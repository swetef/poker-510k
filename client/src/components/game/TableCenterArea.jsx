import React from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { Coins } from 'lucide-react';
// [修复] 修正 Card 导入路径
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
            {/* 底分面板 - 极简纯净版 */}
            {pendingPoints > 0 && (
                <div className={css.scoreBoard}>
                    <div className={css.scoreValue}>
                        <Coins size={24} fill="#f1c40f" stroke="#e67e22" strokeWidth={2} />
                        <span style={{marginLeft: 6}}>{pendingPoints}</span>
                    </div>
                </div>
            )}

            {/* 系统消息 (全屏大字) */}
            {infoMessage && (
                <div className={css.infoMessage}>
                    {infoMessage}
                </div>
            )}

            {/* 桌面出牌展示区 */}
            {lastPlayed && lastPlayed.length > 0 && (
                <div className={css.tableCenter}>
                    <div className={css.playedContainer}>
                        <div className={css.playerNameTag}>{lastPlayerName}</div>
                        
                        <div className={css.playedRow}>
                            {lastPlayed.map((c, i) => (
                                <div key={`${c}-${i}`} className={css.miniCardWrapper}>
                                    {/* [修复] 使用正确的 Card 属性: cardVal */}
                                    {/* index=0 spacing=0 确保它在 wrapper 内部居中/靠左，由 wrapper 负责布局 */}
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
                </div>
            )}
        </>
    );
};