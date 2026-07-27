const express = require("express");
const router = express.Router();

const {
    getGlobalNotifications,
    createGlobalNotification,
    markAllGlobalAsRead,
    deleteAllGlobalNotifications,
    getUserNotifications,
    markAsRead,
    deleteNotification
} = require("../controllers/notificationController");

// ======================================
// GLOBAL / ADMIN NOTIFICATIONS
// (bell icon in admin/js/app-core.js, contact form in client/js/client-actions.js)
// ======================================

router.get("/notifications", getGlobalNotifications);
router.post("/notifications", createGlobalNotification);
router.patch("/notifications/read-all", markAllGlobalAsRead);
router.delete("/notifications", deleteAllGlobalNotifications);
router.patch("/notifications/:id/read", markAsRead);

// ======================================
// PER-USER NOTIFICATIONS
// (client/profile/main.js)
// ======================================

router.get("/notifications/:userId", getUserNotifications);
router.put("/notifications/read/:id", markAsRead);

// ======================================
// SHARED
// ======================================

router.delete("/notifications/:id", deleteNotification);

module.exports = router;
