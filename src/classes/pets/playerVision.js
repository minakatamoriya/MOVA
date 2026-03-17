import Phaser from 'phaser';

export function getPlayerVisionRect(scene, player, padding = 0) {
  const safePadding = Number.isFinite(Number(padding)) ? Number(padding) : 0;
  const cam = scene?.cameras?.main;
  const view = cam?.worldView;
  if (view) {
    const width = Math.max(1, view.width + safePadding * 2);
    const height = Math.max(1, view.height + safePadding * 2);
    return new Phaser.Geom.Rectangle(
      view.x - safePadding,
      view.y - safePadding,
      width,
      height
    );
  }

  const width = cam?.width || scene?.scale?.width || 0;
  const height = cam?.height || scene?.scale?.height || 0;
  const centerX = Number(player?.x) || 0;
  const centerY = Number(player?.y) || 0;
  const rectWidth = Math.max(1, width + safePadding * 2);
  const rectHeight = Math.max(1, height + safePadding * 2);
  return new Phaser.Geom.Rectangle(
    centerX - width * 0.5 - safePadding,
    centerY - height * 0.5 - safePadding,
    rectWidth,
    rectHeight
  );
}

export function isPointInPlayerVision(scene, player, x, y, padding = 0) {
  const rect = getPlayerVisionRect(scene, player, padding);
  return Phaser.Geom.Rectangle.Contains(rect, x, y);
}

export function clampPointToPlayerVision(scene, player, x, y, inset = 0) {
  const safeInset = Math.max(0, Number(inset) || 0);
  const rect = getPlayerVisionRect(scene, player, -safeInset);
  const minX = rect.x;
  const maxX = rect.x + rect.width;
  const minY = rect.y;
  const maxY = rect.y + rect.height;
  return {
    x: Phaser.Math.Clamp(x, minX, maxX),
    y: Phaser.Math.Clamp(y, minY, maxY)
  };
}

export function collectCombatEnemies(scene) {
  if (scene?.exitDoorActive || scene?._pathChoiceActive || scene?._postBossRewardActive) return [];

  const enemies = [];
  const boss = scene?.bossManager?.getCurrentBoss?.();
  if (boss && boss.isAlive) enemies.push(boss);

  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];
  if (Array.isArray(minions)) {
    for (let i = 0; i < minions.length; i++) {
      const minion = minions[i];
      if (minion && minion.isAlive) enemies.push(minion);
    }
  }

  return enemies;
}