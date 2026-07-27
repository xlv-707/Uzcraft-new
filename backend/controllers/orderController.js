const Order = require("../models/Order");

// ==========================================
// CREATE ORDER
// ==========================================

exports.createOrder = async (req, res) => {

    try {

        const order = await Order.create(req.body);

        res.status(201).json({
            success: true,
            message: "Order created successfully.",
            order
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ==========================================
// GET ALL ORDERS
// ==========================================

exports.getOrders = async (req, res) => {

    try {

        const orders = await Order.find()

            .populate("user")

            .populate("products.product")

            .sort({
                createdAt: -1
            });

        res.json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ==========================================
// GET SINGLE ORDER
// ==========================================

exports.getOrder = async (req, res) => {

    try {

        const order = await Order.findById(req.params.id)

            .populate("user")

            .populate("products.product");

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
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

};

// ==========================================
// UPDATE STATUS
// ==========================================

exports.updateOrder = async (req, res) => {

    try {

        const order = await Order.findByIdAndUpdate(

            req.params.id,

            req.body,

            {
                new: true,
                runValidators: true
            }

        );

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        res.json({
            success: true,
            message: "Order updated.",
            order
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ==========================================
// DELETE ORDER
// ==========================================

exports.deleteOrder = async (req, res) => {

    try {

        const order = await Order.findByIdAndDelete(
            req.params.id
        );

        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        res.json({
            success: true,
            message: "Order deleted."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};