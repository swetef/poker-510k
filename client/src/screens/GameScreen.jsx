import React, { useState } from 'react';
import css from './GameScreen.module.css'; 
import { GameLogPanel } from '../components/BaseUI.jsx';
import { useGame } from '../context/GameContext.jsx';
import { RefreshCw, AlertCircle, Eye } from 'lucide-react';

import { GameHeader } from '../components/game/GameHeader.jsx';
import { TableCenterArea } from '../components/game/TableCenterArea.jsx';
import { SettlementModal } from '../components/game/SettlementModal.jsx';
import { PlayerLayout } from '../components/game/PlayerLayout.jsx';
import { HandArea } from '../components/game/HandArea.jsx';
import { GameActionBar } from '../components/game/GameActionBar.jsx';

export const GameScreen = () => {
    const { players, mySocketId, gameLogs, isSpectator, isRoundOver } = useGame();

    // [新增] 控制结算弹窗显示
    const [showSettlement, setShowSettlement] = useState(false);

    // [新增] 当小局结束时，不自动弹，但如果是大局结束(GameOver)，可能还是需要强制弹
    // 这里我们简单处理：如果是RoundOver，默认不弹，由用户点；但如果是GrandOver，组件内部逻辑会处理
    
    const myPlayerExists = players.some(p => p.id === mySocketId);
    
    if (!myPlayerExists && !isSpectator && players.length > 0) {
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
            {isSpectator && (
                <div style={{
                    position: 'absolute', top: 60, right: 20, 
                    background: 'rgba(0,0,0,0.5)', padding: '5px 15px', 
                    borderRadius: 20, color: '#f1c40f', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', gap: 6, zIndex: 50,
                    pointerEvents: 'none'
                }}>
                    <Eye size={16}/> 观战模式
                </div>
            )}

            <div className={css.gameSafeArea}>
                <GameLogPanel logs={gameLogs} />
                <GameHeader />
                <TableCenterArea />
                
                {/* [修改] 传递 isOpen 和 onClose */}
                <SettlementModal 
                    isOpen={showSettlement || (useGame().grandResult !== null)} // 大局结束强制显示
                    onClose={() => setShowSettlement(false)} 
                />
                
                <PlayerLayout />
                <HandArea />
                
                {/* [修改] 传递回调 */}
                <GameActionBar onShowSettlement={() => setShowSettlement(true)} />
            </div>
        </div>
    );
};