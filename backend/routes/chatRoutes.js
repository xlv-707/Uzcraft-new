const express = require("express");
const router = express.Router();

const {
    sendMessage,
    getMessages,
    getConversation,
    readMessage,
    getUnreadCount,
    markAsDelivered,
    editMessage,
    deleteMessage,
    togglePin,
    addReaction,
    removeReaction,
    forwardMessage,
    searchMessages,
    getStats
} = require("../controllers/chatController");

// ======================================
// MAVJUD CHAT ROUTES
// ======================================

// Send message
router.post("/send", sendMessage);

// User messages
router.get("/messages/:userId", getMessages);

// Conversation
router.get("/conversation/:user1/:user2", getConversation);

// Read message
router.put("/read/:id", readMessage);

// Unread count
router.get("/unread/:userId", getUnreadCount);

// ======================================
// YANGI CHAT ROUTES
// ======================================

// Delivered status
router.put("/delivered/:messageId", markAsDelivered);

// Edit message (15 min limit)
router.put("/edit/:messageId", editMessage);

// Delete message
router.delete("/delete/:messageId", deleteMessage);

// Pin / Unpin message
router.put("/pin/:messageId", togglePin);

// Add reaction
router.post("/reaction/:messageId", addReaction);

// Remove reaction
router.delete("/reaction/:messageId", removeReaction);

// Forward message
router.post("/forward/:messageId", forwardMessage);

// Search messages
router.get("/search/:userId", searchMessages);

// Chat statistics
router.get("/stats/:userId", getStats);

module.exports = router;