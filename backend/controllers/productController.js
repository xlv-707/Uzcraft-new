const Product = require("../models/Product");

// ===================================
// CREATE PRODUCT
// ===================================

exports.createProduct = async (req, res) => {
    try {

        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            message: "Mahsulot muvaffaqiyatli qo'shildi.",
            product
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// ===================================
// GET ALL PRODUCTS
// ===================================

exports.getProducts = async (req, res) => {

    try {

        const products = await Product.find().sort({
            createdAt: -1
        });

        res.json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ===================================
// GET SINGLE PRODUCT
// ===================================

exports.getProduct = async (req, res) => {

    try {

        const product = await Product.findById(req.params.id);

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Mahsulot topilmadi."
            });

        }

        res.json({
            success: true,
            product
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ===================================
// UPDATE PRODUCT
// ===================================

exports.updateProduct = async (req, res) => {

    try {

        const product = await Product.findByIdAndUpdate(

            req.params.id,

            req.body,

            {
                new: true,
                runValidators: true
            }

        );

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Mahsulot topilmadi."
            });

        }

        res.json({
            success: true,
            message: "Mahsulot yangilandi.",
            product
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ===================================
// DELETE PRODUCT
// ===================================

exports.deleteProduct = async (req, res) => {

    try {

        const product = await Product.findByIdAndDelete(
            req.params.id
        );

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Mahsulot topilmadi."
            });

        }

        res.json({
            success: true,
            message: "Mahsulot o'chirildi."
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ===================================
// GET PRODUCTS BY CATEGORY
// ===================================

exports.getProductsByCategory = async (req, res) => {

    try {

        const products = await Product.find({
            category: req.params.category
        }).sort({
            createdAt: -1
        });

        res.json(products);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};