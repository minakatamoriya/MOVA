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

  const targetBody = target.body || null;
  const targetVx = Number.isFinite(target.vx) ? target.vx : Number(targetBody?.velocity?.x || 0);
  const targetVy = Number.isFinite(target.vy) ? target.vy : Number(targetBody?.velocity?.y || 0);
  const shotSpeed = Math.max(1, Number(player.bulletSpeed || 720));
  const rawDx = target.x - rangeX;
  const rawDy = target.y - rangeY;
  const leadTime = Phaser.Math.Clamp(Math.sqrt((rawDx * rawDx) + (rawDy * rawDy)) / shotSpeed, 0, 0.32);
  const aimX = target.x + targetVx * leadTime;
  const aimY = target.y + targetVy * leadTime;
  const dx = aimX - rangeX;
  const dy = aimY - rangeY;
  if ((dx * dx + dy * dy) > acquireRange * acquireRange) return false;

  const muzzleBaseY = player.y - player.visualRadius * 0.28;
  const muzzleDistance = Math.max(12, player.visualRadius * 0.72);
  const volleyOriginX = player.x + Math.cos(Phaser.Math.Angle.Between(spawnX, spawnY, aimX, aimY)) * muzzleDistance;
  const volleyOriginY = muzzleBaseY + Math.sin(Phaser.Math.Angle.Between(spawnX, spawnY, aimX, aimY)) * muzzleDistance;
  const angle = Phaser.Math.Angle.Between(volleyOriginX, volleyOriginY, aimX, aimY);

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
  const bounceLevel = Phaser.Math.Clamp(Math.round(player.archerArrowBounce || 0), 0, 3);
  const windfuryLevel = Phaser.Math.Clamp(Math.round(player.archerWindfury || 0), 0, 3);
  const eagleeyeLevel = Phaser.Math.Clamp(Math.round(player.archerEagleeye || 0), 0, 3);

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
    if (bounceLevel > 0) {
      bullet.canBounce = true;
      bullet.basicEnh = bullet.basicEnh || {};
      bullet.basicEnh.bounce = Math.max(bullet.basicEnh.bounce || 0, bounceLevel);
    }
    applyEnhancementsToBullet(bullet, enh, scheme);
  };

  const getArrowDamageScale = (shotIndex, shotCount) => {
    if (shotCount <= 1) return 1;
    const centerIndex = (shotCount - 1) / 2;
    const distanceFromCenter = Math.abs(shotIndex - centerIndex);
    if (distanceFromCenter < 0.25) return 1;
    if (distanceFromCenter <= 1.25) return 0.72;
    return 0.52;
  };

  const isCenterArrow = (shotIndex, shotCount) => {
    if (shotCount <= 1) return true;
    const centerIndex = (shotCount - 1) / 2;
    return Math.abs(shotIndex - centerIndex) < 0.25;
  };

  const fireVolley = (allowRapidProc = true, volleyIndex = 0) => {
    const useRingVolley = windfuryLevel > 0 || player.archerVolleyMode === 'ring';
    if (useRingVolley) {
      const count = windfuryLevel > 0
        ? Math.max(12, 12 + windfuryLevel * 2)
        : Math.max(1, Math.round(player.archerVolleyRingCount || 8));
      const ringOffset = windfuryLevel > 0 ? ((Math.PI / count) * volleyIndex * 0.85) : 0;
      for (let i = 0; i < count; i++) {
        const shotAngle = ((Math.PI * 2 * i) / count) + ringOffset;
        const bullet = player.createBulletAtAngle(shotAngle, true, {
          spawnX: volleyOriginX,
          spawnY: volleyOriginY
        });
        if (bullet && eagleeyeLevel > 0) {
          bullet.damage = Math.max(1, Math.round((bullet.damage || 1) * ([1, 1.08, 1.18, 1.32][eagleeyeLevel] || 1.08)));
        }
        applyArrowVisuals(bullet);
      }
    } else {
      const count = Math.max(1, Math.round(player.archerVolleyCount || 1));
      const spread = Number(player.archerVolleySpread || 0);
      const start = -spread * (count - 1) / 2;
      for (let i = 0; i < count; i++) {
        const shotAngle = angle + start + spread * i;
        const bullet = player.createBulletAtAngle(shotAngle, true, {
          spawnX: volleyOriginX,
          spawnY: volleyOriginY
        });
        if (bullet) {
          bullet.damage = Math.max(1, Math.round((bullet.damage || 0) * getArrowDamageScale(i, count)));
          if (player.archerVolleyLockAim && target && target.isAlive && isCenterArrow(i, count)) {
            bullet.homing = true;
            bullet.homingMode = 'fan_lock';
            bullet.lockTarget = target;
            bullet.fanOffsetRad = 0;
            bullet.homingTurnRadPerSec = Number(player.archerVolleyLockTurn || Phaser.Math.DegToRad(300));
          }
          if (eagleeyeLevel > 0) {
            bullet.damage = Math.max(1, Math.round((bullet.damage || 1) * ([1, 1.08, 1.18, 1.32][eagleeyeLevel] || 1.08)));
          }
        }
        applyArrowVisuals(bullet);
      }
    }

    if (windfuryLevel > 0 && allowRapidProc) {
      for (let wave = 1; wave <= windfuryLevel; wave++) {
        scene.time.delayedCall(110 + wave * 80, () => {
          if (!player?.isAlive || player.scene !== scene) return;
          fireVolley(false, wave);
        });
      }
    }

    if (allowRapidProc && player.archerRapidfire && Math.random() < 0.1) {
      fireVolley(false, volleyIndex + 1);
    }
  };

  fireVolley(true);
  return true;
}
