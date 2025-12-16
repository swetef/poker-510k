import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// [修改] 增加 position 参数 ('top', 'bottom', 'left', 'right', 'top-right')
const CountDownTimer = ({ initialSeconds, totalSeconds = 60, position = 'top' }) => {
    const [seconds, setSeconds] = useState(initialSeconds);

    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        if (seconds <= 0) return;
        const timerId = setInterval(() => {
            setSeconds((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timerId);
    }, [seconds]);

    const isUrgent = seconds <= 10;
    const color = isUrgent ? '#ff4d4d' : '#ffffff';
    const bgColor = isUrgent ? 'rgba(231, 76, 60, 0.9)' : 'rgba(0, 0, 0, 0.7)';

    // 根据位置参数生成样式
    let posStyle = {};
    const commonTransform = 'translate(0, 0)';

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
        case 'top-right': // 专门给底部自己用的，放在头像右上角/右侧
            posStyle = { left: '100%', top: -20, marginLeft: 5 };
            break;
        case 'top':
        default:
            posStyle = { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 5 };
            break;
    }

    return (
        <div style={{
            position: 'absolute',
            ...posStyle,
            
            // 样式调整：气泡风格
            background: bgColor,
            padding: '2px 8px', // 稍微缩小一点
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            zIndex: 30,
            transition: 'all 0.3s'
        }}>
            <Clock size={12} color={color} className={isUrgent ? 'spin' : ''} />
            <span style={{ 
                color: color, 
                fontWeight: 'bold', 
                fontSize: 12,
                fontFamily: 'monospace'
            }}>
                {seconds}s
            </span>
            
            <style>{`
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default CountDownTimer;