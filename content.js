class VenoxChat {
    constructor() {
        this.apiUrl = "https://chat-eklentisi.onrender.com";
        this.currentUser = { name: 'Misafir' + Math.floor(Math.random() * 1000), avatar: null, isAdmin: false, isGuest: true };
        this.messages = [];
        this.activeUsers = 1;
        this.mutedUsers = new Set();
        this.bannedUsers = new Set();
        this.blockedPrefixes = new Set();
        this.cooldownTimer = null;
        this.pollingInterval = null;
        this.unreadMessages = 0;
        this.selectedMessages = new Set();
        this.serverOnline = true; // Sunucu durumu takibi
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.run());
        } else {
            this.run();
        }
    }

    run() {
        if (!window.location.hostname.includes('cheatglobal.com')) return;
        this.createChatUI();
        this.extractUserInfo();
        this.setupEventListeners();
        this.startChatPolling();
        this.checkForSavedState();
        this.loadBlockedPrefixes();
        setInterval(() => this.updateTimestamps(), 60000);
    }
    
    updateTimestamps() {
        const timestampElements = document.querySelectorAll('.vx-timestamp');
        timestampElements.forEach(el => {
            const date = new Date(el.dataset.timestamp);
            el.textContent = this.formatTimestamp(date);
        });
    }

    createChatUI() {
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'vx-chat-toggle-btn';
        toggleBtn.innerHTML = `<span>💬</span>`;
        document.body.appendChild(toggleBtn);

        const panel = document.createElement('div');
        panel.id = 'vx-chat-panel';
        panel.innerHTML = `
            <div class="vx-chat-header">
                <div class="vx-chat-title">
                    <span>🐍</span>
                    <span>VenoX Chat</span>
                </div>
                <div class="vx-header-stats">
                    <span class="vx-online-dot"></span>
                    <span class="vx-active-users-count">0</span> Aktif
                </div>
                <button id="vx-close-btn">×</button>
            </div>
            
            <div class="vx-main-content">
                <div class="vx-messages-area" id="vxMessagesArea">
                    <div class="vx-system-message" id="vxWelcomeMessage">
                        🐍 VenoX Chat'e hoş geldiniz!
                    </div>
                </div>
                
                <div class="vx-users-sidebar" id="vxUsersSidebar">
                    <div class="vx-sidebar-header">
                        <span class="vx-users-icon">👥</span>
                        <span>Aktif Kullanıcılar</span>
                        <span class="vx-user-count-badge" id="vxUserCountBadge">1</span>
                    </div>
                    <div class="vx-users-list" id="vxUsersList"></div>
                </div>
            </div>
            
            <div class="vx-input-area">
                <div class="vx-input-wrapper">
                    <input 
                        type="text" 
                        class="vx-message-input" 
                        id="vxMessageInput" 
                        placeholder="Mesajınızı yazın..."
                        maxlength="200"
                    >
                    <button class="vx-send-btn" id="vxSendBtn">
                        ➤
                    </button>
                </div>
                <div class="vx-cooldown hidden" id="vxCooldown"></div>
            </div>
        `;
        document.body.appendChild(panel);
        
        if (this.currentUser.isAdmin) {
            const bulkDeleteBar = document.createElement('div');
            bulkDeleteBar.id = 'vxBulkDeleteBar';
            bulkDeleteBar.className = 'vx-bulk-delete-bar';
            bulkDeleteBar.innerHTML = `<button class="vx-bulk-delete-btn">Seçilen 0 mesajı sil</button>`;
            document.getElementById('vxMessagesArea').prepend(bulkDeleteBar);
            
            this.createAdminPanels();
        }
    }

    createAdminPanels() {
        // Toplu ban paneli
        const bulkBanPanel = document.createElement('div');
        bulkBanPanel.id = 'vxBulkBanPanel';
        bulkBanPanel.className = 'vx-bulk-ban-panel';
        bulkBanPanel.innerHTML = `
            <div class="vx-bulk-ban-header">
                <span>🔨 Toplu Ban</span>
                <button id="vxToggleBulkBan" class="vx-toggle-bulk-ban">Aç</button>
            </div>
            <div class="vx-bulk-ban-content" id="vxBulkBanContent" style="display: none;">
                <div class="vx-bulk-ban-input-group">
                    <label>Kullanıcı adı başlangıcı:</label>
                    <input type="text" id="vxBulkBanPrefix" placeholder="örn: user, bot, spam" maxlength="20">
                    <button id="vxBulkBanExecute" class="vx-bulk-ban-execute">Toplu Ban</button>
                </div>
                <div class="vx-bulk-ban-preview" id="vxBulkBanPreview"></div>
            </div>
        `;
        
        // Prefix engelleme paneli
        const blockPrefixPanel = document.createElement('div');
        blockPrefixPanel.id = 'vxBlockPrefixPanel';
        blockPrefixPanel.className = 'vx-block-prefix-panel';
        blockPrefixPanel.innerHTML = `
            <div class="vx-block-prefix-header">
                <span>🚫 Kullanıcı Adı Engelleme</span>
                <button id="vxToggleBlockPrefix" class="vx-toggle-block-prefix">Aç</button>
            </div>
            <div class="vx-block-prefix-content" id="vxBlockPrefixContent" style="display: none;">
                <div class="vx-block-prefix-input-group">
                    <label>Engellenecek prefix:</label>
                    <input type="text" id="vxBlockPrefixInput" placeholder="örn: user, bot, spam" maxlength="20">
                    <button id="vxAddBlockPrefix" class="vx-add-block-prefix">Engelle</button>
                </div>
                <div class="vx-blocked-prefixes-list" id="vxBlockedPrefixesList">
                    <div class="vx-blocked-prefixes-header">Engellenen Prefix'ler:</div>
                    <div class="vx-blocked-prefixes-items" id="vxBlockedPrefixesItems"></div>
                </div>
            </div>
        `;
        
        // Panelleri body'ye ekle (chat panelinin dışına)
        document.body.appendChild(bulkBanPanel);
        document.body.appendChild(blockPrefixPanel);
    }

    extractUserInfo() {
        try {
            const userLink = document.querySelector('.p-navgroup-link--user');
            if (userLink) {
                this.currentUser.isGuest = false;
                const usernameElement = userLink.querySelector('.p-navgroup-linkText');
                if (usernameElement) {
                    this.currentUser.name = usernameElement.textContent.trim();
                }
                this.currentUser.isAdmin = this.currentUser.name === 'VenoX';
                
                const avatarImg = userLink.querySelector('.avatar img');
                if (avatarImg && avatarImg.src) {
                    let avatarSrc = avatarImg.src;
                    if (avatarSrc.startsWith('/')) {
                        avatarSrc = window.location.origin + avatarSrc;
                    }
                    this.currentUser.avatar = avatarSrc;
                }
            } else {
                this.currentUser.isGuest = true;
                this.currentUser.name = 'Misafir';
                document.getElementById('vxMessageInput').placeholder = 'Mesaj göndermek için üye olunuz.';
                document.getElementById('vxMessageInput').disabled = true;
                document.getElementById('vxSendBtn').disabled = true;
                this.updateWelcomeMessage('Mesaj göndermek için giriş yapınız.');
            }
        } catch (e) {
            console.log('Kullanıcı bilgileri çıkarılamadı, varsayılan misafir kullanılıyor');
            this.currentUser.isGuest = true;
        }
    }

    updateWelcomeMessage(message) {
        const welcomeMessageDiv = document.getElementById('vxWelcomeMessage');
        if (welcomeMessageDiv) {
            welcomeMessageDiv.textContent = message;
        }
    }

    setupEventListeners() {
        document.getElementById('vx-chat-toggle-btn').addEventListener('click', () => this.toggleChat());
        document.getElementById('vx-close-btn').addEventListener('click', () => this.toggleChat());

        const messageInput = document.getElementById('vxMessageInput');
        const sendBtn = document.getElementById('vxSendBtn');
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !sendBtn.disabled) {
                this.sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => this.sendMessage());
        
        if (this.currentUser.isAdmin) {
            const bulkDeleteBar = document.getElementById('vxBulkDeleteBar');
            if (bulkDeleteBar) {
                bulkDeleteBar.querySelector('.vx-bulk-delete-btn').addEventListener('click', () => this.bulkDeleteMessages());
            }
            
            // Toplu ban event listeners
            document.getElementById('vxToggleBulkBan')?.addEventListener('click', () => this.toggleBulkBanPanel());
            document.getElementById('vxBulkBanPrefix')?.addEventListener('input', (e) => this.previewBulkBan(e.target.value));
            document.getElementById('vxBulkBanExecute')?.addEventListener('click', () => this.executeBulkBan());
            
            // Prefix engelleme event listeners
            document.getElementById('vxToggleBlockPrefix')?.addEventListener('click', () => this.toggleBlockPrefixPanel());
            document.getElementById('vxAddBlockPrefix')?.addEventListener('click', () => this.addBlockedPrefix());
            document.getElementById('vxBlockPrefixInput')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addBlockedPrefix();
                }
            });
        }
    }

    toggleChat() {
        const panel = document.getElementById('vx-chat-panel');
        const toggleBtn = document.getElementById('vx-chat-toggle-btn');
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            panel.classList.remove('vx-chat-visible');
            toggleBtn.style.right = '20px';
        } else {
            panel.classList.add('vx-chat-visible');
            toggleBtn.style.right = '630px'; 
            this.scrollToBottom();
            this.fetchUsers();
            this.clearUnreadCount();
        }
        
        this.saveState();
    }

    clearUnreadCount() {
        this.unreadMessages = 0;
        const toggleBtn = document.getElementById('vx-chat-toggle-btn');
        let badge = toggleBtn.querySelector('.vx-new-message-badge');
        if (badge) {
            badge.remove();
        }
    }

    updateUnreadCount() {
        if (this.isMinimized) {
            this.unreadMessages++;
            const toggleBtn = document.getElementById('vx-chat-toggle-btn');
            let badge = toggleBtn.querySelector('.vx-new-message-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'vx-new-message-badge';
                toggleBtn.appendChild(badge);
            }
            badge.textContent = this.unreadMessages > 99 ? '99+' : this.unreadMessages;
        }
    }

    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiUrl}/${endpoint}`, {
                method: 'GET',
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.serverOnline = true;
            return result;
            
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            this.serverOnline = false;
            
            // Sunucu çevrimdışıysa yerel mod kullan
            if (endpoint === 'messages' && options.method === 'POST') {
                // Yerel mesaj ekleme
                return { success: true, message: 'Yerel mesaj gönderildi' };
            }
            
            throw error;
        }
    }

    async sendMessage() {
        const input = document.getElementById('vxMessageInput');
        const sendBtn = document.getElementById('vxSendBtn');
        const message = input.value.trim();
        
        if (!message || sendBtn.disabled || this.currentUser.isGuest) return;
        
        if (this.bannedUsers.has(this.currentUser.name)) {
            this.showNotification('Yasaklı kullanıcısınız, mesaj gönderemezsiniz.', 'error');
            return;
        }
        
        if (this.mutedUsers.has(this.currentUser.name)) {
            this.showNotification('Susturulmuş kullanıcısınız, mesaj gönderemezsiniz.', 'error');
            return;
        }

        try {
            await this.apiRequest('messages', {
                method: 'POST',
                body: JSON.stringify({
                    username: this.currentUser.name,
                    message: message,
                    avatar: this.currentUser.avatar,
                    isAdmin: this.currentUser.isAdmin
                })
            });

            input.value = '';
            this.startCooldown();
            
        } catch (error) {
            // Sunucu hatası durumunda yerel mesaj ekle
            console.log('Sunucu hatası, yerel mesaj ekleniyor');
            this.addLocalMessage(this.currentUser.name, message, true);
            input.value = '';
            this.startCooldown();
        }
    }

    isUsernameBlocked(username) {
        for (let prefix of this.blockedPrefixes) {
            if (username.toLowerCase().startsWith(prefix.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    addLocalMessage(username, message, isCurrentUser = false) {
        if (this.isUsernameBlocked(username) && !isCurrentUser) {
            return;
        }

        const messagesArea = document.getElementById('vxMessagesArea');
        const messageDiv = document.createElement('div');
        const messageId = Date.now() + Math.random();
        messageDiv.className = 'vx-message';
        messageDiv.dataset.messageId = messageId;
        
        const isUserAdmin = this.isUserAdmin(username);
        
        let avatarSrc;
        if (isCurrentUser && this.currentUser.avatar) {
            avatarSrc = this.currentUser.avatar;
        } else {
            avatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32`;
        }
        
        const deleteButton = this.currentUser.isAdmin ? `<button class="vx-delete-btn" data-message-id="${messageId}" title="Mesajı Sil">🗑️</button>` : '';
        const replyButton = `<button class="vx-reply-btn" data-username="${username}" data-message-text="${this.escapeHtml(message)}" title="Yanıtla">Yanıtla</button>`;

        const adminActions = this.currentUser.isAdmin && !isCurrentUser ? `
            <div class="vx-user-actions" data-username="${username}">
                <button class="vx-action-btn mute-btn" data-username="${username}">Sustur (5dk)</button>
                <button class="vx-action-btn ban-btn" data-username="${username}">Yasakla</button>
                <button class="vx-action-btn unmute-btn" data-username="${username}">Susturmayı Kaldır</button>
                <button class="vx-action-btn unban-btn" data-username="${username}">Yasağı Kaldır</button>
            </div>
        ` : '';

        const messageMeta = `
            <div class="vx-message-meta">
                ${replyButton}
                ${deleteButton}
            </div>
        `;

        const selector = this.currentUser.isAdmin ? `<div class="vx-message-selector" data-message-id="${messageId}" title="Mesajı Seç"></div>` : '';
        const timestamp = `<span class="vx-timestamp" data-timestamp="${new Date().toISOString()}">${this.formatTimestamp(new Date())}</span>`;

        messageDiv.innerHTML = `
            ${selector}
            <img src="${avatarSrc}" alt="${username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username" data-username="${username}">
                    ${username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
                    ${timestamp}
                </div>
                ${adminActions}
                <div class="vx-message-text">${this.escapeHtml(message)}</div>
                ${this.isVideoLink(message) ? this.createVideoPreview(message) : ''}
            </div>
            ${messageMeta}
        `;
        
        messagesArea.appendChild(messageDiv);
        this.scrollToBottom();

        this.addMessageListeners(messageDiv, messageId);

        while (messagesArea.children.length > 100) {
            messagesArea.removeChild(messagesArea.firstChild);
        }
    }

    formatTimestamp(date) {
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
    
        if (days > 0) return `${days} gün önce`;
        if (hours > 0) return `${hours} saat önce`;
        if (minutes > 0) return `${minutes} dakika önce`;
        if (seconds >= 0) return `${seconds} saniye önce`;
    
        return 'şimdi';
    }

    addMessageListeners(messageDiv, messageId) {
        // Reply button
        const replyBtn = messageDiv.querySelector('.vx-reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                const text = e.target.dataset.messageText;
                const input = document.getElementById('vxMessageInput');
                input.value = `@${username} `;
                input.focus();
            });
        }

        if (this.currentUser.isAdmin) {
            // Message selector
            const selector = messageDiv.querySelector('.vx-message-selector');
            if (selector) {
                selector.addEventListener('click', () => {
                    selector.classList.toggle('selected');
                    const messageId = selector.dataset.messageId;
                    if (selector.classList.contains('selected')) {
                        this.selectedMessages.add(messageId);
                    } else {
                        this.selectedMessages.delete(messageId);
                    }
                    this.updateBulkDeleteBar();
                });
            }

            // Username click for admin actions
            const usernameDiv = messageDiv.querySelector('.vx-username');
            if (usernameDiv) {
                usernameDiv.addEventListener('click', () => {
                    const actionsDiv = messageDiv.querySelector('.vx-user-actions');
                    if (actionsDiv) {
                        actionsDiv.classList.toggle('visible');
                    }
                });
            }

            // Admin action buttons
            const muteBtn = messageDiv.querySelector('.mute-btn');
            if (muteBtn) {
                muteBtn.addEventListener('click', (e) => {
                    this.muteUser(e.target.dataset.username);
                });
            }

            const banBtn = messageDiv.querySelector('.ban-btn');
            if (banBtn) {
                banBtn.addEventListener('click', (e) => {
                    this.banUser(e.target.dataset.username);
                });
            }

            const unmuteBtn = messageDiv.querySelector('.unmute-btn');
            if (unmuteBtn) {
                unmuteBtn.addEventListener('click', (e) => {
                    this.unmuteUser(e.target.dataset.username);
                });
            }

            const unbanBtn = messageDiv.querySelector('.unban-btn');
            if (unbanBtn) {
                unbanBtn.addEventListener('click', (e) => {
                    this.unbanUser(e.target.dataset.username);
                });
            }

            // Delete button
            const deleteBtn = messageDiv.querySelector('.vx-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    this.deleteMessage(messageId, messageDiv);
                });
            }
        }
    }

    updateBulkDeleteBar() {
        const bar = document.getElementById('vxBulkDeleteBar');
        if (!bar) return;
        
        if (this.selectedMessages.size > 0) {
            bar.style.display = 'flex';
            const button = bar.querySelector('.vx-bulk-delete-btn');
            if (button) {
                button.textContent = `Seçilen ${this.selectedMessages.size} mesajı sil`;
            }
        } else {
            bar.style.display = 'none';
        }
    }

    async bulkDeleteMessages() {
        if (this.selectedMessages.size === 0) return;
        
        if (!confirm(`${this.selectedMessages.size} mesajı silmek istediğinizden emin misiniz?`)) {
            return;
        }
        
        const messageIds = Array.from(this.selectedMessages);

        try {
            if (this.serverOnline) {
                await this.apiRequest('messages/bulk', {
                    method: 'DELETE',
                    body: JSON.stringify({
                        adminUser: this.currentUser.name,
                        messageIds: messageIds
                    })
                });
            }
            
            // Yerel olarak mesajları sil
            messageIds.forEach(id => {
                const messageElement = document.querySelector(`[data-message-id="${id}"]`);
                if (messageElement) {
                    messageElement.remove();
                }
            });
            
            this.selectedMessages.clear();
            this.updateBulkDeleteBar();
            this.addSystemMessage(`${messageIds.length} mesaj silindi.`);
            
        } catch (error) {
            console.error('Toplu silme hatası:', error);
            this.showNotification('Toplu silme başarısız.', 'error');
        }
    }

    // Toplu ban metodları
    toggleBulkBanPanel() {
        const content = document.getElementById('vxBulkBanContent');
        const toggle = document.getElementById('vxToggleBulkBan');
        
        if (!content || !toggle) return;
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            toggle.textContent = 'Kapat';
            this.previewBulkBan(document.getElementById('vxBulkBanPrefix')?.value || '');
        } else {
            content.style.display = 'none';
            toggle.textContent = 'Aç';
        }
    }

    previewBulkBan(prefix) {
        const previewDiv = document.getElementById('vxBulkBanPreview');
        if (!previewDiv) return;
        
        if (!prefix.trim()) {
            previewDiv.innerHTML = '';
            return;
        }
        
        const matchingUsers = this.getActiveUsersList().filter(username => 
            username.toLowerCase().startsWith(prefix.toLowerCase()) && 
            username !== this.currentUser.name &&
            username !== 'VenoX'
        );
        
        const messageUsers = [...new Set(this.messages
            .filter(msg => msg.username.toLowerCase().startsWith(prefix.toLowerCase()) && 
                          msg.username !== this.currentUser.name &&
                          msg.username !== 'VenoX')
            .map(msg => msg.username)
        )];
        
        const allMatchingUsers = [...new Set([...matchingUsers, ...messageUsers])];
        
        if (allMatchingUsers.length === 0) {
            previewDiv.innerHTML = '<div class="vx-preview-empty">Bu prefix ile eşleşen kullanıcı bulunamadı</div>';
            return;
        }
        
        previewDiv.innerHTML = `
            <div class="vx-preview-header">
                <strong>${allMatchingUsers.length} kullanıcı banlanacak:</strong>
            </div>
            <div class="vx-preview-users">
                ${allMatchingUsers.map(user => `
                    <span class="vx-preview-user ${this.bannedUsers.has(user) ? 'already-banned' : ''}">${user}</span>
                `).join('')}
            </div>
            ${allMatchingUsers.some(user => this.bannedUsers.has(user)) ? 
                '<div class="vx-preview-note">🟡 Sarı olanlar zaten banlanmış</div>' : ''
            }
        `;
    }

    async executeBulkBan() {
        const prefixInput = document.getElementById('vxBulkBanPrefix');
        if (!prefixInput) return;
        
        const prefix = prefixInput.value.trim();
        if (!prefix) {
            this.showNotification('Lütfen bir prefix girin', 'error');
            return;
        }
        
        if (!confirm(`"${prefix}" ile başlayan tüm kullanıcıları banlamak istediğinizden emin misiniz?`)) {
            return;
        }
        
        const activeUsers = this.getActiveUsersList();
        const messageUsers = [...new Set(this.messages.map(msg => msg.username))];
        const allUsers = [...new Set([...activeUsers, ...messageUsers])];
        
        const targetUsers = allUsers.filter(username => 
            username.toLowerCase().startsWith(prefix.toLowerCase()) && 
            username !== this.currentUser.name &&
            username !== 'VenoX' &&
            !this.bannedUsers.has(username)
        );
        
        if (targetUsers.length === 0) {
            this.showNotification('Banlanacak kullanıcı bulunamadı', 'error');
            return;
        }
        
        try {
            if (this.serverOnline) {
                await this.apiRequest('admin/bulk-ban', {
                    method: 'POST',
                    body: JSON.stringify({
                        adminUser: this.currentUser.name,
                        prefix: prefix,
                        targetUsers: targetUsers
                    })
                });
            }
            
            // Yerel olarak da uygula
            targetUsers.forEach(user => this.bannedUsers.add(user));
            this.showNotification(`${targetUsers.length} kullanıcı başarıyla banlandı`, 'success');
            this.addSystemMessage(`🔨 Toplu ban: "${prefix}" prefix'i ile ${targetUsers.length} kullanıcı banlandı.`);
            this.previewBulkBan(prefix);
            
        } catch (error) {
            console.error('Sunucu hatası, yerel toplu ban uygulanıyor:', error);
            targetUsers.forEach(user => this.bannedUsers.add(user));
            this.addSystemMessage(`🔨 Toplu ban (yerel): "${prefix}" prefix'i ile ${targetUsers.length} kullanıcı banlandı.`);
            this.showNotification(`${targetUsers.length} kullanıcı yerel olarak banlandı`, 'info');
            this.previewBulkBan(prefix);
        }
        
        prefixInput.value = '';
    }

    // Prefix engelleme metodları
    toggleBlockPrefixPanel() {
        const content = document.getElementById('vxBlockPrefixContent');
        const toggle = document.getElementById('vxToggleBlockPrefix');
        
        if (!content || !toggle) return;
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            toggle.textContent = 'Kapat';
            this.updateBlockedPrefixesList();
        } else {
            content.style.display = 'none';
            toggle.textContent = 'Aç';
        }
    }

    addBlockedPrefix() {
        const input = document.getElementById('vxBlockPrefixInput');
        if (!input) return;
        
        const prefix = input.value.trim().toLowerCase();
        
        if (!prefix) {
            this.showNotification('Lütfen bir prefix girin', 'error');
            return;
        }
