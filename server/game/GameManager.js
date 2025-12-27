const CardRules = require('./CardRules');
const Deck = require('./Deck');
const BotManager = require('./BotManager');

class GameManager {
    constructor(roomConfig, players, io, roomId) {
        this.config = roomConfig;
        this.players = players;
        this.io = io;
        this.roomId = roomId;

        // 初始化大局分数
        this.grandScores = {};
        this.players.forEach(p => {
            this.grandScores[p.id] = 0;
            // [功能保护] 确保默认属性存在，不破坏原有数据结构
            p.autoPlayMode = p.autoPlayMode || 'SMART'; 
            p.isReady = false; 
            p.isAutoPlay = false;
            p.isOffline = false; // [新增] 离线状态标记
        });

        this.readyPlayers = new Set();
        
        // [状态管理修复] 核心锁
        this.isRoundOverState = false; // 小局是否结束
        this.isGrandOverState = false; // 大局(整场比赛)是否结束
        
        // [新增] 缓存最后一次结算数据，用于断线重连补发
        this.lastSettlementData = null;

        this.lastWinnerId = null;
        this.gameState = null;
        this.matchHistory = []; 
        this.timer = null;
        this.turnStartTime = 0;
        this.collectedCards = [];
        this.botManager = new BotManager(this);

        // [Bug修复] 增加销毁标记
        this.disposed = false;
        
        console.log(`[GameManager] Created for room ${roomId}`);
    }

    // [Bug修复] 彻底销毁当前实例，清理所有定时器和副作用
    dispose() {
        this.disposed = true;
        this._clearTimer();
        if (this.botManager) {
            this.botManager.clearTimer();
        }
        // [功能保护] 清空引用帮助GC
        this.players = [];
        this.gameState = null;
        this.lastSettlementData = null;
        console.log(`[GameManager] Instance for room ${this.roomId} disposed.`);
    }

    setPlayerAutoPlayMode(playerId, mode) {
        if (this.disposed) return; 
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.autoPlayMode = mode;
            console.log(`[Game] Player ${player.name} switched auto-play mode to ${mode}`);
        }
    }

    toggleAutoPlay(playerId) {
        if (this.disposed) return; 
        this.botManager.toggleAutoPlay(playerId);
    }

    // [核心修复] startRound 逻辑增强
    startRound(isNextRound = false) {
        if (this.disposed) return; 

        console.log(`[Game] startRound triggered. isNextRound: ${isNextRound}, RoomId: ${this.roomId}`);

        // 1. 重置所有结束状态标记，防止逻辑死循环
        this.isRoundOverState = false;
        this.isGrandOverState = false; 
        this.lastSettlementData = null; // 清空旧结算数据
        this.readyPlayers.clear();
        this.players.forEach(p => {
            p.isReady = false;
            // [功能保护] 确保下一局开始时清理掉上一局的临时状态
            p.isFinished = false; 
        });

        // 2. 如果是新的一场大局(非下一小局)，彻底重置所有历史数据
        if (!isNextRound) {
            console.log('[Game] Starting NEW GRAND GAME. Resetting scores and history.');
            this.players.forEach(p => this.grandScores[p.id] = 0);
            this.lastWinnerId = null;
            this.matchHistory = [];
            this.collectedCards = [];
        }

        // 3. [功能保护] 新局开始，真人玩家默认不托管（除非掉线）
        this.players.forEach(p => {
            if (!p.isBot) {
                // 如果玩家在线，则取消托管；如果离线，保持原样(后续逻辑会处理离线行为)
                if (!p.isOffline) {
                    p.isAutoPlay = false;
                }
            }
        });

        // 4. 发牌逻辑
        const deck = new Deck(this.config.deckCount);
        let strategy = this.config.shuffleStrategy || (this.config.isNoShuffleMode ? 'NO_SHUFFLE' : 'CLASSIC');
        let preciseMode = this.config.preciseMode || 'stimulating';
        
        const hands = deck.deal(this.players.length, strategy, this.collectedCards, preciseMode);
        this.collectedCards = []; // 清空收集的废牌

        // 5. 确定首发玩家（头游）
        let startIndex = 0;
        if (this.lastWinnerId) {
            const winnerIdx = this.players.findIndex(p => p.id === this.lastWinnerId);
            if (winnerIdx !== -1) startIndex = winnerIdx;
        }

        // 6. 队伍分配
        // [功能保护] 严格根据配置重置队伍，防止脏数据
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        this.players.forEach((p, index) => {
            if (isTeamMode) {
                p.team = index % 2; // 0 或 1
            } else {
                p.team = null;
            }
        });

        // 7. 初始化局内状态
        this.gameState = {
            hands: {},
            currentTurnIndex: startIndex,
            lastPlayedCards: [],
            consecutivePasses: 0,
            roundPoints: {},
            pendingTablePoints: 0,
            roundWinnerId: null,
            finishedRank: [],
            lastShotPhase: null // [功能保护] 确保此字段初始化
        };

        this.players.forEach((p, index) => {
            this.gameState.hands[p.id] = hands[index];
            this.gameState.roundPoints[p.id] = 0;
        });

        // 8. 启动游戏循环
        this._resetTimer();
        this.botManager.checkAndRun();

        return {
            startPlayerIndex: startIndex,
            startPlayerId: this.players[startIndex].id,
            hands: this.gameState.hands
        };
    }

    _broadcastUpdate(infoText = null) {
        if (this.disposed) return; 
        const publicState = this.getPublicState();
        if (!publicState) return; // 保护
        if (infoText) publicState.infoText = infoText;
        this.io.to(this.roomId).emit('game_state_update', publicState);
    }

    _notifyHandUpdate(playerId) {
        if (this.disposed) return; 
        if (!this.gameState || !this.gameState.hands) return;
        const hand = this.gameState.hands[playerId] || [];
        
        const owner = this.players.find(p => p.id === playerId);
        if (owner && !owner.isBot) {
            this.io.to(playerId).emit('hand_update', hand);
        }
        // 同时也通知观察者（如队友或观战者）
        this._notifyObservers(playerId, hand);
    }

    _notifyObservers(targetId, hand) {
        if (this.disposed) return; 
        const targetPlayer = this.players.find(p => p.id === targetId);
        if (!targetPlayer) return;

        this.players.forEach(observer => {
            if (observer.id === targetId) return;
            if (observer.isBot) return;

            const observerHand = this.gameState.hands[observer.id] || [];
            const isFinished = observerHand.length === 0;

            let canSee = false;
            // 逻辑：如果观察者自己出完了，或者小局已结束，或者有特殊透视道具(预留)，则可见
            if (isFinished || this.isRoundOverState) {
                // 组队模式下，通常只能看队友，或者结束后看所有人
                if (targetPlayer.team !== null && targetPlayer.team !== undefined) {
                    if (observer.team === targetPlayer.team) canSee = true;
                } else {
                    canSee = true; // 个人混战模式出完牌通常可以看别人
                }
                
                if (this.isRoundOverState) canSee = true; // 结算时全亮

                if (canSee) {
                    this.io.to(observer.id).emit('observation_update', { 
                        targetId: targetId, 
                        hand: hand,
                        targetName: targetPlayer.name 
                    });
                }
            }
        });
    }

    _pushAllVisibleHandsTo(observerId) {
        if (this.disposed) return; 
        const observer = this.players.find(p => p.id === observerId);
        if (!observer) return;

        this.players.forEach(target => {
            if (target.id === observerId) return;
            const targetHand = this.gameState.hands[target.id] || [];
            if (targetHand.length > 0) {
                let canSee = false;
                if (target.team !== null && target.team !== undefined) {
                    if (observer.team === target.team) canSee = true;
                } else {
                    canSee = true;
                }
                if (this.isRoundOverState) canSee = true;

                if (canSee) {
                    this.io.to(observerId).emit('observation_update', { 
                        targetId: target.id, 
                        hand: targetHand,
                        targetName: target.name 
                    });
                }
            }
        });
    }

    _handleWin(result, triggerPlayerId) {
        if (this.disposed) return; 
        const rInfo = result.roundResult;
        
        const settlementData = {
            roundWinner: rInfo.roundWinnerName,
            pointsEarned: rInfo.pointsEarned,
            detail: rInfo.detail,
            matchHistory: this.matchHistory,
            grandScores: rInfo.grandScores,
            roundIndex: this.matchHistory.length,
            scoreBreakdown: rInfo.scoreBreakdown,
            isGrandOver: rInfo.isGrandOver,
            remainingHands: rInfo.remainingHands 
        };

        // [核心修复] 缓存结算数据，供重连使用
        this.lastSettlementData = settlementData;

        if (rInfo.isGrandOver) {
            console.log(`[Game] Grand Game Over! Winner: ${rInfo.roundWinnerName}`);
            // [关键修复] 标记大局结束
            this.isGrandOverState = true; 
            
            this.io.to(this.roomId).emit('grand_game_over', { 
                grandWinner: rInfo.roundWinnerName,
                ...settlementData 
            });
            
            this.gameState = null; 
            this._clearTimer();
        } else {
            console.log(`[Game] Round Over. Waiting for ready...`);
            this.io.to(this.roomId).emit('round_over', settlementData);
            this._clearTimer();
        }
    }

    // [关键修复] 处理玩家准备
    handlePlayerReady(playerId) {
        if (this.disposed) return { success: false, error: '游戏已结束' };

        // 1. 基础状态检查
        if (!this.isRoundOverState) return { success: false, error: '当前不在准备阶段' };
        
        // 2. [新增] 大局结束阻断
        if (this.isGrandOverState) {
            return { success: false, error: '大局已结束，请点击重新开始' };
        }

        this.readyPlayers.add(playerId);
        
        const player = this.players.find(p => p.id === playerId);
        if (player) player.isReady = true;

        this.io.to(this.roomId).emit('ready_state_update', { 
            readyPlayerIds: Array.from(this.readyPlayers) 
        });

        // 3. 检查全员准备 (真人+Bot)
        const botCount = this.players.filter(p => p.isBot).length;
        if (this.readyPlayers.size + botCount >= this.players.length) {
            console.log('[Game] All players ready. Auto-starting next round...');
            setTimeout(() => {
                if (!this.disposed) this._autoStartNextRound();
            }, 500);
            return { success: true, allReady: true };
        }
        return { success: true, allReady: false };
    }

    _autoStartNextRound() {
        if (this.disposed) return; 
        // 安全检查
        if (this.isGrandOverState) return;

        const startInfo = this.startRound(true);

        this.players.forEach((p) => {
            if (!p.isBot) {
                const hand = startInfo.hands[p.id];
                this.io.to(p.id).emit('game_started', { 
                    hand: hand, 
                    grandScores: this.grandScores,
                    handCounts: this.getPublicState().handCounts
                });
            }
        });
        
        if (this.players.some(p => !p.isBot)) {
            this._broadcastUpdate('所有玩家准备完毕，游戏开始！');
        }
    }

    playCards(playerId, cards) {
        if (this.disposed) return { success: false, error: '游戏已销毁' }; 
        if (!this.gameState) return { success: false, error: '游戏未开始' };
        
        // [Bug修复核心] 如果本局已结束，直接拦截出牌请求，防止重复结算
        if (this.isRoundOverState) return { success: false, error: '本局已结束' };

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        if (currPlayer.id !== playerId) return { success: false, error: '还没轮到你' };

        const playerHand = this.gameState.hands[playerId];
        // 验证手牌合法性
        if (!this._handContainsCards(playerHand, cards)) return { success: false, error: '手牌不足或数据不同步' };

        // 验证牌型规则
        const isNewRound = this.gameState.lastPlayedCards.length === 0;
        const cardsToBeat = isNewRound ? [] : this.gameState.lastPlayedCards;
        if (!CardRules.canPlay(cards, cardsToBeat, this.config.deckCount)) return { success: false, error: '牌型不符或管不上' };

        // 执行出牌
        this._removeCardsFromHand(playerId, cards);
        this.collectedCards.push(...cards);
        
        // 分数计算（如5/10/K）
        this.gameState.pendingTablePoints += CardRules.calculateTotalScore(cards);
        
        // 炸弹王等特殊奖励
        const analysis = CardRules.analyze(cards, this.config.deckCount);
        if (analysis.type === 'BOMB_KING') this.gameState.pendingTablePoints += (this.config.deckCount * 100);

        this.gameState.lastPlayedCards = cards;
        this.gameState.consecutivePasses = 0;
        this.gameState.roundWinnerId = playerId;

        // 检查是否出完
        const isFinished = this.gameState.hands[playerId].length === 0;
        if (isFinished) {
            if (!this.gameState.finishedRank.includes(playerId)) this.gameState.finishedRank.push(playerId);
            // 出完牌后立即通知其他人
            this._pushAllVisibleHandsTo(playerId);
        }

        const cardDesc = CardRules.getAnalysisText(analysis);
        let logText = `${currPlayer.name}: ${cardDesc}`;
        if (analysis.type === 'BOMB_KING') logText += ` (+${this.config.deckCount * 100}分)`;
        if (isFinished) logText += ` (牌出完了!)`;

        this._notifyHandUpdate(playerId);

        // [结束判定逻辑]
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
        let shouldEndGame = false;
        
        if (isTeamMode) {
            // 组队模式：只剩一个队伍时结束
            const activeTeams = new Set();
            this.players.forEach(p => {
                if (this.gameState.hands[p.id] && this.gameState.hands[p.id].length > 0) {
                    if (p.team !== undefined && p.team !== null) activeTeams.add(p.team);
                }
            });
            if (activeTeams.size <= 1) shouldEndGame = true;
        } else {
            // 个人模式：只剩一人时结束
            let activeCount = 0;
            this.players.forEach(p => {
                if (this.gameState.hands[p.id] && this.gameState.hands[p.id].length > 0) activeCount++;
            });
            if (activeCount <= 1) shouldEndGame = true;
        }

        if (shouldEndGame) {
            const activeCount = this._getActivePlayerCount();
            
            // 情况A: 所有人都出完了
            if (activeCount === 0) {
                this.gameState.roundPoints[playerId] = (this.gameState.roundPoints[playerId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                this._clearTimer();
                const roundResult = this._concludeRound();
                return { success: true, isRoundOver: true, roundResult, cardsPlayed: cards, pendingPoints: 0, logText: logText + " - 游戏结束" };
            }

            // 情况B: 已经是“最后一手”阶段
            if (this.gameState.lastShotPhase) {
                this.gameState.roundPoints[playerId] = (this.gameState.roundPoints[playerId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;
                this._clearTimer();
                const roundResult = this._concludeRound();
                return { success: true, isRoundOver: true, roundResult, cardsPlayed: cards, pendingPoints: 0, logText: logText + " - 最后一手结束" };
            }
            
            // 情况C: 进入“最后一手”阶段
            this.gameState.lastShotPhase = true;
            this._advanceTurn();
            this._resetTimer();
            this.botManager.checkAndRun();
            return { success: true, isRoundOver: false, cardsPlayed: cards, pendingPoints: this.gameState.pendingTablePoints, logText: logText + " (最后一手)" };
        }

        this._advanceTurn();
        this._resetTimer();
        this.botManager.checkAndRun();

        return { success: true, isRoundOver: false, cardsPlayed: cards, pendingPoints: this.gameState.pendingTablePoints, logText };
    }

    passTurn(playerId) {
        if (this.disposed) return { success: false, error: '游戏已销毁' }; 
        if (!this.gameState) return { success: false, error: '游戏未开始' };
        
        // [Bug修复核心] 如果本局已结束，直接拦截请求，防止最后一手重复点击导致多次结算
        if (this.isRoundOverState) return { success: false, error: '本局已结束' };

        const currPlayer = this.players[this.gameState.currentTurnIndex];
        if (currPlayer.id !== playerId) return { success: false, error: '还没轮到你' };

        if (this.gameState.lastPlayedCards.length === 0) return { success: false, error: '必须出牌' };

        this.gameState.consecutivePasses++;
        this._advanceTurn();

        const activeCount = this._getActivePlayerCount();
        const winnerId = this.gameState.roundWinnerId;
        const winnerHand = this.gameState.hands[winnerId];
        const winnerIsActive = winnerHand && winnerHand.length > 0;
        
        const passesNeeded = winnerIsActive ? (activeCount - 1) : activeCount;
        
        let turnCleared = false;
        let infoMessage = `${currPlayer.name}: 不要`;

        // [一轮结束]
        if (this.gameState.consecutivePasses >= passesNeeded) {
            const wId = this.gameState.roundWinnerId;
            if (wId) {
                // 1. 结算桌面分数
                this.gameState.roundPoints[wId] = (this.gameState.roundPoints[wId] || 0) + this.gameState.pendingTablePoints;
                this.gameState.pendingTablePoints = 0;

                // 2. 接风逻辑
                if (this.gameState.hands[wId] && this.gameState.hands[wId].length > 0) {
                    const wIdx = this.players.findIndex(p => p.id === wId);
                    this.gameState.currentTurnIndex = wIdx;
                } else {
                    const winnerPlayer = this.players.find(p => p.id === wId);
                    if (!winnerPlayer) {
                        infoMessage = `${currPlayer.name}: 不要 (上家已离线)`;
                    } else {
                        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);
                        
                        if (isTeamMode && winnerPlayer.team !== undefined && winnerPlayer.team !== null) {
                            // [功能保护] 组队模式找队友逻辑 (完整保留)
                            const wIdx = this.players.findIndex(p => p.id === wId);
                            const pCount = this.players.length;
                            let foundTeammate = false;
                            
                            for (let i = 1; i < pCount; i++) {
                                const tIdx = (wIdx + i) % pCount;
                                const potentialTeammate = this.players[tIdx];
                                // 队友必须和赢家同队，且手里必须有牌
                                if (potentialTeammate.team === winnerPlayer.team && this.gameState.hands[potentialTeammate.id] && this.gameState.hands[potentialTeammate.id].length > 0) {
                                    this.gameState.currentTurnIndex = tIdx;
                                    infoMessage = `${currPlayer.name}: 不要 (队友接风)`;
                                    this._broadcastUpdate(`${winnerPlayer.name} 已逃出，队友 ${potentialTeammate.name} 接风`);
                                    foundTeammate = true;
                                    break;
                                }
                            }
                            if (!foundTeammate) this._advanceTurn();
                        } else {
                            // [功能保护] 个人模式找下家逻辑 (完整保留)
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
            }
            turnCleared = true;

            // Last Shot 检查
            if (this.gameState.lastShotPhase) {
                const roundResult = this._concludeRound();
                // 注意：_concludeRound 已经将 this.isRoundOverState 设为 true，
                // 任何后续的 passTurn 请求都会被顶部的 if check 拦截。
                return { success: true, isRoundOver: true, roundResult, turnCleared: true, logText: infoMessage + " - 无人接风，结束" };
            }

            this.gameState.lastPlayedCards = [];
            this.gameState.consecutivePasses = 0;
        }

        this._resetTimer();
        this.botManager.checkAndRun();

        return { success: true, turnCleared, logText: infoMessage };
    }

    _clearTimer() {
        if (this.timer) clearTimeout(this.timer);
        if (this.botManager) this.botManager.clearTimer();
        this.timer = null;
    }

    // [逻辑修改] 根据玩家状态设置不同的超时逻辑
    _resetTimer() {
        this._clearTimer();
        if (this.disposed) return; 

        if (this.gameState && this._getActivePlayerCount() > 0) {
            this.turnStartTime = Date.now();
            const currPlayer = this.players[this.gameState.currentTurnIndex];

            let timeLimit = this.config.turnTimeout || 60000;
            
            // 如果玩家掉线，仅给1.5秒缓冲，然后触发_handleTimeout进行自动Pass
            if (currPlayer.isOffline) {
                timeLimit = 1500; 
            } else if (currPlayer.isBot) {
                // Bot有自己的节奏，给个长超时兜底
                timeLimit = 60000; 
            }
            // 正常在线玩家使用 turnTimeout

            this.timer = setTimeout(() => {
                if (!this.disposed) this._handleTimeout();
            }, timeLimit);
        }
    }

    // [逻辑修改与功能保护] 
    // 1. 如果是离线玩家：自动不要/出最小牌 (不托管)
    // 2. 如果是在线玩家：超时 -> 自动托管 (恢复此功能)
    _handleTimeout() {
        if (this.disposed) return; 
        if (!this.gameState) return;
        const currIdx = this.gameState.currentTurnIndex;
        const currPlayer = this.players[currIdx];
        
        // [功能恢复] 如果是在线玩家超时，进入托管模式，然后让Bot接手
        if (!currPlayer.isBot && !currPlayer.isOffline && !currPlayer.isAutoPlay) {
            console.log(`[Game] Player ${currPlayer.name} timed out. Enabling AutoPlay.`);
            currPlayer.isAutoPlay = true; 
            this._broadcastUpdate(`${currPlayer.name} 超时，已开启自动托管`);
            // 立即触发Bot思考
            this.botManager.checkAndRun();
            return; 
        }

        // 以下情况进入消极处理逻辑：
        // 1. 玩家已经离线 (isOffline=true) -> 快速跳过，不托管
        // 2. 玩家已经是Bot (isBot=true) -> BotManager会处理，这里只是兜底
        // 3. 玩家已经在托管 (isAutoPlay=true) -> 同上
        
        const isNewRound = this.gameState.lastPlayedCards.length === 0;

        if (isNewRound) {
            // 必须出牌：只能出一张最小的牌推进游戏
            const hand = this.gameState.hands[currPlayer.id];
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
                this._notifyHandUpdate(currPlayer.id);
                const reason = currPlayer.isOffline ? '掉线自动出牌' : '托管出牌';
                const logText = result.logText || `${currPlayer.name} ${reason}`;
                this._broadcastUpdate(logText);
                if (result.isRoundOver) {
                    setTimeout(() => { if (!this.disposed) this._handleWin(result, currPlayer.id); }, 3000);
                }
            }
        } else {
            // 可选择不要：直接执行 pass
            const result = this.passTurn(currPlayer.id);
            if (result.success) {
                const reason = currPlayer.isOffline ? '掉线自动不要' : '托管不要';
                if (result.isRoundOver) {
                    this._broadcastUpdate(`${currPlayer.name}: ${reason}`);
                    setTimeout(() => { if (!this.disposed) this._handleWin(result, currPlayer.id); }, 3000);
                } else {
                    this._broadcastUpdate(`${currPlayer.name}: ${reason}`);
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
            (this.gameState.hands[this.players[nextIndex].id] || []).length === 0 &&
            attempts < playerCount
        );
        this.gameState.currentTurnIndex = nextIndex;
    }

    getPublicState() {
        if (this.disposed) return null; 
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
                isOffline: p.isOffline, // [新增] 前端可显示掉线图标
                team: p.team,
                autoPlayMode: p.autoPlayMode,
                isReady: this.readyPlayers.has(p.id)
            };
            handCounts[p.id] = this.gameState.hands[p.id] ? this.gameState.hands[p.id].length : 0;
        });

        const winnerObj = this.players.find(p => p.id === this.gameState.roundWinnerId);
        
        let remainingSeconds = 0;
        if (this.turnStartTime) {
            let timeLimit = this.config.turnTimeout || 60000;
            // 修正前端倒计时显示：如果是离线玩家，倒计时应该很短
            const currP = this.players[this.gameState.currentTurnIndex];
            if (currP && currP.isOffline) timeLimit = 1500;
            
            const elapsed = Date.now() - this.turnStartTime;
            remainingSeconds = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
        }

        return {
            turnIndex: this.gameState.currentTurnIndex,
            currentTurnId: this.players[this.gameState.currentTurnIndex].id,
            turnRemaining: this.isRoundOverState ? 0 : remainingSeconds, 
            lastPlayed: this.gameState.lastPlayedCards,
            lastPlayerName: winnerObj ? winnerObj.name : '',
            scores: currentScoresDisplay,
            roundPoints: roundPointsDisplay,
            pendingPoints: this.gameState.pendingTablePoints,
            finishedRank: this.gameState.finishedRank,
            playersInfo: playersInfo,
            handCounts: handCounts,
            isRoundOver: this.isRoundOverState,
            revealedHands: this.isRoundOverState ? this.gameState.hands : null
        };
    }

    // [功能保护] 健壮的重连逻辑，保留所有必要状态
    reconnectPlayer(oldId, newId) {
        if (this.disposed) return false;
        console.log(`[Game] Reconnecting ${oldId} -> ${newId}`);
        
        if (this.grandScores[oldId] !== undefined) {
            this.grandScores[newId] = this.grandScores[oldId];
            delete this.grandScores[oldId];
        }
        if (this.lastWinnerId === oldId) this.lastWinnerId = newId;
        
        if (this.readyPlayers.has(oldId)) {
            this.readyPlayers.delete(oldId);
            this.readyPlayers.add(newId);
        }

        let player = this.players.find(p => p.id === newId);
        if (!player) {
            player = this.players.find(p => p.id === oldId);
            if (player) player.id = newId;
        }
        if (player) {
            player.isAutoPlay = false; 
            player.isOffline = false; // [关键修复] 重连后标记为在线
        }

        // [功能保护] 确保游戏内状态无缝迁移
        if (this.gameState) {
            // 迁移手牌
            if (this.gameState.hands && this.gameState.hands[oldId]) {
                this.gameState.hands[newId] = this.gameState.hands[oldId];
                delete this.gameState.hands[oldId];
            } else if (this.gameState.hands) {
                this.gameState.hands[newId] = [];
            }
            // 迁移当前小局得分
            if (this.gameState.roundPoints[oldId] !== undefined) {
                this.gameState.roundPoints[newId] = this.gameState.roundPoints[oldId];
                delete this.gameState.roundPoints[oldId];
            }
            // 迁移出牌权记录
            if (this.gameState.roundWinnerId === oldId) this.gameState.roundWinnerId = newId;
            // 迁移排名
            const rankIdx = this.gameState.finishedRank.indexOf(oldId);
            if (rankIdx !== -1) {
                this.gameState.finishedRank[rankIdx] = newId;
            }
        }

        // 迁移历史战绩中的ID
        this.matchHistory.forEach(match => {
            if (match.scores[oldId] !== undefined) {
                match.scores[newId] = match.scores[oldId];
                delete match.scores[oldId];
            }
            if (match.winnerId === oldId) match.winnerId = newId;
        });

        // 立即重置计时器，让重连回来的玩家有完整的时间操作
        if (this.gameState && this.players[this.gameState.currentTurnIndex].id === newId) {
            this._resetTimer();
        }

        return true;
    }
    
    // [功能保护] 记录离线状态
    leavePlayer(playerId) {
        if (this.disposed) return;
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.isOffline = true;
            console.log(`[Game] Player ${player.name} left game.`);
            // 如果正好轮到该离线玩家，立即重置计时器（触发快速超时）
            if (this.gameState && this.players[this.gameState.currentTurnIndex].id === playerId) {
                this._resetTimer();
            }
        }
    }
    
    getHint(playerId) {
        if (this.disposed || !this.gameState) return [];
        const hand = this.gameState.hands[playerId];
        if (!hand) return [];
        // TODO: 预留复杂提示逻辑
        return [];
    }

    getSettlementData() {
        return this.lastSettlementData;
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
        // [Bug修复核心] 设置锁状态
        this.isRoundOverState = true;
        
        const fullRankIds = [...this.gameState.finishedRank];
        this.players.forEach(p => {
            if (!fullRankIds.includes(p.id)) fullRankIds.push(p.id);
        });

        const firstWinnerId = fullRankIds[0];
        this.lastWinnerId = firstWinnerId; 
        
        let logLines = [];
        let penaltyDetails = [];
        let currentRoundScores = {};
        this.players.forEach(p => {
            currentRoundScores[p.id] = (this.gameState.roundPoints[p.id] || 0);
        });
        
        const scoreBreakdown = {};
        this.players.forEach(p => {
            scoreBreakdown[p.id] = {
                id: p.id,
                name: p.name,
                team: p.team,
                tablePoints: this.gameState.roundPoints[p.id] || 0,
                handCount: (this.gameState.hands[p.id] || []).length,
                handScore: CardRules.calculateTotalScore(this.gameState.hands[p.id] || []),
                penalty: 0,
                final: 0,
                finishRank: fullRankIds.indexOf(p.id) + 1,
                remainingHand: this.gameState.hands[p.id] || [] 
            };
        });

        // 1. 计算手牌罚分 (Hand Penalty)
        let totalCardPenalty = 0;
        let penaltySources = [];
        this.players.forEach(p => {
            const h = this.gameState.hands[p.id] || [];
            const handPts = CardRules.calculateTotalScore(h);
            if (handPts > 0) {
                totalCardPenalty += handPts;
                penaltySources.push(`${p.name}(${handPts})`);
            }
        });

        if (firstWinnerId && totalCardPenalty > 0) {
            currentRoundScores[firstWinnerId] += totalCardPenalty;
            scoreBreakdown[firstWinnerId].penalty += totalCardPenalty;
            const winnerName = this.players.find(p=>p.id===firstWinnerId)?.name;
            logLines.push(`[手牌罚分] 输家剩余手牌分 (${penaltySources.join(', ')}) 共 ${totalCardPenalty} 分，归头游 ${winnerName}。`);
            penaltyDetails.push(`头游 ${winnerName} 收取手牌分 ${totalCardPenalty}`);
        }

        // 2. 计算排名赏罚 (Rank Penalty)
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
                        
                        if (winner && loser) {
                            if (winner.team !== null && winner.team !== undefined && winner.team === loser.team) {
                                logLines.push(`[🛡️队友保护] 第${winnerIndex+1}名(${winner.name}) 与 倒数第${index+1}名(${loser.name}) 是队友，${score}分 免罚！`);
                                penaltyDetails.push(`[队友保护] ${winner.name} 免收 ${loser.name} ${score} 分`);
                            } else {
                                currentRoundScores[winnerId] += score;
                                currentRoundScores[loserId] -= score;
                                scoreBreakdown[winnerId].penalty += score;
                                scoreBreakdown[loserId].penalty -= score;
                                logLines.push(`[排名赏罚] 第${winnerIndex+1}名 ${winner.name} 收取 倒数第${index+1}名 ${loser.name} ${score} 分。`);
                                penaltyDetails.push(`${loser.name} 排名进贡 ${winner.name} ${score} 分`);
                            }
                        }
                    }
                }
            });
        }

        // 更新大局总分
        this.players.forEach(p => {
            this.grandScores[p.id] += currentRoundScores[p.id];
            scoreBreakdown[p.id].final = currentRoundScores[p.id];
            
            if (this.gameState && this.gameState.roundPoints) {
                this.gameState.roundPoints[p.id] = 0;
            }
        });
        
        // 记录历史
        this.matchHistory.push({
            roundIndex: this.matchHistory.length + 1,
            scores: {...currentRoundScores},
            winnerId: firstWinnerId,
            details: penaltyDetails
        });
        
        const firstWinnerName = this.players.find(p => p.id === firstWinnerId)?.name || '未知';
        
        // 3. 判断是否整场比赛结束
        let isGrandOver = false;
        const targetScore = this.config.targetScore;
        const isTeamMode = this.config.isTeamMode && (this.players.length % 2 === 0);

        if (isTeamMode) {
            let redTotal = 0;
            let blueTotal = 0;
            this.players.forEach(p => {
                const s = this.grandScores[p.id] || 0;
                if (p.team === 0) redTotal += s;
                else if (p.team === 1) blueTotal += s;
            });
            if (redTotal >= targetScore || blueTotal >= targetScore) {
                isGrandOver = true;
            }
        } else {
            const maxScore = Math.max(...Object.values(this.grandScores));
            if (maxScore >= targetScore) {
                isGrandOver = true;
            }
        }

        const totalPointsEarned = currentRoundScores[firstWinnerId];

        return {
            roundWinnerName: firstWinnerName,
            pointsEarned: totalPointsEarned,
            detail: logLines.join('\n') || '完美结束，未设置额外罚分',
            grandScores: this.grandScores,
            isGrandOver,
            scoreBreakdown,
            remainingHands: this.gameState.hands 
        };
    }

    getPlayerHand(playerId) {
        if (!this.gameState || !this.gameState.hands) return [];
        return this.gameState.hands[playerId] || [];
    }
}

module.exports = GameManager;