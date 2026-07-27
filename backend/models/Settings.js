const mongoose = require("mongoose");

// Store-wide settings live as a single document in this collection
// (enforced by settingsService, which always upserts the same
// well-known _id). This replaces the old settings.json file.
const SettingsSchema = new mongoose.Schema(
    {
        singleton: {
            type: String,
            default: "main",
            unique: true
        },

        general: {
            siteName: { type: String, default: "UZCRAFT" },
            siteDescription: { type: String, default: "Premium handmade crafts from Uzbekistan" },
            siteLogo: { type: String, default: "" },
            siteEmail: { type: String, default: "info@uzcraft.com" },
            sitePhone: { type: String, default: "+998 90 123 45 67" },
            siteAddress: { type: String, default: "Tashkent, Uzbekistan" },
            currency: { type: String, default: "USD" },
            timezone: { type: String, default: "Asia/Tashkent" }
        },

        language: {
            type: String,
            enum: ["uz", "ru", "en"],
            default: "en"
        },

        payment: {
            stripeEnabled: { type: Boolean, default: true },
            publishableKey: { type: String, default: "" },
            secretKey: { type: String, default: "" },
            stripeStatus: { type: String, default: "disconnected" },
            lastChecked: { type: Date, default: null },
            paypalEnabled: { type: Boolean, default: false },
            codEnabled: { type: Boolean, default: true }
        },

        email: {
            smtpHost: { type: String, default: "" },
            smtpPort: { type: Number, default: 587 },
            smtpEmail: { type: String, default: "" },
            smtpPassword: { type: String, default: "" },
            orderEmailEnabled: { type: Boolean, default: true },
            statusEmailEnabled: { type: Boolean, default: true },
            lastTestStatus: { type: String, default: "not_tested" }
        },

        security: {
            passwordLength: { type: Number, default: 8, min: 4 },
            sessionTimeout: { type: Number, default: 60, min: 5 },
            maxLoginAttempts: { type: Number, default: 5, min: 1 },
            twoFactorEnabled: { type: Boolean, default: false },
            autoBackups: { type: Boolean, default: true }
        },

        userManagement: {
            registrationEnabled: { type: Boolean, default: true },
            loginEnabled: { type: Boolean, default: true },
            guestCheckoutEnabled: { type: Boolean, default: true }
        },

        store: {
            productsPerPage: { type: Number, default: 12 },
            defaultSort: { type: String, default: "newest" },
            enableReviews: { type: Boolean, default: true },
            showOutOfStock: { type: Boolean, default: false }
        },

        shipping: {
            freeShippingThreshold: { type: Number, default: 50 },
            defaultShippingRate: { type: Number, default: 5.99 },
            internationalShipping: { type: Boolean, default: true },
            expressShipping: { type: Boolean, default: true }
        },

        advanced: {
            maintenanceMode: { type: Boolean, default: false },
            debugMode: { type: Boolean, default: false }
        },

        pages: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true,
        minimize: false
    }
);

module.exports = mongoose.model("Settings", SettingsSchema);
