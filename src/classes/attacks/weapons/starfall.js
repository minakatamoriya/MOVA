import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

function spawnSparkles(scene, x, y, colorA, colorB) {
  const sparkles = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.12, 0.12);
    const r = Phaser.Math.Between(6, 14);
    const p = scene.add.circle(
      x + Math.cos(a) * r,
      y + Math.sin(a) * r,
      Phaser.Math.Between(2, 3),
      Phaser.Math.RND.pick([colorA, colorB, 0xffffff]),
      0.85
    );
    p.setDepth(60);
    sparkles.push(p);

    scene.tweens.add({
      targets: p,
      alpha: 0,
      scale: 0.2,
      x: p.x + Math.cos(a) * Phaser.Math.Between(10, 22),
      y: p.y + Math.sin(a) * Phaser.Math.Between(10, 22),
      duration: Phaser.Math.Between(180, 260),
      ease: 'Sine.Out',
      onComplete: () => {
        if (p && p.active) p.destroy();
      }
    });
  }

  return sparkles;
}

function createImpactVfx(scene, x, y, scheme, aoeRadius) {
  const ring = scene.add.circle(x, y, aoeRadius, scheme.coreColor, 0.08);
  ring.setStrokeStyle(3, scheme.accentColor, 0.9);
  ring.setDepth(40);
  ring.setScale(0.18);

  scene.tweens.add({
    targets: ring,
    scale: 1,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy()
  });

  const flash = scene.add.circle(x, y, Math.max(10, Math.round(aoeRadius * 0.3)), 0xffffff, 0.85);
  flash.setDepth(65);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scale: 2.4,
    duration: 160,
    ease: 'Sine.Out',
    onComplete: () => flash.destroy()
  });
}

/**
 * 德鲁伊基础技能：星落
 * - 定位敌方（当前Boss）
 * - 有索敌射程上限（用于范围提示与走位决策）
 * - 敌方上方生成闪亮星体下落，落地造成范围伤害
 */
export function fireStarfall(player) {
  if (!player?.scene) return;

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
  if (enemies.length === 0) return;

  // 索敌射程（不再无限距离）
  const acquireRange = Math.max(120, Math.round(player.druidStarfallRange || player.druidStarfallRangeBase || 720));
  const acquireR2 = acquireRange * acquireRange;

  // 目标选择：
  // 1) 优先相机视野内
  // 2) 视野内同时存在 Boss/精英小怪时：优先打“血更少”的
  // 3) 平手：更近者
  const cam = scene.cameras?.main;
  const view = cam?.worldView;
  const viewRect = (view && view.width > 0 && view.height > 0)
    ? view
    : (cam
      ? new Phaser.Geom.Rectangle(cam.scrollX, cam.scrollY, cam.width / (cam.zoom || 1), cam.height / (cam.zoom || 1))
      : null);

  const isInView = (e) => {
    if (!viewRect) return true;
    return Phaser.Geom.Rectangle.Contains(viewRect, e.x, e.y);
  };

  const getHp = (e) => {
    if (Number.isFinite(e.currentHp)) return e.currentHp;
    if (Number.isFinite(e.hp)) return e.hp;
    return Infinity;
  };

  const inRange = enemies.filter((e) => {
    const dx = (e.x || 0) - player.x;
    const dy = (e.y || 0) - player.y;
    return (dx * dx + dy * dy) <= acquireR2;
  });
  if (inRange.length === 0) return;

  const visible = inRange.filter(isInView);
  const pool = visible.length > 0 ? visible : inRange;

  let target = pool[0];
  let bestHp = getHp(target);
  let bestD = (target.x - player.x) ** 2 + (target.y - player.y) ** 2;

  for (let i = 1; i < pool.length; i++) {
    const e = pool[i];
    const hp = getHp(e);
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (hp < bestHp) {
      target = e;
      bestHp = hp;
      bestD = d;
      continue;
    }
    if (hp === bestHp && d < bestD) {
      target = e;
      bestD = d;
    }
  }

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);
  const now = scene.time?.now ?? 0;
  const radiusByLevel = [70, 80, 92, 106];
  const impactDamageMultByLevel = [1, 1.15, 1.30, 1.45];
  const fallMsByLevel = [260, 235, 210, 185];
  const starfireChanceByLevel = [0, 0.20, 0.30, 0.40];
  const starfireDamageByLevel = [0, 0.45, 0.60, 0.75];
  const starfallShapeLevel = Phaser.Math.Clamp(Math.round(player.druidMeteorShowerLevel || 0), 0, 3);
  const impactLevel = Phaser.Math.Clamp(Math.round(player.druidMeteorLevel || 0), 0, 3);
  const starfireLevel = Phaser.Math.Clamp(Math.round(player.druidStarfireLevel || 0), 0, 3);
  const kingLevel = Phaser.Math.Clamp(Math.round(player.druidKingofbeasts || 0), 0, 3);
  const naturefusionLevel = Phaser.Math.Clamp(Math.round(player.druidNaturefusion || 0), 0, 3);
  const astralstormLevel = Phaser.Math.Clamp(Math.round(player.druidAstralstormLevel || 0), 0, 3);

  const baseTargetX = target.x;
  const baseTargetY = target.y;

  const spawnOne = (aim, opts = {}) => {
    const { damageMult = 1, allowStarfire = true, allowNaturefusion = true } = opts;

    const aimTarget = (aim && typeof aim === 'object') ? (aim.target || null) : null;
    const aimOffsetX = (aim && typeof aim === 'object' && Number.isFinite(aim.offsetX)) ? aim.offsetX : 0;
    const aimOffsetY = (aim && typeof aim === 'object' && Number.isFinite(aim.offsetY)) ? aim.offsetY : 0;

    // 若没有目标引用（兜底/特殊调用），按固定坐标处理
    let lastX = (aim && typeof aim === 'object' && Number.isFinite(aim.x)) ? aim.x : (Number.isFinite(aim) ? aim : baseTargetX);
    let lastY = (aim && typeof aim === 'object' && Number.isFinite(aim.y)) ? aim.y : baseTargetY;

    const resolveAim = () => {
      if (aimTarget && aimTarget.active && aimTarget.isAlive) {
        lastX = (aimTarget.x || 0) + aimOffsetX;
        lastY = (aimTarget.y || 0) + aimOffsetY;
      }
      return { x: lastX, y: lastY };
    };

    const dropHeight = 320;
    const p0 = resolveAim();
    const startY = p0.y - dropHeight;

    const starColor = scheme.coreBright;
    const outlineColor = scheme.accentColor;
    const glowColor = scheme.glowColor;

    const aoeRadius = Math.round((radiusByLevel[starfallShapeLevel] || 70) * ([1, 1.18, 1.34, 1.52][kingLevel] || 1));
    const isHeavyImpact = impactLevel >= 2;
    const glow = scene.add.circle(p0.x, startY, isHeavyImpact ? 28 : 24, glowColor, 0.22);
    glow.setStrokeStyle(1, glowColor, 0.35);
    glow.setDepth(58);

    const star = scene.add.star(p0.x, startY, 5, 6, isHeavyImpact ? 18 : 15, starColor, 1);
    star.setStrokeStyle(2, outlineColor, 0.95);
    star.setDepth(59);
    star.setScale(0.6);
    star.alpha = 0;
    glow.setScale(0.6);
    glow.alpha = 0;

    scene.tweens.add({
      targets: [star, glow],
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 1 },
      duration: 140,
      ease: 'Sine.Out'
    });

    const fallMs = Math.max(120, Math.round((fallMsByLevel[impactLevel] || 260) * ([1, 0.92, 0.82, 0.72][astralstormLevel] || 1)));
    const tracker = { p: 0 };
    scene.tweens.add({
      targets: tracker,
      p: 1,
      duration: fallMs,
      ease: 'Quad.In',
      onUpdate: () => {
        const p = Phaser.Math.Clamp(tracker.p || 0, 0, 1);
        const pos = resolveAim();
        const y = pos.y - dropHeight * (1 - p);
        if (star && star.active) {
          star.x = pos.x;
          star.y = y;
        }
        if (glow && glow.active) {
          glow.x = pos.x;
          glow.y = y;
        }
      },
      onComplete: () => {
        if (star && star.active) star.destroy();
        if (glow && glow.active) glow.destroy();

        const pos = resolveAim();
        const impactX = pos.x;
        const impactY = pos.y;

        const damage = Math.max(1, Math.round(player.bulletDamage * 0.92 * (impactDamageMultByLevel[impactLevel] || 1) * ([1, 1.16, 1.30, 1.46][kingLevel] || 1) * damageMult));

        const aoeBullet = scene.createManagedPlayerAreaBullet?.(
          impactX,
          impactY,
          scheme.coreColor,
          {
            radius: aoeRadius,
            damage,
            alpha: 0.001,
            maxLifeMs: 240,
            pierce: true,
            maxHits: 999,
            hitCooldownMs: 250,
            tags: ['player_starfall_impact']
          }
        );

        if (aoeBullet) {
          const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);
          applyEnhancementsToBullet(aoeBullet, enh, scheme);

          player.bullets.push(aoeBullet);
          while (player.bullets.length > player.maxBullets) {
            player.bullets.shift();
          }
        }

        createImpactVfx(scene, impactX, impactY, scheme, aoeRadius);
        // 性能：星落属于高频普攻，砍掉 sparkles/dust 的对象与 tween 量，避免移动+射击时掉帧

        // 星火：30% 概率额外触发一次（不连锁）
        if (allowStarfire && starfireLevel > 0 && Math.random() < Math.min(0.8, (starfireChanceByLevel[starfireLevel] || 0) + ([0, 0.05, 0.10, 0.16][astralstormLevel] || 0))) {
          spawnOne({ x: impactX, y: impactY }, { damageMult: starfireDamageByLevel[starfireLevel] || 0.45, allowStarfire: false });
        }

        if (allowNaturefusion && naturefusionLevel > 0) {
          const extraCount = naturefusionLevel;
          const extraDamageMult = [0, 0.34, 0.48, 0.62][naturefusionLevel] || 0.34;
          for (let i = 0; i < extraCount; i++) {
            scene.time.delayedCall(90 + i * 70, () => {
              if (!scene?.sys?.isActive?.()) return;
              const angle = (Math.PI * 2 * i) / Math.max(1, extraCount);
              const spread = 28 + i * 16;
              spawnOne(
                { x: impactX + Math.cos(angle) * spread, y: impactY + Math.sin(angle) * spread },
                { damageMult: extraDamageMult, allowStarfire: false, allowNaturefusion: false }
              );
            });
          }
        }
      }
    });
  };

  const initialCount = 1 + kingLevel;
  for (let i = 0; i < initialCount; i++) {
    const angle = initialCount <= 1 ? 0 : ((Math.PI * 2 * i) / initialCount);
    const spread = i === 0 ? 0 : 26 + kingLevel * 12;
    spawnOne(
      { target, offsetX: Math.cos(angle) * spread, offsetY: Math.sin(angle) * spread },
      { damageMult: 1, allowStarfire: true, allowNaturefusion: true }
    );
  }
}
