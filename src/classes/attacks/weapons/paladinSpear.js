import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function firePaladinSpear(player) {
  if (!player?.scene) return;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  const spawnX = player.x;
  const spawnY = player.y - player.visualRadius - 2;

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

  const now = scene.time?.now ?? 0;

  // 回马枪：每 5 秒下一次额外多投
  let multi = false;
  if (player.paladinTriple) {
    player._paladinTripleNextAt = player._paladinTripleNextAt || (now + 5000);
    if (!player._paladinTripleCharged && now >= player._paladinTripleNextAt) {
      player._paladinTripleCharged = true;
    }
    if (player._paladinTripleCharged) {
      player._paladinTripleCharged = false;
      player._paladinTripleNextAt = now + 5000;
      multi = true;
    }
  }

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const spawnSpear = (a, dmgMult = 1) => {
    const bullet = scene.bulletManager.createPlayerBullet(
      spawnX,
      spawnY,
      scheme.coreColor,
      {
        radius: 8,
        speed: 420,
        damage: Math.max(1, Math.round(player.bulletDamage * 1.05 * dmgMult)),
        angleOffset: a,
        isAbsoluteAngle: true,
        hasGlow: true,
        hasTrail: true,
        glowRadius: 13,
        glowColor: scheme.glowColor,
        strokeColor: scheme.accentColor,
        trailColor: scheme.trailColor,
        homing: false,
        explode: false,
        skipUpdate: false
      }
    );

    if (!bullet) return;

    // 近距离投枪：短射程 + 强击退
    bullet.maxLifeMs = 520;
    bullet.knockback = 24;
    bullet.hitCooldownMs = 220;

    if (player.paladinPierce) {
      bullet.pierce = true;
      bullet.maxHits = 2;
    }

    if (player.paladinHolyfire) {
      bullet.holyfire = true;
    }

    applyEnhancementsToBullet(bullet, enh, scheme);
    player.bullets.push(bullet);
  };

  if (multi) {
    const spread = 0.24;
    [angle, angle - spread, angle + spread, angle - spread * 0.55].forEach((a) => spawnSpear(a, 0.92));
    return;
  }

  spawnSpear(angle, 1);
}
