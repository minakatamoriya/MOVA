import Phaser from 'phaser';
import FormalBossBase from './FormalBossBase';
import {
  clampWorldPoint,
  clearTrackedHazards,
  getTargetPoint,
  getWorldRect,
  spawnPersistentLineHazard,
  updatePersistentLineHazards
} from './formalBossUtils';

const TOXIC_COLOR = 0x66bb4f;
const TOXIC_GLOW = 0xa6ea75;
const TOXIC_EGG = 0xc5ff8e;

export default class ToxicWeaverBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '毒网织母',
      color: TOXIC_COLOR,
      intervalByPhase: { 1: 3050, 2: 2550, 3: 2150 },
      hitReactionCdMs: 900
    });

    this._lineHazards = [];
    this._gridAxisToggle = 0;
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    updatePersistentLineHazards(this, this._lineHazards, time);
  }

  destroy() {
    clearTrackedHazards(this._lineHazards, ['core', 'glow']);
    super.destroy();
  }

  getCycleSequence() {
    return [
      this.castCardinalWeave,
      this.castGridLock,
      this.castIntersectionEggs
    ];
  }

  buildAxisLine(axis, value) {
    const rect = getWorldRect(this.scene);
    if (axis === 'vertical') {
      return { x1: value, y1: rect.y + 32, x2: value, y2: rect.y + rect.height - 32 };
    }
    return { x1: rect.x + 32, y1: value, x2: rect.x + rect.width - 32, y2: value };
  }

  telegraphAndSpawnLines(lines, telegraphMs = 760, durationMs = 2600) {
    const scene = this.scene;
    if (!scene?.patternSystem || !Array.isArray(lines) || lines.length <= 0) return;

    this.showAlertIcon(telegraphMs);
    this.lockAction?.(telegraphMs + 180);

    lines.forEach((line) => {
      const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
      const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
      const cx = (line.x1 + line.x2) * 0.5;
      const cy = (line.y1 + line.y2) * 0.5;
      const telegraph = scene.patternSystem.emitGroundTelegraph({
        x: cx,
        y: cy,
        shape: 'line',
        angle,
        telegraphWidth: line.width || 42,
        telegraphLength: length,
        telegraphColor: line.color || TOXIC_COLOR,
        durationMs: telegraphMs
      });
      if (telegraph) this._trackHazardObject?.(telegraph);
    });

    const timer = scene.time?.delayedCall?.(telegraphMs, () => {
      if (!this.isAlive || this.isDestroyed) return;
      lines.forEach((line) => {
        spawnPersistentLineHazard(scene, this, this._lineHazards, {
          ...line,
          width: line.width || 40,
          color: line.color || TOXIC_COLOR,
          glowColor: line.glowColor || TOXIC_GLOW,
          durationMs,
          damage: this.scaleAttackDamage(line.damage || 7, 5),
          tickIntervalMs: line.tickIntervalMs || 360,
          alpha: 0.92,
          glowAlpha: 0.22
        });
      });
      scene.vfxSystem?.playBurst?.(this.x, this.y, {
        radius: 42,
        color: TOXIC_GLOW,
        durationMs: 180
      });
    });
    if (timer) this._trackHazardTimer?.(timer);
  }

  castCardinalWeave() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const lines = [];
    const vertical = Math.random() >= 0.5;
    const mainValue = vertical ? targetPoint.x : targetPoint.y;
    lines.push({ ...this.buildAxisLine(vertical ? 'vertical' : 'horizontal', mainValue), width: phase >= 3 ? 46 : 40 });

    if (phase >= 2) {
      lines.push({ ...this.buildAxisLine(vertical ? 'horizontal' : 'vertical', vertical ? targetPoint.y : targetPoint.x), width: 40 });
    }

    if (phase >= 3) {
      const rect = getWorldRect(this.scene);
      const offset = Phaser.Math.Clamp((vertical ? rect.width : rect.height) * 0.16, 110, 180);
      const extraValue = mainValue + (Math.random() >= 0.5 ? offset : -offset);
      const clamped = vertical
        ? Phaser.Math.Clamp(extraValue, rect.x + 80, rect.x + rect.width - 80)
        : Phaser.Math.Clamp(extraValue, rect.y + 80, rect.y + rect.height - 80);
      lines.push({ ...this.buildAxisLine(vertical ? 'vertical' : 'horizontal', clamped), width: 44, damage: 9 });
    }

    this.telegraphAndSpawnLines(lines, 760, phase >= 3 ? 3200 : 2800);
  }

  castGridLock() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const axis = this._gridAxisToggle % 2 === 0 ? 'horizontal' : 'vertical';
    this._gridAxisToggle += 1;

    const offsets = phase >= 3 ? [-150, 0, 150] : [-96, 96];
    const lines = offsets.map((offset) => {
      const value = axis === 'horizontal' ? targetPoint.y + offset : targetPoint.x + offset;
      const point = clampWorldPoint(this.scene, axis === 'horizontal' ? this.x : value, axis === 'horizontal' ? value : this.y, 84);
      return {
        ...this.buildAxisLine(axis, axis === 'horizontal' ? point.y : point.x),
        width: phase >= 3 ? 42 : 38,
        damage: phase >= 3 ? 9 : 8,
        tickIntervalMs: 320
      };
    });

    if (phase >= 2) {
      const crossAxis = axis === 'horizontal' ? 'vertical' : 'horizontal';
      const crossValue = crossAxis === 'horizontal' ? targetPoint.y : targetPoint.x;
      lines.push({ ...this.buildAxisLine(crossAxis, crossValue), width: 36, damage: 8 });
    }

    this.telegraphAndSpawnLines(lines, 680, phase >= 3 ? 3000 : 2500);
  }

  castIntersectionEggs() {
    const scene = this.scene;
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!scene?.patternSystem || !targetPoint) return;

    const phase = this.getPhase();
    const candidates = [];
    const lines = this._lineHazards.slice(-6);

    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const a = lines[i];
        const b = lines[j];
        const aVertical = Math.abs(a.x1 - a.x2) < 6;
        const bVertical = Math.abs(b.x1 - b.x2) < 6;
        if (aVertical === bVertical) continue;
        candidates.push(clampWorldPoint(this.scene, aVertical ? a.x1 : b.x1, aVertical ? b.y1 : a.y1, 64));
      }
    }

    while (candidates.length < (phase + 1)) {
      const angle = (Math.PI * 2 * candidates.length) / Math.max(3, phase + 1);
      candidates.push(clampWorldPoint(this.scene, targetPoint.x + (Math.cos(angle) * 120), targetPoint.y + (Math.sin(angle) * 120), 72));
    }

    const count = Math.min(candidates.length, phase + 1);
    const durationMs = 760;
    this.showAlertIcon(durationMs);

    candidates.slice(0, count).forEach((point, index) => {
      const telegraph = scene.patternSystem.emitGroundTelegraph({
        x: point.x,
        y: point.y,
        telegraphRadius: phase >= 3 ? 42 : 34,
        telegraphColor: TOXIC_EGG,
        durationMs
      });
      if (telegraph) this._trackHazardObject?.(telegraph);

      const timer = scene.time?.delayedCall?.(durationMs, () => {
        if (!this.isAlive || this.isDestroyed) return;
        scene.vfxSystem?.playBurst?.(point.x, point.y, {
          radius: 44,
          color: TOXIC_EGG,
          durationMs: 180
        });
        scene.patternSystem.emitRing({
          side: 'boss',
          x: point.x,
          y: point.y,
          count: phase >= 3 ? 12 : 8,
          speed: phase >= 3 ? 165 : 145,
          color: TOXIC_COLOR,
          radius: 8,
          damage: this.scaleAttackDamage(phase >= 3 ? 10 : 8, 6),
          tags: ['boss_toxic_egg'],
          options: {
            type: 'circle',
            hasTrail: true,
            trailColor: TOXIC_GLOW,
            hasGlow: false
          }
        });
      });
      if (timer) this._trackHazardTimer?.(timer);
    });
  }
}