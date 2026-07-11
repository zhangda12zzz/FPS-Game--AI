import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PLAYER } from '../core/Constants.js';

export class PlayerController {
  constructor(camera, physics, input, canvas) {
    this.camera = camera;
    this.physics = physics;
    this.input = input;

    this.yaw = 0;
    this.pitch = 0;
    this.canJump = false;
    this.isSprinting = false;
    this.isCrouching = false;
    this.isMoving = false;               // 本帧是否在移动（供脚步声使用）
    this.currentHeight = PLAYER.HEIGHT; // 当前视点高度（蹲伏时平滑降低）
    this.sensitivityScale = 1;          // 鼠标灵敏度系数（开镜时降低，更易瞄准）

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this._createPhysicsBody();
  }

  _createPhysicsBody() {
    const shape = new CANNON.Sphere(PLAYER.RADIUS);
    this.body = new CANNON.Body({
      mass: 70,
      material: this.physics.playerMaterial,
      linearDamping: 0.9,
      angularDamping: 1.0
    });
    this.body.addShape(shape);
    this.body.position.set(0, PLAYER.HEIGHT, 0);
    this.physics.addBody(this.body);

    // 地面检测
    this.body.addEventListener('collide', (e) => {
      const contact = e.contact;
      const normal = new CANNON.Vec3();
      if (contact.bi === this.body) {
        contact.ni.negate(normal);
      } else {
        normal.copy(contact.ni);
      }
      if (normal.y > 0.5) {
        this.canJump = true;
      }
    });
  }

  update(dt) {
    if (!this.input.isLocked) { this.isMoving = false; return; }

    // 鼠标视角（开镜时按 sensitivityScale 降低灵敏度）
    const { dx, dy } = this.input.consumeMouseDelta();
    const sens = 0.002 * this.sensitivityScale;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    // 移动
    // 下蹲状态（Ctrl）：降低视点高度与移动速度，且不可冲刺
    this.isCrouching = this.input.isKeyPressed('ControlLeft') || this.input.isKeyPressed('ControlRight');
    const targetHeight = this.isCrouching ? PLAYER.CROUCH_HEIGHT : PLAYER.HEIGHT;
    this.currentHeight += (targetHeight - this.currentHeight) * Math.min(1, dt * 12);

    // 移动速度：下蹲 < 正常 < 冲刺（下蹲优先，禁止冲刺）
    this.isSprinting = !this.isCrouching && this.input.isKeyPressed('ShiftLeft');
    let speed = PLAYER.SPEED;
    if (this.isCrouching) speed = PLAYER.CROUCH_SPEED;
    else if (this.isSprinting) speed = PLAYER.SPRINT_SPEED;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.direction.set(0, 0, 0);
    if (this.input.isKeyPressed('KeyW')) this.direction.add(forward);
    if (this.input.isKeyPressed('KeyS')) this.direction.sub(forward);
    if (this.input.isKeyPressed('KeyA')) this.direction.sub(right);
    if (this.input.isKeyPressed('KeyD')) this.direction.add(right);

    if (this.direction.length() > 0) {
      this.direction.normalize();
      this.body.velocity.x = this.direction.x * speed;
      this.body.velocity.z = this.direction.z * speed;
      this.isMoving = true;
    } else {
      this.isMoving = false;
    }

    // 跳跃（下蹲时不可跳）
    if (this.input.isKeyPressed('Space') && this.canJump && !this.isCrouching) {
      this.body.velocity.y = PLAYER.JUMP_FORCE;
      this.canJump = false;
    }

    // 同步相机（使用当前视点高度）
    this.camera.position.set(
      this.body.position.x,
      this.body.position.y + this.currentHeight - 0.2,
      this.body.position.z
    );

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  getPosition() {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y + this.currentHeight - 0.2,
      this.body.position.z
    );
  }

  getDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  applyRecoil(amount) {
    this.pitch += amount * (0.5 + Math.random() * 0.5);
    this.yaw += (Math.random() - 0.5) * amount * 0.5;
  }

  respawn(position) {
    this.body.position.set(position.x, position.y + 2, position.z);
    this.body.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.isCrouching = false;
    this.currentHeight = PLAYER.HEIGHT;
  }
}
