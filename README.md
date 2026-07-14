# CF-FPS 穿越火线风格第一人称射击游戏

一款基于 **Three.js** 与 **cannon-es** 构建的纯前端 3D FPS 游戏，灵感来源于经典 FPS《穿越火线》（CF）。

项目全部用原生 JavaScript（ES Modules）编写，不依赖 React/Vue 等框架，聚焦于“第一人称战斗体验”本身——真实 GLB 武器模型、开镜放大、爆头反馈、C4 炸弹模式、多地图切换、CF 风格 HUD 等核心玩法。

> 🎮 直接在浏览器中运行，无需服务端。
<div align="center">

<img src="README/image/image-2.png" width="48%">
<img src="README/image/image-3.png" width="48%">

<img src="README/image/image-4.png" width="48%">
<img src="README/image/image-6.png" width="48%">

<img src="README/image/image-9.png" width="48%">
<img src="README/image/image-8.png" width="48%">

<img src="README/image/image.png" width="48%">
<img src="README/image/image-1.png" width="48%">

</div>
---

## 📖 目录

- [特性](#-特性)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [操作与玩法](#-操作与玩法)
- [核心系统说明](#-核心系统说明)
- [资源目录](#-资源目录)
- [构建与部署](#-构建与部署)
- [开发建议](#-开发建议)
- [License](#-license)

---

## ✨ 特性

- **第一人称视角**：Pointer Lock + WASD 移动 + 鼠标视角
- **CF 风格四神器**：AK47-火麒麟（步枪）/ 沙鹰-修罗（手枪）/ 屠龙（近战）/ 幻神-狙击枪
- **真实 GLB 武器模型**：`GLTFLoader` 预加载 `HUO_1/XIU_2/NI_3/HUAN_4.glb`，切枪克隆复用；加载失败自动回退绿幕平面
- **绿幕抠图着色器**：`ChromaKeyMaterial`（自定义 GLSL）作为武器贴图与击杀视频的透明方案
- **右键开镜（ADS）**：FOV 平滑插值 + 武器位置/缩放插值（腰射 ↔ 开镜），狙击枪独立狙击镜黑边
- **敌人 AI**：`enemy.glb` 真实模型 + 视野锥（±45°）+ 距离分档命中率/伤害表 + 路径寻找 + F2 可开关攻击
- **敌人分批增援**：首波 5 人 → 每 5s 在敌方老巢补刷 1 名，直至全场击杀 20 名兵力
- **多地图 & 选图界面**：`MapRegistry` 注册地图，启动即选图（当前内置"经典 运输船"和"田字格 冰世界"）
- **C4 炸弹模式**：安放 / 拆除 / 倒计时 + 爆炸白屏闪光 + 镜头震动
- **多命系统**：玩家默认 2 条命，全部耗尽才判负
- **击杀反馈**：CF 连杀语音播报（2kill ~ 8kill）+ 绿幕抠图击杀视频
- **爆头机制**：独立音效 + 红色大字体 + 专属视频
- **音效全链路**：BGM / 脚步 / 换弹 / 射击 / 爆炸，Howler.js + WebAudio
- **总音量滑块**：持久化 `localStorage`，范围 0 ~ 200%
- **暂停系统**：HUD 暂停按钮 / ESC / Pointer Lock 丢失自动暂停
- **HUD & UI**：小地图 / 计分板 / 击杀播报 / 伤害数字 / 受伤红框 / 换弹进度条 / 拆包进度条
- **CF 风格**：神器命名、UI 配色、击杀播报风格均贴近原版 CF

---

## 🛠 技术栈

| 层        | 技术                          | 说明                                |
|-----------|-------------------------------|-------------------------------------|
| 渲染      | `three.js` ^0.160             | WebGLRenderer / PerspectiveCamera / 阴影 |
| 物理      | `cannon-es` ^0.20             | 角色刚体 / 射线检测 / 碰撞判定      |
| 音频      | `howler` ^2.2                 | 多实例混音 / Sprite / 3D 空间音效   |
| 构建      | `vite` ^5.0                   | HMR 热更新 / ES Modules             |
| 语言      | 原生 ES2022 Modules           | 无 TypeScript / 无框架              |
| 着色器    | GLSL                          | 绿幕抠图（ChromaKeyMaterial）       |

---

## 📁 项目结构

```
FpsGame/
├── index.html                 # 入口页面 + CF 风格 HUD + 选图界面 + 全部 CSS
├── package.json
├── vite.config.js             # Vite 构建配置
├── public/                    # 静态资源（Vite 直接拷贝）
│   ├── models/                # GLB 模型：HUO_1/XIU_2/NI_3/HUAN_4/enemy.glb
│   ├── images/                # 武器绿幕贴图（回退方案）：HUO_1 / XIU_2 / Ni3 / JU_4 / TU_3
│   ├── textures/              # 程序化或预生成贴图
│   ├── skybox/                # 天空盒贴图
│   ├── sounds/                # BGM、脚步声、换弹、CF 连杀语音
│   └── video/                 # 绿幕击杀视频（cf_1kill ~ cf_8kill / headshot / kinfe）
└── src/
    ├── main.js                # 启动入口：开始画面 / 选图界面 / 音量滑块 / 暂停 / Pointer Lock
    ├── core/
    │   ├── Game.js            # 游戏主循环、HUD、回合、重置、选图/切图切换
    │   ├── SceneManager.js    # Three.js 场景 / 相机 / 灯光 / 渲染器
    │   ├── Physics.js         # cannon-es 世界、射线检测、角色刚体
    │   ├── Input.js           # 键盘 / 鼠标 / 鼠标滚轮
    │   ├── AudioFx.js         # Howler 音效封装（BGM / 射击 / 换弹 / 击杀）
    │   ├── Constants.js       # 武器配置、敌人参数、多命 LIVES、物理常量
    │   └── EventBus.js        # 全局事件总线
    ├── player/
    │   ├── PlayerController.js# 第一人称控制：移动 / 跳跃 / 冲刺 / 下蹲
    │   └── Health.js          # 生命值与受伤处理
    ├── weapons/
    │   ├── Weapon.js          # 武器基类
    │   ├── WeaponManager.js   # 切枪 / 开镜插值 / 武器晚动
    │   ├── WeaponModels.js    # GLB 武器模型预加载 + 克隆构建（单件/多部件）
    │   └── arsenal/
    │       ├── Rifle.js       # AK47-火麒麟（HUO_1.glb，回退绿幕平面）
    │       ├── Pistol.js      # 沙鹰-修罗（XIU_2.glb）
    │       ├── Knife.js       # 屠龙（NI_3.glb，多部件挥砍动画）
    │       └── Sniper.js      # 幻神-狙击枪（HUAN_4.glb，专属狙击镜）
    ├── enemies/
    │   ├── Enemy.js           # 单个敌人：enemy.glb 模型 / 视野锥 / 命中概率表 / 行走动画
    │   ├── EnemyManager.js    # 敌人生成、分批增援、死亡管理
    │   └── Pathfinder.js      # 简易寻路
    ├── modes/
    │   └── BombManager.js     # C4 安放 / 拆除 / 爆炸
    ├── effects/
    │   ├── MuzzleFlash.js     # 枪口闪光
    │   └── ParticleManager.js # 粒子系统（弹壳 / 血花 / 弹道 等统一接入）
    ├── map/
    │   ├── MapLoader.js       # 地图基类：地面 / 墙 / 碰撞体工厂
    │   ├── MapRegistry.js     # 地图注册表（新增地图在此追加）
    │   ├── Map_Transport.js   # 经典运输船地图
    │   └── Map_IceWorld.js    # 田字格冰世界地图（CS1.6 fy_iceworld 风格）
    ├── ui/
    │   └── KillVideo.js       # 绿幕击杀视频播放（透明抠图）
    └── utils/
        ├── ChromaKeyMaterial.js # 绿幕抠图 ShaderMaterial
        └── TextureGen.js        # 程序化纹理生成
```

---

## 🚀 快速开始

### 前置要求

- Node.js >= 16（推荐 18+）
- npm >= 8

### 安装与启动

```bash
# 1. 克隆仓库
git clone <repo-url>
cd FpsGame

# 2. 安装依赖
npm install

# 3. 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

### 构建生产版本

```bash
npm run build    # 输出到 dist/
npm run preview  # 本地预览构建产物
```

> ⚠️ 注意：`public/sounds/`、`public/video/` 中包含大体积音频/视频文件，建议使用 Git LFS 管理。

---

## 🎮 操作与玩法

| 操作            | 按键         | 说明                            |
|-----------------|--------------|---------------------------------|
| 移动            | `W / A / S / D` | 前后左右                        |
| 视角            | 鼠标         | Pointer Lock                    |
| 射击            | 鼠标左键     | 长按步枪自动连射                |
| 开镜（ADS）     | 鼠标右键     | 长按开镜 / 短按点击锁定切换；狙击枪开镜后自动退镜    |
| 跳跃            | `Space`      |                                 |
| 冲刺            | `Shift`      |                                 |
| 下蹲            | `Ctrl`       |                                 |
| 切换主武器      | `1`          | AK47-火麒麟                     |
| 切换副武器      | `2`          | 沙鹰-修罗                       |
| 切换近战        | `3`          | 屠龙                          |
| 切换狙击枪      | `4`          | 幻神-狙击枪                     |
| 换弹            | `R`          | 显示换弹进度条                  |
| 拆除炸弹        | `E`          | 靠近 C4 按住                    |
| 计分板          | `Tab`        | 长按显示                        |
| 暂停/继续       | `ESC` 或 HUD 暂停按钮 | Pointer Lock 丢失同样自动暂停 |
| 开关敌人攻击    | `F2`         | 默认关闭（安全模式）            |
| 回选图界面      | `F5`         | 清理当前局面并返回地图选择    |

### 游戏流程

1. **主界面** → 点击"开始游戏"
2. **选图界面**：当前提供两张地图卡片
   - **经典 运输船**：CF 经典长条地图（80m），多集装箱掩体，炸弹模式默认地图
   - **田字格 冰世界**：CS1.6 fy_iceworld 风格，正方形 48m，十字隔墙分四象限
3. **游戏中**：`F5` 随时回到选图界面切换地图

### 游戏模式

- **默认模式**：击杀全部敌人（总兵力 20 名，首波 5 人，每 5s 在敌方老巢补刷 1 名）获胜
- **C4 炸弹模式**：敌人安放 C4 → 倒计时 15s → 玩家需击杀携包者或拆除
  - 成功拆除或全部歼灭 → 胜利
  - C4 爆炸或玩家死亡 → 失败（爆炸瞬间白屏 + 镜头震动）
- **多命机制**：玩家默认 2 条命，全部耗尽才判负

---

## 🔍 核心系统说明

### 1. 武器模型系统（GLB 主方案 + 绿幕回退）

`WeaponModels.js` 使用 `GLTFLoader` **预加载四把武器模型**，并缓存为模板（`RIFLE/PISTOL/KNIFE/SNIPER`）：

```js
const PATHS = {
  RIFLE:  '/models/HUO_1.glb',   // AK47-火麒麟
  PISTOL: '/models/XIU_2.glb',   // 沙鹰-修罗
  KNIFE:  '/models/NI_3.glb',    // 屠龙
  SNIPER: '/models/HUAN_4.glb',  // 幻神-狙击枪
};
```

- **单件构建** `buildWeaponMesh(key, cfg)`：包围盒居中 → 最长边归一化到 `cfg.size` → 方向 `rot` + 位置 `pos`（相对相机）
- **多部件构建** `buildWeaponMeshParts(key, parts)`：将 GLB 内多个 mesh 分别居中归一化（例如屠龙将"刷手"与"刀身+握持手"拆为两部件，支持挥砍动画单独驱动刀身）
- **回退方案**：任一模型加载失败，对应武器自动回退到 `PlaneGeometry + ChromaKeyMaterial` 绿幕平面

### 2. 绿幕抠图着色器（`ChromaKeyMaterial`）

`src/utils/ChromaKeyMaterial.js` 提供 `createChromaKeyMaterial(url, options)`，用于武器回退平面与击杀视频的透明处理：

```glsl
// fragment shader 核心
float greenDiff = color.g - max(color.r, color.b);
if (greenDiff > threshold) discard;
color.g = min(color.g, max(color.r, color.b) + spillReduction);
```

效果：绿幕被自动透明化，前景保留，且保留原图的发光/高光效果。

### 3. 开镜插值系统（ADS）

`WeaponManager.update(dt)` 每帧驱动：

- `aimT`：0（腰射）↔ 1（完全开镜），以 `dt * 14` 平滑插值
- 位置：`hipPos` ↔ `adsPos`
- 缩放：`scale 1` ↔ `adsScale`（手枪 0.62 / 步枪 0.85 等）
- FOV：`baseFov 75` ↔ `weapon.config.adsFov`（手枪 45 / 步枪 38 / 狙击枪 18）
- **狙击枪专属**：开镜时叠加狙击镜黑边与十字分划，开火后自动退镜，后坐力使镜头抬高约 25°

切枪时**重置 mesh.scale = 1**，避免开镜残留缩放导致切换后"闪一下特别大"。

### 4. 敌人 AI（`Enemy.js` / `EnemyManager.js`）

- **真实模型**：预加载 `enemy.glb`，失败回退程序化人形
- **状态机**：`IDLE / PATROL / CHASE / ATTACK / STRAY / DEAD`
- **视野锥**：前方 ±45°（`FOV_HALF`）/ 最大 50m（`VISION_RANGE`）
- **命中模型**：按距离分 近(<10m)/中(10-35m)/远(>35m) 三档，命中率 `[0.8, 0.55, 0.4]`，玩家移动时再 ×0.7
- **伤害表**：爆头 `[75, 40, 20]` / 身体 `[40, 25, 10]`，爆头率 35%
- **分批增援**：首波 5 人 → 每 5s 补刷 1 名 → 直至总兵力 20 名击杀完毕
- **F2** 开关敌人开火（默认关，方便演示）
- **爆头反馈**：爆头伤害倍率 ×2.5，触发专属爆头视频 + 音效

### 5. 多地图与选图系统

`MapRegistry.js` 集中声明所有地图，新增地图仅需：

1. 在 `src/map/` 下新建一个继承 `MapLoader` 的地图类
2. 在 `MAP_REGISTRY` 数组追加一项 `{ id, name, desc, loader }`

`main.js` 启动时自动渲染卡片选图界面；游戏中 `F5` 可随时回到选图界面切换地图（`Game.js` 会清理旧世界并重置敌人/玩家/炸弹状态）。

### 6. 击杀反馈

`KillVideo.js` 在画面中央上方叠加一个 `<canvas>` 播放绿幕抠图视频：

- 1kill ~ 8kill：播放对应连杀视频 + CF 连杀语音
- 爆头：专属 `cf_headshot.mp4` + `headshot.wav`
- 刀杀：`cf_kinfe.mp4`

视频绿幕部分通过 2D Canvas 像素级抠图实现透明。

### 7. 音效系统（`AudioFx`）

- Howler.js 封装，支持主音量控制 `setMasterVolume(0 ~ 2)`
- 所有音效按事件命名：`shoot` / `reload` / `step` / `bomb` / `headshot` / `kill_N`
- 总音量滑块 `0 ~ 200%`，自动保存到 `localStorage.fps_master_volume`

---

## 📦 资源目录

| 路径                  | 说明                                                   |
|-----------------------|--------------------------------------------------------|
| `public/models/`      | GLB 武器模型与敌人模型：`HUO_1.glb`（AK）/ `XIU_2.glb`（手枪）/ `NI_3.glb`（屠龙）/ `HUAN_4.glb`（狙击枪）/ `enemy.glb` |
| `public/images/`      | 武器绿幕贴图（回退方案）：`HUO_1.png` / `XIU_2.png` / `Ni3.png` / `JU_4.png` / `TU_3.png` |
| `public/textures/`    | 程序化或预生成贴图                                    |
| `public/skybox/`      | 天空盒贴图                                                |
| `public/sounds/`      | `bgm1.mp3`、`bgm2.mp3`、`reload.mp3`、`bomb.flac`、`cf_*.wav` 等 |
| `public/video/`       | `cf_1kill.mp4` ~ `cf_8kill.mp4`、`cf_headshot.mp4`、`cf_kinfe.mp4` |

---

## 🌐 构建与部署

```bash
npm run build
# 产物输出到 dist/，可部署到任意静态托管：
# - Vercel
# - Netlify
# - GitHub Pages
# - Nginx / 腾讯云 COS / 阿里云 OSS
```

部署后访问路径即可运行。建议配置 CDN + gzip 以加速大体积音频/视频传输。

---

## 💡 开发建议

- **替换武器模型**：将新的 GLB 放到 `public/models/` 并修改 `Constants.js` 中对应武器的 `model.path` / `size` / `pos` / `rot`
- **替换绿幕回退贴图**：直接替换 `public/images/` 下的绿幕图片即可，无需改代码
- **新增武器**：在 `src/weapons/arsenal/` 加新类，继承 `Weapon`，在 `WeaponManager.init` 注册；若用 GLB 需在 `WeaponModels.js` 的 `PATHS` 追加载入
- **新增地图**：新建一个继承 `MapLoader` 的类 → 在 `MapRegistry.js` 的 `MAP_REGISTRY` 追加一项（含 `id/name/desc/loader`），选图界面会自动出新卡片
- **调整开镜手感**：修改 `Constants.js` 的 `adsFov` / `adsPos` / `adsScale`
- **调整射击参数**：`Constants.js` 的 `damage` / `headshotDamage` / `fireRate` / `recoil` / `magSize` 等
- **调整敌人难度**：`Constants.js` 的 `ENEMY.HIT_CHANCE` / `DMG_HEADSHOT` / `DMG_BODY` / `INITIAL_COUNT` / `TOTAL_FORCE` / `RESPAWN_DELAY`
- **调整多命数**：`Constants.js` 的 `LIVES.MAX`

---

## 📄 License

MIT

---

<p align="center">
  <i>Made with Three.js · cannon-es · Howler.js · Vite</i>
</p>
