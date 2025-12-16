// 游戏主界面 - 深度适配移动端布局，增加了全屏按钮
import React, { useState } from 'react';
import { Coins, Layers, Crown, Clock, Bot, Zap, Maximize, Minimize } from 'lucide-react';
import { styles } from '../styles.js'; 
import { Card, MiniCard, PlayerAvatar, GameLogPanel } from '../components/BaseUI.jsx';
import { calculateCardSpacing } from '../utils/cardLogic.js';

export const GameScreen = ({ 
    roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
    infoMessage: serverInfoMessage, winner, playerScores, playersInfo, pendingPoints, gameLogs, sortMode,
    mySocketId, roundResult, grandResult, roomConfig,
    turnRemaining, finishedRank = [], 
    toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
    handleToggleAutoPlay 
}) => {
    const isMyTurn = currentTurnId === mySocketId;
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    
    // 手牌区域宽度 (留出左边的头像位置)
    const handAreaWidth = window.innerWidth - 100; 
    const cardSpacing = calculateCardSpacing(myHand.length, handAreaWidth);
    
    const myInfo = (playersInfo && playersInfo[mySocketId]) || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const isCrowded = players.length > 6;
    const avatarScale = isCrowded ? 0.85 : 1;
    const avatarStyleOverride = isCrowded ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    const [localInfo, setLocalInfo] = useState('');
    const displayMessage = localInfo || serverInfoMessage;

    const [isFullScreen, setIsFullScreen] = useState(false);

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
    const renderPlayers = () => {
        const myIndex = players.findIndex(p => p.id === mySocketId);
        // 如果找不到自己（观战模式？），默认第一个视角
        const safeMyIndex = myIndex === -1 ? 0 : myIndex;
        
        // 重新排序数组，把自己放在第一个，然后依次是下家、下下家...
        // 但为了布局 "左 -> 上 -> 右"，我们需要重新映射
        // 假设 players 是 [我, A, B, C]
        // 我们需要把 A, B, C 分配到 左, 上, 右
        
        const otherPlayers = [];
        for (let i = 1; i < players.length; i++) {
            const idx = (safeMyIndex + i) % players.length;
            otherPlayers.push(players[idx]);
        }

        // 简单的分配逻辑
        const layoutConfig = [];
        const totalOthers = otherPlayers.length;
        
        // 只有1个对手 -> 上
        if (totalOthers === 1) {
            layoutConfig.push({ p: otherPlayers[0], pos: { top: 10, left: '50%', transform: 'translateX(-50%)' } });
        } 
        // 2个对手 -> 左, 右 (或者 左, 上) -> 用户说 "左边 上面 右边"，那应该是顺时针
        else if (totalOthers === 2) {
            layoutConfig.push({ p: otherPlayers[0], pos: { top: '40%', right: 10, transform: 'translateY(-50%)' } }); // 下家在右
            layoutConfig.push({ p: otherPlayers[1], pos: { top: '40%', left: 10, transform: 'translateY(-50%)' } });  // 上家在左
        }
        // 3个及以上 -> 分三组
        else {
            const part = Math.ceil(totalOthers / 3);
            const rightGroup = otherPlayers.slice(0, part); // 下家们 -> 右边
            const topGroup = otherPlayers.slice(part, totalOthers - part); // 对家们 -> 上边
            const leftGroup = otherPlayers.slice(totalOthers - part); // 上家们 -> 左边

            // 右边组 (从下往上排，或者垂直居中)
            rightGroup.forEach((p, i) => {
                const step = 80;
                const startY = 50 - ((rightGroup.length - 1) * step / 2 / window.innerHeight * 100); 
                layoutConfig.push({ p, pos: { top: `${40 - (i * 15)}%`, right: 10, transform: 'translateY(-50%)' } });
            });

            // 上边组 (水平居中分布)
            topGroup.forEach((p, i) => {
                // 简单的基于百分比分布
                const center = 50;
                const offset = (i - (topGroup.length - 1) / 2) * 15; // 间距 15%
                layoutConfig.push({ p, pos: { top: 10, left: `${center + offset}%`, transform: 'translateX(-50%)' } });
            });

            // 左边组
            leftGroup.forEach((p, i) => {
                 layoutConfig.push({ p, pos: { top: `${40 - (i * 15)}%`, left: 10, transform: 'translateY(-50%)' } });
            });
        }

        // 添加自己 (固定在左下角)
        const me = players[safeMyIndex];
        const allItems = [
            { p: me, pos: { bottom: 25, left: 10, zIndex: 100 } }, // 提高层级
            ...layoutConfig
        ];

        return allItems.map(({ p, pos }, i) => {
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
            <div className="gameLogPanel">
                 <GameLogPanel logs={gameLogs} />
            </div>

            <div style={styles.tableHeader}>
                <div style={styles.roomBadge}>Room {roomId}</div>
                {/* 计分板已移到中心，Header只留 Room 和 按钮 */}
                
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
                    <Card key={`${c}-${i}`} cardVal={c} index={i} isSelected={selectedCards.includes(c)} onClick={handleMouseDown} onMouseEnter={handleMouseEnter} spacing={cardSpacing} />
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
                                        <button style={styles.playButton} onClick={handlePlayCards}>出牌</button>
                                    </>
                                ) : (
                                    <div style={styles.waitingBadge}><Clock size={20} className="spin" /> 等待对方...</div>
                                )}
                                
                                <button 
                                    style={{
                                        pointerEvents: 'auto', 
                                        background: 'rgba(255,255,255,0.1)', 
                                        border: '1px solid rgba(255,255,255,0.3)',
                                        color: '#ecf0f1',
                                        borderRadius: 30, 
                                        padding: '0 15px',
                                        height: 40,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        marginLeft: 10,
                                        fontSize: 14,
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={handleToggleAutoPlay}
                                    title="点击开启系统托管"
                                >
                                    <Zap size={16} style={{marginRight: 4}} />
                                    托管
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            
            <style>{`
                .statusBadgeBot { background: #34495e; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); }
                .statusBadgeAuto { background: #e67e22; color: white; padding: 2px 6px; borderRadius: 10px; fontSize: 10px; display: flex; align-items: center; gap: 2px; border: 1px solid rgba(255,255,255,0.3); animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
            `}</style>
        </div>
    );
};