// 天赋树/技能树：仅用于 UI 展示与进度记录

import { DEPTH_SPEC_POOLS, DUAL_SPEC_POOLS, THIRD_SPEC_PREP_OPTIONS } from './upgradePools';
import { resolveClassColor } from './visual/classColors';

export const TREE_DEFS = [
  {
    id: 'archer',
    name: '猎人-主',
    color: resolveClassColor('archer'),
    core: { id: 'scatter_core', name: '初始：猎人', maxLevel: 1, desc: '解锁散射射击。' },
    nodes: [
      { id: 'archer_nimble_evade', name: '灵巧回避', maxLevel: 3, desc: '生命低于30%时自动触发：闪避率 +40%/+60%/+80%，持续3秒，冷却30秒。' },
      { id: 'archer_evade_mastery', name: '残影步调', maxLevel: 3, desc: '强化灵巧回避：持续时间提高至5/8/10秒。' },
      { id: 'archer_range', name: '射程', maxLevel: 3, desc: '基础射击射程提升（+12%/+24%/+36%）。' },
      { id: 'archer_scatter', name: '散射', maxLevel: 3, desc: '基础射击初始为1列；升级后变为3列→5列→7列，中心列始终锁定目标。' }
    ],
    ultimate: { id: 'scatter_ultimate', name: '终极：弹幕风暴', maxLevel: 1, desc: '散射进化为高密度弹幕。' }
  },
  {
    id: 'druid',
    name: '德鲁伊-主',
    color: resolveClassColor('druid'),
    core: { id: 'drone_core', name: '初始：德鲁伊', maxLevel: 1, desc: '解锁星落（定位敌方，星星下落造成范围伤害）。' },
    nodes: [
      { id: 'druid_meteor_shower', name: '流星雨', maxLevel: 1, desc: '星落数量 +2，但单次伤害略微降低。' },
      { id: 'druid_meteor', name: '陨石', maxLevel: 1, desc: '每 10 秒，下一次星落变为巨型陨石：范围更大，伤害更高。' },
      { id: 'druid_starfire', name: '星火', maxLevel: 1, desc: '星落命中后有 30% 概率在同位置额外触发一次（不连锁）。' },
      { id: 'druid_nourish', name: '自然滋养', maxLevel: 3, desc: '生命低于30%时自动触发：在15/10/5秒内缓慢回复30%生命，冷却30秒。' },
      { id: 'druid_nourish_growth', name: '丰饶脉动', maxLevel: 3, desc: '强化自然滋养：总回复量额外提高50%/80%/100%。' }
    ],
    ultimate: { id: 'drone_ultimate', name: '终极：自然编队', maxLevel: 1, desc: '宠物进入编队火力形态。' }
  },
  {
    id: 'warrior',
    name: '战士-主',
    color: resolveClassColor('warrior'),
    core: { id: 'warrior_core', name: '初始：战士', maxLevel: 1, desc: '攻击变为劈砍。' },
    nodes: [
      { id: 'warrior_spin', name: '回旋', maxLevel: 1, desc: '挥砍变为 360° 回旋斩，造成范围伤害。' },
      { id: 'warrior_swordqi', name: '剑气', maxLevel: 1, desc: '挥砍时额外发射一道月牙剑气，近战判定仍保留。' },
      { id: 'warrior_endure', name: '持久', maxLevel: 1, desc: '战士近战形态获得 20% 伤害减免。' },
      { id: 'warrior_range', name: '月牙扩展', maxLevel: 4, desc: '月牙斩有效范围提升（可叠加）。' },
      { id: 'warrior_blood_conversion', name: '猩红嗜血', maxLevel: 3, desc: '生命低于30%时自动触发：攻击伤害转化为100%吸血，持续5/10/15秒，冷却30秒。' },
      { id: 'warrior_bloodlust_mastery', name: '狂血渴饮', maxLevel: 3, desc: '强化猩红嗜血：攻击伤害转化提高至120%/150%/200%。' }
    ],
    ultimate: { id: 'warrior_ultimate', name: '终极：剑刃风暴', maxLevel: 1, desc: '挥砍形成连斩冲击。' }
  },
  {
    id: 'mage',
    name: '法师-主',
    color: resolveClassColor('mage'),
    core: { id: 'mage_core', name: '初始：法师', maxLevel: 1, desc: '攻击变为奥术射线。' },
    nodes: [
      { id: 'mage_refract', name: '折射', maxLevel: 1, desc: '激光命中目标后，从该目标分裂 2 道短射线到附近敌人，伤害为 50%。' },
      { id: 'mage_arcane_perception', name: '奥术感知', maxLevel: 3, desc: '奥术射线索敌范围提升。' },
      { id: 'mage_energy_focus', name: '能量汇集', maxLevel: 3, desc: '奥术射线伤害提升，并随层数变粗更亮（+10%/+20%/+30%）。' },
      { id: 'mage_frost_nova', name: '冰霜新星', maxLevel: 3, desc: '生命低于30%时自动触发：释放冰霜新星，冻结周围敌人 3/5/10 秒，冷却30秒。' },
      { id: 'mage_frost_domain', name: '极寒疆域', maxLevel: 3, desc: '强化冰霜新星：冻结范围扩大至300/380/480。' }
    ],
    ultimate: { id: 'mage_ultimate', name: '终极：贯穿聚焦', maxLevel: 1, desc: '激光聚焦并贯穿。' }
  },
  {
    id: 'paladin',
    name: '圣骑士-主',
    color: resolveClassColor('paladin'),
    core: { id: 'paladin_core', name: '初始：圣骑', maxLevel: 1, desc: '护盾脉冲清弹并反击。' },
    nodes: [
      { id: 'paladin_pierce', name: '重锤', maxLevel: 1, desc: '锤击范围与伤害提高。' },
      { id: 'paladin_holyfire', name: '圣焰', maxLevel: 1, desc: '锤击命中后留下圣焰持续伤害。' },
      { id: 'paladin_triple', name: '连锤', maxLevel: 1, desc: '每 5 秒，下一次锤击额外追加 2 次余震落点。' },
      { id: 'paladin_stun', name: '制裁', maxLevel: 3, desc: '锤击有 10%/20%/30% 概率使敌人眩晕。' },
      { id: 'paladin_divine_shelter', name: '神圣庇护', maxLevel: 3, desc: '生命低于30%时自动触发：获得40%/60%/80%减伤，持续5秒，冷却30秒。' },
      { id: 'paladin_shelter_extension', name: '圣佑绵延', maxLevel: 3, desc: '强化神圣庇护：持续时间提高至8/10/12秒。' }
    ],
    ultimate: { id: 'paladin_ultimate', name: '终极：神圣裁决', maxLevel: 1, desc: '脉冲强化为审判领域。' }
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
      { id: 'warlock_infernal', name: '炼狱魔火', maxLevel: 3, desc: '生命低于30%时自动触发：消耗15%生命召唤地狱火 10 秒，冷却30秒。等级会提升地狱火生命、攻击与每击回血。' },
      { id: 'warlock_infernal_contract', name: '灰烬契约', maxLevel: 3, desc: '强化炼狱魔火：生命消耗降低至10%/5%/0%。' }
    ],
    ultimate: { id: 'warlock_ultimate', name: '终极：腐化蔓延', maxLevel: 1, desc: '中毒与虚弱扩散。' }
  },

  // ====== 副职业通用派系（纯被动） ======
  {
    id: 'arcane',
    name: '法师-副',
    color: resolveClassColor('mage'),
    core: { id: 'off_arcane', name: '选择：奥术', maxLevel: 1, desc: '作为副职业，提供技能加速与站桩奖励。' },
    nodes: [
      { id: 'arcane_swift', name: '迅捷', maxLevel: 1, desc: '所有攻击的攻击速度/冷却时间 -8%。' },
      { id: 'arcane_circle', name: '法阵', maxLevel: 1, desc: '站立不动 2 秒后阵内攻击力 +20%，移动则消失。' }
    ],
    ultimate: { id: 'arcane_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'ranger',
    name: '猎人-副',
    color: resolveClassColor('archer'),
    core: { id: 'off_ranger', name: '选择：游侠', maxLevel: 1, desc: '作为副职业，提供暴击、闪避与先手压制。' },
    nodes: [
      { id: 'ranger_precise', name: '精准', maxLevel: 1, desc: '暴击率 +10%。' },
      { id: 'ranger_agile', name: '灵巧', maxLevel: 1, desc: '闪避率 +8%。' },
      { id: 'ranger_hunter', name: '猎手', maxLevel: 1, desc: '对生命值高于 80% 的敌人暴击率额外 +15%。' }
    ],
    ultimate: { id: 'ranger_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'unyielding',
    name: '战士-副',
    color: resolveClassColor('warrior'),
    core: { id: 'off_unyielding', name: '选择：不屈', maxLevel: 1, desc: '作为副职业，提供逆境增伤与绝境反击。' },
    nodes: [
      { id: 'unyielding_bloodrage', name: '血怒', maxLevel: 1, desc: '生命值每降低 10%，造成的伤害 +3%。' },
      { id: 'unyielding_battlecry', name: '战吼', maxLevel: 1, desc: '受伤时 20% 概率触发：3 秒内伤害 +15%。' },
      { id: 'unyielding_duel', name: '死斗', maxLevel: 1, desc: '生命值低于 30% 时，攻击速度 +25%。' }
    ],
    ultimate: { id: 'unyielding_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'curse',
    name: '术士-副',
    color: resolveClassColor('warlock'),
    core: { id: 'off_curse', name: '选择：诅咒', maxLevel: 1, desc: '作为副职业，获得死灵共鸣：召唤物伤害 +12%、生命值 +10%，并解锁亡灵召唤强化。' },
    nodes: [
      { id: 'curse_skeleton_guard', name: '骷髅卫士', maxLevel: 3, desc: '召唤骷髅卫士协同近战。等级 1/2/3 时上限为 1/3/5。' },
      { id: 'curse_skeleton_mage', name: '骷髅法师', maxLevel: 3, desc: '召唤骷髅法师跟随作战。等级 1/2/3 时上限为 1/3/5。' }
    ],
    ultimate: { id: 'curse_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'guardian',
    name: '圣骑士-副',
    color: resolveClassColor('paladin'),
    core: { id: 'off_guardian', name: '选择：守护', maxLevel: 1, desc: '作为副职业，提供格挡、减伤与反击。' },
    nodes: [
      { id: 'guardian_block', name: '坚盾', maxLevel: 1, desc: '5% 概率格挡，格挡时减伤 50%。' },
      { id: 'guardian_armor', name: '护甲', maxLevel: 1, desc: '所有受到的伤害 -3（固定减伤）。' },
      { id: 'guardian_counter', name: '反制', maxLevel: 1, desc: '格挡成功后反击造成 100% 攻击力伤害。' }
    ],
    ultimate: { id: 'guardian_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'nature',
    name: '德鲁伊-副',
    color: resolveClassColor('druid'),
    core: { id: 'off_nature', name: '选择：自然伙伴', maxLevel: 1, desc: '作为副职业，获得自然亲和：受到治疗效果 +12%，并逐步召唤熊灵、战鹰、树精。' },
    nodes: [
      { id: 'druid_pet_bear', name: '熊灵', maxLevel: 1, desc: '召唤熊灵协同作战，负责扛伤与近战压制。' },
      { id: 'druid_pet_hawk', name: '战鹰', maxLevel: 1, desc: '召唤战鹰协同作战，负责持续高频打击。' },
      { id: 'druid_pet_treant', name: '树精', maxLevel: 1, desc: '召唤树精协同作战，负责周期治疗与续航。' },
      { id: 'nature_bear_vitality', name: '熊灵厚甲', maxLevel: 3, desc: '熊灵生命值提高 +25%/+50%/+75%。' },
      { id: 'nature_hawk_swiftness', name: '鹰击疾掠', maxLevel: 3, desc: '战鹰攻击间隔缩短 12%/24%/36%。' },
      { id: 'nature_treant_bloom', name: '林灵繁茂', maxLevel: 3, desc: '树精单次治疗量提高 +2/+4/+6。' }
    ],
    ultimate: { id: 'nature_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  }
];

export const SKILL_TO_TREE = {
  // 猎人（散射流）
  scatter_core: 'archer',
  archer_rapidfire: 'archer',
  archer_pierce: 'archer',
  archer_arrowrain: 'archer',
  archer_nimble_evade: 'archer',
  archer_evade_mastery: 'archer',
  archer_range: 'archer',
  archer_rate: 'archer',
  archer_damage: 'archer',
  archer_scatter: 'archer',
  scatter_ultimate: 'archer',

  // 德鲁伊（星落）
  drone_core: 'druid',
  druid_meteor_shower: 'druid',
  druid_meteor: 'druid',
  druid_starfire: 'druid',
  druid_nourish: 'druid',
  druid_nourish_growth: 'druid',
  drone_ultimate: 'druid',

  // 其余职业
  warrior_core: 'warrior',
  warrior_spin: 'warrior',
  warrior_swordqi: 'warrior',
  warrior_endure: 'warrior',
  warrior_range: 'warrior',
  warrior_blood_conversion: 'warrior',
  warrior_bloodlust_mastery: 'warrior',
  warrior_ultimate: 'warrior',

  mage_core: 'mage',
  mage_refract: 'mage',
  mage_arcane_perception: 'mage',
  mage_energy_focus: 'mage',
  mage_frost_nova: 'mage',
  mage_frost_domain: 'mage',
  mage_ultimate: 'mage',

  paladin_core: 'paladin',
  paladin_pierce: 'paladin',
  paladin_holyfire: 'paladin',
  paladin_triple: 'paladin',
  paladin_stun: 'paladin',
  paladin_divine_shelter: 'paladin',
  paladin_shelter_extension: 'paladin',
  paladin_ultimate: 'paladin',

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
  warlock_ultimate: 'warlock'
  ,

  // 副职业通用：派系选择
  off_arcane: 'arcane',
  off_ranger: 'ranger',
  off_unyielding: 'unyielding',
  off_curse: 'curse',
  off_guardian: 'guardian',
  off_nature: 'nature',

  // 副职业通用：奥术
  arcane_swift: 'arcane',
  arcane_circle: 'arcane',

  // 副职业通用：游侠
  ranger_precise: 'ranger',
  ranger_agile: 'ranger',
  ranger_hunter: 'ranger',

  // 副职业通用：不屈
  unyielding_bloodrage: 'unyielding',
  unyielding_battlecry: 'unyielding',
  unyielding_duel: 'unyielding',

  // 副职业通用：诅咒
  curse_skeleton_guard: 'curse',
  curse_skeleton_mage: 'curse',

  // 副职业通用：守护
  guardian_block: 'guardian',
  guardian_armor: 'guardian',
  guardian_counter: 'guardian',

  // 副职业通用：自然伙伴（契约）
  druid_pet_bear: 'nature',
  druid_pet_hawk: 'nature',
  druid_pet_treant: 'nature',

  // 副职业通用：自然伙伴（宠物强化）
  nature_bear_vitality: 'nature',
  nature_hawk_swiftness: 'nature',
  nature_treant_bloom: 'nature'
  ,

  // 第三天赋（占位）
  third_depth_prep: 'third',
  third_dual_prep: 'third',

  // 第三天赋：深度专精（主=副）
  mage_dualcaster: 'third',
  mage_trilaser: 'third',
  mage_arcanomorph: 'third',

  archer_hundred: 'third',
  archer_windfury: 'third',
  archer_eagleeye: 'third',

  warrior_bladestorm: 'third',
  warrior_berserkgod: 'third',
  warrior_unyielding: 'third',

  warlock_infinite: 'third',
  warlock_souleater: 'third',
  warlock_netherlord: 'third',

  paladin_avenger: 'third',
  paladin_sacredshield: 'third',
  paladin_divine: 'third',

  druid_kingofbeasts: 'third',
  druid_naturefusion: 'third',
  druid_astralstorm: 'third',

  // 第三天赋：双职业专精（主≠副）
  dual_mage_drone_arcanebear: 'third',
  dual_mage_drone_starwisdom: 'third',
  dual_mage_drone_natureoverflow: 'third',

  dual_scatter_mage_enchantedarrow: 'third',
  dual_scatter_mage_hastefocus: 'third',
  dual_scatter_mage_archercircle: 'third',

  dual_warrior_paladin_crusade: 'third',
  dual_warrior_paladin_righteousrage: 'third',
  dual_warrior_paladin_sacredspin: 'third',

  dual_warlock_drone_decay: 'third',
  dual_warlock_drone_witheringroar: 'third',
  dual_warlock_drone_soulbloom: 'third',

  dual_paladin_scatter_holyrain: 'third',
  dual_paladin_scatter_blessedquiver: 'third',
  dual_paladin_scatter_retribution: 'third',

  dual_drone_warrior_ironbark: 'third',
  dual_drone_warrior_predator: 'third',
  dual_drone_warrior_ancestral: 'third'
};

// 副职业派系 -> 对应“职业主题”的核心 key（用于判断是否同职业 & 第三天赋树类型）
// 注意：这里的 key 与 GameScene.registry 中的 offFaction 保持一致。
export const OFF_FACTION_TO_ACCENT_CORE_KEY = {
  arcane: 'mage',
  ranger: 'scatter',
  unyielding: 'warrior',
  curse: 'warlock',
  guardian: 'paladin',
  nature: 'drone'
};

export function getAccentCoreKeyForOffFaction(offFaction) {
  if (!offFaction) return null;
  return OFF_FACTION_TO_ACCENT_CORE_KEY[offFaction] || null;
}

export function getThirdSpecTypeForMainOff({ mainCoreKey, offFaction }) {
  if (!mainCoreKey || !offFaction) return null;
  const accentCoreKey = getAccentCoreKeyForOffFaction(offFaction);
  const sameTheme = !!accentCoreKey && accentCoreKey === mainCoreKey;
  return sameTheme ? 'depth' : 'dual';
}

// 第三天赋树（占位）：
// - 主/副“同职业主题” => 深度专精
// - 不同 => 双职业天赋
// 具体节点稍后由策划提供；这里仅提供 UI 所需的 def 结构。
export function buildThirdTalentTreePlaceholder({ mainCoreKey, offFaction, mainTreeDef, offTreeDef }) {
  if (!mainCoreKey || !offFaction) return null;

  const specType = getThirdSpecTypeForMainOff({ mainCoreKey, offFaction });
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
    ...((DEPTH_SPEC_POOLS[mainCoreKey] || []).map(toNode))
  ];

  const accentCoreKey = getAccentCoreKeyForOffFaction(offFaction);
  const dualPool = (accentCoreKey && DUAL_SPEC_POOLS[mainCoreKey] && DUAL_SPEC_POOLS[mainCoreKey][accentCoreKey])
    ? DUAL_SPEC_POOLS[mainCoreKey][accentCoreKey]
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
    nodes,
    ultimate: { id: `${id}_ultimate`, name: '（预留）', maxLevel: 1, desc: '预留。' }
  };
}

const MAX_LEVELS = Object.fromEntries(
  TREE_DEFS.flatMap(t => [t.core, ...t.nodes, t.ultimate].map(n => [n.id, n.maxLevel || 1]))
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
  return SKILL_TO_TREE[skillId] || null;
}

export function getMaxLevel(skillId) {
  return THIRD_SPEC_MAX_LEVELS[skillId] || MAX_LEVELS[skillId] || 1;
}
