import React, { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import css from './HandArea.module.css'; // 新的 CSS
import { Card } from '../BaseUI.jsx';
import { calculateCardSpacing } from '../../utils/cardLogic.js';
import { useGame } from '../../context/GameContext.jsx';
import { useHandGesture } from '../../hooks/useHandGesture.js';

export const HandArea = () => {
    const { 
        myHand, selectedCards, handleMouseDown, handleMouseEnter, 
        playersInfo, mySocketId 
    } = useGame();
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const [dimensions, setDimensions] = useState({ width: window.innerWidth });
    
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const cardSpacing = calculateCardSpacing(myHand.length, dimensions.width);

    const handContainerRef = useHandGesture({
        myHand, selectedCards, cardSpacing, handleMouseDown, amIAutoPlay
    });

    const containerClass = [
        css.handArea,
        amIAutoPlay ? css.autoPlayMode : ''
    ].join(' ');

    return (
        <div ref={handContainerRef} className={containerClass}>
            {amIAutoPlay && (
                <div className={css.autoPlayBadge}>
                    <Bot size={14} /> 系统代打中
                </div>
            )}
            
            {myHand.map((c, i) => (
                <Card 
                    key={`${c}-${i}`} 
                    cardVal={c} 
                    index={i} 
                    isSelected={selectedCards.includes(c)} 
                    onClick={handleMouseDown} 
                    onMouseEnter={handleMouseEnter} 
                    spacing={cardSpacing} 
                />
            ))}
        </div>
    );
};