const WAVE_TIMELINE = [
  { startMinute: 0, spawnIntervalMs: 900, weights: { swarm: 1, brute: 0, infiltrator: 0, anchor: 0 } },
  { startMinute: 2, spawnIntervalMs: 780, weights: { swarm: 6, brute: 2, infiltrator: 0, anchor: 0 } },
  { startMinute: 3, spawnIntervalMs: 720, weights: { swarm: 6, brute: 2, infiltrator: 2, anchor: 0 } },
  { startMinute: 5, spawnIntervalMs: 680, weights: { swarm: 6, brute: 3, infiltrator: 2, anchor: 0 } },
  { startMinute: 8, spawnIntervalMs: 620, weights: { swarm: 5, brute: 3, infiltrator: 2, anchor: 2 } },
  { startMinute: 12, spawnIntervalMs: 560, weights: { swarm: 5, brute: 4, infiltrator: 3, anchor: 2 } },
  { startMinute: 16, spawnIntervalMs: 500, weights: { swarm: 5, brute: 4, infiltrator: 3, anchor: 3 } },
];

export const CORE_DEFENSE_ENEMY_DEFS = {
  swarm: {
    id: 'swarm',
    name: '基础潮怪',
    color: 0xd6e4ff,
    radius: 14,
    hp: 34,
    speed: 42,
    pressure: 1.0,
    score: 1,
  },
  brute: {
    id: 'brute',
    name: '厚皮推进怪',
    color: 0xffb86b,
    radius: 22,
    hp: 100,
    speed: 30,
    pressure: 2.4,
    score: 3,
  },
  infiltrator: {
    id: 'infiltrator',
    name: '渗透怪',
    color: 0xff6b8a,
    radius: 12,
    hp: 28,
    speed: 76,
    pressure: 1.8,
    score: 2,
  },
  anchor: {
    id: 'anchor',
    name: '停驻施压怪',
    color: 0x8de2ff,
    radius: 18,
    hp: 64,
    speed: 38,
    pressure: 1.2,
    remotePressure: 1.3,
    anchorYRatio: 0.46,
    score: 4,
  },
};

export function getWaveProfileByMinute(minute) {
  const safeMinute = Math.max(0, Math.floor(Number(minute || 0)));
  let result = WAVE_TIMELINE[0];
  for (let i = 0; i < WAVE_TIMELINE.length; i += 1) {
    if (safeMinute >= WAVE_TIMELINE[i].startMinute) result = WAVE_TIMELINE[i];
  }
  return result;
}

export function rollEnemyType(randomValue, minute) {
  const profile = getWaveProfileByMinute(minute);
  const weights = profile.weights || {};
  const entries = Object.entries(weights).filter(([, value]) => Number(value) > 0);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (total <= 0) return 'swarm';

  let cursor = (Number.isFinite(randomValue) ? randomValue : Math.random()) * total;
  for (let i = 0; i < entries.length; i += 1) {
    const [enemyType, weight] = entries[i];
    cursor -= Number(weight || 0);
    if (cursor <= 0) return enemyType;
  }

  return entries[entries.length - 1][0];
}
