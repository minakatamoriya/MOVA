import Phaser from 'phaser';
import { breathGlow, organicPulse, organicAlpha } from '../NoiseHelper';

function applyDepth(obj, depth) {
  if (obj?.setDepth) obj.setDepth(depth);
  return obj;
}

export default class VfxSystem {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 2400;
    // 追踪已添加的全局 PostFX，便于清理
    this._globalFx = {};
  }

  // ═══════ PostFX 辅助方法 ═══════

  /** 给任意 GameObject 添加发光 */
  applyGlow(gameObject, color, strength = 4) {
    if (gameObject?.postFX) {
      gameObject.postFX.addGlow(color, strength, 0, false, 0.1, 24);
    }
    return gameObject;
  }

  /** 给任意 GameObject 添加流光扫过 */
  applyShine(gameObject, speed = 0.5, intensity = 0.5, reveal = 5) {
    if (gameObject?.postFX) {
      gameObject.postFX.addShine(speed, intensity, reveal);
    }
    return gameObject;
  }

  /** 给摄像机添加全屏泛光 */
  applyBloom(intensity = 1.2, threshold = 1.6) {
    const cam = this.scene?.cameras?.main;
    if (!cam?.postFX) return null;
    const fx = cam.postFX.addBloom(0xffffff, 1, 1, intensity, threshold);
    this._globalFx.bloom = fx;
    return fx;
  }

  /** 低血量暗角效果 */
  applyVignette(strength = 0.3) {
    const cam = this.scene?.cameras?.main;
    if (!cam?.postFX) return null;
    const fx = cam.postFX.addVignette(0.5, 0.5, strength);
    this._globalFx.vignette = fx;
    return fx;
  }

  /** 受击色偏 */
  applyColorShift(type = 'saturate', value = 1.5) {
    const cam = this.scene?.cameras?.main;
    if (!cam?.postFX) return null;
    const cm = cam.postFX.addColorMatrix();
    if (type === 'saturate') cm.saturate(value);
    else if (type === 'desaturate') cm.desaturate();
    else if (type === 'hue') cm.hue(value);
    this._globalFx.colorShift = cm;
    return cm;
  }

  /** 清除指定全局 PostFX */
  removeGlobalFx(name) {
    const cam = this.scene?.cameras?.main;
    if (this._globalFx[name] && cam?.postFX) {
      cam.postFX.remove(this._globalFx[name]);
      delete this._globalFx[name];
    }
  }

  // ═══════ Noise 增强效果 ═══════

  /** Boss 呼吸光效：根据噪声自然脉动发光强度 */
  updateBreathGlow(gameObject, timeMs, color, base = 4, range = 2) {
    if (!gameObject?.postFX) return;
    const strength = breathGlow(timeMs, base, range);
    // 移除旧 glow 并添加新的（每帧更新）
    gameObject.postFX.clear();
    gameObject.postFX.addGlow(color, Math.max(0, strength), 0, false, 0.1, 24);
  }

  /** 有机缩放脉动（比 Math.sin 更自然） */
  getOrganicPulse(timeMs, seed = 0, amp = 0.06) {
    return organicPulse(timeMs, seed, amp);
  }

  /** 有机透明度波动 */
  getOrganicAlpha(timeMs, seed = 0, min = 0.7, max = 1.0) {
    return organicAlpha(timeMs, seed, min, max);
  }

  // ═══════ 命中震屏 + 时停 ═══════

  /** 命中震屏 */
  shakeCamera(durationMs = 80, intensity = 0.005) {
    const cam = this.scene?.cameras?.main;
    if (cam) cam.shake(durationMs, intensity);
  }

  /** 命中时停（hitlag） */
  hitlag(durationMs = 80) {
    if (!this.scene?.time) return;
    this.scene.time.timeScale = 0.05;
    this.scene.time.delayedCall(durationMs, () => {
      if (this.scene?.time) this.scene.time.timeScale = 1;
    });
  }

  // ═══════ 粒子爆发效果（使用 flare 纹理） ═══════

  /** 命中粒子爆发（使用 Phaser Particle Emitter） */
  playParticleHit(x, y, opts = {}) {
    if (!this.scene?.add || !this.scene.textures?.exists?.('flare')) {
      return this.playHit(x, y, opts);
    }
    const color = opts.color ?? 0xffff99;
    const tints = opts.tints ?? [color, 0xffcc88, 0xffd26a];
    const count = opts.count ?? 8;
    const emitter = this.scene.add.particles(x, y, 'flare', {
      speed: { min: 60, max: 160 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: tints,
      blendMode: 'ADD',
      lifespan: 250,
      quantity: count,
      emitting: false
    });
    applyDepth(emitter, this.depth + 1);
    emitter.explode(count);
    this.scene.time.delayedCall(400, () => { try { emitter.destroy(); } catch (_) {} });
    return emitter;
  }

  /** 弹幕拖尾粒子发射器（绑定到弹幕对象上） */
  createTrailEmitter(bullet, opts = {}) {
    if (!this.scene?.add || !this.scene.textures?.exists?.('flare')) return null;
    const color = opts.color ?? (bullet.visualCoreColor || 0xffffff);
    const emitter = this.scene.add.particles(0, 0, 'flare', {
      follow: bullet,
      scale: { start: opts.startScale ?? 0.35, end: 0 },
      alpha: { start: opts.startAlpha ?? 0.6, end: 0 },
      tint: color,
      blendMode: 'ADD',
      lifespan: opts.lifespan ?? 180,
      frequency: opts.frequency ?? 35
    });
    applyDepth(emitter, this.depth - 1);
    return emitter;
  }

  /** 充能完成爆发（大型粒子爆） */
  playChargeBurst(x, y, opts = {}) {
    if (!this.scene?.add || !this.scene.textures?.exists?.('flare')) {
      return this.playBurst(x, y, opts);
    }
    const color = opts.color ?? 0x88ffcc;
    const count = opts.count ?? 16;
    const emitter = this.scene.add.particles(x, y, 'flare', {
      speed: { min: 100, max: 280 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [color, 0xffffff, color],
      blendMode: 'ADD',
      lifespan: 350,
      quantity: count,
      emitting: false
    });
    applyDepth(emitter, this.depth + 1);
    emitter.explode(count);
    this.scene.time.delayedCall(500, () => { try { emitter.destroy(); } catch (_) {} });
    return emitter;
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