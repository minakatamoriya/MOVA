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

  // 射程判定以“玩家核心判定点”为中心，避免子弹生成点偏移导致
  // 小体积敌人（试炼之地）看起来“进圈了却不射”。
  const hp = (typeof player.getHitboxPosition === 'function') ? player.getHitboxPosition() : null;
  const rangeX = (hp && Number.isFinite(hp.x)) ? hp.x : player.x;
  const rangeY = (hp && Number.isFinite(hp.y)) ? hp.y : player.y;

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
    player.archerArrowRangeMax || 420
  );
  const hasTargetInRange = (() => {
    if (!target || !target.isAlive) return false;
    const dx = target.x - rangeX;
    const dy = target.y - rangeY;
    return (dx * dx + dy * dy) <= (acquireRange * acquireRange);
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
    // 固定角度展开：中心列瞄准目标，两侧按发射瞬间角度散开，不再二次聚拢。
    player.createBulletAtAngle(baseAngle + off, true);
  }

  return true;
}
