import Phaser from 'phaser';
import FormalBossBase from './FormalBossBase';
import {
  clampWorldPoint,
  createDiamondGlyph,
  destroyDisplayObject,
  getTargetPoint,
  spawnPersistentCircleHazard,
  spawnPersistentLineHazard,
  updatePersistentCircleHazards,
  updatePersistentLineHazards
} from './formalBossUtils';

const THUNDER_COLOR = 0xf3c13a;
const THUNDER_GLOW = 0xffed8c;
const THUNDER_CORE = 0xfff4ce;

export default class ThunderWardenBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '雷牢执政官',
      color: THUNDER_COLOR,
      intervalByPhase: { 1: 3200, 2: 2720, 3: 2280 },
      hitReactionCdMs: 840
    });

    this._pillars = [];
    this._linkHazards = [];
    this._pulseHazards = [];
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    this.updatePillars(time);
    updatePersistentLineHazards(this, this._linkHazards, time);
    updatePersistentCircleHazards(this, this._pulseHazards, time);
  }

  destroy() {
    this._pillars.forEach((pillar) => {
      destroyDisplayObject(pillar?.glyph);
      destroyDisplayObject(pillar?.ring);
    });
    this._pillars = [];
    this._linkHazards.forEach((hazard) => {
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
    });
    this._pulseHazards.forEach((hazard) => {
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
    });
    this._linkHazards = [];
    this._pulseHazards = [];
    super.destroy();
  }

  getCycleSequence() {
    return [
      this.castThunderPillars,
      this.castChainLoop,
      this.castStormPulse
    ];
  }

  updatePillars(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    let writeIndex = 0;
    for (let index = 0; index < this._pillars.length; index += 1) {
      const pillar = this._pillars[index];
      if (!pillar?.glyph?.active || !pillar?.ring?.active || now >= pillar.expiresAt) {
        destroyDisplayObject(pillar?.glyph);
        destroyDisplayObject(pillar?.ring);
        continue;
      }

      const pulse = 0.88 + (0.12 * Math.sin((now * 0.014) + index));
      pillar.glyph.rotation += 0.025;
      pillar.glyph.scale = pulse;

      pillar.ring.clear();
      pillar.ring.lineStyle(4, THUNDER_GLOW, 0.26 * pulse);
      pillar.ring.strokeCircle(pillar.x, pillar.y, 26 + (4 * pulse));
      this._pillars[writeIndex++] = pillar;
    }

    this._pillars.length = writeIndex;
  }

  spawnPillar(point) {
    const glyph = createDiamondGlyph(this.scene, 18, THUNDER_COLOR, THUNDER_CORE, 0.74);
    glyph.setDepth(8);
    glyph.x = point.x;
    glyph.y = point.y;
    const ring = this.scene.add.graphics().setDepth(7);
    this._trackHazardObject?.(glyph);
    this._trackHazardObject?.(ring);

    this._pillars.push({
      x: point.x,
      y: point.y,
      glyph,
      ring,
      expiresAt: Number(this.scene.time?.now || 0) + (this.getPhase() >= 3 ? 9200 : 7800)
    });
  }

  castThunderPillars() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const count = phase >= 3 ? 4 : (phase >= 2 ? 3 : 2);
    const radius = phase >= 2 ? 170 : 140;
    const telegraphMs = 720;
    this.showAlertIcon(telegraphMs);

    for (let index = 0; index < count; index += 1) {
      const angle = ((Math.PI * 2) / count) * index + Math.random() * 0.3;
      const point = clampWorldPoint(this.scene, targetPoint.x + (Math.cos(angle) * radius), targetPoint.y + (Math.sin(angle) * radius), 104);
      const telegraph = this.scene.patternSystem?.emitGroundTelegraph?.({
        x: point.x,
        y: point.y,
        telegraphRadius: 30,
        telegraphColor: THUNDER_GLOW,
        durationMs: telegraphMs
      });
      if (telegraph) this._trackHazardObject?.(telegraph);

      const timer = this.scene.time?.delayedCall?.(telegraphMs, () => {
        if (!this.isAlive || this.isDestroyed) return;
        this.spawnPillar(point);
      });
      if (timer) this._trackHazardTimer?.(timer);
    }
  }

  castChainLoop() {
    if (this._pillars.length < 2) {
      this.castThunderPillars();
      return;
    }

    const phase = this.getPhase();
    const pillars = this._pillars.slice().sort((a, b) => a.x - b.x);
    const links = [];
    for (let index = 0; index < pillars.length - 1; index += 1) {
      links.push({ a: pillars[index], b: pillars[index + 1] });
    }
    if (phase >= 2 && pillars.length >= 3) {
      links.push({ a: pillars[0], b: pillars[pillars.length - 1] });
    }

    const telegraphMs = phase >= 3 ? 560 : 720;
    this.showAlertIcon(telegraphMs);
    links.forEach(({ a, b }) => {
      const telegraph = this.scene.patternSystem?.emitGroundTelegraph?.({
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5,
        shape: 'line',
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        telegraphWidth: 24,
        telegraphLength: Math.hypot(b.x - a.x, b.y - a.y),
        telegraphColor: THUNDER_GLOW,
        durationMs: telegraphMs
      });
      if (telegraph) this._trackHazardObject?.(telegraph);
    });

    const timer = this.scene.time?.delayedCall?.(telegraphMs, () => {
      if (!this.isAlive || this.isDestroyed) return;
      links.forEach(({ a, b }) => {
        spawnPersistentLineHazard(this.scene, this, this._linkHazards, {
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          width: phase >= 3 ? 30 : 24,
          color: THUNDER_COLOR,
          glowColor: THUNDER_GLOW,
          durationMs: phase >= 3 ? 2200 : 1800,
          damage: this.scaleAttackDamage(phase >= 3 ? 10 : 8, 5),
          tickIntervalMs: phase >= 3 ? 180 : 240,
          alpha: 0.94,
          glowAlpha: 0.26
        });
      });
    });
    if (timer) this._trackHazardTimer?.(timer);
  }

  castStormPulse() {
    if (this._pillars.length <= 0) {
      this.castThunderPillars();
      return;
    }

    const phase = this.getPhase();
    const count = Math.min(this._pillars.length, phase >= 3 ? 2 : 1);
    const selected = this._pillars.slice(0, count);
    selected.forEach((pillar) => {
      spawnPersistentCircleHazard(this.scene, this, this._pulseHazards, {
        x: pillar.x,
        y: pillar.y,
        radius: phase >= 3 ? 74 : 58,
        color: THUNDER_COLOR,
        glowColor: THUNDER_GLOW,
        durationMs: 1800,
        damage: this.scaleAttackDamage(phase >= 3 ? 10 : 8, 5),
        tickIntervalMs: 280,
        alpha: 0.18,
        strokeAlpha: 0.88
      });

      this.scene.patternSystem?.emitRing?.({
        side: 'boss',
        x: pillar.x,
        y: pillar.y,
        count: phase >= 3 ? 14 : 10,
        speed: phase >= 3 ? 170 : 150,
        color: THUNDER_COLOR,
        radius: 7,
        damage: this.scaleAttackDamage(phase >= 3 ? 9 : 7, 4),
        tags: ['boss_thunder_pulse'],
        options: {
          type: 'circle',
          hasTrail: true,
          trailColor: THUNDER_GLOW,
          hasGlow: false
        }
      });
    });
  }
}