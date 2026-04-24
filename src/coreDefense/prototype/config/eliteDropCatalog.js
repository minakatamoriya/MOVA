const ELITE_DROP_STACK_CAP = 3;

export function createInitialEliteDropState() {
  return {
    frontlineBountyLevel: 0,
    eliteHunterLevel: 0,
    coreCouponCharges: 0,
    coreCouponValue: 0,
    reserveGoldPayouts: 0,
    dropsCollected: 0,
    lastDropId: null,
    lastDropName: '',
  };
}

const ELITE_DROP_POOL = [
  {
    id: 'drop_frontline_bounty',
    name: '前线赏金模块',
    color: '#ffe18a',
    summary: '前线击杀收益提升',
    isEligible: (scene) => Number(scene.eliteDropState?.frontlineBountyLevel || 0) < ELITE_DROP_STACK_CAP,
    apply: (scene) => {
      scene.eliteDropState.frontlineBountyLevel += 1;
      return true;
    },
  },
  {
    id: 'drop_elite_hunter',
    name: '精英猎手战利品',
    color: '#ffd2a8',
    summary: '对压阵精英伤害提升',
    isEligible: (scene) => Number(scene.eliteDropState?.eliteHunterLevel || 0) < ELITE_DROP_STACK_CAP,
    apply: (scene) => {
      scene.eliteDropState.eliteHunterLevel += 1;
      return true;
    },
  },
  {
    id: 'drop_core_coupon',
    name: '核心采购券',
    color: '#8de8ff',
    summary: '下次核心升级获得折扣',
    isEligible: (scene) => Number(scene.eliteDropState?.coreCouponCharges || 0) < 4,
    apply: (scene) => {
      scene.eliteDropState.coreCouponCharges += 1;
      scene.eliteDropState.coreCouponValue = Math.min(64, Number(scene.eliteDropState.coreCouponValue || 0) + 18);
      return true;
    },
  },
  {
    id: 'drop_reserve_fund',
    name: '战备拨款',
    color: '#c8ffd4',
    summary: '立即获得一笔共享金币',
    isEligible: (scene) => Number(scene.eliteDropState?.reserveGoldPayouts || 0) < 4,
    apply: (scene) => {
      scene.eliteDropState.reserveGoldPayouts += 1;
      scene.gold += 36 + (scene.eliteDropState.reserveGoldPayouts * 10);
      return true;
    },
  },
];

export function getCoreCouponDiscount(scene) {
  if (!scene?.eliteDropState) return 0;
  const charges = Number(scene.eliteDropState.coreCouponCharges || 0);
  const value = Number(scene.eliteDropState.coreCouponValue || 0);
  if (charges <= 0 || value <= 0) return 0;
  return value;
}

export function consumeCoreCouponDiscount(scene) {
  if (!scene?.eliteDropState) return 0;
  const discount = getCoreCouponDiscount(scene);
  if (discount <= 0) return 0;
  scene.eliteDropState.coreCouponCharges = Math.max(0, Number(scene.eliteDropState.coreCouponCharges || 0) - 1);
  if (scene.eliteDropState.coreCouponCharges <= 0) {
    scene.eliteDropState.coreCouponValue = 0;
  }
  return discount;
}

export function getFrontlineBountyReward(scene, enemy) {
  const level = Number(scene.eliteDropState?.frontlineBountyLevel || 0);
  if (level <= 0) return { gold: 0, exp: 0 };
  const enteredFrontline = Boolean(enemy?.enteredFrontline || enemy?.y >= scene.metrics?.zones?.frontline?.y);
  if (!enteredFrontline) return { gold: 0, exp: 0 };
  return {
    gold: level * 3,
    exp: level,
  };
}

export function getEliteHunterBonus(scene, enemy) {
  const level = Number(scene.eliteDropState?.eliteHunterLevel || 0);
  if (level <= 0 || !enemy?.isEliteAnchor) {
    return { damage: 0, critChance: 0 };
  }
  return {
    damage: level * 8,
    critChance: level * 0.06,
  };
}

export function awardEliteDrop(scene) {
  const eligibleDrops = ELITE_DROP_POOL.filter((entry) => entry.isEligible(scene));
  if (!eligibleDrops.length) return null;
  const selected = eligibleDrops[Math.floor(Math.random() * eligibleDrops.length)];
  const applied = selected.apply(scene);
  if (!applied) return null;

  scene.eliteDropState.dropsCollected += 1;
  scene.eliteDropState.lastDropId = selected.id;
  scene.eliteDropState.lastDropName = selected.name;

  return {
    id: selected.id,
    name: selected.name,
    color: selected.color,
    summary: selected.summary,
  };
}