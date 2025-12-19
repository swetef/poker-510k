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
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [mySocketId, setMySocketId] = useState(null);
    
    // [新增] 延迟状态
    const [ping, setPing] = useState(0);

    useEffect(() => {
        console.log(`正在连接服务器: ${SOCKET_URL}`);
        
        const newSocket = io(SOCKET_URL, { 
            reconnectionAttempts: 20,   
            reconnectionDelay: 2000,    
            timeout: 20000,
            autoConnect: true
        });
        
        setSocket(newSocket);

        let pingInterval;

        const onConnect = () => {
            console.log("Socket 连接成功!");
            setIsConnected(true);
            
            // [新增] 启动 Ping 循环
            pingInterval = setInterval(() => {
                const start = Date.now();
                newSocket.emit('ping', () => {
                    const latency = Date.now() - start;
                    setPing(latency);
                });
            }, 2000); // 每2秒检测一次
        };

        const onDisconnect = () => {
            console.log("Socket 断开连接");
            setIsConnected(false);
            if (pingInterval) clearInterval(pingInterval);
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
            if (pingInterval) clearInterval(pingInterval);
            newSocket.off('connect', onConnect);
            newSocket.off('disconnect', onDisconnect);
            newSocket.off('connect_error', onConnectError);
            newSocket.off('your_id', onYourId);
            // newSocket.disconnect(); // 保持长连接
        };
    }, []);

    return { 
        socket, 
        isConnected, 
        mySocketId,
        ping // [新增] 导出 ping
    };
};