const BotLogic = require('./BotLogic');
const CardRules = require('./CardRules');

class BotManager {
    constructor(gameInstance) {
        this.game = gameInstance; // 持有 GameManager 的引用
        this.timer = null;
    }

    // 切换托管状态
    toggleAutoPlay(playerId) {
        const player = this.game.players.find(p => p.id === playerId);
        if (!player || player.isBot) return; 

        player.isAutoPlay = !player.isAutoPlay;
        
        // 如果当前正好轮到该玩家，且开启了托管，立即触发机器人逻辑
        if (this.game.gameState && 
            this.game.players[this.game.gameState.currentTurnIndex].id === playerId) {
            
            if (player.isAutoPlay) {
                this.checkAndRun();
            } else {
                this.clearTimer();
                // 恢复普通倒计时
                this.game._resetTimer();
            }
        }
    }

    // 清除机器人思考定时器
    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    // 检查当前玩家是否是机器人/托管，并执行逻辑
    checkAndRun() {
        // [Bug修复] 如果游戏已销毁，停止所有Bot逻辑
        if (!this.game || !this.game.gameState || this.game.disposed) return;
        
        this.clearTimer();

        // 仅当非最后一手阶段时，才检查 activePlayerCount <= 1 的跳过逻辑
        if (!this.game.gameState.lastShotPhase && 
            this.game._getActivePlayerCount() <= 1 && 
            this.game.gameState.lastPlayedCards.length === 0) {
            return;
        }

        const currPlayer = this.game.players[this.game.gameState.currentTurnIndex];
        const isAI = currPlayer.isBot || currPlayer.isAutoPlay;

        // 如果是 AI，设置思考时间
        if (isAI && this.game.gameState.hands[currPlayer.id].length > 0) {
            
            // [性能优化] 极速出牌模式
            // 将延迟压缩至 30ms。这几乎是人类感知的“瞬间”，
            // 但保留了微小的 Node.js 事件循环缓冲，防止高并发下 socket 写入阻塞。
            const delay = 30;

            this.timer = setTimeout(() => {
                this.executeTurn(currPlayer);
            }, delay);

        } else if (isAI && this.game.gameState.hands[currPlayer.id].length === 0 && this.game.gameState.lastShotPhase) {
            // [特殊] 如果是 AI 在最后一手阶段没牌了，直接过
             this._forcePass(currPlayer);
        }
    }

    // 执行机器人的回合
    executeTurn(botPlayer) {
        // [Bug修复] 再次检查游戏是否销毁
        if (!this.game || !this.game.gameState || this.game.disposed) return;
        
        // 双重检查：确保当前还是该机器人出牌（防止网络延迟导致的异步问题）
        if (this.game.players[this.game.gameState.currentTurnIndex].id !== botPlayer.id) return;

        try {
            const hand = this.game.gameState.hands[botPlayer.id];
            
            // 如果处于 lastShotPhase 且自己没牌，直接 Pass
            if (!hand || hand.length === 0) {
                 this._forcePass(botPlayer); 
                 return;
            }

            const isNewRound = this.game.gameState.lastPlayedCards.length === 0;
            const cardsToBeat = isNewRound ? [] : this.game.gameState.lastPlayedCards;

            // [性能敏感] 此处排序是必须的，decideMove 依赖有序输入
            const sortedHand = [...hand].sort((a,b) => CardRules.getPoint(a) - CardRules.getPoint(b));
            
            let cardsToPlay = null;

            // 构建策略上下文
            const strategyContext = {
                mode: botPlayer.autoPlayMode || 'SMART',
                pendingScore: this.game.gameState.pendingTablePoints || 0,
                isTeammate: false
            };

            // 判断上家是否为队友
            if (!isNewRound && this.game.gameState.roundWinnerId) {
                const lastWinner = this.game.players.find(p => p.id === this.game.gameState.roundWinnerId);
                if (lastWinner && botPlayer.team !== null && botPlayer.team !== undefined) {
                    if (lastWinner.team === botPlayer.team && lastWinner.id !== botPlayer.id) {
                        strategyContext.isTeammate = true;
                    }
                }
            }

            try {
                // [核心调用] 使用新的 decideMove
                cardsToPlay = BotLogic.decideMove(sortedHand, cardsToBeat, this.game.config.deckCount, strategyContext);
            } catch (err) {
                console.error("[Bot Error] Logic crashed:", err);
            }

            if (cardsToPlay) {
                // 调用 GameManager 的核心出牌方法
                const result = this.game.playCards(botPlayer.id, cardsToPlay);
                
                if (result.success) {
                    if (!botPlayer.isBot) {
                        this.game.io.to(botPlayer.id).emit('hand_update', this.game.gameState.hands[botPlayer.id]);
                    }

                    const analysis = CardRules.analyze(cardsToPlay, this.game.config.deckCount);
                    const desc = CardRules.getAnalysisText(analysis);
                    let logText = `${botPlayer.name}: ${desc}`;
                    if (result.logText && result.logText.includes('最后一手')) {
                        logText = result.logText;
                    } else if (analysis.type === 'BOMB_KING') {
                            logText += ` (+${this.game.config.deckCount * 100}分)`;
                    }
                    this.game._broadcastUpdate(logText);

                    if (result.isRoundOver) {
                        // [UI优化] 回合结束时给前端留3秒展示时间
                        setTimeout(() => {
                            if (!this.game.disposed) this.game._handleWin(result, botPlayer.id);
                        }, 3000);
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
            console.error(`[Bot Error] Critical Exception in executeTurn:`, error);
            this._forcePass(botPlayer);
        }
    }

    // [优化] 内部辅助：出一张最小的牌
    _playMinCard(botPlayer, sortedHand) {
        if (this.game.disposed) return;
        
        // [架构修正] 恢复调用 BotLogic，确保逻辑分层统一。
        const minCard = BotLogic.getFallbackMove(sortedHand);
        
        if (!minCard) {
             this._forcePass(botPlayer);
             return;
        }

        const result = this.game.playCards(botPlayer.id, minCard);
        if (result.success) {
            if (!botPlayer.isBot) this.game.io.to(botPlayer.id).emit('hand_update', this.game.gameState.hands[botPlayer.id]);
            
            const analysis = CardRules.analyze(minCard, this.game.config.deckCount);
            const desc = CardRules.getAnalysisText(analysis);
            this.game._broadcastUpdate(`${botPlayer.name}: ${desc} (系统)`);

            if (result.isRoundOver) {
                setTimeout(() => {
                    if (!this.game.disposed) this.game._handleWin(result, botPlayer.id);
                }, 3000);
            }
        } else {
             this._forcePass(botPlayer); 
        }
    }

    // 内部辅助：强制过牌
    _forcePass(botPlayer) {
        if (this.game.disposed) return;
        const result = this.game.passTurn(botPlayer.id);
        
        if (result.isRoundOver) {
             this.game._broadcastUpdate(`${botPlayer.name}: 不要`);
             setTimeout(() => {
                if (!this.game.disposed) this.game._handleWin(result, botPlayer.id); 
             }, 3000);
        } else if (result.success) {
            this.game._broadcastUpdate(`${botPlayer.name}: 不要`);
        } else {
            console.error("[Bot Critical] Failed to pass turn:", result.error);
            // 极罕见情况：无法过牌（例如已经是首出但没牌），强制推进
            this.game._advanceTurn();
            this.game._broadcastUpdate();
            this.game._resetTimer();
            // [Fix] 修正为 this.checkAndRun()，保持与原代码一致
            this.checkAndRun();
        }
    }
}

module.exports = BotManager;