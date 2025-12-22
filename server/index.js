const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// 全局配置
const GLOBAL_CONFIG = {
    SERVER_PORT: 3001
};

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 允许所有跨域，生产环境请根据需要配置
        methods: ["GET", "POST"]
    }
});

// 房间数据存储
// 结构: { roomId: { players: [], status: 'waiting'|'playing', ... } }
const rooms = {};

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // 加入房间
    socket.on('join_room', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                players: [],
                status: 'waiting',
                currentTurn: -1,
                landlord: null,
                lastPlayedCards: null,
                lastPlayedPlayerIndex: -1,
                multiplier: 1 // 初始倍数
            };
        }

        const room = rooms[roomId];

        // 检查玩家是否已存在
        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (!existingPlayer) {
            // 限制人数为 3
            if (room.players.length < 3) {
                room.players.push({
                    id: socket.id,
                    username: username,
                    isReady: false,
                    hand: [],
                    role: null // 'landlord' | 'peasant'
                });
            } else {
                socket.emit('error_message', '房间已满');
                return;
            }
        }

        // 广播房间状态
        io.to(roomId).emit('roomUpdate', room);
    });

    // 玩家准备
    socket.on('player_ready', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = true;
        }

        io.to(roomId).emit('roomUpdate', room);

        // 检查是否所有人都准备好了
        const allReady = room.players.length === 3 && room.players.every(p => p.isReady);
        if (allReady) {
            startGame(roomId);
        }
    });

    // 叫地主
    socket.on('call_landlord', ({ roomId, wantLandlord }) => {
        const room = rooms[roomId];
        if (!room) return;

        // 简单逻辑：只要有人叫，就当地主；如果都不叫（这里简化处理，实际可加轮询逻辑）
        // 这里实现为：当前轮到的人决定是否叫地主
        if (wantLandlord) {
            const player = room.players[room.currentTurn];
            player.role = 'landlord';
            room.landlord = player.id;
            
            // 地主获得 3 张底牌
            player.hand.push(...room.hiddenCards);
            player.hand = sortCards(player.hand); // 重新排序

            // 其他人设为农民
            room.players.forEach(p => {
                if (p.id !== player.id) p.role = 'peasant';
            });

            room.status = 'playing'; // 正式开始出牌
            io.to(roomId).emit('gameStart', { 
                landlordId: player.id,
                hiddenCards: room.hiddenCards 
            });
        } else {
            // 不叫，轮下一个人（简化版：如果三个人都不叫，重新发牌或强制第一个人当地主）
            // 这里简化：如果不叫，直接下一个；如果是第三个人还不叫，默认第一个人当地主
            // 实际项目建议完善“抢地主”逻辑
            
            // 简单处理：如果当前是第3个人且不叫，强制第1个人当地主（防止死循环）
            // 或者：直接进入下一个人叫分阶段。这里为了流畅性，暂不处理复杂的抢地主回退逻辑。
            room.currentTurn = (room.currentTurn + 1) % 3;
        }
        
        io.to(roomId).emit('roomUpdate', room);
    });

    // 出牌
    socket.on('play_card', ({ roomId, cards }) => {
        const room = rooms[roomId];
        if (!room) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== room.currentTurn) return; // 不是你的回合

        const player = room.players[playerIndex];

        // 简单的验证：玩家是否有这些牌
        // 实际项目应添加 牌型合法性验证 (isValidPlay)
        const hasCards = cards.every(card => player.hand.some(c => c.rank === card.rank && c.suit === card.suit));
        
        if (hasCards) {
            // 从手牌移除
            cards.forEach(card => {
                const idx = player.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
                if (idx !== -1) player.hand.splice(idx, 1);
            });

            room.lastPlayedCards = cards;
            room.lastPlayedPlayerIndex = playerIndex;
            
            // 检查是否获胜
            if (player.hand.length === 0) {
                checkGameOver(room, roomId); // 触发结算
            } else {
                // 轮到下一个人
                room.currentTurn = (room.currentTurn + 1) % 3;
                io.to(roomId).emit('roomUpdate', room);
            }
        }
    });

    // 不出 (Pass)
    socket.on('pass_turn', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        if (room.lastPlayedPlayerIndex === -1) {
            // 必须出牌，不能过（你是首出者）
            return; 
        }

        // 轮到下一个人
        room.currentTurn = (room.currentTurn + 1) % 3;
        
        // 如果下一个人就是上一次出牌的人（即其他两人都不要），清空上一手牌
        if (room.currentTurn === room.lastPlayedPlayerIndex) {
            room.lastPlayedCards = null;
        }

        io.to(roomId).emit('roomUpdate', room);
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
        // 这里可以添加逻辑：如果游戏中途退出，通过某种方式处理（如托管或解散房间）
        // 简单处理：从所有房间移除
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx !== -1) {
                room.players.splice(idx, 1);
                // 如果房间空了，删除房间
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('roomUpdate', room);
                }
            }
        }
    });
});

// --- 游戏逻辑辅助函数 ---

function startGame(roomId) {
    const room = rooms[roomId];
    const deck = createDeck();
    const shuffled = shuffle(deck);

    // 发牌：留3张底牌，其余每人17张
    const hiddenCards = shuffled.slice(0, 3);
    const playerCards = [
        shuffled.slice(3, 20),
        shuffled.slice(20, 37),
        shuffled.slice(37, 54)
    ];

    room.players.forEach((p, i) => {
        p.hand = sortCards(playerCards[i]);
        p.role = null; // 重置身份
        p.isReady = false; // 游戏开始后重置准备状态
    });

    room.hiddenCards = hiddenCards;
    room.status = 'calling'; // 进入叫地主阶段
    room.currentTurn = Math.floor(Math.random() * 3); // 随机指定第一个叫地主的人
    room.lastPlayedCards = null;
    room.lastPlayedPlayerIndex = -1;
    room.multiplier = 1; // 初始倍数

    io.to(roomId).emit('roomUpdate', room);
}

// 创建一副牌
function createDeck() {
    const suits = ['♠', '♥', '♣', '♦'];
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    const deck = [];

    for (let s of suits) {
        for (let r of ranks) {
            let val = ranks.indexOf(r);
            deck.push({ suit: s, rank: r, value: val });
        }
    }
    // 大小王
    deck.push({ suit: 'Joker', rank: 'Small', value: 13 });
    deck.push({ suit: 'Joker', rank: 'Big', value: 14 });
    return deck;
}

// 洗牌
function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 理牌（从大到小）
function sortCards(hand) {
    return hand.sort((a, b) => b.value - a.value);
}

/**
 * [修改] 优化分数计算逻辑
 * @param {string} winnerId 获胜者ID
 * @param {Array} players 玩家列表
 * @param {number} currentMultiplier 当前倍数
 */
function calculateScore(winnerId, players, currentMultiplier = 1) {
    const winner = players.find(p => p.id === winnerId);
    if (!winner) return {};

    const isLandlordWin = winner.role === 'landlord';
    const baseScore = 100; // 基础分
    const finalScore = baseScore * currentMultiplier;

    const scores = {};

    players.forEach(p => {
        if (p.role === 'landlord') {
            // 地主
            if (isLandlordWin) {
                scores[p.id] = finalScore * 2; // 地主赢，得两份
            } else {
                scores[p.id] = -finalScore * 2; // 地主输，扣两份
            }
        } else {
            // 农民
            if (isLandlordWin) {
                scores[p.id] = -finalScore; // 农民输，扣一份
            } else {
                scores[p.id] = finalScore; // 农民赢，得一份
            }
        }
    });

    return scores;
}

/**
 * [修改] 游戏结束检查与处理
 * 确保先广播结算数据，再重置房间状态
 */
function checkGameOver(room, roomId) {
    const winner = room.players.find(p => p.hand.length === 0);
    if (winner) {
        console.log(`[GAME OVER] Room: ${roomId}, Winner: ${winner.username}`);
        
        // 1. 计算得分
        const scores = calculateScore(winner.id, room.players, room.multiplier || 1);

        // 2. 广播游戏结束 (带上结算数据)
        io.to(roomId).emit('gameOver', {
            winnerId: winner.id,
            winnerRole: winner.role,
            scores: scores,
            players: room.players // 发送最终状态
        });

        // 3. 重置房间数据为等待状态
        room.status = 'waiting';
        room.multiplier = 1;
        room.landlord = null;
        room.currentTurn = -1;
        room.lastPlayedCards = null;
        room.lastPlayedPlayerIndex = -1;
        
        // 4. 重置玩家状态
        room.players.forEach(p => {
            p.isReady = false;
            p.hand = [];
            p.role = null;
        });

        // 5. 广播房间更新 (这会触发前端回到准备界面)
        // 注意：前端需要处理 gameOver 弹窗覆盖在准备界面之上的逻辑
        io.to(roomId).emit('roomUpdate', room);
    }
}

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