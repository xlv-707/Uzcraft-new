const express = require("express");

const router = express.Router();

const {
    createProduct,
    getProducts,
    getProductsByCategory,
    getProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

// ===============================
// PRODUCTS
// ===============================

// Barcha mahsulotlar
router.get("/", getProducts);

router.get("/category/:category", getProductsByCategory);

// Bitta mahsulot
router.get("/:id", getProduct);

// Mahsulot qo'shish
router.post("/", createProduct);

// Mahsulotni tahrirlash
router.put("/:id", updateProduct);

// Mahsulotni o'chirish
router.delete("/:id", deleteProduct);

module.exports = router;