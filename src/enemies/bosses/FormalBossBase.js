import BaseBoss from './BaseBoss';
import { getBossPhase } from './formalBossUtils';

export default class FormalBossBase extends BaseBoss {
  constructor(scene, config = {}, formalConfig = {}) {
    const attackPatterns = [
      {
        interval: formalConfig.intervalByPhase?.[1] || formalConfig.baseInterval || 2600,
        execute: (boss) => boss.executeFormalCycle()
      }
    ];

    super(scene, {
      ...config,
      name: config.name || formalConfig.name || 'Boss',
      color: config.color ?? formalConfig.color ?? 0xffffff,
      attackPatterns,
      hitReactionType: config.hitReactionType || formalConfig.hitReactionType || 'ranged_blast',
      hitReactionCdMs: config.hitReactionCdMs ?? formalConfig.hitReactionCdMs ?? 850
    });

    this._formalCycleIndex = 0;
    this._formalIntervalByPhase = {
      1: formalConfig.intervalByPhase?.[1] || formalConfig.baseInterval || 2600,
      2: formalConfig.intervalByPhase?.[2] || formalConfig.intervalByPhase?.[1] || formalConfig.baseInterval || 2400,
      3: formalConfig.intervalByPhase?.[3] || formalConfig.intervalByPhase?.[2] || formalConfig.intervalByPhase?.[1] || formalConfig.baseInterval || 2200
    };

    this._incomingDamageWindowUntil = 0;
    this._incomingDamageWindowMultiplier = 1;
    this._vulnerabilityTintColor = formalConfig.vulnerabilityTintColor ?? null;
    this._vulnerabilityStrokeColor = formalConfig.vulnerabilityStrokeColor ?? null;
    this._vulnerabilityVisualApplied = false;
  }

  getPhase() {
    return getBossPhase(this);
  }

  getCurrentInterval() {
    return this._formalIntervalByPhase[this.getPhase()] || this._formalIntervalByPhase[1] || 2600;
  }

  isDamageAmpWindowActive(now = this.scene?.time?.now ?? 0) {
    return (this._incomingDamageWindowUntil || 0) > now && Number(this._incomingDamageWindowMultiplier || 1) > 1;
  }

  setIncomingDamageWindow(multiplier = 1, durationMs = 0, options = {}) {
    const now = this.scene?.time?.now ?? 0;
    this._incomingDamageWindowMultiplier = Math.max(1, Number(multiplier || 1));
    this._incomingDamageWindowUntil = now + Math.max(0, Math.round(Number(durationMs || 0)));
    if (options.tintColor != null) this._vulnerabilityTintColor = options.tintColor;
    if (options.strokeColor != null) this._vulnerabilityStrokeColor = options.strokeColor;
  }

  clearIncomingDamageWindow() {
    this._incomingDamageWindowUntil = 0;
    this._incomingDamageWindowMultiplier = 1;
  }

  update(time, delta) {
    super.update(time, delta);
    if (this.isDestroyed || !this.isAlive) return;

    const active = this.isDamageAmpWindowActive(time);
    if (active && !this._vulnerabilityVisualApplied) {
      if (this.sprite?.setTint && this._vulnerabilityTintColor != null) {
        this.sprite.setTint(this._vulnerabilityTintColor);
      }
      if (this.body?.setStrokeStyle && this._vulnerabilityStrokeColor != null) {
        this.body.setStrokeStyle(4, this._vulnerabilityStrokeColor, 1);
      }
      this._vulnerabilityVisualApplied = true;
    } else if (!active && this._vulnerabilityVisualApplied) {
      if (this.sprite?.clearTint) this.sprite.clearTint();
      if (this.body?.setStrokeStyle) this.body.setStrokeStyle(3, 0xffffff, 0.95);
      this._vulnerabilityVisualApplied = false;
      this.clearIncomingDamageWindow();
    }
  }

  getCycleSequence() {
    return [];
  }

  executeFormalCycle() {
    if (!this.isAlive || this.isDestroyed) return;
    const pattern = this.attackPatterns?.[0];
    if (pattern) pattern.interval = this.getCurrentInterval();

    const sequence = this.getCycleSequence();
    if (!Array.isArray(sequence) || sequence.length <= 0) return;

    const action = sequence[this._formalCycleIndex % sequence.length];
    this._formalCycleIndex += 1;
    action?.call(this);
  }

  takeDamage(damage, context = {}) {
    const multiplier = this.isDamageAmpWindowActive() ? this._incomingDamageWindowMultiplier : 1;
    return super.takeDamage(Math.max(1, Math.round(Number(damage || 0) * multiplier)), context);
  }
}