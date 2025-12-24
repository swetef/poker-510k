module.exports = (io, socket, rooms) => {
    
    // --- 基础连接检测 ---
    socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
            callback();
        }
    });

    // --- 辅助函数：广播房间信息 ---
    const broadcastRoomInfo = (roomId) => {
        const room = rooms[roomId];
        if (!room) return;
        
        const currentGrandScores = room.gameManager ? room.gameManager.grandScores : {};
        // 如果没有积分数据，初始化为0
        if (Object.keys(currentGrandScores).length === 0) {
            room.players.forEach(p => currentGrandScores[p.id] = 0);
        }

        // 广播时带上观众人数
        const spectatorCount = room.spectators ? room.spectators.length : 0;

        const data = { 
            roomId, 
            config: room.config, 
            players: room.players, 
            grandScores: currentGrandScores,
            spectatorCount 
        };
        io.to(roomId).emit('room_info', data);
    };

    // --- 辅助函数：广播游戏状态 ---
    const broadcastGameState = (roomId, room, infoText = null) => {
        if (!room.gameManager) return;
        const publicState = room.gameManager.getPublicState();
        if (!publicState) return;
        if (infoText) publicState.infoText = infoText;
        io.to(roomId).emit('game_state_update', publicState);
    };

    // ==========================================
    //               房间管理事件
    // ==========================================

    socket.on('create_room', ({ roomId, username, config }) => {
        // [修改] 智能房间覆盖逻辑 (实现“顶替”)
        if (rooms[roomId]) {
            const room = rooms[roomId];
            
            if (room.isPermanent) {
                 return socket.emit('error_msg', '常驻房间已存在，请直接加入');
            }

            // 检查是否有真人在线 (排除 Bot)
            const hasOnlineRealPlayers = room.players.some(p => !p.isBot && p.online);

            // 核心逻辑：如果房间存在，但没有真人在线（所有人已离开或断线），视为“僵尸房间”
            // 此时用户显式点击“创建”，说明意图是“开新局”，因此直接销毁旧房间
            if (!hasOnlineRealPlayers) {
                console.log(`[Room] Overwriting empty zombie room ${roomId}`);
                // 清理旧定时器
                if (room.destroyTimer) clearTimeout(room.destroyTimer);
                // 彻底删除旧房间数据，后续代码会重新创建全新的
                delete rooms[roomId];
            } else {
                // 如果还有人在线，才报“已存在”
                return socket.emit('error_msg', '房间已存在且有人在线，请更换房间号');
            }
        }
        
        const cleanName = String(username || '').trim();
        if (!cleanName) return socket.emit('error_msg', '用户名不能为空');

        const roomConfig = { 
            deckCount: 1, 
            maxPlayers: 3, 
            targetScore: 500, 
            shuffleStrategy: 'CLASSIC',
            ...config 
        };
        
        rooms[roomId] = {
            config: roomConfig,
            players: [],
            spectators: [], // 观众列表
            gameManager: null,
            seatManager: null, 
            destroyTimer: null 
        };
        
        socket.join(roomId);
        rooms[roomId].players.push({ id: socket.id, name: cleanName, isHost: true, online: true });
        
        broadcastRoomInfo(roomId);
    });

    // 加入房间逻辑 (支持观战)
    socket.on('join_room', ({ roomId, username }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit('error_msg', '房间不存在');

        const cleanName = String(username || '').trim();
        if (!cleanName) return socket.emit('error_msg', '用户名不能为空');

        const existingPlayerIndex = room.players.findIndex(p => p.name === cleanName);
        let isReconnect = false;
        let oldSocketId = null;

        if (existingPlayerIndex !== -1) {
            // --- 重连逻辑 ---
            const existingPlayer = room.players[existingPlayerIndex];
            
            if (existingPlayer.online && existingPlayer.id !== socket.id) {
                 const oldSocket = io.sockets.sockets.get(existingPlayer.id);
                 if (oldSocket) {
                     oldSocket.emit('error_msg', '您的账号已在其他页面登录');
                     oldSocket.disconnect(); 
                 }
            }

            isReconnect = true;
            oldSocketId = existingPlayer.id;
            existingPlayer.id = socket.id;
            existingPlayer.online = true; 

            // 既然有人重连回来了，取消销毁定时器
            if (room.destroyTimer) {
                clearTimeout(room.destroyTimer);
                room.destroyTimer = null;
            }

            if (room.gameManager) room.gameManager.reconnectPlayer(oldSocketId, socket.id);
            if (room.seatManager) room.seatManager.reconnectPlayer(oldSocketId, socket.id);

            socket.join(roomId);

            // [核心修复] Bot 房主回收机制
            // 如果我是真人重连，且现在的房主是 Bot，则我立即抢回房主
            if (!existingPlayer.isBot) {
                const currentHost = room.players.find(p => p.isHost);
                if (!currentHost || currentHost.isBot) {
                    if (currentHost) currentHost.isHost = false;
                    existingPlayer.isHost = true;
                    console.log(`[Room] Host claimed by returning player ${cleanName}`);
                }
            }

        } else {
            // --- 新玩家或观众逻辑 ---
            const isFull = room.players.length >= room.config.maxPlayers;
            const isGameRunning = room.gameManager && room.gameManager.gameState;

            if (isFull || isGameRunning) {
                // 进入观战模式
                socket.join(roomId);
                if (!room.spectators) room.spectators = [];
                const existingSpec = room.spectators.find(s => s.id === socket.id);
                if (!existingSpec) {
                    room.spectators.push({ id: socket.id, name: cleanName });
                }
                socket.emit('spectator_join', { message: '房间已满或游戏中，您已进入观战模式' });
            } else {
                // 正常加入
                socket.join(roomId);
                if (!room.players.find(u => u.id === socket.id)) {
                    // 如果房主是Bot或没人是房主，新人自动成为房主
                    const realHostExists = room.players.some(p => p.isHost && !p.isBot && p.online);
                    const isHost = !realHostExists;
                    
                    // 如果之前Bot是房主，取消Bot的房主
                    if (isHost) {
                        room.players.forEach(p => p.isHost = false);
                    }

                    room.players.push({ id: socket.id, name: cleanName, isHost: isHost, online: true });
                }
            }
        }

        broadcastRoomInfo(roomId);

        // 如果游戏进行中，发送状态
        if (room.gameManager && room.gameManager.gameState) {
            if (isReconnect) {
                const hand = room.gameManager.getPlayerHand(socket.id);
                socket.emit('game_started', { 
                    hand: hand, 
                    grandScores: room.gameManager.grandScores,
                    handCounts: room.gameManager.getPublicState().handCounts
                });
                
                // [核心修复] 如果重连时，处于“小局结束”状态，补发结算包
                // 解决 Issue 4: 重连后只显示打牌按钮，不显示准备按钮
                if (room.gameManager.isRoundOverState) {
                    const settlementData = room.gameManager.getSettlementData();
                    if (settlementData) {
                        // 稍作延迟，确保前端先处理完 game_started 的状态初始化
                        setTimeout(() => {
                             socket.emit('round_over', settlementData);
                        }, 500);
                    }
                }

            } else {
                // 观众或新加入者
                socket.emit('game_started', { 
                    hand: [], 
                    grandScores: room.gameManager.grandScores,
                    handCounts: room.gameManager.getPublicState().handCounts,
                    isSpectator: true 
                });
            }
            broadcastGameState(roomId, room);
        }
        
        // 抓牌阶段同步 (如果存在 SeatManager)
        if (room.seatManager && room.seatManager.drawResults) {
             socket.emit('enter_draw_phase', { totalCards: room.players.length });
             Object.entries(room.seatManager.drawResults).forEach(([pid, val]) => {
                 const pName = room.players.find(p=>p.id===pid)?.name || '未知';
                 let cardIndex = -1;
                 room.seatManager.availableCards.forEach((c, idx) => { if (c === val) cardIndex = idx; });
                 socket.emit('seat_draw_update', { index: cardIndex, val: val, playerId: pid, name: pName });
             });
        }
    });

    socket.on('update_room_config', ({ roomId, config }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return socket.emit('error_msg', '只有房主可以修改规则');
        if (room.gameManager || room.seatManager) return socket.emit('error_msg', '游戏进行中无法修改规则');

        if (config.isNoShuffleMode !== undefined) room.config.shuffleStrategy = config.isNoShuffleMode ? 'NO_SHUFFLE' : 'CLASSIC';
        if (config.shuffleStrategy) room.config.shuffleStrategy = config.shuffleStrategy;

        room.config = { ...room.config, ...config };
        broadcastRoomInfo(roomId);
    });

    socket.on('add_bot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        if (room.players.length >= room.config.maxPlayers) return socket.emit('error_msg', '房间已满');
        
        const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        let botName = `Bot_${Date.now().toString().slice(-4)}`;
        room.players.push({ id: botId, name: botName, isHost: false, online: true, isBot: true });
        broadcastRoomInfo(roomId);
    });

    socket.on('kick_player', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const sender = room.players.find(p => p.id === socket.id);
        if (!sender || !sender.isHost) return socket.emit('error_msg', '只有房主可以踢人');
        if (room.gameManager || room.seatManager) return socket.emit('error_msg', '游戏进行中无法踢人');

        const targetIndex = room.players.findIndex(p => p.id === targetId);
        if (targetIndex === -1) return;
        const targetPlayer = room.players[targetIndex];
        if (targetPlayer.id === socket.id) return;

        room.players.splice(targetIndex, 1);
        if (!targetPlayer.isBot) {
            io.to(targetPlayer.id).emit('kicked', '你已被房主移出房间');
            const targetSocket = io.sockets.sockets.get(targetPlayer.id);
            if (targetSocket) targetSocket.leave(roomId);
        }
        broadcastRoomInfo(roomId);
    });

    socket.on('switch_seat', ({ roomId, index1, index2 }) => {
        const room = rooms[roomId];
        if (!room) return;
        const requestPlayer = room.players.find(p => p.id === socket.id);
        if (!requestPlayer || !requestPlayer.isHost) return socket.emit('error_msg', '只有房主可以调整座位');
        if (room.gameManager && room.gameManager.gameState) return socket.emit('error_msg', '游戏中无法调整座位');
        if (index1 < 0 || index1 >= room.players.length || index2 < 0 || index2 >= room.players.length) return;

        const temp = room.players[index1];
        room.players[index1] = room.players[index2];
        room.players[index2] = temp;
        broadcastRoomInfo(roomId);
    });

    // ==========================================
    //          断开连接处理 (智能销毁逻辑)
    // ==========================================
    
    socket.on('disconnecting', () => {
        const roomsToLeave = [...socket.rooms];
        roomsToLeave.forEach(roomId => {
            const room = rooms[roomId];
            if (room) {
                // 1. 处理观众离开
                if (room.spectators) {
                    const specIndex = room.spectators.findIndex(s => s.id === socket.id);
                    if (specIndex !== -1) {
                        console.log(`[Spectator] Left: ${room.spectators[specIndex].name}`);
                        room.spectators.splice(specIndex, 1);
                        broadcastRoomInfo(roomId);
                        return; // 如果是观众，处理完就退出，不涉及玩家逻辑
                    }
                }

                // 2. 处理正式玩家离开
                const player = room.players.find(p => p.id === socket.id);
                if (player) {
                    console.log(`[Disconnect] Player ${player.name} (${player.id}) disconnected from room ${roomId}`);
                    
                    if (room.gameManager && room.gameManager.gameState) {
                        // 游戏进行中：标记离线，不移除
                        player.online = false;
                        broadcastRoomInfo(roomId);
                        // 如果开启了托管，自动接管
                        if (!player.isAutoPlay && !player.isBot) {
                            player.isAutoPlay = true;
                            room.gameManager.botManager.checkAndRun();
                            broadcastGameState(roomId, room, `${player.name} 断线，自动托管`);
                        }
                    } else {
                        // 游戏未开始：直接移除
                        room.players = room.players.filter(p => p.id !== socket.id);
                        
                        // 移交房主权限
                        if (player.isHost && room.players.length > 0) {
                            const nextHost = room.players.find(p => !p.isBot && p.online) || room.players[0];
                            nextHost.isHost = true;
                        }
                        
                        broadcastRoomInfo(roomId);
                    }

                    // 检查是否空房间 (全是 Bot 或无人)
                    const realPlayers = room.players.filter(p => !p.isBot);
                    const onlineRealPlayers = realPlayers.filter(p => p.online);

                    // 房间变空了，开始销毁倒计时
                    if (onlineRealPlayers.length === 0) {
                        if (!room.isPermanent) {
                             if (room.destroyTimer) clearTimeout(room.destroyTimer);
                             
                             // [关键逻辑] 智能判断销毁延迟：
                             // 1. 如果游戏从未开始（gameManager 为空） -> 纯大厅空置 -> 2秒销毁
                             // 2. 如果游戏已开始或已结束（gameManager 存在） -> 保留 5分钟（允许断线重连或查看战绩）
                             
                             const hasGameData = !!room.gameManager; 
                             const destroyDelay = hasGameData ? 300000 : 2000; // 5分钟 vs 2秒
                             
                             room.destroyTimer = setTimeout(() => {
                                 console.log(`[Room] Destroying empty room ${roomId} (Delay: ${destroyDelay}ms)`);
                                 delete rooms[roomId];
                             }, destroyDelay); 
                        }
                    }
                }
            }
        });
    });
};