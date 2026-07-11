import * as THREE from 'three';

export class MuzzleFlash {
  constructor(scene) {
    this.scene = scene;
    this.flashes = [];
    // 创建可复用的闪光球
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: i < 3 ? 0xffaa00 : 0xffdd44,
        transparent: true, opacity: 0,
        depthTest: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.flashes.push({ mesh, life: 0 });
    }
    // 点光源
    this.light = new THREE.PointLight(0xffaa00, 0, 8);
    scene.add(this.light);
  }

  show(worldPos) {
    const count = 2 + Math.floor(Math.random() * 3); // 2-4个
    let shown = 0;
    for (let i = 0; i < this.flashes.length && shown < count; i++) {
      const f = this.flashes[i];
      if (f.life <= 0) {
        f.mesh.position.copy(worldPos);
        f.mesh.position.x += (Math.random() - 0.5) * 0.1;
        f.mesh.position.y += (Math.random() - 0.5) * 0.1;
        f.mesh.position.z += (Math.random() - 0.5) * 0.1;
        f.mesh.material.opacity = 1;
        f.mesh.visible = true;
        f.life = 0.05 + Math.random() * 0.03; // 50-80ms
        shown++;
      }
    }
    this.light.position.copy(worldPos);
    this.light.intensity = 3;
    setTimeout(() => { this.light.intensity = 0; }, 60);
  }

  update(dt) {
    for (const f of this.flashes) {
      if (f.life > 0) {
        f.life -= dt;
        if (f.life <= 0) {
          f.mesh.visible = false;
          f.mesh.material.opacity = 0;
        } else {
          f.mesh.material.opacity = f.life / 0.08;
        }
      }
    }
  }
}