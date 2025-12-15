// 主入口 - 修复了引用路径，添加了 .js/.jsx 后缀
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// [修复] 添加显式后缀名以解决编译错误
import { sortHand } from './utils/cardLogic.js';
import SoundManager from './utils/SoundManager.js';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { GameScreen } from './screens/GameScreen.jsx';

const SOCKET_URL = 'http://localhost:3001';

export default function App() {
  const [gameState, setGameState] = useState('LOGIN'); 
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  
  // 初始配置增加 turnTimeout，默认 60s
  const [roomConfig, setRoomConfig] = useState({ 
      deckCount: 2,          // 默认改为2副牌，更适合多人
      maxPlayers: 4,         // 默认4人
      targetScore: 1000,     // 默认1000分
      turnTimeout: 60000     // 默认60秒
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
    const socket = io(SOCKET_URL, { reconnectionAttempts: 5, timeout: 10000 });
    socketRef.current = socket;

    const initAudio = () => {
        SoundManager.init();
        window.removeEventListener('click', initAudio);
    };
    window.addEventListener('click', initAudio);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
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
        setMyHand(sortHand(data.hand, sortModeRef.current));
        setLastPlayed([]);
        setRoundResult(null);
        setGrandResult(null);
        setPendingPoints(0);
        if (data.grandScores) setPlayerScores(data.grandScores);
        setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: '🏁 新一局开始！' }]); 
        setGameState('GAME');
        setTurnRemaining(60);
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
      if (!isConnected) return alert("未连接服务器");
      if (!username || !roomId) return alert("请输入信息");
      setIsLoading(true);
      const event = isCreatorMode ? 'create_room' : 'join_room';
      const payload = isCreatorMode ? { roomId, username, config: roomConfig } : { roomId, username };
      socketRef.current.emit(event, payload);
  };
  
  const handleStartGame = () => socketRef.current.emit('start_game', { roomId });
  const handleNextRound = () => socketRef.current.emit('next_round', { roomId });
  
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

  if (gameState === 'LOGIN') return <LoginScreen {...{username, setUsername, roomId, setRoomId, roomConfig, setRoomConfig, isCreatorMode, setIsCreatorMode, handleRoomAction, isLoading}} />;
  if (gameState === 'LOBBY') return <LobbyScreen {...{roomId, roomConfig, players, mySocketId, handleStartGame}} />;
  
  return <GameScreen {...{
      roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
      infoMessage, winner: null, playerScores, pendingPoints, gameLogs, sortMode, 
      mySocketId, roundResult, grandResult, roomConfig,
      turnRemaining, 
      toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame
  }} />;
}