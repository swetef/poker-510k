const SeatManager = require('../game/SeatManager');
const GameManager = require('../game/GameManager');

module.exports = (io, socket, rooms) => {

    const broadcastGameState = (roomId, room, infoText = null) => {
        if (!room.gameManager) return;
        const publicState = room.gameManager.getPublicState();
        if (!publicState) return;
        if (infoText) publicState.infoText = infoText;
        io.to(roomId).emit('game_state_update', publicState);
    };

    const broadcastRoomInfo = (roomId, room) => {
        const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
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

        if (room.spectators) {
            room.spectators.forEach(s => {
                io.to(s.id).emit('game_started', {
                    hand: [],
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

    // 1. 开始游戏
    socket.on('start_game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return socket.emit('error_msg', '只有房主可以开始游戏');
        if (room.players.length < 2) return socket.emit('error_msg', '人数不足');

        if (room.gameManager) {
            // [Bug修复] 显式调用 dispose 方法，杀死旧实例
            if (room.gameManager.dispose) room.gameManager.dispose();
            if (room.gameManager._clearTimer) room.gameManager._clearTimer();
            room.gameManager = null;
        }
        
        if (room.config.isTeamMode && room.players.length % 2 !== 0) {
            room.config.isTeamMode = false;
            io.to(roomId).emit('error_msg', '人数为奇数，已自动关闭组队模式');
            broadcastRoomInfo(roomId, room);
        }

        const isTeamMode = room.config.isTeamMode && (room.players.length % 2 === 0);
        
        room.seatManager = new SeatManager(io, roomId, room.players, isTeamMode);
        io.to(roomId).emit('enter_draw_phase', { totalCards: room.players.length });
        
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

    // 3. 下一局 (保留给房主强制开始，但正常流程走准备)
    socket.on('next_round', ({ roomId }) => handleGameStart(roomId, true));

    // [新增] 玩家准备
    socket.on('player_ready', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;
        
        room.gameManager.handlePlayerReady(socket.id);
        // handlePlayerReady 内部会广播 ready_state_update
    });

    socket.on('play_cards', ({ roomId, cards }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;
        
        const result = room.gameManager.playCards(socket.id, cards);

        if (!result.success) return socket.emit('play_error', result.error);

        const currentHand = room.gameManager.gameState.hands[socket.id];
        io.to(socket.id).emit('hand_update', currentHand);

        if (result.isRoundOver) { 
            if (result.cardsPlayed && result.cardsPlayed.length > 0) {
                 broadcastGameState(roomId, room, result.logText);
            }

            setTimeout(() => {
                if (!rooms[roomId]) return;
                // [Bug修复] 确保在异步回调中，GameManager 还是有效的
                if (room.gameManager && !room.gameManager.disposed) {
                    room.gameManager._handleWin(result, socket.id);

                    if (result.roundResult.isGrandOver) {
                        // 大局结束，保留 gameManager 供查看战绩，但已标记 isGrandOverState
                        // 此时不应设为 null，否则无法查看战绩
                    } else {
                        // 小局结束
                        broadcastGameState(roomId, room);
                    }
                }
            }, 3000); 
        } else {
            broadcastGameState(roomId, room, result.logText);
        }
    });

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
                    
                    if (result.roundResult && result.roundResult.isGrandOver) {
                         // grand over
                    } else {
                        broadcastGameState(roomId, room);
                    }
                }
            }, 3000);
        } else {
            broadcastGameState(roomId, room, result.logText || "PASS");
        }
    });

    socket.on('toggle_auto_play', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.toggleAutoPlay(socket.id);
        broadcastGameState(roomId, room);
    });

    socket.on('switch_autoplay_mode', ({ roomId, mode }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.setPlayerAutoPlayMode(socket.id, mode);
        broadcastGameState(roomId, room);
    });

    socket.on('request_hint', ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.gameManager) {
            // 需要实现 getHint，这里简化处理，通常前端自己算或者后端算好发回
        }
    });
};