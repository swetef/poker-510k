const CardRules = require('./CardRules');
const Deck = require('./Deck');

// [变更] 不再使用硬编码的常量，改用从 config 读取
// const TURN_TIME_LIMIT = 60000; 

class GameManager {
    constructor(roomConfig, players, io, roomId) {
        this.config = roomConfig;
        this.players = players; 
        this.io = io; 
        this.roomId = roomId;

        this.grandScores = {};
        this.players.forEach(p => this.grandScores[p.id] = 0);
        this.lastWinnerId = null;
        this.gameState = null; 
        
        this.timer = null;
        this.turnStartTime = 0; 
    }

    startRound(isNextRound = false) {
        if (!isNextRound) {
            this.players.forEach(p => this.grandScores[p.id] = 0);
            this.lastWinnerId = null;
        }

        const deck = new Deck(this.config.deckCount);
        const hands = deck.deal(this.players.length);

        let startIndex = 0;
        if (this.lastWinnerId) {
            const winnerIdx = this.players.findIndex(p => p.id === this.lastWinnerId);
            if (winnerIdx !== -1) startIndex = winnerIdx;
        }

        this.gameState = {
            hands: {},
            currentTurnIndex: startIndex,
            lastPlayedCards: [],    
            consecutivePasses: 0,   
            roundPoints: {},        
            pendingTablePoints: 0,  
            roundWinnerId: null,    
        };

        this.players.forEach((p, index) => {
            this.gameState.hands[p.id] = hands[index];
            this.gameState.roundPoints[p.id] = 0;
        });

        this._resetTimer();

        return {
            startPlayerIndex: startIndex,
            startPlayerId: this.players[startIndex].id,
            hands: this.gameState.hands
        };
    }

    playCards(playerId, cards) {
        if (!this.gameState) return { success: false, error: '游戏未开始' };

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        if (currPlayer.id !== playerId) return { success: false, error: '还没轮到你' };

        const playerHand = this.gameState.hands[playerId];
        if (!this._handContainsCards(playerHand, cards)) {
            return { success: false, error: '手牌不足或数据不同步' };
        }

        const isNewRound = this.gameState.lastPlayedCards.length === 0 || 
                           this.gameState.consecutivePasses >= this.players.length - 1;
        const cardsToBeat = isNewRound ? [] : this.gameState.lastPlayedCards;

        if (!CardRules.canPlay(cards, cardsToBeat, this.config.deckCount)) {
            return { success: false, error: '牌型不符或管不上' };
        }

        this._removeCardsFromHand(playerId, cards);
        this.gameState.pendingTablePoints += CardRules.calculateTotalScore(cards);
        this.gameState.lastPlayedCards = cards;
        this.gameState.consecutivePasses = 0;
        this.gameState.roundWinnerId = playerId;

        this._advanceTurn();

        const isWin = this.gameState.hands[playerId].length === 0;
        let roundResult = null;
        
        if (isWin) {
            this._clearTimer(); 
            roundResult = this._concludeRound(playerId);
        } else {
            this._resetTimer(); 
        }

        return { 
            success: true, 
            isWin, 
            roundResult, 
            cardsPlayed: cards,
            pendingPoints: this.gameState.pendingTablePoints
        };
    }

    passTurn(playerId) {
        if (!this.gameState) return { success: false, error: '游戏未开始' };

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        if (currPlayer.id !== playerId) return { success: false, error: '还没轮到你' };

        if (this.gameState.lastPlayedCards.length === 0 || 
            this.gameState.consecutivePasses >= this.players.length - 1) {
            return { success: false, error: '必须出牌' };
        }

        this.gameState.consecutivePasses++;
        this._advanceTurn();

        let turnCleared = false;
        if (this.gameState.consecutivePasses >= this.players.length - 1) {
            const wId = this.gameState.roundWinnerId;
            if (wId) {
                this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                const wIdx = this.players.findIndex(p => p.id === wId);
                this.gameState.currentTurnIndex = wIdx;
            }
            this.gameState.lastPlayedCards = [];
            turnCleared = true;
        }

        this._resetTimer(); 

        return { success: true, turnCleared };
    }

    _clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    _resetTimer() {
        this._clearTimer();
        
        if (this.gameState) {
            this.turnStartTime = Date.now();
            
            // [修改] 优先读取配置的时间，如果没有则默认 60s
            const timeLimit = this.config.turnTimeout || 60000;

            this.timer = setTimeout(() => {
                this._handleTimeout();
            }, timeLimit);
        }
    }

    _handleTimeout() {
        if (!this.gameState) return;
        
        const currIdx = this.gameState.currentTurnIndex;
        const currPlayer = this.players[currIdx];
        
        console.log(`[Timeout] Player ${currPlayer.name} (${currPlayer.id}) timed out.`);

        const isNewRound = this.gameState.lastPlayedCards.length === 0 || 
                           this.gameState.consecutivePasses >= this.players.length - 1;

        if (isNewRound) {
            const hand = this.gameState.hands[currPlayer.id];
            const sorted = hand.map(c => ({ id: c, val: CardRules.getPoint(c) })).sort((a, b) => a.val - b.val);
            const cardToPlay = [sorted[0].id]; 
            
            const result = this.playCards(currPlayer.id, cardToPlay);
            
            if (result.success) {
                this.io.to(currPlayer.id).emit('hand_update', this.gameState.hands[currPlayer.id]);
                
                const publicState = this.getPublicState();
                publicState.infoText = `${currPlayer.name} 超时，系统代打`;
                this.io.to(this.roomId).emit('game_state_update', publicState);
            }
        } else {
            this.passTurn(currPlayer.id);
            
            const publicState = this.getPublicState();
            publicState.infoText = `${currPlayer.name} 超时，自动过牌`;
            this.io.to(this.roomId).emit('game_state_update', publicState);
        }
    }

    getPublicState() {
        if (!this.gameState) return null;
        
        const currentScoresDisplay = {};
        this.players.forEach(p => {
            currentScoresDisplay[p.id] = (this.grandScores[p.id] || 0) + (this.gameState.roundPoints[p.id] || 0);
        });

        const winnerObj = this.players.find(p => p.id === this.gameState.roundWinnerId);

        let remainingSeconds = 0;
        if (this.turnStartTime) {
            const timeLimit = this.config.turnTimeout || 60000;
            const elapsed = Date.now() - this.turnStartTime;
            remainingSeconds = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
        }
        
        return {
            turnIndex: this.gameState.currentTurnIndex,
            currentTurnId: this.players[this.gameState.currentTurnIndex].id,
            turnRemaining: remainingSeconds, 
            lastPlayed: this.gameState.lastPlayedCards,
            lastPlayerName: winnerObj ? winnerObj.name : '',
            scores: currentScoresDisplay,
            pendingPoints: this.gameState.pendingTablePoints
        };
    }

    reconnectPlayer(oldId, newId) {
        if (this.grandScores[oldId] !== undefined) {
            this.grandScores[newId] = this.grandScores[oldId];
            delete this.grandScores[oldId];
        }
        if (this.lastWinnerId === oldId) this.lastWinnerId = newId;

        if (this.gameState) {
            if (this.gameState.hands[oldId]) {
                this.gameState.hands[newId] = this.gameState.hands[oldId];
                delete this.gameState.hands[oldId];
            }
            if (this.gameState.roundPoints[oldId] !== undefined) {
                this.gameState.roundPoints[newId] = this.gameState.roundPoints[oldId];
                delete this.gameState.roundPoints[oldId];
            }
            if (this.gameState.roundWinnerId === oldId) this.gameState.roundWinnerId = newId;
        }
        return true;
    }
    
    _advanceTurn() {
        this.gameState.currentTurnIndex = (this.gameState.currentTurnIndex + 1) % this.players.length;
    }

    _handContainsCards(hand, cardsToPlay) {
        const tempHand = [...hand];
        for (let c of cardsToPlay) {
            const idx = tempHand.indexOf(c);
            if (idx === -1) return false;
            tempHand.splice(idx, 1);
        }
        return true;
    }

    _removeCardsFromHand(playerId, cards) {
        const newHand = [...this.gameState.hands[playerId]];
        for (let c of cards) {
            const idx = newHand.indexOf(c);
            if (idx !== -1) newHand.splice(idx, 1);
        }
        this.gameState.hands[playerId] = newHand;
    }

    _concludeRound(winnerId) {
        this.lastWinnerId = winnerId;
        let totalRoundScore = this.gameState.pendingTablePoints;
        let penaltyLog = "";

        this.players.forEach(p => {
            if (p.id !== winnerId) {
                const handPts = CardRules.calculateTotalScore(this.gameState.hands[p.id]);
                if (handPts > 0) {
                    totalRoundScore += handPts;
                    penaltyLog += `${p.name}剩${handPts}分 `;
                }
            }
        });

        totalRoundScore += (this.gameState.roundPoints[winnerId] || 0);
        this.grandScores[winnerId] += totalRoundScore;
        const isGrandOver = this.grandScores[winnerId] >= this.config.targetScore;
        if (isGrandOver) this.gameState = null; 

        return {
            roundWinnerName: this.players.find(p=>p.id===winnerId).name,
            pointsEarned: totalRoundScore,
            detail: penaltyLog ? `罚分: ${penaltyLog}` : '无罚分',
            grandScores: this.grandScores,
            isGrandOver
        };
    }
    
    getPlayerHand(playerId) {
        if (!this.gameState || !this.gameState.hands) return [];
        return this.gameState.hands[playerId] || [];
    }
}

module.exports = GameManager;