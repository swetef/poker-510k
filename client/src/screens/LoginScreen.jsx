// 登录页 - 重构版
// 优化了布局，填补了空白，增加了更丰富的人数、牌数和规则配置
import React from 'react';
import { User, Monitor, RefreshCw, Plus, LogIn, Settings, Clock, Layers, Users, Target } from 'lucide-react';
import { styles } from '../styles';

export const LoginScreen = ({ username, setUsername, roomId, setRoomId, roomConfig, setRoomConfig, isCreatorMode, setIsCreatorMode, handleRoomAction, isLoading }) => {
    
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
                                    
                                    {/* 倒计时选择 - 使用自定义 Select 样式 */}
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

                        <div style={{flex: 1}}></div> {/* 弹簧填充，把按钮顶到底部 */}

                        <button style={styles.primaryButton} onClick={handleRoomAction} disabled={isLoading}>
                            {isLoading ? <RefreshCw className="spin" size={20}/> : (isCreatorMode ? <Plus size={20}/> : <LogIn size={20}/>)}
                            <span style={{marginLeft:10}}>{isCreatorMode ? "立即创建房间" : "进入游戏房间"}</span>
                        </button>
                    </div>
                </div>
            </div>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};