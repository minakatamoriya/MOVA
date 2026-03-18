import Phaser from 'phaser';

function noop() {}

function normalizeSide(side) {
  return side === 'boss' ? 'boss' : 'player';
}

function cloneDescriptor(descriptor = {}) {
  return {
    side: normalizeSide(descriptor.side),
    x: Number(descriptor.x || 0),
    y: Number(descriptor.y || 0),
    angle: Number.isFinite(Number(descriptor.angle)) ? Number(descriptor.angle) : (-Math.PI / 2),
    speed: Math.max(0, Number(descriptor.speed || 0)),
    color: descriptor.color ?? 0xffffff,
    radius: Math.max(1, Number(descriptor.radius || 6)),
    damage: Math.max(0, Number(descriptor.damage || 0)),
    options: { ...(descriptor.options || {}) },
    tags: Array.isArray(descriptor.tags) ? [...descriptor.tags] : []
  };
}

// BulletCore 是对现有 BulletManager/CollisionManager 的薄封装。
// 目标不是重写底层，而是给 Pattern/Vfx/Boss 时间轴提供统一发弹入口。
export default class BulletCore {
  constructor(scene, deps = {}) {
    this.scene = scene;
    this.bulletManager = deps.bulletManager || scene?.bulletManager || null;
    this.collisionManager = deps.collisionManager || scene?.collisionManager || null;

    this.hooks = {
      onSpawn: deps.onSpawn || noop,
      onExpire: deps.onExpire || noop,
      onHit: deps.onHit || noop,
      onDestroy: deps.onDestroy || noop
    };

    this.metrics = {
      created: 0,
      destroyed: 0,
      destroyedByReason: Object.create(null),
      hits: 0,
      lastHitAt: 0,
      lastSpawnAt: 0,
      lastDestroyAt: 0
    };
  }

  attachManagers({ bulletManager, collisionManager } = {}) {
    if (bulletManager) this.bulletManager = bulletManager;
    if (collisionManager) this.collisionManager = collisionManager;
    return this;
  }

  // 统一子弹描述结构：上层只关心 side/angle/speed/radius/damage，
  // 底层仍然交给现有 BulletManager 做对象池、trail、glow 等细节。
  createBullet(descriptor = {}) {
    const resolved = cloneDescriptor(descriptor);
    if (!this.bulletManager) return null;

    const options = {
      radius: resolved.radius,
      damage: resolved.damage,
      isAbsoluteAngle: true,
      angleOffset: resolved.angle,
      ...(resolved.options || {})
    };

    const bullet = resolved.side === 'boss'
      ? this.bulletManager.createBossBullet(
          resolved.x,
          resolved.y,
          resolved.angle,
          resolved.speed,
          resolved.color,
          options
        )
      : this.bulletManager.createPlayerBullet(
          resolved.x,
          resolved.y,
          resolved.color,
          {
            speed: resolved.speed,
            ...options
          }
        );

    if (!bullet) return null;

    // 统一挂载 core 元信息，后续命中/调试/统计都从这里读，避免各层自己推断。
    bullet.bulletCoreSide = resolved.side;
    bullet.bulletCoreTags = resolved.tags;
    bullet.bulletDescriptor = resolved;

    this.metrics.created += 1;
    this.metrics.lastSpawnAt = Number(this.scene?.time?.now || 0);
    this.hooks.onSpawn(bullet, resolved, this);
    return bullet;
  }

  createPlayerBullet(descriptor = {}) {
    return this.createBullet({ ...descriptor, side: 'player' });
  }

  createBossBullet(descriptor = {}) {
    return this.createBullet({ ...descriptor, side: 'boss' });
  }

  // 统一销毁出口，便于后续统计、调试覆盖层与生命周期回调接入。
  destroyBullet(bullet, opts = {}) {
    if (!bullet) return false;

    const side = normalizeSide(opts.side || bullet.bulletCoreSide || (bullet.isPlayerBullet ? 'player' : 'boss'));
    const expired = opts.reason === 'expire';

    if (expired) {
      this.hooks.onExpire(bullet, opts, this);
    }

    if (this.bulletManager?.destroyBullet) {
      this.bulletManager.destroyBullet(bullet, side === 'player');
    } else if (bullet.destroy) {
      bullet.destroy();
    }

    this.metrics.destroyed += 1;
    this.metrics.lastDestroyAt = Number(this.scene?.time?.now || 0);
    const reason = String(opts.reason || 'unknown');
    this.metrics.destroyedByReason[reason] = Number(this.metrics.destroyedByReason[reason] || 0) + 1;
    this.hooks.onDestroy(bullet, opts, this);
    return true;
  }

  notifyHit(payload = {}) {
    const resolvedPayload = {
      ...payload,
      side: normalizeSide(payload.side || payload.bullet?.bulletCoreSide || (payload.bullet?.isPlayerBullet ? 'player' : 'boss')),
      at: Number(this.scene?.time?.now || 0)
    };

    this.metrics.hits += 1;
    this.metrics.lastHitAt = resolvedPayload.at;
    this.hooks.onHit(resolvedPayload, this);
    return resolvedPayload;
  }

  clearAll() {
    if (this.bulletManager?.destroyAllBullets) {
      this.bulletManager.destroyAllBullets();
      return;
    }

    if (this.bulletManager?.clearAll) {
      this.bulletManager.clearAll();
      return;
    }

    this.bulletManager?.clearPlayerBullets?.();
    this.bulletManager?.clearBossBullets?.();
  }

  clearSide(side = 'player') {
    if (normalizeSide(side) === 'boss') {
      this.bulletManager?.clearBossBullets?.();
      return;
    }
    this.bulletManager?.clearPlayerBullets?.();
  }

  getActiveBullets(side) {
    if (!this.bulletManager) return [];
    if (side === 'boss') return this.bulletManager.getBossBullets?.() || [];
    if (side === 'player') return this.bulletManager.getPlayerBullets?.() || [];
    return [
      ...(this.bulletManager.getPlayerBullets?.() || []),
      ...(this.bulletManager.getBossBullets?.() || [])
    ];
  }

  getPoolStats() {
    const managerStats = this.bulletManager?.getStats?.() || {};
    return {
      pooledBullets: Number(managerStats.pooledBullets || 0),
      totalCreated: Number(managerStats.totalCreated || 0),
      totalDestroyed: Number(managerStats.totalDestroyed || 0)
    };
  }

  getMetrics() {
    // DebugOverlay 读取这里的数据，所以尽量保持字段稳定、语义直接。
    const managerStats = this.bulletManager?.getStats?.() || {};
    const playerBullets = this.bulletManager?.getPlayerBullets?.() || [];
    const bossBullets = this.bulletManager?.getBossBullets?.() || [];

    return {
      createdByCore: this.metrics.created,
      destroyedByCore: this.metrics.destroyed,
      hitCount: this.metrics.hits,
      lastHitAt: this.metrics.lastHitAt,
      lastSpawnAt: this.metrics.lastSpawnAt,
      lastDestroyAt: this.metrics.lastDestroyAt,
      destroyedByReason: { ...(this.metrics.destroyedByReason || {}) },
      activePlayerBullets: playerBullets.length,
      activeBossBullets: bossBullets.length,
      managerCreated: Number(managerStats.totalCreated || 0),
      managerDestroyed: Number(managerStats.totalDestroyed || 0),
      pooledBullets: Number(managerStats.pooledBullets || 0)
    };
  }

  getCollisionManager() {
    return this.collisionManager;
  }

  static angleToTarget(fromX, fromY, toX, toY) {
    return Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
  }
}