const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
    origin: ['https://cheatglobal.com', 'http://localhost:3000'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

let messages = [];
let activeUsers = new Set();
let bannedUsers = new Set();
let mutedUsers = new Set();
let blockedPrefixes = new Set(); // Yeni: Engellenen prefix'ler

// Yeni: Kullanıcı adı kontrolü
function isUsernameBlocked(username) {
    for (let prefix of blockedPrefixes) {
        if (username.toLowerCase().startsWith(prefix.toLowerCase())) {
            return true;
        }
    }
    return false;
}

app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: 'VenoX Chat Server Active',
        stats: {
            totalMessages: messages.length,
            activeUsers: activeUsers.size,
            bannedUsers: bannedUsers.size,
            mutedUsers: mutedUsers.size,
            blockedPrefixes: blockedPrefixes.size
        }
    });
});

app.get('/messages', (req, res) => {
    try {
        // Engellenen prefix'lere sahip kullanıcıların mesajlarını filtrele
        const filteredMessages = messages.filter(msg => !isUsernameBlocked(msg.username));
        res.json({ 
            success: true, 
            messages: filteredMessages,
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

        // Yeni: Engellenen prefix kontrolü
        if (isUsernameBlocked(username)) {
            return res.status(403).json({ success: false, message: 'Bu kullanıcı adı engellendi' });
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

app.delete('/messages/bulk', (req, res) => {
    const { messageIds, adminUser } = req.body;
    
    if (adminUser !== 'VenoX') {
        return res.status(403).json({ success: false, message: 'Yetki yok' });
    }
    
    const initialLength = messages.length;
    messages = messages.filter(msg => !messageIds.includes(msg.id.toString()));
    
    if (messages.length < initialLength) {
        res.json({ success: true, message: 'Mesajlar silindi' });
    } else {
        res.status(404).json({ success: false, message: 'Mesaj bulunamadı' });
    }
});

// Yeni: Toplu ban endpoint'i
app.post('/admin/bulk-ban', (req, res) => {
    try {
        const { adminUser, prefix, targetUsers } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        if (!prefix || !targetUsers || !Array.isArray(targetUsers)) {
            return res.status(400).json({ success: false, message: 'Geçersiz parametreler' });
        }

        if (targetUsers.length === 0) {
            return res.status(400).json({ success: false, message: 'Banlanacak kullanıcı bulunamadı' });
        }

        // Güvenlik kontrolü - admin kullanıcıları koruma
        const protectedUsers = ['VenoX', 'Admin', 'Moderator'];
        const filteredUsers = targetUsers.filter(user => 
            !protectedUsers.includes(user) && 
            user !== adminUser
        );

        if (filteredUsers.length === 0) {
            return res.status(400).json({ success: false, message: 'Banlanabilir kullanıcı bulunamadı' });
        }

        // Kullanıcıları ban listesine ekle
        let bannedCount = 0;
        filteredUsers.forEach(user => {
            if (!bannedUsers.has(user)) {
                bannedUsers.add(user);
                bannedCount++;
                
                // Aktif kullanıcılardan çıkar
                activeUsers.delete(user);
            }
        });

        // Sistem mesajı ekle
        messages.push({
            id: Date.now(),
            username: 'System',
            message: `🔨 Toplu ban uygulandı: "${prefix}" prefix'i ile ${bannedCount} kullanıcı banlandı. (${filteredUsers.join(', ')})`,
            isAdmin: true,
            isSystem: true,
            timestamp: new Date().toISOString(),
        });

        res.json({ 
            success: true, 
            message: `${bannedCount} kullanıcı başarıyla banlandı`,
            bannedUsers: filteredUsers,
            prefix: prefix
        });

        console.log(`Bulk ban executed by ${adminUser}: ${bannedCount} users banned with prefix "${prefix}"`);

    } catch (error) {
        console.error('Bulk ban error:', error);
        res.status(500).json({ success: false, message: 'Toplu ban işlemi başarısız' });
    }
});

// Yeni: Prefix engelleme endpoint'i
app.post('/admin/blocked-prefixes', (req, res) => {
    try {
        const { adminUser, blockedPrefixes: newBlockedPrefixes } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        if (!Array.isArray(newBlockedPrefixes)) {
            return res.status(400).json({ success: false, message: 'Geçersiz prefix listesi' });
        }

        // Güvenlik kontrolü - önemli prefix'leri koruma
        const protectedPrefixes = ['venox', 'admin', 'moderator'];
        const filteredPrefixes = newBlockedPrefixes.filter(prefix => 
            !protectedPrefixes.includes(prefix.toLowerCase())
        );

        // Engellenen prefix'leri güncelle
        blockedPrefixes = new Set(filteredPrefixes);

        // Yeni engellenen prefix'lere sahip aktif kullanıcıları listeden çıkar
        const activeUsersList = Array.from(activeUsers);
        activeUsersList.forEach(user => {
            if (isUsernameBlocked(user)) {
                activeUsers.delete(user);
            }
        });

        res.json({ 
            success: true, 
            message: 'Engellenen prefix listesi güncellendi',
            blockedPrefixes: Array.from(blockedPrefixes)
        });

        console.log(`Blocked prefixes updated by ${adminUser}:`, Array.from(blockedPrefixes));

    } catch (error) {
        console.error('Blocked prefixes error:', error);
        res.status(500).json({ success: false, message: 'Prefix engelleme işlemi başarısız' });
    }
});

app.post('/admin/mute', (req, res) => {
    try {
        const { adminUser, targetUser, duration } = req.body;

        if (adminUser !== 'VenoX') {
            return res.status(403).json({ success: false, message: 'Yetki yok' });
        }

        mutedUsers.add(targetUser);

        messages.push({
            id: Date.now(),
            username: 'System',
            message: `@${targetUser} 5 dakika boyunca susturuldu.`,
            isAdmin: true,
            isSystem: true,
            timestamp: new Date().toISOString(),
        });

        setTimeout(() => {
            mutedUsers.delete(targetUser);
            messages.push({
                id: Date.now(),
                username: 'System',
                message: `@${targetUser} susturması sona erdi.`,
                isAdmin: true,
                isSystem: true,
                timestamp: new Date().toISOString(),
            });
        }, duration);

        res.json({ 
            success: true, 
            message: `${targetUser} 5 dakika boyunca susturuldunuz!`
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
        
        messages.push({
            id: Date.now(),
            username: 'System',
            message: `@${targetUser} susturması kaldırıldı.`,
            isAdmin: true,
            isSystem: true,
            timestamp: new Date().toISOString(),
        });

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

        messages.push({
            id: Date.now(),
            username: 'System',
            message: `@${targetUser} sohbetten yasaklandı.`,
            isAdmin: true,
            isSystem: true,
            timestamp: new Date().toISOString(),
        });

        res.json({ 
            success: true, 
            message: `${targetUser} sohbetten yasaklandınız!` 
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

        messages.push({
            id: Date.now(),
            username: 'System',
            message: `@${targetUser} yasağı kaldırıldı.`,
            isAdmin: true,
            isSystem: true,
            timestamp: new Date().toISOString(),
        });

        res.json({ 
            success: true, 
            message: `${targetUser} yasağı kaldırıldı` 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Unban işlemi başarısız' });
    }
});

app.get('/stats', (req, res) => {
    // Engellenen prefix'lere sahip kullanıcıları filtrele
    const filteredActiveUsers = Array.from(activeUsers).filter(user => !isUsernameBlocked(user));
    const currentActiveUsers = new Set(filteredActiveUsers);
    currentActiveUsers.add('VenoX');

    res.json({
        success: true,
        stats: {
            totalMessages: messages.length,
            activeUsers: currentActiveUsers.size,
            activeUsersList: Array.from(currentActiveUsers),
            bannedUsers: bannedUsers.size,
            mutedUsers: mutedUsers.size,
            blockedPrefixes: blockedPrefixes.size,
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
