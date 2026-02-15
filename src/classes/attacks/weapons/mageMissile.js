import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function fireMageMissile(player) {
  if (!player?.scene) return;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  const spawnX = player.x;
  const spawnY = player.y - player.visualRadius - 6;

  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  let target = enemies.length > 0 ? enemies[0] : null;
  if (enemies.length > 1) {
    let bestD = (target.x - spawnX) ** 2 + (target.y - spawnY) ** 2;
    for (let i = 1; i < enemies.length; i++) {
      const e = enemies[i];
      const d = (e.x - spawnX) ** 2 + (e.y - spawnY) ** 2;
      if (d < bestD) {
        target = e;
        bestD = d;
      }
    }
  }

  const angle = target && target.isAlive
    ? Phaser.Math.Angle.Between(spawnX, spawnY, target.x, target.y)
    : -Math.PI / 2;

  const bullet = scene.bulletManager.createPlayerBullet(
    spawnX,
    spawnY,
    scheme.coreColor,
    {
      radius: 6,
      speed: 420,
      damage: Math.max(1, Math.round(player.bulletDamage * 0.72)),
      angleOffset: angle,
      isAbsoluteAngle: true,
      hasGlow: true,
      hasTrail: true,
      glowRadius: 12,
      glowColor: scheme.glowColor,
      strokeColor: scheme.accentColor,
      trailColor: scheme.trailColor,
      homing: true,
      homingTurn: 0.08,
      // 法师：中距离（略短于猎人箭矢）
      maxLifeMs: Math.round((520 / 420) * 1000),
      explode: false,
      skipUpdate: false
    }
  );

  bullet.hitCooldownMs = 120;

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);
  applyEnhancementsToBullet(bullet, enh, scheme);

  player.bullets.push(bullet);
}
