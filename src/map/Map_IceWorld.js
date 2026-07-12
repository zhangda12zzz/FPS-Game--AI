import * as THREE from 'three';
import { MapLoader } from './MapLoader.js';
import { COLORS } from '../core/Constants.js';
import { createConcreteTexture } from '../utils/TextureGen.js';

// 冰世界风格地图（CS1.6 fy_iceworld 构型，"田字格"布局）
// 四象限对称：十字隔墙将场地分为 4 块，隔墙中央留通道口
// 玩家(+X)与敌人(-X)分居两端，中央十字路口为交火热区
export class Map_IceWorld extends MapLoader {
  constructor(scene, physics) {
    super(scene, physics);
    this.spawnPoints = [];
    this.playerSpawnPoints = [];
    this.enemySpawnPoints = [];

    // 正方形场地 48×48
    this.bounds = { minX: -24, maxX: 24, minZ: -24, maxZ: 24 };
  }

  load() {
    const iceTex = createConcreteTexture();
    iceTex.repeat.set(4, 4);
    const wallTex = createConcreteTexture();
    wallTex.repeat.set(2, 1);

    // 冰雪色系
    const ICE_GROUND = 0xdde8f0;
    const ICE_WALL   = 0x88aacc;
    const ICE_BLOCK  = 0xa8c8e8;
    const ICE_DARK   = 0x6a8ab0;
    const SNOW       = 0xf0f4f8;

    // === 地面 ===
    this.createGround({ x: 120, z: 120 }, ICE_GROUND);

    // === 外围围墙（4 面，高 4m 封闭场地） ===
    const half = 24, wallH = 5.2, wallT = 0.5;  // 围墙高度 ×1.3 (原4m)
    this.createBox({ x: 48, y: wallH, z: wallT }, new THREE.Vector3(0, wallH/2, -half), ICE_WALL, { texture: wallTex, roughness: 0.4, metalness: 0.2 });
    this.createBox({ x: 48, y: wallH, z: wallT }, new THREE.Vector3(0, wallH/2,  half), ICE_WALL, { texture: wallTex, roughness: 0.4, metalness: 0.2 });
    this.createBox({ x: wallT, y: wallH, z: 48 }, new THREE.Vector3(-half, wallH/2, 0), ICE_WALL, { texture: wallTex, roughness: 0.4, metalness: 0.2 });
    this.createBox({ x: wallT, y: wallH, z: 48 }, new THREE.Vector3( half, wallH/2, 0), ICE_WALL, { texture: wallTex, roughness: 0.4, metalness: 0.2 });

    // === "田"字隔墙：沿 Z=0 的水平墙 + 沿 X=0 的垂直墙，中央各留 6m 通道 ===
    const gap = 3;          // 通道半宽（总宽 6m）
    const divH = 3.5;       // 隔墙高度
    const divT = 0.4;       // 隔墙厚度

    // 水平隔墙（沿 X 轴，在 Z=0 处）：左段 + 右段
    this.createBox({ x: half - gap, y: divH, z: divT }, new THREE.Vector3(-(gap + half) / 2, divH/2, 0), ICE_DARK, { roughness: 0.5, metalness: 0.15, type: 'wall' });
    this.createBox({ x: half - gap, y: divH, z: divT }, new THREE.Vector3( (gap + half) / 2, divH/2, 0), ICE_DARK, { roughness: 0.5, metalness: 0.15, type: 'wall' });

    // 垂直隔墙（沿 Z 轴，在 X=0 处）：前段 + 后段
    this.createBox({ x: divT, y: divH, z: half - gap }, new THREE.Vector3(0, divH/2, -(gap + half) / 2), ICE_DARK, { roughness: 0.5, metalness: 0.15, type: 'wall' });
    this.createBox({ x: divT, y: divH, z: half - gap }, new THREE.Vector3(0, divH/2,  (gap + half) / 2), ICE_DARK, { roughness: 0.5, metalness: 0.15, type: 'wall' });

    // === 冰块掩体（4 象限对称分布） ===
    // 玩家象限 Q1(+X,+Z) / Q2(+X,-Z)，敌人象限 Q3(-X,-Z) / Q4(-X,+Z)
    const blocks = [
      // 每象限中央一个大方冰块
      { x: 12, z: 12, w: 4, d: 4, h: 2.5 },
      { x: 12, z: -12, w: 4, d: 4, h: 2.5 },
      { x: -12, z: -12, w: 4, d: 4, h: 2.5 },
      { x: -12, z: 12, w: 4, d: 4, h: 2.5 },
      // 靠近中央通道的小冰块（掩护过路口）
      { x: 6, z: 6, w: 2, d: 2, h: 1.8 },
      { x: 6, z: -6, w: 2, d: 2, h: 1.8 },
      { x: -6, z: -6, w: 2, d: 2, h: 1.8 },
      { x: -6, z: 6, w: 2, d: 2, h: 1.8 },
      // 各象限侧翼长冰墙（半高，可蹲射）
      { x: 18, z: 6, w: 5, d: 1, h: 1.2 },
      { x: 18, z: -6, w: 5, d: 1, h: 1.2 },
      { x: -18, z: 6, w: 5, d: 1, h: 1.2 },
      { x: -18, z: -6, w: 5, d: 1, h: 1.2 },
      // 出生区前方的掩体
      { x: 20, z: 0, w: 1, d: 6, h: 2 },
      { x: -20, z: 0, w: 1, d: 6, h: 2 },
      // 额外矮掩体（可跳跃登顶）
      { x: 9, z: 4, w: 2, d: 2, h: 1.2 },
      { x: 9, z: -4, w: 2, d: 2, h: 1.2 },
      { x: -9, z: 4, w: 2, d: 2, h: 1.2 },
      { x: -9, z: -4, w: 2, d: 2, h: 1.2 },
      // 侧翼矮墙
      { x: 15, z: 8, w: 3, d: 1, h: 1.0 },
      { x: 15, z: -8, w: 3, d: 1, h: 1.0 },
      { x: -15, z: 8, w: 3, d: 1, h: 1.0 },
      { x: -15, z: -8, w: 3, d: 1, h: 1.0 },
    ];
    blocks.forEach(b => this._createIceBlock(b.x, b.z, b.w, b.d, b.h, ICE_BLOCK));

    // === 连体阶梯冰块（矮→中→高，可连续跳跃登顶） ===
    this._createIceSteps(4, 12, ICE_BLOCK);
    this._createIceSteps(4, -12, ICE_BLOCK);
    this._createIceSteps(-4, 12, ICE_BLOCK);
    this._createIceSteps(-4, -12, ICE_BLOCK);

    // === 雪堆装饰（4 象限角落，纯视觉无碰撞） ===
    this._createSnowPile(20, 20);
    this._createSnowPile(-20, 20);
    this._createSnowPile(20, -20);
    this._createSnowPile(-20, -20);

    // === 中央地标圆环（标记十字路口） ===
    this._createCenterMarker();

    // === 出生区地标 ===
    this._createSpawnZone(20, 0x2277ff);
    this._createSpawnZone(-20, 0xff3322);

    // === 出生点 ===
    this.playerSpawnPoints = [
      new THREE.Vector3(20, 0, -8),
      new THREE.Vector3(20, 0, 0),
      new THREE.Vector3(20, 0, 8),
      new THREE.Vector3(18, 0, -5),
      new THREE.Vector3(18, 0, 5),
    ];
    this.enemySpawnPoints = [
      new THREE.Vector3(-20, 0, -8),
      new THREE.Vector3(-20, 0, 0),
      new THREE.Vector3(-20, 0, 8),
      new THREE.Vector3(-18, 0, -5),
      new THREE.Vector3(-18, 0, 5),
    ];
    this.spawnPoints = this.enemySpawnPoints;
    return this.enemySpawnPoints;
  }

  getPlayerSpawn() {
    const arr = this.playerSpawnPoints;
    if (!arr.length) return new THREE.Vector3(20, 0, 0);
    return arr[Math.floor(Math.random() * arr.length)].clone();
  }

  getPlantZone() {
    return new THREE.Vector3(20, 0, 0);
  }

  /** 在玩家老家蓝区内部随机选一个安包点（确保在蓝区内、靠里边） */
  getRandomPlantPoint() {
    // 蓝区: x=16~24, z=-9~9 (center x=20, PlaneGeometry 8×18)
    // 取蓝区内部偏深位置 x=18~22, z=-5~5
    const x = 18 + Math.random() * 4;
    const z = (Math.random() - 0.5) * 10;
    return new THREE.Vector3(x, 0, z);
  }

  // ====== 辅助方法 ======

  /** 创建冰块（半透明蓝色，带物理碰撞） */
  _createIceBlock(x, z, w, d, h, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.75,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = 'container';
    this.scene.add(mesh);
    this.objects.push(mesh);

    this.physics.createBox(
      { x: w, y: h, z: d },
      new THREE.Vector3(x, h / 2, z),
      this.physics.groundMaterial
    );
  }

  /** 阶梯式冰块：矮(1.2m)→中(2.2m)→高(3.2m)，相邻排布可连续跳跃登顶 */
  _createIceSteps(x, z, color) {
    const dir = Math.sign(x) || 1;
    const steps = [
      { dx: 0,           h: 1.2 },
      { dx: dir * 1.8,   h: 2.2 },
      { dx: dir * 3.6,   h: 3.2 },
    ];
    steps.forEach(s => {
      this._createIceBlock(x + s.dx, z, 2, 2, s.h, color);
    });
  }

  /** 雪堆装饰（纯视觉，无碰撞体） */
  _createSnowPile(x, z) {
    const geo = new THREE.SphereGeometry(2, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.9,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5, z);
    mesh.scale.y = 0.4;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  /** 中央地标：地面圆环标记十字路口 */
  _createCenterMarker() {
    const geo = new THREE.RingGeometry(2.5, 3, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, 0);
    this.scene.add(ring);
  }

  /** 出生区地标（半透明彩色区块 + 边框） */
  _createSpawnZone(cx, color) {
    const geo = new THREE.PlaneGeometry(8, 18);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(cx, 0.02, 0);
    this.scene.add(plane);

    const lineMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const borders = [
      { w: 8, d: 0.2, x: cx, z: -9 },
      { w: 8, d: 0.2, x: cx, z: 9 },
      { w: 0.2, d: 18, x: cx - 4, z: 0 },
      { w: 0.2, d: 18, x: cx + 4, z: 0 },
    ];
    borders.forEach(b => {
      const bGeo = new THREE.PlaneGeometry(b.w, b.d);
      const line = new THREE.Mesh(bGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(b.x, 0.03, b.z);
      this.scene.add(line);
    });
  }
}
