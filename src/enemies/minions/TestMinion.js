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

function getTargetHitbox(target) {
  if (!target) return null;
  if (typeof target.getHitboxPosition === 'function') {
    const hitbox = target.getHitboxPosition();
    if (hitbox && Number.isFinite(hitbox.x) && Number.isFinite(hitbox.y)) return hitbox;
  }

  return {
    x: Number(target.x || 0),
    y: Number(target.y || 0),
    radius: Number(target.hitboxRadius || target.hitRadius || target.radius || 16)
  };
}

function getTargetMotion(target, fallbackDx = 0, fallbackDy = 0) {
  const vx = Number(target?.worldVelocity?.x || 0);
  const vy = Number(target?.worldVelocity?.y || 0);
  const speed = Math.hypot(vx, vy);
  if (speed > 0.001) {
    return { vx, vy, speed, dirX: vx / speed, dirY: vy / speed };
  }

  const lx = Number(target?.lastMoveIntent?.x || 0);
  const ly = Number(target?.lastMoveIntent?.y || 0);
  const lastMag = Math.hypot(lx, ly);
  if (lastMag > 0.001) {
    return { vx: lx, vy: ly, speed: 1, dirX: lx / lastMag, dirY: ly / lastMag };
  }

  const fallbackMag = Math.hypot(fallbackDx, fallbackDy);
  if (fallbackMag > 0.001) {
    return {
      vx: fallbackDx / fallbackMag,
      vy: fallbackDy / fallbackMag,
      speed: 1,
      dirX: fallbackDx / fallbackMag,
      dirY: fallbackDy / fallbackMag,
    };
  }

  return { vx: 0, vy: 1, speed: 0, dirX: 0, dirY: 1 };
}

function perpendicularVector(x, y, sign = 1) {
  return sign >= 0 ? { x: -y, y: x } : { x: y, y: -x };
}

export default class TestMinion extends Phaser.GameObjects.Container {
  constructor(scene, config) {
    super(scene, config.x || 0, config.y || 0);

    this.scene = scene;
    this.scene.add.existing(this);

    this.isMinion = true;
    this.isEnemy = true;
    this.isElite = !!config.isElite;
    this.isSummon = !!config.isSummon;
    this.noKillRewards = !!config.noKillRewards;
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
    this._chargeTelegraphMarker = null;
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
      lastEmberAt: -999999,
      lastBombardAt: -999999,
      lastPoisonAt: -999999,
      lastSummonAt: -999999,
      lastTrapAt: -999999,
      lastBlinkAt: -999999,
      lastArcaneHitAt: -999999,
      moltenTickAt: -999999,
      activeArcane: null,
      activeArcaneCleanupTimer: null,
      activeFrozen: null,
      activeWalls: [],
      activeMolten: null,
      activePoisonPools: [],
      activeTraps: [],
      summonUnits: [],
      enragedActive: false,
      enrageTriggered: false
    };
    this._eliteAffixText = null;
    this._eliteAura = null;
    this._eliteBlueAura = null;
    this._eliteRedAura = null;
    this._eliteDarkAura = null;
    this._elitePurpleAura = null;
    this._eliteCrown = null;
    this._eliteSmokeMotes = [];
    this.applyEliteAffixes(config.eliteAffixes);

    // 受击反馈（可扩展接口）：被击中后立即触发某种“反应”（远程反击/冲锋/防御法阵等）
    this.hitReactionCdMs = (config.hitReactionCdMs != null)
      ? Math.max(0, Math.round(config.hitReactionCdMs))
      : Math.max(0, Math.round(config.hitCounterCdMs ?? 520));

    this.followBoss = config.followBoss || null;
    this.followOffset = config.followOffset || { x: 120, y: 40 };
    this.stunUntil = 0;
    this.freezeUntil = 0;
    this.slowUntil = 0;
    this.slowMoveMult = 1;
    this._freezeClearTimer = null;
    this._freezeAura = null;
    this._freezeCrystal = null;

    // 第一关首波：进入视野后才开始追玩家
    this.aggroOnSeen = !!config.aggroOnSeen;
    this.aggroActive = !this.aggroOnSeen;
    this.forceChasePlayerAfterBoss = !!config.forceChasePlayerAfterBoss;
    this.packRole = config.packRole || (this.minionType === 'ring_shooter'
      ? 'orbiter'
      : (this.minionType === 'charger' ? 'diver' : 'frontliner'));
    this.packIndex = Math.max(0, Math.floor(Number(config.packIndex) || 0));
    this.flankSign = (config.flankSign != null)
      ? (Number(config.flankSign) >= 0 ? 1 : -1)
      : ((this.packIndex % 2 === 0) ? 1 : -1);
    this.interceptLeadMs = (config.interceptLeadMs != null)
      ? Phaser.Math.Clamp(Number(config.interceptLeadMs), 80, 520)
      : (this.minionType === 'ring_shooter' ? 160 : 240);
    this.flankOffset = (config.flankOffset != null)
      ? Math.max(0, Math.round(Number(config.flankOffset) || 0))
      : (this.minionType === 'ring_shooter' ? 54 : 84);
    this.orbitRange = (config.orbitRange != null)
      ? Math.max(12, Math.round(Number(config.orbitRange) || 0))
      : (this.minionType === 'ring_shooter' ? 72 : 48);

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
    const visualRadius = this.isElite ? Math.round(this.radius * 1.18) : this.radius;
    const core = color || (
      this.minionType === 'ring_shooter' ? 0xff2ca8
        : (this.minionType === 'charger' ? 0xff9a52
          : (this.minionType === 'shooter' ? 0xaa66ff : 0xffaa66))
    );

    if (this.minionType === 'ring_shooter') {
      const halo = this.scene.add.circle(0, 0, visualRadius + 5, core, 0.10);
      halo.setStrokeStyle(4, 0xffd0f0, 0.96);
      halo.setBlendMode(Phaser.BlendModes.ADD);
      const coreOrb = this.scene.add.circle(0, 0, Math.max(5, visualRadius * 0.46), 0xff79cb, 0.95);
      coreOrb.setStrokeStyle(2, 0xffffff, 0.65);
      const leftSigil = this.scene.add.circle(-visualRadius * 0.62, 0, 2.5, 0xffd0f0, 0.9);
      const rightSigil = this.scene.add.circle(visualRadius * 0.62, 0, 2.5, 0xffd0f0, 0.9);
      this.sprite = halo;
      this.add(halo);
      this.add(coreOrb);
      this.add(leftSigil);
      this.add(rightSigil);
    } else if (this.minionType === 'charger') {
      const spearhead = this.scene.add.triangle(
        0,
        0,
        visualRadius * 1.18, 0,
        -visualRadius * 0.86, -visualRadius * 0.82,
        -visualRadius * 0.86, visualRadius * 0.82,
        core,
        0.98
      );
      spearhead.setStrokeStyle(2, 0xffe0b0, 0.78);
      const tail = this.scene.add.rectangle(-visualRadius * 0.48, 0, Math.max(8, visualRadius * 0.95), Math.max(6, visualRadius * 0.60), 0xffc27a, 0.88);
      tail.setAngle(0);
      const coreSpark = this.scene.add.circle(visualRadius * 0.20, 0, Math.max(4, visualRadius * 0.22), 0xfff1c2, 0.95);
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
        this.sprite.setDisplaySize(visualRadius * 2, visualRadius * 2);
        this.add(this.sprite);
      }
    }

    // 圆形触碰判定框：透明填充 + 描边
    this.body = this.scene.add.circle(0, 0, visualRadius, core, 0);
    this.body.setStrokeStyle(
      this.minionType === 'ring_shooter' ? 4 : 2,
      this.minionType === 'ring_shooter' ? 0xffd0f0 : (this.minionType === 'charger' ? 0xffd28a : 0xffffff),
      0.95
    );
    this.add(this.body);

    if (this.isElite && this.eliteAffixes.length > 0) {
      const ringColor = this.getPrimaryEliteAffixColor();
      this._eliteDarkAura = this.scene.add.circle(0, 0, visualRadius + 18, 0x090b10, 0.24);
      this._eliteDarkAura.setStrokeStyle(2, 0x131722, 0.7);
      this.addAt(this._eliteDarkAura, 0);

      this._eliteBlueAura = this.scene.add.circle(0, 0, visualRadius + 10, 0x58a6ff, 0.08);
      this._eliteBlueAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._eliteBlueAura, 0);

      this._elitePurpleAura = this.scene.add.circle(0, 0, visualRadius + 12, 0x9d6bff, 0.07);
      this._elitePurpleAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._elitePurpleAura, 0);

      this._eliteRedAura = this.scene.add.circle(0, 0, visualRadius + 16, 0xff5b6e, 0.06);
      this._eliteRedAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._eliteRedAura, 0);

      this._eliteAura = this.scene.add.circle(0, 0, visualRadius + 8, ringColor, 0.08);
      this._eliteAura.setStrokeStyle(3, ringColor, 0.84);
      this._eliteAura.setBlendMode(Phaser.BlendModes.ADD);
      this.addAt(this._eliteAura, 0);

      this._eliteCrown = this.scene.add.triangle(
        0,
        -visualRadius - 8,
        -12, 5,
        0, -9,
        12, 5,
        0xffe1a6,
        0.92
      );
      this._eliteCrown.setStrokeStyle(2, ringColor, 0.86);
      this.add(this._eliteCrown);

      this._eliteSmokeMotes = [];
      for (let i = 0; i < 6; i += 1) {
        const mote = this.scene.add.circle(0, 0, Phaser.Math.Between(3, 5), 0x090b10, 0.28);
        mote.setStrokeStyle(1, i % 2 === 0 ? 0x6e79ff : 0xc14f72, 0.25);
        this.addAt(mote, 1);
        this._eliteSmokeMotes.push({
          node: mote,
          angle: (Phaser.Math.PI2 / 6) * i,
          orbitRadius: visualRadius + Phaser.Math.Between(8, 16),
          speed: Phaser.Math.FloatBetween(0.5, 1.15),
          drift: Phaser.Math.FloatBetween(2.5, 6.5),
          pulse: Phaser.Math.FloatBetween(0, Math.PI * 2)
        });
      }

      this.body.setStrokeStyle(
        this.minionType === 'ring_shooter' ? 4 : 3,
        ringColor,
        0.98
      );
    }

  }

  createHpBar() {
    if (this.hpBarBg || this.hpBarFill) return;
    const barW = Math.max(this.isElite ? 64 : 42, Math.round(this.radius * (this.isElite ? 4.1 : 3.2)));
    const barH = this.isElite ? 8 : 6;
    const y = -this.radius - (this.isElite ? 22 : 16);

    this._hpBarW = barW;
    this.hpBarBg = this.scene.add.rectangle(0, y, barW, barH, 0x0b0b18, 0.80).setOrigin(0.5, 0.5);
    this.hpBarBg.setStrokeStyle(this.isElite ? 2 : 1, this.isElite ? 0xffd4a0 : 0xffffff, this.isElite ? 0.42 : 0.18);

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
    const tagText = this.scene.add.text(0, -this.radius - 62, '精英', {
      fontSize: '11px',
      color: '#ffd699',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    const labelText = this.scene.add.text(0, -this.radius - 47, label, {
      fontSize: '18px',
      color: '#ffe9b8',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center'
    }).setOrigin(0.5, 0.5);
    const plaqueW = Math.max(86, labelText.width + 30);
    const plaque = this.scene.add.rectangle(0, -this.radius - 47, plaqueW, 24, 0x120d0d, 0.62).setOrigin(0.5, 0.5);
    plaque.setStrokeStyle(2, 0xffd0a0, 0.48);
    const accent = this.scene.add.rectangle(0, -this.radius - 60, 34, 3, this.getPrimaryEliteAffixColor(), 0.9).setOrigin(0.5, 0.5);
    const badge = this.scene.add.container(0, 0, [plaque, accent, tagText, labelText]);
    this._eliteAffixText = badge;
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
      mageFrost: 15,
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
    if (!this.showStatusUi && !this.isElite) return;
    if (!this.hpBarBg || !this.hpBarFill) return;
    const max = Math.max(1, this.maxHp || 1);
    const cur = Math.max(0, this.currentHp || 0);
    const pct = Phaser.Math.Clamp(cur / max, 0, 1);
    const w = Math.max(2, Math.floor((this._hpBarW - 2) * pct));
    this.hpBarFill.width = w;

    const color = this.isElite
      ? (pct > 0.6 ? 0x8ef7d0 : (pct > 0.3 ? 0xffc86e : 0xff6b6b))
      : (pct > 0.6 ? 0x66ff99 : (pct > 0.3 ? 0xffdd88 : 0xff6666));
    this.hpBarFill.fillColor = color;
  }

  shouldShowOverheadUi() {
    return this.scene?.registry?.get?.('showEnemyOverlays') === true;
  }

  syncOverheadUiVisibility() {
    const shouldShow = this.shouldShowOverheadUi();
    const shouldShowAffix = this.isElite && this.eliteAffixes.length > 0;
    const shouldShowEliteBar = this.isElite && this.eliteAffixes.length > 0;
    if (
      this.showStatusUi === shouldShow
      && (!!this._eliteAffixText?.visible) === shouldShowAffix
      && (!!this.hpBarBg?.visible) === (shouldShow || shouldShowEliteBar)
    ) return;

    this.showStatusUi = shouldShow;
    if (shouldShow || shouldShowEliteBar) {
      this.createHpBar();
    }
    if (shouldShow) {
      this.createDebuffUi();
    }
    this.updateHpBar();

    // 精英词缀头标强制常显，不受 showEnemyOverlays 开关控制。
    this.createAffixUi();

    if (this.hpBarBg) this.hpBarBg.setVisible(shouldShow || shouldShowEliteBar);
    if (this.hpBarFill) this.hpBarFill.setVisible(shouldShow || shouldShowEliteBar);
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

    // ── 受击白闪（吸血鬼幸存者风格） ──
    this.playHitFlash();

    // ── 微击退：从子弹/攻击者方向推开几像素 ──
    this.applyMicroKnockback(context);

    if (this.currentHp <= 0) {
      this.die('killed', context);
      return true;
    }
    return false;
  }

  playHitFlash() {
    if (!this.scene || !this.active) return;
    const now = this.scene.time?.now ?? 0;
    if (now - (this._lastFlashAt || 0) < 50) return;
    this._lastFlashAt = now;

    // 整体容器内所有图形节点 tint 白
    const nodes = this.list || [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n && typeof n.setTint === 'function' && n !== this.hpBarBg && n !== this.hpBarFill && !n._isDebuffUi) {
        n.setTint(0xffffff);
      }
    }
    this.scene.time.delayedCall(60, () => {
      if (!this.active) return;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n && n.active && typeof n.clearTint === 'function' && n !== this.hpBarBg && n !== this.hpBarFill && !n._isDebuffUi) {
          n.clearTint();
        }
      }
    });
  }

  applyMicroKnockback(context = {}) {
    if (!this.scene || !this.active || !this.isAlive) return;
    const bullet = context.bullet;
    const attacker = context.attacker;
    let pushAngle;
    if (bullet) {
      pushAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, this.x, this.y);
    } else if (attacker) {
      pushAngle = Phaser.Math.Angle.Between(attacker.x, attacker.y, this.x, this.y);
    } else {
      return;
    }
    const dist = this.isElite ? 2 : Phaser.Math.Between(3, 5);
    const nx = this.x + Math.cos(pushAngle) * dist;
    const ny = this.y + Math.sin(pushAngle) * dist;
    const clamped = clampWorldPoint(this.scene, nx, ny, 18);
    this.x = clamped.x;
    this.y = clamped.y;
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
        radius: isShooter ? 8 : 9,
        damage,
        options: {
          hasTrail: true,
          type,
          hasGlow: true,
          glowRadius: isShooter ? 16 : 18,
          trailColor: isShooter ? 0xe3d6ff : 0xffddba
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

    if (this.hasEliteAffix('hasted')) {
      this.moveSpeed = Math.round(this.moveSpeed * 1.14);
      this.shootCdMs = Math.max(320, Math.round(this.shootCdMs * 0.88));
      this.chargeCdMs = Math.max(320, Math.round(this.chargeCdMs * 0.9));
      this.chargeSpeed = Math.round(this.chargeSpeed * 1.08);
    }

    if (this.hasEliteAffix('juggernaut')) {
      this.maxHp = Math.round(this.maxHp * 1.18);
      this.currentHp = this.maxHp;
      this.damageTakenMult = Math.min(this.damageTakenMult || 1, 0.84);
      this.contactDamage = Math.max(1, Math.round((this.contactDamage || 0) * 1.15));
      this.radius += 2;
    }

    if (this.hasEliteAffix('ember_nova')) {
      this.contactDamage = Math.max(1, Math.round((this.contactDamage || 1) * 1.1));
    }

    if (this.hasEliteAffix('seeker_bombard')) {
      this.shootRange = Math.max(this.shootRange, 300);
    }

    if (this.hasEliteAffix('toxic_pool')) {
      this.shootRange = Math.max(this.shootRange, 260);
    }

    if (this.hasEliteAffix('summoner')) {
      this.maxHp = Math.round(this.maxHp * 1.05);
      this.currentHp = this.maxHp;
    }

    if (this.hasEliteAffix('blink_step')) {
      this.moveSpeed = Math.round(this.moveSpeed * 1.04);
    }

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

    if (this.scene?.createManagedBossBullet) {
      return this.scene.createManagedBossBullet(x, y, angle, speed, color, {
        radius,
        damage,
        tags,
        ...options
      });
    }

    // BulletCore 不可用时的最后兜底（正常不应触发）
    console.warn('[TestMinion] createManagedBossBullet unavailable, falling back to raw bulletManager');
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

    this.updateEnrageState(time);
    this.updateEliteVisualState(time);
    this.updateActiveArcaneLaser(time, player);
    this.updateActiveMoltenCore(time, player);
    this.updateActivePoisonPools(time, player);
    this.updateActiveSnareTraps(time, player);

    if (this._eliteAura?.active) {
      const pulse = 0.72 + 0.16 * Math.sin((time || 0) / 220);
      this._eliteAura.setScale(pulse);
      this._eliteAura.alpha = 0.10 + 0.04 * Math.sin((time || 0) / 180);
    }

    this.tryTriggerArcaneLaserAffix(time, player);
    this.tryTriggerFrozenBurstAffix(time, player);
    this.tryTriggerWallerAffix(time, player);
    this.tryTriggerEmberNovaAffix(time, player);
    this.tryTriggerSeekerBombardAffix(time, player);
    this.tryTriggerToxicPoolAffix(time, player);
    this.tryTriggerSummonerAffix(time, player);
    this.tryTriggerSnareTrapAffix(time, player);
    this.tryTriggerBlinkStepAffix(time, player);
  }

  updateEnrageState(time) {
    if (!this.hasEliteAffix('enraged')) return;
    if (this._eliteAffixState.enragedActive) return;

    const hpPct = Phaser.Math.Clamp((this.currentHp || 0) / Math.max(1, this.maxHp || 1), 0, 1);
    if (hpPct > 0.38) return;

    this._eliteAffixState.enragedActive = true;
    this._eliteAffixState.enrageTriggered = true;
    this.moveSpeed = Math.round(this.moveSpeed * 1.1);
    this.shootCdMs = Math.max(260, Math.round(this.shootCdMs * 0.82));
    this.shootBulletSpeed = Math.round(this.shootBulletSpeed * 1.12);
    this.chargeCdMs = Math.max(320, Math.round(this.chargeCdMs * 0.88));
    this.chargeSpeed = Math.round(this.chargeSpeed * 1.06);
    this.scene?.vfxSystem?.playChargeBurst?.(this.x, this.y, {
      color: 0xff7a63,
      count: 18
    });
  }

  updateEliteVisualState(time) {
    if (!this.isElite) return;
    const wave = 0.5 + 0.5 * Math.sin((time || 0) / 180);
    const halfWave = wave < 0.5 ? wave / 0.5 : (wave - 0.5) / 0.5;
    const color = wave < 0.5
      ? lerpColor(0x4aa3ff, 0x9d6bff, halfWave)
      : lerpColor(0x9d6bff, 0xff5b6e, halfWave);

    if (this._eliteDarkAura?.active) {
      this._eliteDarkAura.alpha = 0.18 + (1 - wave) * 0.10;
      this._eliteDarkAura.setScale(1.02 + wave * 0.08);
    }

    if (this._eliteBlueAura?.active) {
      this._eliteBlueAura.alpha = 0.08 + (1 - wave) * 0.10;
      this._eliteBlueAura.setScale(0.95 + (1 - wave) * 0.22);
    }
    if (this._elitePurpleAura?.active) {
      this._elitePurpleAura.alpha = Phaser.Math.Clamp(0.06 + 0.08 * Math.sin((time || 0) / 210 + 1.2), 0.03, 0.16);
      this._elitePurpleAura.setScale(0.98 + 0.16 * Math.sin((time || 0) / 240 + 0.8));
    }
    if (this._eliteRedAura?.active) {
      this._eliteRedAura.alpha = 0.08 + wave * 0.10;
      this._eliteRedAura.setScale(0.92 + wave * 0.26);
    }
    if (this._eliteCrown?.active) {
      this._eliteCrown.y = -Math.round(this.radius * 1.18) - 10 + Math.sin((time || 0) / 220) * 1.5;
      this._eliteCrown.rotation = Math.sin((time || 0) / 320) * 0.04;
      this._eliteCrown.alpha = 0.86 + wave * 0.12;
    }
    if (Array.isArray(this._eliteSmokeMotes)) {
      this._eliteSmokeMotes.forEach((mote, index) => {
        if (!mote?.node?.active) return;
        const t = (time || 0) * 0.001 * mote.speed;
        const orbit = mote.orbitRadius + Math.sin(t * 1.6 + mote.pulse) * 4;
        mote.node.x = Math.cos(mote.angle + t) * orbit;
        mote.node.y = Math.sin(mote.angle + t) * (orbit * 0.58) - mote.drift - Math.sin(t * 2.2 + index) * 5;
        mote.node.alpha = Phaser.Math.Clamp(0.16 + 0.16 * Math.sin(t * 2.8 + mote.pulse), 0.05, 0.32);
        mote.node.setScale(0.86 + 0.26 * Math.sin(t * 2.1 + mote.pulse));
      });
    }
    if (this.sprite?.setTint) this.sprite.setTint(color);
    if (this.body?.setStrokeStyle) this.body.setStrokeStyle(this.isElite ? 4 : 3, color, 1);
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
        telegraphWidth: 20,
        telegraphLength: 125,
        telegraphColor: 0xb18cff,
        durationMs: 520
      });
      const teleB = this.scene?.patternSystem?.emitGroundTelegraph?.({
        x: this.x,
        y: this.y,
        shape: 'line',
        angle: baseAngle + offset + Math.PI,
        telegraphWidth: 20,
        telegraphLength: 125,
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
        const beam = this.scene.add.rectangle(this.x, this.y, 125, 14, 0xc8a5ff, 0.50).setDepth(9);
        beam.setBlendMode(Phaser.BlendModes.ADD);
        const core = this.scene.add.rectangle(this.x, this.y, 125, 6, 0xf4eaff, 0.96).setDepth(10);
        core.setBlendMode(Phaser.BlendModes.ADD);
        visuals.push({ beam, core, angleOffset: i * (Math.PI * 0.5) });
      }

      this._eliteAffixState.activeArcane = {
        startedAt: this.scene?.time?.now ?? now,
        durationMs: 1700,
        length: 125,
        width: 14,
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
        radius: 10,
        damage: Math.max(1, Math.round((this.contactDamage || 8) * 0.85)),
        tags: ['elite_affix_frozen_burst'],
        options: {
          type: 'ring',
          hasTrail: true,
          trailColor: 0xd9fbff,
          hasGlow: true,
          glowRadius: 18,
          ringStrokeWidth: 3,
          ringFillAlpha: 0.24,
          onHitMoveSlowPercent: 0.82,
          onHitMoveSlowDurationMs: 2200
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
        player.applyMoveSpeedSlow?.(0.82, 2200);
        player.takeDamage(Math.max(1, Math.round((this.contactDamage || 8) * 0.95)));
      }
    });
    this.trackOwnedTimer(timer);
  }

  tryTriggerWallerAffix(time, player) {
    if (!this.hasEliteAffix('waller')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastWallAt || 0) < 4400) return;
    if ((this._eliteAffixState.activeWalls || []).length > 0) return;

    const cfg = this.scene?.mapConfig;
    if (!cfg?.cellSize || !cfg?.gridSize) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y };
    const dx = hp.x - this.x;
    const dy = hp.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (dist > 290) return;

    this._eliteAffixState.lastWallAt = now;
    const cellSize = cfg.cellSize;
    const gridSize = cfg.gridSize;
    const centerGx = Math.floor((hp.x - Math.sign(dx || 1) * cellSize * 0.9) / cellSize);
    const centerGy = Math.floor((hp.y - Math.sign(dy || 1) * cellSize * 0.9) / cellSize);
    const vertical = Math.abs(dx) > Math.abs(dy);
    const cells = [];
    const gapOffset = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    for (let i = -1; i <= 1; i += 1) {
      if (i === gapOffset) continue;
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

      const gapCell = vertical
        ? { gx: centerGx, gy: centerGy + gapOffset }
        : { gx: centerGx + gapOffset, gy: centerGy };
      if (gapCell.gx >= 0 && gapCell.gx < gridSize && gapCell.gy >= 0 && gapCell.gy < gridSize) {
        const gapX = gapCell.gx * cellSize + cellSize * 0.5;
        const gapY = gapCell.gy * cellSize + cellSize * 0.5;
        const gapHint = this.scene.add.circle(gapX, gapY, Math.max(10, cellSize * 0.14), 0xfff0c8, 0.14).setDepth(8);
        gapHint.setStrokeStyle(2, 0xfff0c8, 0.55);
        walls.push({ wall: gapHint, idx: null, x: gapX, y: gapY, isHint: true });
      }
      this._eliteAffixState.activeWalls = walls;

      const clearTimer = this.scene?.time?.delayedCall?.(1100, () => {
        this.clearEliteWalls();
      });
      this.trackOwnedTimer(clearTimer);
    });
    this.trackOwnedTimer(timer);
  }

  tryTriggerEmberNovaAffix(time, player) {
    if (!this.hasEliteAffix('ember_nova')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastEmberAt || 0) < 3600) return;
    if (this._eliteAffixState.activeMolten) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y, radius: player.hitboxRadius || 16 };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist > 250) return;

    this._eliteAffixState.lastEmberAt = now;
    const burstRadius = Math.max(74, this.radius + 44);
    const telegraph = this.scene?.patternSystem?.emitGroundTelegraph?.({
      x: this.x,
      y: this.y,
      telegraphRadius: burstRadius,
      telegraphColor: 0xff9a54,
      durationMs: 540
    });
    this.trackOwnedObject(telegraph);

    const timer = this.scene?.time?.delayedCall?.(540, () => {
      if (!this.active || !this.isAlive) return;

      const outer = this.scene?.add?.circle?.(this.x, this.y, burstRadius, 0xff8b47, 0.14)?.setDepth?.(7) || null;
      const inner = this.scene?.add?.circle?.(this.x, this.y, Math.max(24, burstRadius * 0.52), 0xffd18a, 0.20)?.setDepth?.(8) || null;
      outer?.setStrokeStyle?.(3, 0xffc27d, 0.9);
      inner?.setStrokeStyle?.(2, 0xfff0c9, 0.78);

      this._eliteAffixState.activeMolten = {
        radius: burstRadius,
        until: (this.scene?.time?.now ?? now) + 2200,
        outer,
        inner
      };
      this._eliteAffixState.moltenTickAt = (this.scene?.time?.now ?? now);
      this.scene?.vfxSystem?.playBurst?.(this.x, this.y, {
        radius: burstRadius,
        color: 0xffb067,
        durationMs: 200
      });
    });
    this.trackOwnedTimer(timer);
  }

  tryTriggerSeekerBombardAffix(time, player) {
    if (!this.hasEliteAffix('seeker_bombard')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastBombardAt || 0) < 5200) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y, radius: player.hitboxRadius || 16 };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist > 500) return;

    this._eliteAffixState.lastBombardAt = now;
    const lockedPoint = clampWorldPoint(this.scene, hp.x, hp.y, 28);
    const blastRadius = 64;
    const telegraph = this.scene?.patternSystem?.emitGroundTelegraph?.({
      x: lockedPoint.x,
      y: lockedPoint.y,
      telegraphRadius: blastRadius,
      telegraphColor: 0xffcf5f,
      durationMs: 1080
    });
    this.trackOwnedObject(telegraph);

    const timer = this.scene?.time?.delayedCall?.(1080, () => {
      if (!this.active || !this.isAlive) return;

      this.scene?.vfxSystem?.playCastFlash?.(lockedPoint.x, lockedPoint.y, {
        color: 0xffcf5f,
        durationMs: 120,
        radius: blastRadius
      });
      this.scene?.vfxSystem?.playBurst?.(lockedPoint.x, lockedPoint.y, {
        radius: blastRadius + 10,
        color: 0xffdf89,
        durationMs: 200
      });

      this.scene?.patternSystem?.emitRing?.({
        side: 'boss',
        x: lockedPoint.x,
        y: lockedPoint.y,
        count: 6,
        speed: 110,
        color: 0xffcf5f,
        radius: 9,
        damage: Math.max(1, Math.round((this.shootBulletDamage || this.contactDamage || 8) * 0.62)),
        tags: ['elite_affix_seeker_bombard'],
        options: {
          type: 'ring',
          hasTrail: true,
          trailColor: 0xffefae,
          hasGlow: true,
          glowRadius: 18,
          ringStrokeWidth: 3,
          ringFillAlpha: 0.18
        }
      });

      const liveHp = player.getHitboxPosition?.() || hp;
      const hit = Phaser.Math.Distance.Between(lockedPoint.x, lockedPoint.y, liveHp.x, liveHp.y) <= (blastRadius + (liveHp.radius || 16));
      if (!hit) return;

      this.scene?.vfxSystem?.playHit?.(liveHp.x, liveHp.y, {
        color: 0xffdf89,
        radius: 10,
        durationMs: 120
      });
      player.takeDamage(Math.max(1, Math.round((this.shootBulletDamage || this.contactDamage || 8) * 0.95)));
    });
    this.trackOwnedTimer(timer);
  }

  tryTriggerToxicPoolAffix(time, player) {
    if (!this.hasEliteAffix('toxic_pool')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastPoisonAt || 0) < 5200) return;
    if ((this._eliteAffixState.activePoisonPools || []).length >= ((this.scene?.currentStage || 1) >= 8 ? 2 : 1)) return;

    const hp = player.getHitboxPosition?.() || { x: player.x, y: player.y, radius: player.hitboxRadius || 16 };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist > 380) return;

    this._eliteAffixState.lastPoisonAt = now;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, hp.x, hp.y);
    const spawn = clampWorldPoint(this.scene, hp.x - Math.cos(angle) * 26, hp.y - Math.sin(angle) * 26, 32);
    const radius = 50;
    const telegraph = this.scene?.patternSystem?.emitGroundTelegraph?.({
      x: spawn.x,
      y: spawn.y,
      telegraphRadius: radius,
      telegraphColor: 0x65d96d,
      durationMs: 620
    });
    this.trackOwnedObject(telegraph);

    const timer = this.scene?.time?.delayedCall?.(620, () => {
      if (!this.active || !this.isAlive) return;

      const poolOuter = this.scene?.add?.circle?.(spawn.x, spawn.y, radius, 0x4fc95c, 0.12)?.setDepth?.(6) || null;
      const poolInner = this.scene?.add?.circle?.(spawn.x, spawn.y, Math.max(24, radius * 0.56), 0x99f0a0, 0.16)?.setDepth?.(7) || null;
      poolOuter?.setStrokeStyle?.(3, 0x9ef5a2, 0.8);
      poolInner?.setStrokeStyle?.(2, 0xd4ffd6, 0.5);
      this.scene?.vfxSystem?.playBurst?.(spawn.x, spawn.y, {
        radius,
        color: 0x83e88a,
        durationMs: 180
      });
      this._eliteAffixState.activePoisonPools.push({
        x: spawn.x,
        y: spawn.y,
        radius,
        until: (this.scene?.time?.now ?? now) + 2600,
        nextTickAt: (this.scene?.time?.now ?? now),
        outer: poolOuter,
        inner: poolInner
      });
    });
    this.trackOwnedTimer(timer);
  }

  tryTriggerSummonerAffix(time) {
    if (!this.hasEliteAffix('summoner')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    const state = this._eliteAffixState;
    state.summonUnits = Array.isArray(state.summonUnits)
      ? state.summonUnits.filter((unit) => unit && unit.isAlive)
      : [];
    if (now - (state.lastSummonAt || 0) < 7600) return;
    if (state.summonUnits.length >= 3) return;
    if (!Array.isArray(this.scene?.bossManager?.minions)) return;

    state.lastSummonAt = now;
    this.scene?.vfxSystem?.playCharge?.(this.x, this.y, {
      radius: this.radius + 8,
      color: 0x7fb3ff,
      durationMs: 380
    });

    const timer = this.scene?.time?.delayedCall?.(380, () => {
      if (!this.active || !this.isAlive) return;
      const summonCount = (this.scene?.currentStage || 1) >= 8 ? 3 : 2;
      for (let index = 0; index < summonCount; index += 1) {
        const angle = (Phaser.Math.PI2 / summonCount) * index + Math.random() * 0.35;
        const spawn = clampWorldPoint(this.scene, this.x + Math.cos(angle) * 54, this.y + Math.sin(angle) * 54, 24);
        const minion = new this.constructor(this.scene, {
          x: spawn.x,
          y: spawn.y,
          name: '召唤杂兵',
          type: 'chaser',
          hp: Math.max(16, Math.round(this.maxHp * 0.1)),
          size: Math.max(10, this.radius - 7),
          moveSpeed: Math.max(66, Math.round(this.moveSpeed * 0.86)),
          contactDamage: Math.max(1, Math.round((this.contactDamage || 6) * 0.52)),
          color: 0x6f9eff,
          expReward: 0,
          isSummon: true,
          noKillRewards: true,
          aggroOnSeen: false,
          spawnProtectedUntilVisible: false,
          summonOwner: this
        });
        if (!minion) continue;
        this.scene?.vfxSystem?.playBurst?.(spawn.x, spawn.y, {
          radius: 20,
          color: 0x8ab7ff,
          durationMs: 160
        });
        this.scene.bossManager.minions.push(minion);
        state.summonUnits.push(minion);
      }
    });
    this.trackOwnedTimer(timer);
  }

  updateActiveMoltenCore(time, player) {
    const state = this._eliteAffixState.activeMolten;
    if (!state) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now >= (state.until || 0) || !this.active || !this.isAlive) {
      this.clearActiveMoltenCore();
      return;
    }

    const wave = 0.5 + 0.5 * Math.sin(now / 120);
    state.outer?.setPosition?.(this.x, this.y);
    state.inner?.setPosition?.(this.x, this.y);
    if (state.outer) {
      state.outer.alpha = 0.12 + wave * 0.08;
      state.outer.setScale?.(0.96 + wave * 0.08);
    }
    if (state.inner) {
      state.inner.alpha = 0.14 + (1 - wave) * 0.10;
      state.inner.setScale?.(0.92 + (1 - wave) * 0.1);
    }

    const hp = player?.getHitboxPosition?.() || { x: player?.x, y: player?.y, radius: player?.hitboxRadius || 16 };
    if (!hp) return;
    const hit = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y) <= (state.radius + (hp.radius || 16));
    if (!hit) return;
    if (now < (this._eliteAffixState.moltenTickAt || 0)) return;

    this._eliteAffixState.moltenTickAt = now + 460;
    this.scene?.vfxSystem?.playHit?.(hp.x, hp.y, {
      color: 0xffc27d,
      radius: 9,
      durationMs: 110
    });
    player.takeDamage(Math.max(1, Math.round((this.contactDamage || 8) * 0.55)));
  }

  clearActiveMoltenCore() {
    const state = this._eliteAffixState?.activeMolten;
    if (state) {
      try { state.outer?.destroy?.(); } catch (_) { /* ignore */ }
      try { state.inner?.destroy?.(); } catch (_) { /* ignore */ }
    }
    this._eliteAffixState.activeMolten = null;
  }

  updateActivePoisonPools(time, player) {
    const pools = Array.isArray(this._eliteAffixState.activePoisonPools)
      ? this._eliteAffixState.activePoisonPools
      : [];
    if (pools.length <= 0) return;

    const now = time || (this.scene?.time?.now ?? 0);
    const hp = player?.getHitboxPosition?.() || { x: player?.x, y: player?.y, radius: player?.hitboxRadius || 16 };
    const nextPools = [];

    for (let i = 0; i < pools.length; i += 1) {
      const pool = pools[i];
      if (!pool) continue;
      if (now >= (pool.until || 0) || !this.active || !this.isAlive) {
        try { pool.outer?.destroy?.(); } catch (_) { /* ignore */ }
        try { pool.inner?.destroy?.(); } catch (_) { /* ignore */ }
        continue;
      }

      const wave = 0.5 + 0.5 * Math.sin((now / 180) + i);
      if (pool.outer) {
        pool.outer.alpha = 0.1 + wave * 0.08;
        pool.outer.setScale?.(0.98 + wave * 0.06);
      }
      if (pool.inner) {
        pool.inner.alpha = 0.12 + (1 - wave) * 0.08;
      }

      const inside = hp && Phaser.Math.Distance.Between(pool.x, pool.y, hp.x, hp.y) <= (pool.radius + (hp.radius || 16));
      if (inside && now >= (pool.nextTickAt || 0)) {
        pool.nextTickAt = now + 900;
        this.scene?.vfxSystem?.playHit?.(hp.x, hp.y, {
          color: 0x9ef5a2,
          radius: 8,
          durationMs: 100
        });
        player.applyMoveSpeedSlow?.(0.62, 900);
        player.takeDamage(Math.max(1, Math.round((this.shootBulletDamage || this.contactDamage || 8) * 0.28)));
      }

      nextPools.push(pool);
    }

    this._eliteAffixState.activePoisonPools = nextPools;
  }

  clearActivePoisonPools() {
    const pools = Array.isArray(this._eliteAffixState?.activePoisonPools) ? this._eliteAffixState.activePoisonPools : [];
    pools.forEach((pool) => {
      try { pool?.outer?.destroy?.(); } catch (_) { /* ignore */ }
      try { pool?.inner?.destroy?.(); } catch (_) { /* ignore */ }
    });
    this._eliteAffixState.activePoisonPools = [];
  }

  tryTriggerSnareTrapAffix(time, player) {
    if (!this.hasEliteAffix('snare_trap')) return;
    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastTrapAt || 0) < 6800) return;

    const hp = player?.getHitboxPosition?.() || { x: player?.x, y: player?.y, radius: player?.hitboxRadius || 16 };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist > 320) return;

    this._eliteAffixState.lastTrapAt = now;
    const trapCount = (this.scene?.currentStage || 1) >= 7 ? 2 : 1;
    for (let index = 0; index < trapCount; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
      const offset = 70 + index * 28;
      const spawn = clampWorldPoint(this.scene, hp.x + Math.cos(angle) * offset, hp.y + Math.sin(angle) * offset, 28);
      const tele = this.scene?.patternSystem?.emitGroundTelegraph?.({
        x: spawn.x,
        y: spawn.y,
        telegraphRadius: 24,
        telegraphColor: 0xc6a56b,
        durationMs: 520
      });
      this.trackOwnedObject(tele);

      const timer = this.scene?.time?.delayedCall?.(520, () => {
        if (!this.active || !this.isAlive) return;
        const outer = this.scene.add.circle(spawn.x, spawn.y, 24, 0xc6a56b, 0.12).setDepth(7);
        outer.setStrokeStyle(2, 0xf3dca9, 0.82);
        const core = this.scene.add.circle(spawn.x, spawn.y, 9, 0xf7e8bf, 0.20).setDepth(8);
        this._eliteAffixState.activeTraps.push({
          x: spawn.x,
          y: spawn.y,
          radius: 24,
          until: (this.scene?.time?.now ?? now) + 2600,
          triggered: false,
          outer,
          core
        });
      });
      this.trackOwnedTimer(timer);
    }
  }

  updateActiveSnareTraps(time, player) {
    const traps = Array.isArray(this._eliteAffixState.activeTraps) ? this._eliteAffixState.activeTraps : [];
    if (traps.length <= 0) return;

    const now = time || (this.scene?.time?.now ?? 0);
    const hp = player?.getHitboxPosition?.() || { x: player?.x, y: player?.y, radius: player?.hitboxRadius || 16 };
    const nextTraps = [];

    for (let i = 0; i < traps.length; i += 1) {
      const trap = traps[i];
      if (!trap) continue;
      if (now >= (trap.until || 0)) {
        try { trap.outer?.destroy?.(); } catch (_) { /* ignore */ }
        try { trap.core?.destroy?.(); } catch (_) { /* ignore */ }
        continue;
      }

      const wave = 0.5 + 0.5 * Math.sin((now / 160) + i);
      trap.outer.alpha = 0.10 + wave * 0.08;
      trap.core.alpha = 0.14 + (1 - wave) * 0.10;

      const inside = Phaser.Math.Distance.Between(trap.x, trap.y, hp.x, hp.y) <= (trap.radius + (hp.radius || 16));
      if (inside && !trap.triggered) {
        trap.triggered = true;
        trap.until = now + 120;
        player.applyRoot?.(450);
        player.applyMoveSpeedSlow?.(0.68, 900);
        player.takeDamage?.(Math.max(1, Math.round((this.contactDamage || 8) * 0.42)), { attacker: this, source: 'elite_trap' });
        this.scene?.vfxSystem?.playHit?.(hp.x, hp.y, {
          color: 0xf3dca9,
          radius: 10,
          durationMs: 120
        });
      }

      nextTraps.push(trap);
    }

    this._eliteAffixState.activeTraps = nextTraps;
  }

  clearActiveSnareTraps() {
    const traps = Array.isArray(this._eliteAffixState.activeTraps) ? this._eliteAffixState.activeTraps : [];
    traps.forEach((trap) => {
      try { trap?.outer?.destroy?.(); } catch (_) { /* ignore */ }
      try { trap?.core?.destroy?.(); } catch (_) { /* ignore */ }
    });
    this._eliteAffixState.activeTraps = [];
  }

  tryTriggerBlinkStepAffix(time, player) {
    if (!this.hasEliteAffix('blink_step')) return;
    if (this._chargeState !== 'idle') return;

    const now = time || (this.scene?.time?.now ?? 0);
    if (now - (this._eliteAffixState.lastBlinkAt || 0) < 7000) return;

    const hp = player?.getHitboxPosition?.() || { x: player?.x, y: player?.y };
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hp.x, hp.y);
    if (dist < 140 || dist > 280) return;

    this._eliteAffixState.lastBlinkAt = now;
    const baseAngle = Phaser.Math.Angle.Between(hp.x, hp.y, this.x, this.y);
    const offsetAngle = Phaser.Math.FloatBetween(-0.85, 0.85);
    const blinkDist = Phaser.Math.Between(118, 145);
    const targetPos = clampWorldPoint(
      this.scene,
      hp.x + Math.cos(baseAngle + offsetAngle) * blinkDist,
      hp.y + Math.sin(baseAngle + offsetAngle) * blinkDist,
      28
    );

    const sourceFx = this.scene?.patternSystem?.emitGroundTelegraph?.({
      x: this.x,
      y: this.y,
      telegraphRadius: Math.max(18, this.radius + 10),
      telegraphColor: 0x7fd4ff,
      durationMs: 320
    });
    const targetFx = this.scene?.patternSystem?.emitGroundTelegraph?.({
      x: targetPos.x,
      y: targetPos.y,
      telegraphRadius: Math.max(18, this.radius + 10),
      telegraphColor: 0x7fd4ff,
      durationMs: 320
    });
    this.trackOwnedObject(sourceFx);
    this.trackOwnedObject(targetFx);

    const timer = this.scene?.time?.delayedCall?.(320, () => {
      if (!this.active || !this.isAlive) return;
      this.scene?.vfxSystem?.playCastFlash?.(this.x, this.y, {
        color: 0xbbeeff,
        radius: this.radius + 8,
        durationMs: 90
      });
      this.setPosition(targetPos.x, targetPos.y);
      this.scene?.vfxSystem?.playCastFlash?.(this.x, this.y, {
        color: 0xbbeeff,
        radius: this.radius + 10,
        durationMs: 110
      });
      this.scene?.vfxSystem?.playBurst?.(this.x, this.y, {
        radius: this.radius + 14,
        color: 0x7fd4ff,
        durationMs: 140
      });
    });
    this.trackOwnedTimer(timer);
  }

  clearSummonUnits() {
    const units = Array.isArray(this._eliteAffixState?.summonUnits) ? this._eliteAffixState.summonUnits : [];
    units.forEach((unit) => {
      if (!unit || !unit.isAlive) return;
      unit.noKillRewards = true;
      unit.expReward = 0;
      unit.destroy?.();
    });
    this._eliteAffixState.summonUnits = [];
  }

  clearEliteWalls() {
    const walls = Array.isArray(this._eliteAffixState.activeWalls) ? this._eliteAffixState.activeWalls : [];
    walls.forEach((entry) => {
      if (entry?.idx != null) this.scene?.eliteAffixBlockedCells?.delete?.(entry.idx);
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

  applySlow(percent, durationMs = 0) {
    if (!this.isAlive) return;
    const now = this.scene?.time?.now ?? 0;
    const until = now + Math.max(0, Math.round(durationMs || 0));
    this.slowUntil = Math.max(this.slowUntil || 0, until);
    this.slowMoveMult = Math.min(Number(this.slowMoveMult || 1), Phaser.Math.Clamp(1 - Number(percent || 0), 0.2, 1));
    this.syncOverheadUiVisibility?.();
    if ((this.freezeUntil || 0) <= now) {
      if (this.sprite?.setTint) this.sprite.setTint(0xa8ebff);
      if (this.body?.setStrokeStyle) this.body.setStrokeStyle(2, 0x7fdcff, 1);
    }
  }

  getSlowMoveMultiplier(now) {
    const current = Number(now ?? this.scene?.time?.now ?? 0);
    if ((this.slowUntil || 0) > current) {
      return Phaser.Math.Clamp(Number(this.slowMoveMult || 1), 0.2, 1);
    }
    this.slowUntil = 0;
    this.slowMoveMult = 1;
    if ((this.freezeUntil || 0) <= current) {
      if (this.sprite?.clearTint) this.sprite.clearTint();
      if (this.body?.setStrokeStyle) this.body.setStrokeStyle(2, 0xffffff, 0.85);
    }
    return 1;
  }

  clearDeathEffects() {
    this._burstActive = false;
    this.stunUntil = 0;
    this.freezeUntil = 0;
    this.slowUntil = 0;
    this.slowMoveMult = 1;

    if (this._freezeClearTimer) {
      try { this._freezeClearTimer.remove(); } catch (_) { /* ignore */ }
      this._freezeClearTimer = null;
    }

    this.clearOwnedTimers();
    this.clearEliteWalls();
    this.clearChargeTelegraph();
    this.clearActiveArcaneLaser();
    this.clearActiveMoltenCore();
    this.clearActivePoisonPools();
    this.clearActiveSnareTraps();
    this.clearSummonUnits();

    if (Array.isArray(this._ownedObjects)) {
      this._ownedObjects.forEach((obj) => {
        try { obj?.destroy?.(); } catch (_) { /* ignore */ }
      });
      this._ownedObjects = [];
    }

    this.setFrozenVisualVisible(false);
    if (this.sprite?.clearTint) this.sprite.clearTint();
    if (this.body?.setStrokeStyle) this.body.setStrokeStyle(2, 0xffffff, 0.85);
    if (this._eliteAura) this._eliteAura.setVisible(false);
    if (this._eliteDarkAura) this._eliteDarkAura.setVisible(false);
    if (this._eliteBlueAura) this._eliteBlueAura.setVisible(false);
    if (this._elitePurpleAura) this._elitePurpleAura.setVisible(false);
    if (this._eliteRedAura) this._eliteRedAura.setVisible(false);
    if (this._eliteCrown) this._eliteCrown.setVisible(false);
    if (Array.isArray(this._eliteSmokeMotes)) {
      this._eliteSmokeMotes.forEach((mote) => mote?.node?.setVisible?.(false));
    }
    if (this._eliteAffixText) this._eliteAffixText.setVisible(false);
    if (this._debuffUi?.container) this._debuffUi.container.setVisible(false);
    if (this.hpBarBg) this.hpBarBg.setVisible(false);
    if (this.hpBarFill) this.hpBarFill.setVisible(false);
  }

  die(reason = 'unknown', deathCtx = {}) {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.isInvincible = true;
    this.clearDeathEffects();

    try { this.scene?.tweens?.killTweensOf?.(this); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this.body); } catch (_) { /* ignore */ }

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
        isSummon: !!this.isSummon,
        noKillRewards: !!this.noKillRewards,
        expReward: this.expReward,
        isStartRoomTutorialTarget: !!this.isStartRoomTutorialTarget,
        minion: this
      });
    }

    // ── 死亡爆裂粒子（割草向反馈） ──
    this.playDeathBurst(reason, deathCtx);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0,
      duration: 160,
      ease: 'Cubic.In',
      onComplete: () => {
        if (!this.active) return;
        this.destroy();
      }
    });
  }

  playDeathBurst(reason, ctx = {}) {
    if (!this.scene) return;
    const x = this.x;
    const y = this.y;
    const scene = this.scene;
    const isElite = !!this.isElite;
    const baseColor = this.isElite ? (this.getPrimaryEliteAffixColor?.() || 0xff5b6e) : 0xb8e8c0;
    const count = isElite ? Phaser.Math.Between(10, 14) : Phaser.Math.Between(5, 8);

    // 碎片粒子
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(isElite ? 120 : 80, isElite ? 260 : 180);
      const size = isElite ? Phaser.Math.Between(3, 6) : Phaser.Math.Between(2, 4);
      const color = Phaser.Math.RND.pick([baseColor, 0xffffff, 0xffe8a0]);
      const frag = scene.add.circle(x, y, size, color, Phaser.Math.FloatBetween(0.7, 1.0));
      frag.setDepth(20);
      frag.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: frag,
        x: x + Math.cos(angle) * speed * Phaser.Math.FloatBetween(0.3, 0.5),
        y: y + Math.sin(angle) * speed * Phaser.Math.FloatBetween(0.3, 0.5),
        alpha: 0,
        scale: { from: 1, to: Phaser.Math.FloatBetween(0.1, 0.4) },
        duration: Phaser.Math.Between(isElite ? 260 : 180, isElite ? 420 : 320),
        ease: 'Quad.Out',
        onComplete: () => frag.destroy()
      });
    }

    // 扩散冲击环
    const ring = scene.add.circle(x, y, this.radius || 14, 0xffffff, isElite ? 0.30 : 0.18);
    ring.setDepth(19);
    ring.setStrokeStyle(isElite ? 3 : 2, baseColor, 0.9);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scale: isElite ? 3.0 : 2.2,
      alpha: 0,
      duration: isElite ? 280 : 200,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy()
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
    try { this.scene?.tweens?.killTweensOf?.(this._eliteDarkAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteBlueAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._elitePurpleAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteRedAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._eliteCrown); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._freezeAura); } catch (_) { /* ignore */ }
    try { this.scene?.tweens?.killTweensOf?.(this._freezeCrystal); } catch (_) { /* ignore */ }
    if (Array.isArray(this._eliteSmokeMotes)) {
      this._eliteSmokeMotes.forEach((mote) => {
        try { this.scene?.tweens?.killTweensOf?.(mote?.node); } catch (_) { /* ignore */ }
      });
    }

    this.clearDeathEffects();

    try { this.removeAll(true); } catch (_) { /* ignore */ }

    this.sprite = null;
    this.body = null;
    this.hpBarBg = null;
    this.hpBarFill = null;
    this._debuffUi = null;
    this._eliteAffixText = null;
    this._eliteAura = null;
    this._eliteDarkAura = null;
    this._eliteBlueAura = null;
    this._elitePurpleAura = null;
    this._eliteRedAura = null;
    this._eliteCrown = null;
    this._eliteSmokeMotes = [];
    this._freezeAura = null;
    this._freezeCrystal = null;
  }

  destroy(fromScene) {
    if (this._destroying) return;
    this._destroying = true;
    this.cleanupVisuals();
    super.destroy(fromScene);
  }

  moveTowardPoint(goalX, goalY, maxStep, faceAngle = true) {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const step = Math.min(dist, Math.max(0, maxStep || 0));
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    if (faceAngle) this.updateFacingVisual(Math.atan2(dy, dx));
    return dist;
  }

  buildInterceptGoal(targetHitbox, target) {
    const fallbackDx = targetHitbox.x - this.x;
    const fallbackDy = targetHitbox.y - this.y;
    const motion = getTargetMotion(target, fallbackDx, fallbackDy);
    const directDist = Math.sqrt(fallbackDx * fallbackDx + fallbackDy * fallbackDy) || 0.0001;
    const leadSec = Phaser.Math.Clamp((this.interceptLeadMs + directDist * 0.45) / 1000, 0.12, 0.52);
    let goalX = targetHitbox.x + motion.vx * leadSec;
    let goalY = targetHitbox.y + motion.vy * leadSec;

    const flankWindow = Phaser.Math.Clamp((directDist - 48) / 180, 0, 1);
    if (this.packRole === 'flanker' || this.packRole === 'orbiter') {
      const perpendicular = perpendicularVector(motion.dirX, motion.dirY, this.flankSign);
      const offset = this.flankOffset * flankWindow;
      goalX += perpendicular.x * offset;
      goalY += perpendicular.y * offset;
    }

    if (this.packRole === 'backliner') {
      goalX -= motion.dirX * 22;
      goalY -= motion.dirY * 22;
    }

    return clampWorldPoint(this.scene, goalX, goalY, 20);
  }

  updateOrbiterMovement(dt, speedMult, target, targetHitbox) {
    const dx = targetHitbox.x - this.x;
    const dy = targetHitbox.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const preferredRange = Math.max(72, (this.shootRange || 190) - 26);
    const radialX = dx / dist;
    const radialY = dy / dist;
    const motion = getTargetMotion(target, dx, dy);
    const perpendicular = perpendicularVector(motion.dirX, motion.dirY, this.flankSign);

    const anchorX = targetHitbox.x - radialX * preferredRange;
    const anchorY = targetHitbox.y - radialY * preferredRange;
    const orbitX = anchorX + perpendicular.x * this.orbitRange;
    const orbitY = anchorY + perpendicular.y * this.orbitRange;

    const moveSpeed = this.moveSpeed * speedMult;
    if (dist > preferredRange + 24) {
      const intercept = this.buildInterceptGoal(targetHitbox, target);
      this.moveTowardPoint(intercept.x, intercept.y, moveSpeed * dt);
      return;
    }
    if (dist < preferredRange - 24) {
      this.moveTowardPoint(anchorX - radialX * 26, anchorY - radialY * 26, moveSpeed * dt);
      return;
    }

    this.moveTowardPoint(orbitX, orbitY, moveSpeed * dt);
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
      } else {
        this._spawnProtectionCleared = true;
        this.spawnProtectedUntilVisible = false;
        this.isInvincible = false;
        this.aggroActive = true;
        this._aggroStartAt = (this.scene?.time?.now ?? time ?? 0);
      }
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

    const target = this.scene?.getPrimaryTarget?.(this) || player;
    const targetHitbox = getTargetHitbox(target) || getTargetHitbox(player);

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
      speedMult = 0.55 + 0.45 * pct;
    }
    speedMult *= this.getSlowMoveMultiplier(now);

    const hiddenSpawnProtected = this.spawnProtectedUntilVisible && !this._spawnProtectionCleared;
    if (hiddenSpawnProtected && target && target.active !== false && target.isAlive !== false && targetHitbox) {
      const dx = targetHitbox.x - this.x;
      const dy = targetHitbox.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const chaseSpeed = this.moveSpeed * Math.max(0.95, speedMult * 1.08);
      const step = Math.min(dist, chaseSpeed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      return;
    }

    if (this.forceChasePlayerAfterBoss && target && target.active !== false && target.isAlive !== false && targetHitbox) {
      const dx = targetHitbox.x - this.x;
      const dy = targetHitbox.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const chaseSpeed = this.moveSpeed * Math.max(1.15, speedMult * 1.2);
      const step = Math.min(dist, chaseSpeed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;

      this.tryContact(time, target);

      const pr = targetHitbox.radius || 16;
      const ddx = this.x - targetHitbox.x;
      const ddy = this.y - targetHitbox.y;
      const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
      const minDist = (this.radius || 16) + pr + 4;
      if (d < minDist) {
        const nx = ddx / d;
        const ny = ddy / d;
        this.x = targetHitbox.x + nx * minDist;
        this.y = targetHitbox.y + ny * minDist;
      }
      return;
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
      if (target && target.active !== false && target.isAlive !== false && targetHitbox) {
        const pr = targetHitbox.radius || 16;
        const ddx = this.x - targetHitbox.x;
        const ddy = this.y - targetHitbox.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
        const minDist = (this.radius || 16) + pr + 4;
        if (d < minDist) {
          const nx = ddx / d;
          const ny = ddy / d;
          this.x = targetHitbox.x + nx * minDist;
          this.y = targetHitbox.y + ny * minDist;
        }
      }

      this.tryShoot(time, target);
      return;
    }

    if (this.minionType === 'ring_shooter' && target && target.active !== false && target.isAlive !== false && targetHitbox) {
      this.updateOrbiterMovement(dt, speedMult, target, targetHitbox);

      this.tryShoot(time, target);
      return;
    }

    if (this.minionType === 'charger' && target && target.active !== false && target.isAlive !== false) {
      this.updateCharger(time, delta, target, speedMult);
      return;
    }

    // shooter（不跟随Boss）：缓慢靠近到理想距离并射击
    if (this.minionType === 'shooter' && target && target.active !== false && target.isAlive !== false && targetHitbox) {
      this.updateOrbiterMovement(dt, speedMult * 0.94, target, targetHitbox);

      this.tryShoot(time, target);
      return;
    }

    // chaser：追玩家
    if (target && target.active !== false && target.isAlive !== false && targetHitbox) {
      const goal = this.buildInterceptGoal(targetHitbox, target);
      this.moveTowardPoint(goal.x, goal.y, (this.moveSpeed * speedMult) * dt);

      this.tryContact(time, target);

      // 玩家-小怪分离：先结算接触伤害，再把小怪推出一点点
      const pr = targetHitbox.radius || 16;
      const ddx = this.x - targetHitbox.x;
      const ddy = this.y - targetHitbox.y;
      const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
      const minDist = (this.radius || 16) + pr + 4;
      if (d < minDist) {
        const nx = ddx / d;
        const ny = ddy / d;
        this.x = targetHitbox.x + nx * minDist;
        this.y = targetHitbox.y + ny * minDist;
      }
    }
  }

  tryContact(time, player) {
    if (!player || player.isAlive === false || player.active === false) return;
    if (this.contactDamage <= 0) return;
    if (this.spawnProtectedUntilVisible && !this._spawnProtectionCleared) return;

    const now = time || (this.scene.time?.now ?? 0);
    if (this._lastContactAt && now - this._lastContactAt < this.contactCdMs) return;

    const hitbox = getTargetHitbox(player);
    if (!hitbox) return;
    const pr = hitbox.radius || 16;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hitbox.x, hitbox.y);
    // 与“玩家-小怪分离”的留缝一致：不重叠但仍算接触伤害
    const separationPad = 4;
    if (dist <= (this.radius + pr + separationPad)) {
      this._lastContactAt = now;
      player.takeDamage?.(this.contactDamage, { attacker: this, source: 'minion_contact' });
    }
  }

  tryShoot(time, player) {
    if (!player || player.isAlive === false || player.active === false) return;
    if (this.spawnProtectedUntilVisible && !this._spawnProtectionCleared) return;
    const hitbox = getTargetHitbox(player);
    if (!hitbox) return;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, hitbox.x, hitbox.y);
    if (dist > Math.max(60, this.shootRange || 190)) return;
    const now = time || (this.scene.time?.now ?? 0);
    if (this._lastShotAt && now - this._lastShotAt < this.shootCdMs) return;
    this._lastShotAt = now;

    if (this.minionType === 'ring_shooter') {
      this.startRingBurst(player, now);
      return;
    }

    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, hitbox.x, hitbox.y);
    const count = Math.max(1, this.shootBulletCount || 1);
    const spread = Number.isFinite(this.shootBulletSpread) ? this.shootBulletSpread : 0.0;
    const speed = Math.max(60, this.shootBulletSpeed || 180);
    const damage = Math.max(1, this.shootBulletDamage || 10);
    const enragedShot = this._eliteAffixState?.enragedActive === true;

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1));
      const a = baseAngle + (t - 0.5) * spread;
      this.spawnEnemyBullet({
        x: this.x,
        y: this.y,
        angle: a,
        speed,
        color: 0xaa66ff,
        radius: 9,
        damage,
        tags: enragedShot ? ['minion_shot', 'elite_affix_enraged'] : ['minion_shot'],
        options: {
          hasTrail: true,
          type: i % 2 === 0 ? 'diamond' : 'circle',
          hasGlow: true,
          glowRadius: 18,
          trailColor: enragedShot ? 0xffb0a6 : 0xe4daff,
          homing: enragedShot,
          homingTurn: enragedShot ? 0.02 : undefined
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
    const targetHp = getTargetHitbox(player);
    if (!targetHp) return;
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
      radius: 15,
      damage,
      tags: ['minion_ring_shot'],
      options: {
        type: 'ring',
        hasTrail: true,
        trailColor: 0xffd0f0,
        hasGlow: true,
        glowRadius: 22,
        ringStrokeWidth: 4,
        ringFillAlpha: 0.30
      }
    });

    this.scene?.vfxSystem?.playCastFlash?.(this.x, this.y, {
      color,
      radius: this.radius + 5,
      durationMs: 90
    });
  }

  startChargeWindup(time, player) {
    if (!player || player.isAlive === false || player.active === false) return;
    if (this._chargeState !== 'idle') return;

    const hp = getTargetHitbox(player);
    if (!hp) return;
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
      width: 16,
      length: this._chargeTelegraphLength,
      color: 0xffa95c,
      durationMs: this.chargeWindupMs + 80
    }) || null;
    this._chargeTelegraphMarker = this.scene?.add?.circle?.(this._chargeTarget.x, this._chargeTarget.y, this.radius + 8, 0xffd7a6, 0.12)?.setDepth?.(8) || null;
    this._chargeTelegraphMarker?.setStrokeStyle?.(3, 0xffd7a6, 0.9);
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
    const hp = getTargetHitbox(player);
    if (!hp) return;

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
          player.takeDamage?.(this.chargeDamage, { attacker: this, source: 'minion_charge' });
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

    const marker = this._chargeTelegraphMarker;
    if (marker?.active) {
      marker.setPosition(this._chargeTarget.x, this._chargeTarget.y);
      marker.alpha = 0.10 + 0.12 * Math.sin((this.scene?.time?.now ?? 0) / 90);
      marker.setScale(0.92 + 0.12 * Math.sin((this.scene?.time?.now ?? 0) / 130));
    }
  }

  clearChargeTelegraph() {
    if (this._chargeTelegraph) {
      try { this._chargeTelegraph.destroy(); } catch (_) { /* ignore */ }
    }
    if (this._chargeTelegraphMarker) {
      try { this._chargeTelegraphMarker.destroy(); } catch (_) { /* ignore */ }
    }
    this._chargeTelegraph = null;
    this._chargeTelegraphMarker = null;
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
