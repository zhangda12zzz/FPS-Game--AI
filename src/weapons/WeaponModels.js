import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 四把武器的真实 GLB 模型模板(预加载后缓存，切枪时克隆复用)
const templates = { RIFLE: null, PISTOL: null, KNIFE: null, SNIPER: null };
let _promise = null;

const PATHS = {
  RIFLE: '/models/HUO_1.glb',   // AK47-火麒麟
  PISTOL: '/models/XIU_2.glb',  // 沙鹰-修罗
  KNIFE: '/models/NI_3.glb',    // 屠龙
  SNIPER: '/models/HUAN_4.glb', // 幻神-狙击枪
};

/** 预加载全部武器模型；单个失败自动回退绿幕平面(该键保持 null) */
export function preloadWeaponModels() {
  if (_promise) return _promise;
  const loader = new GLTFLoader();
  const loadOne = (key) => new Promise((resolve) => {
    loader.load(
      PATHS[key],
      (gltf) => { templates[key] = gltf.scene; resolve(); },
      undefined,
      (err) => { console.warn(`[Weapon] ${PATHS[key]} 加载失败，回退绿幕平面:`, err); templates[key] = null; resolve(); }
    );
  });
  _promise = Promise.all(Object.keys(PATHS).map(loadOne));
  return _promise;
}

export function hasWeaponModel(key) {
  return !!templates[key];
}

/**
 * 用真实 GLB 模型构建第一人称武器 mesh。
 * 返回的根 Group.position = 腰射位置(供 WeaponManager 读取为 hipPos)；
 * 内层 orient 承载归一化缩放与朝向旋转，模型已居中。
 * @param {string} key RIFLE|PISTOL|KNIFE
 * @param {{size:number,pos:number[],rot:number[]}} cfg 归一化目标尺寸/位置/朝向
 * @returns {THREE.Group|null} 模型未加载时返回 null(调用方回退绿幕平面)
 */
export function buildWeaponMesh(key, cfg = {}) {
  const tpl = templates[key];
  if (!tpl) return null;

  const model = tpl.clone(true);
  model.updateMatrixWorld(true);

  // 每把武器独立克隆材质，关闭阴影/视锥剔除(贴在相机上会被误剔除)
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = false;
    if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
    else if (o.material) o.material = o.material.clone();
  });

  // 居中：把包围盒中心移到原点(在现有 position 基础上偏移，保留模型自身旋转/缩放)
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);

  // 归一化缩放：最长边缩放到目标尺寸
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = (cfg.size || 0.5) / maxDim;

  // orient: 承载缩放 + 朝向旋转(绕居中后的模型中心)
  const orient = new THREE.Group();
  orient.add(model);
  orient.scale.setScalar(s);
  const rot = cfg.rot || [0, 0, 0];
  orient.rotation.set(rot[0], rot[1], rot[2]);

  // root: 承载腰射位置(WeaponManager 会在 hip/ads 之间对其插值)
  const root = new THREE.Group();
  root.add(orient);
  const pos = cfg.pos || [0, 0, -0.45];
  root.position.set(pos[0], pos[1], pos[2]);

  return root;
}

/**
 * 多部件武器：模型拆成多块，每块独立的 size/rot/pos(方便分别微调)。
 * 每块先烘焙自身在 GLB 中的变换→居中→归一化缩放→旋转→定位，挂到同一根下。
 * @param {string} key RIFLE|PISTOL|KNIFE
 * @param {Array<{match?:string,index?:number,size:number,pos:number[],rot:number[]}>} parts
 * @returns {THREE.Group|null}
 */
export function buildWeaponMeshParts(key, parts = []) {
  const tpl = templates[key];
  if (!tpl) return null;

  const src = tpl.clone(true);
  src.updateMatrixWorld(true);
  const meshes = [];
  src.traverse((o) => { if (o.isMesh) meshes.push(o); });

  const root = new THREE.Group();
  parts.forEach((cfg, i) => {
    // 定位部件：优先按 match(mesh 名或父节点名包含)，否则按 index/顺序
    let mesh = null;
    if (cfg.match) {
      mesh = meshes.find((m) =>
        (m.name && m.name.includes(cfg.match)) ||
        (m.parent && m.parent.name && m.parent.name.includes(cfg.match)));
    }
    if (!mesh) mesh = meshes[cfg.index != null ? cfg.index : i];
    if (!mesh) return;

    // 烘焙世界变换到几何，再居中到原点
    const geom = mesh.geometry.clone();
    geom.applyMatrix4(mesh.matrixWorld);
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    geom.translate(-center.x, -center.y, -center.z);

    const material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    const part = new THREE.Mesh(geom, material);
    part.castShadow = false;
    part.receiveShadow = false;
    part.frustumCulled = false;

    // orient: 归一化缩放 + 朝向
    const orient = new THREE.Group();
    orient.add(part);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    orient.scale.setScalar((cfg.size || 0.3) / maxDim);
    const rot = cfg.rot || [0, 0, 0];
    orient.rotation.set(rot[0], rot[1], rot[2]);

    // 部件位置(相对相机，因为根在相机原点)
    const pg = new THREE.Group();
    pg.add(orient);
    const pos = cfg.pos || [0, 0, -0.45];
    pg.position.set(pos[0], pos[1], pos[2]);
    root.add(pg);
  });

  return root;
}
