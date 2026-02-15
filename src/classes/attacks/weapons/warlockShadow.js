import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function fireWarlockShadow(player) {
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
      radius: 8,
      speed: 210,
      damage: Math.max(1, Math.round(player.bulletDamage * 1.02)),
      angleOffset: angle,
      isAbsoluteAngle: true,
      hasGlow: true,
      hasTrail: true,
      glowRadius: 14,
      glowColor: scheme.glowColor,
      strokeColor: scheme.accentColor,
      trailColor: scheme.trailColor,
      homing: false,
      explode: false,
      skipUpdate: false
    }
  );

  bullet.shadowBase = true;
  bullet.hitCooldownMs = 240;

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);
  applyEnhancementsToBullet(bullet, enh, scheme);

  // 术士本体也自带叠层/播种（最低限度）：命中叠 1 层
  bullet.basicEnh = bullet.basicEnh || {};
  bullet.basicEnh.markOnHit = Math.max(bullet.basicEnh.markOnHit || 0, 1);

  // 术士专精：连环（命中后弹射 1 次；可再次击中同一目标）
  if (player.warlockChain) {
    bullet.basicEnh.bounce = Math.max(bullet.basicEnh.bounce || 0, 1);
    bullet.hitCooldownMs = Math.min(bullet.hitCooldownMs || 240, 180);
  }

  player.bullets.push(bullet);
}
