const CardRules = require('./CardRules');

const BotLogic = {
    // 简单的决策函数
    decideMove: (hand, lastPlayedCards, deckCount) => {
        try {
            // 1. 如果当前没有被压牌（自己领出），出最小的一张牌
            if (!lastPlayedCards || lastPlayedCards.length === 0) {
                if (hand.length === 0) return null;
                // 简单策略：总是出手中最小的一张牌
                return [hand[0]]; 
            }

            // 2. 如果有人出牌了，尝试管上
            const lastHandState = CardRules.analyze(lastPlayedCards, deckCount);
            if (lastHandState.type === 'INVALID') return null; 

            // 整理手牌：按点数分组
            const grouped = {};
            hand.forEach(c => {
                const p = CardRules.getPoint(c);
                if (!grouped[p]) grouped[p] = [];
                grouped[p].push(c);
            });
            
            const uniquePoints = Object.keys(grouped).map(Number).sort((a,b) => a-b);

            // 策略 A：尝试用同类型的牌管（不含炸弹）
            if (['SINGLE', 'PAIR', 'TRIPLE'].includes(lastHandState.type)) {
                const countNeeded = lastHandState.type === 'SINGLE' ? 1 : 
                                    lastHandState.type === 'PAIR' ? 2 : 3;
                
                for (let p of uniquePoints) {
                    if (p > lastHandState.val && grouped[p].length >= countNeeded) {
                        return grouped[p].slice(0, countNeeded);
                    }
                }
            }
            
            // 简单的连对/飞机管牌尝试 (只管长度一致的)
            if (lastHandState.type === 'LIANDUI' || lastHandState.type === 'AIRPLANE') {
                 // 这是一个复杂的搜索，这里简化：Bot暂不处理复杂牌型的跟牌，直接尝试用炸弹炸
            }

            // 策略 B：尝试用炸弹炸
            const currentLevel = lastHandState.level || 0;
            
            // 找普通炸弹 (4张及以上)
            for (let p of uniquePoints) {
                if (grouped[p].length >= 4) {
                    const bombCards = grouped[p];
                    const bombState = CardRules.analyze(bombCards, deckCount);
                    
                    // 级别高，或同级别点数大
                    if (bombState.level > currentLevel) return bombCards;
                    if (bombState.level === currentLevel && bombState.val > lastHandState.val) return bombCards;
                }
            }

            // 3. 实在管不上，过
            return null;
        } catch (e) {
            console.error("BotLogic error:", e);
            return null; // 报错时默认过牌
        }
    }
};

module.exports = BotLogic;