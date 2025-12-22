import { useEffect, useRef } from 'react';
import { getCardIndexFromTouch } from '../utils/cardLogic.js';

/**
 * 专门处理手牌区域的触摸滑动 & 鼠标拖拽选择逻辑
 * [修改] 增加了 Mouse 事件支持，适配 PC 端滑动选牌
 */
export const useHandGesture = ({ 
    myHand, 
    selectedCards, 
    cardSpacing, 
    handleMouseDown, // 这里复用原本的点击/选牌处理函数
    amIAutoPlay 
}) => {
    const handContainerRef = useRef(null);
    const lastTouchedIndex = useRef(null);
    const isDragging = useRef(false);
    const dragStartMode = useRef(true); // true=选中模式, false=取消模式

    // 使用 Ref 保存最新状态，避免在 EventListener 中产生闭包陷阱
    const stateRef = useRef({ myHand, selectedCards, cardSpacing, handleMouseDown });

    useEffect(() => {
        stateRef.current = { myHand, selectedCards, cardSpacing, handleMouseDown };
    }, [myHand, selectedCards, cardSpacing, handleMouseDown]);

    // --- 核心手势逻辑 (复用于 Touch 和 Mouse) ---
    const handleGestureStart = (clientX, clientY) => {
        const container = handContainerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const { myHand: currHand, selectedCards: currSelection, cardSpacing: currSpacing, handleMouseDown: currToggle } = stateRef.current;
        
        const index = getCardIndexFromTouch(clientX, rect.left, currSpacing, currHand.length);
        const cardVal = currHand[index];
        if (cardVal === undefined) return;

        const isSelected = currSelection.includes(cardVal);
        // 判定有效高度 (模拟 visually 弹起的牌)
        const CARD_HEIGHT = 70;    
        const POP_HEIGHT = 35;     
        const TOLERANCE = 10;      
        const validVisualHeight = isSelected ? CARD_HEIGHT + POP_HEIGHT + TOLERANCE : CARD_HEIGHT + TOLERANCE;
        const distanceFromBottom = rect.bottom - clientY;

        // 超出判定区域则忽略 (防止点到卡牌上方空白处误触)
        if (distanceFromBottom > validVisualHeight || distanceFromBottom < -10) {
            isDragging.current = false;
            return;
        }

        isDragging.current = true;
        dragStartMode.current = !currSelection.includes(cardVal);
        lastTouchedIndex.current = index;
        
        // 立即触发当前点击
        if (isSelected !== dragStartMode.current) {
            currToggle(cardVal); 
            if (navigator.vibrate) navigator.vibrate(5);
        }
    };

    const handleGestureMove = (clientX, clientY) => {
        if (!isDragging.current) return;
        
        const container = handContainerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        // 增加垂直容错，防止鼠标/手指稍微划出区域就断触
        if (clientY < rect.top - 50 || clientY > rect.bottom + 50) return;
        
        const { myHand: currHand, selectedCards: currSelection, cardSpacing: currSpacing, handleMouseDown: currToggle } = stateRef.current;
        const index = getCardIndexFromTouch(clientX, rect.left, currSpacing, currHand.length);
        
        // 只有滑到了新的牌上才触发
        if (lastTouchedIndex.current !== index) {
            lastTouchedIndex.current = index;
            const cardVal = currHand[index];
            if (cardVal !== undefined) {
                const isSelected = currSelection.includes(cardVal);
                // 保持和起始动作一致（如果是“选中”模式，划过的都选中；如果是“取消”模式，划过的都取消）
                if (isSelected !== dragStartMode.current) {
                    currToggle(cardVal); 
                    if (navigator.vibrate) navigator.vibrate(5);
                }
            }
        }
    };

    const handleGestureEnd = () => {
        isDragging.current = false;
        lastTouchedIndex.current = null;
    };

    // --- 事件绑定 ---
    useEffect(() => {
        const container = handContainerRef.current;
        if (!container || amIAutoPlay) return;
        
        // 1. Touch Events (移动端)
        const onTouchStart = (e) => {
            if (e.cancelable) e.preventDefault();
            if (e.touches.length > 0) {
                handleGestureStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        const onTouchMove = (e) => {
            if (e.cancelable) e.preventDefault();
            if (e.touches.length > 0) {
                handleGestureMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        const onTouchEnd = () => handleGestureEnd();

        // 2. Mouse Events (PC端适配)
        const onMouseDown = (e) => {
            if (e.button !== 0) return; // 只响应左键
            handleGestureStart(e.clientX, e.clientY);
        };
        const onMouseMove = (e) => {
            handleGestureMove(e.clientX, e.clientY);
        };
        const onMouseUp = () => handleGestureEnd();

        
        // 绑定 Touch (使用 passive: false 以便能 preventDefault 阻止滚动)
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd);
        
        // 绑定 Mouse
        container.addEventListener('mousedown', onMouseDown);
        // 将 Move 和 Up 绑定到 window，防止鼠标拖出容器后失效
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        
        return () => {
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);

            container.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [amIAutoPlay]);

    return handContainerRef;
};