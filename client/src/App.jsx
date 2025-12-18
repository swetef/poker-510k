import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Smartphone, RefreshCw, AlertCircle } from 'lucide-react'; 

import { sortHand } from './utils/cardLogic.js';
import SoundManager from './utils/SoundManager.js';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { GameScreen } from './screens/GameScreen.jsx';
import { DrawSeatScreen } from './screens/DrawSeatScreen.jsx';

// [核心修复] 重写连接地址判断逻辑
const getSocketUrl = () => {
    const { hostname, protocol, port } = window.location;
    
    // 如果是 HTTPS，通常是线上环境，直接用相对路径
    if (protocol === 'https:') {
        return '/';
    }

    // 1. 本地 localhost/127.0.0.1 环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // 如果当前浏览器端口不是后端端口 (3001)，说明在用 Vite (5173/5174等)，强制指向 3001
        if (port !== '3001') {
            return `${protocol}//${hostname}:3001`;
        }
    }
    
    // 2. 局域网 IP 访问 (192.168.x.x 等)
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        // 同理，如果不是 3001 端口，强制指向 3001
        if (port !== '3001') {
            return `${protocol}//${hostname}:3001`;
        }
    }
    
    // 3. 其他情况 (生产环境，或者就是运行在 3001 上)
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
      rankPenaltyScores: [30, 15],
      showCardCountMode: 1, 
      isTeamMode: false,
      enableDrawSeat: false 
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
  const [finishedRank, setFinishedRank] = useState([]); 
  
  const [pendingPoints, setPendingPoints] = useState(0);
  const [gameLogs, setGameLogs] = useState([]);

  const [sortMode, setSortMode] = useState('POINT'); 
  const [isConnected, setIsConnected] = useState(false); 
  const [mySocketId, setMySocketId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [turnRemaining, setTurnRemaining] = useState(60); 
  const [handCounts, setHandCounts] = useState({});

  const [drawState, setDrawState] = useState(null); 

  const socketRef = useRef(null);
  const isDragging = useRef(false); 
  const dragStartMode = useRef(true); 
  const sortModeRef = useRef('POINT');
  const usernameRef = useRef(username); 
  const mySocketIdRef = useRef(null);   
  
  const roomIdRef = useRef(roomId);
  
  const backupHandRef = useRef([]);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { mySocketIdRef.current = mySocketId; }, [mySocketId]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // [修改] 整合后的连接逻辑
  const connectSocket = () => {
    if (socketRef.current) {
        socketRef.current.disconnect();
    }

    console.log(`正在连接服务器: ${SOCKET_URL}`);
    
    // [修复] 移除 transports: ['websocket'] 强制配置
    // 允许 Socket.io 自动协商 (Polling -> WebSocket)，解决 "WebSocket closed before connection established" 报错
    const socket = io(SOCKET_URL, { 
        reconnectionAttempts: 20,   
        reconnectionDelay: 2000,    
        timeout: 20000,
        // transports: ['websocket'], // <--- 已注释掉
        autoConnect: true
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
        console.log("Socket 连接成功!");
        setIsConnected(true); 
        
        if (roomIdRef.current && usernameRef.current) {
             console.log(`[Auto-Rejoin] 自动恢复身份: ${usernameRef.current} @ Room ${roomIdRef.current}`);
             socket.emit('join_room', { 
                 roomId: roomIdRef.current, 
                 username: usernameRef.current 
             });
        }
    });
    
    socket.on('disconnect', () => {
        console.log("Socket 断开连接");
        setIsConnected(false); 
    });
    
    socket.on('connect_error', (err) => {
        console.warn("连接错误 (详细):", err.message);
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
        
        if (gameState !== 'GAME' && gameState !== 'DRAW_SEATS') {
             setGameState('LOBBY'); 
        }
        setIsLoading(false);
    });

    socket.on('enter_draw_phase', (data) => {
        setDrawState({ 
            totalCards: data.totalCards, 
            history: [] 
        });
        setGameState('DRAW_SEATS');
        SoundManager.play('deal');
    });

    socket.on('seat_draw_update', (data) => {
        setDrawState(prev => ({
            ...prev,
            history: [...prev.history, data]
        }));
        SoundManager.play('deal'); 
    });

    socket.on('seat_draw_finished', (data) => {
        setPlayers(data.players); 
    });

    socket.on('game_started', (data) => {
        if (data.hand) {
            setMyHand(sortHand(data.hand, sortModeRef.current));
        }
        setLastPlayed([]);
        setRoundResult(null);
        setGrandResult(null);
        setPendingPoints(0);
        setFinishedRank([]); 
        if (data.grandScores) setPlayerScores(data.grandScores);
        setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: '🏁 新一局开始！' }]); 
        setGameState('GAME');
        setTurnRemaining(60);
        setPlayersInfo({});
        if (data.handCounts) setHandCounts(data.handCounts);
        SoundManager.play('deal');
        backupHandRef.current = []; 
    });

    socket.on('game_state_update', (data) => {
        setCurrentTurnId(data.currentTurnId);
        
        if (data.turnRemaining !== undefined) {
             setTurnRemaining(data.turnRemaining);
        }

        if (data.lastPlayed && data.lastPlayed.length > 0) {
             if (data.lastPlayerName !== usernameRef.current) {
                SoundManager.play('play'); 
             }
        }

        if (data.lastPlayed) setLastPlayed(sortHand(data.lastPlayed, sortModeRef.current));
        setLastPlayerName(data.lastPlayerName || '');
        
        if (data.infoText && data.infoText !== 'PASS') {
            setInfoMessage(data.infoText); setTimeout(()=>setInfoMessage(''), 2000);
            setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: data.infoText }]);
        }
        if (data.scores) setPlayerScores(data.scores);
        if (data.playersInfo) setPlayersInfo(data.playersInfo);
        if (data.handCounts) setHandCounts(data.handCounts);
        if (data.finishedRank) setFinishedRank(data.finishedRank);
        if (data.pendingPoints !== undefined) setPendingPoints(data.pendingPoints);

        if (data.currentTurnId === mySocketIdRef.current) {
            SoundManager.play('alert');
        }
    });

    socket.on('hand_update', (newHand) => {
        setMyHand(sortHand(newHand, sortModeRef.current)); 
        setSelectedCards([]);
        backupHandRef.current = [];
    });

    socket.on('play_error', (msg) => { 
        setInfoMessage(msg); 
        setTimeout(()=>setInfoMessage(''), 2000); 
        SoundManager.play('lose'); 
        
        if (backupHandRef.current.length > 0) {
            setMyHand(backupHandRef.current);
            backupHandRef.current = [];
            setInfoMessage("出牌无效，手牌已回滚");
        }
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
  };

  useEffect(() => {
    connectSocket();

    const initAudio = () => {
        SoundManager.init();
        window.removeEventListener('click', initAudio);
    };
    window.addEventListener('click', initAudio);

    const handleGlobalMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => { 
        if (socketRef.current) socketRef.current.disconnect(); 
        window.removeEventListener('mouseup', handleGlobalMouseUp); 
    };
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

  const handleSwitchSeat = (index1, index2) => {
      if (!isCreatorMode && !players.find(p=>p.id===mySocketId)?.isHost) return;
      socketRef.current.emit('switch_seat', { roomId, index1, index2 });
  };
  
  const handleDrawCard = (index) => {
      socketRef.current.emit('draw_seat_card', { roomId, cardIndex: index });
  };

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
    const cardsToPlay = [...selectedCards];
    backupHandRef.current = [...myHand];
    const nextHand = myHand.filter(c => !cardsToPlay.includes(c));
    setMyHand(nextHand);
    setLastPlayed(sortHand(cardsToPlay, sortModeRef.current));
    setLastPlayerName(username); 
    setSelectedCards([]); 
    SoundManager.play('play');
    socketRef.current.emit('play_cards', { roomId, cards: cardsToPlay });
  };
  
  const handlePass = () => {
    socketRef.current.emit('pass_turn', { roomId });
    setSelectedCards([]);
  };

  const renderLandscapeHint = () => (
      <div className="landscape-hint">
          <div className="phone-rotate-icon"></div>
          <h3 style={{marginBottom: 10, fontSize: 18}}>建议使用横屏游玩</h3>
          <p style={{fontSize: 14, opacity: 0.8, maxWidth: 250}}>
              510K 需要较大的展示空间。<br/>
              请旋转您的手机以获得最佳体验。
          </p>
          <button 
            style={{marginTop: 20, padding: '8px 20px', background: 'rgba(255,255,255,0.2)', color:'white', border:'1px solid white'}}
            onClick={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
          >
              我非要竖屏玩
          </button>
      </div>
  );

  const renderDisconnectAlert = () => (
      !isConnected && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: '#e74c3c', color: 'white', padding: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
              <AlertCircle size={20} />
              <span style={{fontWeight: 'bold'}}>连接已断开，正在尝试重连...</span>
              <button 
                onClick={() => window.location.reload()} 
                style={{
                    background: 'white', color: '#e74c3c', border: 'none', 
                    borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 'bold',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                  <RefreshCw size={12} /> 刷新重连
              </button>
          </div>
      )
  );

  return (
    <>
      {renderDisconnectAlert()}
      {renderLandscapeHint()}
      
      {gameState === 'LOGIN' && <LoginScreen {...{
          username, setUsername, 
          roomId, setRoomId, 
          roomConfig, setRoomConfig, 
          isCreatorMode, setIsCreatorMode, 
          handleRoomAction, 
          isLoading,
          isConnected 
      }} />}
      
      {gameState === 'LOBBY' && <LobbyScreen {...{
          roomId, roomConfig, players, mySocketId, 
          handleStartGame, 
          handleAddBot,
          handleSwitchSeat 
      }} />}
      
      {gameState === 'DRAW_SEATS' && <DrawSeatScreen {...{
          roomId, players, mySocketId,
          drawState, handleDrawCard,
          roomConfig 
      }} />}
      
      {gameState === 'GAME' && <GameScreen {...{
          roomId, players, myHand, selectedCards, lastPlayed, lastPlayerName, currentTurnId, 
          infoMessage, winner: null, playerScores, playersInfo, pendingPoints, gameLogs, sortMode, 
          mySocketId, roundResult, grandResult, roomConfig,
          turnRemaining, finishedRank, handCounts, 
          toggleSort, handleMouseDown, handleMouseEnter, handlePlayCards, handlePass, handleNextRound, handleStartGame,
          handleToggleAutoPlay 
      }} />}
    </>
  );
}