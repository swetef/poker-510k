import React from 'react';
import { Trophy, Flag, Shield, Coins } from 'lucide-react';
import { styles } from '../../styles.js';
import CountDownTimer from '../CountDownTimer.jsx';

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