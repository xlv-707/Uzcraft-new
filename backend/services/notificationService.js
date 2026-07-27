const Notification = require("../models/Notification");

/**
 * Creates a notification. Pass `userId` for a per-user notification
 * (e.g. order status changed); omit it for a global/admin notification
 * (e.g. settings updated, backup created, server error).
 * Replaces the old createNotification() that wrote to notifications.json.
 */
async function createNotification({
    userId = null,
    orderId = null,
    type = "info",
    title = "Notification",
    message = "",
    source = "system",
    meta = {}
}) {
    return Notification.create({
        userId,
        orderId,
        type,
        title,
        message,
        source,
        meta
    });
}

// The pre-migration frontend (admin/js/app-core.js) reads `item.id` on
// notification objects (it used to be a plain JSON file with numeric ids).
// We keep that contract intact by exposing Mongo's _id as `id` too, instead
// of requiring a frontend rewrite as part of this migration.
function withIdAlias(doc) {
    return { ...doc, id: String(doc._id) };
}

/** Global/admin notifications (no userId) — used by the admin panel bell icon. */
async function getGlobalNotifications({ limit = 300 } = {}) {
    const notifications = await Notification.find({ userId: null })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    return notifications.map(withIdAlias);
}

/** Per-user notifications — used by the client account/order pages. */
async function getUserNotifications(userId) {
    const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .populate("orderId")
        .lean();
    return notifications.map(withIdAlias);
}

async function markAsRead(id) {
    return Notification.findByIdAndUpdate(id, { read: true }, { new: true });
}

async function markAllGlobalAsRead() {
    return Notification.updateMany({ userId: null }, { read: true });
}

async function deleteNotification(id) {
    return Notification.findByIdAndDelete(id);
}

async function deleteAllGlobalNotifications() {
    return Notification.deleteMany({ userId: null });
}

module.exports = {
    createNotification,
    getGlobalNotifications,
    getUserNotifications,
    markAsRead,
    markAllGlobalAsRead,
    deleteNotification,
    deleteAllGlobalNotifications
};
