import * as THREE from 'three';

// 所有弹道共享同一几何体（单位长圆柱，沿 Y 轴，按需缩放长度），避免逐发创建/销毁几何体
const SHARED_GEO = new THREE.CylinderGeometry(0.008, 0.008, 1, 4);

export class BulletTracer {
  constructor(scene) {
    this.scene = scene;
    // 对象池：弹道复用
    this.pool = [];
  }

  _acquire() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.7,
      depthTest: false
    });
    const mesh = new THREE.Mesh(SHARED_GEO, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    const t = { mesh, active: false, life: 0, maxLife: 0 };
    this.pool.push(t);
    return t;
  }

  create(from, to) {
    const t = this._acquire();
    const mesh = t.mesh;
    const length = from.distanceTo(to);

    // 单位圆柱按长度缩放 Y
    mesh.scale.set(1, length, 1);

    // 位置取中点，朝向对准终点（圆柱默认沿 Y，绕 X 转 90° 使其沿视线）
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    mesh.rotateX(Math.PI / 2);

    const maxLife = 0.15 + Math.random() * 0.1; // 150-250ms
    mesh.material.opacity = 0.7;
    mesh.visible = true;
    t.life = maxLife;
    t.maxLife = maxLife;
    t.active = true;
  }

  /** 回收所有活跃弹道（切图等世界清理时调用，保留池以复用） */
  reset() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const t = this.pool[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
      } else {
        t.mesh.material.opacity = (t.life / t.maxLife) * 0.7;
      }
    }
  }
}
