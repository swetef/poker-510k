// (原 server.js) 程序入口，只负责启动服务和 Socket 监听
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// 引入模块
const CardRules = require('./game/CardRules');
const Deck = require('./game/Deck');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {}; 

function broadcastGameState(io, roomId, room, infoText = null) {
    const game = room.game;
    if (!game) return;
    const players = room.players;
    
    const currentScoresDisplay = {};
    players.forEach(p => {
        currentScoresDisplay[p.id] = (room.grandScores[p.id] || 0) + (game.roundPoints[p.id] || 0);
    });

    io.to(roomId).emit('game_state_update', {
        turnIndex: game.currentTurnIndex,
        currentTurnId: players[game.currentTurnIndex].id,
        lastPlayed: game.lastPlayedCards,
        lastPlayerName: players.find(p => p.id === game.roundWinnerId)?.name || '',
        infoText: infoText,
        scores: currentScoresDisplay,
        pendingPoints: game.pendingTablePoints
    });
}

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);
    socket.emit('your_id', socket.id);

    // --- 创建房间 ---
    socket.on('create_room', ({ roomId, username, config }) => {
        if (rooms[roomId]) return socket.emit('error_msg', '房间已存在');
        
        const roomConfig = { deckCount: 1, maxPlayers: 3, targetScore: 500, ...config };
        
        rooms[roomId] = {
            config: roomConfig,
            players: [],
            grandScores: {}, 
            lastWinnerId: null, // 新增：记录上一局赢家
            game: null
        };
        
        socket.join(roomId);
        rooms[roomId].players.push({ id: socket.id, name: username, isHost: true });
        rooms[roomId].grandScores[socket.id] = 0;

        const data = { roomId, config: roomConfig, players: rooms[roomId].players, grandScores: rooms[roomId].grandScores };
        socket.emit('room_info', data); 
        io.to(roomId).emit('room_info', data);
    });

    // --- 加入房间 ---
    socket.on('join_room', ({ roomId, username }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit('error_msg', '房间不存在');
        if (room.players.length >= room.config.maxPlayers) return socket.emit('error_msg', '房间已满');

        socket.join(roomId);
        if (!room.players.find(u=>u.id===socket.id)) {
            room.players.push({ id: socket.id, name: username, isHost: false });
            if (room.grandScores[socket.id] === undefined) room.grandScores[socket.id] = 0;
        }
        
        const data = { roomId, config: room.config, players: room.players, grandScores: room.grandScores };
        socket.emit('room_info', data);
        io.to(roomId).emit('room_info', data);
    });

    // --- 游戏流程控制 ---
    const startGameLogic = (roomId, isNextRound = false) => {
        const room = rooms[roomId];
        if (!room) return;

        // 如果是全新开始，重置大分和赢家记录
        if (!isNextRound) {
            room.players.forEach(p => room.grandScores[p.id] = 0);
            room.lastWinnerId = null;
        }

        const deck = new Deck(room.config.deckCount);
        const hands = deck.deal(room.players.length);

        // 确定谁先出牌：如果有上一局赢家，他先出；否则房主(0)先出
        let startIndex = 0;
        if (room.lastWinnerId) {
            const winnerIdx = room.players.findIndex(p => p.id === room.lastWinnerId);
            if (winnerIdx !== -1) startIndex = winnerIdx;
        }

        room.game = {
            hands: {}, 
            currentTurnIndex: startIndex, // 设定初始出牌人
            lastPlayedCards: [], 
            consecutivePasses: 0, 
            winner: null,
            roundPoints: {},      
            pendingTablePoints: 0,
            roundWinnerId: null,  
        };

        room.players.forEach((p, index) => {
            room.game.hands[p.id] = hands[index];
            room.game.roundPoints[p.id] = 0;
            io.to(p.id).emit('game_started', { hand: hands[index], grandScores: room.grandScores });
        });

        const startPlayerName = room.players[startIndex].name;
        broadcastGameState(io, roomId, room, isNextRound ? `新一轮开始！由 ${startPlayerName} 先出` : `游戏开始！目标 ${room.config.targetScore} 分`);
    };

    socket.on('start_game', ({ roomId }) => startGameLogic(roomId, false));
    socket.on('next_round', ({ roomId }) => startGameLogic(roomId, true));

    // --- 出牌 ---
    socket.on('play_cards', ({ roomId, cards }) => {
        const room = rooms[roomId];
        if (!room || !room.game) return;
        const gameState = room.game;
        
        const isNewRound = gameState.lastPlayedCards.length === 0 || gameState.consecutivePasses >= room.players.length - 1;
        const cardsToBeat = isNewRound ? [] : gameState.lastPlayedCards;
        
        if (!CardRules.canPlay(cards, cardsToBeat, room.config.deckCount)) {
            return socket.emit('play_error', '管不上！');
        }

        const playerHand = gameState.hands[socket.id];
        let newHand = [...playerHand];
        for (let c of cards) {
            const idx = newHand.indexOf(c);
            if (idx !== -1) newHand.splice(idx, 1);
        }
        gameState.hands[socket.id] = newHand;
        
        gameState.pendingTablePoints += CardRules.calculateTotalScore(cards);
        
        gameState.lastPlayedCards = cards;
        gameState.consecutivePasses = 0;
        gameState.roundWinnerId = socket.id;

        const currIdx = room.players.findIndex(p => p.id === socket.id);
        gameState.currentTurnIndex = (currIdx + 1) % room.players.length;

        // 判定小局结束
        if (newHand.length === 0) {
            const winnerId = socket.id;
            const winnerName = room.players[currIdx].name;
            
            // 记录本局赢家，用于下一局先手
            room.lastWinnerId = winnerId;

            let totalRoundScore = gameState.pendingTablePoints; 
            
            let penaltyLog = "";
            room.players.forEach(p => {
                if (p.id !== winnerId) {
                    const handPts = CardRules.calculateTotalScore(gameState.hands[p.id]);
                    if (handPts > 0) {
                        totalRoundScore += handPts;
                        penaltyLog += `${p.name}剩${handPts}分 `;
                    }
                }
            });

            totalRoundScore += (gameState.roundPoints[winnerId] || 0);
            room.grandScores[winnerId] += totalRoundScore;

            if (room.grandScores[winnerId] >= room.config.targetScore) {
                io.to(roomId).emit('grand_game_over', { grandWinner: winnerName, grandScores: room.grandScores });
                room.game = null;
            } else {
                io.to(roomId).emit('round_over', {
                    roundWinner: winnerName,
                    pointsEarned: totalRoundScore,
                    detail: penaltyLog ? `罚分: ${penaltyLog}` : '无罚分',
                    grandScores: room.grandScores
                });
            }
        } else {
            broadcastGameState(io, roomId, room);
            io.to(socket.id).emit('hand_update', newHand);
        }
    });

    // --- 过牌 ---
    socket.on('pass_turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.game) return;
        const gameState = room.game;
        
        if (gameState.lastPlayedCards.length === 0 || gameState.consecutivePasses >= room.players.length - 1) {
            return socket.emit('play_error', '必须出牌');
        }

        gameState.consecutivePasses++;
        const currIdx = room.players.findIndex(p => p.id === socket.id);
        gameState.currentTurnIndex = (currIdx + 1) % room.players.length;

        if (gameState.consecutivePasses >= room.players.length - 1) {
            const wId = gameState.roundWinnerId;
            if (wId) {
                gameState.roundPoints[wId] = (gameState.roundPoints[wId] || 0) + gameState.pendingTablePoints;
                gameState.pendingTablePoints = 0;
            }
            gameState.lastPlayedCards = [];
            gameState.currentTurnIndex = room.players.findIndex(p => p.id === wId);
        }

        broadcastGameState(io, roomId, room, "PASS");
    });

    socket.on('disconnect', () => {
        for (const rId in rooms) {
            const r = rooms[rId];
            if (!r.game) {
                const idx = r.players.findIndex(p => p.id === socket.id);
                if (idx !== -1) {
                    r.players.splice(idx, 1);
                    io.to(rId).emit('room_info', { roomId: rId, config: r.config, players: r.players, grandScores: r.grandScores });
                }
            }
        }
    });
});
const path = require('path');

// --- 生产环境部署配置 (关键代码) ---
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



