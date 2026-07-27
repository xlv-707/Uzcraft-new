const express = require("express");

const router = express.Router();

const {

    getUsers,
    getUser,
    getUserDetail,
    getUserStats,
    getUserOrders,
    getUserActivity,
    getUserSecurity,
    updateUser,
    toggleUserStatus,
    syncCart,
    syncWishlist,
    deleteUser

} = require("../controllers/userController");

// ============================================================
// USERS LIST (CRM)
// ============================================================
router.get("/", getUsers);

// ============================================================
// USER DETAIL PANEL
// ============================================================
router.get("/:id", getUser);
router.get("/:id/detail", getUserDetail);
router.get("/:id/stats", getUserStats);
router.get("/:id/orders", getUserOrders);
router.get("/:id/activity", getUserActivity);
router.get("/:id/security", getUserSecurity);

// ============================================================
// UPDATE / STATUS / CART / WISHLIST
// ============================================================
router.put("/:id", updateUser);
router.patch("/:id/status", toggleUserStatus);
router.post("/:id/cart", syncCart);
router.post("/:id/wishlist", syncWishlist);

// ============================================================
// DELETE
// ============================================================
router.delete("/:id", deleteUser);

module.exports = router;
