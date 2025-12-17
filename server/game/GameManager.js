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

    // 切换托管状态
    toggleAutoPlay(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isBot) return; 

        player.isAutoPlay = !player.isAutoPlay;
        
        // 如果当前正好是该玩家的回合
        if (this.gameState && this.players[this.gameState.currentTurnIndex].id === playerId) {
            if (player.isAutoPlay) {
                // 开启托管：立即尝试运行 Bot
                this._checkAndRunBot();
            } else {
                // 取消托管：清除 Bot 计时器，重置超时计时器给玩家思考时间
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

        // [新增] 组队分配逻辑：间隔入座 (0,2为一队; 1,3为一队)
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        this.players.forEach((p, index) => {
            if (isTeamMode) {
                p.team = index % 2; // 0 或 1
            } else {
                p.team = null; // 个人战
            }
        });

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
        // 双重检查：确保当前回合确实属于该 Bot，防止 Timer 触发时回合已变
        if (this.players[this.gameState.currentTurnIndex].id !== botPlayer.id) return;

        try {
            const hand = this.gameState.hands[botPlayer.id];
            // 没牌了，直接跳过
            if (!hand || hand.length === 0) {
                 this._advanceTurn(); 
                 this._broadcastUpdate(); // 广播状态
                 return;
            }

            const isNewRound = this.gameState.lastPlayedCards.length === 0;
            const cardsToBeat = isNewRound ? [] : this.gameState.lastPlayedCards;

            const sortedHand = [...hand].sort((a,b) => CardRules.getPoint(a) - CardRules.getPoint(b));
            
            // 尝试获取出牌策略
            let cardsToPlay = null;
            try {
                cardsToPlay = BotLogic.decideMove(sortedHand, cardsToBeat, this.config.deckCount);
            } catch (err) {
                console.error("[Bot Error] Logic crashed:", err);
            }

            if (cardsToPlay) {
                console.log(`[Bot/Auto] ${botPlayer.name} plays ${cardsToPlay.length} cards.`);
                const result = this.playCards(botPlayer.id, cardsToPlay);
                
                if (result.success) {
                    if (!botPlayer.isBot) {
                        this.io.to(botPlayer.id).emit('hand_update', this.gameState.hands[botPlayer.id]);
                    }

                    if (result.isRoundOver) {
                        this._handleWin(result, botPlayer.id);
                    } else {
                        const analysis = CardRules.analyze(cardsToPlay, this.config.deckCount);
                        const desc = CardRules.getAnalysisText(analysis);
                        this._broadcastUpdate(`${botPlayer.name}: ${desc}`);
                    }
                } else {
                    console.error(`[Bot Error] Play failed: ${result.error}`);
                    if (!isNewRound) {
                        this._forcePass(botPlayer);
                    } else {
                        this._playMinCard(botPlayer, sortedHand);
                    }
                }
            } else {
                if (isNewRound) {
                    console.warn(`[Bot Fix] AI tried to pass on new round. Forcing min card.`);
                    this._playMinCard(botPlayer, sortedHand);
                } else {
                    console.log(`[Bot/Auto] ${botPlayer.name} passes.`);
                    this._forcePass(botPlayer);
                }
            }
        } catch (error) {
            console.error(`[Bot Error] Critical Exception in _executeBotTurn:`, error);
            
            this._advanceTurn();
            this._resetTimer();
            
            const publicState = this.getPublicState();
            publicState.infoText = `${botPlayer.name} 发生错误，跳过`;
            this.io.to(this.roomId).emit('game_state_update', publicState);

            this._checkAndRunBot();
        }
    }
    
    // 辅助：出最小的一张牌 (用于兜底)
    _playMinCard(botPlayer, sortedHand) {
        const minCard = [sortedHand[0]];
        const result = this.playCards(botPlayer.id, minCard);
        if (result.success) {
            if (!botPlayer.isBot) this.io.to(botPlayer.id).emit('hand_update', this.gameState.hands[botPlayer.id]);
            
            const analysis = CardRules.analyze(minCard, this.config.deckCount);
            const desc = CardRules.getAnalysisText(analysis);
            this._broadcastUpdate(`${botPlayer.name}: ${desc} (系统)`);
        } else {
             this._forcePass(botPlayer); 
        }
    }

    // 统一广播函数
    _broadcastUpdate(infoText = null) {
        const publicState = this.getPublicState();
        if (infoText) publicState.infoText = infoText;
        this.io.to(this.roomId).emit('game_state_update', publicState);
    }
    
    // 强制过牌辅助函数
    _forcePass(botPlayer) {
        const result = this.passTurn(botPlayer.id);
        if (result.success) {
            this._broadcastUpdate(`${botPlayer.name}: 不要`);
        } else {
            console.error("[Bot Critical] Failed to pass turn:", result.error);
            this._advanceTurn();
            this._broadcastUpdate();
            this._resetTimer();
            this._checkAndRunBot();
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
        
        const analysis = CardRules.analyze(cards, this.config.deckCount);
        const cardDesc = CardRules.getAnalysisText(analysis);
        const logText = `${currPlayer.name}: ${cardDesc}`;

        const activeCount = this._getActivePlayerCount();
        
        if (activeCount <= 1) {
            this._clearTimer();
            const roundResult = this._concludeRound();
            return { 
                success: true, 
                isRoundOver: true,
                roundResult,
                cardsPlayed: cards,
                pendingPoints: this.gameState.pendingTablePoints,
                logText // 返回日志给调用者
            };
        }

        this._advanceTurn();
        this._resetTimer();
        this._checkAndRunBot();

        return { 
            success: true, 
            isRoundOver: false,
            cardsPlayed: cards,
            pendingPoints: this.gameState.pendingTablePoints,
            logText // 返回日志给调用者
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

        return { 
            success: true, 
            turnCleared,
            logText: `${currPlayer.name}: 不要`
        };
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
                
                const logText = result.logText || `${currPlayer.name} 超时出牌`;
                
                if (result.isRoundOver) {
                     this._handleWin(result, currPlayer.id);
                } else {
                     this._broadcastUpdate(logText);
                }
            }
        } else {
            const result = this.passTurn(currPlayer.id);
            if (result.success) {
                this._broadcastUpdate(`${currPlayer.name}: 超时过牌`);
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
            nextIndex = (nextIndex - 1 + playerCount) % playerCount;
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
        
        const handCounts = {};

        this.players.forEach(p => {
            currentScoresDisplay[p.id] = (this.grandScores[p.id] || 0) + (this.gameState.roundPoints[p.id] || 0);
            // [关键修改] 将 team 信息暴露给前端
            playersInfo[p.id] = { 
                isBot: p.isBot, 
                isAutoPlay: p.isAutoPlay,
                team: p.team 
            };
            handCounts[p.id] = this.gameState.hands[p.id] ? this.gameState.hands[p.id].length : 0;
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
            playersInfo: playersInfo,
            handCounts: handCounts 
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

    _concludeRound() {
        const lastPlayer = this.players.find(p => this.gameState.hands[p.id].length > 0);
        if (lastPlayer) {
            this.gameState.finishedRank.push(lastPlayer.id);
        }
        
        const wId = this.gameState.roundWinnerId;
        if (wId) {
             this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
             this.gameState.pendingTablePoints = 0;
        }

        const fullRankIds = [...this.gameState.finishedRank];
        this.players.forEach(p => {
            if (!fullRankIds.includes(p.id)) fullRankIds.push(p.id);
        });

        const firstWinnerId = fullRankIds[0];
        this.lastWinnerId = firstWinnerId;

        let logLines = [];

        let totalCardPenalty = 0;
        let cardPenaltyDetail = "";

        this.players.forEach(p => {
            const handPts = CardRules.calculateTotalScore(this.gameState.hands[p.id]);
            if (handPts > 0) {
                totalCardPenalty += handPts;
                cardPenaltyDetail += `${p.name}-${handPts} `;
            }
            this.grandScores[p.id] += (this.gameState.roundPoints[p.id] || 0);
        });

        // 头游收分逻辑
        if (firstWinnerId && totalCardPenalty > 0) {
            this.grandScores[firstWinnerId] += totalCardPenalty;
            logLines.push(`[手牌罚分] 输家共计 ${totalCardPenalty} 分，归第一名 ${this.players.find(p=>p.id===firstWinnerId)?.name}。`);
        }

        // 排名赏罚 + [新增] 队友保护逻辑
        if (this.config.enableRankPenalty && this.config.rankPenaltyScores && this.config.rankPenaltyScores.length > 0) {
            const penaltyConfig = this.config.rankPenaltyScores;
            const playerCount = fullRankIds.length;
            
            penaltyConfig.forEach((score, index) => {
                const winnerIndex = index; 
                const loserIndex = playerCount - 1 - index; 

                if (winnerIndex < loserIndex) {
                    const winnerId = fullRankIds[winnerIndex];
                    const loserId = fullRankIds[loserIndex];
                    
                    if (winnerId && loserId) {
                        const winner = this.players.find(p=>p.id===winnerId);
                        const loser = this.players.find(p=>p.id===loserId);
                        
                        // [新增] 队友保护判断
                        // 逻辑：如果两人都有 team 属性，且 team 相等，则免罚
                        if (winner.team !== null && winner.team !== undefined && winner.team === loser.team) {
                             logLines.push(`[🛡️队友保护] 第${winnerIndex+1}名(${winner.name}) 与 倒数第${index+1}名(${loser.name}) 是队友，${score}分 免罚！`);
                        } else {
                            // 正常罚分
                            this.grandScores[winnerId] += score;
                            this.grandScores[loserId] -= score;
                            logLines.push(`[排名赏罚] 第${winnerIndex+1}名 ${winner.name} 收取 倒数第${index+1}名 ${loser.name} ${score} 分。`);
                        }
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
            detail: logLines.join('\n') || '完美结束，未设置额外罚分', 
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