import React from 'react';
import { BookOpen, X, Trophy, AlertTriangle, Zap } from 'lucide-react';
import css from './RulesModal.module.css';

export const RulesModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className={css.modalOverlay} onClick={onClose}>
            <div className={css.modalContent} onClick={e => e.stopPropagation()}>
                <div className={css.modalHeader}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <BookOpen size={20} color="#2c3e50"/>
                        <span style={{fontSize: 18, fontWeight: 'bold', color:'#2c3e50'}}>游戏规则说明</span>
                    </div>
                    <button className={css.closeBtn} onClick={onClose}>
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
                    <button className={css.confirmBtn} onClick={onClose}>我已了解</button>
                </div>
            </div>
        </div>
    );
};