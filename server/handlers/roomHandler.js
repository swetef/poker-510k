module.exports = (io, socket, rooms) => {
    
    // ... (保持辅助函数 broadcastRoomInfo, broadcastGameState 不变) ...
    const broadcastRoomInfo = (roomId) => {
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
    };

    const broadcastGameState = (roomId, room, infoText = null) => {
        if (!room.gameManager) return;
        const publicState = room.gameManager.getPublicState();
        if (!publicState) return;
        if (infoText) publicState.infoText = infoText;
        io.to(roomId).emit('game_state_update', publicState);
    };

    // --- 创建房间 ---
    socket.on('create_room', ({ roomId, username, config }) => {
        if (rooms[roomId]) {
            if (rooms[roomId].isPermanent) {
                 return socket.emit('error_msg', '常驻房间已存在，请直接加入');
            }
            return socket.emit('error_msg', '房间已存在');
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
            gameManager: null,
            seatManager: null, 
            destroyTimer: null 
        };
        
        socket.join(roomId);
        rooms[roomId].players.push({ id: socket.id, name: cleanName, isHost: true, online: true });
        
        broadcastRoomInfo(roomId);
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
            
            // [关键修改] 移除在线检查报错，允许顶号重连
            // 之前的代码会在这里 return error，导致刷新后进不去
            
            // 如果旧连接还在线，踢掉它 (强制下线旧设备/旧页面)
            if (existingPlayer.online && existingPlayer.id !== socket.id) {
                 const oldSocket = io.sockets.sockets.get(existingPlayer.id);
                 if (oldSocket) {
                     // 通知旧连接被顶号
                     oldSocket.emit('error_msg', '您的账号已在其他页面登录');
                     oldSocket.disconnect(); 
                     console.log(`[Join] Kicking old socket for ${cleanName}: ${existingPlayer.id}`);
                 }
            }

            isReconnect = true;
            oldSocketId = existingPlayer.id;
            console.log(`[Reconnect] Success! ${cleanName} (${oldSocketId} -> ${socket.id})`);

            // 更新为新 socket id
            existingPlayer.id = socket.id;
            existingPlayer.online = true; 

            if (room.destroyTimer) {
                clearTimeout(room.destroyTimer);
                room.destroyTimer = null;
                console.log(`[Room] Destruction cancelled for ${roomId} (player returned)`);
            }

            if (room.gameManager) room.gameManager.reconnectPlayer(oldSocketId, socket.id);
            if (room.seatManager) room.seatManager.reconnectPlayer(oldSocketId, socket.id);

        } else {
            if (room.players.length >= room.config.maxPlayers) {
                return socket.emit('error_msg', '房间已满');
            }
            
            socket.join(roomId);
            if (!room.players.find(u => u.id === socket.id)) {
                const hasHost = room.players.some(p => p.isHost && p.online);
                const isHost = !hasHost;
                room.players.push({ id: socket.id, name: cleanName, isHost: isHost, online: true });
            }
        }

        socket.join(roomId);
        broadcastRoomInfo(roomId);

        // 如果游戏正在进行，立即发送当前状态，让前端切回游戏界面
        const isGameRunning = room.gameManager && room.gameManager.gameState;
        if (isGameRunning) {
            if (isReconnect) {
                const hand = room.gameManager.getPlayerHand(socket.id);
                socket.emit('game_started', { 
                    hand: hand, 
                    grandScores: room.gameManager.grandScores,
                    handCounts: room.gameManager.getPublicState().handCounts
                });
            }
            broadcastGameState(roomId, room);
        }
        
        if (room.seatManager && room.seatManager.drawResults) {
             socket.emit('enter_draw_phase', { totalCards: room.players.length });
             Object.entries(room.seatManager.drawResults).forEach(([pid, val]) => {
                 const pName = room.players.find(p=>p.id===pid)?.name || '未知';
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

    // ... (后续 update_room_config, add_bot, kick_player, switch_seat 保持不变) ...
    socket.on('update_room_config', ({ roomId, config }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            return socket.emit('error_msg', '只有房主可以修改规则');
        }

        if (room.gameManager || room.seatManager) {
            return socket.emit('error_msg', '游戏进行中无法修改规则');
        }

        if (config.isNoShuffleMode !== undefined) {
            room.config.shuffleStrategy = config.isNoShuffleMode ? 'NO_SHUFFLE' : 'CLASSIC';
        }
        if (config.shuffleStrategy) {
            room.config.shuffleStrategy = config.shuffleStrategy;
        }

        room.config = { ...room.config, ...config };
        broadcastRoomInfo(roomId);
    });

    socket.on('add_bot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        if (room.players.length >= room.config.maxPlayers) return socket.emit('error_msg', '房间已满');
        
        const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        
        let botName = '';
        let attempts = 0;
        do {
            const randomNum = Math.floor(Math.random() * 1000); 
            botName = `Robot ${randomNum}`;
            attempts++;
        } while (room.players.some(p => p.name === botName) && attempts < 10);

        if (room.players.some(p => p.name === botName)) {
            botName = `Bot_${Date.now().toString().slice(-4)}`;
        }
        
        room.players.push({ 
            id: botId, 
            name: botName, 
            isHost: false, 
            online: true,
            isBot: true 
        });
        
        broadcastRoomInfo(roomId);
    });

    socket.on('kick_player', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room) return;

        const sender = room.players.find(p => p.id === socket.id);
        if (!sender || !sender.isHost) {
            return socket.emit('error_msg', '只有房主可以踢人');
        }

        if (room.gameManager || room.seatManager) {
            return socket.emit('error_msg', '游戏进行中无法踢人');
        }

        const targetIndex = room.players.findIndex(p => p.id === targetId);
        if (targetIndex === -1) return;

        const targetPlayer = room.players[targetIndex];
        if (targetPlayer.id === socket.id) return;

        room.players.splice(targetIndex, 1);

        if (!targetPlayer.isBot) {
            io.to(targetPlayer.id).emit('kicked', '你已被房主移出房间');
            const targetSocket = io.sockets.sockets.get(targetPlayer.id);
            if (targetSocket) {
                targetSocket.leave(roomId);
            }
        }
        
        broadcastRoomInfo(roomId);
    });

    socket.on('switch_seat', ({ roomId, index1, index2 }) => {
        const room = rooms[roomId];
        if (!room) return;

        const requestPlayer = room.players.find(p => p.id === socket.id);
        if (!requestPlayer || !requestPlayer.isHost) {
            return socket.emit('error_msg', '只有房主可以调整座位');
        }

        if (index1 < 0 || index1 >= room.players.length || index2 < 0 || index2 >= room.players.length) return;
        if (room.gameManager && room.gameManager.gameState) return socket.emit('error_msg', '游戏中无法调整座位');

        const temp = room.players[index1];
        room.players[index1] = room.players[index2];
        room.players[index2] = temp;

        broadcastRoomInfo(roomId);
    });
};