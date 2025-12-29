import React, { useState, useEffect } from 'react';
import { RotateCcw, Zap, Lightbulb, Clock, Loader2, AlertTriangle, Repeat, Shield, Coins, Coffee, Eye, ClipboardList, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import css from './GameActionBar.module.css';
import { useGame } from '../../context/GameContext.jsx';
import TimerComponent from '../CountDownTimer.jsx';
import { isBomb } from '../../utils/cardLogic.js';

// [修改] 接收回调
export const GameActionBar = ({ onShowSettlement }) => {
    const { 
        winner, roundResult, grandResult, selectedCards, 
        playersInfo, mySocketId, currentTurnId, players, turnRemaining,
        handleClearSelection, handleToggleAutoPlay, handleSwitchAutoPlayMode,
        handlePass, handleRequestHint, handlePlayCards,
        isSubmitting, lastPlayerName,
        isSpectator, observedHands,
        // [新增]
        isRoundOver, readyPlayers, handlePlayerReady,
        // [新增] 观看控制
        watchedPlayerId, setWatchedPlayerId
    } = useGame();

    const [confirmState, setConfirmState] = useState(false);

    useEffect(() => {
        setConfirmState(false);
    }, [selectedCards, currentTurnId]);

    // 切换观看对象
    const cycleWatchedPlayer = (direction) => {
        const availableIds = Object.keys(observedHands);
        if (availableIds.length <= 1) return;
        
        const currentIndex = availableIds.indexOf(watchedPlayerId);
        if (currentIndex === -1 && availableIds.length > 0) {
            setWatchedPlayerId(availableIds[0]);
            return;
        }

        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % availableIds.length;
        } else {
            nextIndex = (currentIndex - 1 + availableIds.length) % availableIds.length;
        }
        setWatchedPlayerId(availableIds[nextIndex]);
    };

    // [新增] 结束状态的特殊 ActionBar
    // [修复] 增加 grandResult 判断：如果大局结束，不显示准备按钮（只允许查看战绩，重开需走结算窗）
    if (isRoundOver) {
        const isReady = readyPlayers.includes(mySocketId);
        return (
            <div className={css.actionBar}>
                <div className={css.buttonGroup}>
                    {/* 查看战绩 */}
                    <button 
                        className={css.btnSecondary}
                        onClick={onShowSettlement}
                        style={{background: '#34495e', padding: '10px 20px'}}
                    >
                        <ClipboardList size={18} style={{marginRight:5}} /> 查看战绩
                    </button>

                    {/* 准备按钮：仅当大局未结束时显示 */}
                    {!grandResult && (
                        <button 
                            className={isReady ? css.btnSecondary : css.btnPlay}
                            onClick={handlePlayerReady}
                            disabled={isReady} // 准备后不可取消
                            style={isReady ? {background: '#27ae60', opacity: 0.8, cursor: 'default'} : {padding: '10px 30px'}}
                        >
                            {isReady ? (
                                <><CheckCircle size={18} style={{marginRight:5}} /> 已准备</>
                            ) : (
                                '准备下一局'
                            )}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (winner || roundResult || grandResult) return null;

    // [修改] 统一处理观战状态 (纯观众 OR 已完赛玩家)
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;
    const currentMode = myInfo.autoPlayMode || 'SMART';
    
    // 是否处于观战状态 (纯观众 或 玩家已出完且有队友可看)
    // 逻辑：如果我是观众(isSpectator)，或者我有观察权限且我自己没牌了(手牌数0)
    // 注意：myInfo.handCount 可能有延迟，这里直接用 observedHands 和 myInfo 判断更准
    // 但为了简化，如果 observedHands 有值且我不是正在打牌的人(或者我手牌空了)，就显示观战条
    
    const myHandCount = playersInfo[mySocketId] ? (playersInfo[mySocketId].handCount || 0) : 0;
    // 如果我是观众，myHandCount通常为0或者undefined
    // 只要有 observedHands，且 (是观众 OR 我手牌为0)，就显示切换条
    
    const isWatchingMode = isSpectator || (Object.keys(observedHands).length > 0 && myHandCount === 0);

    if (isWatchingMode && Object.keys(observedHands).length > 0) {
        const watchedName = players.find(p => p.id === watchedPlayerId)?.name || '未知';
        const availableCount = Object.keys(observedHands).length;

        return (
             <div className={css.actionBar}>
                <div className={css.spectatorGroup}>
                    {/* [修改] 将布局调整为： 左箭头 - 信息 - 右箭头 */}
                    {availableCount > 1 && (
                        <button className={css.spectatorBtn} onClick={() => cycleWatchedPlayer('prev')}>
                            <ChevronLeft size={28} />
                        </button>
                    )}

                    <div className={css.spectatorInfo}>
                        <Eye size={18} style={{marginRight:5}}/> 
                        <span>观看: <span style={{color: '#f1c40f'}}>{watchedName}</span></span>
                    </div>

                    {availableCount > 1 && (
                        <button className={css.spectatorBtn} onClick={() => cycleWatchedPlayer('next')}>
                            <ChevronRight size={28} />
                        </button>
                    )}
                </div>
            </div>
        );
    }
    
    // 如果是纯观战但还没有手牌数据传过来 (刚进房间/没人出完)
    if (isSpectator) {
         return (
             <div className={css.actionBar}>
                <div className={css.waitingBadge}>
                    <Eye size={20} /> 正在观战中...
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