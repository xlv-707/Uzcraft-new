const Settings = require("../models/Settings");

const SINGLETON_QUERY = { singleton: "main" };

/**
 * Returns the single settings document, creating it with schema
 * defaults on first use. Replaces the old getSettings()/DEFAULT_SETTINGS
 * JSON-file logic.
 */
async function getSettings() {
    let settings = await Settings.findOne(SINGLETON_QUERY);
    if (!settings) {
        settings = await Settings.create(SINGLETON_QUERY);
    }
    return settings;
}

/**
 * Deep-merges partial input into the existing settings document and saves it.
 * Mirrors the old deepMerge(DEFAULT_SETTINGS, input) behaviour but persists
 * to MongoDB instead of settings.json.
 */
async function saveSettings(partialInput = {}) {
    const settings = await getSettings();

    const mergableSections = [
        "general",
        "payment",
        "email",
        "security",
        "userManagement",
        "store",
        "shipping",
        "advanced"
    ];

    mergableSections.forEach((section) => {
        if (partialInput[section] && typeof partialInput[section] === "object") {
            const current = settings[section] && typeof settings[section].toObject === "function"
                ? settings[section].toObject()
                : settings[section] || {};
            settings[section] = { ...current, ...partialInput[section] };
        }
    });

    if (partialInput.language) settings.language = partialInput.language;
    if (partialInput.pages) settings.pages = { ...settings.pages, ...partialInput.pages };

    // Guard rails that used to live in sanitizeSettingsInput()
    settings.security.passwordLength = Math.max(4, Number(settings.security.passwordLength || 8));
    settings.security.sessionTimeout = Math.max(5, Number(settings.security.sessionTimeout || 60));
    settings.security.maxLoginAttempts = Math.max(1, Number(settings.security.maxLoginAttempts || 5));
    settings.payment.stripeStatus = settings.payment.stripeStatus || "disconnected";

    await settings.save();
    return settings;
}

function isValidStripeKeyPair(publishableKey, secretKey) {
    return (
        /^pk_(test|live)_[A-Za-z0-9_-]{10,}$/.test(String(publishableKey || "")) &&
        /^sk_(test|live)_[A-Za-z0-9_-]{10,}$/.test(String(secretKey || ""))
    );
}

function validateEmailSettings(emailSettings) {
    const port = Number(emailSettings.smtpPort);
    return Boolean(
        emailSettings.smtpHost &&
        Number.isInteger(port) &&
        port > 0 &&
        port <= 65535 &&
        /.+@.+\..+/.test(String(emailSettings.smtpEmail || "")) &&
        emailSettings.smtpPassword
    );
}

async function testStripeConnection({ publishableKey, secretKey }) {
    const settings = await getSettings();
    const pk = publishableKey ?? settings.payment.publishableKey;
    const sk = secretKey ?? settings.payment.secretKey;
    const connected = isValidStripeKeyPair(pk, sk);

    settings.payment.publishableKey = pk;
    settings.payment.secretKey = sk;
    settings.payment.stripeStatus = connected ? "connected" : "failed";
    settings.payment.lastChecked = new Date();
    await settings.save();

    return { connected, settings };
}

async function testEmailConnection(emailInput = {}) {
    const settings = await getSettings();
    settings.email = { ...settings.email, ...emailInput };
    const ok = validateEmailSettings(settings.email);
    settings.email.lastTestStatus = ok ? "sent" : "failed";
    await settings.save();
    return { ok, settings };
}

module.exports = {
    getSettings,
    saveSettings,
    testStripeConnection,
    testEmailConnection,
    validateEmailSettings,
    isValidStripeKeyPair
};
