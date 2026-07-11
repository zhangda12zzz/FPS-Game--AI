import * as THREE from 'three';
import { COLORS } from './Constants.js';

export class SceneManager {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.SKY);
    this.scene.fog = new THREE.Fog(COLORS.SKY, 80, 200);

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,          // 不使用模板缓冲，节省显存
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // 限制像素比 ≤ 1.5，高 DPI 屏幕上避免过度渲染导致掉帧
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    // PCFShadowMap 比 PCFSoftShadowMap 快很多，视觉差异很小
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // 相机
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.scene.add(this.camera);

    this._setupLights();
    this._setupResize();
  }

  _setupLights() {
    // 环境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    // 方向光（太阳）
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);  // 1024 比 2048 快 4 倍，远距离几乎看不出差异
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // 半球光
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x5a5a3a, 0.35);
    this.scene.add(hemi);

    // 补光（从下方反射）
    const fill = new THREE.DirectionalLight(0x8899aa, 0.15);
    fill.position.set(-20, -10, -30);
    this.scene.add(fill);
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
