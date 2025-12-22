module.exports = (io, socket, rooms) => {
    
    // 辅助函数：广播房间信息
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

    // 辅助函数：广播游戏状态
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

    // --- 更新房间配置 ---
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

    // --- 添加机器人 ---
    socket.on('add_bot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        if (room.players.length >= room.config.maxPlayers) return socket.emit('error_msg', '房间已满');
        
        const botId = `bot_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        
        // [修复] 防止机器人重名
        // 尝试生成名字，如果重复则重试，最多尝试 10 次
        let botName = '';
        let attempts = 0;
        do {
            const randomNum = Math.floor(Math.random() * 1000); // 范围扩大到 0-999
            botName = `Robot ${randomNum}`;
            attempts++;
        } while (room.players.some(p => p.name === botName) && attempts < 10);

        // 如果重试 10 次还重复，强制加时间戳后缀
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

    // --- 踢人 ---
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

    // --- 切换座位 ---
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