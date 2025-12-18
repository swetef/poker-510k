// 登录页 - 适配移动端，包含自动全屏逻辑 + 手动全屏按钮 + 剩余牌数配置 + 组队开关 (移除抽卡开关，改为默认)
import React, { useState } from 'react'; 
import { User, Monitor, RefreshCw, Plus, LogIn, Clock, Layers, Users, Target, Wifi, WifiOff, Award, Maximize, Minimize, Eye, Shield } from 'lucide-react'; 
import { styles } from '../styles.js';
// [新增] 引入 useGame
import { useGame } from '../context/GameContext.jsx';

// [修改] 移除 Props 参数
export const LoginScreen = () => {
    
    // [新增] 从 Context 获取数据
    const { 
        username, setUsername, 
        roomId, setRoomId, 
        roomConfig, setRoomConfig, 
        isCreatorMode, setIsCreatorMode, 
        handleRoomAction, 
        isLoading,
        isConnected 
    } = useGame();

    // 全屏状态管理
    const [isFullScreen, setIsFullScreen] = useState(false);

    // 手动切换全屏
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            const docEl = document.documentElement;
            const requestFull = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (requestFull) {
                requestFull.call(docEl)
                    .then(() => setIsFullScreen(true))
                    .catch(err => console.log("全屏请求被拦截:", err));
            }
        } else {
            const exitFull = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exitFull) {
                exitFull.call(document)
                    .then(() => setIsFullScreen(false));
            }
        }
    };

    // 尝试请求全屏的辅助函数
    const tryEnterFullScreen = () => {
        try {
            if (!document.fullscreenElement) {
                const docEl = document.documentElement;
                const requestFull = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
                
                if (requestFull) {
                    requestFull.call(docEl)
                        .then(() => setIsFullScreen(true))
                        .catch(err => console.log("全屏自动触发被拦截 (正常):", err));
                }
            }
        } catch (e) {
            console.log("全屏错误:", e);
        }
    };

    const onActionClick = () => {
        tryEnterFullScreen(); 
        handleRoomAction();   
    };

    const renderConfigSlider = (icon, label, value, min, max, step, onChange, suffix = '') => (
        <div style={styles.configItem}>
            <div style={styles.configLabel}>
                <span style={{display:'flex', alignItems:'center', gap:6}}>{icon} {label}</span>
                <span style={styles.configValue}>{value}{suffix}</span>
            </div>
            <input 
                type="range" 
                style={styles.rangeInput}
                min={min} 
                max={max} 
                step={step || 1}
                value={value} 
                onChange={(e) => onChange(parseInt(e.target.value))}
            />
        </div>
    );

    return (
        <div style={styles.container}>
            <div style={styles.loginCard} className="mobile-layout-column">
                {/* 左侧：品牌展示区 */}
                <div style={styles.loginLeft} className="mobile-login-left">
                    <div style={styles.logoCircle}>
                        <div style={styles.logoText}>510K</div>
                    </div>
                    <h1 style={styles.brandTitle}>扑克对战</h1>
                    <div style={styles.brandSubtitle}>多人在线 · 自由规则 · 极速畅玩</div>
                    
                    <div style={styles.featureList} className="hide-on-mobile">
                        <div style={styles.featureItem}>✨ 支持 2-12 人同台竞技</div>
                        <div style={styles.featureItem}>🚀 只有 1 副牌? 不，现在支持 8 副!</div>
                        <div style={styles.featureItem}>⏱️ 自定义思考时间与获胜目标</div>
                    </div>
                </div>

                {/* 右侧：操作区 */}
                <div style={styles.loginRight} className="mobile-login-right">
                    {/* 顶部状态栏 */}
                    <div style={{
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        <button 
                            onClick={toggleFullScreen}
                            style={{
                                background: '#f8f9fa', border: '1px solid #e1e4e8', borderRadius: 20, padding: '6px 12px',
                                cursor: 'pointer', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 12, fontWeight: 'bold', transition: 'all 0.2s'
                            }}
                        >
                            {isFullScreen ? <Minimize size={14}/> : <Maximize size={14}/>}
                            <span>{isFullScreen ? '退出全屏' : '全屏模式'}</span>
                        </button>

                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px', borderRadius: 20,
                            background: isConnected ? '#eafaf1' : '#fdedec', color: isConnected ? '#27ae60' : '#e74c3c',
                            fontWeight: 'bold', border: `1px solid ${isConnected ? '#abebc6' : '#fadbd8'}`
                        }}>
                            {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
                            {isConnected ? '已连接' : '连接中...'}
                        </div>
                    </div>

                    {/* 顶部 Tab 切换 */}
                    <div style={styles.tabs}>
                        <button style={!isCreatorMode ? styles.tabBtnActive : styles.tabBtn} onClick={()=>setIsCreatorMode(false)}>加入房间</button>
                        <button style={isCreatorMode ? styles.tabBtnActive : styles.tabBtn} onClick={()=>setIsCreatorMode(true)}>创建房间</button>
                    </div>

                    <div style={styles.formContent}>
                        <div style={styles.inputGroup}>
                            <User size={18} color="#7f8c8d" />
                            <input style={styles.input} value={username} onChange={e=>setUsername(e.target.value)} placeholder="请输入你的昵称" maxLength={10}/>
                        </div>
                        <div style={styles.inputGroup}>
                            <Monitor size={18} color="#7f8c8d" />
                            <input style={styles.input} value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="请输入房间号 (如: 888)" maxLength={6}/>
                        </div>

                        {/* 创建模式下的高级配置区 */}
                        {isCreatorMode && (
                            <div style={styles.advancedConfigPanel}>
                                <div style={styles.configGrid}>
                                    {renderConfigSlider(<Users size={14}/>, "玩家人数", roomConfig.maxPlayers, 2, 12, 1, v=>setRoomConfig({...roomConfig, maxPlayers:v}), '人')}
                                    {renderConfigSlider(<Layers size={14}/>, "牌库数量", roomConfig.deckCount, 1, 8, 1, v=>setRoomConfig({...roomConfig, deckCount:v}), '副')}
                                    {renderConfigSlider(<Target size={14}/>, "获胜目标", roomConfig.targetScore, 500, 5000, 500, v=>setRoomConfig({...roomConfig, targetScore:v}), '分')}
                                    
                                    {/* 组队对抗开关 */}
                                    <div style={{...styles.configItem, marginTop: 10, padding: '10px', background: roomConfig.maxPlayers % 2 !== 0 ? '#f0f0f0' : '#e8f8f5', borderRadius: 8, opacity: roomConfig.maxPlayers % 2 !== 0 ? 0.6 : 1, gridColumn: '1 / -1'}}>
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                            <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:'600', color: roomConfig.maxPlayers % 2 !== 0 ? '#999' : '#27ae60'}}>
                                                <Shield size={16} /> 组队对抗模式 (2v2, 3v3...)
                                            </div>
                                            <label style={{position:'relative', display:'inline-block', width:40, height:20}}>
                                                <input 
                                                    type="checkbox" 
                                                    style={{opacity:0, width:0, height:0}}
                                                    checked={roomConfig.isTeamMode && roomConfig.maxPlayers % 2 === 0}
                                                    disabled={roomConfig.maxPlayers % 2 !== 0}
                                                    onChange={(e) => setRoomConfig({...roomConfig, isTeamMode: e.target.checked})}
                                                />
                                                <span style={{
                                                    position:'absolute', cursor: roomConfig.maxPlayers % 2 !== 0 ? 'not-allowed' : 'pointer', top:0, left:0, right:0, bottom:0, 
                                                    backgroundColor: (roomConfig.isTeamMode && roomConfig.maxPlayers % 2 === 0) ? '#27ae60' : '#ccc', 
                                                    transition:'.4s', borderRadius: 20
                                                }}>
                                                    <span style={{
                                                        position:'absolute', content:"", height:16, width:16, left:2, bottom:2, 
                                                        backgroundColor:'white', transition:'.4s', borderRadius:'50%',
                                                        transform: (roomConfig.isTeamMode && roomConfig.maxPlayers % 2 === 0) ? 'translateX(20px)' : 'translateX(0)'
                                                    }}></span>
                                                </span>
                                            </label>
                                        </div>
                                        <div style={{fontSize: 11, color: '#7f8c8d', marginTop: 4}}>
                                            {roomConfig.maxPlayers % 2 !== 0 ? "⚠️ 需要偶数人数 (4, 6...) 才能开启" : "开启后，间隔入座为队友 (1和3队友，2和4队友)"}
                                        </div>
                                    </div>
                                    
                                    {/* [注] 抽卡开关已移除，现在是强制默认流程 */}

                                    {/* 倒计时选择 */}
                                    <div style={styles.configItem}>
                                        <div style={styles.configLabel}>
                                            <span style={{display:'flex', alignItems:'center', gap:6}}><Clock size={14}/> 出牌时限</span>
                                            <span style={styles.configValue}>{roomConfig.turnTimeout / 1000}秒</span>
                                        </div>
                                        <div style={styles.radioGroup}>
                                            {[30, 60, 90, 120].map(sec => (
                                                <button 
                                                    key={sec}
                                                    style={roomConfig.turnTimeout === sec * 1000 ? styles.radioBtnActive : styles.radioBtn}
                                                    onClick={() => setRoomConfig({...roomConfig, turnTimeout: sec * 1000})}
                                                >
                                                    {sec}s
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* 剩余牌数显示配置 */}
                                <div style={{marginTop: 20, paddingTop: 15, borderTop: '1px solid #f0f0f0'}}>
                                    <div style={{display:'flex', alignItems:'center', gap:6, color:'#7f8c8d', fontSize:14, marginBottom:10, fontWeight:600}}>
                                        <Eye size={14}/> 剩余牌数显示规则
                                    </div>
                                    <div style={styles.radioGroup}>
                                        <button 
                                            style={roomConfig.showCardCountMode === 0 ? styles.radioBtnActive : styles.radioBtn}
                                            onClick={() => setRoomConfig({...roomConfig, showCardCountMode: 0})}
                                        >
                                            不显示
                                        </button>
                                        <button 
                                            style={roomConfig.showCardCountMode === 1 ? styles.radioBtnActive : styles.radioBtn}
                                            onClick={() => setRoomConfig({...roomConfig, showCardCountMode: 1})}
                                        >
                                            ≤3张显示
                                        </button>
                                        <button 
                                            style={roomConfig.showCardCountMode === 2 ? styles.radioBtnActive : styles.radioBtn}
                                            onClick={() => setRoomConfig({...roomConfig, showCardCountMode: 2})}
                                        >
                                            一直显示
                                        </button>
                                    </div>
                                </div>

                                {/* 排名赏罚设置区域 */}
                                <div style={{marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                                        <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:'600', color:'#555', fontSize:14}}>
                                            <Award size={16} /> 启用排名赏罚 (进贡/抓分)
                                        </div>
                                        <label style={{position:'relative', display:'inline-block', width:40, height:20}}>
                                            <input 
                                                type="checkbox" 
                                                style={{opacity:0, width:0, height:0}}
                                                checked={roomConfig.enableRankPenalty}
                                                onChange={(e) => setRoomConfig({...roomConfig, enableRankPenalty: e.target.checked})}
                                            />
                                            <span style={{
                                                position:'absolute', cursor:'pointer', top:0, left:0, right:0, bottom:0, 
                                                backgroundColor: roomConfig.enableRankPenalty ? '#27ae60' : '#ccc', 
                                                transition:'.4s', borderRadius: 20
                                            }}>
                                                <span style={{
                                                    position:'absolute', content:"", height:16, width:16, left:2, bottom:2, 
                                                    backgroundColor:'white', transition:'.4s', borderRadius:'50%',
                                                    transform: roomConfig.enableRankPenalty ? 'translateX(20px)' : 'translateX(0)'
                                                }}></span>
                                            </span>
                                        </label>
                                    </div>

                                    {/* 如果开启，显示详细分值设置 */}
                                    {roomConfig.enableRankPenalty && (
                                        <div style={{background:'#f9f9f9', padding: 15, borderRadius: 8, display:'flex', gap: 20, fontSize: 13}}>
                                            <div style={{flex:1}}>
                                                <div style={{marginBottom:5, color:'#7f8c8d'}}>头尾赏罚 (第1名 vs 倒1)</div>
                                                <input 
                                                    type="number" style={{...styles.input, background:'white', height: 35, padding: '0 10px'}} 
                                                    value={roomConfig.rankPenaltyScores[0]}
                                                    onChange={e => {
                                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                                        setRoomConfig({...roomConfig, rankPenaltyScores: [val, roomConfig.rankPenaltyScores[1]]});
                                                    }}
                                                />
                                            </div>
                                            <div style={{flex:1}}>
                                                <div style={{marginBottom:5, color:'#7f8c8d'}}>次级赏罚 (第2名 vs 倒2)</div>
                                                <input 
                                                    type="number" style={{...styles.input, background:'white', height: 35, padding: '0 10px'}} 
                                                    value={roomConfig.rankPenaltyScores[1]}
                                                    onChange={e => {
                                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                                        setRoomConfig({...roomConfig, rankPenaltyScores: [roomConfig.rankPenaltyScores[0], val]});
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{flex: 1}}></div>

                        <button 
                            style={{
                                ...styles.primaryButton,
                                opacity: (!isConnected || isLoading) ? 0.7 : 1,
                                cursor: (!isConnected || isLoading) ? 'not-allowed' : 'pointer',
                                background: (!isConnected) ? '#95a5a6' : '#2c3e50'
                            }} 
                            onClick={onActionClick} 
                            disabled={isLoading || !isConnected}
                        >
                            {(isLoading || !isConnected) ? <RefreshCw className="spin" size={20}/> : (isCreatorMode ? <Plus size={20}/> : <LogIn size={20}/>)}
                            <span style={{marginLeft:10}}>
                                {!isConnected ? "正在连接服务器..." : (isLoading ? "处理中..." : (isCreatorMode ? "立即创建房间" : "进入游戏房间"))}
                            </span>
                        </button>
                        
                        {!isConnected && (
                            <div style={{textAlign:'center', marginTop: 15, fontSize: 13, color:'#e74c3c', background:'#fdedec', padding:'8px', borderRadius:8}}>
                                ⚠️ 首次访问可能需要 30-50秒 唤醒服务器，请耐心等待右上角变为绿色。
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};