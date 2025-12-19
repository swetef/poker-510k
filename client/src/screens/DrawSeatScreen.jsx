import React, { useState, useEffect } from 'react';
import { Card } from '../components/BaseUI.jsx'; 
import { Shuffle } from 'lucide-react';
import { useGame } from '../context/GameContext.jsx';
import css from './DrawSeatScreen.module.css'; // 新 CSS

export const DrawSeatScreen = () => {
    const { 
        players, mySocketId, 
        drawState, // { totalCards, history: [...] }
        handleDrawCard,
        roomConfig
    } = useGame();

    const [flippedCards, setFlippedCards] = useState({}); 
    const [infoText, setInfoText] = useState("请点击一张卡背进行抽签");

    useEffect(() => {
        if (drawState && drawState.history) {
            const newFlipped = {};
            drawState.history.forEach(item => {
                newFlipped[item.index] = { val: item.val, playerName: item.name };
            });
            setFlippedCards(newFlipped);

            const myLog = drawState.history.find(h => h.playerId === mySocketId);
            if (myLog) {
                setInfoText(`等待其他玩家完成抽签...`);
            }
        }
    }, [drawState, mySocketId]);

    const onCardClick = (index) => {
        if (flippedCards[index]) return; 
        
        const myName = players.find(p=>p.id===mySocketId)?.name;
        if (Object.values(flippedCards).some(c => c.playerName === myName)) {
             return; 
        }
        
        handleDrawCard(index);
    };

    const isTeamMode = roomConfig && roomConfig.isTeamMode && (players.length % 2 === 0);

    return (
        <div className={css.drawTable}>
            <div className={css.contentContainer}>
                
                <div className={css.infoBox}>
                    <h2 className={css.title}>
                        <Shuffle size={24} color="#f1c40f"/> 赛前抽卡定座
                    </h2>
                    
                    <div className={css.desc}>
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

                <div className={css.cardGrid}>
                    {Array.from({ length: players.length }).map((_, index) => {
                        const flipData = flippedCards[index];
                        const isFlipped = !!flipData;
                        const isMine = isFlipped && flipData.playerName === players.find(p=>p.id===mySocketId)?.name;

                        return (
                            <div key={index} className={css.cardSlot}>
                                {isFlipped && (
                                    <div className={`${css.nameTag} ${isMine ? css.nameTagMine : ''}`}>
                                        {flipData.playerName}
                                    </div>
                                )}

                                {isFlipped ? (
                                    // 翻开后的牌
                                    <div className={`${css.flippedWrapper} ${isMine ? css.flippedWrapperMine : ''}`}>
                                        <Card 
                                            cardVal={flipData.val} 
                                            index={0} 
                                            isSelected={false} 
                                            onClick={()=>{}} 
                                            onMouseEnter={()=>{}} 
                                            spacing={0}
                                        />
                                    </div>
                                ) : (
                                    // 卡背
                                    <div className={css.cardBack} onClick={() => onCardClick(index)}>
                                        <div className={css.cardBackInner}>
                                            <span className={css.cardBackText}>?</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={css.statusText}>
                    {infoText}
                </div>

            </div>
        </div>
    );
};