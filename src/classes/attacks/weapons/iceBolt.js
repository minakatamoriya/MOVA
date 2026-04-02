import Phaser from 'phaser';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

function collectTargets(scene) {
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];
  const targets = [];

  if (boss && boss.isAlive) targets.push(boss);
  if (Array.isArray(minions)) {
    minions.forEach((target) => {
      if (target && target.isAlive) targets.push(target);
    });
  }

  return targets;
}

function getRangeCenter(player) {
  if (player && typeof player.getHitboxPosition === 'function') {
    const hitbox = player.getHitboxPosition();
    if (hitbox && Number.isFinite(hitbox.x) && Number.isFinite(hitbox.y)) {
      return { x: hitbox.x, y: hitbox.y };
    }
  }
  return { x: player.x, y: player.y };
}

function selectTarget(player, range) {
  const scene = player?.scene;
  if (!scene) return null;

  const targets = collectTargets(scene);
  if (targets.length === 0) return null;

  const center = getRangeCenter(player);
  let best = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > range * range) continue;

    if (target.isBoss) return target;
    if (distanceSq < bestDistanceSq) {
      best = target;
      bestDistanceSq = distanceSq;
    }
  }

  return best;
}

export function fireMageIceBolt(player, options = {}) {
  const scene = player?.scene;
  if (!scene) return false;

  const range = Math.max(80, Math.round(player.mageMissileRange || player.mageMissileRangeBase || 280));
  const target = (options.target && options.target.isAlive) ? options.target : selectTarget(player, range);
  if (!target) return false;

  const scheme = getBasicSkillColorScheme(player.mainCoreKey || 'mage', player.offCoreKey);
  const veinsLevel = Math.max(0, Math.min(3, player.mageIceVeinsLevel || 0));
  const speed = 400 + veinsLevel * 24;
  const damageMult = [1, 1.1, 1.2, 1.3][veinsLevel] || 1;
  const radius = 6 + Math.min(2, veinsLevel);
  const iceCore = 0xf2fdff;
  const iceStroke = 0x8fdcff;
  const iceHighlight = 0xffffff;
  const iceFeather = 0xd5f7ff;
  const spawnY = player.y - (player.visualRadius || 15) * 0.35;
  const angle = Number.isFinite(options.fireAngle)
    ? options.fireAngle
    : Phaser.Math.Angle.Between(player.x, spawnY, target.x, target.y);
  const spawnX = player.x + Math.cos(angle) * Math.max(10, (player.visualRadius || 15) * 0.55);
  const rangeLifeMs = Math.max(260, Math.round((range / Math.max(1, speed * 1.35)) * 1000));

  const bullet = scene.createManagedPlayerBullet(spawnX, spawnY, iceCore, {
    radius,
    speed,
    damage: Math.max(1, Math.round((player.bulletDamage || 1) * damageMult)),
    angleOffset: angle,
    isAbsoluteAngle: true,
    type: 'spear',
    hasGlow: true,
    hasTrail: true,
    glowRadius: 22 + veinsLevel * 3,
    glowColor: 0x9cecff,
    strokeColor: iceStroke,
    arrowLenMult: 2.85,
    arrowThickMult: 0.96,
    arrowHighlightColor: iceHighlight,
    arrowFeatherColor: iceFeather,
    trailColor: scheme?.highlight || 0xa9ecff,
    trailIntervalMs: 24,
    trailLifeMs: 240,
    trailAlpha: 0.86,
    trailScale: 1.1,
    trailMode: 'streak',
    trailScaleX: 6.8,
    trailScaleY: 0.22,
    homing: true,
    homingTurn: 0.038,
    speedStartMult: 0.34,
    speedEndMult: 1.7,
    speedRampMs: 96,
    maxLifeMs: rangeLifeMs,
    tags: ['player_mage_frostbolt']
  });

  if (!bullet) return false;

  bullet.frostSpell = true;
  bullet.lockTarget = target;
  bullet.homingMode = 'fan_lock';
  bullet.homingTurnRadPerSec = Phaser.Math.DegToRad(280);
  bullet.ignoreNonTargetCollision = true;
  bullet.hitEffectColor = 0xdaf7ff;
  bullet.damageNumberAtTarget = true;
  bullet.visualAccentColor = iceStroke;
  bullet.visualCoreColor = iceCore;

  player.bullets.push(bullet);
  while (player.bullets.length > player.maxBullets) {
    player.bullets.shift();
  }

  return true;
}