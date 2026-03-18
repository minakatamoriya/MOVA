import Phaser from 'phaser';

// 冲锋采用“线段扫掠 vs 圆形 hitbox”检测，避免高速位移时穿过玩家不判伤。
function segmentHitsCircle(ax, ay, bx, by, cx, cy, r) {
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 0.000001) {
    const dx = ax - cx;
    const dy = ay - cy;
    return (dx * dx + dy * dy) <= (r * r);
  }

  const t = Phaser.Math.Clamp(((acx * abx) + (acy * aby)) / len2, 0, 1);
  const px = ax + abx * t;
  const py = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return (dx * dx + dy * dy) <= (r * r);
}

function clampWorldPoint(scene, x, y, padding = 18) {
  const bounds = scene?.worldBoundsRect || scene?.gameArea;
  if (!bounds) return { x, y };

  return {
    x: Phaser.Math.Clamp(x, bounds.x + padding, bounds.x + bounds.width - padding),
    y: Phaser.Math.Clamp(y, bounds.y + padding, bounds.y + bounds.height - padding)
  };
}

function buildEliteAffixDisplayText(affixes = []) {
  const names = Array.isArray(affixes)
    ? affixes.map((item) => item?.name || '').filter(Boolean)
    : [];
  if (names.length <= 2) return names.join(' · ');

  const rows = [];
  for (let i = 0; i < names.length; i += 2) {
    rows.push(names.slice(i, i + 2).join(' · '));
  }
  return rows.join('\n');
}

function lerpColor(colorA, colorB, t) {
  const c1 = Phaser.Display.Color.IntegerToColor(colorA);
  const c2 = Phaser.Display.Color.IntegerToColor(colorB);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, Math.round(Phaser.Math.Clamp(t, 0, 1) * 100));
  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
}

function segmentDistanceToPoint(ax, ay, bx, by, px, py) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 0.000001) {
    const dx = px - ax;
    const dy = py - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const t = Phaser.Math.Clamp(((apx * abx) + (apy * aby)) / len2, 0, 1);
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  const dx = px - qx;
  const dy = py - qy;
  return Math.sqrt(dx * dx + dy * dy);
}

export default class TestMinion extends Phaser.GameObjects.Container {
  constructor(scene, config) {
    super(scene, config.x || 0, config.y || 0);

    this.scene = scene;
    this.scene.add.existing(this);

    this.isMinion = true;
    this.isEnemy = true;
    this.isElite = !!config.isElite;
    this._destroying = false;

    this.minionType = config.type || 'chaser'; // chaser | shooter | ring_shooter | charger
    this.minionName = config.name || (
      this.minionType === 'ring_shooter' ? '随从·光环射手'
        : (this.minionType === 'charger' ? '随从·冲锋者'
          : (this.minionType === 'shooter' ? '随从·炮手' : '随从·追猎'))
    );
    this.baseMinionName = this.minionName;

    this.maxHp = config.hp || 240;
    this.currentHp = this.maxHp;
    this.isAlive = true;
    this.isInvincible = false;

    this.damageTakenMult = 1;
    this.damageDealtMult = 1;

    this.radius = Math.max(10, config.size || 18);
    this.bossSize = this.radius; // 复用现有“bossSize”字段

    // 降低“追随小怪”靠近速度：整体下调，且跟随 Boss 时再慢一点
    const defaultMoveSpeed = this.minionType === 'charger'
      ? 86
      : ((this.minionType === 'chaser') ? 78 : 68);
    this.moveSpeed = config.moveSpeed || defaultMoveSpeed;

    this.contactDamage = config.contactDamage || ((this.minionType === 'chaser') ? 14 : 0);
    this.contactCdMs = 650;
    this._lastContactAt = 0;

    this.shootCdMs = config.shootCdMs || (this.minionType === 'ring_shooter' ? 1500 : 850);
    this._lastShotAt = 0;
    this._ownedTimers = [];
    this._burstActive = false;

    this.shootBulletCount = (config.shootBulletCount != null) ? Math.max(1, Math.floor(config.shootBulletCount)) : 3;
    this.shootBulletSpread = (config.shootBulletSpread != null) ? Number(config.shootBulletSpread) : 0.22;
    this.shootBulletSpeed = (config.shootBulletSpeed != null) ? Math.max(60, Math.floor(config.shootBulletSpeed)) : 180;
    this.shootBulletDamage = (config.shootBulletDamage != null) ? Math.max(1, Math.floor(config.shootBulletDamage)) : 10;
    this.shootBurstCount = (config.shootBurstCount != null) ? Math.max(1, Math.floor(config.shootBurstCount)) : 3;
    this.shootBurstSpacingMs = (config.shootBurstSpacingMs != null)
      ? Math.max(30, Math.floor(config.shootBurstSpacingMs))
      : (this.minionType === 'ring_shooter' ? 220 : 120);
    this.aggroRadius = (config.aggroRadius != null)
      ? Math.max(80, Math.round(config.aggroRadius))
      : 420;
    this.shootRange = (config.shootRange != null)
      ? Math.max(60, Math.round(config.shootRange))
      : (this.isElite ? 230 : 190);

    this.chargeRange = (config.chargeRange != null)
      ? Math.max(70, Math.round(config.chargeRange))
      : (this.isElite ? 185 : 160);
    this.chargeCdMs = (config.chargeCdMs != null)
      ? Math.max(300, Math.round(config.chargeCdMs))
      : 1750;
    this.chargeWindupMs = (config.chargeWindupMs != null)
      ? Math.max(100, Math.round(config.chargeWindupMs))
      : 260;
    this.chargeSpeed = (config.chargeSpeed != null)
      ? Math.max(140, Math.round(config.chargeSpeed))
      : 430;
    this.chargeSpeedStart = (config.chargeSpeedStart != null)
      ? Math.max(40, Math.round(config.chargeSpeedStart))
      : Math.max(70, Math.round(this.chargeSpeed * 0.26));
    this.chargeAccelExponent = (config.chargeAccelExponent != null)
      ? Math.max(1.05, Number(config.chargeAccelExponent))
      : 1.9;
    this.chargeDamage = (config.chargeDamage != null)
      ? Math.max(1, Math.round(config.chargeDamage))
      : Math.max(8, Math.round((config.contactDamage || 10) * 1.35));
    this.chargeTravelPx = (config.chargeTravelPx != null)
      ? Math.max(80, Math.round(config.chargeTravelPx))
      : (this.isElite ? 250 : 210);
    this.chargeOvershootPx = (config.chargeOvershootPx != null)
      ? Math.max(20, Math.round(config.chargeOvershootPx))
      : Math.max(48, Math.round(this.radius * 3.2));
    this.chargeBackstepPx = (config.chargeBackstepPx != null)
      ? Math.max(4, Math.round(config.chargeBackstepPx))
      : 18;
    this._lastChargeAt = -999999;
    this._chargeState = 'idle';
    this._chargeDir = new Phaser.Math.Vector2(0, 0);
    this._chargeDistanceLeft = 0;
    this._chargeWindupUntil = 0;
    this._chargeRecoverUntil = 0;
    this._chargeHitApplied = false;
    this._chargeTrailAt = 0;
    this._chargeVisualSpeed = this.chargeSpeedStart;
    this._chargeTelegraph = null;
    this._chargeTelegraphLength = Math.max(120, Math.round(this.chargeTravelPx * 0.92));
    this._chargeTurnRadPerSec = (config.chargeTurnRadPerSec != null)
      ? Math.max(0, Number(config.chargeTurnRadPerSec))
      : Phaser.Math.DegToRad(160);
    this._chargeTarget = new Phaser.Math.Vector2(0, 0);

    this.eliteAffixes = [];
    this.eliteAffixIds = new Set();
    this._eliteAffixState = {
      lastArcaneAt: -999999,
      lastFrozenAt: -999999,
      lastWallAt: -999999,
      lastArcaneHitAt: -999999,
      activeArcane: null,
      activeArcaneCleanupTimer: null,
      activeFrozen: null,
      activeWalls: []
    };
    this._eliteAffixText = null;
    this._eliteAura = null;
    this._eliteBlueAura = null;
    this._eliteRedAura = null;
    this.applyEliteAffixes(config.eliteAffixes);

    // 受击反馈（可扩展接口）：被击中后立即触发某种“反应”（远程反击/冲锋/防御法阵等）
    this.hitReactionCdMs = (config.hitReactionCdMs != null)
      ? Math.max(0, Math.round(config.hitReactionCdMs))
      : Math.max(0, Math.round(config.hitCounterCdMs ?? 520));

    this.followBoss = config.followBoss || null;
    this.followOffset = config.followOffset || { x: 120, y: 40 };
    this.stunUntil = 0;
    this.freezeUntil = 0;
    this._freezeClearTimer = null;
    this._freezeAura = null;
    this._freezeCrystal = null;

    // 第一关首波：进入视野后才开始追玩家
    this.aggroOnSeen = !!config.aggroOnSeen;
    this.aggroActive = !this.aggroOnSeen;

    // “检测到后缓缓移动”：速度爬升时间（毫秒）
    this.aggroRampMs = (config.aggroRampMs != null) ? Math.max(0, Math.floor(config.aggroRampMs)) : 650;
    this._aggroStartAt = this.aggroActive ? (this.scene?.time?.now ?? 0) : 0;

    this.debuffs = {};
    this.showStatusUi = false;

    this.expReward = config.expReward !== undefined
      ? Math.max(0, Math.floor(config.expReward))
      : (this.isElite ? 120 : 100);

    this.spawnProtectedUntilVisible = !!config.spawnProtectedUntilVisible;
    this._spawnProtectionCleared = !this.spawnProtectedUntilVisible;
    if (this.spawnProtectedUntilVisible) {
      this.isInvincible = true;
    }

    this.createVisuals(config.color);
    this.syncOverheadUiVisibility();
    this.updateHpBar();

    // Boss 入场无敌期：小怪不可被攻击，也不允许攻击
    if (this.followBoss?.isInvincible) {
      this.isInvincible = true;
      this.setVisible(false);
    }
  }

  createVisuals(color) {
    const core = color || (
      this.minionType === 'ring_shooter' ? 0xff2ca8
        : (this.minionType === 'charger' ? 0xff9a52
          : (this.minionType === 'shooter' ? 0xaa66ff : 0xffaa66))
    );

    if (this.minionType === 'ring_shooter') {
      const halo = this.scene.add.circle(0, 0, this.radius + 5, core, 0.10);
      halo.setStrokeStyle(4, 0xffd0f0, 0.96);
      halo.setBlendMode(Phaser.BlendModes.ADD);
      const coreOrb = this.scene.add.circle(0, 0, Math.max(5, this.radius * 0.46), 0xff79cb, 0.95);
      coreOrb.setStrokeStyle(2, 0xffffff, 0.65);
      const leftSigil = this.scene.add.circle(-this.radius * 0.62, 0, 2.5, 0xffd0f0, 0.9);
      const rightSigil = this.scene.add.circle(this.radius * 0.62, 0, 2.5, 0xffd0f0, 0.9);
      this.sprite = halo;
      this.add(halo);
      this.add(coreOrb);
      this.add(leftSigil);
      this.add(rightSigil);
    } else if (this.minionType === 'charger') {
      const spearhead = this.scene.add.triangle(
        0,
        0,
        this.radius * 1.18, 0,
        -this.radius * 0.86, -this.radius * 0.82,
        -this.radius * 0.86, this.radius * 0.82,
        core,
        0.98
      );
      spearhead.setStrokeStyle(2, 0xffe0b0, 0.78);
      const tail = this.scene.add.rectangle(-this.radius * 0.48, 0, Math.max(8, this.radius * 0.95), Math.max(6, this.radius * 0.60), 0xffc27a, 0.88);
      tail.setAngle(0);
      const coreSpark = this.scene.add.circle(this.radius * 0.20, 0, Math.max(4, this.radius * 0.22), 0xfff1c2, 0.95);
      this.sprite = spearhead;
      this._visualFacingNodes = [tail, spearhead];
      this.add(tail);
      this.add(spearhead);
      this.add(coreSpark);
    } else {
      // 默认怪仍使用史莱姆贴图
      const texKey = 'shilaimu';
      if (this.scene?.textures?.exists?.(texKey)) {
        this.sprite = this.scene.add.image(0, 0, texKey);
        this.sprite.setDisplaySize(this.radius * 2, this.radius * 2);
        this.add(this.sprite);
      }
    }

    // 圆形触碰判定框：透明填充 + 描边
    this.body = this.scene.add.circle(0, 0, this.radius, core, 0);
    this.body.setStrokeStyle(
      this.minionType === 'ring_shooter' ? 4 : 2,
      this.minionType === 'ring_shooter' ? 0xffd0f0 : (this.minionType === 'charger' ? 0xffd28a : 0xffffff),
      0.95
    );
    this.add(this.body);

    if (this.isElite && this.eliteAffixes.length > 0) {
      const ringColor = this.getPrimaryEliteAffixColor();
      this._eliteBlueAura = this.scene.add.circle(0, 0, this.radius + 10, 0x58a6ff, 0.06);
      this._eliteBlueAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._eliteBlueAura, 0);

      this._eliteRedAura = this.scene.add.circle(0, 0, this.radius + 14, 0xff5b6e, 0.05);
      this._eliteRedAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._eliteRedAura, 0);

      this._eliteAura = this.scene.add.circle(0, 0, this.radius + 7, ringColor, 0.06);
      this._eliteAura.setStrokeStyle(2, ringColor, 0.78);
      this._eliteAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._eliteAura, 0);

      this.body.setStrokeStyle(
        this.minionType === 'ring_shooter' ? 4 : 3,
        ringColor,
        0.98
      );
    }

  }

  createHpBar() {
    if (this.hpBarBg || this.hpBarFill) return;
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

  createAffixUi() {
    if (this._eliteAffixText || !this.isElite || this.eliteAffixes.length <= 0) return;
    const label = buildEliteAffixDisplayText(this.eliteAffixes);
    this._eliteAffixText = this.scene.add.text(0, -this.radius - 54, label, {
      fontSize: '18px',
      color: '#ffe9b8',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center'
    }).setOrigin(0.5, 0.5);
    this._eliteAffixText.setDepth(12);
    this.add(this._eliteAffixText);
  }

  setDebuffStacks(key, stacks, opts = {}) {
    if (!this.showStatusUi) return;
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
    if (!this.showStatusUi) return;
    if (!this.hpBarBg || !this.hpBarFill) return;
    const max = Math.max(1, this.maxHp || 1);
    const cur = Math.max(0, this.currentHp || 0);
    const pct = Phaser.Math.Clamp(cur / max, 0, 1);
    const w = Math.max(2, Math.floor((this._hpBarW - 2) * pct));
    this.hpBarFill.width = w;

    const color = pct > 0.6 ? 0x66ff99 : (pct > 0.3 ? 0xffdd88 : 0xff6666);
    this.hpBarFill.fillColor = color;
  }

  shouldShowOverheadUi() {
    return this.scene?.registry?.get?.('showEnemyOverlays') === true;
  }

  syncOverheadUiVisibility() {
    const shouldShow = this.shouldShowOverheadUi();
    const shouldShowAffix = this.isElite && this.eliteAffixes.length > 0;
    if (this.showStatusUi === shouldShow && (!!this._eliteAffixText?.visible) === shouldShowAffix) return;

    this.showStatusUi = shouldShow;
    if (shouldShow) {
      this.createHpBar();
      this.createDebuffUi();
      this.updateHpBar();
    }

    // 精英词缀头标强制常显，不受 showEnemyOverlays 开关控制。
    this.createAffixUi();

    if (this.hpBarBg) this.hpBarBg.setVisible(shouldShow);
    if (this.hpBarFill) this.hpBarFill.setVisible(shouldShow);
    if (this._debuffUi?.container) this._debuffUi.container.setVisible(shouldShow);
    if (this._eliteAffixText) this._eliteAffixText.setVisible(shouldShowAffix);
  }

  takeDamage(damage, context = {}) {
    if (!this.isAlive) return false;
    if (this.isInvincible) return false;

    if (!this._firstDamagedAt) {
      this._firstDamagedAt = (this.scene?.time?.now ?? 0);
    }

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

    const applied = Math.max(1, Math.round((damage || 0) * Math.max(0.1, Number(this.damageTakenMult || 1))));
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
    if (this.minionType === 'charger') {
      const now = this.scene?.time?.now ?? 0;
      if (this._chargeState === 'idle' && now - (this._lastChargeAt || 0) >= Math.max(450, this.chargeCdMs * 0.45)) {
        this.startChargeWindup(now, player);
      }
      return;
    }
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
      this.spawnEnemyBullet({
        x: this.x,
        y: this.y,
        angle: a,
        speed,
        color,
        radius: 6,
        damage,
        options: {
          hasTrail: true,
          type
        }
      });
    }
  }

  applyEliteAffixes(affixes = []) {
    const list = (this.isElite && Array.isArray(affixes))
      ? affixes.filter((item) => item && item.id).map((item) => ({ ...item }))
      : [];

    this.eliteAffixes = list;
    this.eliteAffixIds = new Set(list.map((item) => item.id));
    if (list.length <= 0) return;

    // 第一版先把精英底座整体稍微抬高一点，确保“有词缀的精英”本体就更有存在感。
    this.maxHp = Math.round(this.maxHp * 1.14);
    this.currentHp = this.maxHp;
    this.damageTakenMult = Math.min(this.damageTakenMult || 1, 0.92);

    const affixNames = list.map((item) => item.name).filter(Boolean);
    const compactPrefix = affixNames.length > 2
      ? `${affixNames.slice(0, 2).join('·')}+${affixNames.length - 2}`
      : affixNames.join('·');
    this.minionName = compactPrefix ? `${compactPrefix} ${this.baseMinionName}` : this.baseMinionName;
  }

  hasEliteAffix(id) {
    return this.eliteAffixIds?.has?.(id) === true;
  }

  getPrimaryEliteAffixColor() {
    return this.eliteAffixes[0]?.color ?? 0xffd28a;
  }

  trackOwnedObject(obj) {
    if (!obj) return null;
    if (!Array.isArray(this._ownedObjects)) this._ownedObjects = [];
    this._ownedObjects.push(obj);
    return obj;
  }

  spawnEnemyBullet(descriptor = {}) {
    const x = Number(descriptor.x ?? this.x ?? 0);
    const y = Number(descriptor.y ?? this.y ?? 0);
    const angle = Number(descriptor.angle || 0);
    const speed = Number(descriptor.speed || 0);
    const color = descriptor.color ?? 0xffffff;
    const radius = Math.max(1, Number(descriptor.radius || 6));
    const damage = Math.max(1, Number(descriptor.damage || 1));
    const tags = Array.isArray(descriptor.tags) ? descriptor.tags : [];
    const options = { ...(descriptor.options || {}) };

    if (this.scene?.bulletCore?.createBossBullet) {
      return this.scene.bulletCore.createBossBullet({
        x,
        y,
        angle,
        speed,
        color,
        radius,
        damage,
        tags,
        options
      });
    }

    if (this.scene?.bulletManager?.createBossBullet) {
      return this.scene.bulletManager.createBossBullet(x, y, angle, speed, color, {
        radius,
        damage,
        ...options
      });
    }

    return null;
  }

  updateEliteAffixes(time, delta, player) {
    if (!this.isElite || this.eliteAffixes.length <= 0 || !player?.isAlive) return;

    this.updateEliteVisualState(time);
    this.updateActiveArcaneLaser(time, player);

    if (this._eliteAura?.active) {
      const pulse = 0.72 + 0.16 * Math.sin((time || 0) / 220);
      this._eliteAura.setScale(pulse);
      this._eliteAura.alpha = 0.10 + 0.04 * Math.sin((time || 0) / 180);
    }

    this.tryTriggerArcaneLaserAffix(time, player);
    this.tryTriggerFrozenBurstAffix(time, player);
    this.tryTriggerWallerAffix(time, player);
  }

  updateEliteVisualState(time) {
    if (!this.isElite) return;
    const wave = 0.5 + 0.5 * Math.sin((time || 0) / 180);
    const color = lerpColor(0x4aa3ff, 0xff5b6e, wave);

    if (this._eliteBlueAura?.active) {
      this._eliteBlueAura.alpha = 0.08 + (1 - wave) * 0.10;
      this._eliteBlueAura.setScale(0.95 + (1 - wave) * 0.22);
    }
    if (this._eliteRedAura?.active) {
      this._eliteRedAura.alpha = 0.08 + wave * 0.10;
      this._eliteRedAura.setScale(0.92 + wave * 0.26);
    }
    if (this.sprite?.setTint) this.sprite.setTint(color);
    if (this.body?.setStrokeStyle) this.body.setStrokeStyle(3, color, 1);
  }

  tryTriggerArcaneLaserAffix(time, player) {
    if (!this.hasEliteAffix('arcane_laser')) return;
    if (this._eliteAffixState.activeArcane) return;

    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastArcaneAt || 0) < 3600) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist > 360) return;

    this._eliteAffixState.lastArcaneAt = now;
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, hp.x, hp.y);
    [0, Math.PI * 0.5].forEach((offset) => {
      const teleA = this.scene?.patternSystem?.emitGroundTelegraph?.({
        x: this.x,
        y: this.y,
        shape: 'line',
        angle: baseAngle + offset,
        telegraphWidth: 16,
        telegraphLength: 250,
        telegraphColor: 0xb18cff,
        durationMs: 520
      });
      const teleB = this.scene?.patternSystem?.emitGroundTelegraph?.({
        x: this.x,
        y: this.y,
        shape: 'line',
        angle: baseAngle + offset + Math.PI,
        telegraphWidth: 16,
        telegraphLength: 250,
        telegraphColor: 0xb18cff,
        durationMs: 520
      });
      this.trackOwnedObject(teleA);
      this.trackOwnedObject(teleB);
    });

    const timer = this.scene?.time?.delayedCall?.(520, () => {
      if (!this.active || !this.isAlive) return;

      const visuals = [];
      for (let i = 0; i < 4; i += 1) {
        const beam = this.scene.add.rectangle(this.x, this.y, 250, 10, 0xc8a5ff, 0.42).setDepth(9);
        beam.setBlendMode(Phaser.BlendModes.ADD);
        const core = this.scene.add.rectangle(this.x, this.y, 250, 4, 0xf4eaff, 0.92).setDepth(10);
        core.setBlendMode(Phaser.BlendModes.ADD);
        visuals.push({ beam, core, angleOffset: i * (Math.PI * 0.5) });
      }

      this._eliteAffixState.activeArcane = {
        startedAt: this.scene?.time?.now ?? now,
        durationMs: 1700,
        length: 250,
        width: 10,
        angle: baseAngle,
        rotateSpeed: Phaser.Math.DegToRad(115),
        visuals
      };

      if (this._eliteAffixState.activeArcaneCleanupTimer) {
        try { this._eliteAffixState.activeArcaneCleanupTimer.remove(false); } catch (_) { /* ignore */ }
      }
      this._eliteAffixState.activeArcaneCleanupTimer = this.scene?.time?.delayedCall?.(1850, () => {
        this.clearActiveArcaneLaser();
      }) || null;
    });
    this.trackOwnedTimer(timer);
  }

  updateActiveArcaneLaser(time, player) {
    const state = this._eliteAffixState.activeArcane;
    if (!state) return;
    const now = time || (this.scene?.time?.now ?? 0);
    const elapsed = now - (state.startedAt || now);
    if (elapsed >= state.durationMs || !this.active || !this.isAlive) {
      this.clearActiveArcaneLaser();
      return;
    }

    state.angle += state.rotateSpeed * ((this.scene?.game?.loop?.delta || 16) / 1000);
    const beamLength = state.length;
    const beamWidth = state.width;
    const half = beamLength * 0.5;
    const hitAngles = [];

    state.visuals.forEach(({ beam, core, angleOffset }) => {
      const angle = state.angle + angleOffset;
      hitAngles.push(angle);
      const cx = this.x + Math.cos(angle) * half;
      const cy = this.y + Math.sin(angle) * half;
      beam?.setPosition?.(cx, cy);
      beam?.setAngle?.(Phaser.Math.RadToDeg(angle));
      core?.setPosition?.(cx, cy);
      core?.setAngle?.(Phaser.Math.RadToDeg(angle));
    });

    const hp = player?.getHitboxPosition?.() || { x: player?.x, y: player?.y, radius: player?.hitboxRadius || 16 };
    const isHit = hitAngles.some((angle) => segmentHitsCircle(
      this.x,
      this.y,
      this.x + Math.cos(angle) * beamLength,
      this.y + Math.sin(angle) * beamLength,
      hp.x,
      hp.y,
      (beamWidth * 0.5) + hp.radius
    ));
    if (isHit && (now - (this._eliteAffixState.lastArcaneHitAt || 0) >= 220)) {
      this._eliteAffixState.lastArcaneHitAt = now;
      this.scene?.vfxSystem?.playHit?.(hp.x, hp.y, {
        color: 0xd7b8ff,
        radius: 8,
        durationMs: 120
      });
      player.takeDamage(Math.max(1, Math.round((this.shootBulletDamage || 8) * 0.8)));
    }
  }

  clearActiveArcaneLaser() {
    const state = this._eliteAffixState?.activeArcane;
    if (state?.visuals) {
      state.visuals.forEach(({ beam, core }) => {
        try { beam?.destroy?.(); } catch (_) { /* ignore */ }
        try { core?.destroy?.(); } catch (_) { /* ignore */ }
      });
    }
    if (this._eliteAffixState?.activeArcaneCleanupTimer) {
      try { this._eliteAffixState.activeArcaneCleanupTimer.remove(false); } catch (_) { /* ignore */ }
    }
    this._eliteAffixState.activeArcaneCleanupTimer = null;
    this._eliteAffixState.activeArcane = null;
  }

  tryTriggerFrozenBurstAffix(time, player) {
    if (!this.hasEliteAffix('frozen_burst')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastFrozenAt || 0) < 3000) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y, radius: player.hitboxRadius || 16 };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist > 260) return;

    this._eliteAffixState.lastFrozenAt = now;
    const burstRadius = Math.max(72, this.radius + 58);
    this.scene?.patternSystem?.emitGroundTelegraph?.({
      x: this.x,
      y: this.y,
      telegraphRadius: burstRadius,
      telegraphColor: 0x8fe7ff,
      durationMs: 620
    });

    const timer = this.scene?.time?.delayedCall?.(620, () => {
      if (!this.active || !this.isAlive) return;
      this.scene?.vfxSystem?.playBurst?.(this.x, this.y, {
        radius: burstRadius,
        color: 0xbef3ff,
        durationMs: 180
      });
      this.scene?.patternSystem?.emitRing?.({
        side: 'boss',
        x: this.x,
        y: this.y,
        count: 10,
        speed: 126,
        color: 0x8fe7ff,
        radius: 7,
        damage: Math.max(1, Math.round((this.contactDamage || 8) * 0.85)),
        tags: ['elite_affix_frozen_burst'],
        options: {
          type: 'circle',
          hasTrail: true,
          trailColor: 0xd9fbff,
          hasGlow: true,
          glowRadius: 12
        }
      });

      const liveHp = player.getHitboxPosition?.() || hp;
      const hit = Phaser.Math.Distance.Between(this.x, this.y, liveHp.x, liveHp.y) <= (burstRadius + (liveHp.radius || 16));
      if (hit) {
        this.scene?.vfxSystem?.playHit?.(liveHp.x, liveHp.y, {
          color: 0xbef3ff,
          radius: 10,
          durationMs: 130
        });
        player.applyMoveSpeedSlow?.(0.28, 1400);
        player.takeDamage(Math.max(1, Math.round((this.contactDamage || 8) * 0.95)));
      }
    });
    this.trackOwnedTimer(timer);
  }

  tryTriggerWallerAffix(time, player) {
    if (!this.hasEliteAffix('waller')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastWallAt || 0) < 3400) return;
    if ((this._eliteAffixState.activeWalls || []).length > 0) return;

    const cfg = this.scene?.mapConfig;
    if (!cfg?.cellSize || !cfg?.gridSize) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y };
    const dx = hp.x - this.x;
    const dy = hp.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (dist > 320) return;

    this._eliteAffixState.lastWallAt = now;
    const cellSize = cfg.cellSize;
    const gridSize = cfg.gridSize;
    const centerGx = Math.floor((hp.x - Math.sign(dx || 1) * cellSize * 0.9) / cellSize);
    const centerGy = Math.floor((hp.y - Math.sign(dy || 1) * cellSize * 0.9) / cellSize);
    const vertical = Math.abs(dx) > Math.abs(dy);
    const cells = [];
    for (let i = -1; i <= 1; i += 1) {
      const gx = vertical ? centerGx : centerGx + i;
      const gy = vertical ? centerGy + i : centerGy;
      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) continue;
      cells.push({ gx, gy, idx: gy * gridSize + gx });
    }
    if (cells.length <= 0) return;

    const telegraphs = cells.map((cell) => {
      const x = cell.gx * cellSize + cellSize * 0.5;
      const y = cell.gy * cellSize + cellSize * 0.5;
      const tele = this.scene?.patternSystem?.emitGroundTelegraph?.({
        x,
        y,
        telegraphRadius: Math.max(16, cellSize * 0.42),
        telegraphColor: 0xffb36b,
        durationMs: 420
      });
      return tele;
    }).filter(Boolean);
    telegraphs.forEach((obj) => this.trackOwnedObject(obj));

    const timer = this.scene?.time?.delayedCall?.(420, () => {
      if (!this.active || !this.isAlive) return;
      const walls = cells.map((cell) => {
        this.scene?.eliteAffixBlockedCells?.add?.(cell.idx);
        const x = cell.gx * cellSize + cellSize * 0.5;
        const y = cell.gy * cellSize + cellSize * 0.5;
        const wall = this.scene.add.rectangle(x, y, cellSize - 8, cellSize - 8, 0xffa154, 0.22).setDepth(8);
        wall.setStrokeStyle(3, 0xffd29b, 0.92);
        return { wall, idx: cell.idx, x, y };
      });
      this._eliteAffixState.activeWalls = walls;

      const clearTimer = this.scene?.time?.delayedCall?.(1400, () => {
        this.clearEliteWalls();
      });
      this.trackOwnedTimer(clearTimer);
    });
    this.trackOwnedTimer(timer);
  }

  clearEliteWalls() {
    const walls = Array.isArray(this._eliteAffixState.activeWalls) ? this._eliteAffixState.activeWalls : [];
    walls.forEach((entry) => {
      this.scene?.eliteAffixBlockedCells?.delete?.(entry.idx);
      try { entry.wall?.destroy?.(); } catch (_) { /* ignore */ }
    });
    this._eliteAffixState.activeWalls = [];
  }

  isStunned() {
    const now = this.scene?.time?.now ?? 0;
    return (this.stunUntil || 0) > now;
  }

  ensureFreezeVisuals() {
    if (!this.scene?.add) return;
    if (this._freezeAura?.active && this._freezeCrystal?.active) return;

    this._freezeAura = this.scene.add.circle(0, 0, this.radius + 8, 0x8fdcff, 0.12);
    this._freezeAura.setStrokeStyle(2, 0xe0f7ff, 0.85);
    this._freezeAura.setVisible(false);
    this.add(this._freezeAura);

    const crystal = this.scene.add.graphics();
    crystal.fillStyle(0xe0f7ff, 0.58);
    crystal.lineStyle(1.5, 0xffffff, 0.88);
    crystal.beginPath();
    crystal.moveTo(0, -12);
    crystal.lineTo(8, -4);
    crystal.lineTo(5, 10);
    crystal.lineTo(0, 16);
    crystal.lineTo(-5, 10);
    crystal.lineTo(-8, -4);
    crystal.closePath();
    crystal.fillPath();
    crystal.strokePath();
    crystal.setPosition(0, -this.radius - 6);
    crystal.setVisible(false);
    this._freezeCrystal = crystal;
    this.add(crystal);
  }

  setFrozenVisualVisible(visible) {
    this.ensureFreezeVisuals();
    if (this._freezeAura) this._freezeAura.setVisible(visible);
    if (this._freezeCrystal) this._freezeCrystal.setVisible(visible);
    if (this.sprite?.setTint) {
      if (visible) this.sprite.setTint(0xc9f2ff);
      else this.sprite.clearTint();
    }
    if (this.body?.setStrokeStyle) {
      this.body.setStrokeStyle(2, visible ? 0xe0f7ff : 0xffffff, visible ? 1 : 0.85);
    }
  }

  applyStun(ms) {
    const now = this.scene?.time?.now ?? 0;
    const until = now + Math.max(0, ms || 0);
    this.stunUntil = Math.max(this.stunUntil || 0, until);
  }

  applyFreeze(ms) {
    if (!this.isAlive) return;

    const now = this.scene?.time?.now ?? 0;
    const until = now + Math.max(0, ms || 0);
    this.freezeUntil = Math.max(this.freezeUntil || 0, until);
    this.applyStun(ms);
    this.setFrozenVisualVisible(true);

    if (this.scene?.add && this.scene?.tweens) {
      const burst = this.scene.add.circle(this.x, this.y, this.radius + 5, 0xbfe9ff, 0.18).setDepth(11);
      burst.setStrokeStyle(2, 0xe0f7ff, 0.92);
      this.scene.tweens.add({
        targets: burst,
        scale: 1.28,
        alpha: 0,
        duration: 180,
        ease: 'Cubic.Out',
        onComplete: () => burst.destroy()
      });
    }

    if (this._freezeClearTimer) this._freezeClearTimer.remove();
    this._freezeClearTimer = this.scene?.time?.delayedCall(Math.max(0, until - now) + 10, () => {
      const current = this.scene?.time?.now ?? 0;
      if ((this.freezeUntil || 0) > current) return;
      this.setFrozenVisualVisible(false);
    });
  }

  die(reason = 'unknown') {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.isInvincible = true;
    this.setFrozenVisualVisible(false);
    if (this._freezeClearTimer) this._freezeClearTimer.remove();

    try { this.scene?.tweens?.killTweensOf?.(this); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this.body); } catch (_) { /* ignore */ }

    if (this.hpBarBg) this.hpBarBg.setVisible(false);
    if (this.hpBarFill) this.hpBarFill.setVisible(false);
    if (this._debuffUi?.container) this._debuffUi.container.setVisible(false);

    if (reason === 'killed') {
      const now = (this.scene?.time?.now ?? 0);
      const first = (this._firstDamagedAt || now);
      const ttkMs = Math.max(0, now - first);
      const stage = this.scene?.currentStage || 1;
      const role = this.isElite ? 'elite' : 'minion';
      // eslint-disable-next-line no-console
      console.log(`[TTK] stage=${stage} role=${role} name=${this.minionName} hp=${this.maxHp} ttk=${(ttkMs / 1000).toFixed(2)}s`);
    }

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
        if (!this.active) return;
        this.destroy();
      }
    });
  }

  cleanupVisuals() {
    try { this.scene?.tweens?.killTweensOf?.(this); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this.body); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this.sprite); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this.hpBarBg); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this.hpBarFill); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._debuffUi?.container); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteAffixText); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteBlueAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteRedAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._freezeAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._freezeCrystal); } catch (_) { /* ignore */ }

    this.clearOwnedTimers();
    this.clearEliteWalls();
    this.clearChargeTelegraph();
    this.clearActiveArcaneLaser();

    if (Array.isArray(this._ownedObjects)) {
      this._ownedObjects.forEach((obj) => {
        try { obj?.destroy?.(); } catch (_) { /* ignore */ }
      });
      this._ownedObjects = [];
    }

    if (this._freezeClearTimer) this._freezeClearTimer.remove();

    if (this.hpBarBg) this.hpBarBg.setVisible(false);
    if (this.hpBarFill) this.hpBarFill.setVisible(false);
    if (this._debuffUi?.container) this._debuffUi.container.setVisible(false);

    try { this.removeAll(true); } catch (_) { /* ignore */ }

    this.sprite = null;
    this.body = null;
    this.hpBarBg = null;
    this.hpBarFill = null;
    this._debuffUi = null;
    this._eliteAffixText = null;
    this._eliteAura = null;
    this._eliteBlueAura = null;
    this._eliteRedAura = null;
    this._freezeAura = null;
    this._freezeCrystal = null;
  }

  destroy(fromScene) {
    if (this._destroying) return;
    this._destroying = true;
    this.cleanupVisuals();
    super.destroy(fromScene);
  }

  update(time, delta, player) {
    if (!this.isAlive) return;

    this.syncOverheadUiVisibility();

    // 血条同步（跟随衰减/恢复等未来扩展）
    this.updateHpBar();

    if (this.isStunned()) {
      return;
    }

    const cam = this.scene?.cameras?.main;
    const view = cam?.worldView;
    if (this.spawnProtectedUntilVisible && !this._spawnProtectionCleared) {
      const inView = !!(view && Phaser.Geom.Rectangle.Contains(view, this.x, this.y));
      if (!inView) {
        this.isInvincible = true;
        return;
      }
      this._spawnProtectionCleared = true;
      this.spawnProtectedUntilVisible = false;
      this.isInvincible = false;
      this.aggroActive = true;
      this._aggroStartAt = (this.scene?.time?.now ?? time ?? 0);
    }

    // 若绑定 Boss 且 Boss 已死：脱离 Boss，作为普通留场单位继续存在
    if (this.followBoss && (!this.followBoss.isAlive || this.followBoss.isDestroyed)) {
      this.followBoss = null;
      this.aggroActive = true;
      this._aggroStartAt = (this.scene?.time?.now ?? time ?? 0);
      this.isInvincible = false;
      if (!this.visible) this.setVisible(true);
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

    this.updateEliteAffixes(time, delta, player);

    // 进入视野后才激活（用于第一关首波扎堆小怪）
    if (!this.followBoss && this.aggroOnSeen && !this.aggroActive) {
      const inView = (view && Phaser.Geom.Rectangle.Contains(view, this.x, this.y));
      const inRange = (player && player.isAlive)
        ? (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= this.aggroRadius)
        : false;
      if (inView || inRange) {
        this.aggroActive = true;
        this._aggroStartAt = (this.scene?.time?.now ?? time ?? 0);
      } else {
        return;
      }
    }

    // 轻量“体积”分离：避免多个小怪完全重叠
    // 节流：每 3 帧执行一次（O(n²) 检测在小怪多时开销大）
    this._separationFrame = ((this._separationFrame || 0) + 1) % 3;
    if (this._separationFrame === 0 && !this.followBoss && this.scene?.bossManager?.getMinions) {
      const minions = this.scene.bossManager.getMinions();
      for (let i = 0; i < minions.length; i++) {
        const other = minions[i];
        if (!other || other === this || !other.isAlive) continue;
        if (other.followBoss) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist2 = dx * dx + dy * dy;
        const minDist = (this.radius || 16) + (other.radius || 16) + 2;
        if (dist2 < minDist * minDist) {
          const dist = Math.sqrt(dist2) || 0.0001;
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          this.x += nx * push;
          this.y += ny * push;
        }
      }
    }

    const dt = (delta || 0) / 1000;

    // 速度缓启动：刚激活时更慢，逐步逼近 moveSpeed
    const now = (time != null) ? time : (this.scene?.time?.now ?? 0);
    let speedMult = 1;
    if (!this.followBoss && this.aggroRampMs > 0) {
      const t = Math.max(0, now - (this._aggroStartAt || 0));
      // 0.35 起步，避免完全不动；随后线性爬到 1
      const pct = Phaser.Math.Clamp(t / this.aggroRampMs, 0, 1);
      speedMult = 0.35 + 0.65 * pct;
    }

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

    if (this.minionType === 'ring_shooter' && player && player.isAlive) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const attackRange = Math.max(80, this.shootRange || 210);
      const preferredRange = Math.max(60, attackRange - 40);

      if (dist > attackRange) {
        const step = Math.min(dist - attackRange, (this.moveSpeed * speedMult) * dt);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      } else if (dist < preferredRange) {
        const backoff = Math.min(preferredRange - dist, (this.moveSpeed * 0.72) * dt);
        this.x -= (dx / dist) * backoff;
        this.y -= (dy / dist) * backoff;
      }

      this.tryShoot(time, player);
      return;
    }

    if (this.minionType === 'charger' && player && player.isAlive) {
      this.updateCharger(time, delta, player, speedMult);
      return;
    }

    // shooter（不跟随Boss）：缓慢靠近到理想距离并射击
    if (this.minionType === 'shooter' && player && player.isAlive) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

      // 远程单位：进入预警范围后，先走到“可攻击距离”再开始攻击
      const attackRange = Math.max(60, this.shootRange || 190);
      if (dist > attackRange) {
        const step = Math.min(dist - attackRange, (this.moveSpeed * speedMult) * dt);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }

      this.tryShoot(time, player);
      return;
    }

    // chaser：追玩家
    if (player && player.isAlive) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const step = Math.min(dist, (this.moveSpeed * speedMult) * dt);
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
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist > Math.max(60, this.shootRange || 190)) return;
    const now = time || (this.scene.time?.now ?? 0);
    if (this._lastShotAt && now - this._lastShotAt < this.shootCdMs) return;
    this._lastShotAt = now;

    if (this.minionType === 'ring_shooter') {
      this.startRingBurst(player, now);
      return;
    }

    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const count = Math.max(1, this.shootBulletCount || 1);
    const spread = Number.isFinite(this.shootBulletSpread) ? this.shootBulletSpread : 0.0;
    const speed = Math.max(60, this.shootBulletSpeed || 180);
    const damage = Math.max(1, this.shootBulletDamage || 10);

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1));
      const a = baseAngle + (t - 0.5) * spread;
      this.spawnEnemyBullet({
        x: this.x,
        y: this.y,
        angle: a,
        speed,
        color: 0xaa66ff,
        radius: 6,
        damage,
        tags: ['minion_shot'],
        options: {
          hasTrail: true,
          type: i % 2 === 0 ? 'diamond' : 'circle'
        }
      });
    }
  }

  trackOwnedTimer(timer) {
    if (!timer) return null;
    if (!Array.isArray(this._ownedTimers)) this._ownedTimers = [];
    this._ownedTimers.push(timer);
    return timer;
  }

  clearOwnedTimers() {
    if (!Array.isArray(this._ownedTimers) || this._ownedTimers.length === 0) return;
    this._ownedTimers.forEach((timer) => {
      try { timer?.remove?.(false); } catch (_) { /* ignore */ }
    });
    this._ownedTimers = [];
  }

  startRingBurst(player, now) {
    if (this._burstActive) return;
    this._burstActive = true;

    const burstCount = Math.max(1, this.shootBurstCount || 3);
    const spacingMs = Math.max(30, this.shootBurstSpacingMs || 120);
    const flashColor = 0xff2ca8;
    this.scene?.vfxSystem?.playCharge?.(this.x, this.y, {
      radius: this.radius + 4,
      color: flashColor,
      durationMs: Math.max(80, burstCount * spacingMs)
    });

    // 连发采用独立 timer，而不是一帧里瞬发，目的是让玩家能读出“1、2、3 发”的节奏。
    for (let i = 0; i < burstCount; i++) {
      const timer = this.scene?.time?.delayedCall?.(i * spacingMs, () => {
        if (!this.active || !this.isAlive) return;
        if (!player?.active || player.isAlive === false) return;
        this.fireReadableRingShot(player);
        if (i === burstCount - 1) {
          this._burstActive = false;
        }
      });
      this.trackOwnedTimer(timer);
    }
  }

  fireReadableRingShot(player) {
    const targetHp = player?.getHitboxPosition?.() || { x: player.x, y: player.y };
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetHp.x, targetHp.y);
    const color = 0xff2ca8;
    const speed = Math.max(90, this.shootBulletSpeed || 140);
    const damage = Math.max(1, this.shootBulletDamage || 8);

    // 远程怪已接到今天新增的 bullets system：优先走 BulletCore，
    // 只有系统未初始化时才回退旧 BulletManager，保证现有关卡不因初始化顺序失效。
    this.spawnEnemyBullet({
      x: this.x,
      y: this.y,
      angle,
      speed,
      color,
      radius: 11,
      damage,
      tags: ['minion_ring_shot'],
      options: {
        type: 'circle',
        hasTrail: false,
        hasGlow: true,
        glowRadius: 16
      }
    });

    this.scene?.vfxSystem?.playCastFlash?.(this.x, this.y, {
      color,
      radius: this.radius + 5,
      durationMs: 90
    });
  }

  startChargeWindup(time, player) {
    if (!player || !player.isAlive) return;
    if (this._chargeState !== 'idle') return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y };
    const dx = hp.x - this.x;
    const dy = hp.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    this._chargeDir.set(dx / dist, dy / dist);
    this._chargeState = 'windup';
    this._chargeWindupUntil = time + this.chargeWindupMs;
    this._chargeDistanceLeft = this.chargeTravelPx;
    this._chargeHitApplied = false;
    this._chargeTrailAt = 0;
    this._chargeVisualSpeed = this.chargeSpeedStart;
    // 前摇阶段先记录一个“穿过玩家后落点”的目标点，
    // 这样冲锋不是停在玩家脸上，而是有真实的穿刺路径。
    this._chargeTarget.set(
      this.x + this._chargeDir.x * this._chargeTelegraphLength,
      this.y + this._chargeDir.y * this._chargeTelegraphLength
    );

    this.scene?.vfxSystem?.playCharge?.(this.x, this.y, {
      radius: this.radius + 6,
      color: 0xffb066,
      durationMs: this.chargeWindupMs
    });

    this.clearChargeTelegraph();
    this._chargeTelegraph = this.scene?.vfxSystem?.playLineTelegraph?.(this.x, this.y, {
      angle: Math.atan2(this._chargeDir.y, this._chargeDir.x),
      width: 12,
      length: this._chargeTelegraphLength,
      color: 0xffa95c,
      durationMs: this.chargeWindupMs + 80
    }) || null;
    this.updateChargeTelegraph();

    this.scene?.tweens?.add?.({
      targets: this.body,
      alpha: 0.35,
      duration: Math.max(60, Math.floor(this.chargeWindupMs * 0.5)),
      yoyo: true,
      repeat: 0,
      onComplete: () => {
        if (this.body?.active) this.body.alpha = 1;
      }
    });

    if (this.sprite?.setTint) this.sprite.setTint(0xffd28a);
    this.updateFacingVisual(Math.atan2(this._chargeDir.y, this._chargeDir.x));
  }

  updateCharger(time, delta, player, speedMult) {
    const now = time || (this.scene?.time?.now ?? 0);
    const dt = (delta || 0) / 1000;
    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y, radius: player.hitboxRadius || 16 };

    if (this._chargeState === 'windup') {
      const targetDx = hp.x - this.x;
      const targetDy = hp.y - this.y;
      const targetAngle = Math.atan2(targetDy, targetDx);
      const currentAngle = Math.atan2(this._chargeDir.y, this._chargeDir.x);
      const nextAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, Phaser.Math.DegToRad(520) * dt);
      this._chargeDir.set(Math.cos(nextAngle), Math.sin(nextAngle));

      const backstepSpeed = this.chargeBackstepPx / Math.max(0.08, this.chargeWindupMs / 1000);
      this.x -= this._chargeDir.x * backstepSpeed * dt;
      this.y -= this._chargeDir.y * backstepSpeed * dt;
      this._chargeTarget.set(
        hp.x + this._chargeDir.x * this.chargeOvershootPx,
        hp.y + this._chargeDir.y * this.chargeOvershootPx
      );
      this.updateChargeTelegraph();
      this.updateFacingVisual(nextAngle);

      if (now >= this._chargeWindupUntil) {
        const releaseDx = hp.x - this.x;
        const releaseDy = hp.y - this.y;
        const releaseDist = Math.sqrt(releaseDx * releaseDx + releaseDy * releaseDy) || 0.0001;
        this._chargeDir.set(releaseDx / releaseDist, releaseDy / releaseDist);
        this._chargeTarget.set(
          hp.x + this._chargeDir.x * this.chargeOvershootPx,
          hp.y + this._chargeDir.y * this.chargeOvershootPx
        );
        this._chargeDistanceLeft = Math.min(
          this.chargeTravelPx,
          Math.max(90, releaseDist + this.chargeOvershootPx)
        );
        this._chargeState = 'dash';
        this._lastChargeAt = now;
        this.clearChargeTelegraph();
        this.scene?.vfxSystem?.playCastFlash?.(this.x, this.y, {
          color: 0xffd28a,
          radius: this.radius + 8,
          durationMs: 90
        });
      }
      return;
    }

    if (this._chargeState === 'dash') {
      const prevX = this.x;
      const prevY = this.y;
      const totalDistance = Math.max(1, this.chargeTravelPx);
      const progress = Phaser.Math.Clamp(1 - (this._chargeDistanceLeft / totalDistance), 0, 1);
      const eased = 1 - Math.pow(1 - progress, this.chargeAccelExponent || 2.1);
      const currentAngle = Math.atan2(this._chargeDir.y, this._chargeDir.x);
      const targetAngle = Math.atan2(this._chargeTarget.y - this.y, this._chargeTarget.x - this.x);
      const steerStrength = progress < 0.35 ? 1 : 0.18;
      const steeredAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, this._chargeTurnRadPerSec * dt * steerStrength);
      this._chargeDir.set(Math.cos(steeredAngle), Math.sin(steeredAngle));
      const currentSpeed = Phaser.Math.Linear(this.chargeSpeedStart, this.chargeSpeed, eased);
      this._chargeVisualSpeed = currentSpeed;
      const step = Math.min(this._chargeDistanceLeft, currentSpeed * dt);
      this.x += this._chargeDir.x * step;
      this.y += this._chargeDir.y * step;
      this._chargeDistanceLeft -= step;
      this.updateFacingVisual(steeredAngle);

      if (now >= this._chargeTrailAt) {
        this.spawnChargeTrail();
        this._chargeTrailAt = now + 36;
      }

      if (!this._chargeHitApplied) {
        const hitR = Math.max(4, Number(hp.radius || player.hitboxRadius || 16));
        const impactRadius = this.radius + hitR + 12;
        const directHit = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y) <= impactRadius;
        const sweptHit = segmentHitsCircle(prevX, prevY, this.x, this.y, hp.x, hp.y, impactRadius);
        if (directHit || sweptHit) {
          this._chargeHitApplied = true;
          player.takeDamage(this.chargeDamage);
          this.scene?.vfxSystem?.playHit?.(hp.x, hp.y, {
            color: 0xffc27a,
            radius: 10,
            durationMs: 120
          });
          this._chargeDistanceLeft = 0;
        }
      }

      if (this._chargeDistanceLeft <= 0) {
        this._chargeState = 'recover';
        this._chargeRecoverUntil = now + 180;
        if (this.sprite?.clearTint) this.sprite.clearTint();
      }
      return;
    }

    if (this._chargeState === 'recover') {
      if (now >= this._chargeRecoverUntil) {
        this._chargeState = 'idle';
      }
      return;
    }

    const dx = hp.x - this.x;
    const dy = hp.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

    if (dist <= this.chargeRange && now - this._lastChargeAt >= this.chargeCdMs) {
      this.startChargeWindup(now, player);
      return;
    }

    const preferredRange = Math.max(this.chargeRange + 8, this.radius + (hp.radius || 16) + 16);
    const step = Math.min(Math.max(0, dist - preferredRange), (this.moveSpeed * speedMult) * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.updateFacingVisual(Math.atan2(dy, dx));
  }

  updateFacingVisual(angleRad) {
    if (!Array.isArray(this._visualFacingNodes) || this._visualFacingNodes.length === 0) return;
    const angleDeg = Phaser.Math.RadToDeg(angleRad || 0);
    this._visualFacingNodes.forEach((node) => {
      if (!node?.active || node.setAngle == null) return;
      node.setAngle(angleDeg);
    });
  }

  updateChargeTelegraph() {
    const telegraph = this._chargeTelegraph;
    if (!telegraph?.active) return;
    const angle = Math.atan2(this._chargeDir.y, this._chargeDir.x);
    const len = Math.max(80, Phaser.Math.Distance.Between(this.x, this.y, this._chargeTarget.x, this._chargeTarget.y));
    const half = len * 0.5;
    if (telegraph.width !== len) {
      telegraph.width = len;
      telegraph.displayWidth = len;
    }
    telegraph.setPosition(this.x + this._chargeDir.x * half, this.y + this._chargeDir.y * half);
    telegraph.setAngle(Phaser.Math.RadToDeg(angle));
  }

  clearChargeTelegraph() {
    if (!this._chargeTelegraph) return;
    try { this._chargeTelegraph.destroy(); } catch (_) { /* ignore */ }
    this._chargeTelegraph = null;
  }

  spawnChargeTrail() {
    if (!this.scene?.add || !this.scene?.tweens) return;
    const angleDeg = Phaser.Math.RadToDeg(Math.atan2(this._chargeDir.y, this._chargeDir.x));
    const speedRatio = Phaser.Math.Clamp((this._chargeVisualSpeed || this.chargeSpeedStart) / Math.max(1, this.chargeSpeed), 0.18, 1);
    const streak = this.scene.add.rectangle(
      this.x,
      this.y,
      Math.max(14, this.radius * (1.7 + speedRatio * 1.6)),
      Math.max(4, 4 + speedRatio * 3),
      0xffb366,
      0.22 + speedRatio * 0.14
    );
    streak.setAngle(angleDeg);
    streak.setDepth(6);
    this.scene.tweens.add({
      targets: streak,
      alpha: 0,
      scaleX: 0.40,
      duration: 135,
      ease: 'Quad.Out',
      onComplete: () => streak.destroy()
    });
  }
}
