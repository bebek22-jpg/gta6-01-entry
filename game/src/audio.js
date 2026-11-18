// Solmar Heat — synthesized sound. Every effect is built from oscillators and
// filtered noise at run time; the game ships no audio files at all.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.muted = false;
  }

  // Browsers only let audio start after a gesture; call from the first one.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngineLoop();
      this._startSirenLoop();
    } catch (err) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _startEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _startSirenLoop() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Called every frame: pitch follows speed, siren wails while police are near.
  update(dt, speed, sirenOn) {
    if (!this.ctx) return;
    if (this.engineOsc) {
      const target = speed > 0.5 ? 0.05 + Math.min(0.09, speed * 0.002) : 0;
      this.engineGain.gain.value += (target - this.engineGain.gain.value) * Math.min(1, dt * 6);
      this.engineOsc.frequency.value = 50 + speed * 3.2;
    }
    if (this.sirenOsc) {
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.45) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.value = this.sirenHigh ? 880 : 660;
      }
      const target = sirenOn ? 0.045 : 0;
      this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 4);
    }
  }

  _tone(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, cutoff) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  gunshot() { this._noise(0.16, 0.5, 2400); this._tone(140, 0.1, 'square', 0.18); }
  punch() { this._noise(0.08, 0.35, 500); this._tone(90, 0.08, 'sine', 0.3); }
  crash() { this._noise(0.25, 0.4, 900); }
  pickup() { this._tone(880, 0.09, 'sine', 0.25); this._tone(1320, 0.14, 'sine', 0.25, 0.09); }
  click() { this._tone(660, 0.05, 'square', 0.12); }
  doorSlam() { this._noise(0.07, 0.3, 700); }
  missionPass() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.22, i * 0.11));
  }
  missionFail() {
    [392, 330, 262].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.2, i * 0.14));
  }
  busted() { this._tone(220, 0.7, 'sawtooth', 0.16); this._tone(165, 0.9, 'sawtooth', 0.14, 0.2); }
}
