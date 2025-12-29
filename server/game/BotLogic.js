const CardRules = require('./CardRules');

/**
 * BotLogic - 游戏机器人与托管智能核心
 * 包含：合法牌型查找、估值排序、战术决策
 */
const BotLogic = {

    /**
     * [核心大脑] 决定出哪一手牌
     * @param {Array} hand 手牌 (已排序)
     * @param {Array} lastPlayedCards 上家出的牌
     * @param {Number} deckCount 牌副数
     * @param {Object} context 战局上下文 { mode: 'SMART'|'THRIFTY', pendingScore: 0, isTeammate: boolean }
     * @returns {Array|null} 返回要出的牌数组，null 代表不要
     */
    decideMove: (hand, lastPlayedCards, deckCount, context = {}) => {
        // 1. 获取所有符合规则的候选牌型，并按基础损耗(cost)排序
        // 候选列表已由 getSortedHints 过滤了“为了出牌而拆炸弹”等极高Cost的选项
        const candidates = BotLogic.getSortedHints(hand, lastPlayedCards, deckCount);
        
        // 如果没有合法出牌，直接过
        if (!candidates || candidates.length === 0) return null;

        // 默认选择 Cost 最小（即最不心疼）的一手
        let bestMove = candidates[0];
        const bestAnalysis = CardRules.analyze(bestMove, deckCount);

        // 2. 引入战术层 (Strategy Layer) 进行过滤
        const { isTeammate, pendingScore, mode } = context;
        const isFreePlay = (!lastPlayedCards || lastPlayedCards.length === 0);

        // --- 战术 A: 绝杀检测 ---
        // 如果最好的一手牌打出去就赢了，无视所有保留逻辑，直接出！
        if (bestMove.length === hand.length) {
            return bestMove;
        }

        // --- 战术 B: 队友保护机制 (Teammate Guard) ---
        if (!isFreePlay && isTeammate) {
            const lastAnalysis = CardRules.analyze(lastPlayedCards, deckCount);
            
            // 如果队友出了炸弹，除非我能绝杀，否则坚决不炸队友
            if (lastAnalysis.level > 0) return null;

            // 如果队友出了大牌 (A, 2, 王)，默认他想上手，我不挡路
            // (除非我有非常好的机会且不伤牌型，或者我快赢了)
            if (lastAnalysis.val >= 14) {
                // 如果我需要拆牌或者用炸弹才能管，那就PASS
                if (bestAnalysis.level > 0 || bestMove.length > 1) return null;
            }
        }

        // --- 战术 C: 模式与贪婪 (Aggression) ---
        
        // 躺平模式：只要不是绝杀，一律不要 (用于挂机)
        if (mode === 'AFK') return null;

        // 省钱模式：如果桌上没分，且需要用炸弹管，那就PASS，省下炸弹
        if (mode === 'THRIFTY') {
            if (bestAnalysis.level > 0 && pendingScore < 50) {
                // 但如果这手炸弹是我最后几张牌，还是炸出去赢比较好
                if (hand.length > 10) return null;
            }
        }

        // 智能模式 (SMART)：根据分数动态调整
        // 如果桌上分数极高 (>200)，即使稍微拆点牌或者炸一下也值得
        if (pendingScore >= 200) {
            // 可以在 candidates 里找一个最大的或者必胜的（当前逻辑简化为：允许出Cost稍高的牌）
            // 但这里我们简单处理：只要有牌出就行
        } else {
            // 分数不高时，如果 BestMove 是炸弹，且上家不是炸弹（即我在用炸弹管散牌），慎重！
            if (bestAnalysis.level > 0 && lastPlayedCards.length > 0) {
                const lastLevel = CardRules.analyze(lastPlayedCards, deckCount).level || 0;
                if (lastLevel === 0) {
                    // 用炸弹管散牌？
                    // 除非我手牌很好(剩余<10)，或者炸弹很多，否则保留
                    if (hand.length > 10) return null;
                }
            }
        }

        return bestMove;
    },

    /**
     * 获取经过智能排序的提示列表
     */
    getSortedHints: (hand, lastPlayedCards, deckCount = 2) => {
        // 1. 获取所有合法解
        const solutions = BotLogic.findAllSolutions(hand, lastPlayedCards, deckCount);
        if (!solutions || solutions.length === 0) return [];

        // 预分析手牌中的炸弹，用于后续计算拆牌惩罚
        const myBombs = BotLogic.findAllBombsInHand(hand, deckCount);
        const bombCardsSet = new Set();
        myBombs.forEach(b => b.cards.forEach(c => bombCardsSet.add(c)));

        // 统计手牌点数频率 (用于判断是否是“拆对子/拆三张”)
        const handCounts = {};
        hand.forEach(c => {
            const p = CardRules.getPoint(c);
            handCounts[p] = (handCounts[p] || 0) + 1;
        });

        // 预计算 analyze 结果，避免后续排序时重复计算
        let candidates = solutions.map(sol => ({
            cards: sol,
            analysis: CardRules.analyze(sol, deckCount),
            cost: 0
        }));

        // 2. 过滤基础不合理项
        candidates = candidates.filter(item => {
            const { type } = item.analysis;
            if (type === 'INVALID') return false;
            // 首出时不推荐主动打 510K (除非是为了跑牌，但一般510K算炸弹留着管牌)
            if ((!lastPlayedCards || lastPlayedCards.length === 0) && (type === '510K_PURE' || type === '510K_MIXED')) {
                 return false; 
            }
            return true;
        });

        if (candidates.length === 0) return [];

        // 3. 分析上家牌型 (判断是否是管牌阶段)
        const lastAnalysis = (lastPlayedCards && lastPlayedCards.length > 0)
            ? CardRules.analyze(lastPlayedCards, deckCount)
            : null;
        const lastIsBomb = lastAnalysis ? lastAnalysis.level > 0 : false;

        // 4. 核心评分逻辑 (Cost 越小越优先)
        candidates.forEach(item => {
            const { analysis, cards } = item;
            let cost = 0;
            
            // --- A. 基础分 (点数越小 Cost 越低) ---
            if (analysis.level > 0) {
                // 炸弹惩罚：起手尽量不炸，保留实力
                cost += analysis.level * 1000000; 
                cost += analysis.len * 10000;
                cost += analysis.val;
            } else {
                cost += analysis.val;
            }

            // --- B. 拆炸弹惩罚 (极高) ---
            const isMoveBomb = analysis.level > 0;
            if (!isMoveBomb) {
                // 如果出的牌里包含了炸弹的组成牌，给予巨额惩罚
                const breaksBomb = cards.some(c => bombCardsSet.has(c));
                if (breaksBomb) cost += 5000000; 
            }

            // --- C. 自由出牌 (First Play) 策略优化 ---
            if (!lastAnalysis) {
                // 策略优先级：飞机 > 连对 > 纯废单张 > 纯对子 > 拆对单张 > ... > 炸弹
                
                if (analysis.type === 'AIRPLANE') cost -= 8000; // 长牌难出，优先跑
                else if (analysis.type === 'LIANDUI') cost -= 6000;
                else if (analysis.type === 'TRIPLE') cost -= 1000; 
                else if (analysis.type === 'PAIR') {
                    // 如果手里正好只有2张，全部打出，优先级高
                    if (handCounts[analysis.val] === 2) cost -= 2000;
                    else cost += 500; // 拆三张/炸弹打对子，稍微惩罚
                }
                else if (analysis.type === 'SINGLE') {
                    const countInHand = handCounts[analysis.val] || 0;
                    if (countInHand === 1) {
                        // [关键优化] 真正的单张废牌 (手里只有1张) -> 优先级大幅提升
                        // 比普通对子更优先，旨在清理手中无法成型的牌
                        cost -= 3000; 
                    } else if (countInHand === 2) {
                        // 拆对子打单张 -> 优先级低，不到万不得已不推荐
                        cost += 2000;
                    } else if (countInHand >= 3) {
                        // 拆三张/炸弹打单张 -> 优先级极低
                        cost += 3000;
                    }
                }
                
                // 炸弹如果不为了管牌，尽量留到最后
                if (isMoveBomb) {
                    cost += 9000000;
                }
            } else {
                // --- 管牌阶段 (Beat It) ---
                // 炸弹压制判断
                if (isMoveBomb && !lastIsBomb) {
                     // 对方不是炸弹，我用炸弹管 -> 除非绝杀(只剩这手牌)，否则尽量不炸
                    if (hand.length === cards.length) cost = -9999999;
                    else cost += 5000; 
                }
            }

            item.cost = cost;
        });

        // 5. 排序
        candidates.sort((a, b) => a.cost - b.cost);

        // 6. [体验优化] 结果去重
        // 比如手里有红桃3和黑桃3单张，Cost一样，没必要提示两次，只保留一个即可
        const uniqueCandidates = [];
        const seenKeys = new Set();
        
        candidates.forEach(c => {
            const { type, val, len, level } = c.analysis;
            // 炸弹不去重 (因为花色可能影响510K或凑同花)，普通牌型去重
            if (level === 0) {
                // 唯一标识：牌型_点数_长度
                const key = `${type}_${val}_${len}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueCandidates.push(c);
                }
            } else {
                uniqueCandidates.push(c);
            }
        });

        return uniqueCandidates.map(i => i.cards);
    },

    /**
     * [兜底策略] 获取手牌中最小的一张单牌
     */
    getFallbackMove: (hand) => {
        if (!hand || hand.length === 0) return null;
        // 按点数排序
        const sortedHand = [...hand].sort((a,b) => CardRules.getPoint(a) - CardRules.getPoint(b));
        // 返回最小的一张
        return [sortedHand[0]];
    },

    // 辅助：快速找出所有炸弹
    findAllBombsInHand: (hand, deckCount) => {
        const grouped = {};
        const points = [];
        hand.forEach(c => {
            const p = CardRules.getPoint(c);
            if (!grouped[p]) {
                grouped[p] = [];
                points.push(p);
            }
            grouped[p].push(c);
        });
        const uniquePoints = [...new Set(points)].sort((a, b) => a - b);
        
        return BotLogic.coreFindBombs(hand, grouped, uniquePoints, deckCount, 0, 0);
    },

    /**
     * [核心逻辑] 仅查找炸弹
     */
    coreFindBombs: (hand, grouped, uniquePoints, deckCount, minLevel = 0, minVal = 0) => {
        const bombList = [];

        // A. 510K (Level 1 & 2)
        if (minLevel <= 2) {
            const fives = grouped[5] || [];
            const tens = grouped[10] || [];
            const kings = grouped[13] || []; // K
            
            if (fives.length > 0 && tens.length > 0 && kings.length > 0) {
                let foundPure = false;
                for (let f of fives) {
                    for (let t of tens) {
                        for (let k of kings) {
                            const s1 = CardRules.getSuit(f);
                            const s2 = CardRules.getSuit(t);
                            const s3 = CardRules.getSuit(k);
                            if (s1 === s2 && s2 === s3) {
                                if (2 > minLevel || (2 === minLevel && 100 > minVal)) { 
                                    bombList.push({ cards: [f, t, k], level: 2, val: 999, type: '510K_PURE' }); 
                                    foundPure = true;
                                }
                            }
                        }
                    }
                }
                
                if (!foundPure && minLevel <= 1) {
                    bombList.push({ cards: [fives[0], tens[0], kings[0]], level: 1, val: 1, type: '510K_MIXED' });
                }
            }
        }

        // B. 普通炸弹 (Level 3 & 5)
        for (let p of uniquePoints) {
            const count = grouped[p].length;
            if (count >= 4) {
                const isMax = (count === deckCount * 4);
                const level = isMax ? 5 : 3;
                const type = isMax ? 'BOMB_MAX' : 'BOMB_STD';
                
                if (level > minLevel || (level === minLevel && p > minVal)) {
                     bombList.push({ cards: grouped[p], level, val: p, type, len: count });
                }
            }
        }

        // C. 天王炸 (Level 4)
        const jokers = hand.filter(c => CardRules.getPoint(c) >= 16);
        if (jokers.length === deckCount * 2) {
            if (minLevel < 4) {
                bombList.push({ cards: jokers, level: 4, val: 999, type: 'BOMB_KING' });
            }
        }

        return bombList;
    },

    // 找出所有可行的出牌方案
    findAllSolutions: (hand, lastPlayedCards, deckCount) => {
        try {
            const solutions = [];
            
            // 整理手牌
            const grouped = {};
            const points = [];
            hand.forEach(c => {
                const p = CardRules.getPoint(c);
                if (!grouped[p]) {
                    grouped[p] = [];
                    points.push(p);
                }
                grouped[p].push(c);
            });
            points.sort((a, b) => a - b); 
            const uniquePoints = [...new Set(points)].sort((a,b)=>a-b);

            // --- 场景 1: 自由出牌 (First Play) ---
            if (!lastPlayedCards || lastPlayedCards.length === 0) {
                // [优化] 引入“保护牌”与“自由牌”概念
                // 1. 先找出所有炸弹/510K，这些牌尽量不拆
                const bombs = BotLogic.coreFindBombs(hand, grouped, uniquePoints, deckCount, -1, -1);
                const protectedCards = new Set();
                bombs.forEach(b => b.cards.forEach(c => protectedCards.add(c)));

                // 2. 识别“自由牌”（非保护牌）
                const freeGrouped = {};
                const freePoints = [];
                hand.forEach(c => {
                    if (!protectedCards.has(c)) {
                        const p = CardRules.getPoint(c);
                        if (!freeGrouped[p]) {
                            freeGrouped[p] = [];
                            freePoints.push(p);
                        }
                        freeGrouped[p].push(c);
                    }
                });
                freePoints.sort((a, b) => a - b);

                // --- 策略生成 (优先基于自由牌) ---
                
                // A. 连对 (在自由牌里找)
                for(let i=0; i<freePoints.length-1; i++) {
                    const p1 = freePoints[i];
                    const p2 = freePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && freeGrouped[p1].length >= 2 && freeGrouped[p2].length >= 2) {
                         solutions.push([...freeGrouped[p1].slice(0,2), ...freeGrouped[p2].slice(0,2)]);
                    }
                }

                // B. 飞机 (在自由牌里找)
                for(let i=0; i<freePoints.length-1; i++) {
                    const p1 = freePoints[i];
                    const p2 = freePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && freeGrouped[p1].length >= 3 && freeGrouped[p2].length >= 3) {
                         solutions.push([...freeGrouped[p1].slice(0,3), ...freeGrouped[p2].slice(0,3)]);
                    }
                }

                // C. 三张 (自由牌)
                for (let p of freePoints) {
                    if (freeGrouped[p].length >= 3) {
                        solutions.push(freeGrouped[p].slice(0, 3));
                    }
                }

                // D. 对子 (自由牌)
                for (let p of freePoints) {
                    if (freeGrouped[p].length >= 2) {
                        solutions.push(freeGrouped[p].slice(0, 2));
                    }
                }

                // E. 单张 (所有自由牌的单张都可以出，这是废牌的主要来源)
                for (let p of freePoints) {
                     solutions.push([freeGrouped[p][0]]);
                }
                
                // F. 补充：如果自由牌方案很少，允许拆牌兜底
                // (但会因为 Cost 高而被排在后面)
                uniquePoints.forEach(p => {
                    // 如果该点数不在自由牌里(即被保护了)，但也添加单张方案作为备选
                    if (!freeGrouped[p]) {
                         solutions.push([grouped[p][0]]);
                    }
                });

                // G. 炸弹 (起手也可以出炸弹)
                bombs.forEach(b => solutions.push(b.cards));
                
                return solutions;
            }

            // --- 场景 2: 管牌 (Beat It) ---
            const lastState = CardRules.analyze(lastPlayedCards, deckCount);
            if (lastState.type === 'INVALID') return [];

            // 策略 A: 同牌型压制 (优化：避免无效循环)
            if (['SINGLE', 'PAIR', 'TRIPLE'].includes(lastState.type)) {
                const countNeeded = lastState.type === 'SINGLE' ? 1 : (lastState.type === 'PAIR' ? 2 : 3);
                // 只检查比上家大的点数
                for (let p of uniquePoints) {
                    if (p > lastState.val && grouped[p].length >= countNeeded) {
                        solutions.push(grouped[p].slice(0, countNeeded));
                    }
                }
            }
            
            // 连对压制
            if (lastState.type === 'LIANDUI') {
                const len = lastState.len;
                const pairCount = len / 2;
                const startVal = lastState.val + 1; 
                
                for(let v = startVal; v <= 14; v++) { // A(14)封顶
                    let hasSequence = true;
                    let tempSol = [];
                    for(let k=0; k<pairCount; k++) {
                        const checkP = v + k;
                        if (!grouped[checkP] || grouped[checkP].length < 2) {
                            hasSequence = false;
                            break;
                        }
                        tempSol.push(...grouped[checkP].slice(0, 2));
                    }
                    if (hasSequence) solutions.push(tempSol);
                }
            }

            // 飞机压制
            if (lastState.type === 'AIRPLANE') {
                 const len = lastState.len;
                 const tripleCount = len / 3;
                 const startVal = lastState.val + 1;
                 
                 for(let v = startVal; v <= 14; v++) {
                    let hasSequence = true;
                    let tempSol = [];
                    for(let k=0; k<tripleCount; k++) {
                        const checkP = v + k;
                        if (!grouped[checkP] || grouped[checkP].length < 3) {
                            hasSequence = false;
                            break;
                        }
                        tempSol.push(...grouped[checkP].slice(0, 3));
                    }
                    if (hasSequence) solutions.push(tempSol);
                 }
            }

            // 策略 C: 炸弹压制 (使用核心方法)
            const currentLevel = lastState.level || 0;
            const currentVal = lastState.val || 0;
            
            const bombs = BotLogic.coreFindBombs(hand, grouped, uniquePoints, deckCount, 0, 0);
            
            bombs.forEach(b => {
                // 这里仍需校验能否管上 (处理同级炸弹的大小比较)
                if (CardRules.canPlay(b.cards, lastPlayedCards, deckCount)) {
                    solutions.push(b.cards);
                }
            });

            return solutions;
        } catch (e) {
            console.error("[Bot Logic] findAllSolutions error:", e);
            return [];
        }
    }
};

module.exports = BotLogic;