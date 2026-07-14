import * as THREE from 'three';

// 所有血滴共享同一几何体（单位球，按需缩放），避免每次命中都创建/销毁几何体造成 GC 抖动
const SHARED_GEO = new THREE.SphereGeometry(1, 4, 4);

export class BloodSplatter {
  constructor(scene) {
    this.scene = scene;
    // 对象池：血滴复用，不再逐帧 new/dispose
    this.pool = [];
  }

  /** 取一个空闲血滴，池不足时按需增长（材质各自独立以支持单独淡出） */
  _acquire() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0x8b0000, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(SHARED_GEO, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    const p = { mesh, active: false, velocity: new THREE.Vector3(), life: 0 };
    this.pool.push(p);
    return p;
  }

  create(position) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      const size = 0.05 + Math.random() * 0.1;
      p.mesh.scale.setScalar(size);
      p.mesh.position.copy(position);
      p.mesh.material.opacity = 0.8;
      p.mesh.visible = true;
      p.velocity.set(
        (Math.random() - 0.5) * 4,
        Math.random() * 3,
        (Math.random() - 0.5) * 4
      );
      p.life = 1.0;
      p.active = true;
    }
  }

  /** 回收所有活跃血滴（切图等世界清理时调用，保留池以复用） */
  reset() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      // 逐分量积分，避免 velocity.clone() 逐帧分配
      s.mesh.position.x += s.velocity.x * dt;
      s.mesh.position.y += s.velocity.y * dt;
      s.mesh.position.z += s.velocity.z * dt;
      s.velocity.y -= 9.8 * dt;
      s.mesh.material.opacity = s.life * 0.8;
    }
  }
}
