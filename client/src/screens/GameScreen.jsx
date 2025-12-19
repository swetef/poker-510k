import React, { useState, useEffect } from 'react';
import { Coins, Layers, Crown, Clock, Bot, Zap, Maximize, Minimize, Shield, RotateCcw, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { styles } from '../styles.js'; 
import { Card, MiniCard, PlayerAvatar, GameLogPanel } from '../components/BaseUI.jsx';
import { ScoreTable } from '../components/ScoreTable.jsx'; 
import TimerComponent from '../components/CountDownTimer.jsx'; 
import { calculateCardSpacing } from '../utils/cardLogic.js';
import { useGame } from '../context/GameContext.jsx';
import { useHandGesture } from '../hooks/useHandGesture.js';

// ==========================================
// 辅助函数：计算座位布局
// ==========================================
const calculateLayout = (totalPlayers) => {
    if (totalPlayers <= 1) return { countT: 1, countR: 0, countL: 0 };
    if (totalPlayers === 2) return { countT: 0, countR: 1, countL: 0 }; // 2人对战，对手在右侧或顶部均可，这里保持原逻辑
    if (totalPlayers === 3) return { countT: 1, countR: 1, countL: 0 }; 
    if (totalPlayers === 4) return { countT: 1, countR: 1, countL: 1 };
    if (totalPlayers === 5) return { countT: 2, countR: 1, countL: 1 }; // 自己1，右1，上2，左1
    if (totalPlayers === 6) return { countT: 2, countR: 2, countL: 1 }; // 自己1，右2，上2，左1 (凑6人)
    
    // 默认通用算法
    return {
        countR: 2,
        countL: 2,
        countT: Math.max(0, totalPlayers - 5) // 减去 自己(1)+右(2)+左(2)
    };
};

// ==========================================
// 子组件定义区
// ==========================================

/**
 * [Header组件] 包含房间信息、比分板、排序切换、全屏按钮
 */
const GameHeader = () => {
    const { roomId, playersInfo, mySocketId, toggleSort, sortMode, handleToggleAutoPlay } = useGame();
    const [isFullScreen, setIsFullScreen] = useState(false);
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const toggleFullScreen = () => {
        const doc = window.document;
        const docEl = doc.documentElement;
        const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullScreen;
        const cancelFullScreen = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
            if (requestFullScreen) requestFullScreen.call(docEl).then(()=>setIsFullScreen(true)).catch(e=>console.log(e));
        } else {
            if (cancelFullScreen) cancelFullScreen.call(doc).then(()=>setIsFullScreen(false));
        }
    };

    return (
        <div style={styles.tableHeader}>
            <div style={styles.roomBadgeContainer}>
                <div style={styles.roomBadge}>Room {roomId}</div>
                <button 
                    style={{
                        pointerEvents: 'auto', background: amIAutoPlay ? '#e67e22' : 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.3)', color: '#ecf0f1', borderRadius: 15, 
                        padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 11, fontWeight: 'bold', transition: 'all 0.2s'
                    }}
                    onClick={handleToggleAutoPlay}
                >
                    <Zap size={12} style={{marginRight: 4}} fill={amIAutoPlay ? "currentColor" : "none"}/>
                    {amIAutoPlay ? '托管中' : '托管'}
                </button>
            </div>

            <div style={{display:'flex', alignItems: 'center', marginLeft: 'auto'}}>
                <TeamScoreBoard />
                <div style={{display:'flex', gap: 10}}>
                    <button style={{...styles.glassButton, padding: '8px 12px', pointerEvents: 'auto'}} onClick={toggleFullScreen}>
                        {isFullScreen ? <Minimize size={18}/> : <Maximize size={18}/>}
                    </button>
                    <button style={styles.sortButton} onClick={toggleSort}>
                        <Layers size={16} style={{marginRight:5}}/> 
                        {sortMode === 'POINT' ? '点数' : (sortMode === 'SUIT' ? '花色' : '理牌')}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * [比分板组件] 红蓝队分数
 */
const TeamScoreBoard = () => {
    const { players, playersInfo, playerScores, roomConfig } = useGame();
    const [isCollapsed, setIsCollapsed] = useState(true);

    let redScore = 0, blueScore = 0, hasTeams = false;
    players.forEach(p => {
        const pInfo = playersInfo[p.id];
        const score = playerScores[p.id] || 0;
        if (pInfo && pInfo.team !== undefined && pInfo.team !== null) {
            hasTeams = true;
            if (pInfo.team === 0) redScore += score;
            else if (pInfo.team === 1) blueScore += score;
        }
    });

    if (!hasTeams) return null;

    return (
        <div style={{ position: 'relative', marginRight: 10, zIndex: 50, pointerEvents: 'auto' }}>
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 20, 
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s'
                }}
            >
                <div style={{color:'#e74c3c', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, fontSize: 13}}>
                    <Shield size={12} fill="currentColor"/> {redScore}
                </div>
                <div style={{width:1, height:12, background:'rgba(255,255,255,0.2)'}}></div>
                <div style={{color:'#3498db', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, fontSize: 13}}>
                    <Shield size={12} fill="currentColor"/> {blueScore}
                </div>
                {isCollapsed ? <ChevronDown size={14} color="#ccc"/> : <ChevronUp size={14} color="#ccc"/>}
            </div>

            {!isCollapsed && (
                <div style={{
                    position: 'absolute', top: '120%', right: 0, 
                    background: 'rgba(30, 40, 50, 0.95)', borderRadius: 8, padding: 10,
                    color: 'white', fontSize: 12, textAlign: 'center', width: 140,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)'
                }}>
                    <div style={{marginBottom: 5, color: '#f1c40f', fontWeight: 'bold'}}>当前比分详情</div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:2}}>
                        <span style={{color:'#e74c3c'}}>红队</span> <span>{redScore}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                        <span style={{color:'#3498db'}}>蓝队</span> <span>{blueScore}</span>
                    </div>
                    <div style={{height:1, background:'rgba(255,255,255,0.1)', marginBottom:6}}></div>
                    <div>目标分数: {roomConfig.targetScore}</div>
                </div>
            )}
        </div>
    );
};

/**
 * [结算弹窗组件]
 */
const SettlementModal = () => {
    const { 
        winner, roundResult, grandResult, players, playersInfo, roomConfig, 
        handleStartGame, handleNextRound, mySocketId 
    } = useGame();

    if (!winner && !roundResult && !grandResult) return null;

    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    const playersWithTeamInfo = players.map(p => ({
        ...p, team: (playersInfo[p.id] && playersInfo[p.id].team !== undefined) ? playersInfo[p.id].team : p.team
    }));

    return (
        <div style={styles.modalOverlay}>
            <div className="modal-content-wrapper" style={{
                ...styles.modalContent, width: '95%', maxWidth: 600, padding: 0, 
                background: 'white', overflowY: 'auto', overflowX: 'hidden'
            }}>
                {grandResult ? (
                    <div style={{padding: 20, width: '100%'}}>
                        <Crown size={60} color="#e74c3c" style={{marginBottom: 10}} />
                        <h2 style={{fontSize: 28, marginBottom: 5, color:'#2c3e50'}}>{grandResult.grandWinner} 夺冠!</h2>
                        <div style={{margin: '15px 0'}}>
                            <ScoreTable players={playersWithTeamInfo} matchHistory={grandResult.matchHistory} currentScores={grandResult.grandScores} roomConfig={roomConfig} grandResult={grandResult}/>
                        </div>
                        <button style={{...styles.primaryButton, fontSize: 16, height: 50}} onClick={handleStartGame}>重新开始</button>
                    </div>
                ) : roundResult ? (
                    <div style={{padding: 20, width: '100%'}}>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom: 15}}>
                            <Coins size={30} color="#f1c40f" />
                            <h2 style={{fontSize: 24, margin:0}}>小局结算</h2>
                        </div>
                        <div style={{margin: '10px 0'}}>
                            <ScoreTable players={playersWithTeamInfo} matchHistory={roundResult.matchHistory} currentScores={roundResult.grandScores} roomConfig={roomConfig}/>
                        </div>
                        {amIHost ? <button style={styles.primaryButton} onClick={handleNextRound}>下一局</button> : <div style={{color:'#999', marginTop:10}}>等待房主...</div>}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

/**
 * [手牌区域组件]
 * 包含：手牌渲染、触摸手势逻辑、窗口自适应逻辑、托管遮罩
 */
const HandArea = () => {
    const { 
        myHand, selectedCards, handleMouseDown, handleMouseEnter, 
        playersInfo, mySocketId 
    } = useGame();
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    // 自适应逻辑移入组件内部
    const [dimensions, setDimensions] = useState({ width: window.innerWidth });
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const cardSpacing = calculateCardSpacing(myHand.length, dimensions.width);

    // 绑定手势 Hook
    const handContainerRef = useHandGesture({
        myHand, selectedCards, cardSpacing, handleMouseDown, amIAutoPlay
    });

    return (
        <div 
            ref={handContainerRef}
            style={{
                ...styles.handArea, 
                opacity: amIAutoPlay ? 0.6 : 1, 
                filter: amIAutoPlay ? 'grayscale(0.6)' : 'none',
                pointerEvents: amIAutoPlay ? 'none' : 'auto' 
            }}
        >
            {amIAutoPlay && (
                <div style={{
                    position: 'absolute', top: -40, left: 20,
                    background: 'rgba(230, 126, 34, 0.9)', color: 'white', padding: '5px 10px', 
                    borderRadius: 20, fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 50
                }}>
                    <Bot size={14} /> 系统代打中
                </div>
            )}
            
            {myHand.map((c, i) => (
                <Card 
                    key={`${c}-${i}`} cardVal={c} index={i} 
                    isSelected={selectedCards.includes(c)} 
                    onClick={handleMouseDown} onMouseEnter={handleMouseEnter} 
                    spacing={cardSpacing} 
                />
            ))}
        </div>
    );
};

/**
 * [操作栏组件]
 * 包含：出牌、不要、提示、重选、取消托管等按钮
 */
const GameActionBar = () => {
    const { 
        winner, roundResult, grandResult, selectedCards, isMyTurn, 
        playersInfo, mySocketId, currentTurnId, players, turnRemaining,
        handleClearSelection, handleToggleAutoPlay, handlePass, handleRequestHint, handlePlayCards 
    } = useGame();

    if (winner || roundResult || grandResult) return null;

    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;
    // 这里重新计算 isMyTurn，或者依赖 Context 传下来的 (推荐Context)
    // 假设 Context 的 isMyTurn 不可用，手动算:
    const myTurn = currentTurnId === mySocketId;
    const currentTurnPlayer = players.find(p => p.id === currentTurnId);
    const waitingText = currentTurnPlayer ? `等待 ${currentTurnPlayer.name}...` : '等待中...';

    return (
        <div style={styles.actionBar}>
            <div style={{display:'flex', alignItems: 'center', gap: 20}}>
                {selectedCards.length > 0 && (
                    <button 
                        style={{...styles.passButton, background: '#95a5a6', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: 5}} 
                        onClick={handleClearSelection}
                    >
                        <RotateCcw size={16} /> 重选
                    </button>
                )}
                {amIAutoPlay ? (
                    <button 
                        style={{...styles.playButton, background: '#e74c3c', width: 180, fontSize: 16, display: 'flex', justifyContent: 'center', alignItems: 'center'}} 
                        onClick={handleToggleAutoPlay}
                    >
                        <Zap size={18} style={{marginRight:8}}/> 取消托管
                    </button>
                ) : (
                    <>
                        {myTurn ? (
                            <>
                                <button style={styles.passButton} onClick={handlePass}>不要</button>
                                
                                <button 
                                    style={{...styles.passButton, background: '#8e44ad', marginRight: 0, padding:'8px 15px', display:'flex', alignItems:'center', gap:5}} 
                                    onClick={handleRequestHint}
                                >
                                    <Lightbulb size={16} /> 提示
                                </button>

                                <TimerComponent initialSeconds={turnRemaining} totalSeconds={60} position="inline" />
                                <button style={styles.playButton} onClick={handlePlayCards}>出牌</button>
                            </>
                        ) : (
                            <div style={styles.waitingBadge}><Clock size={20} className="spin" /> {waitingText}</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * [玩家布局组件]
 * 负责渲染牌桌上的所有玩家
 */
const PlayerLayout = () => {
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

    rightGroup.forEach((p, i) => {
        const topPos = countR === 1 ? '40%' : (i === 0 ? '55%' : '35%');
        layoutItems.push({ p, pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, timerPos: 'left' });
    });

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

    leftGroup.forEach((p, i) => {
        const topPos = countL === 1 ? '40%' : (i === 0 ? '35%' : '55%'); 
        layoutItems.push({ p, pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, timerPos: 'right' });
    });

    // 加入自己
    const me = players[myIndex];
    if (me) layoutItems.unshift({ p: me, pos: { bottom: 25, left: 20, zIndex: 100 }, hideTimer: true });

    return layoutItems.map(({ p, pos, timerPos, hideTimer }) => {
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
                    {isBot && <div style={styles.statusBadgeBot}><Bot size={12}/> AI</div>}
                    {isAuto && <div style={styles.statusBadgeAuto}><Zap size={12}/> 托管</div>}
                </div>
            </div>
        );
    });
};

/**
 * [中间区域组件]
 * 负责显示：最后打出的牌、待结算分数、系统消息
 */
const TableCenterArea = () => {
    const { 
        lastPlayed, lastPlayerName, pendingPoints, infoMessage, 
        infoMessage: serverInfoMessage 
    } = useGame();

    // 可以在这里处理本地消息逻辑，目前暂且直接展示
    const displayMessage = serverInfoMessage;

    return (
        <>
            <div style={styles.scoreBoard}>
                <div style={{fontSize: 10, opacity: 0.8, textTransform:'uppercase'}}>POINTS</div>
                <div style={{fontSize: 24, fontWeight: 'bold', color: '#f1c40f', display:'flex', alignItems:'center', justifyContent:'center', gap:5}}>
                    <Coins size={20} /> {pendingPoints}
                </div>
            </div>

            <div style={styles.infoMessage}>{displayMessage}</div>

            <div style={styles.tableCenter}>
                {lastPlayed.length > 0 && (
                    <div style={{animation: 'popIn 0.3s'}}>
                        <div style={styles.playerNameTag}>{lastPlayerName}</div>
                        <div style={styles.playedRow}> 
                            {lastPlayed.map((c, i) => <MiniCard key={i} cardVal={c} index={i} />)}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// ==========================================
// 主组件: GameScreen
// ==========================================
export const GameScreen = () => {
    const { players, mySocketId, gameLogs } = useGame();

    // 身份同步保护
    const myPlayerExists = players.some(p => p.id === mySocketId);
    if (!myPlayerExists && players.length > 0) {
        return <div style={{...styles.gameTable, color:'white', display:'flex', justifyContent:'center', alignItems:'center'}}>正在同步数据...</div>;
    }

    return (
        <div style={styles.gameTable} onMouseUp={() => { /* 全局鼠标抬起事件通常用于取消拖拽，已在 Hook 中处理 */ }}>
            <div style={styles.gameSafeArea}>
                
                {/* 1. 左上角日志 */}
                <div className="gameLogPanel">
                     <GameLogPanel logs={gameLogs} />
                </div>

                {/* 2. 顶部 Header */}
                <GameHeader />

                {/* 3. 桌面中间区域 (底分、消息、出牌) */}
                <TableCenterArea />

                {/* 4. 结算弹窗 (如果有) */}
                <SettlementModal />

                {/* 5. 玩家头像布局 */}
                <PlayerLayout />

                {/* 6. 底部手牌区域 */}
                <HandArea />

                {/* 7. 底部操作按钮 */}
                <GameActionBar />

            </div>
            
            {/* 全局样式注入 (Bot/托管 Badge) */}
            <style>{`.statusBadgeBot { background: #34495e; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); } .statusBadgeAuto { background: #e67e22; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); animation: pulse 2s infinite; } @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`}</style>
        </div>
    );
};