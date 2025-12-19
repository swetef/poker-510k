import { useState } from 'react';

export const useRoomLogic = (socket, isConnected) => {
    // 基础表单状态
    const [username, setUsername] = useState('');
    const [roomId, setRoomId] = useState('');
    const [isCreatorMode, setIsCreatorMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // 房间配置表单状态 (默认值)
    const [inputConfig, setInputConfig] = useState({ 
        deckCount: 2,          
        maxPlayers: 4,         
        targetScore: 1000,     
        turnTimeout: 60000,
        enableRankPenalty: true, // [修改] 默认开启排名赏罚
        rankPenaltyScores: [30, 15],
        showCardCountMode: 1, 
        isTeamMode: false,
        shuffleStrategy: 'CLASSIC'
    });

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