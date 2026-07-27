const mongoose = require("mongoose");

// Unified notification model.
//
// Historically this project had TWO separate notification systems:
//   1. This Mongoose model, used only for per-user order notifications.
//   2. A parallel JSON-file ("notifications.json") system used for global
//      admin/system notifications (new user, low stock, payment events, etc).
// They even had colliding routes (DELETE /notifications/:id was defined
// twice, so the JSON version silently shadowed this one).
//
// This schema now covers both use cases:
//   - Per-user notifications: set `userId` (and optionally `orderId`).
//   - Global/admin notifications: leave `userId` empty and use `source`/`meta`.
const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        message: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            enum: [
                "order",
                "payment",
                "system",
                "promotion",
                "success",
                "error",
                "info",
                "warning"
            ],
            default: "info"
        },

        // Which part of the app raised this notification (admin/global
        // notifications only). E.g. "settings", "payment", "backup", "danger".
        source: {
            type: String,
            default: "system",
            trim: true
        },

        // Free-form structured context (e.g. { path, method } for error logs).
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        read: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    {
        timestamps: true
    }
);

// Fast lookups for "unread notifications for user X" and
// "latest global notifications" (userId: null).
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// The pre-migration admin frontend reads `item.id` (it used to be a plain
// JSON file with numeric ids). Alias _id as id on JSON responses so that
// contract keeps working without a frontend rewrite.
notificationSchema.set("toJSON", {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = String(ret._id);
        return ret;
    }
});

module.exports = mongoose.model("Notification", notificationSchema);
