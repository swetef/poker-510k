import React, { createContext, useContext } from 'react';
import { useGameSocket } from '../hooks/useGameSocket.js';

// 创建 Context 对象
const GameContext = createContext(null);

// Provider 组件：负责持有状态并向下传递
export const GameProvider = ({ children }) => {
  // 这里调用你原本的巨型 Hook，获取所有数据和方法
  const gameData = useGameSocket();

  return (
    <GameContext.Provider value={gameData}>
      {children}
    </GameContext.Provider>
  );
};

// 自定义 Hook：方便子组件直接获取数据
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};