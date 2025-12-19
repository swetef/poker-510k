import React from 'react';
import { RotateCcw, Zap, Lightbulb, Clock, Loader2 } from 'lucide-react';
import css from './GameActionBar.module.css'; // 新 CSS
import { useGame } from '../../context/GameContext.jsx';
import TimerComponent from '../CountDownTimer.jsx';

export const GameActionBar = () => {
    const { 
        winner, roundResult, grandResult, selectedCards, 
        playersInfo, mySocketId, currentTurnId, players, turnRemaining,
        handleClearSelection, handleToggleAutoPlay, handlePass, handleRequestHint, handlePlayCards,
        isSubmitting
    } = useGame();

    if (winner || roundResult || grandResult) return null;

    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;
    
    const myTurn = currentTurnId === mySocketId;
    const currentTurnPlayer = players.find(p => p.id === currentTurnId);
    const waitingText = currentTurnPlayer ? `等待 ${currentTurnPlayer.name}...` : '等待中...';

    return (
        <div className={css.actionBar}>
            <div className={css.buttonGroup}>
                {selectedCards.length > 0 && (
                    <button 
                        className={css.btnReset}
                        onClick={handleClearSelection}
                        disabled={isSubmitting}
                    >
                        <RotateCcw size={16} /> 重选
                    </button>
                )}
                
                {amIAutoPlay ? (
                    <button 
                        className={css.btnCancelAuto}
                        onClick={handleToggleAutoPlay}
                    >
                        <Zap size={18} /> 取消托管
                    </button>
                ) : (
                    <>
                        {myTurn ? (
                            <>
                                <button 
                                    className={css.btnSecondary}
                                    onClick={handlePass}
                                    disabled={isSubmitting}
                                >
                                    不要
                                </button>
                                
                                <button 
                                    className={css.btnHint}
                                    onClick={handleRequestHint}
                                    disabled={isSubmitting}
                                >
                                    <Lightbulb size={16} /> 提示
                                </button>

                                <TimerComponent initialSeconds={turnRemaining} totalSeconds={60} position="inline" />
                                
                                <button 
                                    className={css.btnPlay} 
                                    onClick={handlePlayCards}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 size={18} className="spin"/> : '出牌'}
                                </button>
                            </>
                        ) : (
                            <div className={css.waitingBadge}>
                                <Clock size={20} className="spin" /> {waitingText}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};