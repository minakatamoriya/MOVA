const ELITE_AFFIX_DEFS = [
  {
    id: 'arcane_laser',
    name: '奥术激光',
    shortLabel: '奥',
    category: '伤害',
    slotType: 'primary',
    powerScore: 2,
    budgetCost: 2,
    color: 0x8d7bff,
    minStage: 1,
    weight: 12,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['hasted', 'enraged', 'waller'],
    discouragedWith: ['seeker_bombard', 'toxic_pool']
  },
  {
    id: 'frozen_burst',
    name: '冰环',
    shortLabel: '冰',
    category: '伤害',
    slotType: 'primary',
    powerScore: 1,
    budgetCost: 1,
    color: 0x8fe7ff,
    minStage: 1,
    weight: 10,
    roles: ['any'],
    exclusiveWith: ['ember_nova'],
    recommendedWith: ['hasted', 'blink_step', 'waller'],
    discouragedWith: []
  },
  {
    id: 'waller',
    name: '墙体',
    shortLabel: '墙',
    category: '控场',
    slotType: 'primary',
    powerScore: 1,
    budgetCost: 1,
    color: 0xffb36b,
    minStage: 2,
    weight: 7,
    roles: ['any'],
    exclusiveWith: ['snare_trap'],
    recommendedWith: ['arcane_laser', 'seeker_bombard', 'juggernaut'],
    discouragedWith: []
  },
  {
    id: 'hasted',
    name: '迅捷',
    shortLabel: '迅',
    category: '机动',
    slotType: 'support',
    powerScore: 1,
    budgetCost: 1,
    color: 0x6ce6c8,
    minStage: 2,
    weight: 10,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['arcane_laser', 'frozen_burst', 'ember_nova'],
    discouragedWith: []
  },
  {
    id: 'juggernaut',
    name: '重甲',
    shortLabel: '甲',
    category: '生存',
    slotType: 'support',
    powerScore: 1,
    budgetCost: 1,
    color: 0xd8a96b,
    minStage: 2,
    weight: 10,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['toxic_pool', 'waller', 'summoner'],
    discouragedWith: []
  },
  {
    id: 'ember_nova',
    name: '熔火',
    shortLabel: '熔',
    category: '伤害',
    slotType: 'primary',
    powerScore: 2,
    budgetCost: 2,
    color: 0xff8b47,
    minStage: 3,
    weight: 8,
    roles: ['any'],
    exclusiveWith: ['frozen_burst'],
    recommendedWith: ['hasted', 'blink_step', 'juggernaut'],
    discouragedWith: []
  },
  {
    id: 'seeker_bombard',
    name: '落雷',
    shortLabel: '雷',
    category: '伤害',
    slotType: 'primary',
    powerScore: 2,
    budgetCost: 2,
    color: 0xffcf5f,
    minStage: 4,
    weight: 8,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['waller', 'snare_trap', 'enraged'],
    discouragedWith: ['arcane_laser']
  },
  {
    id: 'toxic_pool',
    name: '毒池',
    shortLabel: '毒',
    category: '控场',
    slotType: 'primary',
    powerScore: 2,
    budgetCost: 2,
    color: 0x65d96d,
    minStage: 3,
    weight: 8,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['juggernaut', 'enraged', 'snare_trap'],
    discouragedWith: ['arcane_laser', 'summoner']
  },
  {
    id: 'summoner',
    name: '召唤',
    shortLabel: '召',
    category: '召唤',
    slotType: 'primary',
    powerScore: 2,
    budgetCost: 2,
    color: 0x7fb3ff,
    minStage: 4,
    weight: 7,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['juggernaut', 'enraged', 'hasted'],
    discouragedWith: ['toxic_pool', 'seeker_bombard']
  },
  {
    id: 'enraged',
    name: '狂暴',
    shortLabel: '狂',
    category: '强化',
    slotType: 'support',
    powerScore: 1,
    budgetCost: 1,
    color: 0xff6b6b,
    minStage: 3,
    weight: 9,
    roles: ['any'],
    exclusiveWith: [],
    recommendedWith: ['arcane_laser', 'seeker_bombard', 'summoner'],
    discouragedWith: []
  },
  {
    id: 'snare_trap',
    name: '陷阱',
    shortLabel: '陷',
    category: '控场',
    slotType: 'primary',
    powerScore: 2,
    budgetCost: 2,
    color: 0xc6a56b,
    minStage: 5,
    weight: 5,
    roles: ['any'],
    exclusiveWith: ['waller'],
    recommendedWith: ['seeker_bombard', 'toxic_pool', 'blink_step'],
    discouragedWith: []
  },
  {
    id: 'blink_step',
    name: '闪现',
    shortLabel: '闪',
    category: '机动',
    slotType: 'support',
    powerScore: 1,
    budgetCost: 2,
    color: 0x7fd4ff,
    minStage: 4,
    weight: 4,
    roles: ['any'],
    exclusiveWith: [],
    supportOnly: true,
    recommendedWith: ['ember_nova', 'frozen_burst', 'snare_trap'],
    discouragedWith: []
  }
];

function normalizeStage(stage) {
  return Math.max(1, Math.floor(Number(stage) || 1));
}

function getStageAffixPlan(stage) {
  const resolvedStage = normalizeStage(stage);

  if (resolvedStage <= 1) {
    return {
      countWeights: [{ count: 1, weight: 1 }],
      maxBudget: 2,
      maxPrimary: 1,
      maxSupport: 0,
      maxPowerScore: 2,
    };
  }

  if (resolvedStage <= 2) {
    return {
      countWeights: [
        { count: 1, weight: 85 },
        { count: 2, weight: 15 }
      ],
      maxBudget: 2,
      maxPrimary: 1,
      maxSupport: 1,
      maxPowerScore: 2,
    };
  }

  if (resolvedStage <= 3) {
    return {
      countWeights: [
        { count: 1, weight: 70 },
        { count: 2, weight: 30 }
      ],
      maxBudget: 3,
      maxPrimary: 1,
      maxSupport: 1,
      maxPowerScore: 3,
    };
  }

  if (resolvedStage <= 5) {
    return {
      countWeights: [
        { count: 1, weight: 32 },
        { count: 2, weight: 53 },
        { count: 3, weight: 15 }
      ],
      maxBudget: 4,
      maxPrimary: 2,
      maxSupport: 1,
      maxPowerScore: 4,
    };
  }

  if (resolvedStage <= 6) {
    return {
      countWeights: [
        { count: 1, weight: 20 },
        { count: 2, weight: 55 },
        { count: 3, weight: 25 }
      ],
      maxBudget: 4,
      maxPrimary: 2,
      maxSupport: 1,
      maxPowerScore: 4,
    };
  }

  if (resolvedStage <= 8) {
    return {
      countWeights: [
        { count: 1, weight: 12 },
        { count: 2, weight: 50 },
        { count: 3, weight: 38 }
      ],
      maxBudget: 5,
      maxPrimary: 2,
      maxSupport: 1,
      maxPowerScore: 5,
    };
  }

  return {
    countWeights: [
      { count: 1, weight: 10 },
      { count: 2, weight: 42 },
      { count: 3, weight: 48 }
    ],
    maxBudget: 5,
    maxPrimary: 2,
    maxSupport: 2,
    maxPowerScore: 6,
  };
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
    slotType: def.slotType || 'primary',
    powerScore: Math.max(1, Number(def.powerScore || 1)),
    budgetCost: Math.max(1, Number(def.budgetCost || 1)),
    color: def.color,
    minStage: def.minStage,
    weight: def.weight,
    roles: [...(def.roles || ['any'])],
    exclusiveWith: [...(def.exclusiveWith || [])],
    supportOnly: def.supportOnly === true,
    recommendedWith: [...(def.recommendedWith || [])],
    discouragedWith: [...(def.discouragedWith || [])]
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

function rollWeightedCount(weightDefs, rng) {
  const pool = Array.isArray(weightDefs) ? weightDefs.filter((item) => Number(item?.count) > 0) : [];
  if (pool.length <= 0) return 1;
  const picked = pickWeighted(pool, rng);
  return Math.max(1, Math.floor(Number(picked?.count) || 1));
}

function hasPrimaryChoice(pool, picked, remainingBudget) {
  return pool.some((item) => {
    if (!item || item.supportOnly) return false;
    if ((picked || []).some((current) => (current?.exclusiveWith || []).includes(item.id) || (item.exclusiveWith || []).includes(current?.id))) {
      return false;
    }
    return item.budgetCost <= remainingBudget;
  });
}

function countPickedBySlot(picked, slotType) {
  return (picked || []).reduce((sum, item) => sum + (item?.slotType === slotType ? 1 : 0), 0);
}

function getPickedPowerScore(picked) {
  return (picked || []).reduce((sum, item) => sum + Math.max(1, Number(item?.powerScore || 1)), 0);
}

function computeAdjustedWeight(candidate, picked, stage) {
  let nextWeight = Math.max(1, Number(candidate?.weight || 1));
  if (!candidate || !Array.isArray(picked) || picked.length <= 0) return nextWeight;

  let hasRecommendedLink = false;
  let hasDiscouragedLink = false;
  let sameCategoryCount = 0;
  let supportPairBonus = false;

  for (let i = 0; i < picked.length; i += 1) {
    const current = picked[i];
    if (!current) continue;
    if ((candidate.recommendedWith || []).includes(current.id) || (current.recommendedWith || []).includes(candidate.id)) {
      hasRecommendedLink = true;
    }
    if ((candidate.discouragedWith || []).includes(current.id) || (current.discouragedWith || []).includes(candidate.id)) {
      hasDiscouragedLink = true;
    }
    if (candidate.category === current.category) {
      sameCategoryCount += 1;
    }
    if (candidate.slotType !== current.slotType) {
      supportPairBonus = true;
    }
  }

  if (hasRecommendedLink) nextWeight *= 1.75;
  if (hasDiscouragedLink) nextWeight *= (normalizeStage(stage) <= 6 ? 0.22 : 0.48);
  if (supportPairBonus) nextWeight *= 1.12;
  if (sameCategoryCount > 0 && (candidate.category === '伤害' || candidate.category === '控场')) {
    nextWeight *= Math.max(0.45, 0.72 - sameCategoryCount * 0.12);
  }
  if (candidate.supportOnly === true && picked.length > 0) {
    nextWeight *= 1.18;
  }

  return Math.max(1, Math.round(nextWeight));
}

function isAffixCompatible(candidate, picked, remainingBudget, targetCount, pool, plan, stage) {
  if (!candidate) return false;
  if (candidate.budgetCost > remainingBudget) return false;
  if (candidate.supportOnly === true) {
    if ((targetCount || 0) <= 1) return false;
    if ((picked?.length || 0) <= 0 && hasPrimaryChoice(pool || [], picked, remainingBudget)) return false;
  }

  const nextPrimaryCount = countPickedBySlot(picked, 'primary') + (candidate.slotType === 'primary' ? 1 : 0);
  const nextSupportCount = countPickedBySlot(picked, 'support') + (candidate.slotType === 'support' ? 1 : 0);
  const nextPowerScore = getPickedPowerScore(picked) + Math.max(1, Number(candidate.powerScore || 1));
  if (plan?.maxPrimary != null && nextPrimaryCount > plan.maxPrimary) return false;
  if (plan?.maxSupport != null && nextSupportCount > plan.maxSupport) return false;
  if (plan?.maxPowerScore != null && nextPowerScore > plan.maxPowerScore) return false;

  for (let i = 0; i < picked.length; i += 1) {
    const current = picked[i];
    if (!current) continue;
    if ((candidate.exclusiveWith || []).includes(current.id)) return false;
    if ((current.exclusiveWith || []).includes(candidate.id)) return false;
    if (
      normalizeStage(stage) <= 5
      && (((candidate.discouragedWith || []).includes(current.id)) || ((current.discouragedWith || []).includes(candidate.id)))
    ) return false;
  }

  return true;
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

  const plan = getStageAffixPlan(stage);
  const targetCount = Math.min(pool.length, rollWeightedCount(plan.countWeights, rng));
  let remainingBudget = Math.max(1, Math.floor(Number(plan.maxBudget) || 1));

  const available = [...pool];
  const picked = [];
  while (available.length > 0 && picked.length < targetCount) {
    const candidates = available.filter((item) => isAffixCompatible(item, picked, remainingBudget, targetCount, available, plan, stage));
    if (candidates.length <= 0) break;

    const weightedCandidates = candidates.map((item) => ({
      ...item,
      weight: computeAdjustedWeight(item, picked, stage)
    }));
    const selected = pickWeighted(weightedCandidates, rng);
    if (!selected) break;

    picked.push(selected);
    remainingBudget -= Math.max(1, Number(selected.budgetCost || 1));

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
