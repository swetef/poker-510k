import React, { useState } from 'react'; 
import { User, Monitor, RefreshCw, Plus, LogIn, Maximize, Minimize, Wifi, WifiOff } from 'lucide-react'; 
import { useGame } from '../context/GameContext.jsx';
import { RoomSettingsForm } from '../components/game/RoomSettingsForm.jsx';

import css from './LoginScreen.module.css';

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
            const requestFull = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
            if (requestFull) {
                requestFull.call(docEl)
                    .then(() => setIsFullScreen(true))
                    .catch(err => console.log("全屏请求被拦截:", err));
            }
        } else {
            const exitFull = document.exitFullscreen || document.webkitExitFullscreen;
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
                const requestFull = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
                if (requestFull) {
                    requestFull.call(docEl).catch(() => {});
                }
            }
        } catch (e) {
            // Ignore
        }
    };

    const onActionClick = () => {
        tryEnterFullScreen(); 
        handleRoomAction();   
    };

    const handleConfigChange = (key, value) => {
        setRoomConfig(prev => ({ ...prev, [key]: value }));
    };

    const getPingColor = (p) => {
        if (!isConnected) return '#e74c3c';
        if (p < 100) return '#27ae60';
        if (p < 200) return '#f1c40f';
        return '#e74c3c';
    };

    // 动态计算 Ping Badge 样式
    const pingStyle = {
        background: isConnected ? (ping < 150 ? '#eafaf1' : '#fef9e7') : '#fdedec',
        color: getPingColor(ping),
        borderColor: isConnected ? '#e1e4e8' : '#fadbd8'
    };

    return (
        <div className={css.container}>
            {/* [关键说明] 
               这里同时使用了 css.loginCard (模块化样式) 和 mobile-layout-column (全局 index.css 样式)。
               这样既享受了 CSS Module 的整洁，又保留了你在 index.css 里写的移动端强制适配规则。
            */}
            <div className={`${css.loginCard} mobile-layout-column`}>
                
                {/* 左侧品牌区 */}
                <div className={`${css.loginLeft} mobile-login-left`}>
                    <div className={css.logoCircle}>
                        <div className={css.logoText}>510K</div>
                    </div>
                    <h1 className={css.brandTitle}>扑克对战</h1>
                    <div className={css.brandSubtitle}>多人在线 · 自由规则 · 极速畅玩</div>
                    
                    <div className={`${css.featureList} hide-on-mobile`}>
                        <div className={css.featureItem}>✨ 支持 2-12 人同台竞技</div>
                        <div className={css.featureItem}>🚀 只有 1 副牌? 不，现在支持 8 副!</div>
                        <div className={css.featureItem}>⏱️ 自定义思考时间与获胜目标</div>
                    </div>
                </div>

                {/* 右侧表单区 */}
                <div className={`${css.loginRight} mobile-login-right`}>
                    
                    {/* 顶部工具栏 */}
                    <div className={css.topBar}>
                        <button onClick={toggleFullScreen} className={css.fullScreenBtn}>
                            {isFullScreen ? <Minimize size={14}/> : <Maximize size={14}/>}
                            <span>{isFullScreen ? '退出全屏' : '全屏模式'}</span>
                        </button>

                        <div className={css.pingBadge} style={pingStyle}>
                            {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
                            {isConnected ? `${ping}ms` : '连接中...'}
                        </div>
                    </div>

                    {/* Tab 切换 */}
                    <div className={css.tabs}>
                        <button 
                            className={!isCreatorMode ? css.tabBtnActive : css.tabBtn} 
                            onClick={()=>setIsCreatorMode(false)}
                        >
                            加入房间
                        </button>
                        <button 
                            className={isCreatorMode ? css.tabBtnActive : css.tabBtn} 
                            onClick={()=>setIsCreatorMode(true)}
                        >
                            创建房间
                        </button>
                    </div>

                    {/* 表单内容 */}
                    <div className={css.formContent}>
                        <div className={css.inputGroup}>
                            <User size={18} color="#7f8c8d" />
                            <input 
                                className={css.input} 
                                value={username} 
                                onChange={e=>setUsername(e.target.value)} 
                                placeholder="请输入你的昵称" 
                                maxLength={10}
                            />
                        </div>
                        <div className={css.inputGroup}>
                            <Monitor size={18} color="#7f8c8d" />
                            <input 
                                className={css.input} 
                                value={roomId} 
                                onChange={e=>setRoomId(e.target.value)} 
                                placeholder="请输入房间号 (如: 888)" 
                                maxLength={6}
                            />
                        </div>

                        {isCreatorMode && (
                            <div className={css.advancedConfigPanel}>
                                <RoomSettingsForm 
                                    config={roomConfig} 
                                    onChange={handleConfigChange} 
                                />
                            </div>
                        )}

                        <div style={{flex: 1}}></div>

                        <button 
                            className={css.primaryButton}
                            onClick={onActionClick} 
                            disabled={isLoading || !isConnected}
                            style={{
                                background: (!isConnected) ? '#95a5a6' : '#2c3e50'
                            }}
                        >
                            {(isLoading || !isConnected) ? <RefreshCw className="spin" size={20}/> : (isCreatorMode ? <Plus size={20}/> : <LogIn size={20}/>)}
                            <span style={{marginLeft:10}}>
                                {!isConnected ? "正在连接服务器..." : (isLoading ? "处理中..." : (isCreatorMode ? "立即创建房间" : "进入游戏房间"))}
                            </span>
                        </button>
                        
                        {!isConnected && (
                            <div className={css.firstLoadTip}>
                                ⚠️ 首次访问可能需要 30-50秒 唤醒服务器，请耐心等待右上角变为绿色。
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};