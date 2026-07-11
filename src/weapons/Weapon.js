import * as THREE from 'three';
import { eventBus } from '../core/EventBus.js';

export class Weapon {
  constructor(config) {
    this.name = config.name;
    this.damage = config.damage;
    this.range = config.range;
    this.fireRate = config.fireRate;
    this.magSize = config.magSize || 30;
    this.reserveAmmo = config.reserveAmmo || 90;
    this.reloadTime = config.reloadTime || 2500;
    this.recoil = config.recoil || 0.03;
    this.slot = config.slot;
    this.auto = config.auto || false;

    this.config = config; // 保存完整配置供Game.js访问
    this.ammo = this.magSize; // 弹匣当前弹药 (外部可直接访问)
    this.lastFireTime = 0;
    this.mesh = null;
  }

  canFire() {
    // 刀没有弹匣限制
    if (!this.config.magSize) return Date.now() - this.lastFireTime >= this.fireRate;
    return this.ammo > 0 && (Date.now() - this.lastFireTime >= this.fireRate);
  }

  fire() {
    if (!this.canFire()) return false;
    if (this.config.magSize) this.ammo--;
    this.lastFireTime = Date.now();
    eventBus.emit('weapon:fire', { weapon: this });
    return true;
  }

  createMesh() {
    return new THREE.Group();
  }

  getRecoilOffset() {
    return (Math.random() - 0.5) * this.recoil;
  }
}