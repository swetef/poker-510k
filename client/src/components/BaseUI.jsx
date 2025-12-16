// 基础UI组件 - 修复移动端点击无效、双重触发问题
import React, { useEffect, useRef } from 'react';
import { Coins, History, Trophy, Flag } from 'lucide-react'; 
import { getCardDisplay } from '../utils/cardLogic';
import { styles } from '../styles';
import CountDownTimer from './CountDownTimer'; 

export const Card = ({ cardVal, index, isSelected, onClick, onMouseEnter, spacing }) => {
    const { suit, text, color, isScore } = getCardDisplay(cardVal);
    
    // [关键修复] 使用 Pointer Events 代替 Touch/Mouse 事件
    // PointerDown 能同时响应鼠标按下和手指按下，且响应速度快，无 300ms 延迟
    const handlePointerDown = (e) => {
        // 只有左键点击(0)或触摸时触发
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        
        // 阻止默认行为，防止触发后续的兼容性鼠标事件
        // 但注意：在某些浏览器中这可能阻止滚动，所以 CSS 的 touch-action: none 配合很重要
        // e.preventDefault(); 
        e.stopPropagation();
        
        // 如果是触摸设备，直接由这里触发点击逻辑
        onClick(cardVal);
    };

    return (
        <div 
            // 移除 onTouchStart 和 onMouseDown，统一使用 onPointerDown
            onPointerDown={handlePointerDown}
            
            // 保留 MouseEnter 用于 PC 端拖拽滑选（移动端不支持 hover 所以不会触发）
            onMouseEnter={(e) => {
                if (e.pointerType === 'mouse') {
                     onMouseEnter(cardVal);
                }
            }}
            
            style={{
                ...styles.card, 
                color, 
                left: index * spacing, 
                zIndex: index,
                // [优化] 选中时上浮高度增加，手机上更容易看清
                transform: isSelected ? 'translateY(-45px)' : 'translateY(0)',
                borderColor: isSelected ? '#3498db' : (isScore ? '#f1c40f' : '#bdc3c7'),
                boxShadow: isSelected ? '0 0 15px rgba(52, 152, 219, 0.6)' : (isScore ? '0 0 8px rgba(241, 196, 15, 0.4)' : '0 -2px 5px rgba(0,0,0,0.1)'),
                // 确保移动端可以接收 Pointer 事件
                touchAction: 'none' 
            }}
        >
            <div style={{fontSize: 18, fontWeight: 'bold'}}>{text}</div>
            <div style={{fontSize: 36, alignSelf: 'center', marginTop: 5}}>{suit}</div>
            {isScore && <div style={{position:'absolute', bottom:2, right:2, fontSize:14, color:'#f1c40f'}}>★</div>}
        </div>
    );
};

export const MiniCard = ({ cardVal, index }) => {
    const { text, suit, color, isScore } = getCardDisplay(cardVal);
    return (
        <div style={{
            ...styles.miniCard, color,
            border: isScore ? '2px solid #f1c40f' : '1px solid #ccc',
            transform: isScore ? 'scale(1.1) translateY(-10px)' : 'scale(1)',
            zIndex: index
        }}>
            {suit}{text}
        </div>
    );
};

export const PlayerAvatar = ({ player, isTurn, score, targetScore, isMySocket, remainingSeconds, rank }) => {
    const progress = Math.min((score / targetScore) * 100, 100);
    const containerOpacity = rank ? 0.75 : 1; 

    return (
        <div style={{
            ...styles.playerBox,
            borderColor: isTurn ? '#f1c40f' : 'rgba(255,255,255,0.1)',
            transform: isTurn ? 'scale(1.1)' : 'scale(1)',
            boxShadow: isTurn ? '0 0 25px rgba(241, 196, 15, 0.5)' : 'none',
            background: isTurn ? 'rgba(44, 62, 80, 0.9)' : 'rgba(44, 62, 80, 0.6)',
            position: 'relative',
            opacity: containerOpacity
        }}>
            {rank && (
                <div style={{
                    position: 'absolute',
                    top: -15,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: rank === 1 ? '#f1c40f' : (rank === 2 ? '#bdc3c7' : '#e67e22'), 
                    color: '#fff',
                    padding: '3px 12px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 'bold',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                    border: '2px solid white'
                }}>
                    {rank === 1 ? <Trophy size={14} fill="white" /> : <Flag size={14} fill="white"/>}
                    {rank === 1 ? 'NO.1' : `NO.${rank}`}
                </div>
            )}

            <div style={styles.avatar}>{player.name[0]}</div>
            <div style={styles.playerName}>{player.name} {isMySocket && '(我)'}</div>
            <div style={styles.scoreBarBg}>
                <div style={{...styles.scoreBarFill, width:`${progress}%`, background: progress>=100?'#e74c3c':'#2ecc71'}}></div>
            </div>
            <div style={styles.playerScore}><Coins size={12} color="#f1c40f"/> {score} / {targetScore}</div>
            
            {isTurn && !rank && (
                <CountDownTimer 
                    initialSeconds={remainingSeconds} 
                    totalSeconds={60} 
                />
            )}
        </div>
    );
};

export const GameLogPanel = ({ logs }) => {
    const endRef = useRef(null);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

    return (
        <div style={styles.gameLogPanel}>
            <div style={styles.logHeader}>
                <History size={16} color="#f1c40f"/> <span style={{color:'#fff', fontWeight:'bold'}}>对局记录</span>
            </div>
            <div style={styles.logList}>
                {logs.map((log, i) => (
                    <div key={i} style={styles.logItem}>
                        <span style={styles.logTime}>[{log.time.split(' ')[0]}]</span>
                        <span style={{color: '#eee'}}>{log.text}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};