import React from 'react';
import { Users, Layers, Target, Clock, Shuffle, Sparkles, Shield, Eye, Award } from 'lucide-react';
import css from './RoomSettingsForm.module.css';

/**
 * 通用房间配置组件
 * @param {Object} config - 当前配置对象
 * @param {Function} onChange - 配置变更回调 (key, value) => void
 * @param {Boolean} readOnly - 是否只读 (非房主模式)
 */
export const RoomSettingsForm = ({ config, onChange, readOnly = false }) => {
    
    // 辅助封装：更新某个字段
    const update = (key, val) => {
        if (!readOnly && onChange) onChange(key, val);
    };

    // 渲染滑块
    const renderSlider = (icon, label, field, min, max, step, suffix = '') => (
        <div className={css.configItem}>
            <div className={css.configLabel}>
                <span style={{display:'flex', alignItems:'center', gap:6}}>{icon} {label}</span>
                <span className={css.configValue}>{config[field]}{suffix}</span>
            </div>
            <input 
                type="range" 
                className={css.rangeInput}
                min={min} 
                max={max} 
                step={step}
                value={config[field]} 
                onChange={(e) => update(field, parseInt(e.target.value))}
                disabled={readOnly}
                style={{opacity: readOnly ? 0.6 : 1, cursor: readOnly ? 'not-allowed' : 'pointer'}}
            />
        </div>
    );

    return (
        <div className={css.configContainer}>
            <div className={css.configGrid}>
                {renderSlider(<Users size={14}/>, "玩家人数", 'maxPlayers', 2, 12, 1, '人')}
                {renderSlider(<Layers size={14}/>, "牌库数量", 'deckCount', 1, 8, 1, '副')}
                {renderSlider(<Target size={14}/>, "获胜目标", 'targetScore', 500, 5000, 500, '分')}

                {/* 洗牌策略 */}
                <div className={css.configItem} style={{gridColumn: '1 / -1', marginTop: 5}}>
                    <div className={css.configLabel} style={{marginBottom: 8}}>
                        <span style={{display:'flex', alignItems:'center', gap:6}}><Shuffle size={14}/> 洗牌策略</span>
                    </div>
                    <div className={css.radioGroup}>
                        <button 
                            className={css.strategyBtn}
                            style={(!config.shuffleStrategy || config.shuffleStrategy === 'CLASSIC') ? {borderColor: '#2ecc71', background: '#eafaf1', color: '#2ecc71'} : {}}
                            onClick={() => update('shuffleStrategy', 'CLASSIC')}
                            disabled={readOnly}
                        >
                            🎲 普通随机
                        </button>
                        <button 
                            className={css.strategyBtn}
                            style={config.shuffleStrategy === 'NO_SHUFFLE' ? {borderColor: '#e67e22', background: '#fdf2e9', color: '#e67e22'} : {}}
                            onClick={() => update('shuffleStrategy', 'NO_SHUFFLE')}
                            disabled={readOnly}
                        >
                            <Sparkles size={14}/> 均贫富(爽局)
                        </button>
                        <button 
                            className={css.strategyBtn}
                            style={config.shuffleStrategy === 'SIMULATION' ? {borderColor: '#9b59b6', background: '#f5eef8', color: '#9b59b6'} : {}}
                            onClick={() => update('shuffleStrategy', 'SIMULATION')}
                            disabled={readOnly}
                        >
                            <Layers size={14}/> 模拟叠牌
                        </button>
                    </div>
                    <div style={{fontSize: 11, color: '#999', marginTop: 4, lineHeight: '1.4'}}>
                        {(!config.shuffleStrategy || config.shuffleStrategy === 'CLASSIC') && "完全随机，运气至上。"}
                        {config.shuffleStrategy === 'NO_SHUFFLE' && "系统平均分配好牌，炸弹更多。"}
                        {config.shuffleStrategy === 'SIMULATION' && "还原线下洗牌手感，可能出现连长龙。"}
                    </div>
                </div>

                {/* 组队模式 */}
                <div className={config.maxPlayers % 2 !== 0 ? css.toggleContainerDisabled : css.toggleContainer}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:'600', color: config.maxPlayers % 2 !== 0 ? '#999' : '#27ae60', fontSize: 14}}>
                            <Shield size={14} /> 组队对抗 (2v2, 3v3...)
                        </div>
                        <label style={{position:'relative', display:'inline-block', width:40, height:20}}>
                            <input 
                                type="checkbox" 
                                style={{opacity:0, width:0, height:0}}
                                checked={config.isTeamMode && config.maxPlayers % 2 === 0}
                                disabled={readOnly || config.maxPlayers % 2 !== 0}
                                onChange={(e) => update('isTeamMode', e.target.checked)}
                            />
                            <span style={{
                                position:'absolute', cursor: (readOnly || config.maxPlayers % 2 !== 0) ? 'not-allowed' : 'pointer', 
                                top:0, left:0, right:0, bottom:0, 
                                backgroundColor: (config.isTeamMode && config.maxPlayers % 2 === 0) ? '#27ae60' : '#ccc', 
                                transition:'.4s', borderRadius: 20
                            }}>
                                <span style={{
                                    position:'absolute', content:"", height:16, width:16, left:2, bottom:2, 
                                    backgroundColor:'white', transition:'.4s', borderRadius:'50%',
                                    transform: (config.isTeamMode && config.maxPlayers % 2 === 0) ? 'translateX(20px)' : 'translateX(0)'
                                }}></span>
                            </span>
                        </label>
                    </div>
                    <div style={{fontSize: 11, color: '#7f8c8d'}}>
                        {config.maxPlayers % 2 !== 0 ? "⚠️ 需偶数人数才能开启" : "间隔入座为队友 (1,3 vs 2,4)"}
                    </div>
                </div>

                {/* 出牌时限 */}
                <div className={css.configItem}>
                    <div className={css.configLabel}>
                        <span style={{display:'flex', alignItems:'center', gap:6}}><Clock size={14}/> 出牌时限</span>
                        <span className={css.configValue}>{config.turnTimeout / 1000}s</span>
                    </div>
                    <div className={css.radioGroup}>
                        {[30, 60, 90, 120].map(sec => (
                            <button 
                                key={sec}
                                className={config.turnTimeout === sec * 1000 ? css.radioBtnActive : css.radioBtn}
                                onClick={() => update('turnTimeout', sec * 1000)}
                                disabled={readOnly}
                            >
                                {sec}s
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className={css.divider}></div>

            {/* 剩余牌数显示 */}
            <div>
                <div className={css.configLabel} style={{marginBottom: 8}}>
                    <span style={{display:'flex', alignItems:'center', gap:6}}><Eye size={14}/> 剩余牌数显示</span>
                </div>
                <div className={css.radioGroup}>
                    <button className={config.showCardCountMode === 0 ? css.radioBtnActive : css.radioBtn} onClick={() => update('showCardCountMode', 0)} disabled={readOnly}>不显示</button>
                    <button className={config.showCardCountMode === 1 ? css.radioBtnActive : css.radioBtn} onClick={() => update('showCardCountMode', 1)} disabled={readOnly}>≤2张</button>
                    <button className={config.showCardCountMode === 2 ? css.radioBtnActive : css.radioBtn} onClick={() => update('showCardCountMode', 2)} disabled={readOnly}>一直显示</button>
                </div>
            </div>

            <div className={css.divider}></div>

            {/* 排名赏罚 */}
            <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:'600', color:'#555', fontSize:14}}>
                        <Award size={14} /> 启用排名赏罚 (抓分)
                    </div>
                    <label style={{position:'relative', display:'inline-block', width:40, height:20}}>
                        <input 
                            type="checkbox" 
                            style={{opacity:0, width:0, height:0}}
                            checked={config.enableRankPenalty}
                            onChange={(e) => update('enableRankPenalty', e.target.checked)}
                            disabled={readOnly}
                        />
                        <span style={{
                            position:'absolute', cursor: readOnly ? 'not-allowed' : 'pointer', top:0, left:0, right:0, bottom:0, 
                            backgroundColor: config.enableRankPenalty ? '#27ae60' : '#ccc', 
                            transition:'.4s', borderRadius: 20
                        }}>
                            <span style={{
                                position:'absolute', content:"", height:16, width:16, left:2, bottom:2, 
                                backgroundColor:'white', transition:'.4s', borderRadius:'50%',
                                transform: config.enableRankPenalty ? 'translateX(20px)' : 'translateX(0)'
                            }}></span>
                        </span>
                    </label>
                </div>
                
                {config.enableRankPenalty && (
                    <div className={css.rankPenaltyContainer}>
                        <div style={{flex:1}}>
                            <div style={{marginBottom:5, color:'#7f8c8d', fontSize:12}}>头尾赏罚</div>
                            <input 
                                type="number" className={css.input}
                                value={config.rankPenaltyScores[0]}
                                onChange={e => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    update('rankPenaltyScores', [val, config.rankPenaltyScores[1]]);
                                }}
                                disabled={readOnly}
                            />
                        </div>
                        <div style={{flex:1}}>
                            <div style={{marginBottom:5, color:'#7f8c8d', fontSize:12}}>次级赏罚</div>
                            <input 
                                type="number" className={css.input}
                                value={config.rankPenaltyScores[1]}
                                onChange={e => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    update('rankPenaltyScores', [config.rankPenaltyScores[0], val]);
                                }}
                                disabled={readOnly}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};