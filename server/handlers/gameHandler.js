const SeatManager = require('../game/SeatManager');
const GameManager = require('../game/GameManager');

module.exports = (io, socket, rooms) => {

    // 广播游戏状态（公共视角）
    const broadcastGameState = (roomId, room, infoText = null) => {
        if (!room.gameManager) return;
        const publicState = room.gameManager.getPublicState();
        if (!publicState) return;
        if (infoText) publicState.infoText = infoText;
        io.to(roomId).emit('game_state_update', publicState);
    };

    // 广播房间信息（玩家列表、总分等）
    const broadcastRoomInfo = (roomId, room) => {
        const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
        // 如果没有分数记录，初始化为0
        if (Object.keys(currentGrandScores).length === 0) {
            room.players.forEach(p => {
                if (currentGrandScores[p.id] === undefined) currentGrandScores[p.id] = 0;
            });
        }
        
        const spectatorCount = room.spectators ? room.spectators.length : 0;

        io.to(roomId).emit('room_info', { 
            roomId, 
            config: room.config, 
            players: room.players, 
            grandScores: currentGrandScores,
            spectatorCount
        });
    };

    // 处理游戏开始（包括第一局和后续轮次）
    const handleGameStart = (roomId, isNextRound) => {
        const room = rooms[roomId];
        if (!room) return;

        // 如果是新的一轮且已有 GameManager，重用它；否则创建新的
        if (!isNextRound || !room.gameManager) {
            room.gameManager = new GameManager(room.config, room.players, io, roomId);
        }

        const startInfo = room.gameManager.startRound(isNextRound);

        // 给每个玩家发送手牌
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

        // 给观战者发送信息
        if (room.spectators) {
            room.spectators.forEach(s => {
                io.to(s.id).emit('game_started', {
                    hand: [], // 观战者没有手牌
                    startPlayerId: startInfo.startPlayerId,
                    grandScores: room.gameManager.grandScores,
                    handCounts: room.gameManager.getPublicState().handCounts,
                    isSpectator: true
                });
            });
        }

        const startPlayerName = room.players[startInfo.startPlayerIndex].name;
        const msg = isNextRound 
            ? `新一轮开始！由 ${startPlayerName} 先出` 
            : `游戏开始！目标 ${room.config.targetScore} 分`;
        
        broadcastGameState(roomId, room, msg);
    };

    // --- Socket 事件监听 ---

    // 开始游戏请求（房主触发）
    socket.on('start_game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return socket.emit('error_msg', '只有房主可以开始游戏');
        if (room.players.length < 2) return socket.emit('error_msg', '人数不足');

        // 清理旧的游戏管理器
        if (room.gameManager) {
            if (room.gameManager.dispose) room.gameManager.dispose();
            if (room.gameManager._clearTimer) room.gameManager._clearTimer();
            room.gameManager = null;
        }
        
        // 检查组队模式人数
        if (room.config.isTeamMode && room.players.length % 2 !== 0) {
            room.config.isTeamMode = false;
            io.to(roomId).emit('error_msg', '人数为奇数，已自动关闭组队模式');
            broadcastRoomInfo(roomId, room);
        }

        const isTeamMode = room.config.isTeamMode && (room.players.length % 2 === 0);
        
        // 进入抽座次阶段
        room.seatManager = new SeatManager(io, roomId, room.players, isTeamMode);
        io.to(roomId).emit('enter_draw_phase', { totalCards: room.players.length });
        
        // 处理机器人的抽牌逻辑
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
                            // 如果抽牌结束
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

    // 玩家抽取座位牌
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

    // 下一轮
    socket.on('next_round', ({ roomId }) => handleGameStart(roomId, true));

    // 玩家准备
    socket.on('player_ready', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;
        
        room.gameManager.handlePlayerReady(socket.id);
    });

    // 出牌
    socket.on('play_cards', ({ roomId, cards }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;
        
        const result = room.gameManager.playCards(socket.id, cards);

        if (!result.success) return socket.emit('play_error', result.error);

        // 更新出牌玩家的手牌
        const currentHand = room.gameManager.gameState.hands[socket.id];
        io.to(socket.id).emit('hand_update', currentHand);

        if (result.isRoundOver) { 
            if (result.cardsPlayed && result.cardsPlayed.length > 0) {
                 broadcastGameState(roomId, room, result.logText);
            }

            // 延迟结算，让玩家看清最后出的牌
            setTimeout(() => {
                if (!rooms[roomId]) return;
                if (room.gameManager && !room.gameManager.disposed) {
                    room.gameManager._handleWin(result, socket.id);
                    // 如果大局没结束，更新一下状态
                    if (!result.roundResult.isGrandOver) {
                        broadcastGameState(roomId, room);
                    }
                }
            }, 3000); 
        } else {
            broadcastGameState(roomId, room, result.logText);
        }
    });

    // 不要/过牌
    socket.on('pass_turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        const result = room.gameManager.passTurn(socket.id);
        if (!result.success) return socket.emit('play_error', result.error);

        if (result.isRoundOver) {
            broadcastGameState(roomId, room, result.logText);
            
            setTimeout(() => {
                if (!rooms[roomId]) return;
                if (room.gameManager && !room.gameManager.disposed) {
                    room.gameManager._handleWin(result, socket.id);
                    if (!result.roundResult || !result.roundResult.isGrandOver) {
                        broadcastGameState(roomId, room);
                    }
                }
            }, 3000);
        } else {
            broadcastGameState(roomId, room, result.logText || "PASS");
        }
    });

    // 托管开关
    socket.on('toggle_auto_play', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.toggleAutoPlay(socket.id);
        broadcastGameState(roomId, room);
    });

    // 切换托管模式
    socket.on('switch_autoplay_mode', ({ roomId, mode }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.setPlayerAutoPlayMode(socket.id, mode);
        broadcastGameState(roomId, room);
    });

    // 请求提示
    socket.on('request_hint', ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.gameManager) {
            // 提示逻辑主要在前端，这里服务端可能只需记录日志或辅助验证
            // 目前主要逻辑由前端 SmartHint 完成
        }
    });

    // [新增] 快捷消息转发
    socket.on('send_chat', ({ roomId, message }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        // 简单验证玩家是否在房间内
        const isPlayer = room.players.some(p => p.id === socket.id);
        const isSpectator = room.spectators && room.spectators.some(s => s.id === socket.id);

        if (!isPlayer && !isSpectator) return;

        // 广播给房间所有人（包括自己，方便统一处理回显）
        io.to(roomId).emit('chat_broadcast', {
            senderId: socket.id,
            message: message,
            timestamp: Date.now()
        });
    });
};