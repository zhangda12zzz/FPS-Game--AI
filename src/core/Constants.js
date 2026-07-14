// 全局常量
export const PLAYER = {
  HEIGHT: 1.7,
  CROUCH_HEIGHT: 1.0,
  SPEED: 5,
  SPRINT_SPEED: 8,
  CROUCH_SPEED: 2.5,
  JUMP_FORCE: 10,       // 跳跃力
  MAX_HEALTH: 100,
  RADIUS: 0.4
};

export const PHYSICS = {
  GRAVITY: -20,
  FIXED_TIMESTEP: 1 / 60
};

export const WEAPONS = {
  KNIFE: {
    name: '屠龙',
    damage: 55,
    headshotDamage: 100,
    range: 3,
    coneAngle: 60,        // 挥砍检测锥形半角(度)，前方±30°内的敌人均可命中
    fireRate: 500,
    slot: 3,
    auto: false,
    // 真实模型 NI_3.glb 已拆成两部件，各自独立的 size/rot/pos，可分别微调
    // match: 按 mesh 名/节点名匹配对应部件；size=归一化最长边; pos=[右,上,前]; rot=[x,y,z]
    model: {
      path: '/models/NI_3.glb',
      parts: [
        // 左手(张开的手/前臂) mesh "tripo_mesh_..."
        { match: 'tripo_mesh', size: 0.2, pos: [-0.3, -0.4, -0.55], rot: [1, -1.8, 1] },
        // 刀身+握持手 mesh "Mesh_1"
        { match: 'Mesh_1', size: 0.72, pos: [0.3, -0.35, -0.62], rot: [0, -1.8, -0.6] },
      ],
    },
    // 挥砍动画：仅动"刀身+握持手"部件，绕手腕轴旋转(刀尖行程大、手臂行程小)；左手永不动
    // 相位1(蓄力): 刀尖上抬回拉；相位2(挥砍): 刀尖斜向前劈下；相位3: 回位
    attack: {
      duration: 420,        // 总时长(ms)
      pivotFrac: [0.85, 0.15, 0.5], // 手腕轴位置[fx,fy,fz] 部件包围盒内占比(0=min,1=max)；握把在右下角
      windupT: 0.28,        // 相位1结束占比
      slashT: 0.6,          // 相位2结束占比
      windupAngle: 0.45,    // 相位1 屏幕内滚转-刀尖向左下(rad, +z 逆时针)
      slashAngle: -0.55,    // 相位2 刀尖向右上(rad)
      windupPitch: 0.35,    // 相位1 俯仰-刀尖上抬(rad, +x 前倾/抬头)
      slashPitch: -0.65,    // 相位2 俯仰-刀尖前劈(rad, -x 前俯/劈下)
      windupShift: [-0.02, -0.03, 0.01], // 相位1 部件小幅位移[右,上,前]
      slashShift: [0.05, 0.06, -0.02],   // 相位2 部件位移[右,上,前]
    },
  },
  PISTOL: {
    name: '沙鹰-修罗',
    damage: 35,
    headshotDamage: 95,
    range: 100,
    fireRate: 240,
    magSize: 15,
    reserveAmmo: 20,
    reloadTime: 800,
    recoil: 0.1,
    adsFov: 45,                 // 右键开镜视野（手枪放大幅度较小）
    adsPos: [0.02, -0.09, -0.38],  // 开镜时武器靠右下
    adsScale: 0.62,             // 开镜时缩小显示（<1 变小）
    muzzleOffset: [0.16, 0.20, 0.62], // 枪口特效偏移 [右, 下, 前]（手枪：更靠下、更近）
    muzzleOffsetAds: [0.03, 0.10, 2.1], // 开镜时的枪口偏移（靠近准星中心）
    slot: 2,
    auto: false,
    // 真实模型 XIU_2.glb（枪管沿 X 轴，枪口在 -X 端，ry=-90°使枪口朝屏幕内）
    model: { path: '/models/XIU_2.glb', size: 0.26, pos: [0.17, -0.25, -0.40], rot: [0, -Math.PI / 2, 0] },
  },
  SNIPER: {
    name: '幻神-狙击枪',
    damage: 100,                // 命中身体接近一击
    headshotDamage: 300,        // 爆头必杀
    range: 300,
    fireRate: 1000,             // 栓动式，射速慢
    magSize:5,
    reserveAmmo: 20,
    reloadTime: 3000,
    recoil: 1.0,               // 后坐力极大，一枪猛抬枪（约 25°），需重新拉回镜子
    adsFov: 10,                 // 右键开镜视野（狙击枪放大幅度最大，越小越放大：75/10 ≈ 7.5×）
    adsPos: [0.15, -0.20, -0.45],  // 开镜时武器抵近瞳孔位置
    muzzleOffset: [0.08, 0.12, 2], // 枪口特效偏移 [右, 下, 前]（枪管长）
    muzzleOffsetAds: [0.08, 0.1, 0.9],
    slot: 4,
    auto: false,
    scoped: true,               // 开镜时显示狙击镜黑边视野，且射击后自动退镜；未开镜无准星
    // 真实模型 HUAN_4.glb（枪管沿 X 轴，枪口在 -X 端，ry=-90°使枪口朝屏幕内）
    model: { path: '/models/HUAN_4.glb', size: 0.5, pos: [0.15, -0.22, -0.45], rot: [-0.1, -1.45, 0.2] },
  },
  RIFLE: {
    name: 'AK47-火麒麟',
    damage: 50,
    headshotDamage: 150,
    range: 200,
    fireRate: 100,
    magSize: 40,
    reserveAmmo: 50,
    reloadTime: 2000,
    recoil: 0.2,
    adsFov: 38,                 // 右键开镜视野（步枪放大幅度较大）
    adsPos: [0.15, -0.20, -0.45],  // 开镜时武器抵近瞳孔位置
    muzzleOffset: [0.08, 0.12, 0.8], // 枪口特效偏移 [右, 下, 前]（步枪：枪管长、更靠前）
    muzzleOffsetAds: [0.08, 0.1, 0.8], // 开镜时的枪口偏移（靠近准星中心）
    slot: 1,
    auto: true,
    // 真实模型 HUO_1.glb（枪管沿 X 轴，枪口在 -X 端，ry=-90°使枪口朝屏幕内）
    model: { path: '/models/HUO_1.glb', size: 0.42, pos: [0.15, -0.20, -0.45], rot: [0, -Math.PI / 2, 0] },
  }
};

export const ENEMY = {
  HEALTH: 100,
  SPEED: 7,               // 常规移动速度（比玩家更快，增加压力）
  SPRINT_SPEED: 10,       // 冲刺速度
  CROUCH_SPEED: 2.5,      // 蹲行速度
  JUMP_FORCE: 10,        // 与玩家一致
  DETECTION_RANGE: 40,
  ATTACK_RANGE: 25,
  STRAY_DISTANCE: 4,       // 近身游走阈值：距玩家4m内不再冲锋，改为绕行游走
  FIRE_RATE: 800,
  DAMAGE: 10,
  INITIAL_COUNT: 5,       // 首波同时出生数量
  MAX_ALIVE: 5,           // 首波同时存活数量（不再作为场上硬性上限）
  TOTAL_FORCE: 20,        // 全场总兵力（=通关需击杀数）
  RESPAWN_DELAY: 5000,    // 每 5s 在敌方老巢补刷一名新敌人(ms)
  RESPAWN_TIME: 3000,
  HEADSHOT_MULTIPLIER: 2.5,

  // === 视野系统 ===
  FOV_HALF: Math.PI / 4,      // 视野半角(45° = 90°总视野)
  VISION_RANGE: 50,            // 最大视野距离

  // === 弹药 ===
  AMMO: 10,                     // 每个敌人子弹数

  // === 距离等级 ===
  DIST_CLOSE: 10,              // <10m = 近距离
  DIST_MEDIUM: 35,            // 10-35m = 中距离，>35m = 远距离

  // === 命中概率(基础，静止目标) [近, 中, 远] ===
  HIT_CHANCE: [0.8, 0.55, 0.4],
  HIT_MOVE_PENALTY: 0.7,          // 玩家移动时命中率降低系数

  // === 爆头概率(命中时) ===
  HEADSHOT_CHANCE: 0.35,

  // === 伤害表 [近, 中, 远] ===
  DMG_HEADSHOT: [75, 40, 20],
  DMG_BODY:     [40, 25, 10],
};

// === 玩家生命系统 ===
export const LIVES = {
  MAX: 2,      // 总生命数
};


// 炸弹安放/拆除模式配置
export const BOMB = {
  PLANT_TIME: 3000,       // 安包耗时(ms)
  DEFUSE_TIME: 5000,      // 拆包耗时(ms)
  COUNTDOWN: 15,          // 起爆倒计时(s)
  TRIGGER_RADIUS: 2,      // 携带者抵达安包点2m内才触发安包(确保在蓝区内部)
  APPROACH_RADIUS: 14,    // 携带者进入此范围后全力冲刺安包(不再收敛混入部队)
  DEFUSE_RADIUS: 3,       // 玩家拆包有效距离
  PICKUP_RADIUS: 1.5,     // AI 拾取掉落炸弹距离
  BLINK_INTERVAL: 0.4,    // 红光闪烁周期(s)
  BASE_PLANT_RADIUS: 10, // 蓝区判定半径：携带者进入此范围即开始逗留计时
  BASE_PLANT_TIMEOUT: 3   // 蓝区逗留超时(s)：超过则原地安包(防止被障碍卡住)
};

export const COLORS = {
  GROUND: 0x5a5a3a,
  WALL: 0x8b7355,
  CONTAINER: 0x2e5090,
  CONTAINER2: 0x904020,
  SKY: 0x87ceeb,
  PLAYER: 0x4488ff,
  ENEMY: 0xff4444,
  MUZZLE_FLASH: 0xffaa00
};
