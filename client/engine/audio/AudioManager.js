/**
 * Web Audio API manager with procedurally generated sound effects.
 * All sounds are synthesized — no external audio files needed.
 */
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._volume = 0.4;
    this._unlocked = false;

    // Unlock audio context on first user interaction
    const unlock = () => {
      if (this._unlocked) return;
      this._init();
      this._unlocked = true;
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
  }

  _init() {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._masterGain) this._masterGain.gain.value = this._volume;
  }

  /**
   * Gunshot — short noise burst with pitch drop
   */
  playShoot() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    // Noise burst
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass for punch
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.06);
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    noise.connect(filter).connect(gain).connect(this._masterGain);
    noise.start(t);
    noise.stop(t + 0.08);

    // Low thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.06);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    osc.connect(oscGain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Reload — metallic click-clack
   */
  playReload() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    // Click
    this._playClick(t, 2000, 0.02, 0.3);
    // Clack
    this._playClick(t + 0.15, 1200, 0.03, 0.35);
    // Slide
    this._playClick(t + 0.35, 3000, 0.04, 0.2);
  }

  _playClick(time, freq, duration, vol) {
    const ctx = this._ctx;
    const bufSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    src.connect(filter).connect(gain).connect(this._masterGain);
    src.start(time);
    src.stop(time + duration);
  }

  /**
   * Zombie hit — wet thud
   */
  playZombieHit() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Zombie death — low growl + pop
   */
  playZombieDeath() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    // Growl
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(filter).connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.3);

    // Pop
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(400, t);
    osc2.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.3, t);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc2.connect(g2).connect(this._masterGain);
    osc2.start(t);
    osc2.stop(t + 0.05);
  }

  /**
   * Player hit — sharp sting
   */
  playPlayerHit() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Player death — descending tone
   */
  playDeath() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);

    osc.connect(filter).connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /**
   * Item pickup — cheerful blip
   */
  playPickup() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.setValueAtTime(800, t + 0.05);
    osc.frequency.setValueAtTime(1000, t + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.setValueAtTime(0.25, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Wave start — alarm horn
   */
  playWaveStart() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.2;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, start);
      osc.frequency.setValueAtTime(550, start + 0.08);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);

      osc.connect(gain).connect(this._masterGain);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  destroy() {
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }
  }
}
