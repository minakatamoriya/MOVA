import Phaser from 'phaser';
import { PRESSURE_TICK_MS } from '../config/prototypeSceneConfig';
import { CORE_DEFENSE_ENEMY_DEFS } from '../../config/waveTimeline';
import { getNextBattleExp } from '../config/progressionCatalog';
import { spawnCoinBurst } from './coinDrops';
import { distanceSq } from '../utils/math';
import { showDamageNumber } from '../utils/combatFeedback';

const ELITE_AURA_TINT = 0x75ff9b;
const ELITE_AURA_STYLE = {
  haste: {
    tint: 0xffc56a,
    bar: 0xffc56a,
    icon: '>>',
  },
  guard: {
    tint: 0x8ebeff,
    bar: 0x8ebeff,
    icon: '盾',
  },
  corrosion: {
    tint: 0x75ff9b,
    bar: 0x8dff72,
    icon: '蚀',
  },
};

function setEliteHpBar(enemy) {
  if (!enemy?.eliteHpBarBg || !enemy?.eliteHpBarFill) return;
  const width = 42;
  const hpRatio = Phaser.Math.Clamp(enemy.hp / Math.max(1, enemy.maxHp || 1), 0, 1);
  const fillWidth = Math.max(2, Math.round(width * hpRatio));
  const auraStyle = ELITE_AURA_STYLE[enemy.eliteAuraType] || ELITE_AURA_STYLE.corrosion;
  enemy.eliteHpBarBg.setPosition(enemy.x, enemy.y - (enemy.radius + 18));
  enemy.eliteHpBarFill.setPosition(enemy.x - 21, enemy.y - (enemy.radius + 18));
  enemy.eliteHpBarFill.width = fillWidth;
  enemy.eliteHpBarFill.setFillStyle(hpRatio > 0.55 ? auraStyle.bar : (hpRatio > 0.28 ? 0xffd45c : 0xff6b78), 1);
  enemy.eliteLabelText?.setPosition?.(enemy.x, enemy.y - (enemy.radius + 48));
  enemy.eliteIconText?.setPosition?.(enemy.x, enemy.y - (enemy.radius + 34));
}

function destroyEnemyVisuals(enemy) {
  enemy?.display?.destroy?.();
  enemy?.eliteAura?.destroy?.();
  enemy?.eliteAuraRing?.destroy?.();
  enemy?.eliteHpBarBg?.destroy?.();
  enemy?.eliteHpBarFill?.destroy?.();
  enemy?.eliteLabelText?.destroy?.();
  enemy?.eliteIconText?.destroy?.();
}

function applyEliteAuraBuffs(scene, enemies) {
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy || enemy.hp <= 0) continue;
    enemy.speed = enemy.baseSpeed ?? enemy.speed;
    enemy.pressure = enemy.basePressure ?? enemy.pressure;
    enemy.threat = enemy.baseThreat ?? enemy.threat;
    enemy.remoteThreat = enemy.baseRemoteThreat ?? enemy.remoteThreat;
    enemy.remotePressure = enemy.baseRemotePressure ?? enemy.remotePressure;
    enemy.damageTakenMultiplier = 1;
    enemy.isAuraBuffed = false;
    if (!enemy.isEliteAnchor) {
      enemy.display?.setStrokeStyle?.(2, 0x000000, 0.35);
    }
  }

  const elites = enemies.filter((enemy) => enemy && enemy.hp > 0 && enemy.isEliteAnchor);
  for (let i = 0; i < elites.length; i += 1) {
    const elite = elites[i];
    const auraRadiusSq = Math.max(0, Number(elite.eliteAuraRadius || 0)) ** 2;
    const auraStrength = Math.max(0, Number(elite.eliteAuraStrength || 0));
    const auraStyle = ELITE_AURA_STYLE[elite.eliteAuraType] || ELITE_AURA_STYLE.corrosion;
    elite.eliteAura?.setRadius?.(elite.eliteAuraRadius);
    elite.eliteAuraRing?.setRadius?.(Math.max(8, elite.eliteAuraRadius - 12));
    elite.eliteAura?.setFillStyle?.(auraStyle.tint, 0.08);
    elite.eliteAura?.setStrokeStyle?.(2, auraStyle.tint, 0.42);
    elite.eliteAuraRing?.setStrokeStyle?.(2, auraStyle.tint, 0.26);
    elite.eliteIconText?.setText?.(auraStyle.icon);
    if (elite.eliteAura?.active) {
      elite.eliteAura.x = elite.x;
      elite.eliteAura.y = elite.y;
    }
    if (elite.eliteAuraRing?.active) {
      elite.eliteAuraRing.x = elite.x;
      elite.eliteAuraRing.y = elite.y;
    }
    setEliteHpBar(elite);

    for (let j = 0; j < enemies.length; j += 1) {
      const enemy = enemies[j];
      if (!enemy || enemy.hp <= 0 || enemy.id === elite.id) continue;
      const d2 = distanceSq(enemy.x, enemy.y, elite.x, elite.y);
      if (d2 > auraRadiusSq) continue;
      if (elite.eliteAuraType === 'haste') {
        enemy.speed = (enemy.baseSpeed ?? enemy.speed) * (1 + auraStrength * 0.8);
        enemy.threat = (enemy.baseThreat ?? enemy.threat) * (1 + auraStrength * 0.22);
      } else if (elite.eliteAuraType === 'guard') {
        enemy.damageTakenMultiplier = Math.min(enemy.damageTakenMultiplier, 1 - (auraStrength * 0.45));
        enemy.pressure = (enemy.basePressure ?? enemy.pressure) * (1 + auraStrength * 0.18);
      } else {
        enemy.pressure = (enemy.basePressure ?? enemy.pressure) * (1 + auraStrength * 0.7);
        enemy.threat = (enemy.baseThreat ?? enemy.threat) * (1 + auraStrength * 0.55);
        enemy.remoteThreat = (enemy.baseRemoteThreat ?? enemy.remoteThreat) * (1 + auraStrength * 0.55);
        enemy.remotePressure = (enemy.baseRemotePressure ?? enemy.remotePressure) * (1 + auraStrength * 0.7);
      }
      enemy.isAuraBuffed = true;
      enemy.display?.setStrokeStyle?.(2, auraStyle.tint, 0.8);
    }
  }
}

function applyIncomingDamage(enemy, amount) {
  const multiplier = Phaser.Math.Clamp(Number(enemy?.damageTakenMultiplier ?? 1), 0.35, 1);
  return Math.max(1, Math.round(Number(amount || 0) * multiplier));
}

function getEnemyBaseGold(enemy) {
  const def = CORE_DEFENSE_ENEMY_DEFS[enemy?.type] || null;
  const fallback = Math.max(1, Math.round(Number(enemy?.score || 1) * 3));
  return Math.max(1, Math.round(Number(def?.goldDrop || fallback)));
}

function shouldDropGold(enemy) {
  const def = CORE_DEFENSE_ENEMY_DEFS[enemy?.type] || null;
  const chance = Phaser.Math.Clamp(Number(def?.goldDropChance ?? 1), 0, 1);
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return Math.random() <= chance;
}

function getFrontlineGoldMultiplier(scene, enemy) {
  if (!scene?.metrics?.zones?.frontline || !enemy) return 1;
  const frontlineY = scene.metrics.zones.frontline.y;
  const coreY = scene.metrics.core.y;
  if (enemy.y <= frontlineY) return 1;
  const travelSpan = Math.max(40, coreY - frontlineY);
  const coreDepth = Phaser.Math.Clamp((enemy.y - frontlineY) / travelSpan, 0, 1);
  return 1 + ((1 - coreDepth) * 0.35);
}

export function updateEnemies(scene, delta) {
  const dt = Math.max(0, Number(delta || 0)) / 1000;
  const nextEnemies = [];
  const frontlineY = scene.metrics.zones.frontline.y;
  const slowfieldLevel = scene.coreModuleLevels.core_slowfield || 0;
  const slowfieldRadius = scene.metrics.core.threatRadius + ((scene.coreModuleLevels.core_bastion || 0) * 18);
  const slowfieldRadiusSq = slowfieldRadius * slowfieldRadius;

  applyEliteAuraBuffs(scene, scene.enemies);

  for (let i = 0; i < scene.enemies.length; i += 1) {
    const enemy = scene.enemies[i];
    if (!enemy || enemy.hp <= 0) {
      if (enemy?.id && enemy.id === scene.currentEliteAnchorId) {
        scene.currentEliteAnchorId = null;
      }
      destroyEnemyVisuals(enemy);
      continue;
    }

    if (enemy.type === 'anchor' && !enemy.stopped && enemy.anchorY != null && enemy.y >= enemy.anchorY) {
      enemy.stopped = true;
    }

    if (!enemy.stopped) {
      const targetX = scene.metrics.core.x + scene.getLaneBias(enemy);
      const targetY = scene.metrics.core.y;
      const vx = targetX - enemy.x;
      const vy = targetY - enemy.y;
      const dist = Math.max(0.0001, Math.hypot(vx, vy));
      let moveSpeed = enemy.speed;
      if (slowfieldLevel > 0 && distanceSq(enemy.x, enemy.y, scene.metrics.core.x, scene.metrics.core.y) <= slowfieldRadiusSq) {
        const slowRate = Math.min(0.5, 0.12 + (slowfieldLevel * 0.1));
        moveSpeed *= (1 - slowRate);
      }
      enemy.x += (vx / dist) * moveSpeed * dt;
      enemy.y += (vy / dist) * moveSpeed * dt;
    }

    enemy.enteredFrontline = enemy.enteredFrontline || enemy.y >= frontlineY;
    enemy.display.x = enemy.x;
    enemy.display.y = enemy.y;
    if (enemy.isEliteAnchor) {
      if (enemy.eliteAura?.active) {
        enemy.eliteAura.x = enemy.x;
        enemy.eliteAura.y = enemy.y;
      }
      if (enemy.eliteAuraRing?.active) {
        enemy.eliteAuraRing.x = enemy.x;
        enemy.eliteAuraRing.y = enemy.y;
      }
      setEliteHpBar(enemy);
    }
    nextEnemies.push(enemy);
  }

  scene.enemies = nextEnemies;
}

export function getThreatTierLabel(threat) {
  if (threat >= 18) return '失控';
  if (threat >= 11) return '高';
  if (threat >= 5) return '中';
  return '低';
}

export function refreshCoreThreatFeedback(scene) {
  const threat = Number(scene.currentThreat || 0);
  let auraAlpha = 0.06;
  let auraStrokeAlpha = 0.22;
  let coreTint = 0x7c5cff;

  if (threat >= 18) {
    auraAlpha = 0.18;
    auraStrokeAlpha = 0.48;
    coreTint = 0xff6b8a;
  } else if (threat >= 11) {
    auraAlpha = 0.12;
    auraStrokeAlpha = 0.38;
    coreTint = 0xffa86b;
  } else if (threat >= 5) {
    auraAlpha = 0.09;
    auraStrokeAlpha = 0.28;
    coreTint = 0xffd36b;
  }

  scene.coreThreatAura.setFillStyle(0xffd36b, auraAlpha);
  scene.coreThreatAura.setStrokeStyle(2, 0xffd36b, auraStrokeAlpha);
  scene.core.setFillStyle(coreTint, 0.95);
}

export function updatePressure(scene, time) {
  if ((time - scene.lastPressureTickAt) < PRESSURE_TICK_MS) return;
  scene.lastPressureTickAt = time;

  const { core } = scene.metrics;
  let threat = 0;
  let directPressure = 0;
  let remotePressure = 0;
  let remoteThreat = 0;
  const threatRadiusSq = core.threatRadius * core.threatRadius;
  const pressureRadiusSq = core.pressureRadius * core.pressureRadius;

  for (let i = 0; i < scene.enemies.length; i += 1) {
    const enemy = scene.enemies[i];
    if (!enemy || enemy.hp <= 0) continue;
    const d2 = distanceSq(enemy.x, enemy.y, core.x, core.y);
    if (d2 <= threatRadiusSq) {
      threat += Number(enemy.threat || enemy.pressure || 0);
    }
    if (d2 <= pressureRadiusSq) {
      directPressure += Number(enemy.pressure || 0);
    } else if (enemy.type === 'anchor' && enemy.stopped) {
      remotePressure += Number(enemy.remotePressure || 0);
      remoteThreat += Number(enemy.remoteThreat || 0);
    }
  }

  scene.currentThreat = threat + remoteThreat;
  const totalPressure = directPressure + remotePressure;
  scene.currentPressure = totalPressure;
  scene.currentThreatTier = getThreatTierLabel(scene.currentThreat);
  const softenedPressure = totalPressure <= 10 ? totalPressure : (10 + Math.sqrt(totalPressure - 10) * 3.2);
  const damage = Math.round(softenedPressure * 3.5);

  refreshCoreThreatFeedback(scene);

  if (damage > 0) {
    let pendingDamage = damage;
    const interceptorLevel = scene.coreModuleLevels.core_interceptor || 0;
    if (interceptorLevel > 0) {
      const reductionRate = hasActiveEliteAnchor(scene)
        ? Math.min(0.52, 0.1 + (interceptorLevel * 0.09))
        : Math.min(0.42, 0.08 + (interceptorLevel * 0.07));
      pendingDamage = Math.max(0, Math.round(pendingDamage * (1 - reductionRate)));
    }
    if (scene.coreShield > 0) {
      const absorbed = Math.min(scene.coreShield, pendingDamage);
      scene.coreShield -= absorbed;
      pendingDamage -= absorbed;
    }
    scene.coreHp = Math.max(0, scene.coreHp - pendingDamage);
    scene.tweens.add({ targets: scene.core, scaleX: 1.08, scaleY: 1.08, duration: 80, yoyo: true, ease: 'Sine.easeOut' });
  }

  if (scene.coreHp <= 0) {
    scene.resolveRound(false, '核心被怪潮压垮');
  }
}

export function updateCoreModules(scene, time) {
  const burnLevel = scene.coreModuleLevels.core_burn || 0;
  if (burnLevel > 0 && (time - scene.coreModuleRuntime.lastBurnAt) >= Math.max(700, 1300 - (burnLevel * 90))) {
    scene.coreModuleRuntime.lastBurnAt = time;
    const bastionLevel = scene.coreModuleLevels.core_bastion || 0;
    const burnRadius = scene.metrics.core.pressureRadius + 22 + (bastionLevel * 10);
    const burnRadiusSq = burnRadius * burnRadius;
    let burnedAnyEnemy = false;
    const burnDamage = 8 + (burnLevel * 6);

    for (let i = 0; i < scene.enemies.length; i += 1) {
      const enemy = scene.enemies[i];
      if (!enemy || enemy.hp <= 0) continue;
      const d2 = distanceSq(enemy.x, enemy.y, scene.metrics.core.x, scene.metrics.core.y);
      if (d2 > burnRadiusSq) continue;
      const resolvedDamage = applyIncomingDamage(enemy, burnDamage);
      enemy.hp -= resolvedDamage;
      showDamageNumber(scene, enemy.x, enemy.y - Math.max(18, enemy.radius + 16), resolvedDamage, { color: '#ff9b5f', fontSize: 18, whisper: true });
      burnedAnyEnemy = true;
      if (enemy.hp <= 0) {
        handleEnemyDefeat(scene, enemy, 0xffa86b);
      }
    }

    if (burnedAnyEnemy) {
      const burnPulse = scene.add.circle(scene.metrics.core.x, scene.metrics.core.y, burnRadius, 0xffa86b, 0.12);
      scene.tweens.add({ targets: burnPulse, alpha: 0, scaleX: 1.12, scaleY: 1.12, duration: 220, onComplete: () => burnPulse.destroy() });
    }
  }

  const recoveryLevel = scene.coreModuleLevels.core_recovery || 0;
  if (recoveryLevel > 0 && scene.currentPressure <= 0.01 && (time - scene.coreModuleRuntime.lastRecoveryAt) >= Math.max(3500, 6500 - (recoveryLevel * 500))) {
    scene.coreModuleRuntime.lastRecoveryAt = time;
    const recoveryAmount = 12 + (recoveryLevel * 8);
    scene.coreShieldMax = Math.max(scene.coreShieldMax, 30 + (recoveryLevel * 25) + ((scene.coreModuleLevels.core_bastion || 0) * 20));
    scene.coreShield = Math.min(scene.coreShieldMax, scene.coreShield + recoveryAmount);
    showDamageNumber(scene, scene.metrics.core.x, scene.metrics.core.y - 74, `盾+${recoveryAmount}`, { color: '#b8f2ff', fontSize: 18, whisper: true });
    scene.tweens.add({ targets: scene.coreAura, alpha: 0.32, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
  }

  const overloadLevel = scene.coreModuleLevels.core_overload || 0;
  if (overloadLevel > 0 && (time - scene.coreModuleRuntime.lastOverloadAt) >= Math.max(3600, 5600 - (overloadLevel * 500))) {
    scene.coreModuleRuntime.lastOverloadAt = time;
    const overloadTarget = findOverloadTarget(scene);
    if (overloadTarget) {
      const overloadDamage = 16 + (overloadLevel * 12);
      const resolvedDamage = applyIncomingDamage(overloadTarget, overloadDamage);
      overloadTarget.hp -= resolvedDamage;
      showDamageNumber(scene, overloadTarget.x, overloadTarget.y - Math.max(18, overloadTarget.radius + 18), resolvedDamage, { color: '#ffe082', fontSize: 20, whisper: true });
      const beam = scene.add.line(0, 0, scene.metrics.core.x, scene.metrics.core.y, overloadTarget.x, overloadTarget.y, 0xffd36b, 0.86)
        .setOrigin(0, 0)
        .setLineWidth(4, 4);
      scene.tweens.add({ targets: beam, alpha: 0, duration: 120, onComplete: () => beam.destroy() });
      if (overloadTarget.hp <= 0) {
        handleEnemyDefeat(scene, overloadTarget, 0xffd36b);
      }
    }
  }
}

export function canPlayerAttackEnemy(scene, enemy) {
  if (!enemy) return false;
  return Boolean(enemy.enteredFrontline || enemy.y >= scene.metrics.zones.frontline.y);
}

export function updateAutoAttack(scene, time) {
  if ((time - scene.lastAttackAt) < scene.classOption.fireIntervalMs) return;

  let best = null;
  let bestDistSq = Infinity;
  const maxRangeSq = scene.classOption.attackRange * scene.classOption.attackRange;

  for (let i = 0; i < scene.enemies.length; i += 1) {
    const enemy = scene.enemies[i];
    if (!enemy || enemy.hp <= 0) continue;
    if (!canPlayerAttackEnemy(scene, enemy)) continue;
    const d2 = distanceSq(scene.player.x, scene.player.y, enemy.x, enemy.y);
    if (d2 > maxRangeSq) continue;
    if (d2 < bestDistSq) {
      best = enemy;
      bestDistSq = d2;
    }
  }

  if (!best) return;
  scene.lastAttackAt = time;
  const critChance = Math.min(0.95, scene.playerCritChance);
  const isCrit = Math.random() < critChance;
  const baseDamage = scene.classOption.attackDamage;
  const rawDamage = Math.max(1, Math.round(baseDamage * (isCrit ? scene.playerCritMultiplier : 1)));
  const damageAmount = applyIncomingDamage(best, rawDamage);
  best.hp -= damageAmount;
  showDamageNumber(scene, best.x, best.y - Math.max(18, best.radius + 18), damageAmount, { color: '#ffe082', fontSize: 22, whisper: true, isCrit });

  const line = scene.add.line(0, 0, scene.player.x, scene.player.y, best.x, best.y, scene.classOption.color, 0.9)
    .setOrigin(0, 0)
    .setLineWidth(3, 3);
  scene.tweens.add({ targets: line, alpha: 0, duration: 100, onComplete: () => line.destroy() });

  if (best.hp <= 0) {
    handleEnemyDefeat(scene, best, scene.classOption.color);
  }
}

export function gainBattleExp(scene, amount) {
  const gained = Math.max(0, Math.round(amount || 0));
  if (gained <= 0) return;
  scene.battleExp += gained;
  while (scene.battleExp >= scene.nextBattleExp) {
    scene.battleExp -= scene.nextBattleExp;
    scene.battleLevel += 1;
    scene.nextBattleExp = getNextBattleExp(scene.battleLevel);
    showDamageNumber(scene, scene.player.x, scene.player.y - 74, `Lv.${scene.battleLevel}`, { color: '#ffe18a', fontSize: 20, whisper: true });
    if (scene.isUpgradeMenuOpen) {
      scene.refreshUpgradeMenu();
    }
  }
}

export function handleEnemyDefeat(scene, enemy, burstColor) {
  if (!enemy || enemy.rewardGranted) return;
  enemy.rewardGranted = true;
  enemy.hp = 0;
  if (enemy.id === scene.currentEliteAnchorId) {
    scene.currentEliteAnchorId = null;
  }
  const baseScore = Number(enemy.score || 1);
  const baseGold = getEnemyBaseGold(enemy);
  const baseExp = Math.max(1, Math.round(baseScore));
  const eliteGoldBonus = enemy.isEliteAnchor ? 28 : 0;
  const eliteExpBonus = enemy.isEliteAnchor ? 6 : 0;
  const frontlineMultiplier = getFrontlineGoldMultiplier(scene, enemy);
  const totalGoldReward = shouldDropGold(enemy)
    ? Math.max(1, Math.round((baseGold * frontlineMultiplier) + eliteGoldBonus))
    : (enemy.isEliteAnchor ? eliteGoldBonus : 0);

  scene.score += baseScore;
  gainBattleExp(scene, baseExp + eliteExpBonus);
  if (totalGoldReward > 0) {
    spawnCoinBurst(scene, enemy.x, enemy.y, totalGoldReward, { isElite: enemy.isEliteAnchor });
  }

  const burst = scene.add.circle(enemy.x, enemy.y, enemy.radius + 8, burstColor || 0xffffff, 0.4);
  scene.tweens.add({ targets: burst, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 180, onComplete: () => burst.destroy() });
}

export function findOverloadTarget(scene) {
  const elite = scene.enemies.find((enemy) => enemy && enemy.hp > 0 && enemy.isEliteAnchor);
  if (elite) return elite;

  const threatRadius = scene.metrics.core.threatRadius + ((scene.coreModuleLevels.core_bastion || 0) * 18);
  const threatRadiusSq = threatRadius * threatRadius;
  let best = null;
  let bestThreat = -1;
  for (let i = 0; i < scene.enemies.length; i += 1) {
    const enemy = scene.enemies[i];
    if (!enemy || enemy.hp <= 0) continue;
    const d2 = distanceSq(enemy.x, enemy.y, scene.metrics.core.x, scene.metrics.core.y);
    if (d2 > threatRadiusSq) continue;
    const enemyThreat = Number(enemy.threat || 0) + Number(enemy.remoteThreat || 0);
    if (enemyThreat > bestThreat) {
      best = enemy;
      bestThreat = enemyThreat;
    }
  }
  return best;
}

export function hasActiveEliteAnchor(scene) {
  if (!scene.currentEliteAnchorId) return false;
  return scene.enemies.some((enemy) => enemy && enemy.id === scene.currentEliteAnchorId && enemy.hp > 0);
}

export function shouldSpawnEliteAnchorForWave(scene, directorState) {
  if (!directorState) return false;
  if (directorState.groupIndex < 1) return false;
  if (directorState.isRecoveryWindow) return false;
  if (directorState.waveKey !== 'peak' && directorState.waveKey !== 'layer') return false;
  if (hasActiveEliteAnchor(scene)) return false;
  return scene.currentEliteWaveIndex !== directorState.waveIndex;
}