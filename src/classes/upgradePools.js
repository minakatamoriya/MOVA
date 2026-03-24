// 升级池：按“主职业专精输出(UPGRADE_POOLS)”与“通用天赋(UNIVERSAL_POOLS)”拆分。
// 约束：
// - 主职业专精只在第一次选择的职业生效
// - 副职业只提供通用被动，不提供第二套攻击形态

// 升级天赋出现权重。
// - 所有候选默认 weight=1，可在单项上单独覆盖。
// - testing 用于测试期定向提高某个分支/某个技能的出现率，方便验证功能。
export const TALENT_OFFER_WEIGHT_CONFIG = {
  mainCoreWeightByStage: {
    main_only: 5.0,
    main_and_off: 2.6,
    all: 1.5,
  },
  offFactionEntryWeight: 2.4,
  ownedOffFactionWeight: 2.8,
  repeatLevelDecay: 0.72,
  repeatableTalentWeight: 1.35,
  repeatableTalentDecay: 0.9,
  testing: {
    enabled: false,
    favoredTree: 'summon',
    favoredTreeMultiplier: 3.5,
    favoredOffFactionEntryMultiplier: 4.0,
    favoredIds: {
      summon_skeleton_guard: 18,
      summon_skeleton_mage: 10,
    },
    favoredRepeatableNoDecay: true,
  }
};

// 主职业专精（只从 mainCore 抽取）
export const UPGRADE_POOLS = {
  // 🟢 猎人·散射（主职业输出）
  archer: [
    { id: 'archer_range', category: 'build', name: '射程', desc: '基础射击射程直接提升到 +36%。', icon: '猎主', maxLevel: 1 },
    { id: 'archer_volley', category: 'build', name: '箭矢齐射', desc: '箭列数：3 -> 5 -> 5 -> 7；第 2 级额外收束散射角并强化锁定。', icon: '猎主', maxLevel: 3 },
    { id: 'archer_nimble_evade', category: 'build', name: '灵巧回避', desc: 'Lv1 低血自动闪避 60%，持续 8 秒；Lv2 提升至 80%，持续 10 秒。冷却 30 秒。', icon: '猎主', maxLevel: 2 },
  ],

  // 🌿 德鲁伊·星落（主职业输出）
  druid: [
    { id: 'druid_meteor_shower', category: 'build', name: '星域牵引', desc: '星落索敌范围：310 -> 350 -> 395 -> 440；爆炸半径：70 -> 80 -> 92 -> 106。', icon: '德主', maxLevel: 3 },
    { id: 'druid_meteor', category: 'build', name: '坠星', desc: '星落伤害：100% -> 115% -> 130% -> 145%；下坠时间：260ms -> 235ms -> 210ms -> 185ms。', icon: '德主', maxLevel: 3 },
    { id: 'druid_starfire', category: 'build', name: '星火', desc: '追击星火触发率：0% -> 20% -> 30% -> 40%；追击伤害：0% -> 45% -> 60% -> 75%。', icon: '德主', maxLevel: 3 },
    { id: 'druid_nourish', category: 'build', name: '自然滋养', desc: 'Lv1 在 10 秒内回复 54% 生命；Lv2 在 5 秒内回复 60% 生命。冷却 30 秒。', icon: '德主', maxLevel: 2 }
  ],

  // 🟠 战士·次元斩（近战挥砍驱动的多段风刃组合）
  warrior: [
    { id: 'warrior_range', category: 'build', name: '斩域展开', desc: '次元斩展开角度直接提升到 270°。', icon: '战主', maxLevel: 1 },
    { id: 'warrior_swordqi', category: 'build', name: '真空刃强化', desc: '基础真空刃持续强化：1级提升飞行质量，2级强化伤害/速度并获得轻度追踪，3级变为双发连斩。', icon: '战主', maxLevel: 3 },
    { id: 'warrior_endure', category: 'build', name: '斩势护体', desc: '次元斩命中后直接获得 16% 减伤，持续 1.8 秒。', icon: '战主', maxLevel: 1 },
    { id: 'warrior_blood_conversion', category: 'build', name: '猩红嗜血', desc: 'Lv1 获得 150% 吸血，持续 10 秒；Lv2 提升至 200% 吸血，持续 15 秒。冷却 30 秒。', icon: '战主', maxLevel: 2 }
  ],

  // 🔵 法师·冰法
  mage: [
    { id: 'mage_frostbite', category: 'build', name: '霜蚀', desc: '冰弹减速提升至 48%，持续 2.7 秒。', icon: '法主', maxLevel: 1 },
    { id: 'mage_cold_focus', category: 'build', name: '寒域感知', desc: '冰弹索敌范围额外 +135。', icon: '法主', maxLevel: 1 },
    { id: 'mage_ice_veins', category: 'build', name: '冰脉灌注', desc: '冰弹伤害加成提升至 30%。', icon: '法主', maxLevel: 1 },
    { id: 'mage_deep_freeze', category: 'build', name: '深度冻结', desc: '额外冻结时长提升至 1.7 秒。', icon: '法主', maxLevel: 1 },
    { id: 'mage_shatter', category: 'build', name: '碎冰传染', desc: '碎冰半径：0 -> 120 -> 150 -> 185；伤害：0% -> 70% -> 100% -> 135%；传染层数：0 -> 1 -> 1 -> 2。', icon: '法主', maxLevel: 3 },
    { id: 'mage_frost_nova', category: 'build', name: '冰霜新星', desc: 'Lv1 冻结 5 秒，范围 380；Lv2 冻结 10 秒，范围 480。冷却 30 秒。', icon: '法主', maxLevel: 2 }
  ],

  // 🛡️ 圣骑士·矛
  paladin: [
    { id: 'paladin_pierce', category: 'build', name: '重锤', desc: '锤击范围与伤害提高', icon: '骑主' },
    { id: 'paladin_repulse', category: 'build', name: '震荡锤击', desc: '锤击命中附带明显击退，更难让敌人贴身', icon: '骑主' },
    { id: 'paladin_triple', category: 'build', name: '连锤', desc: '每 5 秒，下一次锤击额外追加 2 次余震落点', icon: '3X' },
    { id: 'paladin_stun', category: 'build', name: '制裁', desc: '锤击眩晕率提升至 30%。', icon: '骑主', maxLevel: 1 },
    { id: 'paladin_divine_shelter', category: 'build', name: '神圣庇护', desc: 'Lv1 获得 60% 减伤，持续 8 秒；Lv2 获得 80% 减伤，持续 12 秒。冷却 30 秒。', icon: '骑主', maxLevel: 2 }
  ],

  // 🟣 术士·暗影箭
  warlock: [
    { id: 'warlock_toxicity', category: 'build', name: '毒性浓度', desc: '剧毒最大层数：0 -> 1 -> 2 -> 3。', icon: '术主', maxLevel: 3 },
    { id: 'warlock_corrode', category: 'build', name: '腐蚀', desc: '毒圈持续时间额外 +3 秒。', icon: '术主', maxLevel: 1 },
    { id: 'warlock_spread', category: 'build', name: '扩散', desc: '毒圈范围加成提升至 60%。', icon: '术主', maxLevel: 1 },
    { id: 'warlock_infernal', category: 'build', name: '灵魂虹吸', desc: 'Lv1 持续 5 秒，50% 伤害吸血，并可转化 20% 最大生命护盾；Lv2 持续 10 秒，100% 吸血，并可转化 30% 最大生命护盾。冷却 30 秒。', icon: '术主', maxLevel: 2 }
  ]
};

// 通用天赋（副职业池）
export const UNIVERSAL_POOLS = {
  // 🔵 法师·奥术
  arcane: [
    { id: 'arcane_circle', category: 'build', name: '奥术炮台', desc: '基础炮台已在解锁副职业时获得；Lv1 将法阵增伤直接提升到 16%、部署间隔提升到 8.6 秒、开火间隔提升到 2.56 秒；Lv2 进一步提升到 24% / 7.9 秒 / 2.34 秒。', icon: '法副', maxLevel: 2 },
    { id: 'arcane_circle_range', category: 'build', name: '棱镜扩容', desc: '炮台索敌范围直接提升到 620。', icon: '法副', maxLevel: 1, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_fire_circle', category: 'build', name: '奥能灌注', desc: '炮台激光额外伤害系数直接提升到 72%。', icon: '法副', maxLevel: 1, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_frost_circle', category: 'build', name: '晶体固化', desc: '炮台驻场时间直接提升到 20.4 秒。', icon: '法副', maxLevel: 1, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_resonance_mark', category: 'build', name: '共鸣裂变', desc: '激光易伤倍率直接提升到 18%。', icon: '法副', maxLevel: 1, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_flowcasting', category: 'build', name: '多重布阵', desc: '部署间隔额外缩短：0秒 -> 0.9秒 -> 1.8秒 -> 2.7秒；离场保留：0秒 -> 1.2秒 -> 2.0秒 -> 3.0秒；并存炮台上限：1 -> 1 -> 2 -> 3。', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' }
  ],

  // 🟢 猎人·猎人
  ranger: [
    { id: 'ranger_snaretrap', category: 'build', name: '诱饵假人', desc: '基础假人已在解锁副职业时获得；Lv1 牵引半径直接提升到 216、箭矢伤害系数直接提升到 32%、定身直接提升到 380 毫秒；Lv2 进一步提升到 238 / 42% / 520 毫秒。', icon: '猎副', maxLevel: 2 },
    { id: 'ranger_huntmark', category: 'build', name: '猎手印记', desc: '被假人牵制的敌人会被标记，承伤直接提升到 22%，持续 4.7 秒。', icon: '猎副', maxLevel: 1, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_spiketrap', category: 'build', name: '缚行力场', desc: '爆炸追加伤害系数：0% -> 18% -> 26% -> 36%；持续伤害系数：0% -> 8% -> 12% -> 18%；持续时间：0秒 -> 2.2秒 -> 3.0秒 -> 3.8秒。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_blasttrap', category: 'build', name: '诱爆装置', desc: '假人结束爆炸伤害系数直接提升到 135%。', icon: '猎副', maxLevel: 1, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_trapcraft', category: 'build', name: '拟饵工学', desc: '部署间隔：10.0秒 -> 8.8秒 -> 7.6秒 -> 6.4秒；并存假人上限：1 -> 1 -> 2 -> 2。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_pack_hunter', category: 'build', name: '围猎本能', desc: '对猎印目标的暴击率直接提升到 14%，暴击伤害直接提升到 30%。', icon: '猎副', maxLevel: 1, requiredSkillId: 'ranger_huntmark' }
  ],

  // 🟠 战士·不屈
  unyielding: [
    { id: 'unyielding_bloodrage', category: 'build', name: '血怒', desc: '基础血怒已在解锁副职业时获得；该节点会把每损失 10% 生命的增伤直接提升到 4%。', icon: '战副', maxLevel: 2 },
    { id: 'unyielding_battlecry', category: 'build', name: '战吼', desc: '战吼增伤直接提升到 30%，持续 3 秒。', icon: '战副', maxLevel: 1 },
    { id: 'unyielding_hamstring', category: 'build', name: '断筋', desc: '断筋减速直接提升到 35%，持续 2 秒。', icon: '战副', maxLevel: 1 },
    { id: 'unyielding_sunder', category: 'build', name: '破甲', desc: '破甲承伤直接提升到 18%。', icon: '战副', maxLevel: 1 },
    { id: 'unyielding_standfast', category: 'build', name: '不退', desc: 'Lv1 贴身减伤直接提升到 12%；Lv2 提升到 18%。', icon: '战副', maxLevel: 2 },
    { id: 'unyielding_executioner', category: 'build', name: '处决本能', desc: '对 35% 以下生命目标的伤害加成直接提升到 36%。', icon: '战副', maxLevel: 1 }
  ],

  // 🟣 术士·召唤
  summon: [
    { id: 'summon_necrotic_vitality', category: 'build', name: '死灵共鸣', desc: '召唤物生命加成直接提升到 36%。', icon: '术副', maxLevel: 1 },
    { id: 'summon_skeleton_guard', category: 'build', name: '骷髅卫士', desc: '骷髅卫士总上限：1 -> 3 -> 5 -> 7。', icon: '术副', maxLevel: 3 },
    { id: 'summon_skeleton_mage', category: 'build', name: '骷髅法师', desc: '骷髅法师总上限：1 -> 3 -> 5 -> 7。', icon: '术副', maxLevel: 3 },
    { id: 'summon_mage_empower', category: 'build', name: '白骨灌能', desc: 'Lv1 骷髅法师伤害加成直接提升到 30%；Lv2 进一步提升到 45%，并额外获得 15% 攻击间隔缩短。', icon: '术副', maxLevel: 2, requiredSkillId: 'summon_skeleton_mage' },
    { id: 'summon_guard_bulwark', category: 'build', name: '骸骨壁垒', desc: '卫士生命加成直接提升到 60%，承伤减免直接提升到 20%。', icon: '术副', maxLevel: 1, requiredSkillId: 'summon_skeleton_guard' },
    { id: 'summon_ember_echo', category: 'build', name: '魂火余烬', desc: '亡灵死亡获得魂火层数：0 -> 1 -> 1 -> 2；层数上限：0 -> 3 -> 5 -> 6；每层伤害固定 +4%，持续 6 秒。', icon: '术副', maxLevel: 3 }
  ],

  // 🛡️ 圣骑士·守护
  guardian: [
    { id: 'guardian_block', category: 'build', name: '坚盾', desc: '基础格挡已在解锁副职业时获得；该节点会把格挡率直接提升到 15%。', icon: '骑副', maxLevel: 2 },
    { id: 'guardian_armor', category: 'build', name: '护甲', desc: '固定减伤直接提升到 6。', icon: '骑副', maxLevel: 1 },
    { id: 'guardian_counter', category: 'build', name: '反制', desc: '格挡成功后触发反击，反击伤害直接提升到 160%。', icon: '骑副', maxLevel: 1, requiredSkillId: 'guardian_block' },
    { id: 'guardian_sacred_seal', category: 'build', name: '庇护圣印', desc: '基础圣印已在解锁副职业时获得；该节点会把圣印上限直接提升到 5，单层减伤直接提升到 4%。', icon: '骑副', maxLevel: 2, requiredSkillId: 'guardian_block' },
    { id: 'guardian_holy_rebuke', category: 'build', name: '神圣回击', desc: 'Lv1 神圣回击半径提升到 135、伤害提升到 150%；Lv2 半径提升到 150、伤害提升到 200%，并追加 0.5 秒冻结。', icon: '骑副', maxLevel: 2, requiredSkillId: 'guardian_sacred_seal' },
    { id: 'guardian_light_fortress', category: 'build', name: '光铸壁垒', desc: '每层圣印护盾转化直接提升到 8%。', icon: '骑副', maxLevel: 1, requiredSkillId: 'guardian_sacred_seal' }
  ],

  // 🌿 德鲁伊·自然伙伴
  nature: [
    { id: 'druid_pet_bear', category: 'build', name: '熊灵', desc: '熊灵生命系数：72% -> 90% -> 108% -> 126%；伤害系数：92% -> 112% -> 132% -> 152%。', icon: '德副', maxLevel: 3 },
    { id: 'druid_pet_hawk', category: 'build', name: '战鹰', desc: '战鹰攻击间隔：520毫秒 -> 458毫秒 -> 395毫秒 -> 333毫秒；伤害系数：18% -> 23% -> 28% -> 33%。', icon: '德副', maxLevel: 3 },
    { id: 'druid_pet_treant', category: 'build', name: '树精', desc: '树精治疗量：4 -> 6 -> 8 -> 10；治疗间隔：3.00秒 -> 2.74秒 -> 2.48秒 -> 2.22秒。', icon: '德副', maxLevel: 3 },
    { id: 'nature_bear_guard', category: 'build', name: '熊灵守护', desc: '熊灵分担伤害：0% -> 8% -> 16% -> 24%；3 级额外解锁震地减速。', icon: '德副', maxLevel: 3, requiredSkillId: 'druid_pet_bear' },
    { id: 'nature_hawk_huntmark', category: 'build', name: '战鹰猎印', desc: '战鹰猎印增伤：0% -> 8% -> 16% -> 24%；对 Boss 生效率：0% -> 45% -> 70% -> 100%。', icon: '德副', maxLevel: 3, requiredSkillId: 'druid_pet_hawk' },
    { id: 'nature_treant_bloom', category: 'build', name: '树精繁茂', desc: '树精治疗加成：0% -> 15% -> 30% -> 45%；附盾概率：0% -> 15% -> 30% -> 45%；护盾值固定为 2% 最大生命。', icon: '德副', maxLevel: 3, requiredSkillId: 'druid_pet_treant' }
  ]
};

// 第二次三选一：副职业“选择事件”选项
// 说明：
// - 选中这些节点时，会在 GameScene.applyUpgrade 中自动写入 offFaction
// - 会立即发放基础副职业能力，但不再附带独立的全局数值包
export const OFF_FACTION_ENTRY_OPTIONS = [
  { id: 'off_arcane', category: 'build', name: '奥术', desc: '解锁法师副职业，并立即获得基础奥术炮台；后续可抽取奥术系强化节点。', icon: '解锁法师副职业！' },
  { id: 'off_ranger', category: 'build', name: '猎人', desc: '解锁猎人副职业，并立即获得基础诱饵假人；后续可抽取围猎系强化节点。', icon: '解锁猎人副职业！' },
  { id: 'off_unyielding', category: 'build', name: '不屈', desc: '解锁战士副职业，并立即获得基础血怒；后续可抽取不屈系强化节点。', icon: '解锁战士副职业！' },
  { id: 'off_summon', category: 'build', name: '召唤', desc: '解锁召唤副职业，并立即获得 1 名骷髅卫士与 1 名骷髅法师；后续可抽取召唤系强化节点。', icon: '解锁术士副职业！' },
  { id: 'off_guardian', category: 'build', name: '守护', desc: '解锁圣骑士副职业，并立即获得基础格挡与圣印；后续可抽取守护系强化节点。', icon: '解锁圣骑士副职业！' },
  { id: 'off_nature', category: 'build', name: '自然伙伴', desc: '解锁德鲁伊副职业，并立即获得 1 只熊灵；后续可抽取战鹰、树精与自然伙伴强化节点。', icon: '解锁德鲁伊副职业！' }
];

// 深度专精池：按主职业主题拆分
export const DEPTH_SPEC_POOLS = {
  mage: [
    { id: 'mage_dualcaster', category: 'third_depth', name: '星界贯炮', desc: '激光变为巨粗贯穿光束，持续升级射程、宽度与压制力', icon: '法深', maxLevel: 3 },
    { id: 'mage_trilaser', category: 'third_depth', name: '棱镜超载', desc: '激光命中后裂出更多副光束，并逐级提高延伸清屏能力', icon: '法深', maxLevel: 3 },
    { id: 'mage_arcanomorph', category: 'third_depth', name: '奥术叠界', desc: '奥能法阵允许重叠，重叠区内法阵增伤与附加效果按层放大', icon: '法深', maxLevel: 3 }
  ],
  archer: [
    { id: 'archer_bounce', category: 'third_depth', name: '反射猎场', desc: '箭矢可多次弹射追猎，逐级提高连锁压制能力', icon: '猎深', maxLevel: 3 },
    { id: 'archer_windfury', category: 'third_depth', name: '暴风裂羽', desc: '主射击进化为 360° 箭环，并逐级追加更多延迟箭幕', icon: '猎深', maxLevel: 3 },
    { id: 'archer_eagleeye', category: 'third_depth', name: '终局鹰眼', desc: '所有箭幕获得更高暴击权重，对被标记目标进一步提高处决能力', icon: '猎深', maxLevel: 3 }
  ],
  warrior: [
    { id: 'warrior_bladestorm', category: 'third_depth', name: '永动旋刃', desc: '进入持续旋转状态，持续升级旋转伤害与节奏', icon: '战深', maxLevel: 3 },
    { id: 'warrior_berserkgod', category: 'third_depth', name: '破风利刃', desc: '持续旋转期间周期性向外发射剑刃，补足远端压制与追击', icon: '战深', maxLevel: 3 },
    { id: 'warrior_unyielding', category: 'third_depth', name: '暴走战躯', desc: '低血时持续提高旋转速度、伤害与追击风刃数量', icon: '战深', maxLevel: 3 }
  ],
  warlock: [
    { id: 'warlock_autoseek', category: 'third_depth', name: '瘟疫疆域', desc: '毒圈会主动索敌漂移，逐级提升移动速度、持续与覆盖范围', icon: '术深', maxLevel: 3 },
    { id: 'warlock_souleater', category: 'third_depth', name: '腐灭连环', desc: '中毒敌人死亡时向周围扩散更强的腐蚀层，形成稳定滚雪球', icon: '术深', maxLevel: 3 },
    { id: 'warlock_netherlord', category: 'third_depth', name: '炼狱君王', desc: '地狱火显著强化，并逐级放大毒圈伤害、范围与地狱火压场能力', icon: '术深', maxLevel: 3 }
  ],
  paladin: [
    { id: 'paladin_avenger', category: 'third_depth', name: '震退反制', desc: '反击命中附带明显击退，高等级可追加短暂眩晕', icon: '骑深', maxLevel: 3 },
    { id: 'paladin_sacredshield', category: 'third_depth', name: '圣棘回响', desc: '格挡、受击、反制时都会反弹神圣伤害，并逐级扩大回响范围', icon: '骑深', maxLevel: 3 },
    { id: 'paladin_divine', category: 'third_depth', name: '审判禁区', desc: '神圣回击、反制、击退彼此联动，在身边形成逐级扩张的审判区', icon: '骑深', maxLevel: 3 }
  ],
  druid: [
    { id: 'druid_kingofbeasts', category: 'third_depth', name: '群星坠世', desc: '星落覆盖范围显著扩大，逐级提升落点数，并同步强化自然伙伴体型', icon: '德深', maxLevel: 3 },
    { id: 'druid_naturefusion', category: 'third_depth', name: '连星陨爆', desc: '陨石命中后引发更多二次流星坠击，形成连续轰炸区', icon: '德深', maxLevel: 3 },
    { id: 'druid_astralstorm', category: 'third_depth', name: '天穹潮汐', desc: '星落循环显著加速，流星雨与陨石能更高频进入战场', icon: '德深', maxLevel: 3 }
  ]
};

// 技能树 id -> GameScene.buildState.core key
export const TREE_TO_CORE_KEY = {
  archer: 'archer',
  druid: 'druid',
  warrior: 'warrior',
  mage: 'mage',
  paladin: 'paladin',
  warlock: 'warlock'
};
