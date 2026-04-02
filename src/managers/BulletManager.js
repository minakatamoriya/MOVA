import Phaser from 'phaser';

/**
 * 弹幕管理器
 * 负责管理所有玩家和Boss的子弹
 * 包括创建、更新、碰撞和销毁
 */
export default class BulletManager {
  constructor(scene) {
    this.scene = scene;
    
    // 创建Group来管理所有弹幕
    this.playerBulletGroup = this.scene.add.group();
    this.bossBulletGroup = this.scene.add.group();
    
    // 对象池配置
    this.bulletPool = []; // 待回收的子弹对象
    this.maxPoolSize = 100; // 最大对象池大小
    
    // ── 拖尾粒子池（取代 per-bullet timer+tween） ──
    this._trailPool = [];          // 空闲 dot trail 对象
    this._trailStreakPool = [];    // 空闲 streak trail 对象
    this._trailActive = [];        // 正在衰减中的粒子 {sprite, life, maxLife}
    this._trailPoolMax = 200;      // 池上限
    this._trailInterval = 110;     // 每颗子弹发射拖尾间隔 ms
    // 仅追踪“真的启用了拖尾”的子弹，避免每帧扫描所有子弹
    this._trailBullets = new Set();

    // 统计数据
    this.stats = {
      totalCreated: 0,
      totalDestroyed: 0,
      activePlayerBullets: 0,
      activeBossBullets: 0,
      pooledBullets: 0
    };
    
    // 配置
    this.config = {
      maxPlayerBullets: 450,
      maxBossBullets: 500,
      screenPadding: 100 // 超出屏幕后的额外距离再销毁
    };
  }

  /**
   * 创建玩家子弹
   */
  createPlayerBullet(x, y, color, options = {}) {
    const {
      radius = 6,
      speed = 300,
      damage = 34,
      angleOffset = 0,
      isAbsoluteAngle = false,
      type = 'circle',
      hasGlow = true,
      hasTrail = true,
      glowRadius = 9,
      glowColor = null,
      strokeColor = null,
      trailColor = null,
      homing = false,
      homingTurn = 0.04,
      explode = false,
      skipUpdate = false,
      maxLifeMs = null,
      arrowLenMult = 1,
      arrowThickMult = 1,
      arrowHighlightColor = null,
      arrowFeatherColor = null,
      trailIntervalMs = null,
      trailLifeMs = null,
      trailAlpha = null,
      trailScale = null,
      trailMode = null,
      trailScaleX = null,
      trailScaleY = null,
      speedStartMult = null,
      speedEndMult = null,
      speedRampMs = null
    } = options;

    const resolvedStroke = strokeColor ?? 0x00ffff;

    const resolvedType = (type || 'circle').toLowerCase();

    // 创建子弹
    let bullet;
    if (resolvedType === 'arrow' || resolvedType === 'spear') {
      // 箭矢：用“预渲染贴图 + Image”代替 Container(多个子物体)
      // 目的：减少每发箭矢的对象创建与 draw calls，降低移动+连射时的 GC/卡顿。
      const highlightColor = arrowHighlightColor ?? 0x54ff68;
      const featherColor = arrowFeatherColor ?? 0x25c944;
      const texKey = resolvedType === 'spear'
        ? `__bm_spear_${color.toString(16)}_${resolvedStroke.toString(16)}_${highlightColor.toString(16)}_${featherColor.toString(16)}`
        : `__bm_arrow_${color.toString(16)}_${resolvedStroke.toString(16)}_${highlightColor.toString(16)}_${featherColor.toString(16)}`;
      if (!this.scene.textures?.exists?.(texKey)) {
        const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
        const W = resolvedType === 'spear' ? 104 : 88;
        const H = resolvedType === 'spear' ? 34 : 40;
        const cx = resolvedType === 'spear' ? 10 : 12;
        const cy = Math.floor(H / 2);

        // 纯亮绿色分层，避免白色高光，把荧光感留给同色系亮度差。
        g.clear();
        if (resolvedType === 'spear') {
          g.fillStyle(resolvedStroke, 0.98);
          g.fillRect(cx + 6, cy - 4, 46, 8);
          g.fillTriangle(cx + 44, cy - 11, cx + 44, cy + 11, cx + 78, cy);

          g.fillStyle(color, 1);
          g.fillRect(cx + 8, cy - 2, 40, 4);
          g.fillTriangle(cx + 40, cy - 8, cx + 40, cy + 8, cx + 73, cy);

          g.fillStyle(highlightColor, 0.95);
          g.fillRect(cx + 10, cy - 1, 28, 2);
          g.fillTriangle(cx + 32, cy - 5, cx + 32, cy + 5, cx + 58, cy);

          g.fillStyle(featherColor, 0.88);
          g.fillTriangle(cx + 2, cy, cx + 12, cy - 4, cx + 14, cy - 1);
          g.fillTriangle(cx + 2, cy, cx + 12, cy + 4, cx + 14, cy + 1);

          g.lineStyle(1, highlightColor, 0.78);
          g.beginPath();
          g.moveTo(cx + 12, cy);
          g.lineTo(cx + 62, cy);
          g.strokePath();
        } else {
          g.fillStyle(resolvedStroke, 0.98);
          g.fillRect(cx + 6, cy - 6, 38, 12);
          g.fillTriangle(cx + 42, cy - 10, cx + 42, cy + 10, cx + 64, cy);

          g.fillStyle(color, 1);
          g.fillRect(cx + 8, cy - 4, 34, 8);
          g.fillTriangle(cx + 40, cy - 7, cx + 40, cy + 7, cx + 60, cy);

          g.fillStyle(highlightColor, 0.95);
          g.fillRect(cx + 10, cy - 2, 26, 4);
          g.fillTriangle(cx + 36, cy - 4, cx + 36, cy + 4, cx + 51, cy);

          g.fillStyle(featherColor, 0.92);
          g.fillTriangle(cx - 1, cy, cx + 10, cy - 6, cx + 12, cy - 1);
          g.fillTriangle(cx - 1, cy, cx + 10, cy + 6, cx + 12, cy + 1);

          g.lineStyle(1, highlightColor, 0.72);
          g.beginPath();
          g.moveTo(cx + 10, cy);
          g.lineTo(cx + 52, cy);
          g.strokePath();
        }

        g.generateTexture(texKey, W, H);
        g.destroy();
      }

      // 目标：更“长、粗、亮”，且保持利落条形
      const shaftLen = Math.max(16, Math.round(radius * (resolvedType === 'spear' ? 3.55 : 3.15) * arrowLenMult));
      const shaftW = Math.max(4, Math.round(radius * (resolvedType === 'spear' ? 0.7 : 0.9) * arrowThickMult));
      const headLen = Math.max(8, Math.round(radius * (resolvedType === 'spear' ? 1.55 : 1.28) * arrowLenMult));
      const totalLen = shaftLen + headLen;
      const totalH = Math.max(8, Math.round(shaftW * (resolvedType === 'spear' ? 1.75 : 2.4)));

      bullet = this.scene.add.image(x, y, texKey).setOrigin(0.5, 0.5);
      bullet.setDisplaySize(totalLen, totalH);
      bullet.setBlendMode(Phaser.BlendModes.ADD);
      bullet.setAlpha(0.96);

      bullet.radius = radius; // 碰撞仍用圆形半径
      bullet._trailAnchorOffset = Math.max(8, totalLen * (resolvedType === 'spear' ? 0.46 : 0.44));
      bullet.rotateToVelocity = true;
      // 兼容 basicAttackMods / 其它逻辑对 setStrokeStyle 的调用
      bullet.setStrokeStyle = () => bullet;
    } else {
      bullet = this.scene.add.circle(x, y, radius, color);
      bullet.radius = radius;
      bullet.setStrokeStyle(2, resolvedStroke, 1);
    }
    
    // 设置子弹属性
    bullet.damage = damage;
    // 碰撞层使用 bullet.radius；必须同步创建时的几何半径
    bullet.speed = speed;
    bullet.baseSpeed = speed;
    if (speedRampMs != null) {
      bullet.speedStart = Math.max(1, speed * Math.max(0.05, speedStartMult ?? 1));
      bullet.speedEnd = Math.max(1, speed * Math.max(0.05, speedEndMult ?? 1));
      bullet.speedRampMs = Math.max(1, Math.round(speedRampMs));
      bullet.speedRampElapsed = 0;
      bullet.speed = bullet.speedStart;
    }
    bullet.angleOffset = angleOffset;
    bullet.isAbsoluteAngle = isAbsoluteAngle;
    bullet.homing = homing;
    bullet.homingTurn = homingTurn;
    bullet.homingMode = null;
    bullet.explode = explode;
    bullet.skipUpdate = skipUpdate;
    bullet.isPlayerBullet = true;
    bullet.active = true;
    bullet.markedForRemoval = false;
    if (maxLifeMs != null) {
      bullet.maxLifeMs = Math.max(1, Math.round(maxLifeMs));
    }

    // 初始朝向（箭矢更重要）；寻踪子弹会在 update 中自行调整 angleOffset
    const initialAngle = isAbsoluteAngle ? angleOffset : (-Math.PI / 2 + angleOffset);
    bullet.rotation = initialAngle;

    // 视觉信息（用于命中反馈/二次渲染等）
    bullet.visualCoreColor = color;
    bullet.visualAccentColor = resolvedStroke;

    // 创建光晕
    if (hasGlow) {
      const glowAlpha = (resolvedType === 'arrow' || resolvedType === 'spear') ? 0.36 : 0.2;
      const glow = this.scene.add.circle(x, y, glowRadius, glowColor ?? color, glowAlpha);
      glow.depth = -1;
      bullet.glow = glow;
    }

    // 创建粒子尾迹（标记式，由 update 统一驱动）
    if (hasTrail && !skipUpdate) {
      bullet._hasTrail = true;
      bullet._trailColor = trailColor ?? resolvedStroke;
      bullet._trailNext = 0; // 立即可发射
      const longProjectile = resolvedType === 'arrow' || resolvedType === 'spear';
      bullet._trailInterval = Math.max(40, Math.round(trailIntervalMs ?? (longProjectile ? 72 : this._trailInterval)));
      bullet._trailLifeMs = Math.max(80, Math.round(trailLifeMs ?? (longProjectile ? 170 : 220)));
      bullet._trailAlpha = Phaser.Math.Clamp(trailAlpha ?? (longProjectile ? 0.42 : 0.7), 0.08, 1);
      bullet._trailScale = Phaser.Math.Clamp(trailScale ?? (longProjectile ? 0.88 : 1), 0.2, 2.2);
      bullet._trailMode = trailMode ?? (longProjectile ? 'streak' : 'dot');
      bullet._trailScaleX = Phaser.Math.Clamp(trailScaleX ?? bullet._trailScale, 0.15, 4);
      bullet._trailScaleY = Phaser.Math.Clamp(trailScaleY ?? bullet._trailScale, 0.1, 4);
      bullet._trailTracked = true;
      this._trailBullets.add(bullet);
    }

    // 添加到Group
    this.playerBulletGroup.add(bullet);
    this.stats.totalCreated++;
    if (this.playerBulletGroup?.children) {
      this.stats.activePlayerBullets = this.playerBulletGroup.children.entries.length;
    }

    // 超屏检测时间事件
    bullet.outOfBoundsTimer = null;

    return bullet;
  }

  /**
   * 创建德鲁伊月火术弹体（光团）
   * - 慢速、有轻微下坠与漂浮感
   * - 不自动追踪，但在极窄 5° 内有“亲和”吸附
   */
  createMoonfireBullet(x, y, options = {}) {
    const {
      angle = -Math.PI / 2,
      speed = 230,
      damage = 12,
      radius = 12,
      gravity = 0,
      driftAmp = 0,
      driftOmega = (Math.PI * 2) / 900,
      affinityTarget = null,
      affinityConeDeg = 55,
      affinityTurnDegPerSec = 28,
      coreColor = 0xf2f0a8,
      coreBright = 0xf6f2b8,
      accentColor = 0x88ffcc,
      trailColor = null
    } = options;

    const outer = this.scene.add.circle(0, 0, radius + 10, accentColor, 0.14);
    outer.setStrokeStyle(2, accentColor, 0.22);

    const mid = this.scene.add.circle(0, 0, radius + 4, coreColor, 0.34);
    mid.setStrokeStyle(1, accentColor, 0.18);

    const inner = this.scene.add.circle(0, 0, radius, coreBright, 0.92);
    inner.setStrokeStyle(1, accentColor, 0.38);

    const bullet = this.scene.add.container(x, y, [outer, mid, inner]);
    bullet.setDepth(5);

    // 物理参数
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.gravity = gravity;
    bullet.driftAmp = driftAmp;
    bullet.driftOmega = driftOmega;
    bullet.driftPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    // 亲和吸附（极窄角度）
    bullet.affinityTarget = affinityTarget;
    bullet.affinityConeRad = Phaser.Math.DegToRad(affinityConeDeg);
    bullet.affinityTurnRadPerSec = Phaser.Math.DegToRad(affinityTurnDegPerSec);

    // 碰撞/通用属性
    bullet.motionType = 'moonfire';
    bullet.damage = damage;
    bullet.radius = radius;
    bullet.noCrit = true;
    bullet.hitEffectType = 'moonfire';
    bullet.isPlayerBullet = true;
    bullet.active = true;
    bullet.skipUpdate = false;
    bullet.markedForRemoval = false;
    bullet.elapsedMs = 0;

    bullet.visualCoreColor = coreColor;
    bullet.visualAccentColor = accentColor;

    // 柔和粒子尾迹（萤火虫感）
    bullet.trailTimer = this.scene.time.addEvent({
      delay: 160,
      repeat: -1,
      callback: () => {
        if (!bullet.active || bullet.markedForRemoval) {
          if (bullet.trailTimer) bullet.trailTimer.remove();
          bullet.trailTimer = null;
          return;
        }

        const p = this.scene.add.circle(
          bullet.x + Phaser.Math.Between(-6, 6),
          bullet.y + Phaser.Math.Between(-6, 6),
          Phaser.Math.Between(2, 3),
          Phaser.Math.RND.pick([trailColor ?? accentColor, coreBright]),
          0.55
        );
        this.scene.tweens.add({
          targets: p,
          alpha: 0,
          scale: 0.2,
          y: p.y + Phaser.Math.Between(10, 18),
          duration: 320,
          ease: 'Sine.Out',
          onComplete: () => p.destroy()
        });
      }
    });

    this.playerBulletGroup.add(bullet);
    this.stats.totalCreated++;
    if (this.playerBulletGroup?.children) {
      this.stats.activePlayerBullets = this.playerBulletGroup.children.entries.length;
    }

    return bullet;
  }

  /**
   * 创建Boss子弹
   */
  createBossBullet(x, y, angle, speed, color, options = {}) {
    const {
      radius = 9,
      glowRadius = 16,
      hasGlow = true,
      hasTrail = true,
      trailColor = null,
      damage = 15,
      type = 'circle',
      ringStrokeWidth = null,
      ringFillAlpha = 0.16
    } = options;

    const shapeType = (type || 'circle').toLowerCase();

    // 创建子弹（硬边、实心为主；默认不创建外圈发光）
    let bullet;
    if (shapeType === 'square') {
      const size = Math.max(6, radius * 2);
      bullet = this.scene.add.rectangle(x, y, size, size, color, 0.96);
      bullet.rotation = 0;
      bullet.radius = Math.round(size * 0.65);
    } else if (shapeType === 'diamond') {
      const size = Math.max(6, radius * 2);
      bullet = this.scene.add.rectangle(x, y, size, size, color, 0.96);
      bullet.rotation = Math.PI / 4;
      bullet.radius = Math.round(size * 0.7);
    } else if (shapeType === 'cross') {
      // 4-point star reads like a cross when inner radius is small
      bullet = this.scene.add.star(x, y, 4, Math.max(2, radius * 0.35), Math.max(4, radius * 1.05), color, 0.98);
      bullet.radius = Math.round(radius * 1.1);
    } else if (shapeType === 'star') {
      bullet = this.scene.add.star(x, y, 5, Math.max(2, radius * 0.45), Math.max(5, radius * 1.2), color, 0.98);
      bullet.radius = Math.round(radius * 1.2);
    } else if (shapeType === 'ring') {
      // ring 类多用于“范围伤害/爆炸区”，若只画描边会出现“被打到了但看不见覆盖面积”的问题
      const strokeWidth = Number.isFinite(Number(ringStrokeWidth))
        ? Math.max(2, Math.round(Number(ringStrokeWidth)))
        : Math.max(2, Math.round(radius * 0.22));
      const fillAlpha = Phaser.Math.Clamp(Number(ringFillAlpha ?? 0.16), 0, 1);
      bullet = this.scene.add.circle(x, y, radius, color, fillAlpha);
      bullet.setStrokeStyle(strokeWidth, color, 0.92);
      bullet.radius = Math.round(radius);
    } else if (shapeType === 'rectangle') {
      // 向后兼容：旧矩形弹
      bullet = this.scene.add.rectangle(x, y, radius * 1.5, radius, color, 0.96);
      bullet.radius = Math.round(Math.max(radius * 0.9, (radius * 1.5) / 2));
    } else {
      // circle / default
      bullet = this.scene.add.circle(x, y, radius, color, 0.96);
      bullet.radius = Math.round(radius);
    }

    // 边缘处理：硬边为主，避免外圈柔光（Arc 形状用 1px 描边强化轮廓）
    if (shapeType === 'ring') {
      bullet.setStrokeStyle(Math.max(3, Math.round(radius * 0.28)), 0xfbf6ff, 0.95);
    } else if (bullet?.setStrokeStyle) {
      bullet.setStrokeStyle(2, 0xfbf6ff, 0.92);
    }

    bullet.damage = damage;
    bullet.speed = speed;
    bullet.angleOffset = angle;
    bullet.isPlayerBullet = false;
    bullet.active = true;
    bullet.markedForRemoval = false;
    bullet.shapeType = shapeType;

    // 动画参数（让子弹“活”起来）
    bullet.elapsedMs = 0;
    bullet.spinDegPerFrame = 0;
    bullet.pulse = false;
    if (shapeType === 'diamond' || shapeType === 'star' || shapeType === 'cross') {
      bullet.spinDegPerFrame = Phaser.Math.Between(5, 10);
    }
    if (shapeType === 'circle') {
      bullet.pulse = true;
      bullet.pulseOmega = (Math.PI * 2) / 600; // 600ms一个周期
    }

    // 用于命中反馈：尖锐弹=火花；圆钝弹=粉尘爆
    bullet.isSharp = (shapeType === 'diamond' || shapeType === 'star' || shapeType === 'cross');
    bullet.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };

    // 始终把敌方弹幕绘制在迷雾之上，避免“不可见的远程攻击”（迷雾遮住了子弹但碰撞仍生效）
    // UI（小地图/HUD）通常在更高的 depth，因此不会盖住 UI。
    try { bullet.setDepth(410); } catch (_) { /* ignore */ }

    // 可选发光（默认关闭：避免“实心+外圈”风格）
    if (hasGlow) {
      const glow = this.scene.add.circle(x, y, glowRadius, color, 0.24);
      glow.setStrokeStyle(2, 0xfbf6ff, 0.48);
      glow.depth = -1;
      bullet.glow = glow;
    } else {
      bullet.glow = null;
    }

    // 粒子尾迹（标记式，由 update 统一驱动）
    if (hasTrail) {
      bullet._hasTrail = true;
      bullet._trailColor = trailColor || color;
      bullet._trailNext = 0;
      bullet._trailTracked = true;
      this._trailBullets.add(bullet);
    }

    // 添加到Group
    this.bossBulletGroup.add(bullet);
    this.stats.totalCreated++;
    if (this.bossBulletGroup?.children) {
      this.stats.activeBossBullets = this.bossBulletGroup.children.entries.length;
    }

    return bullet;
  }

  /**
   * 销毁子弹及其所有相关效果
   */
  destroyBullet(bullet, isPlayerBullet = true) {
    if (!bullet) return;

    // 标记为待删除，防止重复销毁
    if (bullet.markedForRemoval) return;
    bullet.markedForRemoval = true;

    // 标记拖尾停止
    if (bullet._trailTracked) {
      this._trailBullets.delete(bullet);
      bullet._trailTracked = false;
    }
    bullet._hasTrail = false;

    if (bullet.outOfBoundsTimer) {
      bullet.outOfBoundsTimer.remove();
      bullet.outOfBoundsTimer = null;
    }

    // 清理光晕
    if (bullet.glow && bullet.glow.active) {
      bullet.glow.destroy();
      bullet.glow = null;
    }

    // 销毁子弹
    if (bullet.active) {
      bullet.setActive(false);
      bullet.setVisible(false);
      bullet.destroy();
    }

    this.stats.totalDestroyed++;
    
    // 更新统计
    if (isPlayerBullet && this.playerBulletGroup?.children) {
      this.stats.activePlayerBullets = this.playerBulletGroup.children.entries.length;
    } else if (!isPlayerBullet && this.bossBulletGroup?.children) {
      this.stats.activeBossBullets = this.bossBulletGroup.children.entries.length;
    }
  }

  /**
   * 更新所有子弹（位置更新和界线检测）
   */
  update(delta) {
    // 更新Boss子弹
    this.updateBossBullets(delta);
    
    // 更新玩家子弹（仅适用于自动移动的子弹）
    this.updatePlayerBullets(delta);
    
    // 统一更新拖尾粒子（替代 per-bullet timer + tween）
    this._updateTrails(delta);
    
    // 检查超屏子弹
    this.cleanupOutOfBoundsBullets();
    
    // 管理子弹数量
    this.manageBulletCount();
  }

  /* ─── 高性能拖尾粒子系统 ─── */

  _getTrailStreakTexture() {
    const texKey = '__bm_trail_streak_v2';
    if (this.scene.textures?.exists?.(texKey)) return texKey;

    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    const width = 64;
    const height = 8;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const x = Math.round(t * (width - 1));
      const segmentW = Math.max(1, Math.ceil(width / 16));
      const alpha = t;
      g.fillStyle(0xffffff, alpha * alpha * 0.95);
      g.fillRect(x, 0, segmentW, height);
    }
    g.generateTexture(texKey, width, height);
    g.destroy();
    return texKey;
  }

  /** 从池中取出或新建一个 trail circle */
  _acquireTrailParticle(mode, x, y, color, alpha = 0.7, scaleX = 1, scaleY = scaleX, rotation = 0) {
    const useStreak = mode === 'streak';
    const pool = useStreak ? this._trailStreakPool : this._trailPool;
    let p = pool.pop();
    if (p) {
      p.setPosition(x, y);
      p.setAlpha(alpha);
      p.setScale(scaleX, scaleY);
      p.setRotation(rotation);
      p.setVisible(true);
      p.setActive(true);
      if (useStreak) p.setTint(color);
      else p.fillColor = color;
    } else {
      if (useStreak) {
        p = this.scene.add.image(x, y, this._getTrailStreakTexture());
        p.setOrigin(0.98, 0.5);
        p.setTint(color);
        p.setBlendMode(Phaser.BlendModes.ADD);
        p.setDepth(-1);
        p.setAlpha(alpha);
        p.setScale(scaleX, scaleY);
        p.setRotation(rotation);
      } else {
        p = this.scene.add.circle(x, y, 2, color, alpha);
        p.setDepth(-1);
        p.setScale(scaleX, scaleY);
        p.setRotation(rotation);
      }
    }
    p._trailMode = mode || 'dot';
    return p;
  }
  /** 回收一个 trail circle 到池中 */
  _releaseTrailParticle(p) {
    p.setVisible(false);
    p.setActive(false);
    const pool = p?._trailMode === 'streak' ? this._trailStreakPool : this._trailPool;
    if (pool.length < this._trailPoolMax) {
      pool.push(p);
    } else {
      p.destroy();
    }
  }

  /** 每帧调用：发射新粒子 + 衰减现有粒子 */
  _updateTrails(delta) {
    const now = this.scene.time?.now ?? 0;

    if (this._trailBullets.size === 0 && this._trailActive.length === 0) return;

    // 1) 为所有带拖尾的活跃子弹发射粒子
    for (const b of this._trailBullets) {
      if (!b || !b.active || b.markedForRemoval || !b._hasTrail) {
        this._trailBullets.delete(b);
        if (b) b._trailTracked = false;
        continue;
      }
      const interval = Math.max(40, b._trailInterval || this._trailInterval);
      if (now < b._trailNext) continue;
      b._trailNext = now + interval;
      const startAlpha = Phaser.Math.Clamp(b._trailAlpha || 0.7, 0.08, 1);
      const startScaleX = Phaser.Math.Clamp(b._trailScaleX || b._trailScale || 1, 0.15, 4);
      const startScaleY = Phaser.Math.Clamp(b._trailScaleY || b._trailScale || 1, 0.1, 4);
      const trailAngle = b.angleRad ?? (b.isAbsoluteAngle ? b.angleOffset : (-Math.PI / 2 + b.angleOffset)) ?? b.rotation ?? 0;
      const isStreak = b._trailMode === 'streak';
      const mode = isStreak ? 'streak' : 'dot';
      const anchorOffset = b._trailAnchorOffset || 12;
      const px = isStreak
        ? b.x - Math.cos(trailAngle) * anchorOffset
        : b.x + (((Math.random() - 0.5) * 8) | 0);
      const py = isStreak
        ? b.y - Math.sin(trailAngle) * anchorOffset
        : b.y + (((Math.random() - 0.5) * 8) | 0);
      const p = this._acquireTrailParticle(mode, px, py, b._trailColor, startAlpha, startScaleX, startScaleY, isStreak ? trailAngle : 0);
      this._trailActive.push({
        sprite: p,
        life: 0,
        maxLife: Math.max(80, b._trailLifeMs || 220),
        startAlpha,
        startScaleX,
        startScaleY,
        mode
      });
    }

    // 2) 衰减活跃粒子
    const active = this._trailActive;
    for (let i = active.length - 1; i >= 0; i--) {
      const t = active[i];
      t.life += delta;
      if (t.life >= t.maxLife) {
        this._releaseTrailParticle(t.sprite);
        // swap-remove（O(1)）
        active[i] = active[active.length - 1];
        active.pop();
      } else {
        const frac = 1 - t.life / t.maxLife;
        t.sprite.setAlpha(t.startAlpha * frac);
        if (t.mode === 'streak') {
          t.sprite.setScale(
            Math.max(0.12, t.startScaleX * (0.45 + 0.55 * frac)),
            Math.max(0.04, t.startScaleY * (0.72 + 0.28 * frac))
          );
        } else {
          t.sprite.setScale(
            Math.max(0.08, t.startScaleX * (0.2 + 0.8 * frac)),
            Math.max(0.06, t.startScaleY * (0.34 + 0.66 * frac))
          );
        }
      }
    }
  }

  /**
   * 更新Boss子弹
   */
  updateBossBullets(delta) {
    if (!this.bossBulletGroup?.children) return;
    
    const bossBullets = this.bossBulletGroup.children.entries;
    
    for (let i = bossBullets.length - 1; i >= 0; i--) {
      const bullet = bossBullets[i];
      if (!bullet || !bullet.active) continue;

      // 累计时间（用于动画）
      bullet.elapsedMs = (bullet.elapsedMs || 0) + delta;

      if (bullet.maxLifeMs) {
        bullet.lifeMs = (bullet.lifeMs || 0) + delta;
        if (bullet.lifeMs >= bullet.maxLifeMs) {
          this.destroyBullet(bullet, false);
          continue;
        }
      }

      // 旋转：菱形/星形/十字每帧 5~10°（按 delta 折算）
      if (bullet.spinDegPerFrame) {
        const frames = delta / 16.666;
        bullet.rotation += Phaser.Math.DegToRad(bullet.spinDegPerFrame) * frames;
      }

      // 脉动：圆形在 0.9~1.1 之间缩放，透明度微变
      if (bullet.pulse) {
        const omega = bullet.pulseOmega || ((Math.PI * 2) / 600);
        const s = 1 + 0.1 * Math.sin((bullet.elapsedMs || 0) * omega);
        bullet.setScale(s);
        bullet.alpha = 0.92 + 0.08 * Math.sin((bullet.elapsedMs || 0) * omega + Math.PI / 2);
      }

      // 更新位置
      const angle = bullet.angleOffset;
      bullet.x += Math.cos(angle) * bullet.speed * (delta / 1000);
      bullet.y += Math.sin(angle) * bullet.speed * (delta / 1000);

      // 更新光晕位置
      if (bullet.glow && bullet.glow.active) {
        bullet.glow.x = bullet.x;
        bullet.glow.y = bullet.y;
        bullet.glow.rotation = bullet.rotation || 0;
      }

      if (bullet.homing) {
        const player = this.scene?.player;
        if (player?.isAlive && player.active !== false) {
          const targetX = Number(player.x || 0);
          const targetY = Number(player.y || 0);
          const targetAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, targetX, targetY);
          const currentAngle = Number.isFinite(bullet.angleRad) ? bullet.angleRad : Number(bullet.angleOffset || 0);
          const turn = Math.max(0.005, Number(bullet.homingTurn || 0.018));
          const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, turn);
          bullet.angleRad = newAngle;
          bullet.angleOffset = newAngle;
        }
      }

      // 检测超屏（提前一点销毁以避免看到边界）
      if (this.isOutOfBounds(bullet, this.config.screenPadding)) {
        this.destroyBullet(bullet, false);
      }
    }
  }

  /**
   * 更新玩家子弹（用于激光束等需要自动移动的子弹）
   */
  updatePlayerBullets(delta) {
    if (!this.playerBulletGroup?.children) return;
    
    const playerBullets = this.playerBulletGroup.children.entries;
    
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (!bullet || !bullet.active || bullet.skipUpdate) continue;

      // 近战/环绕类：跟随玩家位置（例如战士挥砍判定）
      if (bullet.followPlayer && this.scene?.player) {
        bullet.x = this.scene.player.x + (bullet.followOffsetX || 0);
        bullet.y = this.scene.player.y + (bullet.followOffsetY || 0);
      }

      // 通用寿命（用于“短射程”投射物）
      if (bullet.maxLifeMs) {
        bullet.lifeMs = (bullet.lifeMs || 0) + delta;
        if (bullet.lifeMs >= bullet.maxLifeMs) {
          this.destroyBullet(bullet, true);
          continue;
        }
      }

      // 月火术：自定义运动（慢速下坠 + 漂浮 + 极窄亲和吸附）
      if (bullet.motionType === 'moonfire') {
        const dt = delta / 1000;
        bullet.elapsedMs = (bullet.elapsedMs || 0) + delta;

        // 亲和吸附：持续缓慢拐弯朝向目标
        if (bullet.affinityTarget && bullet.affinityTarget.active) {
          const currentAngle = Math.atan2(bullet.vy || 0, bullet.vx || 0);
          const targetAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, bullet.affinityTarget.x, bullet.affinityTarget.y);
          const diff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle);
          const maxTurn = (bullet.affinityTurnRadPerSec || 0) * dt;
          const turn = Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
          const speed = Math.sqrt((bullet.vx || 0) ** 2 + (bullet.vy || 0) ** 2) || 1;
          const newAngle = currentAngle + turn;
          bullet.vx = Math.cos(newAngle) * speed;
          bullet.vy = Math.sin(newAngle) * speed;
        }

        // 直线缓慢前进
        bullet.x += (bullet.vx || 0) * dt;
        bullet.y += (bullet.vy || 0) * dt;

        // 柔和脉动
        const s = 1 + 0.06 * Math.sin((bullet.elapsedMs || 0) * ((Math.PI * 2) / 700));
        bullet.setScale(s);
        bullet.alpha = 0.88 + 0.08 * Math.sin((bullet.elapsedMs || 0) * ((Math.PI * 2) / 900) + Math.PI / 3);

        if (this.isOutOfBounds(bullet, 50)) {
          this.destroyBullet(bullet, true);
        }
        continue;
      }

      // 更新光晕位置
      if (bullet.glow && bullet.glow.active) {
        bullet.glow.x = bullet.x;
        bullet.glow.y = bullet.y;
      }

      // 轻量速度曲线：支持“由慢到快”的发射手感。
      if (bullet.speedRampMs) {
        bullet.speedRampElapsed = Math.min(bullet.speedRampMs, (bullet.speedRampElapsed || 0) + delta);
        const t = Phaser.Math.Clamp((bullet.speedRampElapsed || 0) / bullet.speedRampMs, 0, 1);
        const eased = 1 - ((1 - t) * (1 - t));
        bullet.speed = Phaser.Math.Linear(bullet.speedStart || bullet.baseSpeed || bullet.speed, bullet.speedEnd || bullet.baseSpeed || bullet.speed, eased);
      }

      // 检查寻踪
      if (bullet.homing) {
        // 轻度追踪：扇形锁定（中心跟随目标，展开角保持不变）
        if (bullet.homingMode === 'fan_lock' && bullet.lockTarget && bullet.lockTarget.active && bullet.lockTarget.isAlive) {
          const dt = delta / 1000;
          const turn = Math.max(0.01, bullet.homingTurnRadPerSec || Phaser.Math.DegToRad(48));
          const targetAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, bullet.lockTarget.x, bullet.lockTarget.y);
          const desired = targetAngle + (bullet.fanOffsetRad || 0);
          const currentAngle = bullet.angleRad ?? (bullet.isAbsoluteAngle ? bullet.angleOffset : (-Math.PI / 2 + bullet.angleOffset));
          const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, desired, turn * dt);
          bullet.angleRad = newAngle;
          bullet.angleOffset = bullet.isAbsoluteAngle ? newAngle : (newAngle + Math.PI / 2);
        } else if (bullet.homingMode === 'fan_lock') {
          // 目标无效：停止追踪，按当前方向飞完
          bullet.homing = false;
          bullet.homingMode = null;
          bullet.lockTarget = null;
        } else {
        const boss = this.scene.bossManager?.getCurrentBoss?.();
        const minions = this.scene.bossManager?.getMinions?.() || this.scene.bossManager?.minions || [];
        const enemies = [];
        if (boss && boss.isAlive) enemies.push(boss);
        if (Array.isArray(minions) && minions.length > 0) {
          minions.forEach((m) => {
            if (m && m.isAlive) enemies.push(m);
          });
        }

        if (enemies.length > 0) {
          let target = enemies[0];
          let bestD = (target.x - bullet.x) ** 2 + (target.y - bullet.y) ** 2;
          for (let i = 1; i < enemies.length; i++) {
            const e = enemies[i];
            const d = (e.x - bullet.x) ** 2 + (e.y - bullet.y) ** 2;
            if (d < bestD) {
              target = e;
              bestD = d;
            }
          }

          const targetAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, target.x, target.y);
          const currentAngle = bullet.angleRad ?? (bullet.isAbsoluteAngle ? bullet.angleOffset : (-Math.PI / 2 + bullet.angleOffset));
          const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, bullet.homingTurn);
          bullet.angleRad = newAngle;

          // 保持 angleOffset 语义：
          // - isAbsoluteAngle=true 时 angleOffset 存绝对角
          // - 否则 angleOffset 存“相对朝上(-PI/2)的偏移”
          bullet.angleOffset = bullet.isAbsoluteAngle ? newAngle : (newAngle + Math.PI / 2);
        }
        }
      }

      // 计算移动角度
      const angle = bullet.angleRad ?? (bullet.isAbsoluteAngle
        ? bullet.angleOffset
        : (-Math.PI / 2 + bullet.angleOffset));

      bullet.x += Math.cos(angle) * bullet.speed * (delta / 1000);
      bullet.y += Math.sin(angle) * bullet.speed * (delta / 1000);

      // 让箭矢/需要朝向的投射物跟随方向旋转
      if (bullet.rotateToVelocity) {
        bullet.rotation = angle;
      }

      // 检测超屏
      if (this.isOutOfBounds(bullet, 50)) {
        this.destroyBullet(bullet, true);
      }
    }
  }

  /**
   * 检查是否超出屏幕范围
   */
  isOutOfBounds(bullet, padding = 100) {
    if (!this.scene) return false;
    
    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    return (
      bullet.x < view.x - padding ||
      bullet.x > view.x + view.width + padding ||
      bullet.y < view.y - padding ||
      bullet.y > view.y + view.height + padding
    );
  }

  /**
   * 清理超屏子弹
   */
  cleanupOutOfBoundsBullets() {
    if (!this.playerBulletGroup?.children) return;
    
    // 清理玩家子弹
    const playerBullets = this.playerBulletGroup.children.entries;
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (bullet && bullet.active && this.isOutOfBounds(bullet, this.config.screenPadding)) {
        this.destroyBullet(bullet, true);
      }
    }

    // 清理Boss子弹
    if (!this.bossBulletGroup?.children) return;
    
    const bossBullets = this.bossBulletGroup.children.entries;
    for (let i = bossBullets.length - 1; i >= 0; i--) {
      const bullet = bossBullets[i];
      if (bullet && bullet.active && this.isOutOfBounds(bullet, this.config.screenPadding)) {
        this.destroyBullet(bullet, false);
      }
    }
  }

  /**
   * 管理子弹数量（超过限制时删除最早的）
   */
  manageBulletCount() {
    if (!this.playerBulletGroup?.children) return;
    
    const playerBullets = this.playerBulletGroup.children.entries;
    while (playerBullets.length > this.config.maxPlayerBullets) {
      const oldest = playerBullets[0];
      if (oldest && oldest.active) {
        this.destroyBullet(oldest, true);
      }
    }

    if (!this.bossBulletGroup?.children) return;
    
    const bossBullets = this.bossBulletGroup.children.entries;
    while (bossBullets.length > this.config.maxBossBullets) {
      const oldest = bossBullets[0];
      if (oldest && oldest.active) {
        this.destroyBullet(oldest, false);
      }
    }
  }

  /**
   * 获取所有玩家子弹
   */
  getPlayerBullets() {
    if (!this.playerBulletGroup?.children) return [];
    return this.playerBulletGroup.children.entries.filter(b => b && b.active && !b.markedForRemoval);
  }

  /**
   * 获取所有Boss子弹
   */
  getBossBullets() {
    if (!this.bossBulletGroup?.children) return [];
    return this.bossBulletGroup.children.entries.filter(b => b && b.active && !b.markedForRemoval);
  }

  /**
   * 清除所有子弹
   */
  clearAll() {
    if (!this.playerBulletGroup || !this.playerBulletGroup.children) return;
    
    // 清理玩家子弹
    const playerBullets = this.playerBulletGroup.children.entries.slice();
    playerBullets.forEach(bullet => {
      if (bullet) this.destroyBullet(bullet, true);
    });

    // 清理Boss子弹
    if (this.bossBulletGroup && this.bossBulletGroup.children) {
      const bossBullets = this.bossBulletGroup.children.entries.slice();
      bossBullets.forEach(bullet => {
        if (bullet) this.destroyBullet(bullet, false);
      });
    }

    // 清理拖尾粒子
    this._clearTrailParticles();

    console.log(`弹幕管理器：已清除所有子弹`);
  }

  /**
   * 仅清除玩家弹幕（不影响 Boss 弹幕）
   * - 用于玩家死亡时立刻停止玩家所有攻击表现
   */
  clearPlayerBullets() {
    if (!this.playerBulletGroup?.children) return;

    const playerBullets = this.playerBulletGroup.children.entries.slice();
    playerBullets.forEach((bullet) => {
      if (bullet) this.destroyBullet(bullet, true);
    });

    if (this.playerBulletGroup?.children) {
      this.stats.activePlayerBullets = this.playerBulletGroup.children.entries.length;
    }
  }

  /**
   * 仅清除 Boss 弹幕（不影响玩家子弹）
   * - 用于 Boss 死亡/过关时立刻清场，避免残留伤害
   */
  clearBossBullets() {
    if (!this.bossBulletGroup?.children) return;
    const bossBullets = this.bossBulletGroup.children.entries.slice();
    bossBullets.forEach((bullet) => {
      if (bullet) this.destroyBullet(bullet, false);
    });

    if (this.bossBulletGroup?.children) {
      this.stats.activeBossBullets = this.bossBulletGroup.children.entries.length;
    }
  }

  /**
   * 销毁管理器
  /**
   * 清理所有拖尾粒子（池 + 活跃）
   */
  _clearTrailParticles() {
    for (let i = this._trailActive.length - 1; i >= 0; i--) {
      const t = this._trailActive[i];
      if (t.sprite) { try { t.sprite.destroy(); } catch (_) {} }
    }
    this._trailActive.length = 0;
    for (let i = this._trailPool.length - 1; i >= 0; i--) {
      try { this._trailPool[i].destroy(); } catch (_) {}
    }
    this._trailPool.length = 0;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.clearAll();
    
    if (this.playerBulletGroup) {
      this.playerBulletGroup.destroy(true);
      this.playerBulletGroup = null;
    }
    if (this.bossBulletGroup) {
      this.bossBulletGroup.destroy(true);
      this.bossBulletGroup = null;
    }

    console.log('弹幕管理器已销毁');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const activePlayer = this.playerBulletGroup?.children?.entries?.length ?? 0;
    const activeBoss = this.bossBulletGroup?.children?.entries?.length ?? 0;
    
    return {
      ...this.stats,
      activePlayerBullets: activePlayer,
      activeBossBullets: activeBoss
    };
  }

  /**
   * 打印健康检查信息
   */
  printHealthCheck() {
    const stats = this.getStats();
    console.log(`
    ===== 弹幕管理器健康检查 =====
    总创建: ${stats.totalCreated}
    总销毁: ${stats.totalDestroyed}
    活跃玩家子弹: ${stats.activePlayerBullets}/${this.config.maxPlayerBullets}
    活跃Boss子弹: ${stats.activeBossBullets}/${this.config.maxBossBullets}
    对象池大小: ${stats.pooledBullets}
    内存泄漏风险: ${stats.totalCreated - stats.totalDestroyed > 50 ? '⚠️  高' : '✓ 低'}
    ============================
    `);
  }
}
