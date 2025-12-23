/**
 * 智能提示逻辑 (优化版)
 * 根据手牌和上家牌型，计算所有可行解，并按优劣排序
 * [性能优化] 引入 analyze 结果缓存，大幅减少重复计算
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
        const solutions = SmartHint.findAllSolutions(hand, lastPlayedCards, deckCount);
        if (!solutions || solutions.length === 0) return [];

        // [优化] 预计算 analyze 结果，避免后续多次调用 GameRules.analyze (昂贵操作)
        let candidates = solutions.map(sol => ({
            cards: sol,
            analysis: GameRules.analyze(sol, deckCount),
            cost: 0
        }));

        // 2. 过滤
        candidates = candidates.filter(item => {
            const { type } = item.analysis;
            // 过滤掉 510K
            if (type === '510K_PURE' || type === '510K_MIXED') return false;
            return true;
        });

        if (candidates.length === 0) return [];

        // 3. 预分析手牌中的炸弹
        const myBombs = SmartHint.findAllBombsInHand(hand, deckCount);
        const bombCardsSet = new Set();
        myBombs.forEach(b => b.cards.forEach(c => bombCardsSet.add(c)));

        // 4. 分析上家牌型
        const lastAnalysis = (lastPlayedCards && lastPlayedCards.length > 0)
            ? GameRules.analyze(lastPlayedCards, deckCount)
            : null;
        const lastIsBomb = lastAnalysis ? lastAnalysis.level > 0 : false;

        // 5. 统计手牌点数
        const handCounts = {};
        hand.forEach(c => {
            const p = GameRules.getPoint(c);
            handCounts[p] = (handCounts[p] || 0) + 1;
        });

        // 6. 评分 (基于缓存的 analysis)
        candidates.forEach(item => {
            const { analysis, cards } = item;
            let cost = 0;
            
            // --- A. 基础分 ---
            if (analysis.level > 0) {
                cost += analysis.level * 100000;
                if (analysis.type === 'BOMB_STD' || analysis.type === 'BOMB_MAX') {
                    cost += analysis.len * 1000;
                }
                cost += analysis.val;
            } else {
                cost += analysis.val;
            }

            // --- B. 拆炸弹惩罚 ---
            const isMoveBomb = analysis.level > 0;
            if (!isMoveBomb) {
                const breaksBomb = cards.some(c => bombCardsSet.has(c));
                if (breaksBomb) cost += 2000000;
            }

            // --- C. 炸弹压制判断 ---
            if (isMoveBomb && !lastIsBomb && lastAnalysis) {
                cost += 500; 
            }

            // --- D. 自由出牌 (首出) ---
            if (!lastAnalysis) {
                if (analysis.type === 'AIRPLANE') cost -= 200;
                else if (analysis.type === 'LIANDUI') cost -= 150;
                else if (analysis.type === 'TRIPLE') cost -= 100;
                else if (analysis.type === 'PAIR') cost -= 50;
                
                else if (analysis.type === 'SINGLE') {
                    const countInHand = handCounts[analysis.val] || 0;
                    if (countInHand === 1) {
                        // 真正的废牌优先出
                        cost -= 80; 
                    }
                }
                
                if (isMoveBomb) {
                    if (hand.length === cards.length) cost = -9999999;
                    else cost += 8000;
                }
            }

            item.cost = cost;
        });

        // 7. 排序
        candidates.sort((a, b) => a.cost - b.cost);

        return candidates.map(i => i.cards);
    },

    // 辅助：快速找出所有炸弹
    findAllBombsInHand: (hand, deckCount) => {
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
        const uniquePoints = [...new Set(points)].sort((a, b) => a - b);
        
        // 直接调用核心逻辑，不再重复分组
        return SmartHint.coreFindBombs(hand, grouped, uniquePoints, deckCount, 0, 0);
    },

    /**
     * [核心逻辑] 仅查找炸弹
     * 提取出来复用
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
                            const s1 = GameRules.getSuit(f);
                            const s2 = GameRules.getSuit(t);
                            const s3 = GameRules.getSuit(k);
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
        const jokers = hand.filter(c => GameRules.getPoint(c) >= 16);
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
                // 4. 连对
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >= 2 && grouped[p2].length >= 2) {
                         solutions.push([...grouped[p1].slice(0,2), ...grouped[p2].slice(0,2)]);
                    }
                }
                // 5. 飞机
                for(let i=0; i<uniquePoints.length-1; i++) {
                    const p1 = uniquePoints[i];
                    const p2 = uniquePoints[i+1];
                    if (p2 === p1 + 1 && p2 < 15 && grouped[p1].length >= 3 && grouped[p2].length >= 3) {
                         solutions.push([...grouped[p1].slice(0,3), ...grouped[p2].slice(0,3)]);
                    }
                }
                // 6. 炸弹
                const bombs = SmartHint.coreFindBombs(hand, grouped, uniquePoints, deckCount, -1, -1);
                bombs.forEach(b => solutions.push(b.cards));
                
                // 兜底
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

            // A. 同牌型
            if (['SINGLE', 'PAIR', 'TRIPLE'].includes(lastState.type)) {
                const countNeeded = lastState.type === 'SINGLE' ? 1 : (lastState.type === 'PAIR' ? 2 : 3);
                for (let p of uniquePoints) {
                    if (p > lastState.val && grouped[p].length >= countNeeded) {
                        solutions.push(grouped[p].slice(0, countNeeded));
                    }
                }
            }
            
            // 连对
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
            
            // 飞机
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

            // C. 炸弹压制
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