import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// 连接地址判断逻辑
const getSocketUrl = () => {
    const { hostname, protocol, port } = window.location;
    if (protocol === 'https:') { return '/'; }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (port !== '3001') { return `${protocol}//${hostname}:3001`; }
    }
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        if (port !== '3001') { return `${protocol}//${hostname}:3001`; }
    }
    return '/';
};

const SOCKET_URL = getSocketUrl();

export const useSocketConnection = () => {
    // [关键修复] 改用 useState，确保 Socket 创建后能触发组件重渲染
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [mySocketId, setMySocketId] = useState(null);

    useEffect(() => {
        console.log(`正在连接服务器: ${SOCKET_URL}`);
        
        const newSocket = io(SOCKET_URL, { 
            reconnectionAttempts: 20,   
            reconnectionDelay: 2000,    
            timeout: 20000,
            autoConnect: true
        });
        
        // 保存实例，触发更新
        setSocket(newSocket);

        const onConnect = () => {
            console.log("Socket 连接成功!");
            setIsConnected(true);
        };

        const onDisconnect = () => {
            console.log("Socket 断开连接");
            setIsConnected(false);
        };

        const onConnectError = (err) => {
            console.warn("连接错误 (详细):", err.message);
        };

        const onYourId = (id) => {
            setMySocketId(id);
        };

        // 绑定基础事件
        newSocket.on('connect', onConnect);
        newSocket.on('disconnect', onDisconnect);
        newSocket.on('connect_error', onConnectError);
        newSocket.on('your_id', onYourId);

        return () => {
            newSocket.off('connect', onConnect);
            newSocket.off('disconnect', onDisconnect);
            newSocket.off('connect_error', onConnectError);
            newSocket.off('your_id', onYourId);
            // newSocket.disconnect(); // 保持长连接，组件卸载时不强制断开，除非彻底退出
        };
    }, []);

    return { 
        socket, 
        isConnected, 
        mySocketId 
    };
};