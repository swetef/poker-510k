const CardRules = require('./CardRules');
const Deck = require('./Deck');
const BotLogic = require('./BotLogic');
// [新增] 引入 BotManager
const BotManager = require('./BotManager');

class GameManager {
    constructor(roomConfig, players, io, roomId) {
        // ... (保留 constructor, getHint, toggleAutoPlay, startRound, _broadcastUpdate, _handleWin, playCards, passTurn, _clearTimer, _resetTimer 等方法不变) ...
        this.config = roomConfig;
        this.players = players; 
        this.io = io; 
        this.roomId = roomId;

        this.grandScores = {}; // 总大分
        this.players.forEach(p => this.grandScores[p.id] = 0);
        this.lastWinnerId = null;
        this.gameState = null; 
        
        this.matchHistory = []; 
        
        this.timer = null;
        this.turnStartTime = 0; 

        this.collectedCards = [];

        // [新增] 初始化 BotManager
        this.botManager = new BotManager(this);
    }

    getHint(playerId) {
        try {
            if (!this.gameState) return [];
            const hand = this.gameState.hands[playerId];
            if (!hand) return [];

            const lastPlayed = this.gameState.lastPlayedCards;
            
            const results = BotLogic.findAllSolutions(hand, lastPlayed, this.config.deckCount);
            
            return results || [];
        } catch (error) {
            console.error("[GameManager] getHint error:", error);
            return [];
        }
    }

    toggleAutoPlay(playerId) {
        // [修改] 委托给 BotManager
        this.botManager.toggleAutoPlay(playerId);
    }

    startRound(isNextRound = false) {
        if (!isNextRound) {
            this.players.forEach(p => this.grandScores[p.id] = 0);
            this.lastWinnerId = null;
            this.matchHistory = []; 
            this.collectedCards = []; 
        }

        const deck = new Deck(this.config.deckCount);
        
        let strategy = this.config.shuffleStrategy || (this.config.isNoShuffleMode ? 'NO_SHUFFLE' : 'CLASSIC');
        
        console.log(`[Game] Round started. Strategy: ${strategy}, Previous Collected: ${this.collectedCards.length}`);

        const hands = deck.deal(this.players.length, strategy, this.collectedCards);
        
        this.collectedCards = [];

        let startIndex = 0;
        if (this.lastWinnerId) {
            const winnerIdx = this.players.findIndex(p => p.id === this.lastWinnerId);
            if (winnerIdx !== -1) startIndex = winnerIdx;
        }

        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        this.players.forEach((p, index) => {
            if (isTeamMode) {
                p.team = index % 2; 
            } else {
                p.team = null; 
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
            // [修改] 移除 lastShotPhase，回归自然流转
            lastShotPhase: null 
        };

        this.players.forEach((p, index) => {
            this.gameState.hands[p.id] = hands[index];
            this.gameState.roundPoints[p.id] = 0;
        });

        this._resetTimer();
        
        // [修改] 委托 BotManager 检查是否需要机器人行动
        this.botManager.checkAndRun();

        return {
            startPlayerIndex: startIndex,
            startPlayerId: this.players[startIndex].id,
            hands: this.gameState.hands
        };
    }

    _broadcastUpdate(infoText = null) {
        const publicState = this.getPublicState();
        if (infoText) publicState.infoText = infoText;
        this.io.to(this.roomId).emit('game_state_update', publicState);
    }

    _handleWin(result, triggerPlayerId) {
        const rInfo = result.roundResult;

        const settlementData = {
            roundWinner: rInfo.roundWinnerName,
            pointsEarned: rInfo.pointsEarned,
            detail: rInfo.detail,       
            matchHistory: this.matchHistory, 
            grandScores: rInfo.grandScores,
            roundIndex: this.matchHistory.length
        };

        if (rInfo.isGrandOver) {
            this.io.to(this.roomId).emit('grand_game_over', { 
                grandWinner: rInfo.roundWinnerName, 
                ...settlementData
            });
            this.gameState = null; 
            this._clearTimer(); 
        } else {
            this.io.to(this.roomId).emit('round_over', settlementData);
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
        this.collectedCards.push(...cards);

        this.gameState.pendingTablePoints += CardRules.calculateTotalScore(cards);

        const analysis = CardRules.analyze(cards, this.config.deckCount);
        if (analysis.type === 'BOMB_KING') {
            const kingBombBonus = this.config.deckCount * 100;
            this.gameState.pendingTablePoints += kingBombBonus;
        }

        this.gameState.lastPlayedCards = cards;
        this.gameState.consecutivePasses = 0;
        this.gameState.roundWinnerId = playerId; // 当前轮次的“庄主”是出牌人

        const isFinished = this.gameState.hands[playerId].length === 0;
        if (isFinished) {
            if (!this.gameState.finishedRank.includes(playerId)) {
                this.gameState.finishedRank.push(playerId);
            }
        }
        
        const cardDesc = CardRules.getAnalysisText(analysis);
        let logText = `${currPlayer.name}: ${cardDesc}`;
        if (analysis.type === 'BOMB_KING') logText += ` (+${this.config.deckCount * 100}分)`;
        if (isFinished) logText += ` (牌出完了!)`;

        // [核心修复] 判定游戏是否彻底结束
        // 规则：单人模式 -> 剩1人结束。组队模式 -> 剩1队结束。
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        let shouldEndGame = false;

        if (isTeamMode) {
            // 检查还有几个队伍存活（有手牌）
            const activeTeams = new Set();
            this.players.forEach(p => {
                if (this.gameState.hands[p.id] && this.gameState.hands[p.id].length > 0) {
                    if (p.team !== undefined && p.team !== null) activeTeams.add(p.team);
                }
            });
            // 如果只剩1个队伍有牌，或者0个队伍有牌，则结束
            if (activeTeams.size <= 1) shouldEndGame = true;
        } else {
            // 检查还有几个人存活
            let activeCount = 0;
            this.players.forEach(p => {
                if (this.gameState.hands[p.id] && this.gameState.hands[p.id].length > 0) activeCount++;
            });
            if (activeCount <= 1) shouldEndGame = true;
        }

        if (shouldEndGame) {
            // 如果我是最后一个出牌的人，并且我出完导致游戏结束了
            // 那么桌面上的 pendingTablePoints 归我（或者归当前轮次赢家，也就是我）
            this.gameState.roundPoints[playerId] = (this.gameState.roundPoints[playerId] || 0) + this.gameState.pendingTablePoints;
            this.gameState.pendingTablePoints = 0;

            this._clearTimer();
            const roundResult = this._concludeRound();
            return { 
                success: true, 
                isRoundOver: true,
                roundResult,
                cardsPlayed: cards,
                pendingPoints: 0,
                logText: logText + " - 游戏结束"
            };
        }

        // 如果游戏没结束，继续流转（即使我没牌了，轮次也正常流转给下家，下家需要管我的牌）
        this._advanceTurn();
        this._resetTimer();
        this.botManager.checkAndRun();

        return { 
            success: true, 
            isRoundOver: false,
            cardsPlayed: cards,
            pendingPoints: this.gameState.pendingTablePoints,
            logText
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

        const activeCount = this._getActivePlayerCount(); 
        
        const winnerId = this.gameState.roundWinnerId;
        const winnerHand = this.gameState.hands[winnerId];
        const winnerIsActive = winnerHand && winnerHand.length > 0;
        
        const passesNeeded = winnerIsActive ? (activeCount - 1) : activeCount;

        let turnCleared = false;
        let infoMessage = `${currPlayer.name}: 不要`;

        if (this.gameState.consecutivePasses >= passesNeeded) {
            const wId = this.gameState.roundWinnerId;
            if (wId) {
                // 结算当前桌面的分
                this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                
                // [关键逻辑] 决定下一轮谁先出牌 (接风逻辑)
                if (this.gameState.hands[wId] && this.gameState.hands[wId].length > 0) {
                     // 赢家还有牌，赢家继续
                     const wIdx = this.players.findIndex(p => p.id === wId);
                     this.gameState.currentTurnIndex = wIdx;
                } else {
                    // 赢家没牌了 (跑了)
                    const winnerPlayer = this.players.find(p => p.id === wId);
                    const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
                    
                    if (isTeamMode && winnerPlayer && winnerPlayer.team !== undefined && winnerPlayer.team !== null) {
                        // --- 组队模式：找队友接风 ---
                        const wIdx = this.players.findIndex(p => p.id === wId);
                        const pCount = this.players.length;
                        
                        // 从赢家下家开始找，找第一个有牌的队友
                        let foundTeammate = false;
                        for (let i = 1; i < pCount; i++) {
                            const tIdx = (wIdx + i) % pCount; 
                            const potentialTeammate = this.players[tIdx];
                            
                            if (potentialTeammate.team === winnerPlayer.team && 
                                this.gameState.hands[potentialTeammate.id] && 
                                this.gameState.hands[potentialTeammate.id].length > 0) {
                                
                                this.gameState.currentTurnIndex = tIdx;
                                infoMessage = `${currPlayer.name}: 不要 (队友接风)`;
                                this._broadcastUpdate(`${winnerPlayer.name} 已逃出，队友 ${potentialTeammate.name} 接风`);
                                foundTeammate = true;
                                break;
                            }
                        }
                        // 如果队友都没牌了（理论上不会，否则游戏早结束了），那就给下家
                        if (!foundTeammate) {
                             // 顺延给下家 (这在逻辑上基本不会发生，除非 activeCount计算有误)
                             this._advanceTurn(); 
                        }
                    } else {
                        // --- 单人模式：赢家跑了，下家接风 ---
                        const wIdx = this.players.findIndex(p => p.id === wId);
                        let nextActiveIdx = wIdx;
                        let found = false;
                        for(let i=1; i<this.players.length; i++) {
                            let idx = (wIdx + i) % this.players.length;
                            if (this.gameState.hands[this.players[idx].id].length > 0) {
                                nextActiveIdx = idx;
                                found = true;
                                break;
                            }
                        }
                        
                        if (found) {
                             this.gameState.currentTurnIndex = nextActiveIdx;
                             infoMessage = `${currPlayer.name}: 不要 (${this.players[nextActiveIdx].name} 接风)`;
                             this._broadcastUpdate(`${winnerPlayer.name} 已逃出，下家 ${this.players[nextActiveIdx].name} 接风`);
                        }
                    }
                }
            }
            
            this.gameState.lastPlayedCards = [];
            this.gameState.consecutivePasses = 0;
            turnCleared = true;
        }

        this._resetTimer(); 
        this.botManager.checkAndRun();

        return { 
            success: true, 
            turnCleared,
            logText: infoMessage
        };
    }

    _clearTimer() {
        if (this.timer) clearTimeout(this.timer);
        if (this.botManager) this.botManager.clearTimer();
        this.timer = null;
    }

    _resetTimer() {
        this._clearTimer();
        if (this.gameState && this._getActivePlayerCount() > 0) {
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
            
            // [关键修复] 如果玩家没牌（异常情况），必须重置计时器并检查Bot，否则游戏会卡死在这里
            if (!hand || hand.length === 0) { 
                this._advanceTurn(); 
                this._resetTimer(); 
                this.botManager.checkAndRun();
                return; 
            }

            const sorted = hand.map(c => ({ id: c, val: CardRules.getPoint(c) })).sort((a, b) => a.val - b.val);
            const cardToPlay = [sorted[0].id]; 
            
            const result = this.playCards(currPlayer.id, cardToPlay);
            if (result.success) {
                this.io.to(currPlayer.id).emit('hand_update', this.gameState.hands[currPlayer.id]);
                
                const logText = result.logText || `${currPlayer.name} 超时出牌`;
                
                // [修复] 先广播出牌，让前端看到最后一张牌
                this._broadcastUpdate(logText);

                if (result.isRoundOver) {
                     // [修复] 增加 3秒 延迟
                     setTimeout(() => {
                        this._handleWin(result, currPlayer.id);
                     }, 3000);
                }
            }
        } else {
            const result = this.passTurn(currPlayer.id);
            if (result.success) {
                // [修复] Pass 导致结束也需要延迟（理论上 passTurn 不返回 isRoundOver，但在组队逻辑下可能需要检查）
                if (result.isRoundOver) {
                     this._broadcastUpdate(`${currPlayer.name}: 超时过牌`);
                     setTimeout(() => {
                        this._handleWin(result, currPlayer.id);
                     }, 3000);
                } else {
                    this._broadcastUpdate(`${currPlayer.name}: 超时过牌`);
                }
            }
        }
    }

    _getActivePlayerCount() {
        if (!this.gameState) return 0;
        let count = 0;
        for (const p of this.players) {
            // [安全保护] 增加对 hands[p.id] 的存在性检查
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
            // 跳过没牌的人
            (this.gameState.hands[this.players[nextIndex].id] || []).length === 0 && 
            attempts < playerCount 
        );
        
        this.gameState.currentTurnIndex = nextIndex;
    }

    getPublicState() {
        if (!this.gameState) return null;
        
        const currentScoresDisplay = {};
        const roundPointsDisplay = {}; 
        const playersInfo = {};
        const handCounts = {};

        this.players.forEach(p => {
            const grand = this.grandScores[p.id] || 0;
            const round = this.gameState.roundPoints[p.id] || 0;
            currentScoresDisplay[p.id] = grand + round;
            roundPointsDisplay[p.id] = round; 
            
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
            roundPoints: roundPointsDisplay, 
            pendingPoints: this.gameState.pendingTablePoints,
            finishedRank: this.gameState.finishedRank,
            playersInfo: playersInfo,
            handCounts: handCounts 
        };
    }

    // ... (保留 reconnectPlayer, _handContainsCards, _removeCardsFromHand, _concludeRound, getPlayerHand 方法不变) ...
    reconnectPlayer(oldId, newId) {
        console.log(`[GameManager] Moving data from ${oldId} to ${newId}`);

        if (this.grandScores[oldId] !== undefined) {
            this.grandScores[newId] = this.grandScores[oldId];
            delete this.grandScores[oldId];
        }

        if (this.lastWinnerId === oldId) this.lastWinnerId = newId;

        const player = this.players.find(p => p.id === newId);
        if (player) {
             player.isAutoPlay = false; 
        }

        if (this.gameState) {
            if (this.gameState.hands && this.gameState.hands[oldId]) {
                this.gameState.hands[newId] = this.gameState.hands[oldId];
                delete this.gameState.hands[oldId];
            } else if (this.gameState.hands) {
                console.warn(`[Warning] Old hand not found for ${oldId}, resetting ${newId} to empty.`);
                this.gameState.hands[newId] = [];
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

        this.matchHistory.forEach(match => {
            if (match.scores[oldId] !== undefined) {
                match.scores[newId] = match.scores[oldId];
                delete match.scores[oldId];
            }
        });

        return true;
    }

    _handContainsCards(hand, cardsToPlay) {
        if (!hand) return false;
        const tempHand = [...hand];
        for (let c of cardsToPlay) {
            const idx = tempHand.indexOf(c);
            if (idx === -1) return false;
            tempHand.splice(idx, 1);
        }
        return true;
    }

    _removeCardsFromHand(playerId, cards) {
        if (!this.gameState.hands[playerId]) return;
        const newHand = [...this.gameState.hands[playerId]];
        for (let c of cards) {
            const idx = newHand.indexOf(c);
            if (idx !== -1) newHand.splice(idx, 1);
        }
        this.gameState.hands[playerId] = newHand;
    }

    _concludeRound() {
        // [修复逻辑] 结束时，把所有还没出完牌的人的牌回收
        // 但通常 510K 里，这些分不一定算分，或者算作输家的分归赢家
        // 这里简化：只记录结束状态
        
        const lastPlayer = this.players.find(p => this.gameState.hands[p.id] && this.gameState.hands[p.id].length > 0);
        
        // 桌面剩余分归赢家
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
        let penaltyDetails = []; 

        let totalCardPenalty = 0;
        let currentRoundScores = {};
        this.players.forEach(p => {
            currentRoundScores[p.id] = (this.gameState.roundPoints[p.id] || 0);
        });

        this.players.forEach(p => {
            const h = this.gameState.hands[p.id] || [];
            const handPts = CardRules.calculateTotalScore(h);
            if (handPts > 0) {
                totalCardPenalty += handPts;
            }
        });

        if (firstWinnerId && totalCardPenalty > 0) {
            currentRoundScores[firstWinnerId] += totalCardPenalty;
            const winnerName = this.players.find(p=>p.id===firstWinnerId)?.name;
            logLines.push(`[手牌罚分] 输家共计 ${totalCardPenalty} 分，归第一名 ${winnerName}。`);
            penaltyDetails.push(`第一名 ${winnerName} 获得剩余手牌分 ${totalCardPenalty}`);
        }

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
                        
                        if (winner.team !== null && winner.team !== undefined && winner.team === loser.team) {
                             logLines.push(`[🛡️队友保护] 第${winnerIndex+1}名(${winner.name}) 与 倒数第${index+1}名(${loser.name}) 是队友，${score}分 免罚！`);
                             penaltyDetails.push(`[队友保护] ${winner.name} 免收 ${loser.name} ${score} 分`);
                        } else {
                            currentRoundScores[winnerId] += score;
                            currentRoundScores[loserId] -= score;
                            logLines.push(`[排名赏罚] 第${winnerIndex+1}名 ${winner.name} 收取 倒数第${index+1}名 ${loser.name} ${score} 分。`);
                            penaltyDetails.push(`${loser.name} 进贡 ${winner.name} ${score} 分`);
                        }
                    }
                }
            });
        }

        this.players.forEach(p => {
            this.grandScores[p.id] += currentRoundScores[p.id];
        });

        this.matchHistory.push({
            roundIndex: this.matchHistory.length + 1,
            scores: {...currentRoundScores}, 
            winnerId: firstWinnerId,
            details: penaltyDetails
        });

        const firstWinnerName = this.players.find(p => p.id === firstWinnerId)?.name || '未知';
        const isGrandOver = this.grandScores[firstWinnerId] >= this.config.targetScore;
        const totalPointsEarned = currentRoundScores[firstWinnerId];

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