import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const CountDownTimer = ({ initialSeconds, totalSeconds = 60 }) => {
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

    return (
        <div style={{
            position: 'absolute',
            // [修改] 显示在头顶上方，避开下方内容
            top: -60, 
            left: '50%',
            transform: 'translateX(-50%)',
            
            // 样式调整：气泡风格
            background: bgColor,
            padding: '4px 12px',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            zIndex: 30,
            transition: 'all 0.3s'
        }}>
            <Clock size={14} color={color} className={isUrgent ? 'spin' : ''} />
            <span style={{ 
                color: color, 
                fontWeight: 'bold', 
                fontSize: 16,
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