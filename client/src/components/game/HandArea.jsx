import React, { useState, useEffect } from 'react';
import { Bot, Eye } from 'lucide-react';
import css from './HandArea.module.css'; 
import { Card } from '../BaseUI.jsx';
import { calculateCardSpacing, sortHand } from '../../utils/cardLogic.js';
import { useGame } from '../../context/GameContext.jsx';
import { useHandGesture } from '../../hooks/useHandGesture.js';

export const HandArea = () => {
    const { 
        myHand, selectedCards, handleMouseDown, handleMouseEnter, 
        playersInfo, mySocketId,
        observedHands, isSpectator // [新增]
    } = useGame();
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const [dimensions, setDimensions] = useState({ width: window.innerWidth });
    
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // [新增] 决定显示谁的手牌
    let displayHand = myHand;
    let isWatching = false;
    let watchingName = '';

    // 如果我自己没牌了 (或者我是观众)，且有观察到的手牌
    if ((myHand.length === 0 || isSpectator) && Object.keys(observedHands).length > 0) {
        // 简单策略：显示第一个观察到的非空手牌
        const targetId = Object.keys(observedHands).find(id => observedHands[id] && observedHands[id].length > 0);
        if (targetId) {
            // 对观察的手牌进行排序，确保显示整齐
            displayHand = sortHand(observedHands[targetId], 'POINT'); 
            isWatching = true;
            // 尝试获取名字，需从 playersInfo 或 players 中找 (Context里 players可能没传进来)
            // 这里简单用ID，或者稍微修改 Context 传入 players
            // 假设我们只能拿到 ID，UI 显示 "正在观看队友" 即可
        }
    }

    const cardSpacing = calculateCardSpacing(displayHand.length, dimensions.width);

    // 只有操作自己的手牌才启用手势
    const handContainerRef = useHandGesture({
        myHand: isWatching ? [] : displayHand, // 观看模式下禁用交互
        selectedCards: isWatching ? [] : selectedCards, 
        cardSpacing, 
        handleMouseDown, 
        amIAutoPlay
    });

    const containerClass = [
        css.handArea,
        amIAutoPlay ? css.autoPlayMode : ''
    ].join(' ');

    return (
        <div ref={handContainerRef} className={containerClass}>
            {amIAutoPlay && !isWatching && (
                <div className={css.autoPlayBadge}>
                    <Bot size={14} /> 系统代打中
                </div>
            )}

            {/* [新增] 观看模式提示 */}
            {isWatching && (
                <div className={css.autoPlayBadge} style={{background: '#3498db'}}>
                    <Eye size={14} /> 正在观看队友视角
                </div>
            )}
            
            {displayHand.map((c, i) => (
                <Card 
                    key={`${c}-${i}`} 
                    cardVal={c} 
                    index={i} 
                    isSelected={!isWatching && selectedCards.includes(c)} 
                    onClick={isWatching ? ()=>{} : handleMouseDown} 
                    onMouseEnter={isWatching ? ()=>{} : handleMouseEnter} 
                    spacing={cardSpacing} 
                />
            ))}
        </div>
    );
};