(function () {
    const $ = id => document.getElementById(id);
    let currentSettings = null;

    function setValue(id, value) {
        const node = $(id);
        if (node) node.value = value ?? "";
    }

    function setChecked(id, value) {
        const node = $(id);
        if (node) node.checked = Boolean(value);
    }

    function value(id) {
        return $(id)?.value?.trim() || "";
    }

    function checked(id) {
        return Boolean($(id)?.checked);
    }

    function toast(message, type = "info") {
        if (typeof window.showToast === "function") window.showToast(message, type);
        else alert(message);
    }

    function stripeStatusText(status) {
        if (status === "connected") return "Connected";
        if (status === "failed") return "Connection Failed";
        return "Not connected";
    }

    function renderStripeStatus(status) {
        const node = $("stripeStatus");
        if (!node) return;
        const connected = status === "connected";
        const failed = status === "failed";
        node.textContent = "? " + stripeStatusText(status);
        node.style.color = connected ? "#16a34a" : failed ? "#dc2626" : "var(--text-muted)";
        node.style.fontWeight = "700";
    }

    function fillSettings(settings) {
        currentSettings = settings;
        const general = settings.general || {};
        setValue("storeName", general.siteName);
        setValue("siteDescription", general.siteDescription);
        setValue("siteLogo", general.siteLogo);
        setValue("storeEmail", general.siteEmail);
        setValue("storePhone", general.sitePhone);
        setValue("storeAddress", general.siteAddress);
        setValue("storeCurrency", general.currency);
        setValue("siteTimezone", general.timezone);
        setValue("storeLanguage", settings.language || "en");

        const store = settings.store || {};
        setValue("storeDescription", general.siteDescription);
        setValue("productsPerPage", store.productsPerPage);
        setValue("defaultSort", store.defaultSort);
        setChecked("enableReviews", store.enableReviews);
        setChecked("showOutOfStock", store.showOutOfStock);

        const payment = settings.payment || {};
        setChecked("stripeEnabled", payment.stripeEnabled);
        setValue("stripePublishable", payment.publishableKey);
        setValue("stripeSecret", payment.secretKey);
        setChecked("paypalEnabled", payment.paypalEnabled);
        setChecked("codEnabled", payment.codEnabled);
        renderStripeStatus(payment.stripeStatus);

        const shipping = settings.shipping || {};
        setValue("freeShippingThreshold", shipping.freeShippingThreshold);
        setValue("defaultShippingRate", shipping.defaultShippingRate);
        setChecked("internationalShipping", shipping.internationalShipping);
        setChecked("expressShipping", shipping.expressShipping);

        const email = settings.email || {};
        setValue("smtpHost", email.smtpHost);
        setValue("smtpPort", email.smtpPort);
        setValue("smtpEmail", email.smtpEmail);
        setValue("smtpPassword", email.smtpPassword);
        setChecked("orderEmailEnabled", email.orderEmailEnabled);
        setChecked("statusEmailEnabled", email.statusEmailEnabled);

        const security = settings.security || {};
        setValue("passwordLength", security.passwordLength);
        setValue("sessionTimeout", security.sessionTimeout);
        setValue("maxLoginAttempts", security.maxLoginAttempts);
        setChecked("twoFactorEnabled", security.twoFactorEnabled);
        setChecked("autoBackups", security.autoBackups);

        const userManagement = settings.userManagement || {};
        setChecked("registrationEnabled", userManagement.registrationEnabled);
        setChecked("loginEnabled", userManagement.loginEnabled);
        setChecked("guestCheckoutEnabled", userManagement.guestCheckoutEnabled);

        const advanced = settings.advanced || {};
        setValue("apiKey", advanced.apiKey);
        setChecked("maintenanceMode", advanced.maintenanceMode);
        setChecked("debugMode", advanced.debugMode);
    }

    function collectSettings(section) {
        const next = JSON.parse(JSON.stringify(currentSettings || window.UZCRAFT.defaults));

        if (section === "general") {
            next.general.siteName = value("storeName");
            next.general.siteDescription = value("siteDescription") || value("storeDescription");
            next.general.siteLogo = value("siteLogo");
            next.general.siteEmail = value("storeEmail");
            next.general.sitePhone = value("storePhone");
            next.general.siteAddress = value("storeAddress");
            next.general.currency = value("storeCurrency");
            next.general.timezone = value("siteTimezone") || "Asia/Tashkent";
            next.language = value("storeLanguage") || "en";
        }

        if (section === "store") {
            next.general.siteDescription = value("storeDescription") || next.general.siteDescription;
            next.store.productsPerPage = Number(value("productsPerPage") || 12);
            next.store.defaultSort = value("defaultSort") || "newest";
            next.store.enableReviews = checked("enableReviews");
            next.store.showOutOfStock = checked("showOutOfStock");
        }

        if (section === "payment") {
            next.payment.stripeEnabled = checked("stripeEnabled");
            next.payment.publishableKey = value("stripePublishable");
            next.payment.secretKey = value("stripeSecret");
            next.payment.paypalEnabled = checked("paypalEnabled");
            next.payment.codEnabled = checked("codEnabled");
        }

        if (section === "shipping") {
            next.shipping.freeShippingThreshold = Number(value("freeShippingThreshold") || 0);
            next.shipping.defaultShippingRate = Number(value("defaultShippingRate") || 0);
            next.shipping.internationalShipping = checked("internationalShipping");
            next.shipping.expressShipping = checked("expressShipping");
        }

        if (section === "email") {
            next.email.smtpHost = value("smtpHost");
            next.email.smtpPort = Number(value("smtpPort") || 587);
            next.email.smtpEmail = value("smtpEmail");
            next.email.smtpPassword = value("smtpPassword");
            next.email.orderEmailEnabled = checked("orderEmailEnabled");
            next.email.statusEmailEnabled = checked("statusEmailEnabled");
        }

        if (section === "security") {
            next.security.passwordLength = Number(value("passwordLength") || 8);
            next.security.sessionTimeout = Number(value("sessionTimeout") || 60);
            next.security.maxLoginAttempts = Number(value("maxLoginAttempts") || 5);
            next.security.twoFactorEnabled = checked("twoFactorEnabled");
            next.security.autoBackups = checked("autoBackups");
            next.userManagement.registrationEnabled = checked("registrationEnabled");
            next.userManagement.loginEnabled = checked("loginEnabled");
            next.userManagement.guestCheckoutEnabled = checked("guestCheckoutEnabled");
        }

        if (section === "advanced") {
            next.advanced.apiKey = value("apiKey");
            next.advanced.maintenanceMode = checked("maintenanceMode");
            next.advanced.debugMode = checked("debugMode");
        }

        return next;
    }

    window.saveSettings = async function (section) {
        try {
            const settings = collectSettings(section);
            currentSettings = await window.UZCRAFT.saveSettings(settings);
            if (section === "payment") await testStripeConnection(false);
            fillSettings(currentSettings);
            toast(section.charAt(0).toUpperCase() + section.slice(1) + " settings saved", "success");
        } catch (error) {
            await window.UZCRAFT.notifyError(section + " settings failed", error.message, "settings");
            toast(error.message || "Failed to save settings", "error");
        }
    };

    window.resetSettings = async function (section) {
        if (!confirm("Reset this section to defaults?")) return;
        const defaults = JSON.parse(JSON.stringify(window.UZCRAFT.defaults));
        const next = JSON.parse(JSON.stringify(currentSettings || defaults));
        if (section === "general") {
            next.general = defaults.general;
            next.language = defaults.language;
        } else if (defaults[section]) {
            next[section] = defaults[section];
        }
        currentSettings = await window.UZCRAFT.saveSettings(next);
        fillSettings(currentSettings);
        toast("Settings reset", "info");
    };

    async function testStripeConnection(showSuccess = true) {
        const payload = {
            publishableKey: value("stripePublishable"),
            secretKey: value("stripeSecret")
        };
        try {
            const result = await window.UZCRAFT.api("/settings/stripe/test", { method: "POST", body: JSON.stringify(payload) });
            renderStripeStatus(result.status);
            if (showSuccess) toast("Stripe successfully connected", "success");
            currentSettings = await window.UZCRAFT.loadSettings();
            return true;
        } catch (error) {
            renderStripeStatus("failed");
            toast("Stripe connection failed", "error");
            await window.UZCRAFT.notifyError("Stripe connection failed", error.message, "payment");
            return false;
        }
    }

    window.sendTestEmail = async function () {
        try {
            const settings = collectSettings("email");
            await window.UZCRAFT.saveSettings(settings);
            await window.UZCRAFT.api("/settings/email/test", { method: "POST", body: JSON.stringify(settings.email) });
            toast("Test email sent successfully", "success");
        } catch (error) {
            await window.UZCRAFT.notifyError("Email test failed", error.message, "email");
            toast(error.message || "Email test failed", "error");
        }
    };

    window.backupNow = async function () {
        try {
            const result = await window.UZCRAFT.api("/backups", { method: "POST", body: "{}" });
            toast("Backup created: " + result.fileName, "success");
            return result;
        } catch (error) {
            await window.UZCRAFT.notifyError("Backup failed", error.message, "backup");
            toast("Backup failed", "error");
        }
    };

    window.exportAllData = async function () {
        const result = await window.backupNow();
        if (result?.fileName) window.open(window.UZCRAFT.API_BASE + "/backups/" + result.fileName, "_blank");
    };

    window.restoreBackup = async function () {
        const input = $("restoreFile");
        if (!input?.files?.length) {
            toast("Select a backup file first", "error");
            return;
        }
        const text = await input.files[0].text();
        const backup = JSON.parse(text);
        await window.UZCRAFT.api("/restore", { method: "POST", body: JSON.stringify({ backup }) });
        currentSettings = await window.UZCRAFT.loadSettings();
        fillSettings(currentSettings);
        toast("Backup restored", "success");
    };

    window.regenerateApiKey = async function () {
        setValue("apiKey", "uzc_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
        await window.saveSettings("advanced");
    };

    window.clearAllData = async function () {
        if (!confirm("Clear all products, orders, customers and chat data?")) return;
        await window.UZCRAFT.api("/danger/clear-data", { method: "POST", body: "{}" });
        toast("All data cleared", "error");
        window.UZCRAFT.renderNotifications();
    };

    window.deleteStore = async function () {
        if (!confirm("Disable the store and enable maintenance mode?")) return;
        currentSettings = (await window.UZCRAFT.api("/danger/delete-store", { method: "POST", body: "{}" })).settings;
        fillSettings(currentSettings);
        toast("Store disabled", "error");
    };

    window.changeLanguage = async function (lang) {
        try {
            if (!currentSettings) currentSettings = await window.UZCRAFT.ready;
            setValue("storeLanguage", lang);
            const next = collectSettings("general");
            next.language = lang;
            currentSettings = await window.UZCRAFT.saveSettings(next);
            fillSettings(currentSettings);
            toast("Language saved", "success");
        } catch (error) {
            await window.UZCRAFT.notifyError("Language save failed", error.message, "settings");
            toast("Language save failed", "error");
        }
    };

    document.addEventListener("DOMContentLoaded", async () => {
        if (!window.UZCRAFT) return;
        currentSettings = await window.UZCRAFT.ready;
        fillSettings(currentSettings);
        $("stripePublishable")?.addEventListener("input", () => renderStripeStatus("disconnected"));
        $("stripeSecret")?.addEventListener("input", () => renderStripeStatus("disconnected"));
        $("testStripeBtn")?.addEventListener("click", () => testStripeConnection(true));
        $("restoreBackupBtn")?.addEventListener("click", window.restoreBackup);
    });
})();