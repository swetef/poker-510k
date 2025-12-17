// 纯逻辑工具

// 排序权重：2(15) > A(14) > K(13)...
export const getSortValue = (cardVal) => {
    const normalized = cardVal % 54;
    if (normalized === 52) return 16;
    if (normalized === 53) return 17;
    const base = normalized % 13;
    if (base === 0) return 14; 
    if (base === 1) return 15; 
    return base + 1;
};

// 花色排序权重
export const getSuitSortValue = (cardVal) => {
    if (cardVal >= 52) return cardVal * 100;
    const suit = Math.floor(cardVal / 13) % 4; 
    const val = cardVal % 13;
    return suit * 100 + val; 
};

// 获取单张牌的显示信息
export const getCardDisplay = (cardVal) => {
    const normalizedValue = cardVal % 54; 
    if (normalizedValue === 52) return { suit: 'Joker', text: '小王', color: '#000', isScore: false };
    if (normalizedValue === 53) return { suit: 'Joker', text: '大王', color: '#d00', isScore: false };
    
    const suits = ['♠', '♥', '♣', '♦'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const valueIndex = normalizedValue % 13;
    const suit = suits[Math.floor(normalizedValue / 13)];
    const color = (suit === '♥' || suit === '♦') ? '#d00' : '#000';
    const text = values[valueIndex];
    const isScore = (text === '5' || text === '10' || text === 'K');
    
    return { suit, text, color, isScore };
};

// 手牌排序
export const sortHand = (cards, mode = 'POINT') => {
    if (mode === 'SUIT') {
        return [...cards].sort((a, b) => getSuitSortValue(b) - getSuitSortValue(a));
    }
    return [...cards].sort((a, b) => getSortValue(b) - getSortValue(a));
};

// 计算手牌间距
export const calculateCardSpacing = (count, screenWidth) => {
    if (count <= 1) return 0;
    
    // 适配手机逻辑：留出左右安全距离
    const isMobile = screenWidth < 768;
    const padding = isMobile ? 20 : 100; // 减少两侧留白
    
    const w = Math.min(screenWidth - padding, 1200); 
    
    // 卡牌实际宽度
    const cardWidth = 55; // 与 styles.js 中的 card width 一致
    
    // 最大间距：牌少的时候不要分太开
    const maxGap = isMobile ? 35 : 45; 
    
    const neededWidth = (count - 1) * maxGap + cardWidth;
    
    // 如果需要的宽度小于屏幕宽，就用最大间距
    if (neededWidth <= w) return maxGap;
    
    // 否则，挤压牌的间距
    return (w - cardWidth) / (count - 1);
};

// [新增] 辅助函数：根据触摸X坐标计算是第几张牌
export const getCardIndexFromTouch = (touchX, containerLeft, spacing, count) => {
    // 相对容器左侧的距离
    const relativeX = touchX - containerLeft;
    
    // 估算索引
    let index = Math.floor(relativeX / spacing);
    
    // 边界检查
    if (index < 0) index = 0;
    if (index >= count) index = count - 1; // 触摸在最后一张牌之后，也算最后一张
    
    return index;
};