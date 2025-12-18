import React from 'react';
import { Trophy, Shield, Medal, ScrollText } from 'lucide-react';

export const ScoreTable = ({ 
    players, 
    matchHistory = [], 
    currentScores,     
    roomConfig,
    grandResult
}) => {
    const isTeamMode = roomConfig.isTeamMode && (players.length % 2 === 0);

    const sortedPlayers = [...players].sort((a, b) => {
        const scoreA = currentScores[a.id] || 0;
        const scoreB = currentScores[b.id] || 0;
        return scoreB - scoreA; 
    });

    let redTeamHistory = [];
    let blueTeamHistory = [];
    let redTotal = 0;
    let blueTotal = 0;

    if (isTeamMode) {
        matchHistory.forEach((match, idx) => {
            let r = 0, b = 0;
            players.forEach(p => {
                const s = match.scores[p.id] || 0;
                if (p.team === 0) r += s;
                else if (p.team === 1) b += s;
            });
            redTeamHistory[idx] = r;
            blueTeamHistory[idx] = b;
        });
        
        players.forEach(p => {
            const s = currentScores[p.id] || 0;
            if (p.team === 0) redTotal += s;
            else if (p.team === 1) blueTotal += s;
        });
    }

    // [新增] 定义列的最小宽度，防止在手机上被挤压
    const minColWidth = 50; 

    const renderHeader = () => (
        <div style={{display: 'flex', background: '#2c3e50', color: 'white', padding: '10px', borderRadius: '8px 8px 0 0', fontWeight: 'bold', fontSize: 13, minWidth: '100%'}}>
            <div style={{flex: 2, textAlign: 'left', paddingLeft: 10, minWidth: 80, position: 'sticky', left: 0, background: '#2c3e50', zIndex: 1}}>玩家/队伍</div>
            {matchHistory.map((_, i) => (
                <div key={i} style={{flex: 1, textAlign: 'center', minWidth: minColWidth}}>R{i + 1}</div>
            ))}
            <div style={{flex: 1.2, textAlign: 'center', color: '#f1c40f', minWidth: 60}}>总分</div>
            <div style={{flex: 0.8, textAlign: 'center', minWidth: 40}}>排名</div>
        </div>
    );

    const renderTeamRow = (teamIndex, totalScore, historyScores) => {
        const color = teamIndex === 0 ? '#e74c3c' : '#3498db';
        const bg = teamIndex === 0 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(52, 152, 219, 0.1)';
        const name = teamIndex === 0 ? '红队' : '蓝队';
        
        return (
            <div style={{display: 'flex', background: bg, padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems:'center', fontSize: 13, minWidth: '100%'}}>
                <div style={{flex: 2, textAlign: 'left', color: color, fontWeight: 'bold', display:'flex', alignItems:'center', gap:5, minWidth: 80, position: 'sticky', left: 0, background: teamIndex === 0 ? '#fceceb' : '#ebf5fb', zIndex: 1}}>
                    <Shield size={14} fill={color} /> {name}
                </div>
                {matchHistory.map((_, i) => (
                    <div key={i} style={{flex: 1, textAlign: 'center', color: historyScores[i] > 0 ? color : '#999', fontWeight:'bold', minWidth: minColWidth}}>
                        {historyScores[i] > 0 ? `+${historyScores[i]}` : historyScores[i]}
                    </div>
                ))}
                <div style={{flex: 1.2, textAlign: 'center', color: color, fontWeight: '900', fontSize: 14, minWidth: 60}}>{totalScore}</div>
                <div style={{flex: 0.8, minWidth: 40}}></div>
            </div>
        );
    };

    const renderPlayerRow = (player, rank) => {
        const score = currentScores[player.id] || 0;
        
        let rankIcon = null;
        if (rank === 1) rankIcon = <Trophy size={16} color="#f1c40f" fill="#f1c40f"/>;
        else if (rank === 2) rankIcon = <Medal size={16} color="#bdc3c7" fill="#bdc3c7"/>;
        else if (rank === 3) rankIcon = <Medal size={16} color="#e67e22" fill="#e67e22"/>;
        else rankIcon = <span style={{color:'#999', fontSize:12}}>{rank}</span>;

        return (
            <div key={player.id} style={{
                display: 'flex', 
                padding: '10px', 
                background: 'white', 
                borderBottom: '1px solid #eee',
                alignItems: 'center',
                fontSize: 13,
                minWidth: '100%'
            }}>
                {/* 玩家名字固定在左侧，方便横向滚动查看分数 */}
                <div style={{flex: 2, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, overflow:'hidden', minWidth: 80, position: 'sticky', left: 0, background: 'white', zIndex: 1, borderRight: '1px solid #f0f0f0'}}>
                    <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#ecf0f1', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold',
                        border: player.team !== undefined && player.team !== null ? `2px solid ${player.team===0?'#e74c3c':'#3498db'}` : 'none',
                        flexShrink: 0
                    }}>
                        {player.name[0]}
                    </div>
                    <span style={{fontWeight: 'bold', color: '#2c3e50', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                        {player.name}
                    </span>
                </div>

                {matchHistory.map((match, i) => {
                    const s = match.scores[player.id] || 0;
                    return (
                        <div key={i} style={{flex: 1, textAlign: 'center', color: s > 0 ? '#e67e22' : (s < 0 ? '#7f8c8d' : '#bdc3c7'), fontWeight: s!==0?'bold':'normal', minWidth: minColWidth}}>
                            {s > 0 ? `+${s}` : s}
                        </div>
                    );
                })}

                <div style={{flex: 1.2, textAlign: 'center', fontWeight: 'bold', color: score >= 0 ? '#27ae60' : '#c0392b', fontSize: 14, minWidth: 60}}>
                    {score}
                </div>

                <div style={{flex: 0.8, textAlign: 'center', display:'flex', justifyContent:'center', minWidth: 40}}>
                    {rankIcon}
                </div>
            </div>
        );
    };

    return (
        <div style={{width: '100%', display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd'}}>
            {/* [关键修改] 外层增加 overflowX: auto，实现横向滚动 */}
            <div style={{overflowX: 'auto', width: '100%'}}>
                {renderHeader()}
                
                {isTeamMode && renderTeamRow(0, redTotal, redTeamHistory)}
                {isTeamMode && renderTeamRow(1, blueTotal, blueTeamHistory)}
                
                {/* [关键修改] maxHeight 使用 min(300px, 40vh) 适配小屏幕 */}
                <div style={{maxHeight: 'min(300px, 40vh)', overflowY: 'auto'}}>
                    {sortedPlayers.map((p, i) => renderPlayerRow(p, i + 1))}
                </div>
            </div>

            <div style={{background: '#f8f9fa', padding: 10, borderTop: '1px solid #ddd'}}>
                <div style={{display:'flex', alignItems:'center', gap:5, fontSize: 12, color: '#7f8c8d', marginBottom: 5, fontWeight:'bold'}}>
                    <ScrollText size={12}/> 赏罚日志详情
                </div>
                {/* [关键修改] maxHeight 使用 min(100px, 15vh) */}
                <div style={{fontSize: 11, color: '#666', lineHeight: '1.6', maxHeight: 'min(100px, 15vh)', overflowY: 'auto', textAlign:'left'}}>
                    {matchHistory.length > 0 ? (
                        matchHistory.slice().reverse().map((match, i) => (
                            <div key={i} style={{marginBottom: 4}}>
                                <span style={{fontWeight:'bold', color:'#333'}}>R{matchHistory.length - i}: </span>
                                {match.details && match.details.length > 0 ? match.details.join('; ') : '无特殊赏罚'}
                            </div>
                        ))
                    ) : (
                        <div>暂无记录</div>
                    )}
                </div>
            </div>
        </div>
    );
};