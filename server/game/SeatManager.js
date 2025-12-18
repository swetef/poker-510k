const CardRules = require('./CardRules');
const Deck = require('./Deck');

class SeatManager {
    // 构造函数接收 isTeamMode 参数
    constructor(io, roomId, players, isTeamMode) {
        this.io = io;
        this.roomId = roomId;
        this.players = players; 
        this.isTeamMode = isTeamMode; 

        // 生成一副牌，洗牌
        const deck = new Deck(1);
        deck.shuffle();
        
        // [修改] 优化抽牌池生成逻辑：优先保证点数不重复
        // 这样玩家抽到的牌大概率是 3, 5, K, A 这种纯数字大小比较，不用比花色
        const distinctCards = [];
        const seenPoints = new Set();
        const leftovers = [];

        for (let card of deck.deck) {
            const p = CardRules.getPoint(card);
            if (!seenPoints.has(p)) {
                seenPoints.add(p);
                distinctCards.push(card);
            } else {
                leftovers.push(card);
            }
        }

        // 优先用不重复的牌，如果不够（极少情况）再用剩下的补
        const pool = [...distinctCards, ...leftovers];
        
        // 取出等于玩家数量的牌作为“签”
        this.availableCards = pool.slice(0, players.length);
        
        // 记录谁抽了什么 { playerId: cardVal }
        this.drawResults = {};
        
        // 记录当前还剩哪些位置的牌没被翻开
        this.pendingIndices = this.availableCards.map((_, i) => i);
    }

    // [新增] 专门处理玩家重连后的 ID 变更
    reconnectPlayer(oldId, newId) {
        if (this.drawResults[oldId] !== undefined) {
            this.drawResults[newId] = this.drawResults[oldId];
            delete this.drawResults[oldId];
            console.log(`[SeatManager] Player reconnected: ${oldId} -> ${newId}, restored draw result.`);
        }
    }

    // 玩家请求抽一张牌
    playerDraw(playerId, cardIndex) {
        if (this.drawResults[playerId] !== undefined) return { success: false, msg: '你已经抽过牌了' };

        const idxInPending = this.pendingIndices.indexOf(cardIndex);
        if (idxInPending === -1) return { success: false, msg: '这张牌已经被被人抽走了' };

        this.pendingIndices.splice(idxInPending, 1);

        const cardVal = this.availableCards[cardIndex];
        this.drawResults[playerId] = cardVal;

        const isFinished = Object.keys(this.drawResults).length === this.players.length;

        return { 
            success: true, 
            cardVal, 
            cardIndex, 
            isFinished 
        };
    }

    // 核心：计算最终座次和分组
    finalizeSeats() {
        // 1. 基础组装与排序
        const results = this.players.map(p => {
            const card = this.drawResults[p.id];
            
            // [安全保护] 如果玩家数据异常，防止服务器再次崩溃
            if (card === undefined) {
                console.error(`[SeatManager] Critical Error: Player ${p.name} (${p.id}) missing draw card!`);
                return { ...p, drawCard: 0, sortVal: 0 };
            }

            return {
                ...p,
                drawCard: card,
                // 这里调用 CardRules.getSortValue
                sortVal: CardRules.getSortValue(card) 
            };
        });

        // 从大到小排 (点数大的在前 -> 1号位)
        results.sort((a, b) => {
            if (b.sortVal !== a.sortVal) return b.sortVal - a.sortVal;
            // 如果点数实在一样（虽然我们尽量避免了），再比花色
            return CardRules.getSuitSortValue(b.drawCard) - CardRules.getSuitSortValue(a.drawCard);
        });

        // 2. 根据模式决定座位顺序
        let newOrder = [];

        if (this.isTeamMode) {
            const mid = Math.ceil(results.length / 2);
            const bigTeam = results.slice(0, mid); 
            const smallTeam = results.slice(mid);  

            const maxLen = Math.max(bigTeam.length, smallTeam.length);
            for (let i = 0; i < maxLen; i++) {
                if (bigTeam[i]) newOrder.push(bigTeam[i]); 
                if (smallTeam[i]) newOrder.push(smallTeam[i]); 
            }
        } else {
            newOrder = results;
        }

        return {
            newPlayers: newOrder,
            drawDetails: this.drawResults 
        };
    }
}

module.exports = SeatManager;