export const OUTRUN_ITEM_SLOT_COUNT = 6;

export const ITEM_DEFS = [
  {
    id: 'potion_small',
    name: '血瓶',
    desc: '生命低于 10% 时自动使用，回复 50% 生命，30 秒冷却。可携带多个。',
    icon: '🧪',
    price: 120,
    kind: 'consumable',
    stackable: true,
    maxOwned: 5,
    carryLimit: 5,
    effects: {},
    consumable: { mode: 'autoHeal', thresholdPct: 0.10, healPct: 0.50, cooldownMs: 30000 }
  },
  {
    id: 'reroll_dice',
    name: '骰子',
    desc: '在三选一界面消耗 1 个，立即重刷当前天赋选项。可携带多个。',
    icon: '🎲',
    price: 100,
    kind: 'consumable',
    stackable: true,
    maxOwned: 5,
    carryLimit: 5,
    effects: {},
    consumable: { mode: 'rerollLevelUp' }
  },
  {
    id: 'revive_cross',
    name: '复活十字',
    desc: '死亡后立即原地复活并回满生命。每局最多携带 1 个。',
    icon: '✚',
    price: 320,
    kind: 'consumable',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    effects: {},
    consumable: { mode: 'revive', reviveHpPct: 1 }
  },
  {
    id: 'magnet',
    name: '吸金石',
    desc: '扩大金币吸附范围，跑图时更容易把散落金币一口气收掉。',
    icon: '◉',
    price: 150,
    kind: 'utility',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    effects: { magnetRadius: 132 }
  },
  {
    id: 'bounty_badge',
    name: '赏金徽',
    desc: '本局获得的金币提高 25%，偏资源型，不直接加战斗属性。',
    icon: '¤',
    price: 180,
    kind: 'utility',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    effects: {},
    support: { sessionCoinMult: 1.25 }
  },
  {
    id: 'lucky_clover',
    name: '幸运符',
    desc: '提升精英与 Boss 的战利品掉率，并让高品质装备更容易出现。',
    icon: '✧',
    price: 220,
    kind: 'utility',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    effects: {},
    support: {
      lootDropChanceBonus: 0.08,
      rarityWeightBonus: { rare: 4, epic: 10, legendary: 8 }
    }
  },
  {
    id: 'boss_contract',
    name: '讨伐契',
    desc: 'Boss 额外掉落 1 件战利品，偏向高风险后的稳定回报。',
    icon: '◇',
    price: 260,
    kind: 'utility',
    stackable: false,
    maxOwned: 1,
    carryLimit: 1,
    effects: {},
    support: { bossExtraDropCount: 1 }
  }
];

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
