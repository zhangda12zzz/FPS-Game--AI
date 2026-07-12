// ============================================================
// 地图注册表：所有可用地图集中声明于此
// 新增地图只需：
//   1. 在 src/map/ 下新建地图类（继承 MapLoader 即可，例如 Map_Transport）
//   2. 在本文件追加一项：{ id, name, desc, loader: (scene, physics) => 实例化 }
// ============================================================
import { Map_Transport } from '../map/Map_Transport.js';
import { Map_IceWorld } from '../map/Map_IceWorld.js';

/**
 * @typedef {Object} MapEntry
 * @property {string}   id        地图唯一 ID（也用于 URL 参数 ?map=xxx）
 * @property {string}   name      显示名称
 * @property {string}   desc      简介
 * @property {string}   [thumb]   可选缩略图（如 /images/maps/transport.jpg）
 * @property {(scene, physics) => object} loader  实例化并返回地图对象（需含 load() 方法）
 */
export const MAP_REGISTRY = [
  {
    id: 'classic',
    name: '经典 运输船',
    desc: 'CF 经典运输船：长边 80m，多集装箱掩体，炸弹模式默认地图',
    loader: (scene, physics) => new Map_Transport(scene, physics),
  },
  {
    id: 'iceworld',
    name: '田字格 冰世界',
    desc: 'CS1.6 fy_iceworld 构型：正方形 48m，十字隔墙分四象限，冰块掩体',
    loader: (scene, physics) => new Map_IceWorld(scene, physics),
  },
  // ===== 以后新增地图在此追加 =====
];

/** 按 id 查找地图条目，找不到时回退第一项 */
export function findMapById(id) {
  return MAP_REGISTRY.find(m => m.id === id) || MAP_REGISTRY[0];
}

/** 返回默认地图（第一项） */
export function getDefaultMap() {
  return MAP_REGISTRY[0];
}
