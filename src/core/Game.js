import * as THREE from 'three';
import { eventBus } from './EventBus.js';
import { PLAYER, WEAPONS, ENEMY, BOMB } from './Constants.js';
import { Input } from './Input.js';
import { Physics } from './Physics.js';
import { SceneManager } from './SceneManager.js';
import { PlayerController } from '../player/PlayerController.js';
import { Health } from '../player/Health.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { ParticleManager } from '../effects/ParticleManager.js';
import { MuzzleFlash } from '../effects/MuzzleFlash.js';
import { BulletTracer } from '../effects/BulletTracer.js';
import { BloodSplatter } from '../effects/BloodSplatter.js';
import { MapLoader } from '../map/MapLoader.js';
import { Map_Transport } from '../map/Map_Transport.js';
import { BombManager } from '../modes/BombManager.js';
import { AudioFx } from './AudioFx.js';
import { KillVideo } from '../ui/KillVideo.js';
import { Pathfinder } from '../enemies/Pathfinder.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.sceneManager = new SceneManager(canvas);
    this.physics = new Physics();
    this.input = new Input(canvas);
    this.clock = new THREE.Clock();
    this.isRunning = false;
    this.isPaused = false;  // 暂停状态

    // 核心系统
    this.playerController = null;
    this.health = null;
    this.weaponManager = null;
    this.enemyManager = null;
    this.mapInstance = null;
    this.particleManager = null;
    this.muzzleFlash = null;
    this.bulletTracer = null;
    this.bloodSplatter = null;
    this.raycaster = new THREE.Raycaster();

    // 炸弹模式
    this.audioFx = new AudioFx();
    this.bombManager = null;
    this.gameOver = false;
    this.exploding = false;   // 炸弹爆炸特效进行中(白屏+震动)，此间冻结输入/结算
    this.pathfinder = null;   // 敌人网格 A* 寻路器

    // 游戏状态
    this.kills = 0;
    this.deaths = 0;
    this.timer = 300; // 5分钟
    this.enemyAttackEnabled = false;
    this.isReloading = false;
    this.reloadStartTime = 0;
    this.reloadDuration = 0;

    // 开镜(ADS)状态
    this.isAiming = false;
    this.aimLocked = false;   // 点击切换模式的锁定状态
    this.aimPressTime = 0;    // 右键按下时刻（用于区分长按/点击）
    this.baseFov = 75;      // 默认视野（与相机初始 FOV 一致）
    this.currentFov = 75;   // 平滑插值的当前视野

    // 击杀反馈（绿幕视频）与连杀计数
    this.killVideo = new KillVideo();
    this.killStreak = 0;
    this.lastKillTime = 0;
    this.STREAK_WINDOW = 5000; // 连杀有效窗口(ms)

    // 小地图
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.mapObstacles = []; // {x, z, w, d} 用于小地图绘制
    // 可移动空间边界（船体甲板，世界坐标）。长边为X方向(80)，短边为Z方向(20)
    this.mapBounds = { minX: -40, maxX: 40, minZ: -10, maxZ: 10 };

    this._bindEvents();
  }

  _bindEvents() {
    eventBus.on('player:damaged', (data) => this._onPlayerDamaged(data));
    eventBus.on('player:died', () => this._onPlayerDied());
    eventBus.on('enemy:killed', (data) => this._onEnemyKilled(data));
    eventBus.on('enemy:attack', (data) => this._onEnemyAttack(data));
    eventBus.on('enemy:damaged', (data) => this._showDamageNumber(data));
    eventBus.on('ui:enemyCount', (data) => {
      const aliveEl = document.getElementById('enemy-alive');
      const totalEl = document.getElementById('enemy-total');
      if (aliveEl) aliveEl.textContent = data.alive ?? data.count ?? 0;
      // 右侧显示剩余待消灭总数（从 20 递减）
      if (totalEl) totalEl.textContent = data.remaining ?? data.total ?? 0;
    });

    // 炸弹模式事件
    eventBus.on('bomb:planted', (data) => this._onBombPlanted(data));
    eventBus.on('bomb:defused', () => this._onBombDefused());
    eventBus.on('bomb:exploded', (data) => this._onBombExploded(data));
    eventBus.on('enemy:carrierAssigned', () => {
      this._showNotification('⚠ 敌方炸弹携带者正在逼近你的老家！', 2500);
    });

    // 控制按钮
    document.getElementById('btn-enemy-attack')?.addEventListener('click', () => this.toggleEnemyAttack());
    document.getElementById('btn-reset-game')?.addEventListener('click', () => this.resetGame());
  }

  async init() {
    // 加载地图 (避免循环依赖，直接使用Map_Transport)
    this.mapInstance = new Map_Transport(this.sceneManager.scene, this.physics);
    this.mapInstance.load();
    // 收集障碍物信息用于小地图
    this._collectMapObstacles();

    // 玩家
    this.playerController = new PlayerController(this.sceneManager.camera, this.physics, this.input, this.canvas);
    this.health = new Health();

    // 武器
    this.weaponManager = new WeaponManager(this.sceneManager.camera, this.sceneManager.scene);
    await this.weaponManager.init();

    // 敌人（在敌方老家出生）
    this.enemyManager = new EnemyManager(this.physics);
    const spawnPoints = this.mapInstance?.enemySpawnPoints || this.mapInstance?.spawnPoints || [];
    const plantZone = this.mapInstance?.getPlantZone ? this.mapInstance.getPlantZone() : new THREE.Vector3(34, 0, 0);
    this.plantZone = plantZone;
    // 网格寻路器：让敌人绕开障碍/被堵时改走其他过道
    this.pathfinder = new Pathfinder(this.mapBounds, this.mapObstacles);
    this.enemyManager.init(this.sceneManager.scene, spawnPoints, plantZone, this.pathfinder);

    // 特效
    this.particleManager = new ParticleManager(this.sceneManager.scene);
    this.muzzleFlash = new MuzzleFlash(this.sceneManager.scene);
    this.bulletTracer = new BulletTracer(this.sceneManager.scene);
    this.bloodSplatter = new BloodSplatter(this.sceneManager.scene);

    // 炸弹模式：先建协调器，再指派首位携带者
    this.bombManager = new BombManager(this.sceneManager.scene, this.audioFx);
    this.enemyManager.assignCarrier();

    // 玩家重生
    const spawnPoint = this.mapInstance.getPlayerSpawn ? this.mapInstance.getPlayerSpawn() : new THREE.Vector3(10, 1, 0);
    this.playerController.respawn(spawnPoint);
    this.health.reset();

    // 绘制准星
    this._drawCrosshair();

    // 初始HUD更新
    this._updateHUD();
  }

  _collectMapObstacles() {
    this.mapObstacles = [];
    this.sceneManager.scene.traverse(child => {
      if (child.isMesh && (child.userData.type === 'wall' || child.userData.type === 'container')) {
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        // 跳过地板/甲板等薄层（高度过低），避免占满整个小地图
        if (size.y < 0.6) return;
        this.mapObstacles.push({ x: center.x, z: center.z, w: size.x, d: size.z });
      }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.clock.start();
    this.input.enablePointerLock();
    this.audioFx?.startBattleAmbience();
    this._gameLoop();
  }

  /** 暂停 / 继续游戏 */
  togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      // 暂停时释放时钟增量，避免恢复时一帧 dt 过大
      this.clock.getDelta();
      this.audioFx?.pause?.();
    } else {
      // 恢复时重置时钟
      this.clock.getDelta();
      this.audioFx?.resume?.();
    }
    return this.isPaused;
  }

  /** 查询是否处于暂停状态 */
  isGamePaused() {
    return this.isPaused;
  }

  _gameLoop() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this._gameLoop());

    // 暂停：保持循环不跑逻辑，但保留时钟与输入同步
    if (this.isPaused) return;

    const dt = this.clock.getDelta();

    // 计时器
    this.timer -= dt;
    if (this.timer <= 0) this.timer = 300;

    // 更新系统
    this.playerController.update(dt);
    this.weaponManager.update(dt);
    this.enemyManager.update(dt, this.playerController.getPosition());
    this.particleManager.update(dt);
    this.muzzleFlash.update(dt);
    this.bulletTracer.update(dt);
    this.bloodSplatter.update(dt);
    this.physics.update(dt);

    // 炸弹模式更新（E 键按住拆包）
    const defuseHeld = this.input.isKeyPressed('KeyE');
    this.bombManager.update(dt, this.playerController.getPosition(), defuseHeld);

    // 处理输入
    this._handleInput(dt);

    // 开镜（右键 ADS）状态与相机 FOV 同步
    this._updateAim(dt);

    // 脚步声（玩家 + 敌人）
    this._updateFootsteps(dt);

    // 换弹进度
    this._updateReloadProgress();

    // HUD
    this._updateHUD();
    this._updateTimerDisplay();
    this._updateBombUI();

    // 全歼判定 → 胜利（炸弹已安放时需先拆除才能胜利；炸弹已引爆/爆炸特效期间不得判胜）
    if (!this.gameOver && !this.exploding && this.enemyManager.isCleared() && !this.bombManager?.isArmed) {
      this._endGame('win');
    }

    // 小地图
    this._drawMinimap();

    // 渲染
    this.sceneManager.render();

    // 清除单帧输入状态
    this.input.endFrame();
  }

  _handleInput(dt) {
    // 爆炸白屏期间冻结玩家操作
    if (this.exploding) return;
    // 武器切换
    if (this.input.isKeyJustPressed('Digit1') || this.input.isKeyJustPressed('Numpad1')) this._switchWeapon(0);
    if (this.input.isKeyJustPressed('Digit2') || this.input.isKeyJustPressed('Numpad2')) this._switchWeapon(1);
    if (this.input.isKeyJustPressed('Digit3') || this.input.isKeyJustPressed('Numpad3')) this._switchWeapon(2);

    // 射击 (非换弹中)
    if (!this.isReloading && this.input.isMouseDown()) {
      const weapon = this.weaponManager.getCurrentWeapon();
      if (weapon && weapon.canFire()) {
        if (weapon.ammo !== undefined && weapon.ammo <= 0) {
          // 弹匣空了自动换弹
          this._startReload();
        } else {
          weapon.fire();
          this._handleShot();
        }
      }
    }

    // 换弹 R
    if (this.input.isKeyJustPressed('KeyR') && !this.isReloading) {
      this._startReload();
    }

    // 敌人攻击开关 F2
    if (this.input.isKeyJustPressed('F2')) {
      this.toggleEnemyAttack();
    }

    // 重新开始 F5
    if (this.input.isKeyJustPressed('F5')) {
      this.resetGame();
    }

    // 计分板 Tab
    if (this.input.isKeyJustPressed('Tab')) {
      this._toggleScoreboard(true);
    }
    if (this.input.isKeyJustReleased('Tab')) {
      this._toggleScoreboard(false);
    }
  }

  /** 脚步声调度：玩家随移动快慢变化（冲刺更局促），敌人就近限频播放 */
  _updateFootsteps(dt) {
    const pc = this.playerController;
    // 玩家脚步（仅触地移动时）
    if (pc && pc.isMoving && pc.canJump) {
      const interval = pc.isCrouching ? 0.55 : (pc.isSprinting ? 0.28 : 0.45);
      this._stepTimer = (this._stepTimer || 0) + dt;
      if (this._stepTimer >= interval) {
        this._stepTimer = 0;
        this.audioFx?.footstep({ sprint: pc.isSprinting, crouch: pc.isCrouching });
      }
    } else {
      this._stepTimer = 0;
    }

    // 敌人脚步：全局限频，每 0.3s 为最近的移动敌人播一下（音量按距离）
    this._enemyStepTimer = (this._enemyStepTimer || 0) + dt;
    if (this._enemyStepTimer >= 0.3) {
      this._enemyStepTimer = 0;
      const playerPos = pc.getPosition();
      let nearest = null, nd = Infinity;
      this.enemyManager.getEnemies().forEach(e => {
        if (e.isDead) return;
        const v = e.body?.velocity;
        const sp = v ? Math.hypot(v.x, v.z) : 0;
        if (sp < 1) return; // 未移动
        const d = e.group.position.distanceTo(playerPos);
        if (d < nd) { nd = d; nearest = e; }
      });
      if (nearest && nd < 30) {
        this.audioFx?.footstep({ enemy: true, volume: Math.max(0.1, 1 - nd / 30) });
      }
    }
  }

  _handleShot() {
    const weapon = this.weaponManager.getCurrentWeapon();
    if (!weapon) return;
    const config = weapon.config;

    // 开火音效（按武器槽位区分：1=步枪 2=手枪 3=刀）
    let shotType = 'rifle';
    if (config.slot === 3) shotType = 'knife';
    else if (config.slot === 2) shotType = 'pistol';
    this.audioFx?.gunshot(shotType);

    // 射线检测
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera);
    this.raycaster.far = config.range || 200;

    const enemyMeshes = this.enemyManager.getEnemyMeshes();
    // 给mesh标记所属敌人
    this.enemyManager.getEnemies().forEach(e => {
      if (!e.isDead) e.group.traverse(c => { if (c.isMesh) c.userData.enemy = e; });
    });

    const hits = this.raycaster.intersectObjects(enemyMeshes, false);

    // 计算枪口世界位置
    const muzzleWorldPos = this._getPlayerMuzzlePos();

    if (hits.length > 0) {
      const hit = hits[0];
      const enemy = hit.object.userData.enemy;

      // 弹道
      this.bulletTracer.create(muzzleWorldPos, hit.point);

      // 血液
      this.bloodSplatter.create(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0));

      // 伤害（检查是否命中头部，爆头使用武器爆头伤害）
      const isHeadshot = hit.object.userData.isHead === true;
      const dmg = isHeadshot
        ? (config.headshotDamage ?? Math.round(config.damage * (ENEMY.HEADSHOT_MULTIPLIER || 2.5)))
        : config.damage;
      const hpBefore = enemy.health;
      const wasAlreadyDead = enemy.isDead;
      enemy.takeDamage(dmg, { name: '玩家', isHeadshot: isHeadshot }, hit.object);

      // 命中肉体音效
      this.audioFx?.hitFlesh();

      // 本次射击造成击杀 → 触发击杀反馈视频
      if (!wasAlreadyDead && enemy.isDead) {
        this._onPlayerKill({
          isHeadshot,
          isKnife: config.slot === 3,
          wasFullHealth: hpBefore >= ENEMY.HEALTH,
        });
      }

      // 命中标记
      this._showHitmarker();
    } else {
      // 未命中 → 延伸到最大射程
      const dir = new THREE.Vector3();
      this.raycaster.ray.direction.normalize();
      dir.copy(this.raycaster.ray.direction);
      const endPoint = muzzleWorldPos.clone().add(dir.multiplyScalar(config.range || 100));
      this.bulletTracer.create(muzzleWorldPos, endPoint);
    }

    // 枪口火焰
    this.muzzleFlash.show(muzzleWorldPos);

    // 后坐力
    this.playerController.applyRecoil(config.recoil || 0.02);

    // 粒子
    this.particleManager.createMuzzleParticles(muzzleWorldPos, 3);
  }

  _getPlayerMuzzlePos() {
    const camera = this.sceneManager.camera;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const down = new THREE.Vector3(0, -1, 0);
    return camera.position.clone()
      .add(right.multiplyScalar(0.25))
      .add(down.multiplyScalar(0.15))
      .add(forward.multiplyScalar(0.8));
  }

  _updateAim(dt) {
    const weapon = this.weaponManager.getCurrentWeapon();
    const canAds = !!(weapon && weapon.config && weapon.config.adsFov);

    if (canAds) {
      const CLICK_MS = 200; // 短于此时长视为“点击”，用于切换锁定
      if (this.input.isMouseJustPressed(2)) {
        this.aimPressTime = performance.now();
      }
      if (this.input.isMouseJustReleased(2)) {
        const dur = performance.now() - this.aimPressTime;
        if (dur < CLICK_MS) {
          this.aimLocked = !this.aimLocked; // 点击：切换锁定开镜
        } else {
          this.aimLocked = false;           // 长按松开：退出开镜
        }
      }
      // 长按（右键按住）或点击锁定，任一成立即处于瞄准状态
      this.isAiming = this.input.isMouseDown(2) || this.aimLocked;
    } else {
      this.isAiming = false;
      this.aimLocked = false;
    }

    // 同步武器模型位置、鼠标灵敏度与移动速度
    this.weaponManager.setAiming(this.isAiming);
    this.playerController.sensitivityScale = this.isAiming ? 0.5 : 1;
    this.playerController.moveSpeedScale = this.isAiming ? 0.4 : 1;

    // 相机 FOV 平滑插值到目标视野
    const targetFov = (this.isAiming && weapon) ? (weapon.config.adsFov || this.baseFov) : this.baseFov;
    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 12);
    const cam = this.sceneManager.camera;
    if (Math.abs(cam.fov - this.currentFov) > 0.01) {
      cam.fov = this.currentFov;
      cam.updateProjectionMatrix();
    }
  }

  _startReload() {
    const weapon = this.weaponManager.getCurrentWeapon();
    if (!weapon || !weapon.config.magSize) return; // 刀没有弹匣
    if (weapon.ammo >= weapon.config.magSize) return; // 满了不换
    if (weapon.reserveAmmo <= 0) return; // 没备弹不换

    this.isReloading = true;
    this.reloadStartTime = Date.now();
    this.reloadDuration = weapon.config.reloadTime || 2500;
    this.audioFx?.reload();

    document.getElementById('reload-bar')?.classList.add('show');
    document.getElementById('reload-text')?.classList.add('show');
  }

  _updateReloadProgress() {
    if (!this.isReloading) return;
    const elapsed = Date.now() - this.reloadStartTime;
    const progress = Math.min(elapsed / this.reloadDuration, 1);

    const fill = document.getElementById('reload-fill');
    if (fill) fill.style.width = `${progress * 100}%`;

    // 显示剩余换弹时间（保留一位小数，倒计时至0）
    const remaining = Math.max(0, (this.reloadDuration - elapsed) / 1000);
    const textEl = document.getElementById('reload-text');
    if (textEl) textEl.textContent = `换弹中... ${remaining.toFixed(1)}s`;

    if (progress >= 1) {
      this._finishReload();
    }
  }

  _finishReload() {
    const weapon = this.weaponManager.getCurrentWeapon();
    if (weapon && weapon.config.magSize) {
      const needed = weapon.config.magSize - weapon.ammo;
      const take = Math.min(needed, weapon.reserveAmmo);
      weapon.ammo += take;
      weapon.reserveAmmo -= take;
    }

    this.isReloading = false;
    document.getElementById('reload-bar')?.classList.remove('show');
    document.getElementById('reload-text')?.classList.remove('show');
  }

  _switchWeapon(slot) {
    // 换枪时取消换弹
    if (this.isReloading) {
      this.isReloading = false;
      document.getElementById('reload-bar')?.classList.remove('show');
      document.getElementById('reload-text')?.classList.remove('show');
    }
    this.weaponManager.switchTo(slot);
    // 切枪时解除点击锁定的开镜状态，避免残留
    this.aimLocked = false;

    // 更新武器名称显示
    const weaponNameEl = document.getElementById('hud-weapon-name');
    if (weaponNameEl && this.weaponManager.getCurrentWeapon()) {
      weaponNameEl.textContent = this.weaponManager.getCurrentWeapon().name;
    }
  }

  toggleEnemyAttack() {
    this.enemyAttackEnabled = !this.enemyAttackEnabled;
    this.enemyManager.setEnemyAttack(this.enemyAttackEnabled);
    const btn = document.getElementById('btn-enemy-attack');
    if (btn) {
      btn.classList.toggle('active', this.enemyAttackEnabled);
      btn.innerHTML = `<span class="btn-key">F2</span>敌人攻击: ${this.enemyAttackEnabled ? '开' : '关'}`;
    }
    this._showNotification(`敌人攻击：${this.enemyAttackEnabled ? '已开启' : '已关闭'}`);
  }

  resetGame() {
    // 完全重置
    this.isPaused = false; // 重置暂停状态
    this.kills = 0;
    this.deaths = 0;
    this.timer = 300;
    this.isReloading = false;
    this.enemyAttackEnabled = false;

    document.getElementById('reload-bar')?.classList.remove('show');
    document.getElementById('reload-text')?.classList.remove('show');

    // 重置炸弹模式 + 结算界面
    this.bombManager?.reset();
    this.audioFx?.stopAlarm();
    document.getElementById('result-overlay')?.classList.remove('show');
    document.getElementById('bomb-timer')?.classList.remove('show');
    document.getElementById('defuse-bar')?.classList.remove('show');
    document.getElementById('defuse-text')?.classList.remove('show');

    // 重置敌人并重新指派携带者
    this.enemyManager.resetEnemies();
    this.enemyManager.setEnemyAttack(false);

    const btn = document.getElementById('btn-enemy-attack');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = `<span class="btn-key">F2</span>敌人攻击: 关`;
    }

    // 重置玩家（回到玩家老家）
    const spawnPoint = this.mapInstance?.getPlayerSpawn ? this.mapInstance.getPlayerSpawn() : new THREE.Vector3(34, 1, 0);
    this.playerController.respawn(spawnPoint);
    this.health.reset();

    // 重置武器
    this.weaponManager.switchTo(0);
    this.weaponManager.resetAllAmmo();
    this.aimLocked = false;
    this.isAiming = false;

    this._updateHUD();
    this._showNotification('游戏已重新开始');

    // 重启背景电报环境声（_endGame 时已停止）
    this.audioFx?.startBattleAmbience();

    // 若因结算冻结过，重新启动循环与指针锁定
    if (this.gameOver) {
      this.gameOver = false;
      this.isRunning = true;
      this.clock.getDelta(); // 丢弃暂停期间的大 delta
      this.input.enablePointerLock();
      this.canvas.requestPointerLock();
      this._gameLoop();
    }
  }

  _onPlayerDamaged(data) {
    const overlay = document.getElementById('damage-overlay');
    if (overlay) {
      overlay.classList.add('show');
      setTimeout(() => overlay.classList.remove('show'), 200);
    }
  }

  _onPlayerDied() {
    this.deaths++;
    this.health.reset();
    const spawnPoint = this.mapInstance?.getPlayerSpawn ? this.mapInstance.getPlayerSpawn() : new THREE.Vector3(34, 1, 0);
    this.playerController.respawn(spawnPoint);
    this._showNotification('你已阵亡，正在重生...');
  }

  _onEnemyKilled(data) {
    this.kills++;
    const killfeed = document.getElementById('killfeed');
    if (killfeed) {
      const item = document.createElement('div');
      item.className = 'killfeed-item';
      item.innerHTML = `<span class="killer">你</span><span class="weapon">[${this.weaponManager.getCurrentWeapon()?.config?.name || '未知'}]</span><span class="victim">敌人</span>${data.isHeadshot ? ' <span class="headshot-tag">💥爆头击杀</span>' : ''}`;
      killfeed.appendChild(item);
      setTimeout(() => item.remove(), 4000);
    }
  }

  _onEnemyAttack(data) {
    // 敌人开枪音效（按距离衰减）
    const dist = data.distance ?? 20;
    this.audioFx?.enemyGunshot(Math.max(0.15, 1 - dist / 40));

    // 距离越远命中率越低
    const hitChance = Math.max(0.1, 1 - data.distance / ENEMY.ATTACK_RANGE);
    if (Math.random() < hitChance) {
      this.health.takeDamage(data.damage);
    }

    // 敌人枪口火焰 + 弹道
    const playerPos = this.playerController.getPosition();
    if (data.muzzlePos) {
      this.muzzleFlash.show(data.muzzlePos);

      const hitPoint = playerPos.clone();
      hitPoint.y += 1.0;
      this.bulletTracer.create(data.muzzlePos, hitPoint);
      this.particleManager.createMuzzleParticles(data.muzzlePos, 2);
    }
  }

  // === 炸弹模式事件 ===
  _onBombPlanted(data) {
    document.getElementById('bomb-timer')?.classList.add('show');
    this._showNotification('💣 炸弹已安放！快去拆除（靠近后按住 E）', 3000);
    // C4 被放置时触发语音 "The bomb is down!"
    this.audioFx?.bombPlantedVoice();
  }

  _onBombDefused() {
    document.getElementById('bomb-timer')?.classList.remove('show');
    document.getElementById('defuse-bar')?.classList.remove('show');
    document.getElementById('defuse-text')?.classList.remove('show');
    this._showNotification('✅ 炸弹已拆除，危机解除！', 2500);
    // 拆弹成功后，若敌人已全歼则胜利
    if (!this.gameOver && this.enemyManager.isCleared()) {
      this._endGame('win');
    }
  }

  _onBombExploded(data) {
    document.getElementById('bomb-timer')?.classList.remove('show');
    document.getElementById('defuse-bar')?.classList.remove('show');
    document.getElementById('defuse-text')?.classList.remove('show');
    // 爆炸粒子特效
    if (data?.position && this.particleManager) {
      const p = data.position.clone(); p.y = 0.5;
      this.particleManager.createMuzzleParticles(p, 40);
    }
    // 先播放爆炸特效（白屏2s+震动+音效），结束后再结算失败
    this._triggerExplosionFx();
    setTimeout(() => {
      this.exploding = false;
      this._endGame('lose');
    }, 2000);
  }

  /** C4 爆炸视听特效：屏幕白闪 2s + 镜头震动 + 爆炸音效 */
  _triggerExplosionFx() {
    if (this.exploding) return;
    this.exploding = true;
    // 释放指针锁定，避免玩家白屏期间误操作
    if (document.pointerLockElement) document.exitPointerLock();
    this.audioFx?.bombExplosion();
    const flash = document.getElementById('explosion-flash');
    if (flash) {
      flash.classList.remove('show');
      // 强制重排以重新触发动画
      void flash.offsetWidth;
      flash.classList.add('show');
    }
    const canvas = this.canvas || document.getElementById('game-canvas');
    if (canvas) {
      canvas.classList.remove('shake');
      void canvas.offsetWidth;
      canvas.classList.add('shake');
      setTimeout(() => canvas.classList.remove('shake'), 800);
    }
  }

  _endGame(result) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.isRunning = false;
    this.bombManager?.reset();
    this.audioFx?.stopAlarm();
    this.audioFx?.stopBattleAmbience();
    if (document.pointerLockElement) document.exitPointerLock();

    const overlay = document.getElementById('result-overlay');
    const titleEl = document.getElementById('result-title');
    const descEl = document.getElementById('result-desc');
    if (titleEl && descEl) {
      if (result === 'win') {
        titleEl.textContent = '游戏成功';
        titleEl.className = 'win';
        descEl.textContent = `你消灭了所有敌人！击杀 ${this.kills} / 阵亡 ${this.deaths}`;
      } else {
        titleEl.textContent = '游戏失败';
        titleEl.className = 'lose';
        descEl.textContent = '炸弹被引爆，防守失败！';
      }
    }
    if (overlay) overlay.classList.add('show');

    // 防止游戏结束释放指针锁时残留的点击落到居中按钮上导致瞬间重开
    const restartBtn = document.getElementById('result-restart');
    if (restartBtn) {
      restartBtn.disabled = true;
      setTimeout(() => { restartBtn.disabled = false; }, 700);
    }
  }

  _updateBombUI() {
    const info = this.bombManager?.getBombInfo();
    const timerEl = document.getElementById('bomb-timer');
    const bar = document.getElementById('defuse-bar');
    const fill = document.getElementById('defuse-fill');
    const text = document.getElementById('defuse-text');

    if (info) {
      if (timerEl) {
        timerEl.classList.add('show');
        timerEl.textContent = `💣 ${info.remaining.toFixed(1)}s`;
      }
      // 拆包进度条
      if (info.defusing) {
        bar?.classList.add('show');
        text?.classList.add('show');
        if (fill) fill.style.width = `${info.defuseRatio * 100}%`;
      } else {
        bar?.classList.remove('show');
        text?.classList.remove('show');
      }
    } else {
      timerEl?.classList.remove('show');
      bar?.classList.remove('show');
      text?.classList.remove('show');
    }
  }

  _showDamageNumber(data) {
    const container = document.getElementById('damage-numbers');
    if (!container) return;

    // 将3D世界坐标投影到屏幕
    const pos3d = data.worldPos.clone();
    pos3d.project(this.sceneManager.camera);
    const x = (pos3d.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos3d.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = 'dmg-num';
    if (data.isHeadshot) el.classList.add('headshot');
    el.textContent = data.isHeadshot ? `爆头 -${data.damage}` : `-${data.damage}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  _showHitmarker() {
    const hm = document.getElementById('hitmarker');
    if (hm) {
      hm.classList.remove('show');
      void hm.offsetWidth; // 重触发动画
      hm.classList.add('show');
    }
  }

  _showNotification(text, duration = 2000) {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._notifyTimeout);
    this._notifyTimeout = setTimeout(() => el.classList.remove('show'), duration);
  }

  /**
   * 玩家击杀反馈（绿幕视频）。优先级：刀杀 > 爆头 > 普通连杀。
   * 连杀窗口 5 秒；爆头不打断连杀计数（后台照常累加）；刀杀立即清零连杀。
   */
  _onPlayerKill({ isHeadshot, isKnife, wasFullHealth }) {
    const now = performance.now();
    const vol = Math.min(1, (this.audioFx?.masterVolume ?? 0.5) * 1.8);

    // 刀杀：最高优先级，立即重置连杀
    if (isKnife) {
      this.killStreak = 0;
      this.lastKillTime = now;
      this.killVideo?.play('cf_kinfe', vol);
      return;
    }

    // 连杀累加（普通击杀与爆头击杀都计入）
    if (now - this.lastKillTime <= this.STREAK_WINDOW) {
      this.killStreak += 1;
    } else {
      this.killStreak = 1;
    }
    this.lastKillTime = now;

    // 爆头：优先展示爆头专属视频（满血一枪爆头 vs 非满血/多枪爆头）
    if (isHeadshot) {
      this.killVideo?.play(wasFullHealth ? 'cf_headshot' : 'cf_headshot(bai)', vol);
      return;
    }

    // 普通连杀：1~7 播 cf_[N]kill，≥8 固定 cf_8kill
    const n = Math.min(Math.max(this.killStreak, 1), 8);
    this.killVideo?.play(`cf_${n}kill`, vol);
  }

  _updateHUD() {
    const weapon = this.weaponManager.getCurrentWeapon();
    if (weapon) {
      const ammoEl = document.getElementById('ammo-current');
      const reserveEl = document.getElementById('ammo-reserve');
      if (ammoEl) ammoEl.textContent = weapon.ammo !== undefined ? weapon.ammo : '∞';
      if (reserveEl) reserveEl.textContent = weapon.reserveAmmo !== undefined ? weapon.reserveAmmo : '-';
    }
    const healthEl = document.getElementById('health-value');
    if (healthEl) healthEl.textContent = this.health.health;

    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.textContent = `${this.kills} / ${this.deaths}`;
  }

  _updateTimerDisplay() {
    const mins = Math.floor(this.timer / 60);
    const secs = Math.floor(this.timer % 60);
    const el = document.getElementById('timer-display');
    if (el) el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _drawMinimap() {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const w = this.minimapCanvas.width;   // 110
    const h = this.minimapCanvas.height;  // 190
    const pad = 6;
    const b = this.mapBounds;
    const spanX = b.maxX - b.minX; // 世界X跨度(长边) → 画布竖直方向
    const spanZ = b.maxZ - b.minZ; // 世界Z跨度(短边) → 画布水平方向

    // 水平/竖直分开取比例，各自填满画布，避免长条地图居中后左右大片空缺
    // 长边(X)映射到竖直方向，短边(Z)映射到水平方向并填满宽度（与下方按钮对齐）
    const scaleZ = (w - pad * 2) / spanZ; // 水平方向每世界单位像素
    const scaleX = (h - pad * 2) / spanX; // 竖直方向每世界单位像素

    const playerPos = this.playerController.getPosition();
    const yaw = this.playerController.yaw;

    // 世界坐标 → 小地图画布坐标（固定朝向，不随玩家旋转）
    // 世界+X → 画布上方；世界+Z → 画布右方；地图中心(0,0)对齐画布中心
    const cx0 = w / 2, cy0 = h / 2;
    const toMap = (wx, wz) => [cx0 + wz * scaleZ, cy0 - wx * scaleX];

    ctx.clearRect(0, 0, w, h);

    // 可移动区域范围矩形（半透明背景）
    const [rx0, ry0] = toMap(b.maxX, b.minZ); // 左上
    const rectW = spanZ * scaleZ;
    const rectH = spanX * scaleX;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx0, ry0, rectW, rectH);
    ctx.fillStyle = 'rgba(30, 40, 35, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 200, 140, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 裁剪到可移动区域，只显示地图内物体
    ctx.clip();

    // 绘制障碍物（真实位置；世界X→竖直，世界Z→水平）
    ctx.fillStyle = 'rgba(150, 150, 120, 0.75)';
    this.mapObstacles.forEach(obs => {
      const [ocx, ocy] = toMap(obs.x, obs.z);
      const ow = obs.d * scaleZ; // Z跨度 → 水平宽度
      const oh = obs.w * scaleX; // X跨度 → 竖直高度
      ctx.fillRect(ocx - ow / 2, ocy - oh / 2, ow, oh);
    });

    // 安包区轮廓（玩家老家）
    if (this.plantZone) {
      const [zx, zy] = toMap(this.plantZone.x, this.plantZone.z);
      ctx.strokeStyle = 'rgba(120, 170, 255, 0.8)';
      ctx.lineWidth = 1;
      const zw = 16 * scaleZ, zh = 8 * scaleX; // Z宽16, X长8
      ctx.strokeRect(zx - zw / 2, zy - zh / 2, zw, zh);
    }

    // 绘制敌人 (统一红点；不标识携带者，避免玩家一眼认出炸弹人)
    const enemies = this.enemyManager.getEnemies();
    enemies.forEach(e => {
      if (e.isDead) return;
      const [ex, ey] = toMap(e.group.position.x, e.group.position.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 已安放炸弹：红色闪烁感叹号
    const bombInfo = this.bombManager?.getBombInfo();
    if (bombInfo && bombInfo.position) {
      const blink = Math.floor(Date.now() / 300) % 2 === 0;
      if (blink) {
        const [bx, by] = toMap(bombInfo.position.x, bombInfo.position.z);
        ctx.fillStyle = '#ff2200';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', bx, by);
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 掉落待拾取的炸弹：橙色闪烁小点
    const dropped = this.enemyManager?.droppedBomb;
    if (dropped && dropped.position) {
      const blink = Math.floor(Date.now() / 250) % 2 === 0;
      if (blink) {
        const [dx, dy] = toMap(dropped.position.x, dropped.position.z);
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(dx, dy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // === 玩家：视野扇区 + 朝向三角形 ===
    const [pcx, pcy] = toMap(playerPos.x, playerPos.z);
    // 世界前方向量 (由yaw导出)
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    // 前方在画布坐标下的角度：画布dx = fwdZ, 画布dy = -fwdX
    const heading = Math.atan2(-fwdX, fwdZ);
    const fovHalf = 0.7; // ≈40°，视野扇区半角
    const fovR = 26;     // 扇区半径(像素)

    // 视野扇区
    ctx.beginPath();
    ctx.moveTo(pcx, pcy);
    ctx.arc(pcx, pcy, fovR, heading - fovHalf, heading + fovHalf);
    ctx.closePath();
    const grad = ctx.createRadialGradient(pcx, pcy, 2, pcx, pcy, fovR);
    grad.addColorStop(0, 'rgba(120, 220, 255, 0.35)');
    grad.addColorStop(1, 'rgba(120, 220, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 玩家朝向三角形（顶角指向头部朝向）
    const tip = 7, back = 5;
    ctx.fillStyle = '#44ff44';
    ctx.beginPath();
    ctx.moveTo(pcx + Math.cos(heading) * tip, pcy + Math.sin(heading) * tip);
    ctx.lineTo(pcx + Math.cos(heading + 2.5) * back, pcy + Math.sin(heading + 2.5) * back);
    ctx.lineTo(pcx + Math.cos(heading - 2.5) * back, pcy + Math.sin(heading - 2.5) * back);
    ctx.closePath();
    ctx.fill();
  }

  _drawCrosshair() {
    const cv = document.getElementById('crosshair');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 40, 40);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    const cx = 20, cy = 20, g = 4, l = 8;
    ctx.beginPath();
    ctx.moveTo(cx - g - l, cy); ctx.lineTo(cx - g, cy);
    ctx.moveTo(cx + g, cy); ctx.lineTo(cx + g + l, cy);
    ctx.moveTo(cx, cy - g - l); ctx.lineTo(cx, cy - g);
    ctx.moveTo(cx, cy + g); ctx.lineTo(cx, cy + g + l);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _toggleScoreboard(show) {
    const sb = document.getElementById('scoreboard');
    if (!sb) return;
    if (show) {
      sb.classList.add('show');
      const tbody = document.getElementById('scoreboard-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td>玩家</td><td>${this.kills}</td><td>${this.deaths}</td></tr>`;
      }
    } else {
      sb.classList.remove('show');
    }
  }

  dispose() {
    this.isRunning = false;
    this.audioFx?.stopBattleAmbience();
    this.audioFx?.stopAlarm();
    this.input.dispose();
  }
}
