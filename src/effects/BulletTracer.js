import * as THREE from 'three';

export class BulletTracer {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
  }

  create(from, to) {
    const dir = to.clone().sub(from);
    const length = dir.length();
    const geo = new THREE.CylinderGeometry(0.008, 0.008, length, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.7,
      depthTest: false
    });
    const mesh = new THREE.Mesh(geo, mat);

    // 位置和旋转
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.lookAt(to);
    mesh.rotateX(Math.PI / 2);

    this.scene.add(mesh);
    const maxLife = 0.15 + Math.random() * 0.1; // 150-250ms
    this.tracers.push({ mesh, life: maxLife, maxLife });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mesh.material.opacity = (t.life / t.maxLife) * 0.7;
      }
    }
  }
}