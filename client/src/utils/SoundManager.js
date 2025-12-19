/**
 * 简易 Web Audio API 音效管理器
 */
const SoundManager = {
    ctx: null,

    init: () => {
        if (!SoundManager.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            SoundManager.ctx = new AudioContext();
        }
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
                    break;
                case 'lose': 
                    SoundManager.beep(150, 0.3, 'sawtooth');
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
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    },

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

    arpeggio: (freqs, interval) => {
        freqs.forEach((f, i) => {
            setTimeout(() => SoundManager.beep(f, 0.2, 'triangle'), i * interval * 1000);
        });
    }
};

export default SoundManager;