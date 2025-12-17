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
    
    // [新增] 辅助：点数转显示文本
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
    
    // [新增] 辅助：将分析结果转为人类可读文本
    getAnalysisText: (analysisResult) => {
        if (!analysisResult || analysisResult.type === 'INVALID') return '未知牌型';
        
        const pt = CardRules.getPointText(analysisResult.val);
        
        switch (analysisResult.type) {
            case 'SINGLE': return `单张 ${pt}`;
            case 'PAIR': return `对 ${pt}`;
            case 'TRIPLE': return `三张 ${pt}`;
            case 'LIANDUI': return `${analysisResult.len/2}连对 (${pt}起)`;
            case 'AIRPLANE': return `飞机 (${pt}起)`;
            case '510K_MIXED': return '杂 510K';
            case '510K_PURE': return '纯 510K';
            case 'BOMB_STD': return `${analysisResult.len}炸 (${pt})`;
            case 'BOMB_MAX': return `至尊 ${analysisResult.len}炸 (${pt})`;
            case 'BOMB_KING': return '天王炸!';
            default: return '未知';
        }
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

        // 三张 (不带) - 也可以看作是长度为3的飞机，但为了兼容性保留为 TRIPLE
        if (len === 3 && uniquePoints.length === 1) {
            return { type: 'TRIPLE', val: points[0], level: 0 };
        }

        // 连对 (Liandui)
        if (len >= 4 && len % 2 === 0) {
            // 简单校验：不含2和王
            if (!points.some(p => p >= 15)) {
                let isLiandui = true;
                // 检查是否是连续的对子 (3344, 334455)
                // 条件1: 去重后的数量要是总张数的一半 (说明全是成对的)
                if (uniquePoints.length === len / 2) {
                     // 条件2: 每张牌必须出现2次 (避免 3333 这种被误判为连对，虽然3333是炸弹逻辑会优先，但以防万一)
                     for (let p of uniquePoints) {
                         if (counts[p] !== 2) isLiandui = false;
                     }

                     // 条件3: 检查 uniquePoints 是否连续
                     for(let i=0; i<uniquePoints.length-1; i++) {
                         if(uniquePoints[i+1] !== uniquePoints[i]+1) isLiandui = false;
                     }
                     
                     if (isLiandui) return { type: 'LIANDUI', val: points[0], len: len, level: 0 };
                }
            }
        }

        // [新增] 飞机 (Airplane) - 连续的三不带
        // 规则：至少2个连续的三张 (len >= 6)，且是3的倍数
        if (len >= 6 && len % 3 === 0) {
            // 简单校验：不含2和王 (通常顺子类牌型不到2)
            if (!points.some(p => p >= 15)) {
                let isAirplane = true;
                
                // 条件1: 去重后的数量应该是总张数的 1/3 (例如 333444，6张牌，去重是3,4 两个数)
                if (uniquePoints.length === len / 3) {
                    // 条件2: 每个点数必须出现正好3次
                    for (let p of uniquePoints) {
                        if (counts[p] !== 3) isAirplane = false;
                    }

                    // 条件3: 连续性检查
                    for(let i=0; i<uniquePoints.length-1; i++) {
                        if(uniquePoints[i+1] !== uniquePoints[i]+1) isAirplane = false;
                    }

                    if (isAirplane) return { type: 'AIRPLANE', val: points[0], len: len, level: 0 };
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
            // 连对和飞机必须张数一致才能比较
            if ((newHand.type === 'LIANDUI' || newHand.type === 'AIRPLANE') && newHand.len !== lastHand.len) return false;
            
            // 必须张数一致
            if (newCards.length !== lastCards.length) return false;
            
            // 比较最小的那个点数 (val)
            return newHand.val > lastHand.val;
        }

        return false;
    }
};

module.exports = CardRules;