import Phaser from 'phaser';

function destroyArc(unit) {
  if (unit?.pendingMeleeArc?.active) unit.pendingMeleeArc.destroy();
  if (unit) unit.pendingMeleeArc = null;
}

function renderArc(graphics, x, y, facing, outerRadius, thickness, progress, color, alpha) {
  if (!graphics?.active) return;

  const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);
  const innerRadius = Math.max(4, outerRadius - thickness);
  const arcSpan = Phaser.Math.Linear(0.2, 1.12, clampedProgress);
  const start = facing - arcSpan * 0.5;
  const end = facing + arcSpan * 0.5;

  graphics.clear();
  graphics.fillStyle(color, alpha * (0.18 + clampedProgress * 0.16));
  graphics.lineStyle(Math.max(2, thickness * 0.16), color, Math.min(1, alpha * (0.55 + clampedProgress * 0.25)));
  graphics.beginPath();
  graphics.arc(x, y, outerRadius, start, end, false);
  graphics.arc(x, y, innerRadius, end, start, true);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

export function clearPendingMeleeWindup(unit) {
  if (!unit) return;
  unit.pendingAttackEvent?.remove?.(false);
  unit.pendingAttackEvent = null;
  unit.pendingAttackUntil = 0;
  unit.pendingAttackTarget = null;
  destroyArc(unit);
}

export function hasPendingMeleeWindup(unit, now) {
  return !!(unit && (unit.pendingAttackUntil || 0) > now);
}

export function startMeleeWindup({
  scene,
  unit,
  target,
  now,
  color = 0xffffff,
  windupMs = 160,
  radius = 36,
  thickness = 12,
  alpha = 0.72,
  onStrike
}) {
  if (!scene || !unit?.active || !target?.active || typeof onStrike !== 'function') return false;

  clearPendingMeleeWindup(unit);

  const facing = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
  unit.pendingAttackUntil = now + windupMs;
  unit.pendingAttackTarget = target;

  const arc = scene.add.graphics();
  arc.setDepth((unit.depth || 6) + 1);
  unit.pendingMeleeArc = arc;

  renderArc(arc, unit.x, unit.y, facing, radius, thickness, 0.08, color, alpha);

  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: windupMs,
    ease: 'Cubic.Out',
    onUpdate: (tween) => {
      if (!unit?.active || !target?.active || !arc?.active) return;
      const liveFacing = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
      renderArc(arc, unit.x, unit.y, liveFacing, radius, thickness, tween.getValue(), color, alpha);
    },
    onComplete: () => destroyArc(unit)
  });

  unit.pendingAttackEvent = scene.time.delayedCall(windupMs, () => {
    const strikeTarget = unit.pendingAttackTarget;
    clearPendingMeleeWindup(unit);
    if (!unit?.active || !strikeTarget?.active) return;
    onStrike(strikeTarget);
  });

  scene.tweens.add({
    targets: unit,
    scaleX: 1.06,
    scaleY: 0.94,
    duration: Math.max(70, Math.round(windupMs * 0.42)),
    ease: 'Sine.Out',
    yoyo: true
  });

  return true;
}