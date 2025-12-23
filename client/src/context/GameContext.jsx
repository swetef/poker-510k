import React, { createContext, useContext, useEffect, useRef } from 'react';

import { useSocketConnection } from '../hooks/useSocketConnection.js';
import { useRoomLogic } from '../hooks/game/useRoomLogic.js';
import { useGameData } from '../hooks/game/useGameData.js';
import { useBattleLogic } from '../hooks/game/useBattleLogic.js';

const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  // Step A: 基础连接
  const { socket, isConnected, mySocketId, ping } = useSocketConnection();

  // Step B: 房间交互
  const roomLogic = useRoomLogic(socket, isConnected);
  const { 
      username, roomId, inputConfig, isLoading, setIsLoading,
      handleRoomAction, handleUpdateConfig
  } = roomLogic;

  // 自动重连逻辑
  const usernameRef = useRef(username);
  const roomIdRef = useRef(roomId);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  useEffect(() => {
      if (isConnected && socket && roomIdRef.current && usernameRef.current) {
          console.log(`[Auto-Rejoin] 自动恢复身份: ${usernameRef.current} @ Room ${roomIdRef.current}`);
          socket.emit('join_room', { 
              roomId: roomIdRef.current, 
              username: usernameRef.current 
          });
      }
  }, [isConnected, socket]);

  // Step C: 全局游戏数据
  const gameData = useGameData(socket, setIsLoading);
  const { 
      gameState, players, syncedConfig, 
      handleStartGame, handleNextRound,
      handleAddBot, handleSwitchSeat, handleDrawCard, handleKickPlayer
  } = gameData;

  // 计算当前生效的配置
  const activeRoomConfig = (gameState === 'LOGIN') ? inputConfig : (syncedConfig || inputConfig);

  // Step D: 战斗逻辑 (局内)
  // [修改] 将 deckCount 传入，用于本地提示计算
  const deckCount = activeRoomConfig ? activeRoomConfig.deckCount : 2;
  const battleLogic = useBattleLogic(socket, username, mySocketId, roomId, deckCount);

  // Step E: 聚合数据
  const wrappedActions = {
      handleRoomAction,
      handleUpdateConfig: (cfg) => handleUpdateConfig(roomId, cfg),
      handleStartGame: () => handleStartGame(roomId),
      handleNextRound: () => handleNextRound(roomId),
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