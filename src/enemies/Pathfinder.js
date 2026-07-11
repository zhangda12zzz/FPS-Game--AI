import * as THREE from 'three';

// 基于网格的 A* 寻路器：从地图障碍物构建占用网格，为敌人计算绕开障碍的路径。
// 通过视线检测(LOS)在可直达时走直线、被墙体阻挡时自动改走其他过道。
export class Pathfinder {
  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds 地图边界
   * @param {Array<{x:number,z:number,w:number,d:number}>} obstacles 障碍物(中心+尺寸)
   * @param {number} cell 网格边长(世界单位)
   * @param {number} pad 障碍物外扩量(容纳敌人半径)
   */
  constructor(bounds, obstacles = [], cell = 1, pad = 0.9) {
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell)); // X 方向格数
    this.rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell)); // Z 方向格数
    this.blocked = new Uint8Array(this.cols * this.rows);
    this._markObstacles(obstacles, pad);
  }

  _idx(ix, iz) { return iz * this.cols + ix; }

  _inGrid(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.cols && iz < this.rows; }

  worldToCell(x, z) {
    return {
      ix: Math.floor((x - this.minX) / this.cell),
      iz: Math.floor((z - this.minZ) / this.cell),
    };
  }

  cellToWorld(ix, iz) {
    return new THREE.Vector3(
      this.minX + (ix + 0.5) * this.cell,
      0,
      this.minZ + (iz + 0.5) * this.cell
    );
  }

  _markObstacles(obstacles, pad) {
    obstacles.forEach(o => {
      const x0 = o.x - o.w / 2 - pad, x1 = o.x + o.w / 2 + pad;
      const z0 = o.z - o.d / 2 - pad, z1 = o.z + o.d / 2 + pad;
      const c0 = this.worldToCell(x0, z0);
      const c1 = this.worldToCell(x1, z1);
      for (let iz = c0.iz; iz <= c1.iz; iz++) {
        for (let ix = c0.ix; ix <= c1.ix; ix++) {
          if (this._inGrid(ix, iz)) this.blocked[this._idx(ix, iz)] = 1;
        }
      }
    });
  }

  _clamp(ix, iz) {
    return {
      ix: Math.max(0, Math.min(this.cols - 1, ix)),
      iz: Math.max(0, Math.min(this.rows - 1, iz)),
    };
  }

  /** 就近寻找一个空闲格(用于起点/终点恰好落在障碍内的情形) */
  _nearestFree(ix, iz) {
    if (this._inGrid(ix, iz) && !this.blocked[this._idx(ix, iz)]) return { ix, iz };
    for (let r = 1; r < Math.max(this.cols, this.rows); r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // 只查该层外环
          const nx = ix + dx, nz = iz + dz;
          if (this._inGrid(nx, nz) && !this.blocked[this._idx(nx, nz)]) return { ix: nx, iz: nz };
        }
      }
    }
    return null;
  }

  /** 世界坐标两点之间是否有视线(无墙体阻挡) */
  hasLineOfSightWorld(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / (this.cell * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = this.worldToCell(a.x + dx * t, a.z + dz * t);
      if (this._inGrid(c.ix, c.iz) && this.blocked[this._idx(c.ix, c.iz)]) return false;
    }
    return true;
  }

  /**
   * 计算从 startVec 到 goalVec 的路径。
   * @returns {THREE.Vector3[]|null} 路点数组(世界坐标, y=0)，含终点；无路可走返回 null
   */
  findPath(startVec, goalVec) {
    let s = this._clamp(...Object.values(this.worldToCell(startVec.x, startVec.z)));
    let g = this._clamp(...Object.values(this.worldToCell(goalVec.x, goalVec.z)));

    if (this.blocked[this._idx(s.ix, s.iz)]) { const f = this._nearestFree(s.ix, s.iz); if (f) s = f; else return null; }
    if (this.blocked[this._idx(g.ix, g.iz)]) { const f = this._nearestFree(g.ix, g.iz); if (f) g = f; else return null; }

    const si = this._idx(s.ix, s.iz);
    const gi = this._idx(g.ix, g.iz);
    if (si === gi) return [new THREE.Vector3(goalVec.x, 0, goalVec.z)];

    const n = this.cols * this.rows;
    const gScore = new Float32Array(n).fill(Infinity);
    const fScore = new Float32Array(n).fill(Infinity);
    const cameFrom = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const inOpen = new Uint8Array(n);
    const open = [];

    const h = (ix, iz) => {
      const ax = Math.abs(ix - g.ix), az = Math.abs(iz - g.iz);
      return (ax + az) + (Math.SQRT2 - 2) * Math.min(ax, az); // 八向启发
    };

    gScore[si] = 0;
    fScore[si] = h(s.ix, s.iz);
    open.push(si); inOpen[si] = 1;

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    while (open.length) {
      // 取 fScore 最小的节点(网格较小，线性扫描足够)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
      const cur = open[bi];
      if (cur === gi) return this._reconstruct(cameFrom, cur, goalVec);
      open.splice(bi, 1); inOpen[cur] = 0; closed[cur] = 1;

      const cix = cur % this.cols, ciz = Math.floor(cur / this.cols);
      for (const [dx, dz] of dirs) {
        const nx = cix + dx, nz = ciz + dz;
        if (!this._inGrid(nx, nz)) continue;
        const ni = this._idx(nx, nz);
        if (this.blocked[ni] || closed[ni]) continue;
        // 对角线不允许切墙角
        if (dx !== 0 && dz !== 0) {
          if (this.blocked[this._idx(cix + dx, ciz)] || this.blocked[this._idx(cix, ciz + dz)]) continue;
        }
        const step = (dx !== 0 && dz !== 0) ? Math.SQRT2 : 1;
        const tentative = gScore[cur] + step;
        if (tentative < gScore[ni]) {
          cameFrom[ni] = cur;
          gScore[ni] = tentative;
          fScore[ni] = tentative + h(nx, nz);
          if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
        }
      }
    }
    return null; // 无路
  }

  _reconstruct(cameFrom, endIdx, goalVec) {
    const cells = [];
    let cur = endIdx;
    while (cur !== -1) {
      const ix = cur % this.cols, iz = Math.floor(cur / this.cols);
      cells.push({ ix, iz });
      cur = cameFrom[cur];
    }
    cells.reverse();
    // 转世界坐标(丢弃起点格，敌人已在此处)
    let pts = cells.map(c => this.cellToWorld(c.ix, c.iz));
    pts = this._smooth(pts);
    if (pts.length) pts.shift(); // 去掉起点
    // 用真实终点替换最后一个格中心，路径更精确
    if (pts.length) pts[pts.length - 1] = new THREE.Vector3(goalVec.x, 0, goalVec.z);
    else pts.push(new THREE.Vector3(goalVec.x, 0, goalVec.z));
    return pts;
  }

  /** 拉直路径：跳过视线可直达的中间点，减少锯齿 */
  _smooth(points) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1 && !this.hasLineOfSightWorld(points[i], points[j])) j--;
      result.push(points[j]);
      i = j;
    }
    return result;
  }
}
