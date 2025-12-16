const CardRules = require('./CardRules');
const Deck = require('./Deck');
const BotLogic = require('./BotLogic');

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
        this.botTimer = null;
        this.turnStartTime = 0; 
    }

    // [新增] 切换托管状态
    toggleAutoPlay(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isBot) return; 

        player.isAutoPlay = !player.isAutoPlay;
        
        if (this.gameState && this.players[this.gameState.currentTurnIndex].id === playerId) {
            if (player.isAutoPlay) {
                this._checkAndRunBot();
            } else {
                if (this.botTimer) {
                    clearTimeout(this.botTimer);
                    this.botTimer = null;
                }
                this._resetTimer();
            }
        }
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
            finishedRank: [],    
        };

        this.players.forEach((p, index) => {
            this.gameState.hands[p.id] = hands[index];
            this.gameState.roundPoints[p.id] = 0;
        });

        this._resetTimer();
        this._checkAndRunBot();

        return {
            startPlayerIndex: startIndex,
            startPlayerId: this.players[startIndex].id,
            hands: this.gameState.hands
        };
    }

    _checkAndRunBot() {
        if (!this.gameState) return;
        
        if (this.botTimer) {
            clearTimeout(this.botTimer);
            this.botTimer = null;
        }

        if (this._getActivePlayerCount() <= 1 && this.gameState.lastPlayedCards.length === 0) return;

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        const isAI = currPlayer.isBot || currPlayer.isAutoPlay;

        if (isAI && this.gameState.hands[currPlayer.id].length > 0) {
            const delay = 1000 + Math.random() * 1000;
            this.botTimer = setTimeout(() => {
                this._executeBotTurn(currPlayer);
            }, delay);
        }
    }

    _executeBotTurn(botPlayer) {
        if (!this.gameState) return;
        if (this.players[this.gameState.currentTurnIndex].id !== botPlayer.id) return;

        try {
            const hand = this.gameState.hands[botPlayer.id];
            if (!hand || hand.length === 0) {
                 this._advanceTurn(); 
                 return;
            }

            const isNewRound = this.gameState.lastPlayedCards.length === 0;
            const cardsToBeat = isNewRound ? [] : this.gameState.lastPlayedCards;

            const sortedHand = [...hand].sort((a,b) => CardRules.getPoint(a) - CardRules.getPoint(b));
            
            const cardsToPlay = BotLogic.decideMove(sortedHand, cardsToBeat, this.config.deckCount);

            if (cardsToPlay) {
                console.log(`[Bot/Auto] ${botPlayer.name} plays ${cardsToPlay.length} cards.`);
                const result = this.playCards(botPlayer.id, cardsToPlay);
                
                if (result.success) {
                    // [修复] 关键修复：如果是真实玩家托管，必须发送手牌更新事件，否则客户端看不到牌少了
                    if (!botPlayer.isBot) {
                        this.io.to(botPlayer.id).emit('hand_update', this.gameState.hands[botPlayer.id]);
                    }

                    if (result.isRoundOver) {
                        this._handleWin(result, botPlayer.id);
                    } else {
                        const publicState = this.getPublicState();
                        this.io.to(this.roomId).emit('game_state_update', publicState);
                    }
                } else {
                    console.error(`[Bot Error] Play failed: ${result.error}`);
                    if (!isNewRound) this.passTurn(botPlayer.id);
                }
            } else {
                console.log(`[Bot/Auto] ${botPlayer.name} passes.`);
                const result = this.passTurn(botPlayer.id);
                if (result.success) {
                    const publicState = this.getPublicState();
                    publicState.infoText = isNewRound ? '' : 'PASS';
                    this.io.to(this.roomId).emit('game_state_update', publicState);
                }
            }
        } catch (error) {
            console.error(`[Bot Error] Exception in _executeBotTurn:`, error);
        }
    }

    _handleWin(result, winnerId) {
        const rInfo = result.roundResult;
        if (rInfo.isGrandOver) {
            this.io.to(this.roomId).emit('grand_game_over', { 
                grandWinner: rInfo.roundWinnerName, 
                grandScores: rInfo.grandScores 
            });
            this.gameState = null; 
            this._clearTimer(); 
        } else {
            this.io.to(this.roomId).emit('round_over', {
                roundWinner: rInfo.roundWinnerName,
                pointsEarned: rInfo.pointsEarned,
                detail: rInfo.detail,
                grandScores: rInfo.grandScores
            });
            this._clearTimer();
        }
    }

    playCards(playerId, cards) {
        if (!this.gameState) return { success: false, error: '游戏未开始' };

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        if (currPlayer.id !== playerId) return { success: false, error: '还没轮到你' };

        const playerHand = this.gameState.hands[playerId];
        if (!this._handContainsCards(playerHand, cards)) {
            return { success: false, error: '手牌不足或数据不同步' };
        }

        const isNewRound = this.gameState.lastPlayedCards.length === 0;
        const cardsToBeat = isNewRound ? [] : this.gameState.lastPlayedCards;

        if (!CardRules.canPlay(cards, cardsToBeat, this.config.deckCount)) {
            return { success: false, error: '牌型不符或管不上' };
        }

        this._removeCardsFromHand(playerId, cards);
        this.gameState.pendingTablePoints += CardRules.calculateTotalScore(cards);
        this.gameState.lastPlayedCards = cards;
        this.gameState.consecutivePasses = 0;
        this.gameState.roundWinnerId = playerId;

        const isFinished = this.gameState.hands[playerId].length === 0;
        if (isFinished) {
            if (!this.gameState.finishedRank.includes(playerId)) {
                this.gameState.finishedRank.push(playerId);
            }
        }

        const activeCount = this._getActivePlayerCount();
        
        if (activeCount <= 1) {
            this._clearTimer();
            const roundResult = this._concludeRound();
            return { 
                success: true, 
                isRoundOver: true,
                roundResult,
                cardsPlayed: cards,
                pendingPoints: this.gameState.pendingTablePoints
            };
        }

        this._advanceTurn();
        this._resetTimer();
        this._checkAndRunBot();

        return { 
            success: true, 
            isRoundOver: false,
            cardsPlayed: cards,
            pendingPoints: this.gameState.pendingTablePoints
        };
    }

    passTurn(playerId) {
        if (!this.gameState) return { success: false, error: '游戏未开始' };

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        if (currPlayer.id !== playerId) return { success: false, error: '还没轮到你' };

        if (this.gameState.lastPlayedCards.length === 0) {
            return { success: false, error: '必须出牌' };
        }

        this.gameState.consecutivePasses++;
        this._advanceTurn(); 

        const winnerHand = this.gameState.hands[this.gameState.roundWinnerId];
        const winnerIsActive = winnerHand && winnerHand.length > 0;
        const activeCount = this._getActivePlayerCount();
        
        const passesNeeded = winnerIsActive ? (activeCount - 1) : activeCount;

        let turnCleared = false;
        if (this.gameState.consecutivePasses >= passesNeeded) {
            const wId = this.gameState.roundWinnerId;
            if (wId) {
                this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                
                if (this.gameState.hands[wId].length > 0) {
                     const wIdx = this.players.findIndex(p => p.id === wId);
                     this.gameState.currentTurnIndex = wIdx;
                }
            }
            
            this.gameState.lastPlayedCards = [];
            this.gameState.consecutivePasses = 0;
            turnCleared = true;
        }

        this._resetTimer(); 
        this._checkAndRunBot();

        return { success: true, turnCleared };
    }

    _clearTimer() {
        if (this.timer) clearTimeout(this.timer);
        if (this.botTimer) clearTimeout(this.botTimer);
        this.timer = null;
        this.botTimer = null;
    }

    _resetTimer() {
        this._clearTimer();
        if (this.gameState && this._getActivePlayerCount() > 1) {
            this.turnStartTime = Date.now();
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
        const isNewRound = this.gameState.lastPlayedCards.length === 0;

        if (isNewRound) {
            const hand = this.gameState.hands[currPlayer.id];
            if (!hand || hand.length === 0) { this._advanceTurn(); return; }

            const sorted = hand.map(c => ({ id: c, val: CardRules.getPoint(c) })).sort((a, b) => a.val - b.val);
            const cardToPlay = [sorted[0].id]; 
            
            const result = this.playCards(currPlayer.id, cardToPlay);
            if (result.success) {
                this.io.to(currPlayer.id).emit('hand_update', this.gameState.hands[currPlayer.id]);
                
                if (result.isRoundOver) {
                     this._handleWin(result, currPlayer.id);
                } else {
                     const publicState = this.getPublicState();
                     publicState.infoText = `${currPlayer.name} 超时，系统代打`;
                     this.io.to(this.roomId).emit('game_state_update', publicState);
                }
            }
        } else {
            const result = this.passTurn(currPlayer.id);
            if (result.success) {
                const publicState = this.getPublicState();
                publicState.infoText = `${currPlayer.name} 超时，自动过牌`;
                this.io.to(this.roomId).emit('game_state_update', publicState);
            }
        }
    }

    _getActivePlayerCount() {
        if (!this.gameState) return 0;
        let count = 0;
        for (const p of this.players) {
            if (this.gameState.hands[p.id] && this.gameState.hands[p.id].length > 0) {
                count++;
            }
        }
        return count;
    }

    _advanceTurn() {
        const playerCount = this.players.length;
        let nextIndex = this.gameState.currentTurnIndex;
        let attempts = 0;
        do {
            nextIndex = (nextIndex + 1) % playerCount;
            attempts++;
        } while (
            this.gameState.hands[this.players[nextIndex].id].length === 0 && 
            attempts < playerCount 
        );
        this.gameState.currentTurnIndex = nextIndex;
    }

    getPublicState() {
        if (!this.gameState) return null;
        
        const currentScoresDisplay = {};
        const playersInfo = {};
        
        this.players.forEach(p => {
            currentScoresDisplay[p.id] = (this.grandScores[p.id] || 0) + (this.gameState.roundPoints[p.id] || 0);
            playersInfo[p.id] = { isBot: p.isBot, isAutoPlay: p.isAutoPlay };
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
            pendingPoints: this.gameState.pendingTablePoints,
            finishedRank: this.gameState.finishedRank,
            playersInfo: playersInfo 
        };
    }

    reconnectPlayer(oldId, newId) {
        if (this.grandScores[oldId] !== undefined) {
            this.grandScores[newId] = this.grandScores[oldId];
            delete this.grandScores[oldId];
        }
        if (this.lastWinnerId === oldId) this.lastWinnerId = newId;

        const player = this.players.find(p => p.id === newId);
        if (player) player.isAutoPlay = false;

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
            
            const rankIdx = this.gameState.finishedRank.indexOf(oldId);
            if (rankIdx !== -1) {
                this.gameState.finishedRank[rankIdx] = newId;
            }
        }
        return true;
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

    // [核心修改] 结算逻辑：增加排名赏罚
    _concludeRound() {
        const lastPlayer = this.players.find(p => this.gameState.hands[p.id].length > 0);
        if (lastPlayer) {
            this.gameState.finishedRank.push(lastPlayer.id);
        }
        
        // 1. 处理最后一轮的桌面分
        const wId = this.gameState.roundWinnerId;
        if (wId) {
             this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
             this.gameState.pendingTablePoints = 0;
        }

        // 2. 构造完整排名 (已跑完 + 剩余玩家)
        // 实际上在 activeCount <= 1 时，剩下的那个玩家也已经被 push 到 finishedRank 里了(通过上面的 lastPlayer 逻辑)
        // 但为了保险，我们用 Set 去重确保完整性
        const fullRankIds = [...this.gameState.finishedRank];
        this.players.forEach(p => {
            if (!fullRankIds.includes(p.id)) fullRankIds.push(p.id);
        });

        const firstWinnerId = fullRankIds[0];
        this.lastWinnerId = firstWinnerId;

        let logLines = [];

        // 3. 规则一：剩余手牌罚分 (原有逻辑)
        let totalCardPenalty = 0;
        let cardPenaltyDetail = "";

        this.players.forEach(p => {
            const handPts = CardRules.calculateTotalScore(this.gameState.hands[p.id]);
            if (handPts > 0) {
                totalCardPenalty += handPts;
                cardPenaltyDetail += `${p.name}-${handPts} `;
            }
            // 先累加桌面分
            this.grandScores[p.id] += (this.gameState.roundPoints[p.id] || 0);
        });

        if (firstWinnerId && totalCardPenalty > 0) {
            this.grandScores[firstWinnerId] += totalCardPenalty;
            logLines.push(`[手牌罚分] 输家共计 ${totalCardPenalty} 分，归第一名 ${this.players.find(p=>p.id===firstWinnerId)?.name}。`);
        }

        // 4. [新增] 规则二：排名赏罚 (Rank Penalty)
        if (this.config.enableRankPenalty && this.config.rankPenaltyScores && this.config.rankPenaltyScores.length > 0) {
            const penaltyConfig = this.config.rankPenaltyScores;
            const playerCount = fullRankIds.length;
            
            // 遍历配置：[30, 15] 对应 (第一vs倒一), (第二vs倒二)
            penaltyConfig.forEach((score, index) => {
                const winnerIndex = index; // 0, 1
                const loserIndex = playerCount - 1 - index; // N-1, N-2

                // 只有当赢家索引小于输家索引时才执行 (避免奇数人数中间撞车)
                if (winnerIndex < loserIndex) {
                    const winnerId = fullRankIds[winnerIndex];
                    const loserId = fullRankIds[loserIndex];
                    
                    if (winnerId && loserId) {
                        this.grandScores[winnerId] += score;
                        this.grandScores[loserId] -= score;

                        const wName = this.players.find(p=>p.id===winnerId)?.name;
                        const lName = this.players.find(p=>p.id===loserId)?.name;
                        logLines.push(`[排名赏罚] 第${winnerIndex+1}名 ${wName} 收取 倒数第${index+1}名 ${lName} ${score} 分。`);
                    }
                }
            });
        }

        const firstWinnerName = this.players.find(p => p.id === firstWinnerId)?.name || '未知';
        const isGrandOver = this.grandScores[firstWinnerId] >= this.config.targetScore;
        const totalPointsEarned = (this.gameState.roundPoints[firstWinnerId] || 0) + totalCardPenalty;

        return {
            roundWinnerName: firstWinnerName,
            pointsEarned: totalPointsEarned, 
            detail: logLines.join('\n') || '完美结束，无额外罚分', // 用换行符连接
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