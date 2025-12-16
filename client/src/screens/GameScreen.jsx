// 游戏主界面 - 深度适配移动端布局，增加了全屏按钮
import React, { useState } from 'react';
import { Coins, Layers, Crown, Clock, Bot, Zap, Maximize, Minimize } from 'lucide-react';
import { styles } from '../styles.js'; 
import { Card, MiniCard, PlayerAvatar, GameLogPanel } from '../components/BaseUI.jsx';
import { calculateCardSpacing } from '../utils/cardLogic.js';

export const GameScreen = ({ 
    roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
    infoMessage, winner, playerScores, playersInfo, pendingPoints, gameLogs, sortMode,
    mySocketId, roundResult, grandResult, roomConfig,
    turnRemaining, finishedRank = [], 
    toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
    handleToggleAutoPlay 
}) => {
    const isMyTurn = currentTurnId === mySocketId;
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    const cardSpacing = calculateCardSpacing(myHand.length, window.innerWidth);
    
    const myInfo = (playersInfo && playersInfo[mySocketId]) || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const isCrowded = players.length > 6;
    const avatarScale = isCrowded ? 0.85 : 1;
    const avatarStyleOverride = isCrowded ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    // [新增] 全屏状态控制
    const [isFullScreen, setIsFullScreen] = useState(false);

    // [新增] 切换全屏逻辑
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => setIsFullScreen(true))
                .catch(err => {
                    console.error("全屏启用失败:", err);
                    // 很多 iPhone 不支持 requestFullscreen，这里可以给个提示或者静默失败
                    // 但有了 PWA 方案作为后备，这里静默即可
                });
        } else {
            document.exitFullscreen()
                .then(() => setIsFullScreen(false))
                .catch(err => console.error(err));
        }
    };

    return (
        <div style={styles.gameTable} onMouseUp={() => { /* Global Mouse Up Handled in App */ }}>
            <div className="gameLogPanel">
                 <GameLogPanel logs={gameLogs} />
            </div>

            <div style={styles.tableHeader}>
                <div style={styles.roomBadge}>Room {roomId}</div>
                <div style={styles.scoreBoard}>
                    <div style={{fontSize: 12, opacity: 0.8, textTransform:'uppercase'}}>Table Points</div>
                    <div style={{fontSize: 32, fontWeight: 'bold', color: '#f1c40f', display:'flex', alignItems:'center', gap:8}}><Coins size={28} /> {pendingPoints}</div>
                </div>
                
                {/* [修改] 右上角按钮组 */}
                <div style={{display:'flex', gap: 10}}>
                    {/* [新增] 全屏按钮 */}
                    <button 
                        style={{...styles.glassButton, padding: '8px 12px'}} 
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

            <div style={styles.infoMessage}>{infoMessage}</div>

            {/* 弹窗区域 */}
            {(winner || roundResult || grandResult) && (
                <div style={styles.modalOverlay}>
                    {className="modal-content-wrapper"}    
                    <div style={styles.modalContent}>
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

            <div style={styles.tableCenter} className="mobile-table-center">
                {lastPlayed.length > 0 && (
                    <div style={{animation: 'popIn 0.3s'}}>
                        <div style={styles.playerNameTag}>{lastPlayerName}</div>
                        <div style={styles.playedRow} className="mini-card-container"> 
                            {lastPlayed.map((c, i) => <MiniCard key={i} cardVal={c} index={i} />)}
                        </div>
                    </div>
                )}
            </div>

            <div style={styles.playersArea} className="mobile-players-area">
                {players.map((p, i) => {
                    const info = (playersInfo && playersInfo[p.id]) || {};
                    const isBot = info.isBot || p.isBot;
                    const isAuto = info.isAutoPlay;
                    const rankIndex = finishedRank ? finishedRank.indexOf(p.id) : -1;
                    const finishedRankVal = rankIndex !== -1 ? rankIndex + 1 : null;

                    return (
                        <div key={i} style={{...avatarStyleOverride, position:'relative'}} className="mobile-avatar-scale"> 
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
                })}
            </div>

            <div 
                style={{
                    ...styles.handArea, 
                    opacity: amIAutoPlay ? 0.6 : 1, 
                    filter: amIAutoPlay ? 'grayscale(0.6)' : 'none',
                    pointerEvents: amIAutoPlay ? 'none' : 'auto' 
                }}
                className="mobile-hand-area"
            >
                {amIAutoPlay && (
                    <div style={{
                        position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(230, 126, 34, 0.9)', color: 'white', padding: '5px 15px', 
                        borderRadius: 20, fontSize: 14, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 50
                    }}>
                        <Bot size={16} /> 系统代打中...
                    </div>
                )}
                
                {myHand.map((c, i) => (
                    <Card key={`${c}-${i}`} cardVal={c} index={i} isSelected={selectedCards.includes(c)} onClick={handleMouseDown} onMouseEnter={handleMouseEnter} spacing={cardSpacing} />
                ))}
            </div>

            <div style={styles.actionBar} className="action-bar-container">
                {!winner && !roundResult && !grandResult && (
                    <div style={{display:'flex', alignItems: 'center', gap: 20}}>
                        {amIAutoPlay ? (
                            <button 
                                style={{
                                    ...styles.playButton, 
                                    background: '#e74c3c', 
                                    width: 220,
                                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                                }} 
                                onClick={handleToggleAutoPlay}
                            >
                                <Zap size={22} style={{marginRight:8}}/> 取消托管
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
                                        padding: '0 20px',
                                        height: 50,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        marginLeft: 20,
                                        fontSize: 16,
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={handleToggleAutoPlay}
                                    title="点击开启系统托管"
                                >
                                    <Zap size={20} style={{marginRight: 6}} />
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