// 主入口
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// --- 模块化导入 ---
// 请确保你本地已经创建了这些文件
import { sortHand } from './utils/cardLogic';
import SoundManager from './utils/SoundManager';
import { LoginScreen } from './screens/LoginScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';

const SOCKET_URL = 'http://localhost:3001';

export default function App() {
  // --- 核心状态 ---
  const [gameState, setGameState] = useState('LOGIN'); 
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomConfig, setRoomConfig] = useState({ deckCount: 1, maxPlayers: 3, targetScore: 500 });
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

  // --- Refs (用于解决闭包陈旧值问题) ---
  const socketRef = useRef(null);
  const isDragging = useRef(false); 
  const dragStartMode = useRef(true); 
  const sortModeRef = useRef('POINT');
  const usernameRef = useRef(username); // 追踪最新用户名
  const mySocketIdRef = useRef(null);   // 追踪最新SocketID

  // 同步 Ref
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { mySocketIdRef.current = mySocketId; }, [mySocketId]);

  // --- Socket 逻辑 ---
  useEffect(() => {
    const socket = io(SOCKET_URL, { reconnectionAttempts: 5, timeout: 10000 });
    socketRef.current = socket;

    // 全局点击一次以激活 AudioContext (浏览器策略要求)
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
        
        // 🎵 音效：发牌
        SoundManager.play('deal');
    });

    socket.on('game_state_update', (data) => {
        setCurrentTurnId(data.currentTurnId);
        
        // 检测是否有新牌打出 (简单的长度或内容变化检测)
        if (data.lastPlayed && data.lastPlayed.length > 0) {
             // 这里可以加更复杂的判断防止重连时重复播放，暂略
             SoundManager.play('play'); // 🎵 音效：出牌
        }

        if (data.lastPlayed) setLastPlayed(sortHand(data.lastPlayed, sortModeRef.current));
        setLastPlayerName(data.lastPlayerName || '');
        
        if (data.infoText && data.infoText !== 'PASS') {
            setInfoMessage(data.infoText); setTimeout(()=>setInfoMessage(''), 2000);
            setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: data.infoText }]);
        }
        if (data.scores) setPlayerScores(data.scores);
        if (data.pendingPoints !== undefined) setPendingPoints(data.pendingPoints);

        // 🎵 音效：轮到我了
        if (data.currentTurnId === mySocketIdRef.current) {
            // 简单的防抖或逻辑判断，避免频繁提示，这里直接播放
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
        SoundManager.play('lose'); // 🎵 音效：错误/管不上
    }); 
    
    socket.on('round_over', (data) => {
        setRoundResult(data);
        if (data.grandScores) setPlayerScores(data.grandScores);
        
        // 🎵 音效：判断输赢
        const amIWinner = data.roundWinner === usernameRef.current;
        SoundManager.play(amIWinner ? 'win' : 'lose');
    });

    socket.on('grand_game_over', (data) => {
        setGrandResult(data);
        SoundManager.play('win'); // 🎵 音效：大局胜利
    });

    const handleGlobalMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => { socket.disconnect(); window.removeEventListener('mouseup', handleGlobalMouseUp); };
  }, []);

  useEffect(() => {
      sortModeRef.current = sortMode;
      if (myHand.length > 0) setMyHand(prev => sortHand(prev, sortMode));
  }, [sortMode]);

  // --- Handlers ---
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
    SoundManager.play('deal'); // 🎵 音效：点击选牌
  };
  
  const handleMouseEnter = (cardVal) => {
    if (isDragging.current) {
        updateSelection(cardVal, dragStartMode.current);
        // 拖拽时不想太吵，可以注释掉下面这行，或者换个轻微的声音
        // SoundManager.play('deal'); 
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

  // --- Render ---
  if (gameState === 'LOGIN') return <LoginScreen {...{username, setUsername, roomId, setRoomId, roomConfig, setRoomConfig, isCreatorMode, setIsCreatorMode, handleRoomAction, isLoading}} />;
  if (gameState === 'LOBBY') return <LobbyScreen {...{roomId, roomConfig, players, mySocketId, handleStartGame}} />;
  
  return <GameScreen {...{
      roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
      infoMessage, winner: null, playerScores, pendingPoints, gameLogs, sortMode, 
      mySocketId, roundResult, grandResult, roomConfig,
      toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame
  }} />;
}