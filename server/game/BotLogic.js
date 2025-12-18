const CardRules = require('./CardRules');

const BotLogic = {
    // [兼容旧接口] 机器人决策仍只取第一个（通常是最小的）
    decideMove: (hand, lastPlayedCards, deckCount) => {
        const solutions = BotLogic.findAllSolutions(hand, lastPlayedCards, deckCount);
        return solutions.length > 0 ? solutions[0] : null;
    },

    // [新接口] 找出所有可行的出牌方案
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
            // 点数去重并排序
            points.sort((a, b) => a - b); 
            // 去除重复点数 (比如 points 里可能有多个 3，如果不去重遍历会重复，但这里我们用 Set 或 includes 判断去重)
            const uniquePoints = [...new Set(points)].sort((a,b)=>a-b);

            // --- 辅助函数：查找所有炸弹 ---
            const findAllBombs = (minLevel = 0, minVal = 0) => {
                const bombList = [];

                // A. 510K (Level 1 & 2)
                if (minLevel <= 2) {
                    const fives = grouped[5] || [];
                    const tens = grouped[10] || [];
                    const kings = grouped[13] || []; // K
                    
                    if (fives.length > 0 && tens.length > 0 && kings.length > 0) {
                        // 简单起见，只组装一套 510K (优先纯色)
                        // 如果要穷举所有 510K 组合会太多，这里简化为：有一套就提示一套
                        let foundPure = false;
                        for (let f of fives) {
                            for (let t of tens) {
                                for (let k of kings) {
                                    const s1 = CardRules.getSuit(f);
                                    const s2 = CardRules.getSuit(t);
                                    const s3 = CardRules.getSuit(k);
                                    if (s1 === s2 && s2 === s3) {
                                        // 纯色 510K (Level 2)
                                        if (2 > minLevel || (2 === minLevel && 100 > minVal)) { // 纯色value此处暂定
                                            bombList.push({ cards: [f, t, k], level: 2, val: 999 }); // 纯色优先
                                            foundPure = true;
                                        }
                                    }
                                }
                                if(foundPure) break;
                            }
                            if(foundPure) break;
                        }
                        
                        if (!foundPure && minLevel <= 1) {
                            // 杂色 510K (Level 1)
                            bombList.push({ cards: [fives[0], tens[0], kings[0]], level: 1, val: 1 });
                        }
                    }
                }

                // B. 普通炸弹 (Level 3)
                // 遍历所有点数，看是否有 >= 4 张
                for (let p of uniquePoints) {
                    const count = grouped[p].length;
                    if (count >= 4) {
                        // 如果要求 Level 3，比较 Val；如果 minLevel < 3，直接加入
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
                // 自由出牌时，循环提示：最小单张 -> 最小对子 -> 最小三张 -> 炸弹
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
                // 4. 所有炸弹
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
                    // 必须点数更大，且张数够
                    if (p > lastState.val && grouped[p].length >= countNeeded) {
                        // 即使是炸弹（4张），如果被拆成单/对/三来管，也是合规的（虽然有点亏）
                        // 为了提示全面，我们把它加进去
                        solutions.push(grouped[p].slice(0, countNeeded));
                    }
                }
            }
            
            // 策略 B: 连对/飞机 (简化处理：只提示炸弹，或者精准匹配)
            // 复杂的连对穷举比较耗时，这里暂时略过连对的同型管法，直接推荐炸弹

            // 策略 C: 炸弹压制
            const currentLevel = lastState.level || 0;
            const currentVal = lastState.val || 0;
            
            const bombs = findAllBombs(currentLevel, currentVal);
            // 此时 bombs 里的已经是符合等级要求的了，除了同级比较
            // findAllBombs 里已经做了简单的 minLevel 过滤，这里再细致排一下
            
            bombs.forEach(b => {
                // 严格校验能不能管
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