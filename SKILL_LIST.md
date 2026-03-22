# MOVA 技能总表

本文档按当前代码整理，主要以 [src/classes/upgradePools.js](src/classes/upgradePools.js)、[src/classes/upgradeOfferPresentation.js](src/classes/upgradeOfferPresentation.js) 与 [src/classes/talentTrees.js](src/classes/talentTrees.js) 为准。

## 说明

- 主职业核心：决定基础攻击形态。
- 主职业专精：只对主职业生效。
- 副职业入口：解锁副职业派系与入口被动。
- 副职业通用池：不切主武器，只提供副玩法系统与被动。
- 深度预备：主副同主题时出现，进入本职业深度专精。
- 双职预备：主副不同主题时出现，进入双职业专精。
- 多级节点统一展开为 Lv1 / Lv2 / Lv3；战士的 [warrior_range](src/classes/upgradePools.js) 当前仍是 4 级。
- 旧 id 别名：mage_refract -> mage_frostbite，mage_arcane_perception -> mage_cold_focus，mage_energy_focus -> mage_ice_veins。
- 以下 5 个深度节点当前代码只记录等级档位，尚未接入明确数值公式：mage_arcanomorph、warrior_berserkgod、warlock_souleater、paladin_avenger、druid_astralstorm。

## 猎人

### 主职业核心

- archer_core：Lv1 解锁箭矢连射。

### 主职业专精

- archer_range，3级：Lv1 基础射击射程加成 0% -> 12%；Lv2 12% -> 24%；Lv3 24% -> 36%。
- archer_volley，3级：Lv1 箭列数 3 -> 5；Lv2 维持 5 列并收束散射角、强化锁定；Lv3 箭列数 5 -> 7。
- archer_nimble_evade，3级：Lv1 低血自动闪避 0% -> 40%，持续 3 秒，冷却 30 秒；Lv2 40% -> 60%；Lv3 60% -> 80%。
- archer_evade_mastery，3级：Lv1 灵巧回避持续时间 3秒 -> 5秒；Lv2 5秒 -> 8秒；Lv3 8秒 -> 10秒。

### 作为副职业：猎人

- off_ranger：Lv1 解锁猎人副职业，闪避率 +10%；基础每 10 秒自动布置 1 个诱饵假人，持续 15 秒，划定吸引范围并向圈内优先目标射出单发箭矢。
- ranger_snaretrap，3级：Lv1 牵引半径 172 -> 194、箭矢伤害系数 18% -> 24%、定身时长 0毫秒 -> 260毫秒；Lv2 半径 194 -> 216、伤害 24% -> 32%、定身 260毫秒 -> 380毫秒；Lv3 半径 216 -> 238、伤害 32% -> 42%、定身 380毫秒 -> 520毫秒。
- ranger_huntmark，3级：Lv1 猎印承伤 0% -> 10%，持续 0秒 -> 3.9秒；Lv2 10% -> 16%，持续 3.9秒 -> 4.3秒；Lv3 16% -> 22%，持续 4.3秒 -> 4.7秒。
- ranger_spiketrap，3级：Lv1 爆炸追加伤害 0% -> 18%，持续伤害系数 0% -> 8%，持续时间 0秒 -> 2.2秒；Lv2 爆炸 18% -> 26%，持续伤害 8% -> 12%，持续时间 2.2秒 -> 3.0秒；Lv3 爆炸 26% -> 36%，持续伤害 12% -> 18%，持续时间 3.0秒 -> 3.8秒。
- ranger_blasttrap，3级：Lv1 结束爆炸伤害系数 55% -> 78%；Lv2 78% -> 102%；Lv3 102% -> 135%。
- ranger_trapcraft，3级：Lv1 部署间隔 10.0秒 -> 8.8秒；Lv2 部署间隔 8.8秒 -> 7.6秒，并存假人上限 1 -> 2；Lv3 部署间隔 7.6秒 -> 6.4秒，并存上限维持 2。
- ranger_pack_hunter，3级：Lv1 对猎印目标暴击率 0% -> 6%，暴击伤害 0% -> 12%；Lv2 暴击率 6% -> 10%，暴击伤害 12% -> 20%；Lv3 暴击率 10% -> 14%，暴击伤害 20% -> 30%。

### 深度专精

- third_depth_prep：Lv1 解锁猎人深度专精，并获得暴击率 +30%。
- archer_bounce：Lv1 反射猎场，箭矢可在墙体与边界间反弹，优先继续追猎最近敌人。
- archer_windfury：Lv1 暴风裂羽，每轮散射额外追加一组延迟二段箭幕。
- archer_eagleeye：Lv1 终局鹰眼，所有散射箭获得更高暴击权重，并进一步提高对被标记目标的暴击上限。

## 德鲁伊

### 主职业核心

- druid_core：Lv1 解锁星落，定位敌方后从空中下落造成范围伤害。

### 主职业专精

- druid_meteor_shower：Lv1 星落数量 +2，但单次伤害略微降低。
- druid_meteor：Lv1 每 10 秒，下一次星落变为巨型陨石，范围更大、伤害更高。
- druid_starfire：Lv1 星落命中后有 30% 概率在同位置额外触发一次，不连锁。
- druid_nourish，3级：Lv1 30% 总治疗在 15 秒内完成，冷却 30 秒；Lv2 压缩到 10 秒；Lv3 压缩到 5 秒。
- druid_nourish_growth，3级：Lv1 自然滋养总回复加成 0% -> 50%；Lv2 50% -> 80%；Lv3 80% -> 100%。

### 作为副职业：自然伙伴

- off_nature：Lv1 解锁德鲁伊副职业，立即获得 1 只熊灵，作为前排肉盾协同作战。
- druid_pet_bear，3级：Lv1 熊灵生命系数 72% -> 90%，伤害系数 92% -> 112%；Lv2 生命 90% -> 108%，伤害 112% -> 132%；Lv3 生命 108% -> 126%，伤害 132% -> 152%。
- druid_pet_hawk，3级：Lv1 战鹰攻击间隔 520毫秒 -> 458毫秒，伤害系数 18% -> 23%；Lv2 458毫秒 -> 395毫秒，伤害 23% -> 28%；Lv3 395毫秒 -> 333毫秒，伤害 28% -> 33%。
- druid_pet_treant，3级：Lv1 树精治疗量 4 -> 6，治疗间隔 3.00秒 -> 2.74秒；Lv2 治疗量 6 -> 8，间隔 2.74秒 -> 2.48秒；Lv3 治疗量 8 -> 10，间隔 2.48秒 -> 2.22秒。
- nature_bear_guard，3级：Lv1 熊灵分担伤害 0% -> 8%；Lv2 8% -> 16%；Lv3 16% -> 24%，并额外解锁震地减速。
- nature_hawk_huntmark，3级：Lv1 战鹰猎印增伤 0% -> 8%，对 Boss 生效率 0% -> 45%；Lv2 增伤 8% -> 16%，Boss 生效率 45% -> 70%；Lv3 增伤 16% -> 24%，Boss 生效率 70% -> 100%。
- nature_treant_bloom，3级：Lv1 树精治疗加成 0% -> 15%，附盾概率 0% -> 15%；Lv2 治疗 15% -> 30%，附盾 15% -> 30%；Lv3 治疗 30% -> 45%，附盾 30% -> 45%；护盾值固定为 2% 最大生命。

### 深度专精

- third_depth_prep：Lv1 解锁德鲁伊深度专精，并获得攻击间隔 -30%。
- druid_kingofbeasts：Lv1 群星坠世，星落覆盖范围显著扩大，单次施法落点数提升。
- druid_naturefusion：Lv1 连星陨爆，陨石命中后引发二次流星坠击。
- druid_astralstorm，3级：Lv1 / Lv2 / Lv3 当前仅记录为星落循环提速档位，代码尚未接入明确数值公式。

## 战士

### 主职业核心

- warrior_core：Lv1 攻击变为近战挥砍。

### 主职业专精

- warrior_spin：Lv1 挥砍变为 360° 回旋斩，造成范围伤害。
- warrior_swordqi：Lv1 挥砍时额外发射一道月牙剑气。
- warrior_endure：Lv1 战士近战形态获得 20% 伤害减免。
- warrior_range，4级：Lv1 月牙斩基础范围 220 -> 245；Lv2 245 -> 270；Lv3 270 -> 295；Lv4 295 -> 320。
- warrior_blood_conversion，3级：Lv1 解锁低血吸血，持续 5 秒，吸血转化固定 100%，冷却 30 秒；Lv2 持续时间 5秒 -> 10秒；Lv3 10秒 -> 15秒。
- warrior_bloodlust_mastery，3级：Lv1 吸血转化 100% -> 120%；Lv2 120% -> 150%；Lv3 150% -> 200%。

### 作为副职业：不屈

- off_unyielding：Lv1 解锁战士副职业，暴击率 +10%；生命每损失 10%，伤害 +2%。
- unyielding_bloodrage，3级：Lv1 每损失 10% 生命的增伤 0% -> 2%；Lv2 2% -> 3%；Lv3 3% -> 4%。
- unyielding_battlecry，3级：Lv1 战吼增伤 0% -> 10%，持续 3 秒；Lv2 10% -> 20%；Lv3 20% -> 30%。
- unyielding_hamstring，3级：Lv1 断筋减速 0% -> 15%，持续 0秒 -> 1.5秒；Lv2 15% -> 25%，持续维持 1.5 秒；Lv3 25% -> 35%，持续 1.5秒 -> 2秒。
- unyielding_sunder，3级：Lv1 破甲承伤 0% -> 6%；Lv2 6% -> 12%；Lv3 12% -> 18%。
- unyielding_standfast，3级：Lv1 贴身减伤 0% -> 6%；Lv2 6% -> 12%；Lv3 12% -> 18%，并额外获得抗击退。
- unyielding_executioner，3级：Lv1 对 35% 以下生命目标伤害加成 0% -> 12%；Lv2 12% -> 24%；Lv3 24% -> 36%。

### 深度专精

- third_depth_prep：Lv1 解锁战士深度专精，并获得造成伤害 +30%。
- warrior_bladestorm：Lv1 永动旋刃，进入持续旋转状态，移动中也不会中断主攻节奏。
- warrior_berserkgod，3级：Lv1 / Lv2 / Lv3 当前仅记录为破风利刃密度档位，代码尚未接入明确数值公式。
- warrior_unyielding：Lv1 暴走战躯，血怒、战吼、处决本能收益上限全部提高，低血时旋转更快、剑刃更多。

## 法师

### 主职业核心

- mage_core：Lv1 攻击变为冰弹，命中叠寒霜，叠满 5 层后爆炸并传染。

### 主职业专精

- mage_frostbite，3级：Lv1 冰弹减速 22% -> 30%，持续 1.5秒 -> 1.9秒；Lv2 30% -> 38%，持续 1.9秒 -> 2.3秒；Lv3 38% -> 48%，持续 2.3秒 -> 2.7秒。
- mage_cold_focus，3级：Lv1 冰弹索敌范围 +0 -> +45；Lv2 +45 -> +90；Lv3 +90 -> +135。
- mage_ice_veins，3级：Lv1 冰弹伤害加成 0% -> 10%；Lv2 10% -> 20%；Lv3 20% -> 30%。
- mage_deep_freeze，3级：Lv1 额外冻结时长 0秒 -> 0.8秒；Lv2 0.8秒 -> 1.2秒；Lv3 1.2秒 -> 1.7秒。
- mage_shatter，3级：Lv1 碎冰半径 0 -> 120，伤害 0% -> 70%，传染 1 层寒霜；Lv2 半径 120 -> 150，伤害 70% -> 100%；Lv3 半径 150 -> 185，伤害 100% -> 135%，传染层数 1 -> 2。
- mage_frost_nova，3级：Lv1 冰霜新星冻结时长 0秒 -> 3秒，冷却 30 秒；Lv2 3秒 -> 5秒；Lv3 5秒 -> 10秒。
- mage_frost_domain，3级：Lv1 冰霜新星范围 0 -> 300；Lv2 300 -> 380；Lv3 380 -> 480。

### 作为副职业：奥术

- off_arcane：Lv1 解锁法师副职业，所有攻击间隔 -8%；基础每 10 秒自动部署 1 座奥术炮台，驻场 15 秒，并向射程内目标发射粗直线贯穿激光。
- arcane_circle，3级：Lv1 法阵内增伤 0% -> 8%，部署间隔 10.0秒 -> 9.3秒，开火间隔 3.00秒 -> 2.78秒；Lv2 增伤 8% -> 16%，部署间隔 9.3秒 -> 8.6秒，开火间隔 2.78秒 -> 2.56秒；Lv3 增伤 16% -> 24%，部署间隔 8.6秒 -> 7.9秒，开火间隔 2.56秒 -> 2.34秒。
- arcane_circle_range，3级：Lv1 炮台索敌范围 380 -> 460；Lv2 460 -> 540；Lv3 540 -> 620。
- arcane_fire_circle，3级：Lv1 炮台激光额外伤害系数 0% -> 24%；Lv2 24% -> 48%；Lv3 48% -> 72%。
- arcane_frost_circle，3级：Lv1 炮台驻场时间 15.0秒 -> 16.8秒；Lv2 16.8秒 -> 18.6秒；Lv3 18.6秒 -> 20.4秒。
- arcane_resonance_mark，3级：Lv1 激光易伤倍率 0% -> 6%；Lv2 6% -> 12%；Lv3 12% -> 18%。
- arcane_flowcasting，3级：Lv1 部署间隔额外缩短 0秒 -> 0.9秒，等效为 10.0秒 -> 9.1秒；Lv2 额外缩短 0.9秒 -> 1.8秒，并存炮台上限 1 -> 2，等效为 9.1秒 -> 8.2秒；Lv3 额外缩短 1.8秒 -> 2.7秒，并存炮台上限 2 -> 3，等效为 8.2秒 -> 7.3秒。

### 深度专精

- third_depth_prep：Lv1 解锁法师深度专精，并获得攻击间隔 -30%。
- mage_dualcaster：Lv1 星界贯炮，激光变为巨粗贯穿光束，立刻进入终局主炮手感。
- mage_trilaser：Lv1 棱镜超载，激光命中后会在主目标后方继续裂出副光束。
- mage_arcanomorph，3级：Lv1 / Lv2 / Lv3 当前仅记录为奥术叠界强度档位，代码尚未接入明确数值公式。

## 圣骑士

### 主职业核心

- paladin_core：Lv1 解锁护盾脉冲体系，清弹并反击。

### 主职业专精

- paladin_pierce：Lv1 提升锤击范围与伤害。
- paladin_repulse：Lv1 锤击命中附带明显击退，更难让敌人贴身。
- paladin_triple：Lv1 每 5 秒，下一次锤击额外追加 2 次余震落点。
- paladin_stun，3级：Lv1 锤击眩晕率 0% -> 10%；Lv2 10% -> 20%；Lv3 20% -> 30%。
- paladin_divine_shelter，3级：Lv1 低血减伤 0% -> 40%，持续 5 秒，冷却 30 秒；Lv2 40% -> 60%；Lv3 60% -> 80%。
- paladin_shelter_extension，3级：Lv1 神圣庇护持续时间 5秒 -> 8秒；Lv2 8秒 -> 10秒；Lv3 10秒 -> 12秒。

### 作为副职业：守护

- off_guardian：Lv1 解锁圣骑士副职业，受到伤害 -10%；获得格挡与圣印。
- guardian_block，3级：Lv1 格挡率 0% -> 5%，格挡减伤固定 50%；Lv2 5% -> 10%；Lv3 10% -> 15%。
- guardian_armor，3级：Lv1 固定减伤 0 -> 2；Lv2 2 -> 4；Lv3 4 -> 6。
- guardian_counter，3级：Lv1 反击伤害 0% -> 80%；Lv2 80% -> 120%；Lv3 120% -> 160%。
- guardian_sacred_seal，3级：Lv1 圣印上限 0 -> 3，单层减伤 0% -> 2%；Lv2 上限 3 -> 4，单层减伤 2% -> 3%；Lv3 上限 4 -> 5，单层减伤 3% -> 4%。
- guardian_holy_rebuke，3级：Lv1 神圣回击半径 0 -> 120，伤害 0% -> 100%；Lv2 半径 120 -> 135，伤害 100% -> 150%；Lv3 半径 135 -> 150，伤害 150% -> 200%，并追加 0.5 秒冻结。
- guardian_light_fortress，3级：Lv1 每层圣印护盾转化 0% -> 4%；Lv2 4% -> 6%；Lv3 6% -> 8%。

### 深度专精

- third_depth_prep：Lv1 解锁圣骑士深度专精，并获得造成伤害 +30%。
- paladin_avenger，3级：Lv1 / Lv2 当前仅记录为震退反制强度档位；Lv3 当前占位说明为可追加眩晕，但代码尚未接入明确数值公式。
- paladin_sacredshield：Lv1 圣棘回响，格挡、受击、反制时都会反弹一部分神圣伤害。
- paladin_divine：Lv1 审判禁区，神圣回击、反制、击退彼此联动，在身边形成难以逼近的审判区。

## 术士

### 主职业核心

- warlock_core：Lv1 解锁剧毒新星，周期在脚下留下扩散毒圈。

### 主职业专精

- warlock_toxicity，3级：Lv1 剧毒最大层数 0 -> 1；Lv2 1 -> 2；Lv3 2 -> 3。
- warlock_corrode，3级：Lv1 毒圈持续时间加成 0秒 -> 1秒；Lv2 1秒 -> 2秒；Lv3 2秒 -> 3秒。
- warlock_spread，3级：Lv1 毒圈范围加成 0% -> 20%；Lv2 20% -> 40%；Lv3 40% -> 60%。
- warlock_infernal，3级：Lv1 地狱火生命系数 0% -> 85%，伤害系数 0% -> 110%，每击回复 0 -> 8；Lv2 生命 85% -> 110%，伤害 110% -> 145%，回复 8 -> 14；Lv3 生命 110% -> 145%，伤害 145% -> 185%，回复 14 -> 22。
- warlock_infernal_contract，3级：Lv1 生命消耗 15% -> 10%；Lv2 10% -> 5%；Lv3 5% -> 0%。

### 作为副职业：召唤

- off_summon：Lv1 解锁召唤副职业，造成伤害 +8%；立即获得 1 名骷髅卫士与 1 名骷髅法师。
- summon_necrotic_vitality，3级：Lv1 召唤物生命加成 0% -> 12%；Lv2 12% -> 24%；Lv3 24% -> 36%。
- summon_skeleton_guard，3级：Lv1 骷髅卫士总上限 1 -> 3；Lv2 3 -> 5；Lv3 5 -> 7。
- summon_skeleton_mage，3级：Lv1 骷髅法师总上限 1 -> 3；Lv2 3 -> 5；Lv3 5 -> 7。
- summon_mage_empower，3级：Lv1 骷髅法师伤害加成 0% -> 15%；Lv2 15% -> 30%；Lv3 30% -> 45%，并额外获得 15% 攻击间隔缩短。
- summon_guard_bulwark，3级：Lv1 卫士生命加成 0% -> 20%，承伤减免 0% -> 10%；Lv2 生命 20% -> 40%，减免 10% -> 15%；Lv3 生命 40% -> 60%，减免 15% -> 20%，并强化拦截倾向。
- summon_ember_echo，3级：Lv1 每次亡灵死亡获得魂火层数 0 -> 1，层数上限 0 -> 3；Lv2 层数上限 3 -> 5；Lv3 每次死亡获得层数 1 -> 2，层数上限 5 -> 6；每层伤害固定 +4%，持续 6 秒。

### 深度专精

- third_depth_prep：Lv1 解锁术士深度专精，并获得造成伤害 +30%。
- warlock_autoseek：Lv1 瘟疫疆域，毒圈会主动缓慢索敌并向敌群漂移，多个毒圈靠近时可融合。
- warlock_souleater，3级：Lv1 / Lv2 / Lv3 当前仅记录为腐灭连环扩散强度档位，代码尚未接入明确数值公式。
- warlock_netherlord：Lv1 炼狱君王，地狱火显著强化，并持续放大毒圈伤害、范围与压场能力。

## 第三天赋预备节点

- third_depth_prep：单级。按主职业给固定预备加成。法师、德鲁伊为攻击间隔 -30%；猎人为暴击率 +30%；战士、术士、圣骑士为造成伤害 +30%。
- third_dual_prep：单级。按主职业给予 15% 主轴加成，再按副职业给予 10% 风格加成。主轴加成为：法师攻击间隔 -15%，猎人暴击率 +15%，战士/术士/圣骑士造成伤害 +15%，德鲁伊攻击间隔 -15%。风格加成为：奥术攻击间隔 -10%，猎人闪避率 +10%，不屈暴击率 +10%，召唤造成伤害 +10%，守护受到伤害 -10%，自然伙伴每秒恢复 1% 最大生命。

## 双职业专精

### 自定义组合

- 法师 + 德鲁伊
- dual_mage_druid_arcanebear：Lv1 奥术之熊，熊灵继承法阵效果，在法阵内减伤 +20%、攻击力 +30%。
- dual_mage_druid_starwisdom，3级：Lv1 星落命中后的激光冷却缩减 0% -> 2%；Lv2 2% -> 4%；Lv3 4% -> 6%；上限 30%。
- dual_mage_druid_natureoverflow：Lv1 自然溢流，自然伙伴节点出现权重提高，且熊灵、战鹰、树精强化不会晚于对应宠物本体出现。

- 猎人 + 法师
- dual_scatter_mage_enchantedarrow：Lv1 附魔箭矢，箭矢有 20% 概率附加一次激光伤害，系数 50%。
- dual_scatter_mage_hastefocus，3级：Lv1 猎人攻速 0% -> 5%，法师迅捷加成 0% -> 2%；Lv2 猎人攻速 5% -> 10%，法师迅捷 2% -> 4%；Lv3 猎人攻速 10% -> 15%，法师迅捷 4% -> 6%。
- dual_scatter_mage_archercircle：Lv1 射手法阵，可以在法阵内移动，且法阵内暴击伤害 +30%。

- 战士 + 圣骑士
- dual_warrior_paladin_crusade：Lv1 十字军，旋风斩每命中一个敌人，格挡率 +5%，持续 3 秒，可叠加。
- dual_warrior_paladin_righteousrage，3级：Lv1 每层血怒额外增伤 0% -> 1%，血怒格挡率 0% -> 10%；Lv2 额外增伤 1% -> 2%，格挡率 10% -> 20%；Lv3 额外增伤 2% -> 3%，格挡率 20% -> 30%。
- dual_warrior_paladin_sacredspin：Lv1 神圣旋风，旋风斩转为神圣伤害，对亡灵或恶魔伤害 +50%。

- 术士 + 德鲁伊
- dual_warlock_druid_decay：Lv1 腐败滋养，宠物攻击时有 25% 概率施加腐蚀，且腐蚀伤害可治疗宠物。
- dual_warlock_druid_witheringroar：Lv1 凋零咆哮，熊灵咆哮时对周围敌人施加虚弱，伤害 -20%。
- dual_warlock_druid_soulbloom，3级：Lv1 树精净化概率 0% -> 10%；Lv2 10% -> 20%；Lv3 20% -> 30%。

- 圣骑士 + 猎人
- dual_paladin_scatter_holyrain：Lv1 圣光箭雨，箭雨转为神圣箭雨，额外造成 20% 神圣伤害并致盲 1 秒。
- dual_paladin_scatter_blessedquiver，3级：Lv1 额外暴击率 0% -> 3%，暴击回血概率 0% -> 20%；Lv2 暴击率 3% -> 6%，回血概率 20% -> 40%；Lv3 暴击率 6% -> 9%，回血概率 40% -> 60%。
- dual_paladin_scatter_retribution：Lv1 惩戒射击，对攻击你的敌人，下次攻击必定暴击，并附带击退或短暂硬直。

- 德鲁伊 + 战士
- dual_drone_warrior_ironbark：Lv1 铁木之熊，熊灵获得战士不屈特性，生命低于 50% 时伤害 +30%。
- dual_drone_warrior_predator，3级：Lv1 战鹰对生命低于 50% 的敌人伤害 0% -> 10%；Lv2 10% -> 20%；Lv3 20% -> 30%。
- dual_drone_warrior_ancestral：Lv1 先祖韧性，树精每 5 秒为战士提供 1 层血怒，无伤害，仅增伤。

### 通用生成组合

- 通用生成组合均为单级 3 选：onslaught、style、fusion。
- onslaught：取该组合左侧职业主轴加成的 70%。
- style：取该组合右侧职业风格加成的 70%。
- fusion：再取上述两项的 55%，并同时给两种加成。

- 猎人 + 德鲁伊
- dual_archer_druid_onslaught：Lv1 暴击率 +10.5%。
- dual_archer_druid_style：Lv1 每秒恢复 0.7% 最大生命。
- dual_archer_druid_fusion：Lv1 暴击率 +5.8%，并每秒恢复 0.4% 最大生命。

- 猎人 + 战士
- dual_archer_warrior_onslaught：Lv1 暴击率 +10.5%。
- dual_archer_warrior_style：Lv1 暴击率 +7.0%。
- dual_archer_warrior_fusion：Lv1 暴击率 +5.8%，并暴击率 +3.9%。

- 猎人 + 术士
- dual_archer_warlock_onslaught：Lv1 暴击率 +10.5%。
- dual_archer_warlock_style：Lv1 造成伤害 +7.0%。
- dual_archer_warlock_fusion：Lv1 暴击率 +5.8%，并造成伤害 +3.9%。

- 法师 + 战士
- dual_mage_warrior_onslaught：Lv1 攻击间隔 -10.5%。
- dual_mage_warrior_style：Lv1 暴击率 +7.0%。
- dual_mage_warrior_fusion：Lv1 攻击间隔 -5.8%，并暴击率 +3.9%。

- 法师 + 术士
- dual_mage_warlock_onslaught：Lv1 攻击间隔 -10.5%。
- dual_mage_warlock_style：Lv1 造成伤害 +7.0%。
- dual_mage_warlock_fusion：Lv1 攻击间隔 -5.8%，并造成伤害 +3.9%。

- 法师 + 圣骑士
- dual_mage_paladin_onslaught：Lv1 攻击间隔 -10.5%。
- dual_mage_paladin_style：Lv1 受到伤害 -7.0%。
- dual_mage_paladin_fusion：Lv1 攻击间隔 -5.8%，并受到伤害 -3.9%。

- 术士 + 战士
- dual_warlock_warrior_onslaught：Lv1 造成伤害 +10.5%。
- dual_warlock_warrior_style：Lv1 暴击率 +7.0%。
- dual_warlock_warrior_fusion：Lv1 造成伤害 +5.8%，并暴击率 +3.9%。

- 圣骑士 + 术士
- dual_paladin_warlock_onslaught：Lv1 造成伤害 +10.5%。
- dual_paladin_warlock_style：Lv1 造成伤害 +7.0%。
- dual_paladin_warlock_fusion：Lv1 造成伤害 +5.8%，并造成伤害 +3.9%。

- 德鲁伊 + 圣骑士
- dual_drone_paladin_onslaught：Lv1 攻击间隔 -10.5%。
- dual_drone_paladin_style：Lv1 受到伤害 -7.0%。
- dual_drone_paladin_fusion：Lv1 攻击间隔 -5.8%，并受到伤害 -3.9%。

## 备注

- 本文档优先反映当前已接入升级池与展示层的实际数值，不再保留旧版设计稿文案。
- 若代码与文档不一致，应先修正 [src/classes/upgradePools.js](src/classes/upgradePools.js) 与 [src/classes/upgradeOfferPresentation.js](src/classes/upgradeOfferPresentation.js)，再同步本文档。
