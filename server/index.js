// 程序入口，负责启动服务、Socket 监听、常驻房间管理
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// 引入模块
const registerRoomHandlers = require('./handlers/roomHandler');
const registerGameHandlers = require('./handlers/gameHandler');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 内存数据库
const rooms = {}; 

// --- 常驻房间配置定义 ---
const PERMANENT_ROOMS = {
    '888': { 
        deckCount: 2, 
        maxPlayers: 4, 
        targetScore: 1000,
        turnTimeout: 60000,
        showCardCountMode: 1,
        isTeamMode: false,
        enableRankPenalty: false,
        rankPenaltyScores: [50, 20],
        shuffleStrategy: 'CLASSIC'
    },
    '666': { 
        deckCount: 3, 
        maxPlayers: 6, 
        targetScore: 1000,
        turnTimeout: 60000,
        showCardCountMode: 1,
        isTeamMode: true, 
        enableRankPenalty: false,
        rankPenaltyScores: [50, 20],
        shuffleStrategy: 'NO_SHUFFLE'
    }
};

/**
 * 辅助函数：初始化/重置常驻房间
 */
function initPermanentRoom(roomId) {
    const defaultConfig = PERMANENT_ROOMS[roomId];
    if (!defaultConfig) return;

    if (!rooms[roomId]) {
        rooms[roomId] = {
            config: JSON.parse(JSON.stringify(defaultConfig)),
            players: [],
            gameManager: null,
            seatManager: null, 
            destroyTimer: null,
            isPermanent: true
        };
        console.log(`[System] Permanent Room ${roomId} initialized.`);
    } else {
        rooms[roomId].config = JSON.parse(JSON.stringify(defaultConfig));
        rooms[roomId].gameManager = null;
        rooms[roomId].seatManager = null;
        console.log(`[System] Permanent Room ${roomId} reset to default.`);
    }
}

// 启动时初始化常驻房间
Object.keys(PERMANENT_ROOMS).forEach(rId => initPermanentRoom(rId));

// --- 辅助：广播房间基础信息 (用于断开连接时的广播) ---
function broadcastRoomInfo(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    
    const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
    if (Object.keys(currentGrandScores).length === 0) {
        room.players.forEach(p => currentGrandScores[p.id] = 0);
    }

    const data = { 
        roomId, 
        config: room.config, 
        players: room.players, 
        grandScores: currentGrandScores 
    };
    io.to(roomId).emit('room_info', data);
}

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);
    socket.emit('your_id', socket.id);

    // [核心修改] 注册拆分后的 Handler
    // 传入 io, socket 和全局 rooms 对象
    registerRoomHandlers(io, socket, rooms);
    registerGameHandlers(io, socket, rooms);

    // 断开连接处理 (Disconnect logic)
    // 这里的逻辑比较复杂且涉及全局清理，保留在 index.js 比较安全，也便于全局管理
    socket.on('disconnect', () => {
        Object.keys(rooms).forEach(rId => {
            const r = rooms[rId];
            
            const idx = r.players.findIndex(p => p.id === socket.id);
            if (idx === -1) return; 

            const player = r.players[idx];
            
            // 逻辑分支：如果在大厅阶段
            if (!r.gameManager && !r.seatManager) {
                r.players.splice(idx, 1);
                console.log(`[Disconnect] Lobby user ${player.name} removed from ${rId}`);
                
                // 处理房主移交逻辑
                if (player.isHost && r.players.length > 0) {
                    const nextHost = r.players.find(p => !p.isBot) || r.players[0];
                    if (nextHost) nextHost.isHost = true;
                }
                
                if (r.players.length === 0) {
                    if (r.isPermanent) {
                        initPermanentRoom(rId); // 重置
                    } else {
                        if (r.destroyTimer) clearTimeout(r.destroyTimer);
                        delete rooms[rId];
                        console.log(`[Room] Room ${rId} deleted (empty lobby).`);
                    }
                } else {
                    broadcastRoomInfo(rId);
                }
            } else {
                // 游戏中掉线
                player.online = false;
                console.log(`[Disconnect] Game user ${player.name} (${socket.id}) dropped.`);

                const allHumansOffline = r.players.filter(p => !p.isBot).every(p => !p.online);
                
                if (allHumansOffline) {
                    if (r.destroyTimer) clearTimeout(r.destroyTimer);
                    r.destroyTimer = setTimeout(() => {
                        const currentRoom = rooms[rId];
                        if (currentRoom && currentRoom.players.filter(p => !p.isBot).every(p => !p.online)) {
                            if (currentRoom.isPermanent) {
                                initPermanentRoom(rId); // 重置
                            } else {
                                delete rooms[rId]; // 销毁
                                console.log(`[Room] Room ${rId} destroyed due to inactivity.`);
                            }
                        }
                    }, 60000); 
                }
            }
        });
    });
});

if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/dist');
    app.use(express.static(buildPath));
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
    });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`>>> Server Running on port ${PORT}`);
});
