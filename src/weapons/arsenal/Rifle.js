import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createScalePatternTexture, createGripTexture, createMetalBrushTexture, createWoodTexture } from '../../utils/TextureGen.js';

export class Rifle extends Weapon {
  constructor() {
    super(WEAPONS.RIFLE);
    this.mesh = this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    // === 程序化纹理 ===
    const scaleTex = createScalePatternTexture('#1a0800', '#6b1500');
    const gripTex = createGripTexture('#3a1500', '#1a0800');
    const metalTex = createMetalBrushTexture();
    const woodTex = createWoodTexture();

    // === 材质 ===
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.88, roughness: 0.22, map: metalTex });
    const scaleMat = new THREE.MeshStandardMaterial({ color: 0x8b1a00, metalness: 0.65, roughness: 0.35, map: scaleTex });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a020, metalness: 0.97, roughness: 0.1 });
    const fireMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, metalness: 0.55, roughness: 0.3, emissive: 0x331100, emissiveIntensity: 0.3 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x181818, metalness: 0.97, roughness: 0.08, map: metalTex });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x4a1a00, roughness: 0.88, metalness: 0.05, map: gripTex });
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x2a0a00, roughness: 0.7, metalness: 0.08, map: woodTex });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.98, roughness: 0.03, map: metalTex });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0 });

    // === 机匣（使用 Shape + Extrude 创建有机外形） ===
    const receiverShape = new THREE.Shape();
    receiverShape.moveTo(-0.025, -0.03);
    receiverShape.lineTo(0.025, -0.03);
    receiverShape.lineTo(0.028, -0.01);
    receiverShape.lineTo(0.028, 0.02);
    receiverShape.lineTo(0.022, 0.032);
    receiverShape.lineTo(-0.022, 0.032);
    receiverShape.lineTo(-0.028, 0.02);
    receiverShape.lineTo(-0.028, -0.01);
    receiverShape.closePath();

    const receiverGeo = new THREE.ExtrudeGeometry(receiverShape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    const receiver = new THREE.Mesh(receiverGeo, bodyMat);
    receiver.position.set(0, 0, -0.25);
    group.add(receiver);

    // 机匣顶部鳞甲覆盖层
    const topScaleGeo = new THREE.BoxGeometry(0.054, 0.008, 0.4);
    const topScale = new THREE.Mesh(topScaleGeo, scaleMat);
    topScale.position.set(0, 0.035, -0.05);
    group.add(topScale);

    // 鳞甲凸起纹理（分段立体效果）
    for (let i = 0; i < 8; i++) {
      const bumpGeo = new THREE.BoxGeometry(0.056, 0.005, 0.018);
      const bump = new THREE.Mesh(bumpGeo, fireMat);
      bump.position.set(0, 0.04, -0.22 + i * 0.048);
      group.add(bump);
    }

    // === 皮卡汀尼导轨 (机匣顶部) ===
    const railBaseGeo = new THREE.BoxGeometry(0.03, 0.006, 0.25);
    const railBase = new THREE.Mesh(railBaseGeo, bodyMat);
    railBase.position.set(0, 0.042, -0.08);
    group.add(railBase);
    // 导轨槽
    for (let i = 0; i < 10; i++) {
      const slotGeo = new THREE.BoxGeometry(0.032, 0.004, 0.006);
      const slot = new THREE.Mesh(slotGeo, goldMat);
      slot.position.set(0, 0.046, -0.18 + i * 0.022);
      group.add(slot);
    }

    // === 护木/前握把区域 ===
    const handguardShape = new THREE.Shape();
    handguardShape.moveTo(-0.024, -0.025);
    handguardShape.lineTo(0.024, -0.025);
    handguardShape.lineTo(0.022, 0.018);
    handguardShape.lineTo(-0.022, 0.018);
    handguardShape.closePath();

    const hgGeo = new THREE.ExtrudeGeometry(handguardShape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.001, bevelSegments: 1 });
    const handguard = new THREE.Mesh(hgGeo, scaleMat);
    handguard.position.set(0, 0, -0.52);
    group.add(handguard);

    // 护木散热孔（圆形排列）
    for (let i = 0; i < 4; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const holeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8);
        const hole = new THREE.Mesh(holeGeo, bodyMat);
        hole.rotation.z = Math.PI / 2;
        hole.position.set(side * 0.025, 0.005, -0.42 + i * 0.05);
        group.add(hole);
      }
    }

    // === 枪管 ===
    const barrelPoints = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const r = 0.012 - t * 0.002 + Math.sin(t * Math.PI) * 0.002;
      barrelPoints.push(new THREE.Vector2(r, t * 0.5));
    }
    const barrelGeo = new THREE.LatheGeometry(barrelPoints, 12);
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = -Math.PI / 2;
    barrel.position.set(0, 0.008, -0.5);
    group.add(barrel);

    // 枪口制退器（多气孔设计）
    const muzzleGeo = new THREE.CylinderGeometry(0.018, 0.014, 0.07, 12);
    const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.008, -1.0);
    group.add(muzzle);
    // 制退器开孔
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const ventGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.008, 6);
      const vent = new THREE.Mesh(ventGeo, bodyMat);
      vent.position.set(Math.cos(angle) * 0.016, Math.sin(angle) * 0.016 + 0.008, -0.98);
      group.add(vent);
    }

    // === 准星护翼 ===
    const fSightBaseGeo = new THREE.BoxGeometry(0.022, 0.008, 0.02);
    const fSightBase = new THREE.Mesh(fSightBaseGeo, barrelMat);
    fSightBase.position.set(0, 0.02, -0.88);
    group.add(fSightBase);
    // 双柱准星
    for (let side = -1; side <= 1; side += 2) {
      const postGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.025, 6);
      const post = new THREE.Mesh(postGeo, goldMat);
      post.position.set(side * 0.006, 0.035, -0.88);
      group.add(post);
    }

    // === 弹匣 (弧形AK弹匣) ===
    const magShape = new THREE.Shape();
    magShape.moveTo(-0.016, 0);
    magShape.lineTo(0.016, 0);
    magShape.lineTo(0.018, -0.005);
    magShape.quadraticCurveTo(0.02, -0.08, 0.015, -0.14);
    magShape.lineTo(-0.015, -0.14);
    magShape.quadraticCurveTo(-0.02, -0.08, -0.018, -0.005);
    magShape.closePath();

    const magGeo = new THREE.ExtrudeGeometry(magShape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    const mag = new THREE.Mesh(magGeo, scaleMat);
    mag.position.set(0, -0.03, -0.08);
    mag.rotation.x = -0.08;
    group.add(mag);
    // 弹匣底板
    const magPlateGeo = new THREE.BoxGeometry(0.038, 0.006, 0.048);
    const magPlate = new THREE.Mesh(magPlateGeo, goldMat);
    magPlate.position.set(0, -0.175, -0.065);
    group.add(magPlate);

    // === 扳机组 ===
    // 扳机护圈（圆弧）
    const guardCurve = new THREE.Shape();
    guardCurve.moveTo(0.015, 0);
    guardCurve.lineTo(0.015, -0.002);
    guardCurve.quadraticCurveTo(0.015, -0.035, 0, -0.038);
    guardCurve.quadraticCurveTo(-0.015, -0.035, -0.015, -0.002);
    guardCurve.lineTo(-0.015, 0);
    guardCurve.lineTo(-0.013, 0);
    guardCurve.quadraticCurveTo(-0.013, -0.03, 0, -0.034);
    guardCurve.quadraticCurveTo(0.013, -0.03, 0.013, 0);
    guardCurve.closePath();

    const guardGeo = new THREE.ExtrudeGeometry(guardCurve, { depth: 0.003, bevelEnabled: false });
    const guard = new THREE.Mesh(guardGeo, bodyMat);
    guard.position.set(-0.0015, -0.03, -0.02);
    group.add(guard);
    // 扳机
    const triggerGeo = new THREE.BoxGeometry(0.003, 0.018, 0.006);
    const trigger = new THREE.Mesh(triggerGeo, bodyMat);
    trigger.position.set(0, -0.04, -0.01);
    trigger.rotation.x = 0.15;
    group.add(trigger);

    // === 握把（木质 + 防滑纹） ===
    const gripGeo = new THREE.CylinderGeometry(0.018, 0.016, 0.09, 8);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.08, 0.04);
    grip.rotation.x = -0.2;
    group.add(grip);
    // 握把底部金属底盖
    const gripCapGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.005, 8);
    const gripCap = new THREE.Mesh(gripCapGeo, bodyMat);
    gripCap.position.set(0, -0.125, 0.05);
    gripCap.rotation.x = -0.2;
    group.add(gripCap);

    // === 枪托 ===
    const stockShape = new THREE.Shape();
    stockShape.moveTo(-0.02, -0.025);
    stockShape.lineTo(0.02, -0.025);
    stockShape.lineTo(0.022, 0.02);
    stockShape.lineTo(-0.022, 0.02);
    stockShape.closePath();

    const stockGeo = new THREE.ExtrudeGeometry(stockShape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 });
    const stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.set(0, 0, 0.17);
    group.add(stock);

    // 枪托火焰纹装饰
    const flameGeo = new THREE.BoxGeometry(0.046, 0.018, 0.12);
    const flame = new THREE.Mesh(flameGeo, fireMat);
    flame.position.set(0, 0.015, 0.28);
    group.add(flame);

    // 枪托尾部橡胶垫
    const buttPadGeo = new THREE.BoxGeometry(0.044, 0.048, 0.012);
    const buttPad = new THREE.Mesh(buttPadGeo, rubberMat);
    buttPad.position.set(0, 0, 0.455);
    group.add(buttPad);

    // === 麒麟刺刀 (枪管下方) ===
    // 刺刀卡座
    const mountGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8);
    const mount = new THREE.Mesh(mountGeo, bodyMat);
    mount.rotation.x = Math.PI / 2;
    mount.position.set(0, -0.008, -0.6);
    group.add(mount);

    // 刺刀主体（带弧度）
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.012, -0.005);
    bladeShape.lineTo(0.015, -0.02);
    bladeShape.lineTo(0.01, -0.025);
    bladeShape.lineTo(-0.002, -0.015);
    bladeShape.closePath();

    const bladeExtGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    const blade = new THREE.Mesh(bladeExtGeo, bladeMat);
    blade.position.set(-0.006, -0.005, -0.78);
    group.add(blade);

    // 麒麟角（刺刀两侧金色尖刺）
    for (let side = -1; side <= 1; side += 2) {
      const hornGeo = new THREE.ConeGeometry(0.004, 0.035, 5);
      const horn = new THREE.Mesh(hornGeo, goldMat);
      horn.position.set(side * 0.015, 0.008, -0.65);
      horn.rotation.z = side * -0.6;
      horn.rotation.x = -0.3;
      group.add(horn);
    }

    // 刺刀根部金色装饰环
    const ringGeo = new THREE.TorusGeometry(0.014, 0.003, 6, 12);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.set(0, -0.008, -0.615);
    group.add(ring);

    // === 拉机柄 (AK经典右侧) ===
    const chargingGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.015, 8);
    const charging = new THREE.Mesh(chargingGeo, bodyMat);
    charging.rotation.z = Math.PI / 2;
    charging.position.set(0.035, 0.01, -0.05);
    group.add(charging);
    // 拉机柄圆球
    const chargingBallGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const chargingBall = new THREE.Mesh(chargingBallGeo, bodyMat);
    chargingBall.position.set(0.043, 0.01, -0.05);
    group.add(chargingBall);

    // === 照门 ===
    const rearSightGeo = new THREE.BoxGeometry(0.025, 0.008, 0.012);
    const rearSight = new THREE.Mesh(rearSightGeo, bodyMat);
    rearSight.position.set(0, 0.042, 0.12);
    group.add(rearSight);

    // === 金色装饰线（枪身侧面） ===
    for (let side = -1; side <= 1; side += 2) {
      const lineGeo = new THREE.BoxGeometry(0.002, 0.012, 0.18);
      const line = new THREE.Mesh(lineGeo, goldMat);
      line.position.set(side * 0.029, 0, -0.05);
      group.add(line);
    }

    // 整体定位
    group.position.set(0.25, -0.22, -0.4);
    group.rotation.y = 0.02;

    group.traverse(child => {
      if (child.isMesh) child.castShadow = true;
    });

    return group;
  }
}
