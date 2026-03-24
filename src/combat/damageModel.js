// 统一战斗数值模型：
// - 先把装备/局内掉落/职业被动规整成派生属性
// - 再把出伤与承伤流程收口到同一套公式里
function toNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function toMultiplier(value, fallback = 1) {
  const resolved = toNumber(value, fallback);
  return resolved > 0 ? resolved : fallback;
}

function clampChance(value) {
  return Math.min(0.95, Math.max(0, toNumber(value, 0)));
}

function roundDamage(value, minimum = 1) {
  return Math.max(minimum, Math.round(toNumber(value, 0)));
}

function getArcherRangeMultiplier(level) {
  return [1, 1.12, 1.24, 1.36][Math.max(0, Math.min(3, Math.round(level || 0)))] || 1;
}

export function normalizeStatMods(mods = {}) {
  // 兼容两种攻速表达：
  // - fireRateMult 直接作用于“攻击间隔”
  // - attackSpeedMult 作用于“攻速”，需要换算成间隔倍率
  const attackSpeedMult = toMultiplier(mods.attackSpeedMult, 1);
  const baseFireRateMult = toMultiplier(mods.fireRateMult, 1);
  const fireRateMult = baseFireRateMult * (attackSpeedMult !== 1 ? (1 / attackSpeedMult) : 1);

  return {
    damageMult: toMultiplier(mods.damageMult, 1),
    fireRateMult,
    speedMult: toMultiplier(mods.speedMult, 1),
    rangeMult: toMultiplier(mods.rangeMult, 1),
    maxHpFlat: toNumber(mods.maxHpFlat, 0),
    critChance: toNumber(mods.critChance, 0),
    critMultiplier: toNumber(mods.critMultiplier, 0),
    lifestealPercent: toNumber(mods.lifestealPercent, 0),
    magnetRadius: toNumber(mods.magnetRadius, 0),
    shieldCharges: Math.max(0, Math.round(toNumber(mods.shieldCharges, 0))),
    dodgeChance: toNumber(mods.dodgeChance, 0),
    regenPerSec: toNumber(mods.regenPerSec, 0),
    damageReductionPercent: toNumber(mods.damageReductionPercent, 0),
    blockChance: toNumber(mods.blockChance, 0)
  };
}

export function combineStatMods(...modsList) {
  // 乘法类属性叠乘，数值类属性累加，避免在业务层重复写同一套合并规则
  return modsList.reduce((acc, mods) => {
    const current = normalizeStatMods(mods);
    acc.damageMult *= current.damageMult;
    acc.fireRateMult *= current.fireRateMult;
    acc.speedMult *= current.speedMult;
    acc.rangeMult *= current.rangeMult;
    acc.maxHpFlat += current.maxHpFlat;
    acc.critChance += current.critChance;
    acc.critMultiplier += current.critMultiplier;
    acc.lifestealPercent += current.lifestealPercent;
    acc.magnetRadius += current.magnetRadius;
    acc.shieldCharges += current.shieldCharges;
    acc.dodgeChance += current.dodgeChance;
    acc.regenPerSec += current.regenPerSec;
    acc.damageReductionPercent += current.damageReductionPercent;
    acc.blockChance += current.blockChance;
    return acc;
  }, normalizeStatMods());
}

export function buildPlayerDerivedStats(player, options = {}) {
  // 玩家当前展示/发射所用属性都从这里派生，保证 UI、射程和实际结算同源
  const equipmentMods = normalizeStatMods(options.equipmentMods || player?.equipmentMods || {});
  const lootMods = normalizeStatMods(options.lootMods || player?.runLootMods || {});

  const damageMult = equipmentMods.damageMult
    * lootMods.damageMult
    * (1 + Math.max(0, toNumber(player?.thirdSpecDamageBonus, 0)))
    * toMultiplier(player?.universalDamageMult, 1)
    * toMultiplier(player?.natureDamageMult, 1);

  const fireRateMult = equipmentMods.fireRateMult
    * lootMods.fireRateMult
    * toMultiplier(player?.buildFireRateMult, 1)
    * toMultiplier(player?.offFireRateMult, 1)
    * Math.max(0.25, 1 - Math.max(0, toNumber(player?.thirdSpecFireRateBonus, 0)))
    * toMultiplier(player?.deathDuelFireRateMult, 1);

  const speedMult = equipmentMods.speedMult
    * lootMods.speedMult
    * toMultiplier(player?.natureMoveSpeedMult, 1)
    * toMultiplier(player?.controlMoveSpeedMult, 1);

  const rangeMult = equipmentMods.rangeMult
    * lootMods.rangeMult
    * toMultiplier(player?.universalRangeMult, 1)
    * toMultiplier(player?.natureRangeMult, 1);

  // 猎人射程升级改为百分比台阶，再统一乘范围倍率，保证成长更直观。
  const archerBaseRange = Math.round(
    toNumber(player?.archerArrowRangeBase, 330) * getArcherRangeMultiplier(player?.archerArrowRangeLevel || 0)
  );

  return {
    equipmentMods,
    lootMods,
    damageMult,
    fireRateMult,
    speedMult,
    rangeMult,
    maxHp: Math.max(1, Math.round(toNumber(player?.baseMaxHp, player?.maxHp || 100) + equipmentMods.maxHpFlat + lootMods.maxHpFlat)),
    bulletDamage: roundDamage(toNumber(player?.baseBulletDamage, 1) * damageMult),
    fireRate: Math.max(60, Math.round(toNumber(player?.baseFireRate, 60) * fireRateMult)),
    moveSpeed: Math.max(50, Math.round(toNumber(player?.baseMoveSpeed, 50) * speedMult)),
    warriorRange: Math.max(90, Math.round(toNumber(player?.warriorRangeBase, 220) * rangeMult)),
    archerArrowRange: Math.min(420, Math.round(archerBaseRange * rangeMult)),
    moonfireRange: Math.max(80, Math.round(toNumber(player?.moonfireRangeBase, 300) * rangeMult)),
    druidStarfallRange: Math.max(80, Math.round(toNumber(player?.druidStarfallRangeBase, 310) * rangeMult)),
    mageMissileRange: Math.max(80, Math.round(toNumber(player?.mageMissileRangeBase, player?.mageMissileRange || 280) * rangeMult)),
    warlockPoisonNovaRadius: Math.max(24, Math.round(toNumber(player?.warlockPoisonNovaRadiusBase, 96) * rangeMult)),
    warlockRange: Math.max(24, Math.round(toNumber(player?.warlockPoisonNovaRadiusBase, 96) * rangeMult))
  };
}

function getPlayerStateDamageMultiplier(attacker, target, now) {
  // 这里收口“攻击者当前状态”带来的临时增伤，避免散落在碰撞、激光、DOT 等路径里
  let multiplier = 1;

  if (attacker?.bloodrageEnabled && toNumber(attacker?.maxHp, 0) > 0) {
    const missingRatio = 1 - (toNumber(attacker?.hp, attacker?.maxHp) / Math.max(1, toNumber(attacker?.maxHp, 1)));
    const stacks = Math.max(0, Math.floor(missingRatio / 0.1));
    multiplier *= (1 + stacks * toNumber(attacker?.bloodragePerStack, 0.03));
  }

  if (toNumber(attacker?.battlecryUntil, 0) > now) {
    multiplier *= (1 + toNumber(attacker?.battlecryBonus, 0.15));
  }

  if (toNumber(attacker?.unyieldingExecutionerLevel, 0) > 0 && toNumber(target?.maxHp, 0) > 0) {
    const hpRatio = toNumber(target?.currentHp, target?.hp) / Math.max(1, toNumber(target?.maxHp, 1));
    if (hpRatio <= 0.35) {
      const executeBonus = [0, 0.12, 0.24, 0.36][Math.max(0, Math.min(3, Math.round(attacker?.unyieldingExecutionerLevel || 0)))] || 0;
      multiplier *= (1 + executeBonus);
    }
  }

  if (toNumber(attacker?.curseEmberUntil, 0) > now && toNumber(attacker?.curseEmberStacks, 0) > 0) {
    multiplier *= (1 + toNumber(attacker?.curseEmberStacks, 0) * 0.04);
  }

  if (toNumber(attacker?.natureRageUntil, 0) > now) {
    multiplier *= toMultiplier(attacker?.natureRageMult, 1.1);
  }

  if (attacker?.warlockExecute && toNumber(target?.maxHp, 0) > 0) {
    const hpRatio = toNumber(target?.currentHp, target?.hp) / Math.max(1, toNumber(target?.maxHp, 1));
    if (hpRatio < 0.3) {
      multiplier *= 2;
    }
  }

  return multiplier;
}

function getTargetDamageTakenMultiplier(target, now) {
  // 这里收口“目标身上状态”带来的承伤变化
  let multiplier = toMultiplier(target?.damageTakenMult, 1);

  if (target?.debuffs?.huntMarkEnd && now < target.debuffs.huntMarkEnd) {
    multiplier *= toMultiplier(target.debuffs.huntMarkMult, 1.1);
  }

  if (target?.debuffs?.natureHawkMarkUntil && now < target.debuffs.natureHawkMarkUntil) {
    multiplier *= toMultiplier(target.debuffs.natureHawkMarkMult, 1.08);
  }

  if (target?.debuffs?.arcaneCircleExposureUntil && now < target.debuffs.arcaneCircleExposureUntil) {
    multiplier *= toMultiplier(target.debuffs.arcaneCircleExposureMult, 1.08);
  }

  if (target?.debuffs?.warriorSunderUntil && now < target.debuffs.warriorSunderUntil) {
    multiplier *= toMultiplier(target.debuffs.warriorSunderMult, 1.06);
  }

  const poisonZoneStacks = Math.max(0, Math.round(target?.debuffs?.poisonZone?.stacks || 0));
  if (poisonZoneStacks > 0) {
    multiplier *= (1 + poisonZoneStacks * 0.03);
  }

  const divineJudgementLevel = Math.max(0, Math.min(3, Math.round(target?.debuffs?.divineJudgementLevel || 0)));
  if (divineJudgementLevel > 0 && (target?.debuffs?.divineJudgementUntil || 0) > now) {
    multiplier *= [1, 1.05, 1.09, 1.14][divineJudgementLevel] || 1.05;
  }

  return multiplier;
}

export function calculateResolvedDamage(options = {}) {
  // 统一出伤顺序：基础伤害 -> 攻击者增伤 -> 暴击 -> 目标承伤
  const {
    attacker = null,
    target = null,
    baseDamage = 0,
    now = 0,
    canCrit = true,
    extraCritChance = 0,
    extraMultiplier = 1,
    includePlayerStateBonuses = true,
    includeTargetModifiers = true,
    minimum = 1,
    forceCrit = null
  } = options;

  let amount = roundDamage(baseDamage, minimum);
  let damageMult = toMultiplier(extraMultiplier, 1) * toMultiplier(attacker?.damageDealtMult, 1);

  if (includePlayerStateBonuses) {
    damageMult *= getPlayerStateDamageMultiplier(attacker, target, now);
  }

  amount = roundDamage(amount * damageMult, minimum);

  // 猎人高血目标暴击加成也放在统一暴击入口，避免只在个别武器生效
  const critChanceBonus = attacker?.hunterCritBonus && target?.maxHp > 0 && (toNumber(target?.currentHp, target?.hp) / Math.max(1, toNumber(target?.maxHp, 1))) > 0.8
    ? toNumber(attacker.hunterCritBonus, 0)
    : 0;

  const packHunterLevel = Math.max(0, Math.min(3, Math.round(attacker?.rangerPackHunterLevel || 0)));
  const hasHuntMark = !!(target?.debuffs?.huntMarkEnd && now < target.debuffs.huntMarkEnd);
  const packHunterCritChanceBonus = hasHuntMark ? ([0, 0.06, 0.1, 0.14][packHunterLevel] || 0) : 0;
  const packHunterCritMultBonus = hasHuntMark ? ([0, 0.12, 0.2, 0.3][packHunterLevel] || 0) : 0;
  const eagleeyeLevel = Math.max(0, Math.min(3, Math.round(attacker?.archerEagleeye || 0)));
  const eagleeyeCritChanceBonus = eagleeyeLevel > 0
    ? (hasHuntMark
      ? ([0, 0.08, 0.14, 0.20][eagleeyeLevel] || 0)
      : ([0, 0.02, 0.04, 0.06][eagleeyeLevel] || 0))
    : 0;
  const eagleeyeCritMultBonus = eagleeyeLevel > 0 && hasHuntMark
    ? ([0, 0.15, 0.25, 0.40][eagleeyeLevel] || 0)
    : 0;

  const critChance = canCrit ? clampChance(toNumber(attacker?.critChance, 0) + critChanceBonus + packHunterCritChanceBonus + eagleeyeCritChanceBonus + toNumber(extraCritChance, 0)) : 0;
  const isCrit = forceCrit == null ? (canCrit && Math.random() < critChance) : !!forceCrit;

  if (isCrit) {
    amount = roundDamage(amount * (toMultiplier(attacker?.critMultiplier, 1.5) + packHunterCritMultBonus + eagleeyeCritMultBonus), minimum);
  }

  const targetMult = includeTargetModifiers ? getTargetDamageTakenMultiplier(target, now) : 1;
  amount = roundDamage(amount * targetMult, minimum);

  return {
    amount,
    isCrit,
    critChance,
    damageMult,
    targetMult
  };
}

export function resolvePlayerIncomingDamage(defender, incomingDamage, now = 0) {
  // 玩家承伤顺序：闪避 -> 固定减伤 -> 受击倍率 -> 职业减伤 -> 格挡
  const emergencyDodgeBonus = toNumber(defender?.emergencyDodgeUntil, 0) > now
    ? toNumber(defender?.emergencyDodgeBonus, 0)
    : 0;
  const dodgeChance = clampChance(
    toNumber(defender?.dodgeChance, 0)
      + toNumber(defender?.thirdSpecDodgeChanceBonus, 0)
      + toNumber(defender?.equipmentDodgeChance, 0)
      + emergencyDodgeBonus
  );
  const dodged = dodgeChance > 0 && Math.random() < dodgeChance;

  if (dodged) {
    return {
      dodged: true,
      blocked: false,
      finalDamage: 0
    };
  }

  let finalDamage = Math.max(0, Math.round(toNumber(incomingDamage, 0) - toNumber(defender?.flatDamageReduction, 0)));
  finalDamage = Math.max(0, Math.round(finalDamage * (1 - clampChance(
    toNumber(defender?.damageReductionPercent, 0)
      + toNumber(defender?.thirdSpecDamageReductionBonus, 0)
  ))));
  finalDamage = Math.max(0, Math.round(finalDamage * toMultiplier(defender?.natureDamageTakenMult, 1)));

  if (toNumber(defender?.emergencyMitigationUntil, 0) > now) {
    finalDamage = Math.max(0, Math.round(finalDamage * toMultiplier(defender?.emergencyMitigationMult, 1)));
  }

  if (defender?.mainCoreKey === 'warrior' && toNumber(defender?.warriorGuardUntil, 0) > now) {
    const guardReduction = Math.max(0, Math.min(0.8, toNumber(defender?.warriorGuardReduction, 0)));
    finalDamage = Math.max(0, Math.round(finalDamage * (1 - guardReduction)));
  }

  if (defender?.unyieldingStandfastActive && toNumber(defender?.unyieldingStandfastLevel, 0) > 0) {
    const standfastReduction = [0, 0.06, 0.12, 0.18][Math.max(0, Math.min(3, Math.round(defender?.unyieldingStandfastLevel || 0)))] || 0;
    finalDamage = Math.max(0, Math.round(finalDamage * (1 - standfastReduction)));
  }

  if (toNumber(defender?.guardianSealStacks, 0) > 0 && toNumber(defender?.guardianSacredSealLevel, 0) > 0) {
    const perStack = [0, 0.02, 0.03, 0.04][Math.max(0, Math.min(3, Math.round(defender?.guardianSacredSealLevel || 0)))] || 0;
    finalDamage = Math.max(0, Math.round(finalDamage * (1 - Math.min(0.35, perStack * toNumber(defender?.guardianSealStacks, 0)))));
  }

  const blockChance = clampChance(toNumber(defender?.blockChance, 0) + toNumber(defender?.guardianBlockBonus, 0));
  const blocked = blockChance > 0 && Math.random() < blockChance;
  if (blocked) {
    finalDamage = Math.max(0, Math.round(finalDamage * 0.5));
  }

  return {
    dodged: false,
    blocked,
    finalDamage,
    evaluatedAt: now
  };
}