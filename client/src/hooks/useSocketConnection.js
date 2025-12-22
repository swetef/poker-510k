import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const getSocketUrl = () => {
    const { hostname, port, protocol } = window.location;
    
    if (port === '' || port === '80' || port === '443') {
        return '/';
    }

    // 本地开发回退逻辑
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
    
    const [ping, setPing] = useState(0);

    useEffect(() => {
        console.log(`正在连接服务器: ${SOCKET_URL}`);
        
        const newSocket = io(SOCKET_URL, { 
            reconnectionAttempts: 20,   
            reconnectionDelay: 2000,    
            timeout: 20000,
            autoConnect: true,
            // [新增] 显式指定 transport，防止 Nginx 代理时轮询失败
            transports: ['websocket', 'polling'] 
        });
        
        setSocket(newSocket);

        let pingInterval;

        const onConnect = () => {
            console.log("Socket 连接成功!");
            setIsConnected(true);
            
            // [核心修复] 连接成功时，立即获取 socket.id 作为我的 ID
            // 这样不需要服务器专门发送 'your_id' 事件也能识别身份
            if (newSocket.id) {
                setMySocketId(newSocket.id);
            }
            
            pingInterval = setInterval(() => {
                const start = Date.now();
                // 确保 socket 有效
                if (newSocket.connected) {
                    newSocket.emit('ping', () => {
                        const latency = Date.now() - start;
                        setPing(latency);
                    });
                }
            }, 2000); 
        };

        const onDisconnect = () => {
            console.log("Socket 断开连接");
            setIsConnected(false);
            if (pingInterval) clearInterval(pingInterval);
        };

        const onConnectError = (err) => {
            console.warn("连接错误 (详细):", err.message);
        };

        // 保留这个监听作为兼容，但主要依赖 onConnect 中的赋值
        const onYourId = (id) => {
            setMySocketId(id);
        };

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
            newSocket.close(); // [建议] 组件卸载时关闭连接，防止多重连接
        };
    }, []);

    return { 
        socket, 
        isConnected, 
        mySocketId,
        ping 
    };
};