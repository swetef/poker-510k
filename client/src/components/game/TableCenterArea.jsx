import React from 'react';
import { Coins } from 'lucide-react';
import css from './TableCenterArea.module.css'; // 新 CSS
import { MiniCard } from '../BaseUI.jsx';
import { useGame } from '../../context/GameContext.jsx';

/**
 * [中间区域组件]
 * 负责显示：最后打出的牌、待结算分数、系统消息
 */
export const TableCenterArea = () => {
    const { 
        lastPlayed, lastPlayerName, pendingPoints, 
        infoMessage: serverInfoMessage 
    } = useGame();

    const displayMessage = serverInfoMessage;

    return (
        <>
            <div className={css.scoreBoard}>
                <div className={css.scoreLabel}>POINTS</div>
                <div className={css.scoreValue}>
                    <Coins size={20} /> {pendingPoints}
                </div>
            </div>

            {displayMessage && (
                <div className={css.infoMessage} key={Date.now()}>
                    {displayMessage}
                </div>
            )}

            <div className={css.tableCenter}>
                {lastPlayed.length > 0 && (
                    <div className={css.playedContainer}>
                        <div className={css.playerNameTag}>{lastPlayerName}</div>
                        <div className={css.playedRow}> 
                            {lastPlayed.map((c, i) => (
                                <div key={i} className={css.miniCardWrapper}>
                                    <MiniCard cardVal={c} index={i} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};