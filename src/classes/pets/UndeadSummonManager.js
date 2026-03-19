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
  1: 1,
  2: 3,
  3: 5
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
    return LEVEL_TO_CAP[lvl] || 0;
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
      const level = Phaser.Math.Clamp(Math.round(Number(unit.infernalLevel) || 1), 1, 3);
      const hpScale = Math.max(0.1, Number(unit.infernalHpScale) || ([0, 0.85, 1.10, 1.45][level] || 1));
      const nextMaxHp = Math.max(180, Math.round(((this.player?.maxHp || 100) * hpScale + (this.player?.bulletDamage || 1) * (12 + level * 8)) * this.getSummonHealthMultiplier()));
      const missing = Math.max(0, (unit.maxHp || nextMaxHp) - (unit.currentHp || 0));
      unit.maxHp = nextMaxHp;
      unit.currentHp = Math.max(1, Math.min(nextMaxHp, nextMaxHp - missing));
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

    const level = Phaser.Math.Clamp(Math.round(Number(options.level) || 1), 1, 3);
    const durationMs = Math.max(1000, Math.round(Number(options.durationMs) || 10000));
    const healPerHit = Math.max(1, Math.round(Number(options.healPerHit) || [0, 8, 14, 22][level] || 10));
    const hpScale = Math.max(0.1, Number(options.hpScale) || ([0, 0.85, 1.10, 1.45][level] || 1));
    const damageMult = Math.max(0.1, Number(options.damageMult) || ([0, 1.10, 1.45, 1.85][level] || 1));

    (this.infernals || []).forEach((unit) => this.destroyUnit(unit));
    this.infernals = [];

    const unit = this.createInfernal({ level, durationMs, healPerHit, hpScale, damageMult });
    if (!unit) return null;

    this.infernals.push(unit);
    this.summonRegistry?.register(REGISTRY_ID, unit);
    return unit;
  }

  createInfernal(config = {}) {
    const level = Phaser.Math.Clamp(Math.round(Number(config.level) || 1), 1, 3);
    const durationMs = Math.max(1000, Math.round(Number(config.durationMs) || 10000));
    const healPerHit = Math.max(1, Math.round(Number(config.healPerHit) || 10));
    const hpScale = Math.max(0.1, Number(config.hpScale) || 1);
    const damageMult = Math.max(0.1, Number(config.damageMult) || 1);
    const x = this.player.x + 10;
    const y = this.player.y + 30;

    const shadow = this.scene.add.ellipse(0, 18, 42, 18, 0x11210f, 0.30);
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

    const unit = this.scene.add.container(x, y, [shadow, legs, armLeft, armRight, body, shoulders, head, jaw, hornLeft, hornRight, eyeLeft, eyeRight]);
    unit.setDepth(8);
    unit.summonType = 'infernal';
    unit.isUndeadSummon = true;
    unit.isInfernal = true;
    unit.infernalLevel = level;
    unit.hitRadius = 22;
    unit.maxHp = Math.max(180, Math.round(((this.player.maxHp || 100) * hpScale + (this.player.bulletDamage || 1) * (12 + level * 8)) * this.getSummonHealthMultiplier()));
    unit.currentHp = unit.maxHp;
    unit.moveSpeed = 250;
    unit.attackRange = 28;
    unit.attackCooldownMs = 760;
    unit.damageMult = damageMult;
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
    unit.expireAt = (this.scene.time?.now ?? 0) + durationMs;

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

    if ((unit.expireAt || 0) <= time) {
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

          const healAmount = Math.max(1, Math.round(unit.healOnHit || 0));
          const restored = this.player.heal?.(healAmount) || 0;
          if (restored > 0) {
            this.scene.showDamageNumber(this.player.x, this.player.y - 56, `+${restored}`, { color: '#86efac', fontSize: 20, whisper: true });
          }

          this.scene.showDamageNumber(strikeTarget.x, strikeTarget.y - 32, result.amount, { color: '#7dff7a', whisper: true, fontSize: 22, isCrit: result.isCrit });
          const slash = this.scene.add.line(0, 0, unit.x, unit.y, strikeTarget.x, strikeTarget.y, 0x7dff7a, 0.65);
          slash.setLineWidth(4, 1);
          this.scene.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });
        }
      });
    }
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
  }

  destroyUnit(unit) {
    if (unit?.active) {
      clearPendingMeleeWindup(unit);
      this.summonRegistry?.unregister(REGISTRY_ID, unit);
      unit.destroy();
    }
  }

  destroy() {
    this.clearUnits();
  }
}