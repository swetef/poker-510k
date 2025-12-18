import React, { useState, useRef, useEffect } from 'react';
// [修改] 引入 Lightbulb
import { Coins, Layers, Crown, Clock, Bot, Zap, Maximize, Minimize, Shield, RotateCcw, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { styles } from '../styles.js'; 
import { Card, MiniCard, PlayerAvatar, GameLogPanel } from '../components/BaseUI.jsx';
import { ScoreTable } from '../components/ScoreTable.jsx'; 
import TimerComponent from '../components/CountDownTimer.jsx'; 
import { calculateCardSpacing, getCardIndexFromTouch } from '../utils/cardLogic.js'; 

// [新增] 引入 useGame
import { useGame } from '../context/GameContext.jsx';

// [修改] 移除 Props 参数
export const GameScreen = () => {

    // [新增] 从 Context 获取所有数据
    const { 
        roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
        infoMessage: serverInfoMessage, winner, 
        playerScores, // 总分 (Grand + Round)
        roundPoints, // 本局得分
        playersInfo = {}, 
        pendingPoints, gameLogs, sortMode,
        mySocketId, roundResult, grandResult, roomConfig,
        turnRemaining, finishedRank = [], 
        handCounts = {}, 
        toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
        handleToggleAutoPlay, handleClearSelection, handleRequestHint 
    } = useGame();

    // 身份同步保护
    const myPlayerExists = players.some(p => p.id === mySocketId);
    if (!myPlayerExists && players.length > 0) {
        return <div style={{...styles.gameTable, color:'white', display:'flex', justifyContent:'center', alignItems:'center'}}>正在同步数据...</div>;
    }

    const isMyTurn = currentTurnId === mySocketId;
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    
    // --- 屏幕尺寸 ---
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handAreaWidth = dimensions.width; 
    const cardSpacing = calculateCardSpacing(myHand.length, handAreaWidth);
    
    const myInfo = (playersInfo && playersInfo[mySocketId]) || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const isCrowded = players.length > 6;
    const avatarScale = isCrowded ? 0.85 : 1;
    const avatarStyleOverride = isCrowded ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    const [localInfo, setLocalInfo] = useState('');
    const displayMessage = localInfo || serverInfoMessage;

    const [isFullScreen, setIsFullScreen] = useState(false);
    // [修改] 默认收起状态
    const [isScoreBoardCollapsed, setIsScoreBoardCollapsed] = useState(true);

    const currentTurnPlayer = players.find(p => p.id === currentTurnId);
    const waitingText = currentTurnPlayer ? `等待 ${currentTurnPlayer.name}...` : '等待中...';

    // 计算队伍分数
    const getTeamScores = () => {
        let redScore = 0;
        let blueScore = 0;
        let hasTeams = false;

        players.forEach(p => {
            const pInfo = playersInfo[p.id];
            const score = playerScores[p.id] || 0;
            if (pInfo && pInfo.team !== undefined && pInfo.team !== null) {
                hasTeams = true;
                if (pInfo.team === 0) redScore += score;
                else if (pInfo.team === 1) blueScore += score;
            }
        });

        return { hasTeams, redScore, blueScore };
    };

    const { hasTeams, redScore, blueScore } = getTeamScores();

    // [关键修复] 预处理 Players 数据，合并 Team 信息
    // ScoreTable 组件依赖 player.team 来统计队伍总分，但原始 players 数组可能没有 team 字段（因为它存在于 playersInfo 中）
    const playersWithTeamInfo = players.map(p => ({
        ...p,
        team: (playersInfo[p.id] && playersInfo[p.id].team !== undefined) ? playersInfo[p.id].team : p.team
    }));

    // --- 触摸逻辑 ---
    const handContainerRef = useRef(null);
    const lastTouchedIndex = useRef(null);
    const isDragging = useRef(false);
    const dragStartMode = useRef(true); 

    const stateRef = useRef({ myHand, selectedCards, cardSpacing, handleMouseDown });
    useEffect(() => {
        stateRef.current = { myHand, selectedCards, cardSpacing, handleMouseDown };
    }, [myHand, selectedCards, cardSpacing, handleMouseDown]);

    const onTouchStartLogic = (e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const container = handContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const { myHand: currHand, selectedCards: currSelection, cardSpacing: currSpacing, handleMouseDown: currToggle } = stateRef.current;
        const index = getCardIndexFromTouch(touch.clientX, rect.left, currSpacing, currHand.length);
        const cardVal = currHand[index];
        if (cardVal === undefined) return;

        const isSelected = currSelection.includes(cardVal);
        const CARD_HEIGHT = 70;    
        const POP_HEIGHT = 35;     
        const TOLERANCE = 10;      
        const validVisualHeight = isSelected ? CARD_HEIGHT + POP_HEIGHT + TOLERANCE : CARD_HEIGHT + TOLERANCE;
        const distanceFromBottom = rect.bottom - touch.clientY;

        if (distanceFromBottom > validVisualHeight || distanceFromBottom < -10) {
            isDragging.current = false;
            return;
        }

        isDragging.current = true;
        dragStartMode.current = !currSelection.includes(cardVal);
        lastTouchedIndex.current = index;
        
        if (isSelected !== dragStartMode.current) {
            currToggle(cardVal); 
            if (navigator.vibrate) navigator.vibrate(5);
        }
    };

    const onTouchMoveLogic = (e) => {
        if (e.cancelable) e.preventDefault(); 
        if (!isDragging.current) return;
        const touch = e.touches[0];
        const container = handContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (touch.clientY < rect.top - 50 || touch.clientY > rect.bottom + 50) return;
        const { myHand: currHand, selectedCards: currSelection, cardSpacing: currSpacing, handleMouseDown: currToggle } = stateRef.current;
        const index = getCardIndexFromTouch(touch.clientX, rect.left, currSpacing, currHand.length);
        if (lastTouchedIndex.current !== index) {
            lastTouchedIndex.current = index;
            const cardVal = currHand[index];
            if (cardVal !== undefined) {
                const isSelected = currSelection.includes(cardVal);
                if (isSelected !== dragStartMode.current) {
                    currToggle(cardVal); 
                    if (navigator.vibrate) navigator.vibrate(5);
                }
            }
        }
    };

    const onTouchEndLogic = () => {
        isDragging.current = false;
        lastTouchedIndex.current = null;
    };

    useEffect(() => {
        const container = handContainerRef.current;
        if (!container || amIAutoPlay) return;
        const ts = (e) => onTouchStartLogic(e);
        const tm = (e) => onTouchMoveLogic(e);
        const te = (e) => onTouchEndLogic(e);
        container.addEventListener('touchstart', ts, { passive: false });
        container.addEventListener('touchmove', tm, { passive: false });
        container.addEventListener('touchend', te);
        return () => {
            container.removeEventListener('touchstart', ts);
            container.removeEventListener('touchmove', tm);
            container.removeEventListener('touchend', te);
        };
    }, [amIAutoPlay]); 

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

    const renderPlayers = () => {
        const myIndex = players.findIndex(p => p.id === mySocketId);
        const safeMyIndex = myIndex;
        
        const otherPlayers = [];
        for (let i = 1; i < players.length; i++) {
            const idx = (safeMyIndex + i) % players.length;
            otherPlayers.push(players[idx]);
        }

        const layoutConfig = [];
        const total = otherPlayers.length;
        let countL = 0, countT = 0, countR = 0;

        if (total === 1) { countT = 1; }
        else if (total === 2) { countR = 1; countL = 1; } 
        else if (total === 3) { countR = 1; countT = 1; countL = 1; } 
        else if (total === 4) { countR = 1; countT = 2; countL = 1; } 
        else if (total === 5) { countR = 2; countT = 1; countL = 2; } 
        else {
            countR = 2;
            countL = 2;
            countT = total - 4;
        }

        const rightGroup = otherPlayers.slice(0, countR);
        const topGroup = otherPlayers.slice(countR, countR + countT);
        const leftGroup = otherPlayers.slice(countR + countT);

        rightGroup.forEach((p, i) => {
            const topPos = countR === 1 ? '40%' : (i === 0 ? '55%' : '35%');
            layoutConfig.push({ p, pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, timerPos: 'left' });
        });

        topGroup.forEach((p, i) => {
            let leftPos;
            if (countT === 1) {
                leftPos = '50%';
            } else {
                const start = 20; 
                const end = 80;
                const step = (end - start) / (countT - 1);
                leftPos = `${end - i * step}%`; 
            }
            layoutConfig.push({ p, pos: { top: 10, left: leftPos, transform: 'translateX(-50%)' }, timerPos: 'bottom' });
        });

        leftGroup.forEach((p, i) => {
            const topPos = countL === 1 ? '40%' : (i === 0 ? '35%' : '55%'); 
            layoutConfig.push({ p, pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, timerPos: 'right' });
        });

        const me = players[safeMyIndex];
        const allItems = [
            { p: me, pos: { bottom: 25, left: 20, zIndex: 100 }, hideTimer: true }, 
            ...layoutConfig
        ];

        return allItems.map(({ p, pos, timerPos, hideTimer }, i) => {
            const info = (playersInfo && playersInfo[p.id]) || {};
            const isBot = info.isBot || p.isBot;
            const isAuto = info.isAutoPlay;
            const rankIndex = finishedRank ? finishedRank.indexOf(p.id) : -1;
            const finishedRankVal = rankIndex !== -1 ? rankIndex + 1 : null;
            const team = info.team;
            
            // 获取 roundPoints
            const myRoundPoint = (roundPoints && roundPoints[p.id]) || 0; 

            return (
                <div key={p.id} style={{...avatarStyleOverride, position: 'absolute', ...pos}}> 
                    <PlayerAvatar 
                        player={p} 
                        isTurn={p.id === currentTurnId} 
                        score={playerScores[p.id] || 0} 
                        roundScore={myRoundPoint} 
                        targetScore={roomConfig.targetScore} 
                        isMySocket={p.id === mySocketId}
                        remainingSeconds={turnRemaining}
                        rank={finishedRankVal}
                        timerPosition={timerPos}
                        hideTimer={hideTimer} 
                        cardCount={handCounts[p.id] || 0}
                        showCardCountMode={roomConfig.showCardCountMode}
                        team={team} 
                    />
                    <div style={{position: 'absolute', top: -10, right: -10, display: 'flex', gap: 5}}>
                        {isBot && <div style={styles.statusBadgeBot}><Bot size={12}/> AI</div>}
                        {isAuto && <div style={styles.statusBadgeAuto}><Zap size={12}/> 托管</div>}
                    </div>
                </div>
            );
        });
    };

    // [修改] 顶部队伍比分板 - 适配 Header 内嵌样式
    const renderTopScoreBoard = () => {
        if (!hasTeams) return null;
        return (
            <div style={{ position: 'relative', marginRight: 10, zIndex: 50, pointerEvents: 'auto' }}>
                {/* 按钮主体 */}
                <div 
                    onClick={() => setIsScoreBoardCollapsed(!isScoreBoardCollapsed)}
                    style={{
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '4px 10px', 
                        borderRadius: 20, 
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'background 0.2s'
                    }}
                >
                    <div style={{color:'#e74c3c', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, fontSize: 13}}>
                         <Shield size={12} fill="currentColor"/> {redScore}
                    </div>
                    <div style={{width:1, height:12, background:'rgba(255,255,255,0.2)'}}></div>
                    <div style={{color:'#3498db', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, fontSize: 13}}>
                         <Shield size={12} fill="currentColor"/> {blueScore}
                    </div>
                    {isScoreBoardCollapsed ? <ChevronDown size={14} color="#ccc"/> : <ChevronUp size={14} color="#ccc"/>}
                </div>

                {/* 下拉详情 */}
                {!isScoreBoardCollapsed && (
                    <div style={{
                        position: 'absolute',
                        top: '120%', 
                        right: 0, // 靠右对齐
                        background: 'rgba(30, 40, 50, 0.95)', 
                        borderRadius: 8, 
                        padding: 10,
                        color: 'white', 
                        fontSize: 12, 
                        textAlign: 'center', 
                        width: 140,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(5px)'
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

    return (
        <div style={styles.gameTable} onMouseUp={() => { }}>
            <div style={styles.gameSafeArea}>
                
                <div className="gameLogPanel">
                     <GameLogPanel logs={gameLogs} />
                </div>
                
                {/* [修改] 移除了绝对定位的 TopScoreBoard，移入下方 tableHeader */}

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
                        
                        {/* [修改] 比分板放在这里 (如果有队伍) */}
                        {renderTopScoreBoard()}

                        <div style={{display:'flex', gap: 10}}>
                            <button 
                                style={{...styles.glassButton, padding: '8px 12px', pointerEvents: 'auto'}} 
                                onClick={toggleFullScreen}
                            >
                                {isFullScreen ? <Minimize size={18}/> : <Maximize size={18}/>}
                            </button>

                            <button style={styles.sortButton} onClick={toggleSort}>
                                <Layers size={16} style={{marginRight:5}}/> 
                                {sortMode === 'POINT' ? '点数' : (sortMode === 'SUIT' ? '花色' : '理牌')}
                            </button>
                        </div>
                    </div>
                </div>

                <div style={styles.scoreBoard}>
                    <div style={{fontSize: 10, opacity: 0.8, textTransform:'uppercase'}}>POINTS</div>
                    <div style={{fontSize: 24, fontWeight: 'bold', color: '#f1c40f', display:'flex', alignItems:'center', justifyContent:'center', gap:5}}>
                        <Coins size={20} /> {pendingPoints}
                    </div>
                </div>

                <div style={styles.infoMessage}>{displayMessage}</div>

                {/* 结算弹窗 - 使用新的 ScoreTable */}
                {(winner || roundResult || grandResult) && (
                    <div style={styles.modalOverlay}>
                        {/* [修复] 移除 overflow: 'hidden'，改回 auto，并允许横向隐藏，纵向滚动 */}
                        <div className="modal-content-wrapper" style={{
                            ...styles.modalContent, 
                            width: '95%', 
                            maxWidth: 600, 
                            padding: 0, 
                            background: 'white', 
                            overflowY: 'auto', 
                            overflowX: 'hidden'
                        }}>
                            {grandResult ? (
                                <div style={{padding: 20, width: '100%'}}>
                                    <Crown size={60} color="#e74c3c" style={{marginBottom: 10}} />
                                    <h2 style={{fontSize: 28, marginBottom: 5, color:'#2c3e50'}}>
                                        {grandResult.grandWinner} 夺冠!
                                    </h2>
                                    
                                    <div style={{margin: '15px 0'}}>
                                        <ScoreTable 
                                            // [关键修复] 传入带有 Team 信息的 players
                                            players={playersWithTeamInfo} 
                                            matchHistory={grandResult.matchHistory}
                                            currentScores={grandResult.grandScores}
                                            roomConfig={roomConfig}
                                            grandResult={grandResult}
                                        />
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
                                        <ScoreTable 
                                            // [关键修复] 传入带有 Team 信息的 players
                                            players={playersWithTeamInfo} 
                                            matchHistory={roundResult.matchHistory} 
                                            currentScores={roundResult.grandScores}
                                            roomConfig={roomConfig}
                                        />
                                    </div>

                                    {amIHost ? <button style={styles.primaryButton} onClick={handleNextRound}>下一局</button> : <div style={{color:'#999', marginTop:10}}>等待房主...</div>}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

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

                {renderPlayers()}

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
                            key={`${c}-${i}`} 
                            cardVal={c} 
                            index={i} 
                            isSelected={selectedCards.includes(c)} 
                            onClick={handleMouseDown} 
                            onMouseEnter={handleMouseEnter} 
                            spacing={cardSpacing} 
                        />
                    ))}
                </div>

                <div style={styles.actionBar}>
                    {!winner && !roundResult && !grandResult && (
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
                                    {isMyTurn ? (
                                        <>
                                            <button style={styles.passButton} onClick={handlePass}>不要</button>
                                            
                                            {/* [新增] 提示按钮 */}
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
                    )}
                </div>
            </div>
            <style>{`.statusBadgeBot { background: #34495e; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); } .statusBadgeAuto { background: #e67e22; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); animation: pulse 2s infinite; } @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`}</style>
        </div>
    );
};