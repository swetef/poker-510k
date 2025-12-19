import { useState, useEffect, useRef } from 'react';
import { sortHand } from '../utils/cardLogic.js';
import SoundManager from '../utils/SoundManager.js';
// [新增] 引入连接 Hook
import { useSocketConnection } from './useSocketConnection.js';

export const useGameSocket = () => {
    // 1. 获取基础连接能力
    const { socket, isConnected, mySocketId } = useSocketConnection();

    // [调试] 监听 Socket 注入状态，方便排查问题
    useEffect(() => {
        if (!socket) {
            console.log("[GameSocket] 等待 Socket 初始化...");
        } else {
            console.log(`[GameSocket] Socket 就绪, ID: ${mySocketId}, 已连接: ${isConnected}`);
        }
    }, [socket, isConnected, mySocketId]);

    // --- 游戏状态定义 (保持不变) ---
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
    const [isLoading, setIsLoading] = useState(false);

    const [turnRemaining, setTurnRemaining] = useState(60); 
    const [handCounts, setHandCounts] = useState({});

    const [drawState, setDrawState] = useState(null); 

    // 提示缓存状态
    const [availableHints, setAvailableHints] = useState([]); 
    const [hintIndex, setHintIndex] = useState(0);            
    const lastHintRef = useRef({ turnId: null, lastPlayed: [] }); 

    // --- Refs ---
    const isDragging = useRef(false); 
    const dragStartMode = useRef(true); 
    const sortModeRef = useRef('POINT');
    const usernameRef = useRef(username); 
    const mySocketIdRef = useRef(mySocketId); // Sync with prop
    const roomIdRef = useRef(roomId);
    
    const lastPlayedRef = useRef(lastPlayed); 
    const backupHandRef = useRef([]);

    // --- 监听 Effect ---
    useEffect(() => { usernameRef.current = username; }, [username]);
    useEffect(() => { mySocketIdRef.current = mySocketId; }, [mySocketId]);
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
    useEffect(() => { lastPlayedRef.current = lastPlayed; }, [lastPlayed]); 
    
    useEffect(() => {
        sortModeRef.current = sortMode;
        if (myHand.length > 0) setMyHand(prev => sortHand(prev, sortMode));
    }, [sortMode]);

    // [重构] 自动重连逻辑：当连接恢复时，尝试重新加入房间
    useEffect(() => {
        if (isConnected && socket && roomIdRef.current && usernameRef.current) {
            console.log(`[Auto-Rejoin] 自动恢复身份: ${usernameRef.current} @ Room ${roomIdRef.current}`);
            socket.emit('join_room', { 
                roomId: roomIdRef.current, 
                username: usernameRef.current 
            });
        }
    }, [isConnected, socket]); // 依赖 isConnected 变化

    // --- 游戏业务事件监听 ---
    useEffect(() => {
        if (!socket) return;

        // 定义所有处理函数
        const onErrorMsg = (msg) => { setIsLoading(false); alert(msg); };

        const onRoomInfo = (data) => {
            setRoomId(data.roomId);
            setRoomConfig(data.config);
            setPlayers(data.players);
            
            if (gameState !== 'GAME' && gameState !== 'DRAW_SEATS') {
                setGameState('LOBBY'); 
            }
            setIsLoading(false);
        };

        const onEnterDrawPhase = (data) => {
            setDrawState({ totalCards: data.totalCards, history: [] });
            setGameState('DRAW_SEATS');
            SoundManager.play('deal');
        };

        const onSeatDrawUpdate = (data) => {
            setDrawState(prev => ({ ...prev, history: [...prev.history, data] }));
            SoundManager.play('deal'); 
        };

        const onSeatDrawFinished = (data) => {
            setPlayers(data.players); 
        };

        const onGameStarted = (data) => {
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
            
            setAvailableHints([]);
            setHintIndex(0);

            SoundManager.play('deal');
            backupHandRef.current = []; 
        };

        const onGameStateUpdate = (data) => {
            setCurrentTurnId(data.currentTurnId);
            
            if (data.turnRemaining !== undefined) {
                setTurnRemaining(data.turnRemaining);
            }

            if (data.lastPlayed && data.lastPlayed.length > 0) {
                if (data.lastPlayerName !== usernameRef.current) {
                    SoundManager.play('play'); 
                }
            }

            // 缓存失效检测
            if (data.lastPlayed) {
                const newPlayedStr = JSON.stringify(data.lastPlayed);
                const oldPlayedStr = JSON.stringify(lastHintRef.current.lastPlayed);
                if (newPlayedStr !== oldPlayedStr) {
                    setAvailableHints([]);
                    setHintIndex(0);
                }
            } else if (data.lastPlayed === null || (Array.isArray(data.lastPlayed) && data.lastPlayed.length === 0)) {
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
        };

        const onHandUpdate = (newHand) => {
            setMyHand(sortHand(newHand, sortModeRef.current)); 
            setSelectedCards([]);
            setAvailableHints([]);
            setHintIndex(0);
            backupHandRef.current = [];
        };

        const onPlayError = (msg) => { 
            setInfoMessage(msg); 
            setTimeout(()=>setInfoMessage(''), 2000); 
            SoundManager.play('lose'); 
            
            if (backupHandRef.current.length > 0) {
                setMyHand(backupHandRef.current);
                backupHandRef.current = [];
                setInfoMessage("出牌无效，手牌已回滚");
            }
        }; 
        
        // [修改] 增加延迟，以便展示最后一手牌
        const onRoundOver = (data) => {
            setTimeout(() => {
                setRoundResult(data);
                if (data.grandScores) setPlayerScores(data.grandScores);
                const amIWinner = data.roundWinner === usernameRef.current;
                SoundManager.play(amIWinner ? 'win' : 'lose');
            }, 3000);
        };

        // [修改] 增加延迟
        const onGrandGameOver = (data) => {
             setTimeout(() => {
                setGrandResult(data);
                SoundManager.play('win'); 
             }, 3000);
        };

        const onHintResponse = (hints) => {
            if (hints && hints.length > 0) {
                setAvailableHints(hints);
                setHintIndex(0);
                setSelectedCards(hints[0]);
                lastHintRef.current = {
                    turnId: mySocketIdRef.current, 
                    lastPlayed: [...lastPlayedRef.current] 
                };
            } else {
                setInfoMessage('没有打得过的牌');
                setTimeout(()=>setInfoMessage(''), 1000);
            }
        };

        // 绑定事件
        socket.on('error_msg', onErrorMsg);
        socket.on('room_info', onRoomInfo);
        socket.on('enter_draw_phase', onEnterDrawPhase);
        socket.on('seat_draw_update', onSeatDrawUpdate);
        socket.on('seat_draw_finished', onSeatDrawFinished);
        socket.on('game_started', onGameStarted);
        socket.on('game_state_update', onGameStateUpdate);
        socket.on('hand_update', onHandUpdate);
        socket.on('play_error', onPlayError);
        socket.on('round_over', onRoundOver);
        socket.on('grand_game_over', onGrandGameOver);
        socket.on('hint_response', onHintResponse);

        return () => {
            // 解绑事件
            socket.off('error_msg', onErrorMsg);
            socket.off('room_info', onRoomInfo);
            socket.off('enter_draw_phase', onEnterDrawPhase);
            socket.off('seat_draw_update', onSeatDrawUpdate);
            socket.off('seat_draw_finished', onSeatDrawFinished);
            socket.off('game_started', onGameStarted);
            socket.off('game_state_update', onGameStateUpdate);
            socket.off('hand_update', onHandUpdate);
            socket.off('play_error', onPlayError);
            socket.off('round_over', onRoundOver);
            socket.off('grand_game_over', onGrandGameOver);
            socket.off('hint_response', onHintResponse);
        };
    }, [socket, gameState]); // 依赖 socket 和 gameState 变化重新绑定

    // --- 初始化 Effect ---
    useEffect(() => {
        const initAudio = () => {
            SoundManager.init();
            window.removeEventListener('click', initAudio);
        };
        window.addEventListener('click', initAudio);

        const handleGlobalMouseUp = () => { isDragging.current = false; };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        
        return () => { 
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
        socket.emit(event, payload);
    };
    
    const handleStartGame = () => socket.emit('start_game', { roomId });
    const handleNextRound = () => socket.emit('next_round', { roomId });
    const handleAddBot = () => socket.emit('add_bot', { roomId });
    const handleToggleAutoPlay = () => socket.emit('toggle_auto_play', { roomId });

    const handleSwitchSeat = (index1, index2) => {
        if (!isCreatorMode && !players.find(p=>p.id===mySocketId)?.isHost) return;
        socket.emit('switch_seat', { roomId, index1, index2 });
    };
    
    const handleDrawCard = (index) => {
        socket.emit('draw_seat_card', { roomId, cardIndex: index });
    };

    const handleUpdateConfig = (newConfig) => {
        socket.emit('update_room_config', { roomId, config: newConfig });
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
        socket.emit('play_cards', { roomId, cards: cardsToPlay });
    };
    
    const handlePass = () => {
        socket.emit('pass_turn', { roomId });
        setSelectedCards([]);
    };
    
    const handleKickPlayer = (targetId) => {
        if (socket) {
            socket.emit('kick_player', { roomId, targetId });
        }
    };

    const handleRequestHint = () => {
        const isCacheValid = 
            availableHints.length > 0 && 
            currentTurnId === mySocketIdRef.current &&
            JSON.stringify(lastPlayed) === JSON.stringify(lastHintRef.current.lastPlayed);

        if (isCacheValid) {
            const nextIndex = (hintIndex + 1) % availableHints.length;
            setHintIndex(nextIndex);
            setSelectedCards(availableHints[nextIndex]);
        } else {
            setAvailableHints([]);
            socket.emit('request_hint', { roomId });
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