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
        this.isMinimized = true;
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
            
            <div class="vx-messages-area" id="vxMessagesArea">
                <div class="vx-system-message">
                    🐍 VenoX Chat'e hoş geldiniz!
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
                    // Avatar src'den tam URL'yi al
                    let avatarSrc = avatarImg.src;
                    if (avatarSrc.includes('/data/avatars/')) {
                        // Eğer relative path ise, base URL ekle
                        if (avatarSrc.startsWith('/')) {
                            avatarSrc = window.location.origin + avatarSrc;
                        }
                    }
                    this.currentUser.avatar = avatarSrc;
                }
            }
        } catch (e) {
            console.log('Kullanıcı bilgileri çıkarılamadı, varsayılan kullanılıyor');
        }
    }

    setupEventListeners() {
        // Toggle button
        document.getElementById('vx-chat-toggle-btn').addEventListener('click', () => this.toggleChat());
        document.getElementById('vx-close-btn').addEventListener('click', () => this.toggleChat());

        // Message input
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
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            panel.classList.remove('vx-chat-visible');
        } else {
            panel.classList.add('vx-chat-visible');
            this.scrollToBottom();
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
        
        // Check if user is banned
        if (this.bannedUsers.has(this.currentUser.name)) {
            this.showNotification('Yasaklı kullanıcısınız, mesaj gönderemezsiniz.', 'error');
            return;
        }

        try {
            // Send message to server
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
            // Fallback to local message if server fails
            this.addLocalMessage(this.currentUser.name, message, true);
            input.value = '';
            this.startCooldown();
        }
    }

    addLocalMessage(username, message, isCurrentUser = false) {
        const messagesArea = document.getElementById('vxMessagesArea');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'vx-message';
        
        const isUserAdmin = username === 'VenoX' || username === this.currentUser.name && this.currentUser.isAdmin;
        
        let avatarSrc;
        if (isCurrentUser && this.currentUser.avatar) {
            avatarSrc = this.currentUser.avatar;
        } else {
            // Simulated users için farklı avatarlar
            const avatarMap = {
                'gokaysevinc': 'https://cheatglobal.com/data/avatars/s/315/315079.jpg?1758126945',
                'V4S': 'https://cheatglobal.com/data/avatars/s/100/100001.jpg?1234567890',
                'TestUser': 'https://ui-avatars.com/api/?name=TestUser&background=2980b9&color=ffffff&size=32',
                'Player123': 'https://ui-avatars.com/api/?name=Player123&background=27ae60&color=ffffff&size=32',
                'GameMaster': 'https://ui-avatars.com/api/?name=GameMaster&background=8e44ad&color=ffffff&size=32'
            };
            
            avatarSrc = avatarMap[username] || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32`;
        }
        
        messageDiv.innerHTML = `
            <img src="${avatarSrc}" alt="${username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username">
                    ${username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
                    ${this.currentUser.isAdmin && !isCurrentUser && !isUserAdmin ? `
                        <div class="vx-user-actions">
                            <button class="vx-action-btn" onclick="venoxChat.muteUser('${username}')">Sustur</button>
                            <button class="vx-action-btn" onclick="venoxChat.banUser('${username}')">Yasakla</button>
                        </div>
                    ` : ''}
                </div>
                <div class="vx-message-text">${this.escapeHtml(message)}</div>
                ${this.isVideoLink(message) ? this.createVideoPreview(message) : ''}
            </div>
        `;
        
        messagesArea.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Limit messages to prevent memory issues
        while (messagesArea.children.length > 100) {
            messagesArea.removeChild(messagesArea.firstChild);
        }
    }

    isVideoLink(message) {
        return message.includes('youtube.com/watch') || message.includes('youtu.be/');
    }

    createVideoPreview(url) {
        const videoId = this.extractVideoId(url);
        if (!videoId) return '';
        
        return `
            <div class="vx-video-preview" onclick="window.open('${url}', '_blank')">
                <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="Video thumbnail">
                <div class="vx-play-button">▶</div>
                <div class="vx-video-title">Video'yu izlemek için tıklayın</div>
            </div>
        `;
    }

    extractVideoId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
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
            await this.apiRequest('admin/mute', {
                method: 'POST',
                body: JSON.stringify({
                    adminUser: this.currentUser.name,
                    targetUser: username
                })
            });
        } catch (error) {
            // Fallback to local mute if server fails
            this.mutedUsers.add(username);
        }
        
        this.addSystemMessage(`${username} susturuldu.`);
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
        } catch (error) {
            // Fallback to local ban if server fails
            this.bannedUsers.add(username);
        }
        
        this.addSystemMessage(`${username} yasaklandı.`);
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
        
        // Fetch messages from server
        this.pollingInterval = setInterval(() => {
            this.fetchMessages();
        }, 3000); // Her 3 saniyede mesajları çek

        // Fallback to simulation if server fails
        setTimeout(() => {
            this.simulateActivity();
        }, Math.random() * 15000 + 10000);

        // Update active users count
        setInterval(() => {
            this.updateActiveUsers();
        }, 30000);
    }

    async fetchMessages() {
        try {
            const result = await this.apiRequest('messages');
            if (result.success && result.messages) {
                this.updateMessagesFromServer(result.messages);
                this.activeUsers = result.activeUsers || this.activeUsers;
                this.updateActiveUsersDisplay();
            }
        } catch (error) {
            // Server'a ulaşılamazsa simülasyon moduna geç
            console.log('Server offline, using simulation mode');
        }
    }

    updateMessagesFromServer(serverMessages) {
        const messagesArea = document.getElementById('vxMessagesArea');
        const currentMessageIds = Array.from(messagesArea.children)
            .filter(el => el.dataset.messageId)
            .map(el => el.dataset.messageId);

        // Yeni mesajları ekle
        serverMessages.forEach(msg => {
            if (!currentMessageIds.includes(msg.id.toString())) {
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
        
        messageDiv.innerHTML = `
            <img src="${avatarSrc}" alt="${messageData.username}" class="vx-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(messageData.username)}&background=3498db&color=ffffff&size=32'">
            <div class="vx-message-content">
                <div class="vx-username">
                    ${messageData.username}
                    ${isUserAdmin ? '<span class="vx-admin-badge">Admin</span>' : ''}
                    ${this.currentUser.isAdmin && messageData.username !== this.currentUser.name && !isUserAdmin ? `
                        <div class="vx-user-actions">
                            <button class="vx-action-btn" onclick="venoxChat.muteUser('${messageData.username}')">Sustur</button>
                            <button class="vx-action-btn" onclick="venoxChat.banUser('${messageData.username}')">Yasakla</button>
                        </div>
                    ` : ''}
                </div>
                <div class="vx-message-text">${this.escapeHtml(messageData.message)}</div>
                ${this.isVideoLink(messageData.message) ? this.createVideoPreview(messageData.message) : ''}
            </div>
        `;
        
        messagesArea.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Limit messages to prevent memory issues
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

    simulateActivity() {
        if (Math.random() < 0.3) { // 30% chance
            const users = ['gokaysevinc', 'V4S', 'TestUser', 'Player123', 'GameMaster'];
            const messages = ['Merhaba!', 'Nasıl gidiyor?', 'Kimse var mı?', 'Bu harika!', 'Teşekkürler'];
            
            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            
            if (!this.bannedUsers.has(randomUser) && !this.mutedUsers.has(randomUser)) {
                this.addLocalMessage(randomUser, randomMessage, false);
            }
        }
    }

    updateActiveUsers() {
        this.activeUsers = Math.max(1, this.activeUsers + (Math.random() > 0.5 ? 1 : -1));
        const countElement = document.querySelector('.vx-active-users-count');
        if (countElement) {
            countElement.textContent = this.activeUsers;
        }
    }

    scrollToBottom() {
        const messagesArea = document.getElementById('vxMessagesArea');
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    showNotification(message, type = "info", duration = 3000) {
        // Remove existing notifications
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
                this.isMinimized = state.isMinimized !== false; // Default to minimized
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
