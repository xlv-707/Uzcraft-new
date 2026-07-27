const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
{
    // ============================
    // ASOSIY MA'LUMOTLAR
    // ============================
    username: {
        type: String,
        required: true
    },

    fullName: {
        type: String,
        default: ""
    },

    avatar: {
        type: String,
        default: ""
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        default: ""
    },

    // ============================
    // MANZIL
    // ============================
    address: {
        type: String,
        default: ""
    },

    country: {
        type: String,
        default: ""
    },

    region: {
        type: String,
        default: ""
    },

    city: {
        type: String,
        default: ""
    },

    // ============================
    // ROL VA HOLAT
    // ============================
    role: {
        type: String,
        default: "client"
    },

    status: {
        type: String,
        enum: ["online", "offline"],
        default: "offline"
    },

    lastSeen: {
        type: Date,
        default: Date.now
    },

    accountStatus: {
        type: String,
        enum: ["active", "blocked", "pending"],
        default: "active"
    },

    // ============================
    // XAVFSIZLIK
    // ============================
    failedLoginAttempts: {
        type: Number,
        default: 0
    },

    lastFailedLoginAt: {
        type: Date,
        default: null
    },

    passwordChangedAt: {
        type: Date,
        default: null
    },

    // ============================
    // WISHLIST / CART (server-side sync)
    // ============================
    wishlist: {
        type: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product"
                },
                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        default: []
    },

    cart: {
        type: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product"
                },
                quantity: {
                    type: Number,
                    default: 1
                },
                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        default: []
    }

},
{
    timestamps: true
});

// Qidiruv (search) tezligi uchun indekslar
UserSchema.index({ username: "text", fullName: "text", email: "text", phone: "text" });
UserSchema.index({ role: 1 });
UserSchema.index({ accountStatus: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", UserSchema);
