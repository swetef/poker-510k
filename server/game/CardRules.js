// 纯规则计算 (510K 逻辑、比大小)

const CardRules = {
    // 1. 基础映射
    // 3=3 ... K=13, A=14, 2=15, 小王=16, 大王=17
    getPoint: (cardVal) => {
        const normalized = cardVal % 54;
        if (normalized === 52) return 16;
        if (normalized === 53) return 17;
        const base = normalized % 13;
        if (base === 0) return 14; // A
        if (base === 1) return 15; // 2
        return base + 1; // 3 => 3
    },

    // 获取牌的分数 (5=5, 10=10, K=10)
    getCardScore: (cardVal) => {
        const p = CardRules.getPoint(cardVal);
        if (p === 5) return 5;
        if (p === 10) return 10;
        if (p === 13) return 10; // K
        return 0;
    },

    // 计算一组牌的总分
    calculateTotalScore: (cards) => {
        return cards.reduce((sum, c) => sum + CardRules.getCardScore(c), 0);
    },

    // 获取牌的花色 (0-3)
    getSuit: (cardVal) => {
        const normalized = cardVal % 54;
        if (normalized >= 52) return -1; // 王没有花色
        return Math.floor(normalized / 13);
    },

    // 2. 核心：牌型分析
    analyze: (cards, deckCount = 1) => {
        const len = cards.length;
        if (len === 0) return { type: 'EMPTY' };

        // 排序：点数从小到大
        const points = cards.map(CardRules.getPoint).sort((a, b) => a - b);
        
        // 统计点数频率 { point: count }
        const counts = {};
        points.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
        const uniquePoints = Object.keys(counts).map(Number).sort((a,b)=>a-b);
        
        // --- 非炸弹牌型 ---

        // 单张
        if (len === 1) return { type: 'SINGLE', val: points[0], level: 0 };

        // 对子
        if (len === 2 && points[0] === points[1]) {
            return { type: 'PAIR', val: points[0], level: 0 };
        }

        // 三张 (不带)
        if (len === 3 && uniquePoints.length === 1) {
            return { type: 'TRIPLE', val: points[0], level: 0 };
        }

        // 连对 (简化版，核心是偶数张且连续)
        if (len >= 4 && len % 2 === 0) {
            // 简单校验：不含2和王，且点数连续
            if (!points.some(p => p >= 15)) {
                let isLiandui = true;
                // 检查是否是连续的对子 (3344, 334455)
                // 这里简化处理，实际项目可加更严格校验
                if (uniquePoints.length === len / 2) {
                     // 检查 uniquePoints 是否连续
                     for(let i=0; i<uniquePoints.length-1; i++) {
                         if(uniquePoints[i+1] !== uniquePoints[i]+1) isLiandui = false;
                     }
                     if (isLiandui) return { type: 'LIANDUI', val: points[0], len: len, level: 0 };
                }
            }
        }

        // --- 炸弹牌型 (Level 1-5) ---

        // Level 1 & 2: 510K
        if (len === 3) {
            const has5 = points.includes(5);
            const has10 = points.includes(10);
            const hasK = points.includes(13);
            if (has5 && has10 && hasK) {
                // 检查花色
                const suits = cards.map(CardRules.getSuit);
                const isPure = (suits[0] === suits[1] && suits[1] === suits[2]);
                if (isPure) {
                    return { type: '510K_PURE', val: suits[0], level: 2 }; // 纯510K (Level 2)
                } else {
                    return { type: '510K_MIXED', val: 0, level: 1 }; // 杂510K (Level 1)
                }
            }
        }

        // Level 3: 普通炸弹 (>=4张)
        if (uniquePoints.length === 1 && len >= 4) {
            // Level 5: 至尊满炸 (Rank数量 == DECK_COUNT * 4)
            if (len === deckCount * 4) {
                 return { type: 'BOMB_MAX', val: points[0], level: 5 };
            }
            // 普通炸弹
            return { type: 'BOMB_STD', val: points[0], len: len, level: 3 };
        }

        // Level 4: 天王炸 (所有王)
        const isAllJokers = points.every(p => p >= 16);
        if (isAllJokers && len === deckCount * 2) {
            return { type: 'BOMB_KING', val: 999, level: 4 };
        }

        return { type: 'INVALID' };
    },

    // 3. 校验能否管牌
    canPlay: (newCards, lastCards, deckCount) => {
        const newHand = CardRules.analyze(newCards, deckCount);
        if (newHand.type === 'INVALID') return false;

        // 自由出牌
        if (!lastCards || lastCards.length === 0) return true;

        const lastHand = CardRules.analyze(lastCards, deckCount);

        // A. 炸弹 vs 非炸弹
        if (newHand.level > 0 && lastHand.level === 0) return true;
        if (newHand.level === 0 && lastHand.level > 0) return false;

        // B. 炸弹之间 (Level 比较)
        if (newHand.level > 0 && lastHand.level > 0) {
            if (newHand.level > lastHand.level) return true;
            if (newHand.level < lastHand.level) return false;

            // 同级别比较
            if (newHand.type === '510K_MIXED') return false; // 互不管
            if (newHand.type === '510K_PURE') return false; 

            if (newHand.type === 'BOMB_STD') {
                if (newHand.len > lastHand.len) return true;
                if (newHand.len < lastHand.len) return false;
                return newHand.val > lastHand.val;
            }
            
            if (newHand.type === 'BOMB_MAX') return newHand.val > lastHand.val;
            return false;
        }

        // C. 非炸弹之间 (同牌型比较)
        if (newHand.type === lastHand.type) {
            if (newHand.type === 'LIANDUI' && newHand.len !== lastHand.len) return false;
            // 必须张数一致
            if (newCards.length !== lastCards.length) return false;
            return newHand.val > lastHand.val;
        }

        return false;
    }
};

module.exports = CardRules;