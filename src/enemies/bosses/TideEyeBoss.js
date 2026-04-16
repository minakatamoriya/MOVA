import Phaser from 'phaser';
import FormalBossBase from './FormalBossBase';
import {
  clearTrackedHazards,
  damageTarget,
  destroyDisplayObject,
  distanceBetween,
  getTargetPoint
} from './formalBossUtils';

const TIDE_COLOR = 0x7c56d6;
const TIDE_GLOW = 0xbba0ff;
const TIDE_CORE = 0xe6dcff;
const TIDE_RING = 0x1f1736;

export default class TideEyeBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '归潮魔眼',
      color: TIDE_COLOR,
      intervalByPhase: { 1: 3200, 2: 2720, 3: 2280 },
      hitReactionCdMs: 820
    });

    this._voidOrbs = [];
    this._collapsePending = false;
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    this.updateVoidOrbs(time, delta);
  }

  destroy() {
    clearTrackedHazards(this._voidOrbs, ['core', 'glow']);
    super.destroy();
  }

  getCycleSequence() {
    return [
      this.castVoidRelease,
      this.castVoidRelease,
      this.castCollapseRing
    ];
  }

  spawnVoidOrb(angle, maxDistance, outwardMs) {
    const scene = this.scene;
    if (!scene?.add) return;

    const core = scene.add.graphics().setDepth(8);
    const glow = scene.add.graphics().setDepth(7);
    this._trackHazardObject?.(core);
    this._trackHazardObject?.(glow);

    this._voidOrbs.push({
      originX: this.x,
      originY: this.y,
      x: this.x,
      y: this.y,
      angle,
      maxDistance,
      outwardMs,
      returnSpeed: this.getPhase() >= 2 ? 295 : 255,
      radius: this.getPhase() >= 3 ? 17 : 15,
      damage: this.scaleAttackDamage(this.getPhase() >= 3 ? 9 : 7, 5),
      tickAt: 0,
      state: 'outbound',
      startedAt: Number(scene.time?.now || 0),
      core,
      glow
    });
  }

  updateVoidOrbs(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    const target = this.getPrimaryTarget();
    let writeIndex = 0;

    for (let index = 0; index < this._voidOrbs.length; index += 1) {
      const orb = this._voidOrbs[index];
      if (!orb?.core?.active || !orb?.glow?.active) {
        destroyDisplayObject(orb?.core);
        destroyDisplayObject(orb?.glow);
        continue;
      }

      const elapsed = now - orb.startedAt;
      if (orb.state === 'outbound') {
        const progress = Phaser.Math.Clamp(elapsed / Math.max(1, orb.outwardMs), 0, 1);
        const distance = orb.maxDistance * progress;
        orb.x = orb.originX + (Math.cos(orb.angle) * distance);
        orb.y = orb.originY + (Math.sin(orb.angle) * distance);
        if (progress >= 1) orb.state = 'returning';
      } else {
        const dx = this.x - orb.x;
        const dy = this.y - orb.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= orb.returnSpeed * 0.016) {
          destroyDisplayObject(orb.core);
          destroyDisplayObject(orb.glow);
          continue;
        }

        orb.x += (dx / Math.max(1, dist)) * orb.returnSpeed * 0.016;
        orb.y += (dy / Math.max(1, dist)) * orb.returnSpeed * 0.016;
      }

      const pulse = 0.85 + (0.15 * Math.sin((now * 0.012) + index));
      orb.glow.clear();
      orb.glow.fillStyle(TIDE_GLOW, 0.14 * pulse);
      orb.glow.fillCircle(orb.x, orb.y, orb.radius + 10);

      orb.core.clear();
      orb.core.fillStyle(TIDE_COLOR, 0.88 * pulse);
      orb.core.fillCircle(orb.x, orb.y, orb.radius);
      orb.core.lineStyle(2, TIDE_CORE, 0.82 * pulse);
      orb.core.strokeCircle(orb.x, orb.y, Math.max(6, orb.radius - 4));

      if (target?.active && target.isAlive !== false && now >= orb.tickAt) {
        const point = getTargetPoint(target);
        const hitRadius = orb.radius + (point?.radius || 0);
        if (point && distanceBetween(orb.x, orb.y, point.x, point.y) <= hitRadius) {
          damageTarget(target, orb.damage, this.scene, point.x, point.y, TIDE_COLOR);
          orb.tickAt = now + 240;
        }
      }

      this._voidOrbs[writeIndex++] = orb;
    }

    this._voidOrbs.length = writeIndex;

    if (this._collapsePending && this._voidOrbs.length <= 0) {
      this._collapsePending = false;
      this.castCollapseRing(true);
    }
  }

  castVoidRelease() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const count = phase >= 3 ? 8 : (phase >= 2 ? 6 : 5);
    const spread = Phaser.Math.DegToRad(phase >= 2 ? 18 : 24);
    const baseAngle = Math.atan2(targetPoint.y - this.y, targetPoint.x - this.x);
    const half = (count - 1) * 0.5;
    const maxDistance = phase >= 3 ? 280 : 240;
    const outwardMs = phase >= 2 ? 650 : 820;

    this.showAlertIcon(520);
    this.scene?.vfxSystem?.playCharge?.(this.x, this.y, {
      radius: 24,
      color: TIDE_GLOW,
      durationMs: 240
    });

    for (let index = 0; index < count; index += 1) {
      const angle = baseAngle + ((index - half) * spread);
      this.spawnVoidOrb(angle, maxDistance, outwardMs);
    }

    this._collapsePending = phase >= 3;
  }

  castCollapseRing(forceImmediate = false) {
    const scene = this.scene;
    if (!scene?.patternSystem) return;

    if (!forceImmediate && this._voidOrbs.length > 0) {
      this._collapsePending = true;
      return;
    }

    const phase = this.getPhase();
    const telegraphMs = 520;
    const telegraph = scene.patternSystem.emitGroundTelegraph({
      x: this.x,
      y: this.y,
      telegraphRadius: phase >= 3 ? 118 : 92,
      telegraphColor: TIDE_RING,
      durationMs: telegraphMs
    });
    if (telegraph) this._trackHazardObject?.(telegraph);
    this.showAlertIcon(telegraphMs);

    const timer = scene.time?.delayedCall?.(telegraphMs, () => {
      if (!this.isAlive || this.isDestroyed) return;
      scene.vfxSystem?.playBurst?.(this.x, this.y, {
        radius: phase >= 3 ? 126 : 100,
        color: TIDE_GLOW,
        durationMs: 180
      });
      scene.patternSystem.emitRing({
        side: 'boss',
        x: this.x,
        y: this.y,
        count: phase >= 3 ? 16 : 12,
        speed: phase >= 3 ? 185 : 160,
        color: TIDE_COLOR,
        radius: 8,
        damage: this.scaleAttackDamage(phase >= 3 ? 11 : 9, 6),
        tags: ['boss_tide_eye_collapse'],
        options: {
          type: 'circle',
          hasTrail: true,
          trailColor: TIDE_GLOW,
          hasGlow: false
        }
      });
    });
    if (timer) this._trackHazardTimer?.(timer);
  }
}