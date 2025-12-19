import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
// [新增] 引入音效
import SoundManager from '../utils/SoundManager.js';

const CountDownTimer = ({ initialSeconds, totalSeconds = 60, position = 'top' }) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const intervalRef = useRef(null);

    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (seconds <= 0) return;

        intervalRef.current = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    return 0;
                }
                
                // [新增] 最后5秒播放滴答声
                if (prev <= 6 && prev > 1) {
                     SoundManager.play('tick');
                }
                
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [initialSeconds]);

    const isUrgent = seconds <= 10;
    // [新增] 极度紧急状态，用于CSS动画
    const isCritical = seconds <= 5; 
    
    const color = isUrgent ? '#ff4d4d' : '#ffffff';
    const bgColor = isUrgent ? 'rgba(231, 76, 60, 0.9)' : 'rgba(0, 0, 0, 0.7)';

    let posStyle = {};
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
            posStyle = { position: 'static', margin: '0 10px' };
            break;
        case 'top':
        default:
            posStyle = { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 5 };
            break;
    }

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

    // [修改] 增加 critical-pulse 类名
    return (
        <div style={containerStyle} className={isCritical ? "critical-pulse" : ""}>
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