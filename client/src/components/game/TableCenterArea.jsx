import React from 'react';
import { Coins } from 'lucide-react';
import { styles } from '../../styles.js';
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

    // 可以在这里处理本地消息逻辑，目前暂且直接展示
    const displayMessage = serverInfoMessage;

    return (
        <>
            <div style={styles.scoreBoard}>
                <div style={{fontSize: 10, opacity: 0.8, textTransform:'uppercase'}}>POINTS</div>
                <div style={{fontSize: 24, fontWeight: 'bold', color: '#f1c40f', display:'flex', alignItems:'center', justifyContent:'center', gap:5}}>
                    <Coins size={20} /> {pendingPoints}
                </div>
            </div>

            <div style={styles.infoMessage}>{displayMessage}</div>

            <div style={styles.tableCenter}>
                {lastPlayed.length > 0 && (
                    <div style={{animation: 'popIn 0.3s'}}>
                        <div style={styles.playerNameTag}>{lastPlayerName}</div>
                        <div style={styles.playedRow}> 
                            {lastPlayed.map((c, i) => <MiniCard key={i} cardVal={c} index={i} />)}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};