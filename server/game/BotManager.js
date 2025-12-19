const BotLogic = require('./BotLogic');
const CardRules = require('./CardRules');

class BotManager {
    constructor(gameInstance) {
        this.game = gameInstance; // 持有 GameManager 的引用
        this.timer = null;
    }

    // ... (保留 toggleAutoPlay, clearTimer, checkAndRun, _playMinCard, _forcePass 等方法不变) ...
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
        if (!this.game.gameState) return;
        
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
            const delay = 1000 + Math.random() * 1000; // 1-2秒延迟
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
        if (!this.game.gameState) return;
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

            const sortedHand = [...hand].sort((a,b) => CardRules.getPoint(a) - CardRules.getPoint(b));
            
            let cardsToPlay = null;
            try {
                // 调用纯算法模块
                cardsToPlay = BotLogic.decideMove(sortedHand, cardsToBeat, this.game.config.deckCount);
            } catch (err) {
                console.error("[Bot Error] Logic crashed:", err);
            }

            if (cardsToPlay) {
                console.log(`[Bot/Auto] ${botPlayer.name} plays ${cardsToPlay.length} cards.`);
                // 调用 GameManager 的核心出牌方法
                const result = this.game.playCards(botPlayer.id, cardsToPlay);
                
                if (result.success) {
                    if (!botPlayer.isBot) {
                        this.game.io.to(botPlayer.id).emit('hand_update', this.game.gameState.hands[botPlayer.id]);
                    }

                    // [修改] 无论是否结束，先广播出牌信息，让前端更新 UI，避免游戏直接结束看不到最后一张牌
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
                        // [修改] 增加 3秒 延迟，确保前端展示出牌动画和停留效果
                        setTimeout(() => {
                            this.game._handleWin(result, botPlayer.id);
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

    // 内部辅助：出一张最小的牌
    _playMinCard(botPlayer, sortedHand) {
        const minCard = [sortedHand[0]];
        const result = this.game.playCards(botPlayer.id, minCard);
        if (result.success) {
            if (!botPlayer.isBot) this.game.io.to(botPlayer.id).emit('hand_update', this.game.gameState.hands[botPlayer.id]);
            
            const analysis = CardRules.analyze(minCard, this.game.config.deckCount);
            const desc = CardRules.getAnalysisText(analysis);
            // [修改] 先广播更新
            this.game._broadcastUpdate(`${botPlayer.name}: ${desc} (系统)`);

            if (result.isRoundOver) {
                // [修改] 增加 3秒 延迟
                setTimeout(() => {
                    this.game._handleWin(result, botPlayer.id);
                }, 3000);
            }
        } else {
             this._forcePass(botPlayer); 
        }
    }

    // 内部辅助：强制过牌
    _forcePass(botPlayer) {
        const result = this.game.passTurn(botPlayer.id);
        
        // [修改] 如果 pass 导致结束，也需要延迟
        if (result.isRoundOver) {
             this.game._broadcastUpdate(`${botPlayer.name}: 不要`);
             setTimeout(() => {
                this.game._handleWin(result, botPlayer.id); 
             }, 3000);
        } else if (result.success) {
            this.game._broadcastUpdate(`${botPlayer.name}: 不要`);
        } else {
            console.error("[Bot Critical] Failed to pass turn:", result.error);
            // 如果连 pass 都失败了，强制流转
            this.game._advanceTurn();
            this.game._broadcastUpdate();
            this.game._resetTimer();
            // 链式调用：继续检查下一个玩家
            this.checkAndRun();
        }
    }
}

module.exports = BotManager;