import Phaser from 'phaser';
import FormalBossBase from './FormalBossBase';
import {
  clampWorldPoint,
  createDiamondGlyph,
  destroyDisplayObject,
  getTargetPoint,
  spawnPersistentCircleHazard,
  updatePersistentCircleHazards
} from './formalBossUtils';

const BROOD_COLOR = 0x6b9c3d;
const BROOD_GLOW = 0xb7df6a;
const BROOD_SLIME = 0x5e8a32;

export default class BroodmotherBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '百巢兽母',
      color: BROOD_COLOR,
      intervalByPhase: { 1: 3200, 2: 2760, 3: 2320 },
      hitReactionCdMs: 980
    });

    this._nests = [];
    this._slimeHazards = [];
    this._baseMoveSpeed = this.moveSpeed;
    this._broodWindowUntil = 0;
    this._broodMoveMult = 1;
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    updatePersistentCircleHazards(this, this._slimeHazards, time);
    this.updateNests(time);
    const now = Number(time || this.scene?.time?.now || 0);
    const p3Bonus = this.getPhase() >= 3 ? Math.min(10, this._nests.length * 2) : 0;
    const broodWindowActive = (this._broodWindowUntil || 0) > now;
    const moveMult = broodWindowActive ? this._broodMoveMult : 1;
    this.moveSpeed = Math.max(18, (this._baseMoveSpeed * moveMult) + p3Bonus);
  }

  destroy() {
    this._nests.forEach((nest) => {
      destroyDisplayObject(nest?.glyph);
      destroyDisplayObject(nest?.ring);
    });
    this._nests = [];
    this._slimeHazards.forEach((hazard) => {
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
    });
    this._slimeHazards = [];
    super.destroy();
  }

  getCycleSequence() {
    return [
      this.castNestDrop,
      this.castBroodWave,
      this.castSlimeCarpet
    ];
  }

  getNestCap() {
    const phase = this.getPhase();
    if (phase >= 3) return 4;
    if (phase >= 2) return 3;
    return 2;
  }

  beginBroodWindow(durationMs, moveMult, incomingDamageMult) {
    const now = Number(this.scene?.time?.now || 0);
    this._broodWindowUntil = Math.max(this._broodWindowUntil || 0, now + Math.max(0, Math.round(durationMs || 0)));
    this._broodMoveMult = Math.max(0.35, Math.min(1, Number(moveMult || 1)));
    this.setIncomingDamageWindow(incomingDamageMult, durationMs, {
      tintColor: 0xd9ffad,
      strokeColor: BROOD_GLOW
    });
  }

  spawnNest(point) {
    const scene = this.scene;
    if (!scene?.add) return null;

    const glyph = createDiamondGlyph(scene, 20, BROOD_GLOW, 0xf2ffd9, 0.72);
    glyph.setDepth(8);
    glyph.x = point.x;
    glyph.y = point.y;
    const ring = scene.add.graphics().setDepth(7);
    this._trackHazardObject?.(glyph);
    this._trackHazardObject?.(ring);

    const nest = {
      x: point.x,
      y: point.y,
      glyph,
      ring,
      spawnAt: Number(scene.time?.now || 0) + 820,
      spawnIntervalMs: this.getPhase() >= 2 ? 2100 : 2600,
      expiresAt: Number(scene.time?.now || 0) + 12000
    };

    spawnPersistentCircleHazard(scene, this, this._slimeHazards, {
      x: point.x,
      y: point.y,
      radius: this.getPhase() >= 3 ? 74 : 62,
      color: BROOD_SLIME,
      glowColor: BROOD_GLOW,
      durationMs: 11000,
      damage: this.scaleAttackDamage(this.getPhase() >= 3 ? 8 : 6, 4),
      tickIntervalMs: 360,
      alpha: 0.16,
      strokeAlpha: 0.74
    });

    while (this._nests.length >= this.getNestCap()) {
      const removed = this._nests.shift();
      destroyDisplayObject(removed?.glyph);
      destroyDisplayObject(removed?.ring);
    }

    this._nests.push(nest);
    return nest;
  }

  updateNests(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    let writeIndex = 0;
    for (let index = 0; index < this._nests.length; index += 1) {
      const nest = this._nests[index];
      if (!nest?.glyph?.active || !nest?.ring?.active || now >= nest.expiresAt) {
        destroyDisplayObject(nest?.glyph);
        destroyDisplayObject(nest?.ring);
        continue;
      }

      const pulse = 0.88 + (0.12 * Math.sin((now * 0.01) + index));
      nest.glyph.rotation += 0.01;
      nest.glyph.scale = pulse;

      nest.ring.clear();
      nest.ring.lineStyle(4, BROOD_GLOW, 0.28 * pulse);
      nest.ring.strokeCircle(nest.x, nest.y, 28 + (4 * pulse));

      if (now >= nest.spawnAt) {
        nest.spawnAt = now + nest.spawnIntervalMs;
        this.spawnBroodlings(nest.x, nest.y, this.getPhase() >= 3 ? 3 : 2);
      }

      this._nests[writeIndex++] = nest;
    }

    this._nests.length = writeIndex;
  }

  spawnBroodlings(x, y, count) {
    const scene = this.scene;
    const bossManager = scene?.bossManager;
    const TestMinion = scene?._TestMinionClass;
    if (!scene || !bossManager || !TestMinion) return;

    for (let index = 0; index < count; index += 1) {
      const angle = ((Math.PI * 2) / Math.max(1, count)) * index + Math.random() * 0.25;
      const spawnX = x + (Math.cos(angle) * 38);
      const spawnY = y + (Math.sin(angle) * 38);
      try {
        const minion = new TestMinion(scene, {
          x: spawnX,
          y: spawnY,
          name: '孵化虫群',
          type: 'chaser',
          hp: this.getPhase() >= 3 ? 76 : 58,
          size: 13,
          moveSpeed: this.getPhase() >= 2 ? 82 : 72,
          contactDamage: this.scaleAttackDamage(this.getPhase() >= 3 ? 9 : 7, 4),
          color: BROOD_COLOR,
          expReward: 0,
          isSummon: true,
          noKillRewards: true,
        });
        if (Array.isArray(bossManager.minions)) bossManager.minions.push(minion);
      } catch (_) {
        // ignore
      }
    }

    scene.vfxSystem?.playBurst?.(x, y, {
      radius: 28,
      color: BROOD_GLOW,
      durationMs: 180
    });
  }

  castNestDrop() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const count = phase >= 3 ? 3 : (phase >= 2 ? 2 : 1);
    const telegraphMs = 720;
    this.beginBroodWindow(telegraphMs + 560, 0.62, phase >= 2 ? 1.42 : 1.28);
    this.showAlertIcon(telegraphMs);

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / Math.max(1, count) + Math.random() * 0.4;
      const point = clampWorldPoint(this.scene, targetPoint.x + (Math.cos(angle) * 140), targetPoint.y + (Math.sin(angle) * 140), 96);
      const telegraph = this.scene.patternSystem?.emitGroundTelegraph?.({
        x: point.x,
        y: point.y,
        telegraphRadius: 34,
        telegraphColor: BROOD_GLOW,
        durationMs: telegraphMs
      });
      if (telegraph) this._trackHazardObject?.(telegraph);

      const timer = this.scene.time?.delayedCall?.(telegraphMs, () => {
        if (!this.isAlive || this.isDestroyed) return;
        this.spawnNest(point);
      });
      if (timer) this._trackHazardTimer?.(timer);
    }
  }

  castBroodWave() {
    const phase = this.getPhase();
    if (this._nests.length <= 0) {
      this.castNestDrop();
      return;
    }

    this.beginBroodWindow(920, 0.56, phase >= 2 ? 1.48 : 1.34);
    this.showAlertIcon(640);
    this.scene?.vfxSystem?.playCharge?.(this.x, this.y, {
      radius: 26,
      color: BROOD_GLOW,
      durationMs: 220
    });

    const timer = this.scene.time?.delayedCall?.(520, () => {
      if (!this.isAlive || this.isDestroyed) return;
      this._nests.forEach((nest) => {
        this.spawnBroodlings(nest.x, nest.y, phase >= 3 ? 4 : 3);
      });
    });
    if (timer) this._trackHazardTimer?.(timer);
  }

  castSlimeCarpet() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    const phase = this.getPhase();
    if (!targetPoint) return;

    const points = this._nests.length > 0
      ? this._nests.slice(0, Math.min(this._nests.length, phase + 1)).map((nest) => ({ x: nest.x, y: nest.y }))
      : [clampWorldPoint(this.scene, targetPoint.x, targetPoint.y, 84)];

    points.forEach((point) => {
      spawnPersistentCircleHazard(this.scene, this, this._slimeHazards, {
        x: point.x,
        y: point.y,
        radius: phase >= 3 ? 84 : 68,
        color: BROOD_SLIME,
        glowColor: BROOD_GLOW,
        durationMs: 4200,
        damage: this.scaleAttackDamage(phase >= 3 ? 9 : 7, 4),
        tickIntervalMs: 320,
        alpha: 0.18,
        strokeAlpha: 0.82
      });
    });
  }
}