import React, { useState } from 'react';
import { Zap, Minimize, Maximize, Layers, Shield, ChevronDown, ChevronUp, Wifi, WifiOff, LogOut } from 'lucide-react';
import css from './GameHeader.module.css'; // 新 CSS
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
        <div className={css.teamScoreContainer}>
            <div className={css.teamScoreBar} onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className={css.scoreItem} style={{color:'#e74c3c'}}>
                    <Shield size={12} fill="currentColor"/> {redScore}
                </div>
                <div className={css.divider}></div>
                <div className={css.scoreItem} style={{color:'#3498db'}}>
                    <Shield size={12} fill="currentColor"/> {blueScore}
                </div>
                {isCollapsed ? <ChevronDown size={14} color="#ccc"/> : <ChevronUp size={14} color="#ccc"/>}
            </div>

            {!isCollapsed && (
                <div className={css.scoreDropdown}>
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
 * [Header组件]
 */
export const GameHeader = () => {
    const { roomId, playersInfo, mySocketId, toggleSort, sortMode, handleToggleAutoPlay, ping, isConnected, handleLeaveRoom } = useGame();
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

    const getPingColor = (p) => {
        if (!isConnected) return '#e74c3c';
        if (p < 100) return '#2ecc71';
        if (p < 200) return '#f1c40f';
        return '#e74c3c';
    };

    // [修改] 增加理牌文案映射
    const getSortButtonText = () => {
        if (sortMode === 'POINT') return '点数';
        if (sortMode === 'ARRANGE') return '理牌(提)'; // 提=提取510K
        if (sortMode === 'ARRANGE_MERGED') return '理牌(合)'; // 合=融合510K
        return '未知';
    };

    return (
        <div className={css.header}>
            <div className={css.roomBadgeContainer}>
                {/* [新增] 退出按钮 */}
                <button 
                    className={css.iconBtn} 
                    onClick={handleLeaveRoom}
                    style={{padding: '4px 8px', border:'none', background:'transparent'}}
                    title="退出房间"
                >
                    <LogOut size={16} />
                </button>

                <div className={css.roomBadge}>Room {roomId}</div>
                
                <div className={css.pingBadge} style={{ color: getPingColor(ping) }}>
                    {isConnected ? <Wifi size={10}/> : <WifiOff size={10}/>}
                    {isConnected ? `${ping}ms` : '断线'}
                </div>

                <button 
                    className={amIAutoPlay ? css.autoPlayBtnActive : css.autoPlayBtn}
                    onClick={handleToggleAutoPlay}
                >
                    <Zap size={12} style={{marginRight: 4}} fill={amIAutoPlay ? "currentColor" : "none"}/>
                    {amIAutoPlay ? '托管中' : '托管'}
                </button>
            </div>

            <div className={css.rightSection}>
                <TeamScoreBoard />
                <div className={css.buttonGroup}>
                    <button className={css.iconBtn} onClick={toggleFullScreen}>
                        {isFullScreen ? <Minimize size={18}/> : <Maximize size={18}/>}
                    </button>
                    <button className={css.iconBtn} onClick={toggleSort}>
                        <Layers size={16} style={{marginRight:5}}/> 
                        {getSortButtonText()}
                    </button>
                </div>
            </div>
        </div>
    );
};