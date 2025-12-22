import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// [修改] 优化连接地址判断逻辑：生产环境默认使用当前相对路径，走 Nginx 代理
const getSocketUrl = () => {
    // 如果是开发环境 (npm run dev)，通常端口是 5173 或其他，需要显式连 3001
    // 这里简单的判断：如果当前页面端口不是 3001 且是 localhost/192/10 开头，且不带 build 特征
    // 但为了部署稳定，最简单的策略是：
    // 1. 如果是 https，肯定是用域名，走 /
    // 2. 如果是部署后的环境（通常通过 80 端口访问），走 /
    // 3. 只有在本地开发调试时，才强制指定 :3001
    
    const { hostname, port, protocol } = window.location;
    
    // [新增] 生产环境判定：如果端口是 80 或 443 (空)，或者通过域名访问，直接用相对路径
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