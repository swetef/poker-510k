// 牌库生成与洗牌 - [增强版] 支持公平不洗牌 & 模拟线下叠牌模式 & 精确控制模式
// 基于《基于4人4副牌的洗牌算法及扩展到3-8适配的说明》实现
// [修复] 增加“目标分数补齐机制”，确保多副牌局一定会出现大炸弹
// [修复] 优化“模拟洗牌”逻辑，增加插洗防止牌序过于整齐导致Bot崩溃，增加废牌容错补齐

const CardRules = require('./CardRules');

class Deck {
    constructor(deckCount = 2) {
        this.deck = [];
        this.deckCount = deckCount;
        // 生成多副牌。每副牌是 0-53。
        // 0-12: 黑桃A-K, 13-25: 红桃, 26-38: 梅花, 39-51: 方片, 52: 小王, 53: 大王
        for (let d = 0; d < deckCount; d++) {
             for (let i = 0; i < 54; i++) {
                this.deck.push(i + d * 54); 
            }
        }

        // --- 配置参数定义 (基于文档) ---
        
        // 1. 模式参数
        this.modeConfigs = {
            'normal': { 
                name: '常规模式',
                bombProb: 0.15,     // 基础生成概率
                scoreFactor: 1.0,   // 分数范围系数
                polarization: 0.2,  // 极化程度
                limitPerPoint: 1,   // 每个点数最多生成炸弹数
                dist: { small: 0.50, mid: 0.30, big: 0.15, huge: 0.05 } 
            },
            'stimulating': { 
                name: '刺激模式',
                bombProb: 0.30,
                scoreFactor: 1.3, 
                polarization: 0.5,
                limitPerPoint: 1,
                dist: { small: 0.30, mid: 0.35, big: 0.25, huge: 0.10 }
            },
            'thrilling': { 
                name: '惊险模式',
                bombProb: 0.50,
                scoreFactor: 1.8, 
                polarization: 0.7,
                limitPerPoint: 2,
                dist: { small: 0.25, mid: 0.30, big: 0.25, huge: 0.20 }
            },
            'exciting': { 
                name: '爽局模式',
                bombProb: 0.80,
                scoreFactor: 2.2, 
                polarization: 0.9,
                limitPerPoint: 2,
                dist: { small: 0.15, mid: 0.20, big: 0.30, huge: 0.35 }
            }
        };

        // 2. 基础分数范围 (基准: 4人4副牌)
        this.baseScoreRange = [36, 50]; 
        
        // 3. 炸弹分级定义 (分数)
        this.bombScores = { small: 1, mid: 2, big: 5, huge: 10 };
    }

    /**
     * 获取当前人数下的炸弹尺寸阈值
     */
    _getBombThresholds(deckCount) {
        const smallMax = 6; 
        const midMax = 9;   
        
        if (deckCount === 3) {
            return { small: [4, 6], mid: [7, 9], big: [10, 12], huge: null };
        }

        const bigMax = 12 + (deckCount - 4) * 2;
        const totalMax = deckCount * 4;

        return {
            small: [4, 6],
            mid: [7, 9],
            big: [10, bigMax],
            huge: [bigMax + 1, totalMax]
        };
    }

    /**
     * 1. 普通洗牌 (Fisher-Yates)
     */
    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    /**
     * 2. [均贫富] 简单公平策略
     */
    shuffleFairNoShuffle(playerCount) {
        const groupMap = {}; 
        const looseCards = []; 

        this.deck.forEach(card => {
            const point = CardRules.getPoint(card);
            if (!groupMap[point]) groupMap[point] = [];
            groupMap[point].push(card);
        });

        const bombChunks = []; 
        Object.values(groupMap).forEach(cards => {
            if (cards.length < 4) {
                looseCards.push(...cards);
                return;
            }
            let remaining = [...cards];
            while (remaining.length >= 4) {
                const chunkSize = Math.min(remaining.length, 4 + Math.floor(Math.random() * 3));
                const chunk = remaining.splice(0, chunkSize);
                bombChunks.push(chunk);
            }
            if (remaining.length > 0) looseCards.push(...remaining);
        });

        for (let i = bombChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bombChunks[i], bombChunks[j]] = [bombChunks[j], bombChunks[i]];
        }

        const playerBuckets = Array.from({ length: playerCount }, () => []);
        bombChunks.forEach((chunk, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(...chunk);
        });

        for (let i = looseCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [looseCards[i], looseCards[j]] = [looseCards[j], looseCards[i]];
        }
        looseCards.forEach((card, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(card);
        });

        this.deck = []; 
        playerBuckets.forEach(bucket => {
            for (let i = bucket.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
            }
            this.deck.push(...bucket);
        });
    }

    /**
     * 3. [模拟洗牌] 叠牌 + 切牌 + 插洗
     * [修复] 增加容错性，防止因牌数微小差异导致的回退
     * [优化] 增加洗牌混乱度，防止牌序过于整齐导致 Bot 计算卡死
     */
    shuffleSimulation(lastRoundCards) {
        // 1. 基础校验与清洗
        if (!lastRoundCards || !Array.isArray(lastRoundCards)) {
            console.log("[Deck] Invalid last round cards, using random shuffle.");
            this.shuffle();
            return;
        }

        // 过滤非法卡牌 (防止 undefined 导致 crash)
        const cleanCards = lastRoundCards.filter(c => typeof c === 'number' && !isNaN(c));
        
        // 2. 长度校验与补齐
        // 如果差异过大（超过10%），说明可能上一局数据有问题，回退随机
        if (Math.abs(cleanCards.length - this.deck.length) > this.deck.length * 0.1) {
             console.log(`[Deck] Card count mismatch too large (${cleanCards.length} vs ${this.deck.length}), reset to random.`);
             this.shuffle();
             return;
        }

        console.log("[Deck] Using Simulation Shuffle (Stacking + Cutting + Riffle)");
        
        // 使用上一局的牌
        this.deck = [...cleanCards];

        // 如果牌少了，补齐 (从原始 deck 里找缺失的)
        if (this.deck.length < this.deckCount * 54) {
             const existingSet = new Set(this.deck);
             const fullDeck = [];
             for(let d=0; d<this.deckCount; d++) {
                 for(let i=0; i<54; i++) fullDeck.push(i + d*54);
             }
             const missing = fullDeck.filter(c => !existingSet.has(c));
             // 打乱缺失的牌再补进去
             for (let i = missing.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [missing[i], missing[j]] = [missing[j], missing[i]];
            }
            this.deck.push(...missing);
            console.log(`[Deck] Filled ${missing.length} missing cards.`);
        }
        // 如果牌多了（极罕见），截断
        if (this.deck.length > this.deckCount * 54) {
            this.deck.length = this.deckCount * 54;
        }

        // 3. 模拟切牌 (增加次数到 3-5 次)
        const cutCount = 3 + Math.floor(Math.random() * 3); 
        for (let k = 0; k < cutCount; k++) {
            const minCut = Math.floor(this.deck.length * 0.3);
            const maxCut = Math.floor(this.deck.length * 0.7);
            const cutPoint = minCut + Math.floor(Math.random() * (maxCut - minCut));
            
            const topPart = this.deck.slice(0, cutPoint);
            const bottomPart = this.deck.slice(cutPoint);
            this.deck = [...bottomPart, ...topPart];
        }

        // 4. [新增] 模拟插洗 (Riffle Shuffle) - 关键！
        // 仅切牌会导致牌序依然保留大块连续，插洗能有效打散局部，避免 Bot 拿到太完美的牌
        const mid = Math.floor(this.deck.length / 2);
        const left = this.deck.slice(0, mid);
        const right = this.deck.slice(mid);
        const riffled = [];
        
        while(left.length > 0 || right.length > 0) {
            // 随机从左或右掉落 1-4 张牌
            const nLeft = Math.floor(Math.random() * 4) + 1;
            const nRight = Math.floor(Math.random() * 4) + 1;
            
            if (left.length > 0) riffled.push(...left.splice(0, nLeft));
            if (right.length > 0) riffled.push(...right.splice(0, nRight));
        }
        this.deck = riffled;
    }

    /**
     * 4. [精确控制洗牌] 核心算法实现
     */
    shufflePrecise(playerCount, mode = 'stimulating') {
        const config = this.modeConfigs[mode] || this.modeConfigs['stimulating'];
        const deckCount = this.deckCount;
        const thresholds = this._getBombThresholds(deckCount);

        console.log(`[Deck] Precise Shuffle | Mode: ${config.name} | Decks: ${deckCount}`);

        // --- Step 1: 归类整理 ---
        const cardsByPoint = {}; 
        const jokers = [];
        
        this.deck.forEach(card => {
            const pt = CardRules.getPoint(card);
            if (pt >= 16) jokers.push(card);
            else {
                if (!cardsByPoint[pt]) cardsByPoint[pt] = [];
                cardsByPoint[pt].push(card);
            }
        });

        const availablePoints = Object.keys(cardsByPoint).map(Number);
        for (let i = availablePoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availablePoints[i], availablePoints[j]] = [availablePoints[j], availablePoints[i]];
        }

        const generatedBombs = []; 
        let currentTotalScore = 0;

        // --- Step 2: 概率生成 ---
        availablePoints.forEach(pt => {
            const pool = cardsByPoint[pt];
            if (!pool || pool.length < 4) return;

            for (let i = 0; i < config.limitPerPoint; i++) {
                if (pool.length < 4) break;
                if (Math.random() < config.bombProb) {
                    const bomb = this._generateSingleBomb(pool, config.dist, thresholds);
                    if (bomb) {
                        generatedBombs.push(bomb);
                        currentTotalScore += bomb.score;
                    }
                }
            }
        });

        // --- Step 3: 目标分数补齐 ---
        const baseTargetMin = this.baseScoreRange[0];
        const targetMinScore = Math.floor(baseTargetMin * config.scoreFactor * (playerCount / 4));
        
        console.log(`[Deck] Score Check: Current ${currentTotalScore} / Target ${targetMinScore}`);

        if (currentTotalScore < targetMinScore) {
            console.log(`[Deck] Score insufficient, force generating bombs...`);
            availablePoints.sort((a, b) => {
                const lenA = cardsByPoint[a] ? cardsByPoint[a].length : 0;
                const lenB = cardsByPoint[b] ? cardsByPoint[b].length : 0;
                return lenB - lenA; 
            });

            for (let pt of availablePoints) {
                if (currentTotalScore >= targetMinScore) break;
                const pool = cardsByPoint[pt];
                if (!pool || pool.length < 4) continue;

                const aggressiveDist = { small: 0.1, mid: 0.2, big: 0.4, huge: 0.3 };
                const bomb = this._generateSingleBomb(pool, aggressiveDist, thresholds);
                if (bomb) {
                    generatedBombs.push(bomb);
                    currentTotalScore += bomb.score;
                }
            }
        }

        // --- Step 4: 极化分配 ---
        const playerHands = Array.from({ length: playerCount }, () => ({
            cards: [],
            bombScore: 0
        }));

        generatedBombs.sort((a, b) => b.score - a.score);

        generatedBombs.forEach(bomb => {
            const weights = playerHands.map(p => 100 / (p.bombScore + 5));
            const finalWeights = weights.map(w => w + (Math.random() * config.polarization * 100));

            let totalW = finalWeights.reduce((a, b) => a + b, 0);
            let r = Math.random() * totalW;
            let selectedIdx = 0;
            for (let i = 0; i < playerCount; i++) {
                r -= finalWeights[i];
                if (r <= 0) {
                    selectedIdx = i;
                    break;
                }
            }
            playerHands[selectedIdx].cards.push(...bomb.cards);
            playerHands[selectedIdx].bombScore += bomb.score;
        });

        // --- Step 5: 填充剩余牌 ---
        const looseCards = [...jokers];
        Object.values(cardsByPoint).forEach(cards => looseCards.push(...cards));
        
        for (let i = looseCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [looseCards[i], looseCards[j]] = [looseCards[j], looseCards[i]];
        }

        let pIdx = 0;
        looseCards.forEach(c => {
            playerHands[pIdx].cards.push(c);
            pIdx = (pIdx + 1) % playerCount;
        });

        // --- Step 6: 组装 ---
        this.deck = [];
        playerHands.forEach(ph => {
            const hand = ph.cards;
            for (let i = hand.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [hand[i], hand[j]] = [hand[j], hand[i]];
            }
            this.deck.push(...hand);
        });

        return true; 
    }

    /**
     * 辅助：从牌池中生成一个炸弹
     */
    _generateSingleBomb(pool, dist, thresholds) {
        if (pool.length < 4) return null;

        const rand = Math.random();
        let type = 'small';
        let range = thresholds.small;

        if (thresholds.huge && rand < dist.huge) {
            type = 'huge';
            range = thresholds.huge;
        } else if (rand < dist.huge + dist.big) {
            type = 'big';
            range = thresholds.big;
        } else if (rand < dist.huge + dist.big + dist.mid) {
            type = 'mid';
            range = thresholds.mid;
        }

        const minLen = range[0];
        const maxLen = range[1];
        
        if (pool.length < minLen) {
            if (pool.length >= 4) {
                const count = pool.length;
                if (thresholds.huge && count >= thresholds.huge[0]) type = 'huge';
                else if (count >= thresholds.big[0]) type = 'big';
                else if (count >= thresholds.mid[0]) type = 'mid';
                else type = 'small';
                
                const bombCards = pool.splice(0, count);
                return { cards: bombCards, type, score: this.bombScores[type] };
            }
            return null;
        }

        let targetLen = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
        targetLen = Math.min(targetLen, pool.length);

        const bombCards = pool.splice(0, targetLen);
        return { cards: bombCards, type, score: this.bombScores[type] };
    }

    deal(playerCount, strategy = 'CLASSIC', lastRoundCards = null, preciseMode = 'stimulating') {
        if (strategy === 'NO_SHUFFLE') {
            this.shuffleFairNoShuffle(playerCount);
            return this._dealSequential(playerCount);
        } else if (strategy === 'SIMULATION') {
            this.shuffleSimulation(lastRoundCards);
            return this._dealBlock(playerCount);
        } else if (strategy === 'PRECISE') {
            this.shufflePrecise(playerCount, preciseMode);
            return this._dealSequential(playerCount);
        } else {
            this.shuffle();
            return this._dealSequential(playerCount);
        }
    }

    _dealSequential(playerCount) {
        const hands = {};
        const totalCards = this.deck.length;
        const cardsPerPlayer = Math.floor(totalCards / playerCount); 
        
        for (let i = 0; i < playerCount; i++) {
            hands[i] = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
            if (i === playerCount - 1 && (i + 1) * cardsPerPlayer < totalCards) {
                 hands[i] = this.deck.slice(i * cardsPerPlayer);
            }
        }
        return hands;
    }

    // 增加死循环保护
    _dealBlock(playerCount) {
        const hands = {};
        for(let i=0; i<playerCount; i++) hands[i] = [];
        const blockSize = 4; 
        let currentCardIdx = 0;
        let turn = 0;
        
        let safetyCounter = 0;
        const maxLoops = this.deck.length * 2; // 安全阈值

        while (currentCardIdx < this.deck.length) {
            safetyCounter++;
            if (safetyCounter > maxLoops) {
                console.error("[Deck] Critical: _dealBlock infinite loop detected!");
                break;
            }

            const playerIdx = turn % playerCount;
            const actualSize = Math.min(blockSize, this.deck.length - currentCardIdx);
            const chunk = this.deck.slice(currentCardIdx, currentCardIdx + actualSize);
            hands[playerIdx].push(...chunk);
            currentCardIdx += actualSize;
            turn++;
        }
        return hands;
    }
}

module.exports = Deck;