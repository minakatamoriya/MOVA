# 天赋分层重构方案

本文档用于重构当前天赋池的等级结构，目标不是新增更多节点，而是减少重复点击、降低信息噪音，并让每一次升级都更像一次明确的玩法决策。

补充口径：
- 副职业不只是补主职业短板。
- 副职业同样承担“引入新玩法分支”的职责，因此副职业节点可以很强。
- 本文档压缩副职业等级时，原则不是削弱副职业，而是减少纯数值续杯，把强度集中到更少但更清晰的选择上。

基准来源：
- [SKILL_LIST.md](SKILL_LIST.md)
- [src/classes/upgradePools.js](src/classes/upgradePools.js)
- [src/classes/talentTrees.js](src/classes/talentTrees.js)

---

## 重构目标

- 把“默认 3 级”改成“默认 1 级”。
- 把纯数值成长从玩家选择中移走，尽量压缩为单级或并入前置节点。
- 只让真正存在阶段性手感变化的节点保留 2 级或 3 级。
- 把一局内的有效选择次数压到约 15 到 22 次，而不是让玩家做 40 到 50 次重复确认。

---

## 分层规则

## 1 级节点

适用条件：
- 拿到即成立，后续只是线性加数值。
- 本质是开关型能力、身份确认、功能解锁。
- 玩家在 5 秒内就能明确感知到“拿到了什么”。

典型类型：
- 主职业核心
- 副职业入口
- 纯伤害、纯射程、纯范围、纯减伤、纯治疗量
- 依附于前置机制的线性补强

## 2 级节点

适用条件：
- 第 1 级建立功能。
- 第 2 级把功能推到成型阈值。
- 第 2 级不是简单加一点数，而是明显提高可靠性、覆盖率或触发质量。

典型类型：
- 应急保命类天赋
- 召唤数量扩张类天赋
- 依赖触发率、Boss 生效率、覆盖率的节点
- 有“初成型”和“完全体”两段感受的节点

## 3 级节点

适用条件：
- 每一级都必须带来明确行为变化或里程碑。
- 第 2 级不是过路数值，而是中段形态升级。
- 第 3 级必须像完成终局拼图，而不是把 20% 提到 30%。

典型类型：
- 弹道形态演进
- 并存数量突破
- 连锁次数扩张
- 深度专精里的终局形态节点

---

## 全局重构规则

### 规则 1

- 纯数值节点默认降为 1 级。

### 规则 2

- 所有“前置机制 + 后续纯倍率补强”节点，优先并入前置，不再拆成两张长期续杯卡。

### 规则 3

- 同一棵树里，3 级节点最多保留 1 到 2 个。

### 规则 4

- 深度专精优先做爆点，不做长线分期付款。

### 规则 5

- 双职业组合技能作为后续内容时，也遵循相同规则：主题融合节点可以 2 级或 3 级，但纯加成节点一律 1 级。

---

## 优先合并的从属节点

这些节点即使保留独立卡，最多也只该是 1 级；更推荐后续直接并入前置节点。

| 节点 | 建议处理 | 原因 |
| --- | --- | --- |
| archer_evade_mastery | 并入 archer_nimble_evade | 本质是延长同一保命技能的持续时间，不值得拆成长期 3 级续杯。 |
| druid_nourish_growth | 并入 druid_nourish | 同属自然滋养的强度补完，单独成树只会增加点击。 |
| warrior_bloodlust_mastery | 并入 warrior_blood_conversion | 同属低血吸血体系，属于前置能力的纯倍率加厚。 |
| mage_frost_domain | 并入 mage_frost_nova | 同属冰霜新星体系，扩圈不应该再吃 3 次选择。 |
| paladin_shelter_extension | 并入 paladin_divine_shelter | 持续时间是庇护技能的自然成长，不值得独立成长。 |
| warlock_infernal_contract | 并入 warlock_infernal | 白骨护甲是灵魂虹吸的完成态，更适合作为第二档一起给。 |

---

## 主职业树重构建议

### 猎人主职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| archer_core | 1级 | 1级 | 职业身份确认。 |
| archer_range | 已改为1级 | 1级 | 已落地：直接压成单级，升级即给到 +36% 射程。 |
| archer_volley | 3级 | 3级 | 5列、收束锁定、7列，三段感知明确。 |
| archer_nimble_evade | 3级 | 2级 | 已落地合并残影步调：Lv1 60%/8秒，Lv2 80%/10秒。 |
| archer_evade_mastery | 3级 | 并入前置 | 已并入 archer_nimble_evade，不再单独发牌。 |

### 德鲁伊主职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| druid_core | 1级 | 1级 | 职业身份确认。 |
| druid_meteor_shower | 1到3级混用 | 1级 | 星落数量与覆盖属于一次性玩法成立。 |
| druid_meteor | 1到3级混用 | 1级 | 巨型陨石是明确玩法开关。 |
| druid_starfire | 1到3级混用 | 1级 | 追击星火作为副触发，一次解锁就够。 |
| druid_nourish | 3级 | 2级 | 已落地合并丰饶脉动：Lv1 54%/10秒，Lv2 60%/5秒。 |
| druid_nourish_growth | 3级 | 并入前置 | 已并入 druid_nourish，不再单独发牌。 |

### 战士主职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| warrior_core | 1级 | 1级 | 职业身份确认。 |
| warrior_spin | 1级 | 1级 | 回旋斩是玩法开关。 |
| warrior_swordqi | 3级 | 3级 | 飞行质量、轻追踪、双发连斩，层级清晰。 |
| warrior_endure | 已改为1级 | 1级 | 已落地：升级即给到 16%/1.8秒的完整护体。 |
| warrior_range | 已改为1级 | 1级 | 已落地：升级即给到 270° 展开角。 |
| warrior_blood_conversion | 3级 | 2级 | 已落地合并狂血渴饮：Lv1 150%/10秒，Lv2 200%/15秒。 |
| warrior_bloodlust_mastery | 3级 | 并入前置 | 已并入 warrior_blood_conversion，不再单独发牌。 |

### 法师主职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| mage_core | 1级 | 1级 | 职业身份确认。 |
| mage_frostbite | 3级 | 1级 | 纯减速数值。 |
| mage_cold_focus | 3级 | 1级 | 纯索敌范围数值。 |
| mage_ice_veins | 3级 | 1级 | 纯伤害数值。 |
| mage_deep_freeze | 3级 | 1级 | 冻结时长不值得分 3 次拿。 |
| mage_shatter | 3级 | 2级 | 第 1 级建立碎冰传染，第 2 级升到完整传染形态。 |
| mage_frost_nova | 3级 | 2级 | 已落地合并极寒疆域：Lv1 冻结 5 秒、范围 380；Lv2 冻结 10 秒、范围 480。 |
| mage_frost_domain | 3级 | 并入前置 | 已并入 mage_frost_nova，不再单独发牌。 |

### 圣骑士主职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| paladin_core | 1级 | 1级 | 职业身份确认。 |
| paladin_pierce | 1级 | 1级 | 主锤强化开关。 |
| paladin_repulse | 1级 | 1级 | 击退开关。 |
| paladin_triple | 1级 | 1级 | 连锤开关。 |
| paladin_stun | 3级 | 1级 | 眩晕率属于纯可靠性数值。 |
| paladin_divine_shelter | 3级 | 2级 | 已落地合并圣佑绵延：Lv1 60%/8秒，Lv2 80%/12秒。 |
| paladin_shelter_extension | 3级 | 并入前置 | 已并入 paladin_divine_shelter，不再单独发牌。 |

### 术士主职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| warlock_core | 1级 | 1级 | 职业身份确认。 |
| warlock_toxicity | 3级 | 2级 | 第 1 级让毒层进入可叠加，第 2 级达到完整层数。 |
| warlock_corrode | 3级 | 1级 | 纯持续时间数值。 |
| warlock_spread | 3级 | 1级 | 纯范围数值。 |
| warlock_infernal | 3级 | 2级 | 已落地合并白骨护甲：Lv1 50%/5秒+20%护盾，Lv2 100%/10秒+30%护盾。 |
| warlock_infernal_contract | 3级 | 并入前置 | 已并入 warlock_infernal，不再单独发牌。 |

---

## 副职业树重构建议

### 副职业入口

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| off_arcane | 1级 | 1级 | 副职业入口必须单级。 |
| off_ranger | 1级 | 1级 | 副职业入口必须单级。 |
| off_unyielding | 1级 | 1级 | 副职业入口必须单级。 |
| off_summon | 1级 | 1级 | 副职业入口必须单级。 |
| off_guardian | 1级 | 1级 | 副职业入口必须单级。 |
| off_nature | 1级 | 1级 | 副职业入口必须单级。 |

### 奥术副职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| arcane_circle | 3级 | 1级 | 基础炮台体系已由入口提供，这里不该再做三段纯数值续杯。 |
| arcane_circle_range | 3级 | 1级 | 纯索敌范围数值。 |
| arcane_fire_circle | 3级 | 1级 | 纯激光伤害数值。 |
| arcane_frost_circle | 3级 | 1级 | 纯驻场时间数值。 |
| arcane_resonance_mark | 3级 | 1级 | 易伤机制解锁后无需三段重复升级。 |
| arcane_flowcasting | 3级 | 3级 | 并存炮台 1 -> 2 -> 3 是清晰里程碑。 |

### 猎人副职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| ranger_snaretrap | 3级 | 1级 | 基础诱饵功能应该一次成立。 |
| ranger_huntmark | 3级 | 1级 | 猎印是机制开关，不是长期续杯数值。 |
| ranger_spiketrap | 3级 | 1级 | 缚行力场建立后无需三级磨数值。 |
| ranger_blasttrap | 3级 | 1级 | 纯爆炸倍率数值。 |
| ranger_trapcraft | 3级 | 2级 | 第 2 级可承担“并存数量提升”这一成型阈值。 |
| ranger_pack_hunter | 3级 | 1级 | 纯收割收益数值。 |

### 不屈副职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| unyielding_bloodrage | 3级 | 1级 | 低血增伤是纯线性数值。 |
| unyielding_battlecry | 3级 | 1级 | 战吼增伤是纯线性数值。 |
| unyielding_hamstring | 3级 | 1级 | 断筋存在即可，后续不必切三次。 |
| unyielding_sunder | 3级 | 1级 | 纯承伤倍率数值。 |
| unyielding_standfast | 3级 | 2级 | 第 2 级可承接抗击退，形成完整站场功能。 |
| unyielding_executioner | 3级 | 1级 | 纯低血处决倍率数值。 |

### 召唤副职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| summon_necrotic_vitality | 3级 | 1级 | 纯召唤物生命数值。 |
| summon_skeleton_guard | 3级 | 2级 | 兵力数量扩张有明显两段感受。 |
| summon_skeleton_mage | 3级 | 2级 | 兵力数量扩张有明显两段感受。 |
| summon_mage_empower | 3级 | 2级 | 第 2 级可以承接攻速档位与伤害成熟。 |
| summon_guard_bulwark | 3级 | 1级 | 纯生存数值。 |
| summon_ember_echo | 3级 | 2级 | 第 1 级建立魂火，第 2 级让滚雪球真正成型。 |

### 守护副职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| guardian_block | 3级 | 1级 | 格挡率属于基础可靠性数值。 |
| guardian_armor | 3级 | 1级 | 纯固定减伤。 |
| guardian_counter | 3级 | 1级 | 反制功能成立后不需要三段续杯。 |
| guardian_sacred_seal | 3级 | 2级 | 第 2 级承接圣印层数与防守成型。 |
| guardian_holy_rebuke | 3级 | 2级 | 第 1 级建立回击，第 2 级承担冻结或范围完成态。 |
| guardian_light_fortress | 3级 | 1级 | 纯护盾转化数值。 |

### 自然伙伴副职业

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| druid_pet_bear | 3级 | 1级 | 熊灵应一次成立。 |
| druid_pet_hawk | 3级 | 1级 | 战鹰应一次成立。 |
| druid_pet_treant | 3级 | 1级 | 树精应一次成立。 |
| nature_bear_guard | 3级 | 2级 | 第 2 级承接震地减速，形成完整守护功能。 |
| nature_hawk_huntmark | 3级 | 2级 | 第 2 级可直接补足 Boss 生效率。 |
| nature_treant_bloom | 3级 | 2级 | 第 1 级建立治疗辅助，第 2 级进入护盾成型。 |

---

## 深度专精重构建议

原则：深度专精应该更像觉醒，而不是再走一套 3 级数值梯子。

### 统一前置

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| third_depth_prep | 1级 | 1级 | 入口卡保持单级。 |

### 猎人深度

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| archer_bounce | 3级 | 3级 | 弹射次数天然适合做 3 段成长。 |
| archer_windfury | 3级 | 3级 | 箭环密度与波数扩张有明确 3 段体感。 |
| archer_eagleeye | 3级 | 2级 | 第 1 级建立暴击权重，第 2 级进入终局处决。 |

### 德鲁伊深度

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| druid_kingofbeasts | 3级 | 3级 | 陨星数量与自然伙伴放大具备 3 段里程碑。 |
| druid_naturefusion | 3级 | 3级 | 连星陨爆次数递增明确。 |
| druid_astralstorm | 3级 | 2级 | 高频轰炸的关键在于进入阈值，不必三级拖长。 |

### 战士深度

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| warrior_bladestorm | 1到3级混用 | 1级 | 永动旋刃应拿到即觉醒。 |
| warrior_berserkgod | 3级 | 3级 | 外放剑刃数量递增有完整 3 段感受。 |
| warrior_unyielding | 1到3级混用 | 2级 | 第 2 级承担低血暴走完全体。 |

### 法师深度

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| mage_dualcaster | 1级 | 1级 | 巨构激光应一次成立。 |
| mage_trilaser | 1到3级混用 | 2级 | 第 2 级再把副光束数量拉满。 |
| mage_arcanomorph | 3级 | 2级 | 建议未来实现为“可重叠”与“重叠收益放大”两段。 |

### 圣骑深度

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| paladin_avenger | 3级 | 2级 | 第 1 级强化震退，第 2 级补眩晕与反制完成态。 |
| paladin_sacredshield | 3级 | 2级 | 第 1 级建立回响，第 2 级扩大反制光环。 |
| paladin_divine | 3级 | 2级 | 第 1 级建立审判波，第 2 级进入禁区成型。 |

### 术士深度

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| warlock_autoseek | 3级 | 2级 | 第 1 级获得索敌漂移，第 2 级达到稳定压场。 |
| warlock_souleater | 3级 | 2级 | 第 1 级建立腐灭扩散，第 2 级进入滚雪球阈值。 |
| warlock_netherlord | 3级 | 3级 | 地狱火压场与毒圈放大适合做终局 3 段。 |

---

## 双职业组合技能重构建议

说明：双职业组合技能当前不是主流程内容，但后续设计时也应该遵守相同分层规则。

### 统一前置

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| third_dual_prep | 1级 | 1级 | 入口卡保持单级。 |

### 当前自定义组合节点

| 节点 | 当前 | 建议 | 备注 |
| --- | --- | --- | --- |
| dual_mage_druid_arcanebear | 1级 | 1级 | 主题融合开关。 |
| dual_mage_druid_starwisdom | 3级 | 2级 | 冷却缩减成长保留两段即可。 |
| dual_mage_druid_natureoverflow | 1级 | 1级 | 出牌权重与宠物解锁优先级属于规则开关。 |
| dual_scatter_mage_enchantedarrow | 1级 | 1级 | 附魔箭本身就是玩法成立。 |
| dual_scatter_mage_hastefocus | 3级 | 2级 | 攻速与迅捷补正不值得三级。 |
| dual_scatter_mage_archercircle | 1级 | 1级 | 法阵内移动是明确开关。 |
| dual_warrior_paladin_crusade | 1级 | 1级 | 十字军叠格挡是规则开关。 |
| dual_warrior_paladin_righteousrage | 3级 | 2级 | 血怒联动保留两段即可。 |
| dual_warrior_paladin_sacredspin | 1级 | 1级 | 神圣旋风是一次性主题融合。 |
| dual_warlock_druid_decay | 1级 | 1级 | 腐败滋养是规则开关。 |
| dual_warlock_druid_witheringroar | 1级 | 1级 | 凋零咆哮是规则开关。 |
| dual_warlock_druid_soulbloom | 3级 | 2级 | 净化概率补成型即可。 |
| dual_paladin_scatter_holyrain | 1级 | 1级 | 神圣箭雨是玩法开关。 |
| dual_paladin_scatter_blessedquiver | 3级 | 2级 | 暴击与回血作为收尾成型即可。 |
| dual_paladin_scatter_retribution | 1级 | 1级 | 惩戒射击是规则开关。 |
| dual_druid_warrior_ironbark | 1级 | 1级 | 铁木之熊是主题融合开关。 |
| dual_druid_warrior_predator | 3级 | 2级 | 低血猎杀补成型即可。 |
| dual_druid_warrior_ancestral | 1级 | 1级 | 先祖韧性是规则开关。 |

### 通用生成组合

| 节点类型 | 建议 | 备注 |
| --- | --- | --- |
| dual_*_onslaught | 1级 | 本质是主轴属性包。 |
| dual_*_style | 1级 | 本质是风格属性包。 |
| dual_*_fusion | 1级 | 本质是混合属性包。 |

---

## 推荐点击预算

按本方案重构后，建议把单局选择预算控制为：

| 阶段 | 建议次数 | 说明 |
| --- | --- | --- |
| 主职业建立 | 5 到 7 次 | 先把身份和手感立住。 |
| 副职业补板 | 4 到 6 次 | 中期补短板，不再把副职业做成第二套主树。 |
| 深度专精 | 2 到 4 次 | 后期爆点，不拖长。 |
| 双职业组合技能 | 0 到 2 次 | 后续扩展内容，不进当前主流程。 |

整局目标：
- 常规 build：12 到 17 次高价值选择
- 完整 build：15 到 22 次高价值选择

---

## 最终执行顺序

1. 先统一 maxLevel 规则，不再默认所有节点都是 3 级。
2. 再把从属补强节点并入前置，先砍掉最显眼的重复点击。
3. 然后重排发牌权重，让主职业前期、副职业中期、深度专精后期的结构成立。
4. 最后再决定哪些双职业组合技能要回到正式版本中。

一句话结论：

- 主职业树负责方向。
- 副职业树负责补板。
- 深度专精负责爆点。
- 多级只留给真正的形态进化，不再留给纯数值续杯。