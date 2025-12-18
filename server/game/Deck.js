// 牌库生成与洗牌 - [增强版] 支持公平不洗牌模式

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

    // 普通洗牌 (Fisher-Yates)
    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // [新增] 公平的“不洗牌”策略
    // 逻辑：提取炸弹 -> 轮流分发给玩家 -> 填充散牌 -> 拼回牌库
    shuffleFairNoShuffle(playerCount) {
        // 1. 先按点数归类所有牌
        const groupMap = {}; // { 3: [card1, card2...], 4: [...], ... 17: [...] }
        const looseCards = []; // 散牌池

        this.deck.forEach(card => {
            const point = CardRules.getPoint(card);
            if (!groupMap[point]) groupMap[point] = [];
            groupMap[point].push(card);
        });

        // 2. 提取炸弹块
        const bombChunks = []; // [ [3,3,3,3], [K,K,K,K,K] ... ]
        
        Object.values(groupMap).forEach(cards => {
            // 如果只有1-3张，直接扔进散牌
            if (cards.length < 4) {
                looseCards.push(...cards);
                return;
            }

            // 如果牌很多（比如8副牌），可能有20张3。我们需要把它切成几个炸弹，而不是一个巨型炸弹
            // 策略：每 4~6 张切成一个炸弹块，剩下的扔散牌
            let remaining = [...cards];
            while (remaining.length >= 4) {
                // 随机切 4 到 6 张作为一个炸弹
                const chunkSize = Math.min(remaining.length, 4 + Math.floor(Math.random() * 3));
                const chunk = remaining.splice(0, chunkSize);
                bombChunks.push(chunk);
            }
            // 剩下的渣渣扔进散牌
            if (remaining.length > 0) looseCards.push(...remaining);
        });

        // 打乱炸弹块的顺序，防止某人总是拿到大牌
        for (let i = bombChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bombChunks[i], bombChunks[j]] = [bombChunks[j], bombChunks[i]];
        }

        // 3. 均分炸弹 (核心公平逻辑)
        const playerBuckets = Array.from({ length: playerCount }, () => []);
        
        // 轮流发炸弹 (Snake Draft 风格: 0,1,2,3 -> 3,2,1,0 也许更好，但随机顺序已经足够)
        bombChunks.forEach((chunk, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(...chunk);
        });

        // 4. 均分散牌
        // 先打乱散牌
        for (let i = looseCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [looseCards[i], looseCards[j]] = [looseCards[j], looseCards[i]];
        }
        // 轮流发散牌
        looseCards.forEach((card, index) => {
            const playerIndex = index % playerCount;
            playerBuckets[playerIndex].push(card);
        });

        // 5. 内部微调 (Internal Shuffle) & 重组
        // 虽然每个玩家拿到了一堆好牌，但不能让他们看出规律（比如炸弹连在一起），所以每人手里的牌要简单洗一下
        this.deck = []; // 清空主牌库，准备回填
        
        playerBuckets.forEach(bucket => {
            // 简单洗一下这堆牌
            for (let i = bucket.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
            }
            // [关键] 按顺序拼回去！
            // 因为 deal 函数是按顺序 slice 的： Player0 拿 0~N, Player1 拿 N~2N
            // 所以我们这里直接 push 进去即可
            this.deck.push(...bucket);
        });

        // 注意：这里不需要再调 this.shuffle() 了，因为已经构造好了顺序
    }

    // [修改] 发牌入口
    deal(playerCount, isNoShuffleMode = false) {
        if (isNoShuffleMode) {
            this.shuffleFairNoShuffle(playerCount);
        } else {
            this.shuffle(); // 经典全随机模式
        }

        const hands = {};
        const totalCards = this.deck.length;
        const cardsPerPlayer = Math.floor(totalCards / playerCount); 
        
        for (let i = 0; i < playerCount; i++) {
            hands[i] = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
            // 修正最后一个人可能少拿的问题（虽然上面的分配算法已经尽量平均了）
            if (i === playerCount - 1) {
                 hands[i] = this.deck.slice(i * cardsPerPlayer);
            }
        }
        return hands;
    }
}

module.exports = Deck;