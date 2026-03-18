const ELITE_AFFIX_DEFS = [
  {
    id: 'arcane_laser',
    name: '奥术激光',
    shortLabel: '奥',
    category: '伤害',
    color: 0x8d7bff,
    minStage: 1,
    weight: 12,
    roles: ['any']
  },
  {
    id: 'frozen_burst',
    name: '冰冻环爆',
    shortLabel: '冰',
    category: '伤害',
    color: 0x8fe7ff,
    minStage: 1,
    weight: 10,
    roles: ['any']
  },
  {
    id: 'waller',
    name: '墙体',
    shortLabel: '墙',
    category: '控场',
    color: 0xffb36b,
    minStage: 1,
    weight: 10,
    roles: ['any']
  }
];

function normalizeStage(stage) {
  return Math.max(1, Math.floor(Number(stage) || 1));
}

function getAffixCountRange(stage) {
  normalizeStage(stage);
  // 第一版先固定每只精英 1 个词缀，便于验证战斗读感。
  return { min: 1, max: 1 };
}

function supportsRole(def, role) {
  const roles = Array.isArray(def.roles) ? def.roles : ['any'];
  return roles.includes('any') || roles.includes(role);
}

function cloneAffix(def) {
  return {
    id: def.id,
    name: def.name,
    shortLabel: def.shortLabel,
    category: def.category,
    color: def.color,
    minStage: def.minStage,
    weight: def.weight,
    roles: [...(def.roles || ['any'])]
  };
}

function pickWeighted(pool, rng) {
  const totalWeight = pool.reduce((sum, item) => sum + Math.max(1, Number(item.weight || 1)), 0);
  if (totalWeight <= 0) return pool[0] || null;

  let roll = rng() * totalWeight;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= Math.max(1, Number(pool[i].weight || 1));
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1] || null;
}

export function getEliteAffixPool(stage, role = 'any') {
  const resolvedStage = normalizeStage(stage);
  return ELITE_AFFIX_DEFS
    .filter((def) => resolvedStage >= def.minStage)
    .filter((def) => supportsRole(def, role))
    .map(cloneAffix);
}

export function rollEliteAffixes({ stage, role = 'any', rng = Math.random } = {}) {
  const pool = getEliteAffixPool(stage, role);
  if (pool.length <= 0) return [];

  const countRange = getAffixCountRange(stage);
  const targetCount = Math.min(
    pool.length,
    countRange.min + Math.floor(rng() * (countRange.max - countRange.min + 1))
  );

  const available = [...pool];
  const picked = [];
  while (available.length > 0 && picked.length < targetCount) {
    const selected = pickWeighted(available, rng);
    if (!selected) break;
    picked.push(selected);
    const idx = available.findIndex((item) => item.id === selected.id);
    if (idx >= 0) available.splice(idx, 1);
  }

  return picked;
}

export function buildEliteAffixLabel(affixes = []) {
  const names = Array.isArray(affixes)
    ? affixes.map((item) => item?.name || '').filter(Boolean)
    : [];
  return names.join('·');
}
