import Phaser from 'phaser';
import { calculateResolvedDamage } from '../../combat/damageModel';

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

export default class UndeadSummonManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.units = new Map([
      [SUMMON_TYPES.guard, []],
      [SUMMON_TYPES.mage, []]
    ]);
    this.respawnAt = new Map([
      [SUMMON_TYPES.guard, 0],
      [SUMMON_TYPES.mage, 0]
    ]);
    this.acquireRangeBase = 260;
    this.maxLeashRange = 340;
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
    const enemies = [];
    const boss = this.scene?.bossManager?.getCurrentBoss?.();
    if (boss && boss.isAlive) enemies.push(boss);

    const minions = this.scene?.bossManager?.getMinions?.() || this.scene?.bossManager?.minions || [];
    if (Array.isArray(minions)) {
      minions.forEach((minion) => {
        if (minion && minion.isAlive) enemies.push(minion);
      });
    }

    return enemies;
  }

  getNearestEnemy(originX, originY, acquireRange) {
    const player = this.player;
    if (!player) return null;

    const leash2 = this.maxLeashRange * this.maxLeashRange;
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
      if (playerD2 > leash2) continue;

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
    const type = unit.summonType;
    const list = this.units.get(type) || [];
    const next = list.filter((entry) => entry !== unit && entry?.active);
    this.units.set(type, next);
    this.destroyUnit(unit);

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
    unit.maxHp = Math.max(24, Math.round((this.player.maxHp || 100) * 0.32));
    unit.currentHp = unit.maxHp;
    unit.moveSpeed = 210;
    unit.attackRange = 20;
    unit.attackCooldownMs = 950;
    unit.damageMult = 0.52;
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
    unit.maxHp = Math.max(12, Math.round((this.player.maxHp || 100) * 0.18));
    unit.currentHp = unit.maxHp;
    unit.followLerp = 0.12;
    unit.attackCooldownMs = 1450;
    unit.projectileSpeed = 320;
    unit.damageMult = 0.42;
    unit.orbitPhase = angle;
    unit.orbitRadius = 58;
    unit.lastAttackAt = 0;
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

  update(time, delta) {
    if (!this.player || this.player.isAlive === false) return;

    this.syncRespawns(time);

    const guardList = this.units.get(SUMMON_TYPES.guard) || [];
    const mageList = this.units.get(SUMMON_TYPES.mage) || [];
    const acquireRange = this.getAcquireRange();

    for (let i = 0; i < guardList.length; i++) {
      this.updateGuard(guardList[i], i, guardList.length, time, delta, acquireRange);
    }

    for (let i = 0; i < mageList.length; i++) {
      this.updateMage(mageList[i], i, mageList.length, time, delta, acquireRange);
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
      this.units.set(type, list);

      this.respawnAt.set(type, list.length < desired ? time + this.respawnDelayMs : 0);
    }
  }

  updateGuard(unit, index, total, time, delta, acquireRange) {
    if (!unit || !unit.active) return;

    const target = this.getNearestEnemy(unit.x, unit.y, acquireRange);
    const anchorAngle = unit.anchorAngle + time * 0.0012;
    const anchorX = this.player.x + Math.cos(anchorAngle) * (unit.anchorRadius || 42);
    const anchorY = this.player.y + 20 + Math.sin(anchorAngle) * 18;

    let desiredX = anchorX;
    let desiredY = anchorY;
    if (target) {
      const surroundAngle = total > 0 ? (Math.PI * 2 * index) / Math.max(1, total) : 0;
      const enemyRadius = Number.isFinite(target?.bossSize) ? target.bossSize : (Number(target?.radius) || 16);
      desiredX = target.x + Math.cos(surroundAngle) * (enemyRadius + unit.hitRadius + 18);
      desiredY = target.y + Math.sin(surroundAngle) * (enemyRadius + unit.hitRadius + 18);
    }

    const dx = desiredX - unit.x;
    const dy = desiredY - unit.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = unit.moveSpeed * (delta / 1000);
    unit.x += (dx / dist) * Math.min(step, dist);
    unit.y += (dy / dist) * Math.min(step, dist);

    if (!target || !target.isAlive) return;

    const enemyRadius = Number.isFinite(target?.bossSize) ? target.bossSize : (Number(target?.radius) || 16);
    const tx = target.x - unit.x;
    const ty = target.y - unit.y;
    const tdist = Math.hypot(tx, ty) || 1;
    unit.rotation = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);

    if (tdist <= enemyRadius + unit.hitRadius + unit.attackRange && time - unit.lastAttackAt >= unit.attackCooldownMs) {
      unit.lastAttackAt = time;
      const baseDamage = Math.max(1, Math.round((this.player.bulletDamage || 1) * unit.damageMult));
      const result = calculateResolvedDamage({ attacker: this.player, target, baseDamage, now: time });
      target.takeDamage(result.amount, { attacker: this.player, source: 'skeleton_guard', suppressHitReaction: false });
      this.player.onDealDamage?.(result.amount);
      this.scene.showDamageNumber(target.x, target.y - 28, result.amount, { color: '#dcdcdc', whisper: true, fontSize: 20, isCrit: result.isCrit });
      const slash = this.scene.add.line(0, 0, unit.x, unit.y, target.x, target.y, 0xdcdcdc, 0.55);
      slash.setLineWidth(2, 2);
      this.scene.tweens.add({ targets: slash, alpha: 0, duration: 120, onComplete: () => slash.destroy() });
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

    const line = this.scene.add.line(0, 0, unit.x, unit.y, target.x, target.y, 0x8df5ff, 0.32);
    line.setLineWidth(1, 1);
    this.scene.tweens.add({ targets: line, alpha: 0, duration: 140, onComplete: () => line.destroy() });
  }

  clearUnits() {
    for (const type of Object.values(SUMMON_TYPES)) {
      const list = this.units.get(type) || [];
      list.forEach((unit) => this.destroyUnit(unit));
      this.units.set(type, []);
      this.respawnAt.set(type, 0);
    }
  }

  destroyUnit(unit) {
    if (unit?.active) unit.destroy();
  }

  destroy() {
    this.clearUnits();
  }
}