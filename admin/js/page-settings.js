(function () {
    const STORAGE_KEY = 'uzcraftPageSettings';
    const pages = [
    {
        "key": "admin-dashboard",
        "area": "Admin",
        "title": "Dashboard",
        "path": "/admin/html/dashboard.html"
    },
    {
        "key": "admin-all-products",
        "area": "Admin",
        "title": "All Products",
        "path": "/admin/html/all-products.html"
    },
    {
        "key": "admin-add-product",
        "area": "Admin",
        "title": "Add Product",
        "path": "/admin/html/admin-product-stock.html"
    },
    {
        "key": "admin-orders",
        "area": "Admin",
        "title": "Orders",
        "path": "/admin/html/orders.html"
    },
    {
        "key": "admin-users",
        "area": "Admin",
        "title": "Users",
        "path": "/admin/html/users.html"
    },
    {
        "key": "admin-settings",
        "area": "Admin",
        "title": "Settings",
        "path": "/admin/html/settings.html",
        "locked": true
    },
    {
        "key": "client-home",
        "area": "Client",
        "title": "Home",
        "path": "/client/html/index.html"
    },
    {
        "key": "client-collection",
        "area": "Client",
        "title": "Collection",
        "path": "/client/html/collection.html"
    },
    {
        "key": "client-categories",
        "area": "Client",
        "title": "Categories",
        "path": "/client/html/catigories.html"
    },
    {
        "key": "client-about",
        "area": "Client",
        "title": "About",
        "path": "/client/html/about.html"
    },
    {
        "key": "client-contact",
        "area": "Client",
        "title": "Contact",
        "path": "/client/html/contact.html"
    },
    {
        "key": "client-profile",
        "area": "Client",
        "title": "Profile",
        "path": "/client/profile/profile.html"
    },
    {
        "key": "client-accessories",
        "area": "Client",
        "title": "Accessories",
        "path": "/client/product/html/accessories.html"
    },
    {
        "key": "client-bags",
        "area": "Client",
        "title": "Bags",
        "path": "/client/product/html/bags.html"
    },
    {
        "key": "client-ceramics",
        "area": "Client",
        "title": "Ceramics",
        "path": "/client/product/html/ceramics.html"
    },
    {
        "key": "client-gifts",
        "area": "Client",
        "title": "Gifts",
        "path": "/client/product/html/gifts.html"
    },
    {
        "key": "client-home-products",
        "area": "Client",
        "title": "Home Decor",
        "path": "/client/product/html/home.html"
    },
    {
        "key": "client-jewelry",
        "area": "Client",
        "title": "Jewelry",
        "path": "/client/product/html/jewelry.html"
    },
    {
        "key": "client-metalware",
        "area": "Client",
        "title": "Metalware",
        "path": "/client/product/html/metalware.html"
    },
    {
        "key": "client-rugs",
        "area": "Client",
        "title": "Rugs",
        "path": "/client/product/html/rugs.html"
    },
    {
        "key": "client-stationery",
        "area": "Client",
        "title": "Stationery",
        "path": "/client/product/html/stationery.html"
    },
    {
        "key": "client-textiles",
        "area": "Client",
        "title": "Textiles",
        "path": "/client/product/html/textiles.html"
    },
    {
        "key": "client-traditional",
        "area": "Client",
        "title": "Traditional",
        "path": "/client/product/html/traditional.html"
    },
    {
        "key": "client-wooden",
        "area": "Client",
        "title": "Wooden",
        "path": "/client/product/html/wooden.html"
    }
];

    function normalizePath(value) {
        if (!value) return '';
        let pathname = String(value).replace(/\\/g, '/');
        try {
            pathname = decodeURIComponent(pathname);
        } catch (error) {}
        const match = pathname.match(/\/(admin|client|login)\/.+$/);
        if (match) pathname = match[0];
        return pathname.replace(/\/+/g, '/');
    }

    function pathFromHref(href) {
        if (!href || href === '#') return '';
        try {
            return normalizePath(new URL(href, window.location.href).pathname);
        } catch (error) {
            return normalizePath(href);
        }
    }

    function readStoredSettings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (error) {
            return {};
        }
    }

    function getSettings() {
        const stored = readStoredSettings();
        const settings = {};
        pages.forEach(page => {
            settings[page.key] = page.locked ? true : stored[page.key] !== false;
        });
        return settings;
    }

    function saveSettings(nextSettings) {
        const output = {};
        pages.forEach(page => {
            output[page.key] = page.locked ? true : nextSettings[page.key] !== false;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(output));
    }

    function resetSettings() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function getCurrentPage() {
        const currentPath = normalizePath(window.location.pathname);
        return pages.find(page => normalizePath(page.path) === currentPath);
    }

    function renderDisabledPage(page) {
        document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;background:#f6f4ef;color:#1f2933;font-family:Inter,Arial,sans-serif;padding:24px;">' +
            '<section style="max-width:520px;background:#fff;border:1px solid #e6dfd2;border-radius:12px;padding:32px;box-shadow:0 18px 50px rgba(31,41,51,.12);text-align:center;">' +
            '<h1 style="font-size:24px;margin:0 0 10px;">' + page.title + '</h1>' +
            '<p style="color:#6b7280;margin:0 0 22px;line-height:1.5;">This page is currently turned off from Admin Settings.</p>' +
            '<a href="/admin/html/settings.html" style="display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 18px;background:#315236;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Open Settings</a>' +
            '</section></main>';
    }

    function applyPageSettings() {
        const settings = getSettings();
        const currentPage = getCurrentPage();

        document.querySelectorAll('a[href]').forEach(link => {
            const pagePath = pathFromHref(link.getAttribute('href'));
            const page = pages.find(item => normalizePath(item.path) === pagePath);
            if (page && settings[page.key] === false) {
                link.style.display = 'none';
                link.setAttribute('aria-hidden', 'true');
            }
        });

        if (currentPage && settings[currentPage.key] === false && !currentPage.locked) {
            if (currentPage.area === 'Admin') {
                window.location.href = '/admin/html/settings.html';
                return;
            }
            renderDisabledPage(currentPage);
        }
    }

    window.UZCRAFTPageSettings = {
        pages,
        getSettings,
        saveSettings,
        resetSettings,
        applyPageSettings,
        getCurrentPage
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPageSettings);
    } else {
        applyPageSettings();
    }
})();