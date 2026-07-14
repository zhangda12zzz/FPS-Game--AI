import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createChromaKeyMaterial } from '../../utils/ChromaKeyMaterial.js';
import { buildWeaponMesh } from '../WeaponModels.js';

export class Pistol extends Weapon {
  constructor() {
    super(WEAPONS.PISTOL);
    this.mesh = this.createMesh();
  }

  createMesh() {
    // 优先使用真实 GLB 模型
    const modelMesh = buildWeaponMesh('PISTOL', WEAPONS.PISTOL.model);
    if (modelMesh) return modelMesh;

    // 回退：绿幕贴图平面 — XIU2.jpg (沙鹰-修罗)
    const group = new THREE.Group();
    const mat = createChromaKeyMaterial('/images/XIU2.jpg');
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.20), mat);
    group.add(plane);
    group.position.set(0.18, -0.25, -0.4);
    return group;
  }
}

