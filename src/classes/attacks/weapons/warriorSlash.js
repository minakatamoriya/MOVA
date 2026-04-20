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

function wrapAngle(angle) {
  let value = angle;
  while (value <= -Math.PI) value += Math.PI * 2;
  while (value > Math.PI) value -= Math.PI * 2;
  return value;
}

function sampleEllipseArc(radiusX, radiusY, startTheta, endTheta, count, clockwise = false) {
  const points = [];
  let delta = wrapAngle(endTheta - startTheta);
  if (clockwise) {
    if (delta >= 0) delta -= Math.PI * 2;
  } else if (delta <= 0) {
    delta += Math.PI * 2;
  }

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1));
    const theta = startTheta + delta * t;
    points.push({
      x: Math.cos(theta) * radiusX,
      y: Math.sin(theta) * radiusY,
      t
    });
  }

  return points;
}

function buildVacuumBladeGeom(length, baseWidth, swingDir, curveLift = 0) {
  const dir = swingDir >= 0 ? 1 : -1;
  const radiusX = Math.max(28, length * 0.58);
  const radiusY = Math.max(10, baseWidth * 2.15);
  const sliceAngle = Phaser.Math.DegToRad(60) * dir;
  const axisX = Math.cos(sliceAngle);
  const axisY = Math.sin(sliceAngle);
  const denom = Math.sqrt(((axisX * axisX) / (radiusX * radiusX)) + ((axisY * axisY) / (radiusY * radiusY)));
  const lineScale = denom > 0 ? (1 / denom) : 0;
  const lineA = { x: axisX * lineScale, y: axisY * lineScale };
  const lineB = { x: -lineA.x, y: -lineA.y };
  const thetaA = Math.atan2(lineA.y / radiusY, lineA.x / radiusX);
  const thetaB = Math.atan2(lineB.y / radiusY, lineB.x / radiusX);

  const arcForward = sampleEllipseArc(radiusX, radiusY, thetaA, thetaB, 20, false);
  const arcBackward = sampleEllipseArc(radiusX, radiusY, thetaA, thetaB, 20, true);
  const pickScore = (pts) => pts.reduce((acc, pt) => acc + pt.x, 0);
  const outerPoints = pickScore(arcForward) >= pickScore(arcBackward) ? arcForward : arcBackward;

  const centerPoints = outerPoints.map((pt) => {
    const proj = pt.x * axisX + pt.y * axisY;
    const linePtX = axisX * proj;
    const linePtY = axisY * proj;
    return {
      x: Phaser.Math.Linear(linePtX, pt.x, 0.42),
      y: Phaser.Math.Linear(linePtY, pt.y, 0.42)
    };
  });

  const apexPoint = outerPoints.reduce((best, pt) => {
    if (!best) return pt;
    return pt.x > best.x ? pt : best;
  }, null) || outerPoints[Math.floor(outerPoints.length / 2)] || { x: radiusX * 0.6, y: 0 };

  return {
    outerPoints,
    centerPoints,
    lineStart: outerPoints[0] || lineA,
    lineEnd: outerPoints[outerPoints.length - 1] || lineB,
    apexPoint,
    sliceAngle,
    length,
    baseWidth,
    dir,
    curveLift,
    radiusX,
    radiusY
  };
}

function tracePolyline(graphics, points, widthBias = 0) {
  if (!Array.isArray(points) || points.length === 0) return;
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y + widthBias);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i].x, points[i].y + widthBias);
  }
  graphics.strokePath();
}

function buildSlashVisual(scene, scheme, geom, opts = {}) {
  const {
    fillAlpha = 0.24,
    shellAlpha = 0.11,
    coreAlpha = 0.92,
    edgeAlpha = 0.50,
    rimAlpha = 0.10,
    hazeAlpha = 0.08,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    x = 0,
    y = 0,
    depth = 5,
    blendMode = Phaser.BlendModes.ADD
  } = opts;

  const {
    outerPoints,
    centerPoints,
    lineStart,
    lineEnd,
    apexPoint,
    sliceAngle,
    glowWidth,
    coreWidth,
    edgeWidth,
    hazeRadiusX,
    hazeRadiusY,
    flareShiftY,
    flareRadius,
    dir
  } = geom;

  const gfx = scene.add.graphics({ x: 0, y: 0 });
  gfx.setBlendMode(blendMode);

  gfx.fillStyle(scheme.coreBright, fillAlpha);
  gfx.beginPath();
  gfx.moveTo(lineStart.x, lineStart.y);
  for (let i = 1; i < outerPoints.length; i++) {
    gfx.lineTo(outerPoints[i].x, outerPoints[i].y);
  }
  gfx.closePath();
  gfx.fillPath();

  gfx.lineStyle(glowWidth, scheme.glowColor, shellAlpha);
  tracePolyline(gfx, outerPoints);

  gfx.lineStyle(coreWidth, scheme.coreColor, coreAlpha);
  tracePolyline(gfx, centerPoints);

  gfx.lineStyle(edgeWidth, 0xffffff, edgeAlpha);
  const edgePoints = outerPoints.map((pt, index) => {
    const inner = centerPoints[index] || pt;
    return {
      x: Phaser.Math.Linear(inner.x, pt.x, 0.82),
      y: Phaser.Math.Linear(inner.y, pt.y, 0.82)
    };
  });
  tracePolyline(gfx, edgePoints);

  gfx.lineStyle(Math.max(1, edgeWidth - 1), scheme.coreColor, 0.18);
  gfx.beginPath();
  gfx.moveTo(lineEnd.x, lineEnd.y);
  gfx.lineTo(lineStart.x, lineStart.y);
  gfx.strokePath();

  const haze = scene.add.ellipse(0, 0, hazeRadiusX, hazeRadiusY, scheme.glowColor, hazeAlpha);
  haze.setBlendMode(blendMode);
  haze.rotation = sliceAngle * 0.28;

  const rim = scene.add.ellipse(0, 0, hazeRadiusX * 0.94, hazeRadiusY * 0.68, scheme.coreColor, 0);
  rim.setStrokeStyle(2, scheme.coreColor, rimAlpha);
  rim.setBlendMode(blendMode);

  const flare = scene.add.ellipse(apexPoint.x, apexPoint.y + flareShiftY, flareRadius * 1.9, flareRadius, 0xffffff, 0.16);
  flare.setBlendMode(blendMode);

  const flareCore = scene.add.ellipse(apexPoint.x + 2, apexPoint.y + flareShiftY, flareRadius, Math.max(3, flareRadius * 0.42), scheme.coreBright, 0.34);
  flareCore.setBlendMode(blendMode);

  const visual = scene.add.container(x, y, [haze, rim, flare, flareCore, gfx]);
  visual.setDepth(depth);
  visual.setScale(scaleX, scaleY);
  visual.rotation = rotation;
  return visual;
}

function spawnSlashAfterimage(scene, scheme, geom, x, y, rotation, swingDir, depth) {
  const ghost = buildSlashVisual(scene, scheme, geom, {
    fillAlpha: 0.11,
    shellAlpha: 0.06,
    coreAlpha: 0.20,
    edgeAlpha: 0.09,
    rimAlpha: 0.05,
    hazeAlpha: 0.05,
    depth,
    x,
    y,
    scaleX: 1.07,
    scaleY: 1.01,
    rotation: rotation + 0.014 * swingDir
  });

  scene.tweens.add({
    targets: ghost,
    alpha: 0,
    scaleX: 1.16,
    scaleY: 1.03,
    x: x - Math.cos(rotation) * 14,
    y: y - Math.sin(rotation) * 14,
    duration: 96,
    ease: 'Quad.Out',
    onComplete: () => ghost.destroy()
  });

  return ghost;
}

// ═════════════════════════════════════════════
//  spawnWarriorMeleeHit —— 近战 / 旋风斩命中判定
// ═════════════════════════════════════════════

export function spawnWarriorMeleeHit(scene, facingAngle, opts = {}) {
  const player = scene.player;
  if (!player) return;

  const angle = (typeof facingAngle === 'number') ? facingAngle : -Math.PI / 2;
  const swingDir = opts.swingDir >= 0 ? 1 : -1;
  const sweepDurationMs = Math.max(120, Math.round(Number(opts.durationMs || scene.slashSwingDuration || 420)));

  const scheme = getWarriorScheme(player);
  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const arcDegByLevel = [180, 360];
  const arcLevel = Phaser.Math.Clamp(Math.round(player.warriorArcLevel || 0), 0, 1);
  const bladestormLevel = Phaser.Math.Clamp(Math.round(player.warriorBladestorm || 0), 0, 3);
  const hasBladestorm = !!player.warriorSpin && bladestormLevel > 0;
  const unyieldingLevel = Phaser.Math.Clamp(Math.round(player.warriorUnyielding || 0), 0, 3);
  const warriorDamageLevel = Phaser.Math.Clamp(Math.round(player.warriorDamageLevel || 0), 0, 3);
  const warriorDamageMult = [1, 1.12, 1.24, 1.40][warriorDamageLevel] || 1;
  const lowHpRatio = (player.maxHp || 0) > 0 ? ((player.hp || 0) / player.maxHp) : 1;
  const unyieldingDamageMult = lowHpRatio <= 0.35 ? ([1, 1.12, 1.24, 1.40][unyieldingLevel] || 1) : 1;
  const arcSpan = (player.warriorSpin || hasBladestorm) ? Math.PI * 2 : Phaser.Math.DegToRad(arcDegByLevel[arcLevel] || 90);
  const isFullCircle = arcSpan >= (Math.PI * 2 - 0.001);
  const start = -arcSpan / 2;
  const end = arcSpan / 2;
  const yScale = isFullCircle ? 1 : Phaser.Math.Clamp(scene.slashEllipseYScale ?? 0.78, 0.55, 0.95);

  const rawRange = scene.getWarriorSenseRange?.() || scene.meleeRange || player.warriorRange || 220;
  const hitRange = Phaser.Math.Clamp(rawRange, 46, 420);
  const hitRadius = hitRange;
  const sweepStartAngle = angle + (swingDir > 0 ? start : end);
  const sweepEndAngle = angle + (swingDir > 0 ? end : start);
  const sweepThickness = (player.warriorSpin || hasBladestorm) ? 18 : 16;

  // 通过 BulletCore 统一入口创建不可见区域子弹
  const bullet = scene.createManagedPlayerAreaBullet(
    player.x, player.y,
    scheme.coreBright,
    {
      radius: sweepThickness,
      damage: Math.max(1, Math.round((player.bulletDamage || 34) * (1.05 + bladestormLevel * 0.14) * warriorDamageMult * unyieldingDamageMult)),
      alpha: 0.001,
      maxLifeMs: sweepDurationMs,
      pierce: true,
      maxHits: 99,
      hitCooldownMs: Math.max(120, sweepDurationMs - 16),
      angleOffset: angle,
      depth: 4,
      tags: ['warrior_melee'],
      flags: {
        followPlayer: true,
        sweepLine: true,
        sweepStartAngle,
        sweepEndAngle,
        sweepCurrentAngleRaw: sweepStartAngle,
        sweepPrevAngleRaw: sweepStartAngle,
        sweepRadius: hitRadius,
        sweepThickness,
        sweepCollisionStepRad: Phaser.Math.DegToRad(isFullCircle ? 10 : 6),
        sweepStartAt: Number(scene.time?.now || 0),
        sweepDurationMs,
        visualCoreColor: scheme.coreBright,
        visualAccentColor: scheme.coreColor,
      }
    }
  );

  if (!bullet) return;
  bullet.rotation = sweepStartAngle;
  if (enh) applyEnhancementsToBullet(bullet, enh, scheme);
  player.bullets.push(bullet);
}

// ═════════════════════════════════════════════
//  spawnWarriorCrescentProjectile —— 剑气月牙
// ═════════════════════════════════════════════

export function spawnWarriorCrescentProjectile(scene, facingAngle, swingDir) {
  const player = scene.player;
  if (!player) return;

  const swordQiLevel = Phaser.Math.Clamp(Math.round(player.warriorSwordQiLevel || 0), 0, 3);
  const warriorDamageLevel = Phaser.Math.Clamp(Math.round(player.warriorDamageLevel || 0), 0, 3);
  const warriorDamageMult = [1, 1.12, 1.24, 1.40][warriorDamageLevel] || 1;

  const angle = (typeof facingAngle === 'number') ? facingAngle : -Math.PI / 2;

  const forward = player.visualRadius + 18;
  const lateral = 10;
  const perp = angle + Math.PI / 2;
  const spawnX = player.x + Math.cos(angle) * forward + Math.cos(perp) * lateral * (swingDir > 0 ? 1 : -1);
  const spawnY = player.y + Math.sin(angle) * forward + Math.sin(perp) * lateral * (swingDir > 0 ? 1 : -1);

  const scheme = getWarriorScheme(player);
  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  const rangeScaleByLevel = [1.0, 1.0, 1.0, 1.0];
  const widthScaleByLevel = [0.94, 1.0, 1.06, 1.10];
  const damageScaleByLevel = [0.48, 0.60, 0.75, 0.70];
  const speedByLevel = [700, 860, 1020, 1180];
  const lifeByLevel = [340, 380, 430, 500];

  const bladeLength = Phaser.Math.Clamp(Math.floor((scene.meleeRange || 220) * 0.70 * (rangeScaleByLevel[swordQiLevel] || 1)), 96, 168);
  const bladeWidth = Phaser.Math.Clamp(Math.floor(bladeLength * 0.11 * (widthScaleByLevel[swordQiLevel] || 1)), 10, 20);
  const curveLift = Phaser.Math.Clamp(Math.round(bladeWidth * 0.52), 4, 12) * (swingDir >= 0 ? 1 : -1);
  const bladeGeom = buildVacuumBladeGeom(bladeLength, bladeWidth, swingDir || 1, curveLift);
  const collisionRadius = Math.max(5, Math.floor(bladeWidth * 0.42));
  const geom = {
    ...bladeGeom,
    glowWidth: Math.max(8, Math.round(bladeWidth * 1.08)),
    coreWidth: Math.max(4, Math.round(bladeWidth * 0.44)),
    edgeWidth: Math.max(2, Math.round(bladeWidth * 0.20)),
    hazeRadiusX: bladeLength * 0.98,
    hazeRadiusY: Math.max(18, bladeWidth * 2.2),
    flareShiftY: curveLift * 0.14,
    flareRadius: Math.max(7, Math.round(bladeWidth * 0.72))
  };

  // ── 通过 BulletCore 统一入口创建碰撞子弹（不可见圆形） ──
  const bullet = scene.createManagedPlayerBullet(
    spawnX, spawnY,
    scheme.coreBright,
    {
      radius: collisionRadius,
      speed: speedByLevel[swordQiLevel] || 640,
      damage: Math.max(1, Math.round((player.bulletDamage || 34) * (damageScaleByLevel[swordQiLevel] || 0.6) * warriorDamageMult)),
      angleOffset: angle,
      isAbsoluteAngle: true,
      hasGlow: false,
      hasTrail: false,
      homing: false,
      maxLifeMs: lifeByLevel[swordQiLevel] || 520,
      tags: ['warrior_crescent'],
    }
  );

  if (!bullet) return;

  // 隐藏碰撞用圆形
  if (bullet.setFillStyle) bullet.setFillStyle(scheme.coreBright, 0.001);
  if (bullet.setStrokeStyle) bullet.setStrokeStyle(0);

  // 预留的风刃碰撞：后续回旋斩若恢复外放刀波，可继续复用这条中心线采样
  bullet.hitShape = 'arcSamples';
  bullet.arcSampleRadius = collisionRadius;
  bullet.arcSamples = bladeGeom.centerPoints.map((pt) => ({ x: pt.x, y: pt.y }));

  bullet.pierce = true;
  bullet.maxHits = 99;
  bullet.hitCooldownMs = 9999;
  bullet.visualCoreColor = scheme.coreBright;
  bullet.visualAccentColor = scheme.coreColor;

  const visual = buildSlashVisual(scene, scheme, geom, {
    depth: 5,
    x: spawnX,
    y: spawnY,
    rotation: angle
  });
  bullet.glow = visual;

  // 半透明刀痕残影
  bullet.trailTimer = scene.time.addEvent({
    delay: 28,
    repeat: -1,
    callback: () => {
      if (!bullet.active || bullet.markedForRemoval) {
        if (bullet.trailTimer) bullet.trailTimer.remove();
        bullet.trailTimer = null;
        return;
      }

      const rotation = bullet.rotation || angle;
      const backstep = Math.max(10, bullet.speed * 0.012);
      const ghostX = bullet.x - Math.cos(rotation) * backstep;
      const ghostY = bullet.y - Math.sin(rotation) * backstep;
      spawnSlashAfterimage(scene, scheme, geom, ghostX, ghostY, rotation, swingDir || 1, 4);

      const streak = scene.add.ellipse(
        ghostX - Math.cos(rotation) * 16,
        ghostY - Math.sin(rotation) * 16,
        Math.max(34, bladeWidth * 3.3),
        Math.max(4, bladeWidth * 0.42),
        scheme.trailColor,
        0.12
      );
      streak.rotation = rotation;
      streak.setBlendMode(Phaser.BlendModes.ADD);
      streak.setDepth(4);
      scene.tweens.add({
        targets: streak,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 0.28,
        duration: 90,
        ease: 'Quad.Out',
        onComplete: () => streak.destroy()
      });
    }
  });

  if (enh) applyEnhancementsToBullet(bullet, enh, scheme);
  player.bullets.push(bullet);
}
