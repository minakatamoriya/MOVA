function buildTimelineId(prefix = 'timeline') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// AttackTimeline 用于把 Boss 机制拆成“阶段 + 事件时间点”，
// 避免攻击脚本里堆太多 delayedCall，后续更适合做相位化设计。
export default class AttackTimeline {
  constructor(scene, deps = {}) {
    this.scene = scene;
    this.patternSystem = deps.patternSystem || null;
    this.vfxSystem = deps.vfxSystem || null;
    this.timelines = new Map();
  }

  attach({ patternSystem, vfxSystem } = {}) {
    if (patternSystem) this.patternSystem = patternSystem;
    if (vfxSystem) this.vfxSystem = vfxSystem;
    return this;
  }

  createTimeline(config = {}) {
    // owner 通常绑定 Boss，本体死亡或切场景时可以按 owner 整体停掉。
    const id = config.id || buildTimelineId(config.prefix || 'boss');
    const timeline = {
      id,
      owner: config.owner || null,
      phases: Array.isArray(config.phases) ? config.phases : [],
      currentPhaseIndex: -1,
      activeTimers: new Set(),
      running: false,
      startedAt: 0
    };

    this.timelines.set(id, timeline);
    return timeline;
  }

  startTimeline(config = {}) {
    const timeline = this.createTimeline(config);
    timeline.running = true;
    timeline.startedAt = Number(this.scene?.time?.now || 0);
    this.advancePhase(timeline.id, 0);
    return timeline;
  }

  advancePhase(timelineId, phaseIndex) {
    // 切 phase 前先清空旧 phase 的 timer，保证时间轴始终只有当前阶段在驱动。
    const timeline = this.timelines.get(timelineId);
    if (!timeline || !timeline.running) return null;

    if (this._shouldStopForOwner(timeline.owner)) {
      this.stopTimeline(timeline.id);
      return null;
    }

    this._clearTimers(timeline);
    timeline.currentPhaseIndex = phaseIndex;

    const phase = timeline.phases[phaseIndex];
    if (!phase) {
      this.stopTimeline(timeline.id);
      return null;
    }

    if (typeof phase.onEnter === 'function') {
      phase.onEnter({ timeline, phase, patternSystem: this.patternSystem, vfxSystem: this.vfxSystem, scene: this.scene });
    }

    const events = Array.isArray(phase.events) ? phase.events : [];
    events.forEach((event) => {
      const delayMs = Math.max(0, Math.round(Number(event.atMs || 0)));
      this._scheduleTimelineTimer(timeline, delayMs, () => {
        this._runEvent(timeline, phase, event);
      });
    });

    if (Number.isFinite(Number(phase.durationMs)) && phase.durationMs >= 0) {
      this._scheduleTimelineTimer(timeline, Number(phase.durationMs), () => {
        if (typeof phase.onExit === 'function') {
          phase.onExit({ timeline, phase, patternSystem: this.patternSystem, vfxSystem: this.vfxSystem, scene: this.scene });
        }
        this.advancePhase(timeline.id, phaseIndex + 1);
      });
    }

    return phase;
  }

  stopTimeline(timelineId, opts = {}) {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) return false;

    const remove = opts.remove !== false;
    timeline.running = false;
    this._clearTimers(timeline);
    if (remove) {
      this.timelines.delete(timelineId);
    }
    return true;
  }

  pauseTimeline(timelineId) {
    const timeline = this.timelines.get(timelineId);
    if (!timeline || !timeline.running) return false;
    timeline.activeTimers.forEach((timer) => {
      if (timer) timer.paused = true;
    });
    return true;
  }

  resumeTimeline(timelineId) {
    const timeline = this.timelines.get(timelineId);
    if (!timeline || !timeline.running) return false;
    timeline.activeTimers.forEach((timer) => {
      if (timer) timer.paused = false;
    });
    return true;
  }

  stopOwnerTimelines(owner, opts = {}) {
    this.timelines.forEach((timeline) => {
      if (timeline.owner === owner) this.stopTimeline(timeline.id, opts);
    });
  }

  pauseOwnerTimelines(owner) {
    this.timelines.forEach((timeline) => {
      if (timeline.owner === owner) this.pauseTimeline(timeline.id);
    });
  }

  resumeOwnerTimelines(owner) {
    this.timelines.forEach((timeline) => {
      if (timeline.owner === owner) this.resumeTimeline(timeline.id);
    });
  }

  getMetrics() {
    const items = [];
    this.timelines.forEach((timeline) => {
      items.push({
        id: timeline.id,
        running: timeline.running,
        currentPhaseIndex: timeline.currentPhaseIndex,
        activeTimers: timeline.activeTimers.size,
        ownerName: timeline.owner?.bossName || timeline.owner?.name || ''
      });
    });
    return items;
  }

  _runEvent(timeline, phase, event) {
    // 允许直接写 run，也允许声明式写 pattern/flash，兼顾灵活性与可读性。
    if (typeof event.run === 'function') {
      event.run({ timeline, phase, patternSystem: this.patternSystem, vfxSystem: this.vfxSystem, scene: this.scene });
      return;
    }

    const type = event.type || 'custom';
    if (type === 'pattern' && event.pattern && this.patternSystem) {
      const fn = this.patternSystem[event.pattern];
      if (typeof fn === 'function') fn.call(this.patternSystem, event.config || {});
      return;
    }

    if (type === 'flash' && this.vfxSystem) {
      this.vfxSystem.flashScreen(event.config || {});
    }
  }

  _scheduleTimelineTimer(timeline, delayMs, callback) {
    if (!this.scene?.time?.delayedCall) return null;

    let timer = null;
    timer = this.scene.time.delayedCall(delayMs, () => {
      if (timer) timeline.activeTimers.delete(timer);
      if (!timeline.running) return;
      this._runWhenOwnerReady(timeline, callback);
    });

    if (timer) timeline.activeTimers.add(timer);
    return timer;
  }

  _runWhenOwnerReady(timeline, callback) {
    if (!timeline?.running) return;

    if (this._shouldStopForOwner(timeline.owner)) {
      this.stopTimeline(timeline.id);
      return;
    }

    if (this._shouldPauseForOwner(timeline.owner)) {
      // 回调触发瞬间若刚好进入眩晕/脱战，这里补一个冻结重试，避免事件丢失。
      const retryTimer = this._scheduleTimelineTimer(timeline, 90, callback);
      if (retryTimer && timeline.owner) {
        this.pauseOwnerTimelines(timeline.owner);
      }
      return;
    }

    callback();
  }

  _shouldStopForOwner(owner) {
    if (!owner) return false;
    return owner.isDestroyed || owner.isAlive === false || owner.active === false;
  }

  _shouldPauseForOwner(owner) {
    if (!owner) return false;
    if (owner.combatActive === false) return true;
    if (typeof owner.isStunned === 'function' && owner.isStunned()) return true;
    return false;
  }

  _clearTimers(timeline) {
    timeline.activeTimers.forEach((timer) => {
      try { timer.remove(false); } catch (_) { /* ignore */ }
    });
    timeline.activeTimers.clear();
  }
}