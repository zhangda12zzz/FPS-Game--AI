import * as THREE from 'three';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      // 更新位置
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      // 重力
      p.velocity.y -= 5 * dt;
      // 淡出
      const alpha = p.life / p.maxLife;
      p.mesh.material.opacity = alpha;
      p.mesh.scale.setScalar(alpha);
    }
  }

  createMuzzleParticles(position, count = 3) {
    this.emit(position, { count, color: 0xffaa00, speed: 2, size: 0.03, life: 0.2 });
  }

  emit(position, config) {
    const count = config.count || 5;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(config.size || 0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: config.color || 0xffaa00,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * (config.speed || 3),
        Math.random() * (config.speed || 3),
        (Math.random() - 0.5) * (config.speed || 3)
      );

      const life = config.life || 0.5;
      this.particles.push({
        mesh, velocity, life, maxLife: life
      });
    }
  }
}
