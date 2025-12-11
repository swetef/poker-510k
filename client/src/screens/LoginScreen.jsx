// 登录页
import React from 'react';
import { User, Monitor, RefreshCw, Plus, LogIn } from 'lucide-react';
import { styles } from '../styles';

export const LoginScreen = ({ username, setUsername, roomId, setRoomId, roomConfig, setRoomConfig, isCreatorMode, setIsCreatorMode, handleRoomAction, isLoading }) => (
    <div style={styles.container}>
        <div style={styles.loginCard}>
           <div style={styles.loginLeft}>
               <div style={styles.logoArea}>510K</div>
               <h1 style={{color:'#2c3e50', fontSize: 28, margin:0}}>扑克对战</h1>
               <div style={{color:'#95a5a6', marginTop: 10}}>PC 模块化重构版 v8.0</div>
           </div>
           <div style={styles.loginRight}>
               <div style={styles.tabs}>
                   <button style={{...styles.tabBtn, borderBottom: !isCreatorMode ? '2px solid #27ae60' : '2px solid transparent', color: !isCreatorMode ? '#27ae60' : '#999'}} onClick={()=>setIsCreatorMode(false)}>加入房间</button>
                   <button style={{...styles.tabBtn, borderBottom: isCreatorMode ? '2px solid #27ae60' : '2px solid transparent', color: isCreatorMode ? '#27ae60' : '#999'}} onClick={()=>setIsCreatorMode(true)}>创建房间</button>
               </div>
               <div style={{marginTop: 20}}>
                   <div style={styles.inputGroup}><User size={18} color="#999"/><input style={styles.input} value={username} onChange={e=>setUsername(e.target.value)} placeholder="你的昵称"/></div>
                   <div style={styles.inputGroup}><Monitor size={18} color="#999"/><input style={styles.input} value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="房间号码"/></div>
               </div>
               {isCreatorMode && (
                   <div style={styles.configBox}>
                        <div style={styles.configRow}><span>人数: {roomConfig.maxPlayers}</span><input type="range" min="2" max="6" value={roomConfig.maxPlayers} onChange={e=>setRoomConfig({...roomConfig, maxPlayers:parseInt(e.target.value)})}/></div>
                        <div style={styles.configRow}><span>牌数: {roomConfig.deckCount}</span><input type="range" min="1" max="3" value={roomConfig.deckCount} onChange={e=>setRoomConfig({...roomConfig, deckCount:parseInt(e.target.value)})}/></div>
                        <div style={styles.configRow}><span>目标: {roomConfig.targetScore}</span><input type="range" min="500" max="2000" step="100" value={roomConfig.targetScore} onChange={e=>setRoomConfig({...roomConfig, targetScore:parseInt(e.target.value)})}/></div>
                   </div>
               )}
               <button style={{...styles.primaryButton, marginTop:30}} onClick={handleRoomAction} disabled={isLoading}>
                   {isLoading ? <RefreshCw className="spin" size={20}/> : (isCreatorMode ? <Plus size={20}/> : <LogIn size={20}/>)}
                   <span style={{marginLeft:10}}>{isCreatorMode ? "立即创建" : "进入房间"}</span>
               </button>
           </div>
        </div>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
);