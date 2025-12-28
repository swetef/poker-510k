import React, { useState, useEffect } from 'react'; 
// [修改] 引入 BookOpen 和 X 图标
import { User, Monitor, RefreshCw, Plus, LogIn, Maximize, Minimize, Wifi, WifiOff, History, BookOpen, X, Trophy, AlertTriangle, Zap } from 'lucide-react'; 
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
        handleQuickReconnect, 
        isLoading,
        isConnected,
        ping 
    } = useGame();

    const [isFullScreen, setIsFullScreen] = useState(false);
    // [新增] 控制规则弹窗的状态
    const [showRules, setShowRules] = useState(false);
    
    const [lastSession, setLastSession] = useState(null);

    useEffect(() => {
        const rid = localStorage.getItem('poker_roomid');
        const uid = localStorage.getItem('poker_username');
        if (rid && uid) {
            setLastSession({ roomId: rid, username: uid });
        }
    }, []);

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
    
    const onReconnectClick = () => {
        tryEnterFullScreen();
        handleQuickReconnect();
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

    const pingStyle = {
        background: isConnected ? (ping < 150 ? '#eafaf1' : '#fef9e7') : '#fdedec',
        color: getPingColor(ping),
        borderColor: isConnected ? '#e1e4e8' : '#fadbd8'
    };

    // [新增] 渲染规则弹窗
    const renderRulesModal = () => (
        <div className={css.modalOverlay} onClick={() => setShowRules(false)}>
            <div className={css.modalContent} onClick={e => e.stopPropagation()}>
                <div className={css.modalHeader}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <BookOpen size={20} color="#2c3e50"/>
                        <span style={{fontSize: 18, fontWeight: 'bold', color:'#2c3e50'}}>游戏规则说明</span>
                    </div>
                    <button className={css.closeBtn} onClick={() => setShowRules(false)}>
                        <X size={20} />
                    </button>
                </div>
                
                <div className={css.modalBody}>
                    <div className={css.ruleSection}>
                        <h3 style={{color: '#2980b9'}}><Trophy size={16} style={{marginRight:5, verticalAlign:'text-bottom'}}/> 核心目标</h3>
                        <p>这是一款<strong>抓分</strong>游戏，而非单纯的跑得快。</p>
                        <p><strong>分牌：</strong><span style={{color:'#c0392b', fontWeight:'bold'}}>5</span> (5分)、<span style={{color:'#c0392b', fontWeight:'bold'}}>10</span> (10分)、<span style={{color:'#c0392b', fontWeight:'bold'}}>K</span> (10分)。</p>
                        <p><strong>抓分机制：</strong>当一轮出牌结束（其他人均不要）时，桌面上的所有分牌归<strong>本轮赢家</strong>所有。</p>
                        <div style={{background:'#f0f9ff', padding:'8px', borderRadius:'6px', fontSize:'13px', color:'#34495e', marginTop:'5px'}}>
                            💡 <strong>最终得分</strong> = 桌面抓分 + 排名赏罚 + (对手剩余手牌分)
                        </div>
                    </div>

                    <div className={css.ruleSection}>
                        <h3 style={{color: '#e67e22'}}><AlertTriangle size={16} style={{marginRight:5, verticalAlign:'text-bottom'}}/> 牌型与大小</h3>
                        <p><strong>点数：</strong>3 &lt; ... &lt; K &lt; A &lt; 2 &lt; 小王 &lt; 大王</p>
                        <p><strong>普通牌型：</strong>单张、对子、三张、连对、飞机(三顺)。</p>
                        
                        <div style={{marginTop:'8px', borderLeft:'3px solid #e67e22', paddingLeft:'10px'}}>
                            <div style={{fontWeight:'bold', marginBottom:'4px', color:'#d35400'}}>💣 炸弹等级 (从大到小)</div>
                            <ul style={{margin:0, paddingLeft:'20px', fontSize:'13px', color:'#555'}}>

                                <li><strong>至尊长炸：</strong>所有同点数牌齐出 (如4副牌16张3)。</li>
                                <li><strong>天王炸：</strong>所有王牌齐出 (如4副牌需8张王)，无敌。</li>
                                <li><strong>普通炸弹：</strong>4张起炸。<strong>张数越多越大</strong>；张数相同比点数。</li>
                                <li><strong>纯色 510K：</strong>同花色的 5、10、K。</li>
                                <li><strong>杂色 510K：</strong>花色不同的 5、10、K (最小炸弹)。</li>
                            </ul>
                        </div>
                    </div>

                    <div className={css.ruleSection}>
                        <h3 style={{color: '#27ae60'}}><Zap size={16} style={{marginRight:5, verticalAlign:'text-bottom'}}/> 结算与惩罚</h3>
                        <p><strong>接风规则：</strong>若上家出完牌且其他人都要不起，则由<strong>上家的队友</strong>(组队时)或<strong>下家</strong>(个人时)获得出牌权。</p>
                        <p><strong>手牌罚分：</strong>游戏结束时，未出完牌的玩家，手中剩余的分牌将被没收，归<strong>头游</strong>(或赢家队伍)所有。</p>
                        <p><strong>排名赏罚：</strong>启用后，末位玩家需向头游玩家进贡分数 (队友之间免罚)。</p>
                    </div>
                </div>
                
                <div className={css.modalFooter}>
                    <button className={css.confirmBtn} onClick={() => setShowRules(false)}>我已了解</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={css.container}>
            {/* [新增] 规则弹窗渲染 */}
            {showRules && renderRulesModal()}

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
                        <div style={{display:'flex', gap: 8}}>
                            <button onClick={toggleFullScreen} className={css.fullScreenBtn}>
                                {isFullScreen ? <Minimize size={14}/> : <Maximize size={14}/>}
                                <span>{isFullScreen ? '退出' : '全屏'}</span>
                            </button>
                            
                            {/* [新增] 规则说明按钮 */}
                            <button onClick={() => setShowRules(true)} className={css.rulesBtn}>
                                <BookOpen size={14}/>
                                <span>规则</span>
                            </button>
                        </div>

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

                        {lastSession && !isCreatorMode && (
                             <button 
                                className={css.reconnectBtn}
                                onClick={onReconnectClick}
                                disabled={isLoading || !isConnected}
                             >
                                <History size={18} />
                                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.2}}>
                                    <span style={{fontSize: 14, fontWeight:'bold'}}>一键重连回房间</span>
                                    <span style={{fontSize: 11, opacity: 0.8}}>Room: {lastSession.roomId} ({lastSession.username})</span>
                                </div>
                             </button>
                        )}

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