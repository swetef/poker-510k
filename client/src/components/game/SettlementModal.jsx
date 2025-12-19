import React from 'react';
import { Crown, Coins } from 'lucide-react';
import css from './SettlementModal.module.css'; // 新 CSS
import { ScoreTable } from '../ScoreTable.jsx';
import { useGame } from '../../context/GameContext.jsx';

/**
 * [结算弹窗组件]
 */
export const SettlementModal = () => {
    const { 
        winner, roundResult, grandResult, players, playersInfo, roomConfig, 
        handleStartGame, handleNextRound, mySocketId 
    } = useGame();

    if (!winner && !roundResult && !grandResult) return null;

    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    const playersWithTeamInfo = players.map(p => ({
        ...p, team: (playersInfo[p.id] && playersInfo[p.id].team !== undefined) ? playersInfo[p.id].team : p.team
    }));

    return (
        <div className={css.modalOverlay}>
            <div className={css.modalContent}>
                {grandResult ? (
                    <div className={css.resultContainer}>
                        <Crown size={60} color="#e74c3c" style={{marginBottom: 10}} />
                        <h2 className={css.winnerTitle}>{grandResult.grandWinner} 夺冠!</h2>
                        
                        <div className={css.tableWrapper}>
                            <ScoreTable 
                                players={playersWithTeamInfo} 
                                matchHistory={grandResult.matchHistory} 
                                currentScores={grandResult.grandScores} 
                                roomConfig={roomConfig} 
                                grandResult={grandResult}
                            />
                        </div>
                        
                        <button className={css.primaryButton} onClick={handleStartGame}>重新开始</button>
                    </div>
                ) : roundResult ? (
                    <div className={css.resultContainer}>
                        <div className={css.titleRow}>
                            <Coins size={30} color="#f1c40f" />
                            <h2 className={css.roundTitle}>小局结算</h2>
                        </div>
                        
                        <div className={css.tableWrapper}>
                            <ScoreTable 
                                players={playersWithTeamInfo} 
                                matchHistory={roundResult.matchHistory} 
                                currentScores={roundResult.grandScores} 
                                roomConfig={roomConfig}
                            />
                        </div>
                        
                        {amIHost ? (
                            <button className={css.primaryButton} onClick={handleNextRound}>下一局</button>
                        ) : (
                            <div className={css.waitingText}>等待房主...</div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};