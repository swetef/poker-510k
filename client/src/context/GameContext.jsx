import React, { createContext, useContext } from 'react';

// 引入拆分后的 Hooks
import { useSocketCore } from '../hooks/game/useSocketCore.js';
import { useRoomLogic } from '../hooks/game/useRoomLogic.js';
import { useGameData } from '../hooks/game/useGameData.js';
import { useBattleLogic } from '../hooks/game/useBattleLogic.js';

const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  // Step A: 基础连接
  const socketCore = useSocketCore(null, null); 
  const { socket, isConnected, mySocketId, ping } = socketCore;

  // Step B: 房间交互 (登录/配置)
  const roomLogic = useRoomLogic(socket, isConnected);
  const { 
      username, roomId, inputConfig, isLoading, setIsLoading,
      handleRoomAction, handleUpdateConfig
  } = roomLogic;

  // 闭包刷新 Hack
  useSocketCore(username, roomId); 

  // Step C: 全局游戏数据 (大厅/抽签/状态流转)
  const gameData = useGameData(socket, setIsLoading);
  const { 
      gameState, players, syncedConfig, 
      handleStartGame, handleNextRound, // [修复] 获取 handleNextRound
      handleAddBot, handleSwitchSeat, handleDrawCard, handleKickPlayer
  } = gameData;

  // Step D: 战斗逻辑 (局内)
  const battleLogic = useBattleLogic(socket, username, mySocketId, roomId);

  // Step E: 聚合数据
  const activeRoomConfig = (gameState === 'LOGIN') ? inputConfig : (syncedConfig || inputConfig);

  const wrappedActions = {
      handleRoomAction,
      handleUpdateConfig: (cfg) => handleUpdateConfig(roomId, cfg),
      handleStartGame: () => handleStartGame(roomId),
      handleNextRound: () => handleNextRound(roomId), // [修复] 包装
      handleAddBot: () => handleAddBot(roomId),
      handleSwitchSeat: (i1, i2) => handleSwitchSeat(roomId, i1, i2),
      handleDrawCard: (idx) => handleDrawCard(roomId, idx),
      handleKickPlayer: (tid) => handleKickPlayer(roomId, tid),
      
      handleToggleAutoPlay: () => battleLogic.handleToggleAutoPlay(roomId),
      handlePass: () => battleLogic.handlePass(roomId),
      handlePlayCards: () => battleLogic.handlePlayCards(roomId),
      handleRequestHint: () => battleLogic.handleRequestHint(roomId),
  };

  const contextValue = {
      // 基础
      socket, isConnected, mySocketId, ping,
      
      // 房间表单
      username, setUsername: roomLogic.setUsername,
      roomId, setRoomId: roomLogic.setRoomId,
      isCreatorMode: roomLogic.isCreatorMode, setIsCreatorMode: roomLogic.setIsCreatorMode,
      isLoading,
      
      // 核心配置与状态
      roomConfig: activeRoomConfig, 
      setRoomConfig: roomLogic.setInputConfig, 
      gameState, 
      players, 
      
      // 战斗数据
      ...gameData, 
      ...battleLogic, 
      
      // 动作
      ...wrappedActions,
      
      // 辅助
      handleMouseDown: battleLogic.handleMouseDown,
      handleMouseEnter: battleLogic.handleMouseEnter,
      handleClearSelection: battleLogic.handleClearSelection,
      toggleSort: battleLogic.toggleSort
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};