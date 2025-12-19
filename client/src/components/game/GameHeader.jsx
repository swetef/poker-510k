import React, { useState } from 'react';
import { Zap, Minimize, Maximize, Layers, Shield, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react'; // [新增] Wifi 图标
import { styles } from '../../styles.js';
import { useGame } from '../../context/GameContext.jsx';

/**
 * [比分板组件] 红蓝队分数 (内部使用)
 */
const TeamScoreBoard = () => {
    const { players, playersInfo, playerScores, roomConfig } = useGame();
    const [isCollapsed, setIsCollapsed] = useState(true);

    let redScore = 0, blueScore = 0, hasTeams = false;
    players.forEach(p => {
        const pInfo = playersInfo[p.id];
        const score = playerScores[p.id] || 0;
        if (pInfo && pInfo.team !== undefined && pInfo.team !== null) {
            hasTeams = true;
            if (pInfo.team === 0) redScore += score;
            else if (pInfo.team === 1) blueScore += score;
        }
    });

    if (!hasTeams) return null;

    return (
        <div style={{ position: 'relative', marginRight: 10, zIndex: 50, pointerEvents: 'auto' }}>
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 20, 
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s'
                }}
            >
                <div style={{color:'#e74c3c', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, fontSize: 13}}>
                    <Shield size={12} fill="currentColor"/> {redScore}
                </div>
                <div style={{width:1, height:12, background:'rgba(255,255,255,0.2)'}}></div>
                <div style={{color:'#3498db', fontWeight:'bold', display:'flex', alignItems:'center', gap:3, fontSize: 13}}>
                    <Shield size={12} fill="currentColor"/> {blueScore}
                </div>
                {isCollapsed ? <ChevronDown size={14} color="#ccc"/> : <ChevronUp size={14} color="#ccc"/>}
            </div>

            {!isCollapsed && (
                <div style={{
                    position: 'absolute', top: '120%', right: 0, 
                    background: 'rgba(30, 40, 50, 0.95)', borderRadius: 8, padding: 10,
                    color: 'white', fontSize: 12, textAlign: 'center', width: 140,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)'
                }}>
                    <div style={{marginBottom: 5, color: '#f1c40f', fontWeight: 'bold'}}>当前比分详情</div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:2}}>
                        <span style={{color:'#e74c3c'}}>红队</span> <span>{redScore}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                        <span style={{color:'#3498db'}}>蓝队</span> <span>{blueScore}</span>
                    </div>
                    <div style={{height:1, background:'rgba(255,255,255,0.1)', marginBottom:6}}></div>
                    <div>目标分数: {roomConfig.targetScore}</div>
                </div>
            )}
        </div>
    );
};

/**
 * [Header组件] 包含房间信息、比分板、排序切换、全屏按钮
 */
export const GameHeader = () => {
    // [修改] 获取 ping 和 isConnected
    const { roomId, playersInfo, mySocketId, toggleSort, sortMode, handleToggleAutoPlay, ping, isConnected } = useGame();
    const [isFullScreen, setIsFullScreen] = useState(false);
    
    const myInfo = playersInfo[mySocketId] || {};
    const amIAutoPlay = myInfo.isAutoPlay;

    const toggleFullScreen = () => {
        const doc = window.document;
        const docEl = doc.documentElement;
        const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullScreen;
        const cancelFullScreen = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
            if (requestFullScreen) requestFullScreen.call(docEl).then(()=>setIsFullScreen(true)).catch(e=>console.log(e));
        } else {
            if (cancelFullScreen) cancelFullScreen.call(doc).then(()=>setIsFullScreen(false));
        }
    };

    // [新增] Ping 颜色逻辑
    const getPingColor = (p) => {
        if (!isConnected) return '#e74c3c'; // 断线红
        if (p < 100) return '#2ecc71'; // 流畅绿
        if (p < 200) return '#f1c40f'; // 良好黄
        return '#e74c3c'; // 延迟红
    };

    return (
        <div style={styles.tableHeader}>
            <div style={styles.roomBadgeContainer}>
                <div style={styles.roomBadge}>Room {roomId}</div>
                
                {/* [新增] 游戏内的 Ping 值显示 */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, 
                    fontSize: 10, padding: '2px 8px', borderRadius: 12,
                    background: 'rgba(0,0,0,0.3)', 
                    color: getPingColor(ping),
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontWeight: 'bold',
                    transition: 'color 0.5s'
                }}>
                    {isConnected ? <Wifi size={10}/> : <WifiOff size={10}/>}
                    {isConnected ? `${ping}ms` : '断线'}
                </div>

                <button 
                    style={{
                        pointerEvents: 'auto', background: amIAutoPlay ? '#e67e22' : 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.3)', color: '#ecf0f1', borderRadius: 15, 
                        padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 11, fontWeight: 'bold', transition: 'all 0.2s'
                    }}
                    onClick={handleToggleAutoPlay}
                >
                    <Zap size={12} style={{marginRight: 4}} fill={amIAutoPlay ? "currentColor" : "none"}/>
                    {amIAutoPlay ? '托管中' : '托管'}
                </button>
            </div>

            <div style={{display:'flex', alignItems: 'center', marginLeft: 'auto'}}>
                <TeamScoreBoard />
                <div style={{display:'flex', gap: 10}}>
                    <button style={{...styles.glassButton, padding: '8px 12px', pointerEvents: 'auto'}} onClick={toggleFullScreen}>
                        {isFullScreen ? <Minimize size={18}/> : <Maximize size={18}/>}
                    </button>
                    <button style={styles.sortButton} onClick={toggleSort}>
                        <Layers size={16} style={{marginRight:5}}/> 
                        {sortMode === 'POINT' ? '点数' : (sortMode === 'SUIT' ? '花色' : '理牌')}
                    </button>
                </div>
            </div>
        </div>
    );
};