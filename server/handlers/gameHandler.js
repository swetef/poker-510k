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

    // 辅助函数：广播房间信息（用于大厅/房间等待阶段）
    const broadcastRoomInfo = (roomId, room) => {
        const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
        // 确保所有玩家都有大分记录
        if (Object.keys(currentGrandScores).length === 0) {
            room.players.forEach(p => {
                if (currentGrandScores[p.id] === undefined) currentGrandScores[p.id] = 0;
            });
        }
        io.to(roomId).emit('room_info', { 
            roomId, 
            config: room.config, 
            players: room.players, 
            grandScores: currentGrandScores 
        });
    };

    // 处理游戏开始逻辑
    const handleGameStart = (roomId, isNextRound) => {
        const room = rooms[roomId];
        if (!room) return;

        // 如果是新一局或没有管理器，重新实例化
        if (!isNextRound || !room.gameManager) {
            room.gameManager = new GameManager(room.config, room.players, io, roomId);
        }

        const startInfo = room.gameManager.startRound(isNextRound);

        // 给每个非机器人玩家发送手牌
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

    // --- 事件监听 ---

    // 1. 更新房间配置
    socket.on('update_config', ({ roomId, config }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        // 只有房主能修改 (通常第一个人是房主，这里简化判断，或者信任前端)
        room.config = { ...room.config, ...config };
        broadcastRoomInfo(roomId, room);
    });

    // 2. 添加机器人
    socket.on('add_bot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        if (room.gameManager) return socket.emit('error_msg', '游戏进行中无法加人');
        if (room.players.length >= 8) return socket.emit('error_msg', '房间已满');

        const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const botName = `机器人${Math.floor(Math.random()*100)}`;
        
        room.players.push({
            id: botId,
            name: botName,
            isBot: true,
            isReady: true,
            team: null
        });

        broadcastRoomInfo(roomId, room);
    });

    // 3. 踢出玩家
    socket.on('kick_player', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        // 简单鉴权：只能踢别人
        if (targetId === socket.id) return; 

        const idx = room.players.findIndex(p => p.id === targetId);
        if (idx !== -1) {
            const removed = room.players.splice(idx, 1)[0];
            
            // 通知被踢玩家
            if (!removed.isBot) {
                io.to(removed.id).emit('kicked', '你已被房主移出房间');
                // 也可以强制断开socket连接或清理状态
            }
            broadcastRoomInfo(roomId, room);
        }
    });

    // 4. 交换座位
    socket.on('switch_seat', ({ roomId, fromIndex, toIndex }) => {
        const room = rooms[roomId];
        if (!room) return;
        if (room.gameManager) return; // 游戏中不能换座

        if (fromIndex < 0 || fromIndex >= room.players.length || 
            toIndex < 0 || toIndex >= room.players.length) return;

        const temp = room.players[fromIndex];
        room.players[fromIndex] = room.players[toIndex];
        room.players[toIndex] = temp;

        broadcastRoomInfo(roomId, room);
    });

    // 5. 开始游戏 (抽牌/直接开始)
    socket.on('start_game', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        // 清理旧的游戏管理器
        if (room.gameManager) {
            if (room.gameManager._clearTimer) room.gameManager._clearTimer();
            room.gameManager = null;
        }
        
        // 组队模式人数检查
        if (room.config.isTeamMode && room.players.length % 2 !== 0) {
            room.config.isTeamMode = false;
            io.to(roomId).emit('error_msg', '人数为奇数，已自动关闭组队模式');
            broadcastRoomInfo(roomId, room);
        }

        const isTeamMode = room.config.isTeamMode && (room.players.length % 2 === 0);
        
        // 初始化座位管理器 (用于抽牌选座)
        room.seatManager = new SeatManager(io, roomId, room.players, isTeamMode);
        
        // 通知前端进入抽牌阶段
        io.to(roomId).emit('enter_draw_phase', { totalCards: room.players.length });
        
        // 机器人自动抽牌逻辑
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
                            // 检查是否所有人都抽完了
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

    // 6. 玩家抽座次牌
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

    // 7. 下一局
    socket.on('next_round', ({ roomId }) => handleGameStart(roomId, true));

    // 8. 出牌
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
                room.gameManager._handleWin(result, socket.id);

                // 如果大局结束，清理 GameManager
                if (result.roundResult.isGrandOver) {
                    room.gameManager = null; 
                }
            }, 3000); 
        } else {
            broadcastGameState(roomId, room, result.logText);
        }
    });

    // 9. 不要/过牌
    socket.on('pass_turn', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        const result = room.gameManager.passTurn(socket.id);
        if (!result.success) return socket.emit('play_error', result.error);

        if (result.isRoundOver) {
            broadcastGameState(roomId, room, result.logText);
            
            setTimeout(() => {
                if (!rooms[roomId]) return;
                room.gameManager._handleWin(result, socket.id);
                
                if (result.roundResult && result.roundResult.isGrandOver) {
                    room.gameManager = null;
                }
            }, 3000);
        } else {
            broadcastGameState(roomId, room, result.logText || "PASS");
        }
    });

    // 10. 切换托管开关
    socket.on('toggle_auto_play', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.toggleAutoPlay(socket.id);
        broadcastGameState(roomId, room);
    });

    // 11. [新增] 切换托管模式 (智能/省钱/躺平)
    socket.on('switch_autoplay_mode', ({ roomId, mode }) => {
        const room = rooms[roomId];
        if (!room || !room.gameManager) return;

        room.gameManager.setPlayerAutoPlayMode(socket.id, mode);
        broadcastGameState(roomId, room);
    });

    // 12. 请求提示
    socket.on('request_hint', ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.gameManager) {
            // 注意: 现在的提示主要在前端计算，后端保留此接口以防万一
            const cards = room.gameManager.getHint(socket.id);
            socket.emit('hint_response', cards);
        }
    });
};