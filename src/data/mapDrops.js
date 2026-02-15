/**
 * 地图掉落物系统
 * ════════════════════════════════════════════
 * 定义每张地图的掉落物池（击杀怪物 / 打开宝箱 / Boss 击败）。
 * 与 items.js 中的 ITEM_DEFS 联动。
 *
 * 结构说明：
 *   DROP_QUALITY   — 品质枚举 & 基础权重
 *   MAP_DROP_TABLE — mapId → { normal, elite, boss } 掉落池
 */

import { LINE, NEUTRAL } from './mapPool';

// ════════════════════════════════════════════
//  品质 & 掉落权重
// ════════════════════════════════════════════

/** 掉落品质 */
export const DROP_QUALITY = {
  COMMON:   'common',
  UNCOMMON: 'uncommon',
  RARE:     'rare',
  EPIC:     'epic',
};

/** 品质颜色 */
export const QUALITY_COLORS = {
  [DROP_QUALITY.COMMON]:   0xaaaaaa,
  [DROP_QUALITY.UNCOMMON]: 0x44cc44,
  [DROP_QUALITY.RARE]:     0x4488ff,
  [DROP_QUALITY.EPIC]:     0xbb44ff,
};

/**
 * 品质基础掉落权重（越低品质权重越高）
 * 实际权重 = 基础权重 × 地图修正
 */
export const BASE_QUALITY_WEIGHTS = {
  [DROP_QUALITY.COMMON]:   60,
  [DROP_QUALITY.UNCOMMON]: 25,
  [DROP_QUALITY.RARE]:     12,
  [DROP_QUALITY.EPIC]:     3,
};

// ════════════════════════════════════════════
//  掉落物定义（与 items.js 互补的地图专属掉落）
// ════════════════════════════════════════════

/**
 * 掉落物条目
 * id       — 掉落物 ID（引用 items.js 中的 itemId 或独立定义）
 * name     — 显示名
 * quality  — 品质
 * line     — 归属线路（用于主题增加掉率）
 * tags     — 标签（weapon / armor / consumable / material / shard）
 */
export const MAP_DROPS = [
  // ── 通用碎片 ──
  { id: 'shard_fire',   name: '火元素碎片',   quality: DROP_QUALITY.COMMON,   line: 'any',       tags: ['shard'] },
  { id: 'shard_water',  name: '水元素碎片',   quality: DROP_QUALITY.COMMON,   line: 'any',       tags: ['shard'] },
  { id: 'shard_wind',   name: '风元素碎片',   quality: DROP_QUALITY.COMMON,   line: 'any',       tags: ['shard'] },

  // ── 通用消耗品 ──
  { id: 'potion_small', name: '血瓶',         quality: DROP_QUALITY.COMMON,   line: 'any',       tags: ['consumable'] },
  { id: 'potion_big',   name: '大血瓶',       quality: DROP_QUALITY.UNCOMMON, line: 'any',       tags: ['consumable'] },

  // ── 🌿 狩猎系 ──
  { id: 'drop_swift_boots',    name: '疾风短靴',     quality: DROP_QUALITY.UNCOMMON, line: LINE.HUNT,   tags: ['armor', 'speed'] },
  { id: 'drop_venom_blade',    name: '毒蛇匕首',     quality: DROP_QUALITY.RARE,     line: LINE.HUNT,   tags: ['weapon', 'poison'] },
  { id: 'drop_hawk_eye',       name: '鹰眼护符',     quality: DROP_QUALITY.RARE,     line: LINE.HUNT,   tags: ['accessory', 'crit'] },
  { id: 'drop_natures_gift',   name: '自然馈赠',     quality: DROP_QUALITY.EPIC,     line: LINE.HUNT,   tags: ['consumable', 'heal'] },
  { id: 'drop_hunter_cloak',   name: '猎人斗篷',     quality: DROP_QUALITY.UNCOMMON, line: LINE.HUNT,   tags: ['armor', 'dodge'] },
  { id: 'drop_beast_fang',     name: '野兽利齿',     quality: DROP_QUALITY.COMMON,   line: LINE.HUNT,   tags: ['material'] },

  // ── 🔮 秘法系 ──
  { id: 'drop_mana_crystal',   name: '魔力结晶',     quality: DROP_QUALITY.UNCOMMON, line: LINE.ARCANE, tags: ['material', 'mana'] },
  { id: 'drop_arcane_orb',     name: '奥术宝珠',     quality: DROP_QUALITY.RARE,     line: LINE.ARCANE, tags: ['weapon', 'spell'] },
  { id: 'drop_void_shard',     name: '虚空碎片',     quality: DROP_QUALITY.RARE,     line: LINE.ARCANE, tags: ['material', 'void'] },
  { id: 'drop_spell_tome',     name: '法术卷轴',     quality: DROP_QUALITY.EPIC,     line: LINE.ARCANE, tags: ['consumable', 'spell'] },
  { id: 'drop_rune_ring',      name: '符文指环',     quality: DROP_QUALITY.UNCOMMON, line: LINE.ARCANE, tags: ['accessory', 'cooldown'] },
  { id: 'drop_wisp_dust',      name: '光球尘埃',     quality: DROP_QUALITY.COMMON,   line: LINE.ARCANE, tags: ['material'] },

  // ── ⚔️ 征战系 ──
  { id: 'drop_iron_plate',     name: '铁壁重甲',     quality: DROP_QUALITY.UNCOMMON, line: LINE.WAR,    tags: ['armor', 'defense'] },
  { id: 'drop_war_axe',        name: '战斧',         quality: DROP_QUALITY.RARE,     line: LINE.WAR,    tags: ['weapon', 'melee'] },
  { id: 'drop_blood_vial',     name: '鲜血药剂',     quality: DROP_QUALITY.RARE,     line: LINE.WAR,    tags: ['consumable', 'lifesteal'] },
  { id: 'drop_glory_medal',    name: '荣耀勋章',     quality: DROP_QUALITY.EPIC,     line: LINE.WAR,    tags: ['accessory', 'damage'] },
  { id: 'drop_bone_shield',    name: '白骨盾',       quality: DROP_QUALITY.UNCOMMON, line: LINE.WAR,    tags: ['armor', 'block'] },
  { id: 'drop_soldier_badge',  name: '士兵徽记',     quality: DROP_QUALITY.COMMON,   line: LINE.WAR,    tags: ['material'] },

  // ── 🕯️ 中立 ──
  { id: 'drop_mystery_box',    name: '神秘宝匣',     quality: DROP_QUALITY.RARE,     line: NEUTRAL,     tags: ['consumable', 'random'] },
  { id: 'drop_chaos_fragment', name: '混沌碎片',     quality: DROP_QUALITY.EPIC,     line: NEUTRAL,     tags: ['material', 'chaos'] },
  { id: 'drop_mimic_coin',     name: '拟态金币',     quality: DROP_QUALITY.UNCOMMON, line: NEUTRAL,     tags: ['material', 'gold'] },
];

// ════════════════════════════════════════════
//  掉落物索引
// ════════════════════════════════════════════

const _dropIndex = {};
MAP_DROPS.forEach(d => { _dropIndex[d.id] = d; });

export function getDropById(id) {
  return _dropIndex[id] || null;
}

// ════════════════════════════════════════════
//  地图 → 掉落物绑定表
// ════════════════════════════════════════════

/**
 * MAP_DROP_TABLE
 *
 * key = mapId
 * value = {
 *   normal:  string[]   — 普通怪掉落池（dropId 列表）
 *   elite:   string[]   — 精英怪掉落池（更高品质倾向）
 *   boss:    string[]   — Boss 掉落池（保底稀有+）
 *   explore: string[]   — 探索/宝箱掉落池
 *   qualityBonus: object — { quality: weightMultiplier } 品质权重修正
 * }
 */
export const MAP_DROP_TABLE = {
  // ════════════ 🌿 狩猎之道 ════════════
  dawn_woodland: {
    normal:  ['shard_wind', 'shard_fire', 'potion_small', 'drop_beast_fang'],
    elite:   ['drop_swift_boots', 'drop_hawk_eye', 'potion_big'],
    boss:    ['drop_venom_blade', 'drop_hawk_eye', 'drop_natures_gift'],
    explore: ['shard_wind', 'potion_small', 'drop_beast_fang'],
  },
  wind_forest: {
    normal:  ['shard_wind', 'shard_water', 'potion_small', 'drop_beast_fang'],
    elite:   ['drop_swift_boots', 'drop_hunter_cloak'],
    boss:    ['drop_swift_boots', 'drop_hawk_eye', 'drop_natures_gift'],
    explore: ['shard_wind', 'drop_beast_fang'],
  },
  gloom_swamp: {
    normal:  ['shard_fire', 'shard_water', 'potion_small', 'drop_beast_fang'],
    elite:   ['drop_venom_blade', 'drop_hunter_cloak', 'potion_big'],
    boss:    ['drop_venom_blade', 'drop_natures_gift'],
    explore: ['shard_water', 'potion_small'],
  },
  beast_lair: {
    normal:  ['shard_fire', 'potion_small', 'drop_beast_fang', 'drop_beast_fang'],
    elite:   ['drop_hawk_eye', 'drop_hunter_cloak', 'potion_big'],
    boss:    ['drop_hawk_eye', 'drop_natures_gift', 'drop_venom_blade'],
    explore: ['drop_beast_fang', 'shard_fire'],
  },
  thorn_maze: {
    normal:  ['shard_wind', 'potion_small', 'drop_beast_fang'],
    elite:   ['drop_hunter_cloak', 'potion_big'],
    boss:    ['drop_hunter_cloak', 'drop_natures_gift'],
    explore: ['potion_small', 'shard_wind'],
  },
  moonlake: {
    normal:  ['shard_wind', 'shard_water', 'potion_small'],
    elite:   ['drop_hawk_eye', 'drop_swift_boots'],
    boss:    ['drop_hawk_eye', 'drop_natures_gift', 'drop_venom_blade'],
    explore: ['shard_water', 'potion_small'],
  },
  jade_garden: {
    normal:  ['shard_water', 'potion_small', 'potion_small'],
    elite:   ['potion_big', 'drop_natures_gift'],
    boss:    ['drop_natures_gift', 'drop_swift_boots'],
    explore: ['potion_small', 'potion_big'],
  },
  verdant_dome: {
    normal:  ['shard_fire', 'shard_wind', 'shard_water', 'potion_small'],
    elite:   ['drop_swift_boots', 'drop_hunter_cloak', 'potion_big'],
    boss:    ['drop_hawk_eye', 'drop_venom_blade'],
    explore: ['shard_wind', 'potion_small'],
  },

  // ════════════ 🔮 秘法之境 ════════════
  forbidden_lib: {
    normal:  ['shard_fire', 'shard_wind', 'potion_small', 'drop_wisp_dust'],
    elite:   ['drop_mana_crystal', 'drop_rune_ring', 'potion_big'],
    boss:    ['drop_arcane_orb', 'drop_spell_tome'],
    explore: ['drop_wisp_dust', 'shard_fire'],
  },
  arcane_tower: {
    normal:  ['shard_fire', 'potion_small', 'drop_wisp_dust'],
    elite:   ['drop_mana_crystal', 'drop_arcane_orb'],
    boss:    ['drop_arcane_orb', 'drop_spell_tome', 'drop_rune_ring'],
    explore: ['drop_wisp_dust', 'shard_fire'],
  },
  void_corridor: {
    normal:  ['shard_fire', 'shard_water', 'potion_small', 'drop_wisp_dust'],
    elite:   ['drop_void_shard', 'drop_mana_crystal', 'potion_big'],
    boss:    ['drop_void_shard', 'drop_spell_tome'],
    explore: ['drop_wisp_dust', 'shard_water'],
  },
  mana_spring: {
    normal:  ['shard_water', 'potion_small', 'drop_wisp_dust'],
    elite:   ['drop_mana_crystal', 'drop_rune_ring'],
    boss:    ['drop_rune_ring', 'drop_spell_tome'],
    explore: ['potion_small', 'drop_wisp_dust'],
  },
  elem_throne: {
    normal:  ['shard_fire', 'shard_wind', 'potion_small', 'drop_wisp_dust'],
    elite:   ['drop_arcane_orb', 'drop_mana_crystal', 'potion_big'],
    boss:    ['drop_arcane_orb', 'drop_spell_tome', 'drop_void_shard'],
    explore: ['shard_fire', 'drop_wisp_dust'],
  },
  time_rift: {
    normal:  ['shard_wind', 'shard_water', 'potion_small'],
    elite:   ['drop_void_shard', 'drop_rune_ring'],
    boss:    ['drop_void_shard', 'drop_spell_tome'],
    explore: ['shard_wind', 'potion_small'],
  },
  rune_forge: {
    normal:  ['shard_fire', 'potion_small', 'drop_wisp_dust'],
    elite:   ['drop_rune_ring', 'drop_mana_crystal', 'potion_big'],
    boss:    ['drop_rune_ring', 'drop_spell_tome'],
    explore: ['drop_mana_crystal', 'shard_fire'],
  },
  star_palace: {
    normal:  ['shard_fire', 'shard_wind', 'shard_water', 'drop_wisp_dust'],
    elite:   ['drop_mana_crystal', 'drop_rune_ring', 'potion_big'],
    boss:    ['drop_arcane_orb', 'drop_spell_tome'],
    explore: ['drop_wisp_dust', 'potion_small'],
  },

  // ════════════ ⚔️ 征战之途 ════════════
  iron_fort: {
    normal:  ['shard_fire', 'potion_small', 'drop_soldier_badge'],
    elite:   ['drop_iron_plate', 'drop_bone_shield', 'potion_big'],
    boss:    ['drop_iron_plate', 'drop_glory_medal'],
    explore: ['drop_soldier_badge', 'shard_fire'],
  },
  blood_arena: {
    normal:  ['shard_fire', 'potion_small', 'drop_soldier_badge'],
    elite:   ['drop_blood_vial', 'drop_war_axe'],
    boss:    ['drop_war_axe', 'drop_blood_vial', 'drop_glory_medal'],
    explore: ['drop_soldier_badge', 'potion_small'],
  },
  thunder_cliff: {
    normal:  ['shard_wind', 'shard_fire', 'potion_small', 'drop_soldier_badge'],
    elite:   ['drop_war_axe', 'drop_bone_shield', 'potion_big'],
    boss:    ['drop_war_axe', 'drop_glory_medal'],
    explore: ['shard_wind', 'drop_soldier_badge'],
  },
  dragon_grave: {
    normal:  ['shard_fire', 'potion_small', 'drop_soldier_badge', 'drop_soldier_badge'],
    elite:   ['drop_war_axe', 'drop_iron_plate', 'potion_big'],
    boss:    ['drop_war_axe', 'drop_glory_medal', 'drop_blood_vial'],
    explore: ['drop_soldier_badge', 'shard_fire'],
  },
  gale_canyon: {
    normal:  ['shard_wind', 'potion_small', 'drop_soldier_badge'],
    elite:   ['drop_iron_plate', 'potion_big'],
    boss:    ['drop_iron_plate', 'drop_glory_medal'],
    explore: ['shard_wind', 'potion_small'],
  },
  war_altar: {
    normal:  ['shard_fire', 'shard_wind', 'potion_small', 'drop_soldier_badge'],
    elite:   ['drop_bone_shield', 'drop_blood_vial', 'potion_big'],
    boss:    ['drop_glory_medal', 'drop_blood_vial'],
    explore: ['drop_soldier_badge', 'shard_fire'],
  },
  immortal_tomb: {
    normal:  ['shard_fire', 'potion_small', 'drop_soldier_badge'],
    elite:   ['drop_blood_vial', 'drop_bone_shield', 'potion_big'],
    boss:    ['drop_blood_vial', 'drop_glory_medal', 'drop_war_axe'],
    explore: ['drop_soldier_badge', 'potion_small'],
  },
  glory_hall: {
    normal:  ['shard_fire', 'shard_wind', 'shard_water', 'drop_soldier_badge'],
    elite:   ['drop_iron_plate', 'drop_war_axe', 'potion_big'],
    boss:    ['drop_glory_medal', 'drop_war_axe'],
    explore: ['drop_soldier_badge', 'potion_small'],
  },

  // ════════════ 🕯️ 中立 / 跨线 ════════════
  forgotten_ruins: {
    normal:  ['shard_fire', 'shard_water', 'shard_wind', 'potion_small'],
    elite:   ['drop_mystery_box', 'drop_mimic_coin', 'potion_big'],
    boss:    ['drop_mystery_box', 'drop_chaos_fragment'],
    explore: ['drop_mimic_coin', 'potion_small'],
  },
  illusion_maze: {
    normal:  ['shard_wind', 'potion_small'],
    elite:   ['drop_mystery_box', 'potion_big'],
    boss:    ['drop_mystery_box', 'drop_chaos_fragment'],
    explore: ['drop_mimic_coin', 'shard_wind'],
  },
  time_nexus: {
    normal:  ['shard_fire', 'shard_water', 'potion_small'],
    elite:   ['drop_void_shard', 'drop_mystery_box'],
    boss:    ['drop_chaos_fragment', 'drop_mystery_box'],
    explore: ['shard_fire', 'shard_water'],
  },

  // ════════════ 特殊地图 ════════════
  chaos_anteroom: {
    normal:  ['shard_fire', 'shard_wind', 'shard_water', 'potion_small'],
    elite:   ['drop_chaos_fragment', 'drop_mystery_box', 'potion_big'],
    boss:    ['drop_chaos_fragment', 'drop_chaos_fragment'],
    explore: ['potion_big', 'drop_mystery_box'],
    qualityBonus: { [DROP_QUALITY.RARE]: 1.5, [DROP_QUALITY.EPIC]: 1.3 },
  },
  chaos_throne: {
    normal:  ['shard_fire', 'shard_wind', 'shard_water'],
    elite:   ['drop_chaos_fragment', 'potion_big'],
    boss:    ['drop_chaos_fragment', 'drop_chaos_fragment', 'drop_glory_medal', 'drop_spell_tome', 'drop_natures_gift'],
    explore: ['drop_chaos_fragment'],
    qualityBonus: { [DROP_QUALITY.RARE]: 2.0, [DROP_QUALITY.EPIC]: 2.0 },
  },
};

// ════════════════════════════════════════════
//  工具函数
// ════════════════════════════════════════════

/**
 * 获取某地图某来源的掉落池
 * @param {string} mapId
 * @param {'normal'|'elite'|'boss'|'explore'} source
 * @returns {Array<object>} 完整掉落物定义列表
 */
export function getMapDropPool(mapId, source = 'normal') {
  const table = MAP_DROP_TABLE[mapId];
  if (!table || !table[source]) return [];
  return table[source].map(id => getDropById(id)).filter(Boolean);
}

/**
 * 按品质权重从掉落池中随机抽取一个（支持地图品质修正）
 * @param {string} mapId
 * @param {'normal'|'elite'|'boss'|'explore'} source
 * @returns {object|null} 掉落物定义
 */
export function rollDrop(mapId, source = 'normal') {
  const pool = getMapDropPool(mapId, source);
  if (pool.length === 0) return null;

  const table = MAP_DROP_TABLE[mapId];
  const qBonus = table?.qualityBonus || {};

  // 按品质加权
  const weighted = pool.map(drop => {
    const baseW = BASE_QUALITY_WEIGHTS[drop.quality] || 10;
    const bonus = qBonus[drop.quality] || 1;
    return { drop, weight: baseW * bonus };
  });

  const totalW = weighted.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * totalW;
  for (const { drop, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return drop;
  }
  return weighted[weighted.length - 1].drop;
}

/**
 * 根据线路偏好过滤掉落池（同线路物品权重 ×2）
 * @param {Array} drops
 * @param {string} playerLine 玩家当前线路
 * @returns {Array} 权重调整后的掉落物数组
 */
export function filterDropsByLine(drops, playerLine) {
  if (!Array.isArray(drops) || drops.length === 0) return [];
  return drops.map(d => ({
    ...d,
    _weight: (d.line === playerLine || d.line === 'any') ? 2 : 1,
  }));
}
