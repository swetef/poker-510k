import React, { useState } from 'react';
import { Crown, Coins, List, History } from 'lucide-react';
import css from './SettlementModal.module.css';
import { ScoreTable } from '../ScoreTable.jsx';
import { useGame } from '../../context/GameContext.jsx';

/**
 * [本局详情表格]
 * 展示：排名、玩家、场内抓分、奖罚(含剩牌)、本局总分
 */
const RoundDetailTable = ({ scoreBreakdown, players }) => {
    if (!scoreBreakdown) return <div style={{padding:20}}>暂无详情数据</div>;

    // 将对象转为数组并按得分排名（或按结束排名？）
    // 需求说：还有一栏是“这一局总得分的排名”
    // 我们这里默认按“本局总分”降序排列
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
                    
                    // 格式化奖罚栏：例如 "+50 (剩0)" 或 "-30 (剩25)"
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

/**
 * [结算弹窗组件]
 */
export const SettlementModal = () => {
    const { 
        winner, roundResult, grandResult, players, playersInfo, roomConfig, 
        handleStartGame, handleNextRound, mySocketId 
    } = useGame();

    // 默认显示 'round' (本局详情), 也可以切到 'grand' (总战绩)
    const [activeTab, setActiveTab] = useState('round');

    if (!winner && !roundResult && !grandResult) return null;

    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    
    // 如果是终局结算 (Grand Over)，默认可能想看总表，这里还是按需求默认给 Round
    // 或者你可以根据 grandResult 是否存在来决定默认 Tab
    const data = grandResult || roundResult;
    if (!data) return null;

    const playersWithTeamInfo = players.map(p => ({
        ...p, team: (playersInfo[p.id] && playersInfo[p.id].team !== undefined) ? playersInfo[p.id].team : p.team
    }));

    return (
        <div className={css.modalOverlay}>
            <div className={css.modalContent}>
                
                {/* 顶部标题区 */}
                <div className={css.headerSection}>
                    {grandResult ? (
                        <>
                            <Crown size={40} color="#e74c3c" />
                            <h2 className={css.title}>{grandResult.grandWinner} 夺冠!</h2>
                        </>
                    ) : (
                        <>
                            <Coins size={32} color="#f1c40f" />
                            <h2 className={css.title}>小局结算</h2>
                        </>
                    )}
                </div>

                {/* Tab 切换区 */}
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

                {/* 内容展示区 */}
                <div className={css.contentBody}>
                    {activeTab === 'round' ? (
                        <div className={css.tabContent}>
                            {/* 如果有 scoreBreakdown 就显示新表格，否则(旧版兼容)显示提示 */}
                            {data.scoreBreakdown ? (
                                <RoundDetailTable 
                                    scoreBreakdown={data.scoreBreakdown} 
                                    players={playersWithTeamInfo}
                                />
                            ) : (
                                <div style={{padding:20, color:'#999'}}>服务端未返回详情数据</div>
                            )}
                            
                            {/* 下方保留简略日志，方便查阅 */}
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

                {/* 底部按钮区 */}
                <div className={css.footerSection}>
                    {grandResult ? (
                        <button className={css.primaryButton} onClick={handleStartGame}>重新开始</button>
                    ) : (
                        amIHost ? (
                            <button className={css.primaryButton} onClick={handleNextRound}>下一局</button>
                        ) : (
                            <div className={css.waitingText}>等待房主...</div>
                        )
                    )}
                </div>

            </div>
        </div>
    );
};