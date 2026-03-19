# 技能列表总览

本文档整理当前项目内所有“技能/天赋/专精”节点，按以下维度归类：
- 主基础技能：选择某个核心后获得的基础攻击形态（主职业决定）
- 主职业专精：只在主职业生效（来自 `UPGRADE_POOLS`）
- 副职业（派系）技能：作为副职业提供的通用能力池（来自 `UNIVERSAL_POOLS`）
- 第三天赋：深度专精（主/副同主题）与双职业专精（主/副不同主题）

说明：
- “主基础技能”是体验层面的基础攻击形态；代码内部对应 `*_core` 选择后切换的 `weaponType` / build 机制。
- 文档中的括号形如 `id=xxx` 对应升级/节点的内部 id。

---

## 主基础技能（核心）

- 战士核心（id=warrior_core）
  - 基础攻击变为近战挥砍（近战判定 + 挥砍表现）。
- 圣骑士核心（id=paladin_core）
  - 护盾脉冲体系：清弹并反击（并有索敌范围提示圈）。
- 猎人核心（id=scatter_core）
  - 基础攻击为散射箭/扇形齐射（散射列数可升级）。
- 法师核心（id=mage_core）
  - 基础攻击切换为奥术射线/激光聚焦（激光体系）。
- 德鲁伊核心（id=drone_core）
  - 基础攻击为星落（定位敌方，星星下落造成范围伤害）。
- 术士核心（id=warlock_core）
  - 基础攻击为剧毒新星（周期在脚下留下毒圈并逐渐扩大）。

---

## 主职业专精（只对主职业生效）

### 猎人·散射（coreKey=scatter）
- 连射（id=archer_rapidfire）：每次攻击后 10% 概率免费再射一轮
- 穿透（id=archer_pierce）：箭矢最多额外穿透 1 次
- 箭雨（id=archer_arrowrain）：每 5 秒下一次攻击变为箭雨，覆盖更大范围，伤害翻倍
- 灵巧回避（id=archer_nimble_evade，maxLevel=3）：生命低于30%时自动触发，闪避率 +40%/+60%/+80%，持续3秒，冷却30秒
- 射程（id=archer_range，maxLevel=3）：基础射击射程提升
- 射速（id=archer_rate，maxLevel=3）：基础射击攻速提升
- 攻击力（id=archer_damage，maxLevel=3）：基础射击伤害提升
- 散射（id=archer_scatter，maxLevel=3）：散射升级（1列→3列→5列）

### 德鲁伊·星落（coreKey=drone）
- 流星雨（id=druid_meteor_shower）：星落数量 +2，但单次伤害略降
- 陨石（id=druid_meteor）：每 10 秒下一次星落变为巨型陨石（更大范围/更高伤害）
- 星火（id=druid_starfire）：星落命中后 30% 概率同位置额外触发一次（不连锁）
- 滋养（id=druid_nourish，maxLevel=3）：生命低于30%时自动触发，在15/10/5秒内缓慢回复30%生命，冷却30秒

### 战士·近战挥砍（coreKey=warrior）
- 回旋（id=warrior_spin）：挥砍变为 360° 回旋斩
- 剑气（id=warrior_swordqi）：挥砍额外发射月牙剑气（保留近战判定）
- 持久（id=warrior_endure）：近战形态获得 20% 伤害减免
- 月牙扩展（id=warrior_range）：月牙斩有效范围提升（可叠加）
- 吸血（id=warrior_blood_conversion，maxLevel=3）：生命低于30%时自动触发，攻击伤害转化为40%/70%/100%吸血，持续5/10/15秒，冷却30秒

### 法师·激光（coreKey=mage）
- 折射（id=mage_refract）：激光命中目标后，从该目标分裂 2 道短射线到附近敌人（伤害 -50%）
- 奥术感知（id=mage_arcane_perception，maxLevel=3）：索敌范围提升
- 能量汇集（id=mage_energy_focus，maxLevel=3）：射线伤害提升并随层数更粗更亮

### 圣骑士（coreKey=paladin）
- 重锤（id=paladin_pierce）：锤击范围略扩大，落点更靠前
- 震荡锤击（id=paladin_repulse）：锤击命中附带明显击退，更难让敌人贴身
- 连锤（id=paladin_triple）：每 5 秒下一次锤击额外追加 2 次余震
- 制裁（id=paladin_stun，maxLevel=3）：锤击眩晕概率 10%/20%/30%
- 神圣庇护（id=paladin_divine_shelter，maxLevel=3）：生命低于30%时自动触发，获得40%/60%/80%减伤，持续5秒，冷却30秒

### 术士（coreKey=warlock）
- 毒性浓度（id=warlock_toxicity，maxLevel=3）：剧毒 debuff 最大层数 +1
- 腐蚀（id=warlock_corrode，maxLevel=3）：毒圈持续时间 +1 秒
- 扩散（id=warlock_spread，maxLevel=3）：毒圈范围 +20%

---

## 副职业（派系）技能

这些技能来自副职业派系选择（registry: `offFaction`），不会切换基础攻击形态。
副职业节点同池可全拿，区别主要在出现顺序与成型节奏，而不是互斥分支。

### 奥术（offFaction=arcane）
- 奥能法阵（id=arcane_circle）：周期生成法阵，法阵自带增伤
- 法阵扩张（id=arcane_circle_range）：扩大法阵范围
- 烈焰法阵（id=arcane_fire_circle）：法阵结束时爆炸，造成范围伤害
- 冰霜法阵（id=arcane_frost_circle）：法阵内敌人减速
- 共鸣刻印（id=arcane_resonance_mark）：进一步扩大法阵增伤
- 流动施法（id=arcane_flowcasting）：离开法阵后短时间保留法阵增益

### 游侠（offFaction=ranger）
- 绊索陷阱（id=ranger_snaretrap）：周期布置陷阱，触发后短暂定身
- 猎手印记（id=ranger_huntmark）：被陷阱触发的敌人受到你的伤害提高
- 钉刺陷阱（id=ranger_spiketrap）：触发后造成减速和持续伤害
- 爆裂陷阱（id=ranger_blasttrap）：触发时造成一次范围爆炸
- 熟练布置（id=ranger_trapcraft）：缩短布置间隔并扩大覆盖能力
- 围猎本能（id=ranger_pack_hunter）：强化你对被控制/标记目标的暴击收益

### 不屈（offFaction=unyielding）
- 血怒（id=unyielding_bloodrage）：生命越低伤害越高
- 战吼（id=unyielding_battlecry）：受伤后短时间增伤
- 断筋（id=unyielding_hamstring）：近距离命中使敌人减速
- 破甲（id=unyielding_sunder）：持续命中同一目标时提高对其伤害
- 不退（id=unyielding_standfast）：近距离时获得减伤与抗击退
- 处决本能（id=unyielding_executioner）：对低血敌人造成额外伤害

### 诅咒（offFaction=curse）
- 死灵共鸣（id=curse_necrotic_vitality）：提高召唤物生命
- 骷髅卫士（id=curse_skeleton_guard，maxLevel=3）：召唤近战骷髅卫士协同作战（1/2/3 级上限为 1/3/5）
- 骷髅法师（id=curse_skeleton_mage，maxLevel=3）：召唤远程骷髅法师协同作战（1/2/3 级上限为 1/3/5）
- 白骨灌能（id=curse_mage_empower）：提高骷髅法师输出能力
- 骸骨壁垒（id=curse_guard_bulwark）：提高骷髅卫士生存与前排能力
- 魂火余烬（id=curse_ember_echo）：召唤物死亡后为你提供短时间增伤/减伤

### 守护（offFaction=guardian）
- 坚盾（id=guardian_block）：概率格挡，格挡时减伤
- 护甲（id=guardian_armor）：固定减伤
- 反制（id=guardian_counter）：格挡成功后反击
- 庇护圣印（id=guardian_sacred_seal）：受击或格挡时积累圣印
- 神圣回击（id=guardian_holy_rebuke）：消耗圣印触发范围冲击
- 光铸壁垒（id=guardian_light_fortress）：低血时把圣印转为护盾

### 自然伙伴（offFaction=nature）
- 熊灵（id=druid_pet_bear）：负责近战拦截与前排牵制
- 战鹰（id=druid_pet_hawk）：负责高频输出与标记
- 树精（id=druid_pet_treant）：负责治疗与护盾
- 熊灵守护（id=nature_bear_guard）：强化承担伤害与拦截能力
- 战鹰猎印（id=nature_hawk_huntmark）：强化标记与增伤
- 树精繁茂（id=nature_treant_bloom）：强化治疗与护盾

---

## 第三天赋：深度专精（主/副同主题）

深度专精终稿统一按“3 节点结构”设计：
- 第 1 节点：立即改变手感
- 第 2 节点：建立连锁或循环
- 第 3 节点：终局爆点

- 法师深度（mainCoreKey=mage）
  - 星界贯炮（id=mage_dualcaster）：激光变为巨粗贯穿光束，立刻进入终局主炮手感
  - 棱镜超载（id=mage_trilaser）：激光命中后在主目标后方继续裂出副光束，形成后排延伸打击
  - 奥术叠界（id=mage_arcanomorph，maxLevel=3）：奥能法阵允许重叠，重叠区内法阵增伤与附加效果按层放大

- 猎人深度（mainCoreKey=archer）
  - 反射猎场（id=archer_bounce）：箭矢可在墙体与边界间反弹，优先继续追猎最近敌人
  - 暴风裂羽（id=archer_windfury）：每轮散射额外追加一组延迟二段箭幕，形成前后两波清屏
  - 终局鹰眼（id=archer_eagleeye）：所有散射箭获得更高暴击权重，对被标记目标进一步提高暴击上限

- 战士深度（mainCoreKey=warrior）
  - 永动旋刃（id=warrior_bladestorm）：进入持续旋转状态，移动中也不会中断主攻节奏
  - 外放剑潮（id=warrior_berserkgod，maxLevel=3）：持续旋转期间周期性向外发射剑刃，补足远端压制与追击
  - 暴走战躯（id=warrior_unyielding）：血怒、战吼、处决本能收益上限全部提高，低血时旋转更快、剑刃更多

- 术士深度（mainCoreKey=warlock）
  - 瘟疫疆域（id=warlock_autoseek）：毒圈会主动缓慢索敌并向敌群漂移
  - 腐灭连环（id=warlock_souleater，maxLevel=3）：中毒敌人死亡时向周围扩散更强的腐蚀层，形成稳定滚雪球
  - 炼狱君王（id=warlock_netherlord）：地狱火显著强化，并持续放大毒圈伤害、范围与压场能力

- 圣骑深度（mainCoreKey=paladin）
  - 震退反制（id=paladin_avenger，maxLevel=3）：反击命中附带明显击退，高等级可追加短暂眩晕
  - 圣棘回响（id=paladin_sacredshield）：格挡、受击、反制时都会反弹一部分神圣伤害
  - 审判禁区（id=paladin_divine）：神圣回击、反制、击退彼此联动，在身边形成难以逼近的审判区

- 德鲁伊深度（mainCoreKey=drone）
  - 群星坠世（id=druid_kingofbeasts）：星落覆盖范围显著扩大，单次施法落点数提升
  - 连星陨爆（id=druid_naturefusion）：陨石命中后引发二次流星坠击，形成连续轰炸区
  - 天穹潮汐（id=druid_astralstorm，maxLevel=3）：星落循环显著加速，流星雨与陨石能更高频进入战场

---

## 第三天赋：双职业专精（主/副不同主题）

双职业专精按（主职业主题 -> 副职业主题）拆分：

- 法师 + 德鲁伊（main=mage, off=nature/drone）
  - 奥术之熊（id=dual_mage_drone_arcanebear）
  - 星辰智慧（id=dual_mage_drone_starwisdom，maxLevel=3）
  - 自然溢流（id=dual_mage_drone_natureoverflow）

- 猎人 + 法师（main=scatter, off=arcane/mage）
  - 附魔箭矢（id=dual_scatter_mage_enchantedarrow）
  - 迅捷专注（id=dual_scatter_mage_hastefocus，maxLevel=3）
  - 射手法阵（id=dual_scatter_mage_archercircle）

- 战士 + 圣骑（main=warrior, off=guardian/paladin）
  - 十字军（id=dual_warrior_paladin_crusade）
  - 正义血怒（id=dual_warrior_paladin_righteousrage，maxLevel=3）
  - 神圣旋风（id=dual_warrior_paladin_sacredspin）

- 术士 + 德鲁伊（main=warlock, off=nature/drone）
  - 腐败滋养（id=dual_warlock_drone_decay）
  - 凋零咆哮（id=dual_warlock_drone_witheringroar）
  - 灵魂绽放（id=dual_warlock_drone_soulbloom，maxLevel=3）

- 圣骑 + 猎人（main=paladin, off=ranger/scatter）
  - 圣光箭雨（id=dual_paladin_scatter_holyrain）
  - 祝福箭袋（id=dual_paladin_scatter_blessedquiver，maxLevel=3）
  - 惩戒射击（id=dual_paladin_scatter_retribution）

- 德鲁伊 + 战士（main=drone, off=unyielding/warrior）
  - 铁木之熊（id=dual_drone_warrior_ironbark）
  - 掠食者（id=dual_drone_warrior_predator，maxLevel=3）
  - 先祖韧性（id=dual_drone_warrior_ancestral）

---

## 副职业精简设计原则（2026-03 方案）

目标：
- 副职业不要做得过厚，避免与深度专精/双职业专精抢最强爆点。
- 每个副职业保留 2 条方向：输出线 + 辅助/控制线。
- 最爽的节点应当放在更后期的成长阶段，但强度定位仍是“玩法成型器”，而不是“最终超模器”。

建议点数预算：
- 主职业：5 个天赋 × 3 级 = 15 点
- 副职业：6 个天赋 × 3 级 = 18 点
- 深度专精 / 双职业：5 个天赋 × 3 级 = 15 点

备注：
- 如果你心里算的是 24 点，那通常意味着把“副职业入口/契约节点/末列节点”也算成额外层级了。
- 纯按“6 个天赋，每个 3 点”计算，副职业主池应是 18 点，这样更适合当前项目体量。

### 副职业成长规则

这里统一按你当前定稿理解：

- 副职业不是分支树，不做互斥路线
- 同一个副职业池里的 6 个节点，理论上都可以拿满
- 玩家决策点主要在“先拿什么”，而不是“舍弃什么”
- 只有出现顺序、前置条件、成型节奏不同，不存在永久锁路

因此“输出向节点 / 辅助向节点”的区分，只是策划归类，不是分支选择。

### 副职业强度边界

副职业应该给：
- 副玩法骨架
- 稳定数值收益
- 中期成型体验
- 与主职业的泛用联动

副职业不应该给：
- 规则改写级能力
- 终局形态变化
- 全屏统治级伤害
- 永久无条件霸体/无敌
- 明显压过深度专精的核心爆点

一句话区分：
- 副职业 = “副玩法成型”
- 深度专精 / 双职业 = “玩法上限突破”

---

## 副职业 6 天赋骨架（精简版）

以下方案统一遵循：
- 每个副职业 6 个天赋
- 每个天赋默认 3 级
- 同池可全拿，不做内部互斥分支

### 法师副：法阵体系

定位：场地区域、站位增益、减速控场

- 奥能法阵：周期生成法阵，法阵自带增伤
- 法阵扩张：扩大法阵范围
- 烈焰法阵：法阵结束时爆炸，造成范围伤害
- 冰霜法阵：法阵内敌人移速降低
- 共鸣刻印：进一步放大法阵增伤幅度
- 流动施法：离开法阵后短时间保留法阵增益

两条方向：
- 输出线：烈焰法阵 -> 共鸣刻印
- 辅助线：冰霜法阵 -> 流动施法

设计重点：
- 奥能法阵本体就必须自带增伤
- 共鸣刻印负责把这个增伤做大，而不是从零提供增伤
- 法师副不再保留单纯的常驻被动节点

### 德鲁伊副：自然伙伴体系

定位：功能型伙伴、综合续航、稳定协同

- 熊灵：负责承担伤害与前排牵制
- 战鹰：负责高频输出与标记
- 树精：负责治疗与护盾
- 熊灵守护：进一步强化承担伤害与拦截能力
- 战鹰猎印：进一步强化标记增伤
- 树精繁茂：进一步强化治疗与护盾

两条方向：
- 输出线：战鹰 -> 战鹰猎印
- 辅助线：熊灵守护 / 树精繁茂

设计重点：
- 德鲁伊副改为可全拿结构，不再按硬分支契约理解
- 熊、鹰、树都是同池节点，理论上可以都拿到
- 深度专精再去负责三宠同场、融合、终局强化

### 术士副：亡灵军势体系

定位：扩军、前后排召唤、越打越强

- 死灵共鸣：召唤物生命提高
- 骷髅卫士：召唤近战骷髅前排
- 骷髅法师：召唤远程骷髅后排
- 白骨灌能：强化骷髅法师攻击能力
- 骸骨壁垒：强化骷髅卫士生存与前排能力
- 魂火余烬：召唤物死亡后为你提供短时间增伤或减伤

两条方向：
- 输出线：骷髅法师 -> 白骨灌能
- 辅助线：骷髅卫士 -> 骸骨壁垒

设计重点：
- 避免设计成需要频繁按场上单位数实时结算的复杂常驻天赋
- 更适合做成“死亡触发短 Buff”的轻量滚雪球节点

### 圣骑副：守护反制体系

定位：减伤、格挡、反伤、受击收益

- 坚盾：概率格挡，格挡时减伤
- 护甲：固定减伤
- 反制：格挡成功后触发反击
- 庇护圣印：受击或格挡时积累圣印
- 神圣回击：消耗圣印对周围敌人进行反击冲击
- 光铸壁垒：低血时圣印自动转为护盾

两条方向：
- 输出线：反制 -> 神圣回击
- 辅助线：护甲 / 圣印 -> 光铸壁垒

设计重点：
- 让圣骑副从“硬”进化到“能把承伤转成收益”
- 不能提前给深度专精级别的圣盾术或超额反伤倍率

### 战士副：贴身压迫体系

定位：近距离压制、追击、破甲、处决

- 血怒：生命越低伤害越高
- 战吼：受伤后短时间提高伤害
- 断筋：近距离命中使敌人减速
- 破甲：持续命中同一目标时提高对其伤害
- 不退：近距离时获得减伤与抗击退
- 处决本能：对低血敌人造成额外伤害

两条方向：
- 输出线：破甲 -> 处决本能
- 压迫线：战吼 / 断筋 -> 不退

设计重点：
- 让战士副真正形成“贴脸越久越强”的闭环
- 不要提前给深度专精那种旋风扩展、霸体爆发或战神化身级效果

### 猎人副：陷阱控场体系

定位：布置、控制、减速、标记、处决

- 绊索陷阱：周期布置陷阱，触发后短暂定身
- 猎手印记：被陷阱触发的敌人受到你的伤害提高
- 钉刺陷阱：触发后造成减速和持续伤害
- 爆裂陷阱：触发时造成一次范围爆炸
- 熟练布置：陷阱生成间隔缩短或可同时存在更多陷阱
- 围猎本能：你对被控制或被标记敌人的暴击率/暴伤提高

两条方向：
- 输出线：爆裂陷阱 -> 围猎本能
- 控制线：绊索陷阱 / 钉刺陷阱 -> 熟练布置

设计重点：
- 让猎人副从“有陷阱”进化到“陷阱能主导战场节奏”
- 不要提前给深度专精级别的全图封锁或无限连控

---

## 六个副职业的强度职责分配

为了平衡，不让六个副职业都在竞争纯伤害，建议职责固定如下：

- 法师副：中输出 / 中控制 / 低防御
- 德鲁伊副：中输出 / 高辅助 / 高续航
- 术士副：高成长 / 中输出 / 中防御
- 圣骑副：低直接输出 / 高生存 / 高反制
- 战士副：高持续输出 / 中生存 / 高贴身压迫
- 猎人副：中输出 / 高控制 / 高节奏收益

这样玩家的副职业选择会更明确：
- 要稳：德鲁伊、圣骑
- 要滚雪球：术士、战士
- 要空间与节奏：法师、猎人

---

## 副职业入口卡提示原则

副职业入口卡会同时提供一个轻量、立即生效的通用数值收益，用来保证刚选到副职业时就有体感；更完整的玩法骨架仍然由后续 6 个节点负责展开。

建议入口卡文案方向：

- 法师副入口：获得奥能法阵，并使所有攻击间隔 -8%。
- 猎人副入口：获得陷阱体系，并使闪避率 +10%。
- 战士副入口：获得不屈战意，并使暴击率 +15%。
- 圣骑副入口：获得格挡与圣印，并使受到的伤害 -10%。
- 德鲁伊副入口：获得自然伙伴，并每秒恢复 0.8% 最大生命。
- 术士副入口：获得亡灵军势，并使造成的伤害 +8%。

---

## 设计落地建议

如果当前阶段要继续收敛设计量，建议副职业先按以下原则落地：

- 每个副职业先实现 4 个可运行节点
- 剩余 2 个作为成型节点，后续补进
- 最后一列优先做“玩法成型感”，而不是“数值最大化”
- 深度专精保留真正的终局级爆点：形态变化、多单位同场、规则改写、倍率突破

这样你就能把副职业控制在“够玩、够分流、够有风格”，同时把真正最爽的爆发和变形保留给深度专精 / 双职业。

---

## 副职业 36 节点草案（可落地版）

说明：
- 这里按你的最新定义整理：副职业只有一整块，不再区分内部列。
- 六个副职业各 6 个节点，总计 36 个节点。
- 默认都按 `maxLevel=3` 设计，便于统一点数节奏。
- 强度控制原则：副职业负责形成副玩法，不抢深度专精的终局爆点。
- 命名尽量兼容现有风格；已有 id 的节点优先保留，新增节点按当前项目命名方式补齐。

### 法师副职业：奥术 / 法阵体系（6）

- 奥能法阵（id=arcane_circle，maxLevel=3）
  - 1级：每 10 秒在玩家脚下生成 1 个法阵，持续 3 秒；阵内你的伤害 +10%
  - 2级：间隔缩短至 8 秒，持续 4 秒；阵内伤害提高至 +15%
  - 3级：间隔缩短至 6 秒，持续 5 秒；阵内伤害提高至 +20%

- 法阵扩张（id=arcane_circle_range，maxLevel=3）
  - 1级：法阵半径 +15%
  - 2级：法阵半径 +30%
  - 3级：法阵半径 +45%

- 烈焰法阵（id=arcane_fire_circle，maxLevel=3）
  - 1级：法阵结束时爆炸，造成 80% 攻击力范围伤害
  - 2级：爆炸伤害提升至 120%，范围 +20%
  - 3级：爆炸伤害提升至 160%，并附带 2 秒灼烧

- 冰霜法阵（id=arcane_frost_circle，maxLevel=3）
  - 1级：法阵内敌人移动速度 -20%
  - 2级：减速提高至 -30%
  - 3级：减速提高至 -40%，敌人离开法阵后仍保留 1 秒减速

- 共鸣刻印（id=arcane_resonance_mark，maxLevel=3）
  - 1级：奥能法阵提供的增伤额外 +6%
  - 2级：额外增伤提高至 +12%
  - 3级：额外增伤提高至 +18%

- 流动施法（id=arcane_flowcasting，maxLevel=3）
  - 1级：离开法阵后保留法阵增益 1 秒
  - 2级：保留时间延长至 2 秒
  - 3级：保留时间延长至 3 秒

定位说明：
- 输出节点：烈焰法阵、共鸣刻印
- 辅助节点：法阵扩张、冰霜法阵、流动施法

### 猎人副职业：游侠 / 陷阱体系（6）

- 绊索陷阱（id=ranger_snaretrap，maxLevel=3）
  - 1级：每 10 秒自动布置一个陷阱，触发后定身敌人 1 秒
  - 2级：间隔缩短至 8 秒，定身 1.5 秒
  - 3级：间隔缩短至 6 秒，定身 2 秒

- 猎手印记（id=ranger_huntmark，maxLevel=3）
  - 1级：被陷阱触发的敌人受到你的伤害 +10%
  - 2级：易伤提高至 +20%
  - 3级：易伤提高至 +30%

- 钉刺陷阱（id=ranger_spiketrap，maxLevel=3）
  - 1级：陷阱触发后造成 60% 攻击力伤害，并减速 25%
  - 2级：伤害提升至 90%，减速提高至 35%
  - 3级：伤害提升至 120%，减速提高至 45%

- 爆裂陷阱（id=ranger_blasttrap，maxLevel=3）
  - 1级：陷阱触发时额外爆炸，造成 80% 攻击力范围伤害
  - 2级：爆炸伤害提升至 120%
  - 3级：爆炸伤害提升至 160%，范围 +25%

- 熟练布置（id=ranger_trapcraft，maxLevel=3）
  - 1级：可同时存在的陷阱数量 +1
  - 2级：陷阱触发范围 +20%
  - 3级：同时存在陷阱数量再 +1，触发范围总计 +35%

- 围猎本能（id=ranger_pack_hunter，maxLevel=3）
  - 1级：你对被控制或被标记敌人的暴击率 +8%
  - 2级：暴击率提高至 +16%
  - 3级：暴击率提高至 +24%，暴击伤害额外 +20%

定位说明：
- 输出节点：爆裂陷阱、围猎本能
- 控制节点：绊索陷阱、钉刺陷阱、熟练布置

### 战士副职业：不屈 / 压迫体系（6）

- 血怒（id=unyielding_bloodrage，maxLevel=3）
  - 1级：生命每降低 10%，伤害 +2%
  - 2级：每层提高至 +3%
  - 3级：每层提高至 +4%

- 战吼（id=unyielding_battlecry，maxLevel=3）
  - 1级：受到伤害时，20% 概率触发 3 秒伤害 +10%
  - 2级：触发后伤害提高至 +20%
  - 3级：触发后伤害提高至 +30%

- 断筋（id=unyielding_hamstring，maxLevel=3）
  - 1级：近距离命中使敌人减速 15%，持续 1.5 秒
  - 2级：减速提高至 25%
  - 3级：减速提高至 35%，持续 2 秒

- 破甲（id=unyielding_sunder，maxLevel=3）
  - 1级：持续命中同一目标时，对其伤害 +6%
  - 2级：提高至 +12%
  - 3级：提高至 +18%

- 不退（id=unyielding_standfast，maxLevel=3）
  - 1级：近距离存在敌人时，受到伤害 -6%
  - 2级：减伤提高至 -12%
  - 3级：减伤提高至 -18%，并获得少量抗击退

- 处决本能（id=unyielding_executioner，maxLevel=3）
  - 1级：对生命低于 35% 的敌人伤害 +12%
  - 2级：伤害提高至 +24%
  - 3级：伤害提高至 +36%

定位说明：
- 输出节点：血怒、破甲、处决本能
- 压迫节点：战吼、断筋、不退

### 圣骑士副职业：守护 / 反制体系（6）

- 坚盾（id=guardian_block，maxLevel=3）
  - 1级：5% 概率格挡，格挡减伤 50%
  - 2级：格挡率提高至 8%
  - 3级：格挡率提高至 12%

- 护甲（id=guardian_armor，maxLevel=3）
  - 1级：所有受到的伤害 -2
  - 2级：固定减伤提高至 -4
  - 3级：固定减伤提高至 -6

- 反制（id=guardian_counter，maxLevel=3）
  - 1级：格挡成功后反击 80% 攻击力
  - 2级：反击提高至 120%
  - 3级：反击提高至 160%

- 庇护圣印（id=guardian_sacred_seal，maxLevel=3）
  - 1级：受击或格挡时积累 1 层圣印，上限 3 层
  - 2级：圣印上限提高至 4 层
  - 3级：圣印上限提高至 5 层

- 神圣回击（id=guardian_holy_rebuke，maxLevel=3）
  - 1级：累计满圣印后，下次格挡或受击触发一次 100% 攻击力范围冲击
  - 2级：冲击伤害提高至 150%
  - 3级：冲击伤害提高至 200%，并附带 20% 减速 2 秒

- 光铸壁垒（id=guardian_light_fortress，maxLevel=3）
  - 1级：生命低于 30% 时，自动消耗全部圣印生成护盾，每层圣印提供 4% 最大生命护盾
  - 2级：每层圣印护盾提高至 6%
  - 3级：每层圣印护盾提高至 8%

定位说明：
- 输出节点：反制、神圣回击
- 防御节点：坚盾、护甲、庇护圣印、光铸壁垒

入口卡提示：
- 获得格挡与圣印，并使受到的伤害 -10%。格挡负责减伤与反击，圣印负责转化为冲击和护盾收益。

### 德鲁伊副职业：自然伙伴体系（6）

- 熊灵（id=druid_pet_bear，maxLevel=3）
  - 1级：召唤 1 只熊灵，负责近战拦截
  - 2级：熊灵生命与仇恨能力提升
  - 3级：熊灵伤害与减伤进一步提升

- 战鹰（id=druid_pet_hawk，maxLevel=3）
  - 1级：召唤 1 只战鹰，负责高频打击
  - 2级：战鹰攻速与索敌半径提升
  - 3级：战鹰攻击附带更高追击倾向

- 树精（id=druid_pet_treant，maxLevel=3）
  - 1级：召唤 1 只树精，周期治疗玩家
  - 2级：治疗量与频率提升
  - 3级：治疗额外附带小额护盾

- 熊灵守护（id=nature_bear_guard，maxLevel=3）
  - 1级：熊灵更容易吸引敌人，玩家受击时熊灵分担 8% 伤害
  - 2级：分担提高至 16%
  - 3级：分担提高至 24%，熊灵受击时有概率震地减速周围敌人

- 战鹰猎印（id=nature_hawk_huntmark，maxLevel=3）
  - 1级：战鹰命中的敌人被标记，你对其伤害 +8%
  - 2级：增伤提高至 +16%
  - 3级：增伤提高至 +24%，且对 Boss 同样稳定生效

- 树精繁茂（id=nature_treant_bloom，maxLevel=3）
  - 1级：树精治疗量 +15%，并有 15% 概率附带 2% 最大生命护盾
  - 2级：治疗量提高至 +30%，护盾概率提高至 30%
  - 3级：治疗量提高至 +45%，护盾概率提高至 45%

定位说明：
- 输出节点：战鹰契约、战鹰猎印
- 辅助节点：熊灵契约、树精契约、熊灵守护、树精繁茂

实现备注：
- 德鲁伊副已改为同池可全拿结构。
- 实际体验是逐步补齐熊、鹰、树三种伙伴，再获得对应强化。

### 术士副职业：诅咒 / 亡灵体系（6）

- 死灵共鸣（id=curse_necrotic_vitality，maxLevel=3）
  - 1级：召唤物生命 +12%
  - 2级：提高至 +24%
  - 3级：提高至 +36%

- 骷髅卫士（id=curse_skeleton_guard，maxLevel=3）
  - 1级：召唤近战骷髅卫士，上限 1
  - 2级：上限提高至 3
  - 3级：上限提高至 5

- 骷髅法师（id=curse_skeleton_mage，maxLevel=3）
  - 1级：召唤远程骷髅法师，上限 1
  - 2级：上限提高至 3
  - 3级：上限提高至 5

- 白骨灌能（id=curse_mage_empower，maxLevel=3）
  - 1级：骷髅法师伤害 +15%
  - 2级：骷髅法师伤害提高至 +30%
  - 3级：骷髅法师伤害提高至 +45%，攻击间隔额外缩短 15%

- 骸骨壁垒（id=curse_guard_bulwark，maxLevel=3）
  - 1级：骷髅卫士生命额外 +20%，受到伤害 -10%
  - 2级：生命提高至 +40%，减伤提高至 -15%
  - 3级：生命提高至 +60%，减伤提高至 -20%，并提高拦截倾向

- 魂火余烬（id=curse_ember_echo，maxLevel=3）
  - 1级：每当一名召唤物死亡，你获得 1 层魂火，持续 4 秒；每层使伤害 +3%，最多 3 层
  - 2级：每层同时提供 2% 减伤，最多 3 层
  - 3级：魂火持续时间延长至 6 秒；每层伤害提高至 +4%，减伤提高至 3%

定位说明：
- 输出节点：骷髅法师、白骨灌能
- 辅助/成长节点：死灵共鸣、骷髅卫士、骸骨壁垒、魂火余烬

---

## 36 节点汇总视图

为便于后续转进 `UNIVERSAL_POOLS`，这里汇总一次：

- 法师副
  - `arcane_circle`
  - `arcane_circle_range`
  - `arcane_fire_circle`
  - `arcane_frost_circle`
  - `arcane_resonance_mark`
  - `arcane_flowcasting`

- 猎人副
  - `ranger_snaretrap`
  - `ranger_huntmark`
  - `ranger_spiketrap`
  - `ranger_blasttrap`
  - `ranger_trapcraft`
  - `ranger_pack_hunter`

- 战士副
  - `unyielding_bloodrage`
  - `unyielding_battlecry`
  - `unyielding_hamstring`
  - `unyielding_sunder`
  - `unyielding_standfast`
  - `unyielding_executioner`

- 圣骑副
  - `guardian_block`
  - `guardian_armor`
  - `guardian_counter`
  - `guardian_sacred_seal`
  - `guardian_holy_rebuke`
  - `guardian_light_fortress`

- 德鲁伊副
  - `druid_pet_bear`
  - `druid_pet_hawk`
  - `druid_pet_treant`
  - `nature_bear_guard`
  - `nature_hawk_huntmark`
  - `nature_treant_bloom`

- 术士副
  - `curse_necrotic_vitality`
  - `curse_skeleton_guard`
  - `curse_skeleton_mage`
  - `curse_mage_empower`
  - `curse_guard_bulwark`
  - `curse_ember_echo`
