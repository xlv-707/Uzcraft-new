const Chat = require("../models/Chat");
const mongoose = require("mongoose");

// ======================================
// MAVJUD FUNKSIYALAR
// ======================================

exports.sendMessage = async (req, res) => {
    try {
        const { senderId, receiverId, senderName, message, replyTo, attachments } = req.body;

        if (!senderId || !receiverId || !message) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const chat = await Chat.create({
            senderId,
            receiverId,
            senderName,
            message,
            replyTo: replyTo || null,
            attachments: attachments || [],
            read: false,
            delivered: false,
            isDeleted: false,
            isEdited: false,
            reactions: {},
            timestamp: new Date()
        });

        const io = req.app.get('io');
        if (io) {
            io.to(receiverId).emit('new-chat-message', chat);
            io.to(senderId).emit('new-chat-message', chat);
        }

        res.status(201).json({
            success: true,
            chat
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const messages = await Chat.find({
            $or: [
                { senderId: req.params.userId },
                { receiverId: req.params.userId }
            ],
            isDeleted: { $ne: true }
        }).sort({ createdAt: -1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getConversation = async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const messages = await Chat.find({
            $or: [
                { senderId: user1, receiverId: user2 },
                { senderId: user2, receiverId: user1 }
            ],
            isDeleted: { $ne: true }
        })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.readMessage = async (req, res) => {
    try {
        const message = await Chat.findByIdAndUpdate(
            req.params.id,
            { read: true },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(message.senderId.toString()).emit('message-read', {
                messageId: message._id,
                readerId: message.receiverId
            });
        }

        res.json({
            success: true,
            message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await Chat.countDocuments({
            receiverId: req.params.userId,
            read: false,
            isDeleted: { $ne: true }
        });

        res.json({
            unreadCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ======================================
// YANGI FUNKSIYALAR
// ======================================

exports.markAsDelivered = async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Chat.findByIdAndUpdate(
            messageId,
            { delivered: true },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(message.senderId.toString()).emit('message-delivered', {
                messageId: message._id
            });
        }

        res.json({ success: true, message });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message content is required'
            });
        }

        const existing = await Chat.findById(messageId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        const now = Date.now();
        const msgTime = new Date(existing.timestamp || existing.createdAt).getTime();
        if (now - msgTime > 15 * 60 * 1000) {
            return res.status(400).json({
                success: false,
                error: 'Edit window expired (15 minutes)'
            });
        }

        existing.message = message.trim();
        existing.isEdited = true;
        existing.editedAt = new Date();
        await existing.save();

        const io = req.app.get('io');
        if (io) {
            io.to(existing.senderId.toString()).emit('message-edit', {
                messageId: existing._id,
                newMessage: existing.message,
                editedAt: existing.editedAt
            });
            io.to(existing.receiverId.toString()).emit('message-edit', {
                messageId: existing._id,
                newMessage: existing.message,
                editedAt: existing.editedAt
            });
        }

        res.json({ success: true, message: existing });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { forEveryone } = req.body;

        const message = await Chat.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        if (forEveryone) {
            message.isDeleted = true;
            message.message = 'This message was deleted';
            await message.save();
        } else {
            await Chat.findByIdAndDelete(messageId);
        }

        const io = req.app.get('io');
        if (io) {
            io.to(message.senderId.toString()).emit('message-delete', {
                messageId: message._id,
                forEveryone
            });
            io.to(message.receiverId.toString()).emit('message-delete', {
                messageId: message._id,
                forEveryone
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.togglePin = async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Chat.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        message.pinned = !message.pinned;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.senderId.toString()).emit('message-pin', {
                messageId: message._id,
                pinned: message.pinned
            });
            io.to(message.receiverId.toString()).emit('message-pin', {
                messageId: message._id,
                pinned: message.pinned
            });
        }

        res.json({
            success: true,
            pinned: message.pinned
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.addReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;

        if (!reaction) {
            return res.status(400).json({
                success: false,
                error: 'Reaction is required'
            });
        }

        const message = await Chat.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        if (!message.reactions) {
            message.reactions = {};
        }
        message.reactions[reaction] = (message.reactions[reaction] || 0) + 1;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.senderId.toString()).emit('message-reaction', {
                messageId: message._id,
                reaction,
                action: 'add'
            });
            io.to(message.receiverId.toString()).emit('message-reaction', {
                messageId: message._id,
                reaction,
                action: 'add'
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.removeReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;

        const message = await Chat.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        if (message.reactions && message.reactions[reaction]) {
            message.reactions[reaction]--;
            if (message.reactions[reaction] <= 0) {
                delete message.reactions[reaction];
            }
            await message.save();
        }

        const io = req.app.get('io');
        if (io) {
            io.to(message.senderId.toString()).emit('message-reaction', {
                messageId: message._id,
                reaction,
                action: 'remove'
            });
            io.to(message.receiverId.toString()).emit('message-reaction', {
                messageId: message._id,
                reaction,
                action: 'remove'
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.forwardMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                error: 'Target user ID is required'
            });
        }

        const original = await Chat.findById(messageId);
        if (!original) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        const forwarded = new Chat({
            senderId: original.senderId,
            receiverId: new mongoose.Types.ObjectId(targetUserId),
            senderName: original.senderName,
            message: original.message,
            attachments: original.attachments || [],
            timestamp: new Date(),
            read: false,
            delivered: false,
            isDeleted: false,
            isEdited: false,
            forwarded: true,
            originalSender: original.senderId,
            reactions: {}
        });

        await forwarded.save();

        const io = req.app.get('io');
        if (io) {
            io.to(targetUserId).emit('new-chat-message', forwarded);
        }

        res.json({
            success: true,
            message: forwarded
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const { q } = req.query;

        if (!q || !q.trim()) {
            return res.json([]);
        }

        const messages = await Chat.find({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ],
            message: { $regex: q.trim(), $options: 'i' },
            isDeleted: { $ne: true }
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

        res.json(messages);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const total = await Chat.countDocuments({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ],
            isDeleted: { $ne: true }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = await Chat.countDocuments({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ],
            timestamp: { $gte: today },
            isDeleted: { $ne: true }
        });

        const unread = await Chat.countDocuments({
            receiverId: userId,
            read: false,
            isDeleted: { $ne: true }
        });

        res.json({
            total,
            today: todayCount,
            unread
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};