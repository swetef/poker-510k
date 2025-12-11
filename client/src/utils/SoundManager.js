/**
 * 简易 Web Audio API 音效管理器
 * 不需要外部 MP3 文件，直接用代码生成声音
 */
const SoundManager = {
    ctx: null,

    init: () => {
        if (!SoundManager.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            SoundManager.ctx = new AudioContext();
        }
    },

    // 播放指定类型的音效
    play: (type) => {
        try {
            // 某些浏览器需要用户交互后才能恢复 Context
            if (SoundManager.ctx && SoundManager.ctx.state === 'suspended') {
                SoundManager.ctx.resume();
            }
            if (!SoundManager.ctx) SoundManager.init();

            switch (type) {
                case 'deal': // 发牌/点击牌 (短促的高频音)
                    SoundManager.beep(800, 0.05, 'sine');
                    break;
                case 'play': // 出牌 (有打击感)
                    SoundManager.noise(0.1); 
                    break;
                case 'win': // 胜利 (连续的琶音)
                    SoundManager.arpeggio([523.25, 659.25, 783.99, 1046.50], 0.1);
                    break;
                case 'lose': // 失败/被压 (低沉)
                    SoundManager.beep(150, 0.3, 'sawtooth');
                    break;
                case 'alert': // 轮到你了
                    SoundManager.beep(880, 0.1, 'square');
                    setTimeout(() => SoundManager.beep(880, 0.1, 'square'), 150);
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    },

    // --- 合成器底层函数 ---

    // 发出单音
    beep: (freq, duration, type = 'sine') => {
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

    // 模拟打击声 (白噪音)
    noise: (duration) => {
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

    // 琶音 (胜利音效)
    arpeggio: (freqs, interval) => {
        freqs.forEach((f, i) => {
            setTimeout(() => SoundManager.beep(f, 0.2, 'triangle'), i * interval * 1000);
        });
    }
};

export default SoundManager;