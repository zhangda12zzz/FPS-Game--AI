// 本地背景音乐（已下载到 public/sounds，随项目本地加载；加载失败时回退到合成环境声）
const BGM_URLS = [
  '/sounds/bgm1.mp3',
  '/sounds/bgm2.mp3',
];

// 本地换弹音效（真实录音，已下载到 public/sounds）
const RELOAD_SFX_URL = '/sounds/reload.mp3';

// 背景音乐相对总音量的占比（较小，避免盖过战斗音效）
const MUSIC_MIX = 0.2;

// WebAudio 合成音效：警报蜂鸣、爆炸、安包/拆包提示音，以及枪声/换弹/命中/脚步等战斗音效；背景音乐与换弹音效使用本地资源播放
export class AudioFx {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.alarmTimer = null;
    this.alarmRate = 1000; // 蜂鸣间隔(ms)，随倒计时加快

    // 总音量（0~1，可由界面滑块调节）
    this.masterVolume = 0.4;

    // 背景音乐（在线资源）
    this.music = null;

    // 本地换弹音效（真实录音，加载失败则回退到合成声）
    this.reloadSfx = null;
    this._reloadSfxFailed = false;

    // 合成环境声（在线音乐不可用时的回退）
    this.ambienceTimer = null;
    this.drone = null;
    this.drone2 = null;
    this.droneGain = null;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
  }

  /** 首次用户交互后调用以解锁播放 */
  resume() {
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._initReloadSfx(); // 提前预加载换弹音效，避免首次换弹无声
  }

  /** 单次蜂鸣 */
  _beep(freq = 880, duration = 0.08, type = 'square', vol = 0.6) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, this.ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(g); g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
  }

  /** 启动警报循环（炸弹计时中） */
  startAlarm() {
    this._ensure();
    this.stopAlarm();
    const tick = () => {
      this._beep(1000, 0.09, 'square', 0.5);
      this.alarmTimer = setTimeout(tick, this.alarmRate);
    };
    tick();
  }

  /** 根据剩余秒数调整蜂鸣频率（越接近爆炸越急促） */
  setAlarmUrgency(remainingSec) {
    // 15s→1000ms 间隔，0s→150ms 间隔
    this.alarmRate = Math.max(150, 150 + (remainingSec / 15) * 850);
  }

  stopAlarm() {
    if (this.alarmTimer) { clearTimeout(this.alarmTimer); this.alarmTimer = null; }
  }

  /** 爆炸：低频轰鸣 + 白噪声衰减 */
  explosion() {
    this._ensure();
    const now = this.ctx.currentTime;

    // 低频轰鸣
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.8);
    og.gain.setValueAtTime(0.9, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    osc.connect(og); og.connect(this.masterGain);
    osc.start(now); osc.stop(now + 1.05);

    // 白噪声爆裂
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.8, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    noise.connect(ng); ng.connect(this.masterGain);
    noise.start(now);
  }

  /**
   * C4 爆炸音效：优先播放本地录音 /sounds/bomb.flac；加载/播放失败时回退到合成爆炸声。
   */
  bombExplosion() {
    if (!this._bombSfxFailed) {
      try {
        const a = this._bombSfx || (this._bombSfx = new Audio('/sounds/bomb.flac'));
        a.volume = Math.min(1, this.masterVolume * 1.6);
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) {
          p.catch(() => { this._bombSfxFailed = true; this.explosion(); });
        }
        return;
      } catch (e) {
        this._bombSfxFailed = true;
      }
    }
    this.explosion();
  }

  /**
   * C4 安放语音 "The bomb is down!"
   * 优先使用本地录音 /sounds/bomb_planted.mp3；不存在时回退到浏览器语音合成。
   */
  bombPlantedVoice() {
    if (!this._bombVoiceFailed) {
      try {
        const a = this._bombVoice || (this._bombVoice = new Audio('/sounds/bomb_planted.mp3'));
        a.volume = Math.min(1, this.masterVolume * 2.2);
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) {
          p.catch(() => { this._bombVoiceFailed = true; this._speakBombDown(); });
        }
        return;
      } catch (e) {
        this._bombVoiceFailed = true;
      }
    }
    this._speakBombDown();
  }

  /** 使用 Web Speech API 报“The bomb is down!” */
  _speakBombDown() {
    try {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance('The bomb is down!');
      u.lang = 'en-US';
      u.rate = 1.0;
      u.pitch = 0.85;
      u.volume = 1.0;
      synth.speak(u);
    } catch (e) { /* 忽略语音失败 */ }
  }

  /** 安包进行提示音 */
  plantTick() { this._beep(440, 0.05, 'sine', 0.3); }

  /** 拆包进行提示音 */
  defuseTick() { this._beep(660, 0.05, 'sine', 0.3); }

  /** 拆除成功提示 */
  defuseSuccess() {
    this.stopAlarm();
    this._beep(880, 0.12, 'sine', 0.5);
    setTimeout(() => this._beep(1320, 0.18, 'sine', 0.5), 130);
  }

  // ===================== 战斗音效 =====================

  /** 生成一段白噪声 buffer */
  _noiseBuffer(dur) {
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** 播放一段经滤波的噪声爆裂 */
  _playNoise(dur, vol, filterType = null, freq = 1000) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    if (filterType) {
      const f = this.ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      src.connect(f); f.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /** 枪声：type = 'rifle' | 'pistol' | 'knife'，vol 用于按距离衰减 */
  gunshot(type = 'rifle', vol = 1) {
    this._ensure();
    const now = this.ctx.currentTime;
    if (type === 'knife') {
      // 挥刀破空声
      this._playNoise(0.18, 0.28 * vol, 'bandpass', 1800);
      return;
    }
    const isRifle = type === 'rifle';
    // 高频噪声爆裂（枪口爆响）
    this._playNoise(isRifle ? 0.12 : 0.10, (isRifle ? 0.5 : 0.4) * vol, 'highpass', isRifle ? 800 : 1200);
    // 低频冲击
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isRifle ? 220 : 300, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    g.gain.setValueAtTime(0.45 * vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.14);
  }

  /** 敌人开枪（更闷、按距离衰减） */
  enemyGunshot(vol = 0.5) {
    this.gunshot('rifle', Math.max(0.12, Math.min(0.7, vol)));
  }

  /** 预加载本地换弹音效元素（幂等） */
  _initReloadSfx() {
    if (this.reloadSfx || this._reloadSfxFailed) return;
    this.reloadSfx = new Audio(RELOAD_SFX_URL);
    this.reloadSfx.preload = 'auto';
    this.reloadSfx.addEventListener('error', () => { this._reloadSfxFailed = true; });
    try { this.reloadSfx.load(); } catch (e) { /* 忽略 */ }
  }

  /** 换弹：优先播放本地真实换弹录音；资源未就绪或失败时回退到合成咔哒声，保证一定有声 */
  reload() {
    this._ensure();
    this._initReloadSfx();
    // 资源已就绪（readyState>=2）才播放真实录音，否则立即用合成音，避免“经常没声音”
    if (this.reloadSfx && !this._reloadSfxFailed && this.reloadSfx.readyState >= 2) {
      try {
        this.reloadSfx.currentTime = 0;
        this.reloadSfx.volume = Math.min(1, this.masterVolume * 1.6);
        const p = this.reloadSfx.play();
        if (p && p.catch) p.catch(() => this._reloadSynth());
        return;
      } catch (e) { /* 回退到合成音 */ }
    }
    this._reloadSynth();
  }

  /** 合成换弹声（退匣咔哒 + 插匣咔哒 + 拉栓）——在线音效不可用时的回退 */
  _reloadSynth() {
    this._clickAt(0, 0.5, 900);
    this._clickAt(180, 0.5, 700);
    this._clickAt(360, 0.55, 1400);
  }

  _clickAt(delayMs, vol, freq) {
    setTimeout(() => {
      if (!this.ctx) return;
      this._playNoise(0.05, vol, 'bandpass', freq);
    }, delayMs);
  }

  /** 子弹命中肉体：低沉噗 + 短噪声 */
  hitFlesh() {
    this._ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.14);
    this._playNoise(0.06, 0.22, 'lowpass', 500);
  }

  /** 随机环境音效：手雷提示音（较大音量） */
  playShoulei() {
    if (!this._shouleiFailed) {
      try {
        const a = this._shouleiSfx || (this._shouleiSfx = new Audio('/sounds/shoulei.wav'));
        a.volume = Math.min(1, this.masterVolume * 2.0);
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(() => { this._shouleiFailed = true; });
        return;
      } catch (e) {
        this._shouleiFailed = true;
      }
    }
  }

  /** 玩家被击中音效 */
  playHited() {
    if (!this._hitedFailed) {
      try {
        const a = this._hitedSfx || (this._hitedSfx = new Audio('/sounds/hited.wav'));
        a.volume = Math.min(1, this.masterVolume * 1.5);
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(() => { this._hitedFailed = true; });
        return;
      } catch (e) {
        this._hitedFailed = true;
      }
    }
    this.hitFlesh(); // 回退到合成命中音
  }

  /** 脚步声：{ sprint, crouch, volume, enemy } */
  footstep({ sprint = false, crouch = false, volume = 1, enemy = false } = {}) {
    this._ensure();
    const now = this.ctx.currentTime;
    const dur = sprint ? 0.09 : 0.13;
    let vol = (enemy ? 0.4 : 0.8) * volume;
    if (crouch) vol *= 0.6;
    if (sprint) vol *= 1.25;
    // 低频软噗
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(sprint ? 150 : 110, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + dur);
    g.gain.setValueAtTime(Math.max(0.0001, vol), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + dur + 0.02);
    // 轻微踏地噪声
    this._playNoise(0.04, vol * 0.4, 'lowpass', 600);
  }

  /** 设置总音量（0~1），同时作用于合成音效与背景音乐 */
  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(2, v));
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    if (this.music) this.music.volume = Math.min(1, this.masterVolume * MUSIC_MIX);
    if (this.reloadSfx) this.reloadSfx.volume = Math.min(1, this.masterVolume * 1.6);
  }

  getMasterVolume() { return this.masterVolume; }

  /** 启动背景音乐（在线常规音乐；加载或播放失败时回退到合成环境声） */
  startBattleAmbience() {
    this._ensure();
    this.stopBattleAmbience();
    if (!this.music) {
      const url = BGM_URLS[Math.floor(Math.random() * BGM_URLS.length)];
      this.music = new Audio(url);
      this.music.loop = true;
      this.music.preload = 'auto';
      // 在线音乐加载失败 → 回退到合成环境声
      this.music.addEventListener('error', () => this._startSynthAmbience());
    }
    this.music.volume = Math.min(1, this.masterVolume * MUSIC_MIX);
    const p = this.music.play();
    if (p && p.catch) p.catch(() => this._startSynthAmbience());
  }

  stopBattleAmbience() {
    if (this.music) { try { this.music.pause(); } catch (e) {} }
    this._stopSynthAmbience();
  }

  /** 合成环境声（低频紧张底噪 + 摩斯短音循环）——在线音乐不可用时的回退方案 */
  _startSynthAmbience() {
    this._ensure();
    this._stopSynthAmbience();
    // 低频紧张底噪
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.04;
    this.droneGain.connect(this.masterGain);
    this.drone = this.ctx.createOscillator();
    this.drone.type = 'sine'; this.drone.frequency.value = 55;
    this.drone2 = this.ctx.createOscillator();
    this.drone2.type = 'sine'; this.drone2.frequency.value = 58.5;
    this.drone.connect(this.droneGain);
    this.drone2.connect(this.droneGain);
    this.drone.start(); this.drone2.start();
    // 电报摩斯短音循环
    const morse = () => {
      const dot = Math.random() < 0.6;
      this._beep(1200, dot ? 0.06 : 0.14, 'square', 0.1);
      const gap = dot ? 120 : 220;
      this.ambienceTimer = setTimeout(morse, gap + Math.random() * 500);
    };
    this.ambienceTimer = setTimeout(morse, 600);
  }

  _stopSynthAmbience() {
    if (this.ambienceTimer) { clearTimeout(this.ambienceTimer); this.ambienceTimer = null; }
    if (this.drone) { try { this.drone.stop(); } catch (e) {} this.drone = null; }
    if (this.drone2) { try { this.drone2.stop(); } catch (e) {} this.drone2 = null; }
    if (this.droneGain) { try { this.droneGain.disconnect(); } catch (e) {} this.droneGain = null; }
  }
}
