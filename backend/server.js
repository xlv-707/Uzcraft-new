require("dotenv").config();
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const backupRoutes = require("./routes/backupRoutes");
const notificationService = require("./services/notificationService");
const Product = require("./models/Product");
const Order = require("./models/Order");
const User = require("./models/User");
const Chat = require("./models/Chat");
const Review = require("./models/Review");
const activityService = require("./services/activityService");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();

const server = http.createServer(app);

// ============================================================
// SOCKET.IO - YANGILANGAN (MAVJUD FUNKSIYALAR SAQLANGAN)
// ============================================================
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    },
    transports: ['websocket', 'polling']
});

// ============================================================
// ONLINE USERS TRACKING (YANGI)
// ============================================================
const onlineUsers = new Map();
const userSockets = new Map();

io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);
    let userId = null;

    // ============================================================
    // JOIN - MAVJUD (KENGAYTIRILGAN)
    // ============================================================
    socket.on("join", (joinedUserId) => {
        socket.join(joinedUserId);
        userId = joinedUserId;
        console.log(`👤 User ${joinedUserId} joined room`);
        
        // Yangi: Online users tracking
        onlineUsers.set(joinedUserId, {
            status: 'online',
            lastSeen: new Date(),
            socketId: socket.id
        });
        userSockets.set(joinedUserId, socket.id);
        
        // Broadcast presence
        io.emit("user-presence", {
            userId: joinedUserId,
            status: 'online',
            lastSeen: new Date()
        });

        // DB'da ham holatni saqlaymiz (Users CRM "Status" ustuni uchun)
        if (mongoose.Types.ObjectId.isValid(joinedUserId)) {
            User.findByIdAndUpdate(joinedUserId, {
                status: 'online',
                lastSeen: new Date()
            }).catch(() => {});
        }
    });

    // ============================================================
    // CHAT MESSAGE - MAVJUD (KENGAYTIRILGAN)
    // ============================================================
    socket.on("chat-message", (data) => {
        // Mavjud funksiya
        io.to(data.receiverId).emit("new-chat-message", data);
        
        // Yangi: Sender uchun ham emit
        io.to(data.senderId).emit("new-chat-message", data);

        // Activity Timeline uchun
        if (data.senderId && mongoose.Types.ObjectId.isValid(data.senderId)) {
            activityService.logActivity(data.senderId, "sent_message", {
                meta: { receiverId: data.receiverId }
            });
        }
    });

    // ============================================================
    // TYPING INDICATOR (YANGI)
    // ============================================================
    socket.on("typing", (data) => {
        const { senderId, receiverId, senderName, isTyping } = data;
        io.to(receiverId).emit("typing", {
            senderId,
            senderName,
            isTyping
        });
    });

    // ============================================================
    // USER PRESENCE (YANGI)
    // ============================================================
    socket.on("user-presence", (data) => {
        const { userId, status } = data;
        if (status === 'online') {
            onlineUsers.set(userId, {
                status: 'online',
                lastSeen: new Date(),
                socketId: socket.id
            });
        } else {
            onlineUsers.delete(userId);
        }
        
        socket.broadcast.emit("user-presence", {
            userId,
            status,
            lastSeen: new Date()
        });
    });

    // ============================================================
    // MESSAGE READ (YANGI)
    // ============================================================
    socket.on("message-read", (data) => {
        const { messageId, readerId } = data;
        socket.broadcast.emit("message-read", {
            messageId,
            readerId
        });
    });

    // ============================================================
    // MESSAGE DELIVERED (YANGI)
    // ============================================================
    socket.on("message-delivered", (data) => {
        const { messageId } = data;
        socket.broadcast.emit("message-delivered", {
            messageId
        });
    });

    // ============================================================
    // MESSAGE REACTION (YANGI)
    // ============================================================
    socket.on("message-reaction", (data) => {
        const { messageId, reaction, action } = data;
        socket.broadcast.emit("message-reaction", {
            messageId,
            reaction,
            action
        });
    });

    // ============================================================
    // MESSAGE DELETE (YANGI)
    // ============================================================
    socket.on("message-delete", (data) => {
        const { messageId, forEveryone, senderId } = data;
        socket.broadcast.emit("message-delete", {
            messageId,
            forEveryone,
            senderId
        });
    });

    // ============================================================
    // MESSAGE EDIT (YANGI)
    // ============================================================
    socket.on("message-edit", (data) => {
        const { messageId, newMessage, editedAt } = data;
        socket.broadcast.emit("message-edit", {
            messageId,
            newMessage,
            editedAt
        });
    });

    // ============================================================
    // MESSAGE PIN (YANGI)
    // ============================================================
    socket.on("message-pin", (data) => {
        const { messageId, pinned } = data;
        socket.broadcast.emit("message-pin", {
            messageId,
            pinned
        });
    });

    // ============================================================
    // DISCONNECT - MAVJUD (KENGAYTIRILGAN)
    // ============================================================
    socket.on("disconnect", () => {
        console.log("🔴 Client disconnected:", socket.id);
        
        // Yangi: Offline status
        if (userId) {
            userSockets.delete(userId);
            onlineUsers.delete(userId);
            
            socket.broadcast.emit("user-presence", {
                userId: userId,
                status: 'offline',
                lastSeen: new Date()
            });

            // DB'da ham holatni saqlaymiz (Users CRM "Status" ustuni uchun)
            if (mongoose.Types.ObjectId.isValid(userId)) {
                User.findByIdAndUpdate(userId, {
                    status: 'offline',
                    lastSeen: new Date()
                }).catch(() => {});
            }
        }
    });

    // ============================================================
    // ERROR HANDLING (YANGI)
    // ============================================================
    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });
});

// ============================================================
// MAKE IO AVAILABLE IN ROUTES (YANGI)
// ============================================================
app.set('io', io);

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, "..");

app.use(cors());
app.use(express.json({ limit: "80mb" }));
app.use(express.urlencoded({ extended: true, limit: "80mb" }));
app.use("/admin", express.static(path.join(ROOT_DIR, "admin")));
app.use("/client", express.static(path.join(ROOT_DIR, "client")));
app.use("/login", express.static(path.join(ROOT_DIR, "login")));
app.use("/img", express.static(path.join(ROOT_DIR, "img")));

// ============================================================
// UPLOADS FOLDER (YANGI)
// ============================================================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

app.use(authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/orders", orderRoutes);
app.use(settingsRoutes);
app.use(notificationRoutes);
app.use(backupRoutes);

// ============================================================
// YANGI API ENDPOINTLAR
// ============================================================

// ============================================================
// GET ONLINE USERS (YANGI)
// ============================================================
app.get("/api/online-users", (req, res) => {
    const users = Array.from(onlineUsers.keys());
    res.json({
        success: true,
        onlineUsers: users,
        count: users.length
    });
});

// ============================================================
// GET USER PRESENCE (YANGI)
// ============================================================
app.get("/api/user-presence/:userId", (req, res) => {
    const userId = req.params.userId;
    const presence = onlineUsers.get(userId);
    res.json({
        success: true,
        userId,
        status: presence ? 'online' : 'offline',
        lastSeen: presence?.lastSeen || null
    });
});

// ============================================================
// CHAT STATISTICS (YANGI)
// ============================================================
app.get("/api/chat/stats/:userId", async (req, res) => {
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
            success: true,
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
});

// ============================================================
// SEARCH MESSAGES (YANGI)
// ============================================================
app.get("/api/chat/search/:userId", async (req, res) => {
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
});

// ============================================================
// FILE UPLOAD (YANGI)
// ============================================================
const multer = require("multer");

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-rar-compressed',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/webm'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = file.mimetype.split('/')[0];
        const subDir = path.join(uploadDir, type);
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
        }
        cb(null, subDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, safeName + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

app.post("/api/chat/upload", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const file = req.file;
        const fileUrl = `/uploads/${file.mimetype.split('/')[0]}/${file.filename}`;

        res.json({
            success: true,
            file: {
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
                type: file.mimetype,
                url: fileUrl,
                path: file.path
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// ORDER STATUS UPDATE WITH SOCKET (YANGILANGAN)
// ============================================================
app.put("/orders/:id/status", async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        await notificationService.createNotification({
            userId: order.user,
            orderId: order._id,
            title: "Order Status Updated",
            message: `Your order status has been changed to ${order.status}.`,
            type: "order"
        });

        await activityService.logActivity(
            order.user,
            order.status === "delivered" ? "order_delivered"
                : order.status === "cancelled" ? "order_cancelled"
                : "order_status_changed",
            { meta: { orderId: order._id, status: order.status } }
        );

        // Socket emit (mavjud)
        io.to(order.user.toString()).emit("order-status-updated", {
            orderId: order._id,
            status: order.status,
            message: `Your order status changed to ${order.status}`
        });

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// MAVJUD CREATE ORDER
// ============================================================
app.post("/create-order", async (req, res) => {
    try {
        const {
            user,
            products,
            totalPrice,
            paymentMethod,
            shippingAddress,
            phone,
            status
        } = req.body;

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User is required"
            });
        }

        if (!products || !products.length) {
            return res.status(400).json({
                success: false,
                message: "Products are required"
            });
        }

        const order = await Order.create({
            user,
            products,
            totalPrice,
            paymentMethod,
            shippingAddress,
            phone,
            status: (status || "pending").toLowerCase()
        });

        const newOrder = await Order.findById(order._id)
            .populate("user")
            .populate("products.product");

        await activityService.logActivity(user, "placed_order", {
            meta: { orderId: order._id, totalPrice: order.totalPrice }
        });

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            order: newOrder
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user")
            .populate("products.product")
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/orders/user/:email", async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user")
            .populate("products.product")
            .sort({ createdAt: -1 });

        const userOrders = orders.filter(order =>
            order.user &&
            order.user.email === req.params.email
        );

        res.json(userOrders);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.put("/order-status/:id", async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/orders/:id", async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("user")
            .populate("products.product");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.put("/orders/:id", async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
        .populate("user")
        .populate("products.product");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            message: "Order updated successfully",
            order
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.delete("/orders/:id", async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }
        res.json({
            success: true,
            message: "Order deleted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post("/reviews", async (req, res) => {
    try {
        const {
            user,
            product,
            rating,
            comment
        } = req.body;

        if (!user || !product || !rating || !comment) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const review = await Review.create({
            user,
            product,
            rating,
            comment
        });

        res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            review
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/reviews/:productId", async (req, res) => {
    try {
        const reviews = await Review.find({
            product: req.params.productId,
            approved: true
        })
        .populate("user", "username")
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/dashboard-stats", async (req, res) => {
    try {
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            pendingOrders,
            processingOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            refundedOrders
        ] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Order.countDocuments(),
            Order.countDocuments({ status: "pending" }),
            Order.countDocuments({ status: "processing" }),
            Order.countDocuments({ status: "shipped" }),
            Order.countDocuments({ status: "delivered" }),
            Order.countDocuments({ status: "cancelled" }),
            Order.countDocuments({ status: "refunded" })
        ]);

        const revenueData = await Order.aggregate([
            {
                $match: {
                    status: {
                        $in: ["processing", "shipped", "delivered"]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: "$totalPrice"
                    }
                }
            }
        ]);

        res.json({
            success: true,
            totalUsers,
            totalProducts,
            totalOrders,
            pendingOrders,
            processingOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            refundedOrders,
            totalRevenue: revenueData[0]?.totalRevenue || 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error(err);
    notificationService
        .createNotification({
            type: "error",
            title: "Server error",
            message: err.message || "Unexpected server error",
            source: "server",
            meta: { path: req.path, method: req.method }
        })
        .catch((notifyError) => console.error("Failed to log error notification:", notifyError));
    res.status(500).json({ success: false, message: "Server unavailable" });
});

// ============================================================
// CONNECT DB & START SERVER
// ============================================================
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📡 Socket.IO ready`);
        console.log(`👥 Online users tracking enabled`);
    });
});