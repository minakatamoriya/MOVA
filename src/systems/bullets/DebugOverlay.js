import Phaser from 'phaser';

function makeMetricLines(coreMetrics = {}, timelineMetrics = []) {
  const firstTimeline = timelineMetrics[0] || null;
  return [
    `player bullets: ${Number(coreMetrics.activePlayerBullets || 0)}`,
    `boss bullets: ${Number(coreMetrics.activeBossBullets || 0)}`,
    `hit count: ${Number(coreMetrics.hitCount || 0)}`,
    `pooled bullets: ${Number(coreMetrics.pooledBullets || 0)}`,
    `created/destroyed: ${Number(coreMetrics.managerCreated || 0)}/${Number(coreMetrics.managerDestroyed || 0)}`,
    firstTimeline ? `timeline: ${firstTimeline.id} phase ${firstTimeline.currentPhaseIndex}` : 'timeline: none'
  ];
}

export default class DebugOverlay {
  constructor(scene, deps = {}, opts = {}) {
    this.scene = scene;
    this.bulletCore = deps.bulletCore || null;
    this.attackTimeline = deps.attackTimeline || null;
    this.depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 2550;

    this.visible = false;
    this.rangeDescriptors = [];

    this.graphics = this.scene?.add?.graphics?.();
    this.text = this.scene?.add?.text?.(14, 14, '', {
      fontSize: '14px',
      color: '#d1fae5',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'left'
    });

    this.graphics?.setScrollFactor?.(0);
    this.text?.setScrollFactor?.(0);
    this.graphics?.setDepth?.(this.depth);
    this.text?.setDepth?.(this.depth + 1);
    this.setVisible(false);
  }

  attach({ bulletCore, attackTimeline } = {}) {
    if (bulletCore) this.bulletCore = bulletCore;
    if (attackTimeline) this.attackTimeline = attackTimeline;
    return this;
  }

  setVisible(visible) {
    this.visible = !!visible;
    this.graphics?.setVisible?.(this.visible);
    this.text?.setVisible?.(this.visible);
    return this;
  }

  toggle() {
    return this.setVisible(!this.visible);
  }

  setRanges(descriptors = []) {
    this.rangeDescriptors = Array.isArray(descriptors) ? descriptors : [];
  }

  update() {
    if (!this.visible) return;
    this.graphics?.clear?.();

    this.rangeDescriptors.forEach((descriptor) => {
      if (!descriptor) return;
      const color = Number(descriptor.color ?? 0x66ffcc);
      const alpha = Phaser.Math.Clamp(Number(descriptor.alpha ?? 0.2), 0, 1);
      const lineAlpha = Phaser.Math.Clamp(Number(descriptor.lineAlpha ?? 0.9), 0, 1);
      const x = Number(descriptor.x || 0);
      const y = Number(descriptor.y || 0);
      const radius = Math.max(1, Number(descriptor.radius || 1));
      this.graphics.fillStyle(color, alpha);
      this.graphics.lineStyle(1, color, lineAlpha);
      this.graphics.strokeCircle(x, y, radius);
    });

    const coreMetrics = this.bulletCore?.getMetrics?.() || {};
    const timelineMetrics = this.attackTimeline?.getMetrics?.() || [];
    this.text?.setText?.(makeMetricLines(coreMetrics, timelineMetrics));
  }

  destroy() {
    try { this.graphics?.destroy?.(); } catch (_) { /* ignore */ }
    try { this.text?.destroy?.(); } catch (_) { /* ignore */ }
    this.graphics = null;
    this.text = null;
  }
}