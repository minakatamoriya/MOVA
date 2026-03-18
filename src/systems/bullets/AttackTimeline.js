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

    this._clearTimers(timeline);
    timeline.currentPhaseIndex = phaseIndex;

    const phase = timeline.phases[phaseIndex];
    if (!phase) {
      timeline.running = false;
      return null;
    }

    if (typeof phase.onEnter === 'function') {
      phase.onEnter({ timeline, phase, patternSystem: this.patternSystem, vfxSystem: this.vfxSystem, scene: this.scene });
    }

    const events = Array.isArray(phase.events) ? phase.events : [];
    events.forEach((event) => {
      const delayMs = Math.max(0, Math.round(Number(event.atMs || 0)));
      const timer = this.scene?.time?.delayedCall?.(delayMs, () => {
        if (!timeline.running) return;
        this._runEvent(timeline, phase, event);
      });
      if (timer) timeline.activeTimers.add(timer);
    });

    if (Number.isFinite(Number(phase.durationMs)) && phase.durationMs >= 0) {
      const endTimer = this.scene?.time?.delayedCall?.(Number(phase.durationMs), () => {
        if (!timeline.running) return;
        if (typeof phase.onExit === 'function') {
          phase.onExit({ timeline, phase, patternSystem: this.patternSystem, vfxSystem: this.vfxSystem, scene: this.scene });
        }
        this.advancePhase(timeline.id, phaseIndex + 1);
      });
      if (endTimer) timeline.activeTimers.add(endTimer);
    }

    return phase;
  }

  stopTimeline(timelineId) {
    const timeline = this.timelines.get(timelineId);
    if (!timeline) return false;
    timeline.running = false;
    this._clearTimers(timeline);
    return true;
  }

  stopOwnerTimelines(owner) {
    this.timelines.forEach((timeline) => {
      if (timeline.owner === owner) this.stopTimeline(timeline.id);
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

  _clearTimers(timeline) {
    timeline.activeTimers.forEach((timer) => {
      try { timer.remove(false); } catch (_) { /* ignore */ }
    });
    timeline.activeTimers.clear();
  }
}