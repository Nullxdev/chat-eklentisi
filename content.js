class VenoxChat {
    constructor() {
        this.apiUrl = "https://chat-eklentisi.onrender.com";
        this.currentUser = { name: 'Misafir' + Math.floor(Math.random() * 1000), avatar: null, isAdmin: false };
        this.messages = [];
        this.activeUsers = 1;
        this.mutedUsers = new Set();
        this.bannedUsers = new Set();
        this.cooldownTimer = null;
        this.pollingInterval = null;
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
        // Toggle Button
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'vx-chat-toggle-btn';
        toggleBtn.innerHTML = `<span>💬</span>`;
        document.body.appendChild(toggleBtn);

        // Chat Panel
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
                    <div class="vx-system-message">
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
    }

    extractUserInfo() {
        try {
            const userLink = document.querySelector('.p-navgroup-link .p-navgroup-linkText');
            const avatarImg = document.querySelector('.p-navgroup-link .avatar img');
            
            if (userLink) {
                this.currentUser.name = userLink.textContent.trim();
                this.currentUser.isAdmin = this.currentUser.name === 'VenoX';
                
                if (avatarImg && avatarImg.src) {
                    let avatarSrc = avatarImg.src;
                    if (avatarSrc.startsWith('/')) {
                        avatarSrc = window.location.origin + avatarSrc;
                    }
                    this.currentUser.avatar = avatarSrc;
                }
            }
        } catch (e) {
            console.log('Kullanıcı bilgileri çıkarılamadı, varsayılan kullanılıyor');
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
            toggleBtn.style.right = '630px'; // Yeni genişliğe göre ayarlandı
            this.scrollToBottom();
            this.fetchUsers();
        }
        
        this.saveState();
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
            this.showNotification(error.message, "error");
            throw error;
        }
    }

    async sendMessage() {
        const input = document.getElementById('vxMessageInput');
        const sendBtn = document.getElementById('vxSendBtn');
        const message = input.value.trim();
        
        if (!message || sendBtn.disabled) return;
        
        if (this.bannedUsers.has(this.currentUser.name)) {
            this.showNotification('Yasaklı kullanıcısınız, mesaj gönderemezsiniz.', 'error');
            return;
        }
        
        if (this.mutedUsers.has(this.currentUser.name)) {
            this.showNotification('Susturulmuş kullanıcısınız, mesaj gönderemezsiniz.', 'error');
            return;
        }

        try {
            const res = await this.apiRequest('messages', {
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
        
        let adminActions = '';
        if (this.currentUser.isAdmin && !isCurrentUser) {
            const actions = [];
            
            if (!isUserAdmin) {
                actions.push(`<button class="vx-action-btn" onclick="venoxChat.muteUser('${username}')">Sustur (5dk)</button>`);
                actions.push(`<button class="vx-action-btn" onclick="venoxChat.banUser('${username}')">Yasakla</button>`);
                actions.push(`<button class="vx-action-btn" onclick="venoxChat.unmuteUser('${username}')">Susturmayı Kaldır</button>`);
                actions.push(`<button class="vx-action-btn" onclick="venoxChat.unbanUser('${username}')">Yasağı Kaldır</button>`);
            }
            
            if (actions.length > 0) {
                adminActions = `<div class="vx-user-actions">${actions.join('')}</div>`;
            }
        }
        
        let deleteButton = '';
        if (this.currentUser.isAdmin) {
            deleteButton = `<button class="vx-delete-btn" onclick="venoxChat.deleteMessage(${messageId}, this.closest('.vx-message'))">🗑️</button>`;
        }
        
        messageDiv.innerHTML = `
            <img src="${avatarSrc}" alt="${username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username">
                    ${username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
                    ${adminActions}
                    ${deleteButton}
                </div>
                <div class="vx-message-text">${this.escapeHtml(message)}</div>
                ${this.isVideoLink(message) ? this.createVideoPreview(message) : ''}
            </div>
        `;
        
        messagesArea.appendChild(messageDiv);
        this.scrollToBottom();
        
        while (messagesArea.children.length > 100) {
            messagesArea.removeChild(messagesArea.firstChild);
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
            const duration = 5 * 60 * 1000; // 5 dakika
            await this.apiRequest('admin/mute', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username,
                    duration: duration
                })
            });
            this.mutedUsers.add(username);
            this.addSystemMessage(`${username} 5 dakika boyunca susturuldu.`);
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
            await this.apiRequest('admin/unmute', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
            this.mutedUsers.delete(username);
            this.addSystemMessage(`${username} susturması kaldırıldı.`);
        } catch (error) {
            console.error('Server error, using local unmute:', error);
            this.mutedUsers.delete(username);
            this.addSystemMessage(`${username} susturması kaldırıldı (yerel).`);
        }
    }

    async banUser(username) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            await this.apiRequest('admin/ban', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
            this.bannedUsers.add(username);
            this.addSystemMessage(`${username} yasaklandı.`);
        } catch (error) {
            console.error('Server error, using local ban:', error);
            this.bannedUsers.add(username);
            this.addSystemMessage(`${username} yasaklandı (yerel).`);
        }
    }
    
    async unbanUser(username) {
        if (!this.currentUser.isAdmin) return;
        
        try {
            await this.apiRequest('admin/unban', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
            this.bannedUsers.delete(username);
            this.addSystemMessage(`${username} yasağı kaldırıldı.`);
        } catch (error) {
            console.error('Server error, using local unban:', error);
            this.bannedUsers.delete(username);
            this.addSystemMessage(`${username} yasağı kaldırıldı (yerel).`);
        }
    }

    async deleteMessage(messageId, messageElement) {
        if (!this.currentUser.isAdmin) return;
        
        if (messageElement && messageElement.parentNode) {
            messageElement.remove();
        }
        
        try {
            await this.apiRequest(`messages/${messageId}`, {
                method: 'DELETE',
                body: JSON.stringify({
                    adminUser: this.currentUser.name
                })
            });
        } catch (error) {
            console.error('Could not delete from server:', error);
        }
        
        this.addSystemMessage('Mesaj silindi.');
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
        
        // VenoX kullanıcısını her zaman listeye ekle
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
        const currentMessageIds = new Set(Array.from(messagesArea.children)
            .filter(el => el.dataset.messageId)
            .map(el => el.dataset.messageId));

        serverMessages.forEach(msg => {
            if (!currentMessageIds.has(msg.id.toString())) {
                this.messages.push(msg);
                this.addServerMessage(msg);
            }
        });
    }

    addServerMessage(messageData) {
        const messagesArea = document.getElementById('vxMessagesArea');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'vx-message';
        messageDiv.dataset.messageId = messageData.id;
        
        const isUserAdmin = messageData.isAdmin || messageData.username === 'VenoX';
        const avatarSrc = messageData.avatar || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(messageData.username)}&background=3498db&color=ffffff&size=32`;
        
        let adminActions = '';
        if (this.currentUser.isAdmin && messageData.username !== this.currentUser.name) {
             adminActions = `
                <div class="vx-user-actions">
                    <button class="vx-action-btn" onclick="venoxChat.muteUser('${messageData.username}')">Sustur (5dk)</button>
                    <button class="vx-action-btn" onclick="venoxChat.banUser('${messageData.username}')">Yasakla</button>
                    <button class="vx-action-btn" onclick="venoxChat.unmuteUser('${messageData.username}')">Susturmayı Kaldır</button>
                    <button class="vx-action-btn" onclick="venoxChat.unbanUser('${messageData.username}')">Yasağı Kaldır</button>
                </div>
            `;
        }

        let deleteButton = '';
        if (this.currentUser.isAdmin) {
             deleteButton = `<button class="vx-delete-btn" onclick="venoxChat.deleteMessage(${messageData.id}, this.closest('.vx-message'))">🗑️</button>`;
        }

        messageDiv.innerHTML = `
            <img src="${avatarSrc}" alt="${messageData.username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(messageData.username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username">
                    ${messageData.username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
                    ${adminActions}
                    ${deleteButton}
                </div>
                <div class="vx-message-text">${this.escapeHtml(messageData.message)}</div>
                ${this.isVideoLink(messageData.message) ? this.createVideoPreview(messageData.message) : ''}
            </div>
        `;
        
        messagesArea.appendChild(messageDiv);
        this.scrollToBottom();
        
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

// Initialize chat when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.venoxChat = new VenoxChat();
    });
} else {
    window.venoxChat = new VenoxChat();
}
