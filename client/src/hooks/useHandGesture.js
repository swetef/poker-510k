import { useEffect, useRef } from 'react';
import { getCardIndexFromTouch } from '../utils/cardLogic.js';

/**
 * 专门处理手牌区域的触摸滑动选择逻辑
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
    const dragStartMode = useRef(true); 

    // 使用 Ref 保存最新状态，避免在 EventListener 中产生闭包陷阱
    const stateRef = useRef({ myHand, selectedCards, cardSpacing, handleMouseDown });

    useEffect(() => {
        stateRef.current = { myHand, selectedCards, cardSpacing, handleMouseDown };
    }, [myHand, selectedCards, cardSpacing, handleMouseDown]);

    const onTouchStartLogic = (e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const container = handContainerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const { myHand: currHand, selectedCards: currSelection, cardSpacing: currSpacing, handleMouseDown: currToggle } = stateRef.current;
        
        const index = getCardIndexFromTouch(touch.clientX, rect.left, currSpacing, currHand.length);
        const cardVal = currHand[index];
        if (cardVal === undefined) return;

        const isSelected = currSelection.includes(cardVal);
        // 判定触摸有效高度 (模拟 visually 弹起的牌)
        const CARD_HEIGHT = 70;    
        const POP_HEIGHT = 35;     
        const TOLERANCE = 10;      
        const validVisualHeight = isSelected ? CARD_HEIGHT + POP_HEIGHT + TOLERANCE : CARD_HEIGHT + TOLERANCE;
        const distanceFromBottom = rect.bottom - touch.clientY;

        // 超出判定区域则忽略
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

    const onTouchMoveLogic = (e) => {
        if (e.cancelable) e.preventDefault(); 
        if (!isDragging.current) return;
        
        const touch = e.touches[0];
        const container = handContainerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        // 增加一点垂直容错，防止手指稍稍划出区域就断触
        if (touch.clientY < rect.top - 50 || touch.clientY > rect.bottom + 50) return;
        
        const { myHand: currHand, selectedCards: currSelection, cardSpacing: currSpacing, handleMouseDown: currToggle } = stateRef.current;
        const index = getCardIndexFromTouch(touch.clientX, rect.left, currSpacing, currHand.length);
        
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

    const onTouchEndLogic = () => {
        isDragging.current = false;
        lastTouchedIndex.current = null;
    };

    // 绑定原生事件 (因为 React 的 SyntheticEvent 在 passive: false 方面支持不够完美)
    useEffect(() => {
        const container = handContainerRef.current;
        if (!container || amIAutoPlay) return;
        
        const ts = (e) => onTouchStartLogic(e);
        const tm = (e) => onTouchMoveLogic(e);
        const te = (e) => onTouchEndLogic(e);
        
        container.addEventListener('touchstart', ts, { passive: false });
        container.addEventListener('touchmove', tm, { passive: false });
        container.addEventListener('touchend', te);
        
        return () => {
            container.removeEventListener('touchstart', ts);
            container.removeEventListener('touchmove', tm);
            container.removeEventListener('touchend', te);
        };
    }, [amIAutoPlay]);

    return handContainerRef;
};