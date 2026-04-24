export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}