import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { useSocketConnection } from '../hooks/useSocketConnection.js';
import { useRoomLogic } from '../hooks/game/useRoomLogic.js';
import { useGameData } from '../hooks/game/useGameData.js';
import { useBattleLogic } from '../hooks/game/useBattleLogic.js';

const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  const { socket, isConnected, mySocketId, ping } = useSocketConnection();

  const [isSpectator, setIsSpectator] = useState(false);
  const [observedHands, setObservedHands] = useState({});

  // [新增] 结算与准备状态
  const [isRoundOver, setIsRoundOver] = useState(false);
  const [roundOverData, setRoundOverData] = useState(null); 
  const [readyPlayers, setReadyPlayers] = useState([]); 

  const roomLogic = useRoomLogic(socket, isConnected);
  const { 
      username, roomId, inputConfig, isLoading, setIsLoading,
      handleRoomAction, handleUpdateConfig
  } = roomLogic;

  // [修改] 传递 Setters 给 useGameData
  const gameData = useGameData(socket, setIsLoading, {
      setIsRoundOver, setRoundOverData, setReadyPlayers
  });

  const { 
      gameState, players, syncedConfig, 
      handleStartGame, handleNextRound,
      handleAddBot, handleSwitchSeat, handleDrawCard, handleKickPlayer
  } = gameData;

  const activeRoomConfig = (gameState === 'LOGIN') ? inputConfig : (syncedConfig || inputConfig);

  const deckCount = activeRoomConfig ? activeRoomConfig.deckCount : 2;
  const battleLogic = useBattleLogic(socket, username, mySocketId, roomId, deckCount);

  // --- [核心修复] 切后台断线后的自动重连逻辑 ---
  useEffect(() => {
    // 只有当 Socket 重新连接上 (isConnected=true)，且本地有房间信息时，才尝试自动重连
    if (isConnected && socket && roomId && username) {
        // 防止在登录页面（LOGIN状态）且未发起请求时误操作
        // 但如果是在游戏状态下断线重连，gameState 可能还停留在 GAME，这时候需要重发 join
        
        console.log(`[AutoRejoin] Socket restored. Attempting to rejoin room ${roomId}...`);
        
        // 只有当并未处于正常的“手动退出”流程时才重连
        // 这里简单发一个 join_room，服务端会自动识别是重连还是新加
        socket.emit('join_room', { roomId, username });
    }
  }, [isConnected, socket]); // 依赖 isConnected 变化


  useEffect(() => {
    if (!socket) return;

    const onSpectatorJoin = (data) => {
        setIsSpectator(true);
        setIsLoading(false); 
        alert(data.message);
    };

    const onObservationUpdate = (data) => {
        setObservedHands(prev => ({
            ...prev,
            [data.targetId]: data.hand
        }));
    };

    const onGameStarted = (data) => {
        setObservedHands({});
        if (data.isSpectator) {
            setIsSpectator(true);
        } else {
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
      handleSwitchAutoPlayMode: (mode) => battleLogic.handleSwitchAutoPlayMode(roomId, mode),
      
      handlePass: () => battleLogic.handlePass(roomId),
      handlePlayCards: () => battleLogic.handlePlayCards(roomId),
      handleRequestHint: () => battleLogic.handleRequestHint(roomId),

      // [新增] 玩家准备
      handlePlayerReady: () => {
          if (socket) socket.emit('player_ready', { roomId });
      },

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
              // 清除本地状态以防自动重连误判
              localStorage.removeItem('poker_roomid');
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
      
      // [新增] 暴露给 UI 的状态
      isRoundOver,
      roundOverData,
      readyPlayers,
      
      ...gameData, 
      ...battleLogic, 
      ...wrappedActions,
      
      handleMouseDown: battleLogic.handleMouseDown,
      handleMouseEnter: battleLogic.handleMouseEnter,
      handleClearSelection: battleLogic.handleClearSelection,
      toggleSort: battleLogic.toggleSort,

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