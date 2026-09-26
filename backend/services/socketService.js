const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { corsOrigin } = require('../config/cors');

let io;

const init = (server) => {
    io = new Server(server, {
        cors: {
            origin: corsOrigin,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.userId;
        console.log(`User connected: ${userId} (Socket: ${socket.id})`);

        // Join a private room for this user
        socket.join(`user_${userId}`);

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${userId}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user_${userId}`).emit(event, data);
    }
};

const emitToGroup = (groupId, members, event, data) => {
    if (io && members && Array.isArray(members)) {
        members.forEach(memberId => {
            io.to(`user_${memberId}`).emit(event, data);
        });
    }
};

module.exports = {
    init,
    getIO,
    emitToUser,
    emitToGroup
};
