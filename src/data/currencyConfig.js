function clampStage(stage) {
  const value = Math.floor(Number(stage || 1));
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, value);
}

function rollInt(rng, min, max) {
  const random = typeof rng === 'function' ? rng : Math.random;
  const resolvedMin = Math.floor(Math.min(min, max));
  const resolvedMax = Math.floor(Math.max(min, max));
  return resolvedMin + Math.floor(random() * (resolvedMax - resolvedMin + 1));
}

export const COIN_ATTRACT_RULES = {
  baseAttractRadius: 96,
  collectRadius: 42,
  itemCollectRadius: 28,
  coinSpeed: 520,
  bagSpeed: 420
};

export function getCoinMagnetConfig(playerPickupRadius = 0) {
  const pickupRadius = Math.max(0, Number(playerPickupRadius || 0));
  return {
    attractRadius: Math.max(COIN_ATTRACT_RULES.baseAttractRadius, Math.round(pickupRadius)),
    collectRadius: COIN_ATTRACT_RULES.collectRadius,
    itemCollectRadius: COIN_ATTRACT_RULES.itemCollectRadius,
    coinSpeed: COIN_ATTRACT_RULES.coinSpeed,
    bagSpeed: COIN_ATTRACT_RULES.bagSpeed
  };
}

export function rollMinionCoinDrops({ isElite = false, stage = 1, rng = Math.random } = {}) {
  const tier = clampStage(stage);
  const chance = isElite
    ? Math.min(0.98, 0.92 + tier * 0.01)
    : Math.min(0.90, 0.72 + tier * 0.03);

  if ((typeof rng === 'function' ? rng() : Math.random()) > chance) return [];

  const bundleCount = isElite
    ? rollInt(rng, 2, tier >= 3 ? 4 : 3)
    : rollInt(rng, 1, tier >= 2 ? 2 : 1);

  const drops = [];
  for (let index = 0; index < bundleCount; index += 1) {
    const amount = isElite
      ? rollInt(rng, 14 + tier * 4, 24 + tier * 6)
      : rollInt(rng, 8 + tier * 2, 12 + tier * 4);
    drops.push({ type: 'coin', amount });
  }

  return drops;
}

export function rollBossCoinDrops({ stage = 1, rng = Math.random } = {}) {
  const tier = clampStage(stage);
  const bagCount = tier >= 4 ? 2 : 1;
  const looseCoinCount = rollInt(rng, 4 + tier, 6 + tier);

  const bags = [];
  for (let index = 0; index < bagCount; index += 1) {
    bags.push(rollInt(rng, 180 + tier * 40, 240 + tier * 55));
  }

  const coins = [];
  for (let index = 0; index < looseCoinCount; index += 1) {
    coins.push(rollInt(rng, 18 + tier * 4, 28 + tier * 6));
  }

  return { bags, coins };
}