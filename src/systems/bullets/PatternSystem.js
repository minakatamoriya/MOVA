import Phaser from 'phaser';

function toRadians(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeCount(value, fallback = 1) {
  return Math.max(1, Math.round(Number(value || fallback)));
}

// PatternSystem 只负责“怎么排弹型”，不负责具体碰撞和表现实现。
// 发弹最终仍通过 BulletCore 落到现有 BulletManager，对项目侵入最小。
export default class PatternSystem {
  constructor(scene, deps = {}) {
    this.scene = scene;
    this.bulletCore = deps.bulletCore || null;
    this.vfxSystem = deps.vfxSystem || null;
  }

  attach({ bulletCore, vfxSystem } = {}) {
    if (bulletCore) this.bulletCore = bulletCore;
    if (vfxSystem) this.vfxSystem = vfxSystem;
    return this;
  }

  emitFan(config = {}) {
    // 扇形：围绕基准角左右展开，适合 Boss 正面压迫或散射技能。
    const count = normalizeCount(config.count, 3);
    const spreadRad = Number.isFinite(Number(config.spreadRad)) ? Number(config.spreadRad) : Phaser.Math.DegToRad(30);
    const baseAngle = this._resolveBaseAngle(config);
    const half = (count - 1) * 0.5;
    const bullets = [];

    for (let index = 0; index < count; index += 1) {
      const angle = baseAngle + (index - half) * spreadRad;
      bullets.push(this._spawnBulletFromConfig(config, angle));
    }

    return bullets.filter(Boolean);
  }

  emitRing(config = {}) {
    // 环形：常用于延迟爆发、站位驱赶、地图中心向外扩散。
    const count = normalizeCount(config.count, 8);
    const offsetRad = toRadians(config.offsetRad);
    const bullets = [];

    for (let index = 0; index < count; index += 1) {
      const t = index / count;
      const angle = offsetRad + t * Phaser.Math.PI2;
      bullets.push(this._spawnBulletFromConfig(config, angle));
    }

    return bullets.filter(Boolean);
  }

  emitSpiral(config = {}) {
    const loops = normalizeCount(config.loops, 1);
    const shotsPerLoop = normalizeCount(config.shotsPerLoop, 8);
    const angleStep = Number.isFinite(Number(config.angleStepRad))
      ? Number(config.angleStepRad)
      : (Phaser.Math.PI2 / shotsPerLoop);
    const startAngle = this._resolveBaseAngle(config);
    const delayMs = Math.max(0, Math.round(Number(config.delayMs || 60)));
    const totalShots = loops * shotsPerLoop;
    const handles = [];

    for (let index = 0; index < totalShots; index += 1) {
      handles.push(this._schedule(delayMs * index, () => {
        const angle = startAngle + index * angleStep;
        this._spawnBulletFromConfig(config, angle);
      }));
    }

    return handles;
  }

  emitAimed(config = {}) {
    const angle = this._resolveBaseAngle(config);
    return this._spawnBulletFromConfig(config, angle);
  }

  emitDelayedBurst(config = {}) {
    // 延迟爆发：先预警，再在落点处触发二段弹幕/扇形/环形。
    const delayMs = Math.max(0, Math.round(Number(config.delayMs || 500)));
    const telegraph = this.emitGroundTelegraph(config);
    const timer = this._schedule(delayMs, () => {
      this.vfxSystem?.playBurst(config.x, config.y, {
        radius: config.burstRadius || config.telegraphRadius || 56,
        color: config.burstColor ?? config.color,
        durationMs: config.burstFxMs || 220
      });

      if (config.burstPattern === 'ring') {
        this.emitRing(config.burstConfig || config);
        return;
      }

      this.emitFan({ ...config, count: config.count || 6, spreadRad: config.spreadRad || Phaser.Math.DegToRad(18) });
    });

    return { telegraph, timer };
  }

  emitReturning(config = {}) {
    const bullet = this._spawnBulletFromConfig(config, this._resolveBaseAngle(config));
    if (!bullet) return null;

    bullet.returnTo = config.returnTo || { x: config.x, y: config.y };
    bullet.returnAfterMs = Math.max(0, Math.round(Number(config.returnAfterMs || 350)));
    bullet.motionModifiers = bullet.motionModifiers || {};
    bullet.motionModifiers.returning = true;
    return bullet;
  }

  emitLaser(config = {}) {
    // 激光拆成“预警线 + 实体伤害段”两段，便于阅读和调参。
    const angle = this._resolveBaseAngle(config);
    const telegraphMs = Math.max(0, Math.round(Number(config.telegraphMs || 450)));
    const telegraph = this.emitGroundTelegraph({
      ...config,
      shape: 'line',
      angle,
      telegraphWidth: config.width || 26,
      telegraphLength: config.length || 420,
      durationMs: telegraphMs
    });

    const timer = this._schedule(telegraphMs, () => {
      this.vfxSystem?.playCastFlash(config.x, config.y, { color: config.color, durationMs: 140, radius: 42 });
      this._spawnBulletFromConfig({
        ...config,
        type: config.type || 'laser',
        options: {
          ...(config.options || {}),
          width: config.width || 20,
          length: config.length || 420,
          persistMs: config.persistMs || 180
        }
      }, angle);
    });

    return { telegraph, timer };
  }

  emitGroundTelegraph(config = {}) {
    // 这里只画预警，不直接造成伤害；真正伤害仍由后续 bullet/pattern 负责。
    const x = Number(config.x || 0);
    const y = Number(config.y || 0);
    const shape = config.shape || 'circle';
    const durationMs = Math.max(40, Math.round(Number(config.durationMs || config.telegraphMs || 500)));

    if (shape === 'line') {
      return this.vfxSystem?.playLineTelegraph(x, y, {
        angle: this._resolveBaseAngle(config),
        width: config.telegraphWidth || 18,
        length: config.telegraphLength || 360,
        color: config.telegraphColor ?? config.color ?? 0xff6666,
        durationMs
      }) || null;
    }

    return this.vfxSystem?.playGroundTelegraph(x, y, {
      radius: config.telegraphRadius || config.radius || 48,
      color: config.telegraphColor ?? config.color ?? 0xff6666,
      durationMs
    }) || null;
  }

  _resolveBaseAngle(config = {}) {
    if (Number.isFinite(Number(config.angle))) return Number(config.angle);
    if (config.target && Number.isFinite(Number(config.target.x)) && Number.isFinite(Number(config.target.y))) {
      return Phaser.Math.Angle.Between(Number(config.x || 0), Number(config.y || 0), Number(config.target.x), Number(config.target.y));
    }
    return -Math.PI / 2;
  }

  _spawnBulletFromConfig(config = {}, angle) {
    if (!this.bulletCore) return null;
    const side = config.side || 'boss';
    const x = Number(config.x || 0);
    const y = Number(config.y || 0);

    // tags 会被 DebugOverlay 和后续统计复用，默认写入 pattern 名称便于排查。
    return this.bulletCore.createBullet({
      side,
      x,
      y,
      angle,
      speed: Number(config.speed || 0),
      color: config.color ?? 0xffffff,
      radius: Number(config.radius || 6),
      damage: Number(config.damage || 0),
      tags: config.tags || [config.pattern || 'pattern'],
      options: { ...(config.options || {}) }
    });
  }

  _schedule(delayMs, callback) {
    if (!this.scene?.time?.delayedCall) return null;
    return this.scene.time.delayedCall(delayMs, callback);
  }
}