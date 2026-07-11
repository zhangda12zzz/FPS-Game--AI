import * as THREE from 'three';
import { BOMB } from '../core/Constants.js';
import { eventBus } from '../core/EventBus.js';

const STATE = { IDLE: 'idle', ARMED: 'armed', DEFUSED: 'defused', EXPLODED: 'exploded' };

// 炸弹安放/拆除协调器：管理炸弹实体、倒计时、拆包交互
export class BombManager {
  constructor(scene, audioFx) {
    this.scene = scene;
    this.audio = audioFx;
    this.state = STATE.IDLE;

    this.bombGroup = null;
    this.bombLight = null;
    this.bombPos = null;

    // 携带者阵亡后掉在地面的炸弹（可见红色实体，待其他敌人拾取）
    this.droppedGroup = null;
    this.droppedLight = null;
    this._dropBlink = 0;

    this.countdown = 0;        // 剩余秒
    this.blinkTimer = 0;
    this.blinkOn = false;

    this.defuseProgress = 0;   // 0~DEFUSE_TIME(ms)
    this.tickTimer = 0;

    this._bindEvents();
  }

  _bindEvents() {
    eventBus.on('bomb:plantComplete', (data) => this._plant(data.position));
    // 携带者阵亡掉包 → 在掉落点生成可见的红色炸弹
    eventBus.on('bomb:dropped', (data) => this._showDropped(data.position));
    // 被拾取/无人可拾 → 移除掉落实体
    eventBus.on('bomb:pickedUp', () => this._removeDropped());
  }

  get isArmed() { return this.state === STATE.ARMED; }

  _plant(position) {
    if (this.state === STATE.ARMED) return;
    this._removeDropped();
    this.bombPos = position.clone();
    this.bombPos.y = 0;
    this._createBombEntity(this.bombPos);
    this.countdown = BOMB.COUNTDOWN;
    this.defuseProgress = 0;
    this.blinkTimer = 0;
    this.blinkOn = true;
    this.state = STATE.ARMED;

    if (this.audio) { this.audio.setAlarmUrgency(this.countdown); this.audio.startAlarm(); }
    eventBus.emit('bomb:planted', { position: this.bombPos.clone(), countdown: this.countdown });
  }

  _createBombEntity(pos) {
    this._removeBombEntity();
    const g = new THREE.Group();

    // 炸药主体（C4 风格深色方块）
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x22331a, roughness: 0.7, metalness: 0.2 })
    );
    body.position.y = 0.11;
    body.castShadow = true;
    g.add(body);

    // 红色指示灯
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), lampMat);
    this.lamp.position.set(0, 0.26, 0);
    g.add(this.lamp);

    // 红色点光源（闪烁）
    this.bombLight = new THREE.PointLight(0xff2200, 2, 12);
    this.bombLight.position.set(0, 0.4, 0);
    g.add(this.bombLight);

    g.position.copy(pos);
    this.scene.add(g);
    this.bombGroup = g;
  }

  _removeBombEntity() {
    if (this.bombGroup) {
      this.scene.remove(this.bombGroup);
      this.bombGroup.traverse(c => {
        if (c.isMesh) { c.geometry?.dispose?.(); c.material?.dispose?.(); }
      });
      this.bombGroup = null;
      this.bombLight = null;
      this.lamp = null;
    }
  }

  /** 在掉落点生成可见的红色炸弹（待拾取） */
  _showDropped(pos) {
    this._removeDropped();
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x992222, emissive: 0xff2200, emissiveIntensity: 0.85, roughness: 0.5 })
    );
    body.position.y = 0.13;
    body.castShadow = true;
    g.add(body);
    // 红色指示灯
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff2200, emissiveIntensity: 1 })
    );
    lamp.position.set(0, 0.28, 0);
    g.add(lamp);
    // 红光便于远处识别
    const light = new THREE.PointLight(0xff2200, 1.6, 9);
    light.position.set(0, 0.4, 0);
    g.add(light);
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this.droppedGroup = g;
    this.droppedLight = light;
    this._dropBlink = 0;
  }

  _removeDropped() {
    if (this.droppedGroup) {
      this.scene.remove(this.droppedGroup);
      this.droppedGroup.traverse(c => {
        if (c.isMesh) { c.geometry?.dispose?.(); c.material?.dispose?.(); }
      });
      this.droppedGroup = null;
      this.droppedLight = null;
    }
  }

  /**
   * @param {number} dt 秒
   * @param {THREE.Vector3} playerPos
   * @param {boolean} defuseHeld 玩家是否按住 E
   */
  update(dt, playerPos, defuseHeld) {
    // 掉落炸弹的红光闪烁（与安包状态无关，只要存在就闪）
    if (this.droppedGroup && this.droppedLight) {
      this._dropBlink += dt;
      const on = Math.floor(this._dropBlink / 0.35) % 2 === 0;
      this.droppedLight.intensity = on ? 2.0 : 0.4;
    }

    if (this.state !== STATE.ARMED) return;

    // 红光闪烁
    this.blinkTimer += dt;
    if (this.blinkTimer >= BOMB.BLINK_INTERVAL) {
      this.blinkTimer = 0;
      this.blinkOn = !this.blinkOn;
      if (this.bombLight) this.bombLight.intensity = this.blinkOn ? 2.5 : 0.2;
      if (this.lamp) this.lamp.material.emissiveIntensity = this.blinkOn ? 1 : 0.15;
    }

    // 倒计时
    this.countdown -= dt;
    if (this.audio) this.audio.setAlarmUrgency(Math.max(0, this.countdown));

    // 拆包交互
    const inRange = playerPos && this.bombPos &&
      playerPos.distanceTo(this.bombPos) <= BOMB.DEFUSE_RADIUS;

    if (defuseHeld && inRange) {
      this.defuseProgress += dt * 1000;
      this.tickTimer += dt;
      if (this.tickTimer >= 0.25) { this.tickTimer = 0; this.audio?.defuseTick(); }
      if (this.defuseProgress >= BOMB.DEFUSE_TIME) {
        this._defuse();
        return;
      }
    } else {
      // 松开/离开则进度回退
      this.defuseProgress = Math.max(0, this.defuseProgress - dt * 2000);
    }

    // 爆炸
    if (this.countdown <= 0) {
      this._explode();
    }
  }

  _defuse() {
    this.state = STATE.DEFUSED;
    this.defuseProgress = 0;
    this._removeBombEntity();
    this.audio?.stopAlarm();
    this.audio?.defuseSuccess();
    eventBus.emit('bomb:defused', {});
    // 拆除后允许敌人重新尝试安包
    this.state = STATE.IDLE;
  }

  _explode() {
    this.state = STATE.EXPLODED;
    const pos = this.bombPos ? this.bombPos.clone() : null;
    this._removeBombEntity();
    this.audio?.stopAlarm();
    this.audio?.explosion();
    eventBus.emit('bomb:exploded', { position: pos });
  }

  /** 供小地图/HUD 读取 */
  getBombInfo() {
    if (this.state !== STATE.ARMED) return null;
    return {
      position: this.bombPos,
      remaining: Math.max(0, this.countdown),
      defuseRatio: Math.min(1, this.defuseProgress / BOMB.DEFUSE_TIME),
      defusing: this.defuseProgress > 0
    };
  }

  reset() {
    this._removeBombEntity();
    this._removeDropped();
    this.audio?.stopAlarm();
    this.state = STATE.IDLE;
    this.countdown = 0;
    this.defuseProgress = 0;
    this.bombPos = null;
    this.blinkOn = false;
  }
}
