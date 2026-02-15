/**
 * 地图事件系统
 * ════════════════════════════════════════════
 * 每张地图可触发的事件池：进入事件、Boss前事件、Boss后事件、随机遭遇。
 * 事件框架就绪后可直接读取此数据驱动。
 *
 * 事件节点结构：
 *   { id, name, description, type, trigger, effect }
 *
 *   type     — 'buff' | 'debuff' | 'encounter' | 'shop' | 'treasure' | 'trap' | 'story'
 *   trigger  — 'onEnter' | 'preBoss' | 'postBoss' | 'random' | 'explore'
 *   effect   — { stat?, value?, itemId?, gold?, custom? }
 *              框架阶段先置空，稍后逐步绑定实际逻辑
 */

import { LINE, NEUTRAL } from './mapPool';

// ════════════════════════════════════════════
//  通用事件（所有地图可用）
// ════════════════════════════════════════════

export const COMMON_EVENTS = [
  {
    id: 'evt_heal_spring',
    name: '治愈之泉',
    description: '发现一处泉水，恢复30%生命值。',
    type: 'buff',
    trigger: 'explore',
    effect: { healPct: 0.3 },
  },
  {
    id: 'evt_gold_chest',
    name: '宝箱',
    description: '发现一个宝箱，获得一笔金币。',
    type: 'treasure',
    trigger: 'explore',
    effect: { gold: 80 },
  },
  {
    id: 'evt_trap_spike',
    name: '地刺陷阱',
    description: '触发地刺，受到少量伤害。',
    type: 'trap',
    trigger: 'random',
    effect: { damagePct: 0.1 },
  },
  {
    id: 'evt_wandering_merchant',
    name: '流浪商人',
    description: '一位神秘商人出现，可以购买物品。',
    type: 'shop',
    trigger: 'random',
    effect: { shopPool: 'wandering' },
  },
  {
    id: 'evt_stat_shrine',
    name: '试炼石碑',
    description: '石碑发出光芒，随机强化一项属性5%。',
    type: 'buff',
    trigger: 'explore',
    effect: { randomStatPct: 0.05 },
  },
  {
    id: 'evt_cursed_altar',
    name: '诅咒祭坛',
    description: '祭坛的力量：获得10%伤害但降低5%移速。',
    type: 'encounter',
    trigger: 'explore',
    effect: { damageMult: 1.10, speedMult: 0.95 },
  },
];

// ════════════════════════════════════════════
//  🌿 狩猎之道 专属事件
// ════════════════════════════════════════════

export const HUNT_EVENTS = [
  {
    id: 'evt_hunt_ambush',
    name: '野兽伏击',
    description: '一群野兽从灌木中冲出！',
    type: 'encounter',
    trigger: 'random',
    effect: { spawnWave: 'hunt_ambush' },
  },
  {
    id: 'evt_hunt_herb',
    name: '珍稀草药',
    description: '发现珍稀草药，永久增加2%生命上限。',
    type: 'buff',
    trigger: 'explore',
    effect: { maxHpPct: 0.02 },
  },
  {
    id: 'evt_hunt_tracker',
    name: '猎人踪迹',
    description: '循着猎人留下的标记，获得移速加成。',
    type: 'buff',
    trigger: 'onEnter',
    effect: { speedMult: 1.08, duration: 60000 },
  },
];

// ════════════════════════════════════════════
//  🔮 秘法之境 专属事件
// ════════════════════════════════════════════

export const ARCANE_EVENTS = [
  {
    id: 'evt_arcane_puzzle',
    name: '奥术谜题',
    description: '解开符文机关，获得法力护盾。',
    type: 'buff',
    trigger: 'explore',
    effect: { shieldCharges: 1 },
  },
  {
    id: 'evt_arcane_backfire',
    name: '魔力反噬',
    description: '不稳定的魔力爆发！受到少量伤害但获得攻速加成。',
    type: 'encounter',
    trigger: 'random',
    effect: { damagePct: 0.08, fireRateMult: 0.90 },
  },
  {
    id: 'evt_arcane_tome',
    name: '古老典籍',
    description: '翻阅遗落的法典，永久提升3%法术伤害。',
    type: 'buff',
    trigger: 'explore',
    effect: { damageMult: 1.03 },
  },
];

// ════════════════════════════════════════════
//  ⚔️ 征战之途 专属事件
// ════════════════════════════════════════════

export const WAR_EVENTS = [
  {
    id: 'evt_war_duel',
    name: '战士挑战',
    description: '一位强悍的挑战者拦住去路！',
    type: 'encounter',
    trigger: 'random',
    effect: { spawnWave: 'war_duel' },
  },
  {
    id: 'evt_war_forge',
    name: '战地铁匠',
    description: '铁匠为你的武器淬火，永久提升2%伤害。',
    type: 'buff',
    trigger: 'explore',
    effect: { damageMult: 1.02 },
  },
  {
    id: 'evt_war_rally',
    name: '战吼鼓舞',
    description: '战旗的力量鼓舞了你，暂时提升攻击和防御。',
    type: 'buff',
    trigger: 'onEnter',
    effect: { damageMult: 1.05, armorFlat: 5, duration: 45000 },
  },
];

// ════════════════════════════════════════════
//  🕯️ 中立地图 专属事件
// ════════════════════════════════════════════

export const NEUTRAL_EVENTS = [
  {
    id: 'evt_neutral_gamble',
    name: '命运赌局',
    description: '命运的轮盘转动：随机获得强力增益或轻微减益。',
    type: 'encounter',
    trigger: 'explore',
    effect: { gamble: true },
  },
  {
    id: 'evt_neutral_portal',
    name: '次元裂隙',
    description: '裂隙中涌出少量异界生物！击败后获得稀有掉落。',
    type: 'encounter',
    trigger: 'random',
    effect: { spawnWave: 'neutral_portal', bonusDrop: true },
  },
];

// ════════════════════════════════════════════
//  地图 → 事件绑定表
// ════════════════════════════════════════════

/**
 * 每张地图可触发的事件列表。
 * key = mapId, value = { onEnter?, explore?, random?, preBoss?, postBoss? }
 * 每种 trigger 对应一个事件ID数组，运行时从中抽取。
 * 未列出的地图使用 COMMON_EVENTS 作为默认。
 */
export const MAP_EVENT_TABLE = {
  // ── 狩猎之道 ──
  dawn_woodland:   { explore: ['evt_hunt_herb', 'evt_gold_chest'],       random: ['evt_hunt_ambush', 'evt_trap_spike'] },
  wind_forest:     { onEnter: ['evt_hunt_tracker'],                      random: ['evt_hunt_ambush'] },
  gloom_swamp:     { explore: ['evt_cursed_altar', 'evt_hunt_herb'],     random: ['evt_trap_spike'] },
  beast_lair:      { explore: ['evt_gold_chest'],                        random: ['evt_hunt_ambush', 'evt_hunt_ambush'] },
  thorn_maze:      { explore: ['evt_stat_shrine'],                       random: ['evt_trap_spike', 'evt_trap_spike'] },
  moonlake:        { explore: ['evt_hunt_herb', 'evt_heal_spring'],      random: ['evt_hunt_ambush'] },
  jade_garden:     { explore: ['evt_heal_spring', 'evt_heal_spring'],    random: ['evt_wandering_merchant'] },
  verdant_dome:    { explore: ['evt_stat_shrine', 'evt_gold_chest'],     random: ['evt_hunt_ambush'] },

  // ── 秘法之境 ──
  forbidden_lib:   { explore: ['evt_arcane_tome', 'evt_gold_chest'],     random: ['evt_arcane_backfire'] },
  arcane_tower:    { explore: ['evt_arcane_puzzle'],                      random: ['evt_arcane_backfire', 'evt_trap_spike'] },
  void_corridor:   { explore: ['evt_cursed_altar'],                      random: ['evt_arcane_backfire'] },
  mana_spring:     { explore: ['evt_heal_spring', 'evt_arcane_tome'],    random: ['evt_wandering_merchant'] },
  elem_throne:     { explore: ['evt_stat_shrine', 'evt_arcane_puzzle'],  random: ['evt_arcane_backfire'] },
  time_rift:       { explore: ['evt_arcane_puzzle', 'evt_arcane_tome'],  random: ['evt_trap_spike'] },
  rune_forge:      { explore: ['evt_stat_shrine'],                       random: ['evt_wandering_merchant'] },
  star_palace:     { explore: ['evt_arcane_tome', 'evt_gold_chest'],     random: ['evt_arcane_backfire'] },

  // ── 征战之途 ──
  iron_fort:       { explore: ['evt_war_forge', 'evt_gold_chest'],       random: ['evt_war_duel'] },
  blood_arena:     { onEnter: ['evt_war_rally'],                         random: ['evt_war_duel', 'evt_war_duel'] },
  thunder_cliff:   { explore: ['evt_stat_shrine'],                       random: ['evt_war_duel', 'evt_trap_spike'] },
  dragon_grave:    { explore: ['evt_gold_chest', 'evt_war_forge'],       random: ['evt_war_duel'] },
  gale_canyon:     { onEnter: ['evt_war_rally'],                         random: ['evt_trap_spike'] },
  war_altar:       { explore: ['evt_war_forge', 'evt_stat_shrine'],      random: ['evt_war_duel'] },
  immortal_tomb:   { explore: ['evt_cursed_altar', 'evt_gold_chest'],    random: ['evt_war_duel'] },
  glory_hall:      { explore: ['evt_war_forge', 'evt_heal_spring'],      random: ['evt_wandering_merchant'] },

  // ── 中立 / 跨线 ──
  forgotten_ruins: { explore: ['evt_neutral_gamble', 'evt_stat_shrine'], random: ['evt_neutral_portal', 'evt_trap_spike'] },
  illusion_maze:   { explore: ['evt_neutral_gamble'],                    random: ['evt_neutral_portal'] },
  time_nexus:      { explore: ['evt_neutral_gamble', 'evt_arcane_puzzle'], random: ['evt_neutral_portal'] },

  // ── 特殊地图 ──
  chaos_anteroom:  { explore: ['evt_cursed_altar', 'evt_heal_spring'],   random: ['evt_neutral_portal', 'evt_trap_spike'] },
  chaos_throne:    { preBoss: ['evt_cursed_altar'] },
};

// ════════════════════════════════════════════
//  工具函数
// ════════════════════════════════════════════

/** 根据事件ID查找事件定义 */
const ALL_EVENTS = [...COMMON_EVENTS, ...HUNT_EVENTS, ...ARCANE_EVENTS, ...WAR_EVENTS, ...NEUTRAL_EVENTS];
const _eventIndex = {};
ALL_EVENTS.forEach(e => { _eventIndex[e.id] = e; });

export function getEventById(id) {
  return _eventIndex[id] || null;
}

/**
 * 获取某张地图在指定 trigger 下可触发的事件列表（完整定义）
 * @param {string} mapId
 * @param {'onEnter'|'explore'|'random'|'preBoss'|'postBoss'} trigger
 * @returns {Array} 事件定义对象数组
 */
export function getMapEvents(mapId, trigger) {
  const table = MAP_EVENT_TABLE[mapId];
  if (!table || !table[trigger]) return [];
  return table[trigger].map(id => getEventById(id)).filter(Boolean);
}

/**
 * 从事件列表中随机抽取一个（简单加权暂不实现，等概率抽取）
 * @param {Array} events
 * @returns {object|null}
 */
export function drawRandomEvent(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  return events[Math.floor(Math.random() * events.length)];
}

/**
 * 获取某条线路的专属事件池
 * @param {string} line  LINE.HUNT | LINE.ARCANE | LINE.WAR | NEUTRAL
 * @returns {Array}
 */
export function getLineEvents(line) {
  switch (line) {
    case LINE.HUNT:   return HUNT_EVENTS;
    case LINE.ARCANE: return ARCANE_EVENTS;
    case LINE.WAR:    return WAR_EVENTS;
    default:          return NEUTRAL_EVENTS;
  }
}
