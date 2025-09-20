class VenoxChat {
    constructor() {
        this.apiUrl = "https://chat-eklentisi.onrender.com";
        this.currentUser = { name: 'Misafir' + Math.floor(Math.random() * 1000), avatar: null, isAdmin: false, isGuest: true };
        this.messages = [];
        this.activeUsers = 1;
        this.mutedUsers = new Set();
        this.bannedUsers = new Set();
        this.blockedPrefixes = new Set(); // Yeni: Engellenen prefix'ler
        this.cooldownTimer = null;
        this.pollingInterval = null;
        this.unreadMessages = 0;
        this.selectedMessages = new Set();
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
        this.loadBlockedPrefixes(); // Yeni: Kaydedilmiş prefix'leri yükle
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
            
            // Admin panelleri ekle
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
            <div class="vx-bulk-ban-content" id="vxBulkBanContent">
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
            <div class="vx-block-prefix-content" id="vxBlockPrefixContent">
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
        
        document.getElementById('vx-chat-panel').appendChild(bulkBanPanel);
        document.getElementById('vx-chat-panel').appendChild(blockPrefixPanel);
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
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Sunucu hatası" }));
                throw new Error(errorData.message);
            }
            
            return await response.json();
        } catch (error) {
            this.showNotification(`Sunucuya ulaşılamıyor: ${error.message}`, "error");
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
            this.addLocalMessage(this.currentUser.name, message, true);
            input.value = '';
            this.startCooldown();
        }
    }

    // Yeni: Kullanıcı adı prefix kontrolü
    isUsernameBlocked(username) {
        for (let prefix of this.blockedPrefixes) {
            if (username.toLowerCase().startsWith(prefix.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    addLocalMessage(username, message, isCurrentUser = false) {
        // Engellenen prefix kontrolü
        if (this.isUsernameBlocked(username) && !isCurrentUser) {
            return; // Mesajı gösterme
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
        
        const deleteButton = this.currentUser.isAdmin ? `<button class="vx-delete-btn" data-message-id="${messageId}">🗑️</button>` : '';
        const replyButton = `<button class="vx-reply-btn" data-username="${username}" data-message-text="${this.escapeHtml(message)}">Yanıtla</button>`;

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

        const selector = this.currentUser.isAdmin ? `<div class="vx-message-selector" data-message-id="${messageId}"></div>` : '';
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
        messageDiv.querySelector('.vx-reply-btn')?.addEventListener('click', (e) => {
            const username = e.target.dataset.username;
            const text = e.target.dataset.messageText;
            const input = document.getElementById('vxMessageInput');
            input.value = `@${username} ${text} `;
            input.focus();
        });

        if (this.currentUser.isAdmin) {
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

            const usernameDiv = messageDiv.querySelector('.vx-username');
            if (usernameDiv) {
                usernameDiv.addEventListener('click', () => {
                    const actionsDiv = messageDiv.querySelector('.vx-user-actions');
                    if (actionsDiv) {
                        actionsDiv.classList.toggle('visible');
                    }
                });
            }

            messageDiv.querySelector('.mute-btn')?.addEventListener('click', (e) => this.muteUser(e.target.dataset.username));
            messageDiv.querySelector('.ban-btn')?.addEventListener('click', (e) => this.banUser(e.target.dataset.username));
            messageDiv.querySelector('.unmute-btn')?.addEventListener('click', (e) => this.unmuteUser(e.target.dataset.username));
            messageDiv.querySelector('.unban-btn')?.addEventListener('click', (e) => this.unbanUser(e.target.dataset.username));
            messageDiv.querySelector('.vx-delete-btn')?.addEventListener('click', () => this.deleteMessage(messageId, messageDiv));
        }
    }

    updateBulkDeleteBar() {
        const bar = document.getElementById('vxBulkDeleteBar');
        if (this.selectedMessages.size > 0) {
            bar.style.display = 'flex';
            const button = bar.querySelector('.vx-bulk-delete-btn');
            button.textContent = `Seçilen ${this.selectedMessages.size} mesajı sil`;
        } else {
            bar.style.display = 'none';
        }
    }

    async bulkDeleteMessages() {
        if (this.selectedMessages.size === 0) return;
        
        const messageIds = Array.from(this.selectedMessages);

        try {
            await this.apiRequest('messages/bulk', {
                method: 'DELETE',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    messageIds: messageIds
                })
            });
            this.selectedMessages.clear();
            this.updateBulkDeleteBar();
            this.addSystemMessage('Seçili mesajlar silindi.');
        } catch (error) {
            console.error('Toplu silme başarısız oldu:', error);
            this.showNotification('Toplu silme başarısız.', 'error');
        }
    }

    // Yeni: Toplu ban metodları
    toggleBulkBanPanel() {
        const content = document.getElementById('vxBulkBanContent');
        const toggle = document.getElementById('vxToggleBulkBan');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            toggle.textContent = 'Kapat';
            this.previewBulkBan(document.getElementById('vxBulkBanPrefix').value);
        } else {
            content.style.display = 'none';
            toggle.textContent = 'Aç';
        }
    }

    previewBulkBan(prefix) {
        const previewDiv = document.getElementById('vxBulkBanPreview');
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
        const prefix = document.getElementById('vxBulkBanPrefix').value.trim();
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
            const result = await this.apiRequest('admin/bulk-ban', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    prefix: prefix,
                    targetUsers: targetUsers
                })
            });
            
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
        
        document.getElementById('vxBulkBanPrefix').value = '';
    }

    // Yeni: Prefix engelleme metodları
    toggleBlockPrefixPanel() {
        const content = document.getElementById('vxBlockPrefixContent');
        const toggle = document.getElementById('vxToggleBlockPrefix');
        
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
        const prefix = input.value.trim().toLowerCase();
        
        if (!prefix) {
            this.showNotification('Lütfen bir prefix girin', 'error');
            return;
        }
        
        if (prefix === 'venox' || prefix === 'admin') {
            this.showNotification('Bu prefix engellenemez', 'error');
            return;
        }
        
        if (this.blockedPrefixes.has(prefix)) {
            this.showNotification('Bu prefix zaten engellenmiş', 'error');
            return;
        }
        
        this.blockedPrefixes.add(prefix);
        this.saveBlockedPrefixes();
        this.updateBlockedPrefixesList();
        
        input.value = '';
        this.showNotification(`"${prefix}" prefix'i engellendi`, 'success');
        this.addSystemMessage(`🚫 "${prefix}" ile başlayan kullanıcı adları engellendi.`);
        
        // API'ye gönder
        this.syncBlockedPrefixesToServer();
    }

    removeBlockedPrefix(prefix) {
        if (confirm(`"${prefix}" prefix engelini kaldırmak istediğinizden emin misiniz?`)) {
            this.blockedPrefixes.delete(prefix);
            this.saveBlockedPrefixes();
            this.updateBlockedPrefixesList();
            this.showNotification(`"${prefix}" prefix engeli kaldırıldı`, 'success');
            this.addSystemMessage(`✅ "${prefix}" prefix engeli kaldırıldı.`);
            this.syncBlockedPrefixesToServer();
        }
    }

    updateBlockedPrefixesList() {
        const container = document.getElementById('vxBlockedPrefixesItems');
        if (!container) return;
        
        if (this.blockedPrefixes.size === 0) {
            container.innerHTML = '<div class="vx-no-blocked-prefixes">Henüz engellenmiş prefix yok</div>';
            return;
        }
        
        container.innerHTML = Array.from(this.blockedPrefixes).map(prefix => `
            <div class="vx-blocked-prefix-item">
                <span class="vx-blocked-prefix-name">${prefix}</span>
                <button class="vx-remove-blocked-prefix" onclick="window.venoxChat.removeBlockedPrefix('${prefix}')">×</button>
            </div>
        `).join('');
    }

    saveBlockedPrefixes() {
        try {
            localStorage.setItem('vx-blocked-prefixes', JSON.stringify(Array.from(this.blockedPrefixes)));
        } catch (e) {
            console.log('Blocked prefixes kaydedilemedi:', e);
        }
    }

    loadBlockedPrefixes() {
        try {
            const saved = localStorage.getItem('vx-blocked-prefixes');
            if (saved) {
                this.blockedPrefixes = new Set(JSON.parse(saved));
            }
        } catch (e) {
            console.log('Blocked prefixes yüklenemedi:', e);
        }
    }

    async syncBlockedPrefixesToServer() {
        try {
            await this.apiRequest('admin/blocked-prefixes', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    blockedPrefixes: Array.from(this.blockedPrefixes)
                })
            });
        } catch (error) {
            console.error('Blocked prefixes sunucuya gönderilemedi:', error);
        }
    }

    getActiveUsersList() {
        const usersList = document.querySelectorAll('.vx-user-name');
        return Array.from(usersList).map(el => el.textContent);
    }

    isVideoLink(message) {
        return message.includes('youtube.com/watch') || message.includes('youtu.be/') || message.includes('streamable.com/');
    }

    createVideoPreview(url) {
        let videoHtml = '';
        if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            const videoId = this.extractVideoId(url);
            if (videoId) {
                videoHtml = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            }
        } else if (url.includes('streamable.com/')) {
            const streamableId = this.extractStreamableId(url);
            if (streamableId) {
                videoHtml = `<iframe src="https://streamable.com/e/${streamableId}" frameborder="0" allowfullscreen></iframe>`;
            }
        }

        if (videoHtml) {
            return `<div class="vx-video-preview">${videoHtml}</div>`;
        }
        return '';
    }

    extractVideoId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }

    extractStreamableId(url) {
        const regExp = /(?:streamable\.com\/)(?:e\/)?([a-zA-Z0-9]+)/;
        const match = url.match(regExp);
        return (match && match[1]) ? match[1] : null;
    }

    startCooldown() {
        const sendBtn = document.getElementById('vxSendBtn');
        const cooldownDiv = document.getElementById('vxCooldown');
        
        sendBtn.disabled = true;
        cooldownDiv.classList.remove('hidden');
        
        let seconds = 2;
        cooldownDiv.textContent = `${seconds} saniye bekleyin...`;
        
        this.cooldownTimer = setInterval(() => {
            seconds--;
            if (seconds > 0) {
                cooldownDiv.textContent = `${seconds} saniye bekleyin...`;
            } else {
                clearInterval(this.cooldownTimer);
                sendBtn.disabled = false;
                cooldownDiv.classList.add('hidden');
            }
        }, 1000);
    }

    async muteUser(username) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            const duration = 5 * 60 * 1000;
            const res = await this.apiRequest('admin/mute', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username,
                    duration: duration
                })
            });
            this.mutedUsers.add(username);
            this.showNotification(`Kullanıcı susturuldu: ${username}`, 'info');
            this.addSystemMessage(res.message);
        } catch (error) {
            console.error('Server error, using local mute:', error);
            this.mutedUsers.add(username);
            this.addSystemMessage(`${username} susturuldu (yerel).`);
            setTimeout(() => this.mutedUsers.delete(username), 5 * 60 * 1000);
        }
    }
    
    async unmuteUser(username) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            const res = await this.apiRequest('admin/unmute', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
            this.mutedUsers.delete(username);
            this.showNotification(`Kullanıcı susturması kaldırıldı: ${username}`, 'info');
            this.addSystemMessage(res.message);
        } catch (error) {
            console.error('Server error, using local unmute:', error);
            this.mutedUsers.delete(username);
            this.addSystemMessage(`${username} susturması kaldırıldı (yerel).`);
        }
    }

    async banUser(username) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            const res = await this.apiRequest('admin/ban', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
            this.bannedUsers.add(username);
            this.showNotification(`Kullanıcı yasaklandı: ${username}`, 'info');
            this.addSystemMessage(res.message);
        } catch (error) {
            console.error('Server error, using local ban:', error);
            this.bannedUsers.add(username);
            this.addSystemMessage(`${username} yasaklandı (yerel).`);
        }
    }
    
    async unbanUser(username) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            const res = await this.apiRequest('admin/unban', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
            this.bannedUsers.delete(username);
            this.showNotification(`Kullanıcı yasağı kaldırıldı: ${username}`, 'info');
            this.addSystemMessage(res.message);
        } catch (error) {
            console.error('Server error, using local unban:', error);
            this.bannedUsers.delete(username);
            this.addSystemMessage(`${username} yasağı kaldırıldı (yerel).`);
        }
    }

    async deleteMessage(messageId, messageElement) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            await this.apiRequest(`messages/${messageId}`, {
                method: 'DELETE',
                body: JSON.stringify({
                    adminUser: this.currentUser.name
                })
            });
            if (messageElement && messageElement.parentNode) {
                messageElement.remove();
            }
            this.addSystemMessage('Mesaj silindi.');
        } catch (error) {
            console.error('Could not delete from server:', error);
        }
    }

    isUserAdmin(username) {
        return username === 'VenoX';
    }

    addSystemMessage(message) {
        const messagesArea = document.getElementById('vxMessagesArea');
        const systemDiv = document.createElement('div');
        systemDiv.className = 'vx-system-message';
        systemDiv.textContent = message;
        messagesArea.appendChild(systemDiv);
        this.scrollToBottom();
    }

    startChatPolling() {
        this.stopChatPolling();
        
        this.pollingInterval = setInterval(() => {
            this.fetchMessages();
        }, 3000); 
    }

    stopChatPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async fetchMessages() {
        try {
            const result = await this.apiRequest('messages');
            if (result.success && result.messages) {
                this.updateMessagesFromServer(result.messages);
                this.activeUsers = result.activeUsers || this.activeUsers;
                this.updateActiveUsersDisplay();
            }
            this.fetchUsers();
        } catch (error) {
            console.error('Server offline, using simulation mode:', error);
        }
    }

    async fetchUsers() {
        try {
            const result = await this.apiRequest('stats');
            if (result.success && result.stats && result.stats.activeUsersList) {
                const usersWithAvatars = result.stats.activeUsersList.map(username => {
                    const foundMessage = this.messages.find(msg => msg.username === username && msg.avatar);
                    return {
                        username: username,
                        avatar: foundMessage ? foundMessage.avatar : this.getUserAvatar(username)
                    };
                });
                this.updateUsersList(usersWithAvatars);
            }
        } catch (error) {
            console.error('Kullanıcı listesi alınamadı, kendi kullanıcısı gösteriliyor.');
            this.updateUsersList([{ username: this.currentUser.name, avatar: this.currentUser.avatar }]);
        }
    }

    updateUsersList(users) {
        const usersListElement = document.getElementById('vxUsersList');
        if (!usersListElement) return;
        
        // Engellenen prefix'lere sahip kullanıcıları filtrele
        const filteredUsers = users.filter(user => !this.isUsernameBlocked(user.username));
        
        let venoxExists = filteredUsers.some(u => u.username === 'VenoX');
        if (!venoxExists && this.currentUser.name === 'VenoX') {
            filteredUsers.push({ username: 'VenoX', avatar: this.currentUser.avatar });
        }
        
        usersListElement.innerHTML = '';
        
        filteredUsers.forEach(user => {
            const username = user.username;
            const avatar = user.avatar || this.getUserAvatar(username);

            const userItem = document.createElement('div');
            userItem.className = 'vx-user-item';
            
            userItem.innerHTML = `
                <img src="${avatar}" alt="${username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32'">
                <div class="vx-user-name">${username}</div>
            `;
            
            usersListElement.appendChild(userItem);
        });
        
        const userCountBadge = document.getElementById('vxUserCountBadge');
        if (userCountBadge) {
            userCountBadge.textContent = filteredUsers.length;
        }
    }

    getUserAvatar(username) {
        if (username === this.currentUser.name && this.currentUser.avatar) {
            return this.currentUser.avatar;
        }
        
        const userMessage = this.messages.find(msg => msg.username === username && msg.avatar);
        if (userMessage) {
            return userMessage.avatar;
        }

        return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32`;
    }

    updateActiveUsersDisplay() {
        const activeUsersCount = document.querySelector('.vx-active-users-count');
        if (activeUsersCount) {
            activeUsersCount.textContent = this.activeUsers;
        }
    }

    updateMessagesFromServer(serverMessages) {
        const messagesArea = document.getElementById('vxMessagesArea');
        const currentMessageElements = Array.from(messagesArea.children).filter(el => el.dataset.messageId);
        const currentMessageIds = new Set(currentMessageElements.map(el => el.dataset.messageId));

        const serverMessageIds = new Set(serverMessages.map(msg => msg.id.toString()));

        currentMessageElements.forEach(el => {
            if (!serverMessageIds.has(el.dataset.messageId)) {
                el.remove();
            }
        });

        let newMessages = false;
        serverMessages.forEach(msg => {
            if (!currentMessageIds.has(msg.id.toString())) {
                this.messages.push(msg);
                this.addServerMessage(msg);
                newMessages = true;
            }
        });

        if (newMessages) {
            this.updateUnreadCount();
        }
    }

    addServerMessage(messageData) {
        // Engellenen prefix kontrolü
        if (this.isUsernameBlocked(messageData.username)) {
            return; // Mesajı gösterme
        }

        const messagesArea = document.getElementById('vxMessagesArea');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'vx-message';
        messageDiv.dataset.messageId = messageData.id;
        
        const isUserAdmin = messageData.isAdmin || messageData.username === 'VenoX';
        const avatarSrc = messageData.avatar || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(messageData.username)}&background=3498db&color=ffffff&size=32`;
        
        const deleteButton = this.currentUser.isAdmin ? `<button class="vx-delete-btn" data-message-id="${messageData.id}">🗑️</button>` : '';
        const replyButton = `<button class="vx-reply-btn" data-username="${messageData.username}" data-message-text="${this.escapeHtml(messageData.message)}">Yanıtla</button>`;

        const adminActions = this.currentUser.isAdmin && messageData.username !== this.currentUser.name ? `
            <div class="vx-user-actions" data-username="${messageData.username}">
                <button class="vx-action-btn mute-btn" data-username="${messageData.username}">Sustur (5dk)</button>
                <button class="vx-action-btn ban-btn" data-username="${messageData.username}">Yasakla</button>
                <button class="vx-action-btn unmute-btn" data-username="${messageData.username}">Susturmayı Kaldır</button>
                <button class="vx-action-btn unban-btn" data-username="${messageData.username}">Yasağı Kaldır</button>
            </div>
        ` : '';

        const messageMeta = `
            <div class="vx-message-meta">
                ${replyButton}
                ${deleteButton}
            </div>
        `;

        const selector = this.currentUser.isAdmin ? `<div class="vx-message-selector" data-message-id="${messageData.id}"></div>` : '';
        const timestamp = `<span class="vx-timestamp" data-timestamp="${messageData.timestamp}">${this.formatTimestamp(new Date(messageData.timestamp))}</span>`;

        messageDiv.innerHTML = `
            ${selector}
            <img src="${avatarSrc}" alt="${messageData.username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(messageData.username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username" data-username="${messageData.username}">
                    ${messageData.username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
                    ${timestamp}
                </div>
                ${adminActions}
                <div class="vx-message-text">${this.escapeHtml(messageData.message)}</div>
                ${this.isVideoLink(messageData.message) ? this.createVideoPreview(messageData.message) : ''}
            </div>
            ${messageMeta}
        `;
        
        messagesArea.appendChild(messageDiv);
        this.scrollToBottom();

        this.addMessageListeners(messageDiv, messageData.id);

        while (messagesArea.children.length > 100) {
            messagesArea.removeChild(messagesArea.firstChild);
        }
    }

    scrollToBottom() {
        const messagesArea = document.getElementById('vxMessagesArea');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `vx-notification ${type === 'error' ? 'vx-notification-error' : type === 'success' ? 'vx-notification-success' : ''}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    saveState() {
        try {
            localStorage.setItem('vx-chat-state', JSON.stringify({
                isMinimized: this.isMinimized
            }));
        } catch (e) {
            console.log('State kaydedilemedi:', e);
        }
    }

    checkForSavedState() {
        try {
            const savedState = localStorage.getItem('vx-chat-state');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.isMinimized = state.isMinimized !== false;
                
                const panel = document.getElementById('vx-chat-panel');
                const toggleBtn = document.getElementById('vx-chat-toggle-btn');
                
                if (!this.isMinimized) {
                    panel.classList.add('vx-chat-visible');
                    toggleBtn.style.right = '630px';
                }
            } else {
                this.isMinimized = true;
            }
        } catch (e) {
            this.isMinimized = true;
        }
    }
}

// Global referans oluştur (removeBlockedPrefix için gerekli)
window.venoxChat = new VenoxChat();
