import { useState, useEffect, useRef } from 'react';
import { sortHand } from '../../utils/cardLogic.js';
import SoundManager from '../../utils/SoundManager.js';
import SmartHint from '../../utils/smartHint.js'; // 引入本地智能提示

export const useBattleLogic = (socket, username, mySocketId, roomId, deckCount = 2) => {
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

    // --- 自动计算提示 (当轮到我出牌时) ---
    useEffect(() => {
        if (currentTurnId === mySocketId && myHand.length > 0) {
            // 本地计算，实时性更高
            // 注意：lastPlayed 需要是最新的
            const hints = SmartHint.getSortedHints(myHand, lastPlayed, deckCount);
            setAvailableHints(hints);
            setHintIndex(0);
        } else {
            setAvailableHints([]);
            setHintIndex(0);
        }
    }, [currentTurnId, mySocketId, myHand, lastPlayed, deckCount]);


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

            setGameLogs([{ time: new Date().toLocaleTimeString(), text: '🏁 新一局开始！' }]); 
            setTurnRemaining(60);
            setPlayersInfo({});
            if (data.handCounts) setHandCounts(data.handCounts);
            
            backupHandRef.current = []; 
        };

        const onGameStateUpdate = (data) => {
            setCurrentTurnId(data.currentTurnId);
            
            if (data.turnRemaining !== undefined) setTurnRemaining(data.turnRemaining);

            if (data.lastPlayed && data.lastPlayed.length > 0) {
                if (data.lastPlayerName !== username) {
                    SoundManager.play('play'); 
                }
            }
            if (data.currentTurnId === mySocketId) {
                SoundManager.play('alert');
            }

            if (data.lastPlayerName === username) {
                 setIsSubmitting(false); 
            }

            if (data.lastPlayed) setLastPlayed(sortHand(data.lastPlayed, sortModeRef.current));
            setLastPlayerName(data.lastPlayerName || '');
            
            if (data.infoText) {
                if (data.infoText.includes('不要')) {
                    SoundManager.play('pass');
                }
                
                if (data.infoText !== 'PASS') {
                    // [修改] 延长停留时间至 3.5s，配合 CSS 动画
                    setInfoMessage(data.infoText); 
                    setTimeout(() => setInfoMessage(''), 3500);
                    
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
            backupHandRef.current = [];
        };

        const onPlayError = (msg) => { 
            setIsSubmitting(false); 
            setInfoMessage(msg); 
            setTimeout(()=>setInfoMessage(''), 3500); 
            SoundManager.play('lose'); 
            
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

        socket.on('game_started', onGameStarted);
        socket.on('game_state_update', onGameStateUpdate);
        socket.on('hand_update', onHandUpdate);
        socket.on('play_error', onPlayError);
        socket.on('round_over', onRoundOver);
        socket.on('grand_game_over', onGrandGameOver);

        return () => {
            socket.off('game_started', onGameStarted);
            socket.off('game_state_update', onGameStateUpdate);
            socket.off('hand_update', onHandUpdate);
            socket.off('play_error', onPlayError);
            socket.off('round_over', onRoundOver);
            socket.off('grand_game_over', onGrandGameOver);
        };
    }, [socket, username, mySocketId]); 

    // --- 交互 Actions ---

    const toggleSort = () => setSortMode(prev => {
        if (prev === 'POINT') return 'ARRANGE';
        if (prev === 'ARRANGE') return 'ARRANGE_MERGED';
        return 'POINT';
    });
    
    const handleToggleAutoPlay = (roomId) => socket.emit('toggle_auto_play', { roomId });

    // [新增] 切换托管模式
    const handleSwitchAutoPlayMode = (roomId, mode) => socket.emit('switch_autoplay_mode', { roomId, mode });

    const handlePass = (roomId) => {
        if (isSubmitting) return; 
        setIsSubmitting(true);    

        socket.emit('pass_turn', { roomId });
        setSelectedCards([]);

        setTimeout(() => setIsSubmitting(false), 500); 
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
        if (isSubmitting) return; 
        if (selectedCards.length === 0) return alert("请先选牌");
        
        setIsSubmitting(true); 
        
        const cardsToPlay = [...selectedCards];
        
        backupHandRef.current = [...myHand];
        const nextHand = myHand.filter(c => !cardsToPlay.includes(c));
        setMyHand(nextHand);
        
        setLastPlayed(sortHand(cardsToPlay, sortModeRef.current));
        setLastPlayerName(username); 
        setSelectedCards([]); 
        
        SoundManager.play('play');
        socket.emit('play_cards', { roomId, cards: cardsToPlay });

        setTimeout(() => setIsSubmitting(false), 3000);
    };

    // [修改] 提示按钮点击逻辑：循环切换候选牌型
    const handleRequestHint = (roomId) => {
        if (availableHints.length > 0) {
            // 当前选中的提示索引
            const targetHint = availableHints[hintIndex]; 
            setSelectedCards(targetHint);
            
            // 移动指针到下一个，为下次点击做准备
            setHintIndex((hintIndex + 1) % availableHints.length);
        } else {
            setInfoMessage('没有打得过的牌');
            setTimeout(()=>setInfoMessage(''), 1000);
            SoundManager.play('pass'); 
        }
    };

    return {
        // State
        myHand, selectedCards, lastPlayed,
        currentTurnId, lastPlayerName, infoMessage,
        roundResult, grandResult, playerScores, roundPoints,
        playersInfo, finishedRank, pendingPoints, gameLogs,
        sortMode, turnRemaining, handCounts,
        isSubmitting, 

        // Actions
        toggleSort, 
        handleToggleAutoPlay,
        handleSwitchAutoPlayMode, // [新增] 导出该方法
        handlePass, 
        handlePlayCards,
        handleRequestHint,
        handleMouseDown, 
        handleMouseEnter,
        handleClearSelection
    };
};