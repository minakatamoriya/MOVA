import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme, lerpColor } from '../../visual/basicSkillColors';

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

  // 细碎“星尘”散开
  const dustCount = 10;
  for (let i = 0; i < dustCount; i++) {
    const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const rr = Phaser.Math.Between(8, Math.round(aoeRadius * 0.65));
    const p = scene.add.circle(x, y, Phaser.Math.Between(1, 2), lerpColor(scheme.coreBright, 0xffffff, 0.4), 0.75);
    p.setDepth(64);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(a) * rr,
      y: y + Math.sin(a) * rr,
      alpha: 0,
      duration: Phaser.Math.Between(220, 320),
      ease: 'Sine.Out',
      onComplete: () => p.destroy()
    });
  }
}

/**
 * 德鲁伊基础技能：星落
 * - 定位敌方（当前Boss）
 * - 射程无限
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

  const visible = enemies.filter(isInView);
  const pool = visible.length > 0 ? visible : enemies;

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

  const baseTargetX = target.x;
  const baseTargetY = target.y;

  // 陨石：每 10 秒下一次强化
  let isMeteor = false;
  if (player.druidMeteor) {
    player._druidMeteorNextAt = player._druidMeteorNextAt || (now + 10000);
    if (!player._druidMeteorCharged && now >= player._druidMeteorNextAt) {
      player._druidMeteorCharged = true;
    }
    if (player._druidMeteorCharged) {
      player._druidMeteorCharged = false;
      player._druidMeteorNextAt = now + 10000;
      isMeteor = true;
    }
  }

  const count = player.druidMeteorShower ? 3 : 1;

  const spawnOne = (aim, opts = {}) => {
    const { big = false, damageMult = 1, allowStarfire = true } = opts;

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

    const glow = scene.add.circle(p0.x, startY, big ? 34 : 24, glowColor, 0.22);
    glow.setStrokeStyle(1, glowColor, 0.35);
    glow.setDepth(58);

    const star = scene.add.star(p0.x, startY, 5, 6, big ? 22 : 15, starColor, 1);
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

    const shimmerTween = scene.tweens.add({
      targets: star,
      angle: '+=120',
      duration: 520,
      repeat: -1
    });
    const pulseTween = scene.tweens.add({
      targets: [star, glow],
      scale: { from: 0.95, to: 1.08 },
      duration: 240,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    spawnSparkles(scene, p0.x, startY, outlineColor, starColor);

    const fallMs = big ? 320 : 260;
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
        if (shimmerTween) shimmerTween.stop();
        if (pulseTween) pulseTween.stop();

        if (star && star.active) star.destroy();
        if (glow && glow.active) glow.destroy();

        const pos = resolveAim();
        const impactX = pos.x;
        const impactY = pos.y;

        const aoeRadius = big ? 110 : 70;
        const damage = Math.max(1, Math.round(player.bulletDamage * 0.92 * damageMult));

        const aoeBullet = scene.bulletManager?.createPlayerBullet(
          impactX,
          impactY,
          scheme.coreColor,
          {
            radius: aoeRadius,
            speed: 0,
            damage,
            hasGlow: false,
            hasTrail: false,
            glowRadius: 0,
            isAbsoluteAngle: true,
            angleOffset: 0,
            homing: false,
            explode: false,
            skipUpdate: false
          }
        );

        if (aoeBullet) {
          aoeBullet.alpha = 0.001;
          // 不能太短：否则掉帧时（delta 很大）会在 BulletManager.update 中先被寿命回收，
          // 导致本帧 CollisionManager 还没检查就已经消失。
          aoeBullet.maxLifeMs = 240;
          // AOE：需要同时命中 Boss 与伴随怪；否则会先命中 Boss 被销毁，导致小怪不掉血。
          aoeBullet.pierce = true;
          aoeBullet.maxHits = 999;
          aoeBullet.hitCooldownMs = 250;

          const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);
          applyEnhancementsToBullet(aoeBullet, enh, scheme);

          player.bullets.push(aoeBullet);
          while (player.bullets.length > player.maxBullets) {
            player.bullets.shift();
          }
        }

        createImpactVfx(scene, impactX, impactY, scheme, aoeRadius);
        spawnSparkles(scene, impactX, impactY, outlineColor, starColor);

        // 星火：30% 概率额外触发一次（不连锁）
        if (allowStarfire && player.druidStarfire && Math.random() < 0.3) {
          spawnOne({ x: impactX, y: impactY }, { big: false, damageMult: 0.82, allowStarfire: false });
        }
      }
    });
  };

  for (let i = 0; i < count; i++) {
    const dx = count > 1 ? Phaser.Math.Between(-34, 34) : 0;
    const dy = count > 1 ? Phaser.Math.Between(-34, 34) : 0;
    const dmgMult = player.druidMeteorShower ? 0.78 : 1;
    // 追踪命中：锁定目标本体（而非地点），偏移仅用于多颗散布
    spawnOne({ target, offsetX: dx, offsetY: dy }, { big: isMeteor, damageMult: isMeteor ? 1.35 * dmgMult : dmgMult, allowStarfire: i === 0 });
  }
}
