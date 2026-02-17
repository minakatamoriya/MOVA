import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function fireMoonfire(player, pointer) {
  if (!player?.scene) return;

  const spawnX = player.x;
  const spawnY = player.y - player.visualRadius - 6;

  const boss = player.scene?.bossManager?.getCurrentBoss?.();
  const minions = player.scene?.bossManager?.getMinions?.() || player.scene?.bossManager?.minions || [];

  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  // 索敌范围限制（初始更短；后续可由天赋增加）
  const acquireRange = Math.max(120, Math.round(player.moonfireRange || player.moonfireRangeBase || 620));
  const acquireR2 = acquireRange * acquireRange;
  const inRange = enemies.filter((e) => {
    const dx = (e.x || 0) - spawnX;
    const dy = (e.y || 0) - spawnY;
    return (dx * dx + dy * dy) <= acquireR2;
  });

  let target = inRange.length > 0 ? inRange[0] : null;
  if (inRange.length > 1) {
    let bestD = (target.x - spawnX) ** 2 + (target.y - spawnY) ** 2;
    for (let i = 1; i < inRange.length; i++) {
      const e = inRange[i];
      const d = (e.x - spawnX) ** 2 + (e.y - spawnY) ** 2;
      if (d < bestD) {
        target = e;
        bestD = d;
      }
    }
  }

  // 默认朝上；按住鼠标时用鼠标方向；否则朝 Boss
  let angle = -Math.PI / 2;

  if (pointer && pointer.isDown) {
    const px = pointer.worldX ?? pointer.x;
    const py = pointer.worldY ?? pointer.y;
    if (typeof px === 'number' && typeof py === 'number') {
      const dx = px - spawnX;
      const dy = py - spawnY;
      const distSq = dx * dx + dy * dy;
      if (distSq > 30 * 30) {
        angle = Math.atan2(dy, dx);
      }
    }
  } else if (target && target.isAlive) {
    angle = Phaser.Math.Angle.Between(spawnX, spawnY, target.x, target.y);
  }

  const affinityTarget = player.scene?.getMoonfireAffinityTarget
    ? player.scene.getMoonfireAffinityTarget()
    : (target && target.isAlive ? target : null);

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  const speed = Math.round(player.bulletSpeed * player.moonfireSpeedMult);
  const damage = Math.max(1, Math.round(player.bulletDamage * player.moonfireDamageMult));

  const bullet = player.scene.bulletManager.createMoonfireBullet(spawnX, spawnY, {
    angle,
    speed,
    damage,
    affinityTarget,
    affinityConeDeg: player.moonfireAffinityConeDeg,
    affinityTurnDegPerSec: player.moonfireAffinityTurnDegPerSec,
    coreColor: scheme.coreColor,
    coreBright: scheme.coreBright,
    accentColor: scheme.accentColor,
    trailColor: scheme.trailColor
  });

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);
  applyEnhancementsToBullet(bullet, enh, scheme);

  player.bullets.push(bullet);
  while (player.bullets.length > player.maxBullets) {
    player.bullets.shift();
  }
}
