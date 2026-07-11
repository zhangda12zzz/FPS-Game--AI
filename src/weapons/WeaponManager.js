import * as THREE from 'three';
import { Rifle } from './arsenal/Rifle.js';
import { Pistol } from './arsenal/Pistol.js';
import { Knife } from './arsenal/Knife.js';

export class WeaponManager {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.weapons = [];
    this.currentWeapon = null;
    this.currentSlot = 0;
    this.weaponMesh = null;
    this.aiming = false; // 是否正在开镜
    this.aimT = 0;       // 开镜插值进度 0~1
  }

  async init() {
    // 按槽位顺序: 0=步枪, 1=手枪, 2=刀
    const rifle = new Rifle();
    const pistol = new Pistol();
    const knife = new Knife();
    this.weapons = [rifle, pistol, knife];

    // 创建所有武器模型，并记录腰射位置与开镜位置
    for (const w of this.weapons) {
      w.mesh = w.createMesh();
      w.hipPos = w.mesh.position.clone(); // 腰射（默认）位置
      if (w.config && w.config.adsPos) {
        w.adsPos = new THREE.Vector3(w.config.adsPos[0], w.config.adsPos[1], w.config.adsPos[2]);
      }
    }

    // 默认装备步枪
    this.switchTo(0);
  }

  switchTo(slot) {
    if (slot < 0 || slot >= this.weapons.length) return;

    // 移除旧武器模型
    if (this.weaponMesh) {
      this.camera.remove(this.weaponMesh);
    }

    this.currentSlot = slot;
    this.currentWeapon = this.weapons[slot];
    this.weaponMesh = this.currentWeapon.mesh;

    // 切枪时重置开镜状态并回到腰射位置
    this.aiming = false;
    this.aimT = 0;
    if (this.weaponMesh) {
      if (this.currentWeapon.hipPos) this.weaponMesh.position.copy(this.currentWeapon.hipPos);
      this.camera.add(this.weaponMesh);
    }
  }

  /** 当前武器是否支持开镜 */
  canAds() {
    return !!(this.currentWeapon && this.currentWeapon.adsPos);
  }

  /** 设置开镜状态（仅在支持开镜的武器上生效） */
  setAiming(v) {
    this.aiming = !!v && this.canAds();
  }

  /** 开镜插值进度（0=腰射，1=完全开镜），供相机 FOV 同步 */
  getAimProgress() {
    return this.aimT;
  }

  update(dt) {
    if (!this.weaponMesh) return;
    const w = this.currentWeapon;

    // 开镜/收镜平滑插值
    const target = this.aiming ? 1 : 0;
    this.aimT += (target - this.aimT) * Math.min(1, dt * 14);

    // 在腰射位置与开镜位置之间插值
    if (w && w.hipPos) {
      if (w.adsPos) {
        this.weaponMesh.position.lerpVectors(w.hipPos, w.adsPos, this.aimT);
      } else {
        this.weaponMesh.position.copy(w.hipPos);
      }
    }

    // 武器晚动：腰射时轻微晃动，开镜时几乎不晃
    const bob = (1 - this.aimT) * Math.sin(Date.now() * 0.003) * 0.002;
    this.weaponMesh.position.y += bob;
  }

  getCurrentWeapon() {
    return this.currentWeapon;
  }

  getCurrentSlot() {
    return this.currentSlot;
  }
}
