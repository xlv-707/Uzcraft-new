// ============================================================
// 🚀 UZCRAFT CHAT WIDGET - PRODUCTION VERSION v2.0
// ============================================================
// Pure Socket.IO | No Polling | Zero Memory Leaks
// Full Feature Set | Enterprise Grade
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // ⚙️ CONFIGURATION
    // ============================================================
    const CONFIG = Object.freeze({
        API_BASE: 'http://localhost:3000/api',
        SOCKET_URL: 'http://localhost:3000',
        MAX_RETRIES: 5,
        RETRY_DELAY: 1000,
        MAX_MESSAGE_LENGTH: 5000,
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        MAX_MESSAGES_PER_PAGE: 30,
        EDIT_TIMEOUT: 15 * 60 * 1000, // 15 minutes
        ADMIN_ROLE: 'admin',
        TYPING_TIMEOUT: 3000,
        DEBOUNCE_DELAY: 300,
        THROTTLE_DELAY: 100,
        SOUND_ENABLED: true,
        NOTIFICATIONS_ENABLED: true
    });

    // ============================================================
    // 🎯 STATE MANAGEMENT
    // ============================================================
    class AppState {
        constructor() {
            this.messages = [];
            this.isOpen = false;
            this.isSending = false;
            this.isLoading = false;
            this.isTyping = false;
            this.messageCache = new Map();
            this.unreadCount = 0;
            this.userId = null;
            this.adminId = null;
            this.adminName = 'Support';
            this.isInitialized = false;
            this.isAdminFetched = false;
            this._fetchingAdmin = false;
            this._isFirstLoad = true;
            this._hasMoreMessages = true;
            this._currentPage = 1;
            this._isAtBottom = true;
            this._isSearching = false;
            this._searchQuery = '';
            this._searchResults = [];
            this._pinnedMessages = [];
            this._replyTo = null;
            this._editingMessage = null;
            this._uploadQueue = [];
            this._isUploading = false;
            this._socketConnected = false;
            this._reconnectAttempts = 0;
            this._offlineQueue = [];
            this._typingTimeout = null;
            this._lastMessageTime = null;
        }

        reset() {
            this.messages = [];
            this.messageCache.clear();
            this.unreadCount = 0;
            this.isLoading = false;
            this.isSending = false;
            this._isFirstLoad = true;
            this._hasMoreMessages = true;
            this._currentPage = 1;
            this._isAtBottom = true;
            this._searchQuery = '';
            this._searchResults = [];
            this._pinnedMessages = [];
            this._replyTo = null;
            this._editingMessage = null;
            this._uploadQueue = [];
            this._isUploading = false;
        }

        get hasMessages() {
            return this.messages.length > 0;
        }

        get lastMessage() {
            return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
        }

        get onlineUsers() {
            return this._onlineUsers || new Set();
        }

        set onlineUsers(users) {
            this._onlineUsers = new Set(users);
        }

        get isUserOnline() {
            return this._onlineUsers && this._onlineUsers.has(this.userId);
        }
    }

    const State = new AppState();

    // ============================================================
    // 🛠️ UTILITY FUNCTIONS
    // ============================================================
    const Utils = {
        getCurrentUser() {
            try {
                const raw = localStorage.getItem('currentUser');
                if (!raw) return null;
                const user = JSON.parse(raw);
                return user && user._id ? user : null;
            } catch {
                return null;
            }
        },

        getUserId() {
            const user = this.getCurrentUser();
            return user?._id || null;
        },

        getUserName() {
            const user = this.getCurrentUser();
            return user?.username || user?.name || 'User';
        },

        generateTempId() {
            return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },

        generateMessageId() {
            return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },

        escapeHtml(text) {
            if (!text) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        },

        formatTime(isoString) {
            try {
                const date = new Date(isoString);
                if (isNaN(date.getTime())) return '';
                return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return '';
            }
        },

        formatDate(isoString) {
            try {
                const date = new Date(isoString);
                if (isNaN(date.getTime())) return '';
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

                if (msgDate.getTime() === today.getTime()) return 'Today';
                if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
                
                const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                if (diff < 7) {
                    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
                }
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            } catch {
                return '';
            }
        },

        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        isValidObjectId(id) {
            return id && /^[0-9a-fA-F]{24}$/.test(String(id));
        },

        normalizeMessage(raw) {
            if (!raw) return null;
            return {
                id: raw._id || raw.id || this.generateMessageId(),
                senderId: raw.senderId,
                receiverId: raw.receiverId,
                senderName: raw.senderName || 'User',
                message: raw.message || '',
                timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
                read: raw.read || false,
                delivered: raw.delivered || false,
                isTemp: raw.isTemp || false,
                isDeleted: raw.isDeleted || false,
                isEdited: raw.isEdited || false,
                editedAt: raw.editedAt || null,
                replyTo: raw.replyTo || null,
                attachments: raw.attachments || [],
                reactions: raw.reactions || {},
                pinned: raw.pinned || false,
                forwarded: raw.forwarded || false,
                originalSender: raw.originalSender || null
            };
        },

        normalizeMessages(rawArray) {
            if (!Array.isArray(rawArray)) return [];
            return rawArray.map(m => this.normalizeMessage(m)).filter(Boolean);
        },

        getMessageKey(msg) {
            return String(msg.id);
        },

        isMessageInCache(msg) {
            return State.messageCache.has(this.getMessageKey(msg));
        },

        addToCache(msg) {
            State.messageCache.set(this.getMessageKey(msg), msg);
        },

        removeFromCache(msg) {
            State.messageCache.delete(this.getMessageKey(msg));
        },

        getTimeAgo(timestamp) {
            const now = Date.now();
            const diff = now - new Date(timestamp).getTime();
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            return this.formatDate(timestamp);
        },

        debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        },

        throttle(fn, delay = CONFIG.THROTTLE_DELAY) {
            let lastCall = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    fn.apply(this, args);
                }
            };
        },

        isAtBottom(element) {
            if (!element) return true;
            const threshold = 100;
            return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
        },

        getFileType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
            const videoTypes = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
            const audioTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
            const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
            const spreadsheetTypes = ['xls', 'xlsx', 'csv', 'ods'];
            const presentationTypes = ['ppt', 'pptx', 'odp'];
            const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];

            if (imageTypes.includes(ext)) return 'image';
            if (videoTypes.includes(ext)) return 'video';
            if (audioTypes.includes(ext)) return 'audio';
            if (documentTypes.includes(ext)) return 'document';
            if (spreadsheetTypes.includes(ext)) return 'spreadsheet';
            if (presentationTypes.includes(ext)) return 'presentation';
            if (archiveTypes.includes(ext)) return 'archive';
            return 'other';
        },

        getFileIcon(filename) {
            const type = this.getFileType(filename);
            const icons = {
                image: 'fa-image',
                video: 'fa-video',
                audio: 'fa-music',
                document: 'fa-file-alt',
                spreadsheet: 'fa-file-excel',
                presentation: 'fa-file-powerpoint',
                archive: 'fa-file-archive',
                other: 'fa-file'
            };
            return icons[type] || 'fa-file';
        },

        sanitizeFileName(filename) {
            return filename.replace(/[^a-zA-Z0-9\-_.]/g, '_');
        }
    };

    // ============================================================
    // 🌐 API CLIENT
    // ============================================================
    class ApiClient {
        async request(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE}${endpoint}`;
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(options.headers || {})
                    },
                    ...options
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || data.error || `HTTP ${response.status}`);
                }

                return data;
            } catch (error) {
                throw error;
            }
        }

        async sendMessage(senderId, receiverId, message, senderName, replyTo = null, attachments = []) {
            if (!senderId || !receiverId || !message) {
                throw new Error('Missing required fields');
            }
            
            if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
                throw new Error(`Message exceeds ${CONFIG.MAX_MESSAGE_LENGTH} characters`);
            }

            const payload = {
                senderId,
                receiverId,
                senderName: senderName || 'Client',
                message: message.trim(),
                replyTo,
                attachments
            };

            return await this.request('/chat/send', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        async getConversation(user1, user2, page = 1, limit = CONFIG.MAX_MESSAGES_PER_PAGE) {
            if (!user1 || !user2) {
                throw new Error('Both user IDs required');
            }
            const data = await this.request(`/chat/conversation/${user1}/${user2}?page=${page}&limit=${limit}`);
            return Utils.normalizeMessages(data);
        }

        async markAsRead(messageId) {
            if (!messageId) throw new Error('Message ID required');
            return await this.request(`/chat/read/${messageId}`, {
                method: 'PUT'
            });
        }

        async markAsDelivered(messageId) {
            if (!messageId) throw new Error('Message ID required');
            return await this.request(`/chat/delivered/${messageId}`, {
                method: 'PUT'
            });
        }

        async getUnreadCount(userId) {
            if (!userId) throw new Error('User ID required');
            const data = await this.request(`/chat/unread/${userId}`);
            return data.count || 0;
        }

        async getAllUsers() {
            const data = await this.request('/users');
            return data.users || data || [];
        }

        async fetchAdminUser() {
            const users = await this.getAllUsers();
            const admin = users.find(u => u.role === CONFIG.ADMIN_ROLE);
            if (!admin) {
                throw new Error('Admin user not found in database');
            }
            return admin;
        }

        async editMessage(messageId, newMessage) {
            if (!messageId || !newMessage) throw new Error('Message ID and new message required');
            return await this.request(`/chat/edit/${messageId}`, {
                method: 'PUT',
                body: JSON.stringify({ message: newMessage })
            });
        }

        async deleteMessage(messageId, forEveryone = false) {
            if (!messageId) throw new Error('Message ID required');
            return await this.request(`/chat/delete/${messageId}`, {
                method: 'DELETE',
                body: JSON.stringify({ forEveryone })
            });
        }

        async togglePinMessage(messageId) {
            if (!messageId) throw new Error('Message ID required');
            return await this.request(`/chat/pin/${messageId}`, {
                method: 'PUT'
            });
        }

        async addReaction(messageId, reaction) {
            if (!messageId || !reaction) throw new Error('Message ID and reaction required');
            return await this.request(`/chat/reaction/${messageId}`, {
                method: 'POST',
                body: JSON.stringify({ reaction })
            });
        }

        async removeReaction(messageId, reaction) {
            if (!messageId || !reaction) throw new Error('Message ID and reaction required');
            return await this.request(`/chat/reaction/${messageId}`, {
                method: 'DELETE',
                body: JSON.stringify({ reaction })
            });
        }

        async searchMessages(userId, query) {
            if (!userId || !query) throw new Error('User ID and query required');
            return await this.request(`/chat/search/${userId}?q=${encodeURIComponent(query)}`);
        }

        async uploadFile(formData) {
            return await this.request('/chat/upload', {
                method: 'POST',
                body: formData,
                headers: {}
            });
        }

        async forwardMessage(messageId, targetUserId) {
            if (!messageId || !targetUserId) throw new Error('Message ID and target user ID required');
            return await this.request(`/chat/forward/${messageId}`, {
                method: 'POST',
                body: JSON.stringify({ targetUserId })
            });
        }

        async getChatStats(userId) {
            if (!userId) throw new Error('User ID required');
            return await this.request(`/chat/stats/${userId}`);
        }
    }

    const API = new ApiClient();

    // ============================================================
    // 🔌 SOCKET.IO MANAGER - REAL-TIME ONLY
    // ============================================================
    class SocketManager {
        constructor() {
            this.socket = null;
            this.isConnected = false;
            this.isInitialized = false;
            this._eventHandlers = new Map();
            this._reconnectTimer = null;
            this._connectionAttempts = 0;
            this._messageHandler = null;
            this._typingHandler = null;
            this._presenceHandler = null;
            this._reactionHandler = null;
            this._deleteHandler = null;
            this._editHandler = null;
            this._pinHandler = null;
            this._deliveredHandler = null;
            this._readHandler = null;
        }

        setHandlers(handlers) {
            this._messageHandler = handlers.message || null;
            this._typingHandler = handlers.typing || null;
            this._presenceHandler = handlers.presence || null;
            this._reactionHandler = handlers.reaction || null;
            this._deleteHandler = handlers.delete || null;
            this._editHandler = handlers.edit || null;
            this._pinHandler = handlers.pin || null;
            this._deliveredHandler = handlers.delivered || null;
            this._readHandler = handlers.read || null;
        }

        connect() {
            if (this.isInitialized && this.socket) {
                return;
            }

            if (this._connectionAttempts >= CONFIG.MAX_RETRIES) {
                return;
            }

            try {
                this.socket = io(CONFIG.SOCKET_URL, {
                    reconnection: true,
                    reconnectionAttempts: CONFIG.MAX_RETRIES,
                    reconnectionDelay: CONFIG.RETRY_DELAY,
                    timeout: 10000,
                    transports: ['websocket', 'polling']
                });

                this._setupEventListeners();
                this.isInitialized = true;
                this._connectionAttempts++;

            } catch (error) {
                this._scheduleReconnect();
            }
        }

        _setupEventListeners() {
            const handlers = {
                connect: this._onConnect.bind(this),
                connect_error: this._onConnectError.bind(this),
                disconnect: this._onDisconnect.bind(this),
                error: this._onError.bind(this),
                'chat-message': this._onChatMessage.bind(this),
                'message-read': this._onMessageRead.bind(this),
                'message-delivered': this._onMessageDelivered.bind(this),
                'typing': this._onTyping.bind(this),
                'user-presence': this._onUserPresence.bind(this),
                'message-reaction': this._onMessageReaction.bind(this),
                'message-delete': this._onMessageDelete.bind(this),
                'message-edit': this._onMessageEdit.bind(this),
                'message-pin': this._onMessagePin.bind(this)
            };

            for (const [event, handler] of Object.entries(handlers)) {
                this.socket.on(event, handler);
                this._eventHandlers.set(event, handler);
            }
        }

        _onConnect() {
            this.isConnected = true;
            this._connectionAttempts = 0;
            
            const userId = Utils.getUserId();
            if (userId && this.socket) {
                this.socket.emit('join', userId);
                // Emit presence
                this.socket.emit('user-presence', { userId, status: 'online' });
            }

            // Process offline queue
            this._processOfflineQueue();
        }

        _onConnectError(error) {
            this.isConnected = false;
            this._scheduleReconnect();
        }

        _onDisconnect(reason) {
            this.isConnected = false;
            if (reason === 'io server disconnect') {
                this._scheduleReconnect();
            }
        }

        _onError(error) {
            // Silent fail
        }

        _onChatMessage(data) {
            if (this._messageHandler) {
                this._messageHandler(data);
            }
        }

        _onMessageRead(data) {
            if (this._readHandler) {
                this._readHandler(data);
            }
        }

        _onMessageDelivered(data) {
            if (this._deliveredHandler) {
                this._deliveredHandler(data);
            }
        }

        _onTyping(data) {
            if (this._typingHandler) {
                this._typingHandler(data);
            }
        }

        _onUserPresence(data) {
            if (this._presenceHandler) {
                this._presenceHandler(data);
            }
        }

        _onMessageReaction(data) {
            if (this._reactionHandler) {
                this._reactionHandler(data);
            }
        }

        _onMessageDelete(data) {
            if (this._deleteHandler) {
                this._deleteHandler(data);
            }
        }

        _onMessageEdit(data) {
            if (this._editHandler) {
                this._editHandler(data);
            }
        }

        _onMessagePin(data) {
            if (this._pinHandler) {
                this._pinHandler(data);
            }
        }

        _scheduleReconnect() {
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
            }
            this._reconnectTimer = setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, CONFIG.RETRY_DELAY * Math.min(this._connectionAttempts + 1, 5));
        }

        emit(event, data) {
            if (!this.socket || !this.isConnected) {
                // Queue for offline
                this._addToOfflineQueue(event, data);
                return false;
            }
            try {
                this.socket.emit(event, data);
                return true;
            } catch (error) {
                this._addToOfflineQueue(event, data);
                return false;
            }
        }

        _addToOfflineQueue(event, data) {
            State._offlineQueue.push({ event, data, timestamp: Date.now() });
            if (State._offlineQueue.length > 100) {
                State._offlineQueue.shift();
            }
        }

        _processOfflineQueue() {
            if (State._offlineQueue.length === 0 || !this.isConnected) return;

            const queue = [...State._offlineQueue];
            State._offlineQueue = [];

            for (const item of queue) {
                try {
                    this.socket.emit(item.event, item.data);
                } catch (error) {
                    // Re-queue if failed
                    State._offlineQueue.push(item);
                }
            }
        }

        disconnect() {
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
            }

            if (this.socket) {
                for (const [event, handler] of this._eventHandlers) {
                    this.socket.off(event, handler);
                }
                this._eventHandlers.clear();
                
                this.socket.disconnect();
                this.socket = null;
            }

            this.isConnected = false;
            this.isInitialized = false;
        }

        isReady() {
            return this.socket && this.isConnected;
        }
    }

    const Socket = new SocketManager();

    // ============================================================
    // 💬 TOAST NOTIFICATIONS
    // ============================================================
    const Toast = {
        _timeout: null,
        _toastElement: null,

        _getElement() {
            if (!this._toastElement) {
                this._toastElement = document.getElementById('uzcraftToast');
            }
            return this._toastElement;
        },

        show(message, type = 'info', duration = 3500) {
            const toast = this._getElement();
            if (!toast) return;

            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
            }

            toast.textContent = message;
            toast.className = `uzcraft-toast show ${type}`;

            this._timeout = setTimeout(() => {
                toast.classList.remove('show');
                this._timeout = null;
            }, duration);
        },

        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error'); },
        info(msg) { this.show(msg, 'info'); },
        warning(msg) { this.show(msg, 'warning'); }
    };

    // ============================================================
    // 🔔 NOTIFICATION MANAGER
    // ============================================================
    const NotificationManager = {
        _permission: 'default',
        _audio: null,
        _soundEnabled: CONFIG.SOUND_ENABLED,
        _notificationsEnabled: CONFIG.NOTIFICATIONS_ENABLED,

        init() {
            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    this._permission = permission;
                });
            } else if ('Notification' in window) {
                this._permission = Notification.permission;
            }

            // Load sound
            try {
                this._audio = new Audio('/sounds/chat-notification.mp3');
                this._audio.load();
            } catch (error) {
                // Sound not available
            }
        },

        async notify(title, body, icon = '/favicon.ico', data = null) {
            // Check if notifications are enabled
            if (!this._notificationsEnabled) return;

            // Check if page is visible
            if (!document.hidden && State.isOpen) {
                // If chat is open and visible, don't notify
                return;
            }

            // Play sound
            if (this._soundEnabled && this._audio) {
                try {
                    this._audio.currentTime = 0;
                    await this._audio.play();
                } catch (error) {
                    // Silent fail
                }
            }

            // Show browser notification
            if ('Notification' in window && this._permission === 'granted') {
                try {
                    const notification = new Notification(title, {
                        body: body,
                        icon: icon,
                        tag: 'chat-message',
                        requireInteraction: true,
                        data: data
                    });

                    notification.onclick = () => {
                        window.focus();
                        ChatWidget.open();
                        notification.close();
                    };

                    setTimeout(() => notification.close(), 10000);
                } catch (error) {
                    // Silent fail
                }
            }
        },

        setSoundEnabled(enabled) {
            this._soundEnabled = enabled;
        },

        setNotificationsEnabled(enabled) {
            this._notificationsEnabled = enabled;
        }
    };

    // ============================================================
    // 🎨 EMOJI PICKER
    // ============================================================
    const EmojiPicker = {
        _emojis: [
            '😊', '😂', '🤣', '😍', '🥰', '😘', '😗', '😙', '😚', '🥲',
            '😀', '😁', '😅', '😆', '🤩', '🥳', '😎', '🤓', '🧐', '🥸',
            '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
            '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
            '😳', '🥵', '🥶', '😶‍🌫️', '😱', '😨', '😰', '😥', '😓', '😪',
            '🤤', '😴', '🥱', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '😷',
            '🤒', '🤕', '🤧', '😇', '🥳', '🤗', '🤔', '🤭', '🤫', '🤨',
            '😐', '😑', '😶', '🙄', '😬', '🙃', '😉', '😌', '😋', '😜',
            '😝', '🤪', '🤑', '🤠', '👋', '🤚', '🖐', '✋', '🖖', '👌',
            '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '👈', '👉', '👆', '👇',
            '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
            '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲'
        ],

        _isOpen: false,
        _pickerElement: null,

        toggle(inputElement) {
            if (this._isOpen) {
                this.close();
                return;
            }
            this.open(inputElement);
        },

        open(inputElement) {
            if (this._isOpen) {
                this.close();
            }

            const picker = document.createElement('div');
            picker.className = 'uzcraft-emoji-picker';
            picker.style.cssText = `
                position: absolute;
                bottom: 70px;
                right: 0;
                width: 320px;
                max-height: 280px;
                overflow-y: auto;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                padding: 12px;
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                gap: 6px;
                z-index: 100000;
                border: 1px solid #e5e7eb;
            `;

            for (const emoji of this._emojis) {
                const btn = document.createElement('button');
                btn.textContent = emoji;
                btn.style.cssText = `
                    width: 100%;
                    aspect-ratio: 1;
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    cursor: pointer;
                    border-radius: 8px;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = '#f3f4f6';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'transparent';
                });
                btn.addEventListener('click', () => {
                    const cursorPos = inputElement.selectionStart;
                    const text = inputElement.value;
                    inputElement.value = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
                    inputElement.focus();
                    inputElement.selectionStart = cursorPos + emoji.length;
                    inputElement.selectionEnd = cursorPos + emoji.length;
                    inputElement.dispatchEvent(new Event('input'));
                    this.close();
                });
                picker.appendChild(btn);
            }

            // Position picker relative to input
            const rect = inputElement.getBoundingClientRect();
            const parentRect = inputElement.parentElement.getBoundingClientRect();
            picker.style.right = '0';
            picker.style.bottom = '70px';

            // Add close on click outside
            const closePicker = (e) => {
                if (!picker.contains(e.target) && e.target !== inputElement) {
                    this.close();
                }
            };

            this._pickerElement = picker;
            inputElement.parentElement.appendChild(picker);
            this._isOpen = true;

            setTimeout(() => {
                document.addEventListener('click', closePicker);
            }, 100);

            this._closeHandler = closePicker;
        },

        close() {
            if (this._pickerElement) {
                this._pickerElement.remove();
                this._pickerElement = null;
            }
            if (this._closeHandler) {
                document.removeEventListener('click', this._closeHandler);
                this._closeHandler = null;
            }
            this._isOpen = false;
        }
    };

    // ============================================================
    // 🎨 CHAT WIDGET - MAIN APPLICATION
    // ============================================================
    const ChatWidget = {
        // ============================================================
        // INITIALIZATION
        // ============================================================
        init() {
            if (State.isInitialized) {
                return;
            }

            const user = Utils.getCurrentUser();
            if (!user || !user._id) {
                return;
            }

            if (document.getElementById('uzcraftChatWidget')) {
                State.isInitialized = true;
                return;
            }

            State.userId = user._id;
            
            // Set socket handlers
            Socket.setHandlers({
                message: this._handleIncomingMessage.bind(this),
                typing: this._handleTyping.bind(this),
                presence: this._handlePresence.bind(this),
                reaction: this._handleReaction.bind(this),
                delete: this._handleDelete.bind(this),
                edit: this._handleEdit.bind(this),
                pin: this._handlePin.bind(this),
                delivered: this._handleDelivered.bind(this),
                read: this._handleRead.bind(this)
            });
            
            this._fetchAdminAndInitialize();
            NotificationManager.init();
        },

        async _fetchAdminAndInitialize() {
            if (State._fetchingAdmin) return;
            if (State.isAdminFetched && State.adminId) {
                this._completeInitialization();
                return;
            }

            State._fetchingAdmin = true;

            try {
                const admin = await API.fetchAdminUser();
                if (!admin?._id) {
                    throw new Error('Admin not found');
                }

                State.adminId = admin._id;
                State.adminName = admin.username || admin.name || 'Support';
                State.isAdminFetched = true;

                this._completeInitialization();

            } catch (error) {
                State._fetchingAdmin = false;
                
                setTimeout(() => {
                    if (!State.isAdminFetched) {
                        this._fetchAdminAndInitialize();
                    }
                }, 3000);
            }
        },

        _completeInitialization() {
            if (State.isInitialized) return;
            if (!State.adminId) {
                return;
            }

            this._createWidget();
            this._attachEventListeners();
            
            State.isInitialized = true;

            // Connect socket and load initial messages
            setTimeout(() => {
                Socket.connect();
                this._loadInitialMessages();
                this._updateUnreadCount();
                this._loadChatStats();
            }, 500);
        },

        // ============================================================
        // DOM CREATION
        // ============================================================
        _createWidget() {
            const html = this._getWidgetHTML();
            document.body.insertAdjacentHTML('beforeend', html);
        },

        _getWidgetHTML() {
            return `
                <style>
                    .uzcraft-chat-widget {
                        position: fixed;
                        bottom: 30px;
                        right: 30px;
                        z-index: 99999;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    }

                    .uzcraft-chat-btn {
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        border: none;
                        background: linear-gradient(135deg, #2d4a33, #3d6b47);
                        color: #fff;
                        font-size: 26px;
                        cursor: pointer;
                        box-shadow: 0 4px 20px rgba(45, 74, 51, 0.4);
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        will-change: transform;
                    }

                    .uzcraft-chat-btn:hover {
                        transform: scale(1.08);
                        box-shadow: 0 8px 30px rgba(45, 74, 51, 0.5);
                    }

                    .uzcraft-chat-btn:active {
                        transform: scale(0.95);
                    }

                    .uzcraft-chat-btn .unread-badge {
                        position: absolute;
                        top: -4px;
                        right: -4px;
                        background: #ef4444;
                        color: #fff;
                        font-size: 11px;
                        font-weight: 700;
                        min-width: 22px;
                        height: 22px;
                        border-radius: 50%;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        padding: 0 6px;
                        border: 2px solid #fff;
                        animation: uzcraftPulse 2s infinite;
                    }

                    .uzcraft-chat-btn .unread-badge.show {
                        display: flex;
                    }

                    .uzcraft-chat-btn .tooltip {
                        position: absolute;
                        bottom: 70px;
                        right: 0;
                        background: #1a1a2e;
                        color: #fff;
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-size: 12px;
                        font-weight: 500;
                        white-space: nowrap;
                        opacity: 0;
                        transform: translateY(10px);
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        pointer-events: none;
                    }

                    .uzcraft-chat-btn .tooltip::after {
                        content: '';
                        position: absolute;
                        bottom: -6px;
                        right: 20px;
                        width: 12px;
                        height: 12px;
                        background: #1a1a2e;
                        transform: rotate(45deg);
                    }

                    .uzcraft-chat-btn:hover .tooltip {
                        opacity: 1;
                        transform: translateY(0);
                    }

                    .uzcraft-chat-btn .connection-status {
                        position: absolute;
                        bottom: -2px;
                        right: -2px;
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        border: 2px solid #fff;
                        transition: all 0.3s;
                    }

                    .uzcraft-chat-btn .connection-status.online {
                        background: #16a34a;
                    }

                    .uzcraft-chat-btn .connection-status.offline {
                        background: #ef4444;
                    }

                    .uzcraft-chat-btn .connection-status.connecting {
                        background: #f59e0b;
                        animation: uzcraftPulse 1s infinite;
                    }

                    @keyframes uzcraftPulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                    }

                    .uzcraft-chat-modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.5);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                        z-index: 99999;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        animation: uzcraftFadeIn 0.3s ease;
                        pointer-events: none;
                    }

                    .uzcraft-chat-modal-overlay.active {
                        display: flex;
                    }

                    @keyframes uzcraftFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    .uzcraft-chat-modal {
                        background: #fff;
                        border-radius: 24px;
                        max-width: 480px;
                        width: 100%;
                        max-height: 90vh;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                        animation: uzcraftSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        overflow: hidden;
                        pointer-events: auto;
                    }

                    @keyframes uzcraftSlideUp {
                        from {
                            opacity: 0;
                            transform: translateY(30px) scale(0.96);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }

                    .uzcraft-chat-header {
                        padding: 16px 20px;
                        background: linear-gradient(135deg, #2d4a33, #3d6b47);
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        flex-shrink: 0;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                    }

                    .uzcraft-chat-header .header-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        min-width: 0;
                        flex: 1;
                    }

                    .uzcraft-chat-header .header-left .avatar {
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: rgba(255, 255, 255, 0.2);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 700;
                        font-size: 16px;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-header .header-left .info {
                        min-width: 0;
                        flex: 1;
                    }

                    .uzcraft-chat-header .header-left .info h4 {
                        font-size: 15px;
                        font-weight: 600;
                        margin: 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .uzcraft-chat-header .header-left .info .status {
                        font-size: 12px;
                        opacity: 0.8;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }

                    .uzcraft-chat-header .header-left .info .status .dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: #16a34a;
                        display: inline-block;
                        animation: uzcraftPulse 2s infinite;
                    }

                    .uzcraft-chat-header .header-left .info .status .dot.offline {
                        background: #6b7280;
                        animation: none;
                    }

                    .uzcraft-chat-header .header-left .info .status .dot.typing {
                        background: #f59e0b;
                        animation: uzcraftPulse 0.5s infinite;
                    }

                    .uzcraft-chat-header .pinned-message {
                        font-size: 11px;
                        opacity: 0.7;
                        padding: 4px 12px;
                        background: rgba(255,255,255,0.1);
                        border-radius: 20px;
                        max-width: 120px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .uzcraft-chat-header .pinned-message:hover {
                        background: rgba(255,255,255,0.2);
                    }

                    .uzcraft-chat-header .header-actions {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }

                    .uzcraft-chat-header .header-actions button {
                        width: 36px;
                        height: 36px;
                        border: none;
                        background: rgba(255, 255, 255, 0.15);
                        border-radius: 50%;
                        color: #fff;
                        cursor: pointer;
                        font-size: 16px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .uzcraft-chat-header .header-actions button:hover {
                        background: rgba(255, 255, 255, 0.25);
                    }

                    .uzcraft-chat-close-btn {
                        width: 36px;
                        height: 36px;
                        border: none;
                        background: rgba(255, 255, 255, 0.15);
                        border-radius: 50%;
                        color: #fff;
                        cursor: pointer;
                        font-size: 18px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .uzcraft-chat-close-btn:hover {
                        background: rgba(255, 255, 255, 0.25);
                    }

                    .uzcraft-chat-connection-banner {
                        padding: 6px 16px;
                        text-align: center;
                        font-size: 12px;
                        font-weight: 500;
                        background: #fef3c7;
                        color: #92400e;
                        display: none;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-connection-banner.show {
                        display: block;
                    }

                    .uzcraft-chat-connection-banner.connected {
                        background: #d1fae5;
                        color: #065f46;
                    }

                    .uzcraft-chat-connection-banner.disconnected {
                        background: #fde8e8;
                        color: #991b1b;
                    }

                    .uzcraft-chat-connection-banner.reconnecting {
                        background: #fef3c7;
                        color: #92400e;
                        animation: uzcraftPulse 1s infinite;
                    }

                    .uzcraft-chat-search {
                        padding: 8px 16px;
                        background: #f8f9fa;
                        border-bottom: 1px solid #e5e7eb;
                        display: none;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-search.show {
                        display: block;
                    }

                    .uzcraft-chat-search input {
                        width: 100%;
                        padding: 8px 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 20px;
                        outline: none;
                        font-size: 13px;
                        background: #fff;
                        transition: all 0.2s;
                    }

                    .uzcraft-chat-search input:focus {
                        border-color: #b08a5a;
                        box-shadow: 0 0 0 4px rgba(176, 138, 90, 0.1);
                    }

                    .uzcraft-chat-search .search-results {
                        margin-top: 8px;
                        max-height: 120px;
                        overflow-y: auto;
                        display: none;
                    }

                    .uzcraft-chat-search .search-results.show {
                        display: block;
                    }

                    .uzcraft-chat-search .search-result {
                        padding: 6px 12px;
                        cursor: pointer;
                        border-radius: 6px;
                        transition: all 0.15s;
                        font-size: 13px;
                        color: #1a1a2e;
                    }

                    .uzcraft-chat-search .search-result:hover {
                        background: #f3f4f6;
                    }

                    .uzcraft-chat-search .search-result .highlight {
                        background: #fef3c7;
                        padding: 0 2px;
                    }

                    .uzcraft-chat-messages {
                        flex: 1;
                        overflow-y: auto;
                        padding: 16px 20px;
                        min-height: 320px;
                        max-height: 420px;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                        background: #f8f9fa;
                        scroll-behavior: smooth;
                        position: relative;
                    }

                    .uzcraft-chat-messages::-webkit-scrollbar {
                        width: 4px;
                    }
                    .uzcraft-chat-messages::-webkit-scrollbar-thumb {
                        background: #d1d5db;
                        border-radius: 50%;
                    }

                    .uzcraft-chat-message {
                        padding: 10px 14px;
                        border-radius: 12px;
                        max-width: 85%;
                        word-wrap: break-word;
                        animation: uzcraftMessageIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                        transition: all 0.2s;
                    }

                    .uzcraft-chat-message:hover .message-actions {
                        opacity: 1;
                    }

                    @keyframes uzcraftMessageIn {
                        from {
                            opacity: 0;
                            transform: translateY(10px) scale(0.96);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }

                    .uzcraft-chat-message.sent {
                        align-self: flex-end;
                        background: #2d4a33;
                        color: #fff;
                        border-bottom-right-radius: 4px;
                    }

                    .uzcraft-chat-message.received {
                        align-self: flex-start;
                        background: #fff;
                        color: #1a1a2e;
                        border-bottom-left-radius: 4px;
                        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
                    }

                    .uzcraft-chat-message .msg-sender {
                        font-size: 11px;
                        font-weight: 600;
                        opacity: 0.7;
                        margin-bottom: 2px;
                    }

                    .uzcraft-chat-message.sent .msg-sender {
                        color: rgba(255, 255, 255, 0.7);
                    }

                    .uzcraft-chat-message .msg-text {
                        font-size: 14px;
                        line-height: 1.4;
                    }

                    .uzcraft-chat-message .msg-text .reply-preview {
                        padding: 4px 8px;
                        margin-bottom: 4px;
                        border-left: 2px solid rgba(176, 138, 90, 0.5);
                        background: rgba(0,0,0,0.05);
                        border-radius: 4px;
                        font-size: 12px;
                        opacity: 0.7;
                        cursor: pointer;
                    }

                    .uzcraft-chat-message.sent .msg-text .reply-preview {
                        background: rgba(255,255,255,0.1);
                        border-left-color: rgba(255,255,255,0.3);
                    }

                    .uzcraft-chat-message .msg-text .reply-preview .reply-sender {
                        font-weight: 600;
                    }

                    .uzcraft-chat-message .msg-time {
                        font-size: 10px;
                        opacity: 0.5;
                        margin-top: 4px;
                        display: block;
                        text-align: right;
                    }

                    .uzcraft-chat-message .msg-status {
                        font-size: 10px;
                        margin-left: 4px;
                    }

                    .uzcraft-chat-message .msg-status.delivered {
                        color: #16a34a;
                    }

                    .uzcraft-chat-message .msg-status.read {
                        color: #3b82f6;
                    }

                    .uzcraft-chat-message .message-actions {
                        position: absolute;
                        top: -20px;
                        right: 0;
                        display: flex;
                        gap: 2px;
                        opacity: 0;
                        transition: all 0.2s;
                        background: #fff;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        padding: 2px;
                    }

                    .uzcraft-chat-message.sent .message-actions {
                        right: auto;
                        left: 0;
                    }

                    .uzcraft-chat-message .message-actions button {
                        width: 28px;
                        height: 28px;
                        border: none;
                        background: transparent;
                        border-radius: 4px;
                        cursor: pointer;
                        color: #6b7280;
                        font-size: 12px;
                        transition: all 0.15s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .uzcraft-chat-message .message-actions button:hover {
                        background: #f3f4f6;
                        color: #1a1a2e;
                    }

                    .uzcraft-chat-message .message-actions button.reply:hover {
                        color: #3b82f6;
                    }

                    .uzcraft-chat-message .message-actions button.copy:hover {
                        color: #16a34a;
                    }

                    .uzcraft-chat-message .message-actions button.edit:hover {
                        color: #f59e0b;
                    }

                    .uzcraft-chat-message .message-actions button.delete:hover {
                        color: #ef4444;
                    }

                    .uzcraft-chat-message .message-actions button.pin:hover {
                        color: #8b5cf6;
                    }

                    .uzcraft-chat-message .message-actions button.react:hover {
                        color: #ec4899;
                    }

                    .uzcraft-chat-message .message-reactions {
                        display: flex;
                        gap: 2px;
                        margin-top: 4px;
                        flex-wrap: wrap;
                    }

                    .uzcraft-chat-message .message-reactions .reaction {
                        padding: 2px 6px;
                        border-radius: 12px;
                        background: rgba(0,0,0,0.05);
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.15s;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                    }

                    .uzcraft-chat-message.sent .message-reactions .reaction {
                        background: rgba(255,255,255,0.1);
                    }

                    .uzcraft-chat-message .message-reactions .reaction:hover {
                        background: rgba(0,0,0,0.1);
                    }

                    .uzcraft-chat-message .message-reactions .reaction .count {
                        font-size: 10px;
                        opacity: 0.7;
                    }

                    .uzcraft-chat-message .message-attachments {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                        margin-top: 4px;
                    }

                    .uzcraft-chat-message .message-attachments .attachment {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 4px 8px;
                        background: rgba(0,0,0,0.05);
                        border-radius: 6px;
                        font-size: 12px;
                        cursor: pointer;
                        transition: all 0.15s;
                    }

                    .uzcraft-chat-message.sent .message-attachments .attachment {
                        background: rgba(255,255,255,0.1);
                    }

                    .uzcraft-chat-message .message-attachments .attachment:hover {
                        background: rgba(0,0,0,0.1);
                    }

                    .uzcraft-chat-message .message-attachments .attachment img {
                        max-width: 200px;
                        max-height: 150px;
                        border-radius: 8px;
                        object-fit: cover;
                    }

                    .uzcraft-chat-message .message-attachments .attachment .file-icon {
                        font-size: 20px;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-message .message-attachments .attachment .file-info {
                        flex: 1;
                        min-width: 0;
                    }

                    .uzcraft-chat-message .message-attachments .attachment .file-info .file-name {
                        font-weight: 500;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .uzcraft-chat-message .message-attachments .attachment .file-info .file-size {
                        font-size: 10px;
                        opacity: 0.6;
                    }

                    .uzcraft-chat-message .message-attachments .attachment .download-btn {
                        padding: 4px 8px;
                        border: none;
                        background: rgba(176, 138, 90, 0.2);
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        color: #b08a5a;
                        transition: all 0.15s;
                    }

                    .uzcraft-chat-message .message-attachments .attachment .download-btn:hover {
                        background: rgba(176, 138, 90, 0.3);
                    }

                    .uzcraft-chat-message .message-edited {
                        font-size: 9px;
                        opacity: 0.5;
                        margin-top: 2px;
                        display: block;
                    }

                    .uzcraft-chat-message .message-deleted {
                        font-style: italic;
                        opacity: 0.5;
                        font-size: 13px;
                    }

                    .uzcraft-chat-date-separator {
                        text-align: center;
                        margin: 12px 0 8px;
                    }

                    .uzcraft-chat-date-separator span {
                        background: #e5e7eb;
                        color: #6b7280;
                        font-size: 11px;
                        font-weight: 600;
                        padding: 4px 14px;
                        border-radius: 50px;
                        display: inline-block;
                    }

                    .uzcraft-chat-loading-more {
                        text-align: center;
                        padding: 8px;
                        font-size: 12px;
                        color: #9ca3af;
                        display: none;
                    }

                    .uzcraft-chat-loading-more.show {
                        display: block;
                    }

                    .uzcraft-chat-typing-indicator {
                        align-self: flex-start;
                        padding: 8px 14px;
                        background: #fff;
                        border-radius: 12px;
                        font-size: 13px;
                        color: #6b7280;
                        display: none;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
                        animation: uzcraftMessageIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    }

                    .uzcraft-chat-typing-indicator.show {
                        display: block;
                    }

                    .uzcraft-chat-typing-indicator .typing-name {
                        font-weight: 600;
                        color: #2d4a33;
                    }

                    .uzcraft-chat-typing-indicator .typing-dots {
                        display: inline-flex;
                        gap: 4px;
                        margin-left: 4px;
                    }

                    .uzcraft-chat-typing-indicator .typing-dots span {
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: #9ca3af;
                        animation: uzcraftTypingDot 1.4s infinite;
                    }

                    .uzcraft-chat-typing-indicator .typing-dots span:nth-child(2) {
                        animation-delay: 0.2s;
                    }

                    .uzcraft-chat-typing-indicator .typing-dots span:nth-child(3) {
                        animation-delay: 0.4s;
                    }

                    @keyframes uzcraftTypingDot {
                        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                        30% { transform: translateY(-6px); opacity: 1; }
                    }

                    .uzcraft-chat-upload-progress {
                        padding: 8px 16px;
                        background: #f8f9fa;
                        border-top: 1px solid #e5e7eb;
                        display: none;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-upload-progress.show {
                        display: block;
                    }

                    .uzcraft-chat-upload-progress .progress-bar {
                        width: 100%;
                        height: 4px;
                        background: #e5e7eb;
                        border-radius: 2px;
                        overflow: hidden;
                    }

                    .uzcraft-chat-upload-progress .progress-bar .progress-fill {
                        height: 100%;
                        background: linear-gradient(90deg, #2d4a33, #3d6b47);
                        border-radius: 2px;
                        width: 0%;
                        transition: width 0.3s;
                    }

                    .uzcraft-chat-upload-progress .progress-text {
                        font-size: 11px;
                        color: #6b7280;
                        margin-top: 4px;
                        display: flex;
                        justify-content: space-between;
                    }

                    .uzcraft-chat-input-wrapper {
                        padding: 12px 16px 16px;
                        border-top: 1px solid #e5e7eb;
                        background: #fff;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-input-wrapper .input-row {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                    }

                    .uzcraft-chat-input-wrapper .input-row .input-actions {
                        display: flex;
                        gap: 4px;
                    }

                    .uzcraft-chat-input-wrapper .input-row .input-actions button {
                        width: 36px;
                        height: 36px;
                        border: none;
                        background: transparent;
                        border-radius: 50%;
                        cursor: pointer;
                        color: #6b7280;
                        font-size: 16px;
                        transition: all 0.15s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .uzcraft-chat-input-wrapper .input-row .input-actions button:hover {
                        background: #f3f4f6;
                        color: #1a1a2e;
                    }

                    .uzcraft-chat-input-wrapper .input-row input {
                        flex: 1;
                        padding: 10px 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 50px;
                        outline: none;
                        font-size: 14px;
                        transition: all 0.2s;
                        background: #f8f9fa;
                        color: #1a1a2e;
                    }

                    .uzcraft-chat-input-wrapper .input-row input:focus {
                        border-color: #b08a5a;
                        background: #fff;
                        box-shadow: 0 0 0 4px rgba(176, 138, 90, 0.1);
                    }

                    .uzcraft-chat-input-wrapper .input-row input::placeholder {
                        color: #9ca3af;
                    }

                    .uzcraft-chat-input-wrapper .input-row input:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .uzcraft-chat-input-wrapper .input-row .send-btn {
                        width: 48px;
                        height: 48px;
                        border: none;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #2d4a33, #3d6b47);
                        color: #fff;
                        cursor: pointer;
                        font-size: 18px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .uzcraft-chat-input-wrapper .input-row .send-btn:hover {
                        transform: scale(1.05);
                        box-shadow: 0 4px 12px rgba(45, 74, 51, 0.3);
                    }

                    .uzcraft-chat-input-wrapper .input-row .send-btn:active {
                        transform: scale(0.95);
                    }

                    .uzcraft-chat-input-wrapper .input-row .send-btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                        transform: none;
                    }

                    .uzcraft-chat-input-wrapper .reply-indicator {
                        display: none;
                        padding: 6px 12px;
                        background: #f3f4f6;
                        border-radius: 8px;
                        font-size: 12px;
                        color: #6b7280;
                        align-items: center;
                        gap: 8px;
                    }

                    .uzcraft-chat-input-wrapper .reply-indicator.show {
                        display: flex;
                    }

                    .uzcraft-chat-input-wrapper .reply-indicator .reply-text {
                        flex: 1;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .uzcraft-chat-input-wrapper .reply-indicator .reply-cancel {
                        cursor: pointer;
                        color: #ef4444;
                        font-size: 14px;
                    }

                    .uzcraft-chat-input-wrapper .edit-indicator {
                        display: none;
                        padding: 6px 12px;
                        background: #fef3c7;
                        border-radius: 8px;
                        font-size: 12px;
                        color: #92400e;
                        align-items: center;
                        gap: 8px;
                    }

                    .uzcraft-chat-input-wrapper .edit-indicator.show {
                        display: flex;
                    }

                    .uzcraft-chat-input-wrapper .edit-indicator .edit-cancel {
                        cursor: pointer;
                        color: #ef4444;
                        font-size: 14px;
                    }

                    .uzcraft-chat-drop-zone {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border: 3px dashed #b08a5a;
                        border-radius: 12px;
                        background: rgba(255, 255, 255, 0.9);
                        display: none;
                        align-items: center;
                        justify-content: center;
                        z-index: 10;
                        pointer-events: none;
                    }

                    .uzcraft-chat-drop-zone.active {
                        display: flex;
                    }

                    .uzcraft-chat-drop-zone .drop-content {
                        text-align: center;
                        color: #6b7280;
                    }

                    .uzcraft-chat-drop-zone .drop-content i {
                        font-size: 48px;
                        color: #b08a5a;
                        margin-bottom: 8px;
                        display: block;
                    }

                    .uzcraft-chat-drop-zone .drop-content p {
                        font-size: 14px;
                    }

                    .uzcraft-chat-empty {
                        text-align: center;
                        padding: 40px 20px;
                        color: #9ca3af;
                        margin: auto;
                    }

                    .uzcraft-chat-empty i {
                        font-size: 48px;
                        color: #e5e7eb;
                        margin-bottom: 12px;
                        display: block;
                    }

                    .uzcraft-chat-empty p {
                        font-size: 14px;
                    }

                    .uzcraft-chat-loading {
                        text-align: center;
                        padding: 40px 20px;
                        color: #9ca3af;
                        margin: auto;
                    }

                    .uzcraft-chat-loading i {
                        font-size: 32px;
                        color: #2d4a33;
                        margin-bottom: 12px;
                        display: block;
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }

                    .uzcraft-toast {
                        position: fixed;
                        bottom: 100px;
                        right: 30px;
                        background: #1a1a2e;
                        color: #fff;
                        padding: 12px 20px;
                        border-radius: 8px;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                        z-index: 99999;
                        display: none;
                        animation: uzcraftSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        max-width: 380px;
                        font-size: 13px;
                        font-weight: 500;
                        font-family: 'Inter', sans-serif;
                    }

                    .uzcraft-toast.show {
                        display: block;
                    }
                    .uzcraft-toast.success {
                        border-left: 4px solid #16a34a;
                    }
                    .uzcraft-toast.error {
                        border-left: 4px solid #ef4444;
                    }
                    .uzcraft-toast.info {
                        border-left: 4px solid #b08a5a;
                    }
                    .uzcraft-toast.warning {
                        border-left: 4px solid #f59e0b;
                    }

                    /* File input hidden */
                    #uzcraftFileInput {
                        display: none;
                    }

                    @media (max-width: 640px) {
                        .uzcraft-chat-modal {
                            max-width: 100%;
                            max-height: 95vh;
                            border-radius: 16px;
                            margin: 10px;
                        }
                        .uzcraft-chat-messages {
                            min-height: 280px;
                            max-height: 380px;
                            padding: 12px 16px;
                        }
                        .uzcraft-chat-btn {
                            width: 56px;
                            height: 56px;
                            font-size: 24px;
                            bottom: 20px;
                            right: 20px;
                        }
                        .uzcraft-toast {
                            bottom: 90px;
                            right: 16px;
                            left: 16px;
                            max-width: none;
                            font-size: 12px;
                            padding: 10px 16px;
                        }
                        .uzcraft-chat-header .header-actions button {
                            width: 32px;
                            height: 32px;
                            font-size: 14px;
                        }
                        .uzcraft-chat-input-wrapper .input-row .input-actions button {
                            width: 32px;
                            height: 32px;
                            font-size: 14px;
                        }
                    }

                    @media (max-width: 400px) {
                        .uzcraft-chat-messages {
                            min-height: 220px;
                            max-height: 300px;
                        }
                        .uzcraft-chat-message {
                            max-width: 92%;
                            font-size: 13px;
                            padding: 8px 12px;
                        }
                        .uzcraft-chat-header {
                            padding: 12px 16px;
                        }
                        .uzcraft-chat-header .header-left .avatar {
                            width: 32px;
                            height: 32px;
                            font-size: 13px;
                        }
                        .uzcraft-chat-header .header-left .info h4 {
                            font-size: 13px;
                        }
                        .uzcraft-chat-header .header-left .info .status {
                            font-size: 10px;
                        }
                        .uzcraft-chat-input-wrapper {
                            padding: 8px 12px 12px;
                        }
                        .uzcraft-chat-input-wrapper .input-row input {
                            font-size: 13px;
                            padding: 8px 14px;
                        }
                        .uzcraft-chat-input-wrapper .input-row .send-btn {
                            width: 42px;
                            height: 42px;
                            font-size: 16px;
                        }
                        .uzcraft-chat-btn {
                            width: 48px;
                            height: 48px;
                            font-size: 20px;
                            bottom: 16px;
                            right: 16px;
                        }
                        .uzcraft-chat-btn .unread-badge {
                            font-size: 10px;
                            min-width: 18px;
                            height: 18px;
                            top: -2px;
                            right: -2px;
                        }
                    }
                </style>

                <div class="uzcraft-chat-widget" id="uzcraftChatWidget">
                    <div class="uzcraft-toast" id="uzcraftToast"></div>

                    <button class="uzcraft-chat-btn" id="uzcraftChatBtn" aria-label="Open chat">
                        <i class="fa-regular fa-comment-dots"></i>
                        <span class="unread-badge" id="uzcraftUnreadBadge">0</span>
                        <span class="connection-status online" id="uzcraftConnectionStatus"></span>
                        <span class="tooltip">💬 Support Chat</span>
                    </button>

                    <div class="uzcraft-chat-modal-overlay" id="uzcraftChatModal">
                        <div class="uzcraft-chat-modal">
                            <div class="uzcraft-chat-header">
                                <div class="header-left">
                                    <div class="avatar">U</div>
                                    <div class="info">
                                        <h4>UZCRAFT Support</h4>
                                        <div class="status" id="uzcraftChatStatus">
                                            <span class="dot"></span>
                                            Online
                                        </div>
                                    </div>
                                </div>
                                <div class="header-actions">
                                    <button id="uzcraftSearchBtn" aria-label="Search messages">
                                        <i class="fa-solid fa-search"></i>
                                    </button>
                                    <button class="uzcraft-chat-close-btn" id="uzcraftChatCloseBtn" aria-label="Close chat">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="uzcraft-chat-connection-banner" id="uzcraftConnectionBanner">
                                <span id="uzcraftConnectionText">Connected</span>
                            </div>

                            <div class="uzcraft-chat-search" id="uzcraftChatSearch">
                                <input type="text" id="uzcraftSearchInput" placeholder="Search messages..." />
                                <div class="search-results" id="uzcraftSearchResults"></div>
                            </div>

                            <div class="uzcraft-chat-messages" id="uzcraftChatMessages">
                                <div class="uzcraft-chat-loading-more" id="uzcraftLoadingMore">Loading older messages...</div>
                                <div class="uzcraft-chat-empty">
                                    <i class="fa-regular fa-comment-dots"></i>
                                    <p>No messages yet. Start chatting!</p>
                                </div>
                            </div>

                            <div class="uzcraft-chat-typing-indicator" id="uzcraftTypingIndicator">
                                <span class="typing-name" id="uzcraftTypingName">Someone</span>
                                is typing
                                <span class="typing-dots">
                                    <span></span><span></span><span></span>
                                </span>
                            </div>

                            <div class="uzcraft-chat-upload-progress" id="uzcraftUploadProgress">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="uzcraftUploadFill"></div>
                                </div>
                                <div class="progress-text">
                                    <span id="uzcraftUploadFileName">Uploading...</span>
                                    <span id="uzcraftUploadPercent">0%</span>
                                </div>
                            </div>

                            <div class="uzcraft-chat-input-wrapper">
                                <div class="reply-indicator" id="uzcraftReplyIndicator">
                                    <i class="fa-solid fa-reply"></i>
                                    <span class="reply-text" id="uzcraftReplyText">Replying to: ...</span>
                                    <span class="reply-cancel" id="uzcraftReplyCancel">✕</span>
                                </div>
                                <div class="edit-indicator" id="uzcraftEditIndicator">
                                    <i class="fa-solid fa-pen"></i>
                                    <span>Editing message</span>
                                    <span class="edit-cancel" id="uzcraftEditCancel">✕</span>
                                </div>
                                <div class="input-row">
                                    <div class="input-actions">
                                        <button id="uzcraftEmojiBtn" aria-label="Emoji picker">
                                            <i class="fa-regular fa-face-smile"></i>
                                        </button>
                                        <button id="uzcraftFileBtn" aria-label="Attach file">
                                            <i class="fa-regular fa-paperclip"></i>
                                        </button>
                                    </div>
                                    <input type="text" id="uzcraftChatInput" placeholder="Type a message..." maxlength="${CONFIG.MAX_MESSAGE_LENGTH}" />
                                    <button class="send-btn" id="uzcraftChatSendBtn" aria-label="Send message">
                                        <i class="fa-solid fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>

                            <input type="file" id="uzcraftFileInput" multiple accept="image/*,.pdf,.doc,.docx,.zip,.rar,.xls,.xlsx,.ppt,.pptx,.mp3,.mp4,.wav,.ogg" />

                            <div class="uzcraft-chat-drop-zone" id="uzcraftDropZone">
                                <div class="drop-content">
                                    <i class="fa-solid fa-cloud-upload-alt"></i>
                                    <p>Drop files here to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        // ============================================================
        // EVENT LISTENERS
        // ============================================================
        _attachEventListeners() {
            const elements = {
                toggle: document.getElementById('uzcraftChatBtn'),
                close: document.getElementById('uzcraftChatCloseBtn'),
                send: document.getElementById('uzcraftChatSendBtn'),
                input: document.getElementById('uzcraftChatInput'),
                emoji: document.getElementById('uzcraftEmojiBtn'),
                file: document.getElementById('uzcraftFileBtn'),
                fileInput: document.getElementById('uzcraftFileInput'),
                search: document.getElementById('uzcraftSearchBtn'),
                searchInput: document.getElementById('uzcraftSearchInput'),
                replyCancel: document.getElementById('uzcraftReplyCancel'),
                editCancel: document.getElementById('uzcraftEditCancel'),
                messages: document.getElementById('uzcraftChatMessages')
            };

            if (elements.toggle) {
                elements.toggle.addEventListener('click', () => this.toggle());
            }

            if (elements.close) {
                elements.close.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                });
            }

            if (elements.send) {
                elements.send.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.sendMessage();
                });
            }

            if (elements.input) {
                elements.input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.sendMessage();
                    }
                });

                elements.input.addEventListener('input', Utils.debounce(() => {
                    this._sendTypingIndicator();
                }, 500));

                elements.input.addEventListener('focus', () => {
                    if (State._isAtBottom) {
                        this.scrollToBottom();
                    }
                });
            }

            if (elements.emoji) {
                elements.emoji.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EmojiPicker.toggle(elements.input);
                });
            }

            if (elements.file) {
                elements.file.addEventListener('click', () => {
                    elements.fileInput.click();
                });
            }

            if (elements.fileInput) {
                elements.fileInput.addEventListener('change', (e) => {
                    const files = e.target.files;
                    if (files.length > 0) {
                        this._handleFileUpload(files);
                    }
                    e.target.value = '';
                });
            }

            if (elements.search) {
                elements.search.addEventListener('click', () => {
                    const searchEl = document.getElementById('uzcraftChatSearch');
                    searchEl.classList.toggle('show');
                    if (searchEl.classList.contains('show')) {
                        elements.searchInput.focus();
                    } else {
                        elements.searchInput.value = '';
                        this._clearSearch();
                    }
                });
            }

            if (elements.searchInput) {
                elements.searchInput.addEventListener('input', Utils.debounce(() => {
                    this._performSearch(elements.searchInput.value);
                }, 300));
            }

            if (elements.replyCancel) {
                elements.replyCancel.addEventListener('click', () => {
                    this._clearReply();
                });
            }

            if (elements.editCancel) {
                elements.editCancel.addEventListener('click', () => {
                    this._clearEdit();
                });
            }

            if (elements.messages) {
                elements.messages.addEventListener('scroll', Utils.throttle(() => {
                    this._handleScroll();
                }, 100));
            }

            // Drop zone
            const dropZone = document.getElementById('uzcraftDropZone');
            if (dropZone) {
                document.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    const modal = document.getElementById('uzcraftChatModal');
                    if (modal && modal.classList.contains('active')) {
                        dropZone.classList.add('active');
                    }
                });

                document.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('active');
                });

                document.addEventListener('dragover', (e) => {
                    e.preventDefault();
                });

                document.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('active');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        const modal = document.getElementById('uzcraftChatModal');
                        if (modal && modal.classList.contains('active')) {
                            this._handleFileUpload(files);
                        }
                    }
                });
            }

            // Close on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && State.isOpen) {
                    const input = document.getElementById('uzcraftChatInput');
                    const searchInput = document.getElementById('uzcraftSearchInput');
                    if (document.activeElement === input || document.activeElement === searchInput) {
                        document.activeElement.blur();
                    } else {
                        this.close();
                    }
                }
            });

            // Handle online/offline events
            window.addEventListener('online', () => {
                this._updateConnectionStatus('online');
                if (!Socket.isReady()) {
                    Socket.connect();
                }
            });

            window.addEventListener('offline', () => {
                this._updateConnectionStatus('offline');
            });

            // Handle visibility change for notifications
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && State.isOpen) {
                    this._updateUnreadCount();
                }
            });
        },

        // ============================================================
        // SOCKET MESSAGE HANDLERS
        // ============================================================
        _handleIncomingMessage(data) {
            const userId = Utils.getUserId();
            const adminId = State.adminId;

            if (!userId || !adminId) return;

            // Only process messages for this user (from admin to client)
            if (String(data.receiverId) === String(userId) &&
                String(data.senderId) === String(adminId)) {
                
                const message = Utils.normalizeMessage(data);
                if (!message) return;

                // Prevent duplicates
                if (Utils.isMessageInCache(message)) {
                    return;
                }

                Utils.addToCache(message);
                State.messages.push(message);
                
                // Sort messages by timestamp
                State.messages.sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );

                // Update unread count if chat is closed
                if (!State.isOpen) {
                    State.unreadCount++;
                    this._updateBadge(State.unreadCount);
                    this._updateTitle(State.unreadCount);
                }

                this.renderMessages();
                this.markMessagesAsRead();
                this._updateUnreadCount();

                // Show notification
                NotificationManager.notify(
                    'New message from Support',
                    message.message,
                    '/favicon.ico',
                    { messageId: message.id }
                );
            }
        },

        _handleTyping(data) {
            const userId = Utils.getUserId();
            if (String(data.senderId) === String(State.adminId) && 
                String(data.receiverId) === String(userId)) {
                this._showTypingIndicator(data.senderName || 'Support');
            }
        },

        _handlePresence(data) {
            const userId = Utils.getUserId();
            if (String(data.userId) === String(State.adminId)) {
                this._updateAdminPresence(data.status);
            }
        },

        _handleReaction(data) {
            const message = State.messages.find(m => String(m.id) === String(data.messageId));
            if (message) {
                if (data.action === 'add') {
                    if (!message.reactions[data.reaction]) {
                        message.reactions[data.reaction] = 0;
                    }
                    message.reactions[data.reaction]++;
                } else if (data.action === 'remove') {
                    if (message.reactions[data.reaction]) {
                        message.reactions[data.reaction]--;
                        if (message.reactions[data.reaction] <= 0) {
                            delete message.reactions[data.reaction];
                        }
                    }
                }
                this.renderMessages();
            }
        },

        _handleDelete(data) {
            const message = State.messages.find(m => String(m.id) === String(data.messageId));
            if (message) {
                if (data.forEveryone) {
                    message.isDeleted = true;
                    message.message = 'This message was deleted';
                } else {
                    State.messages = State.messages.filter(m => String(m.id) !== String(data.messageId));
                }
                this.renderMessages();
            }
        },

        _handleEdit(data) {
            const message = State.messages.find(m => String(m.id) === String(data.messageId));
            if (message) {
                message.message = data.newMessage;
                message.isEdited = true;
                message.editedAt = data.editedAt;
                this.renderMessages();
            }
        },

        _handlePin(data) {
            const message = State.messages.find(m => String(m.id) === String(data.messageId));
            if (message) {
                message.pinned = data.pinned;
                if (data.pinned) {
                    if (!State._pinnedMessages.includes(data.messageId)) {
                        State._pinnedMessages.push(data.messageId);
                    }
                } else {
                    State._pinnedMessages = State._pinnedMessages.filter(
                        id => String(id) !== String(data.messageId)
                    );
                }
                this._updatePinnedMessage();
                this.renderMessages();
            }
        },

        _handleDelivered(data) {
            const message = State.messages.find(m => String(m.id) === String(data.messageId));
            if (message) {
                message.delivered = true;
                this.renderMessages();
            }
        },

        _handleRead(data) {
            const message = State.messages.find(m => String(m.id) === String(data.messageId));
            if (message) {
                message.read = true;
                this.renderMessages();
            }
        },

        // ============================================================
        // TYPING INDICATOR
        // ============================================================
        _sendTypingIndicator() {
            const userId = Utils.getUserId();
            if (!userId || !State.adminId) return;

            Socket.emit('typing', {
                senderId: userId,
                receiverId: State.adminId,
                senderName: Utils.getUserName(),
                isTyping: true
            });

            clearTimeout(State._typingTimeout);
            State._typingTimeout = setTimeout(() => {
                Socket.emit('typing', {
                    senderId: userId,
                    receiverId: State.adminId,
                    senderName: Utils.getUserName(),
                    isTyping: false
                });
            }, CONFIG.TYPING_TIMEOUT);
        },

        _showTypingIndicator(name) {
            const indicator = document.getElementById('uzcraftTypingIndicator');
            const nameEl = document.getElementById('uzcraftTypingName');
            if (indicator && nameEl) {
                nameEl.textContent = name;
                indicator.classList.add('show');
                
                clearTimeout(this._typingHideTimeout);
                this._typingHideTimeout = setTimeout(() => {
                    indicator.classList.remove('show');
                }, CONFIG.TYPING_TIMEOUT + 1000);
            }
        },

        // ============================================================
        // PRESENCE MANAGEMENT
        // ============================================================
        _updateAdminPresence(status) {
            const statusEl = document.getElementById('uzcraftChatStatus');
            const dot = statusEl?.querySelector('.dot');
            const text = statusEl?.querySelector('span:last-child');

            if (dot) {
                dot.className = 'dot';
                if (status === 'online') {
                    dot.classList.add('online');
                } else if (status === 'typing') {
                    dot.classList.add('typing');
                } else {
                    dot.classList.add('offline');
                }
            }

            if (text) {
                if (status === 'online') text.textContent = 'Online';
                else if (status === 'typing') text.textContent = 'Typing...';
                else text.textContent = 'Offline';
            }
        },

        // ============================================================
        // CONNECTION STATUS
        // ============================================================
        _updateConnectionStatus(status) {
            const banner = document.getElementById('uzcraftConnectionBanner');
            const text = document.getElementById('uzcraftConnectionText');
            const statusDot = document.getElementById('uzcraftConnectionStatus');

            if (!banner || !text) return;

            banner.className = 'uzcraft-chat-connection-banner';

            if (status === 'online') {
                banner.classList.add('connected');
                text.textContent = 'Connected';
                banner.classList.remove('show');
                if (statusDot) {
                    statusDot.className = 'connection-status online';
                }
            } else if (status === 'reconnecting') {
                banner.classList.add('reconnecting');
                text.textContent = 'Reconnecting...';
                banner.classList.add('show');
                if (statusDot) {
                    statusDot.className = 'connection-status connecting';
                }
            } else {
                banner.classList.add('disconnected');
                text.textContent = 'Disconnected - Attempting to reconnect...';
                banner.classList.add('show');
                if (statusDot) {
                    statusDot.className = 'connection-status offline';
                }
            }
        },

        // ============================================================
        // PINNED MESSAGE
        // ============================================================
        _updatePinnedMessage() {
            const header = document.querySelector('.uzcraft-chat-header');
            const existingPin = header?.querySelector('.pinned-message');
            
            if (existingPin) {
                existingPin.remove();
            }

            if (State._pinnedMessages.length > 0) {
                const pinnedId = State._pinnedMessages[State._pinnedMessages.length - 1];
                const message = State.messages.find(m => String(m.id) === String(pinnedId));
                if (message && !message.isDeleted) {
                    const pinEl = document.createElement('span');
                    pinEl.className = 'pinned-message';
                    pinEl.title = 'Pinned message: ' + message.message;
                    pinEl.textContent = '📌 ' + message.message.slice(0, 30) + (message.message.length > 30 ? '...' : '');
                    pinEl.addEventListener('click', () => {
                        const msgEl = document.querySelector(`[data-message-id="${message.id}"]`);
                        if (msgEl) {
                            msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            msgEl.style.background = '#fef3c7';
                            setTimeout(() => {
                                msgEl.style.background = '';
                            }, 2000);
                        }
                    });
                    const headerLeft = header?.querySelector('.header-left');
                    if (headerLeft) {
                        headerLeft.appendChild(pinEl);
                    }
                }
            }
        },

        // ============================================================
        // SEARCH
        // ============================================================
        async _performSearch(query) {
            const resultsContainer = document.getElementById('uzcraftSearchResults');
            if (!resultsContainer) return;

            if (!query.trim()) {
                resultsContainer.classList.remove('show');
                return;
            }

            const userId = Utils.getUserId();
            if (!userId) return;

            try {
                const results = await API.searchMessages(userId, query);
                if (results.length === 0) {
                    resultsContainer.innerHTML = `<div style="padding:8px 12px;color:#9ca3af;font-size:13px;">No results found</div>`;
                } else {
                    let html = '';
                    for (const msg of results) {
                        const highlighted = msg.message.replace(
                            new RegExp(query, 'gi'),
                            match => `<span class="highlight">${match}</span>`
                        );
                        html += `
                            <div class="search-result" data-message-id="${msg.id}">
                                <span class="search-result-sender" style="font-weight:600;font-size:11px;color:#6b7280;">
                                    ${msg.senderName}:
                                </span>
                                ${highlighted}
                                <span style="font-size:10px;color:#9ca3af;display:block;margin-top:2px;">
                                    ${Utils.formatTime(msg.timestamp)}
                                </span>
                            </div>
                        `;
                    }
                    resultsContainer.innerHTML = html;
                    
                    // Add click handlers
                    resultsContainer.querySelectorAll('.search-result').forEach(el => {
                        el.addEventListener('click', () => {
                            const messageId = el.dataset.messageId;
                            const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
                            if (msgEl) {
                                msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                msgEl.style.background = '#fef3c7';
                                setTimeout(() => {
                                    msgEl.style.background = '';
                                }, 3000);
                            }
                            // Close search
                            document.getElementById('uzcraftChatSearch').classList.remove('show');
                        });
                    });
                }
                resultsContainer.classList.add('show');
            } catch (error) {
                resultsContainer.innerHTML = `<div style="padding:8px 12px;color:#ef4444;font-size:13px;">Search failed</div>`;
                resultsContainer.classList.add('show');
            }
        },

        _clearSearch() {
            const resultsContainer = document.getElementById('uzcraftSearchResults');
            if (resultsContainer) {
                resultsContainer.classList.remove('show');
                resultsContainer.innerHTML = '';
            }
        },

        // ============================================================
        // UI CONTROLS
        // ============================================================
        toggle() {
            State.isOpen ? this.close() : this.open();
        },

        open() {
            const modal = document.getElementById('uzcraftChatModal');
            if (!modal) return;

            State.isOpen = true;
            modal.classList.add('active');

            // Reset unread count
            State.unreadCount = 0;
            this._updateBadge(0);
            this._updateTitle(0);

            this.markMessagesAsRead();

            setTimeout(() => {
                const input = document.getElementById('uzcraftChatInput');
                if (input) {
                    input.value = '';
                    input.disabled = false;
                    input.focus();
                }
                this.scrollToBottom();
            }, 400);
        },

        close() {
            const modal = document.getElementById('uzcraftChatModal');
            if (modal) {
                modal.classList.remove('active');
            }
            State.isOpen = false;
            
            // Clear typing indicator
            const indicator = document.getElementById('uzcraftTypingIndicator');
            if (indicator) {
                indicator.classList.remove('show');
            }
        },

        // ============================================================
        // MESSAGE OPERATIONS
        // ============================================================
        async sendMessage() {
            if (State.isSending) return;

            const input = document.getElementById('uzcraftChatInput');
            if (!input) return;

            const message = input.value.trim();
            if (!message) return;

            const userId = Utils.getUserId();
            const adminId = State.adminId;

            if (!userId || !adminId) {
                Toast.error('Please login to chat');
                return;
            }

            if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
                Toast.error(`Message too long (max ${CONFIG.MAX_MESSAGE_LENGTH} chars)`);
                return;
            }

            // Prevent duplicate sends
            const duplicateKey = `${message}_${Date.now()}`;
            if (State.messageCache.has(duplicateKey)) {
                Toast.warning('Duplicate message detected');
                return;
            }
            State.messageCache.set(duplicateKey, true);
            setTimeout(() => State.messageCache.delete(duplicateKey), 5000);

            State.isSending = true;

            // Create optimistic message
            const tempId = Utils.generateTempId();
            const replyTo = State._replyTo;
            const attachments = State._uploadQueue;

            const tempMessage = {
                id: tempId,
                senderId: userId,
                receiverId: adminId,
                senderName: Utils.getUserName(),
                message: message,
                timestamp: new Date().toISOString(),
                read: false,
                delivered: false,
                isTemp: true,
                replyTo: replyTo,
                attachments: attachments,
                reactions: {}
            };

            State.messages.push(tempMessage);
            this.renderMessages();

            // Clear input and state
            input.value = '';
            input.disabled = true;
            const sendBtn = document.getElementById('uzcraftChatSendBtn');
            if (sendBtn) sendBtn.disabled = true;

            this._clearReply();
            this._clearEdit();
            State._uploadQueue = [];

            try {
                // Send via API
                const result = await API.sendMessage(
                    userId, 
                    adminId, 
                    message, 
                    Utils.getUserName(),
                    replyTo ? replyTo.id : null,
                    attachments
                );

                // Remove temp message
                State.messages = State.messages.filter(m => m.id !== tempId);
                
                // Add the actual message
                const actualMessage = Utils.normalizeMessage(result.message || result);
                if (actualMessage) {
                    Utils.addToCache(actualMessage);
                    State.messages.push(actualMessage);
                    State.messages.sort((a, b) => 
                        new Date(a.timestamp) - new Date(b.timestamp)
                    );
                }

                // Emit via socket for real-time
                Socket.emit('chat-message', {
                    senderId: userId,
                    receiverId: adminId,
                    senderName: Utils.getUserName(),
                    message: message,
                    timestamp: new Date().toISOString(),
                    replyTo: replyTo ? replyTo.id : null,
                    attachments: attachments
                });

                Toast.success('Message sent!');
                this.renderMessages();
                this.scrollToBottom();

            } catch (error) {
                // Mark temp message as failed
                State.messages = State.messages.map(m => 
                    m.id === tempId ? { ...m, _failed: true } : m
                );
                this.renderMessages();
                Toast.error('Failed to send message');
            } finally {
                State.isSending = false;
                input.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                input.focus();
            }
        },

        async editMessage(messageId, newMessage) {
            if (!messageId || !newMessage) return;

            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message) return;

            const userId = Utils.getUserId();
            if (String(message.senderId) !== String(userId)) {
                Toast.error('You can only edit your own messages');
                return;
            }

            // Check edit timeout (15 minutes)
            const msgTime = new Date(message.timestamp).getTime();
            const now = Date.now();
            if (now - msgTime > CONFIG.EDIT_TIMEOUT) {
                Toast.error('Message can only be edited within 15 minutes');
                return;
            }

            try {
                const result = await API.editMessage(messageId, newMessage);
                if (result.success) {
                    message.message = newMessage;
                    message.isEdited = true;
                    message.editedAt = new Date().toISOString();
                    this.renderMessages();
                    Toast.success('Message edited');
                }
            } catch (error) {
                Toast.error('Failed to edit message');
            }
        },

        async deleteMessage(messageId, forEveryone = false) {
            if (!messageId) return;

            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message) return;

            const userId = Utils.getUserId();
            if (String(message.senderId) !== String(userId) && !forEveryone) {
                Toast.error('You can only delete your own messages');
                return;
            }

            if (!confirm(forEveryone ? 'Delete this message for everyone?' : 'Delete this message for you?')) {
                return;
            }

            try {
                const result = await API.deleteMessage(messageId, forEveryone);
                if (result.success) {
                    if (forEveryone) {
                        message.isDeleted = true;
                        message.message = 'This message was deleted';
                    } else {
                        State.messages = State.messages.filter(m => String(m.id) !== String(messageId));
                    }
                    this.renderMessages();
                    Toast.success('Message deleted');
                    
                    // Emit socket event
                    Socket.emit('message-delete', {
                        messageId: messageId,
                        forEveryone: forEveryone,
                        senderId: userId
                    });
                }
            } catch (error) {
                Toast.error('Failed to delete message');
            }
        },

        async togglePinMessage(messageId) {
            if (!messageId) return;

            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message) return;

            const userId = Utils.getUserId();
            if (String(message.senderId) !== String(userId) && !this._isAdmin()) {
                Toast.error('You can only pin your own messages');
                return;
            }

            try {
                const result = await API.togglePinMessage(messageId);
                if (result.success) {
                    message.pinned = result.pinned;
                    if (result.pinned) {
                        if (!State._pinnedMessages.includes(messageId)) {
                            State._pinnedMessages.push(messageId);
                        }
                    } else {
                        State._pinnedMessages = State._pinnedMessages.filter(
                            id => String(id) !== String(messageId)
                        );
                    }
                    this._updatePinnedMessage();
                    this.renderMessages();
                    Toast.success(result.pinned ? 'Message pinned' : 'Message unpinned');
                    
                    // Emit socket event
                    Socket.emit('message-pin', {
                        messageId: messageId,
                        pinned: result.pinned
                    });
                }
            } catch (error) {
                Toast.error('Failed to pin message');
            }
        },

        async addReaction(messageId, reaction) {
            if (!messageId || !reaction) return;

            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message || message.isDeleted) return;

            try {
                const result = await API.addReaction(messageId, reaction);
                if (result.success) {
                    if (!message.reactions[reaction]) {
                        message.reactions[reaction] = 0;
                    }
                    message.reactions[reaction]++;
                    this.renderMessages();
                    
                    // Emit socket event
                    Socket.emit('message-reaction', {
                        messageId: messageId,
                        reaction: reaction,
                        action: 'add'
                    });
                }
            } catch (error) {
                Toast.error('Failed to add reaction');
            }
        },

        async removeReaction(messageId, reaction) {
            if (!messageId || !reaction) return;

            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message) return;

            try {
                const result = await API.removeReaction(messageId, reaction);
                if (result.success) {
                    if (message.reactions[reaction]) {
                        message.reactions[reaction]--;
                        if (message.reactions[reaction] <= 0) {
                            delete message.reactions[reaction];
                        }
                    }
                    this.renderMessages();
                    
                    // Emit socket event
                    Socket.emit('message-reaction', {
                        messageId: messageId,
                        reaction: reaction,
                        action: 'remove'
                    });
                }
            } catch (error) {
                Toast.error('Failed to remove reaction');
            }
        },

        async forwardMessage(messageId, targetUserId) {
            if (!messageId || !targetUserId) return;

            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message || message.isDeleted) return;

            try {
                const result = await API.forwardMessage(messageId, targetUserId);
                if (result.success) {
                    Toast.success('Message forwarded');
                }
            } catch (error) {
                Toast.error('Failed to forward message');
            }
        },

        async copyMessage(messageId) {
            const message = State.messages.find(m => String(m.id) === String(messageId));
            if (!message || message.isDeleted) return;

            try {
                await navigator.clipboard.writeText(message.message);
                Toast.success('Message copied to clipboard');
            } catch (error) {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = message.message;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                Toast.success('Message copied to clipboard');
            }
        },

        // ============================================================
        // REPLY & EDIT INDICATORS
        // ============================================================
        _setReply(message) {
            State._replyTo = message;
            const indicator = document.getElementById('uzcraftReplyIndicator');
            const text = document.getElementById('uzcraftReplyText');
            if (indicator && text) {
                text.textContent = `Replying to: ${message.message.slice(0, 50)}${message.message.length > 50 ? '...' : ''}`;
                indicator.classList.add('show');
            }
            document.getElementById('uzcraftChatInput')?.focus();
        },

        _clearReply() {
            State._replyTo = null;
            const indicator = document.getElementById('uzcraftReplyIndicator');
            if (indicator) {
                indicator.classList.remove('show');
            }
        },

        _setEdit(message) {
            State._editingMessage = message;
            const indicator = document.getElementById('uzcraftEditIndicator');
            const input = document.getElementById('uzcraftChatInput');
            if (indicator && input) {
                indicator.classList.add('show');
                input.value = message.message;
                input.focus();
            }
        },

        _clearEdit() {
            State._editingMessage = null;
            const indicator = document.getElementById('uzcraftEditIndicator');
            const input = document.getElementById('uzcraftChatInput');
            if (indicator) {
                indicator.classList.remove('show');
            }
            if (input && !State._replyTo) {
                input.value = '';
            }
        },

        // ============================================================
        // FILE UPLOAD
        // ============================================================
        async _handleFileUpload(files) {
            const validFiles = [];
            const maxSize = CONFIG.MAX_FILE_SIZE;

            for (const file of files) {
                if (file.size > maxSize) {
                    Toast.error(`File "${file.name}" exceeds ${Utils.formatFileSize(maxSize)} limit`);
                    continue;
                }
                validFiles.push(file);
            }

            if (validFiles.length === 0) return;

            const progressEl = document.getElementById('uzcraftUploadProgress');
            const fillEl = document.getElementById('uzcraftUploadFill');
            const nameEl = document.getElementById('uzcraftUploadFileName');
            const percentEl = document.getElementById('uzcraftUploadPercent');

            if (progressEl) progressEl.classList.add('show');

            let completed = 0;
            const total = validFiles.length;

            for (const file of validFiles) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    nameEl.textContent = `Uploading: ${file.name}`;

                    // Simulate progress for UI
                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        progress += 2;
                        if (progress >= 90) {
                            clearInterval(progressInterval);
                            progress = 90;
                        }
                        fillEl.style.width = `${progress}%`;
                        percentEl.textContent = `${Math.round(progress)}%`;
                    }, 100);

                    const result = await API.uploadFile(formData);

                    clearInterval(progressInterval);
                    fillEl.style.width = '100%';
                    percentEl.textContent = '100%';

                    if (result.success && result.file) {
                        State._uploadQueue.push({
                            filename: result.file.filename || file.name,
                            originalName: file.name,
                            size: file.size,
                            type: file.type,
                            path: result.file.path,
                            url: result.file.url,
                            fileType: Utils.getFileType(file.name),
                            fileSize: Utils.formatFileSize(file.size)
                        });
                        Toast.success(`Uploaded: ${file.name}`);
                    }

                } catch (error) {
                    Toast.error(`Failed to upload: ${file.name}`);
                } finally {
                    completed++;
                    if (completed === total) {
                        setTimeout(() => {
                            if (progressEl) progressEl.classList.remove('show');
                        }, 1000);
                    }
                }
            }
        },

        // ============================================================
        // SCROLL HANDLING & INFINITE SCROLL
        // ============================================================
        _handleScroll() {
            const container = document.getElementById('uzcraftChatMessages');
            if (!container) return;

            const atBottom = Utils.isAtBottom(container);
            State._isAtBottom = atBottom;

            // Load more messages when scrolling up
            if (container.scrollTop < 100 && State._hasMoreMessages && !State.isLoading) {
                this._loadMoreMessages();
            }
        },

        async _loadMoreMessages() {
            if (State.isLoading || !State._hasMoreMessages) return;

            State.isLoading = true;
            const loadingEl = document.getElementById('uzcraftLoadingMore');
            if (loadingEl) loadingEl.classList.add('show');

            const userId = Utils.getUserId();
            const adminId = State.adminId;
            const nextPage = State._currentPage + 1;

            try {
                const messages = await API.getConversation(userId, adminId, nextPage);

                if (messages.length === 0) {
                    State._hasMoreMessages = false;
                    if (loadingEl) loadingEl.classList.remove('show');
                    return;
                }

                // Add messages to the beginning
                const newMessages = [];
                for (const msg of messages) {
                    if (!Utils.isMessageInCache(msg)) {
                        Utils.addToCache(msg);
                        newMessages.push(msg);
                    }
                }

                if (newMessages.length > 0) {
                    State.messages = [...newMessages, ...State.messages];
                    State.messages.sort((a, b) => 
                        new Date(a.timestamp) - new Date(b.timestamp)
                    );
                    State._currentPage = nextPage;
                    this.renderMessages();
                    
                    // Restore scroll position
                    const firstMessage = container.querySelector('.uzcraft-chat-message');
                    if (firstMessage) {
                        const scrollOffset = firstMessage.offsetTop - 50;
                        container.scrollTo({ top: scrollOffset, behavior: 'auto' });
                    }
                } else {
                    State._hasMoreMessages = false;
                }

            } catch (error) {
                // Silent fail
            } finally {
                State.isLoading = false;
                if (loadingEl) loadingEl.classList.remove('show');
            }
        },

        scrollToBottom() {
            const container = document.getElementById('uzcraftChatMessages');
            if (!container) return;
            
            requestAnimationFrame(() => {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            });
        },

        // ============================================================
        // MARK AS READ / DELIVERED
        // ============================================================
        async markMessagesAsRead() {
            const userId = Utils.getUserId();
            const adminId = State.adminId;

            if (!userId || !adminId) return;

            const unreadMessages = State.messages.filter(msg =>
                String(msg.senderId) === String(adminId) &&
                String(msg.receiverId) === String(userId) &&
                !msg.read
            );

            if (unreadMessages.length === 0) return;

            // Mark all as read in parallel
            await Promise.allSettled(
                unreadMessages.map(async (msg) => {
                    try {
                        await API.markAsRead(msg.id);
                        msg.read = true;
                        Socket.emit('message-read', {
                            messageId: msg.id,
                            readerId: userId
                        });
                    } catch (error) {
                        // Continue with next message
                    }
                })
            );

            this.renderMessages();
            this._updateUnreadCount();
        },

        async markMessagesAsDelivered() {
            const userId = Utils.getUserId();
            const adminId = State.adminId;

            if (!userId || !adminId) return;

            const undeliveredMessages = State.messages.filter(msg =>
                String(msg.senderId) === String(adminId) &&
                String(msg.receiverId) === String(userId) &&
                !msg.delivered
            );

            if (undeliveredMessages.length === 0) return;

            for (const msg of undeliveredMessages) {
                try {
                    await API.markAsDelivered(msg.id);
                    msg.delivered = true;
                } catch (error) {
                    // Continue
                }
            }

            this.renderMessages();
        },

        // ============================================================
        // UNREAD COUNT & BADGE
        // ============================================================
        async _updateUnreadCount() {
            const userId = Utils.getUserId();
            if (!userId) return;

            try {
                const count = await API.getUnreadCount(userId);
                State.unreadCount = count;
                this._updateBadge(count);
                this._updateTitle(count);
            } catch (error) {
                // Silent fail
            }
        },

        _updateBadge(count) {
            const badge = document.getElementById('uzcraftUnreadBadge');
            if (!badge) return;

            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.add('show');
            } else {
                badge.classList.remove('show');
            }
        },

        _updateTitle(count) {
            if (count > 0) {
                document.title = `💬 (${count}) UZCRAFT`;
            } else {
                document.title = 'UZCRAFT';
            }
        },

        // ============================================================
        // CHAT STATISTICS
        // ============================================================
        async _loadChatStats() {
            const userId = Utils.getUserId();
            if (!userId) return;

            try {
                const stats = await API.getChatStats(userId);
                // Store stats for display if needed
                State._stats = stats;
            } catch (error) {
                // Silent fail
            }
        },

        // ============================================================
        // DATA LOADING
        // ============================================================
        async _loadInitialMessages() {
            if (State.isLoading) return;

            const userId = Utils.getUserId();
            const adminId = State.adminId;

            if (!userId || !adminId) {
                return;
            }

            State.isLoading = true;
            State._currentPage = 1;
            State._hasMoreMessages = true;

            try {
                const messages = await API.getConversation(userId, adminId, 1);

                // Clear existing messages and cache
                State.messages = [];
                State.messageCache.clear();

                // Add messages to state
                for (const msg of messages) {
                    Utils.addToCache(msg);
                    State.messages.push(msg);
                }

                State.messages.sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );

                if (messages.length < CONFIG.MAX_MESSAGES_PER_PAGE) {
                    State._hasMoreMessages = false;
                }

                this.renderMessages();

                if (State.isOpen) {
                    await this.markMessagesAsRead();
                }

                await this._updateUnreadCount();

                // Update pinned messages
                State._pinnedMessages = State.messages
                    .filter(m => m.pinned)
                    .map(m => m.id);
                this._updatePinnedMessage();

            } catch (error) {
                if (!State.hasMessages) {
                    this.renderEmpty();
                }
            } finally {
                State.isLoading = false;
                State._isFirstLoad = false;
            }
        },

        // ============================================================
        // RENDER FUNCTIONS
        // ============================================================
        renderMessages() {
            const container = document.getElementById('uzcraftChatMessages');
            if (!container) return;

            if (!State.hasMessages) {
                this.renderEmpty();
                return;
            }

            const userId = Utils.getUserId();
            let html = '';
            let lastDate = '';

            for (const msg of State.messages) {
                // Skip failed temp messages
                if (msg._failed) continue;

                // Date separator
                const date = Utils.formatDate(msg.timestamp);
                if (date && date !== lastDate) {
                    html += `
                        <div class="uzcraft-chat-date-separator">
                            <span>${Utils.escapeHtml(date)}</span>
                        </div>
                    `;
                    lastDate = date;
                }

                const isSent = String(msg.senderId) === String(userId);
                const time = Utils.formatTime(msg.timestamp);
                const senderName = isSent ? 'You' : (msg.senderName || State.adminName || 'Support');
                const readStatus = isSent ? (msg.read ? '✓✓' : (msg.delivered ? '✓✓' : '✓')) : '';
                const readClass = msg.read ? 'read' : (msg.delivered ? 'delivered' : '');
                
                // Build message content
                let content = '';
                
                // Reply preview
                if (msg.replyTo) {
                    const replyMsg = State.messages.find(m => String(m.id) === String(msg.replyTo));
                    if (replyMsg && !replyMsg.isDeleted) {
                        content += `
                            <div class="reply-preview" onclick="ChatWidget._scrollToMessage('${replyMsg.id}')">
                                <span class="reply-sender">${Utils.escapeHtml(replyMsg.senderName)}:</span>
                                ${Utils.escapeHtml(replyMsg.message.slice(0, 80))}${replyMsg.message.length > 80 ? '...' : ''}
                            </div>
                        `;
                    }
                }

                // Message text or deleted placeholder
                if (msg.isDeleted) {
                    content += `<div class="message-deleted">${Utils.escapeHtml(msg.message)}</div>`;
                } else {
                    content += `<div class="msg-text">${Utils.escapeHtml(msg.message)}</div>`;
                }

                // Attachments
                if (msg.attachments && msg.attachments.length > 0) {
                    content += `<div class="message-attachments">`;
                    for (const attachment of msg.attachments) {
                        const isImage = attachment.fileType === 'image';
                        const icon = Utils.getFileIcon(attachment.originalName || attachment.filename);
                        const fileSize = Utils.formatFileSize(attachment.size || 0);
                        
                        if (isImage && attachment.url) {
                            content += `
                                <div class="attachment">
                                    <img src="${attachment.url}" alt="${Utils.escapeHtml(attachment.originalName || attachment.filename)}" 
                                         loading="lazy" onclick="window.open('${attachment.url}', '_blank')" />
                                </div>
                            `;
                        } else {
                            content += `
                                <div class="attachment" onclick="window.open('${attachment.url}', '_blank')">
                                    <span class="file-icon"><i class="fa-regular ${icon}"></i></span>
                                    <div class="file-info">
                                        <div class="file-name">${Utils.escapeHtml(attachment.originalName || attachment.filename)}</div>
                                        <div class="file-size">${fileSize}</div>
                                    </div>
                                    <button class="download-btn" onclick="event.stopPropagation(); window.open('${attachment.url}', '_blank')">
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                </div>
                            `;
                        }
                    }
                    content += `</div>`;
                }

                // Reactions
                if (msg.reactions && Object.keys(msg.reactions).length > 0) {
                    content += `<div class="message-reactions">`;
                    for (const [reaction, count] of Object.entries(msg.reactions)) {
                        if (count > 0) {
                            content += `
                                <span class="reaction" onclick="ChatWidget.addReaction('${msg.id}', '${reaction}')">
                                    ${reaction} <span class="count">${count}</span>
                                </span>
                            `;
                        }
                    }
                    content += `</div>`;
                }

                // Edited indicator
                if (msg.isEdited && !msg.isDeleted) {
                    content += `<span class="message-edited">(edited)</span>`;
                }

                // Build message HTML
                html += `
                    <div class="uzcraft-chat-message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}">
                        <div class="msg-sender">${Utils.escapeHtml(senderName)}</div>
                        ${content}
                        <span class="msg-time">
                            ${Utils.escapeHtml(time)}
                            ${readStatus ? `<span class="msg-status ${readClass}">${readStatus}</span>` : ''}
                        </span>
                        <div class="message-actions">
                            <button class="reply" onclick="ChatWidget._setReply(State.messages.find(m => m.id === '${msg.id}'))" title="Reply">
                                <i class="fa-solid fa-reply"></i>
                            </button>
                            <button class="copy" onclick="ChatWidget.copyMessage('${msg.id}')" title="Copy">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            ${!msg.isDeleted && String(msg.senderId) === String(userId) ? `
                                <button class="edit" onclick="ChatWidget._setEdit(State.messages.find(m => m.id === '${msg.id}'))" title="Edit">
                                    <i class="fa-regular fa-pen-to-square"></i>
                                </button>
                            ` : ''}
                            ${!msg.isDeleted && String(msg.senderId) === String(userId) ? `
                                <button class="delete" onclick="ChatWidget.deleteMessage('${msg.id}', false)" title="Delete for me">
                                    <i class="fa-regular fa-trash-can"></i>
                                </button>
                                <button class="delete" onclick="ChatWidget.deleteMessage('${msg.id}', true)" title="Delete for everyone" style="color:#ef4444;">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            ` : ''}
                            <button class="pin" onclick="ChatWidget.togglePinMessage('${msg.id}')" title="${msg.pinned ? 'Unpin' : 'Pin'}">
                                <i class="fa-regular ${msg.pinned ? 'fa-solid fa-thumbtack' : 'fa-thumbtack'}"></i>
                            </button>
                            <button class="react" onclick="ChatWidget._showReactionPicker('${msg.id}')" title="React">
                                <i class="fa-regular fa-face-smile"></i>
                            </button>
                            <button class="forward" onclick="ChatWidget._showForwardPicker('${msg.id}')" title="Forward">
                                <i class="fa-solid fa-share"></i>
                            </button>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;
            
            // Re-attach reaction click handlers
            container.querySelectorAll('.reaction').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            });

            // Auto scroll if at bottom
            if (State._isAtBottom) {
                this.scrollToBottom();
            }
        },

        renderEmpty() {
            const container = document.getElementById('uzcraftChatMessages');
            if (!container) return;
            container.innerHTML = `
                <div class="uzcraft-chat-empty">
                    <i class="fa-regular fa-comment-dots"></i>
                    <p>No messages yet. Start chatting!</p>
                </div>
            `;
        },

        renderLoading() {
            const container = document.getElementById('uzcraftChatMessages');
            if (!container) return;
            container.innerHTML = `
                <div class="uzcraft-chat-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <p>Loading messages...</p>
                </div>
            `;
        },

        // ============================================================
        // REACTION PICKER
        // ============================================================
        _showReactionPicker(messageId) {
            const reactions = ['👍', '❤️', '😂', '🔥', '👏', '😢', '🤔', '😮', '💯', '🙌'];
            const picker = document.createElement('div');
            picker.style.cssText = `
                position: fixed;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                padding: 8px;
                display: flex;
                gap: 4px;
                z-index: 100000;
                border: 1px solid #e5e7eb;
                animation: uzcraftSlideUp 0.2s ease;
            `;

            const rect = event.target.getBoundingClientRect();
            picker.style.left = `${rect.left}px`;
            picker.style.top = `${rect.top - 60}px`;

            for (const emoji of reactions) {
                const btn = document.createElement('button');
                btn.textContent = emoji;
                btn.style.cssText = `
                    width: 36px;
                    height: 36px;
                    border: none;
                    background: transparent;
                    font-size: 22px;
                    cursor: pointer;
                    border-radius: 8px;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = '#f3f4f6';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'transparent';
                });
                btn.addEventListener('click', () => {
                    this.addReaction(messageId, emoji);
                    picker.remove();
                });
                picker.appendChild(btn);
            }

            document.body.appendChild(picker);

            // Close on click outside
            const closePicker = (e) => {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closePicker);
            }, 100);
        },

        // ============================================================
        // FORWARD PICKER
        // ============================================================
        _showForwardPicker(messageId) {
            // Simple implementation - prompt for user ID
            const targetUserId = prompt('Enter user ID to forward this message to:');
            if (targetUserId && targetUserId.trim()) {
                this.forwardMessage(messageId, targetUserId.trim());
            }
        },

        // ============================================================
        // SCROLL TO MESSAGE
        // ============================================================
        _scrollToMessage(messageId) {
            const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (msgEl) {
                msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                msgEl.style.background = '#fef3c7';
                setTimeout(() => {
                    msgEl.style.background = '';
                }, 2000);
            }
        },

        // ============================================================
        // HELPERS
        // ============================================================
        _isAdmin() {
            const user = Utils.getCurrentUser();
            return user?.role === CONFIG.ADMIN_ROLE || user?.role === 'super';
        },

        // ============================================================
        // DESTROY - CLEANUP
        // ============================================================
        destroy() {
            Socket.disconnect();
            State.reset();
            State.isInitialized = false;
            
            const widget = document.getElementById('uzcraftChatWidget');
            if (widget) {
                widget.remove();
            }
        }
    };

    // ============================================================
    // 📦 EXPOSE GLOBALLY
    // ============================================================
    window.ChatWidget = ChatWidget;
    window.Toast = Toast;
    window.SocketManager = Socket;
    window.State = State;
    window.Utils = Utils;
    window.EmojiPicker = EmojiPicker;

    // ============================================================
    // 🚀 AUTO-INITIALIZATION
    // ============================================================
    function autoInit() {
        const user = Utils.getCurrentUser();
        if (user && user._id) {
            ChatWidget.init();
        } else {
            setTimeout(() => {
                const user2 = Utils.getCurrentUser();
                if (user2 && user2._id) {
                    ChatWidget.init();
                }
            }, 2000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    window.addEventListener('load', () => {
        if (!document.getElementById('uzcraftChatWidget')) {
            const user = Utils.getCurrentUser();
            if (user && user._id) {
                ChatWidget.init();
            }
        }
    });

})();