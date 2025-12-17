import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Smartphone } from 'lucide-react'; 

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
      rankPenaltyScores: [30, 15],
      showCardCountMode: 1, // 默认：少于3张显示
      isTeamMode: false     // 组队模式
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

  // 用于存储每个玩家的剩余牌数
  const [handCounts, setHandCounts] = useState({});

  const socketRef = useRef(null);
  const isDragging = useRef(false); 
  const dragStartMode = useRef(true); 
  const sortModeRef = useRef('POINT');
  const usernameRef = useRef(username); 
  const mySocketIdRef = useRef(null);   
  
  // [新增] 用于乐观更新失败时的回滚备份
  const backupHandRef = useRef([]);

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
        setFinishedRank([]); 
        if (data.grandScores) setPlayerScores(data.grandScores);
        setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: '🏁 新一局开始！' }]); 
        setGameState('GAME');
        setTurnRemaining(60);
        setPlayersInfo({});
        // 初始牌数
        if (data.handCounts) setHandCounts(data.handCounts);
        SoundManager.play('deal');
        backupHandRef.current = []; // 新局开始清空备份
    });

    socket.on('game_state_update', (data) => {
        setCurrentTurnId(data.currentTurnId);
        
        if (data.turnRemaining !== undefined) {
             setTurnRemaining(data.turnRemaining);
        }

        // [修改] 只有当出牌人不是自己时，才播放出牌音效
        // 因为如果是自己，点击按钮的瞬间已经在本地播放过了 (防止重音和延迟)
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
        
        // 更新手牌数
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
        // 服务器确认手牌更新了，说明操作成功，清空备份
        backupHandRef.current = [];
    });

    socket.on('play_error', (msg) => { 
        setInfoMessage(msg); 
        setTimeout(()=>setInfoMessage(''), 2000); 
        SoundManager.play('lose'); 
        
        // [新增] 发生错误（如牌型不对/网络错误），回滚本地手牌
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

  const handleSwitchSeat = (index1, index2) => {
      if (!isCreatorMode && !players.find(p=>p.id===mySocketId)?.isHost) return;
      socketRef.current.emit('switch_seat', { roomId, index1, index2 });
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

  // [修改] 乐观更新版出牌函数
  const handlePlayCards = () => {
    if (selectedCards.length === 0) return alert("请先选牌");
    
    // 1. 复制要出的牌
    const cardsToPlay = [...selectedCards];

    // 2. 备份当前手牌，万一服务器报错，用于回滚
    backupHandRef.current = [...myHand];

    // 3. 【乐观更新】立即从 UI 上移除手牌
    const nextHand = myHand.filter(c => !cardsToPlay.includes(c));
    setMyHand(nextHand);

    // 4. 【乐观更新】立即在桌面上显示刚出的牌 (为了好看，本地也排个序)
    setLastPlayed(sortHand(cardsToPlay, sortModeRef.current));
    setLastPlayerName(username); // 临时显示自己的名字
    setSelectedCards([]); // 清空选中状态

    // 5. 【无延迟】立即播放音效
    SoundManager.play('play');

    // 6. 最后再发送给服务器
    socketRef.current.emit('play_cards', { roomId, cards: cardsToPlay });
  };
  
  const handlePass = () => {
    // 不要（Pass）通常不需要乐观更新，因为没有复杂的视觉变化
    socketRef.current.emit('pass_turn', { roomId });
    setSelectedCards([]);
  };

  // --- Render Helpers ---

  // 横屏引导层
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

  return (
    <>
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