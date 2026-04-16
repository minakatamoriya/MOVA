import Phaser from 'phaser';
import FormalBossBase from './FormalBossBase';
import {
  clampWorldPoint,
  damageTarget,
  destroyDisplayObject,
  getTargetPoint,
  getWorldRect,
  spawnPersistentCircleHazard,
  updatePersistentCircleHazards
} from './formalBossUtils';

const DEVOURER_COLOR = 0x4fb8c8;
const DEVOURER_GLOW = 0xa3edf6;
const DEVOURER_CORE = 0xe2fcff;
const DEVOURER_VORTEX = 0x2e8594;

export default class TideDevourerBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '潮汐吞星兽',
      color: DEVOURER_COLOR,
      intervalByPhase: { 1: 3280, 2: 2760, 3: 2320 },
      hitReactionCdMs: 900
    });

    this._waveHazards = [];
    this._vortexHazards = [];
    this._meteorHazards = [];
    this._waveOrientationToggle = 0;
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    this.updateWaves(time);
    this.updateMeteors(time);
    updatePersistentCircleHazards(this, this._vortexHazards, time);
  }

  destroy() {
    this._waveHazards.forEach((wave) => {
      destroyDisplayObject(wave?.core);
      destroyDisplayObject(wave?.glow);
    });
    this._meteorHazards.forEach((meteor) => {
      destroyDisplayObject(meteor?.core);
      destroyDisplayObject(meteor?.glow);
    });
    this._vortexHazards.forEach((hazard) => {
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
    });
    this._waveHazards = [];
    this._meteorHazards = [];
    this._vortexHazards = [];
    super.destroy();
  }

  getCycleSequence() {
    return [
      this.castSeaWall,
      this.castVortexRetention,
      this.castMeteorBreach
    ];
  }

  spawnWaveState(config) {
    const core = this.scene.add.graphics().setDepth(8);
    const glow = this.scene.add.graphics().setDepth(7);
    this._trackHazardObject?.(core);
    this._trackHazardObject?.(glow);
    this._waveHazards.push({
      ...config,
      core,
      glow,
      tickAt: 0,
      startedAt: Number(this.scene.time?.now || 0)
    });
  }

  updateWaves(time) {
    const rect = getWorldRect(this.scene);
    const now = Number(time || this.scene?.time?.now || 0);
    const target = this.getPrimaryTarget();
    let writeIndex = 0;

    for (let index = 0; index < this._waveHazards.length; index += 1) {
      const wave = this._waveHazards[index];
      if (!wave?.core?.active || !wave?.glow?.active) {
        destroyDisplayObject(wave?.core);
        destroyDisplayObject(wave?.glow);
        continue;
      }

      const progress = Phaser.Math.Clamp((now - wave.startedAt) / Math.max(1, wave.durationMs), 0, 1);
      if (progress >= 1) {
        destroyDisplayObject(wave.core);
        destroyDisplayObject(wave.glow);
        continue;
      }

      const pulse = 0.90 + (0.10 * Math.sin((now * 0.01) + index));
      const currentAxis = Phaser.Math.Linear(wave.startAxis, wave.endAxis, progress);
      const gapStart = wave.gapCenter - (wave.gapSize * 0.5);
      const gapEnd = wave.gapCenter + (wave.gapSize * 0.5);
      const segments = wave.orientation === 'vertical'
        ? [
            { x1: currentAxis, y1: rect.y + 20, x2: currentAxis, y2: gapStart },
            { x1: currentAxis, y1: gapEnd, x2: currentAxis, y2: rect.y + rect.height - 20 }
          ]
        : [
            { x1: rect.x + 20, y1: currentAxis, x2: gapStart, y2: currentAxis },
            { x1: gapEnd, y1: currentAxis, x2: rect.x + rect.width - 20, y2: currentAxis }
          ];

      wave.glow.clear();
      wave.core.clear();
      segments.forEach((segment) => {
        wave.glow.lineStyle(wave.width + 14, DEVOURER_GLOW, 0.12 * pulse);
        wave.glow.beginPath();
        wave.glow.moveTo(segment.x1, segment.y1);
        wave.glow.lineTo(segment.x2, segment.y2);
        wave.glow.strokePath();

        wave.core.lineStyle(wave.width, DEVOURER_COLOR, 0.92 * pulse);
        wave.core.beginPath();
        wave.core.moveTo(segment.x1, segment.y1);
        wave.core.lineTo(segment.x2, segment.y2);
        wave.core.strokePath();
      });

      if (target?.active && target.isAlive !== false && now >= wave.tickAt) {
        const point = getTargetPoint(target);
        if (point) {
          let isHit = false;
          if (wave.orientation === 'vertical') {
            isHit = Math.abs(point.x - currentAxis) <= ((wave.width * 0.5) + point.radius)
              && !(point.y >= gapStart && point.y <= gapEnd);
          } else {
            isHit = Math.abs(point.y - currentAxis) <= ((wave.width * 0.5) + point.radius)
              && !(point.x >= gapStart && point.x <= gapEnd);
          }
          if (isHit) {
            damageTarget(target, wave.damage, this.scene, point.x, point.y, DEVOURER_COLOR);
            wave.tickAt = now + wave.tickIntervalMs;
          }
        }
      }

      this._waveHazards[writeIndex++] = wave;
    }

    this._waveHazards.length = writeIndex;
  }

  updateMeteors(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    const target = this.getPrimaryTarget();
    let writeIndex = 0;

    for (let index = 0; index < this._meteorHazards.length; index += 1) {
      const meteor = this._meteorHazards[index];
      if (!meteor?.core?.active || !meteor?.glow?.active) {
        destroyDisplayObject(meteor?.core);
        destroyDisplayObject(meteor?.glow);
        continue;
      }

      const progress = Phaser.Math.Clamp((now - meteor.startedAt) / Math.max(1, meteor.travelMs), 0, 1);
      meteor.x = Phaser.Math.Linear(meteor.startX, meteor.endX, progress);
      meteor.y = Phaser.Math.Linear(meteor.startY, meteor.endY, progress);
      const pulse = 0.86 + (0.14 * Math.sin((now * 0.013) + index));

      meteor.glow.clear();
      meteor.glow.fillStyle(DEVOURER_GLOW, 0.10 * pulse);
      meteor.glow.fillCircle(meteor.x, meteor.y, meteor.radius + 10);

      meteor.core.clear();
      meteor.core.fillStyle(DEVOURER_COLOR, 0.84 * pulse);
      meteor.core.fillCircle(meteor.x, meteor.y, meteor.radius);
      meteor.core.lineStyle(2, DEVOURER_CORE, 0.72 * pulse);
      meteor.core.strokeCircle(meteor.x, meteor.y, meteor.radius - 2);

      if (target?.active && target.isAlive !== false && now >= meteor.tickAt) {
        const point = getTargetPoint(target);
        const hitRadius = meteor.radius + (point?.radius || 0);
        if (point && Math.hypot(point.x - meteor.x, point.y - meteor.y) <= hitRadius) {
          damageTarget(target, meteor.damage, this.scene, point.x, point.y, DEVOURER_COLOR);
          meteor.tickAt = now + 240;
        }
      }

      if (progress >= 1) {
        this.scene.patternSystem?.emitRing?.({
          side: 'boss',
          x: meteor.endX,
          y: meteor.endY,
          count: 8,
          speed: 140,
          color: DEVOURER_COLOR,
          radius: 7,
          damage: this.scaleAttackDamage(8, 5),
          tags: ['boss_tide_devourer_meteor'],
          options: {
            type: 'circle',
            hasTrail: true,
            trailColor: DEVOURER_GLOW,
            hasGlow: false
          }
        });
        destroyDisplayObject(meteor.core);
        destroyDisplayObject(meteor.glow);
        continue;
      }

      this._meteorHazards[writeIndex++] = meteor;
    }

    this._meteorHazards.length = writeIndex;
  }

  castSeaWall() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const rect = getWorldRect(this.scene);
    const telegraphMs = 680;
    const count = phase >= 3 ? 2 : 1;
    const orientation = this._waveOrientationToggle % 2 === 0 ? 'vertical' : 'horizontal';
    this._waveOrientationToggle += 1;
    this.showAlertIcon(telegraphMs);

    for (let index = 0; index < count; index += 1) {
      const gapCenter = orientation === 'vertical'
        ? Phaser.Math.Clamp(targetPoint.y + ((index === 0 ? -1 : 1) * (phase >= 3 ? 70 : 0)), rect.y + 120, rect.y + rect.height - 120)
        : Phaser.Math.Clamp(targetPoint.x + ((index === 0 ? -1 : 1) * (phase >= 3 ? 90 : 0)), rect.x + 120, rect.x + rect.width - 120);
      const inward = (index + phase) % 2 === 0;
      const startAxis = orientation === 'vertical'
        ? (inward ? rect.x - 36 : rect.x + rect.width + 36)
        : (inward ? rect.y - 36 : rect.y + rect.height + 36);
      const endAxis = orientation === 'vertical'
        ? (inward ? rect.x + rect.width + 36 : rect.x - 36)
        : (inward ? rect.y + rect.height + 36 : rect.y - 36);
      const telegraph = this.scene.patternSystem?.emitGroundTelegraph?.({
        x: orientation === 'vertical' ? startAxis : rect.x + (rect.width * 0.5),
        y: orientation === 'vertical' ? rect.y + (rect.height * 0.5) : startAxis,
        shape: 'line',
        angle: orientation === 'vertical' ? Math.PI * 0.5 : 0,
        telegraphWidth: phase >= 3 ? 40 : 34,
        telegraphLength: orientation === 'vertical' ? rect.height : rect.width,
        telegraphColor: DEVOURER_GLOW,
        durationMs: telegraphMs
      });
      if (telegraph) this._trackHazardObject?.(telegraph);

      const timer = this.scene.time?.delayedCall?.(telegraphMs, () => {
        if (!this.isAlive || this.isDestroyed) return;
        this.spawnWaveState({
          orientation,
          gapCenter,
          gapSize: phase >= 3 ? 130 : 160,
          startAxis,
          endAxis,
          durationMs: phase >= 3 ? 2200 : 2600,
          width: phase >= 3 ? 42 : 36,
          damage: this.scaleAttackDamage(phase >= 3 ? 10 : 8, 5),
          tickIntervalMs: phase >= 3 ? 200 : 260
        });
      });
      if (timer) this._trackHazardTimer?.(timer);
    }
  }

  castVortexRetention() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const count = phase >= 3 ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const angle = ((Math.PI * 2) / count) * index + Math.random() * 0.25;
      const point = clampWorldPoint(this.scene, targetPoint.x + (Math.cos(angle) * 120), targetPoint.y + (Math.sin(angle) * 120), 96);
      spawnPersistentCircleHazard(this.scene, this, this._vortexHazards, {
        x: point.x,
        y: point.y,
        radius: phase >= 3 ? 76 : 64,
        color: DEVOURER_VORTEX,
        glowColor: DEVOURER_GLOW,
        durationMs: 3600,
        damage: this.scaleAttackDamage(phase >= 3 ? 9 : 7, 4),
        tickIntervalMs: 300,
        alpha: 0.16,
        strokeAlpha: 0.82
      });
    }
  }

  castMeteorBreach() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const rect = getWorldRect(this.scene);
    const phase = this.getPhase();
    const count = phase >= 3 ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 'left' : 'right';
      const startX = side === 'left' ? rect.x + 30 : rect.x + rect.width - 30;
      const startY = rect.y + 120 + (index * 110);
      const point = clampWorldPoint(this.scene, targetPoint.x + ((index - 0.5) * 90), targetPoint.y + ((index % 2 === 0 ? -1 : 1) * 80), 90);
      const core = this.scene.add.graphics().setDepth(8);
      const glow = this.scene.add.graphics().setDepth(7);
      this._trackHazardObject?.(core);
      this._trackHazardObject?.(glow);
      this._meteorHazards.push({
        startX,
        startY,
        endX: point.x,
        endY: point.y,
        x: startX,
        y: startY,
        radius: 14,
        travelMs: phase >= 3 ? 1500 : 1800,
        startedAt: Number(this.scene.time?.now || 0),
        tickAt: 0,
        damage: this.scaleAttackDamage(phase >= 3 ? 10 : 8, 5),
        core,
        glow
      });
    }
  }
}