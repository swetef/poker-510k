import React, { useState, useEffect } from 'react';
import { RotateCcw, Zap, Lightbulb, Clock, Loader2, AlertTriangle, Repeat, Shield, Coins, Coffee, Eye } from 'lucide-react';
import css from './GameActionBar.module.css';
import { useGame } from '../../context/GameContext.jsx';
import TimerComponent from '../CountDownTimer.jsx';
import { isBomb } from '../../utils/cardLogic.js';

export const GameActionBar = () => {
    const { 
        winner, roundResult, grandResult, selectedCards, 
        playersInfo, mySocketId, currentTurnId, players, turnRemaining,
        handleClearSelection, handleToggleAutoPlay, handleSwitchAutoPlayMode,
        handlePass, handleRequestHint, handlePlayCards,
        isSubmitting, lastPlayerName,
        isSpectator, observedHands // [新增]
    } = useGame();

    const [confirmState, setConfirmState] = useState(false);

    useEffect(() => {
        setConfirmState(false);
    }, [selectedCards, currentTurnId]);

    if (winner || roundResult || grandResult) return null;

    // [新增] 如果是观众，显示简单的状态栏
    if (isSpectator) {
        return (
             <div className={css.actionBar}>
                <div className={css.waitingBadge}>
                    <Eye size={20} /> 正在观战中...
                </div>
            </div>
        );
    }

    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;
    const currentMode = myInfo.autoPlayMode || 'SMART';
    
    // [新增] 如果已经打完牌了 (赢了)，显示观看状态
    // 通过判断手牌数 (myHand 在 Context 里，但这里没解构，可以用 observedHands 侧面判断)
    // 更简单的判断：如果在 observedHands 里有数据，说明我已经 finished 并且收到了推送
    const isFinishedAndWatching = Object.keys(observedHands).length > 0;
    
    if (isFinishedAndWatching) {
        return (
            <div className={css.actionBar}>
                <div className={css.waitingBadge} style={{background: 'rgba(52, 152, 219, 0.4)'}}>
                    <Eye size={20} /> 已完赛，观看队友中
                </div>
            </div>
        );
    }
    
    const myTurn = currentTurnId === mySocketId;
    const currentTurnPlayer = players.find(p => p.id === currentTurnId);
    const waitingText = currentTurnPlayer ? `等待 ${currentTurnPlayer.name}...` : '等待中...';

    const handlePlayClick = () => {
        if (isSubmitting) return;
        
        if (selectedCards.length === 0) {
            handlePlayCards();
            return;
        }

        const lastPlayer = players.find(p => p.name === lastPlayerName);
        const isTeammate = 
            myInfo.team !== undefined && myInfo.team !== null && 
            lastPlayer && lastPlayer.id !== mySocketId && 
            playersInfo[lastPlayer.id]?.team === myInfo.team;

        const playingBomb = isBomb(selectedCards);

        if (isTeammate && playingBomb && !confirmState) {
            setConfirmState(true);
            setTimeout(() => setConfirmState(false), 3000);
            return;
        }

        handlePlayCards();
        setConfirmState(false);
    };

    const cycleMode = () => {
        const modes = ['SMART', 'THRIFTY', 'AFK'];
        const currentIdx = modes.indexOf(currentMode);
        const nextMode = modes[(currentIdx + 1) % modes.length];
        handleSwitchAutoPlayMode(nextMode);
    };

    const getModeLabel = (mode) => {
        switch(mode) {
            case 'SMART': return { text: '智能(保队友)', icon: <Shield size={14} />, color: '#2ecc71' };
            case 'THRIFTY': return { text: '省钱(无分不炸)', icon: <Coins size={14} />, color: '#f1c40f' };
            case 'AFK': return { text: '躺平(全不要)', icon: <Coffee size={14} />, color: '#95a5a6' };
            default: return { text: '智能', icon: <Shield size={14} />, color: '#2ecc71' };
        }
    };

    const modeInfo = getModeLabel(currentMode);

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
                    <div className={css.autoPlayGroup}>
                        <button 
                            className={css.btnModeSwitch}
                            onClick={cycleMode}
                            style={{borderColor: modeInfo.color, color: modeInfo.color}}
                        >
                            {modeInfo.icon} {modeInfo.text} <Repeat size={12} style={{opacity:0.6}}/>
                        </button>

                        <button 
                            className={css.btnCancelAuto}
                            onClick={handleToggleAutoPlay}
                        >
                            <Zap size={18} /> 取消托管
                        </button>
                    </div>
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
                                    className={confirmState ? css.btnWarning : css.btnPlay} 
                                    onClick={handlePlayClick}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={18} className="spin"/>
                                    ) : (
                                        confirmState ? (
                                            <>
                                                <AlertTriangle size={18} /> 确认炸队友?
                                            </>
                                        ) : '出牌'
                                    )}
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