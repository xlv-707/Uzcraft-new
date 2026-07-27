const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            default: ""
        },

        price: {
            type: Number,
            required: true
        },

        oldPrice: {
            type: Number,
            default: 0
        },

        category: {
            type: String,
            required: true
        },

        stock: {
            type: Number,
            default: 0
        },

        image: {
            type: String,
            default: ""
        },

        gallery: {
            type: [String],
            default: []
        },

        rating: {
            type: Number,
            default: 5
        },

        reviews: {
            type: Number,
            default: 0
        },

        featured: {
            type: Boolean,
            default: false
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);