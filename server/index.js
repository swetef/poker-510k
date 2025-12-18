// 程序入口，只负责启动服务和 Socket 监听
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// 引入模块
const GameManager = require('./game/GameManager');
const SeatManager = require('./game/SeatManager'); 

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 内存数据库
const rooms = {}; 

/**
 * 辅助函数：向房间内所有人广播最新状态
 */
function broadcastGameState(io, roomId, room, infoText = null) {
    if (!room.gameManager) return;
    
    const publicState = room.gameManager.getPublicState();
    if (!publicState) return;

    if (infoText) publicState.infoText = infoText;

    io.to(roomId).emit('game_state_update', publicState);
}

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);
    socket.emit('your_id', socket.id);

    // --- 创建房间 ---
    socket.on('create_room', ({ roomId, username, config }) => {
        if (rooms[roomId]) return socket.emit('error_msg', '房间已存在');
        
        const cleanName = String(username || '').trim();
        if (!cleanName) return socket.emit('error_msg', '用户名不能为空');

        const roomConfig = { 
            deckCount: 1, 
            maxPlayers: 3, 
            targetScore: 500, 
            ...config 
        };
        
        rooms[roomId] = {
            config: roomConfig,
            players: [],
            gameManager: null,
            seatManager: null, 
            destroyTimer: null 
        };
        
        socket.join(roomId);
        rooms[roomId].players.push({ id: socket.id, name: cleanName, isHost: true, online: true });
        
        const initialScores = {};
        rooms[roomId].players.forEach(p => initialScores[p.id] = 0);

        const data = { roomId, config: roomConfig, players: rooms[roomId].players, grandScores: initialScores };
        socket.emit('room_info', data); 
        io.to(roomId).emit('room_info', data);
    });

    // --- 加入房间 ---
    socket.on('join_room', ({ roomId, username }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit('error_msg', '房间不存在');

        const cleanName = String(username || '').trim();
        if (!cleanName) return socket.emit('error_msg', '用户名不能为空');

        const existingPlayerIndex = room.players.findIndex(p => p.name === cleanName);
        let isReconnect = false;
        let oldSocketId = null;

        if (existingPlayerIndex !== -1) {
            const existingPlayer = room.players[existingPlayerIndex];
            
            if (existingPlayer.online) {
                return socket.emit('error_msg', `名字 "${cleanName}" 已被使用且玩家在线`);
            }

            isReconnect = true;
            oldSocketId = existingPlayer.id;
            console.log(`[Reconnect] Success! ${cleanName} (${oldSocketId} -> ${socket.id})`);

            existingPlayer.id = socket.id;
            existingPlayer.online = true; 

            if (room.destroyTimer) {
                clearTimeout(room.destroyTimer);
                room.destroyTimer = null;
                console.log(`[Room] Destruction cancelled for ${roomId} (player returned)`);
            }

            if (room.gameManager) {
                room.gameManager.reconnectPlayer(oldSocketId, socket.id);
            }

            // [核心修复] 如果正在抽签，也要通知 SeatManager 更新 ID
            if (room.seatManager) {
                room.seatManager.reconnectPlayer(oldSocketId, socket.id);
            }

        } else {
            if (room.players.length >= room.config.maxPlayers) {
                return socket.emit('error_msg', '房间已满');
            }
            
            socket.join(roomId);
            if (!room.players.find(u => u.id === socket.id)) {
                room.players.push({ id: socket.id, name: cleanName, isHost: false, online: true });
            }
        }

        socket.join(roomId);
        
        let currentGrandScores = {};
        if (room.gameManager) {
            currentGrandScores = room.gameManager.grandScores;
        } else {
            room.players.forEach(p => currentGrandScores[p.id] = 0);
        }
        
        const data = { roomId, config: room.config, players: room.players, grandScores: currentGrandScores };
        
        socket.emit('room_info', data);

        const isGameRunning = room.gameManager && room.gameManager.gameState;
        if (!isGameRunning) {
            socket.to(roomId).emit('room_info', data);
        }

        if (isGameRunning) {
            if (isReconnect) {
                const hand = room.gameManager.getPlayerHand(socket.id);
                socket.emit('game_started', { 
                    hand: hand, 
                    grandScores: room.gameManager.grandScores 
                });
            }
            broadcastGameState(io, roomId, room);
        }
        
        // [新增] 如果重连时正好在抽卡阶段，要把当前的抽卡状态发给重连者
        if (room.seatManager && room.seatManager.drawResults) {
             socket.emit('enter_draw_phase', { totalCards: room.players.length });
             // 补发历史记录
             Object.entries(room.seatManager.drawResults).forEach(([pid, val]) => {
                 const pName = room.players.find(p=>p.id===pid)?.name || '未知';
                 // 反查 index
                 let cardIndex = -1;
                 room.seatManager.availableCards.forEach((c, idx) => {
                     if (c === val) cardIndex = idx;
                 });
                 
                 socket.emit('seat_draw_update', {
                    index: cardIndex,
                    val: val,
                    playerId: pid,
                    name: pName
                });
             });
        }
    });
    
    // 添加机器人
    socket.on('add_bot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        if (room.players.length >= room.config.maxPlayers) return socket.emit('error_msg', '房间已满');
        
        const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const botName = `Robot ${Math.floor(Math.random()*100)}`;
        
        room.players.push({ 
            id: botId, 
            name: botName, 
            isHost: false, 
            online: true,
            isBot: true 
        });
        
        const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
        currentGrandScores[botId] = 0;

        const data = { roomId, config: room.config, players: room.players, grandScores: currentGrandScores };
        io.to(roomId).emit('room_info', data);
    });

    // 切换托管
    socket.on('toggle_auto_play', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.toggleAutoPlay(socket.id);
        broadcastGameState(io, roomId, room);
    });

    // 座位调整
    socket.on('switch_seat', ({ roomId, index1, index2 }) => {
        const room = rooms[roomId];
        if (!room) return;

        const requestPlayer = room.players.find(p => p.id === socket.id);
        if (!requestPlayer || !requestPlayer.isHost) {
            return socket.emit('error_msg', '只有房主可以调整座位');
        }

        if (index1 < 0 || index1 >= room.players.length || index2 < 0 || index2 >= room.players.length) {
            return;
        }

        if (room.gameManager && room.gameManager.gameState) {
             return socket.emit('error_msg', '游戏中无法调整座位');
        }

        const temp = room.players[index1];
        room.players[index1] = room.players[index2];
        room.players[index2] = temp;

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
    });

    // 抽卡交互逻辑
    socket.on('draw_seat_card', ({ roomId, cardIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.seatManager) return;

        const result = room.seatManager.playerDraw(socket.id, cardIndex);
        if (!result.success) {
            return socket.emit('error_msg', result.msg);
        }

        const player = room.players.find(p => p.id === socket.id);
        io.to(roomId).emit('seat_draw_update', {
            index: cardIndex,
            val: result.cardVal,
            playerId: socket.id,
            name: player ? player.name : '未知'
        });

        if (result.isFinished) {
            setTimeout(() => {
                const { newPlayers, drawDetails } = room.seatManager.finalizeSeats();
                
                room.players = newPlayers;
                room.seatManager = null; 

                io.to(roomId).emit('seat_draw_finished', {
                    players: newPlayers,
                    details: drawDetails
                });

                setTimeout(() => {
                    handleGameStart(roomId, false);
                }, 3000);

            }, 1000); 
        }
    });

    // 游戏流程
    const handleGameStart = (roomId, isNextRound) => {
        const room = rooms[roomId];
        if (!room) return;

        if (!isNextRound || !room.gameManager) {
            room.gameManager = new GameManager(room.config, room.players, io, roomId);
        }

        const startInfo = room.gameManager.startRound(isNextRound);

        room.players.forEach((p) => {
            if (!p.isBot) { 
                const hand = startInfo.hands[p.id];
                io.to(p.id).emit('game_started', { 
                    hand: hand, 
                    grandScores: room.gameManager.grandScores,
                    handCounts: room.gameManager.getPublicState().handCounts
                });
            }
        });

        const startPlayerName = room.players[startInfo.startPlayerIndex].name;
        const msg = isNextRound 
            ? `新一轮开始！由 ${startPlayerName} 先出` 
            : `游戏开始！目标 ${room.config.targetScore} 分`;
        
        broadcastGameState(io, roomId, room, msg);
    };

    socket.on('start_game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        const isTeamMode = room.config.isTeamMode && (room.players.length % 2 === 0);
        
        room.seatManager = new SeatManager(io, roomId, room.players, isTeamMode);
        
        io.to(roomId).emit('enter_draw_phase', {
            totalCards: room.players.length
        });
        
        const bots = room.players.filter(p => p.isBot);
        bots.forEach((bot, i) => {
            setTimeout(() => {
                if(room.seatManager) {
                    const availableIdx = room.seatManager.pendingIndices[0];
                    if (availableIdx !== undefined) {
                        const res = room.seatManager.playerDraw(bot.id, availableIdx);
                        if(res.success) {
                            io.to(roomId).emit('seat_draw_update', {
                                index: res.cardIndex,
                                val: res.cardVal,
                                playerId: bot.id,
                                name: bot.name
                            });
                            if (res.isFinished) {
                                setTimeout(() => {
                                    const { newPlayers } = room.seatManager.finalizeSeats();
                                    room.players = newPlayers;
                                    room.seatManager = null;
                                    io.to(roomId).emit('seat_draw_finished', { players: newPlayers });
                                    setTimeout(() => handleGameStart(roomId, false), 3000);
                                }, 1000);
                            }
                        }
                    }
                }
            }, 1000 + i * 1500); 
        });
    });

    socket.on('next_round', ({ roomId }) => handleGameStart(roomId, true));

    socket.on('play_cards', ({ roomId, cards }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;
        
        const result = room.gameManager.playCards(socket.id, cards);

        if (!result.success) {
            return socket.emit('play_error', result.error);
        }

        const currentHand = room.gameManager.gameState.hands[socket.id];
        io.to(socket.id).emit('hand_update', currentHand);

        if (result.isRoundOver) { 
            const rInfo = result.roundResult;
            if (rInfo.isGrandOver) {
                io.to(roomId).emit('grand_game_over', { 
                    grandWinner: rInfo.roundWinnerName, 
                    grandScores: rInfo.grandScores 
                });
                room.gameManager = null; 
            } else {
                io.to(roomId).emit('round_over', {
                    roundWinner: rInfo.roundWinnerName,
                    pointsEarned: rInfo.pointsEarned,
                    detail: rInfo.detail,
                    grandScores: rInfo.grandScores
                });
            }
        } else {
            broadcastGameState(io, roomId, room, result.logText);
        }
    });

    socket.on('pass_turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        const result = room.gameManager.passTurn(socket.id);
        
        if (!result.success) return socket.emit('play_error', result.error);

        broadcastGameState(io, roomId, room, result.logText || "PASS");
    });

    socket.on('disconnect', () => {
        Object.keys(rooms).forEach(rId => {
            const r = rooms[rId];
            
            const idx = r.players.findIndex(p => p.id === socket.id);
            if (idx === -1) return; 

            const player = r.players[idx];
            if (!r.gameManager && !r.seatManager) {
                r.players.splice(idx, 1);
                console.log(`[Disconnect] Lobby user ${player.name} removed from ${rId}`);
                
                if (r.players.length === 0) {
                    if (r.destroyTimer) clearTimeout(r.destroyTimer);
                    delete rooms[rId];
                    console.log(`[Room] Room ${rId} deleted (empty lobby).`);
                } else {
                    io.to(rId).emit('room_info', { 
                        roomId: rId, 
                        config: r.config, 
                        players: r.players, 
                        grandScores: r.gameManager ? r.gameManager.grandScores : {} 
                    });
                }
            } else {
                player.online = false;
                console.log(`[Disconnect] Game user ${player.name} (${socket.id}) dropped.`);

                const allHumansOffline = r.players.filter(p => !p.isBot).every(p => !p.online);
                
                if (allHumansOffline) {
                    if (r.destroyTimer) clearTimeout(r.destroyTimer);
                    r.destroyTimer = setTimeout(() => {
                        if (rooms[rId] && rooms[rId].players.filter(p => !p.isBot).every(p => !p.online)) {
                            delete rooms[rId];
                            console.log(`[Room] Room ${rId} destroyed due to inactivity.`);
                        }
                    }, 60000); 
                }
            }
        });
    });
});

// 这一段的意思是：如果是在线上环境，就把 React 打包好的文件(build)发给浏览器
if (process.env.NODE_ENV === 'production') {
    // 1. 指定静态文件目录
    const buildPath = path.join(__dirname, '../client/dist');
    app.use(express.static(buildPath));
    // 2. 任何其他请求，都返回 index.html
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
    });
}

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`>>> Server Running on port ${PORT}`);
});