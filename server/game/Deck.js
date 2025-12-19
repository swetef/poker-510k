// 牌库生成与洗牌 - [增强版] 支持公平不洗牌 & 模拟线下叠牌模式 & 精确控制模式

const CardRules = require('./CardRules');

class Deck {
    constructor(deckCount = 1) {
        this.deck = [];
        this.deckCount = deckCount;
        // 生成多副牌。每副牌是 0-53。
        for (let d = 0; d < deckCount; d++) {
             for (let i = 0; i < 54; i++) {
                this.deck.push(i + d * 54); 
            }
        }

        // 精确控制模式配置
        this.preciseConfigs = {
            'normal': { totalScoreRange: [36, 50], bombProb: 0.15, hugeProb: 0.1 },      // 常规
            'stimulating': { totalScoreRange: [48, 60], bombProb: 0.30, hugeProb: 0.2 }, // 刺激
            'thrilling': { totalScoreRange: [60, 80], bombProb: 0.50, hugeProb: 0.3 },   // 惊险
            'exciting': { totalScoreRange: [72, 100], bombProb: 0.80, hugeProb: 0.5 }    // 爽局
        };
    }

    // 1. 普通洗牌 (Fisher-Yates) - 彻底打乱
    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // 2. [爽局] 公平的“均贫富”策略 (简单版)
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

        // 打乱炸弹块
        for (let i = bombChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bombChunks[i], bombChunks[j]] = [bombChunks[j], bombChunks[i]];
        }

        const playerBuckets = Array.from({ length: playerCount }, () => []);
        
        // 轮询分发炸弹
        bombChunks.forEach((chunk, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(...chunk);
        });

        // 随机打乱散牌并分发
        for (let i = looseCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [looseCards[i], looseCards[j]] = [looseCards[j], looseCards[i]];
        }
        looseCards.forEach((card, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(card);
        });

        // 重组
        this.deck = []; 
        playerBuckets.forEach(bucket => {
            // 内部微调
            for (let i = bucket.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
            }
            this.deck.push(...bucket);
        });
    }

    // 3. [新模式] 模拟洗牌 (叠牌 + 切牌)
    shuffleSimulation(lastRoundCards) {
        if (!lastRoundCards || lastRoundCards.length !== this.deck.length) {
            console.log("[Deck] No valid last round cards, using random shuffle.");
            this.shuffle();
            return;
        }

        console.log("[Deck] Using Simulation Shuffle (Stacking + Cutting)");
        this.deck = [...lastRoundCards];

        const cutCount = 1 + Math.floor(Math.random() * 2); 
        for (let k = 0; k < cutCount; k++) {
            const minCut = Math.floor(this.deck.length * 0.2);
            const maxCut = Math.floor(this.deck.length * 0.8);
            const cutPoint = minCut + Math.floor(Math.random() * (maxCut - minCut));
            
            const topPart = this.deck.slice(0, cutPoint);
            const bottomPart = this.deck.slice(cutPoint);
            this.deck = [...bottomPart, ...topPart];
        }
    }

    // 4. [加入新算法] 精确控制洗牌 (Precise Control)
    // mode: 'normal' | 'stimulating' | 'thrilling' | 'exciting'
    shufflePrecise(playerCount, mode = 'stimulating') {
        const config = this.preciseConfigs[mode] || this.preciseConfigs['stimulating'];
        console.log(`[Deck] Using Precise Shuffle: ${mode}`);

        // 1. 归类所有牌
        const cardsByPoint = {}; // point -> [cardId]
        const jokers = [];
        
        this.deck.forEach(card => {
            const pt = CardRules.getPoint(card);
            if (pt >= 16) {
                jokers.push(card);
            } else {
                if (!cardsByPoint[pt]) cardsByPoint[pt] = [];
                cardsByPoint[pt].push(card);
            }
        });

        // 2. 构造炸弹库
        const bombs = [];
        const availablePoints = Object.keys(cardsByPoint).map(Number);
        
        // 简单打乱点数顺序，保证每次不是按 3,4,5... 的顺序生成
        for (let i = availablePoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availablePoints[i], availablePoints[j]] = [availablePoints[j], availablePoints[i]];
        }

        availablePoints.forEach(pt => {
            const cards = cardsByPoint[pt];
            if (!cards || cards.length < 4) return;

            // 核心概率控制
            if (Math.random() < config.bombProb) {
                const maxLen = cards.length;
                let bombSize = 4;
                
                // 决定炸弹大小
                const rand = Math.random();
                if (rand < config.hugeProb && maxLen >= 8) {
                    bombSize = Math.min(8 + Math.floor(Math.random() * 3), maxLen); // 8-10张
                } else if (rand < 0.5 && maxLen >= 6) {
                    bombSize = Math.min(6 + Math.floor(Math.random() * 2), maxLen); // 6-7张
                } else {
                    bombSize = Math.min(4 + Math.floor(Math.random() * 2), maxLen); // 4-5张
                }

                // 提取炸弹
                const bombCards = cards.splice(0, bombSize);
                // 简单的分数估算：大小 = 分数权重
                bombs.push({ cards: bombCards, score: bombSize });
            }
        });

        // 3. 极化分配 (模拟：给分低的或者随机分配好牌)
        // 简易实现：将炸弹按大小排序，轮流分发，但这里我们加入随机性
        bombs.sort((a, b) => b.score - a.score); // 大炸弹排前面

        const playerHands = Array.from({ length: playerCount }, () => []);
        
        // 按照“S型”或者“随机权重”分配炸弹，避免一人独吞所有大炸弹
        bombs.forEach((bomb, i) => {
            // 简单轮询 + 随机扰动
            const targetIdx = (i + Math.floor(Math.random() * 2)) % playerCount;
            playerHands[targetIdx].push(...bomb.cards);
        });

        // 4. 分配剩余散牌和大小王
        const looseCards = [...jokers];
        Object.values(cardsByPoint).forEach(cards => looseCards.push(...cards));
        
        // 打乱散牌
        for (let i = looseCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [looseCards[i], looseCards[j]] = [looseCards[j], looseCards[i]];
        }

        // 均匀填补
        let pIdx = 0;
        looseCards.forEach(c => {
            playerHands[pIdx].push(c);
            pIdx = (pIdx + 1) % playerCount;
        });

        // 5. 组装回 this.deck (虽然这步对于直接发牌不是必须的，但保持 Deck 状态一致性)
        this.deck = [];
        playerHands.forEach(hand => {
            // 对每个人的手牌内部再洗一次，防止炸弹和散牌分界太明显
            for (let i = hand.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [hand[i], hand[j]] = [hand[j], hand[i]];
            }
            this.deck.push(...hand);
        });
        
        // 标记为已构造好，deal 时直接切分
        return true; 
    }

    // 发牌入口
    // strategy: 'CLASSIC' | 'NO_SHUFFLE' | 'SIMULATION' | 'PRECISE'
    deal(playerCount, strategy = 'CLASSIC', lastRoundCards = null) {
        
        if (strategy === 'NO_SHUFFLE') {
            this.shuffleFairNoShuffle(playerCount);
            return this._dealSequential(playerCount);
        } else if (strategy === 'SIMULATION') {
            this.shuffleSimulation(lastRoundCards);
            return this._dealBlock(playerCount);
        } else if (strategy === 'PRECISE') {
            // 默认使用刺激模式，你也可以扩展 roomConfig 传参进来
            this.shufflePrecise(playerCount, 'stimulating');
            return this._dealSequential(playerCount);
        } else {
            // 默认：全随机
            this.shuffle();
            return this._dealSequential(playerCount);
        }
    }

    // 普通顺序发牌 (一人一张轮流)
    // 适用于：全随机模式、已经构造好顺序的均贫富模式
    _dealSequential(playerCount) {
        const hands = {};
        const totalCards = this.deck.length;
        const cardsPerPlayer = Math.floor(totalCards / playerCount); 
        
        for (let i = 0; i < playerCount; i++) {
            hands[i] = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
            // 补齐余数给最后一个人
            if (i === playerCount - 1) {
                 hands[i] = this.deck.slice(i * cardsPerPlayer);
            }
        }
        return hands;
    }

    // 块状发牌 (一人一次拿多张)
    // 适用于：模拟洗牌模式 (防止把叠好的牌拆散)
    _dealBlock(playerCount) {
        const hands = {};
        for(let i=0; i<playerCount; i++) hands[i] = [];

        // 块大小：比如每次拿 4 张
        const blockSize = 4; 
        let currentCardIdx = 0;
        let turn = 0;

        while (currentCardIdx < this.deck.length) {
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