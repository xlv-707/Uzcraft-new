const mongoose = require("mongoose");

// ============================================================
// ACTIVITY LOG MODEL
// Foydalanuvchi Activity Timeline uchun (User Detail -> Activity)
// ============================================================

const ActivityLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: [
                "registered",
                "login",
                "logout",
                "updated_profile",
                "added_to_cart",
                "removed_from_cart",
                "added_to_wishlist",
                "removed_from_wishlist",
                "placed_order",
                "payment_completed",
                "order_status_changed",
                "order_delivered",
                "order_cancelled",
                "opened_chat",
                "sent_message",
                "changed_address",
                "changed_password",
                "other"
            ],
            default: "other"
        },

        description: {
            type: String,
            default: ""
        },

        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

ActivityLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
