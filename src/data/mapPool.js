/**
 * [DEPRECATED] 地图池 & 分支系统
 * ════════════════════════════════════════════
 * 2024-03 起项目已切换为混沌竞技场单地图模式。
 * 本文件中的三路线数据（HUNT/ARCANE/WAR_MAPS）仅作为地图元数据池保留，
 * 供 LevelProgressionMixin 的竞技场关卡随机选图使用。
 * 旧的路线选择流程（getLayerChoices / showPathChoiceUI）已弃用。
 *
 * 仍在使用的导出：ALL_MAPS, NEUTRAL, getMapById, START_ROOM
 * 已弃用：STAGE_FLOW, LINE_META, getLayerChoices, HUNT_MAPS, ARCANE_MAPS, WAR_MAPS
 *
 * 原设计：三条主线 × 8 张地图 = 24 张 + 6 张中立/特殊 = 30 张
 *
 * 流程：10 层（不含起点）
 *   起点  → 命运十字（选武器）
 *   第1层 → 三选一：三条主线各出1张（决定初始路线）
 *   第2层 → 当前主线2张 + 跨线节点1张
 *   第3层 → 当前主线2张 + 跨线节点1张
 *   第4层 → 当前主线3张（时空枢纽可能混入）
 *   第5层 → 当前主线2张 + 跨线节点1张
 *   第6层 → 当前主线3张
 *   第7层 → 当前主线2张 + 跨线节点1张
 *   第8层 → 当前主线2张 + 跨线节点1张
 *   第9层 → 混沌前厅（固定）
 *   第10层→ 混沌王座（固定，最终 Boss）
 *
 * 事件框架暂不实现，仅保留数据字段预留。
 */

// ════════════════════════════════════════════
//  常量 & 枚举
// ════════════════════════════════════════════

/** 三条主线标识 */
export const LINE = {
  HUNT:   'hunt',    // 🌿 狩猎之道
  ARCANE: 'arcane',  // 🔮 秘法之境
  WAR:    'war',     // ⚔️ 征战之途
};

/** 中立/特殊地图标识 */
export const NEUTRAL = 'neutral';

// ════════════════════════════════════════════
//  🌿 狩猎之道（自然、敏捷、生存）— 8 张
// ════════════════════════════════════════════

export const HUNT_MAPS = [
  {
    id: 'dawn_woodland',    name: '晨曦林地',  subtitle: '远程、敏捷',
    line: LINE.HUNT, layers: [1, 4],
    drops: '弓箭/弩类武器、攻速加成、闪避道具',
  },
  {
    id: 'wind_forest',      name: '风语森林',  subtitle: '机动、陷阱',
    line: LINE.HUNT, layers: [1, 5],
    drops: '移速加成、陷阱类技能、冲刺强化',
  },
  {
    id: 'gloom_swamp',      name: '幽光沼泽',  subtitle: '持续伤害、控制',
    line: LINE.HUNT, layers: [2, 6],
    drops: '毒/流血类武器、减速光环、定身道具',
  },
  {
    id: 'beast_lair',       name: '兽王巢穴',  subtitle: '召唤、协同',
    line: LINE.HUNT, layers: [2, 7],
    drops: '召唤兽技能书、宠物强化道具、群体增益',
  },
  {
    id: 'thorn_maze',       name: '荆棘迷宫',  subtitle: '反伤、生存',
    line: LINE.HUNT, layers: [3, 6],
    drops: '反伤甲、护甲加成、荆棘光环',
  },
  {
    id: 'moonlake',         name: '月影湖畔',  subtitle: '隐身、爆发',
    line: LINE.HUNT, layers: [3, 7],
    drops: '背刺加成、暴击伤害、隐身技能',
  },
  {
    id: 'jade_garden',      name: '翡翠庭院',  subtitle: '治疗、自然',
    line: LINE.HUNT, layers: [5, 8],
    drops: '生命回复、自然治愈、生命偷取',
  },
  {
    id: 'verdant_dome',     name: '苍翠穹顶',  subtitle: '均衡、自然',
    line: LINE.HUNT, layers: [4, 8],
    drops: '混合掉落（自然系各类，品质略低）',
  },
];

// ════════════════════════════════════════════
//  🔮 秘法之境（魔法、元素、神秘）— 8 张
// ════════════════════════════════════════════

export const ARCANE_MAPS = [
  {
    id: 'forbidden_lib',    name: '禁书藏馆',  subtitle: '法术强度、冷却',
    line: LINE.ARCANE, layers: [1, 4],
    drops: '法杖/法球、法伤加成、冷却缩减',
  },
  {
    id: 'arcane_tower',     name: '奥术高塔',  subtitle: '远程法术、穿透',
    line: LINE.ARCANE, layers: [1, 5],
    drops: '穿透类法术、法术范围扩大、奥术飞弹强化',
  },
  {
    id: 'void_corridor',    name: '虚空回廊',  subtitle: '召唤、黑暗',
    line: LINE.ARCANE, layers: [2, 6],
    drops: '恶魔召唤书、暗影伤害、召唤物强化',
  },
  {
    id: 'mana_spring',      name: '魔力源泉',  subtitle: '法力续航、范围',
    line: LINE.ARCANE, layers: [2, 7],
    drops: '法力回复、范围法术、回蓝道具',
  },
  {
    id: 'elem_throne',      name: '元素王座',  subtitle: '元素专精',
    line: LINE.ARCANE, layers: [3, 6],
    drops: '单一元素强化（火/冰/雷）、元素转换',
  },
  {
    id: 'time_rift',        name: '时空裂境',  subtitle: '控制、位移',
    line: LINE.ARCANE, layers: [3, 7],
    drops: '减速/定身法术、瞬移技能、时间操控',
  },
  {
    id: 'rune_forge',       name: '符文工坊',  subtitle: '增益、附魔',
    line: LINE.ARCANE, layers: [5, 8],
    drops: '武器/防具附魔卷轴、临时增益、符文镶嵌',
  },
  {
    id: 'star_palace',      name: '星辰穹殿',  subtitle: '均衡、秘法',
    line: LINE.ARCANE, layers: [4, 8],
    drops: '混合掉落（秘法系各类）',
  },
];

// ════════════════════════════════════════════
//  ⚔️ 征战之途（力量、坚韧、荣耀）— 8 张
// ════════════════════════════════════════════

export const WAR_MAPS = [
  {
    id: 'iron_fort',        name: '钢铁要塞',  subtitle: '防御、格挡',
    line: LINE.WAR, layers: [1, 4],
    drops: '盾牌、护甲、格挡率、减伤',
  },
  {
    id: 'blood_arena',      name: '血染斗技场', subtitle: '狂暴、吸血',
    line: LINE.WAR, layers: [1, 5],
    drops: '吸血武器、狂暴技能、生命偷取',
  },
  {
    id: 'thunder_cliff',    name: '雷霆崖壁',  subtitle: '击退、震荡',
    line: LINE.WAR, layers: [2, 6],
    drops: '击退武器、眩晕概率、震荡波',
  },
  {
    id: 'dragon_grave',     name: '巨龙墓地',  subtitle: '屠龙、威压',
    line: LINE.WAR, layers: [2, 7],
    drops: '对龙类增伤、龙鳞护甲、威压光环',
  },
  {
    id: 'gale_canyon',      name: '烈风峡谷',  subtitle: '冲锋、机动',
    line: LINE.WAR, layers: [3, 6],
    drops: '冲锋技能、移动速度、突进强化',
  },
  {
    id: 'war_altar',        name: '战神祭坛',  subtitle: '战吼、团队',
    line: LINE.WAR, layers: [3, 7],
    drops: '群体增益、战吼技能、怒气系统',
  },
  {
    id: 'immortal_tomb',    name: '不朽王陵',  subtitle: '复活、亡语',
    line: LINE.WAR, layers: [5, 8],
    drops: '死亡触发效果、复活道具、亡语技能',
  },
  {
    id: 'glory_hall',       name: '荣光殿堂',  subtitle: '均衡、战斗',
    line: LINE.WAR, layers: [4, 8],
    drops: '混合掉落（征战系各类）',
  },
];

// ════════════════════════════════════════════
//  🕯️ 中立 / 跨线节点地图
// ════════════════════════════════════════════

export const NEUTRAL_MAPS = [
  {
    id: 'forgotten_ruins',  name: '遗忘之墟',  subtitle: '随机增益/减益',
    line: NEUTRAL, layers: [2, 3, 4, 5, 6, 7, 8],
    drops: '随机效果',
    crossLine: true,
  },
  {
    id: 'illusion_maze',    name: '幻象迷宫',  subtitle: '迷宫寻路',
    line: NEUTRAL, layers: [2, 5, 8],
    drops: '路线印记',
    crossLine: true,
  },
  {
    id: 'time_nexus',       name: '时空枢纽',  subtitle: '跨线跳转',
    line: NEUTRAL, layers: [4, 7],
    drops: '跨线道具',
    crossLine: true,
  },
];

// ════════════════════════════════════════════
//  固定特殊地图（不参与池抽取）
// ════════════════════════════════════════════

export const START_ROOM = {
  id: 'start_room',  name: '试炼之地',  subtitle: '熟悉职业并完成首战',
  line: NEUTRAL, type: 'start',
};

export const CHAOS_ANTEROOM = {
  id: 'chaos_anteroom',  name: '混沌前厅',  subtitle: '最后的准备',
  line: NEUTRAL, type: 'rest',
};

export const CHAOS_THRONE = {
  id: 'chaos_throne',  name: '混沌王座',  subtitle: '最终决战',
  line: NEUTRAL, type: 'boss',
};

// ════════════════════════════════════════════
//  汇总 & 索引
// ════════════════════════════════════════════

export const LINE_MAPS = [...HUNT_MAPS, ...ARCANE_MAPS, ...WAR_MAPS];
export const ALL_MAPS  = [...LINE_MAPS, ...NEUTRAL_MAPS];

const _mapById = {};
ALL_MAPS.forEach(m => { _mapById[m.id] = m; });
_mapById[START_ROOM.id]      = START_ROOM;
_mapById[CHAOS_ANTEROOM.id]  = CHAOS_ANTEROOM;
_mapById[CHAOS_THRONE.id]    = CHAOS_THRONE;

export function getMapById(id) { return _mapById[id] || null; }
export function getMapsByLine(line) { return LINE_MAPS.filter(m => m.line === line); }

// ════════════════════════════════════════════
//  10 层流程定义
// ════════════════════════════════════════════

export const STAGE_FLOW = [
  { layer: 1,  type: 'intro' },                                       // 三线各1
  { layer: 2,  type: 'choice', crossLineSlot: true },                 // 主线2 + 跨线1
  { layer: 3,  type: 'choice', crossLineSlot: true },                 // 主线2 + 跨线1
  { layer: 4,  type: 'choice', crossLineSlot: false },                // 主线3
  { layer: 5,  type: 'choice', crossLineSlot: true },                 // 主线2 + 跨线1
  { layer: 6,  type: 'choice', crossLineSlot: false },                // 主线3
  { layer: 7,  type: 'choice', crossLineSlot: true },                 // 主线2 + 跨线1
  { layer: 8,  type: 'choice', crossLineSlot: true },                 // 主线2 + 跨线1
  { layer: 9,  type: 'fixed',  mapId: 'chaos_anteroom' },             // 混沌前厅
  { layer: 10, type: 'fixed',  mapId: 'chaos_throne' },               // 混沌王座
];

// ════════════════════════════════════════════
//  主线元数据（颜色、标签、emoji）
// ════════════════════════════════════════════

export const LINE_META = {
  [LINE.HUNT]:   { emoji: '🌿', label: '狩猎之道', color: 0x44aa44, hex: '#44aa44' },
  [LINE.ARCANE]: { emoji: '🔮', label: '秘法之境', color: 0x6666dd, hex: '#6666dd' },
  [LINE.WAR]:    { emoji: '⚔️', label: '征战之途', color: 0xcc4444, hex: '#cc4444' },
  [NEUTRAL]:     { emoji: '🕯️', label: '中立',     color: 0x999999, hex: '#999999' },
};

// ════════════════════════════════════════════
//  抽取逻辑
// ════════════════════════════════════════════

/** 加权随机抽 n 张不重复 */
function weightedDraw(pool, n) {
  let candidates = [...pool];
  const result = [];
  for (let i = 0; i < n && candidates.length > 0; i++) {
    const total = candidates.reduce((s, c) => s + (c.weight || 1), 0);
    let r = Math.random() * total;
    let chosen = candidates[0];
    for (const c of candidates) {
      r -= (c.weight || 1);
      if (r <= 0) { chosen = c; break; }
    }
    result.push({ ...chosen });
    candidates = candidates.filter(c => c.id !== chosen.id);
  }
  return result;
}

/** 第1层特殊：三线各随机1张 layer=1 的地图 */
export function drawIntroChoices(excludeIds = []) {
  const result = [];
  for (const line of [LINE.HUNT, LINE.ARCANE, LINE.WAR]) {
    const pool = getMapsByLine(line).filter(m =>
      m.layers.includes(1) && !excludeIds.includes(m.id)
    );
    if (pool.length > 0) {
      result.push(...weightedDraw(pool, 1));
    }
  }
  while (result.length < 3) {
    result.push({ id: 'unknown', name: '未知路径', subtitle: '???', line: NEUTRAL, layers: [] });
  }
  return result;
}

/**
 * 常规层三选一
 * @param {number} layer 当前层 (2-8)
 * @param {string} currentLine 当前主线
 * @param {object} opts { excludeIds, crossLineSlot }
 */
export function drawLayerChoices(layer, currentLine, opts = {}) {
  const { excludeIds = [], crossLineSlot = false } = opts;
  const result = [];

  const linePool = getMapsByLine(currentLine).filter(m =>
    m.layers.includes(layer) && !excludeIds.includes(m.id)
  );
  const neutralPool = NEUTRAL_MAPS.filter(m =>
    m.layers.includes(layer) && !excludeIds.includes(m.id)
  );

  if (crossLineSlot && neutralPool.length > 0) {
    result.push(...weightedDraw(linePool, 2));
    result.push(...weightedDraw(neutralPool, 1));
  } else {
    result.push(...weightedDraw(linePool, 3));
  }

  // 不够3张时依次从整线→中立→全池兜底
  if (result.length < 3) {
    const fb1 = [...linePool, ...neutralPool].filter(
      m => !result.some(r => r.id === m.id) && !excludeIds.includes(m.id)
    );
    result.push(...weightedDraw(fb1, 3 - result.length));
  }
  if (result.length < 3) {
    const fb2 = ALL_MAPS.filter(
      m => !result.some(r => r.id === m.id) && !excludeIds.includes(m.id)
    );
    result.push(...weightedDraw(fb2, 3 - result.length));
  }
  while (result.length < 3) {
    result.push({ id: 'unknown', name: '未知路径', subtitle: '???', line: NEUTRAL, layers: [] });
  }
  return result;
}

/**
 * 统一入口：根据层号获取三选一 / 固定地图
 * @param {number} layer 1-10
 * @param {string|null} currentLine 当前主线（layer=1 时为 null）
 * @param {object} runState { visitedMapIds }
 * @returns {{ choices: Array|null, fixedMap: object|null }}
 */
export function getLayerChoices(layer, currentLine, runState = {}) {
  const flow = STAGE_FLOW.find(s => s.layer === layer);
  if (!flow) return { choices: null, fixedMap: null };

  const excludeIds = runState.visitedMapIds || [];

  if (flow.type === 'intro') {
    return { choices: drawIntroChoices(excludeIds), fixedMap: null };
  }

  if (flow.type === 'fixed') {
    const map = getMapById(flow.mapId);
    return { choices: null, fixedMap: map ? { ...map } : null };
  }

  return {
    choices: drawLayerChoices(layer, currentLine || LINE.HUNT, {
      excludeIds,
      crossLineSlot: !!flow.crossLineSlot,
    }),
    fixedMap: null,
  };
}
