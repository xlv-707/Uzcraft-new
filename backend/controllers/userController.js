const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");
const Chat = require("../models/Chat");
const ActivityLog = require("../models/ActivityLog");
const LoginHistory = require("../models/LoginHistory");
const activityService = require("../services/activityService");

const { ObjectId } = mongoose.Types;

// Buyurtma sifatida "aylanma" (revenue) hisoblanadigan statuslar
const REVENUE_STATUSES = ["processing", "packed", "shipped", "out_for_delivery", "delivered"];

// ============================================================
// GET ALL USERS -- Professional CRM ro'yxati
// Query: page, limit, search, role, status, accountStatus, sortBy, sortDir
// ============================================================

exports.getUsers = async (req, res) => {

    try {

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;

        const search = (req.query.search || "").trim();
        const role = (req.query.role || "").trim();
        const status = (req.query.status || "").trim();
        const accountStatus = (req.query.accountStatus || "").trim();

        const sortField = [
            "createdAt", "username", "email", "totalOrders", "totalSpending", "lastSeen"
        ].includes(req.query.sortBy) ? req.query.sortBy : "createdAt";

        const sortDir = req.query.sortDir === "asc" ? 1 : -1;

        const match = {};

        if (role) match.role = role;
        if (status) match.status = status;
        if (accountStatus) match.accountStatus = accountStatus;

        if (req.query.newSince) {
            const since = new Date(req.query.newSince);
            if (!isNaN(since.getTime())) {
                match.createdAt = { $gte: since };
            }
        }

        if (search) {
            const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safe, "i");
            match.$or = [
                { username: regex },
                { fullName: regex },
                { email: regex },
                { phone: regex },
                { city: regex },
                { country: regex }
            ];
        }

        const pipeline = [
            { $match: match },

            // Buyurtmalar bilan bog'lash (Total Orders / Total Spending)
            {
                $lookup: {
                    from: "orders",
                    localField: "_id",
                    foreignField: "user",
                    as: "orders"
                }
            },

            {
                $addFields: {
                    totalOrders: { $size: "$orders" },
                    totalSpending: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$orders",
                                        as: "o",
                                        cond: { $in: ["$$o.status", REVENUE_STATUSES] }
                                    }
                                },
                                as: "o",
                                in: "$$o.totalPrice"
                            }
                        }
                    },
                    wishlistCount: { $size: { $ifNull: ["$wishlist", []] } },
                    cartCount: { $size: { $ifNull: ["$cart", []] } }
                }
            },

            {
                $project: {
                    password: 0,
                    orders: 0
                }
            },

            { $sort: { [sortField]: sortDir, _id: -1 } },

            {
                $facet: {
                    data: [{ $skip: skip }, { $limit: limit }],
                    totalCount: [{ $count: "count" }]
                }
            }
        ];

        const result = await User.aggregate(pipeline);

        const users = result[0]?.data || [];
        const total = result[0]?.totalCount?.[0]?.count || 0;

        res.json({
            success: true,
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// GET SINGLE USER (soddalashtirilgan, eski API bilan mos)
// ============================================================

exports.getUser = async (req, res) => {

    try {

        const user = await User.findById(req.params.id)
            .select("-password");

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        res.json({
            success: true,
            user
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// GET USER DETAIL -- User Detail panel uchun to'liq ma'lumot
// Information + Purchase Statistics birlashtirilgan javob
// ============================================================

exports.getUserDetail = async (req, res) => {

    try {

        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Noto'g'ri ID" });
        }

        const user = await User.findById(userId)
            .select("-password")
            .populate("wishlist.product")
            .populate("cart.product")
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const stats = await buildPurchaseStats(userId);

        const [lastChat, unreadFromUser] = await Promise.all([
            Chat.findOne({
                $or: [{ senderId: userId }, { receiverId: userId }]
            }).sort({ timestamp: -1 }).lean(),

            Chat.countDocuments({
                senderId: userId,
                read: false,
                isDeleted: { $ne: true }
            })
        ]);

        res.json({
            success: true,
            user,
            stats,
            chat: {
                lastMessageAt: lastChat?.timestamp || null,
                lastMessagePreview: lastChat ? lastChat.message.slice(0, 140) : "",
                unreadFromUser
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// GET USER STATS -- faqat Purchase Statistics (yengil so'rov)
// ============================================================

exports.getUserStats = async (req, res) => {

    try {

        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Noto'g'ri ID" });
        }

        const stats = await buildPurchaseStats(userId);

        res.json({
            success: true,
            stats
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// Ichki yordamchi funksiya: Purchase Statistics aggregatsiyasi
async function buildPurchaseStats(userId) {

    const uid = new ObjectId(userId);

    const [statusFacet] = await Order.aggregate([
        { $match: { user: uid } },
        {
            $facet: {
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            completedOrders: {
                                $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
                            },
                            pendingOrders: {
                                $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                            },
                            cancelledOrders: {
                                $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
                            },
                            returnedOrders: {
                                $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] }
                            },
                            totalSpent: {
                                $sum: {
                                    $cond: [
                                        { $in: ["$status", REVENUE_STATUSES] },
                                        "$totalPrice",
                                        0
                                    ]
                                }
                            },
                            lastPurchase: { $max: "$createdAt" }
                        }
                    }
                ],
                categoryBreakdown: [
                    { $unwind: "$products" },
                    {
                        $lookup: {
                            from: "products",
                            localField: "products.product",
                            foreignField: "_id",
                            as: "productInfo"
                        }
                    },
                    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
                    {
                        $group: {
                            _id: "$productInfo.category",
                            qty: { $sum: "$products.quantity" }
                        }
                    },
                    { $sort: { qty: -1 } },
                    { $limit: 1 }
                ],
                favoriteProducts: [
                    { $unwind: "$products" },
                    {
                        $group: {
                            _id: "$products.product",
                            timesOrdered: { $sum: 1 }
                        }
                    },
                    { $match: { timesOrdered: { $gt: 1 } } },
                    { $count: "count" }
                ]
            }
        }
    ]);

    const totals = statusFacet?.totals?.[0] || {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
        totalSpent: 0,
        lastPurchase: null
    };

    const mostPurchasedCategory = statusFacet?.categoryBreakdown?.[0]?._id || "—";
    const favoriteProductsCount = statusFacet?.favoriteProducts?.[0]?.count || 0;

    const user = await User.findById(uid).select("wishlist cart").lean();

    const averageOrderPrice = totals.totalOrders > 0
        ? Math.round((totals.totalSpent / totals.totalOrders) * 100) / 100
        : 0;

    return {
        totalOrders: totals.totalOrders,
        completedOrders: totals.completedOrders,
        pendingOrders: totals.pendingOrders,
        cancelledOrders: totals.cancelledOrders,
        returnedOrders: totals.returnedOrders,
        totalMoneySpent: totals.totalSpent,
        averageOrderPrice,
        mostPurchasedCategory,
        lastPurchase: totals.lastPurchase,
        favoriteProductsCount,
        wishlistCount: user?.wishlist?.length || 0,
        cartCount: user?.cart?.length || 0
    };

}

// ============================================================
// GET USER ORDERS -- Order History (paginatsiya bilan)
// ============================================================

exports.getUserOrders = async (req, res) => {

    try {

        const userId = req.params.id;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
        const skip = (page - 1) * limit;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Noto'g'ri ID" });
        }

        const [orders, total] = await Promise.all([
            Order.find({ user: userId })
                .populate("products.product")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),

            Order.countDocuments({ user: userId })
        ]);

        res.json({
            success: true,
            orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// GET USER ACTIVITY -- Activity Timeline (paginatsiya bilan)
// ============================================================

exports.getUserActivity = async (req, res) => {

    try {

        const userId = req.params.id;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
        const skip = (page - 1) * limit;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Noto'g'ri ID" });
        }

        const [activities, total] = await Promise.all([
            ActivityLog.find({ user: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),

            ActivityLog.countDocuments({ user: userId })
        ]);

        res.json({
            success: true,
            activities,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// GET USER SECURITY -- Login History + xavfsizlik ma'lumotlari
// ============================================================

exports.getUserSecurity = async (req, res) => {

    try {

        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Noto'g'ri ID" });
        }

        const [user, loginHistory] = await Promise.all([
            User.findById(userId).select("accountStatus failedLoginAttempts lastFailedLoginAt passwordChangedAt lastSeen status"),
            LoginHistory.find({ user: userId }).sort({ createdAt: -1 }).limit(50)
        ]);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            accountStatus: user.accountStatus,
            failedLoginAttempts: user.failedLoginAttempts,
            lastFailedLoginAt: user.lastFailedLoginAt,
            passwordChangedAt: user.passwordChangedAt,
            lastLogin: loginHistory.find(l => l.success) || null,
            loginHistory
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// UPDATE USER
// ============================================================

exports.updateUser = async (req, res) => {

    try {

        const data = { ...req.body };

        delete data._id;
        delete data.role;
        delete data.accountStatus;
        delete data.failedLoginAttempts;

        if (!data.password) {
            delete data.password;
        } else {
            const bcrypt = require("bcrypt");
            data.password = await bcrypt.hash(data.password, 10);
            data.passwordChangedAt = new Date();
        }

        const previous = await User.findById(req.params.id).select("address country region city").lean();

        const user = await User.findByIdAndUpdate(

            req.params.id,

            data,

            {
                new: true,
                runValidators: true
            }

        ).select("-password");

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        const addressChanged = previous && (
            previous.address !== user.address ||
            previous.country !== user.country ||
            previous.region !== user.region ||
            previous.city !== user.city
        );

        if (addressChanged) {
            await activityService.logActivity(user._id, "changed_address");
        } else {
            await activityService.logActivity(user._id, "updated_profile");
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// TOGGLE USER ACCOUNT STATUS (active / blocked)
// ============================================================

exports.toggleUserStatus = async (req, res) => {

    try {

        const { accountStatus } = req.body;

        if (!["active", "blocked", "pending"].includes(accountStatus)) {
            return res.status(400).json({
                success: false,
                message: "Noto'g'ri holat qiymati"
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { accountStatus },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ============================================================
// SYNC CART -- Client localStorage'dan serverga sinxronizatsiya
// ============================================================

exports.syncCart = async (req, res) => {

    try {

        const items = Array.isArray(req.body.items) ? req.body.items : [];

        const cart = items
            .filter(i => i && i.productId)
            .map(i => ({
                product: i.productId,
                quantity: Math.max(parseInt(i.quantity) || 1, 1)
            }));

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { cart },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, cartCount: user.cart.length });

    } catch (error) {

        res.status(500).json({ success: false, message: error.message });

    }

};

// ============================================================
// SYNC WISHLIST -- Client localStorage'dan serverga sinxronizatsiya
// ============================================================

exports.syncWishlist = async (req, res) => {

    try {

        const items = Array.isArray(req.body.items) ? req.body.items : [];

        const wishlist = items
            .filter(i => i && i.productId)
            .map(i => ({ product: i.productId }));

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { wishlist },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, wishlistCount: user.wishlist.length });

    } catch (error) {

        res.status(500).json({ success: false, message: error.message });

    }

};

// ============================================================
// DELETE USER
// ============================================================

exports.deleteUser = async (req, res) => {

    try {

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        res.json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};
