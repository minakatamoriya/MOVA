# MOVA 项目状态分析与开发路线图

> 更新日期：2026-03-18 | 分析工具：Claude Opus 4.6 全量代码扫描

---

## 一、已完成的优化（本轮成果）

| # | 优化项 | 说明 |
|---|--------|------|
| ✅ | 战士武器提取 | 创建 `warriorSlash.js`，从 BuildClassMixin 提取 ~280 行近战逻辑 |
| ✅ | applyUpgrade 全 case 填充 | 新增 ~150 行：11 紧急冷却天赋 + 2 预备节点 + 18 深度专精 + 18 双职业 |
| ✅ | 旧三路线系统清理 | 废弃 `showPathChoiceUI`、移除死导入、`mapPool.js` 加废弃标注 |
| ✅ | 弹幕系统统一至 BulletCore | BaseBoss/TestMinion raw fallback 加 console.warn，metrics 追踪接入 |
| ✅ | 召唤系统统一 | 新建 `SummonRegistry.js`，PetManager + UndeadSummonManager 统一注册 |
| ✅ | CollisionManager 伤害解耦 | 提取 `resolvePlayerBulletHit` / `resolveBossBulletHitAlly` / `resolveBossBulletHitPlayer` |
| ✅ | warriorSlash 迁移至 BulletCore | 近战命中改用 `createManagedPlayerAreaBullet`，月牙改用 `createManagedPlayerBullet` |

---

## 二、当前系统完成度总览

| 系统 | 完成度 | 状态说明 |
|------|--------|----------|
| 技术架构 | 90% | Phaser 3.90 + React 18 + Zustand，Mixin 架构稳定 |
| 弹幕系统 | 85% | BulletCore 统一入口，PatternSystem/VfxSystem/AttackTimeline 框架就绪 |
| 碰撞系统 | 85% | 伤害结算已解耦，arcSamples 弧形碰撞正常工作 |
| 6 职业核心攻击 | 85% | 全部有独立武器文件，均走 BulletCore 路径 |
| 主职业天赋 | 80% | 猎人/战士/法师/圣骑/德鲁伊/术士基础天赋全部生效 |
| 紧急冷却系统 | 80% | EMERGENCY_COOLDOWN_DEFS 定义 + installPassiveCooldownSkills 驱动 |
| 天赋选择 UI | 85% | 三选一 UI 正常，权重系统 TALENT_OFFER_WEIGHT_CONFIG 已接入 |
| 宠物/召唤框架 | 60% | 有 update() 循环、熊近战攻击、骨卫近战攻击已实现 |
| 物品/装备系统 | 70% | 27+ 物品定义，装备场景基本可用 |
| React UI 层 | 80% | Bus 双向通信、Zustand 状态管理、天赋面板完整 |
| Boss 系统 | 40% | BaseBoss 模板 + 批量弹幕模式，无差异化 Boss |
| 第三天赋效果 | 15% | applyUpgrade 设 flag ✅，但 0 个 flag 被游戏系统消费 |
| 精英词缀 | 30% | rollEliteAffixes 被导入，标签显示有，但效果未生效 |
| 商店系统 | 30% | 场景骨架有，购买无实际效果 |
| 数据系统 | 20% | mapEvents（零引用）、mapDrops（零引用）完全空转 |

---

## 三、待解决问题清单

### P0 — 核心玩法缺失（选了天赋但游戏里什么也不会发生）

#### 3.1 第三天赋效果全部空转
- **现状**：applyUpgrade 中 36 个 case 只是 `this.player.xxx = true` 或 `xxxLevel += 1`
- **问题**：没有任何武器文件、damageModel、PetManager 或 GameScene 读取这些 flag
- **影响范围**：
  - 深度专精 18 个：`mageDualcaster`, `mageTrilaser`, `mageArcanomorph`, `archerHundred`, `archerWindfury`, `archerEagleeye`, `warriorBladestorm`, `warriorBerserkgod`, `warriorUnyielding`, `warlockInfinite`, `warlockSouleater`, `warlockNetherlord`, `paladinAvenger`, `paladinSacredshield`, `paladinDivine`, `druidKingofbeasts`, `druidNaturefusion`, `druidAstralstorm`
  - 双职业专精 18 个：`dualArcanebear`, `dualStarwisdom`, `dualNatureoverflow`, `dualEnchantedarrow`, `dualHastefocus`, `dualArchercircle`, `dualCrusade`, `dualRighteousrage`, `dualSacredspin`, `dualDecay`, `dualWitheringroar`, `dualSoulbloom`, `dualHolyrain`, `dualBlessedquiver`, `dualRetribution`, `dualIronbark`, ...
- **验收标准**：选择每个天赋后，游戏内必须有可观测的行为变化

#### 3.2 Boss 无差异化
- **现状**：只有一个 BaseBoss 类，所有 Boss 共用同一套 `fireSmartVolley` / `fan + burst` 攻击模式
- **问题**：每轮战斗体验相同，无策略深度
- **验收标准**：至少 3-4 个 Boss 各有独特攻击模式和阶段机制

#### 3.3 宠物/召唤战斗 AI 不完整
- **现状**：PetManager.update() 和 UndeadSummonManager.update() 已被 GameScene 调用（每帧），熊和骨卫有近战攻击逻辑
- **缺失**：
  - 🦅 战鹰远程攻击 — 属性存在但射击行为未确认完整
  - 🌲 树精治疗 — 无任何周期性治疗逻辑
  - 🧙 骷髅法师远程攻击 — 部分实现，需确认完整性
  - 🔥 炼狱恶魔行为 — `summonInfernal()` 框架存在，战斗 AI 可能缺失

### P1 — 系统空转（数据定义完整但未接入）

#### 3.4 精英词缀仅为装饰
- **现状**：`rollEliteAffixes()` 在 LevelProgressionMixin 中被调用，TestMinion 显示精英标签
- **问题**：词缀属性修正（额外攻击、减速光环等）未实际应用到小怪行为
- **影响**：精英怪与普通怪战斗体验无区别

#### 3.5 碎片系统无累积效果
- **现状**：`shard_fire/water/wind` 在 items.js 中定义了 `{ stat, pct }` 结构
- **问题**：拾取碎片后无代码将碎片数量 × 百分比加成到玩家属性
- **影响**：碎片可收集但无意义

#### 3.6 mapEvents.js 零引用
- **现状**：定义了 40+ 地图事件，但没有任何文件 import 这个模块
- **建议**：作为混沌竞技场随机事件接入，或暂时标记废弃

#### 3.7 mapDrops.js 零引用
- **现状**：定义了 25+ 掉落物品池，但没有任何文件 import 这个模块
- **建议**：接入 Boss 击杀奖励或竞技场波次掉落

#### 3.8 商店购买无效
- **现状**：ShopScene / ItemShopScene 有 UI 骨架，但购买按钮不修改玩家状态
- **影响**：商店存在但无意义

### P2 — 技术债与代码质量

#### 3.9 Player.js 三套动画配置
- `PLAYER_ANIM_CONFIG`、`ARCHER_ANIM_CONFIG`、`DELUYI_ANIM_CONFIG` 并存
- 应统一为根据职业动态选择的配置系统

#### 3.10 React 无 ErrorBoundary
- React 组件树崩溃不会被捕获，Phaser 层会继续运行产生不一致状态
- 应添加顶层 ErrorBoundary 并显示降级 UI

#### 3.11 laser.js Graphics 对象频繁创建
- 激光渲染每帧重绘 Graphics，建议引入对象池或 RenderTexture 缓存

#### 3.12 MotionModifier 使用情况不明
- `MotionModifier` 类已定义但与 BulletCore 的集成路径需确认
- 可能影响弹道修饰器功能（波浪弹、螺旋弹等）

---

## 四、开发路线图

### 阶段 A：核心循环可玩化（优先级最高）

> **目标**：让每个"选择"都有可感知的游戏效果

| 任务 | 内容 | 复杂度 | 涉及文件 |
|------|------|--------|----------|
| A1 | Boss 差异化（3-4 个独特 Boss） | 高 | BaseBoss 子类, BossManager, index.js |
| A2 | 第三天赋 — 深度专精效果实装（18 个 flag → 实际行为） | 高 | 各武器文件, damageModel, PetManager, GameScene |
| A3 | 第三天赋 — 双职业专精效果实装（18 个 flag → 实际行为） | 高 | 同上 |
| A4 | 宠物战斗补全（战鹰射击、树精治疗、骷髅法师、恶魔） | 中 | PetManager, UndeadSummonManager, meleeWindup |
| A5 | 精英词缀效果接入 | 中 | TestMinion, eliteAffixes.js |

### 阶段 B：经济与奖励系统

> **目标**：建立完整的"战斗→奖励→强化→战斗"循环

| 任务 | 内容 | 复杂度 | 涉及文件 |
|------|------|--------|----------|
| B1 | 碎片累积系统实装 | 低 | items.js, DropsInventoryMixin, Player.js |
| B2 | mapDrops 接入 Boss 击杀奖励 | 中 | mapDrops.js, BossManager, GameScene |
| B3 | 商店购买效果实装 | 中 | ShopScene, ItemShopScene, Player.js |
| B4 | 战后结算界面 | 中 | 新建 VictoryScene 或扩展 GameOverScene |

### 阶段 C：战场丰富度

> **目标**：让每局游戏有差异化体验

| 任务 | 内容 | 复杂度 | 涉及文件 |
|------|------|--------|----------|
| C1 | 竞技场修正器（落雷/毒池/裂隙等危险区域） | 高 | GameScene, 新建 ArenaModifier 系统 |
| C2 | Boss 二阶段机制（血量阈值触发变身/新模式） | 中 | BaseBoss 子类 |
| C3 | mapEvents 接入随机事件 | 中 | mapEvents.js, LevelProgressionMixin |
| C4 | 小怪波次多样化 | 中 | TestMinion, BossManager |

### 阶段 D：技术债清理与打磨

| 任务 | 内容 | 复杂度 |
|------|------|--------|
| D1 | Player.js 动画配置统一 | 低 |
| D2 | React ErrorBoundary | 低 |
| D3 | laser.js 对象池优化 | 中 |
| D4 | 确认 MotionModifier 集成 | 低 |
| D5 | PreloadScene 资源加载失败重试 | 低 |

---

## 五、周期预估

| 阶段 | 预估工作量 | 前置依赖 |
|------|-----------|----------|
| **阶段 A**：核心循环可玩化 | 5-8 个开发周期 | 无 |
| ├─ A1 Boss 差异化 | 2-3 周期 | — |
| ├─ A2+A3 第三天赋实装 | 2-3 周期（每个天赋需设计+实装+测试） | — |
| ├─ A4 宠物战斗补全 | 1-2 周期 | — |
| └─ A5 精英词缀 | 0.5-1 周期 | — |
| **阶段 B**：经济与奖励 | 2-3 个开发周期 | 阶段 A 完成 |
| **阶段 C**：战场丰富度 | 3-5 个开发周期 | 阶段 A+B 完成 |
| **阶段 D**：技术债清理 | 1-2 个开发周期 | 可穿插进行 |

> **"开发周期"定义**：一个集中工作日（约 4-8 小时有效编码时间）

---

## 六、核心原则

1. **验收标准驱动**：每个天赋/系统的标准是「选了之后游戏里真的会发生什么」
2. **深度优先于广度**：不要继续扩展新数据定义，先让现有 36 个第三天赋全部生效
3. **可玩优先于完美**：Boss 差异化比弹道特效更重要
4. **渐进式集成**：新系统先通过 flag → behavior 的最小路径接入，再迭代视觉表现

---

## 七、文件清单速查

### 核心系统文件
| 文件 | 职责 |
|------|------|
| `src/scenes/GameScene.js` | 主场景，管理器初始化，游戏循环 |
| `src/scenes/game/BuildClassMixin.js` | 职业构建、applyUpgrade、天赋应用 |
| `src/scenes/game/LevelProgressionMixin.js` | 混沌竞技场流程、波次推进 |
| `src/managers/CollisionManager.js` | 碰撞检测 + 伤害结算（已解耦） |
| `src/managers/BulletManager.js` | 子弹对象池、运动更新、拖尾渲染 |
| `src/systems/bullets/BulletCore.js` | 统一弹幕入口（所有新代码应走此路径） |
| `src/combat/damageModel.js` | 伤害公式集中定义 |
| `src/player/Player.js` | 玩家实体、属性、动画 |

### 武器文件
| 文件 | 职业 |
|------|------|
| `src/classes/attacks/weapons/archerArrow.js` | 猎人 |
| `src/classes/attacks/weapons/warriorSlash.js` | 战士 |
| `src/classes/attacks/weapons/laser.js` | 法师 |
| `src/classes/attacks/weapons/paladinHammer.js` | 圣骑士 |
| `src/classes/attacks/weapons/starfall.js` | 德鲁伊 |
| `src/classes/attacks/weapons/warlockPoisonNova.js` | 术士 |

### 宠物/召唤
| 文件 | 职责 |
|------|------|
| `src/classes/pets/PetManager.js` | 德鲁伊宠物（熊/鹰/树精）|
| `src/classes/pets/UndeadSummonManager.js` | 术士骷髅（骨卫/法师/恶魔）|
| `src/classes/pets/SummonRegistry.js` | 统一召唤注册中心 |

### 数据配置
| 文件 | 状态 |
|------|------|
| `src/classes/upgradePools.js` | ✅ 活跃 |
| `src/classes/talentTrees.js` | ✅ 活跃 |
| `src/data/balanceConfig.js` | ✅ 活跃 |
| `src/data/items.js` | ✅ 活跃（碎片效果待接入）|
| `src/data/eliteAffixes.js` | ⚠️ 部分接入 |
| `src/data/mapDrops.js` | ❌ 零引用 |
| `src/data/mapEvents.js` | ❌ 零引用 |
| `src/data/mapPool.js` | ⚠️ 已废弃标注 |
