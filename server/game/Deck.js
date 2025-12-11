// 牌库生成与洗牌


class Deck {
    constructor(deckCount = 1) {
        this.deck = [];
        // 生成多副牌。每副牌是 0-53。
        // 我们使用 i + d * 54 来保证每张牌有唯一ID，方便前端渲染 Key 值
        for (let d = 0; d < deckCount; d++) {
             for (let i = 0; i < 54; i++) {
                this.deck.push(i + d * 54); 
            }
        }
    }

    shuffle() {
        // Fisher-Yates 洗牌算法
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    deal(playerCount) {
        this.shuffle();
        const hands = {};
        const totalCards = this.deck.length;
        const cardsPerPlayer = Math.floor(totalCards / playerCount); 
        
        for (let i = 0; i < playerCount; i++) {
            hands[i] = this.deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
            // 将多余的牌发给最后一个人（简化处理）
            if (i === playerCount - 1) {
                 hands[i] = this.deck.slice(i * cardsPerPlayer);
            }
        }
        return hands;
    }
}

module.exports = Deck;