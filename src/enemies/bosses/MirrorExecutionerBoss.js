import Phaser from 'phaser';
import BaseBoss from './BaseBoss';

const MIRROR_COLOR = 0xff7a3d;
const MIRROR_GLOW = 0xffc27a;
const MIRROR_CORE = 0xfff2d8;
const BURN_COLOR = 0xffb347;

const NORMAL_INTERVAL_MS = 2800;
const ENRAGED_INTERVAL_MS = 2250;
const ENRAGE_HP_RATIO = 0.5;

function getTargetPoint(target) {
  if (!target) return null;
  if (typeof target.getHitboxPosition === 'function') {
    const hitbox = target.getHitboxPosition();
    if (hitbox && Number.isFinite(hitbox.x) && Number.isFinite(hitbox.y)) {
      return {
        x: hitbox.x,
        y: hitbox.y,
        radius: Math.max(0, Number(hitbox.radius || 0))
      };
    }
  }

  return {
    x: Number(target.x || 0),
    y: Number(target.y || 0),
    radius: Math.max(0, Number(target.hitRadius || target.visualRadius || 16))
  };
}

function closestPointOnSegment(ax, ay, bx, by, px, py) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLen2 = (abx * abx) + (aby * aby);
  if (abLen2 <= 0.00001) {
    return { x: ax, y: ay, t: 0 };
  }

  const apx = px - ax;
  const apy = py - ay;
  const t = Phaser.Math.Clamp(((apx * abx) + (apy * aby)) / abLen2, 0, 1);
  return {
    x: ax + (abx * t),
    y: ay + (aby * t),
    t
  };
}

function createMirrorGlyph(scene, size, fillColor, strokeColor, fillAlpha = 0.88) {
  const half = Math.max(6, Number(size || 14));
  const g = scene.add.graphics();
  g.fillStyle(fillColor, fillAlpha);
  g.lineStyle(Math.max(2, Math.round(half * 0.18)), strokeColor, 0.96);
  g.beginPath();
  g.moveTo(0, -half);
  g.lineTo(half * 0.68, 0);
  g.lineTo(0, half);
  g.lineTo(-half * 0.68, 0);
  g.closePath();
  g.fillPath();
  g.strokePath();
  return g;
}

function destroyDisplayObject(obj) {
  try {
    if (obj?.active) obj.destroy();
  } catch (_) {
    // ignore
  }
}

export default class MirrorExecutionerBoss extends BaseBoss {
  constructor(scene, config = {}) {
    const attackPatterns = [
      {
        interval: NORMAL_INTERVAL_MS,
        execute: (boss) => boss.executeMirrorCycle()
      }
    ];

    super(scene, {
      ...config,
      name: config.name || '灼镜行刑官',
      color: config.color ?? MIRROR_COLOR,
      attackPatterns,
      hitReactionType: config.hitReactionType || 'ranged_blast',
      hitReactionCdMs: config.hitReactionCdMs ?? 900
    });

    this._mirrorCycleIndex = 0;
    this._orbitMirrors = [];
    this._activeMirrorLasers = [];
    this._activeMirrorAnchors = [];

    this.createOrbitMirrors();
  }

  isEnraged() {
    if (!this.isAlive || !this.maxHp) return false;
    return (this.currentHp / this.maxHp) <= ENRAGE_HP_RATIO;
  }

  createOrbitMirrors() {
    if (!this.scene?.add) return;
    for (let index = 0; index < 2; index += 1) {
      const glyph = createMirrorGlyph(this.scene, 12, MIRROR_GLOW, MIRROR_CORE, 0.70);
      glyph.setDepth(11);
      glyph.alpha = 0.82;
      this.add(glyph);
      this._orbitMirrors.push(glyph);
    }
  }

  update(time, delta) {
    super.update(time, delta);
    if (this.isDestroyed || !this.isAlive) return;

    this.updateOrbitMirrors(time, delta);
    this.updateMirrorLasers(time);
    this.updateMirrorAnchors(time);
  }

  updateOrbitMirrors(time, delta) {
    if (!Array.isArray(this._orbitMirrors) || this._orbitMirrors.length <= 0) return;
    const orbitRadius = Math.max(22, Math.round((this.bossSize || 50) * 0.44));
    const t = Number(time || 0) * 0.0024;
    const rageScale = this.isEnraged() ? 1.18 : 1;

    this._orbitMirrors.forEach((glyph, index) => {
      if (!glyph?.active) return;
      const angle = t + (index * Math.PI);
      glyph.x = Math.cos(angle) * orbitRadius;
      glyph.y = -Math.max(8, Math.round((this.bossSize || 50) * 0.16)) + (Math.sin(angle) * orbitRadius * 0.36);
      glyph.rotation = angle + Math.PI / 4;
      glyph.scaleX = 0.92 + (Math.sin(t * 2.1 + index) * 0.06 * rageScale);
      glyph.scaleY = 0.92 + (Math.cos(t * 1.7 + index) * 0.06 * rageScale);
      glyph.alpha = 0.64 + (0.12 * Math.sin((Number(time || 0) * 0.006) + index));
    });
  }

  updateMirrorAnchors(time) {
    if (!Array.isArray(this._activeMirrorAnchors) || this._activeMirrorAnchors.length <= 0) return;
    const now = Number(time || this.scene?.time?.now || 0);
    let writeIndex = 0;

    for (let index = 0; index < this._activeMirrorAnchors.length; index += 1) {
      const anchor = this._activeMirrorAnchors[index];
      if (!anchor?.glyph?.active || now >= (anchor.expiresAt || 0)) {
        destroyDisplayObject(anchor?.glyph);
        continue;
      }

      const pulse = 0.92 + (0.10 * Math.sin((now * 0.01) + index));
      anchor.glyph.scale = pulse;
      anchor.glyph.rotation += 0.012;
      this._activeMirrorAnchors[writeIndex++] = anchor;
    }

    this._activeMirrorAnchors.length = writeIndex;
  }

  updateMirrorLasers(time) {
    if (!Array.isArray(this._activeMirrorLasers) || this._activeMirrorLasers.length <= 0) return;
    const now = Number(time || this.scene?.time?.now || 0);
    let writeIndex = 0;

    for (let index = 0; index < this._activeMirrorLasers.length; index += 1) {
      const state = this._activeMirrorLasers[index];
      if (!state?.core?.active || !state?.glow?.active || now >= (state.expiresAt || 0)) {
        this.destroyMirrorLaser(state);
        continue;
      }

      const progress = Phaser.Math.Clamp((now - state.startedAt) / Math.max(1, state.durationMs), 0, 1);
      const angle = Number.isFinite(state.endAngle)
        ? Phaser.Math.Interpolation.Linear([state.startAngle, state.endAngle], progress)
        : state.startAngle;

      const originX = state.followBoss ? this.x : state.x;
      const originY = state.followBoss ? this.y : state.y;
      const halfLength = state.centered ? (state.length * 0.5) : 0;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const start = {
        x: originX - (dirX * halfLength),
        y: originY - (dirY * halfLength)
      };
      const end = {
        x: originX + (dirX * (state.centered ? halfLength : state.length)),
        y: originY + (dirY * (state.centered ? halfLength : state.length))
      };

      this.drawMirrorLaser(state, start, end, progress);
      this.tryMirrorLaserDamage(state, start, end, now);
      this._activeMirrorLasers[writeIndex++] = state;
    }

    this._activeMirrorLasers.length = writeIndex;
  }

  drawMirrorLaser(state, start, end, progress) {
    const fade = progress >= 0.85 ? (1 - ((progress - 0.85) / 0.15)) : 1;
    const beamAlpha = Phaser.Math.Clamp(fade, 0.18, 1);
    const glowWidth = Math.max(state.width + 12, Math.round(state.width * 1.9));

    state.glow.clear();
    state.glow.lineStyle(glowWidth, state.glowColor, 0.18 * beamAlpha);
    state.glow.beginPath();
    state.glow.moveTo(start.x, start.y);
    state.glow.lineTo(end.x, end.y);
    state.glow.strokePath();

    state.core.clear();
    state.core.lineStyle(state.width, state.color, 0.92 * beamAlpha);
    state.core.beginPath();
    state.core.moveTo(start.x, start.y);
    state.core.lineTo(end.x, end.y);
    state.core.strokePath();

    state.core.lineStyle(Math.max(3, Math.round(state.width * 0.32)), MIRROR_CORE, 0.72 * beamAlpha);
    state.core.beginPath();
    state.core.moveTo(start.x, start.y);
    state.core.lineTo(end.x, end.y);
    state.core.strokePath();

    state.core.fillStyle(state.color, 0.22 * beamAlpha);
    state.core.fillCircle(end.x, end.y, Math.max(6, Math.round(state.width * 0.4)));
  }

  tryMirrorLaserDamage(state, start, end, now) {
    if (now < (state.tickAt || 0)) return;
    const target = this.getPrimaryTarget();
    if (!target?.active || target.isAlive === false || typeof target.takeDamage !== 'function') return;

    const point = getTargetPoint(target);
    if (!point) return;

    const hitPoint = closestPointOnSegment(start.x, start.y, end.x, end.y, point.x, point.y);
    const dx = hitPoint.x - point.x;
    const dy = hitPoint.y - point.y;
    const distSq = (dx * dx) + (dy * dy);
    const hitRadius = Math.max(8, (state.width * 0.5) + (point.radius || 0));
    if (distSq > (hitRadius * hitRadius)) return;

    state.tickAt = now + state.tickIntervalMs;
    target.takeDamage(state.damage);
    this.scene?.createHitEffect?.(hitPoint.x, hitPoint.y, state.color);
  }

  destroyMirrorLaser(state) {
    if (!state) return;
    destroyDisplayObject(state.core);
    destroyDisplayObject(state.glow);
  }

  clearMirrorLasers() {
    if (!Array.isArray(this._activeMirrorLasers)) return;
    this._activeMirrorLasers.forEach((state) => this.destroyMirrorLaser(state));
    this._activeMirrorLasers = [];
  }

  clearMirrorAnchors() {
    if (!Array.isArray(this._activeMirrorAnchors)) return;
    this._activeMirrorAnchors.forEach((anchor) => destroyDisplayObject(anchor?.glyph));
    this._activeMirrorAnchors = [];
  }

  lockAction(durationMs) {
    const now = this.scene?.time?.now ?? 0;
    this._meleeLockUntil = Math.max(this._meleeLockUntil || 0, now + Math.max(0, Math.round(durationMs || 0)));
  }

  executeMirrorCycle() {
    if (!this.isAlive || this.isDestroyed) return;
    const pattern = this.attackPatterns?.[0];
    if (pattern) {
      pattern.interval = this.isEnraged() ? ENRAGED_INTERVAL_MS : NORMAL_INTERVAL_MS;
    }

    const sequence = [
      () => this.castSolarSweep(),
      () => this.castCrossSentence(),
      () => this.castMirrorVolley(),
    ];

    const action = sequence[this._mirrorCycleIndex % sequence.length];
    this._mirrorCycleIndex += 1;
    action?.();
  }

  castSolarSweep() {
    const scene = this.scene;
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!scene?.attackTimeline?.startTimeline || !targetPoint) return;

    const telegraphMs = 760;
    const sweepDurationMs = this.isEnraged() ? 1320 : 1080;
    const sweepArc = Phaser.Math.DegToRad(this.isEnraged() ? 150 : 122);
    const length = this.isEnraged() ? 620 : 560;
    const width = this.isEnraged() ? 30 : 26;
    const damage = this.scaleAttackDamage(12, 8);
    const facing = Phaser.Math.Angle.Between(this.x, this.y, targetPoint.x, targetPoint.y);
    const startAngle = facing - (sweepArc * 0.5);
    const endAngle = facing + (sweepArc * 0.5);

    this.showAlertIcon(telegraphMs);
    this.lockAction(telegraphMs + sweepDurationMs + 120);
    scene.attackTimeline.stopOwnerTimelines?.(this);

    scene.attackTimeline.startTimeline({
      prefix: 'mirror_executioner_sweep',
      owner: this,
      phases: [
        {
          durationMs: telegraphMs + sweepDurationMs + 80,
          onEnter: () => {
            this._playWindupFlash({
              color: MIRROR_COLOR,
              duration: telegraphMs,
              radius: (this.bossSize || 50) + 28
            });
            scene.vfxSystem?.playCharge?.(this.x, this.y, {
              radius: 22,
              color: MIRROR_GLOW,
              durationMs: 280
            });
            [startAngle, facing, endAngle].forEach((angle) => {
              const telegraph = scene.vfxSystem?.playLineTelegraph?.(this.x, this.y, {
                angle,
                width: width + 2,
                length,
                color: MIRROR_GLOW,
                durationMs: telegraphMs
              });
              if (telegraph) this._trackHazardObject(telegraph);
            });
          },
          events: [
            {
              atMs: telegraphMs,
              run: () => {
                scene.vfxSystem?.flashScreen?.({ color: 0xfff2d8, alpha: 0.16, durationMs: 70 });
                this.startMirrorLaser({
                  followBoss: true,
                  startAngle,
                  endAngle,
                  length,
                  width,
                  durationMs: sweepDurationMs,
                  damage,
                  tickIntervalMs: 170,
                  color: BURN_COLOR,
                  glowColor: MIRROR_GLOW
                });
              }
            }
          ]
        }
      ]
    });
  }

  castCrossSentence() {
    const scene = this.scene;
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!scene?.attackTimeline?.startTimeline || !targetPoint) return;

    const telegraphMs = 820;
    const durationMs = this.isEnraged() ? 860 : 680;
    const length = 700;
    const width = this.isEnraged() ? 20 : 16;
    const damage = this.scaleAttackDamage(10, 7);
    const angles = this.isEnraged()
      ? [0, Math.PI * 0.5, Math.PI * 0.25, -Math.PI * 0.25]
      : [0, Math.PI * 0.5];

    this.showAlertIcon(telegraphMs);
    this.lockAction(telegraphMs + durationMs + 120);
    scene.attackTimeline.stopOwnerTimelines?.(this);

    scene.attackTimeline.startTimeline({
      prefix: 'mirror_executioner_cross',
      owner: this,
      phases: [
        {
          durationMs: telegraphMs + durationMs + 120,
          onEnter: () => {
            this._playWindupFlash({
              x: targetPoint.x,
              y: targetPoint.y,
              color: MIRROR_COLOR,
              duration: telegraphMs,
              radius: 44
            });
            const ring = scene.vfxSystem?.playGroundTelegraph?.(targetPoint.x, targetPoint.y, {
              radius: 42,
              color: MIRROR_COLOR,
              durationMs: telegraphMs
            });
            if (ring) this._trackHazardObject(ring);

            angles.forEach((angle) => {
              const telegraph = scene.vfxSystem?.playLineTelegraph?.(targetPoint.x, targetPoint.y, {
                angle,
                width: width + 2,
                length,
                color: MIRROR_GLOW,
                durationMs: telegraphMs
              });
              if (telegraph) this._trackHazardObject(telegraph);
            });
          },
          events: [
            {
              atMs: telegraphMs,
              run: () => {
                scene.vfxSystem?.playBurst?.(targetPoint.x, targetPoint.y, {
                  radius: 56,
                  color: MIRROR_GLOW,
                  durationMs: 220
                });

                angles.forEach((angle) => {
                  this.startMirrorLaser({
                    x: targetPoint.x,
                    y: targetPoint.y,
                    centered: true,
                    startAngle: angle,
                    length,
                    width,
                    durationMs,
                    damage,
                    tickIntervalMs: 190,
                    color: MIRROR_COLOR,
                    glowColor: MIRROR_GLOW
                  });
                });
              }
            }
          ]
        }
      ]
    });
  }

  castMirrorVolley() {
    const scene = this.scene;
    const target = this.getPrimaryTarget();
    const targetPoint = getTargetPoint(target);
    if (!scene?.attackTimeline?.startTimeline || !scene?.patternSystem || !targetPoint) return;

    const telegraphMs = 560;
    const fanCount = this.isEnraged() ? 6 : 5;
    const fanDamage = this.scaleAttackDamage(8, 6);
    const centerDamage = this.scaleAttackDamage(10, 7);
    const blastDamage = this.scaleAttackDamage(7, 5);
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, targetPoint.x, targetPoint.y);
    const forwardX = Math.cos(baseAngle);
    const forwardY = Math.sin(baseAngle);
    const sideX = Math.cos(baseAngle + Math.PI * 0.5);
    const sideY = Math.sin(baseAngle + Math.PI * 0.5);
    const sideDistance = Math.max(88, Math.round((this.bossSize || 50) + 46));
    const rearOffset = 24;
    const anchors = [
      {
        x: this.x + (sideX * sideDistance) - (forwardX * rearOffset),
        y: this.y + (sideY * sideDistance) - (forwardY * rearOffset)
      },
      {
        x: this.x - (sideX * sideDistance) - (forwardX * rearOffset),
        y: this.y - (sideY * sideDistance) - (forwardY * rearOffset)
      }
    ];

    this.showAlertIcon(telegraphMs);
    this.lockAction(telegraphMs + 700);
    scene.attackTimeline.stopOwnerTimelines?.(this);

    scene.attackTimeline.startTimeline({
      prefix: 'mirror_executioner_volley',
      owner: this,
      phases: [
        {
          durationMs: telegraphMs + 760,
          onEnter: () => {
            this.clearMirrorAnchors();
            anchors.forEach((anchor) => {
              const glyph = createMirrorGlyph(scene, 16, MIRROR_GLOW, MIRROR_CORE, 0.80);
              glyph.setPosition(anchor.x, anchor.y);
              glyph.setDepth(10);
              scene.tweens.add({
                targets: glyph,
                alpha: { from: 0.35, to: 0.95 },
                duration: 180,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
              });
              this._trackHazardObject(glyph);
              this._activeMirrorAnchors.push({ glyph, expiresAt: scene.time.now + telegraphMs + 620 });

              const telegraph = scene.vfxSystem?.playLineTelegraph?.(anchor.x, anchor.y, {
                angle: Phaser.Math.Angle.Between(anchor.x, anchor.y, targetPoint.x, targetPoint.y),
                width: 14,
                length: Math.max(180, Phaser.Math.Distance.Between(anchor.x, anchor.y, targetPoint.x, targetPoint.y) + 40),
                color: MIRROR_GLOW,
                durationMs: telegraphMs
              });
              if (telegraph) this._trackHazardObject(telegraph);
            });

            this._playWindupFlash({
              color: MIRROR_COLOR,
              duration: telegraphMs,
              radius: (this.bossSize || 50) + 24
            });
          },
          events: [
            {
              atMs: telegraphMs,
              run: () => {
                anchors.forEach((anchor, index) => {
                  scene.patternSystem?.emitFan?.({
                    side: 'boss',
                    x: anchor.x,
                    y: anchor.y,
                    target: { x: targetPoint.x, y: targetPoint.y },
                    count: fanCount,
                    spreadRad: Phaser.Math.DegToRad(index === 0 ? 10 : 14),
                    speed: this.isEnraged() ? 205 : 188,
                    color: MIRROR_COLOR,
                    radius: 8,
                    damage: fanDamage,
                    tags: ['mirror_executioner_anchor_fan'],
                    options: {
                      type: 'diamond',
                      hasTrail: true,
                      trailColor: MIRROR_GLOW,
                      hasGlow: false
                    }
                  });

                  this.castGroundBlast(anchor.x, anchor.y, {
                    radius: 48,
                    telegraphMs: 280,
                    displayMs: 560,
                    fadeOutMs: 180,
                    damage: blastDamage,
                    color: MIRROR_COLOR
                  });
                });

                scene.patternSystem?.emitAimed?.({
                  side: 'boss',
                  x: this.x,
                  y: this.y,
                  target: { x: targetPoint.x, y: targetPoint.y },
                  speed: 220,
                  color: BURN_COLOR,
                  radius: 10,
                  damage: centerDamage,
                  tags: ['mirror_executioner_core_lance'],
                  options: {
                    type: 'diamond',
                    hasTrail: true,
                    trailColor: MIRROR_GLOW,
                    hasGlow: false
                  }
                });
              }
            }
          ]
        }
      ]
    });
  }

  startMirrorLaser(config = {}) {
    if (!this.scene?.add) return null;
    const now = this.scene.time.now;
    const glow = this.scene.add.graphics();
    const core = this.scene.add.graphics();
    glow.setDepth(9);
    core.setDepth(10);
    this._trackHazardObject(glow);
    this._trackHazardObject(core);

    const state = {
      glow,
      core,
      x: Number(config.x ?? this.x),
      y: Number(config.y ?? this.y),
      followBoss: config.followBoss === true,
      centered: config.centered === true,
      startAngle: Number(config.startAngle ?? config.angle ?? 0),
      endAngle: Number.isFinite(Number(config.endAngle)) ? Number(config.endAngle) : null,
      length: Math.max(80, Number(config.length || 520)),
      width: Math.max(8, Number(config.width || 18)),
      durationMs: Math.max(120, Math.round(Number(config.durationMs || 800))),
      expiresAt: now + Math.max(120, Math.round(Number(config.durationMs || 800))),
      startedAt: now,
      damage: Math.max(1, Math.round(Number(config.damage || 8))),
      tickIntervalMs: Math.max(90, Math.round(Number(config.tickIntervalMs || 180))),
      tickAt: now,
      color: config.color ?? MIRROR_COLOR,
      glowColor: config.glowColor ?? MIRROR_GLOW
    };

    this._activeMirrorLasers.push(state);
    return state;
  }

  destroy() {
    this.clearMirrorLasers();
    this.clearMirrorAnchors();
    this._orbitMirrors = [];
    super.destroy();
  }
}