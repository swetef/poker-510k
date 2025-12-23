import React from 'react';
import { RefreshCw, AlertCircle, WifiOff } from 'lucide-react'; 
// [修复] 修正导入路径，确保在 client/src/App.jsx 位置能正确引用
import { useGame } from './context/GameContext'; // Vite 通常可以自动解析 .jsx，也可以显式写

import { LoginScreen } from './screens/LoginScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { DrawSeatScreen } from './screens/DrawSeatScreen';

export default function App() {
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

  // [修改] 优化后的断线重连提示
  const renderDisconnectAlert = () => (
      !isConnected && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: 'rgba(231, 76, 60, 0.95)', color: 'white', padding: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)', backdropFilter: 'blur(5px)',
              fontSize: 13, fontWeight: '500'
          }}>
              <WifiOff size={16} className="pulse-icon" />
              <span>网络连接已断开，正在尝试自动恢复...</span>
              
              {/* 如果自动重连太久没反应，给个手动按钮 */}
              <button 
                onClick={() => window.location.reload()} 
                style={{
                    background: 'white', color: '#e74c3c', border: 'none', 
                    borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 'bold',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    marginLeft: 10
                }}
              >
                  <RefreshCw size={12} /> 立即刷新
              </button>
              <style>{`.pulse-icon { animation: pulse 1.5s infinite; } @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
          </div>
      )
  );

  return (
    <>
      {renderDisconnectAlert()}
      {renderLandscapeHint()}
      
      {gameState === 'LOGIN' && <LoginScreen />}
      
      {gameState === 'LOBBY' && <LobbyScreen />}
      
      {gameState === 'DRAW_SEATS' && <DrawSeatScreen />}
      
      {gameState === 'GAME' && <GameScreen />}
    </>
  );
}