# MOVA 技能总表

本文档按当前代码整理，主要以 [src/classes/upgradePools.js](src/classes/upgradePools.js)、[src/classes/upgradeOfferPresentation.js](src/classes/upgradeOfferPresentation.js) 与 [src/classes/talentTrees.js](src/classes/talentTrees.js) 为准。

## 说明

- 主职业核心：决定基础攻击形态。
- 主职业专精：只对主职业生效。
- 副职业入口：解锁副职业派系并立即发放基础副职业能力。
- 副职业通用池：不切主武器，只提供副玩法系统与被动。
- 深度专精：已并入主职业后期天赋池，不再通过单独预备卡解锁。
- 多级节点统一展开为 Lv1 / Lv2 / Lv3；已完成的压缩节点会直接标注为 1级 或 2级。
- 旧 id 别名：mage_refract -> mage_frostbite，mage_arcane_perception -> mage_cold_focus，mage_energy_focus -> mage_ice_veins。
- 以下 2 个深度节点当前仍未完全接入最终数值公式：mage_arcanomorph、paladin_avenger。

## 猎人

### 主职业核心

- archer_core：Lv1 解锁箭矢连射。

### 主职业专精

- archer_range，1级：Lv1 基础射击射程直接提升到 +36%。
- archer_volley，3级：Lv1 箭列数 3 -> 5；Lv2 维持 5 列并收束散射角、强化锁定；Lv3 箭列数 5 -> 7。
- archer_nimble_evade，2级：Lv1 低血自动闪避提升到 60%，持续 8 秒，冷却 30 秒；Lv2 提升到 80%，持续 10 秒。

### 作为副职业：猎人

- off_ranger：Lv1 解锁猎人副职业，并立即获得基础诱饵假人；不再附带额外闪避数值。
- ranger_snaretrap，2级：基础假人已在副职业选择时获得；Lv1 牵引半径直接提升到 216、箭矢伤害系数直接提升到 32%、定身直接提升到 380 毫秒；Lv2 进一步提升到 238 / 42% / 520 毫秒。
- ranger_huntmark，1级：Lv1 猎印承伤直接提升到 22%，持续 4.7 秒。
- ranger_spiketrap，3级：Lv1 爆炸追加伤害 0% -> 18%，持续伤害系数 0% -> 8%，持续时间 0秒 -> 2.2秒；Lv2 爆炸 18% -> 26%，持续伤害 8% -> 12%，持续时间 2.2秒 -> 3.0秒；Lv3 爆炸 26% -> 36%，持续伤害 12% -> 18%，持续时间 3.0秒 -> 3.8秒。
- ranger_blasttrap，1级：Lv1 结束爆炸伤害系数直接提升到 135%。
- ranger_trapcraft，3级：Lv1 部署间隔 10.0秒 -> 8.8秒；Lv2 部署间隔 8.8秒 -> 7.6秒，并存假人上限 1 -> 2；Lv3 部署间隔 7.6秒 -> 6.4秒，并存上限维持 2。
- ranger_pack_hunter，1级：Lv1 对猎印目标暴击率直接提升到 14%，暴击伤害直接提升到 30%。

### 深度专精

- archer_bounce，3级：Lv1 箭矢获得 1 次敌人间弹射追猎；Lv2 1 -> 2 次；Lv3 2 -> 3 次。当前不是墙体物理反弹，而是命中后改向追击下一个目标。
- archer_windfury，3级：Lv1 主射击改为 360° 箭环，并追加 1 波延迟箭幕；Lv2 箭环密度提高，并追加第 2 波；Lv3 再提高密度，并追加第 3 波。
- archer_eagleeye，3级：Lv1 箭幕基础伤害提高，并对猎印目标获得额外暴击权重；Lv2 继续提高暴击权重与箭幕伤害；Lv3 对猎印目标的暴击伤害再提升。

## 德鲁伊

### 主职业核心

- druid_core：Lv1 解锁星落，定位敌方后从空中下落造成范围伤害。

### 主职业专精

- druid_meteor_shower：Lv1 星落数量 +2，但单次伤害略微降低。
- druid_meteor：Lv1 每 10 秒，下一次星落变为巨型陨石，范围更大、伤害更高。
- druid_starfire：Lv1 星落命中后有 30% 概率在同位置额外触发一次，不连锁。
- druid_nourish，2级：Lv1 在 10 秒内回复 54% 生命，冷却 30 秒；Lv2 在 5 秒内回复 60% 生命。

### 作为副职业：自然伙伴

- off_nature：Lv1 解锁德鲁伊副职业，立即获得 1 只熊灵，作为前排肉盾协同作战。
- druid_pet_bear，3级：Lv1 熊灵生命系数 72% -> 90%，伤害系数 92% -> 112%；Lv2 生命 90% -> 108%，伤害 112% -> 132%；Lv3 生命 108% -> 126%，伤害 132% -> 152%。
- druid_pet_hawk，3级：Lv1 战鹰攻击间隔 520毫秒 -> 458毫秒，伤害系数 18% -> 23%；Lv2 458毫秒 -> 395毫秒，伤害 23% -> 28%；Lv3 395毫秒 -> 333毫秒，伤害 28% -> 33%。
- druid_pet_treant，3级：Lv1 树精治疗量 4 -> 6，治疗间隔 3.00秒 -> 2.74秒；Lv2 治疗量 6 -> 8，间隔 2.74秒 -> 2.48秒；Lv3 治疗量 8 -> 10，间隔 2.48秒 -> 2.22秒。
- nature_bear_guard，3级：Lv1 熊灵分担伤害 0% -> 8%；Lv2 8% -> 16%；Lv3 16% -> 24%，并额外解锁震地减速。
- nature_hawk_huntmark，3级：Lv1 战鹰猎印增伤 0% -> 8%，对 Boss 生效率 0% -> 45%；Lv2 增伤 8% -> 16%，Boss 生效率 45% -> 70%；Lv3 增伤 16% -> 24%，Boss 生效率 70% -> 100%。
- nature_treant_bloom，3级：Lv1 树精治疗加成 0% -> 15%，附盾概率 0% -> 15%；Lv2 治疗 15% -> 30%，附盾 15% -> 30%；Lv3 治疗 30% -> 45%，附盾 30% -> 45%；护盾值固定为 2% 最大生命。

### 深度专精

- druid_kingofbeasts，3级：Lv1 星落额外追加 1 颗陨星，并同步放大熊灵、战鹰、树精体型与部分基础面板；Lv2 额外陨星提高到 2 颗；Lv3 提高到 3 颗，范围继续扩大。
- druid_naturefusion，3级：Lv1 陨石命中后追加 1 段连星陨爆；Lv2 追加数提高到 2；Lv3 提高到 3，并让自然伙伴攻击更容易挂联动状态。
- druid_astralstorm，3级：Lv1 星落下坠节奏与额外星火触发率提升；Lv2 进一步加速；Lv3 达到最高频率，并继续放大星火追击概率。

## 战士

### 主职业核心

- warrior_core：Lv1 攻击变为近战挥砍。

### 主职业专精

- warrior_damage，3级：Lv1 基础技能伤害提高 0% -> 12%；Lv2 12% -> 24%；Lv3 24% -> 40%。
- warrior_swordqi，3级：基础每次挥砍放出 1 枚风刃；Lv1 1 -> 3，并提升风刃速度；Lv2 3 -> 5，并继续提升速度；Lv3 5 -> 10，并达到最高飞行速度。
- warrior_range，3级：Lv1 风刃基础射程提升约 27%（220 -> 280）；Lv2 提升约 55%（280 -> 340）；Lv3 提升约 91%（340 -> 420）。
- warrior_blood_conversion，2级：Lv1 获得 150% 吸血，持续 10 秒，冷却 30 秒；Lv2 提升到 200% 吸血，持续 15 秒。

### 作为副职业：不屈

- off_unyielding：Lv1 解锁战士副职业，并立即获得基础血怒；不再附带额外暴击数值。
- unyielding_bloodrage，2级：副职业选择时已获得基础血怒；后续强化会把每损失 10% 生命的增伤直接提升到 4%。
- unyielding_battlecry，1级：Lv1 战吼增伤直接提升到 30%，持续 3 秒。
- unyielding_hamstring，1级：Lv1 断筋减速直接提升到 35%，持续 2 秒。
- unyielding_sunder，1级：Lv1 破甲承伤直接提升到 18%。
- unyielding_standfast，2级：Lv1 贴身减伤直接提升到 12%；Lv2 提升到 18%。
- unyielding_executioner，1级：Lv1 对 35% 以下生命目标伤害加成直接提升到 36%。

### 深度专精

- warrior_spin：Lv1 回旋斩，作为终极技能进入第三列天赋池；每 30 秒自动触发一次，持续 10 秒，期间战士进入 360° 回旋斩状态。
- warrior_berserkgod，3级：Lv1 旋转期间每轮额外追加 1 道延迟破风刃；Lv2 追加数提高到 2 道；Lv3 提高到 3 道，形成连续外放压制。
- warrior_unyielding：Lv1 暴走战躯，低血量时永动旋刃进一步提速；当前代码阈值为生命低于 35% 时额外加快旋转频率。

## 法师

### 主职业核心

- mage_core：Lv1 攻击变为冰弹，命中叠寒霜，叠满 5 层后爆炸并传染。

### 主职业专精

- mage_frostbite，1级：Lv1 冰弹减速直接提升到 48%，持续 2.7 秒。
- mage_cold_focus，1级：Lv1 冰弹索敌范围直接提升到 +135。
- mage_ice_veins，1级：Lv1 冰弹伤害加成直接提升到 30%。
- mage_deep_freeze，1级：Lv1 额外冻结时长直接提升到 1.7 秒。
- mage_shatter，3级：Lv1 碎冰半径 0 -> 120，伤害 0% -> 70%，传染 1 层寒霜；Lv2 半径 120 -> 150，伤害 70% -> 100%；Lv3 半径 150 -> 185，伤害 100% -> 135%，传染层数 1 -> 2。
- mage_frost_nova，2级：Lv1 冻结 5 秒，范围 380，冷却 30 秒；Lv2 冻结 10 秒，范围 480。

### 作为副职业：奥术

- off_arcane：Lv1 解锁法师副职业，并立即获得基础奥术炮台；不再附带额外攻速数值。
- arcane_circle，2级：基础炮台已在副职业选择时获得；Lv1 法阵增伤直接提升到 16%，部署间隔直接提升到 8.6 秒，开火间隔直接提升到 2.56 秒；Lv2 进一步提升到 24% / 7.9 秒 / 2.34 秒。
- arcane_circle_range，1级：Lv1 炮台索敌范围直接提升到 620。
- arcane_fire_circle，1级：Lv1 炮台激光额外伤害系数直接提升到 72%。
- arcane_frost_circle，1级：Lv1 炮台驻场时间直接提升到 20.4 秒。
- arcane_resonance_mark，1级：Lv1 激光易伤倍率直接提升到 18%。
- arcane_flowcasting，3级：Lv1 部署间隔额外缩短 0秒 -> 0.9秒，等效为 10.0秒 -> 9.1秒；Lv2 额外缩短 0.9秒 -> 1.8秒，并存炮台上限 1 -> 2，等效为 9.1秒 -> 8.2秒；Lv3 额外缩短 1.8秒 -> 2.7秒，并存炮台上限 2 -> 3，等效为 8.2秒 -> 7.3秒。

### 深度专精

- mage_dualcaster：Lv1 星界贯炮，站定后快速展开超宽贯穿激光，射程扩展到覆盖当前屏幕；移动时光束消失，主束会持续减速命中的敌人。
- mage_trilaser：Lv1 棱镜超载，主激光命中后会从主目标继续裂出最多 2 条副光束，补打周围后排目标。
- mage_arcanomorph，3级：Lv1 / Lv2 / Lv3 当前仅记录为奥术叠界强度档位，代码尚未接入明确数值公式。

## 圣骑士

### 主职业核心

- paladin_core：Lv1 解锁护盾脉冲体系，清弹并反击。

### 主职业专精

- paladin_pierce：Lv1 提升锤击范围与伤害。
- paladin_repulse：Lv1 锤击命中附带明显击退，更难让敌人贴身。
- paladin_triple：Lv1 每 5 秒，下一次锤击额外追加 2 次余震落点。
- paladin_stun，1级：Lv1 锤击眩晕率直接提升到 30%。
- paladin_divine_shelter，2级：Lv1 低血自动获得 60% 减伤，持续 8 秒，冷却 30 秒；Lv2 提升到 80% 减伤，持续 12 秒。

### 作为副职业：守护

- off_guardian：Lv1 解锁圣骑士副职业，并立即获得基础格挡与圣印；不再附带额外减伤数值。
- guardian_block，2级：副职业选择时已获得基础格挡；后续强化会把格挡率直接提升到 15%。
- guardian_armor，1级：Lv1 固定减伤直接提升到 6。
- guardian_counter，1级：Lv1 反击伤害直接提升到 160%。
- guardian_sacred_seal，2级：副职业选择时已获得基础圣印；后续强化会把圣印上限直接提升到 5，单层减伤直接提升到 4%。
- guardian_holy_rebuke，2级：Lv1 神圣回击半径直接提升到 135，伤害直接提升到 150%；Lv2 半径直接提升到 150，伤害直接提升到 200%，并追加 0.5 秒冻结。
- guardian_light_fortress，1级：Lv1 每层圣印护盾转化直接提升到 8%。

### 深度专精

- paladin_avenger，3级：当前已接入为主锤伤害成长档位，但“震退反制”的终局表现仍需继续补到更鲜明的专属数值链路。
- paladin_sacredshield，3级：Lv1 受击、格挡、护盾吸收会触发近身神圣回响；Lv2 回响范围与伤害提高；Lv3 进一步提高范围与伤害，形成稳定反制光环。
- paladin_divine，3级：Lv1 受击、神圣回击与锤击会触发审判波，并给敌人挂审判承伤；Lv2 审判波范围与伤害提高；Lv3 进一步提高，并有概率追加短暂眩晕。

## 术士

### 主职业核心

- warlock_core：Lv1 解锁剧毒新星，周期在脚下留下扩散毒圈。

### 主职业专精

- warlock_toxicity，3级：Lv1 剧毒最大层数 0 -> 1；Lv2 1 -> 2；Lv3 2 -> 3。
- warlock_corrode，1级：Lv1 毒圈持续时间直接额外增加 3 秒。
- warlock_spread，1级：Lv1 毒圈范围加成直接提升到 60%。
- warlock_infernal，2级：Lv1 持续 5 秒，50% 伤害吸血，并可转化上限 20% 最大生命的白骨护甲；Lv2 持续 10 秒，100% 吸血，并可转化上限 30% 最大生命的白骨护甲；冷却 30 秒。

### 作为副职业：召唤

- off_summon：Lv1 解锁召唤副职业，并立即获得 1 名骷髅卫士与 1 名骷髅法师；不再附带额外增伤数值。
- summon_necrotic_vitality，1级：Lv1 召唤物生命加成直接提升到 36%。
- summon_skeleton_guard，3级：Lv1 骷髅卫士总上限 1 -> 3；Lv2 3 -> 5；Lv3 5 -> 7。
- summon_skeleton_mage，3级：Lv1 骷髅法师总上限 1 -> 3；Lv2 3 -> 5；Lv3 5 -> 7。
- summon_mage_empower，2级：Lv1 骷髅法师伤害加成直接提升到 30%；Lv2 进一步提升到 45%，并额外获得 15% 攻击间隔缩短。
- summon_guard_bulwark，1级：Lv1 卫士生命加成直接提升到 60%，承伤减免直接提升到 20%。
- summon_ember_echo，3级：Lv1 每次亡灵死亡获得魂火层数 0 -> 1，层数上限 0 -> 3；Lv2 层数上限 3 -> 5；Lv3 每次死亡获得层数 1 -> 2，层数上限 5 -> 6；每层伤害固定 +4%，持续 6 秒。

### 深度专精

- warlock_autoseek，3级：Lv1 毒圈获得主动索敌漂移；Lv2 漂移速度、持续与覆盖进一步提升；Lv3 继续增强追猎与压场。当前尚未实现毒圈融合。
- warlock_souleater，3级：Lv1 中毒目标死亡时在尸体位置触发一次腐灭扩散，并补加毒层；Lv2 扩散范围与补层提高；Lv3 继续提高范围、伤害与滚雪球速度。
- warlock_netherlord，3级：Lv1 立即解锁 1 只常驻地狱火，并同步提升其体型、生命、攻速与伤害；地狱火被击杀后会在 30 秒后重生。Lv2 继续放大毒圈伤害与覆盖，并强化地狱火驻场压制；Lv3 达到最高压场档位。

## 备注

- 本文档优先反映当前已接入升级池与展示层的实际数值，不再保留旧版设计稿文案。
- 若代码与文档不一致，应先修正 [src/classes/upgradePools.js](src/classes/upgradePools.js) 与 [src/classes/upgradeOfferPresentation.js](src/classes/upgradeOfferPresentation.js)，再同步本文档。
- 天赋等级压缩与分层重构建议，见 [TALENT_LAYERING_REBUILD.md](TALENT_LAYERING_REBUILD.md)。
- 已废弃的双职业方案仅保留在 [DUAL_CLASS_REDESIGN.md](DUAL_CLASS_REDESIGN.md) 作为历史草案，不属于当前版本内容。
