import React from 'react';
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
    // [修改] 解构 isSpectator
    const { players, mySocketId, gameLogs, isSpectator } = useGame();

    const myPlayerExists = players.some(p => p.id === mySocketId);
    
    // [修改] 如果不是观众且没有同步到玩家数据，才显示同步界面
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
            {/* [新增] 观众模式水印 */}
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
                <SettlementModal />
                <PlayerLayout />
                <HandArea />
                <GameActionBar />
            </div>
        </div>
    );
};