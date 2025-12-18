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
        
        // 比赛历史记录，用于结算页面展示表格
        this.matchHistory = []; 
        
        this.timer = null;
        this.botTimer = null;
        this.turnStartTime = 0; 

        // [新增] 收集本局所有打出的牌（按顺序），用于下一局“模拟洗牌”
        this.collectedCards = [];
    }

    // [修改] 获取提示 - 返回所有可行解
    getHint(playerId) {
        try {
            if (!this.gameState) return [];
            const hand = this.gameState.hands[playerId];
            if (!hand) return [];

            const lastPlayed = this.gameState.lastPlayedCards;
            
            // 使用新方法 findAllSolutions 获取所有可行牌型
            const results = BotLogic.findAllSolutions(hand, lastPlayed, this.config.deckCount);
            
            return results || [];
        } catch (error) {
            console.error("[GameManager] getHint error:", error);
            return [];
        }
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
            this.matchHistory = []; // 新比赛清空历史
            this.collectedCards = []; // [新增] 第一局清空收集区
        }

        const deck = new Deck(this.config.deckCount);
        
        // [修改] 解析洗牌策略 (兼容旧的 isNoShuffleMode)
        let strategy = this.config.shuffleStrategy || (this.config.isNoShuffleMode ? 'NO_SHUFFLE' : 'CLASSIC');
        
        console.log(`[Game] Round started. Strategy: ${strategy}, Previous Collected: ${this.collectedCards.length}`);

        // [修改] 传入 strategy 和 collectedCards
        const hands = deck.deal(this.players.length, strategy, this.collectedCards);
        
        // [新增] 发牌后，清空收集区，准备收集这一局的新牌
        this.collectedCards = [];

        let startIndex = 0;
        if (this.lastWinnerId) {
            const winnerIdx = this.players.findIndex(p => p.id === this.lastWinnerId);
            if (winnerIdx !== -1) startIndex = winnerIdx;
        }

        // 组队分配逻辑：间隔入座 (0,2为一队; 1,3为一队)
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
                // [修改] Bot 使用 decideMove (内部会调用 findAllSolutions 取第一个)
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
                        // [修改] 如果 Bot 打出了天王炸，日志也需要带上加分信息
                        let logText = `${botPlayer.name}: ${desc}`;
                        if (analysis.type === 'BOMB_KING') {
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

        // 构造包含所有信息的结算对象
        const settlementData = {
            roundWinner: rInfo.roundWinnerName,
            pointsEarned: rInfo.pointsEarned,
            detail: rInfo.detail,       // 文字版日志
            matchHistory: this.matchHistory, // 完整的历史记录
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
        
        // [新增] 收集打出的牌 (模拟堆叠)
        this.collectedCards.push(...cards);

        // 1. 基础分计算
        this.gameState.pendingTablePoints += CardRules.calculateTotalScore(cards);

        // [新增] 2. 天王炸弹额外加分逻辑
        const analysis = CardRules.analyze(cards, this.config.deckCount);
        if (analysis.type === 'BOMB_KING') {
            // 响应你的第3点需求：集齐所有王的炸弹，加分到公共积分池，分值为牌副数*100
            const kingBombBonus = this.config.deckCount * 100;
            this.gameState.pendingTablePoints += kingBombBonus;
        }

        this.gameState.lastPlayedCards = cards;
        this.gameState.consecutivePasses = 0;
        this.gameState.roundWinnerId = playerId;

        const isFinished = this.gameState.hands[playerId].length === 0;
        if (isFinished) {
            if (!this.gameState.finishedRank.includes(playerId)) {
                this.gameState.finishedRank.push(playerId);
            }
        }
        
        const cardDesc = CardRules.getAnalysisText(analysis);
        let logText = `${currPlayer.name}: ${cardDesc}`;
        // 如果是天王炸，在日志里也显示一下加分
        if (analysis.type === 'BOMB_KING') {
            logText += ` (+${this.config.deckCount * 100}分)`;
        }

        const activeCount = this._getActivePlayerCount();
        
        // [新增] 3. 组队模式结束判断 (响应你的第2点需求)
        let isTeamFinished = false;
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        if (isTeamMode) {
            const pTeam = currPlayer.team;
            // 检查该队所有成员是否手牌都为0
            if (pTeam !== undefined && pTeam !== null) {
                const teamMembers = this.players.filter(p => p.team === pTeam);
                const allDone = teamMembers.every(p => this.gameState.hands[p.id].length === 0);
                if (allDone) {
                    isTeamFinished = true;
                }
            }
        }
        
        // 结束条件：只剩1人 OR 某队全员出完
        if (activeCount <= 1 || isTeamFinished) {
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
        let infoMessage = `${currPlayer.name}: 不要`;

        if (this.gameState.consecutivePasses >= passesNeeded) {
            const wId = this.gameState.roundWinnerId;
            if (wId) {
                this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                
                // 如果赢家还有牌，赢家继续出
                if (this.gameState.hands[wId].length > 0) {
                     const wIdx = this.players.findIndex(p => p.id === wId);
                     this.gameState.currentTurnIndex = wIdx;
                } else {
                    // 赢家已出完牌 (逃出)
                    // 检查是否需要触发“队友接风”逻辑
                    const winnerPlayer = this.players.find(p => p.id === wId);
                    const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
                    
                    let teammateTookOver = false;

                    // 只有在组队模式下，才尝试寻找队友接风
                    if (isTeamMode && winnerPlayer && winnerPlayer.team !== undefined && winnerPlayer.team !== null) {
                        const wIdx = this.players.findIndex(p => p.id === wId);
                        const pCount = this.players.length;
                        
                        // 接风搜索递增方向
                        for (let i = 1; i < pCount; i++) {
                            const tIdx = (wIdx + i) % pCount; 
                            const potentialTeammate = this.players[tIdx];
                            
                            // 是队友 且 还是活跃状态
                            if (potentialTeammate.team === winnerPlayer.team && 
                                this.gameState.hands[potentialTeammate.id] && 
                                this.gameState.hands[potentialTeammate.id].length > 0) {
                                
                                this.gameState.currentTurnIndex = tIdx;
                                teammateTookOver = true;
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
            nextIndex = (nextIndex + 1) % playerCount; // 轮转改为递增
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
        const roundPointsDisplay = {}; // 每一小局的独立分数
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

    // 完整的重连数据搬运
    reconnectPlayer(oldId, newId) {
        console.log(`[GameManager] Moving data from ${oldId} to ${newId}`);

        // 1. 搬运全局总分
        if (this.grandScores[oldId] !== undefined) {
            this.grandScores[newId] = this.grandScores[oldId];
            delete this.grandScores[oldId];
        }

        // 2. 搬运上局赢家标记
        if (this.lastWinnerId === oldId) this.lastWinnerId = newId;

        // 3. 处理托管状态
        const player = this.players.find(p => p.id === newId);
        if (player) {
             player.isAutoPlay = false; 
        }

        // 4. 搬运当前局数据
        if (this.gameState) {
            // 手牌
            if (this.gameState.hands[oldId]) {
                this.gameState.hands[newId] = this.gameState.hands[oldId];
                delete this.gameState.hands[oldId];
            }
            // 本局得分
            if (this.gameState.roundPoints[oldId] !== undefined) {
                this.gameState.roundPoints[newId] = this.gameState.roundPoints[oldId];
                delete this.gameState.roundPoints[oldId];
            }
            // 本回合赢家
            if (this.gameState.roundWinnerId === oldId) this.gameState.roundWinnerId = newId;
            
            // 完赛排名 (Array)
            const rankIdx = this.gameState.finishedRank.indexOf(oldId);
            if (rankIdx !== -1) {
                this.gameState.finishedRank[rankIdx] = newId;
            }
        }

        // 修复重连时历史记录 ID 映射
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
            // [新增] 收集输家的剩余手牌，确保牌数守恒
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

        let logLines = []; // [用于前端文字显示]
        let penaltyDetails = []; // [用于前端 Table 的日志数组]

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

        // 头游收分逻辑
        if (firstWinnerId && totalCardPenalty > 0) {
            currentRoundScores[firstWinnerId] += totalCardPenalty;
            const winnerName = this.players.find(p=>p.id===firstWinnerId)?.name;
            logLines.push(`[手牌罚分] 输家共计 ${totalCardPenalty} 分，归第一名 ${winnerName}。`);
            penaltyDetails.push(`第一名 ${winnerName} 获得剩余手牌分 ${totalCardPenalty}`);
        }

        // 排名赏罚 + 队友保护逻辑
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
                        
                        // 队友保护判断
                        if (winner.team !== null && winner.team !== undefined && winner.team === loser.team) {
                             logLines.push(`[🛡️队友保护] 第${winnerIndex+1}名(${winner.name}) 与 倒数第${index+1}名(${loser.name}) 是队友，${score}分 免罚！`);
                             penaltyDetails.push(`[队友保护] ${winner.name} 免收 ${loser.name} ${score} 分`);
                        } else {
                            // 正常罚分
                            currentRoundScores[winnerId] += score;
                            currentRoundScores[loserId] -= score;
                            logLines.push(`[排名赏罚] 第${winnerIndex+1}名 ${winner.name} 收取 倒数第${index+1}名 ${loser.name} ${score} 分。`);
                            penaltyDetails.push(`${loser.name} 进贡 ${winner.name} ${score} 分`);
                        }
                    }
                }
            });
        }

        // 更新总分
        this.players.forEach(p => {
            this.grandScores[p.id] += currentRoundScores[p.id];
        });

        // 存入 matchHistory
        this.matchHistory.push({
            roundIndex: this.matchHistory.length + 1,
            scores: {...currentRoundScores}, 
            winnerId: firstWinnerId,
            details: penaltyDetails
        });

        const firstWinnerName = this.players.find(p => p.id === firstWinnerId)?.name || '未知';
        const isGrandOver = this.grandScores[firstWinnerId] >= this.config.targetScore;
        const totalPointsEarned = currentRoundScores[firstWinnerId]; // 使用包含罚分后的最终当局得分

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