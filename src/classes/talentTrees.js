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
    ],
    ultimate: { id: 'archer_ultimate', name: '终极：箭雨风暴', maxLevel: 1, desc: '箭矢连射进化为高密度箭雨。' }
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
      { id: 'paladin_repulse', name: '震荡锤击', maxLevel: 1, desc: '锤击命中附带明显击退。' },
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
    core: { id: 'off_arcane', name: '选择：奥术', maxLevel: 1, desc: '作为副职业，获得奥能法阵：周期生成法阵，并为阵内提供增伤。' },
    nodes: [
      { id: 'arcane_circle', name: '奥能法阵', maxLevel: 3, desc: '周期生成法阵，阵内提供伤害增幅。' },
      { id: 'arcane_circle_range', name: '法阵扩张', maxLevel: 3, desc: '扩大奥能法阵的覆盖范围。' },
      { id: 'arcane_fire_circle', name: '烈焰法阵', maxLevel: 3, desc: '法阵结束时爆炸，造成范围伤害。' },
      { id: 'arcane_frost_circle', name: '冰霜法阵', maxLevel: 3, desc: '法阵内敌人减速。' },
      { id: 'arcane_resonance_mark', name: '共鸣刻印', maxLevel: 3, desc: '进一步扩大奥能法阵的增伤幅度。' },
      { id: 'arcane_flowcasting', name: '流动施法', maxLevel: 3, desc: '离开法阵后短时间保留法阵增益。' }
    ],
    ultimate: { id: 'arcane_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'ranger',
    name: '猎人-副',
    color: resolveClassColor('archer'),
    core: { id: 'off_ranger', name: '选择：游侠', maxLevel: 1, desc: '作为副职业，获得陷阱体系：自动布置陷阱，提供控制与标记。' },
    nodes: [
      { id: 'ranger_snaretrap', name: '绊索陷阱', maxLevel: 3, desc: '自动布置陷阱，触发后定身敌人。' },
      { id: 'ranger_huntmark', name: '猎手印记', maxLevel: 3, desc: '被陷阱触发的敌人受到你的伤害提高。' },
      { id: 'ranger_spiketrap', name: '钉刺陷阱', maxLevel: 3, desc: '陷阱触发后造成伤害与减速。' },
      { id: 'ranger_blasttrap', name: '爆裂陷阱', maxLevel: 3, desc: '陷阱触发时额外爆炸。' },
      { id: 'ranger_trapcraft', name: '熟练布置', maxLevel: 3, desc: '强化陷阱覆盖能力。' },
      { id: 'ranger_pack_hunter', name: '围猎本能', maxLevel: 3, desc: '强化你对被控制或被标记目标的暴击收益。' }
    ],
    ultimate: { id: 'ranger_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'unyielding',
    name: '战士-副',
    color: resolveClassColor('warrior'),
    core: { id: 'off_unyielding', name: '选择：不屈', maxLevel: 1, desc: '作为副职业，获得不屈战意：提供受伤增益、贴身压迫与收割能力。' },
    nodes: [
      { id: 'unyielding_bloodrage', name: '血怒', maxLevel: 3, desc: '生命越低伤害越高。' },
      { id: 'unyielding_battlecry', name: '战吼', maxLevel: 3, desc: '受伤后短时间提高伤害。' },
      { id: 'unyielding_hamstring', name: '断筋', maxLevel: 3, desc: '近距离命中使敌人减速。' },
      { id: 'unyielding_sunder', name: '破甲', maxLevel: 3, desc: '持续命中同一目标时提高对其伤害。' },
      { id: 'unyielding_standfast', name: '不退', maxLevel: 3, desc: '近距离时获得减伤与抗击退。' },
      { id: 'unyielding_executioner', name: '处决本能', maxLevel: 3, desc: '对低血敌人造成额外伤害。' }
    ],
    ultimate: { id: 'unyielding_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'curse',
    name: '术士-副',
    color: resolveClassColor('warlock'),
    core: { id: 'off_curse', name: '选择：诅咒', maxLevel: 1, desc: '作为副职业，获得亡灵军势：逐步召唤骷髅，并通过死亡触发滚雪球收益。' },
    nodes: [
      { id: 'curse_necrotic_vitality', name: '死灵共鸣', maxLevel: 3, desc: '提高召唤物生命。' },
      { id: 'curse_skeleton_guard', name: '骷髅卫士', maxLevel: 3, desc: '召唤骷髅卫士协同近战。等级 1/2/3 时上限为 1/3/5。' },
      { id: 'curse_skeleton_mage', name: '骷髅法师', maxLevel: 3, desc: '召唤骷髅法师跟随作战。等级 1/2/3 时上限为 1/3/5。' },
      { id: 'curse_mage_empower', name: '白骨灌能', maxLevel: 3, desc: '强化骷髅法师输出。' },
      { id: 'curse_guard_bulwark', name: '骸骨壁垒', maxLevel: 3, desc: '强化骷髅卫士生存与拦截能力。' },
      { id: 'curse_ember_echo', name: '魂火余烬', maxLevel: 3, desc: '召唤物死亡后为你提供短时间增伤或减伤。' }
    ],
    ultimate: { id: 'curse_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'guardian',
    name: '圣骑士-副',
    color: resolveClassColor('paladin'),
    core: { id: 'off_guardian', name: '选择：守护', maxLevel: 1, desc: '作为副职业，获得格挡与圣印：承伤会转化为反击和护盾收益。' },
    nodes: [
      { id: 'guardian_block', name: '坚盾', maxLevel: 3, desc: '概率格挡，格挡时减伤。' },
      { id: 'guardian_armor', name: '护甲', maxLevel: 3, desc: '固定减伤。' },
      { id: 'guardian_counter', name: '反制', maxLevel: 3, desc: '格挡成功后触发反击。' },
      { id: 'guardian_sacred_seal', name: '庇护圣印', maxLevel: 3, desc: '受击或格挡时积累圣印。' },
      { id: 'guardian_holy_rebuke', name: '神圣回击', maxLevel: 3, desc: '消耗圣印触发范围冲击。' },
      { id: 'guardian_light_fortress', name: '光铸壁垒', maxLevel: 3, desc: '低血时把圣印转为护盾。' }
    ],
    ultimate: { id: 'guardian_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
  },
  {
    id: 'nature',
    name: '德鲁伊-副',
    color: resolveClassColor('druid'),
    core: { id: 'off_nature', name: '选择：自然伙伴', maxLevel: 1, desc: '作为副职业，获得自然伙伴：逐步召唤熊灵、战鹰、树精协同作战。' },
    nodes: [
      { id: 'druid_pet_bear', name: '熊灵', maxLevel: 3, desc: '召唤熊灵协同作战，负责前排拦截。' },
      { id: 'druid_pet_hawk', name: '战鹰', maxLevel: 3, desc: '召唤战鹰协同作战，负责高频输出。' },
      { id: 'druid_pet_treant', name: '树精', maxLevel: 3, desc: '召唤树精协同作战，负责治疗与护盾。' },
      { id: 'nature_bear_guard', name: '熊灵守护', maxLevel: 3, desc: '强化熊灵承担伤害与拦截能力。' },
      { id: 'nature_hawk_huntmark', name: '战鹰猎印', maxLevel: 3, desc: '强化战鹰标记与增伤。' },
      { id: 'nature_treant_bloom', name: '树精繁茂', maxLevel: 3, desc: '强化树精治疗与护盾。' }
    ],
    ultimate: { id: 'nature_ultimate', name: '（预留）', maxLevel: 1, desc: '预留。' }
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
  archer_ultimate: 'archer',

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
  paladin_repulse: 'paladin',
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
  curse_necrotic_vitality: 'curse',
  off_guardian: 'guardian',
  off_nature: 'nature',

  // 副职业通用：奥术
  arcane_circle: 'arcane',
  arcane_circle_range: 'arcane',
  arcane_fire_circle: 'arcane',
  arcane_frost_circle: 'arcane',
  arcane_resonance_mark: 'arcane',
  arcane_flowcasting: 'arcane',

  // 副职业通用：游侠
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

  // 副职业通用：诅咒
  off_curse: 'curse',
  curse_skeleton_guard: 'curse',
  curse_skeleton_mage: 'curse',
  curse_mage_empower: 'curse',
  curse_guard_bulwark: 'curse',
  curse_ember_echo: 'curse',

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
  nature_treant_bloom: 'nature'
  ,

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

  warrior_bladestorm: 'third',
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

export const SKILL_ID_ALIASES = {};

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
