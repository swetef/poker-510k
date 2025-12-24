import React from 'react';
import { Bot, Zap, CheckCircle } from 'lucide-react';
// [修复] 添加 .jsx 后缀以解决解析错误
import { PlayerAvatar, MiniCard } from '../BaseUI.jsx'; 
import { useGame } from '../../context/GameContext.jsx'; 

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
        isSpectator,
        isRoundOver, roundOverData, readyPlayers
    } = useGame();

    if (!players) return null;

    const totalP = players.length;
    let avatarScale = 1;
    if (totalP > 10) avatarScale = 0.70;      
    else if (totalP > 8) avatarScale = 0.80;  
    else if (totalP > 6) avatarScale = 0.90;  
    
    const avatarStyleOverride = totalP > 6 ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    let myIndex = players.findIndex(p => p.id === mySocketId);
    
    if (myIndex === -1) {
        myIndex = 0; 
    }

    const otherPlayers = [];
    if (players.length > 0) {
        for (let i = 1; i < players.length; i++) {
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

    const me = players[myIndex];
    if (me) {
        const isActuallyMe = me.id === mySocketId;
        
        if (!isSpectator || isActuallyMe) {
            layoutItems.unshift({ p: me, pos: { bottom: 35, left: 20, zIndex: 100 }, hideTimer: true });
        } else {
            layoutItems.unshift({ p: me, pos: { bottom: 35, left: 20, zIndex: 100 }, hideTimer: false, timerPos: 'top' });
        }
    }

    return (
        <>
            {layoutItems.map(({ p, pos, timerPos, hideTimer }) => {
                if (!p) return null;

                const info = playersInfo[p.id] || {};
                const isBot = info.isBot || p.isBot;
                const isAuto = info.isAutoPlay;
                const rankIndex = finishedRank ? finishedRank.indexOf(p.id) : -1;
                const finishedRankVal = rankIndex !== -1 ? rankIndex + 1 : null;
                
                // 摊牌逻辑
                let remainingCards = [];
                if (isRoundOver && roundOverData && roundOverData.scoreBreakdown) {
                    const playerData = roundOverData.scoreBreakdown[p.id];
                    if (playerData && playerData.remainingHand) {
                        remainingCards = playerData.remainingHand;
                    }
                }
                const isReady = isRoundOver && readyPlayers.includes(p.id);

                return (
                    <div key={p.id} style={{...avatarStyleOverride, position: 'absolute', ...pos, transition: 'all 0.5s ease'}}> 
                        <PlayerAvatar 
                            player={p} 
                            isTurn={p.id === currentTurnId} 
                            score={playerScores[p.id] || 0} 
                            roundScore={roundPoints[p.id] || 0} 
                            targetScore={roomConfig ? roomConfig.targetScore : 500} 
                            isMySocket={p.id === mySocketId}
                            remainingSeconds={turnRemaining}
                            rank={finishedRankVal}
                            timerPosition={timerPos}
                            hideTimer={hideTimer} 
                            cardCount={handCounts[p.id] || 0}
                            showCardCountMode={roomConfig ? roomConfig.showCardCountMode : false} 
                            team={info.team} 
                        />
                        <div style={{position: 'absolute', top: -10, right: -10, display: 'flex', gap: 5}}>
                            {isBot && <div className="statusBadgeBot"><Bot size={12}/> AI</div>}
                            {isAuto && <div className="statusBadgeAuto"><Zap size={12}/> 托管</div>}
                        </div>

                        {/* [修改] 优化后的摊牌展示：增大尺寸，增加背景对比 */}
                        {isRoundOver && remainingCards.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                // 稍微下移一点，防止挡住名字
                                top: '100%', left: '50%', transform: 'translateX(-50%)',
                                marginTop: 15,
                                display: 'flex', 
                                background: 'rgba(0,0,0,0.85)', 
                                padding: '8px 12px', 
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.2)',
                                zIndex: 999, // 确保足够高
                                pointerEvents: 'none',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                                width: 'max-content',
                                maxWidth: '200px', // 防止太宽
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: 2
                            }}>
                                <div style={{
                                    position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                                    fontSize: 10, color: '#ccc', background: 'rgba(0,0,0,0.85)', 
                                    padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap'
                                }}>
                                    剩余手牌
                                </div>
                                {remainingCards.map((c, idx) => (
                                    <div key={idx} style={{
                                        // 调整 Wrapper 尺寸以适应放大后的 MiniCard
                                        width: 24, height: 32, 
                                        marginRight: -10 // 叠牌效果
                                    }}>
                                        <div style={{
                                            // 放大 Scale 到 0.6 (之前是 0.35)
                                            transform: 'scale(0.6)', 
                                            transformOrigin: 'top left'
                                        }}>
                                            <MiniCard cardVal={c} index={idx} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 准备标记 */}
                        {isReady && (
                            <div style={{
                                position: 'absolute', top: -25, left: '50%', transform: 'translateX(-50%)',
                                background: '#27ae60', color: 'white', fontSize: 10, padding: '2px 8px',
                                borderRadius: 10, whiteSpace: 'nowrap', fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', gap: 2,
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)', zIndex: 300
                            }}>
                                <CheckCircle size={10} /> 已准备
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
};