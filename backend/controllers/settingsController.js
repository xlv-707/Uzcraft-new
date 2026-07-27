const settingsService = require("../services/settingsService");
const notificationService = require("../services/notificationService");

// GET /settings — returns the raw settings object (not wrapped), matching
// the original settings.json contract that admin/js/app-core.js expects.
exports.getSettings = async (req, res) => {
    try {
        const settings = await settingsService.getSettings();
        res.json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const settings = await settingsService.saveSettings(req.body || {});
        await notificationService.createNotification({
            type: "success",
            title: "Settings updated",
            message: "Admin settings were saved successfully",
            source: "settings"
        });
        res.json({ success: true, settings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.testStripe = async (req, res) => {
    try {
        const { connected } = await settingsService.testStripeConnection(req.body || {});
        await notificationService.createNotification({
            type: connected ? "success" : "error",
            title: connected ? "Stripe successfully connected" : "Stripe connection failed",
            message: connected ? "Stripe successfully connected" : "Stripe connection failed",
            source: "payment"
        });
        res.status(connected ? 200 : 400).json({
            success: connected,
            status: connected ? "connected" : "failed",
            message: connected ? "Stripe successfully connected" : "Stripe connection failed"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.testEmail = async (req, res) => {
    try {
        const { ok, settings } = await settingsService.testEmailConnection(req.body || {});
        await notificationService.createNotification({
            type: ok ? "success" : "error",
            title: ok ? "Test email sent" : "Test email failed",
            message: ok ? `Test email accepted for ${settings.email.smtpEmail}` : "SMTP settings are incomplete or invalid",
            source: "email"
        });
        res.status(ok ? 200 : 400).json({
            success: ok,
            message: ok ? "Test email sent successfully" : "Email settings are invalid"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
