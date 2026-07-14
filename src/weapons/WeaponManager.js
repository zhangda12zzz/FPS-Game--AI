import * as THREE from 'three';
import { Rifle } from './arsenal/Rifle.js';
import { Pistol } from './arsenal/Pistol.js';
import { Knife } from './arsenal/Knife.js';
import { Sniper } from './arsenal/Sniper.js';
import { preloadWeaponModels } from './WeaponModels.js';

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
    // 预加载四把武器的真实 GLB 模型(失败自动回退绿幕平面)
    await preloadWeaponModels();

    // 按槽位顺序: 0=步枪, 1=手枪, 2=刀, 3=狙击枪
    const rifle = new Rifle();
    const pistol = new Pistol();
    const knife = new Knife();
    const sniper = new Sniper();
    this.weapons = [rifle, pistol, knife, sniper];

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
      this.weaponMesh.scale.setScalar(1); // 重置缩放，避免开镜残留的 scale 造成切枪闪大
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

    // 开镜缩放：在腰射(1)与开镜缩放之间插值，避免开镜时武器显示过大
    const adsScale = (w && w.config && w.config.adsScale) || 1;
    this.weaponMesh.scale.setScalar(1 + (adsScale - 1) * this.aimT);

    // 武器晚动：腰射时轻微晃动，开镜时几乎不晃
    const bob = (1 - this.aimT) * Math.sin(Date.now() * 0.003) * 0.002;
    this.weaponMesh.position.y += bob;
  }

  /**
   * 预热渲染：把四把武器逐一临时挂到相机上渲染一次，
   * 触发各自材质的着色器编译与贴图 GPU 上传，避免进游戏后首次切枪卡顿。
   * 完成后恢复当前装备的武器。
   */
  warmup(renderer, scene, camera) {
    const restore = this.weaponMesh;
    // 先移除当前武器，逐把挂载并渲染
    if (restore) camera.remove(restore);
    for (const w of this.weapons) {
      if (!w.mesh) continue;
      camera.add(w.mesh);
      w.mesh.visible = true;
      if (renderer.compile) renderer.compile(scene, camera);
      renderer.render(scene, camera);
      camera.remove(w.mesh);
    }
    // 恢复当前武器
    if (restore) camera.add(restore);
  }

  getCurrentWeapon() {
    return this.currentWeapon;
  }

  getCurrentSlot() {
    return this.currentSlot;
  }

  /** 重置所有武器的弹匣与备弹到初始值 */
  resetAllAmmo() {
    for (const w of this.weapons) {
      if (w.resetAmmo) w.resetAmmo();
    }
  }
}
