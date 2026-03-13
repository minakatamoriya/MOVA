import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

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
  const baseAcquireRange = 260;
  const acquireRange = player.paladinPierce ? Math.round(baseAcquireRange * 1.06) : baseAcquireRange;
  const distToTarget = Phaser.Math.Distance.Between(px, py, target.x, target.y);
  if (distToTarget > acquireRange) return false;

  // 当前版本先简化：一个“金色大圆圈” + 伤害
  const baseRadius = 160;
  const radius = player.paladinPierce ? Math.round(baseRadius * 1.12) : baseRadius;

  // 敌人进入索敌范围才出手：落点以目标位置为准（类似星落的“点名落地 AoE”）
  const impactX = target.x;
  const impactY = target.y;

  const now = scene.time?.now ?? 0;

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

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

    // 碎光粒子（少量、短命）
    const sparks = [];
    const sparkCount = 10;
    for (let i = 0; i < sparkCount; i++) {
      const a = (Math.PI * 2 * i) / sparkCount + Phaser.Math.FloatBetween(-0.18, 0.18);
      const r0 = Phaser.Math.Between(6, 16);
      const p = scene.add.circle(
        x + Math.cos(a) * r0,
        y + Math.sin(a) * r0,
        Phaser.Math.Between(2, 3),
        Phaser.Math.RND.pick([scheme.coreBright || scheme.coreColor, scheme.accentColor || scheme.coreColor, 0xffffff]),
        0.9
      );
      p.setDepth(9);
      sparks.push(p);
      scene.tweens.add({
        targets: p,
        alpha: 0,
        scale: 0.2,
        x: p.x + Math.cos(a) * Phaser.Math.Between(14, 28),
        y: p.y + Math.sin(a) * Phaser.Math.Between(14, 28),
        duration: Phaser.Math.Between(180, 260),
        ease: 'Sine.Out',
        onComplete: () => {
          if (p && p.active) p.destroy();
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
    const aoe = scene.bulletManager.createPlayerBullet(
      x,
      y,
      scheme.coreColor,
      {
        radius,
        speed: 0,
        damage: Math.max(1, Math.round(player.bulletDamage * 0.92 * dmgMult)),
        hasGlow: false,
        hasTrail: false,
        glowRadius: 0,
        isAbsoluteAngle: true,
        angleOffset: 0,
        homing: false,
        explode: false,
        skipUpdate: false
      }
    );

    if (!aoe) return;

    if (aoe.setFillStyle) aoe.setFillStyle(scheme.coreColor, 0.001);
    if (aoe.setStrokeStyle) aoe.setStrokeStyle(0);

    aoe.maxLifeMs = 150;
    aoe.pierce = true;
    aoe.maxHits = 99;
    aoe.hitCooldownMs = 9999;
    aoe.damageNumberAtTarget = true;

    // 圣焰：复用碰撞层的 holyfire 落地逻辑
    if (player.paladinHolyfire) {
      aoe.holyfire = true;
    }

    // 制裁：眩晕概率（10/20/30%）
    aoe.stunChance = Phaser.Math.Clamp(player.paladinStunChance || 0, 0, 0.95);
    aoe.stunMs = 650;

    applyEnhancementsToBullet(aoe, enh, scheme);
    player.bullets.push(aoe);
  };

  // 立即结算（当前版本先只要“大金圈+伤害”）
  spawnImpact(impactX, impactY, 1);

  return true;
}
