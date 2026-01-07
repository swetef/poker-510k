/**
 * Web Audio API 音效管理器 + TTS 语音合成 + MP3 语音播放
 * [升级] 支持自定义 MP3 语音包替换默认电子音
 */
import GameRules from './gameRules.js'; 

// ============================================================
// 🎙️ 语音映射表 (2024全新语音包版)
// 格式: "聊天文字": "子目录/文件名.mp3"
// 基础路径: client/public/sounds/voice/
// ============================================================
const VOICE_MAP = {
    // ============================================================
    // 📂 文件夹 1: taunt (嘲讽/名场面)
    // 对应分隔符 \\\\\ 之前的内容
    // ============================================================
    "Are you ok": "taunt/are you ok!.MP3",
    "八十": "taunt/八十.mp3",
    "打击范围覆盖全球": "taunt/打击范围覆盖全球.MP3",
    "二龙戏珠": "taunt/二龙戏珠.mp3",
    "该我上场表演了": "taunt/高渐离 - 该我上场表演了.mp3",
    "给阿姨倒一杯卡布奇诺": "taunt/给阿姨倒一杯卡布奇诺.mp3",
    "根本赢不了": "taunt/根本赢不了.MP3",
    "跟我的保险说去吧": "taunt/跟我的保险说去吧.mp3",
    "金币": "taunt/金币音.mp3",
    "曼巴Out": "taunt/科比 曼巴out.mp3",
    "快点儿啊": "taunt/快点儿啊，我等的花儿都谢了!.mp3",
    "闷声发大财": "taunt/闷声发大财3.mp3",
    "你是MM还是GG": "taunt/你是MM还是GG.mp3",
    "你这瓜保守吗": "taunt/你这瓜保守吗.mp3",
    "卢本伟准备就绪": "taunt/伞兵一号卢本伟准备就绪.mp3",
    "泰山压顶": "taunt/泰山压顶.mp3",
    "我超勇的好不好": "taunt/我超勇的好不好！.mp3",
    "我以为减速带呢": "taunt/我以为减速带呢!.mp3",
    "乌鸦坐飞机": "taunt/乌鸦坐飞机.mp3",
    "全体起立": "taunt/现在各位观众全体起立.mp3",
    "遥遥领先": "taunt/遥遥领先.mp3",
    "虎杀两羊": "taunt/一虎杀两羊.mp3",
    "优势在我": "taunt/优势在我.MP3",

    // ============================================================
    // 📂 文件夹 2: meme (搞怪/趣味音效)
    // 对应分隔符 \\\\\ 和 ////// 中间的内容
    // ============================================================
    "CS GOGOGO": "meme/CS GOGOGO.mp3",
    "被捅": "meme/被捅.mp3",
    "你干嘛哎呦": "meme/蔡徐坤你干嘛哎呦.mp3",
    "死亡音效": "meme/超级玛丽死亡音效.mp3",
    "单走一个六": "meme/单走一个六 傻逼 走K.mp3",
    "迪迦奥特曼": "meme/迪迦奥特曼.mp3",
    "给队友上香": "meme/给队友上香.mp3",
    "好!很有精神!": "meme/好！很有精神！.mp3",
    "黑手": "meme/黑手_01.mp3",
    "Man!": "meme/科比 man！.mp3",
    "What can I say": "meme/科比 what can i say？.mp3",
    "龙卷风摧毁停车场": "meme/龙卷风摧毁停车场.mp3",
    "我去!": "meme/马报国我去！.mp3",
    "你不要过来啊": "meme/你不要过来啊.mp3",
    "邪恶笑": "meme/汤姆邪恶笑.mp3",
    "哇哦": "meme/哇哦.mp3",
    "我听不懂": "meme/我听不懂.MP3",
    "一定要赢啊": "meme/一定要赢啊.MP3",

    // ============================================================
    // 📂 文件夹 3: chat (回应/反击)
    // 对应分隔符 ////// 之后的内容
    // ============================================================
    "抱怨": "chat/抱怨.mp3",
    "抱怨2": "chat/抱怨2.mp3",
    "敢不敢跟我比划": "chat/敢不敢跟我比划比划2.mp3",
    "耗子尾汁": "chat/耗子尾汁.mp3",
    "盖亚!": "chat/卢本伟盖亚！.mp3",
    "我大意了": "chat/马报国咿呀我大意了啊但没关系啊.mp3",
    "你太baby辣": "chat/你太baby辣.mp3",
    "不讲武德": "chat/年轻人不讲武德.mp3",
    "让我看看": "chat/让我看看啊！.mp3",
    "17张牌你能秒我": "chat/十七张牌你能秒我 你能秒杀我.mp3",
    "大小姐驾到": "chat/孙尚香-大小姐驾到.mp3",
    "惨叫1": "chat/汤姆惨叫1啊！！！！.mp3",
    "惨叫2": "chat/汤姆惨叫哦！！！.mp3",
    "偷袭": "chat/偷袭！.mp3",
    "还想开军舰": "chat/这么小声还想开军舰？.mp3",

    // ============================================================
    // ⚙️ 系统提示音 (可选，需确保文件存在)
    // ============================================================
    "不要": "chat/pass.mp3", // 沿用之前的配置，如果在chat文件夹下
    "胜利": "system/win_voice.mp3",
    "遗憾": "system/lose_voice.mp3"
};

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
     * 核心：播放语音 (优先查找 MP3，找不到则使用 TTS 电子音)
     * @param {string} text 要朗读的文本
     * @param {number} rate 语速 (0.1 - 10)
     */
    speak: (text, rate = 1.4) => {
        if (!SoundManager.enabled || !text) return;

        // 1. [优先] 检查是否有对应的 MP3 文件配置
        if (VOICE_MAP[text]) {
            const fileName = VOICE_MAP[text];
            // 拼接路径：/sounds/voice/ + 子目录/文件名.mp3
            const audioPath = `/sounds/voice/${fileName}`;
            
            const audio = new Audio(audioPath);
            audio.volume = 1.0; // 音量控制
            
            // 播放并捕获错误 (防止文件不存在报错)
            audio.play().catch(err => {
                console.warn(`[SoundManager] 播放语音文件失败 (${audioPath}):`, err);
                // 如果文件播放失败，自动降级回 TTS 电子音
                SoundManager._ttsSpeak(text, rate);
            });
            return;
        }

        // 2. [降级] 如果没有配置 MP3，使用浏览器自带 TTS
        SoundManager._ttsSpeak(text, rate);
    },

    /**
     * 内部方法：浏览器原生 TTS (电子音)
     */
    _ttsSpeak: (text, rate) => {
        if ('speechSynthesis' in window) {
            // 打断当前正在说的（防止消息堆积）
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate; 
            utterance.pitch = 1.1; 
            utterance.lang = 'zh-CN';
            
            const voices = window.speechSynthesis.getVoices();
            const cnVoice = voices.find(v => v.lang.includes('zh') && v.name.includes('Google'));
            if (cnVoice) utterance.voice = cnVoice;

            window.speechSynthesis.speak(utterance);
        }
    },

    /**
     * 智能分析牌型并朗读 (保留电子音，因为组合太多，除非你也想录制 '对3', '三带一' 等)
     */
    playCardVoice: (cards) => {
        if (!cards || cards.length === 0) return;
        
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

    _getPointVoiceText: (val) => {
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

            switch (type) {
                case 'deal': 
                    SoundManager.beep(800, 0.05, 'sine');
                    break;
                case 'play': 
                    SoundManager.noise(0.1); 
                    break;
                case 'win': 
                    SoundManager.arpeggio([523.25, 659.25, 783.99, 1046.50], 0.1);
                    SoundManager.speak("胜利", 1.0); 
                    break;
                case 'lose': 
                    SoundManager.beep(150, 0.3, 'sawtooth');
                    SoundManager.speak("遗憾", 1.0); 
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
                    SoundManager.speak("不要"); // 这里也会尝试去 VOICE_MAP 找 "不要"
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    },

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