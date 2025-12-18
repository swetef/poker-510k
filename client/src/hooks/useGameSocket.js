import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { sortHand } from '../utils/cardLogic.js';
import SoundManager from '../utils/SoundManager.js';

// 连接地址判断逻辑
const getSocketUrl = () => {
    const { hostname, protocol, port } = window.location;
    if (protocol === 'https:') { return '/'; }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (port !== '3001') { return `${protocol}//${hostname}:3001`; }
    }
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        if (port !== '3001') { return `${protocol}//${hostname}:3001`; }
    }
    return '/';
};

const SOCKET_URL = getSocketUrl();

export const useGameSocket = () => {
    // --- 状态定义 ---
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
    const [roundPoints, setRoundPoints] = useState({});

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

    // [新增] 提示缓存状态
    const [availableHints, setAvailableHints] = useState([]); // 缓存所有提示方案
    const [hintIndex, setHintIndex] = useState(0);            // 当前显示的索引
    const lastHintRef = useRef({ turnId: null, lastPlayed: [] }); // 用于验证缓存是否过期

    // --- Refs ---
    const socketRef = useRef(null);
    const isDragging = useRef(false); 
    const dragStartMode = useRef(true); 
    const sortModeRef = useRef('POINT');
    const usernameRef = useRef(username); 
    const mySocketIdRef = useRef(null);   
    const roomIdRef = useRef(roomId);
    
    // [关键修复] 增加 lastPlayedRef，确保 Socket 闭包中能拿到最新的 lastPlayed
    const lastPlayedRef = useRef(lastPlayed); 
    
    const backupHandRef = useRef([]);

    // --- 监听 Effect ---
    useEffect(() => { usernameRef.current = username; }, [username]);
    useEffect(() => { mySocketIdRef.current = mySocketId; }, [mySocketId]);
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
    
    // [关键修复] 同步 Ref
    useEffect(() => { lastPlayedRef.current = lastPlayed; }, [lastPlayed]); 

    useEffect(() => {
        sortModeRef.current = sortMode;
        if (myHand.length > 0) setMyHand(prev => sortHand(prev, sortMode));
    }, [sortMode]);

    // --- Socket 连接逻辑 ---
    const connectSocket = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        console.log(`正在连接服务器: ${SOCKET_URL}`);
        
        const socket = io(SOCKET_URL, { 
            reconnectionAttempts: 20,   
            reconnectionDelay: 2000,    
            timeout: 20000,
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
            setRoundPoints({});

            setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: '🏁 新一局开始！' }]); 
            setGameState('GAME');
            setTurnRemaining(60);
            setPlayersInfo({});
            if (data.handCounts) setHandCounts(data.handCounts);
            
            // 清空提示缓存
            setAvailableHints([]);
            setHintIndex(0);

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

            // [关键修改] 使用 JSON 比较来检测 lastPlayed 是否真的变了
            // 如果上家出牌变了，或者轮次变了，清空提示缓存
            // 注意：这里我们使用 Ref 的当前值来比较，虽然在这里直接用 data.lastPlayed 也是新的，
            // 但为了逻辑一致性，我们主要关注的是“缓存失效”的时机。
            if (data.lastPlayed) {
                const newPlayedStr = JSON.stringify(data.lastPlayed);
                const oldPlayedStr = JSON.stringify(lastHintRef.current.lastPlayed);
                if (newPlayedStr !== oldPlayedStr) {
                    setAvailableHints([]);
                    setHintIndex(0);
                }
            } else if (data.lastPlayed === null || (Array.isArray(data.lastPlayed) && data.lastPlayed.length === 0)) {
                // 如果桌上清空了（比如新一轮），也清空缓存
                if (lastHintRef.current.lastPlayed.length > 0) {
                    setAvailableHints([]);
                    setHintIndex(0);
                }
            }

            if (data.lastPlayed) setLastPlayed(sortHand(data.lastPlayed, sortModeRef.current));
            setLastPlayerName(data.lastPlayerName || '');
            
            if (data.infoText && data.infoText !== 'PASS') {
                setInfoMessage(data.infoText); setTimeout(()=>setInfoMessage(''), 2000);
                setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: data.infoText }]);
            }
            if (data.scores) setPlayerScores(data.scores);
            if (data.roundPoints) setRoundPoints(data.roundPoints);

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
            // 手牌变了，之前的提示肯定无效了
            setAvailableHints([]);
            setHintIndex(0);
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

        // [修改] 监听提示返回 - 处理多组解
        socket.on('hint_response', (hints) => {
            if (hints && hints.length > 0) {
                // 缓存提示列表
                setAvailableHints(hints);
                setHintIndex(0);
                
                // 立即展示第一个
                setSelectedCards(hints[0]);
                
                // 记录状态用于校验
                lastHintRef.current = {
                    turnId: mySocketIdRef.current, // 记录是我的回合请求的
                    // [关键修复] 使用 lastPlayedRef.current 而不是 lastPlayed (闭包陷阱)
                    lastPlayed: [...lastPlayedRef.current] 
                };
                
                // 为了调试，可以打印一下
                // console.log("Hint received, cached for:", lastPlayedRef.current);
            } else {
                setInfoMessage('没有打得过的牌');
                setTimeout(()=>setInfoMessage(''), 1000);
            }
        });
    };

    // --- 初始化 Effect ---
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

    // --- 交互处理函数 ---
    const toggleSort = () => setSortMode(prev => prev === 'POINT' ? 'ARRANGE' : 'POINT');

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

    const handleUpdateConfig = (newConfig) => {
        socketRef.current.emit('update_room_config', { roomId, config: newConfig });
    };

    const updateSelection = (cardVal, forceSelect = null) => {
        setSelectedCards(prev => {
            const isSelected = prev.includes(cardVal);
            if (forceSelect !== null) return forceSelect && !isSelected ? [...prev, cardVal] : (!forceSelect && isSelected ? prev.filter(c => c !== cardVal) : prev);
            return isSelected ? prev.filter(c => c !== cardVal) : [...prev, cardVal];
        });
    };

    const handleClearSelection = () => {
        setSelectedCards([]);
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
    
    const handleKickPlayer = (targetId) => {
        if (socketRef.current) {
            socketRef.current.emit('kick_player', { roomId, targetId });
        }
    };

    // [修改] 请求提示 - 支持循环切换
    const handleRequestHint = () => {
        // 1. 检查缓存是否有效
        // 必须是我的回合，且上家出的牌没变 (使用 JSON 字符串比较)
        const isCacheValid = 
            availableHints.length > 0 && 
            currentTurnId === mySocketIdRef.current &&
            JSON.stringify(lastPlayed) === JSON.stringify(lastHintRef.current.lastPlayed);

        if (isCacheValid) {
            // 2. 有缓存，切下一个
            const nextIndex = (hintIndex + 1) % availableHints.length;
            setHintIndex(nextIndex);
            setSelectedCards(availableHints[nextIndex]);
        } else {
            // 3. 无缓存，请求新的
            setAvailableHints([]); // 清空旧的
            socketRef.current.emit('request_hint', { roomId });
        }
    };

    return {
        // State
        gameState, username, roomId, roomConfig, isCreatorMode,
        players, myHand, selectedCards, lastPlayed,
        currentTurnId, lastPlayerName, infoMessage,
        roundResult, grandResult, playerScores, roundPoints,
        playersInfo, finishedRank, pendingPoints, gameLogs,
        sortMode, isConnected, mySocketId, isLoading,
        turnRemaining, handCounts, drawState,

        // Setters
        setUsername, setRoomId, setRoomConfig, setIsCreatorMode,

        // Actions
        toggleSort, handleRoomAction, handleStartGame, handleNextRound,
        handleAddBot, handleToggleAutoPlay, handleSwitchSeat, handleDrawCard,
        handleUpdateConfig, handleClearSelection, handleMouseDown,
        handleMouseEnter, handlePlayCards, handlePass, handleKickPlayer, handleRequestHint
    };
};