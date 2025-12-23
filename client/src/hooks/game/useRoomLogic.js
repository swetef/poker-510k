import { useState, useEffect } from 'react';

export const useRoomLogic = (socket, isConnected) => {
    // 基础表单状态
    // [修改] 初始值优先从 localStorage 读取，防止刷新丢失
    const [username, setUsername] = useState(localStorage.getItem('poker_username') || '');
    const [roomId, setRoomId] = useState(localStorage.getItem('poker_roomid') || '');
    
    const [isCreatorMode, setIsCreatorMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // 房间配置表单状态 (默认值)
    const [inputConfig, setInputConfig] = useState({ 
        deckCount: 2,          
        maxPlayers: 4,         
        targetScore: 1000,     
        turnTimeout: 60000,
        enableRankPenalty: true, 
        rankPenaltyScores: [30, 15],
        showCardCountMode: 1, 
        isTeamMode: false,
        shuffleStrategy: 'CLASSIC'
    });

    // [新增] 监听 username 变化并自动保存到 localStorage
    useEffect(() => {
        if (username) {
            localStorage.setItem('poker_username', username);
        }
    }, [username]);

    // [新增] 监听 roomId 变化并自动保存到 localStorage
    useEffect(() => {
        if (roomId) {
            localStorage.setItem('poker_roomid', roomId);
        }
    }, [roomId]);

    // 动作：创建或加入房间
    const handleRoomAction = () => {
        if (!isConnected) return; 
        if (!username || !roomId) return alert("请输入昵称和房间号");
        
        setIsLoading(true);
        
        const event = isCreatorMode ? 'create_room' : 'join_room';
        const payload = isCreatorMode 
            ? { roomId, username, config: inputConfig } 
            : { roomId, username };
            
        socket.emit(event, payload);
    };

    // 动作：更新配置 (房主)
    const handleUpdateConfig = (roomId, newConfig) => {
        if (socket) socket.emit('update_room_config', { roomId, config: newConfig });
    };

    return {
        username, setUsername,
        roomId, setRoomId,
        isCreatorMode, setIsCreatorMode,
        isLoading, setIsLoading,
        inputConfig, setInputConfig, // 暴露给 LoginScreen 使用
        
        // Actions
        handleRoomAction,
        handleUpdateConfig
    };
};