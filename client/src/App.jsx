import React from 'react';
import { useGame } from './context/GameContext';
import { LandscapeHint, DisconnectAlert } from './components/BaseUI';

import { LoginScreen } from './screens/LoginScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { DrawSeatScreen } from './screens/DrawSeatScreen';

export default function App() {
  const { gameState } = useGame();

  return (
    <>
      {/* 系统级全局提示组件 */}
      <DisconnectAlert />
      <LandscapeHint />
      
      {/* 核心页面路由状态机 */}
      {gameState === 'LOGIN' && <LoginScreen />}
      
      {gameState === 'LOBBY' && <LobbyScreen />}
      
      {gameState === 'DRAW_SEATS' && <DrawSeatScreen />}
      
      {gameState === 'GAME' && <GameScreen />}
    </>
  );
}