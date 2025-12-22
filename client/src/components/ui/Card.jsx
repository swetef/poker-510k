import React from 'react';
import { getCardDisplay } from '../../utils/cardLogic.js';
import css from './Card.module.css';

export const Card = ({ cardVal, index, isSelected, onClick, onMouseEnter, spacing }) => {
    const { suit, text, color, isScore } = getCardDisplay(cardVal);
    
    const handlePointerDown = (e) => {
        if (e.pointerType === 'touch') return;
        
        // [修改] PC 端鼠标点击也交由父组件手势 Hook 统一处理
        // 屏蔽此处的 onClick，避免与 useHandGesture 的 mousedown 逻辑冲突（导致点一次触发两次）
        
        /* if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.stopPropagation();
        onClick(cardVal); 
        */
    };

    const containerClasses = [
        css.card,
        isSelected ? css.cardSelected : '',
        isScore ? css.cardScore : css.cardNormal
    ].join(' ');

    return (
        <div 
            className={containerClasses}
            onPointerDown={handlePointerDown}
            onMouseEnter={(e) => {
                // 这个事件主要保留给旧逻辑，但有了 useHandGesture 后其实不再依赖它
                if (e.pointerType === 'mouse') {
                     onMouseEnter(cardVal);
                }
            }}
            style={{
                color: color, 
                left: index * spacing, 
                zIndex: index
            }}
        >
            <div className={css.cardContent}>
                <div className={css.cardText}>{text}</div>
                <div className={css.cardSuit}>{suit}</div>
            </div>
            {isScore && <div className={css.starBadge}>★</div>}
        </div>
    );
};

export const MiniCard = ({ cardVal, index }) => {
    const { text, suit, color, isScore } = getCardDisplay(cardVal);
    
    const miniClasses = [
        css.miniCard,
        isScore ? css.miniCardScore : ''
    ].join(' ');

    return (
        <div 
            className={miniClasses}
            style={{ 
                color,
                zIndex: index 
            }}
        >
            {suit}{text}
        </div>
    );
};