import React from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { Coins } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import css from './TableCenterArea.module.css';

export const TableCenterArea = () => {
    const { 
        lastPlayed, 
        lastPlayerName, 
        infoMessage, 
        pendingPoints
    } = useGame();

    return (
        <>
            {/* 系统消息 (全屏大字) - 保持独立，覆盖在最上层 */}
            {infoMessage && (
                <div className={css.infoMessage}>
                    {infoMessage}
                </div>
            )}

            {/* [关键修改] 将底分和出牌区包裹在同一个 tableCenter 容器中 
                这样可以通过 Flex Column 轻松实现上下排列
            */}
            <div className={css.tableCenter}>
                
                {/* 底分面板 - 即使是 0 分也可以显示，或者只在 >0 时显示 */}
                <div className={css.scoreBoard} style={{opacity: pendingPoints > 0 ? 1 : 0}}>
                    <div className={css.scoreValue}>
                        <Coins size={28} fill="#f1c40f" stroke="#e67e22" strokeWidth={2.5} />
                        <span style={{marginLeft: 8}}>{pendingPoints}</span>
                    </div>
                </div>

                {/* 桌面出牌展示区 */}
                {lastPlayed && lastPlayed.length > 0 && (
                    <div className={css.playedContainer}>
                        {/* 名字现在在 flex-row 的左侧 */}
                        <div className={css.playerNameTag}>{lastPlayerName}</div>
                        
                        <div className={css.playedRow}>
                            {lastPlayed.map((c, i) => (
                                <div key={`${c}-${i}`} className={css.miniCardWrapper}>
                                    <Card 
                                        cardVal={c} 
                                        index={0} 
                                        isSelected={false} 
                                        onClick={()=>{}} 
                                        onMouseEnter={()=>{}} 
                                        spacing={0} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};