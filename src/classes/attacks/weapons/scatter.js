import Phaser from 'phaser';

export function fireScatter(player) {
  if (!player?.scatterEnabled) return false;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  const spawnX = player.x;
  const spawnY = player.y - (player.visualRadius || 0);

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

  const acquireRange = Phaser.Math.Clamp(
    Math.round(player.archerArrowRange || player.archerArrowRangeBase || 330),
    200,
    360
  );
  const hasTargetInRange = (() => {
    if (!target || !target.isAlive) return false;
    const enemyR = Math.max(0,
      target.bossSize || 0,
      target.hitRadius || 0,
      target.radius || 0,
      (target.width ? Math.round(target.width * 0.5) : 0),
      (target.displayWidth ? Math.round(target.displayWidth * 0.5) : 0)
    );
    const dx = target.x - spawnX;
    const dy = target.y - spawnY;
    const r = acquireRange + enemyR;
    return (dx * dx + dy * dy) <= (r * r);
  })();

  // 未遇敌：不射箭
  if (!hasTargetInRange) return false;

  const baseAngle = Phaser.Math.Angle.Between(spawnX, spawnY, target.x, target.y);

  if (player.scatterMode === 'ring') {
    const count = player.scatterRingCount;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      player.createBulletAtAngle(angle, true);
    }
    return true;
  }

  const count = Math.max(1, player.scatterBulletCount);
  const start = -player.scatterSpread * (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const off = start + player.scatterSpread * i;

    // 轻度追踪：锁定同一目标；扇形偏移保持（中心线跟随，展开角不变）
    const bullet = player.createBulletAtAngle(baseAngle + off, true);
    if (bullet) {
      bullet.homing = true;
      bullet.homingMode = 'fan_lock';
      bullet.lockTarget = target;
      bullet.fanOffsetRad = off;
      bullet.homingTurnRadPerSec = Phaser.Math.DegToRad(48);
    }
  }

  return true;
}
