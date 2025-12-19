import React, { useState } from 'react';
import { Target, Layers, User, Play, Clock, Bot, Shield, ArrowUp, ArrowDown, Settings, X, Sparkles, Award } from 'lucide-react';
// [修改] 彻底移除 styles.js 引用
import css from './LobbyScreen.module.css'; 
import { useGame } from '../context/GameContext.jsx';
import { RoomSettingsForm } from '../components/game/RoomSettingsForm.jsx';

export const LobbyScreen = () => {
    const { 
        roomId, roomConfig, players, mySocketId, 
        handleStartGame, 
        handleAddBot,
        handleSwitchSeat,
        handleUpdateConfig,
        handleKickPlayer
    } = useGame();
    
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    const isTeamMode = roomConfig.isTeamMode && roomConfig.maxPlayers % 2 === 0;
    const [showSettings, setShowSettings] = useState(false);
    
    const handleConfigChange = (key, value) => {
        const newConfig = { ...roomConfig, [key]: value };
        handleUpdateConfig(newConfig);
    };

    const renderSettingsModal = () => (
        <div className={css.modalOverlay}>
            <div className={css.modalContent} style={{textAlign:'left'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20, borderBottom:'1px solid #eee', paddingBottom:10, width:'100%'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, fontSize:18, fontWeight:'bold', color:'#2c3e50'}}>
                        <Settings size={20}/> 房间规则设置
                    </div>
                    <button onClick={()=>setShowSettings(false)} style={{background:'none', border:'none', cursor:'pointer', padding:5}}>
                        <X size={20} color="#999"/>
                    </button>
                </div>

                <div style={{maxHeight: '60vh', overflowY:'auto', paddingRight: 5, width:'100%'}}>
                    <RoomSettingsForm 
                        config={roomConfig} 
                        onChange={handleConfigChange} 
                        readOnly={!amIHost} 
                    />
                </div>

                <div style={{marginTop: 20, textAlign:'center', width:'100%'}}>
                    <button className={css.primaryButton} style={{height: 50, fontSize: 16, marginTop:0}} onClick={() => setShowSettings(false)}>
                        完成设置
                    </button>
                </div>
            </div>
        </div>
    );

    return (
    // [修改] 使用 css.lobbyContainer
    <div className={css.lobbyContainer}>
      {showSettings && renderSettingsModal()}

      <div className={`${css.lobbyCard} mobile-layout-column`}>
          
          <div className="mobile-lobby-content" style={{display:'flex', flexDirection:'column', height:'100%', width: '100%', overflow:'hidden', borderRadius: 20}}>
            
            <div className={css.lobbyHeader}>
                <div style={{display:'flex', alignItems:'center', gap: 10, flexWrap: 'wrap'}}>
                    <h2 style={{margin:0, fontSize: 24}}>房间: <span style={{fontFamily:'monospace', color:'#27ae60'}}>{roomId}</span></h2>
                    
                    {roomConfig.shuffleStrategy === 'NO_SHUFFLE' && (
                        <span style={{
                            background: 'linear-gradient(to right, #f6d365 0%, #fda085 100%)', 
                            color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, 
                            display:'flex', alignItems:'center', gap:4, fontWeight: 'bold',
                            boxShadow: '0 2px 5px rgba(253, 160, 133, 0.4)'
                        }}>
                            <Sparkles size={12} fill="white"/> 不洗牌(爽局)
                        </span>
                    )}

                    {roomConfig.shuffleStrategy === 'SIMULATION' && (
                        <span style={{
                            background: 'linear-gradient(to right, #a18cd1 0%, #fbc2eb 100%)', 
                            color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, 
                            display:'flex', alignItems:'center', gap:4, fontWeight: 'bold',
                            boxShadow: '0 2px 5px rgba(161, 140, 209, 0.4)'
                        }}>
                            <Layers size={12} fill="white"/> 模拟叠牌
                        </span>
                    )}

                    {isTeamMode && (
                        <span style={{background:'#27ae60', color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, display:'flex', alignItems:'center', gap:4}}>
                            <Shield size={12}/> 组队模式
                        </span>
                    )}
                </div>
                
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <div style={{display:'flex', gap:10}} className="hide-on-mobile">
                        <span className={css.tag}><Target size={14}/> 目标 {roomConfig.targetScore}</span>
                        <span className={css.tag}><Layers size={14}/> {roomConfig.deckCount}副</span>
                        <span className={css.tag}><User size={14}/> {roomConfig.maxPlayers}人</span>
                    </div>

                    {amIHost && (
                        <button 
                            onClick={() => setShowSettings(true)}
                            style={{
                                background: '#f1f2f6', border: '1px solid #ccc', borderRadius: '50%', 
                                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.2s', color: '#2c3e50'
                            }}
                            title="修改房间规则"
                        >
                            <Settings size={20} />
                        </button>
                    )}
                </div>
            </div>
            
            <div style={{padding: '0 15px 10px 15px', display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'#666'}} className="mobile-only-tags">
                 <span className={css.tag}><Target size={12}/> {roomConfig.targetScore}</span>
                 <span className={css.tag}><Layers size={12}/> {roomConfig.deckCount}副</span>
                 <span className={css.tag}><User size={12}/> {roomConfig.maxPlayers}人</span>
                 {roomConfig.shuffleStrategy === 'NO_SHUFFLE' && <span className={css.tag} style={{background:'#fdf2e9', color:'#e67e22', border:'1px solid #e67e22'}}><Sparkles size={12}/> 不洗牌</span>}
                 {roomConfig.shuffleStrategy === 'SIMULATION' && <span className={css.tag} style={{background:'#f5eef8', color:'#9b59b6', border:'1px solid #9b59b6'}}><Layers size={12}/> 模拟叠牌</span>}
                 {roomConfig.enableRankPenalty && <span className={css.tag} style={{color:'#e67e22', background:'#fdf2e9'}}><Award size={12}/> 赏罚</span>}
            </div>
            <style>{`@media (min-width: 769px) { .mobile-only-tags { display: none !important; } }`}</style>

            <div className={`${css.playerGrid} mobile-lobby-grid`}>
                {players.map((p, i) => {
                    let teamColor = '#eee'; 
                    let teamBg = 'white';   
                    let teamName = null;
                    
                    if (isTeamMode) {
                        const isRedTeam = i % 2 === 0;
                        teamColor = isRedTeam ? '#e74c3c' : '#3498db';
                        teamBg = isRedTeam ? '#fdedec' : '#eaf2f8';
                        teamName = isRedTeam ? '红队' : '蓝队';
                    }

                    const isMe = p.id === mySocketId;
                    if (isMe && !isTeamMode) {
                        teamBg = '#f0fbf4';
                        teamColor = '#27ae60';
                    }
                    const borderWidth = isMe ? 3 : 2;

                    return (
                        <div key={p.id} className={css.lobbyPlayer} style={{
                            borderColor: isMe ? '#2ecc71' : teamColor, 
                            backgroundColor: teamBg,
                            borderWidth: borderWidth
                        }}>
                            {amIHost && !isMe && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const confirmKick = window.confirm(`确定要踢出 ${p.name} 吗？`);
                                        if (confirmKick) handleKickPlayer(p.id);
                                    }}
                                    className={css.kickButton}
                                    title="踢出玩家"
                                >
                                    <X size={14} color="white"/>
                                </button>
                            )}

                            {teamName && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, 
                                    background: teamColor, color: 'white', 
                                    fontSize: 10, padding: '2px 8px', 
                                    borderBottomRightRadius: 8, borderTopLeftRadius: 8
                                }}>
                                    {teamName}
                                </div>
                            )}

                            {amIHost && players.length > 1 && (
                                <div style={{
                                    position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                                    display:'flex', flexDirection:'column', gap:4
                                }}>
                                    {i > 0 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleSwitchSeat(i, i - 1); }}
                                            style={{
                                                padding:4, borderRadius:4, border:'1px solid #ccc', 
                                                background:'white', cursor:'pointer', lineHeight:0
                                            }}
                                            title="上移"
                                        >
                                            <ArrowUp size={14} color="#666"/>
                                        </button>
                                    )}
                                    {i < players.length - 1 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleSwitchSeat(i, i + 1); }}
                                            style={{
                                                padding:4, borderRadius:4, border:'1px solid #ccc', 
                                                background:'white', cursor:'pointer', lineHeight:0
                                            }}
                                            title="下移"
                                        >
                                            <ArrowDown size={14} color="#666"/>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className={css.avatarLarge}>
                                {p.isBot ? <Bot size={40} /> : p.name[0]}
                            </div>
                            <div style={{fontWeight: 'bold', display:'flex', alignItems:'center', gap:5}}>
                                {p.name}
                                {p.isBot && <span style={{fontSize:10, background:'#eee', padding:'2px 5px', borderRadius:4}}>AI</span>}
                            </div>
                            {p.isHost && <span className={css.hostBadge}>房主</span>}
                        </div>
                    );
                })}
                
                {Array.from({length: Math.max(0, roomConfig.maxPlayers - players.length)}).map((_, i) => (
                    <div key={`empty-${i}`} className={css.lobbyPlayer} style={{borderStyle: 'dashed', opacity: 0.5}}>
                        <div className={css.avatarLarge} style={{background:'#f0f0f0', color:'#ccc'}}>?</div>
                        <div style={{color:'#999'}}>等待加入</div>
                    </div>
                ))}
            </div>

            <div className={`${css.lobbyFooter} mobile-lobby-footer`}>
                {players.find(p=>p.id===mySocketId)?.isHost ? (
                    <div style={{display:'flex', gap: 15, justifyContent: 'center'}}>
                        <button 
                            className={css.primaryButton}
                            style={{background: '#7f8c8d', width:'auto', padding:'0 20px', fontSize: 16, marginTop:0}} 
                            onClick={handleAddBot}
                            disabled={players.length >= roomConfig.maxPlayers}
                        >
                            <Bot size={18} style={{marginRight:5}}/> +Bot
                        </button>

                        <button className={css.primaryButton} style={{width:'auto', padding:'0 30px', marginTop:0}} onClick={handleStartGame} disabled={players.length < 2}>
                            <Play size={18} style={{marginRight:5}}/> 开始对战
                        </button>
                    </div>
                ) : (
                    <div style={{color:'#999', fontSize: 14, display:'flex', alignItems:'center', gap:5}}><Clock size={16}/> 等待房主开始...</div>
                )}
            </div>
          </div>
      </div>
    </div>
    );
};