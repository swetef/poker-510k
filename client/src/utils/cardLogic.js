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

// 计算手牌间距 - [修改] 适配移动端
export const calculateCardSpacing = (count, screenWidth) => {
    if (count <= 1) return 0;
    
    // [修改] 适配手机：如果屏幕很窄，增加可用宽度的比例
    const isMobile = screenWidth < 768;
    const padding = isMobile ? 20 : 100; // 手机端留白少一点
    
    const w = Math.min(screenWidth - padding, 1400); 
    
    // [修改] 卡牌实际渲染宽度 (对应 styles.js 里的 card.width)
    // 之前是100，改成了80来适配
    const cardWidth = 80; 
    
    // 最大间距：牌少的时候不要分太开
    const maxGap = 50; 
    
    const neededWidth = (count - 1) * maxGap + cardWidth;
    
    // 如果需要的宽度小于屏幕宽，就用最大间距
    if (neededWidth <= w) return maxGap;
    
    // 否则，挤压牌的间距
    return (w - cardWidth) / (count - 1);
};