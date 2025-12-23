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

      // [新增] 快速重连 (用于首页一键回房)
      handleQuickReconnect: () => {
          const lastRid = localStorage.getItem('poker_roomid');
          const lastName = localStorage.getItem('poker_username');
          
          if (!lastRid || !lastName) {
              return alert("没有找到最近的房间记录，无法重连");
          }
          if (!isConnected) return alert("网络连接未就绪，请稍候");

          // 1. 同步 UI 状态 (让输入框变回原来的值，提升视觉反馈)
          roomLogic.setRoomId(lastRid);
          roomLogic.setUsername(lastName);
          roomLogic.setIsCreatorMode(false);
          
          // 2. 发起连接
          if (setIsLoading) setIsLoading(true);
          console.log(`[QuickReconnect] 尝试重回房间: ${lastRid} as ${lastName}`);
          
          // 确保 socket 是连接状态
          if (socket && socket.connected) {
              socket.emit('join_room', { roomId: lastRid, username: lastName });
          } else {
              setIsLoading(false);
              alert("连接断开，请刷新页面重试");
          }
      },

      // 离开房间/返回首页
      handleLeaveRoom: () => {
          if (window.confirm("确定要退出房间返回首页吗？")) {
              // [关键修改]
              // 不再清除 localStorage，这样如果是“手误”退出，
              // 回到首页后依然可以看到“一键重连”按钮，随时可以回去。
              // localStorage.removeItem('poker_roomid'); // 已注释
              
              window.location.reload();
          }
      }
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