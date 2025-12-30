import React, { useState, useEffect } from 'react';
import { Bot, Eye } from 'lucide-react';
import css from './HandArea.module.css'; 
import { Card } from '../BaseUI.jsx';
import { calculateCardSpacing, sortHand } from '../../utils/cardLogic.js';
import { useGame } from '../../context/GameContext.jsx';
// [修复] 引入缺失的手势交互 Hook
import { useHandGesture } from '../../hooks/useHandGesture.js';

export const HandArea = () => {
    const { 
        myHand, selectedCards, handleMouseDown, handleMouseEnter, 
        playersInfo, mySocketId,
        observedHands, isSpectator,
        watchedPlayerId, players
    } = useGame();
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const [dimensions, setDimensions] = useState({ width: window.innerWidth });
    
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 逻辑：确保显示的手牌数据源正确且有序
    let displayHand = [];
    let isWatching = false;
    let watchingName = '';

    const canWatchOthers = (myHand.length === 0 || isSpectator);
    
    if (canWatchOthers && watchedPlayerId && observedHands[watchedPlayerId]) {
        displayHand = sortHand(observedHands[watchedPlayerId], 'POINT');
        isWatching = true;
        const targetPlayer = players.find(p => p.id === watchedPlayerId);
        watchingName = targetPlayer ? targetPlayer.name : '未知玩家';
    } else {
        // [修复] 直接使用 myHand，因为 Logic 层(useBattleLogic)已经根据 sortMode 对其进行了排序
        // 原代码强制 sortHand(myHand, 'POINT') 导致理牌按钮的排序效果被覆盖
        displayHand = myHand;
        isWatching = false;
    }

    const cardSpacing = calculateCardSpacing(displayHand.length, dimensions.width);

    const containerClass = [
        css.handArea,
        amIAutoPlay ? css.autoPlayMode : ''
    ].join(' ');

    const canInteract = !isWatching && !amIAutoPlay;

    // [修复] 启用手势 Hook，绑定到容器上
    // 这将接管点击和滑动手势，解决点击无反应的问题
    const handRef = useHandGesture({
        myHand: displayHand, // 传入当前显示的有序手牌，确保坐标计算准确
        selectedCards,
        cardSpacing,
        handleMouseDown: (val) => {
            // 再次校验权限，防止观战或托管时误触
            if (canInteract && handleMouseDown) {
                handleMouseDown(val);
            }
        },
        amIAutoPlay
    });

    // 保持旧接口兼容（虽然主要靠 Hook 触发）
    const onCardClick = (val) => {
        if (canInteract && handleMouseDown) {
            handleMouseDown(val);
        }
    };

    const onCardEnter = (val) => {
        if (canInteract && handleMouseEnter) {
            handleMouseEnter(val);
        }
    };

    return (
        // [修复] 将 ref 绑定到容器 div，使手势监听生效
        <div className={containerClass} ref={handRef}>
            {/* 托管状态提示 */}
            {amIAutoPlay && !isWatching && (
                <div className={css.autoPlayBadge}>
                    <Bot size={14} /> 系统代打中
                </div>
            )}

            {/* 观战模式提示 */}
            {isWatching && (
                <div className={css.autoPlayBadge} style={{background: '#3498db', gap: 8}}>
                    <Eye size={14} /> 视角: {watchingName}
                </div>
            )}
            
            {displayHand.map((c, i) => (
                <Card 
                    key={`${c}-${i}`} 
                    cardVal={c} 
                    index={i} 
                    isSelected={!isWatching && selectedCards.includes(c)} 
                    onClick={() => onCardClick(c)} 
                    onMouseEnter={() => onCardEnter(c)} 
                    spacing={cardSpacing} 
                />
            ))}
        </div>
    );
};