import React from 'react';
import { Bot, Zap } from 'lucide-react';
import { PlayerAvatar } from '../BaseUI'; // 移除 .jsx 后缀以增强兼容性
import { useGame } from '../../context/GameContext'; // 移除 .jsx 后缀

const calculateLayout = (otherPlayersCount) => {
    if (otherPlayersCount === 0) return { countT: 0, countR: 0, countL: 0 }; 
    if (otherPlayersCount === 1) return { countT: 1, countR: 0, countL: 0 }; 
    if (otherPlayersCount === 2) return { countT: 0, countR: 1, countL: 1 }; 
    if (otherPlayersCount === 3) return { countT: 1, countR: 1, countL: 1 }; 
    if (otherPlayersCount === 4) return { countT: 2, countR: 1, countL: 1 }; 
    if (otherPlayersCount === 5) return { countT: 2, countR: 2, countL: 1 }; 

    const sideCount = Math.ceil(otherPlayersCount / 3);
    const topCount = otherPlayersCount - (sideCount * 2);
    
    return {
        countR: sideCount,
        countL: sideCount,
        countT: Math.max(0, topCount) 
    };
};

export const PlayerLayout = () => {
    const { 
        players, mySocketId, currentTurnId, playersInfo, playerScores, 
        roundPoints, roomConfig, turnRemaining, finishedRank, handCounts,
        isSpectator 
    } = useGame();

    // [安全检查] 防止 players 为 undefined 导致崩溃
    if (!players) return null;

    const totalP = players.length;
    let avatarScale = 1;
    if (totalP > 10) avatarScale = 0.70;      
    else if (totalP > 8) avatarScale = 0.80;  
    else if (totalP > 6) avatarScale = 0.90;  
    
    const avatarStyleOverride = totalP > 6 ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    let myIndex = players.findIndex(p => p.id === mySocketId);
    
    // [修改] 如果是观众，或者找不到自己，默认以第一个玩家为视角中心 (index 0)
    if (myIndex === -1) {
        myIndex = 0; 
    }

    // 重新排列数组，让视角中心在第一个
    const otherPlayers = [];
    if (players.length > 0) {
        for (let i = 1; i < players.length; i++) {
            // 安全取模
            const idx = (myIndex + i) % players.length;
            if (players[idx]) {
                otherPlayers.push(players[idx]);
            }
        }
    }

    const { countT, countR, countL } = calculateLayout(otherPlayers.length);
    const rightGroup = otherPlayers.slice(0, countR);
    const topGroup = otherPlayers.slice(countR, countR + countT);
    const leftGroup = otherPlayers.slice(countR + countT);

    const layoutItems = [];

    rightGroup.forEach((p, i) => {
        let topPos;
        if (countR === 1) {
            topPos = '45%'; 
        } else {
            const start = 65; 
            const end = 25;   
            const step = (start - end) / (countR - 1 || 1);
            topPos = `${start - i * step}%`;
        }
        layoutItems.push({ p, pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, timerPos: 'left' });
    });

    topGroup.forEach((p, i) => {
        let leftPos;
        if (countT === 1) {
            leftPos = '50%';
        } else {
            const start = 85; 
            const end = 15;   
            const step = (start - end) / (countT - 1 || 1);
            leftPos = `${start - i * step}%`; 
        }
        layoutItems.push({ p, pos: { top: '12%', left: leftPos, transform: 'translateX(-50%)' }, timerPos: 'bottom' });
    });

    leftGroup.forEach((p, i) => {
        let topPos;
        if (countL === 1) {
            topPos = '45%';
        } else {
            const start = 25; 
            const end = 65;   
            const step = (end - start) / (countL - 1 || 1);
            topPos = `${start + i * step}%`;
        }
        layoutItems.push({ p, pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, timerPos: 'right' });
    });

    // 加入“自己”或“主视角玩家”
    const me = players[myIndex];
    if (me) {
        const isActuallyMe = me.id === mySocketId;
        
        if (!isSpectator || isActuallyMe) {
            // 正常玩家模式：自己不显示Timer（或者显示在特定位置），位置固定在左下
            layoutItems.unshift({ p: me, pos: { bottom: 35, left: 20, zIndex: 100 }, hideTimer: true });
        } else {
            // 观众模式：主视角玩家需要显示Timer，Timer在上方
            layoutItems.unshift({ p: me, pos: { bottom: 35, left: 20, zIndex: 100 }, hideTimer: false, timerPos: 'top' });
        }
    }

    return (
        <>
            {layoutItems.map(({ p, pos, timerPos, hideTimer }) => {
                if (!p) return null; // 安全检查

                const info = playersInfo[p.id] || {};
                const isBot = info.isBot || p.isBot;
                const isAuto = info.isAutoPlay;
                const rankIndex = finishedRank ? finishedRank.indexOf(p.id) : -1;
                const finishedRankVal = rankIndex !== -1 ? rankIndex + 1 : null;
                
                return (
                    <div key={p.id} style={{...avatarStyleOverride, position: 'absolute', ...pos, transition: 'all 0.5s ease'}}> 
                        <PlayerAvatar 
                            player={p} 
                            isTurn={p.id === currentTurnId} 
                            score={playerScores[p.id] || 0} 
                            roundScore={roundPoints[p.id] || 0} 
                            targetScore={roomConfig ? roomConfig.targetScore : 500} // 安全访问
                            isMySocket={p.id === mySocketId}
                            remainingSeconds={turnRemaining}
                            rank={finishedRankVal}
                            timerPosition={timerPos}
                            hideTimer={hideTimer} 
                            cardCount={handCounts[p.id] || 0}
                            showCardCountMode={roomConfig ? roomConfig.showCardCountMode : false} // 安全访问
                            team={info.team} 
                        />
                        <div style={{position: 'absolute', top: -10, right: -10, display: 'flex', gap: 5}}>
                            {isBot && <div className="statusBadgeBot"><Bot size={12}/> AI</div>}
                            {isAuto && <div className="statusBadgeAuto"><Zap size={12}/> 托管</div>}
                        </div>
                    </div>
                );
            })}
        </>
    );
};