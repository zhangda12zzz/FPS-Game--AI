import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createGripTexture, createMetalBrushTexture } from '../../utils/TextureGen.js';

export class Pistol extends Weapon {
  constructor() {
    super(WEAPONS.PISTOL);
    this.mesh = this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const metalTex = createMetalBrushTexture();
    const gripTex = createGripTexture('#1a1a1e', '#0a0a0e');

    // === 材质 ===
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.92, roughness: 0.18, map: metalTex });
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.55, roughness: 0.3, emissive: 0x220000, emissiveIntensity: 0.2 });
    const crimsonMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, metalness: 0.45, roughness: 0.4 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.85, metalness: 0.15, map: gripTex });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.97, roughness: 0.04, map: metalTex });
    const darkGold = new THREE.MeshStandardMaterial({ color: 0x996600, metalness: 0.92, roughness: 0.12 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95, metalness: 0 });

    // === 沙鹰枪身 (使用 Shape 创建棱角分明的侧面轮廓) ===
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.02, -0.03);
    bodyShape.lineTo(0.02, -0.03);
    bodyShape.lineTo(0.02, 0.015);
    bodyShape.lineTo(0.018, 0.025);
    bodyShape.lineTo(-0.018, 0.025);
    bodyShape.lineTo(-0.02, 0.015);
    bodyShape.closePath();

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0, -0.11);
    group.add(body);

    // === 滑套 (上部，可动部分) ===
    const slideShape = new THREE.Shape();
    slideShape.moveTo(-0.019, 0);
    slideShape.lineTo(0.019, 0);
    slideShape.lineTo(0.019, 0.018);
    slideShape.lineTo(0.017, 0.022);
    slideShape.lineTo(-0.017, 0.022);
    slideShape.lineTo(-0.019, 0.018);
    slideShape.closePath();

    const slideGeo = new THREE.ExtrudeGeometry(slideShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    const slide = new THREE.Mesh(slideGeo, bodyMat);
    slide.position.set(0, 0.025, -0.1);
    group.add(slide);

    // 滑套后部（加厚 - 沙鹰特征）
    const slideBackGeo = new THREE.BoxGeometry(0.04, 0.026, 0.05);
    const slideBack = new THREE.Mesh(slideBackGeo, bodyMat);
    slideBack.position.set(0, 0.038, 0.1);
    group.add(slideBack);

    // 滑套防滑锯齿（前端 + 后端）
    for (let area = 0; area < 2; area++) {
      const startZ = area === 0 ? -0.08 : 0.06;
      for (let i = 0; i < 6; i++) {
        const serrGeo = new THREE.BoxGeometry(0.041, 0.002, 0.003);
        const serr = new THREE.Mesh(serrGeo, bloodMat);
        serr.position.set(0, 0.048, startZ + i * 0.006);
        group.add(serr);
      }
    }

    // === 修罗魂纹饰 (血红色) ===
    // 枪身中部修罗纹带
    const patternGeo = new THREE.BoxGeometry(0.042, 0.008, 0.12);
    const pattern = new THREE.Mesh(patternGeo, bloodMat);
    pattern.position.set(0, 0.002, 0);
    group.add(pattern);

    // 滑套上血色装饰线
    for (let i = 0; i < 4; i++) {
      const deco = new THREE.BoxGeometry(0.04, 0.003, 0.015);
      const decoMesh = new THREE.Mesh(deco, crimsonMat);
      decoMesh.position.set(0, 0.048, -0.04 + i * 0.03);
      group.add(decoMesh);
    }

    // === 枪管 (沙鹰特征：粗壮的枪管) ===
    const barrelPoints = [];
    for (let i = 0; i <= 15; i++) {
      const t = i / 15;
      const r = 0.011 + Math.sin(t * Math.PI) * 0.003;
      barrelPoints.push(new THREE.Vector2(r, t * 0.1));
    }
    const barrelGeo = new THREE.LatheGeometry(barrelPoints, 10);
    const barrel = new THREE.Mesh(barrelGeo, bodyMat);
    barrel.rotation.x = -Math.PI / 2;
    barrel.position.set(0, 0.02, -0.14);
    group.add(barrel);

    // 枪口（六角形）
    const muzzleGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.018, 6);
    const muzzle = new THREE.Mesh(muzzleGeo, bodyMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.02, -0.24);
    group.add(muzzle);

    // 枪管下方导杆
    const guideGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.12, 6);
    const guide = new THREE.Mesh(guideGeo, bodyMat);
    guide.rotation.x = Math.PI / 2;
    guide.position.set(0, 0.005, -0.15);
    group.add(guide);

    // === 准星 ===
    const fSightGeo = new THREE.BoxGeometry(0.006, 0.012, 0.005);
    const fSight = new THREE.Mesh(fSightGeo, darkGold);
    fSight.position.set(0, 0.052, -0.12);
    group.add(fSight);
    // 准星发光点
    const dotGeo = new THREE.SphereGeometry(0.002, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0, 0.06, -0.12);
    group.add(dot);

    // === 照门 ===
    const rSightGeo = new THREE.BoxGeometry(0.02, 0.008, 0.004);
    const rSight = new THREE.Mesh(rSightGeo, bodyMat);
    rSight.position.set(0, 0.048, 0.08);
    group.add(rSight);

    // === 扳机护圈 ===
    const guardShape = new THREE.Shape();
    guardShape.moveTo(0.013, 0);
    guardShape.lineTo(0.013, -0.002);
    guardShape.quadraticCurveTo(0.013, -0.03, 0, -0.032);
    guardShape.quadraticCurveTo(-0.013, -0.03, -0.013, -0.002);
    guardShape.lineTo(-0.013, 0);
    guardShape.lineTo(-0.011, 0);
    guardShape.quadraticCurveTo(-0.011, -0.026, 0, -0.028);
    guardShape.quadraticCurveTo(0.011, -0.026, 0.011, 0);
    guardShape.closePath();

    const guardGeo = new THREE.ExtrudeGeometry(guardShape, { depth: 0.003, bevelEnabled: false });
    const guard = new THREE.Mesh(guardGeo, bodyMat);
    guard.position.set(-0.0015, -0.028, 0.02);
    group.add(guard);

    // 扳机
    const trigGeo = new THREE.BoxGeometry(0.003, 0.016, 0.005);
    const trig = new THREE.Mesh(trigGeo, bodyMat);
    trig.position.set(0, -0.035, 0.015);
    trig.rotation.x = 0.12;
    group.add(trig);

    // === 握把 (大尺寸，沙鹰特征) ===
    const gripShape = new THREE.Shape();
    gripShape.moveTo(-0.017, 0);
    gripShape.lineTo(0.017, 0);
    gripShape.lineTo(0.015, -0.09);
    gripShape.lineTo(-0.015, -0.09);
    gripShape.closePath();

    const gripGeo = new THREE.ExtrudeGeometry(gripShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    const grip = new THREE.Mesh(gripGeo, gripMaterial);
    grip.position.set(0, -0.03, 0.04);
    grip.rotation.x = -0.12;
    group.add(grip);

    // 握把底部弹匣底板
    const magBaseGeo = new THREE.BoxGeometry(0.032, 0.006, 0.038);
    const magBase = new THREE.Mesh(magBaseGeo, bodyMat);
    magBase.position.set(0, -0.125, 0.07);
    group.add(magBase);

    // === 外露击锤 (沙鹰经典特征) ===
    const hammerGeo = new THREE.BoxGeometry(0.008, 0.02, 0.012);
    const hammer = new THREE.Mesh(hammerGeo, darkGold);
    hammer.position.set(0, 0.055, 0.11);
    hammer.rotation.x = -0.4;
    group.add(hammer);
    // 击锤防滑纹
    for (let i = 0; i < 3; i++) {
      const hLine = new THREE.BoxGeometry(0.009, 0.002, 0.001);
      const hLineMesh = new THREE.Mesh(hLine, bodyMat);
      hLineMesh.position.set(0, 0.058, 0.105 + i * 0.004);
      group.add(hLineMesh);
    }

    // === 保险 (左侧) ===
    const safetyGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8);
    const safety = new THREE.Mesh(safetyGeo, darkGold);
    safety.rotation.z = Math.PI / 2;
    safety.position.set(0.023, 0.03, 0.05);
    group.add(safety);

    // === 滑套释放杆 ===
    const releaseGeo = new THREE.BoxGeometry(0.003, 0.008, 0.015);
    const release = new THREE.Mesh(releaseGeo, bodyMat);
    release.position.set(0.021, 0.015, -0.02);
    group.add(release);

    // === 修罗刃 (枪管下方战术刀刃) ===
    // 刀刃安装座
    const bladeBaseGeo = new THREE.BoxGeometry(0.012, 0.008, 0.025);
    const bladeBase = new THREE.Mesh(bladeBaseGeo, bodyMat);
    bladeBase.position.set(0, -0.012, -0.15);
    group.add(bladeBase);

    // 刀刃（用 Shape 创建弯刀外形）
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.008, -0.005);
    bladeShape.lineTo(0.01, -0.015);
    bladeShape.lineTo(0.005, -0.02);
    bladeShape.lineTo(-0.003, -0.012);
    bladeShape.closePath();

    const bladeExtGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
    const blade = new THREE.Mesh(bladeExtGeo, bladeMat);
    blade.position.set(-0.003, -0.01, -0.19);
    group.add(blade);

    // 刀刃血槽
    const grooveGeo = new THREE.BoxGeometry(0.003, 0.002, 0.06);
    const groove = new THREE.Mesh(grooveGeo, bloodMat);
    groove.position.set(0, -0.018, -0.18);
    group.add(groove);

    // === 金色装饰点缀 ===
    // 枪身两侧金色线条
    for (let side = -1; side <= 1; side += 2) {
      const lineGeo = new THREE.BoxGeometry(0.001, 0.006, 0.15);
      const line = new THREE.Mesh(lineGeo, darkGold);
      line.position.set(side * 0.021, 0.01, 0);
      group.add(line);
    }

    // 整体定位
    group.position.set(0.2, -0.2, -0.3);

    group.traverse(child => {
      if (child.isMesh) child.castShadow = true;
    });

    return group;
  }
}
