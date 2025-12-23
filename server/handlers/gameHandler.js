const SeatManager = require('../game/SeatManager');
const GameManager = require('../game/GameManager');

module.exports = (io, socket, rooms) => {

    // 辅助函数：广播游戏状态
    const broadcastGameState = (roomId, room, infoText = null) => {
        if (!room.gameManager) return;
        const publicState = room.gameManager.getPublicState();
        if (!publicState) return;
        if (infoText) publicState.infoText = infoText;
        io.to(roomId).emit('game_state_update', publicState);
    };

    // 辅助函数：开始游戏逻辑
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
        
        broadcastGameState(roomId, room, msg);
    };

    // --- 开始游戏 (含座位抽签) ---
    socket.on('start_game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        // 修正奇数人数问题
        if (room.config.isTeamMode && room.players.length % 2 !== 0) {
            room.config.isTeamMode = false;
            io.to(roomId).emit('error_msg', '人数为奇数，已自动关闭组队模式');
            
            // 简单更新一下配置信息给客户端
            const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
            if (Object.keys(currentGrandScores).length === 0) room.players.forEach(p => currentGrandScores[p.id] = 0);
            io.to(roomId).emit('room_info', { roomId, config: room.config, players: room.players, grandScores: currentGrandScores });
        }

        const isTeamMode = room.config.isTeamMode && (room.players.length % 2 === 0);
        room.seatManager = new SeatManager(io, roomId, room.players, isTeamMode);
        
        io.to(roomId).emit('enter_draw_phase', { totalCards: room.players.length });
        
        // 机器人自动抽卡
        const bots = room.players.filter(p => p.isBot);
        bots.forEach((bot, i) => {
            setTimeout(() => {
                if (!rooms[roomId]) return; 

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
                                    if (!rooms[roomId]) return;
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

    // --- 抽卡动作 ---
    socket.on('draw_seat_card', ({ roomId, cardIndex }) => {
        const room = rooms[roomId];
        if (!room || !room.seatManager) return;

        const result = room.seatManager.playerDraw(socket.id, cardIndex);
        if (!result.success) return socket.emit('error_msg', result.msg);

        const player = room.players.find(p => p.id === socket.id);
        io.to(roomId).emit('seat_draw_update', {
            index: cardIndex,
            val: result.cardVal,
            playerId: socket.id,
            name: player ? player.name : '未知'
        });

        if (result.isFinished) {
            setTimeout(() => {
                if (!rooms[roomId]) return; 

                const { newPlayers, drawDetails } = room.seatManager.finalizeSeats();
                room.players = newPlayers;
                room.seatManager = null; 

                io.to(roomId).emit('seat_draw_finished', {
                    players: newPlayers,
                    details: drawDetails
                });

                setTimeout(() => handleGameStart(roomId, false), 3000);
            }, 1000); 
        }
    });

    // --- 下一局 ---
    socket.on('next_round', ({ roomId }) => handleGameStart(roomId, true));

    // --- 出牌 ---
    socket.on('play_cards', ({ roomId, cards }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;
        
        const result = room.gameManager.playCards(socket.id, cards);

        if (!result.success) return socket.emit('play_error', result.error);

        const currentHand = room.gameManager.gameState.hands[socket.id];
        io.to(socket.id).emit('hand_update', currentHand);

        if (result.isRoundOver) { 
            // 1. 如果有出牌动作（不是直接结束），先广播出牌动画
            if (result.cardsPlayed && result.cardsPlayed.length > 0) {
                 broadcastGameState(roomId, room, result.logText);
            }

            // 2. 延迟 3秒 后触发结算
            setTimeout(() => {
                // 双重检查防止房间被销毁
                if (!rooms[roomId]) return;
                
                // [核心修复] 
                // 不再手动 emit round_over，而是调用 GameManager._handleWin 
                // 这样能确保与 Bot 获胜时的逻辑完全一致，包含 scoreBreakdown 和 matchHistory
                room.gameManager._handleWin(result, socket.id);

                // 如果是大局结束，清理 GameManager 引用
                if (result.roundResult.isGrandOver) {
                    room.gameManager = null; 
                }
            }, 3000); 
        } else {
            broadcastGameState(roomId, room, result.logText);
        }
    });

    // --- 过牌 ---
    socket.on('pass_turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        const result = room.gameManager.passTurn(socket.id);
        if (!result.success) return socket.emit('play_error', result.error);

        // 如果过牌导致游戏结束 (如最后一手都没人要)
        if (result.isRoundOver) {
            broadcastGameState(roomId, room, result.logText);
            
            setTimeout(() => {
                if (!rooms[roomId]) return;
                
                // [核心修复] 同样调用 _handleWin 统一结算逻辑
                room.gameManager._handleWin(result, socket.id);
                
                // 这里的 result.roundResult 依然包含 isGrandOver 等信息
                if (result.roundResult && result.roundResult.isGrandOver) {
                    room.gameManager = null;
                }
            }, 3000);
        } else {
            broadcastGameState(roomId, room, result.logText || "PASS");
        }
    });

    // --- 切换托管 ---
    socket.on('toggle_auto_play', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.toggleAutoPlay(socket.id);
        broadcastGameState(roomId, room);
    });

    // --- 请求提示 ---
    socket.on('request_hint', ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.gameManager) {
            const cards = room.gameManager.getHint(socket.id);
            socket.emit('hint_response', cards);
        }
    });
};