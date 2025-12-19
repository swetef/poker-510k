import { useState, useEffect, useRef } from 'react';
import { sortHand } from '../../utils/cardLogic.js';
import SoundManager from '../../utils/SoundManager.js';

export const useBattleLogic = (socket, username, mySocketId, roomId) => {
    // --- 局内状态 ---
    const [myHand, setMyHand] = useState([]);       
    const [selectedCards, setSelectedCards] = useState([]); 
    const [lastPlayed, setLastPlayed] = useState([]); 
    const [currentTurnId, setCurrentTurnId] = useState(null); 
    const [lastPlayerName, setLastPlayerName] = useState(''); 
    const [infoMessage, setInfoMessage] = useState(''); 
    
    // 积分与结算
    const [roundResult, setRoundResult] = useState(null); 
    const [grandResult, setGrandResult] = useState(null); 
    const [playerScores, setPlayerScores] = useState({});
    const [roundPoints, setRoundPoints] = useState({});
    const [playersInfo, setPlayersInfo] = useState({}); 
    const [finishedRank, setFinishedRank] = useState([]); 
    const [pendingPoints, setPendingPoints] = useState(0);
    
    // 杂项
    const [gameLogs, setGameLogs] = useState([]);
    const [sortMode, setSortMode] = useState('POINT'); 
    const [turnRemaining, setTurnRemaining] = useState(60); 
    const [handCounts, setHandCounts] = useState({});

    // 提示功能状态
    const [availableHints, setAvailableHints] = useState([]); 
    const [hintIndex, setHintIndex] = useState(0);            
    const lastHintRef = useRef({ turnId: null, lastPlayed: [] }); 

    // [新增] 提交防抖状态
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 交互 Ref
    const isDragging = useRef(false); 
    const dragStartMode = useRef(true); 
    const sortModeRef = useRef('POINT');
    const backupHandRef = useRef([]);

    // 保持 Ref 同步
    useEffect(() => { sortModeRef.current = sortMode; }, [sortMode]);
    // 当排序模式改变时，重排手牌
    useEffect(() => {
        if (myHand.length > 0) setMyHand(prev => sortHand(prev, sortMode));
    }, [sortMode]);

    // 初始化音效 & 全局事件
    useEffect(() => {
        const initAudio = () => {
            SoundManager.init();
            window.removeEventListener('click', initAudio);
        };
        window.addEventListener('click', initAudio);

        const handleGlobalMouseUp = () => { isDragging.current = false; };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // --- Socket 监听 ---
    useEffect(() => {
        if (!socket) return;

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
            setTurnRemaining(60);
            setPlayersInfo({});
            if (data.handCounts) setHandCounts(data.handCounts);
            
            setAvailableHints([]);
            setHintIndex(0);
            backupHandRef.current = []; 
        };

        const onGameStateUpdate = (data) => {
            setCurrentTurnId(data.currentTurnId);
            
            if (data.turnRemaining !== undefined) setTurnRemaining(data.turnRemaining);

            // 音效逻辑：别人出牌时播放
            if (data.lastPlayed && data.lastPlayed.length > 0) {
                if (data.lastPlayerName !== username) {
                    SoundManager.play('play'); 
                }
            }
            // 轮到自己时播放提示音
            if (data.currentTurnId === mySocketId) {
                SoundManager.play('alert');
            }

            // [新增] 收到新的状态更新（说明出牌成功或别人出牌了），解除锁定
            // 如果 lastPlayerName 是我，说明我的出牌被确认了
            if (data.lastPlayerName === username) {
                 setIsSubmitting(false); 
            }

            // 提示缓存失效检测
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

            // 更新状态
            if (data.lastPlayed) setLastPlayed(sortHand(data.lastPlayed, sortModeRef.current));
            setLastPlayerName(data.lastPlayerName || '');
            
            if (data.infoText) {
                // [新增] 检测“不要”并播放音效
                if (data.infoText.includes('不要')) {
                    SoundManager.play('pass');
                }
                
                if (data.infoText !== 'PASS') {
                    setInfoMessage(data.infoText); setTimeout(()=>setInfoMessage(''), 2000);
                    setGameLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: data.infoText }]);
                }
            }
            
            if (data.scores) setPlayerScores(data.scores);
            if (data.roundPoints) setRoundPoints(data.roundPoints);
            if (data.playersInfo) setPlayersInfo(data.playersInfo);
            if (data.handCounts) setHandCounts(data.handCounts);
            if (data.finishedRank) setFinishedRank(data.finishedRank);
            if (data.pendingPoints !== undefined) setPendingPoints(data.pendingPoints);
        };

        const onHandUpdate = (newHand) => {
            setMyHand(sortHand(newHand, sortModeRef.current)); 
            setSelectedCards([]);
            setAvailableHints([]);
            setHintIndex(0);
            backupHandRef.current = [];
        };

        const onPlayError = (msg) => { 
            setIsSubmitting(false); // [新增] 出错解除锁定
            setInfoMessage(msg); 
            setTimeout(()=>setInfoMessage(''), 2000); 
            SoundManager.play('lose'); 
            
            // 乐观更新失败，回滚
            if (backupHandRef.current.length > 0) {
                setMyHand(backupHandRef.current);
                backupHandRef.current = [];
                setInfoMessage("出牌无效，手牌已回滚");
            }
        }; 
        
        const onRoundOver = (data) => {
            setTimeout(() => {
                setRoundResult(data);
                if (data.grandScores) setPlayerScores(data.grandScores);
                const amIWinner = data.roundWinner === username;
                SoundManager.play(amIWinner ? 'win' : 'lose');
            }, 1000); 
        };

        const onGrandGameOver = (data) => {
             setTimeout(() => {
                setGrandResult(data);
                SoundManager.play('win'); 
             }, 1000);
        };

        const onHintResponse = (hints) => {
            if (hints && hints.length > 0) {
                setAvailableHints(hints);
                setHintIndex(0);
                setSelectedCards(hints[0]);
                lastHintRef.current = {
                    turnId: mySocketId, 
                    lastPlayed: [...lastPlayed] 
                };
            } else {
                setInfoMessage('没有打得过的牌');
                setTimeout(()=>setInfoMessage(''), 1000);
            }
        };

        socket.on('game_started', onGameStarted);
        socket.on('game_state_update', onGameStateUpdate);
        socket.on('hand_update', onHandUpdate);
        socket.on('play_error', onPlayError);
        socket.on('round_over', onRoundOver);
        socket.on('grand_game_over', onGrandGameOver);
        socket.on('hint_response', onHintResponse);

        return () => {
            socket.off('game_started', onGameStarted);
            socket.off('game_state_update', onGameStateUpdate);
            socket.off('hand_update', onHandUpdate);
            socket.off('play_error', onPlayError);
            socket.off('round_over', onRoundOver);
            socket.off('grand_game_over', onGrandGameOver);
            socket.off('hint_response', onHintResponse);
        };
    }, [socket, username, mySocketId, lastPlayed]); 

    // --- 交互 Actions ---

    const toggleSort = () => setSortMode(prev => prev === 'POINT' ? 'ARRANGE' : 'POINT');
    
    const handleToggleAutoPlay = (roomId) => socket.emit('toggle_auto_play', { roomId });
    const handlePass = (roomId) => {
        socket.emit('pass_turn', { roomId });
        setSelectedCards([]);
    };
    
    const updateSelection = (cardVal, forceSelect = null) => {
        setSelectedCards(prev => {
            const isSelected = prev.includes(cardVal);
            if (forceSelect !== null) return forceSelect && !isSelected ? [...prev, cardVal] : (!forceSelect && isSelected ? prev.filter(c => c !== cardVal) : prev);
            return isSelected ? prev.filter(c => c !== cardVal) : [...prev, cardVal];
        });
    };

    const handleClearSelection = () => setSelectedCards([]);

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

    const handlePlayCards = (roomId) => {
        if (isSubmitting) return; // [新增] 防抖拦截
        if (selectedCards.length === 0) return alert("请先选牌");
        
        setIsSubmitting(true); // [新增] 锁定状态
        
        const cardsToPlay = [...selectedCards];
        
        // 乐观更新：先扣手牌
        backupHandRef.current = [...myHand];
        const nextHand = myHand.filter(c => !cardsToPlay.includes(c));
        setMyHand(nextHand);
        
        // 更新本地展示的“最后一手”
        setLastPlayed(sortHand(cardsToPlay, sortModeRef.current));
        setLastPlayerName(username); 
        setSelectedCards([]); 
        
        SoundManager.play('play');
        socket.emit('play_cards', { roomId, cards: cardsToPlay });

        // [新增] 安全兜底：3秒后自动解锁，防止服务器无响应导致卡死
        setTimeout(() => setIsSubmitting(false), 3000);
    };

    const handleRequestHint = (roomId) => {
        const isCacheValid = 
            availableHints.length > 0 && 
            currentTurnId === mySocketId &&
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
        myHand, selectedCards, lastPlayed,
        currentTurnId, lastPlayerName, infoMessage,
        roundResult, grandResult, playerScores, roundPoints,
        playersInfo, finishedRank, pendingPoints, gameLogs,
        sortMode, turnRemaining, handCounts,
        isSubmitting, // [新增] 导出防抖状态

        // Actions
        toggleSort, 
        handleToggleAutoPlay, 
        handlePass, 
        handlePlayCards,
        handleRequestHint,
        handleMouseDown, 
        handleMouseEnter,
        handleClearSelection
    };
};