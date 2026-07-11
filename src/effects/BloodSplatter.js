import * as THREE from 'three';

export class BloodSplatter {
  constructor(scene) {
    this.scene = scene;
    this.splatters = [];
  }

  create(position) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8b0000,
        transparent: true,
        opacity: 0.8
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3,
        (Math.random() - 0.5) * 4
      );

      this.splatters.push({ mesh, velocity, life: 1.0 });
    }
  }

  update(dt) {
    for (let i = this.splatters.length - 1; i >= 0; i--) {
      const s = this.splatters[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.splatters.splice(i, 1);
        continue;
      }
      s.mesh.position.add(s.velocity.clone().multiplyScalar(dt));
      s.velocity.y -= 9.8 * dt;
      s.mesh.material.opacity = s.life * 0.8;
    }
  }
}
