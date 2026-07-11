import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createConcreteTexture, createMetalPanelTexture } from '../utils/TextureGen.js';

export class MapLoader {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.objects = [];

    // 预生成常用纹理
    this.concreteTex = createConcreteTexture();
    this.metalTex = createMetalPanelTexture();
  }

  createBox(size, position, color, opts = {}) {
    const { texture, castShadow = true, receiveShadow = true } = opts;

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const matOpts = {
      color,
      roughness: opts.roughness ?? 0.8,
      metalness: opts.metalness ?? 0.1
    };
    if (texture) matOpts.map = texture;
    const mat = new THREE.MeshStandardMaterial(matOpts);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.type = opts.type || 'wall';
    this.scene.add(mesh);
    this.objects.push(mesh);

    const body = this.physics.createBox(size, position, this.physics.groundMaterial);
    return { mesh, body };
  }

  createGround(size, color) {
    const tex = createConcreteTexture();
    tex.repeat.set(size.x / 10, size.z / 10);
    const geo = new THREE.PlaneGeometry(size.x, size.z);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.92, metalness: 0.0, map: tex
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.userData.type = 'ground';
    this.scene.add(mesh);

    const shape = new CANNON.Plane();
    const body = new CANNON.Body({ mass: 0, material: this.physics.groundMaterial });
    body.addShape(shape);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.addBody(body);

    return mesh;
  }
}
