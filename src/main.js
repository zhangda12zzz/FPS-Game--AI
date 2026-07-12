import { Game } from './core/Game.js';
import { MAP_REGISTRY, findMapById } from './map/MapRegistry.js';
import { eventBus } from './core/EventBus.js';

const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const mapSelectScreen = document.getElementById('map-select-screen');
const mapGrid = document.getElementById('map-grid');
const mapSelectBackBtn = document.getElementById('map-select-back');
const canvas = document.getElementById('game-canvas');

let game = null;

// ===================== 屏幕切换 =====================
// 'start' | 'map-select' | 'game'
let currentScreen = 'start';

function showStartScreen() {
  currentScreen = 'start';
  startScreen.style.display = 'flex';
  mapSelectScreen.classList.remove('show');
}

function showMapSelect() {
  currentScreen = 'map-select';
  startScreen.style.display = 'none';
  mapSelectScreen.classList.add('show');
  if (document.pointerLockElement) document.exitPointerLock();
}

function hideMapSelect() {
  mapSelectScreen.classList.remove('show');
}

// ===================== 地图卡片渲染 =====================
function renderMapGrid() {
  if (!mapGrid) return;
  mapGrid.innerHTML = '';
  MAP_REGISTRY.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'map-card';
    card.dataset.mapId = entry.id;

    // 缩略图（可选：entry.thumb 为图片路径）
    const thumb = document.createElement('div');
    thumb.className = 'map-thumb';
    if (entry.thumb) {
      thumb.style.backgroundImage = `url('${entry.thumb}')`;
    } else {
      // 没有缩略图时用文字/图标占位
      thumb.textContent = entry.icon || '🗺️';
    }
    card.appendChild(thumb);

    const name = document.createElement('div');
    name.className = 'map-name';
    name.textContent = entry.name;
    card.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'map-desc';
    desc.textContent = entry.desc || '';
    card.appendChild(desc);

    const idTag = document.createElement('div');
    idTag.className = 'map-id';
    idTag.textContent = `ID: ${entry.id}`;
    card.appendChild(idTag);

    card.addEventListener('click', () => startGameWithMap(entry));
    mapGrid.appendChild(card);
  });
}

// ===================== 开始/切换地图 =====================
async function startGameWithMap(mapEntry) {
  try {
    hideMapSelect();
    if (!game) {
      // 首次启动：初始化游戏（武器/玩家/特效/炸弹协调器，但不加载地图）
      game = new Game(canvas);
      await game.init();
      // 首次用户交互后解锁 WebAudio 并应用当前总音量
      game.audioFx?.resume();
      applyVolume(parseInt(volumeSlider?.value ?? '40', 10));
    } else {
      // 已经在游戏中（从结算/游戏中切图），先清理世界
      // loadMap 内部会调用 _clearWorld()，无需重复
    }
    // 加载指定地图并开始游戏循环
    game.loadMap(mapEntry);
    game.start();
    canvas.requestPointerLock();
    currentScreen = 'game';
  } catch (err) {
    console.error('Start with map failed:', err);
    showMapSelect();
    startBtn.textContent = '开始游戏';
    startBtn.disabled = false;
    alert('地图加载失败: ' + err.message);
  }
}

// ===================== 回到地图选择界面 =====================
function goToMapSelect() {
  if (game) {
    game.goToMapSelect();
  }
  showMapSelect();
  setPauseUI(false);
}

// ===================== 总音量调节 =====================
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

// ===================== 事件绑定 =====================

// 主界面"开始游戏" → 进入地图选择界面
startBtn.addEventListener('click', () => {
  startBtn.blur();
  renderMapGrid();
  showMapSelect();
});

// 地图选择界面"返回主界面"
mapSelectBackBtn?.addEventListener('click', () => {
  mapSelectBackBtn.blur();
  showStartScreen();
});

// 结算界面"重新开始" → 回到地图选择
document.getElementById('result-restart')?.addEventListener('click', () => {
  goToMapSelect();
});

// HUD 左上角“重新开始”按钮 → 回到地图选择
document.getElementById('btn-reset-game')?.addEventListener('click', () => {
  goToMapSelect();
});

// Game 内部触发回到选图界面（F5 键等） → 显示地图选择 UI
eventBus.on('game:goToMapSelect', () => {
  // Game.goToMapSelect() 已做世界清理与音频停止，这里只管 UI
  renderMapGrid();
  showMapSelect();
  setPauseUI(false);
});

// ===================== 暂停 / 继续 =====================
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
  if (!game || currentScreen !== 'game') return;
  const paused = game.togglePause();
  setPauseUI(paused);
  if (paused) {
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    canvas.requestPointerLock();
  }
}

pauseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
  pauseBtn.blur();
});

// 点击画面重新获取指针锁定（仅在"游戏中"且未暂停时）
canvas.addEventListener('click', () => {
  if (currentScreen === 'game' && !game?.isGamePaused()) {
    canvas.requestPointerLock();
  }
});

// ESC / 指针锁变化：仅在"游戏中"才触发暂停
document.addEventListener('pointerlockchange', () => {
  if (!game || currentScreen !== 'game') return;
  if (!document.pointerLockElement) {
    if (!game.isGamePaused() && !game.gameOver && !game.exploding) {
      game.togglePause();
      setPauseUI(true);
    }
  } else {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    if (game.isGamePaused()) {
      game.togglePause();
      setPauseUI(false);
    }
  }
});

// 浏览器原生 F5（刷新）保持默认行为；
// 游戏内的 F5 拦截在 Game.js（Input）里，会触发 goToMapSelect()。

// 初次进入主界面
showStartScreen();
