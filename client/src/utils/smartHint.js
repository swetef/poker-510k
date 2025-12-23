/**
 * 智能提示逻辑
 * 根据手牌和上家牌型，计算所有可行解，并按优劣排序
 * * [修改记录]
 * 1. 过滤掉了 510K 牌型，提示不再推荐 510K。
 * 2. 优化自由出牌逻辑：优先出“真正的单张废牌”，不再优先拆对子出单张。
 */
import GameRules from './gameRules.js';

const SmartHint = {
    
    /**
     * 获取经过智能排序的提示列表
     * @param {Array} hand 手牌数组
     * @param {Array} lastPlayedCards 上家出的牌 (空数组代表首出)
     * @param {Number} deckCount 牌副数
     * @returns {Array[]} 候选牌型数组
     */
    getSortedHints: (hand, lastPlayedCards, deckCount = 2) => {
        // 1. 获取所有合法解
        let solutions = SmartHint.findAllSolutions(hand, lastPlayedCards, deckCount);
        if (!solutions || solutions.length === 0) return [];

        // [修改] 过滤掉 510K 牌型 (提示和托管不会自动出 510K)
        solutions = solutions.filter(sol => {
            const type = GameRules.analyze(sol, deckCount).type;
            return type !== '510K_PURE' && type !== '510K_MIXED';
        });

        if (solutions.length === 0) return [];

        // 2. 预分析手牌中的炸弹（用于判断出牌是否拆了炸弹）
        const myBombs = SmartHint.findAllBombsInHand(hand, deckCount);
        const bombCardsSet = new Set();
        myBombs.forEach(b => b.cards.forEach(c => bombCardsSet.add(c)));

        // 3. 分析上家牌型
        const lastAnalysis = (lastPlayedCards && lastPlayedCards.length > 0)
            ? GameRules.analyze(lastPlayedCards, deckCount)
            : null;
        const lastIsBomb = lastAnalysis ? lastAnalysis.level > 0 : false;

        // [新增] 统计手牌中每个点数的数量，用于识别“废牌”
        const handCounts = {};
        hand.forEach(c => {
            const p = GameRules.getPoint(c);
            handCounts[p] = (handCounts[p] || 0) + 1;
        });

        // 4. 对每个方案计算 Cost (代价越低越优先)
        const scoredSolutions = solutions.map(sol => {
            const analysis = GameRules.analyze(sol, deckCount);
            let cost = 0;
            
            // --- A. 基础分计算 ---
            if (analysis.level > 0) {
                // 是炸弹：Level 权重最大，其次是张数，最后是点数
                cost += analysis.level * 100000;
                
                // 普通炸弹和至尊炸弹，张数权重很高
                if (analysis.type === 'BOMB_STD' || analysis.type === 'BOMB_MAX') {
                    cost += analysis.len * 1000;
                }
                
                cost += analysis.val; // 最后才是点数微调
            } else {
                // 普通牌型 (单张、对子等)：直接按点数排
                cost += analysis.val;
            }

            // --- B. 拆炸弹惩罚 ---
            const isMoveBomb = analysis.level > 0;
            if (!isMoveBomb) {
                // 如果出的不是炸弹，检查是否用了炸弹里的牌
                const breaksBomb = sol.some(c => bombCardsSet.has(c));
                if (breaksBomb) {
                    cost += 2000000; // 严禁拆炸弹
                }
            }

            // --- C. 炸弹压制判断 (避免大材小用) ---
            if (isMoveBomb && !lastIsBomb && lastAnalysis) {
                // 上家不是炸弹，我用炸弹管 -> 略亏，除非这是最后一手
                cost += 500; 
            }

            // --- D. 自由出牌 (首出) 策略优化 ---
            if (!lastAnalysis) {
                if (analysis.type === 'AIRPLANE') cost -= 200;
                else if (analysis.type === 'LIANDUI') cost -= 150;
                else if (analysis.type === 'TRIPLE') cost -= 100;
                else if (analysis.type === 'PAIR') cost -= 50; // 对子优惠 50
                
                // [关键修改] 单张逻辑细化
                else if (analysis.type === 'SINGLE') {
                    const countInHand = handCounts[analysis.val] || 0;
                    
                    if (countInHand === 1) {
                        // 真正的废牌（手里只有这一张）：给予极高优先级
                        // 设定为 -80，比对子的 -50 更小，所以会优先出单张废牌
                        cost -= 80; 
                    } else {
                        // 如果 countInHand > 1，说明是拆了对子或三张打的单牌
                        // 不给予减分优惠，Cost = val (正数)
                        // 这样 Cost(-80) < Cost(Pair -50) < Cost(Single positive)
                        // 顺序变成：废牌 > 对子 > 拆开的单牌
                    }
                }
                
                // 首出炸弹惩罚
                if (isMoveBomb) {
                    // 如果这手牌出完就跑了，那就无视 Cost 优先出
                    if (hand.length === sol.length) cost = -9999999;
                    else cost += 8000; // 避免起手扔炸弹
                }
            }

            return { sol, cost };
        });

        // 5. 排序：代价小的在前
        scoredSolutions.sort((a, b) => a.cost - b.cost);

        return scoredSolutions.map(item => item.sol);
    },

    // 辅助：快速找出所有炸弹 (纯净版，不包含其他牌型逻辑)
    findAllBombsInHand: (hand, deckCount) => {
        // 先对牌进行分组
        const grouped = {};
        hand.forEach(c => {
            const p = GameRules.getPoint(c);
            if (!grouped[p]) grouped[p] = [];
            grouped[p].push(c);
        });
        
        // 获取所有去重后的点数
        const points = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        
        // 直接调用核心炸弹查找逻辑，不需要 lastPlayedCards 参数
        return SmartHint.coreFindBombs(hand, grouped, points, deckCount, 0, 0);
    },

    /**
     * [核心逻辑] 仅查找炸弹
     * 提取出来供 findAllSolutions 和 findAllBombsInHand 复用
     */
    coreFindBombs: (hand, grouped, uniquePoints, deckCount, minLevel = 0, minVal = 0) => {
        const bombList = [];

        // A. 510K (Level 1 & 2)
        if (minLevel <= 2) {
            const fives = grouped[5] || [];
            const tens = grouped[10] || [];
            const kings = grouped[13] || []; // K
            
            if (fives.length > 0 && tens.length > 0 && kings.length > 0) {
                // 寻找纯色
                let foundPure = false;
                for (let f of fives) {
                    for (let t of tens) {
                        for (let k of kings) {
                            const s1 = GameRules.getSuit(f);
                            const s2 = GameRules.getSuit(t);
                            const s3 = GameRules.getSuit(k);
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
                
                // 杂色 (如果没找到纯色，或者不限制)
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
        const jokers = hand.filter(c => GameRules.getPoint(c) >= 16);
        if (jokers.length === deckCount * 2) {
            if (minLevel < 4) {
                bombList.push({ cards: jokers, level: 4, val: 999 });
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
                const p = GameRules.getPoint(c);
                if (!grouped[p]) {
                    grouped[p] = [];
                    points.push(p);
                }
                grouped[p].push(c);
            });
            // 排序去重后的点数
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
                        // 不 break，允许找大一点的对子，让 Cost 函数决定
                    }
                }
                // 3. 三张
                for (let p of uniquePoints) {
                    if (grouped[p].length >= 3) {
                        solutions.push(grouped[p].slice(0, 3));
                    }
                }
                // 4. 连对 (简单检测)
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >=2 && grouped[p2].length >= 2) {
                         solutions.push([...grouped[p1].slice(0,2), ...grouped[p2].slice(0,2)]);
                    }
                }

                // 5. 炸弹 (调用核心逻辑)
                const bombs = SmartHint.coreFindBombs(hand, grouped, uniquePoints, deckCount, -1, -1);
                bombs.forEach(b => solutions.push(b.cards));
                
                // 如果以上都没生成 (比如只有单张)，把前3小的单张加入
                if (solutions.length === 1 && solutions[0].length === 1) {
                    for(let i=1; i<Math.min(uniquePoints.length, 3); i++) {
                        solutions.push([grouped[uniquePoints[i]][0]]);
                    }
                }

                return solutions;
            }

            // --- 场景 2: 管牌 (Beat It) ---
            const lastState = GameRules.analyze(lastPlayedCards, deckCount);
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
                
                for(let v = startVal; v <= 14; v++) { 
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
            
            // 调用核心逻辑
            const bombs = SmartHint.coreFindBombs(hand, grouped, uniquePoints, deckCount, 0, 0);
            
            bombs.forEach(b => {
                if (GameRules.canPlay(b.cards, lastPlayedCards, deckCount)) {
                    solutions.push(b.cards);
                }
            });

            return solutions;
        } catch (e) {
            console.error("SmartHint findAllSolutions error:", e);
            return [];
        }
    }
};

export default SmartHint;