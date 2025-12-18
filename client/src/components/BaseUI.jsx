import React, { useEffect, useRef, useState } from 'react'; 
import { Coins, History, Trophy, Flag, ChevronDown, ChevronUp, Shield } from 'lucide-react'; 
import { getCardDisplay } from '../utils/cardLogic.js';
import { styles } from '../styles.js';
import CountDownTimer from './CountDownTimer.jsx'; 

export const GameLogPanel = ({ logs }) => {
    const [isCollapsed, setIsCollapsed] = useState(false); 
    const endRef = useRef(null);

    useEffect(() => {
        if (!isCollapsed) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isCollapsed]);

    return (
        <div 
            style={{
                ...styles.gameLogPanel,
                zIndex: 1000,
                height: isCollapsed ? 36 : 140, 
                background: 'transparent', 
                backdropFilter: 'none',
                border: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'none',
                cursor: 'pointer',
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)'
            }}
            onClick={() => setIsCollapsed(!isCollapsed)} 
        >
            <div style={styles.logHeader}>
                <History size={14} color="#f1c40f" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}/> 
                <span style={{color:'#fff', fontWeight:'bold', flex: 1}}>
                    对局记录
                </span>
                {isCollapsed ? <ChevronDown size={14} color="#ccc" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}/> : <ChevronUp size={14} color="#ccc" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}/>}
            </div>
            
            <div style={{
                ...styles.logList, 
                opacity: isCollapsed ? 0 : 1,
                pointerEvents: isCollapsed ? 'none' : 'auto'
            }}>
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

export const Card = ({ cardVal, index, isSelected, onClick, onMouseEnter, spacing }) => {
    const { suit, text, color, isScore } = getCardDisplay(cardVal);
    
    const handlePointerDown = (e) => {
        if (e.pointerType === 'touch') return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.stopPropagation();
        onClick(cardVal);
    };

    return (
        <div 
            onPointerDown={handlePointerDown}
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
                transform: isSelected ? 'translateY(-35px)' : 'translateY(0)',
                borderColor: isSelected ? '#3498db' : (isScore ? '#f1c40f' : '#bdc3c7'),
                boxShadow: isSelected ? '0 0 15px rgba(52, 152, 219, 0.6)' : (isScore ? '0 0 8px rgba(241, 196, 15, 0.4)' : '0 -2px 5px rgba(0,0,0,0.1)'),
                touchAction: 'none' 
            }}
        >
            <div style={{position: 'absolute', top: 0, left: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0.9}}>
                <div style={{fontSize: 16, fontWeight: '900', letterSpacing: -1}}>{text}</div>
                <div style={{fontSize: 14, marginTop: -1}}>{suit}</div>
            </div>
            {isScore && <div style={{position:'absolute', bottom:1, right:2, fontSize:10, color:'#f1c40f'}}>★</div>}
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

// [修改] 增加 roundScore 参数
export const PlayerAvatar = ({ player, isTurn, score, roundScore = 0, targetScore, isMySocket, remainingSeconds, rank, timerPosition, hideTimer, cardCount, showCardCountMode, team }) => {
    const progress = Math.min((score / targetScore) * 100, 100);
    const containerOpacity = rank ? 0.75 : 1; 

    let showBadge = false;
    if (showCardCountMode === 2) showBadge = true;
    if (showCardCountMode === 1 && cardCount <= 2 && cardCount > 0) showBadge = true;
    if (rank) showBadge = false;

    const isTeamMode = team !== undefined && team !== null;
    const teamColor = team === 0 ? '#e74c3c' : '#3498db'; 
    const teamName = team === 0 ? '红' : '蓝';
    
    let borderColor = 'rgba(255,255,255,0.1)';
    if (isTeamMode) borderColor = teamColor;
    if (isTurn) borderColor = '#f1c40f'; 

    let bgColor = isTurn ? 'rgba(44, 62, 80, 0.9)' : 'rgba(44, 62, 80, 0.6)';
    if (isTeamMode && !isTurn) {
        bgColor = team === 0 ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)';
    }

    return (
        <div style={{
            ...styles.playerBox,
            borderColor: borderColor,
            borderWidth: isTeamMode ? 2 : 1, 
            transform: isTurn ? 'scale(1.1)' : 'scale(1)',
            boxShadow: isTurn ? '0 0 25px rgba(241, 196, 15, 0.5)' : 'none',
            background: bgColor,
            position: 'relative',
            opacity: containerOpacity
        }}>
            {showBadge && (
                <div style={styles.cardCountBadge}>
                    {cardCount}
                </div>
            )}

            {isTeamMode && (
                <div style={{
                    position: 'absolute', 
                    top: -10, 
                    right: -8, 
                    background: teamColor, color: 'white',
                    fontSize: 9, padding: '1px 4px', borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 2,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    zIndex: 25
                }}>
                    <Shield size={8} fill="currentColor"/> {teamName}队
                </div>
            )}

            {rank && (
                <div style={{
                    position: 'absolute',
                    top: -16, 
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: rank === 1 ? '#f1c40f' : (rank === 2 ? '#bdc3c7' : '#e67e22'), 
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 'bold',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                    zIndex: 30, 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    whiteSpace: 'nowrap',
                    border: '1px solid white'
                }}>
                    {rank === 1 ? <Trophy size={10} fill="white" /> : <Flag size={10} fill="white"/>}
                    {rank === 1 ? 'NO.1' : `NO.${rank}`}
                </div>
            )}

            <div style={{...styles.avatar, borderColor: isTeamMode ? teamColor : 'rgba(255,255,255,0.3)'}}>
                {player.name[0]}
            </div>
            
            <div style={styles.playerName}>
                {player.name} {isMySocket && '(我)'}
            </div>
            
            <div style={styles.scoreBarBg}>
                <div style={{...styles.scoreBarFill, width:`${progress}%`, background: progress>=100?'#e74c3c':'#2ecc71'}}></div>
            </div>
            
            {/* [核心修改] 分数显示优化 */}
            <div style={styles.playerScore}>
                <Coins size={10} color="#f1c40f"/> 
                {score}
                {roundScore > 0 && (
                    <span style={{color: '#f1c40f', fontSize: 9, marginLeft: 2, fontWeight: 900}}>(+{roundScore})</span>
                )}
            </div>
            
            {isTurn && !rank && !hideTimer && (
                <CountDownTimer 
                    initialSeconds={remainingSeconds} 
                    totalSeconds={60} 
                    position={timerPosition}
                />
            )}
        </div>
    );
};