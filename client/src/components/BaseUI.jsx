// 基础UI组件 (卡牌、头像、日志)

import React, { useEffect, useRef } from 'react';
import { Coins, History } from 'lucide-react';
import { getCardDisplay } from '../utils/cardLogic';
import { styles } from '../styles';

export const Card = ({ cardVal, index, isSelected, onClick, onMouseEnter, spacing }) => {
    const { suit, text, color, isScore } = getCardDisplay(cardVal);
    return (
        <div 
            onMouseDown={() => onClick(cardVal)}
            onMouseEnter={() => onMouseEnter(cardVal)}
            style={{
                ...styles.card, 
                color, 
                left: index * spacing, 
                zIndex: index,
                transform: isSelected ? 'translateY(-40px)' : 'translateY(0)',
                borderColor: isSelected ? '#3498db' : (isScore ? '#f1c40f' : '#bdc3c7'),
                boxShadow: isSelected ? '0 0 15px rgba(52, 152, 219, 0.6)' : (isScore ? '0 0 8px rgba(241, 196, 15, 0.4)' : '0 -2px 5px rgba(0,0,0,0.1)'),
            }}
        >
            <div style={{fontSize: 22, fontWeight: 'bold'}}>{text}</div>
            <div style={{fontSize: 48, alignSelf: 'center', marginTop: 10}}>{suit}</div>
            {isScore && <div style={{position:'absolute', bottom:5, right:5, fontSize:16, color:'#f1c40f'}}>★</div>}
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

export const PlayerAvatar = ({ player, isTurn, score, targetScore, isMySocket }) => {
    const progress = Math.min((score / targetScore) * 100, 100);
    return (
        <div style={{
            ...styles.playerBox,
            borderColor: isTurn ? '#f1c40f' : 'rgba(255,255,255,0.1)',
            transform: isTurn ? 'scale(1.1)' : 'scale(1)',
            boxShadow: isTurn ? '0 0 25px rgba(241, 196, 15, 0.5)' : 'none',
            background: isTurn ? 'rgba(44, 62, 80, 0.9)' : 'rgba(44, 62, 80, 0.6)',
        }}>
            <div style={styles.avatar}>{player.name[0]}</div>
            <div style={styles.playerName}>{player.name} {isMySocket && '(我)'}</div>
            <div style={styles.scoreBarBg}>
                <div style={{...styles.scoreBarFill, width:`${progress}%`, background: progress>=100?'#e74c3c':'#2ecc71'}}></div>
            </div>
            <div style={styles.playerScore}><Coins size={12} color="#f1c40f"/> {score} / {targetScore}</div>
            {isTurn && <div style={styles.turnProgress}></div>}
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