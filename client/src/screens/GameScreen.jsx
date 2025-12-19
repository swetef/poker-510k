import React from 'react';
// [修改] 引入 CSS Module，不再依赖 styles.js 中的 gameTable 等属性
import css from './GameScreen.module.css'; 
import { styles } from '../styles.js'; // 保留引用，以防个别子组件需要 styles.container 等通用样式
import { GameLogPanel } from '../components/BaseUI.jsx';
import { useGame } from '../context/GameContext.jsx';

// 引入拆分后的子组件
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
        // loading 态简单保留内联样式即可
        return <div className={css.gameTable} style={{color:'white', display:'flex', justifyContent:'center', alignItems:'center'}}>正在同步数据...</div>;
    }

    return (
        // [修改] 使用 CSS Module 类名
        <div className={css.gameTable} onMouseUp={() => { /* 全局鼠标抬起事件通常用于取消拖拽，已在 Hook 中处理 */ }}>
            <div className={css.gameSafeArea}>
                
                {/* 1. 左上角日志 */}
                <div className="gameLogPanel">
                     <GameLogPanel logs={gameLogs} />
                </div>

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
            
            {/* [修改] 移除内联 <style>，已迁移至 GameScreen.module.css 的 :global 块中 */}
        </div>
    );
};