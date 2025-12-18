// 大厅页 - 支持房主换座 + 组队模式 + 房主修改规则
import React, { useState } from 'react';
// [修改] 引入 Sparkles 图标
import { Target, Layers, User, Play, Clock, Bot, Shield, ArrowUp, ArrowDown, Settings, X, Eye, Award, Check, Sparkles, Shuffle } from 'lucide-react';
import { styles } from '../styles.js';
// [新增] 引入 useGame
import { useGame } from '../context/GameContext.jsx';

// [修改] 移除 Props 参数
export const LobbyScreen = () => {
    
    // [新增] 从 Context 获取数据
    const { 
        roomId, roomConfig, players, mySocketId, 
        handleStartGame, 
        handleAddBot,
        handleSwitchSeat,
        handleUpdateConfig,
        handleKickPlayer // [新增]
    } = useGame();
    
    // 判断自己是不是房主
    const amIHost = players.find(p => p.id === mySocketId)?.isHost;
    
    // 判断是否开启了组队模式 (开关开启 且 人数是偶数)
    const isTeamMode = roomConfig.isTeamMode && roomConfig.maxPlayers % 2 === 0;

    // --- 配置弹窗状态 ---
    const [showSettings, setShowSettings] = useState(false);
    
    // 渲染配置滑块的辅助函数 (复用自 LoginScreen 风格)
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

    // 统一更新函数
    const updateConfig = (key, value) => {
        const newConfig = { ...roomConfig, [key]: value };
        // 立即发送 socket 请求
        handleUpdateConfig(newConfig);
    };

    // 渲染设置弹窗内容
    const renderSettingsModal = () => (
        <div style={styles.modalOverlay}>
            <div style={{...styles.modalContent, width: '90%', maxWidth: 500, padding: 25, textAlign:'left'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20, borderBottom:'1px solid #eee', paddingBottom:10}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, fontSize:18, fontWeight:'bold', color:'#2c3e50'}}>
                        <Settings size={20}/> 房间规则设置
                    </div>
                    <button onClick={()=>setShowSettings(false)} style={{background:'none', border:'none', cursor:'pointer', padding:5}}>
                        <X size={20} color="#999"/>
                    </button>
                </div>

                <div style={{maxHeight: '60vh', overflowY:'auto', paddingRight: 5}}>
                    <div style={styles.configGrid}>
                        {renderConfigSlider(<UsersIcon/>, "玩家人数", roomConfig.maxPlayers, 2, 12, 1, v=>updateConfig('maxPlayers', v), '人')}
                        {renderConfigSlider(<Layers size={14}/>, "牌库数量", roomConfig.deckCount, 1, 8, 1, v=>updateConfig('deckCount', v), '副')}
                        {renderConfigSlider(<Target size={14}/>, "获胜目标", roomConfig.targetScore, 500, 5000, 500, v=>updateConfig('targetScore', v), '分')}
                        
                        {/* [修改] 洗牌策略选择器 (替代原不洗牌开关) */}
                        <div style={{...styles.configItem, marginTop: 10, padding: '10px', background: '#f8f9fa', borderRadius: 8, gridColumn: '1 / -1', border: '1px solid #eee'}}>
                            <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:'600', color: '#2c3e50', marginBottom: 10}}>
                                <Shuffle size={16} /> 洗牌策略
                            </div>
                            <div style={{display:'flex', gap: 10}}>
                                <button 
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 'bold',
                                        border: (!roomConfig.shuffleStrategy || roomConfig.shuffleStrategy === 'CLASSIC') ? '1px solid #2ecc71' : '1px solid #ddd',
                                        background: (!roomConfig.shuffleStrategy || roomConfig.shuffleStrategy === 'CLASSIC') ? '#eafaf1' : 'white',
                                        color: (!roomConfig.shuffleStrategy || roomConfig.shuffleStrategy === 'CLASSIC') ? '#2ecc71' : '#7f8c8d',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => updateConfig('shuffleStrategy', 'CLASSIC')}
                                >
                                    🎲 普通随机
                                </button>
                                <button 
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 'bold',
                                        border: roomConfig.shuffleStrategy === 'NO_SHUFFLE' ? '1px solid #e67e22' : '1px solid #ddd',
                                        background: roomConfig.shuffleStrategy === 'NO_SHUFFLE' ? '#fdf2e9' : 'white',
                                        color: roomConfig.shuffleStrategy === 'NO_SHUFFLE' ? '#e67e22' : '#7f8c8d',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => updateConfig('shuffleStrategy', 'NO_SHUFFLE')}
                                >
                                    🔥 均贫富(爽局)
                                </button>
                                <button 
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 'bold',
                                        border: roomConfig.shuffleStrategy === 'SIMULATION' ? '1px solid #9b59b6' : '1px solid #ddd',
                                        background: roomConfig.shuffleStrategy === 'SIMULATION' ? '#f5eef8' : 'white',
                                        color: roomConfig.shuffleStrategy === 'SIMULATION' ? '#9b59b6' : '#7f8c8d',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => updateConfig('shuffleStrategy', 'SIMULATION')}
                                >
                                    🃏 模拟叠牌(新)
                                </button>
                            </div>
                            <div style={{fontSize: 11, color: '#999', marginTop: 6, lineHeight: '1.4'}}>
                                {(!roomConfig.shuffleStrategy || roomConfig.shuffleStrategy === 'CLASSIC') && "完全随机洗牌，运气至上。"}
                                {roomConfig.shuffleStrategy === 'NO_SHUFFLE' && "系统平均分配炸弹，保证每人都有好牌。"}
                                {roomConfig.shuffleStrategy === 'SIMULATION' && "保留上局出牌顺序 + 简单切牌，还原线下手感。"}
                            </div>
                        </div>
                        
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
                                        onChange={(e) => updateConfig('isTeamMode', e.target.checked)}
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
                                {roomConfig.maxPlayers % 2 !== 0 ? "⚠️ 需要偶数人数 (4, 6...) 才能开启" : "开启后，间隔入座为队友"}
                            </div>
                        </div>
                        
                        {/* 出牌时限 */}
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
                                        onClick={() => updateConfig('turnTimeout', sec * 1000)}
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
                                onClick={() => updateConfig('showCardCountMode', 0)}
                            >
                                不显示
                            </button>
                            <button 
                                style={roomConfig.showCardCountMode === 1 ? styles.radioBtnActive : styles.radioBtn}
                                onClick={() => updateConfig('showCardCountMode', 1)}
                            >
                                ≤3张显示
                            </button>
                            <button 
                                style={roomConfig.showCardCountMode === 2 ? styles.radioBtnActive : styles.radioBtn}
                                onClick={() => updateConfig('showCardCountMode', 2)}
                            >
                                一直显示
                            </button>
                        </div>
                    </div>

                    {/* 排名赏罚 */}
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
                                    onChange={(e) => updateConfig('enableRankPenalty', e.target.checked)}
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
                        {roomConfig.enableRankPenalty && (
                            <div style={{background:'#f9f9f9', padding: 15, borderRadius: 8, display:'flex', gap: 20, fontSize: 13}}>
                                <div style={{flex:1}}>
                                    <div style={{marginBottom:5, color:'#7f8c8d'}}>头尾赏罚</div>
                                    <input 
                                        type="number" style={{...styles.input, background:'white', height: 35, padding: '0 10px'}} 
                                        value={roomConfig.rankPenaltyScores[0]}
                                        onChange={e => {
                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                            updateConfig('rankPenaltyScores', [val, roomConfig.rankPenaltyScores[1]]);
                                        }}
                                    />
                                </div>
                                <div style={{flex:1}}>
                                    <div style={{marginBottom:5, color:'#7f8c8d'}}>次级赏罚</div>
                                    <input 
                                        type="number" style={{...styles.input, background:'white', height: 35, padding: '0 10px'}} 
                                        value={roomConfig.rankPenaltyScores[1]}
                                        onChange={e => {
                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                            updateConfig('rankPenaltyScores', [roomConfig.rankPenaltyScores[0], val]);
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div style={{marginTop: 20, textAlign:'center'}}>
                    <button style={{...styles.primaryButton, height: 50, fontSize: 16, marginTop:0}} onClick={() => setShowSettings(false)}>
                        <Check size={18} style={{marginRight:5}}/> 完成设置
                    </button>
                </div>
            </div>
        </div>
    );

    // 简单封装 Users 图标
    const UsersIcon = () => <User size={14}/>;

    return (
    <div style={styles.container}>
      {showSettings && renderSettingsModal()}

      <div style={styles.lobbyCard} className="mobile-layout-column">
          
          <div className="mobile-lobby-content" style={{display:'flex', flexDirection:'column', height:'100%', width: '100%', overflow:'hidden', borderRadius: 20}}>
            
            {/* 头部信息 */}
            <div style={styles.lobbyHeader}>
                <div style={{display:'flex', alignItems:'center', gap: 10, flexWrap: 'wrap'}}>
                    <h2 style={{margin:0, fontSize: 24}}>房间: <span style={{fontFamily:'monospace', color:'#27ae60'}}>{roomId}</span></h2>
                    
                    {/* [修改] 模式标签展示 */}
                    {roomConfig.shuffleStrategy === 'NO_SHUFFLE' && (
                        <span style={{
                            background: 'linear-gradient(to right, #f6d365 0%, #fda085 100%)', 
                            color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, 
                            display:'flex', alignItems:'center', gap:4, fontWeight: 'bold',
                            boxShadow: '0 2px 5px rgba(253, 160, 133, 0.4)'
                        }}>
                            <Sparkles size={12} fill="white"/> 不洗牌(爽局)
                        </span>
                    )}

                    {/* [新增] 模拟洗牌标签 */}
                    {roomConfig.shuffleStrategy === 'SIMULATION' && (
                        <span style={{
                            background: 'linear-gradient(to right, #a18cd1 0%, #fbc2eb 100%)', 
                            color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, 
                            display:'flex', alignItems:'center', gap:4, fontWeight: 'bold',
                            boxShadow: '0 2px 5px rgba(161, 140, 209, 0.4)'
                        }}>
                            <Layers size={12} fill="white"/> 模拟叠牌
                        </span>
                    )}

                    {/* 组队模式标签 */}
                    {isTeamMode && (
                        <span style={{background:'#27ae60', color:'white', fontSize:12, padding:'2px 8px', borderRadius:10, display:'flex', alignItems:'center', gap:4}}>
                            <Shield size={12}/> 组队模式
                        </span>
                    )}
                </div>
                
                {/* 头部右侧：信息标签 + 设置按钮 */}
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <div style={{display:'flex', gap:10}} className="hide-on-mobile">
                        <span style={styles.tag}><Target size={14}/> 目标 {roomConfig.targetScore}</span>
                        <span style={styles.tag}><Layers size={14}/> {roomConfig.deckCount}副</span>
                        <span style={styles.tag}><User size={14}/> {roomConfig.maxPlayers}人</span>
                    </div>

                    {/* [新增] 房主设置按钮 */}
                    {amIHost && (
                        <button 
                            onClick={() => setShowSettings(true)}
                            style={{
                                background: '#f1f2f6', border: '1px solid #ccc', borderRadius: '50%', 
                                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.2s', color: '#2c3e50'
                            }}
                            title="修改房间规则"
                        >
                            <Settings size={20} />
                        </button>
                    )}
                </div>
            </div>
            
            {/* 移动端显示的配置概览 (作为补充) */}
            <div style={{padding: '0 15px 10px 15px', display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'#666'}} className="mobile-only-tags">
                 <span style={styles.tag}><Target size={12}/> {roomConfig.targetScore}</span>
                 <span style={styles.tag}><Layers size={12}/> {roomConfig.deckCount}副</span>
                 <span style={styles.tag}><User size={12}/> {roomConfig.maxPlayers}人</span>
                 {roomConfig.shuffleStrategy === 'NO_SHUFFLE' && <span style={{...styles.tag, background:'#fdf2e9', color:'#e67e22', border:'1px solid #e67e22'}}><Sparkles size={12}/> 不洗牌</span>}
                 {roomConfig.shuffleStrategy === 'SIMULATION' && <span style={{...styles.tag, background:'#f5eef8', color:'#9b59b6', border:'1px solid #9b59b6'}}><Layers size={12}/> 模拟叠牌</span>}
                 {roomConfig.enableRankPenalty && <span style={{...styles.tag, color:'#e67e22', background:'#fdf2e9'}}><Award size={12}/> 赏罚</span>}
            </div>
            <style>{`@media (min-width: 769px) { .mobile-only-tags { display: none !important; } }`}</style>

            {/* 玩家列表区域 */}
            <div style={styles.playerGrid} className="mobile-lobby-grid">
                {players.map((p, i) => {
                    // 组队模式视觉逻辑
                    let teamColor = '#eee'; 
                    let teamBg = 'white';   
                    let teamName = null;
                    
                    if (isTeamMode) {
                        const isRedTeam = i % 2 === 0; // 0, 2, 4... 红队
                        teamColor = isRedTeam ? '#e74c3c' : '#3498db';
                        teamBg = isRedTeam ? '#fdedec' : '#eaf2f8';
                        teamName = isRedTeam ? '红队' : '蓝队';
                    }

                    const isMe = p.id === mySocketId;
                    if (isMe && !isTeamMode) {
                        teamBg = '#f0fbf4';
                        teamColor = '#27ae60';
                    }
                    const borderWidth = isMe ? 3 : 2;

                    return (
                        <div key={p.id} style={{
                            ...styles.lobbyPlayer, 
                            borderColor: isMe ? '#2ecc71' : teamColor, 
                            background: teamBg,
                            borderWidth: borderWidth,
                            position: 'relative'
                        }}>
                            {/* [新增] 房主踢人按钮 */}
                            {amIHost && !isMe && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const confirmKick = window.confirm(`确定要踢出 ${p.name} 吗？`);
                                        if (confirmKick) handleKickPlayer(p.id);
                                    }}
                                    style={styles.kickButton}
                                    title="踢出玩家"
                                >
                                    <X size={14} color="white"/>
                                </button>
                            )}

                            {/* 组队角标 */}
                            {teamName && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, 
                                    background: teamColor, color: 'white', 
                                    fontSize: 10, padding: '2px 8px', 
                                    borderBottomRightRadius: 8, borderTopLeftRadius: 8
                                }}>
                                    {teamName}
                                </div>
                            )}

                            {/* 房主调位按钮 */}
                            {amIHost && players.length > 1 && (
                                <div style={{
                                    position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                                    display:'flex', flexDirection:'column', gap:4
                                }}>
                                    {i > 0 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleSwitchSeat(i, i - 1); }}
                                            style={{
                                                padding:4, borderRadius:4, border:'1px solid #ccc', 
                                                background:'white', cursor:'pointer', lineHeight:0
                                            }}
                                            title="上移"
                                        >
                                            <ArrowUp size={14} color="#666"/>
                                        </button>
                                    )}
                                    {i < players.length - 1 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleSwitchSeat(i, i + 1); }}
                                            style={{
                                                padding:4, borderRadius:4, border:'1px solid #ccc', 
                                                background:'white', cursor:'pointer', lineHeight:0
                                            }}
                                            title="下移"
                                        >
                                            <ArrowDown size={14} color="#666"/>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div style={styles.avatarLarge}>
                                {p.isBot ? <Bot size={40} /> : p.name[0]}
                            </div>
                            <div style={{fontWeight: 'bold', display:'flex', alignItems:'center', gap:5}}>
                                {p.name}
                                {p.isBot && <span style={{fontSize:10, background:'#eee', padding:'2px 5px', borderRadius:4}}>AI</span>}
                            </div>
                            {p.isHost && <span style={styles.hostBadge}>房主</span>}
                        </div>
                    );
                })}
                
                {/* 虚拟空位 */}
                {Array.from({length: Math.max(0, roomConfig.maxPlayers - players.length)}).map((_, i) => (
                    <div key={`empty-${i}`} style={{...styles.lobbyPlayer, borderStyle: 'dashed', opacity: 0.5}}>
                        <div style={{...styles.avatarLarge, background:'#f0f0f0', color:'#ccc'}}>?</div>
                        <div style={{color:'#999'}}>等待加入</div>
                    </div>
                ))}
            </div>

            {/* 底部按钮 */}
            <div style={styles.lobbyFooter} className="mobile-lobby-footer">
                {players.find(p=>p.id===mySocketId)?.isHost ? (
                    <div style={{display:'flex', gap: 15, justifyContent: 'center'}}>
                        <button 
                            style={{...styles.primaryButton, background: '#7f8c8d', width:'auto', padding:'0 20px', fontSize: 16, marginTop:0}} 
                            onClick={handleAddBot}
                            disabled={players.length >= roomConfig.maxPlayers}
                        >
                            <Bot size={18} style={{marginRight:5}}/> +Bot
                        </button>

                        <button style={{...styles.primaryButton, width:'auto', padding:'0 30px', marginTop:0}} onClick={handleStartGame} disabled={players.length < 2}>
                            <Play size={18} style={{marginRight:5}}/> 开始对战
                        </button>
                    </div>
                ) : (
                    <div style={{color:'#999', fontSize: 14, display:'flex', alignItems:'center', gap:5}}><Clock size={16}/> 等待房主开始...</div>
                )}
            </div>
          </div>
      </div>
    </div>
    );
};