import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

const PALADIN_HAMMER_CONFIG = Object.freeze({
  baseFireRate: 1160,
  baseAcquireRange: 220,
  pierceAcquireRangeMult: 1.12,
  baseImpactRadius: 72,
  pierceImpactRadiusMult: 1.24,
  baseDamageMult: 0.78,
  pierceDamageMult: 0.96,
  windupMs: 180,
  windupMinMs: 100,
  windupMaxMs: 280,
  markerLeadMs: 70,
  markerLeadMinMs: 40,
  markerLeadMaxMs: 110,
  trailWindow: 0.26,
  trailSteps: 18
});

export function getPaladinHammerAcquireRange(player) {
  return player?.paladinPierce
    ? Math.round(PALADIN_HAMMER_CONFIG.baseAcquireRange * PALADIN_HAMMER_CONFIG.pierceAcquireRangeMult)
    : PALADIN_HAMMER_CONFIG.baseAcquireRange;
}

export function getPaladinHammerImpactRadius(player) {
  const divineLevel = Phaser.Math.Clamp(Math.round(player?.paladinDivine || 0), 0, 3);
  const base = player?.paladinPierce
    ? Math.round(PALADIN_HAMMER_CONFIG.baseImpactRadius * PALADIN_HAMMER_CONFIG.pierceImpactRadiusMult)
    : PALADIN_HAMMER_CONFIG.baseImpactRadius;
  return Math.round(base * ([1, 1.10, 1.22, 1.36][divineLevel] || 1));
}

function getPaladinHammerDamageMultiplier(player) {
  const avengerLevel = Phaser.Math.Clamp(Math.round(player?.paladinAvengerLevel || 0), 0, 3);
  const divineLevel = Phaser.Math.Clamp(Math.round(player?.paladinDivine || 0), 0, 3);
  const base = player?.paladinPierce
    ? PALADIN_HAMMER_CONFIG.pierceDamageMult
    : PALADIN_HAMMER_CONFIG.baseDamageMult;
  return base * ([1, 1.08, 1.18, 1.30][avengerLevel] || 1) * ([1, 1.06, 1.12, 1.18][divineLevel] || 1);
}

function getPaladinHammerTiming(player) {
  const fireRate = Number.isFinite(player?.fireRate) && player.fireRate > 0
    ? player.fireRate
    : PALADIN_HAMMER_CONFIG.baseFireRate;
  const ratio = fireRate / PALADIN_HAMMER_CONFIG.baseFireRate;
  return {
    windupMs: Phaser.Math.Clamp(
      Math.round(PALADIN_HAMMER_CONFIG.windupMs * ratio),
      PALADIN_HAMMER_CONFIG.windupMinMs,
      PALADIN_HAMMER_CONFIG.windupMaxMs
    ),
    markerLeadMs: Phaser.Math.Clamp(
      Math.round(PALADIN_HAMMER_CONFIG.markerLeadMs * ratio),
      PALADIN_HAMMER_CONFIG.markerLeadMinMs,
      PALADIN_HAMMER_CONFIG.markerLeadMaxMs
    )
  };
}

function getQuadraticPoint(t, start, control, end) {
  const inv = 1 - t;
  return {
    x: (inv * inv * start.x) + (2 * inv * t * control.x) + (t * t * end.x),
    y: (inv * inv * start.y) + (2 * inv * t * control.y) + (t * t * end.y)
  };
}

function drawQuadraticSegment(graphics, start, control, end, fromT, toT, width, color, alpha, steps) {
  if (!graphics || toT <= fromT) return;
  graphics.lineStyle(width, color, alpha);
  graphics.beginPath();
  const first = getQuadraticPoint(fromT, start, control, end);
  graphics.moveTo(first.x, first.y);
  for (let i = 1; i <= steps; i++) {
    const t = fromT + ((toT - fromT) * (i / steps));
    const p = getQuadraticPoint(t, start, control, end);
    graphics.lineTo(p.x, p.y);
  }
  graphics.strokePath();
}

function spawnHammerSweep(scene, start, control, end, scheme, windupMs) {
  const sweep = scene.add.graphics();
  const coreGlow = scene.add.circle(start.x, start.y, 12, 0xffffff, 0.20);
  const coreSpark = scene.add.circle(start.x, start.y, 6, scheme.coreBright || scheme.coreColor, 0.95);
  sweep.setDepth(9);
  sweep.setBlendMode(Phaser.BlendModes.ADD);
  coreGlow.setDepth(10);
  coreGlow.setBlendMode(Phaser.BlendModes.ADD);
  coreSpark.setDepth(11);
  coreSpark.setBlendMode(Phaser.BlendModes.ADD);

  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: windupMs,
    ease: 'Cubic.Out',
    onUpdate: (tween) => {
      if (!sweep.active) return;
      const progress = tween.getValue();
      const tail = Math.max(0, progress - PALADIN_HAMMER_CONFIG.trailWindow);
      const tip = getQuadraticPoint(progress, start, control, end);
      sweep.clear();
      drawQuadraticSegment(sweep, start, control, end, tail, progress, 24, scheme.accentColor || scheme.coreColor, 0.14, PALADIN_HAMMER_CONFIG.trailSteps);
      drawQuadraticSegment(sweep, start, control, end, tail, progress, 14, scheme.coreBright || scheme.coreColor, 0.92, PALADIN_HAMMER_CONFIG.trailSteps);
      drawQuadraticSegment(sweep, start, control, end, Math.max(tail, progress - 0.13), progress, 7, 0xffffff, 0.75, 10);
      coreGlow.setPosition(tip.x, tip.y);
      coreGlow.setScale(1 + progress * 0.55);
      coreGlow.setAlpha(0.16 + progress * 0.12);
      coreSpark.setPosition(tip.x, tip.y);
      coreSpark.setScale(0.9 + progress * 0.35);
      coreSpark.setAlpha(0.9);
    },
    onComplete: () => {
      if (sweep && sweep.active) sweep.destroy();
      if (coreGlow && coreGlow.active) coreGlow.destroy();
      if (coreSpark && coreSpark.active) coreSpark.destroy();
    }
  });
}

function spawnImpactMarker(scene, x, y, radius, scheme, markerLeadMs) {
  const flash = scene.add.circle(x, y, Math.max(14, Math.round(radius * 0.24)), scheme.coreBright || scheme.coreColor, 0.14);
  flash.setDepth(8);
  flash.setBlendMode(Phaser.BlendModes.ADD);

  const ring = scene.add.circle(x, y, Math.max(20, Math.round(radius * 0.4)), scheme.coreColor, 0.05);
  ring.setStrokeStyle(3, scheme.coreBright || scheme.coreColor, 0.9);
  ring.setDepth(8);

  scene.tweens.add({
    targets: [flash, ring],
    alpha: 0,
    scale: 1.18,
    duration: markerLeadMs,
    ease: 'Sine.Out',
    onComplete: () => {
      if (flash && flash.active) flash.destroy();
      if (ring && ring.active) ring.destroy();
    }
  });
}

export function firePaladinHammer(player) {
  if (!player?.scene) return false;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  const hp = player.getHitboxPosition?.();
  const px = (hp && Number.isFinite(hp.x)) ? hp.x : player.x;
  const py = (hp && Number.isFinite(hp.y)) ? hp.y : player.y;

  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  if (enemies.length === 0) return false; // 不空挥

  let target = enemies[0];
  if (enemies.length > 1) {
    let bestD = (target.x - px) ** 2 + (target.y - py) ** 2;
    for (let i = 1; i < enemies.length; i++) {
      const e = enemies[i];
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < bestD) {
        target = e;
        bestD = d;
      }
    }
  }

  // 只有在一定索敌范围内才出手
  const acquireRange = getPaladinHammerAcquireRange(player);
  const distToTarget = Phaser.Math.Distance.Between(px, py, target.x, target.y);
  if (distToTarget > acquireRange) return false;

  const radius = getPaladinHammerImpactRadius(player);
  const damageMultiplier = getPaladinHammerDamageMultiplier(player);
  const timing = getPaladinHammerTiming(player);
  const divineLevel = Phaser.Math.Clamp(Math.round(player?.paladinDivine || 0), 0, 3);

  const impactX = target.x;
  const impactY = target.y;

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const angle = Phaser.Math.Angle.Between(px, py, impactX, impactY);
  const distance = Math.max(40, Phaser.Math.Distance.Between(px, py, impactX, impactY));
  const backOffset = Math.min(74, Math.max(48, distance * 0.32));
  const startDiagonalOffset = Math.min(52, Math.max(24, distance * 0.18));
  const controlDistance = Math.max(44, distance * 0.52);
  const lateral = Math.min(64, Math.max(22, distance * 0.24));
  const lateralSign = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
  const perpendicular = angle + (Math.PI / 2);
  const start = {
    x: px - (Math.cos(angle) * backOffset) + (Math.cos(perpendicular) * startDiagonalOffset * lateralSign),
    y: py - (Math.sin(angle) * backOffset) + (Math.sin(perpendicular) * startDiagonalOffset * lateralSign)
  };
  const control = {
    x: px + (Math.cos(angle) * controlDistance) + (Math.cos(perpendicular) * lateral * lateralSign),
    y: py + (Math.sin(angle) * controlDistance) + (Math.sin(perpendicular) * lateral * lateralSign)
  };
  const end = { x: impactX, y: impactY };

  const spawnImpact = (x, y, dmgMult = 1) => {
    if (!scene?.bulletManager?.createPlayerBullet) return;

    // 地面金色大圆圈（渐隐）
    const ring = scene.add.circle(x, y, radius, scheme.coreColor, 0.10);
    ring.setStrokeStyle(4, scheme.coreBright || scheme.coreColor, 0.86);
    ring.setDepth(7);

    // 冲击波 + 闪光（增强砸地表现）
    const shock = scene.add.circle(x, y, Math.max(12, Math.round(radius * 0.22)), 0xffffff, 0.35);
    shock.setDepth(8);
    const shockOuter = scene.add.circle(x, y, Math.max(10, Math.round(radius * 0.70)), scheme.coreBright || scheme.coreColor, 0.06);
    shockOuter.setStrokeStyle(2, 0xffffff, 0.22);
    shockOuter.setDepth(6);

    // 碎光粒子 + 短促冲击碎片
    const sparkCount = 18;
    for (let i = 0; i < sparkCount; i++) {
      const a = (Math.PI * 2 * i) / sparkCount + Phaser.Math.FloatBetween(-0.12, 0.12);
      const r0 = Phaser.Math.Between(4, 14);
      const burst = scene.add.circle(
        x + Math.cos(a) * r0,
        y + Math.sin(a) * r0,
        Phaser.Math.Between(2, 4),
        Phaser.Math.RND.pick([scheme.coreBright || scheme.coreColor, scheme.accentColor || scheme.coreColor, 0xffffff]),
        0.95
      );
      burst.setDepth(9);
      burst.setBlendMode(Phaser.BlendModes.ADD);

      scene.tweens.add({
        targets: burst,
        alpha: 0,
        scale: 0.15,
        x: burst.x + Math.cos(a) * Phaser.Math.Between(22, 52),
        y: burst.y + Math.sin(a) * Phaser.Math.Between(22, 52),
        duration: Phaser.Math.Between(220, 340),
        ease: 'Cubic.Out',
        onComplete: () => {
          if (burst && burst.active) burst.destroy();
        }
      });
    }

    const shardCount = 8;
    for (let i = 0; i < shardCount; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const shard = scene.add.rectangle(
        x + Math.cos(a) * Phaser.Math.Between(6, 14),
        y + Math.sin(a) * Phaser.Math.Between(6, 14),
        Phaser.Math.Between(10, 16),
        Phaser.Math.Between(2, 4),
        scheme.coreBright || scheme.coreColor,
        0.9
      );
      shard.setDepth(9);
      shard.setAngle(Phaser.Math.RadToDeg(a));
      shard.setBlendMode(Phaser.BlendModes.ADD);

      scene.tweens.add({
        targets: shard,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        angle: shard.angle + Phaser.Math.Between(-50, 50),
        x: shard.x + Math.cos(a) * Phaser.Math.Between(28, 60),
        y: shard.y + Math.sin(a) * Phaser.Math.Between(28, 60),
        duration: Phaser.Math.Between(180, 300),
        ease: 'Quart.Out',
        onComplete: () => {
          if (shard && shard.active) shard.destroy();
        }
      });
    }

    // 轻微“力度感”
    if (scene?.cameras?.main?.shake) {
      scene.cameras.main.shake(100, 0.004);
    }

    scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.08,
      duration: 320,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    });

    scene.tweens.add({
      targets: shock,
      alpha: 0,
      scale: 2.4,
      duration: 170,
      ease: 'Sine.Out',
      onComplete: () => shock.destroy()
    });

    scene.tweens.add({
      targets: shockOuter,
      alpha: 0,
      scale: 1.12,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => shockOuter.destroy()
    });

    // 碰撞用 AoE 子弹（短命、静止、多目标）
    const aoe = scene.createManagedPlayerAreaBullet(
      x,
      y,
      scheme.coreColor,
      {
        radius,
        damage: Math.max(1, Math.round(player.bulletDamage * damageMultiplier * dmgMult)),
        alpha: 0.001,
        maxLifeMs: 150,
        pierce: true,
        maxHits: 99,
        hitCooldownMs: 9999,
        damageNumberAtTarget: true,
        fillAlpha: 0.001,
        strokeWidth: 0,
        tags: ['player_paladin_hammer_aoe']
      }
    );

    if (!aoe) return;

    aoe.knockback = Math.max(0, Number(player.paladinKnockback || 0));

    // 制裁：眩晕概率（10/20/30%）
    aoe.stunChance = Phaser.Math.Clamp(player.paladinStunChance || 0, 0, 0.95);
    aoe.stunMs = 650;

    applyEnhancementsToBullet(aoe, enh, scheme);
    player.bullets.push(aoe);
  };

  spawnHammerSweep(scene, start, control, end, scheme, timing.windupMs);

  scene.time.delayedCall(timing.windupMs, () => {
    if (!scene?.sys?.isActive?.()) return;
    spawnImpactMarker(scene, impactX, impactY, radius, scheme, timing.markerLeadMs);
    scene.time.delayedCall(timing.markerLeadMs, () => {
      if (!scene?.sys?.isActive?.()) return;
      spawnImpact(impactX, impactY, 1);
      if (divineLevel > 0) {
        for (let i = 0; i < divineLevel; i++) {
          scene.time.delayedCall(110 + i * 80, () => {
            if (!scene?.sys?.isActive?.()) return;
            const angleOffset = (Math.PI * 2 * i) / Math.max(1, divineLevel);
            const orbit = 26 + i * 18;
            spawnImpact(impactX + Math.cos(angleOffset) * orbit, impactY + Math.sin(angleOffset) * orbit, 0.45 + divineLevel * 0.12);
          });
        }
      }
    });
  });

  return true;
}
