import { useState, useEffect, useRef } from 'react';
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
    
    const socketRef = useRef(null); // 使用 Ref 保持 socket 引用，方便在事件回调中使用

    useEffect(() => {
        console.log(`正在连接服务器: ${SOCKET_URL}`);
        
        const newSocket = io(SOCKET_URL, { 
            reconnectionAttempts: Infinity, // 无限重试，确保网络恢复后能连上
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            transports: ['websocket', 'polling'] 
        });
        
        setSocket(newSocket);
        socketRef.current = newSocket;

        let pingInterval;

        const onConnect = () => {
            console.log("Socket 连接成功!");
            setIsConnected(true);
            if (newSocket.id) {
                setMySocketId(newSocket.id);
            }
            
            // 连接成功后立即发一个 ping 测活
            newSocket.emit('ping');

            pingInterval = setInterval(() => {
                const start = Date.now();
                if (newSocket.connected) {
                    newSocket.emit('ping', () => {
                        const latency = Date.now() - start;
                        setPing(latency);
                    });
                }
            }, 3000); 
        };

        const onDisconnect = (reason) => {
            console.log(`Socket 断开连接: ${reason}`);
            setIsConnected(false);
            if (pingInterval) clearInterval(pingInterval);
            
            // 如果是服务端断开或传输关闭，尝试自动重连
            if (reason === "io server disconnect" || reason === "transport close") {
                newSocket.connect();
            }
        };

        const onConnectError = (err) => {
            console.warn("连接错误:", err.message);
        };

        const onYourId = (id) => {
            setMySocketId(id);
        };

        newSocket.on('connect', onConnect);
        newSocket.on('disconnect', onDisconnect);
        newSocket.on('connect_error', onConnectError);
        newSocket.on('your_id', onYourId);

        // --- [新增] 核心：切屏/后台恢复检测 ---
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("[App] 切回前台，检查连接状态...");
                
                // 1. 如果 Socket 断开了，立即重连
                if (!newSocket.connected) {
                    console.log("[App] 发现连接已断开，正在强制重连...");
                    newSocket.connect();
                } else {
                    // 2. 即使 connected 为 true，也可能是假死，发一个包激活一下
                    newSocket.emit('ping', () => {
                        console.log("[App] 连接活性检查通过");
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (pingInterval) clearInterval(pingInterval);
            newSocket.off('connect', onConnect);
            newSocket.off('disconnect', onDisconnect);
            newSocket.off('connect_error', onConnectError);
            newSocket.off('your_id', onYourId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            newSocket.close();
        };
    }, []);

    return { 
        socket, 
        isConnected, 
        mySocketId,
        ping 
    };
};