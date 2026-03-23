const LOOT_RARITY_DEFS = {
  common: {
    id: 'common',
    label: '普通',
    color: 0xf4f7fb,
    textColor: '#f4f7fb',
    borderColor: 0xd8dee8,
    bgColor: 0x5e6672,
    beamColor: 0xe5edf8,
    auraColor: 0xcfd6df,
    sortOrder: 0,
    scale: 1,
    chestTitle: '白银战匣'
  },
  rare: {
    id: 'rare',
    label: '稀有',
    color: 0x3aa0ff,
    textColor: '#3aa0ff',
    borderColor: 0x85c8ff,
    bgColor: 0x15304f,
    beamColor: 0x7fd2ff,
    auraColor: 0x246cb8,
    sortOrder: 1,
    scale: 1.22,
    chestTitle: '碧潮秘匣'
  },
  epic: {
    id: 'epic',
    label: '史诗',
    color: 0xb56cff,
    textColor: '#b56cff',
    borderColor: 0xd3a8ff,
    bgColor: 0x34124d,
    beamColor: 0xe1b8ff,
    auraColor: 0x7a2bb8,
    sortOrder: 2,
    scale: 1.52,
    chestTitle: '夜辉珍匣'
  },
  legendary: {
    id: 'legendary',
    label: '传说',
    color: 0xff9f2e,
    textColor: '#ff9f2e',
    borderColor: 0xffcf8a,
    bgColor: 0x5a2300,
    beamColor: 0xffd26e,
    auraColor: 0xff7b00,
    sortOrder: 3,
    scale: 1.9,
    chestTitle: '焰金圣匣'
  }
};

const LOOT_SOURCE_PROFILES = {
  minion: {
    id: 'minion',
    label: '小怪',
    dropChance: 0.08,
    minCount: 1,
    maxCount: 1,
    rarityWeights: [
      { id: 'common', weight: 80 },
      { id: 'rare', weight: 18 },
      { id: 'epic', weight: 2 }
    ]
  },
  elite: {
    id: 'elite',
    label: '精英',
    dropChance: 0.34,
    minCount: 1,
    maxCount: 2,
    rarityWeights: [
      { id: 'common', weight: 12 },
      { id: 'rare', weight: 52 },
      { id: 'epic', weight: 30 },
      { id: 'legendary', weight: 6 }
    ]
  },
  boss: {
    id: 'boss',
    label: 'Boss',
    dropChance: 1,
    minCount: 2,
    maxCount: 3,
    rarityWeights: [
      { id: 'rare', weight: 14 },
      { id: 'epic', weight: 48 },
      { id: 'legendary', weight: 38 }
    ]
  }
};

const LOOT_QUALITY_ALIASES = {
  common: { qualityId: 'white', qualityLabel: '白', qualityName: '普通' },
  rare: { qualityId: 'blue', qualityLabel: '蓝', qualityName: '精良' },
  epic: { qualityId: 'purple', qualityLabel: '紫', qualityName: '史诗' },
  legendary: { qualityId: 'orange', qualityLabel: '橙', qualityName: '传说' }
};

const LOOT_EQUIPMENT_TEMPLATES = [
  { id: 'blade_mark', name: '刃之印', icon: '✦', category: 'damage', categoryLabel: '攻击', sortOrder: 1, effects: { damageMult: 1.08 } },
  { id: 'swift_feather', name: '疾风羽', icon: '≫', category: 'fire_rate', categoryLabel: '攻速', sortOrder: 2, effects: { fireRateMult: 0.94 } },
  { id: 'wind_step', name: '追风靴', icon: '➜', category: 'move_speed', categoryLabel: '移速', sortOrder: 3, effects: { speedMult: 1.08 } },
  { id: 'far_sight', name: '千里瞳', icon: '◎', category: 'range', categoryLabel: '范围', sortOrder: 4, effects: { rangeMult: 1.08 } },
  { id: 'vital_core', name: '生机核', icon: '◉', category: 'max_hp', categoryLabel: '生命', sortOrder: 5, effects: { maxHpFlat: 18 } },
  { id: 'iron_wall', name: '铁壁甲', icon: '◈', category: 'damage_reduction', categoryLabel: '减伤', sortOrder: 6, effects: { damageReductionPercent: 0.05 } },
  { id: 'spring_leaf', name: '回春叶', icon: '✚', category: 'regen', categoryLabel: '回复', sortOrder: 7, effects: { regenPerSec: 0.6 } },
  { id: 'eagle_eye', name: '鹰眼石', icon: '✴', category: 'crit_chance', categoryLabel: '暴击', sortOrder: 8, effects: { critChance: 0.02 } },
  { id: 'shadow_step', name: '影步符', icon: '◌', category: 'dodge', categoryLabel: '闪避', sortOrder: 9, effects: { dodgeChance: 0.03 } },
  { id: 'rage_edge', name: '狂锋纹', icon: '✹', category: 'crit_damage', categoryLabel: '暴伤', sortOrder: 10, effects: { critMultiplier: 0.22 } }
];

const VENDOR_CURSE_TEMPLATES = [
  {
    id: 'bloodthorn_idol',
    name: '血棘邪像',
    icon: '🜂',
    category: 'vendor_curse',
    categoryLabel: '诅咒圣物',
    sortOrder: 110,
    effects: { damageMult: 1.18, damageReductionPercent: -0.08 },
    price: 340,
    summary: '攻击猛涨，但身板更薄。'
  },
  {
    id: 'reverse_hourglass',
    name: '逆时沙漏',
    icon: '⌛',
    category: 'vendor_curse',
    categoryLabel: '诅咒圣物',
    sortOrder: 111,
    effects: { fireRateMult: 0.82, maxHpFlat: -26 },
    price: 360,
    summary: '攻速暴涨，但生命被抽空。'
  },
  {
    id: 'hunters_gamble',
    name: '逐猎赌契',
    icon: '🜁',
    category: 'vendor_curse',
    categoryLabel: '诅咒圣物',
    sortOrder: 112,
    effects: { critChance: 0.10, speedMult: 0.90 },
    price: 320,
    summary: '暴击更狠，但移动变钝。'
  },
  {
    id: 'ashen_chalice',
    name: '烬心圣杯',
    icon: '☗',
    category: 'vendor_curse',
    categoryLabel: '诅咒圣物',
    sortOrder: 113,
    effects: { lifestealPercent: 0.10, fireRateMult: 1.12 },
    price: 330,
    summary: '吸血更强，但出手更慢。'
  },
  {
    id: 'glass_comet',
    name: '琉璃彗芯',
    icon: '✺',
    category: 'vendor_curse',
    categoryLabel: '诅咒圣物',
    sortOrder: 114,
    effects: { rangeMult: 1.20, maxHpFlat: -18, dodgeChance: -0.04 },
    price: 350,
    summary: '射程拉满，但容错下降。'
  }
];

function clampPositive(value, fallback = 0) {
  const resolved = Number(value);
  return Number.isFinite(resolved) ? Math.max(0, resolved) : fallback;
}

function clampWeightEntries(entries = []) {
  return entries
    .filter((entry) => entry && LOOT_RARITY_DEFS[entry.id])
    .map((entry) => ({ id: entry.id, weight: clampPositive(entry.weight, 0) }))
    .filter((entry) => entry.weight > 0);
}

function pickWeighted(entries, rng = Math.random) {
  const list = clampWeightEntries(entries);
  if (list.length <= 0) return null;

  const total = list.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = clampPositive(rng(), 0) * total;
  for (let i = 0; i < list.length; i += 1) {
    roll -= list[i].weight;
    if (roll <= 0) return list[i].id;
  }

  return list[list.length - 1].id;
}

function scaleMultiplier(baseValue, scale, invert = false) {
  const bonus = invert ? (1 - baseValue) : (baseValue - 1);
  if (!Number.isFinite(bonus) || Math.abs(bonus) < 0.00001) return baseValue;
  return invert ? (1 - bonus * scale) : (1 + bonus * scale);
}

function scaleFlat(baseValue, scale, digits = 3) {
  const factor = Math.pow(10, digits);
  return Math.round(baseValue * scale * factor) / factor;
}

function scaleEffectValue(key, value, scale) {
  if (!Number.isFinite(Number(value))) return value;
  const numeric = Number(value);
  switch (key) {
    case 'damageMult':
    case 'speedMult':
    case 'rangeMult':
      return scaleMultiplier(numeric, scale, false);
    case 'fireRateMult':
      return Math.max(0.55, scaleMultiplier(numeric, scale, true));
    case 'maxHpFlat':
      return Math.round(numeric * scale);
    case 'critChance':
    case 'critMultiplier':
    case 'dodgeChance':
    case 'damageReductionPercent':
    case 'regenPerSec':
      return scaleFlat(numeric, scale, 3);
    default:
      return numeric;
  }
}

function scaleEffects(baseEffects = {}, scale = 1) {
  const next = {};
  Object.entries(baseEffects || {}).forEach(([key, value]) => {
    next[key] = scaleEffectValue(key, value, scale);
  });
  return next;
}

function formatPercentValue(value, digits = 0) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

export function getLootRarity(id) {
  return LOOT_RARITY_DEFS[id] || LOOT_RARITY_DEFS.common;
}

export function getLootSourceProfile(source) {
  return LOOT_SOURCE_PROFILES[source] || LOOT_SOURCE_PROFILES.minion;
}

export function getLootTemplates() {
  return [...LOOT_EQUIPMENT_TEMPLATES];
}

export function formatLootEffectLines(effects = {}) {
  const lines = [];
  const pushSignedPercent = (label, value, digits = 0) => {
    const numeric = Number(value || 0);
    if (!numeric) return;
    const sign = numeric > 0 ? '+' : '-';
    lines.push(`${label} ${sign}${formatPercentValue(Math.abs(numeric), digits)}`);
  };
  const pushSignedFlat = (label, value, digits = 0) => {
    const numeric = Number(value || 0);
    if (!numeric) return;
    const sign = numeric > 0 ? '+' : '-';
    const abs = Math.abs(numeric);
    lines.push(`${label} ${sign}${digits > 0 ? abs.toFixed(digits) : Math.round(abs)}`);
  };

  if (effects.damageMult && effects.damageMult !== 1) pushSignedPercent('攻击力', effects.damageMult - 1);
  if (effects.maxHpFlat) pushSignedFlat('生命上限', effects.maxHpFlat);
  if (effects.fireRateMult && effects.fireRateMult !== 1) pushSignedPercent('攻击速度', (1 / effects.fireRateMult) - 1);
  if (effects.speedMult && effects.speedMult !== 1) pushSignedPercent('移动速度', effects.speedMult - 1);
  if (effects.rangeMult && effects.rangeMult !== 1) pushSignedPercent('攻击范围', effects.rangeMult - 1);
  if (effects.critChance) pushSignedPercent('暴击率', effects.critChance);
  if (effects.critMultiplier) pushSignedPercent('暴击伤害', effects.critMultiplier);
  if (effects.regenPerSec) pushSignedFlat('每秒回复', effects.regenPerSec, 1);
  if (effects.damageReductionPercent) pushSignedPercent('减伤', effects.damageReductionPercent);
  if (effects.dodgeChance) pushSignedPercent('闪避', effects.dodgeChance);
  if (effects.lifestealPercent) pushSignedPercent('吸血', effects.lifestealPercent);
  if (effects.blockChance) pushSignedPercent('格挡', effects.blockChance);
  return lines;
}

export function formatLootPickupLine(effects = {}) {
  const firstLine = formatLootEffectLines(effects)[0];
  if (firstLine) return firstLine;
  return '';
}

export function rollLootRarity(source, rng = Math.random) {
  const profile = getLootSourceProfile(source);
  const rarityId = pickWeighted(profile.rarityWeights, rng) || 'common';
  return getLootRarity(rarityId);
}

export function rollLootTemplate(rng = Math.random) {
  if (LOOT_EQUIPMENT_TEMPLATES.length <= 0) return null;
  const index = Math.floor(clampPositive(rng(), 0) * LOOT_EQUIPMENT_TEMPLATES.length) % LOOT_EQUIPMENT_TEMPLATES.length;
  return LOOT_EQUIPMENT_TEMPLATES[index];
}

export function buildLootEquipment({ template, rarityId = 'common', instanceId = '', source = 'minion' } = {}) {
  if (!template) return null;
  const rarity = getLootRarity(rarityId);
  const quality = LOOT_QUALITY_ALIASES[rarity.id] || LOOT_QUALITY_ALIASES.common;
  const effects = scaleEffects(template.effects || {}, rarity.scale);
  const statLines = formatLootEffectLines(effects);
  const desc = [
    `${rarity.label} ${template.categoryLabel}装备`,
    ...statLines
  ].join('\n');

  return {
    id: String(instanceId || `${template.id}_${rarity.id}`),
    instanceId: String(instanceId || `${template.id}_${rarity.id}`),
    baseId: template.id,
    source,
    kind: 'run_loot_equipment',
    stackable: false,
    name: template.name,
    icon: template.icon,
    category: template.category,
    categoryLabel: template.categoryLabel,
    sortOrder: Number(template.sortOrder || 0),
    rarityId: rarity.id,
    rarityLabel: rarity.label,
    rarityColor: rarity.color,
    rarityTextColor: rarity.textColor,
    raritySort: rarity.sortOrder,
    qualityId: quality.qualityId,
    qualityLabel: quality.qualityLabel,
    qualityName: quality.qualityName,
    chestTitle: rarity.chestTitle,
    desc,
    shortDesc: statLines.join(' · '),
    statLines,
    effects,
    count: 1
  };
}

export function rollLootEquipment({ source = 'minion', rng = Math.random, instanceId = '', rarityId = null } = {}) {
  const template = rollLootTemplate(rng);
  if (!template) return null;
  const rarity = rarityId ? getLootRarity(rarityId) : rollLootRarity(source, rng);
  return buildLootEquipment({ template, rarityId: rarity.id, instanceId, source });
}

export function rollVendorCurseEquipment({ rng = Math.random, instanceId = '', source = 'vendor' } = {}) {
  if (VENDOR_CURSE_TEMPLATES.length <= 0) return null;
  const index = Math.floor(clampPositive(rng(), 0) * VENDOR_CURSE_TEMPLATES.length) % VENDOR_CURSE_TEMPLATES.length;
  const template = VENDOR_CURSE_TEMPLATES[index];
  const rarityId = rng() < 0.28 ? 'epic' : 'rare';
  const item = buildLootEquipment({ template, rarityId, instanceId, source });
  if (!item) return null;
  const rarity = getLootRarity(rarityId);
  return {
    ...item,
    price: Math.round(Number(template.price || 320) * (rarityId === 'epic' ? 1.18 : 1)),
    vendorSummary: template.summary || '',
    desc: [template.summary || '', ...formatLootEffectLines(item.effects || {})].filter(Boolean).join('\n'),
    shortDesc: [template.summary || '', ...formatLootEffectLines(item.effects || {})].filter(Boolean).join(' · ')
  };
}

export function rollVendorEquipment({ rng = Math.random, instanceId = '', source = 'vendor' } = {}) {
  const rarityWeights = [
    { id: 'common', weight: 52 },
    { id: 'rare', weight: 31 },
    { id: 'epic', weight: 13 },
    { id: 'legendary', weight: 4 }
  ];

  const totalWeight = rarityWeights.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let roll = rng() * totalWeight;
  let rarityId = 'common';
  for (let index = 0; index < rarityWeights.length; index += 1) {
    roll -= Number(rarityWeights[index].weight || 0);
    if (roll <= 0) {
      rarityId = rarityWeights[index].id;
      break;
    }
  }

  const item = rollLootEquipment({ source: 'elite', rng, instanceId, rarityId });
  if (!item) return null;

  const basePrice = {
    common: 58,
    rare: 92,
    epic: 148,
    legendary: 238
  };
  const orderBonus = Math.max(0, Number(item.sortOrder || 0)) * (rarityId === 'legendary' ? 5 : (rarityId === 'epic' ? 4 : 3));
  const price = Math.round((basePrice[rarityId] || 58) + orderBonus);

  return {
    ...item,
    source,
    price,
    vendorSummary: `${item.qualityLabel}质${item.categoryLabel}装备`,
    previewLines: Array.isArray(item.statLines) ? item.statLines : []
  };
}

export { LOOT_RARITY_DEFS, LOOT_SOURCE_PROFILES, LOOT_EQUIPMENT_TEMPLATES, VENDOR_CURSE_TEMPLATES };