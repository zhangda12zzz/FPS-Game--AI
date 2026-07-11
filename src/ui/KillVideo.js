// 击杀反馈绿幕视频播放器
// 将 public/video 下的绿幕(chroma key)视频实时抠除绿色，作为透明击杀提示叠加显示。
// 视频自带音效，直接由 <video> 元素播放，无需额外音频源。
export class KillVideo {
  constructor(canvasId = 'kill-video-canvas') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;

    // 离屏 <video> 作为帧来源与音源（不加入 DOM，仍可播放音频）
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.crossOrigin = 'anonymous';

    this._raf = null;
    this._playing = false;

    this.video.addEventListener('ended', () => this.stop());
    this.video.addEventListener('error', () => this.stop());
  }

  _srcFor(name) {
    // 文件名可能含括号（如 cf_headshot(bai)），需编码
    return `/video/${encodeURIComponent(name)}.mp4`;
  }

  /** 播放指定名称的击杀视频；volume 为 0~1，会打断当前正在播放的视频 */
  play(name, volume = 1) {
    if (!this.canvas || !this.ctx) return;
    this.stop();

    this.video.src = this._srcFor(name);
    this.video.currentTime = 0;
    this.video.muted = false;
    this.video.volume = Math.max(0, Math.min(1, volume));

    this._playing = true;
    this.canvas.classList.add('show');

    const p = this.video.play();
    if (p && p.catch) {
      p.catch(() => {
        // 若带声音自动播放被拦截，退化为静音播放（至少保留画面）
        this.video.muted = true;
        this.video.play().catch(() => this.stop());
      });
    }
    this._loop();
  }

  _loop() {
    if (!this._playing) return;
    const v = this.video;
    if (v.readyState >= 2 && v.videoWidth > 0) {
      // 素材内容(击杀图标)仅占画面下方中央的一小块区域，其余全是绿幕。
      // 裁剪到内容区域并放大，避免图标显示得过小。
      const cropX = v.videoWidth * 0.20;
      const cropY = v.videoHeight * 0.40;
      const cropW = v.videoWidth * 0.60;
      const cropH = v.videoHeight * 0.60;
      // 限制处理分辨率以保证性能
      const maxW = 640;
      const scale = Math.min(1, maxW / cropW);
      const w = Math.round(cropW * scale);
      const h = Math.round(cropH * scale);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, w, h);
      try {
        const frame = this.ctx.getImageData(0, 0, w, h);
        const d = frame.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const diff = g - Math.max(r, b); // 绿色主导程度
          if (g > 70 && diff > 60) {
            d[i + 3] = 0;                    // 纯绿幕 → 完全透明
          } else if (g > 70 && diff > 20) {
            d[i + 3] = Math.round(255 * (60 - diff) / 40); // 边缘软过渡
            // 去溢色：削弱残留绿边
            d[i + 1] = Math.round((r + b) / 2);
          }
        }
        this.ctx.putImageData(frame, 0, 0);
      } catch (e) { /* 极少数跨域读取失败时直接显示原始帧 */ }
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  stop() {
    this._playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.canvas) this.canvas.classList.remove('show');
    try { this.video.pause(); } catch (e) { /* 忽略 */ }
  }
}
