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
  thirdSpecWeight: 0.8,
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
    { id: 'archer_range', category: 'build', name: '射程', desc: '基础射击射程加成：0% -> 12% -> 24% -> 36%。', icon: '猎主', maxLevel: 3 },
    { id: 'archer_volley', category: 'build', name: '箭矢齐射', desc: '箭列数：3 -> 5 -> 5 -> 7；第 2 级额外收束散射角并强化锁定。', icon: '猎主', maxLevel: 3 },
    { id: 'archer_nimble_evade', category: 'build', name: '灵巧回避', desc: '低血自动闪避：0% -> 40% -> 60% -> 80%，持续 3 秒，冷却 30 秒。', icon: '猎主', maxLevel: 3 },
    { id: 'archer_evade_mastery', category: 'build', name: '残影步调', desc: '灵巧回避持续时间：3秒 -> 5秒 -> 8秒 -> 10秒。', icon: '猎主', maxLevel: 3, requiredSkillId: 'archer_nimble_evade' },
  ],

  // 🌿 德鲁伊·星落（主职业输出）
  druid: [
    { id: 'druid_meteor_shower', category: 'build', name: '流星雨', desc: '星落数量 +2，但单次伤害略微降低', icon: '德主' },
    { id: 'druid_meteor', category: 'build', name: '陨石', desc: '每 10 秒，下一次星落变为巨型陨石：范围更大，伤害更高', icon: '德主' },
    { id: 'druid_starfire', category: 'build', name: '星火', desc: '星落命中后有 30% 概率在同位置额外触发一次（不连锁）', icon: '德主' },
    { id: 'druid_nourish', category: 'build', name: '自然滋养', desc: '30% 总治疗完成时间：15秒 -> 10秒 -> 5秒，冷却 30 秒。', icon: '德主', maxLevel: 3 },
    { id: 'druid_nourish_growth', category: 'build', name: '丰饶脉动', desc: '自然滋养总回复加成：0% -> 50% -> 80% -> 100%。', icon: '德主', maxLevel: 3, requiredSkillId: 'druid_nourish' }
  ],

  // 🟠 战士·旋风斩（此项目内为“近战挥砍/半月波”）
  warrior: [
    { id: 'warrior_spin', category: 'build', name: '回旋', desc: '挥砍变为 360° 回旋斩，造成范围伤害', icon: '战主' },
    { id: 'warrior_swordqi', category: 'build', name: '剑气', desc: '挥砍时额外发射一道月牙剑气（保留近战判定）', icon: '战主' },
    { id: 'warrior_endure', category: 'build', name: '持久', desc: '战士近战形态获得 20% 伤害减免', icon: '战主' },
    { id: 'warrior_range', category: 'build', name: '月牙扩展', desc: '月牙斩基础范围：220 -> 245 -> 270 -> 295 -> 320。', icon: '战主' },
    { id: 'warrior_blood_conversion', category: 'build', name: '猩红嗜血', desc: '低血吸血持续时间：5秒 -> 10秒 -> 15秒；吸血转化固定 100%，冷却 30 秒。', icon: '战主', maxLevel: 3 },
    { id: 'warrior_bloodlust_mastery', category: 'build', name: '狂血渴饮', desc: '吸血转化：100% -> 120% -> 150% -> 200%。', icon: '战主', maxLevel: 3, requiredSkillId: 'warrior_blood_conversion' }
  ],

  // 🔵 法师·冰法
  mage: [
    { id: 'mage_frostbite', category: 'build', name: '霜蚀', desc: '冰弹减速：22% -> 30% -> 38% -> 48%；持续：1.5秒 -> 1.9秒 -> 2.3秒 -> 2.7秒。', icon: '法主', maxLevel: 3 },
    { id: 'mage_cold_focus', category: 'build', name: '寒域感知', desc: '冰弹索敌范围加成：+0 -> +45 -> +90 -> +135。', icon: '法主', maxLevel: 3 },
    { id: 'mage_ice_veins', category: 'build', name: '冰脉灌注', desc: '冰弹伤害加成：0% -> 10% -> 20% -> 30%。', icon: '法主', maxLevel: 3 },
    { id: 'mage_deep_freeze', category: 'build', name: '深度冻结', desc: '额外冻结时长：0秒 -> 0.8秒 -> 1.2秒 -> 1.7秒。', icon: '法主', maxLevel: 3 },
    { id: 'mage_shatter', category: 'build', name: '碎冰传染', desc: '碎冰半径：0 -> 120 -> 150 -> 185；伤害：0% -> 70% -> 100% -> 135%；传染层数：0 -> 1 -> 1 -> 2。', icon: '法主', maxLevel: 3 },
    { id: 'mage_frost_nova', category: 'build', name: '冰霜新星', desc: '冰霜新星冻结时长：0秒 -> 3秒 -> 5秒 -> 10秒，冷却 30 秒。', icon: '法主', maxLevel: 3 },
    { id: 'mage_frost_domain', category: 'build', name: '极寒疆域', desc: '冰霜新星范围：0 -> 300 -> 380 -> 480。', icon: '法主', maxLevel: 3, requiredSkillId: 'mage_frost_nova' }
  ],

  // 🛡️ 圣骑士·矛
  paladin: [
    { id: 'paladin_pierce', category: 'build', name: '重锤', desc: '锤击范围与伤害提高', icon: '骑主' },
    { id: 'paladin_repulse', category: 'build', name: '震荡锤击', desc: '锤击命中附带明显击退，更难让敌人贴身', icon: '骑主' },
    { id: 'paladin_triple', category: 'build', name: '连锤', desc: '每 5 秒，下一次锤击额外追加 2 次余震落点', icon: '3X' },
    { id: 'paladin_stun', category: 'build', name: '制裁', desc: '锤击眩晕率：0% -> 10% -> 20% -> 30%。', icon: '骑主' },
    { id: 'paladin_divine_shelter', category: 'build', name: '神圣庇护', desc: '低血减伤：0% -> 40% -> 60% -> 80%，持续 5 秒，冷却 30 秒。', icon: '骑主', maxLevel: 3 },
    { id: 'paladin_shelter_extension', category: 'build', name: '圣佑绵延', desc: '神圣庇护持续时间：5秒 -> 8秒 -> 10秒 -> 12秒。', icon: '骑主', maxLevel: 3, requiredSkillId: 'paladin_divine_shelter' }
  ],

  // 🟣 术士·暗影箭
  warlock: [
    { id: 'warlock_toxicity', category: 'build', name: '毒性浓度', desc: '剧毒最大层数：0 -> 1 -> 2 -> 3。', icon: '术主', maxLevel: 3 },
    { id: 'warlock_corrode', category: 'build', name: '腐蚀', desc: '毒圈持续时间加成：0秒 -> 1秒 -> 2秒 -> 3秒。', icon: '术主', maxLevel: 3 },
    { id: 'warlock_spread', category: 'build', name: '扩散', desc: '毒圈范围加成：0% -> 20% -> 40% -> 60%。', icon: '术主', maxLevel: 3 },
    { id: 'warlock_infernal', category: 'build', name: '炼狱魔火', desc: '地狱火生命系数：0% -> 85% -> 110% -> 145%；伤害系数：0% -> 110% -> 145% -> 185%；每击回复：0 -> 8 -> 14 -> 22。', icon: '术主', maxLevel: 3 },
    { id: 'warlock_infernal_contract', category: 'build', name: '灰烬契约', desc: '生命消耗：15% -> 10% -> 5% -> 0%。', icon: '术主', maxLevel: 3, requiredSkillId: 'warlock_infernal' }
  ]
};

// 通用天赋（副职业池）
export const UNIVERSAL_POOLS = {
  // 🔵 法师·奥术
  arcane: [
    { id: 'arcane_circle', category: 'build', name: '奥术炮台', desc: '法阵内增伤：0% -> 8% -> 16% -> 24%；部署间隔：10.0秒 -> 9.3秒 -> 8.6秒 -> 7.9秒；开火间隔：3.00秒 -> 2.78秒 -> 2.56秒 -> 2.34秒。', icon: '法副', maxLevel: 3 },
    { id: 'arcane_circle_range', category: 'build', name: '棱镜扩容', desc: '炮台索敌范围：380 -> 460 -> 540 -> 620。', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_fire_circle', category: 'build', name: '奥能灌注', desc: '炮台激光额外伤害系数：0% -> 24% -> 48% -> 72%。', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_frost_circle', category: 'build', name: '晶体固化', desc: '炮台驻场时间：15.0秒 -> 16.8秒 -> 18.6秒 -> 20.4秒。', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_resonance_mark', category: 'build', name: '共鸣裂变', desc: '激光易伤倍率：0% -> 6% -> 12% -> 18%。', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_flowcasting', category: 'build', name: '多重布阵', desc: '部署间隔额外缩短：0秒 -> 0.9秒 -> 1.8秒 -> 2.7秒；离场保留：0秒 -> 1.2秒 -> 2.0秒 -> 3.0秒；并存炮台上限：1 -> 1 -> 2 -> 3。', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' }
  ],

  // 🟢 猎人·猎人
  ranger: [
    { id: 'ranger_snaretrap', category: 'build', name: '诱饵假人', desc: '牵引半径：172 -> 194 -> 216 -> 238；箭矢伤害系数：18% -> 24% -> 32% -> 42%；定身时长：0毫秒 -> 260毫秒 -> 380毫秒 -> 520毫秒。', icon: '猎副', maxLevel: 3 },
    { id: 'ranger_huntmark', category: 'build', name: '猎手印记', desc: '猎印承伤：0% -> 10% -> 16% -> 22%；持续时间：0秒 -> 3.9秒 -> 4.3秒 -> 4.7秒。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_spiketrap', category: 'build', name: '缚行力场', desc: '爆炸追加伤害系数：0% -> 18% -> 26% -> 36%；持续伤害系数：0% -> 8% -> 12% -> 18%；持续时间：0秒 -> 2.2秒 -> 3.0秒 -> 3.8秒。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_blasttrap', category: 'build', name: '诱爆装置', desc: '结束爆炸伤害系数：55% -> 78% -> 102% -> 135%。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_trapcraft', category: 'build', name: '拟饵工学', desc: '部署间隔：10.0秒 -> 8.8秒 -> 7.6秒 -> 6.4秒；并存假人上限：1 -> 1 -> 2 -> 2。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_pack_hunter', category: 'build', name: '围猎本能', desc: '对猎印目标的暴击率：0% -> 6% -> 10% -> 14%；暴击伤害：0% -> 12% -> 20% -> 30%。', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_huntmark' }
  ],

  // 🟠 战士·不屈
  unyielding: [
    { id: 'unyielding_bloodrage', category: 'build', name: '血怒', desc: '每损失 10% 生命的增伤：0% -> 2% -> 3% -> 4%。', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_battlecry', category: 'build', name: '战吼', desc: '战吼增伤：0% -> 10% -> 20% -> 30%，持续 3 秒。', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_hamstring', category: 'build', name: '断筋', desc: '断筋减速：0% -> 15% -> 25% -> 35%；持续：0秒 -> 1.5秒 -> 1.5秒 -> 2秒。', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_sunder', category: 'build', name: '破甲', desc: '破甲承伤：0% -> 6% -> 12% -> 18%。', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_standfast', category: 'build', name: '不退', desc: '贴身减伤：0% -> 6% -> 12% -> 18%；3 级额外获得抗击退。', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_executioner', category: 'build', name: '处决本能', desc: '对 35% 以下生命目标的伤害加成：0% -> 12% -> 24% -> 36%。', icon: '战副', maxLevel: 3 }
  ],

  // 🟣 术士·召唤
  summon: [
    { id: 'summon_necrotic_vitality', category: 'build', name: '死灵共鸣', desc: '召唤物生命加成：0% -> 12% -> 24% -> 36%。', icon: '术副', maxLevel: 3 },
    { id: 'summon_skeleton_guard', category: 'build', name: '骷髅卫士', desc: '骷髅卫士总上限：1 -> 3 -> 5 -> 7。', icon: '术副', maxLevel: 3 },
    { id: 'summon_skeleton_mage', category: 'build', name: '骷髅法师', desc: '骷髅法师总上限：1 -> 3 -> 5 -> 7。', icon: '术副', maxLevel: 3 },
    { id: 'summon_mage_empower', category: 'build', name: '白骨灌能', desc: '骷髅法师伤害加成：0% -> 15% -> 30% -> 45%；3 级额外攻击间隔缩短 15%。', icon: '术副', maxLevel: 3, requiredSkillId: 'summon_skeleton_mage' },
    { id: 'summon_guard_bulwark', category: 'build', name: '骸骨壁垒', desc: '卫士生命加成：0% -> 20% -> 40% -> 60%；承伤减免：0% -> 10% -> 15% -> 20%。', icon: '术副', maxLevel: 3, requiredSkillId: 'summon_skeleton_guard' },
    { id: 'summon_ember_echo', category: 'build', name: '魂火余烬', desc: '亡灵死亡获得魂火层数：0 -> 1 -> 1 -> 2；层数上限：0 -> 3 -> 5 -> 6；每层伤害固定 +4%，持续 6 秒。', icon: '术副', maxLevel: 3 }
  ],

  // 🛡️ 圣骑士·守护
  guardian: [
    { id: 'guardian_block', category: 'build', name: '坚盾', desc: '格挡率：0% -> 5% -> 10% -> 15%；格挡减伤固定 50%。', icon: '骑副', maxLevel: 3 },
    { id: 'guardian_armor', category: 'build', name: '护甲', desc: '固定减伤：0 -> 2 -> 4 -> 6。', icon: '骑副', maxLevel: 3 },
    { id: 'guardian_counter', category: 'build', name: '反制', desc: '反击伤害：0% -> 80% -> 120% -> 160%。', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_block' },
    { id: 'guardian_sacred_seal', category: 'build', name: '庇护圣印', desc: '圣印上限：0 -> 3 -> 4 -> 5；单层减伤：0% -> 2% -> 3% -> 4%。', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_block' },
    { id: 'guardian_holy_rebuke', category: 'build', name: '神圣回击', desc: '神圣回击半径：0 -> 120 -> 135 -> 150；伤害：0% -> 100% -> 150% -> 200%；3 级追加 0.5 秒冻结。', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_sacred_seal' },
    { id: 'guardian_light_fortress', category: 'build', name: '光铸壁垒', desc: '每层圣印护盾转化：0% -> 4% -> 6% -> 8%。', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_sacred_seal' }
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

// 第二次三选一：副职业“入门节点”选项（直接给真实被动/入口）
// 说明：
// - 选中这些节点时，会在 GameScene.applyUpgrade 中自动写入 offFaction
// - 自然伙伴：这里先解锁德鲁伊副职业，后续再从自然伙伴池中抽取熊/鹰/树精与其强化
export const OFF_FACTION_ENTRY_OPTIONS = [
  { id: 'off_arcane', category: 'build', name: '奥术', desc: '解锁法师副职业，所有攻击间隔 -8%。基础每10秒自动部署1座奥术炮台，驻场15秒，并向射程内目标发射粗直线贯穿激光。', icon: '解锁法师副职业！' },
  { id: 'off_ranger', category: 'build', name: '猎人', desc: '解锁猎人副职业，闪避率 +10%。基础每10秒自动布置1个诱饵假人，持续15秒，划定吸引范围并向圈内优先目标射出单发箭矢。', icon: '解锁猎人副职业！' },
  { id: 'off_unyielding', category: 'build', name: '不屈', desc: '解锁战士副职业，暴击率 +10%。生命每损失10%，伤害 +2%。', icon: '解锁战士副职业！' },
  { id: 'off_summon', category: 'build', name: '召唤', desc: '解锁召唤副职业，造成伤害 +8%。立即获得1名骷髅卫士与1名骷髅法师。', icon: '解锁术士副职业！' },
  { id: 'off_guardian', category: 'build', name: '守护', desc: '解锁圣骑士副职业，受到伤害 -10%。获得格挡与圣印。', icon: '解锁圣骑士副职业！' },
  { id: 'off_nature', category: 'build', name: '自然伙伴', desc: '解锁德鲁伊副职业。立即获得1只熊灵，作为前排肉盾协同作战。', icon: '解锁德鲁伊副职业！' }
];

// ====== 第三天赋：深度专精 / 双职业专精（占位池，后续由策划填充） ======
// 设计约束：深度专精池 与 双职业池 完全互斥。
// - depth：主/副同主题（例如 法师主 + 奥术副 => 法师深度专精）
// - dual：主/副不同主题（例如 法师主 + 自然伙伴副 => 法师+德鲁伊双职业）

export const THIRD_SPEC_PREP_OPTIONS = {
  depth: { id: 'third_depth_prep', category: 'build', name: '本职业深度专精天赋', desc: '解锁深度专精天赋', icon: '专精' },
  dual: { id: 'third_dual_prep', category: 'build', name: '双职业天赋', desc: '解锁双职业天赋', icon: '双职' }
};

const THIRD_SPEC_CORE_LABELS = {
  mage: '法师',
  archer: '猎人',
  warrior: '战士',
  warlock: '术士',
  paladin: '圣骑士',
  druid: '德鲁伊'
};

const OFF_FACTION_TO_ACCENT_CORE_KEY = {
  arcane: 'mage',
  ranger: 'archer',
  unyielding: 'warrior',
  summon: 'warlock',
  guardian: 'paladin',
  nature: 'druid'
};

const DUAL_MAIN_ENTRY_BONUSES = {
  mage: { title: '奥术洪流', stat: 'fireRate', value: 0.15 },
  archer: { title: '致命瞄准', stat: 'critChance', value: 0.15 },
  warrior: { title: '破阵之力', stat: 'damage', value: 0.15 },
  warlock: { title: '召魂灌注', stat: 'damage', value: 0.15 },
  paladin: { title: '圣裁锋芒', stat: 'damage', value: 0.15 },
  druid: { title: '星怒奔流', stat: 'fireRate', value: 0.15 }
};

const DUAL_OFF_STYLE_BONUSES_BY_FACTION = {
  arcane: { title: '奥术余韵', stat: 'fireRate', value: 0.10 },
  ranger: { title: '猎人步调', stat: 'dodgeChance', value: 0.10 },
  unyielding: { title: '不屈战意', stat: 'critChance', value: 0.10 },
  summon: { title: '召魂灌注', stat: 'damage', value: 0.10 },
  guardian: { title: '守护庇佑', stat: 'damageReduction', value: 0.10 },
  nature: { title: '自然回响', stat: 'regenRatio', value: 0.01 }
};

const DEPTH_ENTRY_BONUSES = {
  mage: { title: '奥术觉醒', stat: 'fireRate', value: 0.30 },
  archer: { title: '猎神凝视', stat: 'critChance', value: 0.30 },
  warrior: { title: '战神附体', stat: 'damage', value: 0.30 },
  warlock: { title: '召魂真名', stat: 'damage', value: 0.30 },
  paladin: { title: '圣裁降临', stat: 'damage', value: 0.30 },
  druid: { title: '星界澎湃', stat: 'fireRate', value: 0.30 }
};

function formatThirdSpecBonusDesc(bonus) {
  if (!bonus) return '';
  const percent = Math.round((bonus.value || 0) * 1000) / 10;
  switch (bonus.stat) {
    case 'fireRate':
      return `攻击间隔 -${percent}%。`;
    case 'damage':
      return `造成伤害 +${percent}%。`;
    case 'critChance':
      return `暴击率 +${percent}%。`;
    case 'damageReduction':
      return `受到伤害 -${percent}%。`;
    case 'dodgeChance':
      return `闪避率 +${percent}%。`;
    case 'blockChance':
      return `格挡率 +${percent}%。`;
    case 'regenRatio':
      return `每秒恢复 ${percent}% 最大生命。`;
    default:
      return '';
  }
}

function toThirdSpecBonusPackage(...entries) {
  return entries.reduce((acc, entry) => {
    if (!entry) return acc;
    switch (entry.stat) {
      case 'damage':
        acc.damageBonus += entry.value || 0;
        break;
      case 'fireRate':
        acc.fireRateBonus += entry.value || 0;
        break;
      case 'critChance':
        acc.critChanceBonus += entry.value || 0;
        break;
      case 'damageReduction':
        acc.damageReductionBonus += entry.value || 0;
        break;
      case 'dodgeChance':
        acc.dodgeChanceBonus += entry.value || 0;
        break;
      case 'blockChance':
        acc.blockChanceBonus += entry.value || 0;
        break;
      case 'regenRatio':
        acc.regenRatioPerSec += entry.value || 0;
        break;
      default:
        break;
    }
    return acc;
  }, {
    damageBonus: 0,
    fireRateBonus: 0,
    critChanceBonus: 0,
    damageReductionBonus: 0,
    dodgeChanceBonus: 0,
    blockChanceBonus: 0,
    regenRatioPerSec: 0
  });
}

function scaleThirdSpecBonus(bonus, multiplier) {
  if (!bonus) return null;
  return {
    ...bonus,
    value: Number(bonus.value || 0) * Number(multiplier || 1)
  };
}

export function getThirdDepthPrepBonus(mainCoreKey) {
  const bonus = DEPTH_ENTRY_BONUSES[mainCoreKey] || null;
  return bonus ? {
    title: bonus.title,
    desc: `获得${formatThirdSpecBonusDesc(bonus)}`,
    bonuses: toThirdSpecBonusPackage(bonus)
  } : null;
}

export function getThirdDualPrepBonus({ mainCoreKey, offFaction }) {
  const mainBonus = DUAL_MAIN_ENTRY_BONUSES[mainCoreKey] || null;
  const offBonus = DUAL_OFF_STYLE_BONUSES_BY_FACTION[offFaction] || null;
  return (mainBonus && offBonus) ? {
    title: `${mainBonus.title} / ${offBonus.title}`,
    desc: `获得${formatThirdSpecBonusDesc(mainBonus)}并获得${formatThirdSpecBonusDesc(offBonus)}`,
    bonuses: toThirdSpecBonusPackage(mainBonus, offBonus)
  } : null;
}

export function getThirdSpecPrepOption({ specType, mainCoreKey, offFaction }) {
  if (specType === 'depth') {
    const base = THIRD_SPEC_PREP_OPTIONS.depth;
    const bonus = getThirdDepthPrepBonus(mainCoreKey);
    return bonus ? { ...base, desc: `${base.desc}。${bonus.desc}` } : base;
  }

  if (specType === 'dual') {
    const base = THIRD_SPEC_PREP_OPTIONS.dual;
    const bonus = getThirdDualPrepBonus({ mainCoreKey, offFaction });
    return bonus ? { ...base, desc: `${base.desc}。${bonus.desc}` } : base;
  }

  return null;
}

// 深度专精池：按主职业主题拆分
export const DEPTH_SPEC_POOLS = {
  mage: [
    { id: 'mage_dualcaster', category: 'third_depth', name: '星界贯炮', desc: '激光变为巨粗贯穿光束，立刻进入终局主炮手感', icon: '法深', maxLevel: 1 },
    { id: 'mage_trilaser', category: 'third_depth', name: '棱镜超载', desc: '激光命中后会在主目标后方继续裂出副光束，强化后排延伸打击', icon: '法深', maxLevel: 1 },
    { id: 'mage_arcanomorph', category: 'third_depth', name: '奥术叠界', desc: '奥能法阵允许重叠，重叠区内法阵增伤与附加效果按层放大', icon: '法深', maxLevel: 3 }
  ],
  archer: [
    { id: 'archer_bounce', category: 'third_depth', name: '反射猎场', desc: '箭矢可在墙体与边界间反弹，优先继续追猎最近敌人', icon: '猎深', maxLevel: 1 },
    { id: 'archer_windfury', category: 'third_depth', name: '暴风裂羽', desc: '每轮散射额外追加一组延迟二段箭幕，形成前后两波清屏', icon: '猎深', maxLevel: 1 },
    { id: 'archer_eagleeye', category: 'third_depth', name: '终局鹰眼', desc: '所有散射箭获得更高暴击权重，对被标记目标进一步提高暴击上限', icon: '猎深', maxLevel: 1 }
  ],
  warrior: [
    { id: 'warrior_bladestorm', category: 'third_depth', name: '永动旋刃', desc: '进入持续旋转状态，移动中也不会中断主攻节奏', icon: '战深', maxLevel: 1 },
    { id: 'warrior_berserkgod', category: 'third_depth', name: '破风利刃', desc: '持续旋转期间周期性向外发射剑刃，补足远端压制与追击', icon: '战深', maxLevel: 3 },
    { id: 'warrior_unyielding', category: 'third_depth', name: '暴走战躯', desc: '血怒、战吼、处决本能收益上限全部提高，低血时旋转更快、剑刃更多', icon: '战深', maxLevel: 1 }
  ],
  warlock: [
    { id: 'warlock_autoseek', category: 'third_depth', name: '瘟疫疆域', desc: '毒圈会主动缓慢索敌并向敌群漂移，多个毒圈靠近时可融合', icon: '术深', maxLevel: 1 },
    { id: 'warlock_souleater', category: 'third_depth', name: '腐灭连环', desc: '中毒敌人死亡时向周围扩散更强的腐蚀层，形成稳定滚雪球', icon: '术深', maxLevel: 3 },
    { id: 'warlock_netherlord', category: 'third_depth', name: '炼狱君王', desc: '地狱火显著强化，并持续放大毒圈伤害、范围与压场能力', icon: '术深', maxLevel: 1 }
  ],
  paladin: [
    { id: 'paladin_avenger', category: 'third_depth', name: '震退反制', desc: '反击命中附带明显击退，高等级可追加短暂眩晕', icon: '骑深', maxLevel: 3 },
    { id: 'paladin_sacredshield', category: 'third_depth', name: '圣棘回响', desc: '格挡、受击、反制时都会反弹一部分神圣伤害', icon: '骑深', maxLevel: 1 },
    { id: 'paladin_divine', category: 'third_depth', name: '审判禁区', desc: '神圣回击、反制、击退彼此联动，在身边形成难以逼近的审判区', icon: '骑深', maxLevel: 1 }
  ],
  druid: [
    { id: 'druid_kingofbeasts', category: 'third_depth', name: '群星坠世', desc: '星落覆盖范围显著扩大，单次施法落点数提升', icon: '德深', maxLevel: 1 },
    { id: 'druid_naturefusion', category: 'third_depth', name: '连星陨爆', desc: '陨石命中后引发二次流星坠击，形成连续轰炸区', icon: '德深', maxLevel: 1 },
    { id: 'druid_astralstorm', category: 'third_depth', name: '天穹潮汐', desc: '星落循环显著加速，流星雨与陨石能更高频进入战场', icon: '德深', maxLevel: 3 }
  ]
};

// 双职业专精池：按（主职业主题 -> 副职业主题）拆分
const CUSTOM_DUAL_SPEC_POOLS = {
  mage: {
    druid: [
      { id: 'dual_mage_druid_arcanebear', category: 'third_dual', name: '奥术之熊', desc: '你的熊灵继承你法阵效果，在法阵内减伤 +20%、攻击力 +30%', icon: '法德', maxLevel: 1 },
      { id: 'dual_mage_druid_starwisdom', category: 'third_dual', name: '星辰智慧', desc: '每层使星落命中后，你的激光冷却 -2%（最高 30%）', icon: '法德', maxLevel: 3 },
      { id: 'dual_mage_druid_natureoverflow', category: 'third_dual', name: '自然溢流', desc: '自然伙伴节点出现权重提高，且熊灵/战鹰/树精强化不会晚于对应宠物本体出现', icon: '法德', maxLevel: 1 }
    ]
  },
  archer: {
    mage: [
      { id: 'dual_scatter_mage_enchantedarrow', category: 'third_dual', name: '附魔箭矢', desc: '你的箭矢有 20% 概率附加一次激光伤害（50% 攻击力）', icon: '猎法', maxLevel: 1 },
      { id: 'dual_scatter_mage_hastefocus', category: 'third_dual', name: '迅捷专注', desc: '每层使猎人攻速 +5%，同时法师迅捷效果 +2%', icon: '猎法', maxLevel: 3 },
      { id: 'dual_scatter_mage_archercircle', category: 'third_dual', name: '射手法阵', desc: '你可以在法阵内移动，且法阵内暴击伤害 +30%', icon: '猎法', maxLevel: 1 }
    ]
  },
  warrior: {
    paladin: [
      { id: 'dual_warrior_paladin_crusade', category: 'third_dual', name: '十字军', desc: '你的旋风斩每命中一个敌人，格挡率 +5%，持续 3 秒（可叠加）', icon: '战骑', maxLevel: 1 },
      { id: 'dual_warrior_paladin_righteousrage', category: 'third_dual', name: '正义血怒', desc: '每层使血怒每层增伤额外 +1%，且血怒状态下格挡率 +10%', icon: '战骑', maxLevel: 3 },
      { id: 'dual_warrior_paladin_sacredspin', category: 'third_dual', name: '神圣旋风', desc: '旋风斩变为神圣伤害，对亡灵/恶魔敌人伤害 +50%', icon: '战骑', maxLevel: 1 }
    ]
  },
  warlock: {
    druid: [
      { id: 'dual_warlock_druid_decay', category: 'third_dual', name: '腐败滋养', desc: '你的宠物攻击时有 25% 概率施加腐蚀，且腐蚀伤害可治疗宠物', icon: '术德', maxLevel: 1 },
      { id: 'dual_warlock_druid_witheringroar', category: 'third_dual', name: '凋零咆哮', desc: '熊灵咆哮时，对周围敌人施加虚弱（伤害 -20%）', icon: '术德', maxLevel: 1 },
      { id: 'dual_warlock_druid_soulbloom', category: 'third_dual', name: '灵魂绽放', desc: '每层使树精的治疗有 10% 概率同时移除一个负面效果', icon: '术德', maxLevel: 3 }
    ]
  },
  paladin: {
    archer: [
      { id: 'dual_paladin_scatter_holyrain', category: 'third_dual', name: '圣光箭雨', desc: '你的箭雨变为神圣箭雨，对敌人造成额外 20% 神圣伤害并致盲 1 秒', icon: '骑猎', maxLevel: 1 },
      { id: 'dual_paladin_scatter_blessedquiver', category: 'third_dual', name: '祝福箭袋', desc: '每层使你的暴击率 +3%，且暴击时有 20% 概率为自己回复 2% 生命', icon: '骑猎', maxLevel: 3 },
      { id: 'dual_paladin_scatter_retribution', category: 'third_dual', name: '惩戒射击', desc: '对攻击你的敌人，你的下次攻击必定暴击，并附带击退或短暂硬直', icon: '骑猎', maxLevel: 1 }
    ]
  },
  druid: {
    warrior: [
      { id: 'dual_druid_warrior_ironbark', category: 'third_dual', name: '铁木之熊', desc: '你的熊灵获得战士不屈特性：生命低于 50% 时伤害 +30%', icon: '德战', maxLevel: 1 },
      { id: 'dual_druid_warrior_predator', category: 'third_dual', name: '掠食者', desc: '每层使战鹰对生命低于 50% 的敌人伤害 +10%', icon: '德战', maxLevel: 3 },
      { id: 'dual_druid_warrior_ancestral', category: 'third_dual', name: '先祖韧性', desc: '你的树精每 5 秒为战士提供一层血怒（无伤害，仅增伤）', icon: '德战', maxLevel: 1 }
    ]
  }
};

const GENERIC_DUAL_MAIN_TITLES = {
  mage: '奥术过载',
  archer: '致命节律',
  warrior: '战场压制',
  warlock: '召魂涌流',
  paladin: '圣裁锋芒',
  druid: '星潮迸发'
};

const GENERIC_DUAL_OFF_TITLES = {
  mage: '法阵余韵',
  archer: '猎人步调',
  warrior: '不屈战意',
  warlock: '召魂灌注',
  paladin: '守护庇佑',
  druid: '自然回响'
};

function getDualStyleBonusByAccentCore(accentCoreKey) {
  const entry = Object.entries(OFF_FACTION_TO_ACCENT_CORE_KEY).find(([, value]) => value === accentCoreKey);
  const offFaction = entry?.[0] || null;
  return offFaction ? DUAL_OFF_STYLE_BONUSES_BY_FACTION[offFaction] || null : null;
}

function getCanonicalDualPair(mainCoreKey, accentCoreKey) {
  const left = String(mainCoreKey || '');
  const right = String(accentCoreKey || '');
  if (!left || !right) return ['', ''];
  return left < right ? [left, right] : [right, left];
}

function buildCanonicalDualTalentId(mainCoreKey, accentCoreKey, suffix) {
  const [left, right] = getCanonicalDualPair(mainCoreKey, accentCoreKey);
  return `dual_${left}_${right}_${suffix}`;
}

function buildGenericDualPool(mainCoreKey, accentCoreKey) {
  const [leftKey, rightKey] = getCanonicalDualPair(mainCoreKey, accentCoreKey);
  const leftLabel = THIRD_SPEC_CORE_LABELS[leftKey] || leftKey;
  const rightLabel = THIRD_SPEC_CORE_LABELS[rightKey] || rightKey;
  const leftMainBonus = scaleThirdSpecBonus(DUAL_MAIN_ENTRY_BONUSES[leftKey], 0.7);
  const rightMainBonus = scaleThirdSpecBonus(DUAL_MAIN_ENTRY_BONUSES[rightKey], 0.7);
  const leftStyleBonus = scaleThirdSpecBonus(getDualStyleBonusByAccentCore(leftKey), 0.7);
  const rightStyleBonus = scaleThirdSpecBonus(getDualStyleBonusByAccentCore(rightKey), 0.7);
  const sharedMainBonus = leftMainBonus || rightMainBonus;
  const sharedStyleBonus = rightStyleBonus || leftStyleBonus;
  const fusionBonusA = scaleThirdSpecBonus(sharedMainBonus, 0.55);
  const fusionBonusB = scaleThirdSpecBonus(sharedStyleBonus, 0.55);

  return [
    {
      id: buildCanonicalDualTalentId(leftKey, rightKey, 'onslaught'),
      category: 'third_dual',
      name: `${leftLabel} / ${rightLabel} 先攻`,
      desc: `双职业主轴强化：${formatThirdSpecBonusDesc(sharedMainBonus)}`,
      icon: `${leftLabel}${rightLabel}`,
      maxLevel: 1
    },
    {
      id: buildCanonicalDualTalentId(leftKey, rightKey, 'style'),
      category: 'third_dual',
      name: `${leftLabel} / ${rightLabel} 偏锋`,
      desc: `双职业风格强化：${formatThirdSpecBonusDesc(sharedStyleBonus)}`,
      icon: `${leftLabel}${rightLabel}`,
      maxLevel: 1
    },
    {
      id: buildCanonicalDualTalentId(leftKey, rightKey, 'fusion'),
      category: 'third_dual',
      name: `${leftLabel}·${rightLabel} 共振`,
      desc: `混融强化：${formatThirdSpecBonusDesc(fusionBonusA)}并${formatThirdSpecBonusDesc(fusionBonusB)}`,
      icon: `${leftLabel}${rightLabel}`,
      maxLevel: 1
    }
  ];
}

export const DUAL_SPEC_GENERIC_BONUS_BY_ID = {};

const THIRD_SPEC_CORE_ORDER = ['mage', 'archer', 'warrior', 'warlock', 'paladin', 'druid'];

const CUSTOM_DUAL_SPEC_PAIR_POOLS = {
  'druid|mage': CUSTOM_DUAL_SPEC_POOLS.mage.druid,
  'archer|mage': CUSTOM_DUAL_SPEC_POOLS.archer.mage,
  'paladin|warrior': CUSTOM_DUAL_SPEC_POOLS.warrior.paladin,
  'druid|warlock': CUSTOM_DUAL_SPEC_POOLS.warlock.druid,
  'archer|paladin': CUSTOM_DUAL_SPEC_POOLS.paladin.archer,
  'druid|warrior': CUSTOM_DUAL_SPEC_POOLS.druid.warrior
};

const DUAL_SPEC_PAIR_POOLS = {};

THIRD_SPEC_CORE_ORDER.forEach((mainCoreKey) => {
  THIRD_SPEC_CORE_ORDER.forEach((accentCoreKey) => {
    if (mainCoreKey === accentCoreKey) return;
    const [leftKey, rightKey] = getCanonicalDualPair(mainCoreKey, accentCoreKey);
    const pairKey = `${leftKey}|${rightKey}`;
    if (DUAL_SPEC_PAIR_POOLS[pairKey]) return;

    const customPool = CUSTOM_DUAL_SPEC_PAIR_POOLS[pairKey] || null;
    const pairPool = customPool || buildGenericDualPool(leftKey, rightKey);
    DUAL_SPEC_PAIR_POOLS[pairKey] = pairPool;

    if (customPool) return;

    const leftMainBonus = scaleThirdSpecBonus(DUAL_MAIN_ENTRY_BONUSES[leftKey], 0.7);
    const rightMainBonus = scaleThirdSpecBonus(DUAL_MAIN_ENTRY_BONUSES[rightKey], 0.7);
    const leftStyleBonus = scaleThirdSpecBonus(getDualStyleBonusByAccentCore(leftKey), 0.7);
    const rightStyleBonus = scaleThirdSpecBonus(getDualStyleBonusByAccentCore(rightKey), 0.7);
    const sharedMainBonus = leftMainBonus || rightMainBonus;
    const sharedStyleBonus = rightStyleBonus || leftStyleBonus;

    DUAL_SPEC_GENERIC_BONUS_BY_ID[buildCanonicalDualTalentId(leftKey, rightKey, 'onslaught')] = toThirdSpecBonusPackage(sharedMainBonus);
    DUAL_SPEC_GENERIC_BONUS_BY_ID[buildCanonicalDualTalentId(leftKey, rightKey, 'style')] = toThirdSpecBonusPackage(sharedStyleBonus);
    DUAL_SPEC_GENERIC_BONUS_BY_ID[buildCanonicalDualTalentId(leftKey, rightKey, 'fusion')] = toThirdSpecBonusPackage(
      scaleThirdSpecBonus(sharedMainBonus, 0.55),
      scaleThirdSpecBonus(sharedStyleBonus, 0.55)
    );
  });
});

export const DUAL_SPEC_POOLS = THIRD_SPEC_CORE_ORDER.reduce((acc, mainCoreKey) => {
  acc[mainCoreKey] = acc[mainCoreKey] || {};

  THIRD_SPEC_CORE_ORDER.forEach((accentCoreKey) => {
    if (mainCoreKey === accentCoreKey) return;
    const [leftKey, rightKey] = getCanonicalDualPair(mainCoreKey, accentCoreKey);
    const pairKey = `${leftKey}|${rightKey}`;
    acc[mainCoreKey][accentCoreKey] = DUAL_SPEC_PAIR_POOLS[pairKey] || [];
  });

  return acc;
}, {});

// 技能树 id -> GameScene.buildState.core key
export const TREE_TO_CORE_KEY = {
  archer: 'archer',
  druid: 'druid',
  warrior: 'warrior',
  mage: 'mage',
  paladin: 'paladin',
  warlock: 'warlock'
};
