const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (production'da Redis kullan)
let messages = [];
let activeUsers = new Set();
let bannedUsers = new Set();
let mutedUsers = new Set();

// Cleanup old messages (son 100 mesajı sakla)
setInterval(() => {
    if (messages.length > 100) {
        messages = messages.slice(-100);
    }
}, 60000); // Her dakika temizle

// Health check
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: 'VenoX Chat Server Active',
        stats: {
            totalMessages: messages.length,
            activeUsers: activeUsers.size,
            bannedUsers: bannedUsers.size,
            mutedUsers: mutedUsers.size
        }
    });
});

// Get recent messages
app.get('/messages', (req, res) => {
    try {
        const recentMessages = messages.slice(-50); // Son 50 mesaj
        res.json({ 
            success: true, 
            messages: recentMessages,
            activeUsers: activeUsers.size
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Mesajlar alınamadı' });
    }
});

// Send message
app.post('/messages', (req, res) => {
    try {
        const { username, message, avatar, isAdmin } = req.body;

        // Validation
        if (!username || !message) {
            return res.status(400).json({ success: false, message: 'Username ve mesaj gerekli' });
        }

        if (message.length > 200) {
            return res.status(400).json({ success: false, message: 'Mesaj çok uzun' });
        }

        // Check if user is banned
        if (bannedUsers.has(username)) {
            return res.status(403).json({ success: false, message: 'Yasaklı kullanıcı' });
        }

        // Check if user is muted
        if (mutedUsers.has(username)) {
            return res.status(403).json({ success: false, message: 'Susturulmuş kullanıcı' });
        }

        const newMessage = {
            id: Date.now() + Math.random(),
            username,
            message: message.trim(),
            avatar,
            isAdmin: isAdmin || username === 'VenoX',
            timestamp: new Date().toISOString(),
            ip: req.ip // Rate limiting için
        };

        messages.push(newMessage);
        activeUsers.add(username);

        // Auto-cleanup inactive users (5 dakika sonra)
        setTimeout(() => {
            activeUsers.delete(username);
        }, 300000);

        res.json({ 
            success: true, 
            message: 'Mesaj gönderildi',
            messageId: newMessage.id
        });

    } catch (error) {
        console.error('Message error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
});

// Admin endpoints
app.post('/admin/ban', (req, res) => {
    try {
        const { adminUser, targetUser } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        bannedUsers.add(targetUser);
        activeUsers.delete(targetUser);

        res.json({ 
            success: true, 
            message: `${targetUser} yasaklandı` 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Ban işlemi başarısız' });
    }
});

app.post('/admin/mute', (req, res) => {
    try {
        const { adminUser, targetUser } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        mutedUsers.add(targetUser);

        res.json({ 
            success: true, 
            message: `${targetUser} susturuldu` 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Mute işlemi başarısız' });
    }
});

app.post('/admin/unban', (req, res) => {
    try {
        const { adminUser, targetUser } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        bannedUsers.delete(targetUser);

        res.json({ 
            success: true, 
            message: `${targetUser} yasağı kaldırıldı` 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Unban işlemi başarısız' });
    }
});

app.post('/admin/unmute', (req, res) => {
    try {
        const { adminUser, targetUser } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        mutedUsers.delete(targetUser);

        res.json({ 
            success: true, 
            message: `${targetUser} susturma kaldırıldı` 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Unmute işlemi başarısız' });
    }
});

// Get server stats
app.get('/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            totalMessages: messages.length,
            activeUsers: activeUsers.size,
            bannedUsers: bannedUsers.size,
            mutedUsers: mutedUsers.size,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
});

// Start server
app.listen(PORT, () => {
    console.log(`VenoX Chat Server running on port ${PORT}`);
    
    // Add some initial system messages
    messages.push({
        id: Date.now(),
        username: 'System',
        message: 'VenoX Chat Server başlatıldı!',
        isAdmin: true,
        timestamp: new Date().toISOString(),
        isSystem: true
    });
});
