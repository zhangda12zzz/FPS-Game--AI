import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { buildWeaponMesh } from '../WeaponModels.js';

export class Sniper extends Weapon {
  constructor() {
    super(WEAPONS.SNIPER);
    this.mesh = this.createMesh();
  }

  createMesh() {
    // 优先使用真实 GLB 模型
    const modelMesh = buildWeaponMesh('SNIPER', WEAPONS.SNIPER.model);
    if (modelMesh) return modelMesh;

    // 回退：无专属绿幕贴图，程序化生成一把细长的深色狙击枪占位
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), bodyMat);
    body.frustumCulled = false;
    group.add(body);
    // 瞄准镜
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 12), bodyMat);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.05, 0.07, 0);
    scope.frustumCulled = false;
    group.add(scope);
    group.position.set(0.15, -0.20, -0.45);
    return group;
  }
}
