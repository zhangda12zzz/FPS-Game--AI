import { Game } from './core/Game.js';

const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const canvas = document.getElementById('game-canvas');

let game = null;

// 总音量调节（可拖动滑块，同时作用于背景音乐与战斗音效）
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const volumeIcon = document.getElementById('volume-icon');

function applyVolume(val) {
  const pct = Math.max(0, Math.min(200, val));
  game?.audioFx?.setMasterVolume(pct / 100);
  if (volumeValue) volumeValue.textContent = pct;
  if (volumeIcon) volumeIcon.textContent = pct === 0 ? '🔇' : (pct < 45 ? '🔉' : '🔊');
  localStorage.setItem('fps_master_volume', String(pct));
}

if (volumeSlider) {
  const saved = parseInt(localStorage.getItem('fps_master_volume') ?? '40', 10);
  volumeSlider.value = Number.isFinite(saved) ? saved : 40;
  applyVolume(parseInt(volumeSlider.value, 10));
  volumeSlider.addEventListener('input', () => applyVolume(parseInt(volumeSlider.value, 10)));
}

startBtn.addEventListener('click', async () => {
  try {
    startBtn.textContent = '加载中...';
    startBtn.disabled = true;

    if (!game) {
      game = new Game(canvas);
      await game.init();
      startScreen.style.display = 'none';
      // 首次用户交互后解锁 WebAudio
      game.audioFx?.resume();
      // 应用当前总音量设置
      applyVolume(parseInt(volumeSlider?.value ?? '40', 10));
      canvas.requestPointerLock();
      game.start();
    }
  } catch (err) {
    console.error('Game init failed:', err);
    startScreen.style.display = 'flex';
    startBtn.textContent = '开始游戏';
    startBtn.disabled = false;
    alert('游戏初始化失败: ' + err.message);
  }
});

// === 暂停 / 继续 ===
const pauseBtn = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');

function setPauseUI(paused) {
  if (pauseBtn) {
    pauseBtn.textContent = paused ? '▶' : '❚❚';
    pauseBtn.classList.toggle('paused', paused);
  }
  pauseOverlay?.classList.toggle('show', paused);
}

function togglePause() {
  if (!game) return;
  const paused = game.togglePause();
  setPauseUI(paused);
  if (paused) {
    // 暂停时释放指针锁，让玩家能点击其他按钮
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    canvas.requestPointerLock();
  }
}

pauseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  // 避免与点击画面重新锁定指针锁冲突
  togglePause();
  // 点击后立即失焦，避免空格/回车（跳跃键）再次“点击”按钮而误触发暂停
  pauseBtn.blur();
});

// 点击画面重新获取指针锁定（仅在未暂停时）
canvas.addEventListener('click', () => {
  if (startScreen.style.display === 'none' && !game?.isGamePaused()) {
    canvas.requestPointerLock();
  }
});

// ESC 退出指针锁 → 自动暂停；重新锁定 → 自动继续
document.addEventListener('pointerlockchange', () => {
  if (!game || startScreen.style.display !== 'none') return;
  if (!document.pointerLockElement) {
    // 释放锁 → 进入暂停。
    // 仅在“正常游玩”时才视为 Esc 主动暂停；
    // 爆炸特效(exploding)与结算(gameOver)也会释放指针锁，此时不应显示暂停页面
    if (!game.isGamePaused() && !game.gameOver && !game.exploding) {
      game.togglePause();
      setPauseUI(true);
    }
  } else {
    // 重新锁定 → 继续，并清除按钮焦点，避免空格/回车误触发 HUD 按钮
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    if (game.isGamePaused()) {
      game.togglePause();
      setPauseUI(false);
    }
  }
});

// 结算界面“重新开始”按钮
document.getElementById('result-restart')?.addEventListener('click', () => {
  if (!game) return;
  game.resetGame();
  setPauseUI(false);
  canvas.requestPointerLock();
});
