// 游戏主界面 - 深度适配移动端布局，增加了全屏按钮
// [完整无删减版]
import React, { useState, useRef, useEffect } from 'react';
import { Coins, Layers, Crown, Clock, Bot, Zap, Maximize, Minimize } from 'lucide-react';
import { styles } from '../styles.js'; 
import { Card, MiniCard, PlayerAvatar, GameLogPanel } from '../components/BaseUI.jsx';
import TimerComponent from '../components/CountDownTimer.jsx'; // 修正导入路径
import { calculateCardSpacing, getCardIndexFromTouch } from '../utils/cardLogic.js'; // 引入滑动计算辅助
import SoundManager from '../utils/SoundManager.js';

export const GameScreen = ({ 
    roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
    infoMessage: serverInfoMessage, winner, playerScores, playersInfo, pendingPoints, gameLogs, sortMode,
    mySocketId, roundResult, grandResult, roomConfig,
    turnRemaining, finishedRank = [], 
    handCounts = {}, // [新增] 接收手牌数
    toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
    handleToggleAutoPlay 
}) => {
    const isMyTurn = currentTurnId === mySocketId;
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    
    // --- 屏幕尺寸与布局计算 ---
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handAreaWidth = dimensions.width; // 使用动态宽度
    const cardSpacing = calculateCardSpacing(myHand.length, handAreaWidth);
    
    const myInfo = (playersInfo && playersInfo[mySocketId]) || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const isCrowded = players.length > 6;
    const avatarScale = isCrowded ? 0.85 : 1;
    const avatarStyleOverride = isCrowded ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    const [localInfo, setLocalInfo] = useState('');
    const displayMessage = localInfo || serverInfoMessage;

    const [isFullScreen, setIsFullScreen] = useState(false);

    // [修改] 获取当前正在操作的玩家名字，用于显示“等待 xxx”
    const currentTurnPlayer = players.find(p => p.id === currentTurnId);
    const waitingText = currentTurnPlayer ? `等待 ${currentTurnPlayer.name}...` : '等待中...';

    // --- 滑动选牌逻辑 ---
    const handContainerRef = useRef(null);
    const lastTouchedIndex = useRef(null);
    const isDragging = useRef(false);
    const dragStartMode = useRef(true); // true = select, false = deselect

    const handleTouchStart = (e) => {
        isDragging.current = true;
        const touch = e.touches[0];
        const container = handContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const index = getCardIndexFromTouch(touch.clientX, rect.left, cardSpacing, myHand.length);
        const cardVal = myHand[index];

        if (cardVal !== undefined) {
            // 决定起始模式
            dragStartMode.current = !selectedCards.includes(cardVal);
            lastTouchedIndex.current = index;
            
            const isSelected = selectedCards.includes(cardVal);
            if (isSelected !== dragStartMode.current) {
                 handleMouseDown(cardVal); // 触发 toggle
                 if (navigator.vibrate) navigator.vibrate(5);
            }
        }
    };

    const handleTouchMove = (e) => {
        if (e.cancelable) e.preventDefault(); // 防止滚动
        if (!isDragging.current) return;

        const touch = e.touches[0];
        const container = handContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        // 增加一点 Y 轴容错，防止手指稍微滑出就断触
        if (touch.clientY < rect.top - 100 || touch.clientY > rect.bottom + 50) return;

        const index = getCardIndexFromTouch(touch.clientX, rect.left, cardSpacing, myHand.length);
        
        if (lastTouchedIndex.current !== index) {
            lastTouchedIndex.current = index;
            const cardVal = myHand[index];
            if (cardVal !== undefined) {
                const isSelected = selectedCards.includes(cardVal);
                // 只有当牌的状态与我们想要的目标状态不一致时，才触发 toggle
                if (isSelected !== dragStartMode.current) {
                    handleMouseDown(cardVal); 
                    if (navigator.vibrate) navigator.vibrate(5);
                }
            }
        }
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
        lastTouchedIndex.current = null;
    };

    const toggleFullScreen = () => {
        const doc = window.document;
        const docEl = doc.documentElement;
        const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

        if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            if (requestFullScreen) {
                requestFullScreen.call(docEl)
                    .then(() => setIsFullScreen(true))
                    .catch(err => {
                        console.warn("全屏请求被拒绝:", err);
                        setLocalInfo("⚠️ 您的浏览器不支持网页全屏，请使用'添加到主屏幕'功能");
                        setTimeout(() => setLocalInfo(''), 3000);
                    });
            } else {
                setLocalInfo("⚠️ iOS请在Safari菜单选择'添加到主屏幕'以全屏游玩");
                setTimeout(() => setLocalInfo(''), 3000);
            }
        } else {
            if (cancelFullScreen) {
                cancelFullScreen.call(doc)
                    .then(() => setIsFullScreen(false))
                    .catch(err => console.error(err));
            }
        }
    };

    // --- 玩家位置计算逻辑 ---
    // 目标：自己(左下)，其他人(左 -> 上 -> 右)
    // 约束：左右最多2个，不能重叠，剩下放上面
    const renderPlayers = () => {
        const myIndex = players.findIndex(p => p.id === mySocketId);
        const safeMyIndex = myIndex === -1 ? 0 : myIndex;
        
        // 1. 获取除自己以外的对手列表，按顺序排列
        const otherPlayers = [];
        for (let i = 1; i < players.length; i++) {
            const idx = (safeMyIndex + i) % players.length;
            otherPlayers.push(players[idx]);
        }

        const layoutConfig = [];
        const total = otherPlayers.length;

        // 2. 决定各区域人数
        // 左边 (Left), 上面 (Top), 右边 (Right)
        let countL = 0, countT = 0, countR = 0;

        if (total === 1) { countT = 1; }
        else if (total === 2) { countL = 1; countR = 1; } // 铁三角布局
        else if (total === 3) { countL = 1; countT = 1; countR = 1; } // 矩形布局
        else if (total === 4) { countL = 1; countT = 2; countR = 1; } // 避免侧边拥挤，上方放2个
        else if (total === 5) { countL = 2; countT = 1; countR = 2; } // 侧边开始放2个
        else {
            // 人数 >= 6：侧边锁死2个，剩下的全去上面
            countL = 2;
            countR = 2;
            countT = total - 4;
        }

        // 3. 切分数组
        const leftGroup = otherPlayers.slice(0, countL);
        const topGroup = otherPlayers.slice(countL, countL + countT);
        const rightGroup = otherPlayers.slice(countL + countT);

        // 4. 生成坐标
        // 左侧组：垂直分布，倒计时在右侧
        leftGroup.forEach((p, i) => {
            // 逆时针出牌顺序下，优化视觉流转
            const topPos = countL === 1 ? '40%' : (i === 0 ? '55%' : '35%'); 
            layoutConfig.push({ p, pos: { top: topPos, left: 30, transform: 'translateY(-50%)' }, timerPos: 'right' });
        });

        // 顶部组：水平分布，倒计时在下方
        topGroup.forEach((p, i) => {
            let leftPos;
            if (countT === 1) {
                leftPos = '50%';
            } else {
                const start = 20; 
                const end = 80;
                const step = (end - start) / (countT - 1);
                leftPos = `${start + i * step}%`;
            }
            layoutConfig.push({ p, pos: { top: 10, left: leftPos, transform: 'translateX(-50%)' }, timerPos: 'bottom' });
        });

        // 右侧组：垂直分布，倒计时在左侧
        rightGroup.forEach((p, i) => {
            const topPos = countR === 1 ? '40%' : (i === 0 ? '35%' : '55%');
            layoutConfig.push({ p, pos: { top: topPos, right: 10, transform: 'translateY(-50%)' }, timerPos: 'left' });
        });

        // 添加自己 (固定在左下角)，hideTimer=true 因为要在按钮中间显示
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

            return (
                <div key={p.id} style={{...avatarStyleOverride, position: 'absolute', ...pos}}> 
                    <PlayerAvatar 
                        player={p} 
                        isTurn={p.id === currentTurnId} 
                        score={playerScores[p.id] || 0} 
                        targetScore={roomConfig.targetScore} 
                        isMySocket={p.id === mySocketId}
                        remainingSeconds={turnRemaining}
                        rank={finishedRankVal}
                        timerPosition={timerPos}
                        hideTimer={hideTimer} // [新增]
                        // [新增] 传递牌数和配置
                        cardCount={handCounts[p.id] || 0}
                        showCardCountMode={roomConfig.showCardCountMode}
                    />
                    <div style={{position: 'absolute', top: -10, right: -10, display: 'flex', gap: 5}}>
                        {isBot && <div style={styles.statusBadgeBot}><Bot size={12}/> AI</div>}
                        {isAuto && <div style={styles.statusBadgeAuto}><Zap size={12}/> 托管</div>}
                    </div>
                </div>
            );
        });
    };

    return (
        <div style={styles.gameTable} onMouseUp={() => { /* Global Mouse Up Handled in App */ }}>
            <div style={styles.gameSafeArea}>
                
                <div className="gameLogPanel">
                     <GameLogPanel logs={gameLogs} />
                </div>

                <div style={styles.tableHeader}>
                    {/* [修改] 左上角区域：房间号 + 托管按钮 */}
                    <div style={styles.roomBadgeContainer}>
                        <div style={styles.roomBadge}>Room {roomId}</div>
                        
                        <button 
                            style={{
                                pointerEvents: 'auto', 
                                background: amIAutoPlay ? '#e67e22' : 'rgba(255,255,255,0.1)', 
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: '#ecf0f1',
                                borderRadius: 15, 
                                padding: '4px 8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 'bold',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                            onClick={handleToggleAutoPlay}
                            title="点击开启/关闭系统托管"
                        >
                            <Zap size={12} style={{marginRight: 4}} fill={amIAutoPlay ? "currentColor" : "none"}/>
                            {amIAutoPlay ? '托管中' : '托管'}
                        </button>
                    </div>

                    {/* 右上角按钮组 */}
                    <div style={{display:'flex', gap: 10, marginLeft: 'auto'}}>
                        <button 
                            style={{...styles.glassButton, padding: '8px 12px', pointerEvents: 'auto'}} 
                            onClick={toggleFullScreen}
                            title={isFullScreen ? "退出全屏" : "进入全屏"}
                        >
                            {isFullScreen ? <Minimize size={18}/> : <Maximize size={18}/>}
                        </button>

                        <button style={styles.sortButton} onClick={toggleSort}>
                            <Layers size={16} style={{marginRight:5}}/> {sortMode === 'POINT' ? '点数' : '花色'}
                        </button>
                    </div>
                </div>

                {/* 新的中间计分板位置 */}
                <div style={styles.scoreBoard}>
                    <div style={{fontSize: 10, opacity: 0.8, textTransform:'uppercase'}}>POINTS</div>
                    <div style={{fontSize: 24, fontWeight: 'bold', color: '#f1c40f', display:'flex', alignItems:'center', justifyContent:'center', gap:5}}>
                        <Coins size={20} /> {pendingPoints}
                    </div>
                </div>

                <div style={styles.infoMessage}>{displayMessage}</div>

                {/* 弹窗区域 */}
                {(winner || roundResult || grandResult) && (
                    <div style={styles.modalOverlay}>
                        <div className="modal-content-wrapper" style={styles.modalContent}>
                            {grandResult ? (
                                <>
                                    <Crown size={80} color="#e74c3c" style={{marginBottom: 20}} />
                                    <h2 style={{fontSize: 32, marginBottom: 10, color:'#2c3e50'}}>最终冠军: {grandResult.grandWinner}</h2>
                                    <button style={{...styles.primaryButton, fontSize: 18}} onClick={handleStartGame}>重新开始</button>
                                </>
                            ) : roundResult ? (
                                <>
                                    <Coins size={60} color="#f1c40f" style={{marginBottom: 20}} />
                                    <h2 style={{fontSize: 28}}>小局结束</h2>
                                    <div style={{fontSize: 20}}>胜者: <span style={{color:'#27ae60'}}>{roundResult.roundWinner}</span></div>
                                    <div style={{fontSize: 32, fontWeight:'bold', color:'#f1c40f', margin:'10px 0'}}>+{roundResult.pointsEarned} 分</div>
                                    
                                    <div style={{
                                        color:'#666', fontSize:14, marginBottom:30, 
                                        whiteSpace: 'pre-wrap', lineHeight: '1.6', 
                                        maxHeight: 200, overflowY: 'auto', textAlign: 'left',
                                        background: '#f8f9fa', padding: 15, borderRadius: 8
                                    }}>
                                        {roundResult.detail}
                                    </div>

                                    {amIHost ? <button style={styles.primaryButton} onClick={handleNextRound}>下一局</button> : <div style={{color:'#999'}}>等待房主...</div>}
                                </>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* 出牌区 - 绝对居中 */}
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

                {/* 玩家区域 - 绝对定位 */}
                {renderPlayers()}

                <div 
                    ref={handContainerRef}
                    style={{
                        ...styles.handArea, 
                        opacity: amIAutoPlay ? 0.6 : 1, 
                        filter: amIAutoPlay ? 'grayscale(0.6)' : 'none',
                        // [新增] 仅 amIAutoPlay 时禁用事件
                        pointerEvents: amIAutoPlay ? 'none' : 'auto' 
                    }}
                    // [新增] 绑定 Touch 事件
                    onTouchStart={!amIAutoPlay ? handleTouchStart : undefined}
                    onTouchMove={!amIAutoPlay ? handleTouchMove : undefined}
                    onTouchEnd={!amIAutoPlay ? handleTouchEnd : undefined}
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
                            {amIAutoPlay ? (
                                <button 
                                    style={{
                                        ...styles.playButton, 
                                        background: '#e74c3c', 
                                        width: 180,
                                        fontSize: 16,
                                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                                    }} 
                                    onClick={handleToggleAutoPlay}
                                >
                                    <Zap size={18} style={{marginRight:8}}/> 取消托管
                                </button>
                            ) : (
                                <>
                                    {isMyTurn ? (
                                        <>
                                            <button style={styles.passButton} onClick={handlePass}>不要</button>
                                            
                                            {/* [修改] 自己的倒计时放在这里 (使用 inline 模式) */}
                                            <TimerComponent initialSeconds={turnRemaining} totalSeconds={60} position="inline" />
                                            
                                            <button style={styles.playButton} onClick={handlePlayCards}>出牌</button>
                                        </>
                                    ) : (
                                        // [修改] 显示具体的等待人名
                                        <div style={styles.waitingBadge}><Clock size={20} className="spin" /> {waitingText}</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                .statusBadgeBot { background: #34495e; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); }
                .statusBadgeAuto { background: #e67e22; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
            `}</style>
        </div>
    );
};