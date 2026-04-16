import Phaser from 'phaser';

export function getTargetPoint(target) {
  if (!target) return null;
  if (typeof target.getHitboxPosition === 'function') {
    const hitbox = target.getHitboxPosition();
    if (hitbox && Number.isFinite(hitbox.x) && Number.isFinite(hitbox.y)) {
      return {
        x: hitbox.x,
        y: hitbox.y,
        radius: Math.max(0, Number(hitbox.radius || 0))
      };
    }
  }

  return {
    x: Number(target.x || 0),
    y: Number(target.y || 0),
    radius: Math.max(0, Number(target.hitRadius || target.visualRadius || 16))
  };
}

export function getBossPhase(boss) {
  if (!boss?.maxHp) return 1;
  const ratio = Number(boss.currentHp || 0) / Math.max(1, Number(boss.maxHp || 1));
  if (ratio <= 0.35) return 3;
  if (ratio <= 0.70) return 2;
  return 1;
}

export function getWorldRect(scene) {
  const worldRect = scene?.worldBoundsRect;
  if (worldRect && Number.isFinite(worldRect.width) && Number.isFinite(worldRect.height)) {
    return {
      x: Number(worldRect.x || 0),
      y: Number(worldRect.y || 0),
      width: Number(worldRect.width || 0),
      height: Number(worldRect.height || 0)
    };
  }

  const worldView = scene?.cameras?.main?.worldView;
  if (worldView && Number.isFinite(worldView.width) && Number.isFinite(worldView.height)) {
    return {
      x: Number(worldView.x || 0),
      y: Number(worldView.y || 0),
      width: Number(worldView.width || 0),
      height: Number(worldView.height || 0)
    };
  }

  return { x: 0, y: 0, width: 1280, height: 720 };
}

export function clampWorldPoint(scene, x, y, padding = 18) {
  const rect = getWorldRect(scene);
  return {
    x: Phaser.Math.Clamp(Number(x || 0), rect.x + padding, rect.x + rect.width - padding),
    y: Phaser.Math.Clamp(Number(y || 0), rect.y + padding, rect.y + rect.height - padding)
  };
}

export function destroyDisplayObject(obj) {
  try {
    if (obj?.active) obj.destroy();
  } catch (_) {
    // ignore
  }
}

export function clearTrackedHazards(items, destroyKeys = ['core', 'glow', 'glyph', 'ring']) {
  if (!Array.isArray(items)) return;
  items.forEach((item) => {
    destroyKeys.forEach((key) => destroyDisplayObject(item?.[key]));
  });
  items.length = 0;
}

export function lerp(a, b, t) {
  return a + ((b - a) * Phaser.Math.Clamp(Number(t || 0), 0, 1));
}

export function distanceBetween(ax, ay, bx, by) {
  return Math.hypot(Number(bx || 0) - Number(ax || 0), Number(by || 0) - Number(ay || 0));
}

export function segmentDistanceToPoint(ax, ay, bx, by, px, py) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = (abx * abx) + (aby * aby);
  if (len2 <= 0.000001) return Math.hypot(px - ax, py - ay);

  const t = Phaser.Math.Clamp(((apx * abx) + (apy * aby)) / len2, 0, 1);
  const qx = ax + (abx * t);
  const qy = ay + (aby * t);
  return Math.hypot(px - qx, py - qy);
}

export function pointOnSegment(ax, ay, bx, by, px, py) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = (abx * abx) + (aby * aby);
  if (len2 <= 0.000001) return { x: ax, y: ay };

  const t = Phaser.Math.Clamp(((apx * abx) + (apy * aby)) / len2, 0, 1);
  return { x: ax + (abx * t), y: ay + (aby * t) };
}

export function damageTarget(target, amount, scene, x, y, color) {
  const resolved = Math.max(0, Math.round(Number(amount || 0)));
  if (!resolved || !target?.active || target.isAlive === false || typeof target.takeDamage !== 'function') return false;
  target.takeDamage(resolved);
  scene?.createHitEffect?.(x, y, color);
  return true;
}

export function createDiamondGlyph(scene, size, fillColor, strokeColor, fillAlpha = 0.84) {
  const half = Math.max(6, Number(size || 14));
  const g = scene.add.graphics();
  g.fillStyle(fillColor, fillAlpha);
  g.lineStyle(Math.max(2, Math.round(half * 0.18)), strokeColor, 0.96);
  g.beginPath();
  g.moveTo(0, -half);
  g.lineTo(half * 0.72, 0);
  g.lineTo(0, half);
  g.lineTo(-half * 0.72, 0);
  g.closePath();
  g.fillPath();
  g.strokePath();
  return g;
}

export function spawnPersistentLineHazard(scene, owner, list, config = {}) {
  if (!scene?.add || !Array.isArray(list)) return null;
  const core = scene.add.graphics().setDepth(config.depth ?? 7);
  const glow = scene.add.graphics().setDepth((config.depth ?? 7) - 1);
  owner?._trackHazardObject?.(core);
  owner?._trackHazardObject?.(glow);

  const state = {
    x1: Number(config.x1 || 0),
    y1: Number(config.y1 || 0),
    x2: Number(config.x2 || 0),
    y2: Number(config.y2 || 0),
    width: Math.max(8, Number(config.width || 24)),
    damage: Math.max(1, Number(config.damage || 1)),
    color: config.color ?? 0xffffff,
    glowColor: config.glowColor ?? config.color ?? 0xffffff,
    tickIntervalMs: Math.max(80, Math.round(Number(config.tickIntervalMs || 320))),
    expiresAt: Number(scene.time?.now || 0) + Math.max(120, Math.round(Number(config.durationMs || 1000))),
    tickAt: Number(scene.time?.now || 0),
    alpha: Number.isFinite(Number(config.alpha)) ? Number(config.alpha) : 0.92,
    glowAlpha: Number.isFinite(Number(config.glowAlpha)) ? Number(config.glowAlpha) : 0.20,
    pulseRate: Number.isFinite(Number(config.pulseRate)) ? Number(config.pulseRate) : 0.01,
    core,
    glow,
    onUpdate: typeof config.onUpdate === 'function' ? config.onUpdate : null,
    canDamage: typeof config.canDamage === 'function' ? config.canDamage : null,
    onExpire: typeof config.onExpire === 'function' ? config.onExpire : null,
    owner
  };

  list.push(state);
  return state;
}

export function updatePersistentLineHazards(owner, list, time) {
  if (!Array.isArray(list) || list.length <= 0) return;
  const scene = owner?.scene;
  const now = Number(time || scene?.time?.now || 0);
  const target = owner?.getPrimaryTarget?.();
  let writeIndex = 0;

  for (let index = 0; index < list.length; index += 1) {
    const hazard = list[index];
    if (!hazard?.core?.active || !hazard?.glow?.active || now >= (hazard.expiresAt || 0)) {
      hazard?.onExpire?.(hazard, now);
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
      continue;
    }

    hazard.onUpdate?.(hazard, now);

    const pulse = 0.90 + (0.10 * Math.sin((now * hazard.pulseRate) + index));
    const glowWidth = Math.max(hazard.width + 10, Math.round(hazard.width * 1.7));

    hazard.glow.clear();
    hazard.glow.lineStyle(glowWidth, hazard.glowColor, hazard.glowAlpha * pulse);
    hazard.glow.beginPath();
    hazard.glow.moveTo(hazard.x1, hazard.y1);
    hazard.glow.lineTo(hazard.x2, hazard.y2);
    hazard.glow.strokePath();

    hazard.core.clear();
    hazard.core.lineStyle(hazard.width, hazard.color, hazard.alpha * pulse);
    hazard.core.beginPath();
    hazard.core.moveTo(hazard.x1, hazard.y1);
    hazard.core.lineTo(hazard.x2, hazard.y2);
    hazard.core.strokePath();

    hazard.core.lineStyle(Math.max(2, Math.round(hazard.width * 0.22)), 0xffffff, 0.32 * pulse);
    hazard.core.beginPath();
    hazard.core.moveTo(hazard.x1, hazard.y1);
    hazard.core.lineTo(hazard.x2, hazard.y2);
    hazard.core.strokePath();

    if (target?.active && target.isAlive !== false && now >= (hazard.tickAt || 0)) {
      const point = getTargetPoint(target);
      const dist = point ? segmentDistanceToPoint(hazard.x1, hazard.y1, hazard.x2, hazard.y2, point.x, point.y) : Infinity;
      const hitRadius = (hazard.width * 0.5) + (point?.radius || 0);
      const canDamage = hazard.canDamage ? hazard.canDamage(hazard, target, now) : true;
      if (canDamage && point && dist <= hitRadius) {
        const hitPoint = pointOnSegment(hazard.x1, hazard.y1, hazard.x2, hazard.y2, point.x, point.y);
        damageTarget(target, hazard.damage, scene, hitPoint.x, hitPoint.y, hazard.color);
        hazard.tickAt = now + hazard.tickIntervalMs;
      }
    }

    list[writeIndex++] = hazard;
  }

  list.length = writeIndex;
}

export function spawnPersistentCircleHazard(scene, owner, list, config = {}) {
  if (!scene?.add || !Array.isArray(list)) return null;
  const core = scene.add.graphics().setDepth(config.depth ?? 7);
  const glow = scene.add.graphics().setDepth((config.depth ?? 7) - 1);
  owner?._trackHazardObject?.(core);
  owner?._trackHazardObject?.(glow);

  const state = {
    x: Number(config.x || 0),
    y: Number(config.y || 0),
    radius: Math.max(8, Number(config.radius || 24)),
    damage: Math.max(1, Number(config.damage || 1)),
    color: config.color ?? 0xffffff,
    glowColor: config.glowColor ?? config.color ?? 0xffffff,
    tickIntervalMs: Math.max(80, Math.round(Number(config.tickIntervalMs || 320))),
    expiresAt: Number(scene.time?.now || 0) + Math.max(120, Math.round(Number(config.durationMs || 1000))),
    tickAt: Number(scene.time?.now || 0),
    alpha: Number.isFinite(Number(config.alpha)) ? Number(config.alpha) : 0.22,
    strokeAlpha: Number.isFinite(Number(config.strokeAlpha)) ? Number(config.strokeAlpha) : 0.92,
    pulseRate: Number.isFinite(Number(config.pulseRate)) ? Number(config.pulseRate) : 0.008,
    core,
    glow,
    onUpdate: typeof config.onUpdate === 'function' ? config.onUpdate : null,
    canDamage: typeof config.canDamage === 'function' ? config.canDamage : null,
    onExpire: typeof config.onExpire === 'function' ? config.onExpire : null,
    owner
  };

  list.push(state);
  return state;
}

export function updatePersistentCircleHazards(owner, list, time) {
  if (!Array.isArray(list) || list.length <= 0) return;
  const scene = owner?.scene;
  const now = Number(time || scene?.time?.now || 0);
  const target = owner?.getPrimaryTarget?.();
  let writeIndex = 0;

  for (let index = 0; index < list.length; index += 1) {
    const hazard = list[index];
    if (!hazard?.core?.active || !hazard?.glow?.active || now >= (hazard.expiresAt || 0)) {
      hazard?.onExpire?.(hazard, now);
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
      continue;
    }

    hazard.onUpdate?.(hazard, now);

    const pulse = 0.88 + (0.12 * Math.sin((now * hazard.pulseRate) + index));
    const glowRadius = hazard.radius + 12;

    hazard.glow.clear();
    hazard.glow.fillStyle(hazard.glowColor, 0.08 * pulse);
    hazard.glow.fillCircle(hazard.x, hazard.y, glowRadius);

    hazard.core.clear();
    hazard.core.fillStyle(hazard.color, hazard.alpha * pulse);
    hazard.core.fillCircle(hazard.x, hazard.y, hazard.radius);
    hazard.core.lineStyle(Math.max(2, Math.round(hazard.radius * 0.1)), hazard.color, hazard.strokeAlpha * pulse);
    hazard.core.strokeCircle(hazard.x, hazard.y, hazard.radius);
    hazard.core.lineStyle(Math.max(2, Math.round(hazard.radius * 0.05)), 0xffffff, 0.22 * pulse);
    hazard.core.strokeCircle(hazard.x, hazard.y, Math.max(4, hazard.radius - 8));

    if (target?.active && target.isAlive !== false && now >= (hazard.tickAt || 0)) {
      const point = getTargetPoint(target);
      const dist = point ? distanceBetween(hazard.x, hazard.y, point.x, point.y) : Infinity;
      const hitRadius = hazard.radius + (point?.radius || 0);
      const canDamage = hazard.canDamage ? hazard.canDamage(hazard, target, now) : true;
      if (canDamage && point && dist <= hitRadius) {
        damageTarget(target, hazard.damage, scene, point.x, point.y, hazard.color);
        hazard.tickAt = now + hazard.tickIntervalMs;
      }
    }

    list[writeIndex++] = hazard;
  }

  list.length = writeIndex;
}