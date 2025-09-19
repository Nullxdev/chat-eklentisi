const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS ayarları
const corsOptions = {
    origin: ['https://cheatglobal.com', 'http://localhost:3000'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// In-memory storage
let messages = [];
let activeUsers = new Set();
let bannedUsers = new Set();
let mutedUsers = new Set();

setInterval(() => {
    if (messages.length > 100) {
        messages = messages.slice(-100);
    }
}, 60000);

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

app.get('/messages', (req, res) => {
    try {
        const recentMessages = messages.slice(-50);
        res.json({ 
            success: true, 
            messages: recentMessages,
            activeUsers: activeUsers.size
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Mesajlar alınamadı' });
    }
});

app.post('/messages', (req, res) => {
    try {
        const { username, message, avatar, isAdmin } = req.body;

        if (!username || !message) {
            return res.status(400).json({ success: false, message: 'Username ve mesaj gerekli' });
        }

        if (message.length > 200) {
            return res.status(400).json({ success: false, message: 'Mesaj çok uzun' });
        }
        
        if (bannedUsers.has(username) || mutedUsers.has(username)) {
            return res.status(403).json({ success: false, message: 'Yasaklı veya susturulmuş kullanıcı' });
        }

        const newMessage = {
            id: Date.now() + Math.random(),
            username,
            message: message.trim(),
            avatar,
            isAdmin: username === 'VenoX',
            timestamp: new Date().toISOString(),
        };

        messages.push(newMessage);
        activeUsers.add(username);

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

app.delete('/messages/:id', (req, res) => {
    const { id } = req.params;
    const { adminUser } = req.body;
    
    if (adminUser !== 'VenoX') {
        return res.status(403).json({ success: false, message: 'Yetki yok' });
    }
    
    const initialLength = messages.length;
    messages = messages.filter(msg => msg.id.toString() !== id);
    
    if (messages.length < initialLength) {
        res.json({ success: true, message: 'Mesaj silindi' });
    } else {
        res.status(404).json({ success: false, message: 'Mesaj bulunamadı' });
    }
});


app.post('/admin/mute', (req, res) => {
    try {
        const { adminUser, targetUser, duration } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        mutedUsers.add(targetUser);

        setTimeout(() => {
            mutedUsers.delete(targetUser);
        }, duration);

        res.json({ 
            success: true, 
            message: `${targetUser} susturuldu` 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Mute işlemi başarısız' });
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

app.get('/stats', (req, res) => {
    const currentActiveUsers = new Set(activeUsers);
    currentActiveUsers.add('VenoX');

    res.json({
        success: true,
        stats: {
            totalMessages: messages.length,
            activeUsers: currentActiveUsers.size,
            activeUsersList: Array.from(currentActiveUsers),
            bannedUsers: bannedUsers.size,
            mutedUsers: mutedUsers.size,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        }
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
});

app.listen(PORT, () => {
    console.log(`VenoX Chat Server running on port ${PORT}`);
    
    messages.push({
        id: Date.now(),
        username: 'System',
        message: 'VenoX Chat Server başlatıldı!',
        isAdmin: true,
        timestamp: new Date().toISOString(),
        isSystem: true
    });
});
