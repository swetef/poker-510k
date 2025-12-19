import React from 'react';
import { Bot, Zap } from 'lucide-react';
import { styles } from '../../styles.js';
import { PlayerAvatar } from '../BaseUI.jsx';
import { useGame } from '../../context/GameContext.jsx';

// ==========================================
// 辅助函数：计算座位布局
// ==========================================
const calculateLayout = (totalPlayers) => {
    if (totalPlayers <= 1) return { countT: 1, countR: 0, countL: 0 };
    if (totalPlayers === 2) return { countT: 0, countR: 1, countL: 0 }; // 2人对战，对手在右侧
    if (totalPlayers === 3) return { countT: 1, countR: 1, countL: 0 }; 
    if (totalPlayers === 4) return { countT: 1, countR: 1, countL: 1 };
    if (totalPlayers === 5) return { countT: 2, countR: 1, countL: 1 }; // 自己1，右1，上2，左1
    if (totalPlayers === 6) return { countT: 2, countR: 2, countL: 1 }; // 自己1，右2，上2，左1
    
    // 默认通用算法
    return {
        countR: 2,
        countL: 2,
        countT: Math.max(0, totalPlayers - 5) // 减去 自己(1)+右(2)+左(2)
    };
};

/**
 * [玩家布局组件]
 * 负责渲染牌桌上的所有玩家
 */
export const PlayerLayout = () => {
    const { 
        players, mySocketId, currentTurnId, playersInfo, playerScores, 
        roundPoints, roomConfig, turnRemaining, finishedRank, handCounts 
    } = useGame();

    const isCrowded = players.length > 6;
    const avatarScale = isCrowded ? 0.85 : 1;
    const avatarStyleOverride = isCrowded ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    const myIndex = players.findIndex(p => p.id === mySocketId);
    if (myIndex === -1 && players.length > 0) return null; // 同步保护

    // 重新排列数组，让自己在第一个
    const otherPlayers = [];
    for (let i = 1; i < players.length; i++) {
        const idx = (myIndex + i) % players.length;
        otherPlayers.push(players[idx]);
    }

    // 计算布局策略
    const { countT, countR, countL } = calculateLayout(otherPlayers.length);

    const rightGroup = otherPlayers.slice(0, countR);
    const topGroup = otherPlayers.slice(countR, countR + countT);
    const leftGroup = otherPlayers.slice(countR + countT);

    const layoutItems = [];

    // 右侧布局
    rightGroup.forEach((p, i) => {
        // [优化] 动态分布
        let topPos;
        if (countR === 1) topPos = '40%';
        else {
            const start = 30, end = 60;
            const step = (end - start) / (countR - 1);
            topPos = `${start + i * step}%`;
        }
        layoutItems.push({ p, pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, timerPos: 'left' });
    });

    // 顶部布局
    topGroup.forEach((p, i) => {
        let leftPos;
        if (countT === 1) leftPos = '50%';
        else {
            const start = 20, end = 80;
            const step = (end - start) / (countT - 1);
            leftPos = `${end - i * step}%`; 
        }
        layoutItems.push({ p, pos: { top: 10, left: leftPos, transform: 'translateX(-50%)' }, timerPos: 'bottom' });
    });

    // 左侧布局
    leftGroup.forEach((p, i) => {
        // [修复] 动态计算垂直分布，避免重叠
        let topPos;
        if (countL === 1) {
            topPos = '40%';
        } else {
            // 在 25% 到 65% 之间均匀分布 (拉大间距)
            const start = 25;
            const end = 65; 
            const step = (end - start) / (countL - 1);
            topPos = `${start + i * step}%`;
        }
        layoutItems.push({ p, pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, timerPos: 'right' });
    });

    // 加入自己
    const me = players[myIndex];
    if (me) layoutItems.unshift({ p: me, pos: { bottom: 25, left: 20, zIndex: 100 }, hideTimer: true });

    return (
        <>
            {layoutItems.map(({ p, pos, timerPos, hideTimer }) => {
                const info = playersInfo[p.id] || {};
                const isBot = info.isBot || p.isBot;
                const isAuto = info.isAutoPlay;
                const rankIndex = finishedRank ? finishedRank.indexOf(p.id) : -1;
                const finishedRankVal = rankIndex !== -1 ? rankIndex + 1 : null;
                
                return (
                    <div key={p.id} style={{...avatarStyleOverride, position: 'absolute', ...pos}}> 
                        <PlayerAvatar 
                            player={p} 
                            isTurn={p.id === currentTurnId} 
                            score={playerScores[p.id] || 0} 
                            roundScore={roundPoints[p.id] || 0} 
                            targetScore={roomConfig.targetScore} 
                            isMySocket={p.id === mySocketId}
                            remainingSeconds={turnRemaining}
                            rank={finishedRankVal}
                            timerPosition={timerPos}
                            hideTimer={hideTimer} 
                            cardCount={handCounts[p.id] || 0}
                            showCardCountMode={roomConfig.showCardCountMode}
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