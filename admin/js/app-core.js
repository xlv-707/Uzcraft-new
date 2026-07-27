(function () {
    const API_BASE = "http://localhost:3000";
    const SETTINGS_KEY = "uzcraftSettings";
    const LOCAL_NOTIFICATIONS_KEY = "uzcraftLocalNotifications";

    const defaults = {
        general: {
            siteName: "UZCRAFT",
            siteDescription: "Premium handmade crafts from Uzbekistan",
            siteLogo: "",
            siteEmail: "info@uzcraft.com",
            sitePhone: "+998 90 123 45 67",
            siteAddress: "Tashkent, Uzbekistan",
            currency: "USD",
            timezone: "Asia/Tashkent"
        },
        language: "en",
        payment: { stripeEnabled: true, publishableKey: "", secretKey: "", stripeStatus: "disconnected", paypalEnabled: false, codEnabled: true },
        email: { smtpHost: "", smtpPort: 587, smtpEmail: "", smtpPassword: "", orderEmailEnabled: true, statusEmailEnabled: true },
        security: { passwordLength: 8, sessionTimeout: 60, maxLoginAttempts: 5, twoFactorEnabled: false, autoBackups: true },
        userManagement: { registrationEnabled: true, loginEnabled: true, guestCheckoutEnabled: true },
        store: { productsPerPage: 12, defaultSort: "newest", enableReviews: true, showOutOfStock: false },
        shipping: { freeShippingThreshold: 50, defaultShippingRate: 5.99, internationalShipping: true, expressShipping: true },
        advanced: { apiKey: "uzc_demo_key", maintenanceMode: false, debugMode: false },
        pages: {}
    };

    const translations = {
        uz: {
            "Dashboard": "Boshqaruv paneli",
            "Orders": "Buyurtmalar",
            "Users": "Foydalanuvchilar",
            "Products": "Mahsulotlar",
            "Categories": "Kategoriyalar",
            "Messages": "Xabarlar",
            "Reviews": "Sharhlar",
            "Reports": "Hisobotlar",
            "Settings": "Sozlamalar",
            "All Products": "Barcha mahsulotlar",
            "Add Product": "Mahsulot qo'shish",
            "Home": "Bosh sahifa",
            "Collections": "Kolleksiyalar",
            "Collection": "Kolleksiya",
            "About": "Haqida",
            "Contact": "Aloqa",
            "Profile": "Profil",
            "General": "Umumiy",
            "Store": "Do'kon",
            "Pages": "Sahifalar",
            "Payment": "To'lov",
            "Shipping": "Yetkazib berish",
            "Email": "Email",
            "Security": "Xavfsizlik",
            "Advanced": "Qo'shimcha",
            "Danger Zone": "Xavfli bo'lim",
            "Pending": "Kutilmoqda",
            "Processing": "Jarayonda",
            "Shipped": "Yuborildi",
            "Delivered": "Yetkazildi",
            "Cancelled": "Bekor qilindi",
            "Refunded": "Qaytarildi",
            "Save Changes": "Saqlash",
            "Reset": "Qayta tiklash",
            "Clear All": "Hammasini tozalash",
            "Mark all read": "Hammasini o'qilgan qilish",
            "No notifications": "Bildirishnoma yo'q",
            "Login": "Kirish",
            "Register": "Ro'yxatdan o'tish",
            "Search orders...": "Buyurtmalarni qidirish..."
        },
        ru: {
            "Dashboard": "Панель управления",
            "Orders": "Заказы",
            "Users": "Пользователи",
            "Products": "Товары",
            "Categories": "Категории",
            "Messages": "Сообщения",
            "Reviews": "Отзывы",
            "Reports": "Отчеты",
            "Settings": "Настройки",
            "All Products": "Все товары",
            "Add Product": "Добавить товар",
            "Home": "Главная",
            "Collections": "Коллекции",
            "Collection": "Коллекция",
            "About": "О нас",
            "Contact": "Контакты",
            "Profile": "Профиль",
            "General": "Основные",
            "Store": "Магазин",
            "Pages": "Страницы",
            "Payment": "Оплата",
            "Shipping": "Доставка",
            "Email": "Email",
            "Security": "Безопасность",
            "Advanced": "Дополнительно",
            "Danger Zone": "Опасная зона",
            "Pending": "Ожидает",
            "Processing": "В обработке",
            "Shipped": "Отправлен",
            "Delivered": "Доставлен",
            "Cancelled": "Отменен",
            "Refunded": "Возврат",
            "Save Changes": "Сохранить",
            "Reset": "Сбросить",
            "Clear All": "Очистить все",
            "Mark all read": "Отметить прочитанными",
            "No notifications": "Нет уведомлений",
            "Login": "Войти",
            "Register": "Регистрация",
            "Search orders...": "Поиск заказов..."
        },
        en: {}
    };

    function merge(target, source) {
        const output = Array.isArray(target) ? target.slice() : { ...target };
        if (!source || typeof source !== "object") return output;
        Object.entries(source).forEach(([key, value]) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                output[key] = merge(output[key] || {}, value);
            } else {
                output[key] = value;
            }
        });
        return output;
    }

    function getLocalSettings() {
        try {
            return merge(defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
        } catch (error) {
            return merge(defaults, {});
        }
    }

    async function api(path, options = {}) {
        const response = await fetch(API_BASE + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
        let data = null;
        try { data = await response.json(); } catch (error) {}
        if (!response.ok) {
            const message = data?.message || response.statusText || "API error";
            throw new Error(message);
        }
        return data;
    }

    async function loadSettings() {
        try {
            const settings = merge(defaults, await api("/settings"));
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            return settings;
        } catch (error) {
            await notifyError("Server unavailable", error.message, "settings");
            return getLocalSettings();
        }
    }

    async function saveSettings(settings) {
        const merged = merge(getLocalSettings(), settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        const result = await api("/settings", { method: "PUT", body: JSON.stringify(merged) });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(result.settings));
        applySettings(result.settings);
        return result.settings;
    }

    function t(value, lang) {
        const currentLang = lang || getLocalSettings().language || "en";
        return translations[currentLang]?.[value] || value;
    }

    function applyGeneral(settings) {
        const general = settings.general || defaults.general;
        document.title = general.siteName || defaults.general.siteName;
        document.querySelectorAll(".brand-text h1, .logo h2").forEach(node => {
            node.textContent = general.siteName || defaults.general.siteName;
        });
        document.querySelectorAll("[data-site-description]").forEach(node => {
            node.textContent = general.siteDescription || "";
        });
        if (general.siteLogo) {
            document.querySelectorAll(".logo-icon").forEach(node => {
                if (node.tagName.toLowerCase() === "img") {
                    node.src = general.siteLogo;
                }
            });
        }
    }

    function applyLanguage(settings) {
        const lang = settings.language || "en";
        document.documentElement.lang = lang;
        const dictionary = translations[lang] || {};
        if (lang === "en") return;

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                const text = node.textContent.trim();
                return dictionary[text] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const original = node.textContent;
            const trimmed = original.trim();
            node.textContent = original.replace(trimmed, dictionary[trimmed]);
        });

        document.querySelectorAll("input[placeholder]").forEach(input => {
            const key = input.getAttribute("placeholder");
            if (dictionary[key]) input.setAttribute("placeholder", dictionary[key]);
        });
    }

    function applySession(settings) {
        const timeout = Number(settings.security?.sessionTimeout || 0);
        const user = localStorage.getItem("currentUser");
        if (!timeout || !user) return;
        const key = "uzcraftLastActivity";
        const now = Date.now();
        const last = Number(localStorage.getItem(key) || now);
        localStorage.setItem(key, String(now));
        if (now - last > timeout * 60 * 1000) {
            localStorage.removeItem("currentUser");
            if (!location.pathname.includes("/login/")) location.href = "/login/html/index.html";
        }
        ["click", "keydown", "mousemove", "touchstart"].forEach(eventName => {
            document.addEventListener(eventName, () => localStorage.setItem(key, String(Date.now())), { passive: true });
        });
    }

    function getCurrencySymbol(currency) {
        const symbols = { USD: "$", UZS: "so\'m", RUB: "RUB", EUR: "EUR" };
        return symbols[String(currency || "USD").toUpperCase()] || currency || "USD";
    }

    function formatMoney(value, settings = getLocalSettings()) {
        const amount = Number(value || 0);
        const currency = settings.general?.currency || "USD";
        const symbol = getCurrencySymbol(currency);
        if (String(currency).toUpperCase() === "UZS") {
            return amount.toLocaleString("uz-UZ") + " " + symbol;
        }
        return symbol.length <= 2
            ? symbol + amount.toFixed(2)
            : amount.toFixed(2) + " " + symbol;
    }

    function applySettings(settings) {
        const merged = merge(defaults, settings || getLocalSettings());
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        applyGeneral(merged);
        applyLanguage(merged);
        applySession(merged);
        document.dispatchEvent(new CustomEvent("uzcraft:settings-applied", { detail: merged }));
    }

    function readLocalNotifications() {
        try { return JSON.parse(localStorage.getItem(LOCAL_NOTIFICATIONS_KEY)) || []; } catch (error) { return []; }
    }

    function writeLocalNotifications(notifications) {
        localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 100)));
    }

    async function createNotification(payload) {
        const notification = {
            type: payload.type || "info",
            title: payload.title || "Notification",
            message: payload.message || "",
            source: payload.source || "client",
            meta: payload.meta || {},
            read: false,
            createdAt: new Date().toISOString()
        };
        try {
            const result = await api("/notifications", { method: "POST", body: JSON.stringify(notification) });
            await renderNotifications();
            return result.notification;
        } catch (error) {
            const local = readLocalNotifications();
            local.unshift({ ...notification, id: Date.now() });
            writeLocalNotifications(local);
            return notification;
        }
    }

    async function notifyError(title, message, source, meta = {}) {
        return createNotification({ type: "error", title, message, source, meta });
    }

    async function getNotifications() {
        try {
            return await api("/notifications");
        } catch (error) {
            return readLocalNotifications();
        }
    }

    function notificationDropdown() {
        const button = document.querySelector(".notification-btn, [aria-label='Notifications']");
        if (!button) return null;
        const dropdown = button.closest(".dropdown");
        if (!dropdown) return null;
        let menu = dropdown.querySelector(".dropdown-menu");
        if (!menu) {
            menu = document.createElement("div");
            menu.className = "dropdown-menu";
            dropdown.appendChild(menu);
        }
        return { button, menu };
    }

    async function renderNotifications() {
        const target = notificationDropdown();
        if (!target) return;
        const notifications = await getNotifications();
        const unread = notifications.filter(item => !item.read).length;
        const badge = target.button.querySelector(".badge");
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread ? "inline-flex" : "none";
        }
        target.menu.innerHTML = `
            <div class="dropdown-header">
                <h4>Notification Center</h4>
                <p>${unread} unread</p>
            </div>
            <div style="max-height:320px;overflow:auto;">
                ${notifications.length ? notifications.map(item => `
                    <div class="notification-item" data-notification-id="${item.id}" style="padding:10px 16px;border-bottom:1px solid var(--border-color);background:${item.read ? 'transparent' : 'rgba(176,138,90,.08)'};">
                        <strong style="font-size:13px;color:var(--text-primary);">${item.type === 'error' ? 'x ' : ''}${item.title}</strong>
                        <p style="font-size:12px;color:var(--text-muted);margin:3px 0 8px;">${item.message || ''}</p>
                        <div style="display:flex;gap:8px;">
                            <button type="button" data-read-notification="${item.id}" style="border:none;background:var(--bg-tertiary);padding:5px 8px;border-radius:6px;cursor:pointer;">Read</button>
                            <button type="button" data-delete-notification="${item.id}" style="border:none;background:#fee2e2;color:#b91c1c;padding:5px 8px;border-radius:6px;cursor:pointer;">Delete</button>
                        </div>
                    </div>
                `).join('') : `<p style="padding:16px;color:var(--text-muted);">${t("No notifications")}</p>`}
            </div>
            <div class="divider"></div>
            <button type="button" data-read-all-notifications style="width:100%;border:none;background:transparent;text-align:left;padding:10px 16px;cursor:pointer;color:var(--text-secondary);">${t("Mark all read")}</button>
            <button type="button" data-clear-notifications style="width:100%;border:none;background:transparent;text-align:left;padding:10px 16px;cursor:pointer;color:#ef4444;">${t("Clear All")}</button>
        `;
        target.menu.querySelectorAll("[data-read-notification]").forEach(button => button.addEventListener("click", async event => {
            event.stopPropagation();
            await api(`/notifications/${button.dataset.readNotification}/read`, { method: "PATCH" });
            renderNotifications();
        }));
        target.menu.querySelectorAll("[data-delete-notification]").forEach(button => button.addEventListener("click", async event => {
            event.stopPropagation();
            await api(`/notifications/${button.dataset.deleteNotification}`, { method: "DELETE" });
            renderNotifications();
        }));
        target.menu.querySelector("[data-read-all-notifications]")?.addEventListener("click", async event => {
            event.stopPropagation();
            await api("/notifications/read-all", { method: "PATCH" });
            renderNotifications();
        });
        target.menu.querySelector("[data-clear-notifications]")?.addEventListener("click", async event => {
            event.stopPropagation();
            await api("/notifications", { method: "DELETE" });
            renderNotifications();
        });
    }

    function installErrorMonitoring() {
        if (window.__uzcraftMonitoringInstalled) return;
        window.__uzcraftMonitoringInstalled = true;
        const originalConsoleError = console.error.bind(console);
        console.error = function (...args) {
            originalConsoleError(...args);
            const message = args.map(item => item instanceof Error ? item.message : String(item)).join(" ");
            notifyError("Console error", message.slice(0, 300), "console");
        };
        const originalFetch = window.fetch.bind(window);
        window.fetch = async function (...args) {
            try {
                const response = await originalFetch(...args);
                const url = String(args[0]?.url || args[0] || "");
                if (!response.ok && !url.includes("/notifications")) {
                    notifyError("API error", `${response.status} ${response.statusText}: ${url}`, "fetch", { url, status: response.status });
                }
                return response;
            } catch (error) {
                const url = String(args[0]?.url || args[0] || "");
                if (!url.includes("/notifications")) notifyError("Server unavailable", error.message, "fetch", { url });
                throw error;
            }
        };
        window.addEventListener("error", event => {
            notifyError("JavaScript error", event.message, "window", { file: event.filename, line: event.lineno });
        });
        window.addEventListener("unhandledrejection", event => {
            notifyError("JavaScript error", event.reason?.message || String(event.reason), "promise");
        });
    }

    const ready = loadSettings().then(settings => {
        installErrorMonitoring();
        applySettings(settings);
        renderNotifications();
        return settings;
    });

    window.UZCRAFT = {
        API_BASE,
        defaults,
        ready,
        api,
        loadSettings,
        saveSettings,
        getLocalSettings,
        applySettings,
        formatMoney,
        t,
        notify: createNotification,
        notifyError,
        renderNotifications
    };
})();