import React from 'react';
import { Bot, Zap } from 'lucide-react';
import { PlayerAvatar } from '../BaseUI.jsx';
import { useGame } from '../../context/GameContext.jsx';

// ==========================================
// 辅助函数：计算座位布局
// ==========================================
const calculateLayout = (otherPlayersCount) => {
    // 基础人数的固定布局 (保持原有的舒适布局)
    if (otherPlayersCount === 0) return { countT: 0, countR: 0, countL: 0 }; // 只有自己
    if (otherPlayersCount === 1) return { countT: 1, countR: 0, countL: 0 }; // 2人局: 对手在上
    if (otherPlayersCount === 2) return { countT: 0, countR: 1, countL: 1 }; // 3人局: 左1 右1 (修改：斗地主式布局更经典)
    if (otherPlayersCount === 3) return { countT: 1, countR: 1, countL: 1 }; // 4人局: 上1 左1 右1
    if (otherPlayersCount === 4) return { countT: 2, countR: 1, countL: 1 }; // 5人局: 上2 左1 右1
    if (otherPlayersCount === 5) return { countT: 2, countR: 2, countL: 1 }; // 6人局: 上2 左1 右2

    // [优化] 多人模式 (>6人) 采用三边均衡分配策略
    // 避免所有人都挤在顶部
    // 算法：侧边优先承担更多人数，因为纵向空间通常不容易遮挡手牌
    const sideCount = Math.ceil(otherPlayersCount / 3);
    const topCount = otherPlayersCount - (sideCount * 2);
    
    // 如果顶部计算出来太少(比如负数或0)，微调一下
    // 比如 7人(其他6人): side=2, top=2. (R2, L2, T2) -> 完美
    // 比如 11人(其他10人): side=4, top=2. (R4, L4, T2) -> 侧边4个完全放得下
    
    return {
        countR: sideCount,
        countL: sideCount,
        countT: Math.max(0, topCount) 
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

    // [优化] 更细致的拥挤判断
    const totalP = players.length;
    let avatarScale = 1;
    if (totalP > 10) avatarScale = 0.70;      // 11-12人：超小
    else if (totalP > 8) avatarScale = 0.80;  // 9-10人：小
    else if (totalP > 6) avatarScale = 0.90;  // 7-8人：微缩
    
    const avatarStyleOverride = totalP > 6 ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    const myIndex = players.findIndex(p => p.id === mySocketId);
    if (myIndex === -1 && players.length > 0) return null; 

    // 重新排列数组，让自己在第一个，形成以我为视角的顺时针数组
    const otherPlayers = [];
    for (let i = 1; i < players.length; i++) {
        const idx = (myIndex + i) % players.length;
        otherPlayers.push(players[idx]);
    }

    // 计算布局策略
    const { countT, countR, countL } = calculateLayout(otherPlayers.length);

    // 切割数组：注意顺序是 逆时针 还是 顺时针
    // 假设 otherPlayers 是 [下家, 下下家, ... 上家]
    // 布局通常是：右侧(下家) -> 顶部 -> 左侧(上家)
    const rightGroup = otherPlayers.slice(0, countR);
    const topGroup = otherPlayers.slice(countR, countR + countT);
    const leftGroup = otherPlayers.slice(countR + countT);

    const layoutItems = [];

    // --- 右侧布局 (从上往下排，或者从下往上) ---
    // 为了视觉习惯，离自己近的(下家)应该在右侧偏下位置
    rightGroup.forEach((p, i) => {
        let topPos;
        if (countR === 1) {
            topPos = '45%'; // 单人居中偏上一点
        } else {
            // 多人均匀分布在 25% - 65% 之间
            const start = 65; // 离自己最近的位置 (底部)
            const end = 25;   // 离顶部最近的位置
            const step = (start - end) / (countR - 1 || 1);
            topPos = `${start - i * step}%`;
        }
        layoutItems.push({ p, pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, timerPos: 'left' });
    });

    // --- 顶部布局 (从右往左排) ---
    // 衔接右侧，index 0 是紧接右侧的玩家，所以应在右边
    topGroup.forEach((p, i) => {
        let leftPos;
        if (countT === 1) {
            leftPos = '50%';
        } else {
            // [优化] 扩大顶部可用宽度范围 (15% - 85%)
            const start = 85; // 靠右
            const end = 15;   // 靠左
            const step = (start - end) / (countT - 1 || 1);
            leftPos = `${start - i * step}%`; 
        }
        // [微调] 顶部稍微靠下一点(12%)，避免贴着浏览器边缘
        layoutItems.push({ p, pos: { top: '12%', left: leftPos, transform: 'translateX(-50%)' }, timerPos: 'bottom' });
    });

    // --- 左侧布局 (从上往下排) ---
    // 衔接顶部，index 0 是紧接顶部的玩家，所以应在上边
    leftGroup.forEach((p, i) => {
        let topPos;
        if (countL === 1) {
            topPos = '45%';
        } else {
            const start = 25; // 顶部
            const end = 65;   // 底部 (离自己上家最近)
            const step = (end - start) / (countL - 1 || 1);
            topPos = `${start + i * step}%`;
        }
        layoutItems.push({ p, pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, timerPos: 'right' });
    });

    // 加入自己 (固定位置)
    const me = players[myIndex];
    if (me) layoutItems.unshift({ p: me, pos: { bottom: 35, left: 20, zIndex: 100 }, hideTimer: true });

    return (
        <>
            {layoutItems.map(({ p, pos, timerPos, hideTimer }) => {
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