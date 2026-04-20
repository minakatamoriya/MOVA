import Phaser from 'phaser';
import FormalBossBase from './FormalBossBase';
import {
  clampWorldPoint,
  damageTarget,
  destroyDisplayObject,
  distanceBetween,
  getTargetPoint,
  getWorldRect,
  spawnPersistentCircleHazard
} from './formalBossUtils';

const STAR_DARK = 0x1d2435;
const STAR_DARK_GLOW = 0x5a6986;
const STAR_LIGHT = 0xe8f0c9;
const STAR_LIGHT_GLOW = 0xf7ffd8;

export default class StarRoyalistBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '王庭观星者',
      color: STAR_LIGHT,
      intervalByPhase: { 1: 3180, 2: 2660, 3: 2220 },
      hitReactionCdMs: 760
    });

    this._polarity = 'dark';
    this._zoneGraphics = [];
    this._zones = [];
    this._starProjectiles = [];
    this._bombHazards = [];
    this._polarityStableUntil = 0;
    this.rebuildOppositionZones();
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    this.updateZones(time);
    this.updateStarProjectiles(time);
    this.updateBombHazards(time);
  }

  destroy() {
    this._zoneGraphics.forEach((graphic) => destroyDisplayObject(graphic));
    this._starProjectiles.forEach((star) => {
      destroyDisplayObject(star?.core);
      destroyDisplayObject(star?.glow);
    });
    this._bombHazards.forEach((hazard) => {
      destroyDisplayObject(hazard?.core);
      destroyDisplayObject(hazard?.glow);
    });
    this._zoneGraphics = [];
    this._zones = [];
    this._starProjectiles = [];
    this._bombHazards = [];
    super.destroy();
  }

  getCycleSequence() {
    return [
      this.castPolarityShift,
      this.castOppositionZones,
      this.castDualBarrage
    ];
  }

  getPolarityColors(type = this._polarity) {
    return type === 'dark'
      ? { core: STAR_DARK, glow: STAR_DARK_GLOW }
      : { core: STAR_LIGHT, glow: STAR_LIGHT_GLOW };
  }

  rebuildOppositionZones() {
    this._zoneGraphics.forEach((graphic) => destroyDisplayObject(graphic));
    this._zoneGraphics = [];
    this._zones = [];

    const rect = getWorldRect(this.scene);
    const centerY = rect.y + (rect.height * 0.5);
    const phase = this.getPhase();
    if (phase === 1) {
      this._zones.push(
        { x: rect.x + (rect.width * 0.28), y: centerY, radius: 196, colorType: 'dark' },
        { x: rect.x + (rect.width * 0.72), y: centerY, radius: 196, colorType: 'light' }
      );
    } else if (phase === 2) {
      this._zones.push(
        { x: rect.x + (rect.width * 0.24), y: centerY, radius: 148, colorType: 'dark' },
        { x: rect.x + (rect.width * 0.76), y: centerY, radius: 148, colorType: 'light' },
        { x: rect.x + (rect.width * 0.5), y: centerY, radius: 104, colorType: this._polarity === 'dark' ? 'light' : 'dark' }
      );
    } else {
      this._zones.push(
        { x: rect.x + (rect.width * 0.28), y: rect.y + (rect.height * 0.34), radius: 110, colorType: 'dark' },
        { x: rect.x + (rect.width * 0.72), y: rect.y + (rect.height * 0.34), radius: 110, colorType: 'light' },
        { x: rect.x + (rect.width * 0.34), y: rect.y + (rect.height * 0.70), radius: 102, colorType: 'light' },
        { x: rect.x + (rect.width * 0.66), y: rect.y + (rect.height * 0.70), radius: 102, colorType: 'dark' }
      );
    }

    this._zones.forEach((zone) => {
      const graphic = this.scene.add.graphics().setDepth(6);
      this._trackHazardObject?.(graphic);
      this._zoneGraphics.push(graphic);
      zone.graphic = graphic;
    });
  }

  updateZones(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    this._zones.forEach((zone, index) => {
      if (!zone?.graphic?.active) return;
      const colors = this.getPolarityColors(zone.colorType);
      const isDamageZone = zone.colorType === this._polarity;
      const pulse = 0.86 + (0.14 * Math.sin((now * 0.008) + index));
      zone.graphic.clear();
      zone.graphic.fillStyle(colors.core, isDamageZone ? 0.18 * pulse : 0.10 * pulse);
      zone.graphic.fillCircle(zone.x, zone.y, zone.radius);
      zone.graphic.lineStyle(4, colors.glow, isDamageZone ? 0.82 * pulse : 0.52 * pulse);
      zone.graphic.strokeCircle(zone.x, zone.y, zone.radius);
    });
  }

  getPlayerZoneColor() {
    const point = getTargetPoint(this.getPrimaryTarget());
    if (!point) return null;

    let picked = null;
    let bestDist = Infinity;
    this._zones.forEach((zone) => {
      const dist = distanceBetween(point.x, point.y, zone.x, zone.y);
      if (dist <= (zone.radius + point.radius) && dist < bestDist) {
        bestDist = dist;
        picked = zone.colorType;
      }
    });
    return picked;
  }

  canPlayerDamageBoss() {
    const zoneColor = this.getPlayerZoneColor();
    return !!zoneColor && zoneColor !== this._polarity;
  }

  isStableWindowActive(now = this.scene?.time?.now ?? 0) {
    return (this._polarityStableUntil || 0) > now;
  }

  takeDamage(damage, context = {}) {
    if (!this.canPlayerDamageBoss()) {
      this.scene?.vfxSystem?.playCastFlash?.(this.x, this.y, {
        color: this._polarity === 'dark' ? STAR_DARK_GLOW : STAR_LIGHT_GLOW,
        radius: 30,
        durationMs: 120
      });
      return 0;
    }
    return super.takeDamage(damage, context);
  }

  spawnStarProjectile(angle, colorType) {
    const core = this.scene.add.graphics().setDepth(8);
    const glow = this.scene.add.graphics().setDepth(7);
    this._trackHazardObject?.(core);
    this._trackHazardObject?.(glow);
    this._starProjectiles.push({
      x: this.x,
      y: this.y,
      angle,
      speed: this.getPhase() >= 3 ? 210 : 185,
      radius: 9,
      damage: this.scaleAttackDamage(this.getPhase() >= 3 ? 10 : 8, 5),
      colorType,
      expiresAt: Number(this.scene.time?.now || 0) + 2800,
      tickAt: 0,
      core,
      glow
    });
  }

  updateStarProjectiles(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    const target = this.getPrimaryTarget();
    let writeIndex = 0;
    for (let index = 0; index < this._starProjectiles.length; index += 1) {
      const star = this._starProjectiles[index];
      if (!star?.core?.active || !star?.glow?.active || now >= star.expiresAt) {
        destroyDisplayObject(star?.core);
        destroyDisplayObject(star?.glow);
        continue;
      }

      star.x += Math.cos(star.angle) * star.speed * 0.016;
      star.y += Math.sin(star.angle) * star.speed * 0.016;
      const colors = this.getPolarityColors(star.colorType);
      const isReal = star.colorType === this._polarity && !this.isStableWindowActive(now);
      const alpha = isReal ? 0.92 : 0.28;

      star.glow.clear();
      star.glow.fillStyle(colors.glow, 0.10 * alpha);
      star.glow.fillCircle(star.x, star.y, star.radius + 8);

      star.core.clear();
      star.core.fillStyle(colors.core, alpha);
      star.core.fillCircle(star.x, star.y, star.radius);
      star.core.lineStyle(2, colors.glow, alpha);
      star.core.strokeCircle(star.x, star.y, star.radius - 2);

      if (isReal && target?.active && target.isAlive !== false && now >= star.tickAt) {
        const point = getTargetPoint(target);
        const hitRadius = star.radius + (point?.radius || 0);
        if (point && distanceBetween(star.x, star.y, point.x, point.y) <= hitRadius) {
          damageTarget(target, star.damage, this.scene, point.x, point.y, colors.core);
          star.tickAt = now + 240;
        }
      }

      this._starProjectiles[writeIndex++] = star;
    }

    this._starProjectiles.length = writeIndex;
  }

  updateBombHazards(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    const target = this.getPrimaryTarget();
    let writeIndex = 0;
    for (let index = 0; index < this._bombHazards.length; index += 1) {
      const hazard = this._bombHazards[index];
      if (!hazard?.core?.active || !hazard?.glow?.active || now >= hazard.expiresAt) {
        destroyDisplayObject(hazard?.core);
        destroyDisplayObject(hazard?.glow);
        continue;
      }

      const colors = this.getPolarityColors(hazard.colorType);
      const isReal = hazard.colorType === this._polarity && !this.isStableWindowActive(now);
      const pulse = 0.88 + (0.12 * Math.sin((now * 0.01) + index));
      hazard.glow.clear();
      hazard.glow.fillStyle(colors.glow, (isReal ? 0.10 : 0.05) * pulse);
      hazard.glow.fillCircle(hazard.x, hazard.y, hazard.radius + 10);
      hazard.core.clear();
      hazard.core.fillStyle(colors.core, (isReal ? 0.18 : 0.08) * pulse);
      hazard.core.fillCircle(hazard.x, hazard.y, hazard.radius);
      hazard.core.lineStyle(4, colors.glow, (isReal ? 0.88 : 0.34) * pulse);
      hazard.core.strokeCircle(hazard.x, hazard.y, hazard.radius);

      if (isReal && target?.active && target.isAlive !== false && now >= hazard.tickAt) {
        const point = getTargetPoint(target);
        if (point && distanceBetween(hazard.x, hazard.y, point.x, point.y) <= (hazard.radius + point.radius)) {
          damageTarget(target, hazard.damage, this.scene, point.x, point.y, colors.core);
          hazard.tickAt = now + 320;
        }
      }

      this._bombHazards[writeIndex++] = hazard;
    }

    this._bombHazards.length = writeIndex;
  }

  castPolarityShift() {
    const telegraphMs = this.getPhase() >= 2 ? 480 : 620;
    this.showAlertIcon(telegraphMs);
    const current = this.getPolarityColors(this._polarity);
    this.scene?.vfxSystem?.playCharge?.(this.x, this.y, {
      radius: 26,
      color: current.glow,
      durationMs: 220
    });
    const timer = this.scene.time?.delayedCall?.(telegraphMs, () => {
      this._polarity = this._polarity === 'dark' ? 'light' : 'dark';
      const stableMs = this.getPhase() >= 3 ? 480 : (this.getPhase() >= 2 ? 620 : 760);
      this._polarityStableUntil = Number(this.scene?.time?.now || 0) + stableMs;
      this.rebuildOppositionZones();
    });
    if (timer) this._trackHazardTimer?.(timer);
  }

  castOppositionZones() {
    this.rebuildOppositionZones();
    this.scene?.vfxSystem?.playBurst?.(this.x, this.y, {
      radius: 34,
      color: this.getPolarityColors(this._polarity).glow,
      durationMs: 180
    });
  }

  castDualBarrage() {
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!targetPoint) return;

    const phase = this.getPhase();
    const baseAngle = Math.atan2(targetPoint.y - this.y, targetPoint.x - this.x);
    const count = phase >= 3 ? 8 : (phase >= 2 ? 6 : 4);
    const spread = Phaser.Math.DegToRad(phase >= 3 ? 12 : 16);
    const half = (count - 1) * 0.5;
    for (let index = 0; index < count; index += 1) {
      const colorType = index % 2 === 0 ? 'dark' : 'light';
      this.spawnStarProjectile(baseAngle + ((index - half) * spread), colorType);
    }

    const bombCount = phase >= 3 ? 3 : (phase >= 2 ? 2 : 1);
    for (let index = 0; index < bombCount; index += 1) {
      const angle = ((Math.PI * 2) / bombCount) * index + Math.random() * 0.3;
      const point = clampWorldPoint(this.scene, targetPoint.x + (Math.cos(angle) * 110), targetPoint.y + (Math.sin(angle) * 110), 96);
      const hazard = spawnPersistentCircleHazard(this.scene, this, [], {
        x: point.x,
        y: point.y,
        radius: phase >= 3 ? 58 : 46,
        color: this.getPolarityColors(index % 2 === 0 ? 'dark' : 'light').core,
        glowColor: this.getPolarityColors(index % 2 === 0 ? 'dark' : 'light').glow,
        durationMs: 2200,
        damage: this.scaleAttackDamage(phase >= 3 ? 10 : 8, 5),
        tickIntervalMs: 320,
        alpha: 0.16,
        strokeAlpha: 0.82
      });
      if (hazard) {
        hazard.colorType = index % 2 === 0 ? 'dark' : 'light';
        this._bombHazards.push(hazard);
      }
    }
  }
}