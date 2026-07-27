// ============================================================
// LOGIN / USER MANAGEMENT
// ============================================================

(function() {
    'use strict';

    // DOM References
    const userIcon = document.getElementById('userIcon');
    const userName = document.getElementById('userName');
    const container = document.getElementById('productsContainer');
    const recentlyViewedContainer = document.getElementById('recentlyViewedContainer');
    const recentlyViewedSection = document.getElementById('recentlyViewedSection');
    const cartCount = document.getElementById('cartCount');
    const wishlistIcon = document.getElementById('wishlistIcon');

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================

    const AppState = {
        products: [],
        currentProduct: null,
        currentImageIndex: 0,
        quantity: 1,
        selectedPaymentMethod: 'card',
        isLoading: false,
        isProcessing: false
    };

    // ============================================================
    // STORAGE HELPERS
    // ============================================================

    const Storage = {
        get(key, defaultValue = null) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : defaultValue;
            } catch {
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch {
                return false;
            }
        },

        getCurrentUser() {
            return this.get('currentUser');
        },

        getWishlist() {
            return this.get('wishlist', []);
        },

        getCart() {
            return this.get('cart', []);
        },

        getOrders() {
            return this.get('orders', []);
        },

        getRecentlyViewed() {
            return this.get('recentlyViewed', []);
        },

        setWishlist(items) {
            return this.set('wishlist', items);
        },

        setCart(items) {
            return this.set('cart', items);
        },

        setOrders(items) {
            return this.set('orders', items);
        },

        setRecentlyViewed(items) {
            return this.set('recentlyViewed', items);
        }
    };

    // ============================================================
    // SETTINGS-AWARE CHECKOUT HELPERS
    // ============================================================

    const SettingsHelper = {
        async ensureReady() {
            if (window.UZCRAFT?.ready) {
                try {
                    await window.UZCRAFT.ready;
                } catch {
                    // Ignore
                }
            }
        },

        getLocalSettings() {
            return window.UZCRAFT?.getLocalSettings ? window.UZCRAFT.getLocalSettings() : {};
        },

        isGuestCheckoutAllowed() {
            const settings = this.getLocalSettings();
            return settings.userManagement?.guestCheckoutEnabled !== false;
        },

        createGuestUser() {
            return {
                _id: `guest_${Date.now()}`,
                email: `guest-${Date.now()}@guest.local`,
                username: 'Guest',
                name: 'Guest',
                isGuest: true
            };
        }
    };

    // ============================================================
    // FORMAT HELPERS
    // ============================================================

    const Formatter = {
        currency(value) {
            if (window.UZCRAFT?.formatMoney) {
                return window.UZCRAFT.formatMoney(value);
            }
            return `$${Number(value || 0).toFixed(2)}`;
        },

        getStockStatus(stock) {
            if (stock === undefined || stock === null || stock > 10) {
                return { label: 'In Stock', class: 'in-stock' };
            }
            if (stock > 0) {
                return { label: 'Low Stock', class: 'low-stock' };
            }
            return { label: 'Out of Stock', class: 'out-of-stock' };
        },

        getProductImage(product) {
            return product?.images?.[0] || product?.image || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image';
        },

        getProductId(product) {
            return product?._id || product?.id || null;
        },

        normalizeProduct(product) {
            if (!product) return null;

            return {
                ...product,
                _id: product._id || product.id || `temp_${Date.now()}_${Math.random()}`,
                id: product._id || product.id || `temp_${Date.now()}_${Math.random()}`
            };
        },

        normalizeProducts(products) {
            if (!Array.isArray(products)) return [];
            return products.map(p => this.normalizeProduct(p)).filter(Boolean);
        }
    };

    // ============================================================
    // API CLIENT
    // ============================================================

    const API = {
        baseURL: 'http://localhost:3000/api',

        async request(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                },
                ...options
            };

            try {
                const response = await fetch(url, config);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || `HTTP ${response.status}`);
                }

                return data;
            } catch (error) {
                console.error(`API Error [${endpoint}]:`, error);
                throw error;
            }
        },

        async getProducts(category = 'Textiles') {
            const data = await this.request(`/products/category/${encodeURIComponent(category)}`);
            
            // Support both { success, products } and direct array
            if (data.success && Array.isArray(data.products)) {
                return Formatter.normalizeProducts(data.products);
            }
            if (Array.isArray(data)) {
                return Formatter.normalizeProducts(data);
            }
            if (data.products && Array.isArray(data.products)) {
                return Formatter.normalizeProducts(data.products);
            }
            return [];
        },

        async getProduct(id) {
            if (!id) throw new Error('Product ID is required');

            const data = await this.request(`/products/${id}`);
            
            // Support both { success, product } and direct object
            let product = data.product || data;
            if (data.success && data.product) {
                product = data.product;
            }

            if (!product || typeof product !== 'object') {
                throw new Error('Product not found');
            }

            return Formatter.normalizeProduct(product);
        },

        async createOrder(orderData) {
            const response = await this.request('/orders', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });

            // Support both { success, order } and direct order
            if (response.success && response.order) {
                return response.order;
            }
            if (response.order) {
                return response.order;
            }
            return response;
        }
    };

    // ============================================================
    // TOAST NOTIFICATIONS
    // ============================================================

    const Toast = {
        show(message, type = 'info', duration = 4000) {
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

            let timeout = setTimeout(() => {
                this.hide(toast);
            }, duration);

            toast.addEventListener('mouseenter', () => {
                clearTimeout(timeout);
            });

            toast.addEventListener('mouseleave', () => {
                timeout = setTimeout(() => {
                    this.hide(toast);
                }, 2000);
            });

            return toast;
        },

        hide(toast) {
            if (!toast) return;
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        },

        success(message) {
            return this.show(message, 'success');
        },

        error(message) {
            return this.show(message, 'error');
        },

        warning(message) {
            return this.show(message, 'warning');
        },

        info(message) {
            return this.show(message, 'info');
        }
    };

    // ============================================================
    // CART MANAGEMENT
    // ============================================================

    const CartManager = {
        getItems() {
            return Storage.getCart();
        },

        addItem(product, quantity = 1) {
            if (!product) return false;

            const normalized = Formatter.normalizeProduct(product);
            const cart = this.getItems();
            const existing = cart.find(item => item._id === normalized._id);

            if (existing) {
                existing.quantity = (existing.quantity || 0) + quantity;
            } else {
                cart.push({
                    ...normalized,
                    quantity: Math.max(1, quantity)
                });
            }

            Storage.setCart(cart);
            this.updateUI();
            return true;
        },

        removeItem(productId) {
            if (!productId) return false;
            const cart = this.getItems().filter(item => item._id !== productId);
            Storage.setCart(cart);
            this.updateUI();
            return true;
        },

        updateQuantity(productId, quantity) {
            if (!productId || quantity < 1) return false;
            const cart = this.getItems();
            const item = cart.find(i => i._id === productId);
            if (item) {
                item.quantity = quantity;
                Storage.setCart(cart);
                this.updateUI();
                return true;
            }
            return false;
        },

        getTotal() {
            return this.getItems().reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        },

        getCount() {
            return this.getItems().reduce((sum, item) => sum + (item.quantity || 1), 0);
        },

        clear() {
            Storage.setCart([]);
            this.updateUI();
        },

        updateUI() {
            if (cartCount) {
                cartCount.textContent = this.getCount();
            }
        }
    };

    // ============================================================
    // WISHLIST MANAGEMENT
    // ============================================================

    const WishlistManager = {
        getItems() {
            return Storage.getWishlist();
        },

        toggle(product) {
            if (!product) return false;

            const normalized = Formatter.normalizeProduct(product);
            const wishlist = this.getItems();
            const index = wishlist.findIndex(item => item._id === normalized._id);

            if (index > -1) {
                wishlist.splice(index, 1);
                Storage.setWishlist(wishlist);
                Toast.info('Removed from wishlist ❤️');
                return false;
            }

            wishlist.push(normalized);
            Storage.setWishlist(wishlist);
            Toast.success('Added to wishlist ❤️');
            return true;
        },

        isInWishlist(productId) {
            if (!productId) return false;
            return this.getItems().some(item => item._id === productId);
        },

        clear() {
            Storage.setWishlist([]);
            Toast.info('Wishlist cleared');
        },

        getCount() {
            return this.getItems().length;
        }
    };

    // ============================================================
    // RECENTLY VIEWED MANAGEMENT
    // ============================================================

    const RecentlyViewedManager = {
        getItems() {
            return Storage.getRecentlyViewed();
        },

        add(product, maxItems = 8) {
            if (!product) return;

            const normalized = Formatter.normalizeProduct(product);
            let items = this.getItems();
            items = items.filter(item => item._id !== normalized._id);
            items.unshift(normalized);

            if (items.length > maxItems) {
                items = items.slice(0, maxItems);
            }

            Storage.setRecentlyViewed(items);
            this.render();
        },

        clear() {
            Storage.setRecentlyViewed([]);
            this.render();
            Toast.info('Cleared recently viewed');
        },

        render() {
            const items = this.getItems();

            if (!recentlyViewedSection) return;

            if (items.length === 0) {
                recentlyViewedSection.style.display = 'none';
                return;
            }

            recentlyViewedSection.style.display = 'block';
            if (recentlyViewedContainer) {
                recentlyViewedContainer.innerHTML = '';
                const countEl = document.getElementById('recentCount');
                if (countEl) countEl.textContent = items.length;

                items.forEach(product => {
                    const image = Formatter.getProductImage(product);
                    const card = document.createElement('div');
                    card.className = 'product-card';
                    card.innerHTML = `
                        <div class="card-image-wrapper" onclick="ProductModal.open('${product._id}')">
                            <img src="${image}" alt="${product.name}" loading="lazy" 
                                 onerror="this.src='https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'">
                        </div>
                        <div class="product-info">
                            <h3 class="product-name">${product.name || 'Product'}</h3>
                            <div class="product-bottom">
                                <span class="product-price">${Formatter.currency(product.price)}</span>
                                <div class="product-cart" onclick="event.stopPropagation(); CartManager.addItem(product)">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1 5h12m-9 0a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    `;
                    recentlyViewedContainer.appendChild(card);
                });
            }
        }
    };

    // ============================================================
    // PRODUCT MODAL
    // ============================================================

    const ProductModal = {
        _modal: null,
        _isOpen: false,

        async open(productId) {
            if (!productId) {
                Toast.error('Product ID is required');
                return;
            }

            if (this._isOpen) {
                this.close();
            }

            try {
                let product = AppState.products.find(p => p._id === productId);

                if (!product) {
                    product = await API.getProduct(productId);
                }

                if (!product) {
                    Toast.error('Product not found');
                    return;
                }

                AppState.currentProduct = product;
                AppState.currentImageIndex = 0;
                AppState.quantity = 1;

                RecentlyViewedManager.add(product);
                this._render(product);
                this._isOpen = true;

            } catch (error) {
                console.error('Error opening product:', error);
                Toast.error('Failed to load product details');

                // Try to find product in DOM as fallback
                const fallbackProduct = this._getProductFromDOM(productId);
                if (fallbackProduct) {
                    AppState.currentProduct = fallbackProduct;
                    this._render(fallbackProduct);
                    this._isOpen = true;
                    Toast.info('Showing product from list');
                }
            }
        },

        close() {
            const modal = document.querySelector('.product-modal-overlay');
            if (modal) modal.remove();
            document.body.style.overflow = '';
            this._isOpen = false;
            AppState.currentProduct = null;
            AppState.currentImageIndex = 0;
            AppState.quantity = 1;
        },

        _render(product) {
            if (!product) return;

            const images = product.images || [product.image || 'https://placehold.co/400x400/f0f2f8/8f8f8f?text=No+Image'];
            const hasMultipleImages = images.length > 1;
            const stockStatus = Formatter.getStockStatus(product.stock);
            const isInWishlist = WishlistManager.isInWishlist(product._id);
            const productId = product._id;

            const modal = document.createElement('div');
            modal.className = 'product-modal-overlay';
            modal.innerHTML = `
                <div class="product-modal" role="dialog" aria-modal="true" aria-label="Product details">
                    <button class="modal-close" onclick="ProductModal.close()" aria-label="Close modal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <div class="modal-content">
                        <div class="modal-left">
                            <div class="modal-image-container">
                                <img id="modalMainImage" src="${images[0]}" alt="${product.name}" 
                                     onerror="this.src='https://placehold.co/400x400/f0f2f8/8f8f8f?text=No+Image'">
                                ${hasMultipleImages ? `
                                    <button class="modal-slider-btn left" onclick="ProductModal.changeImage(-1)" aria-label="Previous image">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                        </svg>
                                    </button>
                                    <button class="modal-slider-btn right" onclick="ProductModal.changeImage(1)" aria-label="Next image">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                        </svg>
                                    </button>
                                    <div class="modal-dots" id="modalDots">
                                        ${images.map((_, i) => `
                                            <span class="${i === 0 ? 'active' : ''}" 
                                                  onclick="ProductModal.changeImageTo(${i})" 
                                                  role="button" aria-label="Go to image ${i + 1}"></span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                            ${hasMultipleImages ? `
                                <div class="modal-thumbnails" id="modalThumbnails">
                                    ${images.map((img, i) => `
                                        <img src="${img}" onclick="ProductModal.changeImageTo(${i})" 
                                             class="${i === 0 ? 'active-thumb' : ''}" 
                                             onerror="this.src='https://placehold.co/100x100/f0f2f8/8f8f8f?text=No+Image'" 
                                             alt="Thumbnail ${i + 1}">
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>

                        <div class="modal-right">
                            <h2 class="modal-product-name">${product.name || 'Product'}</h2>
                            <div>
                                <span class="modal-product-price">${Formatter.currency(product.price)}</span>
                                ${product.originalPrice ? `<span class="modal-original-price">${Formatter.currency(product.originalPrice)}</span>` : ''}
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
                                    <button onclick="ProductModal.changeQuantity(-1)" aria-label="Decrease quantity">−</button>
                                    <span id="quantityDisplay">1</span>
                                    <button onclick="ProductModal.changeQuantity(1)" aria-label="Increase quantity">+</button>
                                </div>
                            </div>

                            <div class="modal-actions">
                                <button class="btn-add-cart" onclick="ProductModal.addToCart()">
                                    <i class="fa-solid fa-cart-plus"></i>
                                    Add to Cart
                                </button>
                                <button class="btn-buy-now" onclick="ProductModal.buyNow()">
                                    <i class="fa-solid fa-bolt"></i>
                                    Buy Now
                                </button>
                            </div>

                            <div class="modal-share">
                                <span>Share:</span>
                                <button onclick="ProductModal.share('facebook')" aria-label="Share on Facebook">
                                    <i class="fa-brands fa-facebook-f"></i>
                                </button>
                                <button onclick="ProductModal.share('twitter')" aria-label="Share on Twitter">
                                    <i class="fa-brands fa-twitter"></i>
                                </button>
                                <button onclick="ProductModal.share('pinterest')" aria-label="Share on Pinterest">
                                    <i class="fa-brands fa-pinterest-p"></i>
                                </button>
                                <button onclick="ProductModal.share('copy')" aria-label="Copy link">
                                    <i class="fa-regular fa-link"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
            this._modal = modal;
        },

        changeImage(direction) {
            const product = AppState.currentProduct;
            if (!product) return;

            const images = product.images || [product.image];
            if (images.length <= 1) return;

            AppState.currentImageIndex = (AppState.currentImageIndex + direction + images.length) % images.length;
            this._updateModalImage(images);
        },

        changeImageTo(index) {
            const product = AppState.currentProduct;
            if (!product) return;

            const images = product.images || [product.image];
            if (index < 0 || index >= images.length) return;

            AppState.currentImageIndex = index;
            this._updateModalImage(images);
        },

        _updateModalImage(images) {
            const mainImg = document.getElementById('modalMainImage');
            if (mainImg) {
                mainImg.src = images[AppState.currentImageIndex];
            }

            const dots = document.querySelectorAll('.modal-dots span');
            dots.forEach((dot, i) => {
                dot.className = i === AppState.currentImageIndex ? 'active' : '';
            });

            const thumbs = document.querySelectorAll('.modal-thumbnails img');
            thumbs.forEach((thumb, i) => {
                thumb.className = i === AppState.currentImageIndex ? 'active-thumb' : '';
            });
        },

        changeQuantity(delta) {
            AppState.quantity = Math.max(1, AppState.quantity + delta);
            const display = document.getElementById('quantityDisplay');
            if (display) display.textContent = AppState.quantity;
        },

        addToCart() {
            const product = AppState.currentProduct;
            if (!product) {
                Toast.error('No product selected');
                return;
            }

            CartManager.addItem(product, AppState.quantity);
            Toast.success(`Added "${product.name}" to cart!`);
            this.close();
        },

        async buyNow() {
            const product = AppState.currentProduct;
            if (!product) {
                Toast.error('No product selected');
                return;
            }

            await SettingsHelper.ensureReady();
            const user = Storage.getCurrentUser();

            if (!user && !SettingsHelper.isGuestCheckoutAllowed()) {
                Toast.warning('Please login to continue');
                setTimeout(() => {
                    window.location.href = '/login/html/index.html';
                }, 1000);
                return;
            }

            PaymentModal.open(product);
        },

        share(platform) {
            const product = AppState.currentProduct;
            if (!product) return;

            const url = window.location.href;
            const text = `Check out ${product.name} on UZCRAFT!`;

            const shareUrls = {
                facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
                twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}&media=${encodeURIComponent(product.images?.[0] || '')}`
            };

            if (platform === 'copy') {
                navigator.clipboard.writeText(url).then(() => {
                    Toast.success('Link copied to clipboard! 📋');
                }).catch(() => {
                    const input = document.createElement('input');
                    input.value = url;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    Toast.success('Link copied to clipboard! 📋');
                });
                return;
            }

            if (shareUrls[platform]) {
                window.open(shareUrls[platform], '_blank', 'width=600,height=400');
            }
        },

        _getProductFromDOM(productId) {
            const card = document.querySelector(`.product-card[data-id="${productId}"]`);
            if (!card) return null;

            const name = card.querySelector('.product-name')?.textContent || 'Product';
            const priceText = card.querySelector('.product-price')?.textContent || '$0';
            const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
            const img = card.querySelector('img')?.src || 'https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image';

            return {
                _id: productId,
                id: productId,
                name,
                price,
                images: [img],
                description: 'Product details',
                category: 'Textiles',
                stock: 10,
                materials: 'Various',
                region: 'Uzbekistan'
            };
        }
    };

    // ============================================================
    // PAYMENT MODAL
    // ============================================================

    const PaymentModal = {
        _modal: null,
        _isOpen: false,

        open(product) {
            if (!product) {
                Toast.error('No product selected');
                return;
            }

            if (this._isOpen) {
                this.close();
            }

            const total = (product.price || 0) * AppState.quantity;
            const image = Formatter.getProductImage(product);

            const modal = document.createElement('div');
            modal.className = 'payment-modal-overlay';
            modal.innerHTML = `
                <div class="payment-modal" role="dialog" aria-modal="true" aria-label="Payment checkout">
                    <button class="payment-close" onclick="PaymentModal.close()" aria-label="Close payment">
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <div class="payment-header">
                        <h2>💳 Checkout</h2>
                        <p>Complete your purchase securely</p>
                    </div>

                    <div class="payment-summary">
                        <div class="payment-product">
                            <img src="${image}" alt="${product.name}" 
                                 onerror="this.src='https://placehold.co/56x56/f0f2f8/8f8f8f?text=No+Image'">
                            <div>
                                <h4>${product.name || 'Product'}</h4>
                                <p>Quantity: ${AppState.quantity}</p>
                            </div>
                        </div>
                        <div class="payment-total">
                            <span>Total:</span>
                            <span class="payment-total-price">${Formatter.currency(total)}</span>
                        </div>
                    </div>

                    <form id="paymentForm" onsubmit="PaymentModal.process(event)">
                        <div class="payment-methods">
                            ${['card', 'paypal', 'apple', 'google'].map(method => `
                                <div class="payment-method ${method === 'card' ? 'active' : ''}" 
                                     onclick="PaymentModal.selectMethod('${method}')" 
                                     data-method="${method}">
                                    <i class="${PaymentModal._getIcon(method)}"></i>
                                    <span>${PaymentModal._getLabel(method)}</span>
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
                                    <i class="${PaymentModal._getIcon(method)}" style="font-size:48px;display:block;margin-bottom:8px;${method === 'paypal' ? 'color:#003087;' : method === 'apple' ? 'color:#000;' : 'color:#4285f4;'}"></i>
                                    <p>${PaymentModal._getDescription(method)}</p>
                                </div>
                            </div>
                        `).join('')}

                        <button type="submit" class="payment-submit-btn" id="paymentSubmitBtn">
                            <i class="fa-solid fa-lock"></i>
                            Pay ${Formatter.currency(total)} Securely
                        </button>
                    </form>

                    <div class="payment-security">
                        <i class="fa-solid fa-shield-check"></i>
                        <span>Secure payment powered by SSL encryption</span>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
            this._modal = modal;
            this._isOpen = true;

            // Setup input formatting
            this._setupInputFormatting(modal);
        },

        close() {
            const modal = document.querySelector('.payment-modal-overlay');
            if (modal) modal.remove();
            document.body.style.overflow = '';
            this._isOpen = false;
        },

        selectMethod(method) {
            AppState.selectedPaymentMethod = method;

            document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('active'));
            document.querySelector(`.payment-method[data-method="${method}"]`)?.classList.add('active');

            document.getElementById('cardDetails').style.display = method === 'card' ? 'block' : 'none';
            document.getElementById('paypalDetails').style.display = method === 'paypal' ? 'block' : 'none';
            document.getElementById('appleDetails').style.display = method === 'apple' ? 'block' : 'none';
            document.getElementById('googleDetails').style.display = method === 'google' ? 'block' : 'none';
        },

        async process(e) {
            e.preventDefault();

            const product = AppState.currentProduct;
            if (!product) {
                Toast.error('No product selected');
                return;
            }

            await SettingsHelper.ensureReady();

            const currentUser = Storage.getCurrentUser();
            let checkoutUser = currentUser;

            if (!checkoutUser) {
                if (!SettingsHelper.isGuestCheckoutAllowed()) {
                    Toast.warning('Please login to complete purchase');
                    this.close();
                    window.location.href = '/login/html/index.html';
                    return;
                }
                checkoutUser = SettingsHelper.createGuestUser();
            }

            const btn = document.getElementById('paymentSubmitBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;

            try {
                const orderData = {
                    user: checkoutUser._id,
                    products: [{
                        product: product._id,
                        quantity: AppState.quantity,
                        price: product.price
                    }],
                    totalPrice: (product.price || 0) * AppState.quantity,
                    paymentMethod: AppState.selectedPaymentMethod,
                    shippingAddress: checkoutUser.address || '',
                    phone: checkoutUser.phone || '',
                    status: 'pending'
                };

                const createdOrder = await API.createOrder(orderData);

                // Save to localStorage
                const orders = Storage.getOrders();
                const localOrder = {
                    id: createdOrder._id || createdOrder.id,
                    product: product,
                    quantity: AppState.quantity,
                    total: createdOrder.totalPrice || orderData.totalPrice,
                    date: createdOrder.createdAt || new Date().toISOString(),
                    status: createdOrder.status || 'pending',
                    paymentMethod: createdOrder.paymentMethod || orderData.paymentMethod,
                    orderNumber: createdOrder._id || createdOrder.id,
                    serverOrder: createdOrder
                };

                orders.push(localOrder);
                Storage.setOrders(orders);

                // Remove from cart
                CartManager.removeItem(product._id);

                // Update UI
                btn.innerHTML = '✅ Order Placed!';
                btn.style.background = '#16a34a';
                btn.style.color = '#fff';

                Toast.success(`🎉 Order #${localOrder.orderNumber} confirmed!`);

                setTimeout(() => {
                    this.close();
                    ProductModal.close();
                    AppState.quantity = 1;
                }, 1500);

            } catch (error) {
                console.error('Payment processing error:', error);
                btn.innerHTML = '❌ Payment Failed';
                btn.style.background = '#dc2626';
                btn.style.color = '#fff';
                Toast.error(error.message || 'Payment failed');

                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '#059669';
                    btn.style.color = '#fff';
                    btn.disabled = false;
                }, 2000);
            }
        },

        _getIcon(method) {
            const icons = {
                card: 'fa-regular fa-credit-card',
                paypal: 'fa-brands fa-paypal',
                apple: 'fa-brands fa-apple-pay',
                google: 'fa-brands fa-google-pay'
            };
            return icons[method] || 'fa-regular fa-credit-card';
        },

        _getLabel(method) {
            const labels = {
                card: 'Card',
                paypal: 'PayPal',
                apple: 'Apple Pay',
                google: 'Google Pay'
            };
            return labels[method] || method;
        },

        _getDescription(method) {
            const descriptions = {
                paypal: 'You will be redirected to PayPal to complete your payment.',
                apple: 'Apple Pay will open on your device to complete the payment.',
                google: 'Google Pay will open to complete your payment.'
            };
            return descriptions[method] || '';
        },

        _setupInputFormatting(modal) {
            // Card number formatting
            const cardInput = modal.querySelector('input[placeholder="1234 5678 9012 3456"]');
            if (cardInput) {
                cardInput.addEventListener('input', function() {
                    let value = this.value.replace(/\D/g, '');
                    value = value.replace(/(.{4})/g, '$1 ').trim();
                    this.value = value;
                });
            }

            // Expiry date formatting
            const expiryInput = modal.querySelector('input[placeholder="MM/YY"]');
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
    };

    // ============================================================
    // PRODUCT LIST
    // ============================================================

    const ProductList = {
        async load(category = 'Textiles') {
            if (AppState.isLoading) return;

            AppState.isLoading = true;
            this.showSkeletons(8);

            try {
                const products = await API.getProducts(category);
                AppState.products = products;

                this.render(products);

                const countEl = document.getElementById('productCount');
                if (countEl) countEl.textContent = products.length;

                RecentlyViewedManager.render();
                CartManager.updateUI();

            } catch (error) {
                console.error('Error loading products:', error);
                this.showError();
            } finally {
                AppState.isLoading = false;
            }
        },

        render(products) {
            if (!container) return;

            container.innerHTML = '';

            if (!products || products.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                        <i class="fa-solid fa-box-open" style="font-size:48px;color:var(--text-muted);margin-bottom:16px;"></i>
                        <h3 style="color:var(--text-primary);margin-bottom:8px;">No products found</h3>
                        <p style="color:var(--text-muted);">Try adjusting your filters or check back later.</p>
                    </div>
                `;
                return;
            }

            products.forEach(product => this._renderCard(product));
        },

        _renderCard(product) {
            if (!product) return;

            const image = Formatter.getProductImage(product);
            const isInWishlist = WishlistManager.isInWishlist(product._id);
            const stockStatus = Formatter.getStockStatus(product.stock);
            const productId = product._id;

            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.id = productId;

            card.innerHTML = `
                <div class="card-image-wrapper" onclick="ProductModal.open('${productId}')">
                    <img src="${image}" alt="${product.name}" loading="lazy" 
                         onerror="this.src='https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'">

                    <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" 
                            onclick="event.stopPropagation(); ProductActions.toggleWishlist('${productId}')">
                        <i class="fa-${isInWishlist ? 'solid' : 'regular'} fa-heart"></i>
                    </button>

                    <span class="availability-badge ${stockStatus.class}">${stockStatus.label}</span>

                    <div class="quick-actions">
                        <button onclick="event.stopPropagation(); ProductActions.quickAdd('${productId}')">
                            <i class="fa-solid fa-cart-plus"></i> Quick Add
                        </button>
                        <button onclick="event.stopPropagation(); ProductModal.open('${productId}')">
                            <i class="fa-regular fa-eye"></i> View
                        </button>
                    </div>
                </div>

                <div class="product-info">
                    <h3 class="product-name">${product.name || 'Product'}</h3>

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
                            ${Formatter.currency(product.price)}
                            ${product.originalPrice ? `<span class="original-price">${Formatter.currency(product.originalPrice)}</span>` : ''}
                        </span>
                        <div class="product-cart" onclick="event.stopPropagation(); ProductActions.addToCart('${productId}')">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1 5h12m-9 0a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
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
        },

        showSkeletons(count) {
            if (!container) return;
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
        },

        showError() {
            if (!container) return;
            container.innerHTML = `
                <div class="error-state" style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:48px;color:var(--text-muted);margin-bottom:16px;"></i>
                    <h3 style="color:var(--text-primary);margin-bottom:8px;">Failed to load products</h3>
                    <p style="color:var(--text-muted);">Please check your connection and try again.</p>
                    <button onclick="ProductList.load()" style="margin-top:16px;padding:10px 28px;border:none;border-radius:50px;background:var(--primary-green);color:#fff;font-weight:600;cursor:pointer;">
                        <i class="fa-solid fa-rotate"></i> Retry
                    </button>
                </div>
            `;
        }
    };

    // ============================================================
    // PRODUCT ACTIONS
    // ============================================================

    const ProductActions = {
        getProduct(productId) {
            if (!productId) return null;
            return AppState.products.find(p => p._id === productId) || null;
        },

        addToCart(productId) {
            const product = this.getProduct(productId);
            if (!product) {
                Toast.error('Product not found');
                return;
            }
            CartManager.addItem(product);
        },

        quickAdd(productId) {
            const product = this.getProduct(productId);
            if (!product) {
                Toast.error('Product not found');
                return;
            }
            CartManager.addItem(product);
            Toast.success(`Added "${product.name}" to cart!`);
        },

        toggleWishlist(productId) {
            const product = this.getProduct(productId);
            if (!product) {
                Toast.error('Product not found');
                return;
            }

            const isAdded = WishlistManager.toggle(product);
            this._updateWishlistUI(productId, isAdded);
        },

        _updateWishlistUI(productId, isAdded) {
            const card = document.querySelector(`.product-card[data-id="${productId}"]`);
            if (!card) return;

            const btn = card.querySelector('.wishlist-btn');
            if (btn) {
                btn.innerHTML = `<i class="fa-${isAdded ? 'solid' : 'regular'} fa-heart"></i>`;
                btn.classList.toggle('active', isAdded);
            }
        }
    };

    // ============================================================
    // WISHLIST MODAL
    // ============================================================

    const WishlistModal = {
        open() {
            const items = WishlistManager.getItems();

            if (items.length === 0) {
                Toast.info('Your wishlist is empty ❤️');
                return;
            }

            const existingModal = document.querySelector('.wishlist-modal-overlay');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.className = 'wishlist-modal-overlay';
            modal.innerHTML = `
                <div class="wishlist-modal" role="dialog" aria-modal="true" aria-label="Wishlist">
                    <button class="wishlist-modal-close" onclick="WishlistModal.close()" aria-label="Close wishlist">
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <div class="wishlist-header">
                        <h2><i class="fa-regular fa-heart" style="color:#ef4444;"></i> My Wishlist</h2>
                        <span class="wishlist-count">${items.length} items</span>
                    </div>

                    <div class="wishlist-grid">
                        ${items.map(product => `
                            <div class="wishlist-item" onclick="ProductModal.open('${product._id}')">
                                <img src="${Formatter.getProductImage(product)}" alt="${product.name}" 
                                     onerror="this.src='https://placehold.co/300x300/f0f2f8/8f8f8f?text=No+Image'">
                                <div class="wishlist-item-info">
                                    <h4>${product.name || 'Product'}</h4>
                                    <p>${Formatter.currency(product.price)}</p>
                                    <button class="wishlist-remove-btn" onclick="event.stopPropagation(); ProductActions.toggleWishlist('${product._id}')">
                                        <i class="fa-solid fa-trash-can"></i> Remove
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="wishlist-footer">
                        <button class="wishlist-clear-btn" onclick="WishlistModal.clear()">
                            <i class="fa-solid fa-trash-can"></i> Clear All
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
        },

        close() {
            const modal = document.querySelector('.wishlist-modal-overlay');
            if (modal) modal.remove();
            document.body.style.overflow = '';
        },

        clear() {
            if (confirm('Are you sure you want to clear your wishlist?')) {
                WishlistManager.clear();
                this.close();
                // Update all wishlist buttons
                document.querySelectorAll('.wishlist-btn').forEach(btn => {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                });
            }
        }
    };

    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    const UserManager = {
        init() {
            const user = Storage.getCurrentUser();

            if (user && userName) {
                userName.textContent = user.username || user.name || 'User';
            }

            if (userIcon) {
                userIcon.addEventListener('click', this._handleUserClick);
            }

            if (userName) {
                userName.addEventListener('click', this._handleUserClick);
            }
        },

        _handleUserClick() {
            const user = Storage.getCurrentUser();
            window.location.href = user ? '/client/profile/profile.html' : '/login/html/index.html';
        }
    };

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (document.querySelector('.product-modal-overlay')) {
                ProductModal.close();
            }
            if (document.querySelector('.payment-modal-overlay')) {
                PaymentModal.close();
            }
            if (document.querySelector('.wishlist-modal-overlay')) {
                WishlistModal.close();
            }
        }

        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && 
            document.querySelector('.product-modal')) {
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            ProductModal.changeImage(direction);
            e.preventDefault();
        }
    });

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function init() {
        // Load products
        ProductList.load('Textiles');

        // Initialize user
        UserManager.init();

        // Update cart count
        CartManager.updateUI();

        // Setup wishlist icon click
        if (wishlistIcon) {
            wishlistIcon.addEventListener('click', WishlistModal.open);
        }

        console.log('✅ Textiles module initialized successfully');
    }

    // Handle DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================================
    // EXPOSE PUBLIC API
    // ============================================================

    window.ProductList = ProductList;
    window.ProductModal = ProductModal;
    window.PaymentModal = PaymentModal;
    window.WishlistModal = WishlistModal;
    window.ProductActions = ProductActions;
    window.CartManager = CartManager;
    window.WishlistManager = WishlistManager;
    window.RecentlyViewedManager = RecentlyViewedManager;
    window.Toast = Toast;
    window.API = API;
    window.AppState = AppState;
    window.Storage = Storage;
    window.Formatter = Formatter;

})();