const CardRules = require('./CardRules');
const Deck = require('./Deck');
const BotLogic = require('./BotLogic');

class GameManager {
    constructor(roomConfig, players, io, roomId) {
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
        this.botTimer = null;
        this.turnStartTime = 0; 

        this.collectedCards = [];
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
            // [新增] 最后一手(捉鸟)阶段状态
            lastShotPhase: null // { targetId: string, passedCount: number, requiredPasses: number }
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

        // 仅当非最后一手阶段时，才检查 activePlayerCount <= 1 的跳过逻辑
        // 如果是 lastShotPhase，即使只有1个对手，也得让他思考出不出
        if (!this.gameState.lastShotPhase && this._getActivePlayerCount() <= 1 && this.gameState.lastPlayedCards.length === 0) return;

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        const isAI = currPlayer.isBot || currPlayer.isAutoPlay;

        if (isAI && this.gameState.hands[currPlayer.id].length > 0) {
            const delay = 1000 + Math.random() * 1000;
            this.botTimer = setTimeout(() => {
                this._executeBotTurn(currPlayer);
            }, delay);
        } else if (isAI && this.gameState.hands[currPlayer.id].length === 0 && this.gameState.lastShotPhase) {
            // [特殊] 如果是 AI 在最后一手阶段（理论上这不该发生，因为 AI 没牌了会被 _advanceTurn 跳过）
            // 但为了保险，如果 AI 没牌了，直接过
             this._forcePass(currPlayer);
        }
    }

    _executeBotTurn(botPlayer) {
        if (!this.gameState) return;
        if (this.players[this.gameState.currentTurnIndex].id !== botPlayer.id) return;

        try {
            const hand = this.gameState.hands[botPlayer.id];
            
            // [修改] 如果处于 lastShotPhase 且自己没牌（理论上不该轮到我），直接 Pass
            if (!hand || hand.length === 0) {
                 this._forcePass(botPlayer); 
                 return;
            }

            const isNewRound = this.gameState.lastPlayedCards.length === 0;
            const cardsToBeat = isNewRound ? [] : this.gameState.lastPlayedCards;

            const sortedHand = [...hand].sort((a,b) => CardRules.getPoint(a) - CardRules.getPoint(b));
            
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
                        let logText = `${botPlayer.name}: ${desc}`;
                        // [保留] 最后一手提示
                        if (result.logText && result.logText.includes('最后一手')) {
                            logText = result.logText;
                        } else if (analysis.type === 'BOMB_KING') {
                             logText += ` (+${this.config.deckCount * 100}分)`;
                        }
                        this._broadcastUpdate(logText);
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
                    this._playMinCard(botPlayer, sortedHand);
                } else {
                    this._forcePass(botPlayer);
                }
            }
        } catch (error) {
            console.error(`[Bot Error] Critical Exception in _executeBotTurn:`, error);
            this._forcePass(botPlayer);
        }
    }
    
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

    _broadcastUpdate(infoText = null) {
        const publicState = this.getPublicState();
        if (infoText) publicState.infoText = infoText;
        this.io.to(this.roomId).emit('game_state_update', publicState);
    }
    
    _forcePass(botPlayer) {
        const result = this.passTurn(botPlayer.id);
        
        // [新增] 处理 passTurn 可能返回的游戏结束状态
        if (result.isRoundOver) {
             this._handleWin(result, botPlayer.id); // 这里的 winnerId 实际上已经在 result.roundResult 里面处理好了
        } else if (result.success) {
            this._broadcastUpdate(`${botPlayer.name}: 不要`);
        } else {
            console.error("[Bot Critical] Failed to pass turn:", result.error);
            this._advanceTurn();
            this._broadcastUpdate();
            this._resetTimer();
            this._checkAndRunBot();
        }
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
        // 注意：roundWinnerId 暂时还是记在出牌人身上
        this.gameState.roundWinnerId = playerId;

        const isFinished = this.gameState.hands[playerId].length === 0;
        if (isFinished) {
            if (!this.gameState.finishedRank.includes(playerId)) {
                this.gameState.finishedRank.push(playerId);
            }
        }
        
        // 构造基础日志
        const cardDesc = CardRules.getAnalysisText(analysis);
        let logText = `${currPlayer.name}: ${cardDesc}`;
        if (analysis.type === 'BOMB_KING') logText += ` (+${this.config.deckCount * 100}分)`;

        // --- 核心修改区：结束检测 ---
        
        // 1. 如果当前处于“最后一手”阶段 (Last Shot Phase)
        // 说明有人之前出完了牌，现在当前玩家成功“管”上了！
        if (this.gameState.lastShotPhase) {
            // 管牌者直接获得桌面积分 (截胡)
            this.gameState.roundPoints[playerId] = (this.gameState.roundPoints[playerId] || 0) + this.gameState.pendingTablePoints;
            this.gameState.pendingTablePoints = 0;

            const targetName = this.players.find(p => p.id === this.gameState.lastShotPhase.targetId)?.name || '对手';
            logText = `${currPlayer.name} 压死 ${targetName}! (截获底分)`;

            // 游戏结束，赢家是当前管牌的人
            this.gameState.roundWinnerId = playerId;
            
            // 无论当前管牌的人是否出完，游戏都因“最后一手被管”而立即结束
            this._clearTimer();
            const roundResult = this._concludeRound();
            
            return { 
                success: true, 
                isRoundOver: true,
                roundResult,
                cardsPlayed: cards,
                pendingPoints: 0,
                logText
            };
        }

        // 2. 如果不处于 Last Shot，但玩家出完了牌，检测是否触发结束条件
        const activeCount = this._getActivePlayerCount(); // 获取剩余还有牌的对手数量
        
        let isTeamFinished = false;
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        if (isTeamMode) {
            const pTeam = currPlayer.team;
            if (pTeam !== undefined && pTeam !== null) {
                const teamMembers = this.players.filter(p => p.team === pTeam);
                const allDone = teamMembers.every(p => this.gameState.hands[p.id].length === 0);
                if (allDone) isTeamFinished = true;
            }
        }

        // 判定是否达到了原本的结束条件
        // (只剩1个对手 OR 某队全员出完) 且 玩家确实出完了
        const wouldEndGame = (activeCount <= 0 || (activeCount === 1 && !isTeamFinished) || isTeamFinished); 
        // 注意：_getActivePlayerCount() 返回的是还有牌的人数。如果我刚出完，我不算。
        // 所以如果 activeCount > 0，说明还有对手活着。

        if (isFinished && activeCount > 0) {
            // [触发 Last Shot]
            // 不立即结束，而是进入“最后一手”阶段，让剩下的对手尝试管一次
            
            this.gameState.lastShotPhase = {
                targetId: playerId, // 谁出的最后一手
                passedCount: 0,
                requiredPasses: activeCount // 所有剩下的有牌玩家都必须表态
            };

            logText += ` (最后一手! 等待挑战)`;

            // 继续流转到下一个人
            this._advanceTurn();
            this._resetTimer();
            this._checkAndRunBot();

            return { 
                success: true, 
                isRoundOver: false, // 暂时不结束
                cardsPlayed: cards,
                pendingPoints: this.gameState.pendingTablePoints,
                logText
            };
        }
        
        // 3. 正常结束 (例如：只剩最后一个人，他出完牌，没人能管了)
        // 或者 activeCount === 0 (我是最后一个)
        if (activeCount === 0) {
            this._clearTimer();
            const roundResult = this._concludeRound();
            return { 
                success: true, 
                isRoundOver: true,
                roundResult,
                cardsPlayed: cards,
                pendingPoints: this.gameState.pendingTablePoints,
                logText
            };
        }

        // 4. 正常流转
        this._advanceTurn();
        this._resetTimer();
        this._checkAndRunBot();

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

        // --- 核心修改区：最后一手阶段的过牌逻辑 ---
        if (this.gameState.lastShotPhase) {
            this.gameState.lastShotPhase.passedCount++;
            const logText = `${currPlayer.name}: 管不起 (最后一手)`;

            // 如果所有有牌的对手都过牌了
            if (this.gameState.lastShotPhase.passedCount >= this.gameState.lastShotPhase.requiredPasses) {
                // 原出牌者真正获胜，拿走底分
                const targetId = this.gameState.lastShotPhase.targetId;
                this.gameState.roundPoints[targetId] = (this.gameState.roundPoints[targetId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;

                const targetName = this.players.find(p => p.id === targetId)?.name;
                const finalLog = `${targetName} 最后一手无人能管，成功拿下底分!`;

                this._clearTimer();
                this.gameState.roundWinnerId = targetId; 
                const roundResult = this._concludeRound();

                return { 
                    success: true, 
                    turnCleared: true, 
                    logText: finalLog,
                    isRoundOver: true, // 标记游戏结束
                    roundResult // 返回结算数据
                };
            }

            // 还有人没表态，继续流转
            this._advanceTurn();
            this._resetTimer();
            this._checkAndRunBot();

            return { success: true, turnCleared: false, logText };
        }

        // --- 正常过牌逻辑 ---
        this.gameState.consecutivePasses++;
        this._advanceTurn(); 

        const winnerHand = this.gameState.hands[this.gameState.roundWinnerId];
        const winnerIsActive = winnerHand && winnerHand.length > 0;
        const activeCount = this._getActivePlayerCount();
        
        const passesNeeded = winnerIsActive ? (activeCount - 1) : activeCount;

        let turnCleared = false;
        let infoMessage = `${currPlayer.name}: 不要`;

        if (this.gameState.consecutivePasses >= passesNeeded) {
            const wId = this.gameState.roundWinnerId;
            if (wId) {
                this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                
                if (this.gameState.hands[wId].length > 0) {
                     const wIdx = this.players.findIndex(p => p.id === wId);
                     this.gameState.currentTurnIndex = wIdx;
                } else {
                    // 队友接风逻辑
                    const winnerPlayer = this.players.find(p => p.id === wId);
                    const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
                    
                    if (isTeamMode && winnerPlayer && winnerPlayer.team !== undefined && winnerPlayer.team !== null) {
                        const wIdx = this.players.findIndex(p => p.id === wId);
                        const pCount = this.players.length;
                        
                        for (let i = 1; i < pCount; i++) {
                            const tIdx = (wIdx + i) % pCount; 
                            const potentialTeammate = this.players[tIdx];
                            
                            if (potentialTeammate.team === winnerPlayer.team && 
                                this.gameState.hands[potentialTeammate.id] && 
                                this.gameState.hands[potentialTeammate.id].length > 0) {
                                
                                this.gameState.currentTurnIndex = tIdx;
                                infoMessage = `${currPlayer.name}: 不要 (队友接风)`;
                                this._broadcastUpdate(`${winnerPlayer.name} 已逃出，队友 ${potentialTeammate.name} 接风`);
                                break;
                            }
                        }
                    }
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
            logText: infoMessage
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
            // [修改] 处理 passTurn 可能返回的 isRoundOver
            const result = this.passTurn(currPlayer.id);
            if (result.success) {
                if (result.isRoundOver) {
                     this._handleWin(result, currPlayer.id);
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
            if (this.gameState.hands[oldId]) {
                this.gameState.hands[newId] = this.gameState.hands[oldId];
                delete this.gameState.hands[oldId];
            }
            if (this.gameState.roundPoints[oldId] !== undefined) {
                this.gameState.roundPoints[newId] = this.gameState.roundPoints[oldId];
                delete this.gameState.roundPoints[oldId];
            }
            if (this.gameState.roundWinnerId === oldId) this.gameState.roundWinnerId = newId;
            
            // [新增] 修复 lastShotPhase 中的 targetId
            if (this.gameState.lastShotPhase && this.gameState.lastShotPhase.targetId === oldId) {
                this.gameState.lastShotPhase.targetId = newId;
            }

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
            const remaining = this.gameState.hands[lastPlayer.id];
            this.collectedCards.push(...remaining);
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
        let penaltyDetails = []; 

        let totalCardPenalty = 0;
        let currentRoundScores = {};
        this.players.forEach(p => {
            currentRoundScores[p.id] = (this.gameState.roundPoints[p.id] || 0);
        });

        this.players.forEach(p => {
            const handPts = CardRules.calculateTotalScore(this.gameState.hands[p.id]);
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