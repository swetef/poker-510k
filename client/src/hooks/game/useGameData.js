import { useState, useEffect } from 'react';
import SoundManager from '../../utils/SoundManager.js';

export const useGameData = (socket, setIsLoading, { setIsRoundOver, setRoundOverData, setReadyPlayers }) => {
    const [gameState, setGameState] = useState('LOGIN'); 
    const [players, setPlayers] = useState([]);
    const [syncedConfig, setSyncedConfig] = useState(null);
    const [drawState, setDrawState] = useState(null); 

    useEffect(() => {
        if (!socket) return;

        const onRoomInfo = (data) => {
            setSyncedConfig(data.config);
            setPlayers(data.players);
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
        };

        const onGameStarted = (data) => {
            setGameState('GAME');
            SoundManager.play('deal');
            // [新增] 重置状态
            setIsRoundOver(false);
            setRoundOverData(null);
            setReadyPlayers([]);
        };
        
        // [新增] 小局结束 (不弹窗，只切状态)
        const onRoundOver = (data) => {
            setRoundOverData(data);
            setIsRoundOver(true);
            const isWinner = data.roundWinner === players.find(p => p.id === socket.id)?.name;
            // 可以播放音效，但不要alert
            // SoundManager.play(isWinner ? 'win' : 'lose'); // 逻辑在 useBattleLogic 处理了
        };
        
        // [新增] 大局结束
        const onGrandGameOver = (data) => {
            setRoundOverData(data);
            setIsRoundOver(true); 
            // 保持原有逻辑，GameManager 会把 isGrandOver: true 传过来
            SoundManager.play('win');
        };

        // [新增] 准备状态更新
        const onReadyStateUpdate = (data) => {
            setReadyPlayers(data.readyPlayerIds || []);
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
        socket.on('round_over', onRoundOver);
        socket.on('grand_game_over', onGrandGameOver);
        socket.on('ready_state_update', onReadyStateUpdate);
        socket.on('error_msg', onErrorMsg);
        socket.on('kicked', onKicked);

        return () => {
            socket.off('room_info', onRoomInfo);
            socket.off('enter_draw_phase', onEnterDrawPhase);
            socket.off('seat_draw_update', onSeatDrawUpdate);
            socket.off('seat_draw_finished', onSeatDrawFinished);
            socket.off('game_started', onGameStarted);
            socket.off('round_over', onRoundOver);
            socket.off('grand_game_over', onGrandGameOver);
            socket.off('ready_state_update', onReadyStateUpdate);
            socket.off('error_msg', onErrorMsg);
            socket.off('kicked', onKicked);
        };
    }, [socket, gameState, setIsLoading, players]); 

    const handleStartGame = (roomId) => socket.emit('start_game', { roomId });
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
        
        handleStartGame, 
        handleNextRound, 
        handleAddBot, 
        handleKickPlayer, 
        handleSwitchSeat, 
        handleDrawCard
    };
};