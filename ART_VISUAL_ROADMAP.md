# MOVA 美术与视觉特效开发路线

> 基础系统完成后，按此文档推进美术资源优化。

---

## 一、美术架构总览

| 层级 | 技术方案 | 说明 |
|------|---------|------|
| **角色/怪物/Boss** | Aseprite → 精灵表 PNG | 手绘像素风，数量少、辨识度高 |
| **弹幕/粒子/特效** | Phaser Canvas 程序化渲染 | 数量大、颜色动态映射职业色 |
| **技能动画帧** | Aseprite → 精灵表 PNG | 挥砍、施法、受击等动作 |
| **UI** | React + CSS / SVG | 已有架构 |
| **碰撞判定** | Phaser 数学碰撞（圆形/扇形） | 与视觉完全解耦 |

### 核心原则

- **视觉与碰撞分离**：显示用精灵/Canvas 绘制，判定用简化几何体（圆、矩形、扇形）
- **最小化美术资源 + 最大化程序生成**：角色手绘，特效程序化
- 所有弹幕颜色由 `classColors.js` 统一驱动，支持双职业混色

---

## 二、Aseprite 工作流

### 角色/怪物精灵表

```
1. Aseprite 中绘制帧动画（如 idle 1帧, walk 6-14帧, attack 4-6帧）
2. 统一画布大小（当前 64×64，可按需调整为 128×128）
3. 导出为水平排列精灵表 PNG（含 spacing 参数）
4. Phaser 加载为 spritesheet
```

```javascript
// 加载
this.load.spritesheet('warrior_slash', 'assets/characters/warrior/slash.png', {
  frameWidth: 128, frameHeight: 128, spacing: 4
});

// 创建动画
this.anims.create({
  key: 'slash',
  frames: this.anims.generateFrameNumbers('warrior_slash', { start: 0, end: 5 }),
  frameRate: 15,
  repeat: 0
});
```

### 现有参考

- Deluyi：64×64 精灵表，16格网格，`flipX` 镜像左右朝向，显示缩放 1.6x
- 备用方案（Any/Archer）：8方向×8帧独立 PNG（已弃用）

### 资产清单（待制作）

| 资产 | 尺寸 | 帧数 | 状态 |
|------|------|------|------|
| 玩家角色（6职业皮肤） | 64×64 | idle 1 + walk 6-14 + attack 4 + hurt 2 | 待定 |
| Stage 1 Boss | 128×128 或更大 | idle + attack + phase变化 | 待定 |
| Stage 2 Boss | 128×128 或更大 | 同上 | 待定 |
| Stage 3 Boss | 128×128 或更大 | 同上 | 待定 |
| 小怪 (TestMinion 替换) | 32×32 或 48×48 | idle + walk + death | 待定 |
| 地图背景 | 720×1280 | 静态/微动 | 待定 |

---

## 三、Canvas 程序化特效 — 当前状态

### 已有效果清单

| 效果 | 文件 | 实现方式 |
|------|------|---------|
| 箭矢（多层描边+高光+羽毛） | BulletManager.js | Canvas 预渲染纹理 88×40px |
| 激光（双层 Graphics + 充能环） | laser.js | Graphics 实时绘制 |
| 星落（7粒子星形散射+冲击波） | starfall.js | 粒子爆发 |
| 毒圈（半透明扩张+描边） | warlockPoisonNova.js | 扩张圆形叠层 |
| 充能环 | VfxSystem.playCharge() | 描边环外扩 |
| 释放闪光 | VfxSystem.playCastFlash() | 白色圆 + ADD 混合 |
| 命中火花 | VfxSystem.playHit() | 粒子爆散 |
| 爆炸环 | VfxSystem.playBurst() | 环形快速扩张 |
| 地面预警（圆/线） | VfxSystem.playGroundTelegraph/LineTelegraph() | 脉动描边 |
| 闪屏 | VfxSystem.flashScreen() | Camera flash |
| 拖尾系统 | BulletManager.js | 对象池，最多200粒子 |

### Canvas 效果的美感上限

| 层级 | 技术手段 | 示例 |
|------|---------|------|
| 基础 | fillRect/fillCircle | 纯色形状 |
| 中等 | 分层绘制 + alpha 混合 | 当前箭矢 |
| 优秀 | Blend Mode (ADD) + tween + 对象池 | 当前 VfxSystem |
| 顶级 | WebGL PostFX Pipeline + 自定义 Shader | ← **下一步目标** |

---

## 四、视觉升级 — Phaser 内置功能（零额外依赖）

### 优先级 1：PostFX Pipeline（最大提升点）

Phaser 3.60+ 内置，直接给任何 GameObject 加后处理。

```javascript
// 弹幕发光 —— 一行代码
bullet.postFX.addGlow(0xff3b2f, 4, 0, false, 0.1, 24);

// 全屏泛光
this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.6);

// 低血量暗角
this.cameras.main.postFX.addVignette(0.5, 0.5, 0.3);

// 受击色偏
this.cameras.main.postFX.addColorMatrix().saturate(1.5);

// Boss 大招释放桶形畸变
boss.postFX.addBarrel(0.6);

// 充能完成流光
chargingObj.postFX.addShine(0.5, 0.5, 5);

// UI 弹出时背景虚化
this.cameras.main.postFX.addBokeh(0.5, 10, 0.2);
```

**可用 PostFX 完整清单：**

| PostFX | 用途 | 弹幕游戏场景 |
|--------|------|------------|
| `addGlow()` | 外发光 | 弹幕自带光晕 |
| `addBloom()` | 泛光溢出 | 全屏弹幕密集时发光渗透 |
| `addShadow()` | 投影 | 飞行弹幕的地面阴影 |
| `addShine()` | 流光扫过 | 充能完成时光泽闪过 |
| `addGradient()` | 渐变叠加 | 毒圈中心到边缘颜色过渡 |
| `addBarrel()` | 桶形畸变 | Boss 大招释放瞬间扭曲 |
| `addWipe()` | 擦除过渡 | 场景切换 |
| `addColorMatrix()` | 色彩矩阵 | 受伤变红、中毒变绿、时停去色 |
| `addBokeh()` | 景深模糊 | UI 弹出时背景虚化 |
| `addVignette()` | 暗角 | 低血量屏幕边缘变暗 |
| `addDisplacement()` | 置换贴图 | 热浪/水波扭曲 |

### VfxSystem 扩展建议

```javascript
// VfxSystem.js 中新增辅助方法
applyGlow(gameObject, color, strength = 4) {
  if (gameObject?.postFX) {
    gameObject.postFX.addGlow(color, strength, 0, false, 0.1, 24);
  }
  return gameObject;
}
```

### 优先级 2：Phaser Particle Emitter

替代当前手动创建 Circle + tween 的粒子方案，性能更好。

```javascript
// 命中爆炸粒子（需要一个 4×4 白色小图 'flare'）
const emitter = this.add.particles(x, y, 'flare', {
  speed: { min: 80, max: 200 },
  scale: { start: 0.6, end: 0 },
  alpha: { start: 0.9, end: 0 },
  tint: [0xff3b2f, 0xffcc88, 0xffd26a],
  blendMode: 'ADD',
  lifespan: 300,
  quantity: 12,
  emitting: false
});
emitter.explode(12);

// 弹幕拖尾（替代手动 trail 系统）
const trailEmitter = this.add.particles(0, 0, 'flare', {
  follow: bullet,
  scale: { start: 0.4, end: 0 },
  alpha: { start: 0.7, end: 0 },
  tint: CLASS_COLORS.mage,
  blendMode: 'ADD',
  lifespan: 200,
  frequency: 30
});
```

**优势：** GPU 批量渲染，弹幕密集时比逐个创建/销毁 Circle 对象高效得多。

### 优先级 3：Camera 全局效果

```javascript
// 命中震屏
this.cameras.main.shake(80, 0.005);

// Boss 登场全屏闪白
this.cameras.main.flash(200, 255, 255, 255);

// 时停效果（命中反馈 hitlag）
this.time.timeScale = 0.1;
this.time.delayedCall(100, () => this.time.timeScale = 1);
```

### 优先级 4：自定义 WebGL Shader Pipeline

当内置 PostFX 不够时，手写 GLSL：

```javascript
class ShockwavePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({ game, fragShader: `
      precision mediump float;
      uniform sampler2D uMainSampler;
      uniform vec2 uCenter;
      uniform float uTime;
      uniform float uRadius;
      varying vec2 outTexCoord;
      void main() {
        vec2 uv = outTexCoord;
        float dist = distance(uv, uCenter);
        if (dist < uRadius && dist > uRadius - 0.05) {
          float diff = dist - uRadius;
          uv += normalize(uv - uCenter) * diff * 0.5;
        }
        gl_FragColor = texture2D(uMainSampler, uv);
      }
    `});
  }
}
// 注册后 → Boss 死亡时触发冲击波扭曲
```

---

## 五、推荐的外部依赖

| 库 | 体积 | 用途 | 推荐度 |
|----|------|------|-------|
| `simplex-noise` | ~3KB | 弹幕飘动、呼吸光效、有机运动 | ✅ 推荐 |
| `pixi-filters` | — | Phaser 3 底层不是 PixiJS，不兼容 | ❌ |
| `GSAP / anime.js` | — | Phaser 自带 tween 已够用，冗余 | ❌ |
| `chroma-js` | — | 现有 `lerpColor` 已够用 | ❌ |

### simplex-noise 用法

```bash
npm install simplex-noise
```

```javascript
import { createNoise2D } from 'simplex-noise';
const noise = createNoise2D();

// 弹幕飘动路径（比 Math.sin 自然得多）
bullet.x += noise(bullet.x * 0.01, time * 0.002) * 2;

// Boss 呼吸光效脉动
const glowStrength = 4 + noise(0, time * 0.003) * 2; // 4±2 自然波动
```

---

## 六、实施顺序

```
Phase 1 — 基础美术替换（Aseprite）
  ├── 玩家角色精灵表（替换 Deluyi 占位）
  ├── Boss 精灵表（替换圆形占位）
  ├── 小怪精灵表（替换 TestMinion 占位）
  └── 地图背景

Phase 2 — 特效基础提升（PostFX + Particle）
  ├── 引入 PostFX Glow：弹幕 + Boss 技能自动发光
  ├── 引入 PostFX Bloom：全屏泛光
  ├── 用 Particle Emitter 替代手动 trail 系统
  ├── 生成 'flare' 纹理（4×4 白色点，PreloadScene 中 generateTexture）
  └── VfxSystem 扩展 applyGlow() 辅助方法

Phase 3 — 游戏感反馈（Camera + Hitlag）
  ├── Camera shake（命中震屏）
  ├── Camera flash（Boss 登场/大招）
  ├── Hitlag 时停（击杀/暴击瞬间）
  ├── PostFX Vignette（低血量暗角）
  └── PostFX ColorMatrix（中毒/燃烧色偏）

Phase 4 — 高级视觉（Shader + Noise）
  ├── 安装 simplex-noise，弹幕有机运动
  ├── 自定义 Shader：Boss 死亡冲击波
  ├── PostFX Displacement：热浪/水波
  └── PostFX Bokeh：UI 弹出背景虚化

Phase 5 — 打磨
  ├── 技能动画帧（Aseprite 挥砍/施法）
  ├── 颜色方案微调（配色、层次感）
  └── 性能测试与优化（粒子数上限、PostFX 开关）
```

---

## 七、颜色系统（已有，供美术参考）

```javascript
// src/classes/visual/classColors.js
CLASS_COLORS = {
  warrior:  0xff3b2f,  // 红
  paladin:  0xffd26a,  // 金
  mage:     0x0b3d91,  // 普鲁士蓝
  warlock:  0xcc00ff,  // 荧光紫
  druid:    0x88ffef,  // 淡青
  archer:   0x1f5f34   // 深绿
}

// src/classes/visual/basicSkillColors.js — 自动衍生配色
getBasicSkillColorScheme(mainCore, offCore) → {
  coreColor, coreBright, accentColor, glowColor, trailColor
}
```

所有 Aseprite 美术资源和 Canvas 程序化效果应基于此色板进行设计。

---

## 八、关键技术约束

- 目标平台：**移动端为主**，720×1280 固定视口，FIT 缩放
- 渲染器：`Phaser.AUTO`（优先 WebGL，降级 Canvas2D）
- PostFX 仅 WebGL 模式可用（绝大多数现代设备支持）
- 粒子数量需控制上限，移动端性能敏感
- 所有效果应提供降级方案（低端设备关闭 PostFX / 减少粒子数）
