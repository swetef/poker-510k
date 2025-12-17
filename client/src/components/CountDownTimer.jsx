import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

const CountDownTimer = ({ initialSeconds, totalSeconds = 60, position = 'top' }) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const intervalRef = useRef(null);

    // [优化] 只在 initialSeconds 发生显著变化（例如新的一轮开始）时重置
    // 这里我们假设父组件会传递正确的 initialSeconds
    // 如果服务器不频繁推送，这里的 useEffect 也就不会频繁触发
    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        // 清除旧的
        if (intervalRef.current) clearInterval(intervalRef.current);

        // 如果已经结束，不启动
        if (seconds <= 0) return;

        // 启动新的计时器
        intervalRef.current = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [initialSeconds]); // 依赖项改为 initialSeconds，而不是 seconds，这样不会每秒重置 interval

    const isUrgent = seconds <= 10;
    const color = isUrgent ? '#ff4d4d' : '#ffffff';
    const bgColor = isUrgent ? 'rgba(231, 76, 60, 0.9)' : 'rgba(0, 0, 0, 0.7)';

    let posStyle = {};
    // ... (位置样式逻辑保持不变) ...
    switch (position) {
        case 'bottom':
            posStyle = { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 5 };
            break;
        case 'left':
            posStyle = { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 };
            break;
        case 'right':
            posStyle = { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 };
            break;
        case 'top-right': 
            posStyle = { left: '100%', top: -20, marginLeft: 5 };
            break;
        case 'inline': 
             // [新增] 内联模式，用于操作栏
            posStyle = { position: 'static', margin: '0 10px' };
            break;
        case 'top':
        default:
            posStyle = { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 5 };
            break;
    }

    // 内联模式下移除 absolute
    const containerStyle = position === 'inline' ? {
        ...posStyle,
        background: bgColor,
        padding: '4px 10px',
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        border: '1px solid rgba(255,255,255,0.2)',
        transition: 'all 0.3s'
    } : {
        position: 'absolute',
        ...posStyle,
        background: bgColor,
        padding: '2px 8px',
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.2)',
        zIndex: 30,
        transition: 'all 0.3s'
    };

    return (
        <div style={containerStyle}>
            <Clock size={12} color={color} className={isUrgent ? 'spin' : ''} />
            <span style={{ 
                color: color, 
                fontWeight: 'bold', 
                fontSize: 12,
                fontFamily: 'monospace'
            }}>
                {seconds}s
            </span>
            <style>{`.spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    );
};

export default CountDownTimer;