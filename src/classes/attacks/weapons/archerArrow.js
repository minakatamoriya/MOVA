import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function fireArcherArrow(player) {
  if (!player?.scene) return false;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  if (!player.getArcherTargetInRange?.()) return false;

  const pickTarget = (x, y) => {
    const enemies = [];
    if (boss && boss.isAlive) enemies.push(boss);
    if (Array.isArray(minions) && minions.length > 0) {
      minions.forEach((m) => {
        if (m && m.isAlive) enemies.push(m);
      });
    }
    if (enemies.length === 0) return null;

    let best = enemies[0];
    let bestD = (best.x - x) ** 2 + (best.y - y) ** 2;
    for (let i = 1; i < enemies.length; i++) {
      const e = enemies[i];
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  };

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  // 需求：箭矢表现为“中心荧光亮绿色、短细条形”
  const arrowCore = 0x2cff6a;
  const arrowAccent = 0xeafff2;
  const arrowGlow = 0x52ff8c;

  const spawnX = player.x;
  const spawnY = player.y - player.visualRadius - 4;

  const hp = (typeof player.getHitboxPosition === 'function') ? player.getHitboxPosition() : null;
  const rangeX = (hp && Number.isFinite(hp.x)) ? hp.x : player.x;
  const rangeY = (hp && Number.isFinite(hp.y)) ? hp.y : player.y;
  const acquireRange = Phaser.Math.Clamp(
    Math.round(player.archerArrowRange || player.archerArrowRangeBase || 330),
    200,
    player.archerArrowRangeMax || 420
  );

  const target = pickTarget(spawnX, spawnY);
  if (!target || !target.isAlive) return false;

  const dx = target.x - rangeX;
  const dy = target.y - rangeY;
  if ((dx * dx + dy * dy) > acquireRange * acquireRange) return false;

  const angle = Phaser.Math.Angle.Between(spawnX, spawnY, target.x, target.y);

  const now = scene.time?.now ?? 0;

  const shouldArrowRain = (() => {
    if (!player.archerArrowRain) return false;
    player._arrowRainNextAt = player._arrowRainNextAt || (now + 5000);
    if (!player._arrowRainCharged && now >= player._arrowRainNextAt) {
      player._arrowRainCharged = true;
    }
    if (player._arrowRainCharged) {
      player._arrowRainCharged = false;
      player._arrowRainNextAt = now + 5000;
      return true;
    }
    return false;
  })();

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  if (shouldArrowRain && target && target.isAlive) {
    // AOE 判定（当前项目以 Boss 为主；用“短寿命大半径子弹”做范围伤害）
    const aoe = scene.createManagedPlayerAreaBullet(
      target.x,
      target.y,
      scheme.coreColor,
      {
        radius: 110,
        damage: Math.max(1, Math.round(player.bulletDamage * 1.8)),
        maxLifeMs: 90,
        hitCooldownMs: 999999,
        noCrit: false,
        tags: ['player_archer_arrow_rain']
      }
    );
    if (aoe) {
      applyEnhancementsToBullet(aoe, enh, scheme);
      player.bullets.push(aoe);
    }

    // 纯表现：几根“落箭”闪一下
    for (let i = 0; i < 7; i++) {
      const dx = Phaser.Math.Between(-90, 90);
      const dy = Phaser.Math.Between(-90, 90);
      const p = scene.add.rectangle(target.x + dx, target.y - 220 + dy, 3, 16, arrowCore, 0.92);
      p.setStrokeStyle(1, arrowAccent, 0.9);
      scene.tweens.add({
        targets: p,
        y: target.y + dy,
        alpha: 0,
        duration: 240,
        ease: 'Quad.In',
        onComplete: () => p.destroy()
      });
    }
    return true;
  }

  const applyArrowVisuals = (bullet) => {
    if (!bullet) return;
    bullet.visualCoreColor = arrowCore;
    bullet.visualAccentColor = arrowAccent;
    bullet.hitEffectColor = arrowGlow;
    bullet.glowColor = arrowGlow;
    bullet.strokeColor = arrowAccent;
    bullet.trailColor = arrowCore;
    applyEnhancementsToBullet(bullet, enh, scheme);
  };

  const fireVolley = (allowRapidProc = true) => {
    if (player.archerVolleyMode === 'ring') {
      const count = Math.max(1, Math.round(player.archerVolleyRingCount || 8));
      for (let i = 0; i < count; i++) {
        const shotAngle = (Math.PI * 2 * i) / count;
        const bullet = player.createBulletAtAngle(shotAngle, true);
        applyArrowVisuals(bullet);
      }
    } else {
      const count = Math.max(1, Math.round(player.archerVolleyCount || 1));
      const spread = Number(player.archerVolleySpread || 0);
      const start = -spread * (count - 1) / 2;
      for (let i = 0; i < count; i++) {
        const shotAngle = angle + start + spread * i;
        const bullet = player.createBulletAtAngle(shotAngle, true);
        applyArrowVisuals(bullet);
      }
    }

    if (allowRapidProc && player.archerRapidfire && Math.random() < 0.1) {
      fireVolley(false);
    }
  };

  fireVolley(true);
  return true;
}
