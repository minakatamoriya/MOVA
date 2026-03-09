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

  // 索敌/射程以“玩家核心判定点”为中心，避免因子弹生成点偏移导致
  // 小体积敌人（例如试炼之地小怪）看起来“进圈了却不施放”。
  const hp = (typeof player.getHitboxPosition === 'function') ? player.getHitboxPosition() : null;
  const rangeX = (hp && Number.isFinite(hp.x)) ? hp.x : player.x;
  const rangeY = (hp && Number.isFinite(hp.y)) ? hp.y : player.y;

  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  // 索敌范围限制（初始更短；后续可由天赋增加）
  const acquireRange = Math.max(120, Math.round(player.mageMissileRange || 480));
  const acquireR2 = acquireRange * acquireRange;
  const inRange = enemies.filter((e) => {
    const dx = (e.x || 0) - rangeX;
    const dy = (e.y || 0) - rangeY;
    return (dx * dx + dy * dy) <= acquireR2;
  });
  if (inRange.length === 0) return;

  let target = inRange.length > 0 ? inRange[0] : null;
  if (inRange.length > 1) {
    let bestD = (target.x - rangeX) ** 2 + (target.y - rangeY) ** 2;
    for (let i = 1; i < inRange.length; i++) {
      const e = inRange[i];
      const d = (e.x - rangeX) ** 2 + (e.y - rangeY) ** 2;
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
