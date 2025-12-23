import React from 'react';
import css from './GameScreen.module.css'; 
import { GameLogPanel } from '../components/BaseUI.jsx';
import { useGame } from '../context/GameContext.jsx';
// [新增] 引入刷新图标
import { RefreshCw, AlertCircle } from 'lucide-react';

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
    
    // [关键修改] 如果卡在同步界面，显示更详细的提示和手动刷新按钮
    if (!myPlayerExists && players.length > 0) {
        return (
            <div className={css.gameTable} style={{
                color:'white', 
                display:'flex', 
                flexDirection: 'column', 
                justifyContent:'center', 
                alignItems:'center',
                gap: 20,
                textAlign: 'center'
            }}>
                <AlertCircle size={40} color="#f1c40f" />
                
                <div>
                    <div style={{fontSize: 20, fontWeight: 'bold', marginBottom: 5}}>正在同步数据...</div>
                    <div style={{fontSize: 14, opacity: 0.7}}>如果是从后台切回，可能需要重新连接</div>
                </div>

                {/* 手动刷新按钮：解决卡死问题的“逃生门” */}
                <button 
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        color: 'white',
                        padding: '10px 25px',
                        borderRadius: 30,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: 'bold',
                        marginTop: 10
                    }}
                >
                    <RefreshCw size={18} /> 刷新页面
                </button>
            </div>
        );
    }

    return (
        <div className={css.gameTable}>
            <div className={css.gameSafeArea}>
                
                {/* 1. 左上角日志 */}
                <GameLogPanel logs={gameLogs} />

                {/* 2. 顶部 Header */}
                <GameHeader />

                {/* 3. 桌面中间区域 */}
                <TableCenterArea />

                {/* 4. 结算弹窗 */}
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