import React, { useState } from 'react'; 
import { User, Monitor, RefreshCw, Plus, LogIn, Maximize, Minimize, Wifi, WifiOff } from 'lucide-react'; // 移除多余图标引用
import { styles } from '../styles.js';
import { useGame } from '../context/GameContext.jsx';
// [新增] 引入通用配置组件
import { RoomSettingsForm } from '../components/game/RoomSettingsForm.jsx';

export const LoginScreen = () => {
    
    const { 
        username, setUsername, 
        roomId, setRoomId, 
        roomConfig, setRoomConfig, 
        isCreatorMode, setIsCreatorMode, 
        handleRoomAction, 
        isLoading,
        isConnected,
        ping 
    } = useGame();

    const [isFullScreen, setIsFullScreen] = useState(false);

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

    // [新增] 统一更新函数适配器
    const handleConfigChange = (key, value) => {
        setRoomConfig(prev => ({ ...prev, [key]: value }));
    };

    const getPingColor = (p) => {
        if (!isConnected) return '#e74c3c';
        if (p < 100) return '#27ae60';
        if (p < 200) return '#f1c40f';
        return '#e74c3c';
    };

    return (
        <div style={styles.container}>
            <div style={styles.loginCard} className="mobile-layout-column">
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

                <div style={styles.loginRight} className="mobile-login-right">
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
                            background: isConnected ? (ping < 150 ? '#eafaf1' : '#fef9e7') : '#fdedec', 
                            color: getPingColor(ping),
                            fontWeight: 'bold', border: `1px solid ${isConnected ? '#e1e4e8' : '#fadbd8'}`
                        }}>
                            {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
                            {isConnected ? `${ping}ms` : '连接中...'}
                        </div>
                    </div>

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

                        {/* [修改] 使用新的通用组件替代手动代码 */}
                        {isCreatorMode && (
                            <div style={styles.advancedConfigPanel}>
                                <RoomSettingsForm 
                                    config={roomConfig} 
                                    onChange={handleConfigChange} 
                                />
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