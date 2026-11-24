// Sound effects generated on the fly via Web Audio API (no external MP3/WAV needed!)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmGain = null;
    this.currentBgmType = null;
    this.bgmTimer = null;
    this.nextNoteTime = 0;
    this.currentStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.muted ? 0 : 0.14, this.ctx.currentTime);
        this.bgmGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.muted ? 0 : 0.14, this.ctx.currentTime);
    }
    return this.muted;
  }

  playBeep(freq = 440, duration = 0.1, type = 'sine') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  countdownBeep(isHigh = false) {
    this.playBeep(isHigh ? 880 : 440, isHigh ? 0.35 : 0.15, 'square');
  }

  click() {
    this.playBeep(600, 0.05, 'triangle');
  }

  coin() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  swordClash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // High metallic chime
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);

      // Clatter noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.1);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3200;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch (e) {}
  }

  conquer() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.22, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch (e) {}
  }

  boost() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  skid() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      // Noise burst
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  // 💥 Tabrakan Keras / Benturan Bodi Mobil (Chassis Thud + Metal Crunch)
  crash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Heavy bass impact thud (hentakan bodi & sasis mobil)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.24);
      oscGain.gain.setValueAtTime(0.38, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);

      // 2. Metallic crunch / clatter noise burst (gesekan & benturan logam keras)
      const duration = 0.20;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.Q.value = 2.0;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.32, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch (e) {}
  }

  waterSplash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      // Deep water entry thud + turbulent liquid rush
      const duration = 0.35;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  gravelCrunch() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      // Crunchy stony crackle of tires on loose rocks
      const duration = 0.12;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // High frequency erratic clicks
        data[i] = (Math.random() > 0.6 ? 1 : -1) * Math.random() * (Math.random() > 0.4 ? 1 : 0);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800 + Math.random() * 600, this.ctx.currentTime);
      filter.Q.value = 3.0;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  winFanfare() {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playBeep(freq, 0.25, 'triangle');
      }, idx * 120);
    });
  }

  lapComplete() {
    this.playBeep(659.25, 0.1, 'sine');
    setTimeout(() => this.playBeep(880, 0.2, 'sine'), 100);
  }

  // ==================== BACKGROUND MUSIC (BGM) SYNTHESIZER ====================
  playBGM(type = 'sambungkata') {
    this.init();
    if (!this.ctx) return;
    if (this.currentBgmType === type && this.bgmTimer) return;
    this.stopBGM();

    this.currentBgmType = type;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    const scheduler = () => {
      if (!this.ctx || !this.currentBgmType) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        this.scheduleBgmStep(this.currentBgmType, this.currentStep, this.nextNoteTime);
        const bpm = this.getBgmBpm(this.currentBgmType);
        const stepDuration = 60 / bpm / 4;
        this.nextNoteTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 64;
      }
    };

    this.bgmTimer = setInterval(scheduler, 30);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.currentBgmType = null;
  }

  getBgmBpm(type) {
    if (type === 'racing') return 132;
    if (type === 'quiz') return 108;
    if (type === 'territory' || type === 'tictactoe') return 102;
    return 116; // sambungkata
  }

  playSynthNote(freq, time, duration, type = 'sine', volume = 0.12, decay = true) {
    if (!this.ctx || !this.bgmGain || freq <= 0) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(volume, time);
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      } else {
        gain.gain.setValueAtTime(volume, time + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0.0001, time + duration);
      }

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  playDrumBeat(drumType, time) {
    if (!this.ctx || !this.bgmGain) return;
    try {
      if (drumType === 'kick') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(32, time + 0.12);
        gain.gain.setValueAtTime(0.24, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(time);
        osc.stop(time + 0.12);
      } else if (drumType === 'snare') {
        const bufSize = Math.floor(this.ctx.sampleRate * 0.08);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1400, time);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);
        noise.start(time);
      } else if (drumType === 'hihat') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(6500, time);
        gain.gain.setValueAtTime(0.035, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(time);
        osc.stop(time + 0.025);
      }
    } catch (e) {}
  }

  scheduleBgmStep(type, step, time) {
    if (type === 'racing') {
      // 🏎️ MINING RALLY 3D: Pumping synthwave driving bass + electronic drums
      const bassNotes = [
        73.42, 73.42, 146.83, 73.42, 87.31, 87.31, 174.61, 87.31,
        98.00, 98.00, 196.00, 98.00, 110.00, 110.00, 130.81, 110.00
      ];
      const bFreq = bassNotes[step % 16];
      this.playSynthNote(bFreq, time, 0.10, 'sawtooth', 0.13, true);

      // Lead arpeggio
      const leadNotes = [293.66, 349.23, 440.00, 523.25, 440.00, 349.23, 293.66, 220.00];
      if (step % 2 === 0) {
        this.playSynthNote(leadNotes[(step / 2) % 8], time, 0.12, 'square', 0.07, true);
      }

      // Drum beat
      if (step % 4 === 0) this.playDrumBeat('kick', time);
      if (step % 8 === 4) this.playDrumBeat('snare', time);
      if (step % 2 === 1) this.playDrumBeat('hihat', time);

    } else if (type === 'quiz') {
      // 🧠 CERDAS CERMAT: Ticking tension, mystery synth stabs & funky walking bass
      const qBass = [82.41, 0, 98.00, 0, 110.00, 0, 123.47, 0, 110.00, 0, 98.00, 0, 82.41, 0, 73.42, 0];
      const qFreq = qBass[step % 16];
      if (qFreq > 0) this.playSynthNote(qFreq, time, 0.18, 'triangle', 0.15, true);

      // Mystery chord stabs on beat 0 and 16
      if (step === 0 || step === 32) {
        [329.63, 392.00, 493.88].forEach(f => this.playSynthNote(f, time, 0.45, 'sine', 0.08, true));
      } else if (step === 16 || step === 48) {
        [261.63, 329.63, 392.00].forEach(f => this.playSynthNote(f, time, 0.45, 'sine', 0.08, true));
      }

      // Clock tick on every 8th note
      if (step % 2 === 0) this.playDrumBeat('hihat', time);
      if (step % 16 === 0) this.playDrumBeat('kick', time);

    } else if (type === 'territory' || type === 'tictactoe') {
      // ⚔️ TERRITORY CONQUEST: Epic strategy cadence & brass chords
      const mBass = [110.00, 0, 110.00, 0, 130.81, 0, 146.83, 0, 164.81, 0, 146.83, 0, 130.81, 0, 110.00, 0];
      const mFreq = mBass[step % 16];
      if (mFreq > 0) this.playSynthNote(mFreq, time, 0.22, 'triangle', 0.16, true);

      if (step % 8 === 0) {
        [220.00, 277.18, 329.63].forEach(f => this.playSynthNote(f, time, 0.35, 'sawtooth', 0.06, true));
      }
      if (step % 4 === 0) this.playDrumBeat('kick', time);
      if (step % 8 === 4) this.playDrumBeat('snare', time);
      if (step % 2 === 1) this.playDrumBeat('hihat', time);

    } else {
      // 🔤 SAMBUNG KATA 3D: Roblox chill & bouncy tropical marimba/island chiptune
      const skBass = [
        65.41, 0, 98.00, 0, 82.41, 0, 110.00, 0,
        73.42, 0, 110.00, 0, 98.00, 0, 146.83, 0
      ];
      const skFreq = skBass[step % 16];
      if (skFreq > 0) this.playSynthNote(skFreq, time, 0.25, 'triangle', 0.18, true);

      // Playful Pentatonic Marimba melody
      const marimbaPattern = [
        523.25, 0, 659.25, 0, 783.99, 0, 880.00, 0,
        659.25, 0, 523.25, 0, 392.00, 0, 440.00, 0,
        587.33, 0, 659.25, 0, 783.99, 0, 1046.50, 0,
        880.00, 0, 783.99, 0, 659.25, 0, 523.25, 0
      ];
      const mNote = marimbaPattern[step % 32];
      if (mNote > 0) this.playSynthNote(mNote, time, 0.15, 'sine', 0.10, true);

      // Tropical percussion
      if (step % 16 === 0 || step % 16 === 8) this.playDrumBeat('kick', time);
      if (step % 8 === 4) this.playDrumBeat('snare', time);
      if (step % 2 === 0) this.playDrumBeat('hihat', time);
    }
  }
}

window.soundManager = new SoundManager();
