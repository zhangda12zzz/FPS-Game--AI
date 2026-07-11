import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createChromaKeyMaterial } from '../../utils/ChromaKeyMaterial.js';

export class Rifle extends Weapon {
  constructor() {
    super(WEAPONS.RIFLE);
    this.mesh = this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    // 绿幕贴图平面 — Huo1.png (AK47-火麒麟)
    const mat = createChromaKeyMaterial('/images/Huo1.png');
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), mat);
    group.add(plane);

    // 腰射位置
    group.position.set(0, -0.05, -0.45);

    return group;
  }
}
