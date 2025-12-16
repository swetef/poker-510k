// 大厅页

import React from 'react';
import { Target, Layers, User, Play, Clock, Bot } from 'lucide-react';
import { styles } from '../styles';

export const LobbyScreen = ({ roomId, roomConfig, players, mySocketId, handleStartGame, handleAddBot }) => (
    <div style={styles.container}>
      <div style={styles.lobbyCard}>
          <div style={styles.lobbyHeader}>
              <h2 style={{margin:0, fontSize: 24}}>房间: <span style={{fontFamily:'monospace', color:'#27ae60'}}>{roomId}</span></h2>
              <div style={{display:'flex', gap:15}}>
                  <span style={styles.tag}><Target size={14}/> 目标 {roomConfig.targetScore}</span>
                  <span style={styles.tag}><Layers size={14}/> {roomConfig.deckCount}副牌</span>
                  <span style={styles.tag}><User size={14}/> {roomConfig.maxPlayers}人</span>
              </div>
          </div>
          <div style={styles.playerGrid}>
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
          <div style={styles.lobbyFooter}>
              {players.find(p=>p.id===mySocketId)?.isHost ? (
                  <div style={{display:'flex', gap: 15}}>
                      {/* [新增] 添加机器人按钮 */}
                      <button 
                          style={{...styles.primaryButton, background: '#7f8c8d', width:'auto', padding:'0 30px', fontSize: 16}} 
                          onClick={handleAddBot}
                          disabled={players.length >= roomConfig.maxPlayers}
                      >
                          <Bot size={18} style={{marginRight:5}}/> +Bot
                      </button>

                      <button style={{...styles.primaryButton, width:'auto', padding:'0 40px'}} onClick={handleStartGame} disabled={players.length < 2}>
                          <Play size={18} style={{marginRight:5}}/> 开始对战
                      </button>
                  </div>
              ) : (
                  <div style={{color:'#999', fontSize: 14, display:'flex', alignItems:'center', gap:5}}><Clock size={16}/> 等待房主开始...</div>
              )}
          </div>
      </div>
    </div>
);