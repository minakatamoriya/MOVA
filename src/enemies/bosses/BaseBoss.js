import Phaser from 'phaser';

/**
 * Boss 基类
 * 所有 Boss 的基础类，定义通用属性和行为
 */
export default class BaseBoss extends Phaser.GameObjects.Container {
  constructor(scene, config) {
    super(scene, config.x || 0, config.y || 0);
    
    this.scene = scene;
    this.scene.add.existing(this);
    
    // 标记为 Boss（用于碰撞检测识别）
    this.isBoss = true;
    
    // 生命周期状态
    this.isDestroyed = false;

    // 控制：眩晕/定身（自然伙伴等效果用）
    this.stunUntil = 0;
    this._stunResumeTimer = null;

    // 记录移动 tween，便于暂停/恢复
    this.moveTween = null;

    // 战斗开关：Boss 可常驻，但只有进入范围才开打
    // 默认 true 以兼容旧 Boss Rush
    this.combatActive = (config.combatActive !== undefined) ? !!config.combatActive : true;
    this._combatStarted = false;

    // 受击反馈（可扩展接口）：被击中后立即触发某种“反应”（远程反击/冲锋/防御法阵等）
    // 先提供通用冷却与默认实现，后续可由子类覆写 onHitReaction(ctx) 或外部直接赋值 boss.onHitReaction = fn
    this.hitReactionType = config.hitReactionType || 'ranged_blast';
    this.hitReactionCdMs = (config.hitReactionCdMs != null)
      ? Math.max(0, Math.round(config.hitReactionCdMs))
      : Math.max(0, Math.round(config.hitCounterCdMs ?? 650));

    // dash 参数：冲到玩家附近
    this.hitDashStopDist = (config.hitDashStopDist != null)
      ? Math.max(20, Math.round(config.hitDashStopDist))
      : 120;
    this.hitDashSpeed = (config.hitDashSpeed != null)
      ? Math.max(200, Math.round(config.hitDashSpeed))
      : 980;

    // Boss 基础属性
    this.bossName = config.name || 'Unknown Boss';
    this.maxHp = config.hp || 1000;
    this.currentHp = this.maxHp;
    this.isAlive = true;
    
    // 出场相关
    this.entryType = config.entryType || 'fade'; // fade, slide, teleport
    this.entryDuration = config.entryDuration || 2000;
    // 需求：见面即可打 —— 彻底取消出场无敌（忽略各 Boss 的 invincibleTime 配置）
    this.invincibleTime = 0;
    this.isInvincible = false;
    
    // 移动属性
    // 所有 Boss 移动速度不宜过快：在基类统一做上限限制
    const rawMoveSpeed = (config.moveSpeed != null) ? Number(config.moveSpeed) : 100;
    const resolvedMoveSpeed = Number.isFinite(rawMoveSpeed) ? rawMoveSpeed : 100;
    this.moveSpeed = Phaser.Math.Clamp(resolvedMoveSpeed, 10, 95);
    this.movePattern = config.movePattern || 'static'; // static, horizontal, vertical, circle, random

    // 可选：限制 Boss 活动范围（世界坐标系矩形）
    // 例如：以出口门为中心的“Boss 房间”区域。
    this.moveBoundsRect = config.moveBoundsRect || null;
    
    // 攻击属性
    this.attackPatterns = config.attackPatterns || [];
    this.currentPatternIndex = 0;
    this.attackPhase = 1;
    
    // 视觉属性
    this.bossColor = config.color || 0xff0000;
    this.bossSize = config.size || 50;
    
    // 弹幕组
    this.bullets = null;

    // 预警提示（头顶感叹号）
    this._alertIcon = null;
    this._alertHideTimer = null;

    // 陷阱/落点等“延迟危险”清理跟踪（用于 Boss 死亡瞬间清空未来机制）
    this._hazardTimers = [];
    this._hazardObjects = [];
    
    // 创建视觉元素
    this.createVisuals();
    
    // 执行入场动画
    this.playEntryAnimation();
  }

  showAlertIcon(durationMs = 1200) {
    const scene = this.scene;
    if (!scene?.add || !scene?.time) return;
    if (!this.isAlive || this.isDestroyed) return;

    if (this._alertHideTimer) {
      try { this._alertHideTimer.remove(false); } catch (_) { /* ignore */ }
      this._alertHideTimer = null;
    }

    // 已存在：刷新时长即可
    if (this._alertIcon && this._alertIcon.active) {
      try { this._alertIcon.setVisible(true); } catch (_) { /* ignore */ }
    } else {
      const icon = scene.add.text(0, -Math.max(48, (this.bossSize || 50) + 52), '!', {
        fontSize: '46px',
        fontStyle: '800',
        color: '#ff2b2b',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      }).setOrigin(0.5);
      icon.setDepth(12);
      this.add(icon);
      this._alertIcon = icon;

      // 轻微弹跳
      try {
        scene.tweens.add({
          targets: icon,
          y: icon.y - 10,
          duration: 180,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.Out'
        });
      } catch (_) { /* ignore */ }
    }

    // 自动隐藏
    const ms = Math.max(300, Math.round(durationMs || 0));
    this._alertHideTimer = scene.time.delayedCall(ms, () => {
      if (!this.scene || this.isDestroyed) return;
      if (this._alertIcon && this._alertIcon.active) {
        try { this._alertIcon.setVisible(false); } catch (_) { /* ignore */ }
      }
      this._alertHideTimer = null;
    });
  }

  fireSmartVolley(options = {}) {
    const scene = this.scene;
    if (!scene?.bulletManager?.createBossBullet) return;
    if (!this.isAlive || this.isDestroyed) return;

    const target = this.getPrimaryTarget();
    if (!target || !target.active || target.isAlive === false) return;

    const count = Math.max(1, Math.min(4, Math.floor(options.count || 2)));
    const spreadRad = Number.isFinite(options.spreadRad) ? Number(options.spreadRad) : 0.14;
    const speed = Math.max(60, Math.round(options.speed || 135));
    const radius = Math.max(8, Math.round(options.radius || 14));
    const damage = Math.max(1, Math.round(options.damage || 7));
    const color = (options.color != null) ? options.color : (this.bossColor || 0xff4444);
    const shapeType = (options.shapeType || 'circle');

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const baseAngle = Math.atan2(dy, dx);

    const half = (count - 1) * 0.5;
    for (let i = 0; i < count; i++) {
      const t = (i - half);
      const angle = baseAngle + t * spreadRad;
      scene.bulletManager.createBossBullet(
        this.x,
        this.y,
        angle,
        speed,
        color,
        {
          radius,
          damage,
          hasGlow: false,
          hasTrail: true,
          type: shapeType
        }
      );
    }
  }

  setMoveBoundsRect(rect) {
    if (!rect) {
      this.moveBoundsRect = null;
      return;
    }
    const x = Number(rect.x);
    const y = Number(rect.y);
    const w = Number(rect.width);
    const h = Number(rect.height);
    const ok = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
    this.moveBoundsRect = ok ? { x, y, width: w, height: h } : null;
  }

  /**
   * 获取 Boss 移动边界（默认使用 GameScene 计算的 gameArea）
   */
  getMoveBounds(padding = {}) {
    const {
      x = 90,
      top = 70,
      bottom = 70
    } = padding || {};

    // 重要：Boss 的移动边界必须使用“世界坐标系”的固定边界。
    // 之前使用 scene.gameArea（屏幕区域）会导致在大地图上 clampToBounds 把 Boss 拉离出生点，表现为“漂移”。
    const scene = this.scene;

    const overrideRect = this.moveBoundsRect;
    const hasOverrideRect = overrideRect
      && Number.isFinite(overrideRect.x) && Number.isFinite(overrideRect.y)
      && Number.isFinite(overrideRect.width) && Number.isFinite(overrideRect.height)
      && overrideRect.width > 0 && overrideRect.height > 0;

    const worldRect = scene?.worldBoundsRect;
    const hasWorldRect = worldRect
      && Number.isFinite(worldRect.x) && Number.isFinite(worldRect.y)
      && Number.isFinite(worldRect.width) && Number.isFinite(worldRect.height)
      && worldRect.width > 0 && worldRect.height > 0;

    let bounds;
    if (hasOverrideRect) {
      bounds = overrideRect;
    } else if (hasWorldRect) {
      bounds = worldRect;
    } else {
      const cfg = scene?.mapConfig;
      if (cfg && Number.isFinite(cfg.gridSize) && Number.isFinite(cfg.cellSize)) {
        const worldSize = cfg.gridSize * cfg.cellSize;
        bounds = { x: 0, y: 0, width: worldSize, height: worldSize };
      } else {
        // 兜底：保留旧逻辑，但尽量使用世界视口（worldView）而不是屏幕 UI 区域。
        bounds = scene?.cameras?.main?.worldView
          || scene?.gameArea
          || { x: 0, y: 0, width: scene?.cameras?.main?.width || 800, height: scene?.cameras?.main?.height || 600 };
      }
    }

    const left = bounds.x + x;
    const right = bounds.x + bounds.width - x;
    const topY = bounds.y + top;
    const bottomY = bounds.y + bounds.height - bottom;

    return {
      left,
      right,
      top: topY,
      bottom: bottomY
    };
  }

  clampToBounds() {
    const b = this.getMoveBounds();
    this.x = Phaser.Math.Clamp(this.x, b.left, b.right);
    this.y = Phaser.Math.Clamp(this.y, b.top, b.bottom);
  }

  /**
   * 创建视觉元素
   */
  createVisuals() {
    // Boss 本体（圆形占位符）
    this.body = this.scene.add.circle(0, 0, this.bossSize, this.bossColor);
    this.body.setStrokeStyle(3, 0xffffff);
    this.body.isBoss = true; // 标记为 Boss 部件
    this.add(this.body);
    
    // Boss 名称
    this.nameText = this.scene.add.text(0, this.bossSize + 15, this.bossName, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff8844',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5);
    this.add(this.nameText);
    
    // 血条背景
    this.hpBarBg = this.scene.add.rectangle(0, -this.bossSize - 20, 150, 10, 0x333333);
    this.add(this.hpBarBg);
    
    // 血条
    this.hpBar = this.scene.add.rectangle(-75, -this.bossSize - 20, 150, 10, 0x00ff00);
    this.hpBar.setOrigin(0, 0.5);
    this.add(this.hpBar);
    
    // 无敌状态指示器
    this.invincibleIndicator = this.scene.add.circle(0, 0, this.bossSize + 10);
    this.invincibleIndicator.setStrokeStyle(2, 0xffff00, 0.5);
    this.invincibleIndicator.setVisible(!!this.isInvincible);
    this.add(this.invincibleIndicator);

    // Debuff 图标行（显示在 Boss“头像/本体”上方；支持未来多个图标并排）
    this.createDebuffUi();
  }

  createDebuffUi() {
    if (this._debuffUi) return;
    const y = -this.bossSize - 38;
    const container = this.scene.add.container(0, y);
    this.add(container);
    this._debuffUi = {
      container,
      entries: new Map()
    };
  }

  setDebuffStacks(key, stacks, opts = {}) {
    if (!key) return;
    if (!this._debuffUi) this.createDebuffUi();

    const nStacks = Math.max(0, Math.floor(Number(stacks) || 0));
    const label = String(opts.label || '').slice(0, 2) || '?';
    const color = opts.color || '#ffffff';

    const ui = this._debuffUi;
    let entry = ui.entries.get(key);

    if (nStacks <= 0) {
      if (entry) {
        entry.container.setVisible(false);
        entry.stacks = 0;
        this._layoutDebuffUi();
      }
      return;
    }

    if (!entry) {
      const c = this.scene.add.container(0, 0);
      const bg = this.scene.add.rectangle(0, 0, 34, 18, 0x000000, 0.38);
      bg.setStrokeStyle(1, 0xffffff, 0.18);

      const iconText = this.scene.add.text(-8, 0, label, {
        fontSize: '12px',
        color,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const stackText = this.scene.add.text(10, 0, String(nStacks), {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      c.add([bg, iconText, stackText]);
      ui.container.add(c);

      entry = { container: c, iconText, stackText, stacks: 0 };
      ui.entries.set(key, entry);
    }

    entry.stacks = nStacks;
    entry.container.setVisible(true);
    entry.iconText.setText(label);
    entry.iconText.setColor(color);
    entry.stackText.setText(String(nStacks));

    this._layoutDebuffUi();
  }

  _layoutDebuffUi() {
    const ui = this._debuffUi;
    if (!ui?.entries) return;

    const priority = {
      poisonZone: 10,
      slow: 20
    };

    const visibleKeys = [...ui.entries.keys()]
      .filter((k) => {
        const e = ui.entries.get(k);
        return e && e.container && e.container.visible;
      })
      .sort((a, b) => (priority[a] || 999) - (priority[b] || 999));

    const spacing = 38;
    const total = Math.max(0, visibleKeys.length - 1) * spacing;
    const x0 = -Math.floor(total / 2);

    visibleKeys.forEach((k, idx) => {
      const e = ui.entries.get(k);
      if (!e) return;
      e.container.x = x0 + idx * spacing;
      e.container.y = 0;
    });
  }

  /**
   * 播放入场动画
   */
  playEntryAnimation() {
    console.log(`${this.bossName} 入场动画: ${this.entryType}`);
    
    switch (this.entryType) {
      case 'fade':
        this.alpha = 0;
        this.scene.tweens.add({
          targets: this,
          alpha: 1,
          duration: this.entryDuration,
          onComplete: () => this.onEntryComplete()
        });
        break;
        
      case 'slide':
        const startY = this.y;
        this.y = -100;
        this.scene.tweens.add({
          targets: this,
          y: startY,
          duration: this.entryDuration,
          ease: 'Back.easeOut',
          onComplete: () => this.onEntryComplete()
        });
        break;
        
      case 'teleport':
        this.alpha = 0;
        this.scale = 0.1;
        this.scene.tweens.add({
          targets: this,
          alpha: 1,
          scale: 1,
          duration: this.entryDuration,
          ease: 'Elastic.easeOut',
          onComplete: () => this.onEntryComplete()
        });
        break;
        
      default:
        // 不要同步触发，避免外部（BossManager/GameScene）来不及设置 combatActive=false
        this.scene?.time?.delayedCall?.(0, () => this.onEntryComplete());
    }
  }

  /**
   * 入场动画完成
   */
  onEntryComplete() {
    console.log(`${this.bossName} 入场完成，无敌时间: ${this.invincibleTime}ms`);

    // 记录无敌结束时间，便于“延迟开战”时精确计算剩余等待
    this._invincibleEndsAt = (this.scene?.time?.now ?? 0) + Math.max(0, this.invincibleTime || 0);

    if (this.invincibleTime > 0) {
      // 开始无敌时间倒计时
      this.scene.time.delayedCall(this.invincibleTime, () => {
        this.isInvincible = false;
        this.invincibleIndicator.setVisible(false);
        console.log(`${this.bossName} 无敌时间结束，可以攻击了！`);
        this.onBecomeVulnerable();
      });

      // 无敌状态闪烁效果
      this.scene.tweens.add({
        targets: this.invincibleIndicator,
        alpha: { from: 0.3, to: 0.8 },
        duration: 500,
        yoyo: true,
        repeat: Math.floor(this.invincibleTime / 1000)
      });
    } else {
      // 立即可受击
      this.isInvincible = false;
      this.invincibleIndicator.setVisible(false);
      this.onBecomeVulnerable();
    }
    
    // 开始移动/攻击（允许“先生成，后进入范围再开打”）
    if (this.combatActive) {
      this.startCombat();
    }
  }

  startCombat() {
    if (this._combatStarted) return;
    this._combatStarted = true;
    this.startMovementPattern();
    this.startAttackPattern();
  }

  setCombatActive(active) {
    const next = !!active;
    if (this.combatActive === next) return;
    this.combatActive = next;

    // 预警触发：Boss 从“待机”进入“开战”时，头顶出现感叹号
    if (this.combatActive) {
      this.showAlertIcon(1200);
    }

    if (!this._combatStarted) {
      if (this.combatActive) this.startCombat();
      return;
    }

    if (this.moveTween) {
      if (this.combatActive) this.moveTween.resume();
      else this.moveTween.pause();
    }

    if (this.moveTimer) {
      this.moveTimer.paused = !this.combatActive;
    }

    if (this.attackTimer) {
      this.attackTimer.paused = !this.combatActive;
    }
  }

  /**
   * Boss 变为可攻击状态时调用
   */
  onBecomeVulnerable() {
    // 子类可以重写此方法
  }

  /**
   * 开始移动模式
   */
  startMovementPattern() {
    switch (this.movePattern) {
      case 'horizontal':
        this.startHorizontalMovement();
        break;
      case 'track':
      case 'tracking':
        this.startTrackingMovement();
        break;
      case 'vertical':
        this.startVerticalMovement();
        break;
      case 'circle':
        this.startCircleMovement();
        break;
      case 'random':
        this.startRandomMovement();
        break;
      default:
        // static - 不移动
        break;
    }
  }

  /**
   * 轻追踪移动：不会持续左右摆动，而是缓慢朝玩家附近挪动
   * - X 方向跟得更明显
   * - Y 方向只做轻微修正（倾向于保持在玩家上方）
   */
  startTrackingMovement() {
    this.clampToBounds();

    if (this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }
    if (this.moveTimer) {
      this.moveTimer.remove();
      this.moveTimer = null;
    }

    const scene = this.scene;
    if (!scene?.time) return;

    // 使用 time event，便于 setCombatActive/applyStun 统一暂停
    const tickMs = 16;
    this.moveTimer = scene.time.addEvent({
      delay: tickMs,
      loop: true,
      callback: () => {
        if (!scene?.sys?.isActive() || this.isDestroyed || !this.isAlive) return;
        if (!this.combatActive) return;

        // 查看菜单打开/关闭中：冻结移动
        if (scene.viewMenuOpen || scene.viewMenuClosing) return;

        if (this.isStunned()) return;

        const target = this.getPrimaryTarget();
        if (!target || !target.active || target.isAlive === false) return;

        const b = this.getMoveBounds({ x: 110, top: 90, bottom: 150 });

        const desiredX = Phaser.Math.Clamp(target.x, b.left, b.right);
        // 倾向站在玩家上方，避免贴脸追击
        const desiredY = Phaser.Math.Clamp(target.y - 180, b.top, b.bottom);

        const dx = desiredX - this.x;
        const dy = desiredY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.5) return;

        const dt = tickMs / 1000;
        // 轻微追踪：只走 moveSpeed 的一部分，避免过快
        const maxStep = this.moveSpeed * 0.55 * dt;
        const step = Math.min(maxStep, dist);

        const nx = dx / dist;
        const ny = dy / dist;
        this.x = Phaser.Math.Clamp(this.x + nx * step, b.left, b.right);
        this.y = Phaser.Math.Clamp(this.y + ny * step, b.top, b.bottom);
      }
    });
  }

  /**
   * 水平移动
   */
  startHorizontalMovement() {
    this.clampToBounds();
    const b = this.getMoveBounds();
    const left = b.left;
    const right = b.right;
    const distance = Math.max(1, right - left);
    const ms = Phaser.Math.Clamp((distance / Math.max(30, this.moveSpeed)) * 1000, 1200, 4800);
    const goRight = Math.abs(this.x - right) < Math.abs(this.x - left);

    if (this.moveTween) this.moveTween.stop();
    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: goRight ? left : right,
      duration: ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * 垂直移动
   */
  startVerticalMovement() {
    this.clampToBounds();
    const b = this.getMoveBounds();
    const top = b.top;
    const bottom = b.bottom;
    const distance = Math.max(1, bottom - top);
    const ms = Phaser.Math.Clamp((distance / Math.max(30, this.moveSpeed)) * 1000, 1400, 5200);
    const goDown = Math.abs(this.y - bottom) < Math.abs(this.y - top);

    if (this.moveTween) this.moveTween.stop();
    this.moveTween = this.scene.tweens.add({
      targets: this,
      y: goDown ? top : bottom,
      duration: ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * 圆形移动
   */
  startCircleMovement() {
    this.clampToBounds();
    const b = this.getMoveBounds();
    const centerX = Phaser.Math.Clamp(this.x, b.left + 50, b.right - 50);
    const centerY = Phaser.Math.Clamp(this.y, b.top + 50, b.bottom - 50);
    const maxRx = Math.max(10, Math.min(centerX - b.left, b.right - centerX));
    const maxRy = Math.max(10, Math.min(centerY - b.top, b.bottom - centerY));
    const radius = Math.max(20, Math.min(90, Math.min(maxRx, maxRy)));
    let angle = 0;
    
    this.moveTimer = this.scene.time.addEvent({
      delay: 16,
      callback: () => {
        angle += 0.02;
        this.x = centerX + Math.cos(angle) * radius;
        this.y = centerY + Math.sin(angle) * radius;
      },
      loop: true
    });
  }

  /**
   * 随机移动
   */
  startRandomMovement() {
    const moveToRandomPosition = () => {
      if (!this.scene || !this.scene.sys || !this.scene.sys.isActive() || this.isDestroyed) {
        return;
      }

      // 眩晕中：延后再尝试移动
      if (this.isStunned()) {
        this.moveTimer = this.scene.time.delayedCall(120, moveToRandomPosition);
        return;
      }

      const b = this.getMoveBounds({ x: 110, top: 90, bottom: 110 });
      const newX = Phaser.Math.Between(Math.floor(b.left), Math.floor(b.right));
      const newY = Phaser.Math.Between(Math.floor(b.top), Math.floor(b.bottom));

      const dist = Phaser.Math.Distance.Between(this.x, this.y, newX, newY);
      const duration = Phaser.Math.Clamp((dist / Math.max(40, this.moveSpeed)) * 1000, 650, 2600);
      
      if (this.moveTween) this.moveTween.stop();
      this.moveTween = this.scene.tweens.add({
        targets: this,
        x: newX,
        y: newY,
        duration: duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!this.scene || !this.scene.sys || !this.scene.sys.isActive() || this.isDestroyed) {
            return;
          }
          this.moveTimer = this.scene.time.delayedCall(1000, moveToRandomPosition);
        }
      });
    };
    
    moveToRandomPosition();
  }

  getPrimaryTarget() {
    return this.scene?.getPrimaryTarget?.() || this.scene?.player || null;
  }

  /**
   * 技能：落点预警 -> 短暂爆炸圈（用 bossBulletGroup 承载命中）
   */
  castGroundBlast(x, y, options = {}) {
    const {
      radius = 90,
      telegraphMs = 650,
      activeMs = 220,
      color = 0xff5533
    } = options;

    const scene = this.scene;
    if (!scene?.add || !scene?.time) return;

    // 预警圈（不参与碰撞）
    const ring = scene.add.circle(x, y, radius, color, 0);
    ring.setStrokeStyle(4, color, 0.65);
    ring.setDepth(8);

    this._trackHazardObject(ring);

    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.9, to: 0.15 },
      duration: telegraphMs,
      ease: 'Sine.easeInOut'
    });

    const cleanupRing = () => {
      if (ring?.active) ring.destroy();
    };

    // 爆炸：生成一个短命的“静止 Boss 子弹”（让碰撞系统吃到）
    const telegraphTimer = scene.time.delayedCall(telegraphMs, () => {
      cleanupRing();
      if (!scene?.sys?.isActive() || this.isDestroyed || !this.isAlive) return;
      if (!scene.bulletManager?.createBossBullet) return;

      const blast = scene.bulletManager.createBossBullet(
        x,
        y,
        0,
        0,
        color,
        {
          radius,
          hasTrail: false,
          hasGlow: false,
          type: 'ring'
        }
      );
      blast.alpha = 0.55;

      this._trackHazardObject(blast);

      const activeTimer = scene.time.delayedCall(activeMs, () => {
        if (!scene?.sys?.isActive()) return;
        if (scene.bulletManager) scene.bulletManager.destroyBullet(blast, false);
        else if (blast?.active) blast.destroy();
      });
      this._trackHazardTimer(activeTimer);
    });

    this._trackHazardTimer(telegraphTimer);

    // 场景关闭时清理
    scene.events.once('shutdown', cleanupRing);
    scene.events.once('sleep', cleanupRing);
  }

  _trackHazardTimer(t) {
    if (!t) return;
    if (!Array.isArray(this._hazardTimers)) this._hazardTimers = [];
    this._hazardTimers.push(t);
  }

  _trackHazardObject(o) {
    if (!o) return;
    if (!Array.isArray(this._hazardObjects)) this._hazardObjects = [];
    this._hazardObjects.push(o);
  }

  clearHazards() {
    // 取消所有已排队的延迟事件（未来陷阱）
    if (Array.isArray(this._hazardTimers) && this._hazardTimers.length > 0) {
      this._hazardTimers.forEach((t) => {
        try { t?.remove?.(false); } catch (_) { /* ignore */ }
      });
      this._hazardTimers = [];
    }

    // 清理预警圈/短命环等对象（已生成但还没销毁）
    if (Array.isArray(this._hazardObjects) && this._hazardObjects.length > 0) {
      const scene = this.scene;
      const bm = scene?.bulletManager || null;

      this._hazardObjects.forEach((o) => {
        if (!o) return;
        // Boss 子弹走 BulletManager，确保 trail/glow 正确清理
        if (bm && o.isPlayerBullet === false && (o.active || o.markedForRemoval === false)) {
          try { bm.destroyBullet(o, false); } catch (_) { /* ignore */ }
          return;
        }
        try { if (o.active && o.destroy) o.destroy(); } catch (_) { /* ignore */ }
      });

      this._hazardObjects = [];
    }
  }

  castGroundBlastAtPlayer(options = {}) {
    const target = this.getPrimaryTarget();
    if (!target) return;
    this.castGroundBlast(target.x, target.y, options);
  }

  /**
   * 开始攻击模式
   */
  startAttackPattern() {
    if (this.attackPatterns.length === 0) return;

    const now = this.scene?.time?.now ?? 0;

    // 若无敌已结束（常见于 Boss 常驻，玩家过一会儿才进入范围），直接开始攻击
    if (!this.isInvincible) {
      this.executeAttackPattern();
      return;
    }

    // 否则按“剩余无敌时间”延迟，而不是再等一次完整 invincibleTime
    const endsAt = (this._invincibleEndsAt != null) ? this._invincibleEndsAt : (now + Math.max(0, this.invincibleTime || 0));
    const waitMs = Math.max(0, endsAt - now) + 500;
    this.scene.time.delayedCall(waitMs, () => {
      this.executeAttackPattern();
    });
  }

  /**
   * 执行攻击模式
   */
  executeAttackPattern() {
    if (!this.isAlive) return;

    // 眩晕中：不执行攻击，短延迟重试（直到眩晕结束）
    if (this.isStunned()) {
      if (this.attackTimer) this.attackTimer.remove();
      this.attackTimer = this.scene.time.delayedCall(90, () => this.executeAttackPattern());
      return;
    }
    
    const pattern = this.attackPatterns[this.currentPatternIndex];
    if (pattern && pattern.execute) {
      pattern.execute(this);
    }
    
    // 循环攻击模式
    if (pattern && pattern.interval) {
      this.attackTimer = this.scene.time.delayedCall(pattern.interval, () => {
        this.executeAttackPattern();
      });
    }
  }

  isStunned() {
    const now = this.scene?.time?.now ?? 0;
    return (this.stunUntil || 0) > now;
  }

  applyStun(ms) {
    const now = this.scene?.time?.now ?? 0;
    const until = now + Math.max(0, ms || 0);
    this.stunUntil = Math.max(this.stunUntil || 0, until);

    // 暂停移动/攻击节奏
    if (this.moveTween && this.moveTween.isPlaying()) this.moveTween.pause();
    if (this.moveTimer) this.moveTimer.paused = true;
    if (this.attackTimer) this.attackTimer.paused = true;

    // 轻量反馈：外圈闪一下
    if (this.scene?.add) {
      const c = this.color ?? 0xffffff;
      const ring = this.scene.add.circle(this.x, this.y, (this.bossSize || 50) + 18, c, 0.05);
      ring.setStrokeStyle(4, c, 0.55);
      ring.setDepth(9);
      this.scene.tweens.add({
        targets: ring,
        alpha: 0,
        scale: 1.4,
        duration: 320,
        onComplete: () => ring.destroy()
      });
    }

    // 只保留一个恢复定时器
    if (this._stunResumeTimer) this._stunResumeTimer.remove();
    this._stunResumeTimer = this.scene?.time?.delayedCall(Math.max(0, until - now) + 5, () => {
      const n = this.scene?.time?.now ?? 0;
      if ((this.stunUntil || 0) > n) return;

      if (this.moveTween && this.moveTween.isPaused()) this.moveTween.resume();
      if (this.moveTimer) this.moveTimer.paused = false;
      if (this.attackTimer) this.attackTimer.paused = false;
    });
  }

  /**
   * 切换到下一个攻击阶段
   */
  nextAttackPhase() {
    this.currentPatternIndex = (this.currentPatternIndex + 1) % this.attackPatterns.length;
    this.attackPhase++;
    console.log(`${this.bossName} 进入攻击阶段 ${this.attackPhase}`);
  }

  /**
   * 受到伤害
   */
  takeDamage(damage, context = {}) {
    if (!this.isAlive) {
      console.log(`${this.bossName} 已死亡，无法受伤`);
      return false;
    }

    if (!this._firstDamagedAt) {
      this._firstDamagedAt = (this.scene?.time?.now ?? 0);
    }

    // 接口：受击反馈（允许无伤害也触发；比如无敌阶段被打也要有反应）
    this.triggerHitReaction({ ...(context || {}), damage });

    // 规则：被攻击即激活（无视距离，只要发生受击/伤害结算尝试就强制开战）
    if (this.combatActive === false) {
      if (typeof this.setCombatActive === 'function') this.setCombatActive(true);
      else this.combatActive = true;
    }

    if (this.isInvincible) {
      console.log(`${this.bossName} 处于无敌状态，无法受伤`);
      return false;
    }
    
    const appliedDamage = Math.round(damage * (this.damageTakenMult || 1));
    this.currentHp -= appliedDamage;
    this.updateHpBar();
    
    // 受伤闪烁效果
    this.scene.tweens.add({
      targets: this.body,
      alpha: 0.3,
      duration: 100,
      yoyo: true
    });
    
    console.log(`${this.bossName} 受到 ${appliedDamage} 点伤害，剩余 HP: ${this.currentHp}/${this.maxHp}`);
    
    // 检查是否死亡
    if (this.currentHp <= 0) {
      this.die();
      return true;
    }
    
    // 检查是否需要切换阶段（根据血量）
    const hpPercent = this.currentHp / this.maxHp;
    const phasesCount = this.attackPatterns.length;
    const expectedPhase = phasesCount - Math.floor(hpPercent * phasesCount);
    
    if (expectedPhase > this.attackPhase - 1 && expectedPhase < phasesCount) {
      this.nextAttackPhase();
    }
    
    return false;
  }

  /**
   * 触发受击反馈（带冷却）
   * @param {object} ctx
   */
  triggerHitReaction(ctx = {}) {
    if (!this.scene || this.isDestroyed || !this.isAlive) return;
    if (ctx && ctx.suppressHitReaction) return;

    const now = this.scene?.time?.now ?? 0;
    const cdMs = Math.max(0, this.hitReactionCdMs ?? 650);
    const last = this._lastHitReactionAt ?? -999999;
    if (now - last < cdMs) return;
    this._lastHitReactionAt = now;

    try {
      if (typeof this.onHitReaction === 'function') {
        this.onHitReaction(ctx);
      }
    } catch (e) {
      console.warn(`[Boss] onHitReaction error:`, e);
    }
  }

  /**
   * 默认受击反馈：远程反击（玩家脚下瞬爆）
   * 子类/配置可覆写为：冲锋、释放防御法阵、召唤等。
   */
  onHitReaction(ctx = {}) {
    const type = (this.hitReactionType || 'ranged_blast');

    if (type === 'dash') {
      this.dashToPlayerOnHit(ctx);
      return;
    }

    // 默认：远程反击（玩家脚下瞬爆）
    if (typeof this.castGroundBlastAtPlayer !== 'function') return;
    this.castGroundBlastAtPlayer({
      radius: Math.max(70, Math.round((this.bossSize || 50) * 1.4)),
      telegraphMs: 0,
      activeMs: 200,
      color: this.bossColor || 0xff5533
    });
  }

  dashToPlayerOnHit(ctx = {}) {
    const scene = this.scene;
    if (!scene?.time || !scene?.tweens) return;
    if (this.isDestroyed || !this.isAlive) return;

    const target = this.getPrimaryTarget();
    if (!target || !target.active || target.isAlive === false) return;

    // 已在冲锋中：避免叠加
    if (this._hitDashTween && this._hitDashTween.isPlaying && this._hitDashTween.isPlaying()) return;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const stopDist = Math.max(20, this.hitDashStopDist || 120);
    if (!Number.isFinite(dist) || dist <= stopDist + 6) return;

    const nx = dx / dist;
    const ny = dy / dist;
    let endX = target.x - nx * stopDist;
    let endY = target.y - ny * stopDist;

    // 夹到可移动边界内
    const b = this.getMoveBounds({ x: 110, top: 90, bottom: 150 });
    endX = Phaser.Math.Clamp(endX, b.left, b.right);
    endY = Phaser.Math.Clamp(endY, b.top, b.bottom);

    const dashSpeed = Math.max(200, this.hitDashSpeed || 980); // px/s
    const ms = Phaser.Math.Clamp(Math.round((dist / dashSpeed) * 1000), 140, 420);

    // 冲锋期间暂停常规移动（攻击保持不动，避免节奏突变）
    const hadMoveTween = this.moveTween;
    const moveTweenWasPaused = hadMoveTween?.isPaused?.() || false;
    if (hadMoveTween && hadMoveTween.isPlaying && hadMoveTween.isPlaying()) {
      hadMoveTween.pause();
    }
    if (this.moveTimer) this.moveTimer.paused = true;

    this._hitDashTween = scene.tweens.add({
      targets: this,
      x: endX,
      y: endY,
      duration: ms,
      ease: 'Cubic.Out',
      onComplete: () => {
        this._hitDashTween = null;
        if (this.isDestroyed || !this.isAlive) return;
        if (this.moveTimer) this.moveTimer.paused = !this.combatActive;
        if (hadMoveTween && !moveTweenWasPaused && this.combatActive) {
          try { hadMoveTween.resume(); } catch (_) { /* ignore */ }
        }
      }
    });
  }

  /**
   * 更新血条
   */
  updateHpBar() {
    const hpPercent = Math.max(0, this.currentHp / this.maxHp);
    this.hpBar.width = 150 * hpPercent;
    
    // 根据血量改变颜色
    if (hpPercent > 0.6) {
      this.hpBar.setFillStyle(0x00ff00);
    } else if (hpPercent > 0.3) {
      this.hpBar.setFillStyle(0xffff00);
    } else {
      this.hpBar.setFillStyle(0xff0000);
    }
  }

  /**
   * Boss 死亡
   */
  die() {
    if (!this.isAlive) return;
    
    this.isAlive = false;
    // 进入死亡流程时，立刻阻止任何后续机制继续生成
    this.isDestroyed = true;

    // 清空 Boss 弹幕与未来陷阱：避免“Boss 已死但弹幕/落点还在打人”
    try { this.scene?.bulletManager?.clearBossBullets?.(); } catch (_) { /* ignore */ }
    try { this.clearHazards(); } catch (_) { /* ignore */ }

    try {
      const now = (this.scene?.time?.now ?? 0);
      const first = (this._firstDamagedAt || now);
      const ttkMs = Math.max(0, now - first);
      const stage = this.scene?.currentStage || 1;
      // eslint-disable-next-line no-console
      console.log(`[TTK] stage=${stage} role=boss name=${this.bossName} hp=${this.maxHp} ttk=${(ttkMs / 1000).toFixed(2)}s`);
    } catch (_) { /* ignore */ }

    console.log(`${this.bossName} 被击败了！`);
    
    // 停止所有计时器
    if (this.attackTimer) this.attackTimer.remove();
    if (this.moveTimer) this.moveTimer.remove();
    
    // 死亡动画
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.5,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        this.onDeath();
        this.destroy();
      }
    });
    
    // 爆炸效果
    this.createDeathEffect();
  }

  /**
   * 创建增强的Boss子弹（带粒子效果）
   * @param {number} x - X位置
   * @param {number} y - Y位置
   * @param {number} angle - 发射角度
   * @param {number} speed - 速度
   * @param {string|number} color - 颜色
   * @param {object} options - 选项 {radius, glow, trail, type}
   */
  createEnhancedBullet(x, y, angle, speed, color, options = {}) {
    const {
      radius = 7,
      glowRadius = 10,
      hasTrail = true,
      trailColor = null,
      type = 'circle'
    } = options;

    // 通过 BulletManager 创建Boss子弹，确保被碰撞检测系统追踪到
    const bullet = this.scene.bulletManager.createBossBullet(
      x, y, angle, speed, color,
      {
        radius: radius,
        glowRadius: glowRadius,
        hasTrail: hasTrail,
        trailColor: trailColor,
        damage: 15,
        type: type
      }
    );

    return bullet;
  }

  /**
   * 创建死亡效果
   */
  createDeathEffect() {
    // 简单的粒子效果
    for (let i = 0; i < 20; i++) {
      const particle = this.scene.add.circle(this.x, this.y, 5, this.bossColor);
      const angle = (Math.PI * 2 * i) / 20;
      const speed = Phaser.Math.Between(100, 300);
      
      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        duration: 1000,
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Boss 死亡时调用（子类可重写）
   */
  onDeath() {
    // 通知场景 Boss 被击败
    this.scene.events.emit('bossDefeated', {
      name: this.bossName,
      score: this.maxHp,
      exp: Math.floor(this.maxHp / 10)
    });
  }

  /**
   * 清理
   */
  destroy() {
    this.isDestroyed = true;
    // 兜底：场景切换/对象销毁时，确保陷阱计时器不泄漏
    try { this.clearHazards(); } catch (_) { /* ignore */ }
    if (this.attackTimer) this.attackTimer.remove();
    if (this.moveTimer) this.moveTimer.remove();
    super.destroy();
  }
}
