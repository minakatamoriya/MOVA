import Phaser from 'phaser';
import { calculateResolvedDamage } from '../../combat/damageModel';
import { clearPendingMeleeWindup, hasPendingMeleeWindup, startMeleeWindup } from './meleeWindup';
import { clampPointToPlayerVision, collectCombatEnemies, isPointInPlayerVision } from './playerVision';

const REGISTRY_ID = 'undead';

const SUMMON_TYPES = /** @type {const} */ ({
  guard: 'guard',
  mage: 'mage'
});

const LEVEL_TO_CAP = {
  0: 0,
  1: 2,
  2: 4,
  3: 6
};

const MELEE_TARGET_VISION_PADDING = 72;
const MELEE_RETURN_VISION_PADDING = 24;
const MELEE_MOVE_VISION_INSET = 18;

export default class UndeadSummonManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.summonRegistry = scene?.summonRegistry || null;
    this.infernals = [];
    this.infernalRespawnAt = 0;
    this.units = new Map([
      [SUMMON_TYPES.guard, []],
      [SUMMON_TYPES.mage, []]
    ]);
    this.respawnAt = new Map([
      [SUMMON_TYPES.guard, 0],
      [SUMMON_TYPES.mage, 0]
    ]);
    this.acquireRangeBase = 260;
    this.respawnDelayMs = 5000;
  }

  hasInfernalUnlocked() {
    return !!(this.player?.warlockDepthInfernalUnlocked);
  }

  setPlayer(player) {
    this.player = player;
  }

  getOwnedLevel(type) {
    if (!this.player) return 0;
    if (type === SUMMON_TYPES.guard) return Math.max(0, this.player.curseSkeletonGuardLevel || 0);
    if (type === SUMMON_TYPES.mage) return Math.max(0, this.player.curseSkeletonMageLevel || 0);
    return 0;
  }

  getDesiredCount(type) {
    const lvl = Math.min(3, this.getOwnedLevel(type));
    const base = LEVEL_TO_CAP[lvl] || 0;
    if (!this.player) return base;

    const starter = type === SUMMON_TYPES.guard
      ? Math.max(0, Math.round(this.player.summonStarterGuardCount || 0))
      : Math.max(0, Math.round(this.player.summonStarterMageCount || 0));
    return base + starter;
  }

  getSummonHealthMultiplier() {
    const necroticBonus = [0, 0.12, 0.24, 0.36][Math.max(0, Math.min(3, Math.round(this.player?.curseNecroticVitalityLevel || 0)))] || 0;
    return Math.max(0.1, (Number(this.player?.summonHealthMultiplier) || 1) * (1 + necroticBonus));
  }

  getSummonDamageMultiplier() {
    return Math.max(0.1, Number(this.player?.summonDamageMultiplier) || 1);
  }

  getGuardBonusHealthMultiplier() {
    return [1, 1.2, 1.4, 1.6][Math.max(0, Math.min(3, Math.round(this.player?.curseGuardBulwarkLevel || 0)))] || 1;
  }

  getGuardDamageTakenMultiplier() {
    return [1, 0.9, 0.85, 0.8][Math.max(0, Math.min(3, Math.round(this.player?.curseGuardBulwarkLevel || 0)))] || 1;
  }

  getMageBonusDamageMultiplier() {
    return [1, 1.15, 1.3, 1.45][Math.max(0, Math.min(3, Math.round(this.player?.curseMageEmpowerLevel || 0)))] || 1;
  }

  refreshSummonStats() {
    for (const list of this.units.values()) {
      for (let i = 0; i < list.length; i++) {
        const unit = list[i];
        if (!unit?.active) continue;

        let nextMaxHp = unit.maxHp || 1;
        if (unit.summonType === SUMMON_TYPES.guard) {
          nextMaxHp = Math.max(24, Math.round((this.player?.maxHp || 100) * 0.32 * this.getSummonHealthMultiplier() * this.getGuardBonusHealthMultiplier()));
          unit.damageTakenMult = this.getGuardDamageTakenMultiplier();
        } else if (unit.summonType === SUMMON_TYPES.mage) {
          nextMaxHp = Math.max(12, Math.round((this.player?.maxHp || 100) * 0.18 * this.getSummonHealthMultiplier()));
          unit.damageMult = 0.42 * this.getMageBonusDamageMultiplier();
          unit.attackCooldownMs = Math.round(1450 * ((this.player?.curseMageEmpowerLevel || 0) >= 3 ? 0.85 : 1));
        }

        const missing = Math.max(0, (unit.maxHp || nextMaxHp) - (unit.currentHp || 0));
        unit.maxHp = nextMaxHp;
        unit.currentHp = Math.max(1, Math.min(nextMaxHp, nextMaxHp - missing));
      }
    }

    const infernals = this.infernals || [];
    for (let i = 0; i < infernals.length; i++) {
      const unit = infernals[i];
      if (!unit?.active) continue;
      const level = Phaser.Math.Clamp(Math.round(Number(unit.infernalLevel) || 3), 1, 3);
      const hpScale = Math.max(0.1, Number(unit.infernalHpScale) || ([0, 1.8, 2.1, 2.5][level] || 2));
      const netherlordLevel = Phaser.Math.Clamp(Math.round(this.player?.warlockNetherlord || 0), 0, 3);
      const nextMaxHp = Math.max(260, Math.round(((this.player?.maxHp || 100) * hpScale + (this.player?.bulletDamage || 1) * (24 + level * 16)) * this.getSummonHealthMultiplier() * ([1, 1.15, 1.30, 1.48][netherlordLevel] || 1)));
      const missing = Math.max(0, (unit.maxHp || nextMaxHp) - (unit.currentHp || 0));
      unit.maxHp = nextMaxHp;
      unit.currentHp = Math.max(1, Math.min(nextMaxHp, nextMaxHp - missing));
      unit.damageMult = Math.max(0.1, (Number(unit.baseDamageMult) || 1.8) * ([1, 1.18, 1.38, 1.62][netherlordLevel] || 1));
      unit.auraDamageMult = Math.max(0.1, (Number(unit.baseAuraDamageMult) || 0.42) * ([1, 1.16, 1.28, 1.42][netherlordLevel] || 1));
      unit.auraRadius = Math.round((Number(unit.baseAuraRadius) || 92) + netherlordLevel * 12);
      unit.setScale?.((Number(unit.baseScale) || 1.1) + netherlordLevel * 0.08);
    }
  }

  refreshFromPlayer() {
    for (const type of Object.values(SUMMON_TYPES)) {
      const desired = this.getDesiredCount(type);
      const list = this.units.get(type) || [];
      if (desired <= 0) {
        list.forEach((unit) => this.destroyUnit(unit));
        this.units.set(type, []);
        this.respawnAt.set(type, 0);
        continue;
      }

      while (list.length < desired) {
        const unit = this.spawnUnit(type, list.length, desired);
        if (!unit) break;
        list.push(unit);
        this.summonRegistry?.register(REGISTRY_ID, unit);
      }

      while (list.length > desired) {
        const extra = list.pop();
        this.destroyUnit(extra);
      }

      this.units.set(type, list);
      this.respawnAt.set(type, 0);
    }
  }

  getAcquireRange() {
    if (!this.player) return this.acquireRangeBase;
    return Math.max(
      this.acquireRangeBase,
      Math.round(Math.max(
        this.player.archerArrowRange || 0,
        this.player.mageMissileRange || 0,
        this.player.druidStarfallRange || 0,
        (this.player.warlockPoisonNovaRadius || this.player.warlockPoisonNovaRadiusBase || 0) * 2.6,
        220
      ))
    );
  }

  getAllEnemies() {
    return collectCombatEnemies(this.scene);
  }

  getNearestEnemy(originX, originY, acquireRange) {
    const player = this.player;
    if (!player) return null;

    const acquire2 = acquireRange * acquireRange;
    const enemies = this.getAllEnemies();
    let best = null;
    let bestD2 = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy || !enemy.isAlive) continue;

      const pdx = enemy.x - player.x;
      const pdy = enemy.y - player.y;
      const playerD2 = pdx * pdx + pdy * pdy;
      if (playerD2 > acquire2) continue;

      const dx = enemy.x - originX;
      const dy = enemy.y - originY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        best = enemy;
        bestD2 = d2;
      }
    }

    return best;
  }

  getNearestVisibleEnemy(originX, originY) {
    if (!this.player) return null;

    const enemies = this.getAllEnemies();
    let best = null;
    let bestD2 = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy || !enemy.isAlive) continue;
      if (!isPointInPlayerVision(this.scene, this.player, enemy.x, enemy.y, MELEE_TARGET_VISION_PADDING)) continue;

      const dx = enemy.x - originX;
      const dy = enemy.y - originY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        best = enemy;
        bestD2 = d2;
      }
    }

    return best;
  }

  getHittableSummons() {
    const result = [];
    for (const list of this.units.values()) {
      for (let i = 0; i < list.length; i++) {
        const unit = list[i];
        if (!unit || !unit.active) continue;
        if ((unit.currentHp || 0) <= 0) continue;
        if ((unit.hitRadius || 0) <= 0) continue;
        result.push(unit);
      }
    }

    const infernals = this.infernals || [];
    for (let i = 0; i < infernals.length; i++) {
      const unit = infernals[i];
      if (!unit || !unit.active) continue;
      if ((unit.currentHp || 0) <= 0) continue;
      if (unit.canDrawFire === false) continue;
      if ((unit.hitRadius || 0) <= 0) continue;
      result.push(unit);
    }

    return result;
  }

  onSummonDamaged(unit) {
    if (!unit || !unit.active) return;
    this.scene.tweens.add({
      targets: unit,
      alpha: { from: 1, to: 0.55 },
      duration: 80,
      yoyo: true,
      repeat: 1
    });
  }

  onSummonKilled(unit) {
    if (!unit) return;
    if (unit.summonType === 'infernal') {
      const now = this.scene.time?.now ?? 0;
      if (this.hasInfernalUnlocked()) {
        this.infernalRespawnAt = Math.max(this.infernalRespawnAt || 0, now + 30000);
        this.scene?.showDamageNumber?.(this.player?.x || unit.x, (this.player?.y || unit.y) - 86, '地狱火重生 30秒', { color: '#a3e635', fontSize: 18, whisper: true });
      }
      this.infernals = (this.infernals || []).filter((entry) => entry !== unit && entry?.active);
      this.destroyUnit(unit);
      return;
    }

    const type = unit.summonType;
    const list = this.units.get(type) || [];
    const next = list.filter((entry) => entry !== unit && entry?.active);
    this.units.set(type, next);
    this.destroyUnit(unit);
    this.player?.onUndeadSummonDeath?.();

    if (this.getDesiredCount(type) > next.length) {
      const now = this.scene.time?.now ?? 0;
      const current = this.respawnAt.get(type) || 0;
      this.respawnAt.set(type, current > now ? current : now + this.respawnDelayMs);
    }
  }

  spawnUnit(type, index = 0, total = 1) {
    if (!this.player) return null;
    if (type === SUMMON_TYPES.guard) return this.createGuard(index, total);
    if (type === SUMMON_TYPES.mage) return this.createMage(index, total);
    return null;
  }

  createGuard(index, total) {
    const angle = total > 0 ? (Math.PI * 2 * index) / Math.max(1, total) : 0;
    const x = this.player.x + Math.cos(angle) * 34;
    const y = this.player.y + 24 + Math.sin(angle) * 16;

    const shield = this.scene.add.circle(-7, 0, 8, 0xd8d8d8, 0.95);
    shield.setStrokeStyle(2, 0x7d7d7d, 1);
    const body = this.scene.add.rectangle(7, 1, 16, 22, 0xf2f2f2, 0.95);
    body.setStrokeStyle(2, 0x5a5a5a, 1);
    const skull = this.scene.add.circle(7, -15, 8, 0xf7f7f7, 1);
    skull.setStrokeStyle(2, 0x5a5a5a, 1);
    const eyes = this.scene.add.text(7, -15, '::', { fontSize: '10px', color: '#6bd6ff' }).setOrigin(0.5);

    const unit = this.scene.add.container(x, y, [shield, body, skull, eyes]);
    unit.setDepth(6);
    unit.summonType = SUMMON_TYPES.guard;
    unit.isUndeadSummon = true;
    unit.hitRadius = 13;
    unit.maxHp = Math.max(24, Math.round((this.player.maxHp || 100) * 0.32 * this.getSummonHealthMultiplier() * this.getGuardBonusHealthMultiplier()));
    unit.currentHp = unit.maxHp;
    unit.moveSpeed = 210;
    unit.attackRange = 20;
    unit.attackCooldownMs = 950;
    unit.damageMult = 0.52;
    unit.damageTakenMult = this.getGuardDamageTakenMultiplier();
    unit.attackWindupMs = 150;
    unit.attackArcRadius = 28;
    unit.attackArcThickness = 10;
    unit.attackArcColor = 0xe8e8e8;
    unit.anchorAngle = angle;
    unit.anchorRadius = 42;
    unit.lastAttackAt = 0;
    return unit;
  }

  createMage(index, total) {
    const angle = total > 0 ? (Math.PI * 2 * index) / Math.max(1, total) : 0;
    const x = this.player.x + Math.cos(angle) * 52;
    const y = this.player.y - 42 + Math.sin(angle) * 18;

    const robe = this.scene.add.triangle(0, 8, -10, 10, 10, 10, 0, -14, 0x7050a8, 0.95);
    robe.setStrokeStyle(2, 0x39235a, 1);
    const skull = this.scene.add.circle(0, -12, 7, 0xf8f8f8, 1);
    skull.setStrokeStyle(2, 0x5a5a5a, 1);
    const eyes = this.scene.add.text(0, -12, '..', { fontSize: '10px', color: '#88ffcc' }).setOrigin(0.5);
    const staff = this.scene.add.rectangle(9, -2, 3, 22, 0x7d5a34, 1);
    const orb = this.scene.add.circle(9, -15, 4, 0x7cf6ff, 0.95);

    const unit = this.scene.add.container(x, y, [robe, skull, eyes, staff, orb]);
    unit.setDepth(7);
    unit.summonType = SUMMON_TYPES.mage;
    unit.isUndeadSummon = true;
    unit.hitRadius = 11;
    unit.maxHp = Math.max(12, Math.round((this.player.maxHp || 100) * 0.18 * this.getSummonHealthMultiplier()));
    unit.currentHp = unit.maxHp;
    unit.followLerp = 0.12;
    unit.attackCooldownMs = Math.round(1450 * ((this.player?.curseMageEmpowerLevel || 0) >= 3 ? 0.85 : 1));
    unit.projectileSpeed = 320;
    unit.damageMult = 0.42 * this.getMageBonusDamageMultiplier();
    unit.orbitPhase = angle;
    unit.orbitRadius = 58;
    unit.lastAttackAt = 0;
    return unit;
  }

  summonInfernal(options = {}) {
    if (!this.player) return null;

    const level = Phaser.Math.Clamp(Math.round(Number(options.level) || 3), 1, 3);
    const durationMs = Math.max(0, Math.round(Number(options.durationMs) || 0));
    const healPerHit = Math.max(0, Math.round(Number(options.healPerHit) || 0));
    const hpScale = Math.max(0.1, Number(options.hpScale) || ([0, 1.8, 2.1, 2.5][level] || 2));
    const damageMult = Math.max(0.1, Number(options.damageMult) || ([0, 1.75, 2.05, 2.4][level] || 2));
    const persistent = options.persistent !== false;

    (this.infernals || []).forEach((unit) => this.destroyUnit(unit));
    this.infernals = [];

    const unit = this.createInfernal({ level, durationMs, healPerHit, hpScale, damageMult, persistent });
    if (!unit) return null;

    this.infernals.push(unit);
    this.infernalRespawnAt = 0;
    this.summonRegistry?.register(REGISTRY_ID, unit);
    return unit;
  }

  createInfernal(config = {}) {
    const level = Phaser.Math.Clamp(Math.round(Number(config.level) || 3), 1, 3);
    const durationMs = Math.max(0, Math.round(Number(config.durationMs) || 0));
    const healPerHit = Math.max(0, Math.round(Number(config.healPerHit) || 0));
    const hpScale = Math.max(0.1, Number(config.hpScale) || 1);
    const damageMult = Math.max(0.1, Number(config.damageMult) || 1);
    const persistent = config.persistent !== false;
    const netherlordLevel = Phaser.Math.Clamp(Math.round(this.player?.warlockNetherlord || 0), 0, 3);
    const x = this.player.x + 10;
    const y = this.player.y + 30;

    const auraOuter = this.scene.add.circle(0, 8, 44, 0x65a30d, 0.10);
    auraOuter.setStrokeStyle(3, 0xbef264, 0.34);
    const auraInner = this.scene.add.circle(0, 10, 26, 0x84cc16, 0.16);
    const shadow = this.scene.add.ellipse(0, 18, 46, 20, 0x11210f, 0.34);
    const flameBase = this.scene.add.ellipse(0, 10, 34, 18, 0xd9f99d, 0.16);
    const legs = this.scene.add.rectangle(0, 18, 20, 16, 0x245e27, 0.95);
    const body = this.scene.add.circle(0, 0, 22, 0x3bb54a, 0.97);
    body.setStrokeStyle(3, 0x173f1a, 1);
    const shoulders = this.scene.add.rectangle(0, -4, 38, 18, 0x46c35b, 0.95);
    shoulders.setStrokeStyle(2, 0x173f1a, 1);
    const head = this.scene.add.circle(0, -24, 14, 0x64d76e, 0.98);
    head.setStrokeStyle(2, 0x173f1a, 1);
    const jaw = this.scene.add.rectangle(0, -12, 18, 8, 0x9cff9c, 0.88);
    const hornLeft = this.scene.add.triangle(-10, -34, 0, 12, -8, -10, 10, 8, 0xb8ff9b, 0.95);
    const hornRight = this.scene.add.triangle(10, -34, 0, 12, -10, 8, 8, -10, 0xb8ff9b, 0.95);
    const eyeLeft = this.scene.add.circle(-5, -25, 2.5, 0xe8ffb8, 1);
    const eyeRight = this.scene.add.circle(5, -25, 2.5, 0xe8ffb8, 1);
    const armLeft = this.scene.add.rectangle(-22, 2, 12, 24, 0x2f8f3a, 0.95);
    const armRight = this.scene.add.rectangle(22, 2, 12, 24, 0x2f8f3a, 0.95);
    const core = this.scene.add.circle(0, -2, 9, 0xecfccb, 0.9);
    core.setStrokeStyle(2, 0xd9f99d, 0.95);
    const emberLeft = this.scene.add.circle(-18, -10, 4, 0xd9f99d, 0.72);
    const emberRight = this.scene.add.circle(18, -14, 3.5, 0xbef264, 0.68);
    const emberTop = this.scene.add.circle(0, -40, 5, 0xecfccb, 0.62);

    const unit = this.scene.add.container(x, y, [auraOuter, auraInner, shadow, flameBase, legs, armLeft, armRight, body, core, shoulders, head, jaw, hornLeft, hornRight, eyeLeft, eyeRight, emberLeft, emberRight, emberTop]);
    unit.setDepth(8);
    unit.summonType = 'infernal';
    unit.isUndeadSummon = true;
    unit.isInfernal = true;
    unit.canDrawFire = false;
    unit.infernalLevel = level;
    unit.hitRadius = 22;
    unit.maxHp = Math.max(260, Math.round(((this.player.maxHp || 100) * hpScale + (this.player.bulletDamage || 1) * (24 + level * 16)) * this.getSummonHealthMultiplier() * ([1, 1.15, 1.30, 1.48][netherlordLevel] || 1)));
    unit.currentHp = unit.maxHp;
    unit.moveSpeed = 250 + netherlordLevel * 18;
    unit.attackRange = 28;
    unit.attackCooldownMs = Math.max(420, 760 - netherlordLevel * 70);
    unit.baseDamageMult = damageMult;
    unit.damageMult = damageMult * ([1, 1.18, 1.38, 1.62][netherlordLevel] || 1);
    unit.damageTakenMult = 0.55;
    unit.infernalHpScale = hpScale;
    unit.attackWindupMs = 190;
    unit.attackArcRadius = 38;
    unit.attackArcThickness = 14;
    unit.attackArcColor = 0x8fff7f;
    unit.anchorAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    unit.anchorRadius = 56;
    unit.lastAttackAt = 0;
    unit.healOnHit = healPerHit;
    unit.persistent = persistent;
    unit.expireAt = persistent ? 0 : ((this.scene.time?.now ?? 0) + Math.max(1000, durationMs));
    unit.netherlordLevel = netherlordLevel;
    unit.baseAuraRadius = 92;
    unit.auraRadius = unit.baseAuraRadius + netherlordLevel * 12;
    unit.baseAuraDamageMult = 0.42;
    unit.auraDamageMult = unit.baseAuraDamageMult * ([1, 1.16, 1.28, 1.42][netherlordLevel] || 1);
    unit.auraTickMs = 450;
    unit.lastAuraTickAt = 0;
    unit.baseScale = 1.1;
    unit.setScale?.(unit.baseScale + netherlordLevel * 0.08);
    unit.visuals = {
      auraOuter,
      auraInner,
      flameBase,
      core,
      emberLeft,
      emberRight,
      emberTop,
      eyes: [eyeLeft, eyeRight],
      body,
      head,
      shoulders
    };

    const pulse = this.scene.add.circle(x, y, 30, 0x7dff7a, 0.22).setDepth(7);
    pulse.setStrokeStyle(4, 0xd9ff9a, 0.95);
    this.scene.tweens.add({
      targets: pulse,
      scale: 1.9,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => pulse.destroy()
    });

    return unit;
  }

  resetPositionsAroundPlayer() {
    if (!this.player) return;

    const guardList = this.units.get(SUMMON_TYPES.guard) || [];
    for (let i = 0; i < guardList.length; i++) {
      const unit = guardList[i];
      if (!unit?.active) continue;
      const angle = guardList.length > 0 ? (Math.PI * 2 * i) / Math.max(1, guardList.length) : 0;
      unit.anchorAngle = angle;
      unit.setPosition(
        this.player.x + Math.cos(angle) * 34,
        this.player.y + 24 + Math.sin(angle) * 16
      );
      unit.rotation = 0;
    }

    const mageList = this.units.get(SUMMON_TYPES.mage) || [];
    for (let i = 0; i < mageList.length; i++) {
      const unit = mageList[i];
      if (!unit?.active) continue;
      const angle = mageList.length > 0 ? (Math.PI * 2 * i) / Math.max(1, mageList.length) : 0;
      unit.orbitPhase = angle;
      unit.setPosition(
        this.player.x + Math.cos(angle) * 52,
        this.player.y - 42 + Math.sin(angle) * 18
      );
      unit.rotation = 0;
    }
  }

  onBossDefeated() {
    this.resetPositionsAroundPlayer();

    for (const list of this.units.values()) {
      for (let i = 0; i < list.length; i++) {
        const unit = list[i];
        if (!unit?.active) continue;
        unit.lastAttackAt = 0;
      }
    }

    const infernals = this.infernals || [];
    for (let i = 0; i < infernals.length; i++) {
      const unit = infernals[i];
      if (!unit?.active) continue;
      unit.lastAttackAt = 0;
    }
  }

  update(time, delta) {
    if (!this.player || this.player.isAlive === false) return;

    this.syncRespawns(time);
    this.syncInfernalRespawn(time);

    const guardList = this.units.get(SUMMON_TYPES.guard) || [];
    const mageList = this.units.get(SUMMON_TYPES.mage) || [];
    const acquireRange = this.getAcquireRange();

    for (let i = 0; i < guardList.length; i++) {
      this.updateGuard(guardList[i], i, guardList.length, time, delta);
    }

    for (let i = 0; i < mageList.length; i++) {
      this.updateMage(mageList[i], i, mageList.length, time, delta, acquireRange);
    }

    this.infernals = (this.infernals || []).filter((unit) => unit && unit.active && (unit.currentHp || 0) > 0);
    for (let i = 0; i < this.infernals.length; i++) {
      this.updateInfernal(this.infernals[i], time, delta);
    }
  }

  syncRespawns(time) {
    for (const type of Object.values(SUMMON_TYPES)) {
      const desired = this.getDesiredCount(type);
      const list = (this.units.get(type) || []).filter((unit) => unit && unit.active);
      this.units.set(type, list);

      if (desired <= 0) {
        this.respawnAt.set(type, 0);
        continue;
      }

      if (list.length >= desired) {
        this.respawnAt.set(type, 0);
        continue;
      }

      const nextAt = this.respawnAt.get(type) || 0;
      if (nextAt > 0 && time < nextAt) continue;

      const unit = this.spawnUnit(type, list.length, desired);
      if (!unit) continue;
      list.push(unit);
      this.summonRegistry?.register(REGISTRY_ID, unit);
      this.units.set(type, list);

      this.respawnAt.set(type, list.length < desired ? time + this.respawnDelayMs : 0);
    }
  }

  updateGuard(unit, index, total, time, delta) {
    if (!unit || !unit.active) return;

    const target = this.getNearestVisibleEnemy(unit.x, unit.y);
    const anchorAngle = unit.anchorAngle + time * 0.0012;
    const anchorX = this.player.x + Math.cos(anchorAngle) * (unit.anchorRadius || 42);
    const anchorY = this.player.y + 20 + Math.sin(anchorAngle) * 18;
    const needsRecall = !isPointInPlayerVision(this.scene, this.player, unit.x, unit.y, MELEE_RETURN_VISION_PADDING);

    let desiredX = unit.x;
    let desiredY = unit.y;
    if (needsRecall) {
      desiredX = anchorX;
      desiredY = anchorY;
    } else if (target) {
      const centerIndex = (Math.max(1, total) - 1) * 0.5;
      const spreadStep = total > 1 ? 0.42 : 0;
      const surroundAngle = Phaser.Math.Angle.Between(target.x, target.y, this.player.x, this.player.y) + (index - centerIndex) * spreadStep;
      const enemyRadius = Number.isFinite(target?.bossSize) ? target.bossSize : (Number(target?.radius) || 16);
      desiredX = target.x + Math.cos(surroundAngle) * (enemyRadius + unit.hitRadius + 18);
      desiredY = target.y + Math.sin(surroundAngle) * (enemyRadius + unit.hitRadius + 18);
    }

    const clamped = clampPointToPlayerVision(this.scene, this.player, desiredX, desiredY, MELEE_MOVE_VISION_INSET);

    const dx = clamped.x - unit.x;
    const dy = clamped.y - unit.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = unit.moveSpeed * (delta / 1000);
    unit.x += (dx / dist) * Math.min(step, dist);
    unit.y += (dy / dist) * Math.min(step, dist);

    if (needsRecall || !target || !target.isAlive) {
      clearPendingMeleeWindup(unit);
      unit.rotation = Phaser.Math.Angle.RotateTo(unit.rotation || 0, 0, 0.16);
      return;
    }

    const enemyRadius = Number.isFinite(target?.bossSize) ? target.bossSize : (Number(target?.radius) || 16);
    const tx = target.x - unit.x;
    const ty = target.y - unit.y;
    const tdist = Math.hypot(tx, ty) || 1;
    unit.rotation = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);

    if (hasPendingMeleeWindup(unit, time)) {
      return;
    }

    if (tdist <= enemyRadius + unit.hitRadius + unit.attackRange && time - unit.lastAttackAt >= unit.attackCooldownMs) {
      unit.lastAttackAt = time;
      const attackRange = enemyRadius + unit.hitRadius + unit.attackRange;
      startMeleeWindup({
        scene: this.scene,
        unit,
        target,
        now: time,
        color: unit.attackArcColor,
        windupMs: unit.attackWindupMs,
        radius: unit.attackArcRadius,
        thickness: unit.attackArcThickness,
        onStrike: (strikeTarget) => {
          if (!strikeTarget?.isAlive || strikeTarget.isInvincible) return;
          const hitDx = strikeTarget.x - unit.x;
          const hitDy = strikeTarget.y - unit.y;
          const hitDist = Math.hypot(hitDx, hitDy);
          if (hitDist > attackRange + 18) return;

          const baseDamage = Math.max(1, Math.round((this.player.bulletDamage || 1) * unit.damageMult * this.getSummonDamageMultiplier()));
          const result = calculateResolvedDamage({ attacker: this.player, target: strikeTarget, baseDamage, now: this.scene.time?.now ?? time });
          strikeTarget.takeDamage(result.amount, { attacker: this.player, source: 'skeleton_guard', suppressHitReaction: false });
          this.player.onDealDamage?.(result.amount);
          this.scene.showDamageNumber(strikeTarget.x, strikeTarget.y - 28, result.amount, { color: '#dcdcdc', whisper: true, fontSize: 20, isCrit: result.isCrit });
          const slash = this.scene.add.line(0, 0, unit.x, unit.y, strikeTarget.x, strikeTarget.y, 0xdcdcdc, 0.55);
          slash.setLineWidth(2, 2);
          this.scene.tweens.add({ targets: slash, alpha: 0, duration: 120, onComplete: () => slash.destroy() });
        }
      });
    }
  }

  updateMage(unit, index, total, time, delta, acquireRange) {
    if (!unit || !unit.active) return;

    const orbit = unit.orbitPhase + time * 0.0014;
    const desiredX = this.player.x + Math.cos(orbit) * unit.orbitRadius;
    const desiredY = this.player.y - 46 + Math.sin(orbit * 1.3) * 16;
    unit.x = Phaser.Math.Linear(unit.x, desiredX, unit.followLerp || 0.12);
    unit.y = Phaser.Math.Linear(unit.y, desiredY, unit.followLerp || 0.12);

    const target = this.getNearestEnemy(unit.x, unit.y, acquireRange);
    if (!target || !target.isAlive) return;
    if (time - unit.lastAttackAt < unit.attackCooldownMs) return;

    unit.lastAttackAt = time;
    const angle = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
    const bullet = this.scene.bulletManager?.createPlayerBullet?.(unit.x, unit.y, 0x8df5ff, {
      radius: 5,
      speed: unit.projectileSpeed || 320,
      damage: Math.max(1, Math.round((this.player.bulletDamage || 1) * unit.damageMult)),
      angleOffset: angle,
      isAbsoluteAngle: true,
      hasGlow: true,
      hasTrail: true,
      glowRadius: 10,
      glowColor: 0x8df5ff,
      strokeColor: 0xbca7ff,
      trailColor: 0xbca7ff,
      homing: true,
      homingTurn: 0.06,
      maxLifeMs: Math.round((acquireRange / Math.max(1, unit.projectileSpeed || 320)) * 1000),
      explode: false,
      skipUpdate: false
    });

    if (bullet) {
      bullet.hitCooldownMs = 120;
      this.player.bullets.push(bullet);
    }
  }

  updateInfernal(unit, time, delta) {
    if (!unit || !unit.active) return;

    if ((unit.expireAt || 0) > 0 && (unit.expireAt || 0) <= time) {
      this.onSummonKilled(unit);
      return;
    }

    const target = this.getNearestVisibleEnemy(unit.x, unit.y);
    const anchorAngle = (unit.anchorAngle || 0) + time * 0.0009;
    const anchorX = this.player.x + Math.cos(anchorAngle) * (unit.anchorRadius || 56);
    const anchorY = this.player.y + 24 + Math.sin(anchorAngle) * 22;
    const needsRecall = !isPointInPlayerVision(this.scene, this.player, unit.x, unit.y, MELEE_RETURN_VISION_PADDING);

    let desiredX = unit.x;
    let desiredY = unit.y;
    if (needsRecall) {
      desiredX = anchorX;
      desiredY = anchorY;
    } else if (target) {
      const enemyRadius = Number.isFinite(target?.bossSize) ? target.bossSize : (Number(target?.radius) || 16);
      const angle = Phaser.Math.Angle.Between(target.x, target.y, this.player.x, this.player.y);
      desiredX = target.x + Math.cos(angle) * (enemyRadius + unit.hitRadius + 20);
      desiredY = target.y + Math.sin(angle) * (enemyRadius + unit.hitRadius + 20);
    }

    const clamped = clampPointToPlayerVision(this.scene, this.player, desiredX, desiredY, MELEE_MOVE_VISION_INSET);

    const dx = clamped.x - unit.x;
    const dy = clamped.y - unit.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = unit.moveSpeed * (delta / 1000);
    unit.x += (dx / dist) * Math.min(step, dist);
    unit.y += (dy / dist) * Math.min(step, dist);

    const pulseT = (time || 0) * 0.006;
    const visuals = unit.visuals || null;
    if (visuals) {
      visuals.auraOuter?.setScale?.(1 + Math.sin(pulseT) * 0.08);
      visuals.auraOuter?.setAlpha?.(0.22 + Math.sin(pulseT * 0.8) * 0.06);
      visuals.auraInner?.setScale?.(1 + Math.sin(pulseT * 1.3 + 0.9) * 0.12);
      visuals.auraInner?.setAlpha?.(0.18 + Math.sin(pulseT * 1.1) * 0.05);
      visuals.flameBase?.setScale?.(1 + Math.sin(pulseT * 1.7 + 1.6) * 0.14, 1 + Math.sin(pulseT * 2.1) * 0.08);
      visuals.flameBase?.setAlpha?.(0.14 + Math.sin(pulseT * 1.4) * 0.05);
      visuals.core?.setScale?.(1 + Math.sin(pulseT * 2.4) * 0.1);
      visuals.core?.setAlpha?.(0.84 + Math.sin(pulseT * 2.6) * 0.12);
      if (Array.isArray(visuals.eyes)) {
        visuals.eyes[0]?.setAlpha?.(0.85 + Math.sin(pulseT * 3.1) * 0.15);
        visuals.eyes[1]?.setAlpha?.(0.85 + Math.sin(pulseT * 3.1 + 0.4) * 0.15);
      }
      visuals.emberLeft?.setPosition?.(-18 + Math.cos(pulseT * 1.2) * 2, -10 + Math.sin(pulseT * 1.8) * 4);
      visuals.emberRight?.setPosition?.(18 + Math.cos(pulseT * 1.5 + 1.4) * 2, -14 + Math.sin(pulseT * 2.0 + 0.6) * 5);
      visuals.emberTop?.setPosition?.(Math.sin(pulseT * 1.6) * 3, -40 + Math.cos(pulseT * 2.2) * 4);
    }

    if (time - (unit.lastAuraTickAt || 0) >= (unit.auraTickMs || 450)) {
      unit.lastAuraTickAt = time;
      const auraRadius = Math.max(40, Number(unit.auraRadius || 92));
      const auraPulse = this.scene.add.circle(unit.x, unit.y + 6, auraRadius, 0xbef264, 0.10).setDepth(7);
      auraPulse.setStrokeStyle(3, 0xecfccb, 0.28);
      this.scene.tweens.add({
        targets: auraPulse,
        scale: 1.18,
        alpha: 0,
        duration: Math.max(180, Math.round(unit.auraTickMs || 450)),
        ease: 'Sine.Out',
        onComplete: () => auraPulse.destroy()
      });
      const enemies = this.getAllEnemies();
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (!enemy?.isAlive || enemy.isInvincible) continue;
        const enemyRadius = Number.isFinite(enemy?.bossSize) ? enemy.bossSize : (Number(enemy?.radius) || 16);
        const reach = auraRadius + enemyRadius;
        const edx = enemy.x - unit.x;
        const edy = enemy.y - unit.y;
        if ((edx * edx + edy * edy) > reach * reach) continue;

        const auraDamage = Math.max(1, Math.round((this.player.bulletDamage || 1) * (unit.auraDamageMult || 0.42) * this.getSummonDamageMultiplier()));
        const result = calculateResolvedDamage({ attacker: this.player, target: enemy, baseDamage: auraDamage, now: this.scene.time?.now ?? time, canCrit: false });
        enemy.takeDamage?.(result.amount, { attacker: this.player, source: 'infernal_aura', suppressHitReaction: true });
        this.player.onDealDamage?.(result.amount);
        this.scene.showDamageNumber?.(enemy.x, enemy.y - Math.max(24, enemyRadius + 16), result.amount, { color: '#84cc16', whisper: true, fontSize: 18 });
      }
    }

    if (needsRecall || !target || !target.isAlive) {
      clearPendingMeleeWindup(unit);
      unit.rotation = Phaser.Math.Angle.RotateTo(unit.rotation || 0, 0, 0.14);
      return;
    }

    const enemyRadius = Number.isFinite(target?.bossSize) ? target.bossSize : (Number(target?.radius) || 16);
    const tx = target.x - unit.x;
    const ty = target.y - unit.y;
    const tdist = Math.hypot(tx, ty) || 1;
    unit.rotation = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y) * 0.08;

    if (hasPendingMeleeWindup(unit, time)) {
      return;
    }

    if (tdist <= enemyRadius + unit.hitRadius + unit.attackRange && time - unit.lastAttackAt >= unit.attackCooldownMs) {
      unit.lastAttackAt = time;
      const attackRange = enemyRadius + unit.hitRadius + unit.attackRange;
      startMeleeWindup({
        scene: this.scene,
        unit,
        target,
        now: time,
        color: unit.attackArcColor,
        windupMs: unit.attackWindupMs,
        radius: unit.attackArcRadius,
        thickness: unit.attackArcThickness,
        onStrike: (strikeTarget) => {
          if (!strikeTarget?.isAlive || strikeTarget.isInvincible) return;
          const hitDx = strikeTarget.x - unit.x;
          const hitDy = strikeTarget.y - unit.y;
          const hitDist = Math.hypot(hitDx, hitDy);
          if (hitDist > attackRange + 20) return;

          const baseDamage = Math.max(1, Math.round(((this.player.bulletDamage || 1) * unit.damageMult + 6) * this.getSummonDamageMultiplier()));
          const result = calculateResolvedDamage({ attacker: this.player, target: strikeTarget, baseDamage, now: this.scene.time?.now ?? time });
          strikeTarget.takeDamage(result.amount, { attacker: this.player, source: 'infernal', suppressHitReaction: false });
          this.player.onDealDamage?.(result.amount);

          this.scene.showDamageNumber(strikeTarget.x, strikeTarget.y - 32, result.amount, { color: '#7dff7a', whisper: true, fontSize: 22, isCrit: result.isCrit });
          const slash = this.scene.add.line(0, 0, unit.x, unit.y, strikeTarget.x, strikeTarget.y, 0x7dff7a, 0.65);
          slash.setLineWidth(4, 1);
          this.scene.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });
          const impact = this.scene.add.circle(strikeTarget.x, strikeTarget.y, 16, 0xecfccb, 0.28).setDepth(9);
          impact.setStrokeStyle(3, 0xbef264, 0.65);
          this.scene.tweens.add({ targets: impact, scale: 1.6, alpha: 0, duration: 150, ease: 'Cubic.Out', onComplete: () => impact.destroy() });
        }
      });
    }
  }

  syncInfernalRespawn(time) {
    if (!this.hasInfernalUnlocked()) return;

    this.infernals = (this.infernals || []).filter((unit) => unit && unit.active && (unit.currentHp || 0) > 0);
    if ((this.infernals || []).length > 0) return;
    if ((this.infernalRespawnAt || 0) > time) return;

    this.summonInfernal({ persistent: true, level: 3 });
    this.scene?.showDamageNumber?.(this.player?.x || 0, (this.player?.y || 0) - 86, '地狱火重生', { color: '#bef264', fontSize: 18, whisper: true });
  }

  clearUnits() {
    for (const type of Object.values(SUMMON_TYPES)) {
      const list = this.units.get(type) || [];
      list.forEach((unit) => this.destroyUnit(unit));
      this.units.set(type, []);
      this.respawnAt.set(type, 0);
    }

    (this.infernals || []).forEach((unit) => this.destroyUnit(unit));
    this.infernals = [];
    this.infernalRespawnAt = 0;
  }

  destroyUnit(unit) {
    if (unit?.active) {
      if (unit.isInfernal) {
        const burst = this.scene.add.circle(unit.x, unit.y + 6, Math.max(38, Number(unit.auraRadius || 92) * 0.55), 0xbef264, 0.18).setDepth(7);
        burst.setStrokeStyle(4, 0xecfccb, 0.55);
        this.scene.tweens.add({ targets: burst, scale: 1.55, alpha: 0, duration: 260, ease: 'Cubic.Out', onComplete: () => burst.destroy() });
      }
      clearPendingMeleeWindup(unit);
      this.summonRegistry?.unregister(REGISTRY_ID, unit);
      unit.destroy();
    }
  }

  destroy() {
    this.clearUnits();
  }
}