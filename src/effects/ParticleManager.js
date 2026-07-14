import * as THREE from 'three';

// 所有粒子共享同一几何体（单位球，按需缩放），避免逐帧创建/销毁
const SHARED_GEO = new THREE.SphereGeometry(1, 4, 4);

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    // 对象池：粒子复用，不再逐帧 new/dispose
    this.pool = [];
  }

  _acquire() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(SHARED_GEO, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    const p = { mesh, active: false, velocity: new THREE.Vector3(), life: 0, maxLife: 0, size: 0.05 };
    this.pool.push(p);
    return p;
  }

  /** 回收所有活跃粒子（切图等世界清理时调用，保留池以复用） */
  reset() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      // 逐分量积分，避免 velocity.clone() 逐帧分配
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;
      // 重力
      p.velocity.y -= 5 * dt;
      // 淡出 + 缩小
      const alpha = p.life / p.maxLife;
      p.mesh.material.opacity = alpha;
      p.mesh.scale.setScalar(p.size * alpha);
    }
  }

  createMuzzleParticles(position, count = 3) {
    this.emit(position, { count, color: 0xffaa00, speed: 2, size: 0.03, life: 0.2 });
  }

  emit(position, config) {
    const count = config.count || 5;
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      const size = config.size || 0.05;
      p.size = size;
      p.mesh.material.color.setHex(config.color || 0xffaa00);
      p.mesh.material.opacity = 1;
      p.mesh.position.copy(position);
      p.mesh.scale.setScalar(size);
      p.mesh.visible = true;

      const speed = config.speed || 3;
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed,
        (Math.random() - 0.5) * speed
      );

      const life = config.life || 0.5;
      p.life = life;
      p.maxLife = life;
      p.active = true;
    }
  }
}
