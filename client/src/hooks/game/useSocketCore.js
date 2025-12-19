import { useEffect, useRef } from 'react';
import { useSocketConnection } from '../useSocketConnection.js';

export const useSocketCore = (username, roomId) => {
    // 复用已有的底层连接 Hook，[修改] 获取 ping
    const { socket, isConnected, mySocketId, ping } = useSocketConnection();
    
    // 使用 Ref 追踪最新状态，用于自动重连时的闭包问题
    const usernameRef = useRef(username);
    const roomIdRef = useRef(roomId);

    useEffect(() => { usernameRef.current = username; }, [username]);
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

    // 自动重连逻辑：当连接断开后重新连接上时，自动尝试回到房间
    useEffect(() => {
        if (isConnected && socket && roomIdRef.current && usernameRef.current) {
            console.log(`[Auto-Rejoin] 自动恢复身份: ${usernameRef.current} @ Room ${roomIdRef.current}`);
            socket.emit('join_room', { 
                roomId: roomIdRef.current, 
                username: usernameRef.current 
            });
        }
    }, [isConnected, socket]);

    return { socket, isConnected, mySocketId, ping }; // [修改] 导出 ping
};