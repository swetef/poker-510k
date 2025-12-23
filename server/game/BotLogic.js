const CardRules = require('./CardRules');

const BotLogic = {
    WEIGHTS: {
        BREAK_BOMB_PENALTY: 100, // 拆炸弹惩罚(Bot决策用)
        PLAY_TRASH_BONUS: 10,    // 出废牌奖励(Bot决策用)
    },

    // [新增/核心] 获取经过智能排序的提示列表
    getSortedHints: (hand, lastPlayedCards, deckCount) => {
        // 1. 获取所有合法解
        const solutions = BotLogic.findAllSolutions(hand, lastPlayedCards, deckCount);
        if (!solutions || solutions.length === 0) return [];

        // 2. 分析手牌中的炸弹（用于判断是否拆了炸弹）
        const myBombs = BotLogic.findAllBombsInHand(hand, deckCount);
        const bombCardsSet = new Set();
        myBombs.forEach(b => b.cards.forEach(c => bombCardsSet.add(c)));

        // 3. 分析上家牌型
        const lastAnalysis = (lastPlayedCards && lastPlayedCards.length > 0)
            ? CardRules.analyze(lastPlayedCards, deckCount)
            : null;
        const lastIsBomb = lastAnalysis ? lastAnalysis.level > 0 : false;

        // 4. 对每个方案计算 Cost (代价越低越优先)
        const scoredSolutions = solutions.map(sol => {
            const analysis = CardRules.analyze(sol, deckCount);
            let cost = 0;
            
            // --- A. [修复] 基础分：优化炸弹与普通牌的排序 ---
            // 之前的逻辑只加 val，导致长炸弹(7个3)比短炸弹(4个8) Cost低，Bot会先扔大炸弹
            if (analysis.level > 0) {
                // 炸弹：Level 权重 > Length 权重 > Value 权重
                cost += analysis.level * 100000;
                
                // 510K 的 level 比较低 (1或2)，会被普通炸弹(level 3)压制，符合逻辑
                
                // 普通炸弹 (Level 3) 或 至尊炸弹 (Level 5)
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
                // 如果出的不是炸弹，检查是否用了炸弹里的牌
                const breaksBomb = sol.some(c => bombCardsSet.has(c));
                if (breaksBomb) {
                    cost += 2000000; // [修改] 极大的惩罚：Bot 绝不应拆炸弹，除非是最后没办法
                }
            }

            // --- C. 炸弹压制判断 (避免大材小用) ---
            if (isMoveBomb && !lastIsBomb && lastAnalysis) {
                // 上家不是炸弹，我用炸弹管 -> 亏，除非这是为了赢
                // 但如果这手牌打完就赢了，则无视 Cost
                if (hand.length === sol.length) cost = -9999999;
                else cost += 1000; 
            }

            // --- D. 自由出牌 (首出) 偏好 ---
            if (!lastAnalysis) {
                // 优先出复杂牌型，快速减少手牌数量
                if (analysis.type === 'AIRPLANE') cost -= 200;
                else if (analysis.type === 'LIANDUI') cost -= 150;
                else if (analysis.type === 'TRIPLE') cost -= 100;
                else if (analysis.type === 'PAIR') cost -= 50;
                
                // 炸弹尽量留到最后出，除非它是为了冲刺
                if (isMoveBomb) {
                    // 如果只剩炸弹了，那就赶紧出
                    if (hand.length === sol.length) cost = -9999999;
                    else cost += 8000; // [修改] Bot 也不要起手扔炸弹
                }
            }

            return { sol, cost };
        });

        // 5. 排序：代价小的在前
        scoredSolutions.sort((a, b) => a.cost - b.cost);

        return scoredSolutions.map(item => item.sol);
    },

    // [智能决策入口]
    decideMove: (hand, lastPlayedCards, deckCount) => {
        try {
            // 如果只剩一手牌，直接梭哈
            const analysis = CardRules.analyze(hand, deckCount);
            if (analysis.type !== 'INVALID') {
                if (!lastPlayedCards || lastPlayedCards.length === 0) return hand;
                if (CardRules.canPlay(hand, lastPlayedCards, deckCount)) return hand;
            }

            const solutions = BotLogic.getSortedHints(hand, lastPlayedCards, deckCount);
            if (solutions.length === 0) return null;

            // getSortedHints 已经排好序了，直接取第一个最优解
            // 简单的贪婪策略：取 Cost 最低的
            return solutions[0];
        } catch (e) {
            console.error("BotLogic decideMove error:", e);
            return null;
        }
    },

    // 辅助：找出所有炸弹
    findAllBombsInHand: (hand, deckCount) => {
        const bombs = [];
        // 调用 findAllSolutions 查找所有炸弹 (level >= 1)
        const allSols = BotLogic.findAllSolutions(hand, [], deckCount);
        allSols.forEach(sol => {
            const analysis = CardRules.analyze(sol, deckCount);
            if (analysis.level > 0) {
                bombs.push({ cards: sol, ...analysis });
            }
        });
        return bombs;
    },

    // 找出所有可行的出牌方案
    findAllSolutions: (hand, lastPlayedCards, deckCount) => {
        try {
            const solutions = [];
            
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

            const findAllBombs = (minLevel = 0, minVal = 0) => {
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
                                            bombList.push({ cards: [f, t, k], level: 2, val: 999 }); 
                                            foundPure = true;
                                        }
                                    }
                                }
                                if(foundPure) break;
                            }
                            if(foundPure) break;
                        }
                        
                        if (!foundPure && minLevel <= 1) {
                            bombList.push({ cards: [fives[0], tens[0], kings[0]], level: 1, val: 1 });
                        }
                    }
                }

                // B. 普通炸弹 (Level 3)
                for (let p of uniquePoints) {
                    const count = grouped[p].length;
                    if (count >= 4) {
                        if (minLevel < 3 || (minLevel === 3 && p > minVal)) {
                            bombList.push({ cards: grouped[p], level: 3, val: p });
                        }
                    }
                }

                // C. 天王炸 (Level 4)
                const jokers = hand.filter(c => CardRules.getPoint(c) >= 16);
                if (jokers.length === deckCount * 2) {
                    if (minLevel < 4) {
                        bombList.push({ cards: jokers, level: 4, val: 999 });
                    }
                }

                return bombList;
            };

            // --- 场景 1: 自由出牌 (First Play) ---
            if (!lastPlayedCards || lastPlayedCards.length === 0) {
                // 1. 单张
                if (uniquePoints.length > 0) solutions.push([grouped[uniquePoints[0]][0]]);
                // 2. 对子
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 2) {
                        solutions.push(grouped[p].slice(0, 2));
                        // [优化] 不再 break，允许找大一点的对子，虽然通常出最小的，但留给Cost函数决定
                    }
                }
                // 3. 三张
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 3) {
                        solutions.push(grouped[p].slice(0, 3));
                    }
                }
                
                // [优化] 4. 连对 (查找所有可能的2连对)
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    // 必须连续，且不能超过A(14)，因为2不能连
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >= 2 && grouped[p2].length >= 2) {
                         solutions.push([...grouped[p1].slice(0,2), ...grouped[p2].slice(0,2)]);
                         // [重要提升] 不再 break，这样 Bot 能发现中间段的连对
                    }
                }

                // [优化] 5. 飞机 (查找所有可能的2连三张)
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >= 3 && grouped[p2].length >= 3) {
                         solutions.push([...grouped[p1].slice(0,3), ...grouped[p2].slice(0,3)]);
                    }
                }

                // 6. 炸弹 (调用核心逻辑)
                const bombs = findAllBombs(-1, -1);
                bombs.forEach(b => solutions.push(b.cards));
                
                // 兜底：如果没找到啥牌，就把前几个单张都加进去备选
                if (solutions.length < 3) {
                    for(let i=0; i<Math.min(uniquePoints.length, 3); i++) {
                        solutions.push([grouped[uniquePoints[i]][0]]);
                    }
                }

                return solutions;
            }

            // --- 场景 2: 管牌 (Beat It) ---
            const lastState = CardRules.analyze(lastPlayedCards, deckCount);
            if (lastState.type === 'INVALID') return [];

            // 策略 A: 同牌型压制
            if (['SINGLE', 'PAIR', 'TRIPLE'].includes(lastState.type)) {
                const countNeeded = lastState.type === 'SINGLE' ? 1 : (lastState.type === 'PAIR' ? 2 : 3);
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

            // 策略 C: 炸弹压制
            const currentLevel = lastState.level || 0;
            const currentVal = lastState.val || 0;
            
            const bombs = findAllBombs(currentLevel, currentVal);
            
            bombs.forEach(b => {
                if (CardRules.canPlay(b.cards, lastPlayedCards, deckCount)) {
                    solutions.push(b.cards);
                }
            });

            return solutions;
        } catch (e) {
            console.error("BotLogic findAllSolutions error:", e);
            return [];
        }
    }
};

module.exports = BotLogic;