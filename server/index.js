const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// [修复] 引入配置文件和逻辑处理器
const { PERMANENT_ROOMS, GLOBAL_CONFIG } = require('./config/constants');
const registerRoomHandlers = require('./handlers/roomHandler');
const registerGameHandlers = require('./handlers/gameHandler');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// 全局房间数据存储
const rooms = {};

// [修复] 初始化常驻房间 (根据 constants.js 配置)
if (PERMANENT_ROOMS) {
    Object.entries(PERMANENT_ROOMS).forEach(([id, config]) => {
        rooms[id] = {
            config: config,
            players: [],
            gameManager: null,
            seatManager: null,
            isPermanent: true
        };
        console.log(`[Init] Permanent room ${id} created.`);
    });
}

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);
    registerRoomHandlers(io, socket, rooms);
    registerGameHandlers(io, socket, rooms);

    // 断开连接处理
    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
        
        // 遍历房间，标记玩家离线
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.id === socket.id);
            
            if (player) {
                player.online = false;
                // 如果在游戏中，可能需要通知其他人 (gameHandler 中通常会有更细致的处理，这里仅做基础标记)
                // 广播房间最新信息，让前端看到灰头像
                const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
                if (Object.keys(currentGrandScores).length === 0 && room.players.length > 0) {
                     room.players.forEach(p => currentGrandScores[p.id] = (room.gameManager?.grandScores?.[p.id] || 0));
                }

                io.to(roomId).emit('room_info', { 
                    roomId, 
                    config: room.config, 
                    players: room.players, 
                    grandScores: currentGrandScores 
                });
                
                // 如果是临时房间且空了，可以在这里加清理逻辑（目前为了断线重连保留房间）
            }
        }
    });
});

// 错误处理
process.on('uncaughtException', (err) => {
    console.error('[FATAL ERROR] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

// 生产环境静态文件服务
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/dist');
    app.use(express.static(buildPath));
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
    });
}

const PORT = process.env.PORT || GLOBAL_CONFIG.SERVER_PORT || 3001;
server.listen(PORT, () => {
    console.log(`>>> Server Running on port ${PORT}`);
});