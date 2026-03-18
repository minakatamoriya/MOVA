import Phaser from 'phaser';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';

// ── 战士配色 ──
const WARRIOR_CORE   = 0xff3a3a;
const WARRIOR_BRIGHT = 0xff7777;
const WARRIOR_GLOW   = 0xffb3b3;

function getWarriorScheme(player) {
  const base = getBasicSkillColorScheme('warrior', player.offCoreKey);
  return {
    ...base,
    coreColor: WARRIOR_CORE,
    coreBright: WARRIOR_BRIGHT,
    accentColor: WARRIOR_CORE,
    glowColor: WARRIOR_GLOW,
    trailColor: WARRIOR_CORE,
  };
}

/**
 * 椭圆采样点（用于弧形命中判定）
 */
function ellipsePoint(phi, r, yScale) {
  return { x: Math.cos(phi) * r, y: Math.sin(phi) * r * yScale };
}

// ═════════════════════════════════════════════
//  spawnWarriorMeleeHit —— 近战 / 旋风斩命中判定
// ═════════════════════════════════════════════

export function spawnWarriorMeleeHit(scene, facingAngle) {
  const player = scene.player;
  if (!player) return;

  const angle = (typeof facingAngle === 'number') ? facingAngle : -Math.PI / 2;

  const scheme = getWarriorScheme(player);
  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const arcSpan = player.warriorSpin ? Math.PI * 2 : (Math.PI * 1.12);
  const start = -arcSpan / 2;
  const end = arcSpan / 2;
  const yScale = Phaser.Math.Clamp(scene.slashEllipseYScale ?? 0.78, 0.55, 0.95);

  const rawRange = scene.meleeRange || 220;
  const hitRange = player.warriorSpin ? rawRange : (rawRange * 0.60);
  const spinMax = Phaser.Math.Clamp(rawRange, 90, 420);
  const halfMoonMax = 260;
  const hitRadius = Phaser.Math.Clamp(Math.floor(hitRange), 46, player.warriorSpin ? spinMax : halfMoonMax);

  // 计算弧形碰撞采样点
  const arcSamples = [];
  const ringRadii = player.warriorSpin
    ? [hitRadius * 0.35, hitRadius * 0.70, hitRadius]
    : [hitRadius * 0.45, hitRadius * 0.72, hitRadius];
  const sampleCount = player.warriorSpin ? 20 : 18;

  for (let r = 0; r < ringRadii.length; r++) {
    const rr = ringRadii[r];
    for (let s = 0; s < sampleCount; s++) {
      const t = sampleCount === 1 ? 0.5 : (s / (sampleCount - 1));
      const phi = Phaser.Math.Linear(start, end, t);
      const p = ellipsePoint(phi, rr, yScale);
      arcSamples.push({ x: p.x, y: p.y });
    }
  }

  // 通过 BulletCore 统一入口创建不可见区域子弹
  const bullet = scene.createManagedPlayerAreaBullet(
    player.x, player.y,
    scheme.coreBright,
    {
      radius: 14,
      damage: Math.max(1, Math.round((player.bulletDamage || 34) * 1.05)),
      alpha: 0.001,
      maxLifeMs: 140,
      pierce: true,
      maxHits: 99,
      hitCooldownMs: 9999,
      angleOffset: angle,
      depth: 4,
      tags: ['warrior_melee'],
      flags: {
        followPlayer: true,
        hitShape: 'arcSamples',
        arcSampleRadius: player.warriorSpin ? 14 : 18,
        arcSamples,
        visualCoreColor: scheme.coreBright,
        visualAccentColor: scheme.coreColor,
      }
    }
  );

  if (!bullet) return;
  if (enh) applyEnhancementsToBullet(bullet, enh, scheme);
  player.bullets.push(bullet);
}

// ═════════════════════════════════════════════
//  spawnWarriorCrescentProjectile —— 剑气月牙
// ═════════════════════════════════════════════

export function spawnWarriorCrescentProjectile(scene, facingAngle, swingDir) {
  const player = scene.player;
  if (!player) return;

  const angle = (typeof facingAngle === 'number') ? facingAngle : -Math.PI / 2;

  const forward = player.visualRadius + 14;
  const lateral = 14;
  const perp = angle + Math.PI / 2;
  const spawnX = player.x + Math.cos(angle) * forward + Math.cos(perp) * lateral * (swingDir > 0 ? 1 : -1);
  const spawnY = player.y + Math.sin(angle) * forward + Math.sin(perp) * lateral * (swingDir > 0 ? 1 : -1);

  const scheme = getWarriorScheme(player);
  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const baseRange = (scene.meleeRange || 220) * 0.48;
  const arcSpan = scene.slashArcSpan || Math.PI;
  const start = -arcSpan / 2;
  const end = arcSpan / 2;
  const yScale = Phaser.Math.Clamp(scene.slashEllipseYScale ?? 0.78, 0.55, 0.95);

  const crescentR = Phaser.Math.Clamp(Math.floor(baseRange), 34, 78);
  const thickness = Phaser.Math.Clamp(Math.floor(crescentR * 0.26), 10, 22);
  const outerR = crescentR + Math.floor(thickness * 0.55);
  const innerR = Math.max(8, crescentR - Math.floor(thickness * 0.55));
  const collisionRadius = Math.max(8, Math.floor(thickness * 0.55));
  const segments = 72;

  // ── 通过 BulletCore 统一入口创建碰撞子弹（不可见圆形） ──
  const bullet = scene.createManagedPlayerBullet(
    spawnX, spawnY,
    scheme.coreBright,
    {
      radius: collisionRadius,
      speed: 640,
      damage: Math.max(1, Math.round((player.bulletDamage || 34) * 1.05)),
      angleOffset: angle,
      isAbsoluteAngle: true,
      hasGlow: false,
      hasTrail: false,
      homing: !!player.warriorSwordQi,
      homingTurn: player.warriorSwordQi ? 0.08 : 0.04,
      maxLifeMs: player.warriorSwordQi ? 720 : 520,
      tags: ['warrior_crescent'],
    }
  );

  if (!bullet) return;

  // 隐藏碰撞用圆形
  if (bullet.setFillStyle) bullet.setFillStyle(scheme.coreBright, 0.001);
  if (bullet.setStrokeStyle) bullet.setStrokeStyle(0);

  // 自定义弧形碰撞
  bullet.hitShape = 'arcSamples';
  bullet.arcSampleRadius = collisionRadius;
  bullet.arcSamples = [];
  const sampleCount = 9;
  for (let s = 0; s < sampleCount; s++) {
    const tt = sampleCount === 1 ? 0.5 : (s / (sampleCount - 1));
    const phi = Phaser.Math.Linear(start, end, tt);
    const p = ellipsePoint(phi, crescentR, yScale);
    bullet.arcSamples.push({ x: p.x, y: p.y });
  }

  bullet.pierce = true;
  bullet.maxHits = 99;
  bullet.hitCooldownMs = 9999;
  bullet.visualCoreColor = scheme.coreBright;
  bullet.visualAccentColor = scheme.coreColor;

  // ── 月牙视觉 (Graphics) ──
  const crescentGfx = scene.add.graphics({ x: 0, y: 0 });
  crescentGfx.setBlendMode(Phaser.BlendModes.ADD);

  crescentGfx.fillStyle(scheme.coreBright, 0.40);
  crescentGfx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const phi = Phaser.Math.Linear(start, end, t);
    const p = ellipsePoint(phi, outerR, yScale);
    if (i === 0) crescentGfx.moveTo(p.x, p.y); else crescentGfx.lineTo(p.x, p.y);
  }
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const phi = Phaser.Math.Linear(start, end, t);
    const p = ellipsePoint(phi, innerR, yScale);
    crescentGfx.lineTo(p.x, p.y);
  }
  crescentGfx.closePath();
  crescentGfx.fillPath();

  crescentGfx.lineStyle(18, scheme.coreColor, 0.14);
  crescentGfx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const phi = Phaser.Math.Linear(start, end, t);
    const p = ellipsePoint(phi, outerR, yScale);
    if (i === 0) crescentGfx.moveTo(p.x, p.y); else crescentGfx.lineTo(p.x, p.y);
  }
  crescentGfx.strokePath();

  crescentGfx.lineStyle(10, scheme.coreBright, 0.92);
  crescentGfx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const phi = Phaser.Math.Linear(start, end, t);
    const p = ellipsePoint(phi, crescentR, yScale);
    if (i === 0) crescentGfx.moveTo(p.x, p.y); else crescentGfx.lineTo(p.x, p.y);
  }
  crescentGfx.strokePath();

  crescentGfx.lineStyle(5, 0xffffff, 0.30);
  crescentGfx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const phi = Phaser.Math.Linear(start + 0.03, end - 0.03, t);
    const p = ellipsePoint(phi, innerR + 2, yScale);
    if (i === 0) crescentGfx.moveTo(p.x, p.y); else crescentGfx.lineTo(p.x, p.y);
  }
  crescentGfx.strokePath();

  // 辉光 + 月牙视觉组合为 Container，由 BulletManager 自动跟随位置并在销毁时清理
  const glowCircle = scene.add.circle(0, 0, 26, scheme.glowColor, 0.10);
  glowCircle.setStrokeStyle(2, scheme.coreColor, 0.12);

  const visual = scene.add.container(spawnX, spawnY, [glowCircle, crescentGfx]);
  visual.setDepth(5);
  visual.rotation = angle;
  bullet.glow = visual;

  // 拖尾
  bullet.trailTimer = scene.time.addEvent({
    delay: 70,
    repeat: -1,
    callback: () => {
      if (!bullet.active || bullet.markedForRemoval) {
        if (bullet.trailTimer) bullet.trailTimer.remove();
        bullet.trailTimer = null;
        return;
      }
      const emitAt = (lx, ly) => {
        const cosR = Math.cos(bullet.rotation || 0);
        const sinR = Math.sin(bullet.rotation || 0);
        const ex = bullet.x + (lx * cosR - ly * sinR);
        const ey = bullet.y + (lx * sinR + ly * cosR);
        const pt = scene.add.circle(
          ex + Phaser.Math.Between(-2, 2),
          ey + Phaser.Math.Between(-2, 2),
          Phaser.Math.Between(2, 3),
          scheme.trailColor, 0.75
        );
        scene.tweens.add({
          targets: pt, alpha: 0, scale: 0.15,
          duration: 240, onComplete: () => pt.destroy()
        });
      };
      emitAt(ellipsePoint(start, outerR, yScale).x, ellipsePoint(start, outerR, yScale).y);
      emitAt(ellipsePoint(end, outerR, yScale).x, ellipsePoint(end, outerR, yScale).y);
    }
  });

  if (enh) applyEnhancementsToBullet(bullet, enh, scheme);
  player.bullets.push(bullet);
}
