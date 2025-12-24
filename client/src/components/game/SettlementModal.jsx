import React, { useState, useEffect } from 'react';
import { Crown, Coins, List, History, X } from 'lucide-react';
import css from './SettlementModal.module.css';
import { ScoreTable } from '../ScoreTable.jsx';
import { useGame } from '../../context/GameContext.jsx';

const RoundDetailTable = ({ scoreBreakdown, players }) => {
    if (!scoreBreakdown) return <div style={{padding:20}}>暂无详情数据</div>;

    const rows = Object.values(scoreBreakdown).sort((a, b) => b.final - a.final);

    return (
        <div className={css.detailTableContainer}>
            <div className={css.detailHeaderRow}>
                <div style={{flex:0.8}}>走位</div>
                <div style={{flex:2, textAlign:'left'}}>玩家</div>
                <div style={{flex:1.2}}>抓分</div>
                <div style={{flex:2}}>奖罚(剩牌)</div>
                <div style={{flex:1.2, color:'#f1c40f'}}>得分</div>
                <div style={{flex:0.8}}>排名</div>
            </div>
            
            <div className={css.detailBody}>
                {rows.map((row, index) => {
                    const isWin = row.final > 0;
                    const isLose = row.final < 0;
                    const scoreColor = isWin ? '#e74c3c' : (isLose ? '#2ecc71' : '#ccc');
                    
                    const penaltyText = row.penalty > 0 ? `+${row.penalty}` : row.penalty;
                    const handText = row.handScore > 0 ? `剩${row.handScore}` : '剩0';
                    
                    return (
                        <div key={row.id} className={css.detailRow}>
                            <div style={{flex:0.8, color:'#999', fontSize:12}}>
                                {row.finishRank}
                            </div>
                            <div style={{flex:2, textAlign:'left', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                {row.team !== undefined && row.team !== null && (
                                    <span style={{color: row.team===0?'#e74c3c':'#3498db', marginRight:4}}>
                                        {row.team===0?'[红]':'[蓝]'}
                                    </span>
                                )}
                                {row.name}
                            </div>
                            <div style={{flex:1.2, fontWeight:'bold'}}>{row.tablePoints}</div>
                            <div style={{flex:2, fontSize:12, color:'#7f8c8d'}}>
                                <span style={{color: row.penalty!==0 ? (row.penalty>0?'#e67e22':'#2ecc71') : '#999', fontWeight:'bold'}}>
                                    {penaltyText}
                                </span>
                                <span style={{marginLeft:4, opacity:0.8}}>({handText})</span>
                            </div>
                            <div style={{flex:1.2, fontWeight:'900', color: scoreColor, fontSize:16}}>
                                {row.final > 0 ? `+${row.final}` : row.final}
                            </div>
                            <div style={{flex:0.8, fontSize:12, fontWeight:'bold', color:'#ccc'}}>
                                {index + 1}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// [修改] 接收 isOpen, onClose
export const SettlementModal = ({ isOpen, onClose }) => {
    const { 
        winner, roundResult, grandResult, players, playersInfo, roomConfig, 
        handleStartGame, handleNextRound, mySocketId,
        roundOverData // [新增]
    } = useGame();

    const [activeTab, setActiveTab] = useState('round');

    // 优先使用 roundOverData
    const data = roundOverData || grandResult || roundResult;
    
    // 如果没有数据，或者 isOpen 为 false，则不显示
    if (!isOpen || !data) return null;

    const playersWithTeamInfo = players.map(p => ({
        ...p, team: (playersInfo[p.id] && playersInfo[p.id].team !== undefined) ? playersInfo[p.id].team : p.team
    }));
    
    // 如果是大局结算，强制显示为大局
    const isGrandOver = data.isGrandOver;

    return (
        <div className={css.modalOverlay}>
            <div className={css.modalContent}>
                
                {/* [新增] 关闭按钮 */}
                {!isGrandOver && (
                    <button 
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: 15, right: 15,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#999', padding: 5, zIndex: 10
                        }}
                    >
                        <X size={24} />
                    </button>
                )}

                <div className={css.headerSection}>
                    {isGrandOver ? (
                        <>
                            <Crown size={40} color="#e74c3c" />
                            <h2 className={css.title}>{data.grandWinner} 夺冠!</h2>
                        </>
                    ) : (
                        <>
                            <Coins size={32} color="#f1c40f" />
                            <h2 className={css.title}>小局结算</h2>
                        </>
                    )}
                </div>

                <div className={css.tabContainer}>
                    <button 
                        className={activeTab === 'round' ? css.tabActive : css.tab}
                        onClick={() => setActiveTab('round')}
                    >
                        <List size={14}/> 本局详情
                    </button>
                    <button 
                        className={activeTab === 'grand' ? css.tabActive : css.tab}
                        onClick={() => setActiveTab('grand')}
                    >
                        <History size={14}/> 总战绩表
                    </button>
                </div>

                <div className={css.contentBody}>
                    {activeTab === 'round' ? (
                        <div className={css.tabContent}>
                            {data.scoreBreakdown ? (
                                <RoundDetailTable 
                                    scoreBreakdown={data.scoreBreakdown} 
                                    players={playersWithTeamInfo}
                                />
                            ) : (
                                <div style={{padding:20, color:'#999'}}>服务端未返回详情数据</div>
                            )}
                            
                            <div className={css.logBox}>
                                <div style={{fontWeight:'bold', marginBottom:5, fontSize:12, color:'#ccc'}}>结算日志:</div>
                                {data.detail}
                            </div>
                        </div>
                    ) : (
                        <div className={css.tabContent}>
                            <ScoreTable 
                                players={playersWithTeamInfo} 
                                matchHistory={data.matchHistory} 
                                currentScores={data.grandScores} 
                                roomConfig={roomConfig} 
                            />
                        </div>
                    )}
                </div>

                <div className={css.footerSection}>
                    {isGrandOver ? (
                        <button className={css.primaryButton} onClick={handleStartGame}>重新开始</button>
                    ) : (
                        // 小局结束，只提供关闭功能，准备在外面点
                        <button className={css.primaryButton} onClick={onClose} style={{background: '#95a5a6'}}>
                            返回桌面 (准备下一局)
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};