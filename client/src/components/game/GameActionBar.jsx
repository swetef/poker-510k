import React from 'react';
import { RotateCcw, Zap, Lightbulb, Clock, Loader2 } from 'lucide-react'; // 增加 Loader2
import { styles } from '../../styles.js';
import { useGame } from '../../context/GameContext.jsx';
import TimerComponent from '../CountDownTimer.jsx';

/**
 * [操作栏组件]
 * 包含：出牌、不要、提示、重选、取消托管等按钮
 */
export const GameActionBar = () => {
    const { 
        winner, roundResult, grandResult, selectedCards, 
        playersInfo, mySocketId, currentTurnId, players, turnRemaining,
        handleClearSelection, handleToggleAutoPlay, handlePass, handleRequestHint, handlePlayCards,
        isSubmitting // [新增] 获取防抖状态
    } = useGame();

    if (winner || roundResult || grandResult) return null;

    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;
    
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
                        disabled={isSubmitting} // 提交中禁用
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
                                <button 
                                    style={{...styles.passButton, opacity: isSubmitting ? 0.6 : 1}} 
                                    onClick={handlePass}
                                    disabled={isSubmitting} // 提交中禁用
                                >
                                    不要
                                </button>
                                
                                <button 
                                    style={{...styles.passButton, background: '#8e44ad', marginRight: 0, padding:'8px 15px', display:'flex', alignItems:'center', gap:5, opacity: isSubmitting ? 0.6 : 1}} 
                                    onClick={handleRequestHint}
                                    disabled={isSubmitting} // 提交中禁用
                                >
                                    <Lightbulb size={16} /> 提示
                                </button>

                                <TimerComponent initialSeconds={turnRemaining} totalSeconds={60} position="inline" />
                                
                                {/* [修改] 增加 Loading 态和禁用逻辑 */}
                                <button 
                                    style={{...styles.playButton, opacity: isSubmitting ? 0.6 : 1, display: 'flex', alignItems:'center', gap: 5}} 
                                    onClick={handlePlayCards}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 size={18} className="spin"/> : '出牌'}
                                </button>
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