import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ENEMY, BOMB } from '../core/Constants.js';
import { eventBus } from '../core/EventBus.js';

const STATE = { IDLE: 'idle', PATROL: 'patrol', CHASE: 'chase', ATTACK: 'attack', DEAD: 'dead' };

export class Enemy {
  constructor(position, physics) {
    this.health = ENEMY.HEALTH;
    this.isDead = false;
    this.state = STATE.PATROL;
    this.physics = physics;
    this.lastAttackTime = 0;
    this.patrolTarget = null;
    this.patrolTimer = 0;
    this.enemyAttackEnabled = false;
    this.deathTimer = 0;
    this.originalMaterials = [];
    this.hitmarkerTimer = 0;

    // === 炸弹携带者/安包状态 ===
    this.isCarrier = false;
    this.isPlanting = false;
    this.hasPlanted = false;     // 已完成安包（此后不再掉包）
    this.plantProgress = 0;      // 0~PLANT_TIME(ms)
    this.plantZone = null;       // THREE.Vector3 安包区中心
    this.pickupTarget = null;    // 拾取掉落炸弹目标点
    this.isCrouching = false;
    this.canJump = false;

    // === 行走动画 ===
    this._walkPhase = 0;

    // === 寻路 ===
    this.pathfinder = null;      // 由 EnemyManager 注入的网格寻路器
    this.path = null;            // 当前路径(世界坐标路点数组)
    this._pathGoal = null;       // 当前路径的目标点
    this._pathTimer = 0;         // 路径重算计时
    this._holdPush = false;      // 携带者是否暂缓冲锋(混入部队)

    this.group = new THREE.Group();
    this._createSoldierModel();
    this.group.position.copy(position);

    // 物理体
    const shape = new CANNON.Sphere(0.5);
    this.body = new CANNON.Body({ mass: 70, material: physics.groundMaterial, linearDamping: 0.9, angularDamping: 1.0 });
    this.body.addShape(shape);
    this.body.position.set(position.x, position.y + 1, position.z);
    physics.addBody(this.body);

    this.canJump = false;
    this.body.addEventListener('collide', (e) => {
      const contact = e.contact;
      const normal = new CANNON.Vec3();
      if (contact.bi === this.body) contact.ni.negate(normal); else normal.copy(contact.ni);
      if (normal.y > 0.5) this.canJump = true;
    });
  }

  _createSoldierModel() {
    const g = this.group;
    const olive = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.8 });
    const darkOlive = new THREE.MeshStandardMaterial({ color: 0x3a4a1a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });
    const black = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const red = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
    const belt = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.8 });

    // === 头部（缩小约 35%，提高爆头难度） ===
    // 头盔 (扁圆柱 + 帽檐)
    const helmetGeo = new THREE.CylinderGeometry(0.15, 0.165, 0.11, 10);
    this.helmet = new THREE.Mesh(helmetGeo, olive);
    this.helmet.position.y = 1.63;
    this.helmet.castShadow = true;
    this.helmet.userData.isHead = true;
    g.add(this.helmet);
    // 帽檐
    const brimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.015, 12, 1, false, 0, Math.PI);
    this.helmetBrim = new THREE.Mesh(brimGeo, darkOlive);
    this.helmetBrim.position.set(0, 1.59, 0.09);
    this.helmetBrim.rotation.x = -0.3;
    this.helmetBrim.userData.isHead = true;
    g.add(this.helmetBrim);
    // 红色头巾 (敌方标识)
    const bandanaGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10);
    this.bandana = new THREE.Mesh(bandanaGeo, red);
    this.bandana.position.y = 1.575;
    this.bandana.userData.isHead = true;
    g.add(this.bandana);
    // 面部
    const faceGeo = new THREE.SphereGeometry(0.105, 8, 8);
    this.face = new THREE.Mesh(faceGeo, skin);
    this.face.position.set(0, 1.53, 0.06);
    this.face.scale.set(1, 0.8, 0.9);
    this.face.userData.isHead = true;
    g.add(this.face);

    // === 上身 ===
    // 躯干 (战术背心)
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.55, 0.3);
    const torso = new THREE.Mesh(torsoGeo, olive);
    torso.position.y = 1.1;
    torso.castShadow = true;
    g.add(torso);
    // 双肩
    for (let side = -1; side <= 1; side += 2) {
      const shoulderGeo = new THREE.SphereGeometry(0.1, 8, 6);
      const shoulder = new THREE.Mesh(shoulderGeo, darkOlive);
      shoulder.position.set(side * 0.3, 1.3, 0);
      g.add(shoulder);
    }
    // 红色臂章 (左臂)
    const armbandGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8);
    const armband = new THREE.Mesh(armbandGeo, red);
    armband.position.set(-0.35, 1.2, 0);
    armband.rotation.z = Math.PI / 2;
    g.add(armband);

    // 胸前弹匣袋 (2-3小方块)
    for (let i = 0; i < 3; i++) {
      const pouchGeo = new THREE.BoxGeometry(0.08, 0.1, 0.06);
      const pouch = new THREE.Mesh(pouchGeo, darkOlive);
      pouch.position.set(-0.1 + i * 0.1, 1.0, 0.18);
      g.add(pouch);
    }

    // 背后背包
    const backpackGeo = new THREE.BoxGeometry(0.3, 0.3, 0.15);
    const backpack = new THREE.Mesh(backpackGeo, darkOlive);
    backpack.position.set(0, 1.15, -0.22);
    g.add(backpack);

    // === 双臂 — 等腰三角形据枪瞄准姿势 ===
    // 双臂从肩部向前伸，在胸部高度交汇，手枪在两手交汇处
    // 使用 pivot group + quaternion 精确定向
    const upY = new THREE.Vector3(0, -1, 0); // 圆柱默认朝上，取反 = 朝下

    // --- 右臂 ---
    const rShoulder = new THREE.Vector3(0.28, 1.28, 0);
    const rHandTarget = new THREE.Vector3(0.04, 1.16, 0.38); // 近中心，胸部高度，前方

    this.rArmPivot = new THREE.Group();
    this.rArmPivot.position.copy(rShoulder);
    g.add(this.rArmPivot);

    const rUpperLen = 0.24;
    const rArmUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, rUpperLen, 6), olive);
    rArmUpper.position.y = -rUpperLen / 2;
    rArmUpper.castShadow = true;
    this.rArmPivot.add(rArmUpper);

    // 前臂 pivot (肘部)
    this.rForearmPivot = new THREE.Group();
    this.rForearmPivot.position.y = -rUpperLen;
    this.rForearmPivot.rotation.x = -0.12; // 微曲保持弹性
    this.rArmPivot.add(this.rForearmPivot);

    const rLowerLen = 0.22;
    const rArmLower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, rLowerLen, 6), olive);
    rArmLower.position.y = -rLowerLen / 2;
    rArmLower.castShadow = true;
    this.rForearmPivot.add(rArmLower);

    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), skin);
    rHand.position.y = -rLowerLen;
    this.rForearmPivot.add(rHand);

    // 定向：肩部 → 手部目标
    const rDir = rHandTarget.clone().sub(rShoulder).normalize();
    this.rArmPivot.quaternion.setFromUnitVectors(upY, rDir);

    // --- 左臂 (镜像) ---
    const lShoulder = new THREE.Vector3(-0.28, 1.28, 0);
    const lHandTarget = new THREE.Vector3(-0.04, 1.16, 0.38);

    this.lArmPivot = new THREE.Group();
    this.lArmPivot.position.copy(lShoulder);
    g.add(this.lArmPivot);

    const lUpperLen = 0.24;
    const lArmUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, lUpperLen, 6), olive);
    lArmUpper.position.y = -lUpperLen / 2;
    lArmUpper.castShadow = true;
    this.lArmPivot.add(lArmUpper);

    this.lForearmPivot = new THREE.Group();
    this.lForearmPivot.position.y = -lUpperLen;
    this.lForearmPivot.rotation.x = -0.12;
    this.lArmPivot.add(this.lForearmPivot);

    const lLowerLen = 0.22;
    const lArmLower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, lLowerLen, 6), olive);
    lArmLower.position.y = -lLowerLen / 2;
    lArmLower.castShadow = true;
    this.lForearmPivot.add(lArmLower);

    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), skin);
    lHand.position.y = -lLowerLen;
    this.lForearmPivot.add(lHand);

    const lDir = lHandTarget.clone().sub(lShoulder).normalize();
    this.lArmPivot.quaternion.setFromUnitVectors(upY, lDir);

    // === 武器 (手枪，位于两手交汇处 / 胸部高度) ===
    const pistolBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.16), gunMetal);
    pistolBody.position.set(0, 1.16, 0.36);
    pistolBody.castShadow = true;
    g.add(pistolBody);
    // 枪管
    const pistolBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.1, 6), black);
    pistolBarrel.rotation.x = Math.PI / 2;
    pistolBarrel.position.set(0, 1.18, 0.48);
    g.add(pistolBarrel);
    // 握把
    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), gunMetal);
    pistolGrip.position.set(0, 1.09, 0.33);
    g.add(pistolGrip);
    // 扳机护圈
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 8, Math.PI), black);
    triggerGuard.position.set(0, 1.08, 0.37);
    triggerGuard.rotation.x = Math.PI / 2;
    g.add(triggerGuard);
    // 枪口位置（世界坐标由 group.matrixWorld 变换）
    this.gunMuzzlePos = new THREE.Vector3(0, 1.18, 0.55);

    // === 下身 ===
    // 腰带
    const beltGeo = new THREE.BoxGeometry(0.48, 0.06, 0.3);
    const beltMesh = new THREE.Mesh(beltGeo, belt);
    beltMesh.position.y = 0.8;
    g.add(beltMesh);

    // === 双腿 — pivot 结构用于行走动画 ===
    // 右腿
    this.rLegPivot = new THREE.Group();
    this.rLegPivot.position.set(0.13, 0.78, 0);
    g.add(this.rLegPivot);

    const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.35, 6), darkOlive);
    rThigh.position.y = -0.175;
    rThigh.castShadow = true;
    this.rLegPivot.add(rThigh);

    this.rShinPivot = new THREE.Group();
    this.rShinPivot.position.set(0, -0.35, 0.04);
    this.rLegPivot.add(this.rShinPivot);

    const rKnee = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), black);
    rKnee.scale.set(1, 0.8, 0.7);
    this.rShinPivot.add(rKnee);

    const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.3, 6), darkOlive);
    rShin.position.y = -0.15;
    rShin.castShadow = true;
    this.rShinPivot.add(rShin);

    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.16), black);
    rBoot.position.set(0, -0.34, 0.02);
    this.rShinPivot.add(rBoot);

    // 左腿 (镜像)
    this.lLegPivot = new THREE.Group();
    this.lLegPivot.position.set(-0.13, 0.78, 0);
    g.add(this.lLegPivot);

    const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.35, 6), darkOlive);
    lThigh.position.y = -0.175;
    lThigh.castShadow = true;
    this.lLegPivot.add(lThigh);

    this.lShinPivot = new THREE.Group();
    this.lShinPivot.position.set(0, -0.35, 0.04);
    this.lLegPivot.add(this.lShinPivot);

    const lKnee = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), black);
    lKnee.scale.set(1, 0.8, 0.7);
    this.lShinPivot.add(lKnee);

    const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.3, 6), darkOlive);
    lShin.position.y = -0.15;
    lShin.castShadow = true;
    this.lShinPivot.add(lShin);

    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.16), black);
    lBoot.position.set(0, -0.34, 0.02);
    this.lShinPivot.add(lBoot);

    // 收集所有材质用于闪白效果
    g.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        this.originalMaterials.push({ mesh: child, color: child.material.color.clone() });
      }
    });
  }

  /** 行走动画：根据移动速度驱动双腿交替摆动 */
  _updateWalkAnimation(dt) {
    if (this.isDead) return;

    const vel = this.body?.velocity;
    const speed = vel ? Math.hypot(vel.x, vel.z) : 0;

    if (speed > 0.5) {
      // 行走中：步频与速度成正比
      this._walkPhase += dt * (4 + speed * 1.5);
      const swing = Math.sin(this._walkPhase) * 0.45;       // 大腿摆幅
      const kneeSwing = Math.max(0, Math.sin(this._walkPhase)) * 0.55; // 抬腿时屈膝
      const kneeBack = Math.max(0, Math.sin(this._walkPhase + Math.PI)) * 0.55; // 对侧腿屈膝

      if (this.rLegPivot) this.rLegPivot.rotation.x = swing;
      if (this.lLegPivot) this.lLegPivot.rotation.x = -swing;
      if (this.rShinPivot) this.rShinPivot.rotation.x = -kneeSwing;
      if (this.lShinPivot) this.lShinPivot.rotation.x = -kneeBack;
    } else {
      // 停步：平滑回正
      const damp = 1 - Math.min(1, dt * 10);
      if (this.rLegPivot) this.rLegPivot.rotation.x *= damp;
      if (this.lLegPivot) this.lLegPivot.rotation.x *= damp;
      if (this.rShinPivot) this.rShinPivot.rotation.x *= damp;
      if (this.lShinPivot) this.lShinPivot.rotation.x *= damp;
    }
  }

  flashWhite() {
    this.originalMaterials.forEach(({ mesh }) => {
      mesh.material.emissive = new THREE.Color(0xffffff);
      mesh.material.emissiveIntensity = 0.8;
    });
    setTimeout(() => {
      this.originalMaterials.forEach(({ mesh }) => {
        mesh.material.emissiveIntensity = 0;
      });
    }, 100);
  }

  /** 设为/取消炸弹携带者，同步背后炸弹包标记 */
  setCarrier(flag) {
    this.isCarrier = flag;
    if (flag) {
      this.pickupTarget = null;
      if (!this.bombPack) this._createBombPack();
      this.bombPack.visible = true;
    } else {
      this.isPlanting = false;
      this.plantProgress = 0;
      if (this.bombPack) this.bombPack.visible = false;
    }
  }

  setPlantZone(vec) {
    this.plantZone = vec ? vec.clone() : null;
  }

  /** 背后炸弹包（红色发光标记） */
  _createBombPack() {
    const packGeo = new THREE.BoxGeometry(0.22, 0.28, 0.14);
    const packMat = new THREE.MeshStandardMaterial({
      // 低调深色，贴合普通装具外观，避免成为醒目的红色标记(让玩家难以分辨携带者)
      color: 0x2f2f26, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.85
    });
    this.bombPack = new THREE.Mesh(packGeo, packMat);
    this.bombPack.position.set(0, 1.15, -0.32); // 背包后侧
    this.group.add(this.bombPack);
  }

  takeDamage(amount, killerInfo, hitObject) {
    if (this.isDead) return;

    // 根据命中部位计算伤害：伤害数值由武器配置传入（爆头已在开火时应用爆头伤害）
    const isHead = this._isHeadMesh(hitObject);
    const finalDamage = Math.round(amount);

    this.health -= finalDamage;
    this.flashWhite();

    if (isHead) {
      this.triggerHitmarker();
    }

    // 发射伤害数字事件
    eventBus.emit('enemy:damaged', {
      enemy: this,
      damage: finalDamage,
      worldPos: this.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
      isHeadshot: isHead
    });

    if (this.health <= 0) {
      this.die(killerInfo);
    } else {
      this.state = STATE.CHASE;
    }
  }

  die(killerInfo) {
    this.isDead = true;
    this.state = STATE.DEAD;
    this.deathTimer = 2; // 倒地后 2s 消失
    const wasHeadshot = killerInfo?.isHeadshot || false;

    // 携带者阵亡且尚未完成安包 → 炸弹掉落（可被其他 AI 拾取）
    if (this.isCarrier && !this.hasPlanted) {
      const dropPos = this.group.position.clone(); // 保留 y = 携带者脚部高度(地表高度)
      eventBus.emit('bomb:dropped', { position: dropPos, from: this });
    }
    this.isCarrier = false;
    this.isPlanting = false;
    if (this.bombPack) this.bombPack.visible = false;

    eventBus.emit('enemy:killed', { enemy: this, killer: killerInfo, isHeadshot: wasHeadshot });
    this.physics.removeBody(this.body);

    // 爆头特殊死亡效果：慢动作倒地 + 延迟消失
    if (wasHeadshot) {
      // 爆头：身体向后仰倒，延迟更长
      this.group.rotation.x = -0.3;
      this.group.position.y -= 0.1;
    }
  }

  update(dt, playerPosition) {
    // 更新命中标记
    this.updateHitmarker(dt);

    if (this.isDead) {
      // 倒地动画（前 0.7s）
      if (this.deathTimer > 1.3) {
        const t = (2 - this.deathTimer) / 0.7;
        this.group.rotation.x = -Math.PI / 2 * Math.min(t, 1);
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, -0.3, t * 0.5);
      }
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.remove();
      }
      return;
    }

    // 同步物理
    this.group.position.set(this.body.position.x, this.body.position.y - 0.5, this.body.position.z);

    // 蹲伏时压低模型（与玩家一致的视觉反馈）
    this._applyCrouchVisual(dt);

    // 行走动画
    this._updateWalkAnimation(dt);

    const distToPlayer = this.group.position.distanceTo(playerPosition);

    // 最高优先级：前往拾取掉落的炸弹
    if (this.pickupTarget) {
      this._navigateTo(this.pickupTarget, ENEMY.SPEED, dt);
      return;
    }

    // 携带者：前往玩家老家安包（未完成时覆盖普通状态机）
    if (this.isCarrier && !this.hasPlanted && this.plantZone) {
      this._carrierBehavior(dt, playerPosition, distToPlayer);
      return;
    }
    this.isCrouching = false;

    switch (this.state) {
      case STATE.PATROL: this._patrol(dt, playerPosition, distToPlayer); break;
      case STATE.CHASE: this._chase(dt, playerPosition, distToPlayer); break;
      case STATE.ATTACK: this._attack(dt, playerPosition, distToPlayer); break;
    }
  }

  /**
   * 携带者行为：靠近安包区→下蹲安包（可被击杀中断）。
   * 为避免"总是冲在最前边"，在远离安包区且并非最靠前时，会像普通士兵一样
   * 作战/推进以混入部队；仅在临近安包区(APPROACH_RADIUS)时才全力冲刺。
   */
  _carrierBehavior(dt, playerPos, distToPlayer) {
    const zone = this.plantZone;
    const flat = this.group.position.clone(); flat.y = 0;
    const dist = flat.distanceTo(zone);

    if (dist <= BOMB.TRIGGER_RADIUS) {
      // 到位：停步下蹲安包
      this.body.velocity.x = 0; this.body.velocity.z = 0;
      this.isCrouching = true;
      this.isPlanting = true;
      const dir = zone.clone().sub(this.group.position); dir.y = 0;
      if (dir.length() > 0.01) this.group.rotation.y = Math.atan2(dir.x, dir.z);
      this.plantProgress += dt * 1000;
      if (this.plantProgress >= BOMB.PLANT_TIME) {
        this.hasPlanted = true;
        this.isPlanting = false;
        this.isCrouching = false;
        const bombPos = this.group.position.clone(); // 保留 y = 携带者脚部高度(地表高度)
        eventBus.emit('bomb:plantComplete', { position: bombPos, from: this });
      }
      return;
    }

    this.isPlanting = false;
    this.isCrouching = false;
    this.plantProgress = 0;

    // 携带者始终向安包区推进（自动寻路绕开障碍），绝不因玩家逐近而停步。
    // 为混入部队、不总冲最前：被判定为最靠前(_holdPush)且尚未临近安包区时降速与队友同步；
    // 一旦进入 APPROACH_RADIUS 则全力冲刺安包。
    const holding = this._holdPush && dist > BOMB.APPROACH_RADIUS;
    const speed = holding ? ENEMY.SPEED * 0.55 : ENEMY.SPEED;
    this._navigateTo(zone, speed, dt);
  }

  /** 朝目标点移动（水平），带卡住检测与侧向绕行避障 */
  _moveTowards(target, speed, dt = 0.016) {
    const pos = this.group.position;
    const dir = target.clone().sub(pos); dir.y = 0;
    if (dir.length() <= 0.1) { this.body.velocity.x = 0; this.body.velocity.z = 0; return; }
    dir.normalize();

    // 卡住检测：每 0.4s 采样一次实际位移，位移过小视为被障碍挡住
    this._progT = (this._progT || 0) + dt;
    if (!this._progPos) this._progPos = pos.clone();
    if (this._progT >= 0.4) {
      const moved = pos.distanceTo(this._progPos);
      if (moved < 0.12 && (this._detourT || 0) <= 0) {
        // 触发绕行：沿垂直方向侧移一段时间以绕开障碍
        this._detourT = 1.0;
        this._detourSign = pos.z >= 0 ? 1 : -1;
        if (Math.abs(pos.z) < 1) this._detourSign = Math.random() < 0.5 ? 1 : -1;
      }
      this._progT = 0;
      this._progPos = pos.clone();
    }

    let moveDir = dir.clone();
    if ((this._detourT || 0) > 0) {
      this._detourT -= dt;
      // 垂直分量为主、前进分量为辅，绕过障碍
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this._detourSign);
      moveDir = dir.multiplyScalar(0.35).add(perp);
      moveDir.y = 0; moveDir.normalize();
    }

    this.body.velocity.x = moveDir.x * speed;
    this.body.velocity.z = moveDir.z * speed;
    this.group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
  }

  /**
   * 自动寻路移动：目标可直视时走直线；被障碍阻挡时用 A* 计算绕行路径并沿路点前进。
   */
  _navigateTo(target, speed, dt = 0.016) {
    const pf = this.pathfinder;
    const pos = this.group.position;
    // 无寻路器或可直视 → 直接前往
    if (!pf || pf.hasLineOfSightWorld(pos, target)) {
      this.path = null;
      this._moveTowards(target, speed, dt);
      return;
    }
    // 需要绕路：目标显著移动或计时到点则重算路径
    this._pathTimer -= dt;
    const goalMoved = !this._pathGoal || this._pathGoal.distanceTo(target) > 2;
    if (!this.path || this.path.length === 0 || this._pathTimer <= 0 || goalMoved) {
      this.path = pf.findPath(pos, target);
      this._pathTimer = 0.6;
      this._pathGoal = target.clone();
    }
    if (this.path && this.path.length) {
      let wp = this.path[0];
      // 跳过已抵达的路点
      while (this.path.length > 1 && pos.distanceTo(wp) < 0.8) { this.path.shift(); wp = this.path[0]; }
      if (this.path.length === 1 && pos.distanceTo(wp) < 0.8) { this.path.shift(); wp = target; }
      this._moveTowards(wp || target, speed, dt);
    } else {
      // 无路可走 → 尽力直线靠近
      this._moveTowards(target, speed, dt);
    }
  }

  /** 蹲伏视觉：平滑压缩模型高度 */
  _applyCrouchVisual(dt) {
    const target = this.isCrouching ? 0.62 : 1.0;
    const cur = this.group.scale.y;
    this.group.scale.y = cur + (target - cur) * Math.min(1, dt * 12);
  }

  _patrol(dt, playerPos, dist) {
    if (dist < ENEMY.DETECTION_RANGE) { this.state = STATE.CHASE; return; }
    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0 || !this.patrolTarget) {
      // 巡逻目标权重偏向玩家老家(+X)
      const biasX = 4 + Math.random() * 14;   // 总体向 +X 推进
      this.patrolTarget = new THREE.Vector3(
        this.group.position.x + biasX, 0,
        this.group.position.z + (Math.random() - 0.5) * 16
      );
      this.patrolTimer = 3 + Math.random() * 3;
    }
    // 巡逻也走寻路，避免径直撞墙
    if (this.group.position.distanceTo(this.patrolTarget) > 1) {
      this._navigateTo(this.patrolTarget, ENEMY.SPEED * 0.6, dt);
    }
  }

  _chase(dt, playerPos, dist) {
    if (dist > ENEMY.DETECTION_RANGE * 1.5) { this.state = STATE.PATROL; return; }
    if (dist < ENEMY.ATTACK_RANGE) { this.state = STATE.ATTACK; return; }
    // 自动寻路追击：可直视则直线逼近，被墙体阻挡则绕行其他过道
    this._navigateTo(playerPos, ENEMY.SPEED, dt);
  }

  _attack(dt, playerPos, dist) {
    if (dist > ENEMY.ATTACK_RANGE * 1.2) { this.state = STATE.CHASE; return; }
    // 始终朝向玩家
    const dir = playerPos.clone().sub(this.group.position); dir.y = 0; dir.normalize();
    this.group.rotation.y = Math.atan2(dir.x, dir.z);

    // 攻击开关关闭时不原地静止：继续向玩家逐近，避免“玩家一靠近敌人就不动”
    if (!this.enemyAttackEnabled) {
      this._navigateTo(playerPos, ENEMY.SPEED, dt);
      return;
    }

    // 攻击开启：停步射击
    this.body.velocity.x = 0; this.body.velocity.z = 0;
    const now = Date.now();
    if (now - this.lastAttackTime >= ENEMY.FIRE_RATE) {
      this.lastAttackTime = now;
      // 敌人枪口位置(世界坐标)
      const muzzleWorld = this.gunMuzzlePos.clone().applyMatrix4(this.group.matrixWorld);
      eventBus.emit('enemy:attack', {
        enemy: this, damage: ENEMY.DAMAGE, distance: dist,
        muzzlePos: muzzleWorld
      });
    }
  }

  getMuzzleWorldPos() {
    this.group.updateMatrixWorld(true);
    return this.gunMuzzlePos.clone().applyMatrix4(this.group.matrixWorld);
  }

  remove() {
    if (this.body) this.physics.removeBody(this.body);
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  // === 爆头检测与部位伤害 ===
  _isHeadMesh(mesh) {
    if (!mesh) return false;
    if (mesh.userData && mesh.userData.isHead === true) return true;
    return mesh === this.helmet || mesh === this.helmetBrim || mesh === this.bandana || mesh === this.face;
  }


  updateHitmarker(dt) {
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) {
        this.hitmarkerTimer = 0;
        // 清除头部mesh的红色发光
        [this.helmet, this.helmetBrim, this.bandana, this.face].forEach(m => {
          if (m && m.material) {
            m.material.emissive = new THREE.Color(0x000000);
            m.material.emissiveIntensity = 0;
          }
        });
      }
    }
  }

  triggerHitmarker() {
    this.hitmarkerTimer = 0.3;
    // 头部mesh变红发光
    [this.helmet, this.helmetBrim, this.bandana, this.face].forEach(m => {
      if (m && m.material) {
        m.material.emissive = new THREE.Color(0xff0000);
        m.material.emissiveIntensity = 0.8;
      }
    });
  }
}
