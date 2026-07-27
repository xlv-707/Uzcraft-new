const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        products: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product"
                },

                quantity: {
                    type: Number,
                    default: 1
                },

                price: {
                    type: Number,
                    required: true
                }
            }
        ],

        totalPrice: {
            type: Number,
            required: true
        },

        paymentMethod: {
            type: String,
            default: "Cash"
        },

        shippingAddress: {
            type: String,
            default: ""
        },

        phone: {
            type: String,
            default: ""
        },

        status: {

            type: String,

            enum: [

                "pending",

                "processing",

                "packed",

                "shipped",

                "out_for_delivery",

                "delivered",

                "cancelled",

                "refunded"

            ],

            default: "pending"

        }

    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);