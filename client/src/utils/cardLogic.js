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

// 判断是否为分牌 (5, 10, K)
const isScoreCard = (cardVal) => {
    const normalized = cardVal % 54;
    if (normalized >= 52) return false; // 王不是分牌
    const val = normalized % 13;
    // 0=A, 1=2, 2=3, 3=4(5), ..., 9(10), ..., 12(K)
    return val === 4 || val === 9 || val === 12;
};

// 获取分牌的内部排序权重 (K > 10 > 5)
const getScoreCardRank = (cardVal) => {
    const val = (cardVal % 54) % 13;
    if (val === 12) return 3; // K
    if (val === 9) return 2;  // 10
    if (val === 4) return 1;  // 5
    return 0;
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

// 智能理牌逻辑
// [修改] 增加 extractScore 参数，默认为 true (提取分牌)
// 如果为 false，则不单独提取分牌，而是按照普通牌逻辑（炸弹/三张/对子）处理
export const arrangeHand = (cards, extractScore = true) => {
    let scoreCards = []; // 右侧：分牌
    let otherCards = []; // 待分类的牌

    if (extractScore) {
        // 1. 先把所有分牌(5, 10, K)提取出来
        cards.forEach(c => {
            if (isScoreCard(c)) scoreCards.push(c);
            else otherCards.push(c);
        });

        // 2. 对分牌进行排序：K > 10 > 5 (KKKK 1010 5555)
        scoreCards.sort((a, b) => {
            const rA = getScoreCardRank(a);
            const rB = getScoreCardRank(b);
            if (rA !== rB) return rB - rA; // 降序 (K=3, 10=2, 5=1)
            return getSuitSortValue(b) - getSuitSortValue(a); // 同分按花色排
        });
    } else {
        // [新增] 不提取模式：所有牌都进入普通分类逻辑
        otherCards = [...cards];
    }

    // 3. 对剩余牌进行分组
    const groups = new Map();
    otherCards.forEach(c => {
        const val = getSortValue(c);
        if (!groups.has(val)) groups.set(val, []);
        groups.get(val).push(c);
    });

    const bombs = [];   // 左侧：炸弹
    const triples = []; // 中间：三张
    const pairs = [];   // 中间：对子
    const singles = []; // 中间：单张

    groups.forEach((groupCards, val) => {
        const count = groupCards.length;
        // 规则：数量 >= 4 视为炸弹
        if (count >= 4) {
            bombs.push({ val, cards: groupCards, count });
        } else if (count === 3) {
            triples.push({ val, cards: groupCards });
        } else if (count === 2) {
            pairs.push({ val, cards: groupCards });
        } else {
            singles.push({ val, cards: groupCards });
        }
    });

    // 4. 排序炸弹：张数优先 (10张 > 8张 > 6张...)，其次点数
    bombs.sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count; // 张数降序
        return b.val - a.val; // 点数降序
    });

    // 5. 排序中间废牌：各自按点数降序
    const sortByVal = (a, b) => b.val - a.val;
    triples.sort(sortByVal);
    pairs.sort(sortByVal);
    singles.sort(sortByVal);

    // 6. 展平数组
    const flatBombs = bombs.flatMap(b => b.cards);
    const flatTriples = triples.flatMap(t => t.cards);
    const flatPairs = pairs.flatMap(p => p.cards);
    const flatSingles = singles.flatMap(s => s.cards);

    // 7. 拼接：左炸弹 + 中(三+对+单) + 右分牌
    return [...flatBombs, ...flatTriples, ...flatPairs, ...flatSingles, ...scoreCards];
};

// 手牌排序入口
export const sortHand = (cards, mode = 'POINT') => {
    // 即使UI删除了 SUIT 入口，为了兼容性保留代码逻辑
    if (mode === 'SUIT') {
        return [...cards].sort((a, b) => getSuitSortValue(b) - getSuitSortValue(a));
    }
    if (mode === 'ARRANGE') {
        // 模式1：提取510K
        return arrangeHand(cards, true);
    }
    if (mode === 'ARRANGE_MERGED') {
        // [新增] 模式2：融合510K
        return arrangeHand(cards, false);
    }
    // 默认 POINT
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