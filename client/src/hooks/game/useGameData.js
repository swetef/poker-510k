import { useState, useEffect } from 'react';
import SoundManager from '../../utils/SoundManager.js';

export const useGameData = (socket, setIsLoading) => {
    const [gameState, setGameState] = useState('LOGIN'); 
    const [players, setPlayers] = useState([]);
    
    // 从服务器同步回来的配置 (用于大厅展示和游戏内逻辑)
    const [syncedConfig, setSyncedConfig] = useState(null);

    // 抽签阶段特有数据
    const [drawState, setDrawState] = useState(null); 
    // { totalCards: number, history: Array<{playerId, index, val, name}> }

    useEffect(() => {
        if (!socket) return;

        // --- 监听大厅与全局状态 ---

        const onRoomInfo = (data) => {
            setSyncedConfig(data.config);
            setPlayers(data.players);
            
            // 自动流转状态
            if (gameState !== 'GAME' && gameState !== 'DRAW_SEATS') {
                setGameState('LOBBY'); 
            }
            if (setIsLoading) setIsLoading(false);
        };

        const onEnterDrawPhase = (data) => {
            setDrawState({ totalCards: data.totalCards, history: [] });
            setGameState('DRAW_SEATS');
            SoundManager.play('deal');
        };

        const onSeatDrawUpdate = (data) => {
            setDrawState(prev => ({ ...prev, history: [...prev.history, data] }));
            SoundManager.play('deal'); 
        };

        const onSeatDrawFinished = (data) => {
            setPlayers(data.players); 
            // 游戏开始事件会紧接着触发，不用这里切状态
        };

        const onGameStarted = (data) => {
            setGameState('GAME');
            SoundManager.play('deal');
        };
        
        const onErrorMsg = (msg) => {
            if (setIsLoading) setIsLoading(false);
            alert(msg);
        };
        
        const onKicked = (msg) => {
             alert(msg);
             window.location.reload();
        };

        socket.on('room_info', onRoomInfo);
        socket.on('enter_draw_phase', onEnterDrawPhase);
        socket.on('seat_draw_update', onSeatDrawUpdate);
        socket.on('seat_draw_finished', onSeatDrawFinished);
        socket.on('game_started', onGameStarted);
        socket.on('error_msg', onErrorMsg);
        socket.on('kicked', onKicked);

        return () => {
            socket.off('room_info', onRoomInfo);
            socket.off('enter_draw_phase', onEnterDrawPhase);
            socket.off('seat_draw_update', onSeatDrawUpdate);
            socket.off('seat_draw_finished', onSeatDrawFinished);
            socket.off('game_started', onGameStarted);
            socket.off('error_msg', onErrorMsg);
            socket.off('kicked', onKicked);
        };
    }, [socket, gameState, setIsLoading]);

    // --- 大厅操作 Actions ---
    const handleStartGame = (roomId) => socket.emit('start_game', { roomId });
    // [修复] 增加 handleNextRound
    const handleNextRound = (roomId) => socket.emit('next_round', { roomId });
    
    const handleAddBot = (roomId) => socket.emit('add_bot', { roomId });
    const handleKickPlayer = (roomId, targetId) => socket.emit('kick_player', { roomId, targetId });
    const handleSwitchSeat = (roomId, index1, index2) => socket.emit('switch_seat', { roomId, index1, index2 });
    const handleDrawCard = (roomId, index) => socket.emit('draw_seat_card', { roomId, cardIndex: index });

    return {
        gameState, setGameState,
        players, setPlayers,
        syncedConfig, setSyncedConfig,
        drawState,
        
        // Actions
        handleStartGame, 
        handleNextRound, // 导出
        handleAddBot, 
        handleKickPlayer, 
        handleSwitchSeat, 
        handleDrawCard
    };
};