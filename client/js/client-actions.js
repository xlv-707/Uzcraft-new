(function () {
    'use strict';

    const API_BASE = 'http://localhost:3000';
    const CART_KEY = 'cart';
    const WISHLIST_KEY = 'wishlist';
    const SUBSCRIBERS_KEY = 'uzcraftSubscribers';
    const CONTACT_KEY = 'uzcraftContactMessages';

    const categoryLinks = {
        ceramics: '/client/product/html/ceramics.html',
        textiles: '/client/product/html/textiles.html',
        'wooden crafts': '/client/product/html/wooden.html',
        wooden: '/client/product/html/wooden.html',
        jewelry: '/client/product/html/jewelry.html',
        accessories: '/client/product/html/accessories.html',
        'gift ideas': '/client/product/html/gifts.html',
        gifts: '/client/product/html/gifts.html',
        bags: '/client/product/html/bags.html',
        rugs: '/client/product/html/rugs.html',
        stationery: '/client/product/html/stationery.html',
        traditional: '/client/product/html/traditional.html',
        metalware: '/client/product/html/metalware.html'
    };

    const supportContent = {
        faqs: 'For order, delivery, and product questions, use the contact page or profile order history.',
        'shipping & delivery': 'Shipping status is available in your profile after an order is placed.',
        'returns & exchanges': 'Return and exchange requests can be sent through the contact form with your order number.',
        'track your order': 'Open your profile to track every order status in real time.',
        blog: 'Latest craft stories are shown in the About page blog section.',
        careers: 'For partnership or career questions, send a message from the Contact page.',
        'artisan partnerships': 'Artisan partnership information is available on the About page.'
    };

    function core() {
        return window.UZCRAFT || {};
    }

    async function ready() {
        if (core().ready) {
            try { await core().ready; } catch (error) {}
        }
    }

    function read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (error) { return fallback; }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function user() {
        return read('currentUser', null);
    }

    function settings() {
        return core().getLocalSettings ? core().getLocalSettings() : {};
    }

    function t(text) {
        return core().t ? core().t(text) : text;
    }

    function formatMoney(value) {
        return core().formatMoney ? core().formatMoney(value) : '$' + Number(value || 0).toFixed(2);
    }

    async function api(path, options = {}) {
        if (core().api) return core().api(path, options);
        const response = await fetch(API_BASE + path, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        let data = null;
        try { data = await response.json(); } catch (error) {}
        if (!response.ok) throw new Error(data?.message || response.statusText || 'Server error');
        return data;
    }

    function notifyError(title, error, source = 'client') {
        if (core().notifyError) core().notifyError(title, error?.message || String(error), source);
    }

    function toast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        let toastNode = document.querySelector('.uzcraft-client-toast');
        if (toastNode) toastNode.remove();
        toastNode = document.createElement('div');
        toastNode.className = 'uzcraft-client-toast';
        toastNode.textContent = message;
        toastNode.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:100000;background:#1f2937;color:#fff;padding:12px 16px;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.18);font:600 14px Inter,Arial,sans-serif;max-width:320px;';
        if (type === 'error') toastNode.style.background = '#b91c1c';
        if (type === 'success') toastNode.style.background = '#15803d';
        document.body.appendChild(toastNode);
        setTimeout(() => toastNode.remove(), 3200);
    }

    function ensureStyles() {
        if (document.getElementById('uzcraft-client-actions-style')) return;
        const style = document.createElement('style');
        style.id = 'uzcraft-client-actions-style';
        style.textContent = `
            .uzcraft-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;}
            .uzcraft-modal{width:min(560px,96vw);max-height:86vh;overflow:auto;background:var(--bg-card,#fff);color:var(--text-primary,#1f2937);border-radius:8px;box-shadow:0 24px 70px rgba(0,0,0,.22);font-family:Inter,Arial,sans-serif;}
            .uzcraft-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border-color,#eee);}
            .uzcraft-modal-header h3{margin:0;font-size:19px;font-weight:800;}
            .uzcraft-modal-close{border:none;background:transparent;font-size:22px;cursor:pointer;color:inherit;line-height:1;}
            .uzcraft-modal-body{padding:18px 20px;}
            .uzcraft-empty{color:var(--text-muted,#6b7280);font-size:14px;margin:0;}
            .uzcraft-list{display:grid;gap:12px;}
            .uzcraft-row{display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;border-bottom:1px solid var(--border-color,#eee);padding-bottom:12px;}
            .uzcraft-row img{width:56px;height:56px;object-fit:cover;border-radius:6px;background:#f3f4f6;}
            .uzcraft-row h4{margin:0 0 4px;font-size:14px;line-height:1.25;}
            .uzcraft-row p{margin:0;color:var(--text-muted,#6b7280);font-size:13px;}
            .uzcraft-row button,.uzcraft-actions button,.uzcraft-actions a{border:none;border-radius:6px;padding:9px 12px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:13px;}
            .uzcraft-row button{background:#fee2e2;color:#991b1b;}
            .uzcraft-actions{display:flex;gap:10px;flex-wrap:wrap;padding:16px 20px;border-top:1px solid var(--border-color,#eee);}
            .uzcraft-primary{background:var(--gold,#b08a5a);color:#fff;}
            .uzcraft-secondary{background:var(--bg-tertiary,#f3f4f6);color:var(--text-primary,#1f2937);}
            .uzcraft-danger{background:#fee2e2;color:#991b1b;}
            @media(max-width:520px){.uzcraft-row{grid-template-columns:48px 1fr}.uzcraft-row>button{grid-column:2;justify-self:start}.uzcraft-actions button,.uzcraft-actions a{width:100%;}}
        `;
        document.head.appendChild(style);
    }

    function productImage(product) {
        return product?.images?.[0] || product?.image || 'https://placehold.co/120x120/f0f2f8/8f8f8f?text=No+Image';
    }

    function getCart() {
        return read(CART_KEY, []);
    }

    function setCart(cart) {
        write(CART_KEY, cart);
        updateCartCount();
    }

    function getWishlist() {
        return read(WISHLIST_KEY, []);
    }

    function setWishlist(wishlist) {
        write(WISHLIST_KEY, wishlist);
        updateWishlistCount();
    }

    function updateCartCount() {
        const count = getCart().reduce((sum, item) => sum + Number(item.quantity || 1), 0);
        document.querySelectorAll('#cartCount').forEach(node => { node.textContent = count; });
    }

    function updateWishlistCount() {
        const count = getWishlist().length;
        document.querySelectorAll('#wishlistCount').forEach(node => { node.textContent = count; });
    }

    function closeModal() {
        document.querySelector('.uzcraft-modal-overlay')?.remove();
        document.body.style.overflow = '';
    }

    function modal(title, body, actions = '') {
        ensureStyles();
        closeModal();
        const overlay = document.createElement('div');
        overlay.className = 'uzcraft-modal-overlay';
        overlay.innerHTML = `
            <div class="uzcraft-modal" role="dialog" aria-modal="true" aria-label="${title}">
                <div class="uzcraft-modal-header">
                    <h3>${title}</h3>
                    <button class="uzcraft-modal-close" type="button" aria-label="Close">x</button>
                </div>
                <div class="uzcraft-modal-body">${body}</div>
                ${actions ? `<div class="uzcraft-actions">${actions}</div>` : ''}
            </div>
        `;
        overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
        overlay.querySelector('.uzcraft-modal-close').addEventListener('click', closeModal);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    function openInfoModal(title, message, actionHref) {
        const action = actionHref ? `<a class="uzcraft-primary" href="${actionHref}">${t('Open')}</a>` : '';
        modal(title, `<p class="uzcraft-empty">${message}</p>`, `${action}<button class="uzcraft-secondary" type="button" data-close-client-modal>${t('Close')}</button>`);
    }

    function openCartModal() {
        const cart = getCart();
        if (!cart.length) {
            modal(t('Cart'), `<p class="uzcraft-empty">${t('Your cart is empty')}</p>`, `<a class="uzcraft-primary" href="/client/html/collection.html">${t('Start Shopping')}</a>`);
            return;
        }
        const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
        const rows = cart.map((item, index) => `
            <div class="uzcraft-row">
                <img src="${productImage(item)}" alt="${item.name || 'Product'}" onerror="this.src='https://placehold.co/120x120/f0f2f8/8f8f8f?text=No+Image'">
                <div><h4>${item.name || 'Product'}</h4><p>${Number(item.quantity || 1)} x ${formatMoney(item.price || 0)}</p></div>
                <button type="button" data-remove-cart="${index}">${t('Remove')}</button>
            </div>
        `).join('');
        modal(t('Cart'), `<div class="uzcraft-list">${rows}</div><p style="margin:16px 0 0;font-weight:800;">${t('Total')}: ${formatMoney(total)}</p>`, `
            <button class="uzcraft-primary" type="button" data-checkout-cart>${t('Checkout')}</button>
            <button class="uzcraft-secondary" type="button" data-clear-cart>${t('Clear All')}</button>
            <a class="uzcraft-secondary" href="/client/html/collection.html">${t('Continue Shopping')}</a>
        `);
    }

    function openWishlistFallback() {
        const wishlist = getWishlist();
        if (!wishlist.length) {
            modal(t('Wishlist'), `<p class="uzcraft-empty">${t('Your wishlist is empty')}</p>`, `<a class="uzcraft-primary" href="/client/html/collection.html">${t('Browse Products')}</a>`);
            return;
        }
        const rows = wishlist.map((item, index) => `
            <div class="uzcraft-row">
                <img src="${productImage(item)}" alt="${item.name || 'Product'}" onerror="this.src='https://placehold.co/120x120/f0f2f8/8f8f8f?text=No+Image'">
                <div><h4>${item.name || 'Product'}</h4><p>${formatMoney(item.price || 0)}</p></div>
                <button type="button" data-remove-wishlist="${index}">${t('Remove')}</button>
            </div>
        `).join('');
        modal(t('Wishlist'), `<div class="uzcraft-list">${rows}</div>`, `
            <button class="uzcraft-secondary" type="button" data-clear-wishlist>${t('Clear All')}</button>
            <a class="uzcraft-primary" href="/client/html/collection.html">${t('Browse Products')}</a>
        `);
    }

    async function checkoutCart() {
        await ready();
        const cart = getCart();
        if (!cart.length) return;
        const currentUser = user();
        const guestAllowed = settings().userManagement?.guestCheckoutEnabled !== false;
        if (!currentUser && !guestAllowed) {
            toast(t('Please login to complete purchase'), 'error');
            closeModal();
            location.href = '/login/html/index.html';
            return;
        }
        const checkoutUser = currentUser || {
            id: null,
            email: `guest-cart-${Date.now()}@guest.local`,
            username: 'Guest',
            guest: true
        };
        try {
            for (const item of cart) {
                await api('/create-order', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: checkoutUser.email,
                        username: checkoutUser.username || checkoutUser.name || 'Guest',
                        userId: checkoutUser.id || null,
                        guest: Boolean(checkoutUser.guest),
                        product: item,
                        quantity: Number(item.quantity || 1),
                        total: Number(item.price || 0) * Number(item.quantity || 1),
                        paymentMethod: 'cart',
                        orderNumber: `UZ-${Date.now()}`
                    })
                });
            }
            setCart([]);
            closeModal();
            toast(t('Order placed successfully'), 'success');
            if (currentUser) setTimeout(() => { location.href = '/client/profile/profile.html'; }, 700);
        } catch (error) {
            notifyError('Order save failed', error, 'cart');
            toast(error.message || t('Order save failed'), 'error');
        }
    }

    function subscribe(email) {
        const value = String(email || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(value)) {
            toast(t('Enter a valid email'), 'error');
            return;
        }
        const subscribers = read(SUBSCRIBERS_KEY, []);
        if (!subscribers.includes(value)) subscribers.unshift(value);
        write(SUBSCRIBERS_KEY, subscribers.slice(0, 500));
        toast(t('Subscribed successfully'), 'success');
    }

    async function submitContact(form) {
        const fields = [...form.querySelectorAll('input, textarea')].map(input => input.value.trim());
        const [name, email, subject, message] = fields;
        if (!name || !email || !subject || !message) {
            toast(t('Please fill all fields'), 'error');
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            toast(t('Enter a valid email'), 'error');
            return;
        }
        const entry = { id: Date.now(), name, email, subject, message, createdAt: new Date().toISOString(), read: false };
        const messages = read(CONTACT_KEY, []);
        messages.unshift(entry);
        write(CONTACT_KEY, messages.slice(0, 200));
        try {
            await api('/notifications', {
                method: 'POST',
                body: JSON.stringify({ type: 'info', title: 'New contact message', message: `${name}: ${subject}`, source: 'contact', meta: entry })
            });
        } catch (error) {
            notifyError('Contact message notification failed', error, 'contact');
        }
        form.reset();
        toast(t('Message sent successfully'), 'success');
    }

    function goProfileOrLogin() {
        location.href = user() ? '/client/profile/profile.html' : '/login/html/index.html';
    }

    function bindHeader() {
        document.querySelectorAll('#userIcon, #userName').forEach(node => {
            node.style.cursor = 'pointer';
            node.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                goProfileOrLogin();
            }, true);
        });
        const currentUser = user();
        if (currentUser) {
            document.querySelectorAll('#userName').forEach(node => {
                node.textContent = currentUser.username || currentUser.name || currentUser.email || '';
            });
        }
    }

    function bindStaticButtons() {
        document.querySelectorAll('.explore-btn, .sellers-btn-1').forEach(button => {
            button.addEventListener('click', () => { location.href = '/client/html/collection.html'; });
        });
        document.querySelectorAll('.cart').forEach(cartNode => {
            cartNode.style.cursor = 'pointer';
            cartNode.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                openCartModal();
            }, true);
        });
        document.querySelectorAll('#wishlistIcon').forEach(icon => {
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (typeof window.openWishlistModal === 'function') window.openWishlistModal();
                else openWishlistFallback();
            }, true);
        });
        document.querySelectorAll('button').forEach(button => {
            const text = button.textContent.trim().toLowerCase();
            if (text.includes('discover our journey')) {
                button.addEventListener('click', () => { location.href = '/client/html/about.html'; });
            }
            if (text.includes('shop gifts')) {
                button.addEventListener('click', () => { location.href = '/client/product/html/gifts.html'; });
            }
            if (text === '→') {
                const input = button.parentElement?.querySelector('input[type="email"]');
                if (input) button.addEventListener('click', event => { event.preventDefault(); subscribe(input.value); input.value = ''; });
            }
        });
        document.querySelectorAll('.stay-div-btn').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                const input = document.querySelector('.ctay-div-input') || button.parentElement?.querySelector('input[type="email"]');
                subscribe(input?.value);
                if (input) input.value = '';
            });
        });
    }

    function bindLinks() {
        document.querySelectorAll('a[href="#"]').forEach(link => {
            const label = link.textContent.trim().toLowerCase();
            const icon = link.querySelector('i')?.className || '';
            link.addEventListener('click', event => {
                event.preventDefault();
                if (label.includes('read more') || label.includes('view all articles')) {
                    location.href = '/client/html/about.html';
                    return;
                }
                if (categoryLinks[label]) {
                    location.href = categoryLinks[label];
                    return;
                }
                if (label === 'contact us') {
                    location.href = '/client/html/contact.html';
                    return;
                }
                if (label === 'about us' || label === 'our story') {
                    location.href = '/client/html/about.html';
                    return;
                }
                if (label === 'track your order') {
                    goProfileOrLogin();
                    return;
                }
                if (supportContent[label]) {
                    const href = label === 'blog' || label === 'artisan partnerships' ? '/client/html/about.html' : null;
                    openInfoModal(link.textContent.trim(), supportContent[label], href);
                    return;
                }
                if (icon.includes('instagram')) location.href = 'https://www.instagram.com/';
                else if (icon.includes('facebook')) location.href = 'https://www.facebook.com/';
                else if (icon.includes('pinterest')) location.href = 'https://www.pinterest.com/';
                else if (icon.includes('youtube')) location.href = 'https://www.youtube.com/';
                else openInfoModal(t('Information'), t('This section is available through the related page.'), '/client/html/contact.html');
            });
        });
    }

    function bindForms() {
        const contactForm = document.querySelector('.contact-form form') || [...document.querySelectorAll('form')].find(form => form.querySelector('textarea'));
        if (contactForm && location.pathname.includes('/contact.html')) {
            contactForm.addEventListener('submit', event => {
                event.preventDefault();
                submitContact(contactForm);
            });
        }
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter' && !input.closest('form')) {
                    event.preventDefault();
                    subscribe(input.value);
                    input.value = '';
                }
            });
        });
    }

    function bindModalActions() {
        document.addEventListener('click', event => {
            const close = event.target.closest('[data-close-client-modal]');
            if (close) closeModal();
            const removeCart = event.target.closest('[data-remove-cart]');
            if (removeCart) {
                const cart = getCart();
                cart.splice(Number(removeCart.dataset.removeCart), 1);
                setCart(cart);
                openCartModal();
            }
            const removeWishlist = event.target.closest('[data-remove-wishlist]');
            if (removeWishlist) {
                const wishlist = getWishlist();
                wishlist.splice(Number(removeWishlist.dataset.removeWishlist), 1);
                setWishlist(wishlist);
                openWishlistFallback();
            }
            if (event.target.closest('[data-clear-cart]')) {
                setCart([]);
                openCartModal();
            }
            if (event.target.closest('[data-clear-wishlist]')) {
                setWishlist([]);
                openWishlistFallback();
            }
            if (event.target.closest('[data-checkout-cart]')) {
                checkoutCart();
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeModal();
        });
    }

    function init() {
        bindHeader();
        bindStaticButtons();
        bindLinks();
        bindForms();
        bindModalActions();
        updateCartCount();
        updateWishlistCount();
    }

    document.addEventListener('DOMContentLoaded', () => {
        ready().finally(init);
    });

    window.UZCRAFT_CLIENT = {
        openCartModal,
        openWishlistFallback,
        updateCartCount,
        updateWishlistCount,
        checkoutCart
    };
})();
