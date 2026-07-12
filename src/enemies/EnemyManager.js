import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { ENEMY, BOMB } from '../core/Constants.js';
import { eventBus } from '../core/EventBus.js';

export class EnemyManager {
  constructor(physics) {
    this.physics = physics;
    this.enemies = [];
    this.spawnPoints = [];
    this.enemyAttackEnabled = false;
    this.killCount = 0;

    // 有限兵力池
    this.totalForce = ENEMY.TOTAL_FORCE;
    this.maxAlive = ENEMY.MAX_ALIVE;
    this.spawnedCount = 0;       // 已投放（含复活）总数
    this.respawnTimer = 0;       // 复活补刷计时

    // 炸弹相关
    this.plantZone = null;
    this.droppedBomb = null;     // {position: Vector3} 地面掉落包
    this.bombActive = false;     // 炸弹已安放到地面并处于计时(禁止再指派携带者)
    
    // 寻路器(由 Game 注入)
    this.pathfinder = null;

    // 掩体网格(由 Game 注入，用于敌人视线遮挡检测)
    this.coverMeshes = [];

    // 随机安包点生成器(由 Game 注入：() => mapInstance.getRandomPlantPoint())
    this.getPlantPointFn = null;

    this._bindEvents();
  }

  _bindEvents() {
    eventBus.on('enemy:killed', (data) => {
      this.killCount++;
      eventBus.emit('ui:killCount', { count: this.killCount });
      // 立即刷新敌人计数（在场/剩余）
      this._updateEnemyCount();
      // 通知小地图更新
      eventBus.emit('minimap:enemyRemoved', { enemy: data.enemy });
      // 若阵亡的是携带者且无掉落（已安包），无需重指派；掉落逻辑见 bomb:dropped
    });

    // 携带者阵亡掉落炸弹 → 记录待拾取
    eventBus.on('bomb:dropped', (data) => {
      this.droppedBomb = { position: data.position.clone() };
    });

    // 安包完成：炸弹已上地面，隐藏携带者背包并锁定不再指派
    eventBus.on('bomb:plantComplete', (data) => {
      this.bombActive = true;
      this.droppedBomb = null;
      if (data.from && data.from.setCarrier) data.from.setCarrier(false);
    });

    // 炸弹被拆除 → 解除锁定，敌人可重新尝试安包
    eventBus.on('bomb:defused', () => {
      this.droppedBomb = null;
      this.bombActive = false;
    });
  }

  init(scene, spawnPoints, plantZone = null, pathfinder = null) {
    this.scene = scene;
    this.spawnPoints = spawnPoints;
    this.plantZone = plantZone;
    this.pathfinder = pathfinder;
    this._spawnInitialEnemies();
  }

  setPlantZone(zone) {
    this.plantZone = zone;
    this.enemies.forEach(e => e.setPlantZone(zone));
  }

  _spawnInitialEnemies() {
    // 清除旧敌人
    this.enemies.forEach(e => {
      if (e.group.parent) e.group.parent.remove(e.group);
      if (e.body) this.physics.removeBody(e.body);
    });
    this.enemies = [];
    this.killCount = 0;
    this.spawnedCount = 0;
    this.respawnTimer = 0;
    this.droppedBomb = null;
    this.bombActive = false;
    eventBus.emit('ui:killCount', { count: 0 });

    const first = Math.min(ENEMY.INITIAL_COUNT, this.totalForce);
    for (let i = 0; i < first; i++) {
      this._spawnEnemy(i);
    }
    this._updateEnemyCount();
  }

  _spawnEnemy(index) {
    let position;
    if (this.spawnPoints.length > 0) {
      position = this.spawnPoints[index % this.spawnPoints.length].clone();
      position.x += (Math.random() - 0.5) * 4;
      position.z += (Math.random() - 0.5) * 4;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 15;
      position = new THREE.Vector3(Math.cos(angle) * dist, 1, Math.sin(angle) * dist);
    }
    const enemy = new Enemy(position, this.physics);
    enemy.enemyAttackEnabled = this.enemyAttackEnabled;
    enemy.setPlantZone(this.plantZone);
    enemy.pathfinder = this.pathfinder;
    enemy.coverMeshes = this.coverMeshes;
    this.scene.add(enemy.group);
    this.enemies.push(enemy);
    this.spawnedCount++;
    return enemy;
  }

  /** 随机指派一名存活敌人为炸弹携带者（若当前无人携带） */
  assignCarrier() {
    if (this.getCarrier()) return;
    const alive = this.enemies.filter(e => !e.isDead && !e.hasPlanted);
    if (alive.length === 0) return;
    const pick = alive[Math.floor(Math.random() * alive.length)];
    pick.setCarrier(true);
    // 每次指派都给一个新的随机安包点（玩家老家内部随机位置）
    if (this.getPlantPointFn) {
      pick.setPlantZone(this.getPlantPointFn());
    }
    eventBus.emit('enemy:carrierAssigned', { enemy: pick });
  }

  getCarrier() {
    return this.enemies.find(e => e.isCarrier && !e.isDead) || null;
  }

  setEnemyAttack(enabled) {
    this.enemyAttackEnabled = enabled;
    this.enemies.forEach(e => { e.enemyAttackEnabled = enabled; });
  }

  resetEnemies() {
    this._spawnInitialEnemies();
    this.assignCarrier();
  }

  getAliveCount() {
    return this.enemies.filter(e => !e.isDead).length;
  }

  /** 兵力已全部投放且场上清空 → 全歼胜利 */
  isCleared() {
    return this.spawnedCount >= this.totalForce && this.getAliveCount() === 0;
  }

  update(dt, playerPosition) {
    // 携带者混入部队判定：若其为最靠近安包区的一个(最靠前)且尚有队友存活，
    // 则让其收敛(不独自冲锋)；若落后于队友或为最后一人，则正常推进。
    const carrier = this.getCarrier();
    if (carrier && !carrier.hasPlanted && this.plantZone) {
      const cd = carrier.group.position.distanceTo(this.plantZone);
      let othersMin = Infinity;
      for (const e of this.enemies) {
        if (e === carrier || e.isDead) continue;
        const d = e.group.position.distanceTo(this.plantZone);
        if (d < othersMin) othersMin = d;
      }
      // 有队友且携带者处于前列(与最靠前队友相差在 3 以内) → 收敛
      carrier._holdPush = (othersMin !== Infinity) && (cd <= othersMin + 3);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, playerPosition);
      if (!enemy.isDead && !enemy.group.parent) {
        this.scene.add(enemy.group);
      }
      // 移除过期尸体
      if (enemy.isDead && enemy.deathTimer <= 0) {
        this.enemies.splice(i, 1);
        this._updateEnemyCount();
      }
    }

    // 复活补刷：已解除场上存活上限，只要兵力池未耗尽就每 5s 在敌方老巢补刷一名
    if (this.spawnedCount < this.totalForce) {
      this.respawnTimer += dt * 1000;
      if (this.respawnTimer >= ENEMY.RESPAWN_DELAY) {
        this.respawnTimer = 0;
        this._spawnEnemy(this.spawnedCount);
        this._updateEnemyCount();
      }
    } else {
      this.respawnTimer = 0;
    }

    // 掉落炸弹拾取：最近存活敌人前往拾取，抵达即成为新携带者
    this._handleBombPickup();

    // 保证场上始终有携带者（除非炸弹已安放/掉落待拾取）
    if (!this.getCarrier() && !this.droppedBomb && !this.bombActive) {
      this.assignCarrier();
    }
  }

  _handleBombPickup() {
    if (!this.droppedBomb) return;
    const alive = this.enemies.filter(e => !e.isDead);
    if (alive.length === 0) { this.droppedBomb = null; eventBus.emit('bomb:pickedUp', {}); return; }

    // 找到最近的存活敌人，赋予最高优先级前往拾取
    let nearest = null, nearestDist = Infinity;
    alive.forEach(e => {
      const d = e.group.position.distanceTo(this.droppedBomb.position);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    });
    if (!nearest) return;

    // 其余敌人不追包
    alive.forEach(e => { if (e !== nearest) e.pickupTarget = null; });
    nearest.pickupTarget = this.droppedBomb.position.clone();

    if (nearestDist <= BOMB.PICKUP_RADIUS) {
      nearest.pickupTarget = null;
      nearest.setCarrier(true);
      // 拾取后也重新分配随机安包点
      if (this.getPlantPointFn) {
        nearest.setPlantZone(this.getPlantPointFn());
      }
      this.droppedBomb = null;
      eventBus.emit('bomb:pickedUp', { enemy: nearest });
      eventBus.emit('enemy:carrierAssigned', { enemy: nearest });
    }
  }

  _updateEnemyCount() {
    const alive = this.enemies.filter(e => !e.isDead).length;
    // 剩余待消灭总数 = 总兵力 - 已击杀
    const remaining = Math.max(0, this.totalForce - this.killCount);
    eventBus.emit('ui:enemyCount', { alive, remaining, total: this.totalForce, count: alive });
  }

  getEnemies() { return this.enemies; }
  getEnemyMeshes() {
    const meshes = [];
    this.enemies.forEach(enemy => {
      if (!enemy.isDead) enemy.group.traverse(child => { if (child.isMesh) meshes.push(child); });
    });
    return meshes;
  }
}
