// ============================================================
// PROFILE PAGE - SETTINGS-AWARE FUNCTIONALITY
// ============================================================

let currentUser = JSON.parse(localStorage.getItem('currentUser'));

if (!currentUser) {
    window.location.href = '/login/html/index.html';
}

function core() {
    return window.UZCRAFT || {};
}

function t(text) {
    return core().t ? core().t(text) : text;
}

function formatMoney(value) {
    return core().formatMoney ? core().formatMoney(value) : '$' + Number(value || 0).toFixed(2);
}

function normalizeStatus(status) {
    const value = String(status || 'pending').toLowerCase();
    return value === 'completed' ? 'delivered' : value;
}

function getStatusLabel(status) {
    const labels = {

        pending: "🟡 Pending",

        processing: "🔵 Processing",

        packed: "📦 Packed",

        shipped: "🚚 Shipped",

        out_for_delivery: "🛵 Out for Delivery",

        delivered: "✅ Delivered",

        completed: "✅ Delivered",

        cancelled: "❌ Cancelled",

        refunded: "💰 Refunded"

    };
    return t(labels[normalizeStatus(status)] || status || 'Pending');
}

async function api(path, options = {}) {
    if (core().api) {
        return core().api(path, options);
    }

    const response = await fetch(`http://localhost:3000${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || response.statusText || 'Server error');
    }
    return data;
}

function notifyProfileError(title, error) {
    if (core().notifyError) {
        core().notifyError(title, error?.message || String(error), 'profile');
    }
}

// ============================================================
// LOAD USER DATA
// ============================================================
function loadUserData() {
    document.getElementById('profileName').textContent = currentUser.username || currentUser.name || 'User';
    document.getElementById('profileEmail').textContent = currentUser.email || 'user@example.com';

    document.getElementById('settingsName').value = currentUser.username || currentUser.name || '';
    document.getElementById('settingsEmail').value = currentUser.email || '';
    document.getElementById('settingsPhone').value = currentUser.phone || '';
    document.getElementById('settingsAddress').value = currentUser.address || '';

    const userName = document.getElementById('userName');
    if (userName) {
        userName.textContent = currentUser.username || currentUser.name || '';
    }

    updateStats(0);
    loadOrders();
    loadNotifications();
    loadWishlist();
    updateCartCount();
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats(orderTotal) {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    document.getElementById('orderCount').textContent = Number(orderTotal || 0);
    document.getElementById('wishlistCount').textContent = wishlist.length;
}


function createOrderTimeline(status) {

    const steps = [

        {
            value: "pending",
            label: "Pending"
        },

        {
            value: "processing",
            label: "Processing"
        },

        {
            value: "packed",
            label: "Packed"
        },

        {
            value: "shipped",
            label: "Shipped"
        },

        {
            value: "out_for_delivery",
            label: "Out for Delivery"
        },

        {
            value: "delivered",
            label: "Delivered"
        }

    ];

    const current = steps.findIndex(
        s => s.value === status
    );

    return `

        <div class="shipping-timeline">

            ${steps.map((step, index) => `

                <div class="timeline-step ${index <= current ? "active" : ""}">

                    <div class="timeline-dot"></div>

                    <span>${step.label}</span>

                </div>

            `).join("")}

        </div>

    `;

}

// ============================================================
// LOAD ORDERS - SERVER
// ============================================================
async function loadOrders() {
    const container = document.getElementById('ordersContainer');

    try {
        const orders = await api(`/orders/user/${encodeURIComponent(currentUser.email)}`);
        updateStats(orders.length);

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-box-open"></i>
                    <p>${t('You have no orders yet')}</p>
                    <a href="../html/collection.html" class="shop-btn">${t('Start Shopping')}</a>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => {
            const status = normalizeStatus(order.status);
            const item = order.products?.[0];

            const product = item?.product || {};

            const quantity = item?.quantity || 1;

            const unitPrice = item?.price || product.price || 0;

            const total = order.totalPrice || unitPrice * quantity;

            const productImage =
                product.image ||
                product.gallery?.[0] ||
                "https://placehold.co/50x50/f0f2f8/8f8f8f?text=No+Image";

            const productName =
                product.name || "Product";
            const createdAt = order.createdAt || order.date || order.timestamp || new Date().toISOString();

            return `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-number">#${order.orderNumber || order._id}</span>
                        <span class="order-date">${new Date(createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                        <span class="order-status ${status}">${getStatusLabel(status)}</span>
                    </div>

                    <div class="order-product">
                        <img src="${productImage}"
                            alt="${productName}"
                            onerror="this.src='https://placehold.co/50x50/f0f2f8/8f8f8f?text=No+Image'">

                        <div class="order-product-info">
                            <h5>${productName}</h5>
                            <p>Qty: ${quantity} x ${formatMoney(unitPrice)}</p>
                        </div>
                    </div>

                    ${createOrderTimeline(status)}

                    <div class="order-total">
                        <span>Total: ${formatMoney(total)}</span>
                        <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                            Payment: ${order.paymentMethod || order.payment || 'Card'}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading orders:', error);
        notifyProfileError('Order not found', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-circle-exclamation"></i>
                <p>${t('Failed to load orders. Please try again.')}</p>
                <button onclick="loadOrders()" class="shop-btn" style="border:none;cursor:pointer;">
                    <i class="fa-solid fa-rotate"></i> Retry
                </button>
            </div>
        `;
    }
}

// ============================================================
// LOAD NOTIFICATIONS
// ============================================================

async function loadNotifications() {

    try {

        const currentUser = JSON.parse(

            localStorage.getItem("currentUser")

        );

        if (!currentUser) return;

        const response = await fetch(

            `http://localhost:3000/notifications/${currentUser._id}`

        );

        const data = await response.json();

        const container = document.getElementById(
            "notificationsContainer"
        );

        const badge = document.getElementById(
            "notificationBadge"
        );

        if (!data.success) {

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-bell-slash"></i>
                    <p>No notifications found</p>
                </div>
            `;

            return;

        }

        badge.textContent = data.notifications.filter(

            n => !n.read

        ).length;

        if (data.notifications.length === 0) {

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;

            return;

        }

        container.innerHTML = data.notifications.map(n => `

            <div class="notification-card">

                <h4>${n.title}</h4>

                <p>${n.message}</p>

                <small>

                    ${new Date(n.createdAt).toLocaleString()}

                </small>

                <div style="margin-top:15px;display:flex;gap:10px;">

                    <button
                        onclick="markNotificationRead('${n._id}')"
                        style="
                            padding:8px 18px;
                            border:none;
                            border-radius:8px;
                            background:#315236;
                            color:white;
                            cursor:pointer;
                        ">

                        ✓ Mark Read

                    </button>

                    <button
                        onclick="deleteNotification('${n._id}')"
                        style="
                            padding:8px 18px;
                            border:none;
                            border-radius:8px;
                            background:#ef4444;
                            color:white;
                            cursor:pointer;
                        ">

                        🗑 Delete

                    </button>

                </div>

            </div>

            `).join("");

    } catch (error) {

        console.error(error);

    }

}

// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

async function markNotificationRead(id) {

    try {

        const response = await fetch(

            `http://localhost:3000/notifications/read/${id}`,

            {

                method: "PUT"

            }

        );

        const data = await response.json();

        if (data.success) {

            loadNotifications();

        } else {

            alert(data.message);

        }

    } catch (error) {

        console.error(error);

    }

}

// ============================================================
// DELETE NOTIFICATION
// ============================================================

async function deleteNotification(id) {

    if (!confirm("Delete this notification?")) {

        return;

    }

    try {

        const response = await fetch(

            `http://localhost:3000/notifications/${id}`,

            {

                method: "DELETE"

            }

        );

        const data = await response.json();

        if (data.success) {

            loadNotifications();

        } else {

            alert(data.message);

        }

    } catch (error) {

        console.error(error);

    }

}

// ============================================================
// LOAD WISHLIST
// ============================================================
function productPageForWishlist(product) {
    const category = String(product.category || product.type || '').toLowerCase();
    const map = {
        ceramics: '/client/product/html/ceramics.html',
        textiles: '/client/product/html/textiles.html',
        jewelry: '/client/product/html/jewelry.html',
        accessories: '/client/product/html/accessories.html',
        bags: '/client/product/html/bags.html',
        rugs: '/client/product/html/rugs.html',
        gifts: '/client/product/html/gifts.html',
        stationery: '/client/product/html/stationery.html',
        metalware: '/client/product/html/metalware.html',
        wooden: '/client/product/html/wooden.html',
        home: '/client/product/html/home.html',
        traditional: '/client/product/html/traditional.html'
    };
    return map[category] || '/client/html/collection.html';
}

function loadWishlist() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const container = document.getElementById('wishlistContainer');

    if (wishlist.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-heart"></i>
                <p>${t('Your wishlist is empty')}</p>
                <a href="../html/collection.html" class="shop-btn">${t('Browse Products')}</a>
            </div>
        `;
        return;
    }

    container.innerHTML = wishlist.map(product => `
        <div class="wishlist-item" onclick="window.location.href='${productPageForWishlist(product)}'">
            <img src="${product.images?.[0] || product.image || 'https://placehold.co/200x200/f0f2f8/8f8f8f?text=No+Image'}"
                 alt="${product.name}"
                 onerror="this.src='https://placehold.co/200x200/f0f2f8/8f8f8f?text=No+Image'">
            <div class="wishlist-item-info">
                <h4>${product.name}</h4>
                <p>${formatMoney(product.price)}</p>
                <button class="wishlist-remove-btn" onclick="event.stopPropagation(); removeFromWishlist('${product.id}')">
                    <i class="fa-solid fa-trash-can"></i> ${t('Remove')}
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// REMOVE FROM WISHLIST
// ============================================================
function removeFromWishlist(productId) {
    let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    wishlist = wishlist.filter(item => item.id !== productId);
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    loadWishlist();
    updateStats(Number(document.getElementById('orderCount').textContent || 0));
    showToast('Removed from wishlist', 'info');
}

// ============================================================
// UPDATE CART COUNT
// ============================================================
function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        cartCount.textContent = total;
    }
}

// ============================================================
// SWITCH TABS
// ============================================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName + 'Tab');
    });
}

// ============================================================
// SAVE SETTINGS - SERVER
// ============================================================
document.getElementById('settingsForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const updatedUser = {
        ...currentUser,
        username: document.getElementById('settingsName').value,
        email: document.getElementById('settingsEmail').value,
        phone: document.getElementById('settingsPhone').value,
        address: document.getElementById('settingsAddress').value
    };

    try {
        const users = await api('/users');
        const userIndex = users.findIndex(u => u.email === currentUser.email || u.id === currentUser.id);

        if (userIndex === -1) {
            throw new Error('User update failed');
        }

        const savedUser = await api(`/user/${users[userIndex].id}`, {
            method: 'PUT',
            body: JSON.stringify({
                ...users[userIndex],
                username: updatedUser.username,
                email: updatedUser.email,
                phone: updatedUser.phone,
                address: updatedUser.address
            })
        });

        currentUser = savedUser.user || updatedUser;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        document.getElementById('profileName').textContent = currentUser.username || currentUser.name || 'User';
        document.getElementById('profileEmail').textContent = currentUser.email || '';

        showToast('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        notifyProfileError('User update failed', error);
        showToast('Failed to save settings. Please try again.', 'error');
    }
});

// ============================================================
// LOGOUT
// ============================================================
function logoutUser() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        window.location.href = '/login/html/index.html';
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info') {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();

    const icons = {
        success: 'fa-regular fa-circle-check',
        error: 'fa-regular fa-circle-xmark',
        warning: 'fa-regular fa-circle-exclamation',
        info: 'fa-regular fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon"><i class="${icons[type] || icons.info}"></i></span>
        <div class="toast-content">
            <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.closest('.custom-toast').remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.querySelector('.wishlist-modal-overlay');
        if (modal) modal.remove();
        document.body.style.overflow = '';
    }
});

// ============================================================
// INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (core().ready) {
        await core().ready;
    }
    loadUserData();
});

// ============================================================
// SOCKET.IO
// ============================================================

const socket = io("http://localhost:3000");

socket.on("connect", () => {

    console.log("🟢 Connected:", socket.id);

    socket.emit("join", currentUser._id);

});

socket.on("disconnect", () => {

    console.log("🔴 Disconnected");

});

// ============================================================
// REAL-TIME ORDER STATUS
// ============================================================

socket.on("order-status-updated", (data) => {

    console.log("📦 Order updated:", data);

    showToast(data.message, "success");

    loadOrders();

    loadNotifications();

});