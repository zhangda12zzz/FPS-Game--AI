// 全局常量
export const PLAYER = {
  HEIGHT: 1.7,
  CROUCH_HEIGHT: 1.0,
  SPEED: 5,
  SPRINT_SPEED: 8,
  CROUCH_SPEED: 2.5,
  JUMP_FORCE: 6,
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
    range: 2.5,
    fireRate: 500,
    slot: 3,
    auto: false
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
    adsFov: 58,                 // 右键开镜视野（手枪放大幅度较小）
    adsPos: [0, -0.13, -0.26],  // 开镜时武器向中心、抵近瞳孔位置
    slot: 2,
    auto: false
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
    adsFov: 50,                 // 右键开镜视野（步枪放大幅度较大）
    adsPos: [0, -0.14, -0.30],  // 开镜时武器向中心、抵近瞳孔位置
    slot: 1,
    auto: true
  }
};

export const ENEMY = {
  HEALTH: 100,
  SPEED: 5,               // 与玩家 PLAYER.SPEED 一致
  SPRINT_SPEED: 8,        // 与玩家一致
  CROUCH_SPEED: 2.5,      // 与玩家一致
  JUMP_FORCE: 6,          // 与玩家一致
  DETECTION_RANGE: 40,
  ATTACK_RANGE: 25,
  FIRE_RATE: 800,
  DAMAGE: 10,
  INITIAL_COUNT: 5,       // 首波同时出生数量
  MAX_ALIVE: 5,           // 首波同时存活数量（不再作为场上硬性上限）
  TOTAL_FORCE: 20,        // 全场总兵力（=通关需击杀数）
  RESPAWN_DELAY: 5000,    // 每 5s 在敌方老巢补刷一名新敌人(ms)
  RESPAWN_TIME: 3000,
  HEADSHOT_MULTIPLIER: 2.5
};

// 炸弹安放/拆除模式配置
export const BOMB = {
  PLANT_TIME: 3000,       // 安包耗时(ms)
  DEFUSE_TIME: 5000,      // 拆包耗时(ms)
  COUNTDOWN: 15,          // 起爆倒计时(s)
  TRIGGER_RADIUS: 6,      // 携带者进入玩家老家触发安包的距离
  DEFUSE_RADIUS: 3,       // 玩家拆包有效距离
  PICKUP_RADIUS: 1.5,     // AI 拾取掉落炸弹距离
  BLINK_INTERVAL: 0.4     // 红光闪烁周期(s)
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
