// 大厅页 - 支持房主换座 + 组队模式显示 + 修复移动端溢出

import React from 'react';
import { Target, Layers, User, Play, Clock, Bot, Shield, ArrowUp, ArrowDown } from 'lucide-react';
import { styles } from '../styles.js';

export const LobbyScreen = ({ roomId, roomConfig, players, mySocketId, handleStartGame, handleAddBot, handleSwitchSeat }) => {
    
    // 判断自己是不是房主
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    
    // 判断是否开启了组队模式 (开关开启 且 人数是偶数)
    const isTeamMode = roomConfig.isTeamMode && roomConfig.maxPlayers % 2 === 0;

    return (
    <div style={styles.container}>
      <div style={styles.lobbyCard} className="mobile-layout-column">
          
          <div className="mobile-lobby-content" style={{display:'flex', flexDirection:'column', height:'100%', width: '100%', overflow:'hidden', borderRadius: 20}}>
            
            {/* 头部信息 */}
            <div style={styles.lobbyHeader}>
                <div style={{display:'flex', alignItems:'center', gap: 10}}>
                    <h2 style={{margin:0, fontSize: 24}}>房间: <span style={{fontFamily:'monospace', color:'#27ae60'}}>{roomId}</span></h2>
                    {/* [新增] 组队模式标签 */}
                    {isTeamMode && (
                        <span style={{background:'#27ae60', color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, display:'flex', alignItems:'center', gap:4}}>
                            <Shield size={12}/> 组队模式
                        </span>
                    )}
                </div>
                <div style={{display:'flex', gap:15}}>
                    <span style={styles.tag}><Target size={14}/> 目标 {roomConfig.targetScore}</span>
                    <span style={styles.tag}><Layers size={14}/> {roomConfig.deckCount}副</span>
                    <span style={styles.tag}><User size={14}/> {roomConfig.maxPlayers}人</span>
                </div>
            </div>

            {/* 玩家列表区域 */}
            <div style={styles.playerGrid} className="mobile-lobby-grid">
                {players.map((p, i) => {
                    // --- [新增] 组队模式视觉逻辑 ---
                    let teamColor = '#eee'; // 默认边框
                    let teamBg = 'white';   // 默认背景
                    let teamName = null;
                    
                    if (isTeamMode) {
                        const isRedTeam = i % 2 === 0; // 0, 2, 4... 红队
                        teamColor = isRedTeam ? '#e74c3c' : '#3498db';
                        teamBg = isRedTeam ? '#fdedec' : '#eaf2f8';
                        teamName = isRedTeam ? '红队' : '蓝队';
                    }

                    // 自己的高亮处理 (在组队模式下叠加，普通模式下单独显示)
                    const isMe = p.id === mySocketId;
                    if (isMe && !isTeamMode) {
                        teamBg = '#f0fbf4';
                        teamColor = '#27ae60';
                    }
                    const borderWidth = isMe ? 3 : 2;

                    return (
                        <div key={p.id} style={{
                            ...styles.lobbyPlayer, 
                            borderColor: isMe ? '#2ecc71' : teamColor, 
                            background: teamBg,
                            borderWidth: borderWidth,
                            position: 'relative'
                        }}>
                            {/* [新增] 组队角标 */}
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

                            {/* --- [新增] 房主调位按钮 (所有模式通用) --- */}
                            {amIHost && players.length > 1 && (
                                <div style={{
                                    position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                                    display:'flex', flexDirection:'column', gap:4
                                }}>
                                    {/* 上移按钮 (非第一位显示) */}
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
                                    {/* 下移按钮 (非最后一位显示) */}
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

                            <div style={styles.avatarLarge}>
                                {p.isBot ? <Bot size={40} /> : p.name[0]}
                            </div>
                            <div style={{fontWeight: 'bold', display:'flex', alignItems:'center', gap:5}}>
                                {p.name}
                                {p.isBot && <span style={{fontSize:10, background:'#eee', padding:'2px 5px', borderRadius:4}}>AI</span>}
                            </div>
                            {p.isHost && <span style={styles.hostBadge}>房主</span>}
                        </div>
                    );
                })}
                
                {/* 虚拟空位 */}
                {Array.from({length: roomConfig.maxPlayers - players.length}).map((_, i) => (
                    <div key={`empty-${i}`} style={{...styles.lobbyPlayer, borderStyle: 'dashed', opacity: 0.5}}>
                        <div style={{...styles.avatarLarge, background:'#f0f0f0', color:'#ccc'}}>?</div>
                        <div style={{color:'#999'}}>等待加入</div>
                    </div>
                ))}
            </div>

            {/* 底部按钮 */}
            <div style={styles.lobbyFooter} className="mobile-lobby-footer">
                {players.find(p=>p.id===mySocketId)?.isHost ? (
                    <div style={{display:'flex', gap: 15, justifyContent: 'center'}}>
                        <button 
                            style={{...styles.primaryButton, background: '#7f8c8d', width:'auto', padding:'0 20px', fontSize: 16, marginTop:0}} 
                            onClick={handleAddBot}
                            disabled={players.length >= roomConfig.maxPlayers}
                        >
                            <Bot size={18} style={{marginRight:5}}/> +Bot
                        </button>

                        <button style={{...styles.primaryButton, width:'auto', padding:'0 30px', marginTop:0}} onClick={handleStartGame} disabled={players.length < 2}>
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