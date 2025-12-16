// 大厅页 - 修复移动端溢出问题

import React from 'react';
import { Target, Layers, User, Play, Clock, Bot } from 'lucide-react';
import { styles } from '../styles.js'; // [修复] 增加 .js 后缀以确保解析正确

export const LobbyScreen = ({ roomId, roomConfig, players, mySocketId, handleStartGame, handleAddBot }) => (
    <div style={styles.container}>
      {/* [修改] 增加 mobile-layout-column 类名，并重构内部结构以支持 flex 滚动 */}
      <div style={styles.lobbyCard} className="mobile-layout-column">
          
          {/* [关键修复] 增加 width: '100%' 确保在任何 flex 布局下都能撑满宽度 */}
          <div className="mobile-lobby-content" style={{display:'flex', flexDirection:'column', height:'100%', width: '100%', overflow:'hidden', borderRadius: 20}}>
            
            {/* 头部：保持不变，固定在顶部 */}
            <div style={styles.lobbyHeader}>
                <h2 style={{margin:0, fontSize: 24}}>房间: <span style={{fontFamily:'monospace', color:'#27ae60'}}>{roomId}</span></h2>
                <div style={{display:'flex', gap:15}}>
                    <span style={styles.tag}><Target size={14}/> 目标 {roomConfig.targetScore}</span>
                    <span style={styles.tag}><Layers size={14}/> {roomConfig.deckCount}副牌</span>
                    <span style={styles.tag}><User size={14}/> {roomConfig.maxPlayers}人</span>
                </div>
            </div>

            {/* 中间：玩家列表 - [修改] 增加 mobile-lobby-grid 类名，支持滚动 */}
            <div style={styles.playerGrid} className="mobile-lobby-grid">
                {players.map((p,i)=>(
                    <div key={i} style={{...styles.lobbyPlayer, borderColor: p.id===mySocketId ? '#27ae60' : '#eee', background: p.id===mySocketId ? '#f0fbf4' : 'white'}}>
                        <div style={styles.avatarLarge}>
                            {p.isBot ? <Bot size={40} /> : p.name[0]}
                        </div>
                        <div style={{fontWeight: 'bold', display:'flex', alignItems:'center', gap:5}}>
                            {p.name}
                            {p.isBot && <span style={{fontSize:10, background:'#eee', padding:'2px 5px', borderRadius:4}}>AI</span>}
                        </div>
                        {p.isHost && <span style={styles.hostBadge}>房主</span>}
                    </div>
                ))}
                {Array.from({length: roomConfig.maxPlayers - players.length}).map((_, i) => (
                    <div key={`empty-${i}`} style={{...styles.lobbyPlayer, borderStyle: 'dashed', opacity: 0.5}}>
                        <div style={{...styles.avatarLarge, background:'#f0f0f0', color:'#ccc'}}>?</div>
                        <div style={{color:'#999'}}>等待加入</div>
                    </div>
                ))}
            </div>

            {/* 底部：按钮区 - [修改] 增加 mobile-lobby-footer 类名，固定在底部 */}
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