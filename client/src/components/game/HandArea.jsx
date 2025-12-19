import React, { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { styles } from '../../styles.js';
import { Card } from '../BaseUI.jsx';
import { calculateCardSpacing } from '../../utils/cardLogic.js';
import { useGame } from '../../context/GameContext.jsx';
import { useHandGesture } from '../../hooks/useHandGesture.js';

/**
 * [手牌区域组件]
 * 包含：手牌渲染、触摸手势逻辑、窗口自适应逻辑、托管遮罩
 */
export const HandArea = () => {
    const { 
        myHand, selectedCards, handleMouseDown, handleMouseEnter, 
        playersInfo, mySocketId 
    } = useGame();
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    // 自适应逻辑移入组件内部
    const [dimensions, setDimensions] = useState({ width: window.innerWidth });
    
    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const cardSpacing = calculateCardSpacing(myHand.length, dimensions.width);

    // 绑定手势 Hook
    const handContainerRef = useHandGesture({
        myHand, selectedCards, cardSpacing, handleMouseDown, amIAutoPlay
    });

    return (
        <div 
            ref={handContainerRef}
            style={{
                ...styles.handArea, 
                opacity: amIAutoPlay ? 0.6 : 1, 
                filter: amIAutoPlay ? 'grayscale(0.6)' : 'none',
                pointerEvents: amIAutoPlay ? 'none' : 'auto' 
            }}
        >
            {amIAutoPlay && (
                <div style={{
                    position: 'absolute', top: -40, left: 20,
                    background: 'rgba(230, 126, 34, 0.9)', color: 'white', padding: '5px 10px', 
                    borderRadius: 20, fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 50
                }}>
                    <Bot size={14} /> 系统代打中
                </div>
            )}
            
            {myHand.map((c, i) => (
                <Card 
                    key={`${c}-${i}`} cardVal={c} index={i} 
                    isSelected={selectedCards.includes(c)} 
                    onClick={handleMouseDown} onMouseEnter={handleMouseEnter} 
                    spacing={cardSpacing} 
                />
            ))}
        </div>
    );
};