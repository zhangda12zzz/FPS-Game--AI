import * as THREE from 'three';
import { MapLoader } from './MapLoader.js';
import { COLORS } from '../core/Constants.js';
import { createMetalPanelTexture, createConcreteTexture } from '../utils/TextureGen.js';

// CF运输船风格地图：长边(X)延长，障碍物沿长边镜像对称，两端各设出生老家
export class Map_Transport extends MapLoader {
  constructor(scene, physics) {
    super(scene, physics);
    this.spawnPoints = [];        // 兼容旧引用（= 敌人出生点）
    this.playerSpawnPoints = [];  // 玩家老家（+X 端）
    this.enemySpawnPoints = [];   // 敌人老家（-X 端）

    // 地图边界（世界坐标）：长边X=80，短边Z=20
    this.bounds = { minX: -40, maxX: 40, minZ: -10, maxZ: 10 };
  }

  load() {
    const shipMetal = createMetalPanelTexture();
    shipMetal.repeat.set(8, 2);
    const containerTex1 = createMetalPanelTexture();
    const containerTex2 = createMetalPanelTexture();

    // === 地面（海面/码头） ===
    this.createGround({ x: 200, z: 200 }, COLORS.GROUND);

    // === 船体甲板（钢板纹理，长边X=80，宽Z=20） ===
    this.createBox(
      { x: 80, y: 0.3, z: 20 },
      new THREE.Vector3(0, 0.15, 0),
      0x6a6a5a,
      { texture: shipMetal, roughness: 0.7, metalness: 0.3 }
    );

    // 船舷（左右长边）
    this.createBox({ x: 80, y: 2, z: 0.5 }, new THREE.Vector3(0, 1, -10), 0x4a4a3a,
      { texture: shipMetal, roughness: 0.65, metalness: 0.35 });
    this.createBox({ x: 80, y: 2, z: 0.5 }, new THREE.Vector3(0, 1, 10), 0x4a4a3a,
      { texture: shipMetal, roughness: 0.65, metalness: 0.35 });
    // 船头/船尾（两端短边）
    this.createBox({ x: 0.5, y: 2, z: 20 }, new THREE.Vector3(40, 1, 0), 0x4a4a3a,
      { texture: shipMetal, roughness: 0.65, metalness: 0.35 });
    this.createBox({ x: 0.5, y: 2, z: 20 }, new THREE.Vector3(-40, 1, 0), 0x4a4a3a,
      { texture: shipMetal, roughness: 0.65, metalness: 0.35 });

    // === 船舷栏杆柱子 ===
    for (let x = -38; x <= 38; x += 4) {
      this._createPost(x, 0.3, -9.75);
      this._createPost(x, 0.3, 9.75);
    }

    // === 中央大集装箱（x=0，唯一地标，不镜像） ===
    this._createContainer(0, 1.8, 0, { x: 8, y: 3, z: 4 }, COLORS.CONTAINER, containerTex1);
    this._createContainer(0, 4.3, 0, { x: 6, y: 2, z: 3 }, COLORS.CONTAINER2, containerTex2);

    // === 沿长边X轴镜像的对称集装箱布局 ===
    this._symContainers([
      // 近中心掩体组
      { x: 7, y: 1.55, z: -6, size: { x: 5, y: 2.5, z: 3 }, color: COLORS.CONTAINER, tex: containerTex1 },
      { x: 7, y: 1.55, z: 6, size: { x: 5, y: 2.5, z: 3 }, color: COLORS.CONTAINER2, tex: containerTex2 },
      { x: 7, y: 4.05, z: 6, size: { x: 5, y: 2.5, z: 3 }, color: COLORS.CONTAINER, tex: containerTex1 },
      // 中段路障
      { x: 16, y: 1.55, z: 0, size: { x: 4, y: 2.5, z: 4 }, color: COLORS.CONTAINER, tex: containerTex1 },
      { x: 16, y: 1.55, z: -7, size: { x: 6, y: 2.5, z: 3 }, color: COLORS.CONTAINER2, tex: containerTex2 },
      { x: 16, y: 1.55, z: 7, size: { x: 6, y: 2.5, z: 3 }, color: COLORS.CONTAINER, tex: containerTex1 },
      // 靠近出生区（掩护出生口）
      { x: 25, y: 1.55, z: -5, size: { x: 5, y: 2.5, z: 3 }, color: COLORS.CONTAINER2, tex: containerTex2 },
      { x: 25, y: 1.55, z: 5, size: { x: 5, y: 2.5, z: 3 }, color: COLORS.CONTAINER, tex: containerTex1 },
    ]);

    // === 低矮掩体（配合下蹲使用），镜像对称 ===
    this._symCover(11, -8);
    this._symCover(11, 8);
    this._symCover(20, 0);
    this._symCover(30, -6);
    this._symCover(30, 6);

    // === 油桶 / 木箱装饰（镜像对称） ===
    this._symOilDrum(10, 3);
    this._symOilDrum(21, -8);
    this._symWoodCrate(22, 8, 1.0);
    this._symWoodCrate(23, 7, 0.7);

    // === 甲板安全线（沿长边X） ===
    this._createDeckLine(0, 0.31, 0, 76, 0.15, 0xffaa00);
    this._createDeckLine(0, 0.31, -8, 76, 0.15, 0xffaa00);
    this._createDeckLine(0, 0.31, 8, 76, 0.15, 0xffaa00);

    // === 出生区地标（老家）：玩家蓝色(+X)，敌人红色(-X) ===
    this._createSpawnZone(34, 0x2277ff);
    this._createSpawnZone(-34, 0xff3322);

    // === 出生点 ===
    this.playerSpawnPoints = [
      new THREE.Vector3(34, 0, -6),
      new THREE.Vector3(34, 0, 0),
      new THREE.Vector3(34, 0, 6),
      new THREE.Vector3(31, 0, -3),
      new THREE.Vector3(31, 0, 3),
    ];
    this.enemySpawnPoints = [
      new THREE.Vector3(-34, 0, -6),
      new THREE.Vector3(-34, 0, 0),
      new THREE.Vector3(-34, 0, 6),
      new THREE.Vector3(-31, 0, -3),
      new THREE.Vector3(-31, 0, 3),
    ];
    this.spawnPoints = this.enemySpawnPoints; // 兼容旧引用

    return this.enemySpawnPoints;
  }

  /** 玩家出生点（从玩家老家随机取一个） */
  getPlayerSpawn() {
    const arr = this.playerSpawnPoints;
    if (!arr.length) return new THREE.Vector3(34, 0, 0);
    return arr[Math.floor(Math.random() * arr.length)].clone();
  }

  /** 安包区中心（玩家老家中心），供小地图绘制与携带者初始寻路 */
  getPlantZone() {
    return new THREE.Vector3(34, 0, 0);
  }

  /** 在玩家老家蓝区内部随机选一个安包点（确保在蓝区内、靠里边） */
  getRandomPlantPoint() {
    // 蓝区: x=30~38, z=-8~8 (center x=34, PlaneGeometry 8×16)
    // 取蓝区内部偏深位置 x=32~36, z=-4~4
    const x = 32 + Math.random() * 4;
    const z = (Math.random() - 0.5) * 8;
    return new THREE.Vector3(x, 0, z);
  }

  /** 批量创建镜像对称集装箱（沿长边X镜像） */
  _symContainers(list) {
    list.forEach(it => {
      this._createContainer(it.x, it.y, it.z, it.size, it.color, it.tex);
      if (it.x !== 0) this._createContainer(-it.x, it.y, it.z, it.size, it.color, it.tex);
    });
  }

  /** 低矮掩体（镜像对称） */
  _symCover(x, z) {
    const coverTex = createConcreteTexture();
    const positions = x !== 0 ? [x, -x] : [0];
    positions.forEach(px => {
      this.createBox(
        { x: 2, y: 1.2, z: 0.5 },
        new THREE.Vector3(px, 0.9, z),
        0x555555,
        { texture: coverTex, roughness: 0.8 }
      );
    });
  }

  _symOilDrum(x, z) {
    const positions = x !== 0 ? [x, -x] : [0];
    positions.forEach(px => this._createOilDrum(px, 0, z));
  }

  _symWoodCrate(x, z, size) {
    const positions = x !== 0 ? [x, -x] : [0];
    positions.forEach(px => this._createWoodCrate(px, 0, z, size));
  }

  /** 出生区地标：半透明彩色区块 + 边框 */
  _createSpawnZone(cx, color) {
    // X方向长度8，Z方向宽度16
    const geo = new THREE.PlaneGeometry(8, 16);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(cx, 0.32, 0);
    this.scene.add(plane);

    // 边框线
    const lineMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const borders = [
      { w: 8, d: 0.2, x: cx, z: -8 },
      { w: 8, d: 0.2, x: cx, z: 8 },
      { w: 0.2, d: 16, x: cx - 4, z: 0 },
      { w: 0.2, d: 16, x: cx + 4, z: 0 },
    ];
    borders.forEach(b => {
      const bGeo = new THREE.PlaneGeometry(b.w, b.d);
      const line = new THREE.Mesh(bGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(b.x, 0.33, b.z);
      this.scene.add(line);
    });
  }

  _createContainer(x, y, z, size, color, texture) {
    const { mesh } = this.createBox(size, new THREE.Vector3(x, y, z), color, {
      texture, roughness: 0.6, metalness: 0.35, type: 'container'
    });

    // 集装箱波纹钢板效果（侧面横条纹）
    for (let i = 0; i < 3; i++) {
      const ridgeGeo = new THREE.BoxGeometry(size.x + 0.02, 0.04, 0.02);
      const ridgeMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.5 });
      const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridge.position.set(x, y - size.y / 2 + 0.4 + i * 0.7, z + size.z / 2 + 0.01);
      this.scene.add(ridge);
    }
    return mesh;
  }

  _createPost(x, y, z) {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x555544, metalness: 0.6, roughness: 0.4 });
    const post = new THREE.Mesh(geo, mat);
    post.position.set(x, y + 0.75, z);
    post.castShadow = true;
    this.scene.add(post);
  }

  _createOilDrum(x, y, z) {
    const drumGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.65, metalness: 0.3 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(x, y + 0.6, z);
    drum.castShadow = true;
    drum.receiveShadow = true;
    this.scene.add(drum);

    // 油桶环箍
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(0.41, 0.015, 4, 16);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, y + 0.2 + i * 0.4, z);
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
    }

    this.physics.createBox(
      { x: 0.8, y: 1.2, z: 0.8 },
      new THREE.Vector3(x, y + 0.6, z),
      this.physics.groundMaterial
    );
  }

  _createWoodCrate(x, y, z, size) {
    const tex = createConcreteTexture();
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9, metalness: 0.0, map: tex });
    const crate = new THREE.Mesh(geo, mat);
    crate.position.set(x, y + size / 2, z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    this.scene.add(crate);

    // 木条边框
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x5a3a00, roughness: 0.85 });
    const edges = [
      [size / 2, 0, 0, size * 0.06, size, size * 0.06],
      [-size / 2, 0, 0, size * 0.06, size, size * 0.06],
      [0, 0, size / 2, size, size * 0.06, size * 0.06],
      [0, 0, -size / 2, size, size * 0.06, size * 0.06]
    ];
    edges.forEach(([ex, ey, ez, ew, eh, ed]) => {
      const edgeGeo = new THREE.BoxGeometry(ew, eh, ed);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(x + ex, y + size / 2 + ey, z + ez);
      this.scene.add(edge);
    });

    this.physics.createBox(
      { x: size, y: size, z: size },
      new THREE.Vector3(x, y + size / 2, z),
      this.physics.groundMaterial
    );
  }

  _createDeckLine(x, y, z, length, width, color) {
    const geo = new THREE.PlaneGeometry(length, width);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const line = new THREE.Mesh(geo, mat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, y, z);
    this.scene.add(line);
  }
}
