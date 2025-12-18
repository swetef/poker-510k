import React, { useState, useEffect } from 'react';
import { styles } from '../styles.js';
import { Card } from '../components/BaseUI.jsx'; 
import { Shuffle } from 'lucide-react';
// [新增] 引入 useGame
import { useGame } from '../context/GameContext.jsx';

// [修改] 移除 Props 参数
export const DrawSeatScreen = () => {

    // [新增] 从 Context 获取数据
    const { 
        roomId, players, mySocketId, 
        drawState, // { totalCards, history: [...] }
        handleDrawCard,
        roomConfig // 接收配置，用于判断显示什么文案
    } = useGame();

    // 本地状态用于动画展示
    const [flippedCards, setFlippedCards] = useState({}); // { index: { val: 54, playerName: 'xxx' } }
    const [infoText, setInfoText] = useState("请点击一张卡背进行抽签");

    // 监听服务器数据更新
    useEffect(() => {
        if (drawState && drawState.history) {
            const newFlipped = {};
            drawState.history.forEach(item => {
                newFlipped[item.index] = { val: item.val, playerName: item.name };
            });
            setFlippedCards(newFlipped);

            // 检查自己是否抽了
            const myLog = drawState.history.find(h => h.playerId === mySocketId);
            if (myLog) {
                setInfoText(`等待其他玩家完成抽签...`);
            }
        }
    }, [drawState, mySocketId]);

    const onCardClick = (index) => {
        if (flippedCards[index]) return; // 已经翻开了
        
        // 检查自己是否已经抽过
        const myName = players.find(p=>p.id===mySocketId)?.name;
        if (Object.values(flippedCards).some(c => c.playerName === myName)) {
             return; 
        }
        
        handleDrawCard(index);
    };

    // 判断是否是真正的组队模式 (开启了开关 且 人数是偶数)
    const isTeamMode = roomConfig && roomConfig.isTeamMode && (players.length % 2 === 0);

    return (
        <div style={styles.gameTable}>
            {/* [修复说明] styles.gameSafeArea 默认带有 pointerEvents: 'none'。
               这会导致其子元素无法接收点击事件。下面的卡片元素通过 pointerEvents: 'auto' 重新开启了交互。
            */}
            <div style={{...styles.gameSafeArea, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                
                <div style={{
                    background: 'rgba(0,0,0,0.6)', padding: '20px 30px', borderRadius: 20, 
                    marginBottom: 40, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center', color: 'white'
                }}>
                    <h2 style={{margin: '0 0 10px 0', fontSize: 24, display:'flex', alignItems:'center', justifyContent:'center', gap:10}}>
                        <Shuffle size={24} color="#f1c40f"/> 赛前抽卡定座
                    </h2>
                    
                    <div style={{fontSize: 14, color: '#bdc3c7', maxWidth: 400, lineHeight: '1.6'}}>
                        {isTeamMode ? (
                            <>
                                点数<span style={{color:'#e74c3c', fontWeight:'bold'}}>大</span>的半数玩家 → <span style={{color:'#e74c3c'}}>红队</span> (1, 3, 5号位)<br/>
                                点数<span style={{color:'#3498db', fontWeight:'bold'}}>小</span>的半数玩家 → <span style={{color:'#3498db'}}>蓝队</span> (2, 4, 6号位)
                            </>
                        ) : (
                            <>
                                抽签决定座位顺序<br/>
                                <span style={{color:'#f1c40f'}}>点数越大，座位越靠前 (1号位起)</span>
                            </>
                        )}
                        <br/>
                        <span style={{fontSize: 12, opacity: 0.8, marginTop: 5, display:'block'}}>(2 &gt; A &gt; K &gt; ... &gt; 3)</span>
                    </div>
                </div>

                <div style={{
                    display: 'flex', gap: 15, flexWrap: 'wrap', justifyContent: 'center', 
                    maxWidth: 800, padding: 10
                }}>
                    {Array.from({ length: players.length }).map((_, index) => {
                        const flipData = flippedCards[index];
                        const isFlipped = !!flipData;
                        const isMine = isFlipped && flipData.playerName === players.find(p=>p.id===mySocketId)?.name;

                        return (
                            <div key={index} style={{position: 'relative', width: 80, height: 110, display:'flex', flexDirection:'column', alignItems:'center'}}>
                                {/* 玩家名字标签 - [修改] 稍微调高 top 避免视觉拥挤 */}
                                {isFlipped && (
                                    <div style={{
                                        position: 'absolute', top: -28, width: 120, textAlign: 'center',
                                        fontSize: 12, color: isMine ? '#f1c40f' : 'white', fontWeight: 'bold',
                                        textShadow: '0 1px 2px black', whiteSpace:'nowrap',
                                        zIndex: 10 // 确保名字在最上层
                                    }}>
                                        {flipData.playerName}
                                    </div>
                                )}

                                {isFlipped ? (
                                    // 翻开后的牌
                                    <div style={{
                                        transform: isMine ? 'scale(1.1)' : 'scale(1)', 
                                        transition: 'all 0.3s',
                                        pointerEvents: 'auto',
                                        // [修改] 如果是我的牌，在外层加光晕，而不是让 Card 组件自己弹起
                                        boxShadow: isMine ? '0 0 20px rgba(241, 196, 15, 0.6)' : 'none',
                                        borderRadius: 6
                                    }}>
                                        <Card 
                                            cardVal={flipData.val} 
                                            index={0} 
                                            // [修改] 强制设为 false，防止 Card 组件内部执行 translateY(-35px) 导致遮挡名字
                                            isSelected={false} 
                                            onClick={()=>{}} 
                                            onMouseEnter={()=>{}} 
                                            spacing={0}
                                        />
                                    </div>
                                ) : (
                                    // 卡背
                                    <div 
                                        onClick={() => onCardClick(index)}
                                        style={{
                                            width: 55, height: 70, 
                                            background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
                                            borderRadius: 6,
                                            border: '2px solid #bdc3c7',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                                            transition: 'transform 0.2s',
                                            pointerEvents: 'auto'
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                    >
                                        <div style={{
                                            width: 40, height: 55, border: '1px dashed rgba(255,255,255,0.3)', 
                                            borderRadius: 4, display:'flex', alignItems:'center', justifyContent:'center'
                                        }}>
                                            <span style={{fontSize: 20, opacity: 0.5, color: 'white'}}>?</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{marginTop: 40, color: '#f1c40f', fontSize: 18, fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)', height: 30}}>
                    {infoText}
                </div>

            </div>
        </div>
    );
};