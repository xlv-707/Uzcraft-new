/**
 * ONE-TIME MIGRATION SCRIPT
 * =========================
 * Moves data still sitting in the legacy JSON files (users.json,
 * products.json, orders.json, chat.json, notifications.json, settings.json)
 * into MongoDB, then it is safe to delete those files.
 *
 * IMPORTANT CONTEXT:
 * The live app (auth/products/orders/chat controllers) already runs on
 * MongoDB via Mongoose. These JSON files are leftovers from an earlier,
 * pre-Mongo version of the project and use their OWN numeric id scheme
 * (e.g. user id `1`), completely disconnected from MongoDB's ObjectIds.
 * This script re-links that old data onto real Mongo documents by matching
 * natural keys (user email, product name+category) instead of assuming the
 * old ids mean anything in Mongo.
 *
 * Run once, manually, after reviewing the summary it prints:
 *   node database/migrateLegacyJson.js
 *
 * It is idempotent: safe to re-run (it matches by email/name before
 * creating anything new), but it does not delete the JSON files itself —
 * that is a deliberate separate step so a human confirms the summary first.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const connectDB = require("../config/db");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Chat = require("../models/Chat");
const Notification = require("../models/Notification");
const settingsService = require("../services/settingsService");

const LEGACY_JSON_DIR = path.join(__dirname, "..", "legacy-json-backup");

const ORDER_STATUSES = ["pending", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded"];
const STATUS_ALIASES = {
    Pending: "pending", Processing: "processing", Shipped: "shipped",
    Delivered: "delivered", Cancelled: "cancelled", Refunded: "refunded",
    completed: "delivered", Completed: "delivered"
};

function normalizeStatus(status) {
    const raw = String(status || "pending").trim();
    const mapped = STATUS_ALIASES[raw] || raw.toLowerCase();
    return ORDER_STATUSES.includes(mapped) ? mapped : "pending";
}

function readLegacyJSON(fileName) {
    const file = path.join(LEGACY_JSON_DIR, fileName);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        console.error(`  ! Could not parse ${fileName}: ${error.message}`);
        return null;
    }
}

async function migrateUsers(legacyUsers) {
    const legacyIdToMongoId = new Map();
    const summary = { matched: 0, created: 0, skipped: 0 };

    for (const legacyUser of legacyUsers || []) {
        if (!legacyUser.email) {
            summary.skipped++;
            continue;
        }
        let user = await User.findOne({ email: legacyUser.email });
        if (user) {
            summary.matched++;
        } else {
            const looksHashed = typeof legacyUser.password === "string" && legacyUser.password.startsWith("$2");
            const hashedPassword = looksHashed
                ? legacyUser.password
                : await bcrypt.hash(String(legacyUser.password || "changeme123"), 10);

            user = await User.create({
                username: legacyUser.username || legacyUser.email,
                email: legacyUser.email,
                password: hashedPassword,
                phone: legacyUser.phone || "",
                address: legacyUser.address || "",
                role: legacyUser.role === "admin" ? "admin" : "client"
            });
            summary.created++;
        }
        legacyIdToMongoId.set(String(legacyUser.id), user._id);
    }

    return { legacyIdToMongoId, summary };
}

async function migrateProducts(legacyProducts) {
    const legacyIdToMongoId = new Map();
    const summary = { matched: 0, created: 0, skipped: 0 };

    for (const legacyProduct of legacyProducts || []) {
        if (!legacyProduct.name || !legacyProduct.category) {
            summary.skipped++;
            continue;
        }
        let product = await Product.findOne({ name: legacyProduct.name, category: legacyProduct.category });
        if (product) {
            summary.matched++;
        } else {
            const images = Array.isArray(legacyProduct.images) ? legacyProduct.images : [];
            product = await Product.create({
                name: legacyProduct.name,
                description: legacyProduct.description || "",
                price: Number(legacyProduct.price) || 0,
                oldPrice: Number(legacyProduct.oldPrice) || 0,
                category: legacyProduct.category,
                stock: Number(legacyProduct.stock) || 0,
                image: images[0] || "",
                gallery: images.slice(1),
                featured: Boolean(legacyProduct.featured),
                status: legacyProduct.status === "inactive" ? "inactive" : "active"
            });
            summary.created++;
        }
        legacyIdToMongoId.set(String(legacyProduct.id), product._id);
    }

    return { legacyIdToMongoId, summary };
}

async function migrateOrders(legacyOrders, productMap) {
    const summary = { created: 0, skippedNoUser: 0, skippedDuplicate: 0 };

    for (const legacyOrder of legacyOrders || []) {
        // Legacy orders were keyed by email, not id — match the user that way.
        const existingUser = await User.findOne({ email: legacyOrder.email });
        const userId = existingUser?._id || null;
        if (!userId) {
            summary.skippedNoUser++;
            continue;
        }

        // Avoid re-inserting the same legacy order on a re-run.
        const alreadyExists = await Order.findOne({
            user: userId,
            totalPrice: Number(legacyOrder.total ?? legacyOrder.totalPrice ?? legacyOrder.product?.price ?? 0),
            createdAt: legacyOrder.createdAt ? new Date(legacyOrder.createdAt) : undefined
        });
        if (alreadyExists) {
            summary.skippedDuplicate++;
            continue;
        }

        const legacyProductId = legacyOrder.product?.id ? String(legacyOrder.product.id) : null;
        const mongoProductId = legacyProductId ? productMap.get(legacyProductId) : null;

        const products = mongoProductId
            ? [{ product: mongoProductId, quantity: Number(legacyOrder.quantity) || 1, price: Number(legacyOrder.product?.price) || 0 }]
            : [];

        await Order.create({
            user: userId,
            products,
            totalPrice: Number(legacyOrder.total ?? legacyOrder.totalPrice ?? legacyOrder.product?.price ?? 0),
            paymentMethod: legacyOrder.paymentMethod || "Cash",
            shippingAddress: legacyOrder.shippingAddress || legacyOrder.address || "",
            phone: legacyOrder.phone || "",
            status: normalizeStatus(legacyOrder.status)
        });
        summary.created++;
    }

    return summary;
}

async function migrateChat(legacyMessages, userMap) {
    const summary = { created: 0, skippedNoUsers: 0 };

    for (const legacyMessage of legacyMessages || []) {
        const senderId = userMap.get(String(legacyMessage.senderId));
        const receiverId = userMap.get(String(legacyMessage.receiverId));
        if (!senderId || !receiverId) {
            summary.skippedNoUsers++;
            continue;
        }
        await Chat.create({
            senderId,
            receiverId,
            senderName: legacyMessage.senderName || "User",
            message: legacyMessage.message,
            timestamp: legacyMessage.timestamp ? new Date(legacyMessage.timestamp) : new Date(),
            read: Boolean(legacyMessage.read)
        });
        summary.created++;
    }

    return summary;
}

async function migrateNotifications(legacyNotifications) {
    const summary = { created: 0 };
    for (const legacyNotification of legacyNotifications || []) {
        await Notification.create({
            userId: null,
            type: legacyNotification.type || "info",
            title: legacyNotification.title || "Notification",
            message: legacyNotification.message || "",
            source: legacyNotification.source || "legacy-migration",
            meta: legacyNotification.meta || {},
            read: Boolean(legacyNotification.read),
            createdAt: legacyNotification.createdAt ? new Date(legacyNotification.createdAt) : new Date()
        });
        summary.created++;
    }
    return summary;
}

async function run() {
    console.log("Connecting to MongoDB...");
    await connectDB();

    console.log("\n== Migrating users.json ==");
    const usersData = readLegacyJSON("users.json");
    const { legacyIdToMongoId: userMap, summary: userSummary } = await migrateUsers(usersData?.users);
    console.log(`  matched=${userSummary.matched} created=${userSummary.created} skipped=${userSummary.skipped}`);

    console.log("\n== Migrating products.json ==");
    const productsData = readLegacyJSON("products.json");
    const { legacyIdToMongoId: productMap, summary: productSummary } = await migrateProducts(productsData?.products);
    console.log(`  matched=${productSummary.matched} created=${productSummary.created} skipped=${productSummary.skipped}`);

    console.log("\n== Migrating orders.json ==");
    const ordersData = readLegacyJSON("orders.json");
    const orderSummary = await migrateOrders(ordersData?.orders, productMap);
    console.log(`  created=${orderSummary.created} skippedNoUser=${orderSummary.skippedNoUser} skippedDuplicate=${orderSummary.skippedDuplicate}`);

    console.log("\n== Migrating chat.json ==");
    const chatData = readLegacyJSON("chat.json");
    const chatSummary = await migrateChat(chatData?.messages, userMap);
    console.log(`  created=${chatSummary.created} skippedNoUsers=${chatSummary.skippedNoUsers}`);

    console.log("\n== Migrating notifications.json ==");
    const notificationsData = readLegacyJSON("notifications.json");
    const notificationSummary = await migrateNotifications(notificationsData?.notifications);
    console.log(`  created=${notificationSummary.created}`);

    console.log("\n== Migrating settings.json ==");
    const settingsData = readLegacyJSON("settings.json");
    if (settingsData) {
        await settingsService.saveSettings(settingsData);
        console.log("  settings merged into MongoDB Settings singleton");
    } else {
        console.log("  no settings.json found, skipped");
    }

    console.log("\nDone. Review the summary above, then you can delete backend/legacy-json-backup/ entirely.");
    process.exit(0);
}

run().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
