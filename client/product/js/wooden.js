// ============================================================
// LOGIN / USER MANAGEMENT
// ============================================================

const userIcon = document.getElementById("userIcon");
const userName = document.getElementById("userName");

const user = JSON.parse(localStorage.getItem("currentUser"));

if (user) {
    userName.textContent = user.username || user.name;
}

userIcon?.addEventListener("click", () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    window.location.href = currentUser ? "/client/profile/profile.html" : "/login/html/index.html";
});

userName?.addEventListener("click", () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    window.location.href = currentUser ? "/client/profile/profile.html" : "/login/html/index.html";
});

// ============================================================
// STATE MANAGEMENT
// ============================================================

const state = {
    products: [],
    currentProduct: null,
    currentImageIndex: 0,
    quantity: 1,
    wishlist: JSON.parse(localStorage.getItem('wishlist') || '[]'),
    recentlyViewed: JSON.parse(localStorage.getItem('recentlyViewed') || '[]'),
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    orders: JSON.parse(localStorage.getItem('orders') || '[]'),
    selectedPaymentMethod: 'card'
};
// ============================================================
// SETTINGS-AWARE CHECKOUT HELPERS
// ============================================================

async function ensureCheckoutSettingsReady() {
    if (window.UZCRAFT?.ready) {
        try { await window.UZCRAFT.ready; } catch (error) {}
    }
}

function getClientSettings() {
    return window.UZCRAFT?.getLocalSettings ? window.UZCRAFT.getLocalSettings() : {};
}

function isGuestCheckoutAllowed() {
    const settings = getClientSettings();
    return settings.userManagement?.guestCheckoutEnabled !== false;
}

function createGuestCheckoutUser() {
    return {
        id: null,
        email: `guest-${Date.now()}@guest.local`,
        username: 'Guest',
        name: 'Guest',
        guest: true
    };
}

function formatMoney(value) {
    return window.UZCRAFT?.formatMoney
        ? window.UZCRAFT.formatMoney(value)
        : '$' + Number(value || 0).toFixed(2);
}


// DOM References
const container = document.getElementById('productsContainer');
const recentlyViewedContainer = document.getElementById('recentlyViewedContainer');
const recentlyViewedSection = document.getElementById('recentlyViewedSection');

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
// LOAD PRODUCTS
// ============================================================

async function loadProducts() {
    try {
        showSkeletons(8);

        const response = await fetch('http://localhost:3000/products/category/Wood Crafts');
        if (!response.ok) throw new Error('Failed to fetch products');

        const products = await response.json();
        state.products = products;

        container.innerHTML = '';
        products.forEach(product => renderProductCard(product));

        document.getElementById('productCount').textContent = products.length;
        renderRecentlyViewed();
        updateCartCount();

    } catch (error) {
        console.error('Error loading products:', error);
        container.innerHTML = `
            <div class="error-state" style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:48px;color:var(--text-muted);margin-bottom:16px;"></i>
                <h3 style="color:var(--text-primary);margin-bottom:8px;">Failed to load products</h3>
                <p style="color:var(--text-muted);">Please check your connection and try again.</p>
                <button onclick="loadProducts()" style="margin-top:16px;padding:10px 28px;border:none;border-radius:50px;background:var(--primary-green);color:#fff;font-weight:600;cursor:pointer;">
                    <i class="fa-solid fa-rotate"></i> Retry
                </button>
            </div>
        `;
    }
}

// ============================================================
// SKELETON LOADING
// ============================================================

function showSkeletons(count) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        container.innerHTML += `
            <div class="skeleton-card">
                <div class="skeleton-image"></div>
                <div class="skeleton-text">
                    <div class="line"></div>
                    <div class="line" style="width:70%;"></div>
                    <div class="line" style="width:40%;margin-bottom:0;"></div>
                </div>
            </div>
        `;
    }
}

// ============================================================
// RENDER PRODUCT CARD
// ============================================================

function renderProductCard(product) {
    const image = product.images?.[0] || product.image || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image';
    const isInWishlist = state.wishlist.some(item => item.id === product.id);
    const stockStatus = getStockStatus(product.stock);

    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;
    card.innerHTML = `
        <div class="card-image-wrapper" onclick="openProductModal('${product.id}')">
            <img src="${image}" alt="${product.name}" loading="lazy" onerror="this.src='https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'">

            <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist('${product.id}')">
                <i class="fa-${isInWishlist ? 'solid' : 'regular'} fa-heart"></i>
            </button>

            <span class="availability-badge ${stockStatus.class}">${stockStatus.label}</span>

            <div class="quick-actions">
                <button onclick="event.stopPropagation(); quickAddToCart('${product.id}')">
                    <i class="fa-solid fa-cart-plus"></i> Quick Add
                </button>
                <button onclick="event.stopPropagation(); openProductModal('${product.id}')">
                    <i class="fa-regular fa-eye"></i> View
                </button>
            </div>
        </div>

        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>

            <div class="product-meta">
                <span class="rating">
                    <i class="fa-solid fa-star"></i>
                    <span>${product.rating || '4.5'}</span>
                </span>
                <span class="rating-count">(${product.reviews || 0})</span>
                ${product.region ? `<span>• ${product.region}</span>` : ''}
            </div>

            <div class="product-bottom">
                <span class="product-price">
                    ${formatMoney(product.price)}
                    ${product.originalPrice ? `<span class="original-price">${formatMoney(product.originalPrice)}</span>` : ''}
                </span>
                <div class="product-cart" onclick="event.stopPropagation(); addToCart('${product.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1 5h12m-9 0a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
                    </svg>
                </div>
            </div>

            ${product.tags ? `
                <div class="product-tags">
                    ${product.tags.slice(0, 3).map(tag => `<span>#${tag}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;

    container.appendChild(card);
}

// ============================================================
// STOCK STATUS
// ============================================================

function getStockStatus(stock) {
    if (stock === undefined || stock === null) return { label: 'In Stock', class: 'in-stock' };
    if (stock > 10) return { label: 'In Stock', class: 'in-stock' };
    if (stock > 0) return { label: 'Low Stock', class: 'low-stock' };
    return { label: 'Out of Stock', class: 'out-of-stock' };
}

// ============================================================
// WISHLIST
// ============================================================

function toggleWishlist(productId) {
    const index = state.wishlist.findIndex(item => item.id === productId);
    const product = state.products.find(p => p.id === productId);

    if (index > -1) {
        state.wishlist.splice(index, 1);
        showToast('Removed from wishlist ❤️', 'info');
    } else if (product) {
        state.wishlist.push(product);
        showToast('Added to wishlist ❤️', 'success');
    } else {
        showToast('Product not found', 'error');
        return;
    }

    localStorage.setItem('wishlist', JSON.stringify(state.wishlist));
    updateWishlistUI(productId);
}

function updateWishlistUI(productId) {
    const card = document.querySelector(`.product-card[data-id="${productId}"]`);
    if (!card) return;

    const btn = card.querySelector('.wishlist-btn');
    const isInWishlist = state.wishlist.some(item => item.id === productId);

    if (btn) {
        btn.innerHTML = `<i class="fa-${isInWishlist ? 'solid' : 'regular'} fa-heart"></i>`;
        btn.classList.toggle('active', isInWishlist);
    }
}

// ============================================================
// RECENTLY VIEWED
// ============================================================

function addToRecentlyViewed(product) {
    state.recentlyViewed = state.recentlyViewed.filter(item => item.id !== product.id);
    state.recentlyViewed.unshift(product);
    if (state.recentlyViewed.length > 8) state.recentlyViewed.pop();

    localStorage.setItem('recentlyViewed', JSON.stringify(state.recentlyViewed));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    if (state.recentlyViewed.length === 0) {
        recentlyViewedSection.style.display = 'none';
        return;
    }

    recentlyViewedSection.style.display = 'block';
    recentlyViewedContainer.innerHTML = '';
    document.getElementById('recentCount').textContent = state.recentlyViewed.length;

    state.recentlyViewed.forEach(product => {
        const image = product.images?.[0] || product.image || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-image-wrapper" onclick="openProductModal('${product.id}')">
                <img src="${image}" alt="${product.name}" loading="lazy" onerror="this.src='https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-bottom">
                    <span class="product-price">${formatMoney(product.price)}</span>
                    <div class="product-cart" onclick="event.stopPropagation(); addToCart('${product.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1 5h12m-9 0a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;
        recentlyViewedContainer.appendChild(card);
    });
}

function clearRecentlyViewed() {
    state.recentlyViewed = [];
    localStorage.setItem('recentlyViewed', JSON.stringify(state.recentlyViewed));
    renderRecentlyViewed();
    showToast('Cleared recently viewed', 'info');
}

// ============================================================
// OPEN PRODUCT MODAL
// ============================================================

async function openProductModal(productId) {
    try {
        let product = state.products.find(p => p.id === productId);

        if (!product) {
            const response = await fetch(`http://localhost:3000/product/${productId}`);
            if (!response.ok) throw new Error('Product not found');
            product = await response.json();
        }

        state.currentProduct = product;
        state.currentImageIndex = 0;
        state.quantity = 1;

        addToRecentlyViewed(product);
        showProductModal(product);

    } catch (error) {
        console.error('Error opening product:', error);
        showToast('❌ Failed to load product details', 'error');

        const card = document.querySelector(`.product-card[data-id="${productId}"]`);
        if (card) {
            const name = card.querySelector('.product-name')?.textContent || 'Product';
            const priceText = card.querySelector('.product-price')?.textContent || '$0';
            const price = parseFloat(priceText.replace('$', ''));
            const img = card.querySelector('img')?.src || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image';

            const fallbackProduct = {
                id: productId,
                name: name,
                price: price,
                images: [img],
                description: 'Product details',
                category: 'Textiles',
                stock: 10,
                materials: 'Various',
                region: 'Uzbekistan'
            };

            state.currentProduct = fallbackProduct;
            state.currentImageIndex = 0;
            state.quantity = 1;
            showProductModal(fallbackProduct);
            showToast('📦 Showing product from list', 'info');
        }
    }
}

// ============================================================
// SHOW PRODUCT MODAL
// ============================================================

function showProductModal(product) {
    const existingModal = document.querySelector('.product-modal-overlay');
    if (existingModal) existingModal.remove();

    const images = product.images || [product.image || 'https://placehold.co/400x400/f0f2f8/8f8f8f?text=No+Image'];
    const hasMultipleImages = images.length > 1;
    const stockStatus = getStockStatus(product.stock);
    const isInWishlist = state.wishlist.some(item => item.id === product.id);

    const modal = document.createElement('div');
    modal.className = 'product-modal-overlay';
    modal.innerHTML = `
        <div class="product-modal" role="dialog" aria-modal="true" aria-label="Product details">
            <button class="modal-close" onclick="closeModal()" aria-label="Close modal">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="modal-content">
                <div class="modal-left">
                    <div class="modal-image-container">
                        <img id="modalMainImage" src="${images[0]}" alt="${product.name}" onerror="this.src='https://placehold.co/400x400/f0f2f8/8f8f8f?text=No+Image'">
                        ${hasMultipleImages ? `
                            <button class="modal-slider-btn left" onclick="changeImage(-1)" aria-label="Previous image">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                            </button>
                            <button class="modal-slider-btn right" onclick="changeImage(1)" aria-label="Next image">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                            <div class="modal-dots" id="modalDots">
                                ${images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}" onclick="changeImageTo(${i})" role="button" aria-label="Go to image ${i + 1}"></span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    ${hasMultipleImages ? `
                        <div class="modal-thumbnails" id="modalThumbnails">
                            ${images.map((img, i) => `
                                <img src="${img}" onclick="changeImageTo(${i})" class="${i === 0 ? 'active-thumb' : ''}" onerror="this.src='https://placehold.co/100x100/f0f2f8/8f8f8f?text=No+Image'" alt="Thumbnail ${i + 1}">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="modal-right">
                    <h2 class="modal-product-name">${product.name || 'Product'}</h2>
                    <div>
                        <span class="modal-product-price">${formatMoney(product.price)}</span>
                        ${product.originalPrice ? `<span class="modal-original-price">${formatMoney(product.originalPrice)}</span>` : ''}
                    </div>

                    <div class="modal-rating">
                        <span>${'★'.repeat(Math.floor(product.rating || 4))}${'☆'.repeat(5 - Math.floor(product.rating || 4))}</span>
                        <span class="modal-rating-count">(${product.reviews || 0} reviews)</span>
                    </div>

                    <div class="modal-product-info">
                        <div><strong>Category:</strong> ${product.category || 'Uncategorized'}</div>
                        <div><strong>Availability:</strong> <span class="${stockStatus.class}">${stockStatus.label}</span></div>
                        ${product.sku ? `<div><strong>SKU:</strong> ${product.sku}</div>` : ''}
                        ${product.region ? `<div><strong>Region:</strong> ${product.region}</div>` : ''}
                        ${product.materials ? `<div><strong>Materials:</strong> ${product.materials}</div>` : ''}
                        ${product.dimensions ? `<div><strong>Dimensions:</strong> ${product.dimensions}</div>` : ''}
                        ${product.weight ? `<div><strong>Weight:</strong> ${product.weight}</div>` : ''}
                    </div>

                    ${product.specifications ? `
                        <div class="modal-specs">
                            ${Object.entries(product.specifications).map(([key, value]) => `
                                <div class="spec-item">
                                    <span class="spec-label">${key}</span>
                                    <span class="spec-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${product.tags ? `
                        <div class="modal-tags">
                            ${product.tags.map(tag => `<span>#${tag}</span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="modal-description">
                        <p>${product.description || product.fullDescription || 'No description available'}</p>
                    </div>

                    <div class="modal-quantity">
                        <label for="quantityInput">Quantity:</label>
                        <div class="quantity-control">
                            <button onclick="changeQuantity(-1)" aria-label="Decrease quantity">−</button>
                            <span id="quantityDisplay">1</span>
                            <button onclick="changeQuantity(1)" aria-label="Increase quantity">+</button>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-add-cart" onclick="addToCartFromModal()">
                            <i class="fa-solid fa-cart-plus"></i>
                            Add to Cart
                        </button>
                        <button class="btn-buy-now" onclick="buyNow()">
                            <i class="fa-solid fa-bolt"></i>
                            Buy Now
                        </button>
                    </div>

                    <div class="modal-share">
                        <span>Share:</span>
                        <button onclick="shareProduct('facebook')" aria-label="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></button>
                        <button onclick="shareProduct('twitter')" aria-label="Share on Twitter"><i class="fa-brands fa-twitter"></i></button>
                        <button onclick="shareProduct('pinterest')" aria-label="Share on Pinterest"><i class="fa-brands fa-pinterest-p"></i></button>
                        <button onclick="shareProduct('copy')" aria-label="Copy link"><i class="fa-regular fa-link"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// ============================================================
// SHARE PRODUCT
// ============================================================

function shareProduct(platform) {
    if (!state.currentProduct) return;

    const url = window.location.href;
    const text = `Check out ${state.currentProduct.name} on UZCRAFT!`;

    const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}&media=${encodeURIComponent(state.currentProduct.images?.[0] || '')}`
    };

    if (platform === 'copy') {
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard! 📋', 'success');
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showToast('Link copied to clipboard! 📋', 'success');
        });
        return;
    }

    if (shareUrls[platform]) {
        window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
}

// ============================================================
// MODAL CONTROLS
// ============================================================

function closeModal() {
    const modal = document.querySelector('.product-modal-overlay');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    state.currentProduct = null;
}

function changeImage(direction) {
    if (!state.currentProduct) return;
    const images = state.currentProduct.images || [state.currentProduct.image];
    state.currentImageIndex = (state.currentImageIndex + direction + images.length) % images.length;
    updateModalImage(images);
}

function changeImageTo(index) {
    if (!state.currentProduct) return;
    const images = state.currentProduct.images || [state.currentProduct.image];
    state.currentImageIndex = index;
    updateModalImage(images);
}

function updateModalImage(images) {
    const mainImg = document.getElementById('modalMainImage');
    if (mainImg) mainImg.src = images[state.currentImageIndex];

    const dots = document.querySelectorAll('.modal-dots span');
    dots.forEach((dot, i) => {
        dot.className = i === state.currentImageIndex ? 'active' : '';
    });

    const thumbs = document.querySelectorAll('.modal-thumbnails img');
    thumbs.forEach((thumb, i) => {
        thumb.className = i === state.currentImageIndex ? 'active-thumb' : '';
    });
}

// ============================================================
// QUANTITY CONTROL
// ============================================================

function changeQuantity(delta) {
    state.quantity = Math.max(1, state.quantity + delta);
    const display = document.getElementById('quantityDisplay');
    if (display) display.textContent = state.quantity;
}

// ============================================================
// CART FUNCTIONS
// ============================================================

function addToCart(productId) {
    const card = document.querySelector(`.product-card[data-id="${productId}"]`);
    if (!card) {
        showToast('❌ Product not found', 'error');
        return;
    }

    const name = card.querySelector('.product-name')?.textContent || 'Product';
    const priceText = card.querySelector('.product-price')?.textContent || '$0';
    const price = parseFloat(priceText.replace('$', ''));
    const img = card.querySelector('img')?.src || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image';

    const product = { id: productId, name, price, images: [img] };
    addToCartHelper(product);
}

function quickAddToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (product) {
        addToCartHelper(product);
    } else {
        addToCart(productId);
    }
}

function addToCartHelper(product) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find(item => item.id === product.id);

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    state.cart = cart;
    updateCartCount();
    showToast(`✅ Added "${product.name}" to cart!`, 'success');
}

function addToCartFromModal() {
    if (!state.currentProduct) return;
    addToCartHelper(state.currentProduct);
    closeModal();
}

// ============================================================
// BUY NOW
// ============================================================

async function buyNow() {
    await ensureCheckoutSettingsReady();
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (!user && !isGuestCheckoutAllowed()) {
        showToast('Please login to continue', 'warning');
        setTimeout(() => {
            window.location.href = '/login/html/index.html';
        }, 1000);
        return;
    }

    if (!state.currentProduct) return;
    openPaymentModal();
}

// ============================================================
// PAYMENT MODAL
// ============================================================

function openPaymentModal() {
    if (!state.currentProduct) return;

    const total = state.currentProduct.price * state.quantity;
    const existing = document.querySelector('.payment-modal-overlay');
    if (existing) existing.remove();

    const paymentModal = document.createElement('div');
    paymentModal.className = 'payment-modal-overlay';
    paymentModal.innerHTML = `
        <div class="payment-modal" role="dialog" aria-modal="true" aria-label="Payment checkout">
            <button class="payment-close" onclick="closePaymentModal()" aria-label="Close payment">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="payment-header">
                <h2>💳 Checkout</h2>
                <p>Complete your purchase securely</p>
            </div>

            <div class="payment-summary">
                <div class="payment-product">
                    <img src="${(state.currentProduct.images || [state.currentProduct.image])[0]}" alt="${state.currentProduct.name}" onerror="this.src='https://placehold.co/56x56/f0f2f8/8f8f8f?text=No+Image'">
                    <div>
                        <h4>${state.currentProduct.name}</h4>
                        <p>Quantity: ${state.quantity}</p>
                    </div>
                </div>
                <div class="payment-total">
                    <span>Total:</span>
                    <span class="payment-total-price">${formatMoney(total)}</span>
                </div>
            </div>

            <form id="paymentForm" onsubmit="processPayment(event)">
                <div class="payment-methods">
                    ${['card', 'paypal', 'apple', 'google'].map(method => `
                        <div class="payment-method ${method === 'card' ? 'active' : ''}" onclick="selectPayment('${method}')" data-method="${method}">
                            <i class="${getPaymentIcon(method)}"></i>
                            <span>${getPaymentLabel(method)}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="payment-card-details" id="cardDetails">
                    <div class="payment-group">
                        <label>Card Number</label>
                        <input type="text" placeholder="1234 5678 9012 3456" maxlength="19" required>
                    </div>
                    <div class="payment-row">
                        <div class="payment-group">
                            <label>Expiry Date</label>
                            <input type="text" placeholder="MM/YY" maxlength="5" required>
                        </div>
                        <div class="payment-group">
                            <label>CVV</label>
                            <input type="text" placeholder="123" maxlength="4" required>
                        </div>
                    </div>
                    <div class="payment-group">
                        <label>Cardholder Name</label>
                        <input type="text" placeholder="John Doe" required>
                    </div>
                </div>

                ${['paypal', 'apple', 'google'].map(method => `
                    <div class="payment-group" style="display:none;" id="${method}Details">
                        <div class="payment-info-box">
                            <i class="${getPaymentIcon(method)}" style="font-size:48px;display:block;margin-bottom:8px;${method === 'paypal' ? 'color:#003087;' : method === 'apple' ? 'color:#000;' : 'color:#4285f4;'}"></i>
                            <p>${getPaymentDescription(method)}</p>
                        </div>
                    </div>
                `).join('')}

                <button type="submit" class="payment-submit-btn" id="paymentSubmitBtn">
                    <i class="fa-solid fa-lock"></i>
                    Pay ${formatMoney(total)} Securely
                </button>
            </form>

            <div class="payment-security">
                <i class="fa-solid fa-shield-check"></i>
                <span>Secure payment powered by SSL encryption</span>
            </div>
        </div>
    `;

    document.body.appendChild(paymentModal);
    document.body.style.overflow = 'hidden';

    // Input formatting
    const cardInput = paymentModal.querySelector('input[placeholder="1234 5678 9012 3456"]');
    if (cardInput) {
        cardInput.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, '');
            value = value.replace(/(.{4})/g, '$1 ').trim();
            this.value = value;
        });
    }

    const expiryInput = paymentModal.querySelector('input[placeholder="MM/YY"]');
    if (expiryInput) {
        expiryInput.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            }
            this.value = value;
        });
    }
}

function getPaymentIcon(method) {
    const icons = {
        card: 'fa-regular fa-credit-card',
        paypal: 'fa-brands fa-paypal',
        apple: 'fa-brands fa-apple-pay',
        google: 'fa-brands fa-google-pay'
    };
    return icons[method] || 'fa-regular fa-credit-card';
}

function getPaymentLabel(method) {
    const labels = {
        card: 'Card',
        paypal: 'PayPal',
        apple: 'Apple Pay',
        google: 'Google Pay'
    };
    return labels[method] || method;
}

function getPaymentDescription(method) {
    const descriptions = {
        paypal: 'You will be redirected to PayPal to complete your payment.',
        apple: 'Apple Pay will open on your device to complete the payment.',
        google: 'Google Pay will open to complete your payment.'
    };
    return descriptions[method] || '';
}

// ============================================================
// PAYMENT FUNCTIONS
// ============================================================

function selectPayment(method) {
    state.selectedPaymentMethod = method;

    document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('active'));
    document.querySelector(`.payment-method[data-method="${method}"]`)?.classList.add('active');

    document.getElementById('cardDetails').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('paypalDetails').style.display = method === 'paypal' ? 'block' : 'none';
    document.getElementById('appleDetails').style.display = method === 'apple' ? 'block' : 'none';
    document.getElementById('googleDetails').style.display = method === 'google' ? 'block' : 'none';
}

function closePaymentModal() {
    const modal = document.querySelector('.payment-modal-overlay');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

// ============================================================
// PROCESS PAYMENT - CREATE ORDER
// ============================================================

async function processPayment(e) {
    e.preventDefault();

    await ensureCheckoutSettingsReady();
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    let checkoutUser = currentUser;

    if (!checkoutUser) {
        if (!isGuestCheckoutAllowed()) {
            showToast('Please login to complete purchase', 'warning');
            closePaymentModal();
            window.location.href = '/login/html/index.html';
            return;
        }
        checkoutUser = createGuestCheckoutUser();
    }

    const btn = document.getElementById('paymentSubmitBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        const orderData = {
            email: checkoutUser.email,
            username: checkoutUser.username || checkoutUser.name,
            userId: checkoutUser.id || null,
            guest: Boolean(checkoutUser.guest),
            product: state.currentProduct,
            quantity: state.quantity,
            total: state.currentProduct.price * state.quantity,
            paymentMethod: state.selectedPaymentMethod,
            orderNumber: `UZ-${Date.now()}`
        };

        const response = await fetch('http://localhost:3000/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create order');
        }

        const result = await response.json();

        // Order successfully created on server
        btn.innerHTML = '✅ Order Placed!';
        btn.style.background = '#16a34a';
        btn.style.color = '#fff';

        // Save to localStorage as backup
        const order = {
            id: Date.now(),
            product: state.currentProduct,
            quantity: state.quantity,
            total: state.currentProduct.price * state.quantity,
            date: new Date().toISOString(),
            status: result.order?.status || 'pending',
            paymentMethod: state.selectedPaymentMethod,
            orderNumber: `UZ-${Date.now()}`,
            serverOrder: result
        };

        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        state.orders = orders;

        // Clear cart for this product
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const updatedCart = cart.filter(item => item.id !== state.currentProduct.id);
        localStorage.setItem('cart', JSON.stringify(updatedCart));
        state.cart = updatedCart;
        updateCartCount();

        showToast(`🎉 Order #${order.orderNumber} confirmed!`, 'success');

        setTimeout(() => {
            closePaymentModal();
            state.quantity = 1;
            closeModal();
        }, 1500);

    } catch (error) {
        console.error('Payment processing error:', error);
        btn.innerHTML = '❌ Payment Failed';
        btn.style.background = '#dc2626';
        btn.style.color = '#fff';
        showToast('❌ ' + error.message, 'error');

        setTimeout(() => {
            btn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay ${formatMoney(state.currentProduct.price * state.quantity)} Securely`;
            btn.style.background = '#059669';
            btn.style.color = '#fff';
            btn.disabled = false;
        }, 2000);
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

    const timeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);

    toast.addEventListener('mouseenter', () => clearTimeout(timeout));
    toast.addEventListener('mouseleave', () => {
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    });
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closePaymentModal();
    }
    if (e.key === 'ArrowLeft' && document.querySelector('.product-modal')) {
        changeImage(-1);
    }
    if (e.key === 'ArrowRight' && document.querySelector('.product-modal')) {
        changeImage(1);
    }
});

// ============================================================
// USER INFO
// ============================================================

function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const userName = document.getElementById('userName');
    const userIcon = document.getElementById('userIcon');

    if (user && user.name) {
        userName.textContent = user.name;
        userIcon.style.display = 'none';
    } else {
        userName.textContent = '';
        userIcon.style.display = 'inline';
    }
}

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadUserInfo();
    updateCartCount();
});

// ============================================================
// WISHLIST MODAL
// ============================================================

function openWishlistModal() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');

    if (wishlist.length === 0) {
        showToast('Your wishlist is empty ❤️', 'info');
        return;
    }

    const existingModal = document.querySelector('.wishlist-modal-overlay');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'wishlist-modal-overlay';
    modal.innerHTML = `
        <div class="wishlist-modal" role="dialog" aria-modal="true" aria-label="Wishlist">
            <button class="wishlist-modal-close" onclick="closeWishlistModal()" aria-label="Close wishlist">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="wishlist-header">
                <h2><i class="fa-regular fa-heart" style="color:#ef4444;"></i> My Wishlist</h2>
                <span class="wishlist-count">${wishlist.length} items</span>
            </div>

            <div class="wishlist-grid">
                ${wishlist.map(product => `
                    <div class="wishlist-item" onclick="openProductModal('${product.id}')">
                        <img src="${product.images?.[0] || product.image || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'}" alt="${product.name}" onerror="this.src='https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'">
                        <div class="wishlist-item-info">
                            <h4>${product.name}</h4>
                            <p>${formatMoney(product.price)}</p>
                            <button class="wishlist-remove-btn" onclick="event.stopPropagation(); toggleWishlist('${product.id}')">
                                <i class="fa-solid fa-trash-can"></i> Remove
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="wishlist-footer">
                <button class="wishlist-clear-btn" onclick="clearWishlist()">
                    <i class="fa-solid fa-trash-can"></i> Clear All
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeWishlistModal() {
    const modal = document.querySelector('.wishlist-modal-overlay');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

function clearWishlist() {
    if (confirm('Are you sure you want to clear your wishlist?')) {
        state.wishlist = [];
        localStorage.setItem('wishlist', JSON.stringify(state.wishlist));
        closeWishlistModal();
        showToast('Wishlist cleared ❤️', 'info');
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        });
    }
}

// Wishlist icon click
document.getElementById('wishlistIcon')?.addEventListener('click', openWishlistModal);