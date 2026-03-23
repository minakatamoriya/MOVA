export const OUTRUN_ITEM_SLOT_COUNT = 6;

export const ITEM_QUALITY_DEFS = {
  white: { id: 'white', label: '白', name: '普通', color: '#f3f4f6', glow: 'rgba(243,244,246,0.28)' },
  blue: { id: 'blue', label: '蓝', name: '精良', color: '#58a6ff', glow: 'rgba(88,166,255,0.28)' },
  purple: { id: 'purple', label: '紫', name: '史诗', color: '#c084fc', glow: 'rgba(192,132,252,0.30)' },
  orange: { id: 'orange', label: '橙', name: '传说', color: '#fb923c', glow: 'rgba(251,146,60,0.34)' }
};

const RAW_ITEM_DEFS = [
  {
    id: 'potion_small',
    name: '战地血瓶',
    desc: '生命低于 10% 时自动使用，回复 50% 生命，30 秒冷却。可携带多个。',
    icon: '🧪',
    price: 120,
    qualityId: 'white',
    kind: 'consumable',
    categoryLabel: '消耗品',
    stackable: true,
    maxOwned: 5,
    carryLimit: 5,
    shopOrder: 10,
    effects: {},
    consumable: { mode: 'autoHeal', thresholdPct: 0.10, healPct: 0.50, cooldownMs: 30000 }
  },
  {
    id: 'reroll_dice',
    name: '重铸骰子',
    desc: '在三选一界面消耗 1 个，立即重刷当前天赋选项。可携带多个。',
    icon: '🎲',
    price: 100,
    qualityId: 'white',
    kind: 'consumable',
    categoryLabel: '消耗品',
    stackable: true,
    maxOwned: 5,
    carryLimit: 5,
    shopOrder: 20,
    effects: {},
    consumable: { mode: 'rerollLevelUp' }
  },
  {
    id: 'training_blade',
    name: '练武短刃',
    desc: '白质武器。常规的开荒选择，直接提高输出。',
    icon: '🗡',
    price: 140,
    qualityId: 'white',
    kind: 'equipment',
    categoryLabel: '武器',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 30,
    effects: { damageMult: 1.08 }
  },
  {
    id: 'scout_boots',
    name: '斥候短靴',
    desc: '白质鞋履。提升走位容错，适合前期发育。',
    icon: '🥾',
    price: 130,
    qualityId: 'white',
    kind: 'equipment',
    categoryLabel: '鞋履',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 40,
    effects: { speedMult: 1.07 }
  },
  {
    id: 'cedar_band',
    name: '雪松环',
    desc: '白质饰品。稍微扩充射程并补一点生存。',
    icon: '◌',
    price: 150,
    qualityId: 'white',
    kind: 'equipment',
    categoryLabel: '饰品',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 50,
    effects: { rangeMult: 1.08, maxHpFlat: 14 }
  },
  {
    id: 'magnet',
    name: '吸金石',
    desc: '蓝质工具。扩大金币吸附范围，让散落金币更快卷回角色。',
    icon: '◉',
    price: 180,
    qualityId: 'blue',
    kind: 'utility',
    categoryLabel: '工具',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 60,
    effects: { magnetRadius: 148 }
  },
  {
    id: 'hawk_quiver',
    name: '鹰翼箭囊',
    desc: '蓝质副手。攻速更快，同时略微拉长攻击距离。',
    icon: '🏹',
    price: 240,
    qualityId: 'blue',
    kind: 'equipment',
    categoryLabel: '副手',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 70,
    effects: { fireRateMult: 0.90, rangeMult: 1.10 }
  },
  {
    id: 'iron_guard',
    name: '铁卫胸甲',
    desc: '蓝质护甲。提高最大生命并稳定减伤。',
    icon: '🛡',
    price: 260,
    qualityId: 'blue',
    kind: 'equipment',
    categoryLabel: '护甲',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 80,
    effects: { maxHpFlat: 34, damageReductionPercent: 0.05 }
  },
  {
    id: 'bounty_badge',
    name: '赏金徽',
    desc: '蓝质资源装。局内金币获取提高 35%，并额外加一点吸附范围。',
    icon: '¤',
    price: 280,
    qualityId: 'blue',
    kind: 'utility',
    categoryLabel: '资源',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 90,
    effects: { magnetRadius: 72 },
    support: { sessionCoinMult: 1.35 }
  },
  {
    id: 'lucky_clover',
    name: '幸运四叶',
    desc: '蓝质资源装。提升精英与 Boss 的战利品掉率，并抬高高品质出现权重。',
    icon: '✧',
    price: 300,
    qualityId: 'blue',
    kind: 'utility',
    categoryLabel: '资源',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 100,
    effects: {},
    support: {
      lootDropChanceBonus: 0.08,
      rarityWeightBonus: { rare: 4, epic: 10, legendary: 8 }
    }
  },
  {
    id: 'shadow_emblem',
    name: '影袭纹章',
    desc: '蓝质饰品。提高暴击与闪避，适合高机动流派。',
    icon: '🜚',
    price: 310,
    qualityId: 'blue',
    kind: 'equipment',
    categoryLabel: '饰品',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 110,
    effects: { critChance: 0.05, dodgeChance: 0.04 }
  },
  {
    id: 'revive_cross',
    name: '复活十字',
    desc: '紫质遗物。死亡后立即原地复活并回满生命。每局最多携带 1 个。',
    icon: '✚',
    price: 360,
    qualityId: 'purple',
    kind: 'consumable',
    categoryLabel: '遗物',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 120,
    effects: {},
    consumable: { mode: 'revive', reviveHpPct: 1 }
  },
  {
    id: 'blood_pendant',
    name: '血辉吊坠',
    desc: '紫质饰品。增强吸血与暴击伤害，打持续战更稳。',
    icon: '🜂',
    price: 460,
    qualityId: 'purple',
    kind: 'equipment',
    categoryLabel: '饰品',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 130,
    effects: { lifestealPercent: 0.08, critMultiplier: 0.24 }
  },
  {
    id: 'void_compass',
    name: '虚空罗盘',
    desc: '紫质法器。显著扩大范围，并让金币从更远处自动吸附。',
    icon: '🧭',
    price: 480,
    qualityId: 'purple',
    kind: 'equipment',
    categoryLabel: '法器',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 140,
    effects: { rangeMult: 1.18, fireRateMult: 0.87, magnetRadius: 96 }
  },
  {
    id: 'lifebloom_core',
    name: '生辉核心',
    desc: '紫质护符。补生命、持续回复，并送 1 层护盾。',
    icon: '✺',
    price: 520,
    qualityId: 'purple',
    kind: 'equipment',
    categoryLabel: '护符',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 150,
    effects: { maxHpFlat: 56, regenPerSec: 1.3, shieldCharges: 1 }
  },
  {
    id: 'boss_contract',
    name: '讨伐契',
    desc: '紫质契约。Boss 额外掉落 1 件战利品，并略微提高伤害。',
    icon: '◇',
    price: 540,
    qualityId: 'purple',
    kind: 'utility',
    categoryLabel: '契约',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 160,
    effects: { damageMult: 1.10 },
    support: { bossExtraDropCount: 1 }
  },
  {
    id: 'sunfire_crown',
    name: '曜日冕冠',
    desc: '橙质头冠。高额提升伤害、攻速与暴击，是纯输出毕业装。',
    icon: '👑',
    price: 860,
    qualityId: 'orange',
    kind: 'equipment',
    categoryLabel: '头冠',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 170,
    effects: { damageMult: 1.22, fireRateMult: 0.84, critChance: 0.08 }
  },
  {
    id: 'kings_guard',
    name: '王庭守誓',
    desc: '橙质重甲。高额生命、减伤与格挡，让前排硬度明显上升。',
    icon: '⛨',
    price: 900,
    qualityId: 'orange',
    kind: 'equipment',
    categoryLabel: '重甲',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 180,
    effects: { maxHpFlat: 90, damageReductionPercent: 0.12, blockChance: 0.16 }
  },
  {
    id: 'starlight_drive',
    name: '星驰引擎',
    desc: '橙质核心。大幅提升移速、范围和暴击伤害，偏高机动爆发。',
    icon: '✦',
    price: 920,
    qualityId: 'orange',
    kind: 'equipment',
    categoryLabel: '核心',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 190,
    effects: { speedMult: 1.18, rangeMult: 1.16, critMultiplier: 0.35 }
  },
  {
    id: 'dragon_hoard',
    name: '龙藏金印',
    desc: '橙质资源装。局内金币、掉率、品质权重与吸附范围全部加强。',
    icon: '🐉',
    price: 980,
    qualityId: 'orange',
    kind: 'utility',
    categoryLabel: '资源',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    shopOrder: 200,
    effects: { magnetRadius: 148 },
    support: {
      sessionCoinMult: 1.55,
      lootDropChanceBonus: 0.12,
      rarityWeightBonus: { rare: 6, epic: 14, legendary: 12 },
      bossExtraDropCount: 1
    }
  }
];

export const ITEM_DEFS = RAW_ITEM_DEFS.map((item) => {
  const quality = ITEM_QUALITY_DEFS[item?.qualityId] || ITEM_QUALITY_DEFS.white;
  return {
    ...item,
    qualityId: quality.id,
    qualityLabel: quality.label,
    qualityName: quality.name,
    qualityColor: quality.color,
    qualityGlow: quality.glow
  };
});

const ITEM_INDEX = Object.fromEntries(ITEM_DEFS.map((item) => [item.id, item]));

function clampPositiveInt(value, fallback = 0) {
  const resolved = Math.floor(Number(value));
  if (!Number.isFinite(resolved)) return Math.max(0, fallback);
  return Math.max(0, resolved);
}

export function getItemById(id) {
  return ITEM_INDEX[String(id || '')] || null;
}

export function getItemMaxOwned(itemOrId) {
  const item = typeof itemOrId === 'string' ? getItemById(itemOrId) : itemOrId;
  if (!item) return 0;
  return Math.max(1, clampPositiveInt(item.maxOwned, 1));
}

export function getItemCarryLimit(itemOrId) {
  const item = typeof itemOrId === 'string' ? getItemById(itemOrId) : itemOrId;
  if (!item) return 0;
  return Math.max(1, clampPositiveInt(item.carryLimit, 1));
}

export function getOwnedItemCount(items, itemId) {
  if (!Array.isArray(items) || !itemId) return 0;
  let count = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i] === itemId) count += 1;
  }
  return count;
}

export function getEquippedItemCount(items, itemId) {
  if (!Array.isArray(items) || !itemId) return 0;
  let count = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i] === itemId) count += 1;
  }
  return count;
}

export function getOwnedItemIds(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const counts = Object.create(null);
  const normalized = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const id = String(rawItems[i] || '');
    const item = getItemById(id);
    if (!item) continue;

    const nextCount = (counts[id] || 0) + 1;
    if (nextCount > getItemMaxOwned(item)) continue;
    counts[id] = nextCount;
    normalized.push(id);
  }

  return normalized;
}

export function normalizeEquippedItems(rawItems, ownedItems) {
  const normalizedOwned = getOwnedItemIds(ownedItems);
  const ownedCounts = Object.create(null);
  normalizedOwned.forEach((id) => {
    ownedCounts[id] = (ownedCounts[id] || 0) + 1;
  });

  const result = new Array(OUTRUN_ITEM_SLOT_COUNT).fill(null);
  const equippedCounts = Object.create(null);
  const source = Array.isArray(rawItems) ? rawItems : [];

  for (let i = 0; i < OUTRUN_ITEM_SLOT_COUNT; i += 1) {
    const id = String(source[i] || '');
    const item = getItemById(id);
    if (!item) continue;

    const ownedCount = ownedCounts[id] || 0;
    if (ownedCount <= 0) continue;

    const nextCount = (equippedCounts[id] || 0) + 1;
    if (nextCount > ownedCount) continue;
    if (nextCount > getItemCarryLimit(item)) continue;

    equippedCounts[id] = nextCount;
    result[i] = id;
  }

  return result;
}

export function getPurchaseState(itemOrId, ownedItems, globalCoins = 0) {
  const item = typeof itemOrId === 'string' ? getItemById(itemOrId) : itemOrId;
  if (!item) return { ok: false, reason: 'missing' };

  const ownedCount = getOwnedItemCount(ownedItems, item.id);
  const maxOwned = getItemMaxOwned(item);
  const price = Math.max(0, Number(item.price || 0));
  if (ownedCount >= maxOwned) return { ok: false, reason: 'max_owned', ownedCount, maxOwned, price };
  if (Number(globalCoins || 0) < price) return { ok: false, reason: 'not_enough_coins', ownedCount, maxOwned, price };
  return { ok: true, reason: '', ownedCount, maxOwned, price };
}

export function getEquipState(itemOrId, ownedItems, equippedItems) {
  const item = typeof itemOrId === 'string' ? getItemById(itemOrId) : itemOrId;
  if (!item) return { ok: false, reason: 'missing' };

  const ownedCount = getOwnedItemCount(ownedItems, item.id);
  const equippedCount = getEquippedItemCount(equippedItems, item.id);
  const carryLimit = getItemCarryLimit(item);

  if (ownedCount <= equippedCount) {
    return { ok: false, reason: 'no_free_copy', ownedCount, equippedCount, carryLimit };
  }
  if (equippedCount >= carryLimit) {
    return { ok: false, reason: 'carry_limit', ownedCount, equippedCount, carryLimit };
  }
  return { ok: true, reason: '', ownedCount, equippedCount, carryLimit };
}

export function getEquippedSupportSummary(equippedItems) {
  const list = Array.isArray(equippedItems) ? equippedItems : [];
  const summary = {
    sessionCoinMult: 1,
    lootDropChanceBonus: 0,
    rarityWeightBonus: { rare: 0, epic: 0, legendary: 0 },
    bossExtraDropCount: 0
  };

  list.forEach((id) => {
    const item = getItemById(id);
    const support = item?.support;
    if (!support) return;

    if (support.sessionCoinMult) summary.sessionCoinMult *= Number(support.sessionCoinMult || 1);
    if (support.lootDropChanceBonus) summary.lootDropChanceBonus += Number(support.lootDropChanceBonus || 0);
    if (support.bossExtraDropCount) summary.bossExtraDropCount += clampPositiveInt(support.bossExtraDropCount, 0);

    const rarityBonus = support.rarityWeightBonus;
    if (rarityBonus && typeof rarityBonus === 'object') {
      Object.keys(summary.rarityWeightBonus).forEach((key) => {
        if (rarityBonus[key]) {
          summary.rarityWeightBonus[key] += Number(rarityBonus[key] || 0);
        }
      });
    }
  });

  return summary;
}
