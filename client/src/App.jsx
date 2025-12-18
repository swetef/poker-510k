import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react'; 
// [修改] 引入 useGame
import { useGame } from './context/GameContext.jsx';

import { LoginScreen } from './screens/LoginScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { GameScreen } from './screens/GameScreen.jsx';
import { DrawSeatScreen } from './screens/DrawSeatScreen.jsx';

export default function App() {
  // [修改] 直接从 Context 获取需要的状态
  const { gameState, isConnected } = useGame();

  const renderLandscapeHint = () => (
      <div className="landscape-hint">
          <div className="phone-rotate-icon"></div>
          <h3 style={{marginBottom: 10, fontSize: 18}}>建议使用横屏游玩</h3>
          <p style={{fontSize: 14, opacity: 0.8, maxWidth: 250}}>
              510K 需要较大的展示空间。<br/>
              请旋转您的手机以获得最佳体验。
          </p>
          <button 
            style={{marginTop: 20, padding: '8px 20px', background: 'rgba(255,255,255,0.2)', color:'white', border:'1px solid white'}}
            onClick={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
          >
              我非要竖屏玩
          </button>
      </div>
  );

  const renderDisconnectAlert = () => (
      !isConnected && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: '#e74c3c', color: 'white', padding: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
              <AlertCircle size={20} />
              <span style={{fontWeight: 'bold'}}>连接已断开，正在尝试重连...</span>
              <button 
                onClick={() => window.location.reload()} 
                style={{
                    background: 'white', color: '#e74c3c', border: 'none', 
                    borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 'bold',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                  <RefreshCw size={12} /> 刷新重连
              </button>
          </div>
      )
  );

  return (
    <>
      {renderDisconnectAlert()}
      {renderLandscapeHint()}
      
      {/* [修改] 子组件不再需要传参，它们会自己去 Context 里拿数据 */}
      {gameState === 'LOGIN' && <LoginScreen />}
      
      {gameState === 'LOBBY' && <LobbyScreen />}
      
      {gameState === 'DRAW_SEATS' && <DrawSeatScreen />}
      
      {gameState === 'GAME' && <GameScreen />}
    </>
  );
}