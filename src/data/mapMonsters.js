/**
 * 地图怪物绑定系统（完整版）
 * ════════════════════════════════════════════
 * 每张地图：小怪 ×3 种、精英 ×2 种、Boss ×1
 *
 * 怪物等级：
 *   role = 'minion'  → 圆形最小 (size 10-14)
 *   role = 'elite'   → 圆形中等 (size 18-22)
 *   role = 'boss'    → 圆形最大 (size 38-50)
 *
 * 当前所有怪物使用圆形原型显示，下方标注名称。
 */

import { LINE, NEUTRAL } from './mapPool';

// ════════════════════════════════════════════
//  尺寸常量
// ════════════════════════════════════════════

export const ROLE_SIZE = {
  minion: 11,
  elite:  20,
  boss:   44,
};

export const ROLE_HP = {
  minion: 40,    // 测试用低血量
  elite:  80,
  boss:   100,   // 测试用低血量，便于快速击杀
};

// ════════════════════════════════════════════
//  完整怪物定义
// ════════════════════════════════════════════

/**
 * 每个怪物条目：
 *   id, name, role ('minion'|'elite'|'boss'), mapId, line,
 *   color (十六进制), moveType ('chaser'|'shooter'|'patrol'|'static')
 *   baseHp / baseDamage 会根据 role 自动设置
 */

// ─────────────────────────────────────────────
//  🌿 晨曦林地 dawn_woodland
// ─────────────────────────────────────────────
export const DAWN_WOODLAND_MONSTERS = [
  { id: 'dw_m1', name: '晨光蝶',       role: 'minion', mapId: 'dawn_woodland', line: LINE.HUNT, color: 0xffee88, moveType: 'patrol' },
  { id: 'dw_m2', name: '树苗守卫',     role: 'minion', mapId: 'dawn_woodland', line: LINE.HUNT, color: 0x66aa44, moveType: 'chaser' },
  { id: 'dw_m3', name: '疾风斥候',     role: 'minion', mapId: 'dawn_woodland', line: LINE.HUNT, color: 0x88ccaa, moveType: 'chaser' },
  { id: 'dw_e1', name: '古老树精',     role: 'elite',  mapId: 'dawn_woodland', line: LINE.HUNT, color: 0x447733, moveType: 'patrol' },
  { id: 'dw_e2', name: '黎明守卫',     role: 'elite',  mapId: 'dawn_woodland', line: LINE.HUNT, color: 0xddcc44, moveType: 'chaser' },
  { id: 'dw_b1', name: '黎明鹿王·艾尔文', role: 'boss', mapId: 'dawn_woodland', line: LINE.HUNT, color: 0xffdd66, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🌿 风语森林 wind_forest
// ─────────────────────────────────────────────
export const WIND_FOREST_MONSTERS = [
  { id: 'wf_m1', name: '风精',         role: 'minion', mapId: 'wind_forest', line: LINE.HUNT, color: 0xaaddcc, moveType: 'patrol' },
  { id: 'wf_m2', name: '疾风盗贼',     role: 'minion', mapId: 'wind_forest', line: LINE.HUNT, color: 0x778866, moveType: 'chaser' },
  { id: 'wf_m3', name: '旋风幼体',     role: 'minion', mapId: 'wind_forest', line: LINE.HUNT, color: 0x99ccbb, moveType: 'chaser' },
  { id: 'wf_e1', name: '狂风使者',     role: 'elite',  mapId: 'wind_forest', line: LINE.HUNT, color: 0x55aa88, moveType: 'chaser' },
  { id: 'wf_e2', name: '风暴追猎者',   role: 'elite',  mapId: 'wind_forest', line: LINE.HUNT, color: 0x77ccaa, moveType: 'chaser' },
  { id: 'wf_b1', name: '风语者·赛莲',  role: 'boss',   mapId: 'wind_forest', line: LINE.HUNT, color: 0x66eebb, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🌿 幽光沼泽 gloom_swamp
// ─────────────────────────────────────────────
export const GLOOM_SWAMP_MONSTERS = [
  { id: 'gs_m1', name: '沼泽蛞蝓',     role: 'minion', mapId: 'gloom_swamp', line: LINE.HUNT, color: 0x667744, moveType: 'patrol' },
  { id: 'gs_m2', name: '幽光蚊群',     role: 'minion', mapId: 'gloom_swamp', line: LINE.HUNT, color: 0x88aa55, moveType: 'chaser' },
  { id: 'gs_m3', name: '泥沼怪',       role: 'minion', mapId: 'gloom_swamp', line: LINE.HUNT, color: 0x556633, moveType: 'chaser' },
  { id: 'gs_e1', name: '剧毒潜伏者',   role: 'elite',  mapId: 'gloom_swamp', line: LINE.HUNT, color: 0x44aa33, moveType: 'chaser' },
  { id: 'gs_e2', name: '幽光亡魂',     role: 'elite',  mapId: 'gloom_swamp', line: LINE.HUNT, color: 0xaacc77, moveType: 'patrol' },
  { id: 'gs_b1', name: '沼泽之母·格蕾塔', role: 'boss', mapId: 'gloom_swamp', line: LINE.HUNT, color: 0x338833, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🌿 兽王巢穴 beast_lair
// ─────────────────────────────────────────────
export const BEAST_LAIR_MONSTERS = [
  { id: 'bl_m1', name: '巢穴幼兽',     role: 'minion', mapId: 'beast_lair', line: LINE.HUNT, color: 0xaa8855, moveType: 'chaser' },
  { id: 'bl_m2', name: '尖牙野狼',     role: 'minion', mapId: 'beast_lair', line: LINE.HUNT, color: 0x887755, moveType: 'chaser' },
  { id: 'bl_m3', name: '暗影豹',       role: 'minion', mapId: 'beast_lair', line: LINE.HUNT, color: 0x554466, moveType: 'chaser' },
  { id: 'bl_e1', name: '兽王亲卫',     role: 'elite',  mapId: 'beast_lair', line: LINE.HUNT, color: 0xcc8844, moveType: 'chaser' },
  { id: 'bl_e2', name: '狂乱巨熊',     role: 'elite',  mapId: 'beast_lair', line: LINE.HUNT, color: 0x885533, moveType: 'chaser' },
  { id: 'bl_b1', name: '兽王·卡恩',    role: 'boss',   mapId: 'beast_lair', line: LINE.HUNT, color: 0xdd9944, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🌿 荆棘迷宫 thorn_maze
// ─────────────────────────────────────────────
export const THORN_MAZE_MONSTERS = [
  { id: 'tm_m1', name: '荆棘藤蔓',     role: 'minion', mapId: 'thorn_maze', line: LINE.HUNT, color: 0x558833, moveType: 'static' },
  { id: 'tm_m2', name: '迷宫刺球',     role: 'minion', mapId: 'thorn_maze', line: LINE.HUNT, color: 0x778844, moveType: 'patrol' },
  { id: 'tm_m3', name: '毒刺花妖',     role: 'minion', mapId: 'thorn_maze', line: LINE.HUNT, color: 0xcc66aa, moveType: 'shooter' },
  { id: 'tm_e1', name: '荆棘编织者',   role: 'elite',  mapId: 'thorn_maze', line: LINE.HUNT, color: 0x447722, moveType: 'patrol' },
  { id: 'tm_e2', name: '铁刺守卫',     role: 'elite',  mapId: 'thorn_maze', line: LINE.HUNT, color: 0x667744, moveType: 'chaser' },
  { id: 'tm_b1', name: '迷宫之主·索恩', role: 'boss',  mapId: 'thorn_maze', line: LINE.HUNT, color: 0x339922, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🌿 月影湖畔 moonlake
// ─────────────────────────────────────────────
export const MOONLAKE_MONSTERS = [
  { id: 'ml_m1', name: '月影幽魂',     role: 'minion', mapId: 'moonlake', line: LINE.HUNT, color: 0x9999cc, moveType: 'patrol' },
  { id: 'ml_m2', name: '湖光幻妖',     role: 'minion', mapId: 'moonlake', line: LINE.HUNT, color: 0x7788bb, moveType: 'shooter' },
  { id: 'ml_m3', name: '夜行猎手',     role: 'minion', mapId: 'moonlake', line: LINE.HUNT, color: 0x556688, moveType: 'chaser' },
  { id: 'ml_e1', name: '暗月刺客',     role: 'elite',  mapId: 'moonlake', line: LINE.HUNT, color: 0x6666aa, moveType: 'chaser' },
  { id: 'ml_e2', name: '湖中女妖',     role: 'elite',  mapId: 'moonlake', line: LINE.HUNT, color: 0x8888cc, moveType: 'shooter' },
  { id: 'ml_b1', name: '月影女士·莱拉', role: 'boss',  mapId: 'moonlake', line: LINE.HUNT, color: 0xaaaaee, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🌿 翡翠庭院 jade_garden
// ─────────────────────────────────────────────
export const JADE_GARDEN_MONSTERS = [
  { id: 'jg_m1', name: '翡翠守卫',     role: 'minion', mapId: 'jade_garden', line: LINE.HUNT, color: 0x44bb66, moveType: 'chaser' },
  { id: 'jg_m2', name: '生命之花妖',   role: 'minion', mapId: 'jade_garden', line: LINE.HUNT, color: 0xee88bb, moveType: 'patrol' },
  { id: 'jg_m3', name: '治愈守护灵',   role: 'minion', mapId: 'jade_garden', line: LINE.HUNT, color: 0x88ddaa, moveType: 'patrol' },
  { id: 'jg_e1', name: '德鲁伊长老',   role: 'elite',  mapId: 'jade_garden', line: LINE.HUNT, color: 0x338855, moveType: 'patrol' },
  { id: 'jg_e2', name: '翡翠龙兽',     role: 'elite',  mapId: 'jade_garden', line: LINE.HUNT, color: 0x22aa55, moveType: 'chaser' },
  { id: 'jg_b1', name: '翡翠之母·维拉', role: 'boss',  mapId: 'jade_garden', line: LINE.HUNT, color: 0x33dd77, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🌿 苍翠穹顶 verdant_dome
// ─────────────────────────────────────────────
export const VERDANT_DOME_MONSTERS = [
  { id: 'vd_m1', name: '苍翠树精',     role: 'minion', mapId: 'verdant_dome', line: LINE.HUNT, color: 0x448844, moveType: 'patrol' },
  { id: 'vd_m2', name: '穹顶之眼',     role: 'minion', mapId: 'verdant_dome', line: LINE.HUNT, color: 0x99bb66, moveType: 'shooter' },
  { id: 'vd_m3', name: '自然之灵',     role: 'minion', mapId: 'verdant_dome', line: LINE.HUNT, color: 0x77cc88, moveType: 'patrol' },
  { id: 'vd_e1', name: '远古守护者',   role: 'elite',  mapId: 'verdant_dome', line: LINE.HUNT, color: 0x336633, moveType: 'chaser' },
  { id: 'vd_e2', name: '苍翠幼龙',     role: 'elite',  mapId: 'verdant_dome', line: LINE.HUNT, color: 0x55aa55, moveType: 'chaser' },
  { id: 'vd_b1', name: '苍翠之魂·奥姆', role: 'boss',  mapId: 'verdant_dome', line: LINE.HUNT, color: 0x44cc44, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🔮 禁书藏馆 forbidden_lib
// ─────────────────────────────────────────────
export const FORBIDDEN_LIB_MONSTERS = [
  { id: 'fl_m1', name: '活化书页',     role: 'minion', mapId: 'forbidden_lib', line: LINE.ARCANE, color: 0xccbb88, moveType: 'patrol' },
  { id: 'fl_m2', name: '咒文守卫',     role: 'minion', mapId: 'forbidden_lib', line: LINE.ARCANE, color: 0x8877aa, moveType: 'chaser' },
  { id: 'fl_m3', name: '魔法飞弹构造体', role: 'minion', mapId: 'forbidden_lib', line: LINE.ARCANE, color: 0xaa88cc, moveType: 'shooter' },
  { id: 'fl_e1', name: '禁忌学者',     role: 'elite',  mapId: 'forbidden_lib', line: LINE.ARCANE, color: 0x7755aa, moveType: 'shooter' },
  { id: 'fl_e2', name: '咒术师',       role: 'elite',  mapId: 'forbidden_lib', line: LINE.ARCANE, color: 0x9966cc, moveType: 'shooter' },
  { id: 'fl_b1', name: '大图书馆长·莫比乌斯', role: 'boss', mapId: 'forbidden_lib', line: LINE.ARCANE, color: 0xbb99dd, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🔮 奥术高塔 arcane_tower
// ─────────────────────────────────────────────
export const ARCANE_TOWER_MONSTERS = [
  { id: 'at_m1', name: '奥术学徒',     role: 'minion', mapId: 'arcane_tower', line: LINE.ARCANE, color: 0x7766bb, moveType: 'shooter' },
  { id: 'at_m2', name: '魔力浮龙',     role: 'minion', mapId: 'arcane_tower', line: LINE.ARCANE, color: 0x9988dd, moveType: 'patrol' },
  { id: 'at_m3', name: '元素侍从',     role: 'minion', mapId: 'arcane_tower', line: LINE.ARCANE, color: 0xaa77cc, moveType: 'chaser' },
  { id: 'at_e1', name: '高阶法师',     role: 'elite',  mapId: 'arcane_tower', line: LINE.ARCANE, color: 0x6655aa, moveType: 'shooter' },
  { id: 'at_e2', name: '奥术构造体',   role: 'elite',  mapId: 'arcane_tower', line: LINE.ARCANE, color: 0x8877cc, moveType: 'chaser' },
  { id: 'at_b1', name: '大法师·萨洛蒙', role: 'boss',  mapId: 'arcane_tower', line: LINE.ARCANE, color: 0x9966ff, moveType: 'shooter' },
];

// ─────────────────────────────────────────────
//  🔮 虚空回廊 void_corridor
// ─────────────────────────────────────────────
export const VOID_CORRIDOR_MONSTERS = [
  { id: 'vc_m1', name: '虚空行者',     role: 'minion', mapId: 'void_corridor', line: LINE.ARCANE, color: 0x553388, moveType: 'chaser' },
  { id: 'vc_m2', name: '暗影魔',       role: 'minion', mapId: 'void_corridor', line: LINE.ARCANE, color: 0x442266, moveType: 'chaser' },
  { id: 'vc_m3', name: '召唤传送门',   role: 'minion', mapId: 'void_corridor', line: LINE.ARCANE, color: 0x7744aa, moveType: 'static' },
  { id: 'vc_e1', name: '虚空吞噬者',   role: 'elite',  mapId: 'void_corridor', line: LINE.ARCANE, color: 0x663399, moveType: 'chaser' },
  { id: 'vc_e2', name: '暗影祭司',     role: 'elite',  mapId: 'void_corridor', line: LINE.ARCANE, color: 0x774488, moveType: 'shooter' },
  { id: 'vc_b1', name: '虚空领主·扎拉斯', role: 'boss', mapId: 'void_corridor', line: LINE.ARCANE, color: 0x8833cc, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🔮 魔力源泉 mana_spring
// ─────────────────────────────────────────────
export const MANA_SPRING_MONSTERS = [
  { id: 'ms_m1', name: '魔力水元素',   role: 'minion', mapId: 'mana_spring', line: LINE.ARCANE, color: 0x4488cc, moveType: 'patrol' },
  { id: 'ms_m2', name: '法力浮灵',     role: 'minion', mapId: 'mana_spring', line: LINE.ARCANE, color: 0x66aadd, moveType: 'patrol' },
  { id: 'ms_m3', name: '源泉守卫',     role: 'minion', mapId: 'mana_spring', line: LINE.ARCANE, color: 0x5599bb, moveType: 'chaser' },
  { id: 'ms_e1', name: '魔力喷涌者',   role: 'elite',  mapId: 'mana_spring', line: LINE.ARCANE, color: 0x3377bb, moveType: 'shooter' },
  { id: 'ms_e2', name: '源泉守护者',   role: 'elite',  mapId: 'mana_spring', line: LINE.ARCANE, color: 0x4499cc, moveType: 'chaser' },
  { id: 'ms_b1', name: '魔力之泉·安努', role: 'boss',  mapId: 'mana_spring', line: LINE.ARCANE, color: 0x55bbee, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🔮 元素王座 elem_throne
// ─────────────────────────────────────────────
export const ELEM_THRONE_MONSTERS = [
  { id: 'et_m1', name: '火元素',       role: 'minion', mapId: 'elem_throne', line: LINE.ARCANE, color: 0xff6633, moveType: 'chaser' },
  { id: 'et_m2', name: '冰霜幼龙',     role: 'minion', mapId: 'elem_throne', line: LINE.ARCANE, color: 0x66ccff, moveType: 'patrol' },
  { id: 'et_m3', name: '雷击者',       role: 'minion', mapId: 'elem_throne', line: LINE.ARCANE, color: 0xffee44, moveType: 'shooter' },
  { id: 'et_e1', name: '元素大使',     role: 'elite',  mapId: 'elem_throne', line: LINE.ARCANE, color: 0xee8833, moveType: 'chaser' },
  { id: 'et_e2', name: '混沌元素',     role: 'elite',  mapId: 'elem_throne', line: LINE.ARCANE, color: 0xcc44ff, moveType: 'chaser' },
  { id: 'et_b1', name: '四相元素聚合体', role: 'boss', mapId: 'elem_throne', line: LINE.ARCANE, color: 0xff8844, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🔮 时空裂境 time_rift
// ─────────────────────────────────────────────
export const TIME_RIFT_MONSTERS = [
  { id: 'tr_m1', name: '时空扭曲体',   role: 'minion', mapId: 'time_rift', line: LINE.ARCANE, color: 0x8866cc, moveType: 'patrol' },
  { id: 'tr_m2', name: '时间窃贼',     role: 'minion', mapId: 'time_rift', line: LINE.ARCANE, color: 0xaa88dd, moveType: 'chaser' },
  { id: 'tr_m3', name: '空间裂隙兽',   role: 'minion', mapId: 'time_rift', line: LINE.ARCANE, color: 0x7755bb, moveType: 'chaser' },
  { id: 'tr_e1', name: '时间编织者',   role: 'elite',  mapId: 'time_rift', line: LINE.ARCANE, color: 0x9977ee, moveType: 'shooter' },
  { id: 'tr_e2', name: '空间切割者',   role: 'elite',  mapId: 'time_rift', line: LINE.ARCANE, color: 0x6644bb, moveType: 'chaser' },
  { id: 'tr_b1', name: '时空之主·柯罗诺斯', role: 'boss', mapId: 'time_rift', line: LINE.ARCANE, color: 0xbb88ff, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🔮 符文工坊 rune_forge
// ─────────────────────────────────────────────
export const RUNE_FORGE_MONSTERS = [
  { id: 'rf_m1', name: '符文傀儡',     role: 'minion', mapId: 'rune_forge', line: LINE.ARCANE, color: 0xbb8844, moveType: 'chaser' },
  { id: 'rf_m2', name: '附魔刀锋',     role: 'minion', mapId: 'rune_forge', line: LINE.ARCANE, color: 0xcc9955, moveType: 'chaser' },
  { id: 'rf_m3', name: '活化符文',     role: 'minion', mapId: 'rune_forge', line: LINE.ARCANE, color: 0xaa7733, moveType: 'patrol' },
  { id: 'rf_e1', name: '符文铁匠',     role: 'elite',  mapId: 'rune_forge', line: LINE.ARCANE, color: 0xdd9944, moveType: 'chaser' },
  { id: 'rf_e2', name: '符文守护者',   role: 'elite',  mapId: 'rune_forge', line: LINE.ARCANE, color: 0xcc8833, moveType: 'chaser' },
  { id: 'rf_b1', name: '大符文匠·托林', role: 'boss',  mapId: 'rune_forge', line: LINE.ARCANE, color: 0xeeaa55, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🔮 星辰穹殿 star_palace
// ─────────────────────────────────────────────
export const STAR_PALACE_MONSTERS = [
  { id: 'sp_m1', name: '星界使徒',     role: 'minion', mapId: 'star_palace', line: LINE.ARCANE, color: 0xaabb99, moveType: 'patrol' },
  { id: 'sp_m2', name: '星辰幻影',     role: 'minion', mapId: 'star_palace', line: LINE.ARCANE, color: 0xccddaa, moveType: 'patrol' },
  { id: 'sp_m3', name: '陨石碎片',     role: 'minion', mapId: 'star_palace', line: LINE.ARCANE, color: 0x887766, moveType: 'shooter' },
  { id: 'sp_e1', name: '星辰预言者',   role: 'elite',  mapId: 'star_palace', line: LINE.ARCANE, color: 0x99aacc, moveType: 'shooter' },
  { id: 'sp_e2', name: '穹顶守护者',   role: 'elite',  mapId: 'star_palace', line: LINE.ARCANE, color: 0xbbccdd, moveType: 'chaser' },
  { id: 'sp_b1', name: '星辰之主·阿斯特拉', role: 'boss', mapId: 'star_palace', line: LINE.ARCANE, color: 0xddeecc, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  ⚔️ 钢铁要塞 iron_fort
// ─────────────────────────────────────────────
export const IRON_FORT_MONSTERS = [
  { id: 'if_m1', name: '钢铁守卫',     role: 'minion', mapId: 'iron_fort', line: LINE.WAR, color: 0x888899, moveType: 'chaser' },
  { id: 'if_m2', name: '盾卫',         role: 'minion', mapId: 'iron_fort', line: LINE.WAR, color: 0x7777aa, moveType: 'chaser' },
  { id: 'if_m3', name: '弩炮手',       role: 'minion', mapId: 'iron_fort', line: LINE.WAR, color: 0xaa8877, moveType: 'shooter' },
  { id: 'if_e1', name: '铁壁骑士',     role: 'elite',  mapId: 'iron_fort', line: LINE.WAR, color: 0x6666aa, moveType: 'chaser' },
  { id: 'if_e2', name: '要塞指挥官',   role: 'elite',  mapId: 'iron_fort', line: LINE.WAR, color: 0x8888bb, moveType: 'chaser' },
  { id: 'if_b1', name: '钢铁领主·加雷特', role: 'boss', mapId: 'iron_fort', line: LINE.WAR, color: 0x9999cc, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 血染斗技场 blood_arena
// ─────────────────────────────────────────────
export const BLOOD_ARENA_MONSTERS = [
  { id: 'ba_m1', name: '角斗士',       role: 'minion', mapId: 'blood_arena', line: LINE.WAR, color: 0xcc4433, moveType: 'chaser' },
  { id: 'ba_m2', name: '血斗士',       role: 'minion', mapId: 'blood_arena', line: LINE.WAR, color: 0xdd5544, moveType: 'chaser' },
  { id: 'ba_m3', name: '狂战士',       role: 'minion', mapId: 'blood_arena', line: LINE.WAR, color: 0xee3322, moveType: 'chaser' },
  { id: 'ba_e1', name: '血腥屠夫',     role: 'elite',  mapId: 'blood_arena', line: LINE.WAR, color: 0xbb2211, moveType: 'chaser' },
  { id: 'ba_e2', name: '斗技场冠军',   role: 'elite',  mapId: 'blood_arena', line: LINE.WAR, color: 0xdd4433, moveType: 'chaser' },
  { id: 'ba_b1', name: '鲜血之王·卡修斯', role: 'boss', mapId: 'blood_arena', line: LINE.WAR, color: 0xff4444, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 雷霆崖壁 thunder_cliff
// ─────────────────────────────────────────────
export const THUNDER_CLIFF_MONSTERS = [
  { id: 'tc_m1', name: '雷霆蜥蜴',     role: 'minion', mapId: 'thunder_cliff', line: LINE.WAR, color: 0xddcc33, moveType: 'chaser' },
  { id: 'tc_m2', name: '震地者',       role: 'minion', mapId: 'thunder_cliff', line: LINE.WAR, color: 0xbbaa44, moveType: 'chaser' },
  { id: 'tc_m3', name: '风暴之鹰',     role: 'minion', mapId: 'thunder_cliff', line: LINE.WAR, color: 0xeedd55, moveType: 'patrol' },
  { id: 'tc_e1', name: '雷霆使者',     role: 'elite',  mapId: 'thunder_cliff', line: LINE.WAR, color: 0xffee44, moveType: 'chaser' },
  { id: 'tc_e2', name: '崖壁萨满',     role: 'elite',  mapId: 'thunder_cliff', line: LINE.WAR, color: 0xccbb33, moveType: 'shooter' },
  { id: 'tc_b1', name: '雷霆之王·索尔', role: 'boss',  mapId: 'thunder_cliff', line: LINE.WAR, color: 0xffff44, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 巨龙墓地 dragon_grave
// ─────────────────────────────────────────────
export const DRAGON_GRAVE_MONSTERS = [
  { id: 'dg_m1', name: '骨龙幼体',     role: 'minion', mapId: 'dragon_grave', line: LINE.WAR, color: 0xbbaa88, moveType: 'chaser' },
  { id: 'dg_m2', name: '龙人守卫',     role: 'minion', mapId: 'dragon_grave', line: LINE.WAR, color: 0x998877, moveType: 'chaser' },
  { id: 'dg_m3', name: '墓穴蠕虫',     role: 'minion', mapId: 'dragon_grave', line: LINE.WAR, color: 0x776655, moveType: 'patrol' },
  { id: 'dg_e1', name: '龙魂骑士',     role: 'elite',  mapId: 'dragon_grave', line: LINE.WAR, color: 0xaa8866, moveType: 'chaser' },
  { id: 'dg_e2', name: '墓穴巨龙',     role: 'elite',  mapId: 'dragon_grave', line: LINE.WAR, color: 0xccaa77, moveType: 'chaser' },
  { id: 'dg_b1', name: '太古龙魂·奈萨里奥', role: 'boss', mapId: 'dragon_grave', line: LINE.WAR, color: 0xddbb88, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 烈风峡谷 gale_canyon
// ─────────────────────────────────────────────
export const GALE_CANYON_MONSTERS = [
  { id: 'gc_m1', name: '烈风掠夺者',   role: 'minion', mapId: 'gale_canyon', line: LINE.WAR, color: 0xaacc88, moveType: 'chaser' },
  { id: 'gc_m2', name: '峡谷风蛇',     role: 'minion', mapId: 'gale_canyon', line: LINE.WAR, color: 0x88aa66, moveType: 'patrol' },
  { id: 'gc_m3', name: '冲锋骑兵',     role: 'minion', mapId: 'gale_canyon', line: LINE.WAR, color: 0xcc9966, moveType: 'chaser' },
  { id: 'gc_e1', name: '风骑士',       role: 'elite',  mapId: 'gale_canyon', line: LINE.WAR, color: 0x77bb55, moveType: 'chaser' },
  { id: 'gc_e2', name: '峡谷领主',     role: 'elite',  mapId: 'gale_canyon', line: LINE.WAR, color: 0x99cc77, moveType: 'chaser' },
  { id: 'gc_b1', name: '烈风之主·阿拉斯特', role: 'boss', mapId: 'gale_canyon', line: LINE.WAR, color: 0xbbee88, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 战神祭坛 war_altar
// ─────────────────────────────────────────────
export const WAR_ALTAR_MONSTERS = [
  { id: 'wa_m1', name: '战神圣像',     role: 'minion', mapId: 'war_altar', line: LINE.WAR, color: 0xcc8833, moveType: 'static' },
  { id: 'wa_m2', name: '狂热信徒',     role: 'minion', mapId: 'war_altar', line: LINE.WAR, color: 0xdd6644, moveType: 'chaser' },
  { id: 'wa_m3', name: '战争使者',     role: 'minion', mapId: 'war_altar', line: LINE.WAR, color: 0xee7755, moveType: 'chaser' },
  { id: 'wa_e1', name: '战神祭祀',     role: 'elite',  mapId: 'war_altar', line: LINE.WAR, color: 0xcc5533, moveType: 'shooter' },
  { id: 'wa_e2', name: '狂信者',       role: 'elite',  mapId: 'war_altar', line: LINE.WAR, color: 0xdd7744, moveType: 'chaser' },
  { id: 'wa_b1', name: '战神化身·马尔斯', role: 'boss', mapId: 'war_altar', line: LINE.WAR, color: 0xff8855, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 不朽王陵 immortal_tomb
// ─────────────────────────────────────────────
export const IMMORTAL_TOMB_MONSTERS = [
  { id: 'it_m1', name: '骷髅战士',     role: 'minion', mapId: 'immortal_tomb', line: LINE.WAR, color: 0xaaaa88, moveType: 'chaser' },
  { id: 'it_m2', name: '幽灵',         role: 'minion', mapId: 'immortal_tomb', line: LINE.WAR, color: 0x99bbcc, moveType: 'patrol' },
  { id: 'it_m3', name: '尸妖',         role: 'minion', mapId: 'immortal_tomb', line: LINE.WAR, color: 0x667755, moveType: 'chaser' },
  { id: 'it_e1', name: '死亡骑士',     role: 'elite',  mapId: 'immortal_tomb', line: LINE.WAR, color: 0x555577, moveType: 'chaser' },
  { id: 'it_e2', name: '不朽守卫',     role: 'elite',  mapId: 'immortal_tomb', line: LINE.WAR, color: 0x777799, moveType: 'chaser' },
  { id: 'it_b1', name: '不朽之王·莱因哈特', role: 'boss', mapId: 'immortal_tomb', line: LINE.WAR, color: 0x8888aa, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  ⚔️ 荣光殿堂 glory_hall
// ─────────────────────────────────────────────
export const GLORY_HALL_MONSTERS = [
  { id: 'gh_m1', name: '英灵战士',     role: 'minion', mapId: 'glory_hall', line: LINE.WAR, color: 0xddcc88, moveType: 'chaser' },
  { id: 'gh_m2', name: '荣耀守卫',     role: 'minion', mapId: 'glory_hall', line: LINE.WAR, color: 0xccbb77, moveType: 'chaser' },
  { id: 'gh_m3', name: '瓦尔基里',     role: 'minion', mapId: 'glory_hall', line: LINE.WAR, color: 0xeedd99, moveType: 'patrol' },
  { id: 'gh_e1', name: '英灵英雄',     role: 'elite',  mapId: 'glory_hall', line: LINE.WAR, color: 0xddbb66, moveType: 'chaser' },
  { id: 'gh_e2', name: '殿堂守护者',   role: 'elite',  mapId: 'glory_hall', line: LINE.WAR, color: 0xeecc77, moveType: 'chaser' },
  { id: 'gh_b1', name: '英灵王·奥丁森', role: 'boss',  mapId: 'glory_hall', line: LINE.WAR, color: 0xffdd88, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🕯️ 命运十字 start_room (特殊)
// ─────────────────────────────────────────────
export const START_ROOM_MONSTERS = [
  // 命运十字无常规小怪
  { id: 'sr_e1', name: '命运之轮守护者', role: 'elite', mapId: 'start_room', line: NEUTRAL, color: 0xddddaa, moveType: 'patrol' },
  // 无 Boss（或隐藏命运试炼）
];

// ─────────────────────────────────────────────
//  🕯️ 试炼之地 tutorial_level (教程)
// ─────────────────────────────────────────────
export const TUTORIAL_LEVEL_MONSTERS = [
  { id: 'tl_m1', name: '试炼傀儡',     role: 'minion', mapId: 'tutorial_level', line: NEUTRAL, color: 0x88aacc, moveType: 'chaser' },
  { id: 'tl_m2', name: '训练靶标',     role: 'minion', mapId: 'tutorial_level', line: NEUTRAL, color: 0x99bbdd, moveType: 'static' },
  { id: 'tl_m3', name: '沙袋幼灵',     role: 'minion', mapId: 'tutorial_level', line: NEUTRAL, color: 0x77aacc, moveType: 'patrol' },
  { id: 'tl_e1', name: '试炼教官',     role: 'elite',  mapId: 'tutorial_level', line: NEUTRAL, color: 0x5599cc, moveType: 'chaser' },
  { id: 'tl_e2', name: '石守卫',       role: 'elite',  mapId: 'tutorial_level', line: NEUTRAL, color: 0x6688bb, moveType: 'patrol' },
  { id: 'tl_b1', name: '教程目标',     role: 'boss',   mapId: 'tutorial_level', line: NEUTRAL, color: 0x66ccff, moveType: 'static' },
];

// ─────────────────────────────────────────────
//  🕯️ 遗忘之墟 forgotten_ruins
// ─────────────────────────────────────────────
export const FORGOTTEN_RUINS_MONSTERS = [
  { id: 'fr_m1', name: '遗忘者',       role: 'minion', mapId: 'forgotten_ruins', line: NEUTRAL, color: 0x999988, moveType: 'patrol' },
  { id: 'fr_m2', name: '废墟爬行者',   role: 'minion', mapId: 'forgotten_ruins', line: NEUTRAL, color: 0x887766, moveType: 'chaser' },
  { id: 'fr_m3', name: '时间残渣',     role: 'minion', mapId: 'forgotten_ruins', line: NEUTRAL, color: 0xaa9977, moveType: 'patrol' },
  { id: 'fr_e1', name: '遗忘守卫',     role: 'elite',  mapId: 'forgotten_ruins', line: NEUTRAL, color: 0x777766, moveType: 'chaser' },
  { id: 'fr_e2', name: '时空残响',     role: 'elite',  mapId: 'forgotten_ruins', line: NEUTRAL, color: 0x998877, moveType: 'patrol' },
  { id: 'fr_b1', name: '遗忘之王·摩洛克', role: 'boss', mapId: 'forgotten_ruins', line: NEUTRAL, color: 0xbbaa88, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🕯️ 幻象迷宫 illusion_maze
// ─────────────────────────────────────────────
export const ILLUSION_MAZE_MONSTERS = [
  { id: 'im_m1', name: '幻象复制体',   role: 'minion', mapId: 'illusion_maze', line: NEUTRAL, color: 0xaaaacc, moveType: 'patrol' },
  { id: 'im_m2', name: '迷宫守卫',     role: 'minion', mapId: 'illusion_maze', line: NEUTRAL, color: 0x8888aa, moveType: 'chaser' },
  { id: 'im_m3', name: '幻影猎手',     role: 'minion', mapId: 'illusion_maze', line: NEUTRAL, color: 0x9999bb, moveType: 'chaser' },
  { id: 'im_e1', name: '幻象编织者',   role: 'elite',  mapId: 'illusion_maze', line: NEUTRAL, color: 0x7777aa, moveType: 'shooter' },
  { id: 'im_e2', name: '迷宫牛头怪',   role: 'elite',  mapId: 'illusion_maze', line: NEUTRAL, color: 0xaa8866, moveType: 'chaser' },
  { id: 'im_b1', name: '迷宫之主·米诺陶斯', role: 'boss', mapId: 'illusion_maze', line: NEUTRAL, color: 0xccbbaa, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🕯️ 时空枢纽 time_nexus
// ─────────────────────────────────────────────
export const TIME_NEXUS_MONSTERS = [
  { id: 'tn_m1', name: '时空守卫',     role: 'minion', mapId: 'time_nexus', line: NEUTRAL, color: 0x8877bb, moveType: 'chaser' },
  { id: 'tn_m2', name: '时间执法者',   role: 'minion', mapId: 'time_nexus', line: NEUTRAL, color: 0x9988cc, moveType: 'chaser' },
  { id: 'tn_m3', name: '空间监察者',   role: 'minion', mapId: 'time_nexus', line: NEUTRAL, color: 0xaa99dd, moveType: 'patrol' },
  { id: 'tn_e1', name: '时空撕裂者',   role: 'elite',  mapId: 'time_nexus', line: NEUTRAL, color: 0x7766aa, moveType: 'chaser' },
  { id: 'tn_e2', name: '枢纽守护者',   role: 'elite',  mapId: 'time_nexus', line: NEUTRAL, color: 0x9988bb, moveType: 'chaser' },
  { id: 'tn_b1', name: '时空之主·克罗米', role: 'boss', mapId: 'time_nexus', line: NEUTRAL, color: 0xbb99ee, moveType: 'patrol' },
];

// ─────────────────────────────────────────────
//  🕯️ 混沌前厅 chaos_anteroom
// ─────────────────────────────────────────────
export const CHAOS_ANTEROOM_MONSTERS = [
  { id: 'ca_m1', name: '混沌仆从',     role: 'minion', mapId: 'chaos_anteroom', line: NEUTRAL, color: 0x664455, moveType: 'chaser' },
  { id: 'ca_m2', name: '虚空爪牙',     role: 'minion', mapId: 'chaos_anteroom', line: NEUTRAL, color: 0x553366, moveType: 'chaser' },
  { id: 'ca_m3', name: '前厅守卫',     role: 'minion', mapId: 'chaos_anteroom', line: NEUTRAL, color: 0x775566, moveType: 'chaser' },
  { id: 'ca_e1', name: '混沌祭司',     role: 'elite',  mapId: 'chaos_anteroom', line: NEUTRAL, color: 0x884466, moveType: 'shooter' },
  { id: 'ca_e2', name: '前厅执政官',   role: 'elite',  mapId: 'chaos_anteroom', line: NEUTRAL, color: 0x995577, moveType: 'chaser' },
  { id: 'ca_b1', name: '混沌守卫·卡奥斯', role: 'boss', mapId: 'chaos_anteroom', line: NEUTRAL, color: 0xaa6688, moveType: 'chaser' },
];

// ─────────────────────────────────────────────
//  🕯️ 混沌王座 chaos_throne
// ─────────────────────────────────────────────
export const CHAOS_THRONE_MONSTERS = [
  { id: 'ct_m1', name: '混沌魔物',     role: 'minion', mapId: 'chaos_throne', line: NEUTRAL, color: 0x442233, moveType: 'chaser' },
  { id: 'ct_m2', name: '暗影巨兽',     role: 'minion', mapId: 'chaos_throne', line: NEUTRAL, color: 0x553344, moveType: 'chaser' },
  { id: 'ct_m3', name: '王座之眼',     role: 'minion', mapId: 'chaos_throne', line: NEUTRAL, color: 0x774455, moveType: 'shooter' },
  { id: 'ct_e1', name: '混沌领主',     role: 'elite',  mapId: 'chaos_throne', line: NEUTRAL, color: 0x663355, moveType: 'chaser' },
  { id: 'ct_e2', name: '深渊骑士',     role: 'elite',  mapId: 'chaos_throne', line: NEUTRAL, color: 0x884466, moveType: 'chaser' },
  { id: 'ct_b1', name: '混沌之神·厄瑞波斯', role: 'boss', mapId: 'chaos_throne', line: NEUTRAL, color: 0x993366, moveType: 'chaser' },
];

// ════════════════════════════════════════════
//  汇总所有怪物
// ════════════════════════════════════════════

export const ALL_MONSTERS = [
  ...DAWN_WOODLAND_MONSTERS,
  ...WIND_FOREST_MONSTERS,
  ...GLOOM_SWAMP_MONSTERS,
  ...BEAST_LAIR_MONSTERS,
  ...THORN_MAZE_MONSTERS,
  ...MOONLAKE_MONSTERS,
  ...JADE_GARDEN_MONSTERS,
  ...VERDANT_DOME_MONSTERS,
  ...FORBIDDEN_LIB_MONSTERS,
  ...ARCANE_TOWER_MONSTERS,
  ...VOID_CORRIDOR_MONSTERS,
  ...MANA_SPRING_MONSTERS,
  ...ELEM_THRONE_MONSTERS,
  ...TIME_RIFT_MONSTERS,
  ...RUNE_FORGE_MONSTERS,
  ...STAR_PALACE_MONSTERS,
  ...IRON_FORT_MONSTERS,
  ...BLOOD_ARENA_MONSTERS,
  ...THUNDER_CLIFF_MONSTERS,
  ...DRAGON_GRAVE_MONSTERS,
  ...GALE_CANYON_MONSTERS,
  ...WAR_ALTAR_MONSTERS,
  ...IMMORTAL_TOMB_MONSTERS,
  ...GLORY_HALL_MONSTERS,
  ...START_ROOM_MONSTERS,
  ...TUTORIAL_LEVEL_MONSTERS,
  ...FORGOTTEN_RUINS_MONSTERS,
  ...ILLUSION_MAZE_MONSTERS,
  ...TIME_NEXUS_MONSTERS,
  ...CHAOS_ANTEROOM_MONSTERS,
  ...CHAOS_THRONE_MONSTERS,
];

// ════════════════════════════════════════════
//  索引 & 查询
// ════════════════════════════════════════════

const _monsterIndex = {};
ALL_MONSTERS.forEach(m => { _monsterIndex[m.id] = m; });

/** 通过 ID 获取怪物定义 */
export function getMonsterById(id) {
  return _monsterIndex[id] || null;
}

/** 获取某张地图的所有怪物定义 */
export function getMonstersByMap(mapId) {
  return ALL_MONSTERS.filter(m => m.mapId === mapId);
}

/** 获取某张地图指定角色的怪物 */
export function getMonstersByMapAndRole(mapId, role) {
  return ALL_MONSTERS.filter(m => m.mapId === mapId && m.role === role);
}

/** 获取某张地图的 Boss */
export function getMapBoss(mapId) {
  return ALL_MONSTERS.find(m => m.mapId === mapId && m.role === 'boss') || null;
}

/** 获取某张地图的小怪列表 */
export function getMapMinions(mapId) {
  return ALL_MONSTERS.filter(m => m.mapId === mapId && m.role === 'minion');
}

/** 获取某张地图的精英列表 */
export function getMapElites(mapId) {
  return ALL_MONSTERS.filter(m => m.mapId === mapId && m.role === 'elite');
}

/**
 * 根据层级计算怪物属性缩放系数
 * @param {number} layer 当前层级 1-10
 * @returns {{ hpMult: number, damageMult: number, countMult: number }}
 */
export function getLayerScaling(layer) {
  const l = Math.max(1, Math.min(10, layer));
  return {
    hpMult:     1 + (l - 1) * 0.18,
    damageMult: 1 + (l - 1) * 0.12,
    countMult:  1 + (l - 1) * 0.08,
  };
}

/**
 * 获取怪物的显示尺寸（基于角色）
 * @param {string} role 'minion' | 'elite' | 'boss'
 * @returns {number}
 */
export function getRoleSize(role) {
  return ROLE_SIZE[role] || ROLE_SIZE.minion;
}

/**
 * 获取怪物的基础 HP（基于角色，测试用低数值）
 * @param {string} role 'minion' | 'elite' | 'boss'
 * @returns {number}
 */
export function getRoleHp(role) {
  return ROLE_HP[role] || ROLE_HP.minion;
}
