import Phaser from 'phaser';

function applyDepth(obj, depth) {
  if (obj?.setDepth) obj.setDepth(depth);
  return obj;
}

export default class VfxSystem {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 2400;
  }

  playCharge(x, y, opts = {}) {
    if (!this.scene?.add) return null;
    const radius = Math.max(6, Number(opts.radius || 18));
    const color = opts.color ?? 0x88ffcc;
    const durationMs = Math.max(40, Math.round(Number(opts.durationMs || 260)));

    const ring = applyDepth(this.scene.add.circle(x, y, radius, color, 0.12), this.depth);
    ring.setStrokeStyle(2, color, 0.75);
    ring.setScale(0.35);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.9,
      duration: durationMs,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy()
    });

    return ring;
  }

  playCastFlash(x, y, opts = {}) {
    if (!this.scene?.add) return null;
    const radius = Math.max(8, Number(opts.radius || 26));
    const color = opts.color ?? 0xffffff;
    const durationMs = Math.max(30, Math.round(Number(opts.durationMs || 120)));

    const flash = applyDepth(this.scene.add.circle(x, y, radius, color, 0.8), this.depth + 1);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.6,
      duration: durationMs,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy()
    });

    return flash;
  }

  applyTrailPreset(bullet, preset = 'default', overrides = {}) {
    if (!bullet) return bullet;

    const defaults = {
      default: { hasTrail: true, trailMode: 'dot', trailAlpha: 0.7, trailScale: 1 },
      beam: { hasTrail: true, trailMode: 'streak', trailAlpha: 0.42, trailScaleX: 1.3, trailScaleY: 0.7 },
      ember: { hasTrail: true, trailMode: 'dot', trailAlpha: 0.55, trailScale: 0.85 }
    };

    bullet.vfxTrailPreset = { ...(defaults[preset] || defaults.default), ...overrides };
    return bullet;
  }

  playHit(x, y, opts = {}) {
    if (!this.scene?.add) return null;
    const color = opts.color ?? 0xffff99;
    const radius = Math.max(3, Number(opts.radius || 8));
    const durationMs = Math.max(30, Math.round(Number(opts.durationMs || 110)));

    const spark = applyDepth(this.scene.add.circle(x, y, radius, color, 0.85), this.depth + 1);
    spark.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 2.2,
      duration: durationMs,
      ease: 'Quad.Out',
      onComplete: () => spark.destroy()
    });

    return spark;
  }

  playBurst(x, y, opts = {}) {
    if (!this.scene?.add) return null;
    const radius = Math.max(10, Number(opts.radius || 40));
    const color = opts.color ?? 0xffcc88;
    const durationMs = Math.max(60, Math.round(Number(opts.durationMs || 180)));

    const ring = applyDepth(this.scene.add.circle(x, y, radius, color, 0.08), this.depth);
    ring.setStrokeStyle(3, color, 0.82);
    ring.setScale(0.4);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.8,
      duration: durationMs,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy()
    });

    return ring;
  }

  playDissipate(target, opts = {}) {
    if (!target || !this.scene?.tweens) return null;
    const durationMs = Math.max(30, Math.round(Number(opts.durationMs || 120)));

    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      duration: durationMs,
      ease: 'Quad.Out',
      onComplete: () => {
        if (opts.destroy !== false) {
          try { target.destroy(); } catch (_) { /* ignore */ }
        }
      }
    });

    return target;
  }

  flashScreen(opts = {}) {
    const cam = this.scene?.cameras?.main;
    if (!cam) return null;
    const durationMs = Math.max(20, Math.round(Number(opts.durationMs || 90)));
    const color = Number(opts.color ?? 0xffffff);
    const alpha = Phaser.Math.Clamp(Number(opts.alpha ?? 0.2), 0, 1);
    cam.flash(durationMs, (color >> 16) & 255, (color >> 8) & 255, color & 255, false, (_, progress) => {
      cam.setAlpha(1 - (1 - alpha) * (1 - progress));
      if (progress >= 1) cam.setAlpha(1);
    });
    return cam;
  }

  playGroundTelegraph(x, y, opts = {}) {
    if (!this.scene?.add) return null;
    const radius = Math.max(8, Number(opts.radius || 42));
    const color = opts.color ?? 0xff6666;
    const durationMs = Math.max(60, Math.round(Number(opts.durationMs || 500)));

    const ring = applyDepth(this.scene.add.circle(x, y, radius, color, 0.08), this.depth - 2);
    ring.setStrokeStyle(2, color, 0.9);

    this.scene.tweens.add({
      targets: ring,
      alpha: { from: 0.15, to: 0.5 },
      duration: Math.floor(durationMs / 2),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.scene.time.delayedCall(durationMs, () => {
      if (!ring.active) return;
      this.playDissipate(ring, { durationMs: 80, destroy: true });
    });

    return ring;
  }

  playLineTelegraph(x, y, opts = {}) {
    if (!this.scene?.add) return null;
    const width = Math.max(4, Number(opts.width || 16));
    const length = Math.max(20, Number(opts.length || 320));
    const angle = Number(opts.angle || 0);
    const color = opts.color ?? 0xff6666;
    const durationMs = Math.max(60, Math.round(Number(opts.durationMs || 500)));

    const rect = applyDepth(this.scene.add.rectangle(x, y, length, width, color, 0.16), this.depth - 2);
    rect.setAngle(Phaser.Math.RadToDeg(angle));

    this.scene.tweens.add({
      targets: rect,
      alpha: { from: 0.16, to: 0.45 },
      duration: Math.floor(durationMs / 2),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.scene.time.delayedCall(durationMs, () => {
      if (!rect.active) return;
      this.playDissipate(rect, { durationMs: 70, destroy: true });
    });

    return rect;
  }
}