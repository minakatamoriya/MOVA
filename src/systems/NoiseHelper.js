import { createNoise2D } from 'simplex-noise';

// 全局噪声实例（单例，所有系统共享同一个种子减少遍历开销）
const _noise2D = createNoise2D();

/**
 * 2D噪声采样（-1~1）
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function noise2D(x, y) {
  return _noise2D(x, y);
}

/**
 * 弹幕飘动偏移：比 Math.sin 更有有机感
 * @param {number} bulletX    子弹当前X
 * @param {number} timeMs     场景时间（毫秒）
 * @param {number} amplitude  飘动幅度（像素），默认2
 * @param {number} freqSpace  空间频率，默认0.01
 * @param {number} freqTime   时间频率，默认0.002
 * @returns {{dx: number, dy: number}}
 */
export function bulletDrift(bulletX, timeMs, amplitude = 2, freqSpace = 0.01, freqTime = 0.002) {
  const t = timeMs * freqTime;
  const dx = _noise2D(bulletX * freqSpace, t) * amplitude;
  const dy = _noise2D(bulletX * freqSpace + 100, t + 100) * amplitude;
  return { dx, dy };
}

/**
 * 呼吸光效脉动值（0~1）
 * @param {number} timeMs     场景时间（毫秒）
 * @param {number} baseValue  基础值
 * @param {number} range      波动范围（±range）
 * @param {number} freq       频率，默认0.003
 * @returns {number}
 */
export function breathGlow(timeMs, baseValue = 4, range = 2, freq = 0.003) {
  return baseValue + _noise2D(0, timeMs * freq) * range;
}

/**
 * 有机缩放脉动（用于Boss呼吸、弹幕脉动）
 * @param {number} timeMs
 * @param {number} seed     区分不同对象的种子偏移
 * @param {number} amp      幅度（0~1），默认0.06
 * @param {number} freq     频率，默认0.0025
 * @returns {number}        1 ± amp 的缩放值
 */
export function organicPulse(timeMs, seed = 0, amp = 0.06, freq = 0.0025) {
  return 1 + _noise2D(seed, timeMs * freq) * amp;
}

/**
 * 颜色亮度有机波动
 * @param {number} timeMs
 * @param {number} seed
 * @param {number} minAlpha
 * @param {number} maxAlpha
 * @returns {number}
 */
export function organicAlpha(timeMs, seed = 0, minAlpha = 0.7, maxAlpha = 1.0) {
  const t = _noise2D(seed + 50, timeMs * 0.003);
  return minAlpha + (maxAlpha - minAlpha) * (t * 0.5 + 0.5);
}
