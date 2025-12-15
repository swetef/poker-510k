// 登录页 - 重构版
// 增加了服务器连接状态显示，解决用户不知道服务器是否就绪的问题
import React from 'react';
import { User, Monitor, RefreshCw, Plus, LogIn, Settings, Clock, Layers, Users, Target, Wifi, WifiOff } from 'lucide-react';
// [修复] 显式添加 .js 后缀，确保模块解析正确
import { styles } from '../styles.js';

export const LoginScreen = ({ 
    username, setUsername, 
    roomId, setRoomId, 
    roomConfig, setRoomConfig, 
    isCreatorMode, setIsCreatorMode, 
    handleRoomAction, 
    isLoading,
    isConnected // 接收连接状态
}) => {
    
    // 渲染配置项的辅助函数
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
            <div style={styles.loginCard}>
                {/* 左侧：品牌展示区 */}
                <div style={styles.loginLeft}>
                    <div style={styles.logoCircle}>
                        <div style={styles.logoText}>510K</div>
                    </div>
                    <h1 style={styles.brandTitle}>扑克对战</h1>
                    <div style={styles.brandSubtitle}>多人在线 · 自由规则 · 极速畅玩</div>
                    
                    <div style={styles.featureList}>
                        <div style={styles.featureItem}>✨ 支持 2-12 人同台竞技</div>
                        <div style={styles.featureItem}>🚀 只有 1 副牌? 不，现在支持 8 副!</div>
                        <div style={styles.featureItem}>⏱️ 自定义思考时间与获胜目标</div>
                    </div>
                </div>

                {/* 右侧：操作区 */}
                <div style={styles.loginRight}>
                    {/* [新增] 顶部状态栏 */}
                    <div style={{
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        {/* [修复] 合并了之前重复的 style 属性 */}
                        <div style={{...styles.tabs, marginBottom: 0, borderBottom: 'none'}}> 
                           {/* 占位，保持布局平衡 */}
                        </div>

                        {/* 连接状态指示器 */}
                        <div style={{
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            fontSize: 12,
                            padding: '6px 12px',
                            borderRadius: 20,
                            // 根据连接状态改变颜色
                            background: isConnected ? '#eafaf1' : '#fdedec',
                            color: isConnected ? '#27ae60' : '#e74c3c',
                            fontWeight: 'bold',
                            border: `1px solid ${isConnected ? '#abebc6' : '#fadbd8'}`
                        }}>
                            {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
                            {isConnected ? '服务器已连接' : '正在连接服务器...'}
                        </div>
                    </div>

                    {/* 顶部 Tab 切换 */}
                    <div style={styles.tabs}>
                        <button 
                            style={!isCreatorMode ? styles.tabBtnActive : styles.tabBtn} 
                            onClick={()=>setIsCreatorMode(false)}
                        >
                            加入房间
                        </button>
                        <button 
                            style={isCreatorMode ? styles.tabBtnActive : styles.tabBtn} 
                            onClick={()=>setIsCreatorMode(true)}
                        >
                            创建房间
                        </button>
                    </div>

                    <div style={styles.formContent}>
                        {/* 基础信息输入 (昵称/房号) */}
                        <div style={styles.inputGroup}>
                            <User size={18} color="#7f8c8d" />
                            <input 
                                style={styles.input} 
                                value={username} 
                                onChange={e=>setUsername(e.target.value)} 
                                placeholder="请输入你的昵称" 
                                maxLength={10}
                            />
                        </div>
                        <div style={styles.inputGroup}>
                            <Monitor size={18} color="#7f8c8d" />
                            <input 
                                style={styles.input} 
                                value={roomId} 
                                onChange={e=>setRoomId(e.target.value)} 
                                placeholder="请输入房间号 (如: 888)" 
                                maxLength={6}
                            />
                        </div>

                        {/* 创建模式下的高级配置区 */}
                        {isCreatorMode && (
                            <div style={styles.advancedConfigPanel}>
                                <div style={styles.configGrid}>
                                    {renderConfigSlider(<Users size={14}/>, "玩家人数", roomConfig.maxPlayers, 2, 12, 1, v=>setRoomConfig({...roomConfig, maxPlayers:v}), '人')}
                                    {renderConfigSlider(<Layers size={14}/>, "牌库数量", roomConfig.deckCount, 1, 8, 1, v=>setRoomConfig({...roomConfig, deckCount:v}), '副')}
                                    {renderConfigSlider(<Target size={14}/>, "获胜目标", roomConfig.targetScore, 500, 5000, 500, v=>setRoomConfig({...roomConfig, targetScore:v}), '分')}
                                    
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
                            </div>
                        )}

                        <div style={{flex: 1}}></div> {/* 弹簧填充 */}

                        {/* [修改] 按钮逻辑：如果 isLoading 或 !isConnected，都显示加载状态 */}
                        <button 
                            style={{
                                ...styles.primaryButton,
                                opacity: (!isConnected || isLoading) ? 0.7 : 1,
                                cursor: (!isConnected || isLoading) ? 'not-allowed' : 'pointer',
                                background: (!isConnected) ? '#95a5a6' : '#2c3e50'
                            }} 
                            onClick={handleRoomAction} 
                            disabled={isLoading || !isConnected}
                        >
                            {(isLoading || !isConnected) ? <RefreshCw className="spin" size={20}/> : (isCreatorMode ? <Plus size={20}/> : <LogIn size={20}/>)}
                            <span style={{marginLeft:10}}>
                                {!isConnected ? "正在连接服务器..." : (isLoading ? "处理中..." : (isCreatorMode ? "立即创建房间" : "进入游戏房间"))}
                            </span>
                        </button>
                        
                        {/* 额外提示 Render 休眠 */}
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