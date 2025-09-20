// server.js içine eklenecek yeni endpoint (mevcut endpoints'lerin yanına)

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
