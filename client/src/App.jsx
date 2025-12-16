import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

import { sortHand } from './utils/cardLogic.js';
import SoundManager from './utils/SoundManager.js';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { GameScreen } from './screens/GameScreen.jsx';

const getSocketUrl = () => {
    const { hostname, protocol } = window.location;
    const isLocal = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.');
    if (isLocal) {
        return `${protocol}//${hostname}:3001`;
    }
    return '/';
};

const SOCKET_URL = getSocketUrl();

export default function App() {
  const [gameState, setGameState] = useState('LOGIN'); 
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  
  const [roomConfig, setRoomConfig] = useState({ 
      deckCount: 2,          
      maxPlayers: 4,         
      targetScore: 1000,     
      turnTimeout: 60000,
      enableRankPenalty: false,    
      rankPenaltyScores: [30, 15]  
  });
  
  const [isCreatorMode, setIsCreatorMode] = useState(false); 

  const [players, setPlayers] = useState([]);     
  const [myHand, setMyHand] = useState([]);       
  const [selectedCards, setSelectedCards] = useState([]); 
  const [lastPlayed, setLastPlayed] = useState([]); 
  const [currentTurnId, setCurrentTurnId] = useState(null); 
  const [lastPlayerName, setLastPlayerName] = useState(''); 
  const [infoMessage, setInfoMessage] = useState(''); 
  
  const [roundResult, setRoundResult] = useState(null); 
  const [grandResult, setGrandResult] = useState(null); 
  const [playerScores, setPlayerScores] = useState({});
  const [playersInfo, setPlayersInfo] = useState({});
  const [finishedRank, setFinishedRank] = useState([]); // [新增] 存储已完成玩家的 ID 列表
  
  const [pendingPoints, setPendingPoints] = useState(0);
  const [gameLogs, setGameLogs] = useState([]);

  const [sortMode, setSortMode] = useState('POINT'); 
  const [isConnected, setIsConnected] = useState(false); 
  const [mySocketId, setMySocketId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [turnRemaining, setTurnRemaining] = useState(60); 

  const socketRef = useRef(null);
  const isDragging = useRef(false); 
  const dragStartMode = useRef(true); 
  const sortModeRef = useRef('POINT');
  const usernameRef = useRef(username); 
  const mySocketIdRef = useRef(null);   

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { mySocketIdRef.current = mySocketId; }, [mySocketId]);

  useEffect(() => {
    console.log(`正在连接服务器: ${SOCKET_URL}`);
    
    const socket = io(SOCKET_URL, { 
        reconnectionAttempts: 10,   
        reconnectionDelay: 1000,    
        timeout: 20000,             
        transports: ['websocket', 'polling'] 
    });
    
    socketRef.current = socket;

    const initAudio = () => {
        SoundManager.init();
        window.removeEventListener('click', initAudio);
    };
    window.addEventListener('click', initAudio);

    socket.on('connect', () => {
        console.log("Socket 连接成功!");
        setIsConnected(true); 
    });
    
    socket.on('disconnect', () => {
        console.log("Socket 断开连接");
        setIsConnected(false); 
    });
    
    socket.on('connect_error', (err) => {
        console.warn("连接错误:", err);
    });

    socket.on('your_id', (id) => {
        setMySocketId(id);
        mySocketIdRef.current = id;
    });
    socket.on('error_msg', (msg) => { setIsLoading(false); alert(msg); });

    socket.on('room_info', (data) => {
        setRoomId(data.roomId);
        setRoomConfig(data.config);
        setPlayers(data.players);
        setGameState('LOBBY'); 
        setIsLoading(false);
    });

    socket.on('game_started', (data) => {
        if (data.hand) {
            setMyHand(sortHand(data.hand, sortModeRef.current));
        }
        setLastPlayed([]);
        setRoundResult(null);
        setGrandResult(null);
        setPendingPoints(0);
        setFinishedRank([]); // [新增] 新的一局开始，清空排名
        if (data.grandScores) setPlayerScores(data.grandScores);
        setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: '🏁 新一局开始！' }]); 
        setGameState('GAME');
        setTurnRemaining(60);
        setPlayersInfo({});
        SoundManager.play('deal');
    });

    socket.on('game_state_update', (data) => {
        setCurrentTurnId(data.currentTurnId);
        
        if (data.turnRemaining !== undefined) {
             setTurnRemaining(data.turnRemaining);
        }

        if (data.lastPlayed && data.lastPlayed.length > 0) {
             SoundManager.play('play'); 
        }

        if (data.lastPlayed) setLastPlayed(sortHand(data.lastPlayed, sortModeRef.current));
        setLastPlayerName(data.lastPlayerName || '');
        
        if (data.infoText && data.infoText !== 'PASS') {
            setInfoMessage(data.infoText); setTimeout(()=>setInfoMessage(''), 2000);
            setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: data.infoText }]);
        }
        if (data.scores) setPlayerScores(data.scores);
        if (data.playersInfo) setPlayersInfo(data.playersInfo);
        
        // [新增] 接收 finishedRank
        if (data.finishedRank) setFinishedRank(data.finishedRank);

        if (data.pendingPoints !== undefined) setPendingPoints(data.pendingPoints);

        if (data.currentTurnId === mySocketIdRef.current) {
            SoundManager.play('alert');
        }
    });

    socket.on('hand_update', (newHand) => {
        setMyHand(sortHand(newHand, sortModeRef.current)); 
        setSelectedCards([]);
    });

    socket.on('play_error', (msg) => { 
        setInfoMessage(msg); 
        setTimeout(()=>setInfoMessage(''), 2000); 
        SoundManager.play('lose'); 
    }); 
    
    socket.on('round_over', (data) => {
        setRoundResult(data);
        if (data.grandScores) setPlayerScores(data.grandScores);
        const amIWinner = data.roundWinner === usernameRef.current;
        SoundManager.play(amIWinner ? 'win' : 'lose');
    });

    socket.on('grand_game_over', (data) => {
        setGrandResult(data);
        SoundManager.play('win'); 
    });

    const handleGlobalMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => { socket.disconnect(); window.removeEventListener('mouseup', handleGlobalMouseUp); };
  }, []);

  useEffect(() => {
      sortModeRef.current = sortMode;
      if (myHand.length > 0) setMyHand(prev => sortHand(prev, sortMode));
  }, [sortMode]);

  const toggleSort = () => setSortMode(prev => prev === 'POINT' ? 'SUIT' : 'POINT');
  
  const handleRoomAction = () => {
      if (!isConnected) return; 
      if (!username || !roomId) return alert("请输入昵称和房间号");
      setIsLoading(true);
      const event = isCreatorMode ? 'create_room' : 'join_room';
      const payload = isCreatorMode ? { roomId, username, config: roomConfig } : { roomId, username };
      socketRef.current.emit(event, payload);
  };
  
  const handleStartGame = () => socketRef.current.emit('start_game', { roomId });
  const handleNextRound = () => socketRef.current.emit('next_round', { roomId });
  const handleAddBot = () => socketRef.current.emit('add_bot', { roomId });
  
  const handleToggleAutoPlay = () => socketRef.current.emit('toggle_auto_play', { roomId });

  const updateSelection = (cardVal, forceSelect = null) => {
    setSelectedCards(prev => {
        const isSelected = prev.includes(cardVal);
        if (forceSelect !== null) return forceSelect && !isSelected ? [...prev, cardVal] : (!forceSelect && isSelected ? prev.filter(c => c !== cardVal) : prev);
        return isSelected ? prev.filter(c => c !== cardVal) : [...prev, cardVal];
    });
  };

  const handleMouseDown = (cardVal) => {
    isDragging.current = true;
    dragStartMode.current = !selectedCards.includes(cardVal); 
    updateSelection(cardVal, dragStartMode.current);
    SoundManager.play('deal'); 
  };
  
  const handleMouseEnter = (cardVal) => {
    if (isDragging.current) {
        updateSelection(cardVal, dragStartMode.current);
    }
  };

  const handlePlayCards = () => {
    if (selectedCards.length === 0) return alert("请先选牌");
    socketRef.current.emit('play_cards', { roomId, cards: selectedCards });
  };
  
  const handlePass = () => {
    socketRef.current.emit('pass_turn', { roomId });
    setSelectedCards([]);
  };

  if (gameState === 'LOGIN') return <LoginScreen {...{
      username, setUsername, 
      roomId, setRoomId, 
      roomConfig, setRoomConfig, 
      isCreatorMode, setIsCreatorMode, 
      handleRoomAction, 
      isLoading,
      isConnected 
  }} />;
  
  if (gameState === 'LOBBY') return <LobbyScreen {...{
      roomId, roomConfig, players, mySocketId, 
      handleStartGame, 
      handleAddBot 
  }} />;
  
  return <GameScreen {...{
      roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
      infoMessage, winner: null, playerScores, playersInfo, pendingPoints, gameLogs, sortMode, 
      mySocketId, roundResult, grandResult, roomConfig,
      turnRemaining, finishedRank, // [新增] 传递 finishedRank
      toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
      handleToggleAutoPlay 
  }} />;
}