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
  const pct = Math.max(0, Math.min(100, val));
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

// 点击画面重新获取指针锁定
canvas.addEventListener('click', () => {
  if (startScreen.style.display === 'none') {
    canvas.requestPointerLock();
  }
});

// ESC退出时显示提示
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && startScreen.style.display === 'none') {
    // 可以添加暂停菜单
  }
});

// 结算界面“重新开始”按钮
document.getElementById('result-restart')?.addEventListener('click', () => {
  if (!game) return;
  game.audioFx?.resume();
  game.resetGame();
  canvas.requestPointerLock();
});
