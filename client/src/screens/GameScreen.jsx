// 游戏主界面 - 完整修复版
import React from 'react';
import { Coins, Layers, Crown, Clock } from 'lucide-react';
import { styles } from '../styles.js'; // 确保加上 .js 后缀
import { Card, MiniCard, PlayerAvatar, GameLogPanel } from '../components/BaseUI.jsx';
import { calculateCardSpacing } from '../utils/cardLogic.js';

export const GameScreen = ({ 
    roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
    infoMessage, winner, playerScores, pendingPoints, gameLogs, sortMode, 
    mySocketId, roundResult, grandResult, roomConfig,
    turnRemaining, 
    toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame 
}) => {
    const isMyTurn = currentTurnId === mySocketId;
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    const cardSpacing = calculateCardSpacing(myHand.length, window.innerWidth);

    // [新增] 动态计算是否需要紧凑模式 (超过6人时缩小显示)
    const isCrowded = players.length > 6;
    const avatarScale = isCrowded ? 0.85 : 1;
    // 使用 margin 负值来抵消 scale 带来的视觉空白，让排列更紧凑
    const avatarStyleOverride = isCrowded ? { transform: `scale(${avatarScale})`, margin: -5 } : {};

    return (
        <div style={styles.gameTable} onMouseUp={() => { /* Global Mouse Up Handled in App */ }}>
            <GameLogPanel logs={gameLogs} />

            <div style={styles.tableHeader}>
                <div style={styles.roomBadge}>Room {roomId}</div>
                <div style={styles.scoreBoard}>
                    <div style={{fontSize: 12, opacity: 0.8, textTransform:'uppercase'}}>Table Points</div>
                    <div style={{fontSize: 32, fontWeight: 'bold', color: '#f1c40f', display:'flex', alignItems:'center', gap:8}}><Coins size={28} /> {pendingPoints}</div>
                </div>
                <button style={styles.sortButton} onClick={toggleSort}><Layers size={16} style={{marginRight:5}}/> {sortMode === 'POINT' ? '点数' : '花色'}</button>
            </div>

            <div style={styles.infoMessage}>{infoMessage}</div>

            {/* 弹窗区域 */}
            {(winner || roundResult || grandResult) && (
                <div style={styles.modalOverlay}>
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
                                <div style={{color:'#666', fontSize:14, marginBottom:30}}>{roundResult.detail}</div>
                                {amIHost ? <button style={styles.primaryButton} onClick={handleNextRound}>下一局</button> : <div style={{color:'#999'}}>等待房主...</div>}
                            </>
                        ) : null}
                    </div>
                </div>
            )}

            {/* 桌面区域 */}
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

            {/* 玩家区域 - 关键修改点 */}
            {/* 这里的 styles.playersArea 已经在 styles.js 中被修改为 flex-wrap: wrap */}
            <div style={styles.playersArea}>
                {players.map((p, i) => (
                    <div key={i} style={avatarStyleOverride}> 
                        <PlayerAvatar 
                            player={p} 
                            isTurn={p.id === currentTurnId} 
                            score={playerScores[p.id] || 0} 
                            targetScore={roomConfig.targetScore} 
                            isMySocket={p.id === mySocketId}
                            remainingSeconds={turnRemaining}
                        />
                    </div>
                ))}
            </div>

            {/* 手牌区域 */}
            <div style={styles.handArea}>
                {myHand.map((c, i) => (
                    <Card key={`${c}-${i}`} cardVal={c} index={i} isSelected={selectedCards.includes(c)} onClick={handleMouseDown} onMouseEnter={handleMouseEnter} spacing={cardSpacing} />
                ))}
            </div>

            {/* 操作栏 */}
            <div style={styles.actionBar}>
                {!winner && !roundResult && !grandResult && (
                    <div style={{display:'flex', gap: 20}}>
                        {isMyTurn ? (
                            <>
                                <button style={styles.passButton} onClick={handlePass}>不要</button>
                                <button style={styles.playButton} onClick={handlePlayCards}>出牌</button>
                            </>
                        ) : (
                            <div style={styles.waitingBadge}><Clock size={20} className="spin" /> 等待对方...</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};