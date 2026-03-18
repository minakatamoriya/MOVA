import Phaser from 'phaser';

function ensureMotionBag(bullet) {
  if (!bullet) return null;
  bullet.motionModifiers = bullet.motionModifiers || Object.create(null);
  return bullet.motionModifiers;
}

export default class MotionModifier {
  static applyAcceleration(bullet, config = {}) {
    const bag = ensureMotionBag(bullet);
    if (!bag) return bullet;
    bag.acceleration = {
      startSpeed: Number(config.startSpeed ?? bullet.speed ?? 0),
      endSpeed: Number(config.endSpeed ?? bullet.speed ?? 0),
      durationMs: Math.max(1, Math.round(Number(config.durationMs || 1))),
      elapsedMs: 0
    };
    return bullet;
  }

  static applyDeceleration(bullet, config = {}) {
    return MotionModifier.applyAcceleration(bullet, {
      startSpeed: Number(config.startSpeed ?? bullet.speed ?? 0),
      endSpeed: Number(config.endSpeed ?? 0),
      durationMs: config.durationMs
    });
  }

  static applySineWave(bullet, config = {}) {
    const bag = ensureMotionBag(bullet);
    if (!bag) return bullet;
    bag.sine = {
      amplitude: Number(config.amplitude || 0),
      frequency: Number(config.frequency || 0.008),
      axisAngle: Number.isFinite(Number(config.axisAngle)) ? Number(config.axisAngle) : ((bullet.angleRad ?? bullet.angleOffset ?? 0) + Math.PI / 2),
      elapsedMs: 0
    };
    return bullet;
  }

  static applyHoming(bullet, config = {}) {
    if (!bullet) return bullet;
    bullet.homing = true;
    bullet.homingTurn = Number(config.turnRate ?? bullet.homingTurn ?? 0.04);
    bullet.homingMode = config.mode || bullet.homingMode || null;
    bullet.lockTarget = config.target || bullet.lockTarget || null;
    return bullet;
  }

  static applyBounce(bullet, config = {}) {
    if (!bullet) return bullet;
    bullet.canBounce = true;
    bullet.maxBounceCount = Math.max(1, Math.round(Number(config.count || 1)));
    bullet.bounceRange = Math.max(0, Number(config.range || 720));
    return bullet;
  }

  static applySplitOnHit(bullet, config = {}) {
    const bag = ensureMotionBag(bullet);
    if (!bag) return bullet;
    bag.splitOnHit = {
      count: Math.max(1, Math.round(Number(config.count || 2))),
      spreadRad: Number.isFinite(Number(config.spreadRad)) ? Number(config.spreadRad) : Phaser.Math.DegToRad(16),
      speed: Number(config.speed ?? bullet.speed ?? 0),
      damageScale: Number(config.damageScale ?? 0.6)
    };
    return bullet;
  }

  static applyOnDeathSpawn(bullet, config = {}) {
    const bag = ensureMotionBag(bullet);
    if (!bag) return bullet;
    bag.onDeathSpawn = {
      pattern: config.pattern || 'ring',
      count: Math.max(1, Math.round(Number(config.count || 6))),
      speed: Number(config.speed ?? bullet.speed ?? 0),
      damageScale: Number(config.damageScale ?? 0.5),
      radius: Number(config.radius ?? bullet.radius ?? 6),
      color: config.color ?? bullet.visualCoreColor ?? 0xffffff
    };
    return bullet;
  }

  static updateBulletMotion(bullet, deltaMs) {
    if (!bullet?.motionModifiers) return bullet;

    const bag = bullet.motionModifiers;

    if (bag.acceleration) {
      bag.acceleration.elapsedMs += deltaMs;
      const t = Phaser.Math.Clamp(bag.acceleration.elapsedMs / Math.max(1, bag.acceleration.durationMs), 0, 1);
      bullet.speed = Phaser.Math.Linear(bag.acceleration.startSpeed, bag.acceleration.endSpeed, t);
    }

    if (bag.sine) {
      bag.sine.elapsedMs += deltaMs;
      const wave = Math.sin(bag.sine.elapsedMs * bag.sine.frequency) * bag.sine.amplitude;
      bullet.sineOffset = wave;
      bullet.sineAxisAngle = bag.sine.axisAngle;
    }

    return bullet;
  }
}