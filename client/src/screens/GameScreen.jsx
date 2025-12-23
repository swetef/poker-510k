import React from 'react';
import css from './GameScreen.module.css'; 
import { GameLogPanel } from '../components/BaseUI.jsx';
import { useGame } from '../context/GameContext.jsx';

import { GameHeader } from '../components/game/GameHeader.jsx';
import { TableCenterArea } from '../components/game/TableCenterArea.jsx';
import { SettlementModal } from '../components/game/SettlementModal.jsx';
import { PlayerLayout } from '../components/game/PlayerLayout.jsx';
import { HandArea } from '../components/game/HandArea.jsx';
import { GameActionBar } from '../components/game/GameActionBar.jsx';

// ==========================================
// 主组件: GameScreen
// ==========================================
export const GameScreen = () => {
    const { players, mySocketId, gameLogs } = useGame();

    // 身份同步保护
    const myPlayerExists = players.some(p => p.id === mySocketId);
    if (!myPlayerExists && players.length > 0) {
        // Loading 态使用简单的内联样式即可，无需依赖 styles.js
        return (
            <div className={css.gameTable} style={{color:'white', display:'flex', justifyContent:'center', alignItems:'center'}}>
                正在同步数据...
            </div>
        );
    }

    return (
        <div className={css.gameTable}>
            <div className={css.gameSafeArea}>
                
                {/* 1. 左上角日志 (直接渲染，组件内部已包含 absolute 定位) */}
                <GameLogPanel logs={gameLogs} />

                {/* 2. 顶部 Header (包含比分板、全屏按钮等) */}
                <GameHeader />

                {/* 3. 桌面中间区域 (底分、消息、出牌展示) */}
                <TableCenterArea />

                {/* 4. 结算弹窗 (如果有) */}
                <SettlementModal />

                {/* 5. 玩家头像布局 */}
                <PlayerLayout />

                {/* 6. 底部手牌区域 */}
                <HandArea />

                {/* 7. 底部操作按钮 */}
                <GameActionBar />

            </div>
        </div>
    );
};