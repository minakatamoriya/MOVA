# MOVA 项目状态与问题清单

> 更新日期：2026-03-24
> 依据：当前代码、天赋配置与本轮运行检查

---

## 一、当前天赋系统结构

当前版本已经不再使用旧三树结构，而是以下两树成长模型：

- 主职业树：开局确认职业身份，只提供本职业核心与主职业专精。
- 副职业树：在固定成长节点弹出一次 6 选 1 事件后解锁。
- 深度专精：不再作为第三列，不再使用预备卡，直接并入主职业树后段。
- 双职业专精：已从当前主流程中删除，不再参与发牌、展示或升级应用。

当前实际流程：

1. 开局只选主职业核心。
2. 前 3 次普通升级主要建立主职业。
3. 达到固定节点后，触发一次不消耗升级点的 6 选 1 副职业选择。
4. 解锁副职业后，主职业池与副职业池并行。
5. 总升级阶段进入后段时，主职业深度专精混入主职业池。

对应代码入口：

- 发牌与升级流程：[src/scenes/game/BuildClassMixin.js](src/scenes/game/BuildClassMixin.js)
- 天赋池定义：[src/classes/upgradePools.js](src/classes/upgradePools.js)
- 天赋树映射：[src/classes/talentTrees.js](src/classes/talentTrees.js)
- 技能文档总表：[SKILL_LIST.md](SKILL_LIST.md)

---

## 二、当前已确认正常的部分

### 2.1 天赋结构本身已切换完成

- 第三树 UI 已移除，只保留主职业列与副职业列。
- 双职业专精、双职业预备卡、第三列占位逻辑已从主流程代码中清除。
- 深度专精已映射回主职业树，进度记录也按两棵树处理。

### 2.2 副职业固定解锁事件已生效

- 当前实现为：主职业普通升级达到 3 次后，触发一次 6 选 1 副职业选择。
- 该选择事件不消耗升级点，也不会额外增加 levelUps 计数。

### 2.3 深度专精发牌链路已改为主池后段

- 当前后段发牌会直接把主职业对应的 DEPTH_SPEC_POOLS 混入候选池。
- 不再经过 third_depth_prep。

### 2.4 旧状态文档里的几项“空转”结论已经不准确

本轮核对确认以下系统已有实际行为，不应再按“纯装饰/空转”统计：

- 精英词缀：已在 [src/enemies/minions/TestMinion.js](src/enemies/minions/TestMinion.js) 内有实际行为逻辑。
- 树精治疗：已在 [src/classes/pets/PetManager.js](src/classes/pets/PetManager.js) 中接入周期治疗。
- 术士地狱火重生：已在 [src/classes/pets/UndeadSummonManager.js](src/classes/pets/UndeadSummonManager.js) 中生效。

### 2.5 工程运行状态正常

- webpack-dev-server 可正常启动。
- 本轮修改后的相关文件 Problems 检查为 0。
- 当前开发服可正常完成热更新编译。

---

## 三、本轮确认的问题

以下问题按优先级排序。

### P1：深度专精的开启条件仍是“总升级阶段”，不是“主职业深度”

现状：

- 当前深度专精进入主池的条件，仍由 getTalentOfferStage(levelUps) 决定。
- 实际上是普通升级总次数进入后段后开放，而不是基于主职业树已投入到足够深度。

对应位置：

- [src/scenes/game/BuildClassMixin.js](src/scenes/game/BuildClassMixin.js)
- [src/classes/dualClass.js](src/classes/dualClass.js)

影响：

- 现在更像“时间门槛”，而不是“主职业树深度门槛”。
- 如果玩家中期大量点副职业，仍可能按总升级数较早看到深度专精。

建议：

- 后续改成基于主职业树已获得节点数、主职业总等级，或主职业关键节点完成度来解锁。

### 已解决：副职业选择事件恢复基础能力，但不再附带入口数值包

本轮已完成：

- 副职业 6 选 1 事件现在会立即发放基础副职业能力，并确定后续副职业池。
- 不再在选择瞬间额外发放攻速、暴击、闪避、减伤、增伤等独立全局数值。
- 免费发放的内容仅限副职业基础机制本身，例如炮台、假人、血怒、召唤物、格挡/圣印、熊灵。
- 副职业树后续节点继续承担主要成长与强化职责。

对应位置：

- [src/scenes/game/BuildClassMixin.js](src/scenes/game/BuildClassMixin.js)
- [src/classes/upgradePools.js](src/classes/upgradePools.js)
- [src/classes/talentTrees.js](src/classes/talentTrees.js)
- [src/combat/damageModel.js](src/combat/damageModel.js)
- [src/player/Player.js](src/player/Player.js)

### P1：项目主状态文档严重过时

现状：

- 旧文档仍按“三树 + 第三天赋 + 双职业 18 项空转”来描述项目。
- 其中多条结论已不符合当前代码。

影响：

- 后续继续按旧文档推进，会把优先级判断带偏。
- 任何新一轮整理都容易重复清理已经完成的工作，或者误判系统是否空转。

处理：

- 本文件已重写为当前真实状态。

### P2：mage_arcanomorph 仍然只有等级记录，没有明确行为接入

现状：

- 当前只看到 [src/scenes/game/BuildClassMixin.js](src/scenes/game/BuildClassMixin.js) 给 mageArcanomorphLevel 加点。
- 本轮源码核对中，没有发现对应的行为消费逻辑。

影响：

- 法师深专中的“奥术叠界”仍可能是纯占位等级。

建议：

- 如果该节点暂不实装，应在文档中继续明确标注“未接入最终数值公式”。
- 如果准备实装，优先在法阵叠层、重叠增益和副效果放大上补真实逻辑。

### P2：少量旧权重/辅助方法已失效但仍残留

现状：

- offFactionEntryWeight、favoredOffFactionEntryMultiplier 这类配置项仍然存在。
- appendWeightedUniqueUpgrades 仍保留，但当前主流程已不再使用。

对应位置：

- [src/classes/upgradePools.js](src/classes/upgradePools.js)
- [src/scenes/game/BuildClassMixin.js](src/scenes/game/BuildClassMixin.js)

影响：

- 不影响运行，但会增加后续阅读成本。
- 继续保留会让人误以为副职业入口卡仍通过普通权重发牌。

建议：

- 做一轮轻量代码清洁，把已失效配置和未使用辅助函数移除。

### P3：mapDrops / mapEvents 仍未接入主流程

现状：

- 本轮未发现这些模块被其他主流程代码引用。

对应位置：

- [src/data/mapDrops.js](src/data/mapDrops.js)
- [src/data/mapEvents.js](src/data/mapEvents.js)

影响：

- 数据层仍有一批配置未参与实际玩法循环。

建议：

- 如果近期不做地图事件与掉落系统，建议在文档中标为“待接入数据层”，避免和现行主循环混淆。

---

## 四、建议的下一步

### 方向 A：把当前天赋系统彻底定稿

优先处理：

1. 决定副职业入口数值包是否保留。
2. 决定深度专精解锁是按总升级，还是按主职业树深度。
3. 补掉 mage_arcanomorph 的真实行为。

### 方向 B：做一轮轻量技术清洁

优先处理：

1. 删除已失效权重项与未使用辅助方法。
2. 清理仍按旧三树语义命名的局部注释。
3. 继续同步其余设计稿，避免文档倒挂。

### 方向 C：继续查核心玩法缺口

在天赋结构稳定后，再看：

1. Boss 差异化是否足够。
2. 商店、掉落、地图事件是否要进入主循环。
3. 还有哪些深专节点只有 flag，没有强感知行为。

---

## 五、当前结论

当前项目最大的变化不是“多了新天赋”，而是成长结构已经改成了可用的两树模型。

真正还没完全收口的，不是第三树本身，而是两点：

- 副职业入口到底要不要继续保留那一包固定数值。
- 深度专精到底按“时间阶段”开放，还是按“主职业深度”开放。

这两个问题一旦定稿，当前天赋系统就可以从“已完成结构改造”进入“已完成规则定稿”。
