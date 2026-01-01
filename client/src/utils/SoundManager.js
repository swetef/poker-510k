/**
 * Web Audio API 音效管理器 + TTS 语音合成
 * [升级] 支持文字转语音 (TTS) 播报牌型和消息
 */
import GameRules from './gameRules.js'; // 引入规则用于分析牌型

const SoundManager = {
    ctx: null,
    enabled: true, // 全局静音开关

    init: () => {
        if (!SoundManager.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            SoundManager.ctx = new AudioContext();
        }
    },

    /**
     * 核心：文字转语音 (TTS)
     * @param {string} text 要朗读的文本
     * @param {number} rate 语速 (0.1 - 10)
     */
    speak: (text, rate = 1.4) => {
        if (!SoundManager.enabled || !text) return;

        // 如果浏览器支持语音合成
        if ('speechSynthesis' in window) {
            // 打断当前正在说的（防止消息堆积）
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate; 
            utterance.pitch = 1.1; // 稍微高一点的音调更像游戏语音
            utterance.lang = 'zh-CN';
            
            // 尝试选择中文女声 (不同浏览器实现不同，尽量优选)
            const voices = window.speechSynthesis.getVoices();
            const cnVoice = voices.find(v => v.lang.includes('zh') && v.name.includes('Google'));
            if (cnVoice) utterance.voice = cnVoice;

            window.speechSynthesis.speak(utterance);
        }
    },

    /**
     * [新增] 智能分析牌型并朗读
     */
    playCardVoice: (cards) => {
        if (!cards || cards.length === 0) return;
        
        // 1. 分析牌型 (deckCount 传2即可，主要为了识别结构)
        const analysis = GameRules.analyze(cards, 2); 
        const ptText = SoundManager._getPointVoiceText(analysis.val);

        let voiceText = '';

        switch (analysis.type) {
            case 'SINGLE': 
                voiceText = ptText; 
                break;
            case 'PAIR': 
                voiceText = `对${ptText}`; 
                break;
            case 'TRIPLE': 
                voiceText = `三个${ptText}`; 
                break;
            case 'LIANDUI': 
                voiceText = "连对"; 
                break;
            case 'AIRPLANE': 
                voiceText = "飞机"; 
                break;
            case '510K_MIXED': 
            case '510K_PURE': 
                voiceText = "五十K"; 
                break;
            case 'BOMB_STD': 
            case 'BOMB_MAX': 
                voiceText = "炸弹"; 
                break;
            case 'BOMB_KING': 
                voiceText = "王炸"; 
                break;
            default: 
                break;
        }

        if (voiceText) SoundManager.speak(voiceText);
    },

    // 将数字转换为口语读法
    _getPointVoiceText: (val) => {
        // 3-13, 14(A), 15(2), 16(小王), 17(大王)
        if (val <= 10) return val.toString();
        if (val === 11) return '勾';
        if (val === 12) return '圈';
        if (val === 13) return '凯';
        if (val === 14) return '尖';
        if (val === 15) return '二';
        if (val === 16) return '小王';
        if (val === 17) return '大王';
        return '';
    },

    play: (type) => {
        try {
            if (SoundManager.ctx && SoundManager.ctx.state === 'suspended') {
                SoundManager.ctx.resume();
            }
            if (!SoundManager.ctx) SoundManager.init();

            // 播放原有的 beep 音效作为背景音
            switch (type) {
                case 'deal': 
                    SoundManager.beep(800, 0.05, 'sine');
                    break;
                case 'play': 
                    SoundManager.noise(0.1); 
                    break;
                case 'win': 
                    SoundManager.arpeggio([523.25, 659.25, 783.99, 1046.50], 0.1);
                    SoundManager.speak("胜利", 1.0); // 加上语音
                    break;
                case 'lose': 
                    SoundManager.beep(150, 0.3, 'sawtooth');
                    SoundManager.speak("遗憾", 1.0); // 加上语音
                    break;
                case 'alert': 
                    SoundManager.beep(880, 0.1, 'square');
                    setTimeout(() => SoundManager.beep(880, 0.1, 'square'), 150);
                    break;
                case 'tick': 
                    SoundManager.beep(600, 0.05, 'sine');
                    break;
                case 'pass': 
                    SoundManager.beep(200, 0.15, 'triangle');
                    SoundManager.speak("不要"); // [关键修改] 不要时触发语音
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    },

    // (保留原有的音效生成函数)
    beep: (freq, duration, type = 'sine') => {
        if (!SoundManager.enabled) return;
        const ctx = SoundManager.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },

    noise: (duration) => {
        if (!SoundManager.enabled) return;
        const ctx = SoundManager.ctx;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },

    arpeggio: (freqs, interval) => {
        if (!SoundManager.enabled) return;
        freqs.forEach((f, i) => {
            setTimeout(() => SoundManager.beep(f, 0.2, 'triangle'), i * interval * 1000);
        });
    }
};

export default SoundManager;