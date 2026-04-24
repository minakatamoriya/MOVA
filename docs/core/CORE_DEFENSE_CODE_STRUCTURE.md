# 守护核心原型代码结构说明

本文档用于约束守护核心模式在原型阶段的代码拆分方向，避免继续把规则、数据、表现、输入和 UI 全部堆进单一场景文件。

## 当前目录分层

### 场景层

- [src/coreDefense/scenes/CoreDefensePrototypeScene.js](src/coreDefense/scenes/CoreDefensePrototypeScene.js)
  - 只负责原型主循环调度。
  - 负责 create / update、对象创建、流程编排、模块调用。
  - 不再继续新增纯数据表、纯数学工具、纯表现工具到本文件顶部。

### 核心配置层

- [src/coreDefense/config/arenaLayout.js](src/coreDefense/config/arenaLayout.js)
  - 战场分区、核心位置、刷怪入口、圈层半径。
- [src/coreDefense/config/classOptions.js](src/coreDefense/config/classOptions.js)
  - 守护核心模式专用职业原型参数。
- [src/coreDefense/config/waveTimeline.js](src/coreDefense/config/waveTimeline.js)
  - 潮汐导演、敌人类型、血量倍率、刷怪节奏。

### 原型专用模块层

- [src/coreDefense/prototype/config/prototypeSceneConfig.js](src/coreDefense/prototype/config/prototypeSceneConfig.js)
  - 原型场景常量。
  - 例如交互半径、核心透明点击区尺寸、压力结算节拍。
- [src/coreDefense/prototype/config/progressionCatalog.js](src/coreDefense/prototype/config/progressionCatalog.js)
  - 玩家升级表、核心模块表、初始升级状态、经验曲线、档位显示规则。
  - 这类数据以后继续加也应优先落在这里，而不是写回 scene 顶部。
- [src/coreDefense/prototype/config/eliteDropCatalog.js](src/coreDefense/prototype/config/eliteDropCatalog.js)
  - 精英掉落池、掉落资格判定与局内奖励规则。
  - 用来承接精英击杀后的 build 变化，不把掉落配置和奖励公式散落到 combatSystems 或 scene。
- [src/coreDefense/prototype/utils/math.js](src/coreDefense/prototype/utils/math.js)
  - 原型通用数学函数。
- [src/coreDefense/prototype/utils/combatFeedback.js](src/coreDefense/prototype/utils/combatFeedback.js)
  - 原型战斗反馈表现，目前承载伤害数字飘字。

### 原型 UI 层

- [src/coreDefense/prototype/ui/topHud.js](src/coreDefense/prototype/ui/topHud.js)
  - 顶部 HUD。
  - 当前承载核心残影血条、护盾值、经验条、波次、计时、金币与威胁信息。
  - 核心血条使用“先立即扣主血条，再延迟收缩残影血条”的表现，方向上参考格斗游戏的受击血槽反馈。
- [src/coreDefense/prototype/ui/upgradeMenu/menu.js](src/coreDefense/prototype/ui/upgradeMenu/menu.js)
  - 升级终端 UI 组装与交互控制。
  - 当前承载菜单布局、分页切换、条目刷新、滚动与购买入口。

### 原型战斗系统层

- [src/coreDefense/prototype/systems/combatSystems.js](src/coreDefense/prototype/systems/combatSystems.js)
  - 守护核心原型当前的战斗系统收口文件。
  - 当前承载敌人推进、核心压力结算、模块效果、玩家自动攻击、经验增长、击杀奖励、精英掉落触发与精英压阵判定。
- [src/coreDefense/prototype/systems/coinDrops.js](src/coreDefense/prototype/systems/coinDrops.js)
  - 守护核心原型的金币掉落与拾取系统。
  - 当前承载金币实体生成、散落、吸附、收集与入账，不再继续使用“击杀直接加金币”的临时口径。

## 与旧游戏的关联文件整理

### 直接可复用候选

- [src/combat/damageModel.js](src/combat/damageModel.js)
  - 这是旧游戏中已经较成熟的统一伤害结算层。
  - 当前守护核心原型还没有正式接入，但后续如果从“简单攻击数值”升级到正式伤害模型，优先从这里抽公共接口，而不是在 scene 里再写一套新公式。
- [src/managers/CollisionManager.js](src/managers/CollisionManager.js)
  - 当前已经参考过其中的伤害数字表现。
  - 这个文件本体过大，不适合直接整份搬入守护核心原型。
  - 复用方式应是继续把可独立的表现函数抽成小模块，而不是让守护核心依赖整个旧碰撞管理器。

### 守护核心模式专用，保留独立演进

- [src/coreDefense/config/arenaLayout.js](src/coreDefense/config/arenaLayout.js)
- [src/coreDefense/config/classOptions.js](src/coreDefense/config/classOptions.js)
- [src/coreDefense/config/waveTimeline.js](src/coreDefense/config/waveTimeline.js)
- [src/coreDefense/prototype/config/progressionCatalog.js](src/coreDefense/prototype/config/progressionCatalog.js)

说明：

- 这些文件描述的是守护核心模式自己的导演、职业原型和成长逻辑，不应该强行并回旧主游戏模块。
- 后续如果出现多模式共享需求，应抽“共享规则层”，而不是让 coreDefense 反向依赖旧场景文件。

### 当前只做参考，后续待剥离判断

- 旧主游戏的大型 Scene 文件。
- 旧主游戏里只服务于主循环 UI 的管理器。
- 旧主游戏里带大量职业、装备、局外系统耦合的逻辑文件。

说明：

- 这些文件先不要让守护核心原型直接 import。
- 如果里面有可复用能力，应先拆成功能单一的 util、model、config，再决定是否共享。

## 后续推荐拆分顺序

1. 继续把升级终端 UI 从单文件拆到布局、刷新、交互三个文件。
2. 把 combatSystems 再拆成 enemyMovement、pressureResolution、coreModuleRuntime、autoAttack 四块。
3. 把顶部 HUD 再拆成 coreBar、expBar、metaTexts 三块，避免 HUD 文件继续膨胀。
4. 最后把场景内状态初始化和运行时状态收成独立 state 模块。

## 下一轮拆分边界建议

### UI 层

- 建议新增 `src/coreDefense/prototype/ui/upgradeMenu/`。
- 当前已落下 `menu.js`。
- 下一步应继续拆出菜单布局、菜单刷新、滚动交互三个文件。
- 顶部 HUD 继续保留在 `ui/` 下，不要回写到 scene。

### 战斗层

- 建议新增 `src/coreDefense/prototype/systems/`。
- 当前已落下 `combatSystems.js`。
- 下一步应继续拆出敌人推进、压力结算、核心模块处理、自动攻击四块。

### 状态层

- 建议新增 `src/coreDefense/prototype/state/`。
- 用工厂函数集中创建 battleLevel、gold、runtime timers、upgradeLevels、coreModuleLevels 等初始状态。

## 当前约束

- 新增规则前，先判断它属于 config、system、ui、state 还是 scene orchestration。
- 如果逻辑可以脱离 Phaser Scene 独立运行或独立测试，就不要写进 scene 方法体。
- 如果只是复用旧游戏的一小段能力，优先抽出最小公共模块，不要整份依赖旧大文件。