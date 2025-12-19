import React from 'react';
import { Trophy, Flag, Shield, Coins } from 'lucide-react';
import css from './PlayerAvatar.module.css';
import CountDownTimer from '../CountDownTimer.jsx';

export const PlayerAvatar = ({ player, isTurn, score, roundScore = 0, targetScore, isMySocket, remainingSeconds, rank, timerPosition, hideTimer, cardCount, showCardCountMode, team }) => {
    const progress = Math.min((score / targetScore) * 100, 100);
    
    // 排名状态下的透明度
    const containerStyle = rank ? { opacity: 0.75 } : {};

    let showBadge = false;
    if (showCardCountMode === 2) showBadge = true;
    if (showCardCountMode === 1 && cardCount <= 2 && cardCount > 0) showBadge = true;
    if (rank) showBadge = false;

    const isTeamMode = team !== undefined && team !== null;
    const teamName = team === 0 ? '红' : '蓝';
    
    const boxClasses = [
        css.playerBox,
        isTurn ? css.activeTurn : '',
        isTeamMode ? (team === 0 ? css.teamRed : css.teamBlue) : ''
    ].join(' ');

    return (
        <div className={boxClasses} style={containerStyle}>
            {showBadge && (
                <div className={css.cardCountBadge}>
                    {cardCount}
                </div>
            )}

            {isTeamMode && (
                <div className={css.teamBadge} style={{backgroundColor: team === 0 ? '#e74c3c' : '#3498db'}}>
                    <Shield size={8} fill="currentColor"/> {teamName}队
                </div>
            )}

            {rank && (
                <div className={css.rankBadge} style={{
                    background: rank === 1 ? '#f1c40f' : (rank === 2 ? '#bdc3c7' : '#e67e22')
                }}>
                    {rank === 1 ? <Trophy size={10} fill="white" /> : <Flag size={10} fill="white"/>}
                    {rank === 1 ? 'NO.1' : `NO.${rank}`}
                </div>
            )}

            <div className={css.avatar} style={{borderColor: isTeamMode ? (team === 0 ? '#e74c3c' : '#3498db') : 'rgba(255,255,255,0.3)'}}>
                {player.name[0]}
            </div>
            
            <div className={css.playerName}>
                {player.name} {isMySocket && '(我)'}
            </div>
            
            <div className={css.scoreBarBg}>
                <div className={css.scoreBarFill} style={{width:`${progress}%`, background: progress>=100?'#e74c3c':'#2ecc71'}}></div>
            </div>
            
            <div className={css.playerScore}>
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