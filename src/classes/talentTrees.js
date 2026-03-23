// 天赋树/技能树：仅用于 UI 展示与进度记录

import { DEPTH_SPEC_POOLS, DUAL_SPEC_POOLS, THIRD_SPEC_PREP_OPTIONS } from './upgradePools';
import { resolveClassColor } from './visual/classColors';
import { normalizeCoreKey } from './classDefs';

export const TREE_DEFS = [
  {
    id: 'archer',
    name: '猎人-主',
    color: resolveClassColor('archer'),
    core: { id: 'archer_core', name: '初始：猎人', maxLevel: 1, desc: '解锁箭矢连射。' },
    nodes: [
      { id: 'archer_nimble_evade', name: '灵巧回避', maxLevel: 3, desc: '生命低于30%时自动触发：闪避率 +40%/+60%/+80%，持续3秒，冷却30秒。' },
      { id: 'archer_evade_mastery', name: '残影步调', maxLevel: 3, desc: '强化灵巧回避：持续时间提高至5/8/10秒。' },
      { id: 'archer_range', name: '射程', maxLevel: 3, desc: '基础射击射程提升（+12%/+24%/+36%）。' },
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
      { id: 'druid_nourish', name: '自然滋养', maxLevel: 3, desc: '生命低于30%时自动触发：在15/10/5秒内缓慢回复30%生命，冷却30秒。' },
      { id: 'druid_nourish_growth', name: '丰饶脉动', maxLevel: 3, desc: '强化自然滋养：总回复量额外提高50%/80%/100%。' }
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
      { id: 'warrior_blood_conversion', name: '猩红嗜血', maxLevel: 3, desc: '生命低于30%时自动触发：攻击伤害转化为100%吸血，持续5/10/15秒，冷却30秒。' },
      { id: 'warrior_bloodlust_mastery', name: '狂血渴饮', maxLevel: 3, desc: '强化猩红嗜血：攻击伤害转化提高至120%/150%/200%。' }
    ]
  },
  {
    id: 'mage',
    name: '法师-主',
    color: resolveClassColor('mage'),
    core: { id: 'mage_core', name: '初始：法师', maxLevel: 1, desc: '攻击变为单发冰弹，命中叠加寒霜，叠满五层爆炸并传染。' },
    nodes: [
      { id: 'mage_frostbite', name: '霜蚀', maxLevel: 3, desc: '冰弹自带减速；1/2/3级强化到 30%/38%/48%，持续 1.9/2.3/2.7 秒。' },
      { id: 'mage_cold_focus', name: '寒域感知', maxLevel: 3, desc: '冰弹索敌范围提升。1/2/3级额外 +45/+90/+135。' },
      { id: 'mage_ice_veins', name: '冰脉灌注', maxLevel: 3, desc: '强化冰弹本体。1/2/3级伤害 +10%/+20%/+30%，弹道更利落。' },
      { id: 'mage_deep_freeze', name: '深度冻结', maxLevel: 3, desc: '5 层碎冰后额外冻结主目标。1/2/3级分别冻结 0.8/1.2/1.7 秒。' },
      { id: 'mage_shatter', name: '碎冰传染', maxLevel: 3, desc: '强化基础碎冰爆裂。1/2级提升半径与伤害；3级额外把传染提升到 2 层。1/2/3级分别为半径 120/150/185，伤害 70%/100%/135%，传染 1/1/2 层寒霜。' },
      { id: 'mage_frost_nova', name: '冰霜新星', maxLevel: 3, desc: '生命低于30%时自动触发冰霜新星。1/2/3级冻结周围敌人 3/5/10 秒，冷却30秒。' },
      { id: 'mage_frost_domain', name: '极寒疆域', maxLevel: 3, desc: '强化冰霜新星范围。1/2/3级范围提升至 300/380/480。' }
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
      { id: 'paladin_stun', name: '制裁', maxLevel: 3, desc: '锤击有 10%/20%/30% 概率使敌人眩晕。' },
      { id: 'paladin_divine_shelter', name: '神圣庇护', maxLevel: 3, desc: '生命低于30%时自动触发：获得40%/60%/80%减伤，持续5秒，冷却30秒。' },
      { id: 'paladin_shelter_extension', name: '圣佑绵延', maxLevel: 3, desc: '强化神圣庇护：持续时间提高至8/10/12秒。' }
    ]
  },
  {
    id: 'warlock',
    name: '术士-主',
    color: resolveClassColor('warlock'),
    core: { id: 'warlock_core', name: '初始：术士', maxLevel: 1, desc: '解锁基础技能：剧毒新星（每 2 秒在脚下留下毒圈并逐渐扩大）。' },
    nodes: [
      { id: 'warlock_toxicity', name: '毒性浓度', maxLevel: 3, desc: '剧毒 debuff 最大层数 +1（可叠加）。' },
      { id: 'warlock_corrode', name: '腐蚀', maxLevel: 3, desc: '毒圈持续时间 +1 秒（可叠加）。' },
      { id: 'warlock_spread', name: '扩散', maxLevel: 3, desc: '毒圈范围 +20%（可叠加）。' },
      { id: 'warlock_infernal', name: '灵魂虹吸', maxLevel: 3, desc: '生命首次跌破30%时自动触发：持续 3/5/10 秒，期间将造成伤害的 30%/50%/100% 转化为生命，冷却30秒。' },
      { id: 'warlock_infernal_contract', name: '白骨护甲', maxLevel: 3, desc: '强化灵魂虹吸：效果期间过量治疗转化为白骨护盾，护盾上限为最大生命的 10%/20%/30%。' }
    ]
  },

  // ====== 副职业通用派系（纯被动） ======
  {
    id: 'arcane',
    name: '法师-副',
    color: resolveClassColor('mage'),
    core: { id: 'off_arcane', name: '选择：奥术', maxLevel: 1, desc: '作为副职业，获得奥术炮台：基础每10秒自动部署漂浮水晶炮台，基准驻场15秒，每3秒向射程内目标发射粗直线贯穿激光。' },
    nodes: [
      { id: 'arcane_circle', name: '奥术炮台', maxLevel: 3, desc: '自动布置漂浮水晶炮台，周期发射粗直线贯穿激光。' },
      { id: 'arcane_circle_range', name: '棱镜扩容', maxLevel: 3, desc: '提升炮台索敌范围。' },
      { id: 'arcane_fire_circle', name: '奥能灌注', maxLevel: 3, desc: '提高炮台单次激光伤害。' },
      { id: 'arcane_frost_circle', name: '晶体固化', maxLevel: 3, desc: '提高炮台持续时间与驻场能力。' },
      { id: 'arcane_resonance_mark', name: '共鸣裂变', maxLevel: 3, desc: '炮台激光命中会附加短暂易伤。' },
      { id: 'arcane_flowcasting', name: '多重布阵', maxLevel: 3, desc: '缩短布置循环，并提升同时存在的炮台数量。' }
    ]
  },
  {
    id: 'ranger',
    name: '猎人-副',
    color: resolveClassColor('archer'),
    core: { id: 'off_ranger', name: '选择：猎人', maxLevel: 1, desc: '作为副职业，获得诱饵假人：基础每10秒自动布置假人，持续15秒，只吸引范围内敌人并射出单发箭矢，在被击破或结束时爆炸。' },
    nodes: [
      { id: 'ranger_snaretrap', name: '诱饵假人', maxLevel: 3, desc: '基础每10秒自动布置诱饵假人，持续15秒，划定吸引范围并向圈内敌人射出单发箭矢。' },
      { id: 'ranger_huntmark', name: '猎手印记', maxLevel: 3, desc: '被假人牵制的敌人会被标记，承受你更多伤害。' },
      { id: 'ranger_spiketrap', name: '缚行力场', maxLevel: 3, desc: '假人周围形成束缚力场，持续减速并附带轻度持续伤害。' },
      { id: 'ranger_blasttrap', name: '诱爆装置', maxLevel: 3, desc: '强化假人结束时的范围爆炸伤害。' },
      { id: 'ranger_trapcraft', name: '拟饵工学', maxLevel: 3, desc: '强化假人持续时间、冷却与同时存在数量。' },
      { id: 'ranger_pack_hunter', name: '围猎本能', maxLevel: 3, desc: '强化你对被标记或被牵制目标的暴击收益。' }
    ]
  },
  {
    id: 'unyielding',
    name: '战士-副',
    color: resolveClassColor('warrior'),
    core: { id: 'off_unyielding', name: '选择：不屈', maxLevel: 1, desc: '作为副职业，获得血怒：生命每损失10%，伤害 +2%，并使暴击率 +10%。' },
    nodes: [
      { id: 'unyielding_bloodrage', name: '血怒', maxLevel: 3, desc: '生命越低伤害越高。' },
      { id: 'unyielding_battlecry', name: '战吼', maxLevel: 3, desc: '受伤后短时间提高伤害。' },
      { id: 'unyielding_hamstring', name: '断筋', maxLevel: 3, desc: '近距离命中使敌人减速。' },
      { id: 'unyielding_sunder', name: '破甲', maxLevel: 3, desc: '持续命中同一目标时提高对其伤害。' },
      { id: 'unyielding_standfast', name: '不退', maxLevel: 3, desc: '近距离时获得减伤与抗击退。' },
      { id: 'unyielding_executioner', name: '处决本能', maxLevel: 3, desc: '对低血敌人造成额外伤害。' }
    ]
  },
  {
    id: 'summon',
    name: '术士-副',
    color: resolveClassColor('warlock'),
    core: { id: 'off_summon', name: '选择：召唤', maxLevel: 1, desc: '作为副职业，立即获得1名骷髅卫士与1名骷髅法师，并使造成的伤害 +8%。' },
    nodes: [
      { id: 'summon_necrotic_vitality', name: '死灵共鸣', maxLevel: 3, desc: '提高召唤物生命。' },
      { id: 'summon_skeleton_guard', name: '骷髅卫士', maxLevel: 3, desc: '扩充骷髅卫士军势。等级 1/2/3 时总上限为 3/5/7。' },
      { id: 'summon_skeleton_mage', name: '骷髅法师', maxLevel: 3, desc: '扩充骷髅法师军势。等级 1/2/3 时总上限为 3/5/7。' },
      { id: 'summon_mage_empower', name: '白骨灌能', maxLevel: 3, desc: '强化骷髅法师输出。' },
      { id: 'summon_guard_bulwark', name: '骸骨壁垒', maxLevel: 3, desc: '强化骷髅卫士生存与拦截能力。' },
      { id: 'summon_ember_echo', name: '魂火余烬', maxLevel: 3, desc: '召唤物死亡后为你提供短时间增伤或减伤。' }
    ]
  },
  {
    id: 'guardian',
    name: '圣骑士-副',
    color: resolveClassColor('paladin'),
    core: { id: 'off_guardian', name: '选择：守护', maxLevel: 1, desc: '作为副职业，获得格挡与圣印，并使受到的伤害 -10%。' },
    nodes: [
      { id: 'guardian_block', name: '坚盾', maxLevel: 3, desc: '概率格挡，格挡时减伤。' },
      { id: 'guardian_armor', name: '护甲', maxLevel: 3, desc: '固定减伤。' },
      { id: 'guardian_counter', name: '反制', maxLevel: 3, desc: '格挡成功后触发反击。' },
      { id: 'guardian_sacred_seal', name: '庇护圣印', maxLevel: 3, desc: '受击或格挡时积累圣印。' },
      { id: 'guardian_holy_rebuke', name: '神圣回击', maxLevel: 3, desc: '消耗圣印触发范围冲击。' },
      { id: 'guardian_light_fortress', name: '光铸壁垒', maxLevel: 3, desc: '低血时把圣印转为护盾。' }
    ]
  },
  {
    id: 'nature',
    name: '德鲁伊-副',
    color: resolveClassColor('druid'),
    core: { id: 'off_nature', name: '选择：自然伙伴', maxLevel: 1, desc: '作为副职业，立即获得1只熊灵，作为前排肉盾协同作战。' },
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

export const SKILL_TO_TREE = {
  // 猎人（散射流）
  archer_core: 'archer',
  archer_rapidfire: 'archer',
  archer_pierce: 'archer',
  archer_arrowrain: 'archer',
  archer_nimble_evade: 'archer',
  archer_evade_mastery: 'archer',
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
  druid_nourish_growth: 'druid',

  // 其余职业
  warrior_core: 'warrior',
  warrior_swordqi: 'warrior',
  warrior_damage: 'warrior',
  warrior_range: 'warrior',
  warrior_blood_conversion: 'warrior',
  warrior_bloodlust_mastery: 'warrior',

  mage_core: 'mage',
  mage_frostbite: 'mage',
  mage_cold_focus: 'mage',
  mage_ice_veins: 'mage',
  mage_deep_freeze: 'mage',
  mage_shatter: 'mage',
  mage_frost_nova: 'mage',
  mage_frost_domain: 'mage',

  paladin_core: 'paladin',
  paladin_pierce: 'paladin',
  paladin_repulse: 'paladin',
  paladin_triple: 'paladin',
  paladin_stun: 'paladin',
  paladin_divine_shelter: 'paladin',
  paladin_shelter_extension: 'paladin',

  warlock_core: 'warlock',
  warlock_toxicity: 'warlock',
  warlock_spread: 'warlock',
  warlock_corrode: 'warlock',
  warlock_infernal: 'warlock',
  warlock_infernal_contract: 'warlock',
  warlock_autoseek: 'third',
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

  // 第三天赋（占位）
  third_depth_prep: 'third',
  third_dual_prep: 'third',

  // 第三天赋：深度专精（主=副）
  mage_dualcaster: 'third',
  mage_trilaser: 'third',
  mage_arcanomorph: 'third',

  archer_bounce: 'third',
  archer_windfury: 'third',
  archer_eagleeye: 'third',

  warrior_spin: 'third',
  warrior_berserkgod: 'third',
  warrior_unyielding: 'third',

  warlock_autoseek: 'third',
  warlock_souleater: 'third',
  warlock_netherlord: 'third',

  paladin_avenger: 'third',
  paladin_sacredshield: 'third',
  paladin_divine: 'third',

  druid_kingofbeasts: 'third',
  druid_naturefusion: 'third',
  druid_astralstorm: 'third',

  // 第三天赋：双职业专精（主≠副）
  dual_mage_druid_arcanebear: 'third',
  dual_mage_druid_starwisdom: 'third',
  dual_mage_druid_natureoverflow: 'third',

  dual_scatter_mage_enchantedarrow: 'third',
  dual_scatter_mage_hastefocus: 'third',
  dual_scatter_mage_archercircle: 'third',

  dual_warrior_paladin_crusade: 'third',
  dual_warrior_paladin_righteousrage: 'third',
  dual_warrior_paladin_sacredspin: 'third',

  dual_warlock_druid_decay: 'third',
  dual_warlock_druid_witheringroar: 'third',
  dual_warlock_druid_soulbloom: 'third',

  dual_paladin_scatter_holyrain: 'third',
  dual_paladin_scatter_blessedquiver: 'third',
  dual_paladin_scatter_retribution: 'third',

  dual_druid_warrior_ironbark: 'third',
  dual_druid_warrior_predator: 'third',
  dual_druid_warrior_ancestral: 'third'
};

export const SKILL_ID_ALIASES = {
  drone_core: 'druid_core',
  mage_refract: 'mage_frostbite',
  mage_arcane_perception: 'mage_cold_focus',
  mage_energy_focus: 'mage_ice_veins',
  dual_mage_drone_arcanebear: 'dual_mage_druid_arcanebear',
  dual_mage_drone_starwisdom: 'dual_mage_druid_starwisdom',
  dual_mage_drone_natureoverflow: 'dual_mage_druid_natureoverflow',
  dual_warlock_drone_decay: 'dual_warlock_druid_decay',
  dual_warlock_drone_witheringroar: 'dual_warlock_druid_witheringroar',
  dual_warlock_drone_soulbloom: 'dual_warlock_druid_soulbloom',
  dual_drone_warrior_ironbark: 'dual_druid_warrior_ironbark',
  dual_drone_warrior_predator: 'dual_druid_warrior_predator',
  dual_drone_warrior_ancestral: 'dual_druid_warrior_ancestral',
  dual_archer_drone_onslaught: 'dual_archer_druid_onslaught',
  dual_archer_drone_style: 'dual_archer_druid_style',
  dual_archer_drone_fusion: 'dual_archer_druid_fusion',
  dual_drone_paladin_onslaught: 'dual_druid_paladin_onslaught',
  dual_drone_paladin_style: 'dual_druid_paladin_style',
  dual_drone_paladin_fusion: 'dual_druid_paladin_fusion',
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

export function getThirdSpecTypeForMainOff({ mainCoreKey, offFaction }) {
  if (!mainCoreKey || !offFaction) return null;
  const normalizedMainCoreKey = normalizeCoreKey(mainCoreKey);
  const accentCoreKey = normalizeCoreKey(getAccentCoreKeyForOffFaction(offFaction));
  const sameTheme = !!accentCoreKey && accentCoreKey === normalizedMainCoreKey;
  return sameTheme ? 'depth' : 'dual';
}

// 第三天赋树（占位）：
// - 主/副“同职业主题” => 深度专精
// - 不同 => 双职业天赋
// 具体节点稍后由策划提供；这里仅提供 UI 所需的 def 结构。
export function buildThirdTalentTreePlaceholder({ mainCoreKey, offFaction, mainTreeDef, offTreeDef }) {
  if (!mainCoreKey || !offFaction) return null;

  const normalizedMainCoreKey = normalizeCoreKey(mainCoreKey);

  const specType = getThirdSpecTypeForMainOff({ mainCoreKey: normalizedMainCoreKey, offFaction });
  const sameTheme = specType === 'depth';

  const mainName = mainTreeDef?.name || '本职业';
  const offName = offTreeDef?.name || '副职业';
  const color = Number.isFinite(mainTreeDef?.color) ? mainTreeDef.color : 0x2a2a3a;

  // 进度记录/展示使用固定 id，标题/配色由主副决定
  const id = 'third';

  const name = sameTheme
    ? `${mainName}·深度专精`
    : `双职业天赋`;

  const desc = sameTheme
    ? '深度专精（稍后提供）'
    : '双职业天赋（稍后提供）';

  const variant = sameTheme ? 'depth' : 'dual';

  const toNode = (opt) => ({
    id: opt.id,
    name: opt.name,
    maxLevel: opt.maxLevel || 1,
    desc: opt.desc || ''
  });

  const depthNodes = [
    { id: 'third_depth_prep', name: '深度专精（前置）', maxLevel: 1, desc: '占位：后续接入深度专精天赋。' },
    ...((DEPTH_SPEC_POOLS[normalizedMainCoreKey] || []).map(toNode))
  ];

  const accentCoreKey = normalizeCoreKey(getAccentCoreKeyForOffFaction(offFaction));
  const dualPool = (accentCoreKey && DUAL_SPEC_POOLS[normalizedMainCoreKey] && DUAL_SPEC_POOLS[normalizedMainCoreKey][accentCoreKey])
    ? DUAL_SPEC_POOLS[normalizedMainCoreKey][accentCoreKey]
    : [];
  const dualNodes = [
    { id: 'third_dual_prep', name: '双职业专精（前置）', maxLevel: 1, desc: '占位：后续接入双职业天赋。' },
    ...dualPool.map(toNode)
  ];

  const nodes = sameTheme ? depthNodes : dualNodes;

  return {
    id,
    name,
    color,
    variant,
    core: { id: `${id}_core`, name: '（预留）', maxLevel: 1, desc },
    nodes
  };
}

const MAX_LEVELS = Object.fromEntries(
  TREE_DEFS.flatMap(t => [t.core, ...t.nodes].filter(Boolean).map(n => [n.id, n.maxLevel || 1]))
);

const THIRD_SPEC_MAX_LEVELS = (() => {
  const entries = [];

  // 前置
  entries.push(['third_depth_prep', 1]);
  entries.push(['third_dual_prep', 1]);

  // 深度池
  Object.values(DEPTH_SPEC_POOLS || {}).forEach((arr) => {
    (arr || []).forEach((opt) => {
      if (opt?.id) entries.push([opt.id, opt.maxLevel || 1]);
    });
  });

  // 双职业池
  Object.values(DUAL_SPEC_POOLS || {}).forEach((bySub) => {
    Object.values(bySub || {}).forEach((arr) => {
      (arr || []).forEach((opt) => {
        if (opt?.id) entries.push([opt.id, opt.maxLevel || 1]);
      });
    });
  });

  // 兜底：如果有人只改了 PREP_OPTIONS
  if (THIRD_SPEC_PREP_OPTIONS?.depth?.id) entries.push([THIRD_SPEC_PREP_OPTIONS.depth.id, THIRD_SPEC_PREP_OPTIONS.depth.maxLevel || 1]);
  if (THIRD_SPEC_PREP_OPTIONS?.dual?.id) entries.push([THIRD_SPEC_PREP_OPTIONS.dual.id, THIRD_SPEC_PREP_OPTIONS.dual.maxLevel || 1]);

  return Object.fromEntries(entries);
})();

export function getTreeIdForSkill(skillId) {
  const normalizedSkillId = normalizeSkillId(skillId);
  const explicitTreeId = SKILL_TO_TREE[normalizedSkillId] || null;
  if (explicitTreeId) return explicitTreeId;

  // 双职业通用池会动态生成 dual_* id，这些 id 不会逐条静态登记，统一归到第三树。
  if (typeof normalizedSkillId === 'string' && normalizedSkillId.startsWith('dual_')) {
    return 'third';
  }

  return null;
}

export function getMaxLevel(skillId) {
  const normalizedSkillId = normalizeSkillId(skillId);
  return THIRD_SPEC_MAX_LEVELS[normalizedSkillId] || MAX_LEVELS[normalizedSkillId] || 1;
}
