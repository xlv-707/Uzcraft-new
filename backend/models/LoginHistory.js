const mongoose = require("mongoose");

// ============================================================
// LOGIN HISTORY MODEL
// User Detail -> Security bo'limi uchun
// ============================================================

const LoginHistorySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        success: {
            type: Boolean,
            default: true
        },

        ip: {
            type: String,
            default: ""
        },

        browser: {
            type: String,
            default: ""
        },

        os: {
            type: String,
            default: ""
        },

        userAgent: {
            type: String,
            default: ""
        },

        reason: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

LoginHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("LoginHistory", LoginHistorySchema);
