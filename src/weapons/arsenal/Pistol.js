import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createChromaKeyMaterial } from '../../utils/ChromaKeyMaterial.js';

export class Pistol extends Weapon {
  constructor() {
    super(WEAPONS.PISTOL);
    this.mesh = this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    // 绿幕贴图平面 — XIU2.jpg (沙鹰-修罗)
    const mat = createChromaKeyMaterial('/images/XIU2.jpg');
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.20), mat);
    group.add(plane);

    // 腰射位置（右下角，符合手枪握持比例）
    group.position.set(0.18, -0.25, -0.4);

    return group;
  }
}
