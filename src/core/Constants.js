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
    range: 4,
    fireRate: 500,
    slot: 3,
    auto: false,
  },
  PISTOL: {
    name: '沙鹰-修罗',
    damage: 25,
    headshotDamage: 75,
    range: 100,
    fireRate: 300,
    magSize: 15,
    reserveAmmo: 20,
    reloadTime: 1000,
    recoil: 0.02,
    adsFov: 45,                 // 右键开镜视野（手枪放大幅度较小）
    adsPos: [0.05, -0.11, -0.40],  // 开镜时武器靠右下
    adsScale: 0.62,             // 开镜时缩小显示（<1 变小）
    muzzleOffset: [0.20, 0.27, 0.62], // 枪口特效偏移 [右, 下, 前]（手枪：更靠下、更近）
    muzzleOffsetAds: [0.03, 0.10, 0.62], // 开镜时的枪口偏移（靠近准星中心）
    slot: 2,
    auto: false,
  },
  RIFLE: {
    name: 'AK47-火麒麟',
    damage: 34,
    headshotDamage: 100,
    range: 200,
    fireRate: 100,
    magSize: 40,
    reserveAmmo: 50,
    reloadTime: 2000,
    recoil: 0.035,
    adsFov: 38,                 // 右键开镜视野（步枪放大幅度较大）
    adsPos: [0, -0.05, -0.38],  // 开镜时武器抵近瞳孔位置
    muzzleOffset: [0.11, 0.16, 0.8], // 枪口特效偏移 [右, 下, 前]（步枪：枪管长、更靠前）
    muzzleOffsetAds: [0.0, 0.06, 0.8], // 开镜时的枪口偏移（靠近准星中心）
    slot: 1,
    auto: true,
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
