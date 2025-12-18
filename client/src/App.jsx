import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react'; 
import { useGameSocket } from './hooks/useGameSocket.js'; // 引入新 Hook

import { LoginScreen } from './screens/LoginScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { GameScreen } from './screens/GameScreen.jsx';
import { DrawSeatScreen } from './screens/DrawSeatScreen.jsx';

export default function App() {
  // 核心逻辑已移交 Hook，App 瘦身成功！
  const {
      // State
      gameState, username, roomId, roomConfig, isCreatorMode,
      players, myHand, selectedCards, lastPlayed,
      currentTurnId, lastPlayerName, infoMessage,
      roundResult, grandResult, playerScores, roundPoints,
      playersInfo, finishedRank, pendingPoints, gameLogs,
      sortMode, isConnected, mySocketId, isLoading,
      turnRemaining, handCounts, drawState,

      // Setters
      setUsername, setRoomId, setRoomConfig, setIsCreatorMode,

      // Actions
      toggleSort, handleRoomAction, handleStartGame, handleNextRound,
      handleAddBot, handleToggleAutoPlay, handleSwitchSeat, handleDrawCard,
      handleUpdateConfig, handleClearSelection, handleMouseDown,
      handleMouseEnter, handlePlayCards, handlePass, handleKickPlayer,
      handleRequestHint // [修复] 确保这里已经从 Hook 中解构出来
  } = useGameSocket();

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
      
      {gameState === 'LOGIN' && <LoginScreen {...{
          username, setUsername, 
          roomId, setRoomId, 
          roomConfig, setRoomConfig, 
          isCreatorMode, setIsCreatorMode, 
          handleRoomAction, 
          isLoading,
          isConnected 
      }} />}
      
      {gameState === 'LOBBY' && <LobbyScreen {...{
          roomId, roomConfig, players, mySocketId, 
          handleStartGame, 
          handleAddBot,
          handleSwitchSeat,
          handleUpdateConfig,
          handleKickPlayer
      }} />}
      
      {gameState === 'DRAW_SEATS' && <DrawSeatScreen {...{
          roomId, players, mySocketId,
          drawState, handleDrawCard,
          roomConfig 
      }} />}
      
      {gameState === 'GAME' && <GameScreen {...{
          roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
          infoMessage, winner: null, 
          playerScores, roundPoints,
          playersInfo, pendingPoints, gameLogs, sortMode, 
          mySocketId, roundResult, grandResult, roomConfig,
          turnRemaining, finishedRank, handCounts, 
          toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
          handleToggleAutoPlay, handleClearSelection,
          handleRequestHint // [关键修复] 将方法传递给 GameScreen
      }} />}
    </>
  );
}