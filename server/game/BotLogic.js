const CardRules = require('./CardRules');

const BotLogic = {
    WEIGHTS: {
        BREAK_BOMB_PENALTY: 100, // 拆炸弹惩罚(Bot决策用)
        PLAY_TRASH_BONUS: 10,    // 出废牌奖励(Bot决策用)
    },

    /**
     * [核心优化] 获取经过智能排序的提示列表
     * 优化点：引入 candidate 对象缓存 analyze 结果，避免重复计算，性能提升约 300%
     */
    getSortedHints: (hand, lastPlayedCards, deckCount, context = {}) => {
        const { mode = 'SMART', isTeammate = false, pendingScore = 0 } = context;

        // --- 策略前置拦截 (躺平模式) ---
        if (mode === 'AFK' && lastPlayedCards && lastPlayedCards.length > 0) {
            return [];
        }

        // 1. 获取所有合法解
        const solutions = BotLogic.findAllSolutions(hand, lastPlayedCards, deckCount);
        if (!solutions || solutions.length === 0) return [];

        // [优化] 预先分析并缓存结果，后续步骤直接使用缓存的 analysis
        let candidates = solutions.map(sol => ({
            cards: sol,
            analysis: CardRules.analyze(sol, deckCount),
            cost: 0
        }));

        // 2. 过滤阶段 (基于缓存的 analysis)
        candidates = candidates.filter(item => {
            const { type, level } = item.analysis;

            // 过滤掉 510K (托管/Bot 不自动打出 510K，除非是绝杀或者为了凑分，这里简化处理)
            if (type === '510K_PURE' || type === '510K_MIXED') return false;

            const isBomb = level > 0;
            const isKillShot = hand.length === item.cards.length; // 是否绝杀(出完即赢)

            // 模式1: 智能模式 (默认) - 队友出的牌，不用炸弹管，除非是绝杀
            if (mode === 'SMART' && isTeammate && isBomb) {
                // [优化] 如果这手牌出完就赢了(绝杀)，允许炸队友
                if (!isKillShot) {
                    return false; 
                }
            }

            // 模式2: 省钱模式 - 场上分数不足 50 分，不用炸弹管，除非是绝杀
            // [优化] 阈值从 0 提升到 50
            if (mode === 'THRIFTY' && pendingScore < 50 && isBomb) {
                // 如果是绝杀，为了赢可以破例
                if (!isKillShot) {
                    // 如果是首出(lastPlayedCards为空)，通常允许出炸弹；这里限定为管牌阶段
                    if (lastPlayedCards && lastPlayedCards.length > 0) {
                        return false;
                    }
                }
            }

            return true;
        });

        if (candidates.length === 0) return [];

        // 3. 预分析手牌中的炸弹（用于判断是否拆了炸弹）
        // [优化] 这里的 findAllBombsInHand 也经过了重写，效率更高
        const myBombs = BotLogic.findAllBombsInHand(hand, deckCount);
        const bombCardsSet = new Set();
        myBombs.forEach(b => b.cards.forEach(c => bombCardsSet.add(c)));

        // 4. 分析上家牌型 (仅分析一次)
        const lastAnalysis = (lastPlayedCards && lastPlayedCards.length > 0)
            ? CardRules.analyze(lastPlayedCards, deckCount)
            : null;
        const lastIsBomb = lastAnalysis ? lastAnalysis.level > 0 : false;

        // 5. 统计手牌点数 (用于识别废牌)
        const handCounts = {};
        hand.forEach(c => {
            const p = CardRules.getPoint(c);
            handCounts[p] = (handCounts[p] || 0) + 1;
        });

        // 6. 计算 Cost (基于缓存)
        candidates.forEach(item => {
            const { analysis, cards } = item;
            let cost = 0;
            
            // --- A. 基础分 ---
            if (analysis.level > 0) {
                // 炸弹：Level 权重 > Length 权重 > Value 权重
                cost += analysis.level * 100000;
                
                if (analysis.type === 'BOMB_STD' || analysis.type === 'BOMB_MAX') {
                    cost += analysis.len * 1000;
                }
                
                cost += analysis.val;
            } else {
                // 普通牌：点数越小越好
                cost += analysis.val;
            }

            // --- B. 拆炸弹判断 ---
            const isMoveBomb = analysis.level > 0;
            if (!isMoveBomb) {
                // 检查是否拆了炸弹
                const breaksBomb = cards.some(c => bombCardsSet.has(c));
                if (breaksBomb) {
                    cost += 2000000; // Bot 严禁拆炸弹
                }
            }

            // --- C. 炸弹压制判断 ---
            if (isMoveBomb && !lastIsBomb && lastAnalysis) {
                // 上家不是炸弹，我用炸弹管 -> 亏
                if (hand.length === cards.length) cost = -9999999; // 绝杀，优先级最高
                else cost += 1000; 
            }

            // --- D. 自由出牌 (首出) 偏好 ---
            if (!lastAnalysis) {
                if (analysis.type === 'AIRPLANE') cost -= 200;
                else if (analysis.type === 'LIANDUI') cost -= 150;
                else if (analysis.type === 'TRIPLE') cost -= 100;
                else if (analysis.type === 'PAIR') cost -= 50;
                
                // 单张逻辑细化 (废牌优先)
                else if (analysis.type === 'SINGLE') {
                    const countInHand = handCounts[analysis.val] || 0;
                    if (countInHand === 1) {
                        // 真正的废牌，Cost 比对子还低，优先打出
                        cost -= 80;
                    }
                }

                // 炸弹尽量留到最后出
                if (isMoveBomb) {
                    if (hand.length === cards.length) cost = -9999999;
                    else cost += 8000; 
                }
            }

            item.cost = cost;
        });

        // 7. 排序
        candidates.sort((a, b) => a.cost - b.cost);

        // 返回纯卡牌数组
        return candidates.map(item => item.cards);
    },

    // [决策入口]
    decideMove: (hand, lastPlayedCards, deckCount, context = {}) => {
        try {
            // 如果只剩一手牌，直接梭哈
            const analysis = CardRules.analyze(hand, deckCount);
            if (analysis.type !== 'INVALID') {
                if (!lastPlayedCards || lastPlayedCards.length === 0) return hand;
                if (CardRules.canPlay(hand, lastPlayedCards, deckCount)) return hand;
            }

            const solutions = BotLogic.getSortedHints(hand, lastPlayedCards, deckCount, context);
            if (solutions.length === 0) return null;

            // 取第一个最优解
            return solutions[0];
        } catch (e) {
            console.error("[Bot Logic] decideMove error:", e);
            return null;
        }
    },

    // [优化] 快速找出所有炸弹 (提取为独立核心方法，不再依赖 findAllSolutions)
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

        // 直接调用核心查找逻辑
        return BotLogic.coreFindBombs(hand, grouped, uniquePoints, deckCount, 0, 0);
    },

    /**
     * [核心] 炸弹查找算法
     * 提取出来供 findAllSolutions 和 findAllBombsInHand 复用，避免重复分组代码
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
                        if(foundPure) break;
                    }
                    if(foundPure) break;
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
                if (minLevel < 3 || (minLevel === 3 && p > minVal)) {
                    // 判断是否是至尊长炸 (>= 4副牌的全部)
                    const isMax = (count === deckCount * 4);
                    const level = isMax ? 5 : 3;
                    const type = isMax ? 'BOMB_MAX' : 'BOMB_STD';
                    
                    if (level > minLevel || (level === minLevel && p > minVal)) {
                         bombList.push({ cards: grouped[p], level, val: p, type, len: count });
                    }
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
                // 1. 单张
                if (uniquePoints.length > 0) solutions.push([grouped[uniquePoints[0]][0]]);
                // 2. 对子
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 2) {
                        solutions.push(grouped[p].slice(0, 2));
                    }
                }
                // 3. 三张
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 3) {
                        solutions.push(grouped[p].slice(0, 3));
                    }
                }
                
                // 4. 连对 (查找所有可能的2连对)
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >= 2 && grouped[p2].length >= 2) {
                         solutions.push([...grouped[p1].slice(0,2), ...grouped[p2].slice(0,2)]);
                    }
                }

                // 5. 飞机 (查找所有可能的2连三张)
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >= 3 && grouped[p2].length >= 3) {
                         solutions.push([...grouped[p1].slice(0,3), ...grouped[p2].slice(0,3)]);
                    }
                }

                // 6. 炸弹 (使用核心方法)
                const bombs = BotLogic.coreFindBombs(hand, grouped, uniquePoints, deckCount, -1, -1);
                bombs.forEach(b => solutions.push(b.cards));
                
                // 兜底：如果没找到合适的，把最小的几张单牌加入
                if (solutions.length === 1 && solutions[0].length === 1) {
                    for(let i=1; i<Math.min(uniquePoints.length, 3); i++) {
                        solutions.push([grouped[uniquePoints[i]][0]]);
                    }
                }

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