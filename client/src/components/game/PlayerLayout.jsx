import React from 'react';
import { Bot, Zap, CheckCircle, Eye } from 'lucide-react'; // [新增] 引入 Eye 图标
import { PlayerAvatar } from '../BaseUI.jsx'; 
import { useGame } from '../../context/GameContext.jsx'; 
import { sortHand, getCardDisplay } from '../../utils/cardLogic.js';

// [保持原样] 布局计算函数
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

// [保持原样] 小卡牌组件
const CompactShowCard = ({ cardVal }) => {
    const { text, suit, color } = getCardDisplay(cardVal);
    return (
        <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
            border: '1px solid #999',
            borderRadius: 4,
            width: 38,
            height: 52,
            position: 'relative',
            color: color,
            boxShadow: '1px 2px 5px rgba(0,0,0,0.25)',
            userSelect: 'none'
        }}>
            <div style={{
                position: 'absolute',
                top: 2,
                left: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 0.9
            }}>
                <div style={{fontSize: 16, fontWeight: '900', letterSpacing: -1}}>{text}</div>
                <div style={{fontSize: 12, marginTop: 0}}>{suit}</div>
            </div>
        </div>
    );
};

export const PlayerLayout = () => {
    const { 
        players, mySocketId, currentTurnId, playersInfo, playerScores, 
        roundPoints, roomConfig, turnRemaining, finishedRank, handCounts,
        isSpectator,
        isRoundOver, roundOverData, readyPlayers,
        // [新增] 获取观战相关状态
        observedHands, watchedPlayerId, setWatchedPlayerId
    } = useGame();

    if (!players) return null;

    const totalP = players.length;
    let avatarScale = 1;
    if (totalP > 10) avatarScale = 0.70;      
    else if (totalP > 8) avatarScale = 0.80;  
    else if (totalP > 6) avatarScale = 0.90;  
    
    const avatarStyleOverride = totalP > 6 ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    let myIndex = players.findIndex(p => p.id === mySocketId);
    if (myIndex === -1) myIndex = 0; 

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

    // [保持原样] 右侧玩家位置计算
    rightGroup.forEach((p, i) => {
        let topPos;
        if (countR === 1) {
            topPos = '45%'; 
        } else {
            const start = 65; const end = 25;   
            const step = (start - end) / (countR - 1 || 1);
            topPos = `${start - i * step}%`;
        }
        layoutItems.push({ 
            p, 
            pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, 
            timerPos: 'left',
            handAreaStyle: {
                position: 'absolute', top: '50%', right: '115%', transform: 'translateY(-50%)',
                display: 'flex', flexDirection: 'row-reverse', alignItems: 'center'
            }
        });
    });

    // [保持原样] 上方玩家位置计算
    topGroup.forEach((p, i) => {
        let leftPos;
        if (countT === 1) {
            leftPos = '50%';
        } else {
            const start = 85; const end = 15;   
            const step = (start - end) / (countT - 1 || 1);
            leftPos = `${start - i * step}%`; 
        }
        layoutItems.push({ 
            p, 
            pos: { top: '12%', left: leftPos, transform: 'translateX(-50%)' }, 
            timerPos: 'bottom',
            handAreaStyle: {
                position: 'absolute', top: '125%', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', justifyContent: 'center', alignItems: 'flex-start'
            }
        });
    });

    // [保持原样] 左侧玩家位置计算
    leftGroup.forEach((p, i) => {
        let topPos;
        if (countL === 1) {
            topPos = '45%';
        } else {
            const start = 25; const end = 65;   
            const step = (end - start) / (countL - 1 || 1);
            topPos = `${start + i * step}%`;
        }
        layoutItems.push({ 
            p, 
            pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, 
            timerPos: 'right',
            handAreaStyle: {
                position: 'absolute', top: '50%', left: '115%', transform: 'translateY(-50%)',
                display: 'flex', flexDirection: 'row', alignItems: 'center'
            }
        });
    });

    // [保持原样] 自己的位置
    const me = players[myIndex];
    if (me) {
        const isActuallyMe = me.id === mySocketId;
        const myItem = { 
            p: me, 
            pos: { bottom: 35, left: 20, zIndex: 100 }, 
            hideTimer: !isSpectator && isActuallyMe,
            timerPos: 'top',
            handAreaStyle: {
                position: 'absolute', bottom: '125%', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', justifyContent: 'center', alignItems: 'flex-end'
            }
        };
        
        // 即使是观众模式，如果为了保持布局稳定，也可以把“自己”的位置留着（显示当前观看的对象或空着）
        // 这里沿用原逻辑：如果在观战，我（作为观众）不在 players 列表中，myIndex 可能指向别人
        // 但通常 spectator 模式下 myIndex 会处理好
        layoutItems.unshift(myItem);
    }

    return (
        <>
            {layoutItems.map(({ p, pos, timerPos, hideTimer, handAreaStyle }) => {
                if (!p) return null;

                const info = playersInfo[p.id] || {};
                const isBot = info.isBot || p.isBot;
                const isAuto = info.isAutoPlay;
                const rankIndex = finishedRank ? finishedRank.indexOf(p.id) : -1;
                const finishedRankVal = rankIndex !== -1 ? rankIndex + 1 : null;
                
                let remainingCards = [];
                if (isRoundOver && roundOverData && roundOverData.scoreBreakdown) {
                    const playerData = roundOverData.scoreBreakdown[p.id];
                    if (playerData && playerData.remainingHand) {
                        remainingCards = sortHand(playerData.remainingHand, 'POINT');
                    }
                }
                const isReady = isRoundOver && readyPlayers.includes(p.id);

                // [新增] 观战状态判断
                const canWatch = observedHands && observedHands[p.id] && observedHands[p.id].length > 0;
                const isWatching = watchedPlayerId === p.id;

                const cardCount = remainingCards.length;
                let overlapMargin = -24; 
                if (cardCount > 6) overlapMargin = -26;
                if (cardCount > 12) overlapMargin = -28;

                return (
                    <div 
                        key={p.id} 
                        style={{
                            ...avatarStyleOverride, 
                            position: 'absolute', 
                            ...pos, 
                            transition: 'all 0.5s ease',
                            // [新增] 如果可观战，显示手型光标
                            cursor: canWatch ? 'pointer' : 'default' 
                        }}
                        // [新增] 点击切换观战视角
                        onClick={() => canWatch && setWatchedPlayerId(p.id)}
                    > 
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
                        
                        {/* 状态徽章区域 */}
                        <div style={{position: 'absolute', top: -10, right: -10, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end'}}>
                            {/* [新增] 眼睛图标：表示可观战/正在观战 */}
                            {canWatch && (
                                <div style={{
                                    background: isWatching ? '#3498db' : 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: 20, height: 20,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: isWatching ? '0 0 10px #3498db' : 'none',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    transition: 'all 0.2s',
                                    marginBottom: 2
                                }}>
                                    <Eye size={12} />
                                </div>
                            )}

                            {/* 原有的状态图标 */}
                            <div style={{display:'flex', gap:5}}>
                                {isBot && <div className="statusBadgeBot"><Bot size={12}/> AI</div>}
                                {isAuto && <div className="statusBadgeAuto"><Zap size={12}/> 托管</div>}
                            </div>
                        </div>

                        {/* [保持原样] 摊牌展示 */}
                        {isRoundOver && remainingCards.length > 0 && (
                            <div style={{
                                ...handAreaStyle,
                                zIndex: 50, 
                                pointerEvents: 'none',
                                padding: 5, 
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: -24, 
                                    left: '50%',
                                    transform: 'translateX(-50%)', 
                                    background: 'rgba(0,0,0,0.6)',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 'bold',
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    whiteSpace: 'nowrap',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    zIndex: 100
                                }}>
                                    余 {cardCount}
                                </div>

                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    {remainingCards.map((c, idx) => (
                                        <div key={idx} style={{
                                            position: 'relative',
                                            marginLeft: idx === 0 ? 0 : overlapMargin,
                                            zIndex: idx, 
                                            transition: 'transform 0.2s',
                                        }}>
                                            <CompactShowCard cardVal={c} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* [保持原样] 准备状态 */}
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