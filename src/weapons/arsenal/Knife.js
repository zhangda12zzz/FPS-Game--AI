import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createChromaKeyMaterial } from '../../utils/ChromaKeyMaterial.js';
import { buildWeaponMesh, buildWeaponMeshParts } from '../WeaponModels.js';

export class Knife extends Weapon {
  constructor() {
    super({ ...WEAPONS.KNIFE, magSize: Infinity, reserveAmmo: Infinity });
    this.mesh = this.createMesh();
  }

  createMesh() {
    // 优先使用真实 GLB 模型（NI_3 已拆成两部件，各自独立 size/rot/pos）
    const cfg = WEAPONS.KNIFE.model;
    const modelMesh = cfg.parts
      ? buildWeaponMeshParts('KNIFE', cfg.parts)
      : buildWeaponMesh('KNIFE', cfg);
    if (modelMesh) {
      // 为"刀身+握持手"部件建立手腕枢轴，供挥砍动画绕轴旋转
      this._setupBladePivot(modelMesh);
      return modelMesh;
    }

    // 回退：绿幕贴图平面 — Ni3.png (麒麟刺)
    const group = new THREE.Group();
    const mat = createChromaKeyMaterial('/images/Ni3.png');
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.40), mat);
    group.add(plane);
    group.position.set(0.04, -0.12, -0.4);
    return group;
  }

  /**
   * 建立握把枢轴：把"刀身+握持手"部件(children[1])绕手腕(部件底部附近)旋转，
   * 使刀尖行程大、手臂行程小；左手(children[0])不参与。
   */
  _setupBladePivot(root) {
    // 约定 parts[0]=左手(永不动)，parts[1]=刀身+握持手(挥砍)
    const pgBlade = root.children[1];
    if (!pgBlade || !pgBlade.children[0]) return;
    const orient = pgBlade.children[0];

    const cfg = WEAPONS.KNIFE.attack || {};
    // pivotFrac 支持 [fx,fy,fz] 三轴分量(0=min,1=max)，或标量(仅 y，其余取中点)
    const pf = cfg.pivotFrac != null ? cfg.pivotFrac : [0.85, 0.15, 0.5];
    const fx = Array.isArray(pf) ? (pf[0] != null ? pf[0] : 0.5) : 0.5;
    const fy = Array.isArray(pf) ? (pf[1] != null ? pf[1] : 0.15) : pf;
    const fz = Array.isArray(pf) ? (pf[2] != null ? pf[2] : 0.5) : 0.5;

    // 部件在 pgBlade 局部空间的包围盒：用局部矩阵手算(不依赖 world 矩阵，
    // 避免 createMesh 阶段 matrixWorld 未更新 / 运行时相机变换污染结果)
    const part = orient.children[0];
    orient.updateMatrix();
    part.updateMatrix();
    const mat = new THREE.Matrix4().multiplyMatrices(orient.matrix, part.matrix);
    const geo = part.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const gb = geo.boundingBox;
    const lb = new THREE.Box3();
    const tmp = new THREE.Vector3();
    [[gb.min.x, gb.min.y, gb.min.z], [gb.max.x, gb.min.y, gb.min.z],
     [gb.min.x, gb.max.y, gb.min.z], [gb.max.x, gb.max.y, gb.min.z],
     [gb.min.x, gb.min.y, gb.max.z], [gb.max.x, gb.min.y, gb.max.z],
     [gb.min.x, gb.max.y, gb.max.z], [gb.max.x, gb.max.y, gb.max.z]]
      .forEach((c) => { tmp.set(c[0], c[1], c[2]).applyMatrix4(mat); lb.expandByPoint(tmp); });
    const minL = lb.min;
    const maxL = lb.max;
    const pivot = new THREE.Vector3(
      minL.x + (maxL.x - minL.x) * fx,
      minL.y + (maxL.y - minL.y) * fy,
      minL.z + (maxL.z - minL.z) * fz,
    );

    // 插入枢轴组：pgBlade → pivotGroup(平移到 pivot) → orient(反向平移，视觉位置不变)
    pgBlade.remove(orient);
    const pivotGroup = new THREE.Group();
    pivotGroup.position.copy(pivot);
    orient.position.sub(pivot);
    pivotGroup.add(orient);
    pgBlade.add(pivotGroup);

    this._pgBlade = pgBlade;
    this._bladePivot = pivotGroup;
    this._bladeRestPos = pgBlade.position.clone();
    this._raf = null;
  }

  canFire() {
    return Date.now() - this.lastFireTime >= this.fireRate;
  }

  fire() {
    if (!this.canFire()) return false;
    this.lastFireTime = Date.now();
    this._playSlash();
    return true;
  }

  /** 挥砍动画：绕手腕轴，相位1刀尖上抬回拉(蓄力)→相位2刀尖斜向前劈下(挥砍)→相位3回位；左手不动 */
  _playSlash() {
    if (!this._bladePivot || !this._pgBlade) return;
    const c = WEAPONS.KNIFE.attack || {};
    const duration  = c.duration != null ? c.duration : 420;
    const windupT   = c.windupT != null ? c.windupT : 0.28;
    const slashT    = c.slashT != null ? c.slashT : 0.6;
    const windupAng = c.windupAngle != null ? c.windupAngle : 0.45;
    const slashAng  = c.slashAngle != null ? c.slashAngle : -0.55;
    const windupPit = c.windupPitch != null ? c.windupPitch : 0.35;
    const slashPit  = c.slashPitch != null ? c.slashPitch : -0.65;
    const wS = c.windupShift || [-0.02, -0.03, 0.01];
    const sS = c.slashShift || [0.05, 0.06, -0.02];

    const rest = this._bladeRestPos;
    const pivot = this._bladePivot;
    const pg = this._pgBlade;

    if (this._raf) cancelAnimationFrame(this._raf);
    const ease = (t) => t * t * (3 - 2 * t); // smoothstep
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      let ang; let pit; let sx; let sy; let sz;
      if (t <= windupT) {
        // 相位1：蓄力 0 → windup（刀尖上抬 + Z轴小幅左偏）
        const k = ease(t / windupT);
        ang = windupAng * k;
        pit = windupPit * k;
        sx = wS[0] * k; sy = wS[1] * k; sz = wS[2] * k;
      } else if (t <= slashT) {
        // 相位2：挥砍 windup → slash（刀尖斜向前劈下 + Z轴右偏）
        const k = ease((t - windupT) / (slashT - windupT));
        ang = windupAng + (slashAng - windupAng) * k;
        pit = windupPit + (slashPit - windupPit) * k;
        sx = wS[0] + (sS[0] - wS[0]) * k;
        sy = wS[1] + (sS[1] - wS[1]) * k;
        sz = wS[2] + (sS[2] - wS[2]) * k;
      } else {
        // 相位3：回位 slash → 0
        const k = ease((t - slashT) / (1 - slashT));
        ang = slashAng * (1 - k);
        pit = slashPit * (1 - k);
        sx = sS[0] * (1 - k); sy = sS[1] * (1 - k); sz = sS[2] * (1 - k);
      }
      pivot.rotation.z = ang;
      pivot.rotation.x = pit;
      pg.position.set(rest.x + sx, rest.y + sy, rest.z + sz);

      if (t < 1) {
        this._raf = requestAnimationFrame(tick);
      } else {
        pivot.rotation.z = 0;
        pivot.rotation.x = 0;
        pg.position.copy(rest);
        this._raf = null;
      }
    };
    this._raf = requestAnimationFrame(tick);
  }
}
