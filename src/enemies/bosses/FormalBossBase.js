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
  }

  getPhase() {
    return getBossPhase(this);
  }

  getCurrentInterval() {
    return this._formalIntervalByPhase[this.getPhase()] || this._formalIntervalByPhase[1] || 2600;
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
}