const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    senderName: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    delivered: {
        type: Boolean,
        default: false,
        index: true
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date,
        default: null
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        default: null
    },
    attachments: [{
        filename: String,
        originalName: String,
        size: Number,
        type: String,
        url: String,
        path: String,
        fileType: {
            type: String,
            enum: ['image', 'video', 'audio', 'document', 'spreadsheet', 'presentation', 'archive', 'other']
        }
    }],
    reactions: {
        type: Map,
        of: Number,
        default: {}
    },
    pinned: {
        type: Boolean,
        default: false,
        index: true
    },
    forwarded: {
        type: Boolean,
        default: false
    },
    originalSender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, {
    timestamps: true
});

// Indexes
chatSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
chatSchema.index({ receiverId: 1, read: 1 });
chatSchema.index({ message: 'text' });

module.exports = mongoose.model("Chat", chatSchema);