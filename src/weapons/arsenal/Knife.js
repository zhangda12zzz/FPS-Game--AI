import * as THREE from 'three';
import { Weapon } from '../Weapon.js';
import { WEAPONS } from '../../core/Constants.js';
import { createChromaKeyMaterial } from '../../utils/ChromaKeyMaterial.js';

export class Knife extends Weapon {
  constructor() {
    super({ ...WEAPONS.KNIFE, magSize: Infinity, reserveAmmo: Infinity });
    this.mesh = this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    // 绿幕贴图平面 — Ni3.png (麒麟刺)
    const mat = createChromaKeyMaterial('/images/Ni3.png');
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.40), mat);
    group.add(plane);

    // 整体定位（靠中下）
    group.position.set(0.04, -0.12, -0.4);

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
