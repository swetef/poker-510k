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

    // [新增] 缺失的排序权重函数 (修复崩溃核心)
    getSortValue: (cardVal) => {
        const normalized = cardVal % 54;
        if (normalized === 52) return 16;
        if (normalized === 53) return 17;
        const base = normalized % 13;
        if (base === 0) return 14; 
        if (base === 1) return 15; 
        return base + 1;
    },

    // [新增] 缺失的花色排序函数 (修复崩溃核心)
    getSuitSortValue: (cardVal) => {
        if (cardVal >= 52) return cardVal * 100;
        const suit = Math.floor(cardVal / 13) % 4; 
        const val = cardVal % 13;
        return suit * 100 + val; 
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
            // case '510K_MIXED': return '杂 510K'; // 杂色已废弃
            case '510K_PURE': 
                const suitNames = ['黑桃', '红桃', '梅花', '方片'];
                // val 映射回索引：4->0, 3->1, 2->2, 1->3
                const suitIndex = 4 - analysisResult.val; 
                const sName = suitNames[suitIndex] || '纯';
                return `${sName} 510K`;
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
    // 0:黑桃, 1:红桃, 2:梅花, 3:方片
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

        // 连对 (Liandui)
        if (len >= 4 && len % 2 === 0) {
            // 简单校验：不含2和王
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

        // 飞机 (Airplane) - 连续的三不带
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

        // Level 1: 510K (纯色) - 杂色已废弃
        if (len === 3) {
            const has5 = points.includes(5);
            const has10 = points.includes(10);
            const hasK = points.includes(13);
            if (has5 && has10 && hasK) {
                // 检查花色
                const suits = cards.map(CardRules.getSuit);
                const isPure = (suits[0] === suits[1] && suits[1] === suits[2]);
                
                if (isPure) {
                    // 纯510K (Level 2，注：虽然现在只有纯色，但依然算作 Level 2 以区别于杂色历史逻辑，或者统称为510K炸弹)
                    // 规则：黑(0)>红(1)>梅(2)>方(3)
                    // 为了方便比较大小，我们将 val 设为花色的反向权重：
                    // 黑桃(0) -> 4
                    // 红桃(1) -> 3
                    // 梅花(2) -> 2
                    // 方片(3) -> 1
                    const suit = suits[0];
                    let suitVal = 0;
                    if (suit === 0) suitVal = 4;
                    else if (suit === 1) suitVal = 3;
                    else if (suit === 2) suitVal = 2;
                    else if (suit === 3) suitVal = 1;

                    return { type: '510K_PURE', val: suitVal, level: 2 }; 
                } 
                // 杂色 510K 不再返回 INVALID，而是作为普通散牌处理（也就是无法一次性打出，除非当单张/对子打）
                // 由于代码逻辑走到这里已经不是单/对/三/连/飞机，所以最终会返回 INVALID，符合“杂色不行”的要求。
            }
        }

        // Level 3: 普通炸弹 (>=4张)
        if (uniquePoints.length === 1 && len >= 4) {
            // Level 5: 至尊满炸 (Rank数量 == DECK_COUNT * 4)
            if (len === deckCount * 4) {
                 return { type: 'BOMB_MAX', val: points[0], level: 5 };
            }
            // 普通炸弹 (包括 4个小王 这种)
            return { type: 'BOMB_STD', val: points[0], len: len, level: 3 };
        }

        // Level 4: 天王炸 (所有王)
        const isAllJokers = points.every(p => p >= 16);
        // 规则：必须集齐所有王
        if (isAllJokers && len === deckCount * 2) {
            return { type: 'BOMB_KING', val: 999, level: 4 };
        }
        // 如果是 3个王、2个王，因为 uniquePoints 长度不为 1 (16和17不同)，
        // 且 len 不满足 deckCount*2，所以会作为 INVALID 处理（无法作为炸弹一次打出）。
        // 但如果是 2个小王 (len=2, points=[16,16])，上面已经匹配了 PAIR。
        // 如果是 3个小王 (len=3, points=[16,16,16])，上面已经匹配了 TRIPLE。
        // 如果是 4个小王 (len=4, points=[16,16,16,16])，上面匹配了 BOMB_STD。
        // 完全符合“不齐的话，就是按照正常的大小王的大小算”的规则。

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
            if (newHand.type === '510K_PURE') {
                // 纯510K 比较花色权重 (黑4 > 红3 > 梅2 > 方1)
                return newHand.val > lastHand.val;
            }

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
            
            // [规则] 连对：严丝合缝 (必须大1点)
            if (newHand.type === 'LIANDUI') {
                return newHand.val === lastHand.val + 1;
            }

            // [规则] 飞机：只要点数大即可 (val > val)
            // [规则] 普通牌型 (单/对/三)：只要点数大即可
            return newHand.val > lastHand.val;
        }

        return false;
    }
};

module.exports = CardRules;