import Phaser from 'phaser';

export default class TestMinion extends Phaser.GameObjects.Container {
  constructor(scene, config) {
    super(scene, config.x || 0, config.y || 0);

    this.scene = scene;
    this.scene.add.existing(this);

    this.isMinion = true;
    this.isEnemy = true;
    this.isElite = !!config.isElite;

    this.minionType = config.type || 'chaser'; // chaser | shooter
    this.minionName = config.name || (this.minionType === 'shooter' ? '随从·炮手' : '随从·追猎');

    this.maxHp = config.hp || 240;
    this.currentHp = this.maxHp;
    this.isAlive = true;
    this.isInvincible = false;

    this.damageTakenMult = 1;
    this.damageDealtMult = 1;

    this.radius = Math.max(10, config.size || 18);
    this.bossSize = this.radius; // 复用现有“bossSize”字段

    // 降低“追随小怪”靠近速度：整体下调，且跟随 Boss 时再慢一点
    this.moveSpeed = config.moveSpeed || (this.minionType === 'chaser' ? 78 : 68);

    this.contactDamage = config.contactDamage || (this.minionType === 'chaser' ? 14 : 0);
    this.contactCdMs = 650;
    this._lastContactAt = 0;

    this.shootCdMs = config.shootCdMs || 850;
    this._lastShotAt = 0;

    // 受击反馈（可扩展接口）：被击中后立即触发某种“反应”（远程反击/冲锋/防御法阵等）
    this.hitReactionCdMs = (config.hitReactionCdMs != null)
      ? Math.max(0, Math.round(config.hitReactionCdMs))
      : Math.max(0, Math.round(config.hitCounterCdMs ?? 520));

    this.followBoss = config.followBoss || null;
    this.followOffset = config.followOffset || { x: 120, y: 40 };

    // 第一关首波：进入视野后才开始追玩家
    this.aggroOnSeen = !!config.aggroOnSeen;
    this.aggroActive = !this.aggroOnSeen;

    this.debuffs = {};

    this.expReward = config.expReward !== undefined
      ? Math.max(0, Math.floor(config.expReward))
      : (this.isElite ? 120 : 100);

    this.createVisuals(config.color);
    this.createHpBar();
    this.createDebuffUi();
    this.updateHpBar();

    // Boss 入场无敌期：小怪不可被攻击，也不允许攻击
    if (this.followBoss?.isInvincible) {
      this.isInvincible = true;
      this.setVisible(false);
    }
  }

  createVisuals(color) {
    const core = color || (this.minionType === 'shooter' ? 0xaa66ff : 0xffaa66);
    this.body = this.scene.add.circle(0, 0, this.radius, core, 1);
    this.body.setStrokeStyle(2, 0xffffff, 0.8);
    this.add(this.body);

    // 名称标签（显示在圆形下方）
    const nameColor = this.isElite ? '#ffdd55' : '#ffffff';
    const fontSize = this.isElite ? '13px' : '12px';
    this.nameLabel = this.scene.add.text(0, this.radius + 8, this.minionName, {
      fontSize,
      fontFamily: 'Arial, sans-serif',
      color: nameColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.add(this.nameLabel);
  }

  createHpBar() {
    const barW = Math.max(42, Math.round(this.radius * 3.2));
    const barH = 6;
    const y = -this.radius - 16;

    this._hpBarW = barW;
    this.hpBarBg = this.scene.add.rectangle(0, y, barW, barH, 0x0b0b18, 0.80).setOrigin(0.5, 0.5);
    this.hpBarBg.setStrokeStyle(1, 0xffffff, 0.18);

    this.hpBarFill = this.scene.add.rectangle(-(barW * 0.5) + 1, y, barW - 2, barH - 2, 0x66ff99, 1).setOrigin(0, 0.5);

    this.add(this.hpBarBg);
    this.add(this.hpBarFill);
  }

  createDebuffUi() {
    if (this._debuffUi) return;
    const y = -this.radius - 28;
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
      const bg = this.scene.add.rectangle(0, 0, 30, 16, 0x000000, 0.38);
      bg.setStrokeStyle(1, 0xffffff, 0.16);

      const iconText = this.scene.add.text(-7, 0, label, {
        fontSize: '11px',
        color,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const stackText = this.scene.add.text(9, 0, String(nStacks), {
        fontSize: '11px',
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

    const spacing = 34;
    const total = Math.max(0, visibleKeys.length - 1) * spacing;
    const x0 = -Math.floor(total / 2);

    visibleKeys.forEach((k, idx) => {
      const e = ui.entries.get(k);
      if (!e) return;
      e.container.x = x0 + idx * spacing;
      e.container.y = 0;
    });
  }

  updateHpBar() {
    if (!this.hpBarBg || !this.hpBarFill) return;
    const max = Math.max(1, this.maxHp || 1);
    const cur = Math.max(0, this.currentHp || 0);
    const pct = Phaser.Math.Clamp(cur / max, 0, 1);
    const w = Math.max(2, Math.floor((this._hpBarW - 2) * pct));
    this.hpBarFill.width = w;

    const color = pct > 0.6 ? 0x66ff99 : (pct > 0.3 ? 0xffdd88 : 0xff6666);
    this.hpBarFill.fillColor = color;
  }

  takeDamage(damage, context = {}) {
    if (!this.isAlive) return false;

    // 接口：受击反馈
    this.triggerHitReaction({ ...(context || {}), damage });

    // 规则：被攻击即激活（无视距离/是否已进入视野）
    if (this.aggroOnSeen && !this.aggroActive) {
      this.aggroActive = true;
    }

    // 若是 Boss 附属小怪被打到：同时唤醒 Boss，避免“打小怪但 Boss 还休眠”
    if (this.followBoss && this.followBoss.combatActive === false) {
      if (typeof this.followBoss.setCombatActive === 'function') this.followBoss.setCombatActive(true);
      else this.followBoss.combatActive = true;
    }

    if (this.isInvincible) return false;
    const applied = Math.max(1, Math.round((damage || 0) * (this.damageTakenMult || 1)));
    this.currentHp -= applied;

    this.updateHpBar();

    this.scene.tweens.add({
      targets: this.body,
      alpha: 0.3,
      duration: 90,
      yoyo: true
    });

    if (this.currentHp <= 0) {
      this.die('killed');
      return true;
    }
    return false;
  }

  triggerHitReaction(ctx = {}) {
    if (!this.scene || !this.isAlive) return;
    if (ctx && ctx.suppressHitReaction) return;

    const now = this.scene?.time?.now ?? 0;
    const cdMs = Math.max(0, this.hitReactionCdMs ?? 520);
    const last = this._lastHitReactionAt ?? -999999;
    if (now - last < cdMs) return;
    this._lastHitReactionAt = now;

    try {
      if (typeof this.onHitReaction === 'function') {
        this.onHitReaction(ctx);
      }
    } catch (e) {
      console.warn('[Minion] onHitReaction error:', e);
    }
  }

  // 默认受击反馈：远程反击（快速射击一轮）
  onHitReaction(ctx = {}) {
    const player = this.scene?.getPrimaryTarget?.() || this.scene?.player || null;
    if (!player || !player.isAlive) return;
    if (!this.scene?.bulletManager?.createBossBullet) return;

    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const isShooter = this.minionType === 'shooter';
    const count = isShooter ? 2 : 1;
    const spread = isShooter ? 0.18 : 0;
    const speed = isShooter ? 210 : 230;
    const damage = isShooter ? 9 : 8;
    const color = isShooter ? 0xaa66ff : 0xffaa66;
    const type = isShooter ? 'diamond' : 'circle';

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1));
      const a = baseAngle + (t - 0.5) * spread;
      this.scene.bulletManager.createBossBullet(this.x, this.y, a, speed, color, {
        radius: 6,
        damage,
        hasTrail: true,
        type
      });
    }
  }

  die(reason = 'unknown') {
    if (!this.isAlive) return;
    this.isAlive = false;

    if (reason === 'killed' && this.scene?.events) {
      this.scene.events.emit('minionKilled', {
        x: this.x,
        y: this.y,
        isElite: !!this.isElite,
        expReward: this.expReward
      });
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0,
      duration: 220,
      ease: 'Cubic.In',
      onComplete: () => {
        if (this.active) this.destroy();
      }
    });
  }

  update(time, delta, player) {
    if (!this.isAlive) return;

    // 血条同步（跟随衰减/恢复等未来扩展）
    this.updateHpBar();

    // 若绑定 Boss 且 Boss 已死：跟着消失
    if (this.followBoss && (!this.followBoss.isAlive || this.followBoss.isDestroyed)) {
      this.die('despawn');
      return;
    }

    // Boss 无敌期：小怪不可被攻击，也不允许攻击（不射击/不接触伤害）
    if (this.followBoss?.isInvincible) {
      this.isInvincible = true;
      this.setVisible(false);
      return;
    } else {
      if (this.isInvincible) this.isInvincible = false;
      if (!this.visible) this.setVisible(true);
    }

    // Boss 常驻但未开战：小怪也保持待机（可见但不移动/不攻击）
    if (this.followBoss && this.followBoss.combatActive === false) {
      return;
    }

    // 进入视野后才激活（用于第一关首波扎堆小怪）
    if (!this.followBoss && this.aggroOnSeen && !this.aggroActive) {
      const cam = this.scene?.cameras?.main;
      const view = cam?.worldView;
      const inView = (view && Phaser.Geom.Rectangle.Contains(view, this.x, this.y));
      const inRange = (player && player.isAlive)
        ? (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= 420)
        : false;
      if (inView || inRange) {
        this.aggroActive = true;
      } else {
        return;
      }
    }

    // 轻量“体积”分离：避免多个小怪完全重叠
    if (!this.followBoss && this.scene?.bossManager?.getMinions) {
      const minions = this.scene.bossManager.getMinions();
      for (let i = 0; i < minions.length; i++) {
        const other = minions[i];
        if (!other || other === this || !other.isAlive) continue;
        if (other.followBoss) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const minDist = (this.radius || 16) + (other.radius || 16) + 2;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          this.x += nx * push;
          this.y += ny * push;
        }
      }
    }

    const dt = (delta || 0) / 1000;

    if (this.minionType === 'shooter' && this.followBoss) {
      const targetX = this.followBoss.x + (this.followOffset?.x || 0);
      const targetY = this.followBoss.y + (this.followOffset?.y || 0);
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const followSpeed = this.moveSpeed * 0.75;
      const step = Math.min(dist, followSpeed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;

      // 玩家-小怪分离：不允许重叠，留一点点距离
      if (player && player.isAlive) {
        const pr = player.getHitboxPosition?.().radius ?? (player.hitboxRadius || 16);
        const ddx = this.x - player.x;
        const ddy = this.y - player.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
        const minDist = (this.radius || 16) + pr + 4;
        if (d < minDist) {
          const nx = ddx / d;
          const ny = ddy / d;
          this.x = player.x + nx * minDist;
          this.y = player.y + ny * minDist;
        }
      }

      this.tryShoot(time, player);
      return;
    }

    // chaser：追玩家
    if (player && player.isAlive) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const step = Math.min(dist, this.moveSpeed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;

      this.tryContact(time, player);

      // 玩家-小怪分离：先结算接触伤害，再把小怪推出一点点
      const pr = player.getHitboxPosition?.().radius ?? (player.hitboxRadius || 16);
      const ddx = this.x - player.x;
      const ddy = this.y - player.y;
      const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
      const minDist = (this.radius || 16) + pr + 4;
      if (d < minDist) {
        const nx = ddx / d;
        const ny = ddy / d;
        this.x = player.x + nx * minDist;
        this.y = player.y + ny * minDist;
      }
    }
  }

  tryContact(time, player) {
    if (!player || !player.isAlive) return;
    if (this.contactDamage <= 0) return;

    const now = time || (this.scene.time?.now ?? 0);
    if (this._lastContactAt && now - this._lastContactAt < this.contactCdMs) return;

    const pr = player.getHitboxPosition?.().radius ?? (player.hitboxRadius || 16);
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    // 与“玩家-小怪分离”的留缝一致：不重叠但仍算接触伤害
    const separationPad = 4;
    if (dist <= (this.radius + pr + separationPad)) {
      this._lastContactAt = now;
      player.takeDamage(this.contactDamage);
    }
  }

  tryShoot(time, player) {
    if (!player || !player.isAlive) return;
    const now = time || (this.scene.time?.now ?? 0);
    if (this._lastShotAt && now - this._lastShotAt < this.shootCdMs) return;
    this._lastShotAt = now;

    if (!this.scene?.bulletManager?.createBossBullet) return;

    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    // 降低密集程度：更少子弹 + 更长 CD
    const count = 3;
    const spread = 0.22;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1));
      const a = baseAngle + (t - 0.5) * spread;
      this.scene.bulletManager.createBossBullet(this.x, this.y, a, 180, 0xaa66ff, {
        radius: 6,
        damage: 10,
        hasTrail: true,
        type: i % 2 === 0 ? 'diamond' : 'circle'
      });
    }
  }
}
