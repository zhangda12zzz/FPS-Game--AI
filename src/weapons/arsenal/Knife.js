import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createDragonPatternTexture, createMetalBrushTexture } from '../../utils/TextureGen.js';

export class Knife extends Weapon {
  constructor() {
    super({ ...WEAPONS.KNIFE, magSize: Infinity, reserveAmmo: Infinity });
    this.mesh = this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const dragonTex = createDragonPatternTexture('#c89a18', '#880000');
    const metalTex = createMetalBrushTexture();

    // === 材质 ===
    const goldBlade = new THREE.MeshStandardMaterial({ color: 0xd4a020, metalness: 0.96, roughness: 0.08, map: metalTex });
    const goldBright = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.98, roughness: 0.04, emissive: 0x332200, emissiveIntensity: 0.15 });
    const dragonRed = new THREE.MeshStandardMaterial({ color: 0xcc0000, metalness: 0.5, roughness: 0.3, emissive: 0x330000, emissiveIntensity: 0.2 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, metalness: 0.35, roughness: 0.6, map: dragonTex });
    const handleDark = new THREE.MeshStandardMaterial({ color: 0x5a3a00, metalness: 0.25, roughness: 0.7 });
    const guardGold = new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.93, roughness: 0.12 });
    const pearlMat = new THREE.MeshStandardMaterial({ color: 0xfff8e7, metalness: 0.3, roughness: 0.4 });

    // === 廓尔喀弯刀刀身 (使用 Shape + Extrude 创建弯刀轮廓) ===
    // 刀身截面形状
    const bladeCrossSection = new THREE.Shape();
    bladeCrossSection.moveTo(-0.005, -0.025);
    bladeCrossSection.lineTo(0.005, -0.025);
    bladeCrossSection.lineTo(0.006, 0);
    bladeCrossSection.lineTo(0.004, 0.025);
    bladeCrossSection.lineTo(-0.004, 0.025);
    bladeCrossSection.lineTo(-0.006, 0);
    bladeCrossSection.closePath();

    // 分段创建弯刀（从刀根到刀尖逐渐弯曲）
    const segments = 12;
    const bladeLength = 0.35;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const nextT = (i + 1) / segments;
      const segLen = bladeLength / segments;

      // 弯曲角度递增
      const angle = t * t * 0.8; // 二次曲线使弯曲自然
      const nextAngle = nextT * nextT * 0.8;

      // 刀身宽度从根到尖逐渐变窄
      const width = 1 - t * 0.4;
      const nextWidth = 1 - nextT * 0.4;

      const z = -0.04 - t * bladeLength * Math.cos(angle);
      const y = -t * bladeLength * Math.sin(angle) * 0.3;

      const segGeo = new THREE.BoxGeometry(0.01, 0.05 * width, segLen);
      const seg = new THREE.Mesh(segGeo, i < 3 ? goldBlade : (i > 8 ? goldBright : goldBlade));
      seg.position.set(0, y, z);
      seg.rotation.x = angle;
      group.add(seg);
    }

    // === 刀背脊线 (廓尔喀弯刀厚实刀背) ===
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      const angle = t * t * 0.8;
      const z = -0.04 - t * bladeLength * Math.cos(angle);
      const y = 0.028 * (1 - t * 0.3) - t * bladeLength * Math.sin(angle) * 0.3;

      const spineGeo = new THREE.BoxGeometry(0.012, 0.006, 0.035);
      const spine = new THREE.Mesh(spineGeo, guardGold);
      spine.position.set(0, y, z);
      spine.rotation.x = angle;
      group.add(spine);
    }

    // === 刀尖 (弯曲上翘) ===
    const tipAngle = 0.8;
    const tipZ = -0.04 - bladeLength * Math.cos(tipAngle);
    const tipY = -bladeLength * Math.sin(tipAngle) * 0.3;

    const tipGeo = new THREE.ConeGeometry(0.022, 0.05, 4);
    const tip = new THREE.Mesh(tipGeo, goldBright);
    tip.rotation.x = Math.PI / 2 + tipAngle + 0.3;
    tip.position.set(0, tipY - 0.02, tipZ - 0.02);
    group.add(tip);

    // === 文龙图案 (刀身红色蜿蜒龙纹) ===
    const dragonSegs = [
      { t: 0.1, w: 0.025 },
      { t: 0.2, w: 0.035 },
      { t: 0.35, w: 0.03 },
      { t: 0.5, w: 0.028 },
      { t: 0.65, w: 0.025 },
      { t: 0.8, w: 0.02 },
    ];

    dragonSegs.forEach(seg => {
      const t = seg.t;
      const angle = t * t * 0.8;
      const z = -0.04 - t * bladeLength * Math.cos(angle);
      const y = -t * bladeLength * Math.sin(angle) * 0.3;
      const width = 1 - t * 0.4;

      const dGeo = new THREE.BoxGeometry(0.011, seg.w, 0.015);
      const d = new THREE.Mesh(dGeo, dragonRed);
      d.position.set(0, y + 0.005, z);
      d.rotation.x = angle;
      group.add(d);
    });

    // 龙爪装饰（刀身两侧）
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.18;
      const angle = t * t * 0.8;
      const z = -0.04 - t * bladeLength * Math.cos(angle);
      const y = 0.02 * (1 - t * 0.3) - t * bladeLength * Math.sin(angle) * 0.3;

      for (let side = -1; side <= 1; side += 2) {
        const clawGeo = new THREE.ConeGeometry(0.004, 0.015, 3);
        const claw = new THREE.Mesh(clawGeo, dragonRed);
        claw.position.set(side * 0.008, y, z);
        claw.rotation.z = side * -0.7;
        group.add(claw);
      }
    }

    // 龙头装饰（刀身根部）
    const headGeo = new THREE.SphereGeometry(0.012, 8, 8);
    const head = new THREE.Mesh(headGeo, dragonRed);
    head.position.set(0, 0.035, -0.04);
    head.scale.set(1, 1.3, 0.8);
    group.add(head);

    // 龙角
    for (let side = -1; side <= 1; side += 2) {
      const hornGeo = new THREE.ConeGeometry(0.003, 0.022, 4);
      const horn = new THREE.Mesh(hornGeo, goldBright);
      horn.position.set(side * 0.008, 0.05, -0.04);
      horn.rotation.z = side * -0.5;
      group.add(horn);
    }

    // 龙眼
    for (let side = -1; side <= 1; side += 2) {
      const eyeGeo = new THREE.SphereGeometry(0.003, 6, 6);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.01, 0.038, -0.035);
      group.add(eye);
    }

    // === 护手 ===
    const guardShape = new THREE.Shape();
    guardShape.moveTo(-0.02, -0.008);
    guardShape.lineTo(0.02, -0.008);
    guardShape.lineTo(0.022, 0);
    guardShape.lineTo(0.02, 0.008);
    guardShape.lineTo(-0.02, 0.008);
    guardShape.lineTo(-0.022, 0);
    guardShape.closePath();

    const guardGeo = new THREE.ExtrudeGeometry(guardShape, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    const guard = new THREE.Mesh(guardGeo, guardGold);
    guard.position.set(0, 0, 0.0);
    group.add(guard);

    // 护手装饰球
    for (let side = -1; side <= 1; side += 2) {
      const ballGeo = new THREE.SphereGeometry(0.008, 8, 8);
      const ball = new THREE.Mesh(ballGeo, goldBright);
      ball.position.set(side * 0.024, 0, 0.008);
      group.add(ball);
    }

    // === 握柄 (金色缠柄 + 龙纹) ===
    const handleGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.1, 10);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 0.06);
    group.add(handle);

    // 缠绕纹理（金色环）
    for (let i = 0; i < 6; i++) {
      const ringGeo = new THREE.TorusGeometry(0.015, 0.002, 4, 12);
      const ring = new THREE.Mesh(ringGeo, guardGold);
      ring.position.set(0, 0, 0.02 + i * 0.015);
      group.add(ring);
    }

    // === 刀柄尾珠 (珍珠) ===
    const pommelGeo = new THREE.SphereGeometry(0.016, 10, 10);
    const pommel = new THREE.Mesh(pommelGeo, pearlMat);
    pommel.position.set(0, 0, 0.12);
    group.add(pommel);

    // 尾珠装饰环
    const pommelRingGeo = new THREE.TorusGeometry(0.015, 0.003, 6, 14);
    const pommelRing = new THREE.Mesh(pommelRingGeo, dragonRed);
    pommelRing.position.set(0, 0, 0.105);
    group.add(pommelRing);

    // 尾部金色小球
    const tailBallGeo = new THREE.SphereGeometry(0.006, 6, 6);
    const tailBall = new THREE.Mesh(tailBallGeo, goldBright);
    tailBall.position.set(0, 0, 0.14);
    group.add(tailBall);

    // 整体定位
    group.position.set(0.25, -0.18, -0.35);
    group.rotation.z = -0.3;
    group.rotation.y = -0.1;

    group.traverse(child => {
      if (child.isMesh) child.castShadow = true;
    });

    return group;
  }

  canFire() {
    return Date.now() - this.lastFireTime >= this.fireRate;
  }

  fire() {
    if (!this.canFire()) return false;
    this.lastFireTime = Date.now();
    this._slashAnimation();
    return true;
  }

  _slashAnimation() {
    if (!this.mesh) return;
    const origRotX = this.mesh.rotation.x;
    const origPosZ = this.mesh.position.z;
    this.mesh.rotation.x = origRotX - 1.0;
    this.mesh.position.z = origPosZ - 0.1;
    setTimeout(() => {
      this.mesh.rotation.x = origRotX;
      this.mesh.position.z = origPosZ;
    }, 250);
  }
}
