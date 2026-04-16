import FormalBossBase from './FormalBossBase';
import { clampWorldPoint, getTargetPoint } from './formalBossUtils';

const TIME_COLOR = 0xc18cff;
const TIME_GLOW = 0xe6c9ff;
const TIME_DARK = 0x6e4d8e;

export default class TimeBishopBoss extends FormalBossBase {
  constructor(scene, config = {}) {
    super(scene, config, {
      name: '时刑主教',
      color: TIME_COLOR,
      intervalByPhase: { 1: 3120, 2: 2640, 3: 2200 },
      hitReactionCdMs: 780
    });

    this._positionHistory = [];
    this._lastHistoryAt = 0;
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.isAlive || this.isDestroyed) return;
    this.captureTargetHistory(time);
  }

  getCycleSequence() {
    return [
      this.castDelayedSanction,
      this.castStaggeredJudgement,
      this.castHistoricPenance
    ];
  }

  captureTargetHistory(time) {
    const now = Number(time || this.scene?.time?.now || 0);
    if ((now - this._lastHistoryAt) < 140) return;
    this._lastHistoryAt = now;

    const point = getTargetPoint(this.getPrimaryTarget());
    if (!point) return;
    this._positionHistory.push({ at: now, x: point.x, y: point.y });
    while (this._positionHistory.length > 18) this._positionHistory.shift();
  }

  getHistoricalPoint(msAgo = 1000) {
    const now = Number(this.scene?.time?.now || 0);
    for (let index = this._positionHistory.length - 1; index >= 0; index -= 1) {
      const entry = this._positionHistory[index];
      if ((now - entry.at) >= msAgo) return { x: entry.x, y: entry.y };
    }
    const current = getTargetPoint(this.getPrimaryTarget());
    return current ? { x: current.x, y: current.y } : null;
  }

  scheduleJudgement(point, options = {}) {
    const scene = this.scene;
    if (!scene?.patternSystem || !point) return;
    const delayMs = Math.max(120, Math.round(Number(options.delayMs || 700)));
    const radius = Math.max(20, Number(options.radius || 44));
    const color = options.color ?? TIME_COLOR;

    const telegraph = scene.patternSystem.emitGroundTelegraph({
      x: point.x,
      y: point.y,
      telegraphRadius: radius,
      telegraphColor: color,
      durationMs: delayMs
    });
    if (telegraph) this._trackHazardObject?.(telegraph);

    const timer = scene.time?.delayedCall?.(delayMs, () => {
      if (!this.isAlive || this.isDestroyed) return;
      scene.vfxSystem?.playBurst?.(point.x, point.y, {
        radius: radius + 8,
        color,
        durationMs: 180
      });
      scene.patternSystem.emitRing({
        side: 'boss',
        x: point.x,
        y: point.y,
        count: options.count || 10,
        speed: options.speed || 150,
        color,
        radius: 7,
        damage: this.scaleAttackDamage(options.damage || 8, 5),
        tags: ['boss_time_bishop_judgement'],
        options: {
          type: 'circle',
          hasTrail: true,
          trailColor: TIME_GLOW,
          hasGlow: false
        }
      });
    });
    if (timer) this._trackHazardTimer?.(timer);
  }

  castDelayedSanction() {
    const targetPoint = getTargetPoint(this.getPrimaryTarget());
    if (!targetPoint) return;

    this.showAlertIcon(720);
    this.scheduleJudgement(targetPoint, {
      delayMs: this.getPhase() >= 2 ? 620 : 780,
      radius: this.getPhase() >= 3 ? 52 : 44,
      damage: this.getPhase() >= 3 ? 10 : 8,
      count: this.getPhase() >= 3 ? 12 : 10
    });
  }

  castStaggeredJudgement() {
    const targetPoint = getTargetPoint(this.getPrimaryTarget());
    if (!targetPoint) return;

    const phase = this.getPhase();
    const first = clampWorldPoint(this.scene, targetPoint.x - 70, targetPoint.y, 84);
    const second = clampWorldPoint(this.scene, targetPoint.x + 70, targetPoint.y, 84);
    this.showAlertIcon(820);

    this.scheduleJudgement(first, {
      delayMs: phase >= 2 ? 540 : 700,
      radius: 40,
      damage: 8,
      color: TIME_COLOR
    });
    this.scheduleJudgement(second, {
      delayMs: phase >= 2 ? 980 : 1220,
      radius: phase >= 3 ? 52 : 44,
      damage: phase >= 3 ? 10 : 8,
      color: TIME_DARK
    });
  }

  castHistoricPenance() {
    const historyPoint = this.getHistoricalPoint(1000);
    if (!historyPoint) return;

    const phase = this.getPhase();
    this.showAlertIcon(780);
    this.scheduleJudgement(historyPoint, {
      delayMs: 760,
      radius: phase >= 3 ? 56 : 46,
      damage: phase >= 3 ? 11 : 9,
      count: phase >= 3 ? 14 : 11,
      color: TIME_DARK
    });

    if (phase >= 3) {
      const current = getTargetPoint(this.getPrimaryTarget());
      if (current) {
        this.scheduleJudgement(current, {
          delayMs: 1180,
          radius: 46,
          damage: 9,
          count: 10,
          color: TIME_COLOR
        });
      }
    }
  }
}