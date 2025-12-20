import React, { useState, useEffect } from 'react';
import { RotateCcw, Zap, Lightbulb, Clock, Loader2, AlertTriangle } from 'lucide-react';
import css from './GameActionBar.module.css';
import { useGame } from '../../context/GameContext.jsx';
import TimerComponent from '../CountDownTimer.jsx';
// [新增] 引入 isBomb 工具函数
import { isBomb } from '../../utils/cardLogic.js';

export const GameActionBar = () => {
    const { 
        winner, roundResult, grandResult, selectedCards, 
        playersInfo, mySocketId, currentTurnId, players, turnRemaining,
        handleClearSelection, handleToggleAutoPlay, handlePass, handleRequestHint, handlePlayCards,
        isSubmitting, lastPlayerName // [修改] 获取上家名字
    } = useGame();

    // [新增] 确认状态：false=正常, true=待确认(管队友)
    const [confirmState, setConfirmState] = useState(false);

    // [新增] 当选牌变化或轮次变化时，重置确认状态
    useEffect(() => {
        setConfirmState(false);
    }, [selectedCards, currentTurnId]);

    if (winner || roundResult || grandResult) return null;

    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;
    
    const myTurn = currentTurnId === mySocketId;
    const currentTurnPlayer = players.find(p => p.id === currentTurnId);
    const waitingText = currentTurnPlayer ? `等待 ${currentTurnPlayer.name}...` : '等待中...';

    // [新增] 智能出牌点击处理
    const handlePlayClick = () => {
        if (isSubmitting) return;
        
        // 1. 如果没选牌，直接透传给原函数处理(原函数会弹Alert)
        if (selectedCards.length === 0) {
            handlePlayCards();
            return;
        }

        // 2. 队友误伤检测逻辑
        const lastPlayer = players.find(p => p.name === lastPlayerName);
        const isTeammate = 
            myInfo.team !== undefined && myInfo.team !== null && // 我在队伍中
            lastPlayer && lastPlayer.id !== mySocketId &&        // 上家存在且不是我
            playersInfo[lastPlayer.id]?.team === myInfo.team;    // 上家是队友

        // [修改] 增加 isBomb 判断：只有用炸弹管队友才弹窗
        const playingBomb = isBomb(selectedCards);

        // 3. 如果是炸弹压队友，且还没确认过
        if (isTeammate && playingBomb && !confirmState) {
            setConfirmState(true);
            // 3秒后自动恢复，防止卡住
            setTimeout(() => setConfirmState(false), 3000);
            return;
        }

        // 4. 正常出牌
        handlePlayCards();
        setConfirmState(false);
    };

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