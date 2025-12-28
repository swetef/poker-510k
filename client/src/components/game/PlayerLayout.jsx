import React from 'react';
import { Bot, Zap, CheckCircle } from 'lucide-react';
import { PlayerAvatar } from '../BaseUI.jsx'; 
import { useGame } from '../../context/GameContext.jsx'; 
import { sortHand, getCardDisplay } from '../../utils/cardLogic.js';

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

// [修改] 改为左上角布局，与手牌逻辑一致
const CompactShowCard = ({ cardVal }) => {
    const { text, suit, color } = getCardDisplay(cardVal);
    return (
        <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)', // 保持微渐变立体感
            border: '1px solid #999',
            borderRadius: 4,
            width: 38,
            height: 52,
            position: 'relative', // 允许绝对定位
            color: color,
            boxShadow: '1px 2px 5px rgba(0,0,0,0.25)',
            userSelect: 'none'
        }}>
            {/* 模拟手牌布局: 内容定位在左上角 */}
            <div style={{
                position: 'absolute',
                top: 2,
                left: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center', // 数字和花色在小容器内居中
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

    // 右侧玩家：摊牌在头像左侧
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
            // [新增] 摊牌样式
            handAreaStyle: {
                position: 'absolute',
                top: '50%',
                right: '115%', // 稍微拉远一点，避免大卡片遮挡头像
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'row-reverse', // 从右向左排，贴着头像
                alignItems: 'center'
            }
        });
    });

    // 上方玩家：摊牌在头像下方
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
            // [新增] 摊牌样式
            handAreaStyle: {
                position: 'absolute',
                top: '125%', // 稍微拉远
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start'
            }
        });
    });

    // 左侧玩家：摊牌在头像右侧
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
            // [新增] 摊牌样式
            handAreaStyle: {
                position: 'absolute',
                top: '50%',
                left: '115%', // 稍微拉远
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'row', // 从左向右排
                alignItems: 'center'
            }
        });
    });

    // 我（下方）：摊牌在头像上方
    const me = players[myIndex];
    if (me) {
        const isActuallyMe = me.id === mySocketId;
        const myItem = { 
            p: me, 
            pos: { bottom: 35, left: 20, zIndex: 100 }, 
            hideTimer: !isSpectator && isActuallyMe,
            timerPos: 'top',
            // [新增] 摊牌样式
            handAreaStyle: {
                position: 'absolute',
                bottom: '125%', // 稍微拉远
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end'
            }
        };
        
        if (!isSpectator || isActuallyMe) {
            layoutItems.unshift(myItem);
        } else {
            layoutItems.unshift(myItem);
        }
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

                // [新增] 动态计算叠牌参数
                const cardCount = remainingCards.length;
                // 默认叠牌间距 -24px (卡片宽38，露出14px)
                // 如果牌很多，挤压更紧 (-28px, 露出10px)
                let overlapMargin = -24; 
                if (cardCount > 6) overlapMargin = -26;
                if (cardCount > 12) overlapMargin = -28;

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

                        {/* [修改] 摊牌展示区域 */}
                        {isRoundOver && remainingCards.length > 0 && (
                            <div style={{
                                ...handAreaStyle,
                                zIndex: 50, // 略高于头像
                                pointerEvents: 'none',
                                padding: 5, // 增加padding防止阴影被切
                            }}>
                                {/* 剩余张数小标签 */}
                                <div style={{
                                    position: 'absolute',
                                    top: -24, // 配合大卡片上移
                                    // 确保标签在正中间
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
                                            // 动态间距
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