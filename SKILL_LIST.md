# 技能列表总览

本文档整理当前项目内所有“技能/天赋/专精”节点，按以下维度归类：
- 主基础技能：选择某个核心后获得的基础攻击形态（主职业决定）
- 主职业专精：只在主职业生效（来自 `UPGRADE_POOLS`）
- 副职业（派系）技能：作为副职业提供的通用被动（来自 `UNIVERSAL_POOLS`）
- 自然伙伴（副职业的一种）：结契与分支强化（来自 `NATURE_CONTRACT_OPTIONS` / `NATURE_BRANCH_POOLS`）
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
- 射程（id=archer_range，maxLevel=3）：基础射击射程提升
- 射速（id=archer_rate，maxLevel=3）：基础射击攻速提升
- 攻击力（id=archer_damage，maxLevel=3）：基础射击伤害提升
- 散射（id=archer_scatter，maxLevel=3）：散射升级（1列→3列→5列）

### 德鲁伊·星落（coreKey=drone）
- 流星雨（id=druid_meteor_shower）：星落数量 +2，但单次伤害略降
- 陨石（id=druid_meteor）：每 10 秒下一次星落变为巨型陨石（更大范围/更高伤害）
- 星火（id=druid_starfire）：星落命中后 30% 概率同位置额外触发一次（不连锁）

### 战士·近战挥砍（coreKey=warrior）
- 回旋（id=warrior_spin）：挥砍变为 360° 回旋斩
- 剑气（id=warrior_swordqi）：挥砍额外发射月牙剑气（保留近战判定）
- 持久（id=warrior_endure）：近战形态获得 20% 伤害减免
- 月牙扩展（id=warrior_range）：月牙斩有效范围提升（可叠加）

### 法师·激光（coreKey=mage）
- 折射（id=mage_refract）：额外生成 2 道较短折射光束
- 过热（id=mage_overheat）：持续命中 3 秒后爆炸造成范围伤害
- 蓄能（id=mage_charge）：每 2 秒充能；下一次攻击 3 倍伤害并击退
- 奥术感知（id=mage_arcane_perception，maxLevel=3）：索敌范围提升
- 能量汇集（id=mage_energy_focus，maxLevel=3）：射线伤害提升并随层数更粗更亮
- 奥术分裂（id=mage_arcane_split，maxLevel=3）：多目标时额外分裂射线（分裂伤害 50%）

### 圣骑士（coreKey=paladin）
- 重锤（id=paladin_pierce）：锤击范围略扩大，落点更靠前
- 圣焰（id=paladin_holyfire）：锤击命中后留下圣焰持续伤害
- 连锤（id=paladin_triple）：每 5 秒下一次锤击额外追加 2 次余震
- 制裁（id=paladin_stun，maxLevel=3）：锤击眩晕概率 10%/20%/30%

### 术士（coreKey=warlock）
- 毒性浓度（id=warlock_toxicity，maxLevel=3）：剧毒 debuff 最大层数 +1
- 腐蚀（id=warlock_corrode，maxLevel=3）：毒圈持续时间 +1 秒
- 扩散（id=warlock_spread，maxLevel=3）：毒圈范围 +20%

---

## 副职业（派系）技能（纯被动）

这些技能来自副职业派系选择（registry: `offFaction`），不会切换基础攻击形态。

### 奥术（offFaction=arcane）
- 迅捷（id=arcane_swift）：所有攻击冷却/间隔 -8%
- 启迪（id=arcane_enlighten）：升级选项数 +1（三选一→四选一）
- 法阵（id=arcane_circle）：站立不动 2 秒生成法阵，阵内攻击力 +20%，移动消失

### 游侠（offFaction=ranger）
- 精准（id=ranger_precise）：暴击率 +10%
- 灵巧（id=ranger_agile）：闪避率 +8%
- 猎手（id=ranger_hunter）：对生命值 >80% 的敌人暴击率额外 +15%

### 不屈（offFaction=unyielding）
- 血怒（id=unyielding_bloodrage）：生命值每降低 10%，伤害 +3%
- 战吼（id=unyielding_battlecry）：受伤时 20% 概率触发 3 秒伤害 +15%
- 死斗（id=unyielding_duel）：生命值 <30% 时攻速 +25%

### 诅咒（offFaction=curse）
- 腐蚀（id=curse_corrosion）：攻击 15% 概率施加剧毒 DoT（3 秒）
- 虚弱（id=curse_weakness）：攻击 20% 概率使敌人伤害 -15%（3 秒）
- 凋零（id=curse_wither）：持续伤害效果可叠加 2 层

### 守护（offFaction=guardian）
- 坚盾（id=guardian_block）：5% 概率格挡，格挡减伤 50%
- 护甲（id=guardian_armor）：所有受到的伤害 -3（固定减伤）
- 反制（id=guardian_counter）：格挡成功后反击 100% 攻击力

---

## 自然伙伴（副职业：结契与分支强化）

### 结契（三选一）
- 契约：熊灵（id=druid_pet_bear）：坦克/嘲讽
- 契约：战鹰（id=druid_pet_hawk）：高频打击
- 契约：树精（id=druid_pet_treant）：周期治疗

### 熊系强化（NATURE_BRANCH_POOLS.bear）
- 共担（id=nature_bear_solidarity）：玩家受击时熊灵承担部分伤害
- 蛮力（id=nature_bear_strength）：提高攻击力
- 甲壳（id=nature_bear_carapace）：降低受到的伤害
- 自然之怒（id=nature_bear_rage）：熊灵受击后短时间增伤
- 震地（id=nature_bear_earthquake）：熊灵受击时概率眩晕 Boss
- 荆棘护体（id=nature_bear_thornshield）：提高反伤比例

### 鹰系强化（NATURE_BRANCH_POOLS.hawk）
- 锐眼（id=nature_hawk_crit）：暴击率提升
- 疾羽（id=nature_hawk_evade）：闪避率提升
- 风行（id=nature_hawk_speed）：移动速度提升
- 风刃（id=nature_hawk_windslash）：周期性追加伤害
- 天降（id=nature_hawk_skycall）：概率触发额外打击
- 猎手标记（id=nature_hawk_huntmark）：命中后上标记，提高你对 Boss 伤害

### 树精强化（NATURE_BRANCH_POOLS.treant）
- 回春（id=nature_treant_regen）：提高治疗量/频率
- 缠绕（id=nature_treant_root）：治疗时概率短暂定身 Boss
- 树皮（id=nature_treant_armor）：提高固定减伤
- 荆棘（id=nature_treant_thorns）：提高反伤比例
- 萌芽（id=nature_treant_summon）：治疗时概率额外提供护盾
- 再生（id=nature_treant_reborn）：树精回归冷却更短

---

## 第三天赋：深度专精（主/副同主题）

深度专精的节点池按主职业主题（mainCoreKey）区分：

- 法师深度（mainCoreKey=mage）
  - 双倍施法（id=mage_dualcaster）
  - 三重激光（id=mage_trilaser）
  - 奥术化身（id=mage_arcanomorph，maxLevel=3）

- 猎人深度（mainCoreKey=scatter）
  - 百发百中（id=archer_hundred，maxLevel=3）
  - 疾风连射（id=archer_windfury）
  - 鹰眼化身（id=archer_eagleeye）
  - 箭矢弹射（id=archer_bounce）

- 战士深度（mainCoreKey=warrior）
  - 剑刃风暴（id=warrior_bladestorm）
  - 战神下凡（id=warrior_berserkgod，maxLevel=3）
  - 不灭化身（id=warrior_unyielding）

- 术士深度（mainCoreKey=warlock）
  - 无限回响（id=warlock_infinite）
  - 噬魂者（id=warlock_souleater，maxLevel=3）
  - 虚空领主（id=warlock_netherlord）
  - 索敌毒径（id=warlock_autoseek）

- 圣骑深度（mainCoreKey=paladin）
  - 复仇者（id=paladin_avenger，maxLevel=3）
  - 圣盾术（id=paladin_sacredshield）
  - 神圣化身（id=paladin_divine）

- 德鲁伊深度（mainCoreKey=drone）
  - 万兽之主（id=druid_kingofbeasts）
  - 自然化身（id=druid_naturefusion）
  - 星辰风暴（id=druid_astralstorm，maxLevel=3）

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
