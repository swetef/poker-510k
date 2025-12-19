// ... existing code ...
const CardRules = require('./CardRules');

const BotLogic = {
    // ... (保留 WEIGHTS 和 decideMove 等函数不变) ...
    WEIGHTS: {
        BREAK_BOMB_PENALTY: 100, // 拆炸弹惩罚
        PLAY_TRASH_BONUS: 10,    // 出废牌奖励
    },

    // [智能决策入口]
    decideMove: (hand, lastPlayedCards, deckCount) => {
        try {
            const solutions = BotLogic.findAllSolutions(hand, lastPlayedCards, deckCount);
            if (solutions.length === 0) return null;

            // 如果没有上家出牌（自由出牌阶段）
            if (!lastPlayedCards || lastPlayedCards.length === 0) {
                return BotLogic.decideFreePlay(solutions, hand, deckCount);
            } 
            // 如果是跟牌阶段
            else {
                return BotLogic.decideFollowPlay(solutions, hand, lastPlayedCards, deckCount);
            }
        } catch (e) {
            console.error("BotLogic decideMove error:", e);
            // 兜底：返回第一个可行解
            return BotLogic.findAllSolutions(hand, lastPlayedCards, deckCount)[0] || null;
        }
    },

    // ... (保留 decideFreePlay, decideFollowPlay, findAllBombsInHand 函数不变) ...
    // 决策：自由出牌
    decideFreePlay: (solutions, hand, deckCount) => {
        // 策略：优先出“复杂”牌型（飞机、连对），其次出小牌，尽量保留炸弹
        // 给每个方案打分，分数越低越好（cost）
        
        const sortedSolutions = solutions.map(sol => {
            const analysis = CardRules.analyze(sol, deckCount);
            let cost = 0;

            // 1. 优先出长牌 (连对、飞机)
            if (analysis.type === 'AIRPLANE') cost -= 50;
            else if (analysis.type === 'LIANDUI') cost -= 30;
            else if (analysis.type === 'TRIPLE') cost -= 10;
            else if (analysis.type === 'PAIR') cost -= 5;
            else if (analysis.type === 'SINGLE') cost -= 0;
            
            // 2. 尽量不先手出炸弹，除非只剩炸弹
            if (analysis.level > 0) {
                cost += 100; // 除非不得不出
                // 如果手牌只剩这一个炸弹了，那就不算惩罚
                if (hand.length === sol.length) cost -= 200; 
            }

            // 3. 牌点越小越好
            cost += analysis.val;

            return { sol, cost };
        }).sort((a, b) => a.cost - b.cost);

        return sortedSolutions[0].sol;
    },

    // 决策：跟牌
    decideFollowPlay: (solutions, hand, lastPlayedCards, deckCount) => {
        const lastAnalysis = CardRules.analyze(lastPlayedCards, deckCount);
        const lastIsBomb = lastAnalysis.level > 0;

        // 识别手牌中的所有炸弹，标记为“珍贵”
        const myBombs = BotLogic.findAllBombsInHand(hand, deckCount);
        const bombCards = new Set();
        myBombs.forEach(b => b.cards.forEach(c => bombCards.add(c)));

        const validMoves = solutions.map(sol => {
            const analysis = CardRules.analyze(sol, deckCount);
            let cost = 0;

            // 1. 拆炸弹惩罚
            // 如果出的这手牌本身就是炸弹，不惩罚
            // 如果出的这手牌不是炸弹，但用到了 bombCards 里的牌，说明拆了炸弹
            const isMoveBomb = analysis.level > 0;
            if (!isMoveBomb) {
                const breaksBomb = sol.some(c => bombCards.has(c));
                if (breaksBomb) cost += 500; // 极大的惩罚：非必要不拆炸弹
            }

            // 2. 炸弹压制成本
            if (isMoveBomb) {
                // 如果上家不是炸弹（例如上家出单3，我有4个3），用炸弹管很不划算
                if (!lastIsBomb) {
                    cost += 200; 
                    // 除非只剩很少牌了，为了赢可以炸
                    if (hand.length <= 10) cost -= 150;
                } else {
                    // 炸弹管炸弹，正常
                    cost += 0;
                }
            }

            // 3. 牌点越小越好 (用最小的管)
            cost += analysis.val;

            return { sol, cost };
        });

        // 过滤掉成本过高的操作 (例如为了管一个单3而拆炸弹)
        // 阈值设为 400，意味着拆炸弹的操作（500分）会被过滤，除非没有其他选择
        const reasonableMoves = validMoves.filter(m => m.cost < 400);

        if (reasonableMoves.length > 0) {
            // 在合理的操作里选成本最低的
            reasonableMoves.sort((a, b) => a.cost - b.cost);
            return reasonableMoves[0].sol;
        } else {
            // 如果所有操作都不合理（都要拆炸弹），那么：
            // 1. 如果上家出的是大牌（比如 2 或王），那PASS算了
            // 2. 如果手牌很少了，拼了
            // 暂定策略：直接PASS，不要为了管小牌拆炸弹
            return null; 
        }
    },

    // 辅助：找出所有炸弹（用于避免拆牌）
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

    // 找出所有可行的出牌方案 (保持原有逻辑，增强连对检测)
    findAllSolutions: (hand, lastPlayedCards, deckCount) => {
        try {
            const solutions = [];
            
            // 1. 预处理手牌：分组 + 排序
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

            // --- 辅助函数：查找所有炸弹 ---
            const findAllBombs = (minLevel = 0, minVal = 0) => {
                // ... (保留 findAllBombs 内部逻辑不变) ...
                const bombList = [];

                // A. 510K (Level 1 & 2)
                if (minLevel <= 2) {
                    const fives = grouped[5] || [];
                    const tens = grouped[10] || [];
                    const kings = grouped[13] || []; // K
                    
                    if (fives.length > 0 && tens.length > 0 && kings.length > 0) {
                        // 简化：只找第一套纯色或者第一套杂色，防止穷举过多
                        let foundPure = false;
                        // 优先找纯色
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
                // ... (保留自由出牌逻辑不变) ...
                // 1. 最小单张
                if (uniquePoints.length > 0) solutions.push([grouped[uniquePoints[0]][0]]);
                // 2. 最小对子
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 2) {
                        solutions.push(grouped[p].slice(0, 2));
                        break; 
                    }
                }
                // 3. 最小三张
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 3) {
                        solutions.push(grouped[p].slice(0, 3));
                        break;
                    }
                }
                // 4. 炸弹 (如果想出也可以出)
                const bombs = findAllBombs(-1, -1);
                bombs.forEach(b => solutions.push(b.cards));
                
                return solutions;
            }

            // --- 场景 2: 管牌 (Beat It) ---
            const lastState = CardRules.analyze(lastPlayedCards, deckCount);
            if (lastState.type === 'INVALID') return [];

            // 策略 A: 同牌型压制 (单/对/三)
            if (['SINGLE', 'PAIR', 'TRIPLE'].includes(lastState.type)) {
                const countNeeded = lastState.type === 'SINGLE' ? 1 : (lastState.type === 'PAIR' ? 2 : 3);
                
                for (let p of uniquePoints) {
                    if (p > lastState.val && grouped[p].length >= countNeeded) {
                        solutions.push(grouped[p].slice(0, countNeeded));
                    }
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

            // [新增] 对结果进行排序，确保提示顺序符合玩家预期（牌力从小到大）
            // 修复：之前只是按找到的顺序（通常是点数顺序），导致可能先提示 5个3，后提示 4个4（实际4个4更小更优）
            solutions.sort((a, b) => {
                const anaA = CardRules.analyze(a, deckCount);
                const anaB = CardRules.analyze(b, deckCount);
                
                // 1. 优先非炸弹 (Level 0) vs 炸弹
                const levelA = anaA.level || 0;
                const levelB = anaB.level || 0;
                if (levelA !== levelB) return levelA - levelB;

                // 2. 如果都是炸弹
                if (levelA > 0) {
                    // 同为普通炸弹：张数优先（张数少的小）
                    if (anaA.type === 'BOMB_STD' && anaB.type === 'BOMB_STD') {
                        if (anaA.len !== anaB.len) return anaA.len - anaB.len;
                    }
                    // 510K 和 炸弹 和 王炸 之间的 Level 已经处理了
                }

                // 3. 最后比点数
                return anaA.val - anaB.val;
            });

            return solutions;
        } catch (e) {
            console.error("BotLogic findAllSolutions error:", e);
            return [];
        }
    }
};

module.exports = BotLogic;