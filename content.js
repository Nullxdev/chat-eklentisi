class VenoxChat {
    constructor() {
        this.apiUrl = "https://chat-eklentisi.onrender.com";
        this.currentUser = { name: 'Misafir' + Math.floor(Math.random() * 1000), avatar: null, isAdmin: false, isGuest: true };
        this.messages = [];
        this.activeUsers = 1;
        this.mutedUsers = new Set();
        this.bannedUsers = new Set();
        this.cooldownTimer = null;
        this.pollingInterval = null;
        this.unreadMessages = 0;
        this.selectedMessages = new Set();
        this.init();
    }

    init() {
        if (!window.location.hostname.includes('cheatglobal.com')) return;
        this.createChatUI();
        this.extractUserInfo();
        this.setupEventListeners();
        this.startChatPolling();
        this.checkForSavedState();
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
        
        // Toplu silme barı ekle
        if (this.currentUser.isAdmin) {
            const bulkDeleteBar = document.createElement('div');
            bulkDeleteBar.id = 'vxBulkDeleteBar';
            bulkDeleteBar.className = 'vx-bulk-delete-bar';
            bulkDeleteBar.innerHTML = 'Seçilen mesajları sil (0)';
            bulkDeleteBar.style.display = 'none'; // Başlangıçta gizli
            document.getElementById('vxMessagesArea').prepend(bulkDeleteBar);
            bulkDeleteBar.addEventListener('click', () => this.bulkDeleteMessages());
        }
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

    addLocalMessage(username, message, isCurrentUser = false) {
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

        messageDiv.innerHTML = `
            ${selector}
            <img src="${avatarSrc}" alt="${username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username" data-username="${username}">
                    ${username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
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
            bar.textContent = `Seçilen mesajları sil (${this.selectedMessages.size})`;
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
        
        let venoxExists = users.some(u => u.username === 'VenoX');
        if (!venoxExists && this.currentUser.name === 'VenoX') {
            users.push({ username: 'VenoX', avatar: this.currentUser.avatar });
        }
        
        usersListElement.innerHTML = '';
        
        users.forEach(user => {
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
            userCountBadge.textContent = users.length;
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

    updateMessagesFromServer(serverMessages) {
        const messagesArea = document.getElementById('vxMessagesArea');
        const currentMessageElements = Array.from(messagesArea.children).filter(el => el.dataset.messageId);
        const currentMessageIds = new Set(currentMessageElements.map(el => el.dataset.messageId));

        const serverMessageIds = new Set(serverMessages.map(msg => msg.id.toString()));

        // Sunucuda olmayan mesajları kaldır
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

        messageDiv.innerHTML = `
            ${selector}
            <img src="${avatarSrc}" alt="${messageData.username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(messageData.username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username" data-username="${messageData.username}">
                    ${messageData.username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
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
            if (messagesArea.firstChild.dataset && messagesArea.firstChild.dataset.messageId) {
                messagesArea.removeChild(messagesArea.firstChild);
            } else {
                break;
            }
        }
    }

    updateActiveUsersDisplay() {
        const countElement = document.querySelector('.vx-active-users-count');
        if (countElement) {
            countElement.textContent = this.activeUsers;
        }
    }

    stopChatPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    scrollToBottom() {
        const messagesArea = document.getElementById('vxMessagesArea');
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    showNotification(message, type = "info", duration = 3000) {
        document.querySelectorAll('.vx-notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `vx-notification vx-notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    saveState() {
        localStorage.setItem('venoxChatState', JSON.stringify({
            isMinimized: this.isMinimized,
            user: this.currentUser
        }));
    }

    checkForSavedState() {
        try {
            const savedState = localStorage.getItem('venoxChatState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.isMinimized = state.isMinimized !== false;
                if (state.user) {
                    Object.assign(this.currentUser, state.user);
                }
            }
        } catch (e) {
            console.log('Saved state could not be loaded');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.venoxChat = new VenoxChat();
    });
} else {
    window.venoxChat = new VenoxChat();
}
