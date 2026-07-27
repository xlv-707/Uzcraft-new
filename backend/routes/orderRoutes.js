const express = require("express");

const router = express.Router();

const {

    createOrder,

    getOrders,

    getOrder,

    updateOrder,

    deleteOrder

} = require("../controllers/orderController");

// ======================================
// ORDERS
// ======================================

// CREATE
router.post("/", createOrder);

// GET ALL
router.get("/", getOrders);

// GET ONE
router.get("/:id", getOrder);

// UPDATE
router.put("/:id", updateOrder);

// DELETE
router.delete("/:id", deleteOrder);

module.exports = router;