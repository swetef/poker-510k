import React from 'react';
import { Crown, Coins } from 'lucide-react';
import { styles } from '../../styles.js';
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
        <div style={styles.modalOverlay}>
            <div className="modal-content-wrapper" style={{
                ...styles.modalContent, width: '95%', maxWidth: 600, padding: 0, 
                background: 'white', overflowY: 'auto', overflowX: 'hidden'
            }}>
                {grandResult ? (
                    <div style={{padding: 20, width: '100%'}}>
                        <Crown size={60} color="#e74c3c" style={{marginBottom: 10}} />
                        <h2 style={{fontSize: 28, marginBottom: 5, color:'#2c3e50'}}>{grandResult.grandWinner} 夺冠!</h2>
                        <div style={{margin: '15px 0'}}>
                            <ScoreTable players={playersWithTeamInfo} matchHistory={grandResult.matchHistory} currentScores={grandResult.grandScores} roomConfig={roomConfig} grandResult={grandResult}/>
                        </div>
                        <button style={{...styles.primaryButton, fontSize: 16, height: 50}} onClick={handleStartGame}>重新开始</button>
                    </div>
                ) : roundResult ? (
                    <div style={{padding: 20, width: '100%'}}>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom: 15}}>
                            <Coins size={30} color="#f1c40f" />
                            <h2 style={{fontSize: 24, margin:0}}>小局结算</h2>
                        </div>
                        <div style={{margin: '10px 0'}}>
                            <ScoreTable players={playersWithTeamInfo} matchHistory={roundResult.matchHistory} currentScores={roundResult.grandScores} roomConfig={roomConfig}/>
                        </div>
                        {amIHost ? <button style={styles.primaryButton} onClick={handleNextRound}>下一局</button> : <div style={{color:'#999', marginTop:10}}>等待房主...</div>}
                    </div>
                ) : null}
            </div>
        </div>
    );
};