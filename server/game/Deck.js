// 牌库生成与洗牌 - [增强版] 支持公平不洗牌 & 模拟线下叠牌模式

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
    }

    // 1. 普通洗牌 (Fisher-Yates) - 彻底打乱
    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // 2. [爽局] 公平的“均贫富”策略 (保留原逻辑)
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

        // 打乱炸弹块的顺序，但块内部不乱
        for (let i = bombChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bombChunks[i], bombChunks[j]] = [bombChunks[j], bombChunks[i]];
        }

        const playerBuckets = Array.from({ length: playerCount }, () => []);
        
        // 轮询分发炸弹 (均贫富)
        bombChunks.forEach((chunk, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(...chunk);
        });

        // 随机打乱散牌
        for (let i = looseCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [looseCards[i], looseCards[j]] = [looseCards[j], looseCards[i]];
        }
        // 轮询分发散牌
        looseCards.forEach((card, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(card);
        });

        // 重组回 deck (虽然这步主要是为了兼容 dealSequential，但 Deck 状态还是要更新)
        this.deck = []; 
        playerBuckets.forEach(bucket => {
            // 对每个人的手牌进行一次内部微调，防止太过规律
            for (let i = bucket.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
            }
            this.deck.push(...bucket);
        });
    }

    // 3. [新模式] 模拟洗牌 (叠牌 + 切牌)
    shuffleSimulation(lastRoundCards) {
        // 如果没有上一局的牌（第一局），或者牌数不对，回退到普通洗牌
        if (!lastRoundCards || lastRoundCards.length !== this.deck.length) {
            console.log("[Deck] No valid last round cards, using random shuffle.");
            this.shuffle();
            return;
        }

        console.log("[Deck] Using Simulation Shuffle (Stacking + Cutting)");
        
        // 直接复用上一局的牌堆顺序（模拟叠牌）
        this.deck = [...lastRoundCards];

        // 模拟切牌 (Cutting)：通常切 1-3 次
        const cutCount = 1 + Math.floor(Math.random() * 2); // 1 to 2 times
        for (let k = 0; k < cutCount; k++) {
            // 随机选择切牌点 (20% - 80% 之间)
            const minCut = Math.floor(this.deck.length * 0.2);
            const maxCut = Math.floor(this.deck.length * 0.8);
            const cutPoint = minCut + Math.floor(Math.random() * (maxCut - minCut));
            
            // 把下半部分移到上面
            const topPart = this.deck.slice(0, cutPoint);
            const bottomPart = this.deck.slice(cutPoint);
            this.deck = [...bottomPart, ...topPart];
        }
        
        // 注意：这里绝对不进行内部打乱 (shuffle)，保留连在一起的牌
    }

    // 发牌入口
    // strategy: 'CLASSIC' | 'NO_SHUFFLE' | 'SIMULATION'
    deal(playerCount, strategy = 'CLASSIC', lastRoundCards = null) {
        
        if (strategy === 'NO_SHUFFLE') {
            // 均贫富模式：内部构造好每人的牌，顺序发即可
            this.shuffleFairNoShuffle(playerCount);
            return this._dealSequential(playerCount);
        } else if (strategy === 'SIMULATION') {
            // 模拟模式：切牌 + 块状发牌
            this.shuffleSimulation(lastRoundCards);
            return this._dealBlock(playerCount);
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
            // 补齐余数给最后一个人（虽然通常整除）
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
            
            // 拿出这一块，如果不够 blockSize 就全拿
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