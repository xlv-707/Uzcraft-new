const notificationService = require("../services/notificationService");

// ==========================================
// GLOBAL / ADMIN NOTIFICATIONS  (was: notifications.json)
// ==========================================

exports.getGlobalNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.getGlobalNotifications();
        res.json({ success: true, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createGlobalNotification = async (req, res) => {
    try {
        const notification = await notificationService.createNotification(req.body || {});
        res.status(201).json({ success: true, notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAllGlobalAsRead = async (req, res) => {
    try {
        await notificationService.markAllGlobalAsRead();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAllGlobalNotifications = async (req, res) => {
    try {
        await notificationService.deleteAllGlobalNotifications();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// PER-USER NOTIFICATIONS  (existing Mongoose feature)
// ==========================================

exports.getUserNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.getUserNotifications(req.params.userId);
        res.json({ success: true, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// SHARED BY ID  (works for both global and per-user notifications)
// ==========================================

exports.markAsRead = async (req, res) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id);
        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const notification = await notificationService.deleteNotification(req.params.id);
        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
