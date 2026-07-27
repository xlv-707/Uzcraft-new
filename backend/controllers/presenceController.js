// Online users tracking
const onlineUsers = new Map();

exports.updatePresence = (userId, status) => {
    if (status === 'online') {
        onlineUsers.set(userId, { 
            status, 
            lastSeen: new Date(),
            userId 
        });
    } else if (status === 'offline') {
        onlineUsers.delete(userId);
    }
    return onlineUsers.get(userId);
};

exports.getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
};

exports.isUserOnline = (userId) => {
    return onlineUsers.has(userId);
};

exports.getUserPresence = (userId) => {
    return onlineUsers.get(userId) || { status: 'offline', lastSeen: null };
};

// Cleanup stale connections (every 30 seconds)
setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of onlineUsers) {
        if (now - new Date(data.lastSeen).getTime() > 60000) {
            onlineUsers.delete(userId);
        }
    }
}, 30000);