import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { useSocketConnection } from '../hooks/useSocketConnection.js';
import { useRoomLogic } from '../hooks/game/useRoomLogic.js';
import { useGameData } from '../hooks/game/useGameData.js';
import { useBattleLogic } from '../hooks/game/useBattleLogic.js';

const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  const { socket, isConnected, mySocketId, ping } = useSocketConnection();

  // [新增] 观众状态
  const [isSpectator, setIsSpectator] = useState(false);
  // [新增] 观察到的其他人手牌 { playerId: [cards] }
  const [observedHands, setObservedHands] = useState({});

  const roomLogic = useRoomLogic(socket, isConnected);
  const { 
      username, roomId, inputConfig, isLoading, setIsLoading,
      handleRoomAction, handleUpdateConfig
  } = roomLogic;

  const gameData = useGameData(socket, setIsLoading);
  const { 
      gameState, players, syncedConfig, 
      handleStartGame, handleNextRound,
      handleAddBot, handleSwitchSeat, handleDrawCard, handleKickPlayer
  } = gameData;

  const activeRoomConfig = (gameState === 'LOGIN') ? inputConfig : (syncedConfig || inputConfig);

  const deckCount = activeRoomConfig ? activeRoomConfig.deckCount : 2;
  const battleLogic = useBattleLogic(socket, username, mySocketId, roomId, deckCount);

  // [新增] 监听观众事件和手牌观察事件
  useEffect(() => {
    if (!socket) return;

    const onSpectatorJoin = (data) => {
        setIsSpectator(true);
        // 如果进入时游戏已经是 GAME 状态，手动解除 loading (防止 useGameData 逻辑覆盖)
        setIsLoading(false); 
        alert(data.message);
    };

    const onObservationUpdate = (data) => {
        // data: { targetId, hand, targetName }
        setObservedHands(prev => ({
            ...prev,
            [data.targetId]: data.hand
        }));
    };

    // 每次新局开始，清空观察的手牌
    const onGameStarted = (data) => {
        setObservedHands({});
        // 如果服务器明确标记你是观众
        if (data.isSpectator) {
            setIsSpectator(true);
        } else {
            // 如果我是玩家（有手牌），确保 isSpectator 为 false
            if (data.hand && data.hand.length > 0) setIsSpectator(false);
        }
    };

    socket.on('spectator_join', onSpectatorJoin);
    socket.on('observation_update', onObservationUpdate);
    socket.on('game_started', onGameStarted);

    return () => {
        socket.off('spectator_join', onSpectatorJoin);
        socket.off('observation_update', onObservationUpdate);
        socket.off('game_started', onGameStarted);
    };
  }, [socket, setIsLoading]);


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

      handleQuickReconnect: () => {
          const lastRid = localStorage.getItem('poker_roomid');
          const lastName = localStorage.getItem('poker_username');
          
          if (!lastRid || !lastName) {
              return alert("没有找到最近的房间记录，无法重连");
          }
          if (!isConnected) return alert("网络连接未就绪，请稍候");

          roomLogic.setRoomId(lastRid);
          roomLogic.setUsername(lastName);
          roomLogic.setIsCreatorMode(false);
          
          if (setIsLoading) setIsLoading(true);
          console.log(`[QuickReconnect] 尝试重回房间: ${lastRid} as ${lastName}`);
          
          if (socket && socket.connected) {
              socket.emit('join_room', { roomId: lastRid, username: lastName });
          } else {
              setIsLoading(false);
              alert("连接断开，请刷新页面重试");
          }
      },

      handleLeaveRoom: () => {
          if (window.confirm("确定要退出房间返回首页吗？")) {
              window.location.reload();
          }
      }
  };

  const contextValue = {
      socket, isConnected, mySocketId, ping,
      
      username, setUsername: roomLogic.setUsername,
      roomId, setRoomId: roomLogic.setRoomId,
      isCreatorMode: roomLogic.isCreatorMode, setIsCreatorMode: roomLogic.setIsCreatorMode,
      isLoading,
      
      roomConfig: activeRoomConfig, 
      setRoomConfig: roomLogic.setInputConfig, 
      gameState, 
      players, 
      
      ...gameData, 
      ...battleLogic, 
      
      ...wrappedActions,
      
      handleMouseDown: battleLogic.handleMouseDown,
      handleMouseEnter: battleLogic.handleMouseEnter,
      handleClearSelection: battleLogic.handleClearSelection,
      toggleSort: battleLogic.toggleSort,

      // [新增] 暴露给 UI 的新状态
      isSpectator,
      observedHands 
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