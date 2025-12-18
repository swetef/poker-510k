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

    getSortValue: (cardVal) => {
        const normalized = cardVal % 54;
        if (normalized === 52) return 16;
        if (normalized === 53) return 17;
        const base = normalized % 13;
        if (base === 0) return 14; 
        if (base === 1) return 15; 
        return base + 1;
    },

    getSuitSortValue: (cardVal) => {
        if (cardVal >= 52) return cardVal * 100;
        const suit = Math.floor(cardVal / 13) % 4; 
        const val = cardVal % 13;
        return suit * 100 + val; 
    },
    
    getPointText: (point) => {
        if (point <= 10) return point.toString();
        if (point === 11) return 'J';
        if (point === 12) return 'Q';
        if (point === 13) return 'K';
        if (point === 14) return 'A';
        if (point === 15) return '2';
        if (point === 16) return '小王';
        if (point === 17) return '大王';
        return '?';
    },
    
    getAnalysisText: (analysisResult) => {
        if (!analysisResult || analysisResult.type === 'INVALID') return '未知牌型';
        
        const pt = CardRules.getPointText(analysisResult.val);
        
        switch (analysisResult.type) {
            case 'SINGLE': return `单张 ${pt}`;
            case 'PAIR': return `对 ${pt}`;
            case 'TRIPLE': return `三张 ${pt}`;
            case 'LIANDUI': return `${analysisResult.len/2}连对 (${pt}起)`;
            case 'AIRPLANE': return `飞机 (${pt}起)`;
            case '510K_MIXED': return '杂色 510K'; // [新增]
            case '510K_PURE': 
                const suitNames = ['黑桃', '红桃', '梅花', '方片'];
                const suitIndex = 4 - analysisResult.val; 
                const sName = suitNames[suitIndex] || '纯';
                return `${sName} 510K`;
            case 'BOMB_STD': return `${analysisResult.len}炸 (${pt})`;
            case 'BOMB_MAX': return `至尊 ${analysisResult.len}炸 (${pt})`;
            case 'BOMB_KING': return '天王炸!';
            default: return '未知';
        }
    },

    getCardScore: (cardVal) => {
        const p = CardRules.getPoint(cardVal);
        if (p === 5) return 5;
        if (p === 10) return 10;
        if (p === 13) return 10; // K
        return 0;
    },

    calculateTotalScore: (cards) => {
        return cards.reduce((sum, c) => sum + CardRules.getCardScore(c), 0);
    },

    getSuit: (cardVal) => {
        const normalized = cardVal % 54;
        if (normalized >= 52) return -1; 
        return Math.floor(normalized / 13);
    },

    // 2. 核心：牌型分析
    analyze: (cards, deckCount = 1) => {
        const len = cards.length;
        if (len === 0) return { type: 'EMPTY' };

        // 排序：点数从小到大
        const points = cards.map(CardRules.getPoint).sort((a, b) => a - b);
        
        // 统计点数频率
        const counts = {};
        points.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
        const uniquePoints = Object.keys(counts).map(Number).sort((a,b)=>a-b);
        
        // --- 非炸弹牌型 ---

        if (len === 1) return { type: 'SINGLE', val: points[0], level: 0 };

        if (len === 2 && points[0] === points[1]) {
            return { type: 'PAIR', val: points[0], level: 0 };
        }

        if (len === 3 && uniquePoints.length === 1) {
            return { type: 'TRIPLE', val: points[0], level: 0 };
        }

        // 连对
        if (len >= 4 && len % 2 === 0) {
            if (!points.some(p => p >= 15)) {
                let isLiandui = true;
                if (uniquePoints.length === len / 2) {
                     for (let p of uniquePoints) {
                         if (counts[p] !== 2) isLiandui = false;
                     }
                     for(let i=0; i<uniquePoints.length-1; i++) {
                         if(uniquePoints[i+1] !== uniquePoints[i]+1) isLiandui = false;
                     }
                     if (isLiandui) return { type: 'LIANDUI', val: points[0], len: len, level: 0 };
                }
            }
        }

        // 飞机
        if (len >= 6 && len % 3 === 0) {
            if (!points.some(p => p >= 15)) {
                let isAirplane = true;
                if (uniquePoints.length === len / 3) {
                    for (let p of uniquePoints) {
                        if (counts[p] !== 3) isAirplane = false;
                    }
                    for(let i=0; i<uniquePoints.length-1; i++) {
                        if(uniquePoints[i+1] !== uniquePoints[i]+1) isAirplane = false;
                    }
                    if (isAirplane) return { type: 'AIRPLANE', val: points[0], len: len, level: 0 };
                }
            }
        }

        // --- 炸弹牌型 (Level 1-5) ---

        // 510K 检测
        if (len === 3) {
            const has5 = points.includes(5);
            const has10 = points.includes(10);
            const hasK = points.includes(13);
            if (has5 && has10 && hasK) {
                // 检查花色
                const suits = cards.map(CardRules.getSuit);
                const isPure = (suits[0] === suits[1] && suits[1] === suits[2]);
                
                if (isPure) {
                    // 纯510K (Level 2)
                    const suit = suits[0];
                    let suitVal = 0;
                    if (suit === 0) suitVal = 4; // 黑
                    else if (suit === 1) suitVal = 3; // 红
                    else if (suit === 2) suitVal = 2; // 梅
                    else if (suit === 3) suitVal = 1; // 方
                    return { type: '510K_PURE', val: suitVal, level: 2 }; 
                } else {
                    // [修复] 恢复杂色 510K (Level 1)
                    return { type: '510K_MIXED', val: 1, level: 1 };
                }
            }
        }

        // Level 3: 普通炸弹
        if (uniquePoints.length === 1 && len >= 4) {
            if (len === deckCount * 4) {
                 return { type: 'BOMB_MAX', val: points[0], level: 5 };
            }
            return { type: 'BOMB_STD', val: points[0], len: len, level: 3 };
        }

        // Level 4: 天王炸
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

            // 同级别比较 (Level相等时)
            if (newHand.type === '510K_PURE') {
                return newHand.val > lastHand.val;
            }

            if (newHand.type === 'BOMB_STD') {
                if (newHand.len > lastHand.len) return true;
                if (newHand.len < lastHand.len) return false;
                return newHand.val > lastHand.val;
            }
            
            // [新增] 杂色510K 互管逻辑 (通常杂色不分大小，或者不能互管)
            // 这里设定为：不能互管 (返回false)
            if (newHand.type === '510K_MIXED') return false;

            if (newHand.type === 'BOMB_MAX') return newHand.val > lastHand.val;
            
            return false;
        }

        // C. 非炸弹之间 (同牌型比较)
        if (newHand.type === lastHand.type) {
            if ((newHand.type === 'LIANDUI' || newHand.type === 'AIRPLANE') && newHand.len !== lastHand.len) return false;
            
            if (newCards.length !== lastCards.length) return false;
            
            if (newHand.type === 'LIANDUI') {
                return newHand.val === lastHand.val + 1;
            }
            
            return newHand.val > lastHand.val;
        }

        return false;
    }
};

module.exports = CardRules;