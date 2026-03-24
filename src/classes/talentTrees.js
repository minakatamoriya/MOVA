// 天赋树/技能树：仅用于 UI 展示与进度记录

import { DEPTH_SPEC_POOLS } from './upgradePools';
import { resolveClassColor } from './visual/classColors';
import { normalizeCoreKey } from './classDefs';

export const TREE_DEFS = [
  {
    id: 'archer',
    name: '猎人-主',
    color: resolveClassColor('archer'),
    core: { id: 'archer_core', name: '初始：猎人', maxLevel: 1, desc: '解锁箭矢连射。' },
    nodes: [
      { id: 'archer_nimble_evade', name: '灵巧回避', maxLevel: 2, desc: '生命低于30%时自动触发：1级闪避率 +60%，持续8秒；2级闪避率 +80%，持续10秒；冷却30秒。' },
      { id: 'archer_range', name: '射程', maxLevel: 1, desc: '基础射击射程直接提升到 +36%。' },
      { id: 'archer_volley', name: '箭矢齐射', maxLevel: 3, desc: '基础射击初始为3列；1级变为5列，2级收束弹道并强化锁定，3级变为7列，中心列始终锁定目标。' }
    ]
  },
  {
    id: 'druid',
    name: '德鲁伊-主',
    color: resolveClassColor('druid'),
    core: { id: 'druid_core', name: '初始：德鲁伊', maxLevel: 1, desc: '解锁星落（定位敌方，星星下落造成范围伤害）。' },
    nodes: [
      { id: 'druid_meteor_shower', name: '星域牵引', maxLevel: 3, desc: '强化星落的锁定与落点覆盖。1/2/3级分别将索敌范围提高到 350/395/440，爆炸半径提高到 80/92/106。' },
      { id: 'druid_meteor', name: '坠星', maxLevel: 3, desc: '强化单次星落质量。1/2/3级分别使星落伤害提高 15%/30%/45%，下坠时间压缩到 235/210/185 毫秒。' },
      { id: 'druid_starfire', name: '星火', maxLevel: 3, desc: '星落命中后有概率在原地引发一次追击星火。1/2/3级概率与伤害分别为 20%/45%、30%/60%、40%/75%（不连锁）。' },
      { id: 'druid_nourish', name: '自然滋养', maxLevel: 2, desc: '生命低于30%时自动触发：1级在10秒内回复54%生命；2级在5秒内回复60%生命；冷却30秒。' }
    ]
  },
  {
    id: 'warrior',
    name: '战士-主',
    color: resolveClassColor('warrior'),
    core: { id: 'warrior_core', name: '初始：战士', maxLevel: 1, desc: '攻击变为近战挥砍并外放真空刃。' },
    nodes: [
      { id: 'warrior_range', name: '斩域展开', maxLevel: 3, desc: '强化风刃射程。1/2/3级分别提高基础射程约 27%/55%/91%（对应 280/340/420）。' },
      { id: 'warrior_swordqi', name: '真空刃强化', maxLevel: 3, desc: '提升每次挥砍放出的风刃数量与飞行速度。基础 1 枚；1/2/3级分别提升到 3/5/10 枚，并同步提高风刃飞行速度。' },
      { id: 'warrior_damage', name: '破军刃势', maxLevel: 3, desc: '直接提高战士基础技能伤害。1/2/3级分别提高 12%/24%/40%。' },
    { id: 'warrior_blood_conversion', name: '猩红嗜血', maxLevel: 2, desc: '生命低于30%时自动触发：1级攻击伤害转化为150%吸血，持续10秒；2级转化为200%吸血，持续15秒；冷却30秒。' }
    ]
  },
  {
    id: 'mage',
    name: '法师-主',
    color: resolveClassColor('mage'),
    core: { id: 'mage_core', name: '初始：法师', maxLevel: 1, desc: '攻击变为单发冰弹，命中叠加寒霜，叠满五层爆炸并传染。' },
    nodes: [
      { id: 'mage_frostbite', name: '霜蚀', maxLevel: 1, desc: '冰弹自带强减速，提升到 48%，持续 2.7 秒。' },
      { id: 'mage_cold_focus', name: '寒域感知', maxLevel: 1, desc: '冰弹索敌范围额外 +135。' },
      { id: 'mage_ice_veins', name: '冰脉灌注', maxLevel: 1, desc: '强化冰弹本体，伤害 +30%。' },
      { id: 'mage_deep_freeze', name: '深度冻结', maxLevel: 1, desc: '5 层碎冰后额外冻结主目标 1.7 秒。' },
      { id: 'mage_shatter', name: '碎冰传染', maxLevel: 3, desc: '强化基础碎冰爆裂。1/2级提升半径与伤害；3级额外把传染提升到 2 层。1/2/3级分别为半径 120/150/185，伤害 70%/100%/135%，传染 1/1/2 层寒霜。' },
      { id: 'mage_frost_nova', name: '冰霜新星', maxLevel: 2, desc: '生命低于30%时自动触发冰霜新星。1级冻结 5 秒、范围 380；2级冻结 10 秒、范围 480；冷却30秒。' }
    ]
  },
  {
    id: 'paladin',
    name: '圣骑士-主',
    color: resolveClassColor('paladin'),
    core: { id: 'paladin_core', name: '初始：圣骑', maxLevel: 1, desc: '护盾脉冲清弹并反击。' },
    nodes: [
      { id: 'paladin_pierce', name: '重锤', maxLevel: 1, desc: '锤击范围与伤害提高。' },
      { id: 'paladin_repulse', name: '震荡锤击', maxLevel: 1, desc: '锤击命中附带明显击退。' },
      { id: 'paladin_triple', name: '连锤', maxLevel: 1, desc: '每 5 秒，下一次锤击额外追加 2 次余震落点。' },
      { id: 'paladin_stun', name: '制裁', maxLevel: 1, desc: '锤击有 30% 概率使敌人眩晕。' },
      { id: 'paladin_divine_shelter', name: '神圣庇护', maxLevel: 2, desc: '生命低于30%时自动触发：1级获得 60% 减伤并持续 8 秒；2级获得 80% 减伤并持续 12 秒；冷却30秒。' }
    ]
  },
  {
    id: 'warlock',
    name: '术士-主',
    color: resolveClassColor('warlock'),
    core: { id: 'warlock_core', name: '初始：术士', maxLevel: 1, desc: '解锁基础技能：剧毒新星（每 2 秒在脚下留下毒圈并逐渐扩大）。' },
    nodes: [
      { id: 'warlock_toxicity', name: '毒性浓度', maxLevel: 3, desc: '剧毒 debuff 最大层数 +1（可叠加）。' },
      { id: 'warlock_corrode', name: '腐蚀', maxLevel: 1, desc: '毒圈持续时间额外 +3 秒。' },
      { id: 'warlock_spread', name: '扩散', maxLevel: 1, desc: '毒圈范围 +60%。' },
      { id: 'warlock_infernal', name: '灵魂虹吸', maxLevel: 2, desc: '生命首次跌破30%时自动触发：1级持续5秒，50%伤害吸血，并可转化20%最大生命护盾；2级持续10秒，100%吸血，并可转化30%最大生命护盾；冷却30秒。' }
    ]
  },

  // ====== 副职业通用派系（纯被动） ======
  {
    id: 'arcane',
    name: '法师-副',
    color: resolveClassColor('mage'),
    core: { id: 'off_arcane', name: '选择：奥术', maxLevel: 1, desc: '作为副职业，立即获得基础奥术炮台，并解锁奥术系天赋池。' },
    nodes: [
      { id: 'arcane_circle', name: '奥术炮台', maxLevel: 2, desc: '把基础奥术炮台强化到中后期压场档位。' },
      { id: 'arcane_circle_range', name: '棱镜扩容', maxLevel: 1, desc: '大幅提升炮台索敌范围。' },
      { id: 'arcane_fire_circle', name: '奥能灌注', maxLevel: 1, desc: '大幅提高炮台单次激光伤害。' },
      { id: 'arcane_frost_circle', name: '晶体固化', maxLevel: 1, desc: '大幅提高炮台持续时间与驻场能力。' },
      { id: 'arcane_resonance_mark', name: '共鸣裂变', maxLevel: 1, desc: '炮台激光命中会附加强力易伤。' },
      { id: 'arcane_flowcasting', name: '多重布阵', maxLevel: 3, desc: '缩短布置循环，并提升同时存在的炮台数量。' }
    ]
  },
  {
    id: 'ranger',
    name: '猎人-副',
    color: resolveClassColor('archer'),
    core: { id: 'off_ranger', name: '选择：猎人', maxLevel: 1, desc: '作为副职业，立即获得基础诱饵假人，并解锁猎人系天赋池。' },
    nodes: [
      { id: 'ranger_snaretrap', name: '诱饵假人', maxLevel: 2, desc: '把基础诱饵假人强化到稳定控场档位。' },
      { id: 'ranger_huntmark', name: '猎手印记', maxLevel: 1, desc: '被假人牵制的敌人会被标记，承受你更多伤害。' },
      { id: 'ranger_spiketrap', name: '缚行力场', maxLevel: 3, desc: '假人周围形成束缚力场，持续减速并附带轻度持续伤害。' },
      { id: 'ranger_blasttrap', name: '诱爆装置', maxLevel: 1, desc: '显著强化假人结束时的范围爆炸伤害。' },
      { id: 'ranger_trapcraft', name: '拟饵工学', maxLevel: 3, desc: '强化假人持续时间、冷却与同时存在数量。' },
      { id: 'ranger_pack_hunter', name: '围猎本能', maxLevel: 1, desc: '强化你对被标记或被牵制目标的暴击收益。' }
    ]
  },
  {
    id: 'unyielding',
    name: '战士-副',
    color: resolveClassColor('warrior'),
    core: { id: 'off_unyielding', name: '选择：不屈', maxLevel: 1, desc: '作为副职业，立即获得基础血怒，并解锁不屈系天赋池。' },
    nodes: [
      { id: 'unyielding_bloodrage', name: '血怒', maxLevel: 2, desc: '把基础血怒强化到终局档位。' },
      { id: 'unyielding_battlecry', name: '战吼', maxLevel: 1, desc: '受伤后短时间大幅提高伤害。' },
      { id: 'unyielding_hamstring', name: '断筋', maxLevel: 1, desc: '近距离命中使敌人显著减速。' },
      { id: 'unyielding_sunder', name: '破甲', maxLevel: 1, desc: '持续命中同一目标时显著提高对其伤害。' },
      { id: 'unyielding_standfast', name: '不退', maxLevel: 2, desc: '近距离时获得更高贴身减伤。' },
      { id: 'unyielding_executioner', name: '处决本能', maxLevel: 1, desc: '对低血敌人造成高额额外伤害。' }
    ]
  },
  {
    id: 'summon',
    name: '术士-副',
    color: resolveClassColor('warlock'),
    core: { id: 'off_summon', name: '选择：召唤', maxLevel: 1, desc: '作为副职业，立即获得 1 名骷髅卫士与 1 名骷髅法师，并解锁召唤系天赋池。' },
    nodes: [
      { id: 'summon_necrotic_vitality', name: '死灵共鸣', maxLevel: 1, desc: '大幅提高召唤物生命。' },
      { id: 'summon_skeleton_guard', name: '骷髅卫士', maxLevel: 3, desc: '扩充骷髅卫士军势。等级 1/2/3 时总上限为 3/5/7。' },
      { id: 'summon_skeleton_mage', name: '骷髅法师', maxLevel: 3, desc: '扩充骷髅法师军势。等级 1/2/3 时总上限为 3/5/7。' },
      { id: 'summon_mage_empower', name: '白骨灌能', maxLevel: 2, desc: '分两段强化骷髅法师输出与节奏。' },
      { id: 'summon_guard_bulwark', name: '骸骨壁垒', maxLevel: 1, desc: '大幅强化骷髅卫士生存与拦截能力。' },
      { id: 'summon_ember_echo', name: '魂火余烬', maxLevel: 3, desc: '召唤物死亡后为你提供短时间增伤或减伤。' }
    ]
  },
  {
    id: 'guardian',
    name: '圣骑士-副',
    color: resolveClassColor('paladin'),
    core: { id: 'off_guardian', name: '选择：守护', maxLevel: 1, desc: '作为副职业，立即获得基础格挡与圣印，并解锁守护系天赋池。' },
    nodes: [
      { id: 'guardian_block', name: '坚盾', maxLevel: 2, desc: '把基础格挡强化到终局档位。' },
      { id: 'guardian_armor', name: '护甲', maxLevel: 1, desc: '大幅提高固定减伤。' },
      { id: 'guardian_counter', name: '反制', maxLevel: 1, desc: '格挡成功后触发强力反击。' },
      { id: 'guardian_sacred_seal', name: '庇护圣印', maxLevel: 2, desc: '把基础圣印强化到终局档位。' },
      { id: 'guardian_holy_rebuke', name: '神圣回击', maxLevel: 2, desc: '消耗圣印触发更强的范围冲击。' },
      { id: 'guardian_light_fortress', name: '光铸壁垒', maxLevel: 1, desc: '低血时高效把圣印转为护盾。' }
    ]
  },
  {
    id: 'nature',
    name: '德鲁伊-副',
    color: resolveClassColor('druid'),
    core: { id: 'off_nature', name: '选择：自然伙伴', maxLevel: 1, desc: '作为副职业，立即获得 1 只熊灵，并解锁自然伙伴天赋池。' },
    nodes: [
      { id: 'druid_pet_bear', name: '熊灵', maxLevel: 3, desc: '召唤熊灵协同作战，负责前排拦截。' },
      { id: 'druid_pet_hawk', name: '战鹰', maxLevel: 3, desc: '召唤战鹰协同作战，负责高频输出。' },
      { id: 'druid_pet_treant', name: '树精', maxLevel: 3, desc: '召唤树精协同作战，负责治疗与护盾。' },
      { id: 'nature_bear_guard', name: '熊灵守护', maxLevel: 3, desc: '强化熊灵承担伤害与拦截能力。' },
      { id: 'nature_hawk_huntmark', name: '战鹰猎印', maxLevel: 3, desc: '强化战鹰标记与增伤。' },
      { id: 'nature_treant_bloom', name: '树精繁茂', maxLevel: 3, desc: '强化树精治疗与护盾。' }
    ]
  }
];

const MAIN_TREE_IDS = new Set(['archer', 'druid', 'warrior', 'mage', 'paladin', 'warlock']);

TREE_DEFS.forEach((treeDef) => {
  if (!MAIN_TREE_IDS.has(treeDef.id)) return;

  const depthNodes = (DEPTH_SPEC_POOLS[treeDef.id] || []).map((opt) => ({
    id: opt.id,
    name: opt.name,
    maxLevel: opt.maxLevel || 1,
    desc: opt.desc || ''
  }));

  treeDef.nodes = [...(treeDef.nodes || []), ...depthNodes];
});

export const SKILL_TO_TREE = {
  // 猎人（散射流）
  archer_core: 'archer',
  archer_rapidfire: 'archer',
  archer_pierce: 'archer',
  archer_arrowrain: 'archer',
  archer_nimble_evade: 'archer',
  archer_range: 'archer',
  archer_rate: 'archer',
  archer_damage: 'archer',
  archer_volley: 'archer',

  // 德鲁伊（星落）
  druid_core: 'druid',
  druid_meteor_shower: 'druid',
  druid_meteor: 'druid',
  druid_starfire: 'druid',
  druid_nourish: 'druid',

  // 其余职业
  warrior_core: 'warrior',
  warrior_swordqi: 'warrior',
  warrior_damage: 'warrior',
  warrior_range: 'warrior',
  warrior_blood_conversion: 'warrior',

  mage_core: 'mage',
  mage_frostbite: 'mage',
  mage_cold_focus: 'mage',
  mage_ice_veins: 'mage',
  mage_deep_freeze: 'mage',
  mage_shatter: 'mage',
  mage_frost_nova: 'mage',

  paladin_core: 'paladin',
  paladin_pierce: 'paladin',
  paladin_repulse: 'paladin',
  paladin_triple: 'paladin',
  paladin_stun: 'paladin',
  paladin_divine_shelter: 'paladin',

  warlock_core: 'warlock',
  warlock_toxicity: 'warlock',
  warlock_spread: 'warlock',
  warlock_corrode: 'warlock',
  warlock_infernal: 'warlock',
  warlock_autoseek: 'warlock',
  warlock_malady: 'warlock',
  warlock_contagion: 'warlock',
  warlock_smoke: 'warlock',
  warlock_plague: 'warlock',

  // 副职业通用：派系选择
  off_arcane: 'arcane',
  off_ranger: 'ranger',
  off_unyielding: 'unyielding',
  off_summon: 'summon',
  summon_necrotic_vitality: 'summon',
  off_guardian: 'guardian',
  off_nature: 'nature',

  // 副职业通用：奥术
  arcane_circle: 'arcane',
  arcane_circle_range: 'arcane',
  arcane_fire_circle: 'arcane',
  arcane_frost_circle: 'arcane',
  arcane_resonance_mark: 'arcane',
  arcane_flowcasting: 'arcane',

  // 副职业通用：猎人
  ranger_snaretrap: 'ranger',
  ranger_huntmark: 'ranger',
  ranger_spiketrap: 'ranger',
  ranger_blasttrap: 'ranger',
  ranger_trapcraft: 'ranger',
  ranger_pack_hunter: 'ranger',

  // 副职业通用：不屈
  unyielding_bloodrage: 'unyielding',
  unyielding_battlecry: 'unyielding',
  unyielding_hamstring: 'unyielding',
  unyielding_sunder: 'unyielding',
  unyielding_standfast: 'unyielding',
  unyielding_executioner: 'unyielding',

  // 副职业通用：召唤
  off_summon: 'summon',
  summon_skeleton_guard: 'summon',
  summon_skeleton_mage: 'summon',
  summon_mage_empower: 'summon',
  summon_guard_bulwark: 'summon',
  summon_ember_echo: 'summon',

  // 副职业通用：守护
  guardian_block: 'guardian',
  guardian_armor: 'guardian',
  guardian_counter: 'guardian',
  guardian_sacred_seal: 'guardian',
  guardian_holy_rebuke: 'guardian',
  guardian_light_fortress: 'guardian',

  // 副职业通用：自然伙伴（契约）
  druid_pet_bear: 'nature',
  druid_pet_hawk: 'nature',
  druid_pet_treant: 'nature',

  // 副职业通用：自然伙伴（宠物强化）
  nature_bear_guard: 'nature',
  nature_hawk_huntmark: 'nature',
  nature_treant_bloom: 'nature',

  // 深度专精并入主职业树
  mage_dualcaster: 'mage',
  mage_trilaser: 'mage',
  mage_arcanomorph: 'mage',
  archer_bounce: 'archer',
  archer_windfury: 'archer',
  archer_eagleeye: 'archer',

  warrior_spin: 'warrior',
  warrior_berserkgod: 'warrior',
  warrior_unyielding: 'warrior',

  warlock_souleater: 'warlock',
  warlock_netherlord: 'warlock',

  paladin_avenger: 'paladin',
  paladin_sacredshield: 'paladin',
  paladin_divine: 'paladin',

  druid_kingofbeasts: 'druid',
  druid_naturefusion: 'druid',
  druid_astralstorm: 'druid'
};

export const SKILL_ID_ALIASES = {
  drone_core: 'druid_core',
  mage_refract: 'mage_frostbite',
  mage_arcane_perception: 'mage_cold_focus',
  mage_energy_focus: 'mage_ice_veins',
  off_curse: 'off_summon',
  curse_necrotic_vitality: 'summon_necrotic_vitality',
  curse_skeleton_guard: 'summon_skeleton_guard',
  curse_skeleton_mage: 'summon_skeleton_mage',
  curse_mage_empower: 'summon_mage_empower',
  curse_guard_bulwark: 'summon_guard_bulwark',
  curse_ember_echo: 'summon_ember_echo'
};

export function normalizeSkillId(skillId) {
  if (!skillId) return skillId;
  return SKILL_ID_ALIASES[skillId] || skillId;
}

// 副职业派系 -> 对应“职业主题”的核心 key（用于判断是否同职业 & 第三天赋树类型）
// 注意：这里的 key 与 GameScene.registry 中的 offFaction 保持一致。
export const OFF_FACTION_TO_ACCENT_CORE_KEY = {
  arcane: 'mage',
  ranger: 'archer',
  unyielding: 'warrior',
  summon: 'warlock',
  guardian: 'paladin',
  nature: 'druid'
};

export function getAccentCoreKeyForOffFaction(offFaction) {
  if (!offFaction) return null;
  return OFF_FACTION_TO_ACCENT_CORE_KEY[offFaction] || null;
}

const MAX_LEVELS = Object.fromEntries(
  TREE_DEFS.flatMap(t => [t.core, ...t.nodes].filter(Boolean).map(n => [n.id, n.maxLevel || 1]))
);

export function getTreeIdForSkill(skillId) {
  const normalizedSkillId = normalizeSkillId(skillId);
  const explicitTreeId = SKILL_TO_TREE[normalizedSkillId] || null;
  if (explicitTreeId) return explicitTreeId;

  return null;
}

export function getMaxLevel(skillId) {
  const normalizedSkillId = normalizeSkillId(skillId);
  return MAX_LEVELS[normalizedSkillId] || 1;
}
