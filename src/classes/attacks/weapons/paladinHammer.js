import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function firePaladinHammer(player) {
  if (!player?.scene) return false;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  const px = player.x;
  const py = player.y;

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
  const acquireRange = 520;
  const distToTarget = Phaser.Math.Distance.Between(px, py, target.x, target.y);
  if (distToTarget > acquireRange) return false;

  const baseAngle = Phaser.Math.Angle.Between(px, py, target.x, target.y);

  const baseReach = 140;
  const reach = player.paladinPierce ? Math.round(baseReach * 1.12) : baseReach;

  // 当前版本先简化：一个“金色大圆圈” + 伤害
  const baseRadius = 160;
  const radius = player.paladinPierce ? Math.round(baseRadius * 1.12) : baseRadius;

  // 进入有效范围后才攻击（避免远距离“隔空砸地”）
  const attackRange = reach + radius + 10;
  if (distToTarget > attackRange) return false;

  const travel = Phaser.Math.Clamp(distToTarget, 44, reach);

  const impactX = px + Math.cos(baseAngle) * travel;
  const impactY = py + Math.sin(baseAngle) * travel;

  const now = scene.time?.now ?? 0;

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const spawnImpact = (x, y, dmgMult = 1) => {
    if (!scene?.bulletManager?.createPlayerBullet) return;

    // 地面金色大圆圈（渐隐）
    const ring = scene.add.circle(x, y, radius, scheme.coreColor, 0.06);
    ring.setStrokeStyle(3, scheme.coreBright || scheme.coreColor, 0.72);
    ring.setDepth(7);

    // 轻微“力度感”
    if (scene?.cameras?.main?.shake) {
      scene.cameras.main.shake(70, 0.002);
    }

    scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.08,
      duration: 320,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
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
