const WAVE_ARCHETYPES = [
  {
    key: 'build',
    name: '建立波',
    durationMs: 52000,
    segments: [
      { untilRatio: 0.20, spawnIntervalMs: 980, weights: { swarm: 9, brute: 0, infiltrator: 0, anchor: 0 } },
      { untilRatio: 0.78, spawnIntervalMs: 820, weights: { swarm: 10, brute: 1, infiltrator: 0, anchor: 0 } },
      { untilRatio: 1.00, spawnIntervalMs: 1080, weights: { swarm: 7, brute: 1, infiltrator: 0, anchor: 0 } },
    ],
  },
  {
    key: 'pressure',
    name: '加压波',
    durationMs: 56000,
    segments: [
      { untilRatio: 0.18, spawnIntervalMs: 920, weights: { swarm: 9, brute: 1, infiltrator: 0, anchor: 0 } },
      { untilRatio: 0.74, spawnIntervalMs: 780, weights: { swarm: 10, brute: 2, infiltrator: 1, anchor: 0 } },
      { untilRatio: 1.00, spawnIntervalMs: 1020, weights: { swarm: 7, brute: 2, infiltrator: 1, anchor: 0 } },
    ],
  },
  {
    key: 'peak',
    name: '峰值波',
    durationMs: 60000,
    segments: [
      { untilRatio: 0.15, spawnIntervalMs: 900, weights: { swarm: 8, brute: 2, infiltrator: 1, anchor: 0 } },
      { untilRatio: 0.72, spawnIntervalMs: 720, weights: { swarm: 10, brute: 3, infiltrator: 2, anchor: 0 } },
      { untilRatio: 1.00, spawnIntervalMs: 980, weights: { swarm: 6, brute: 2, infiltrator: 1, anchor: 1 } },
    ],
  },
  {
    key: 'layer',
    name: '层级波',
    durationMs: 64000,
    segments: [
      { untilRatio: 0.16, spawnIntervalMs: 920, weights: { swarm: 8, brute: 2, infiltrator: 1, anchor: 0 } },
      { untilRatio: 0.76, spawnIntervalMs: 760, weights: { swarm: 9, brute: 3, infiltrator: 2, anchor: 1 } },
      { untilRatio: 1.00, spawnIntervalMs: 1040, weights: { swarm: 6, brute: 2, infiltrator: 1, anchor: 1 } },
    ],
  },
];

const TOTAL_GROUP_DURATION_MS = WAVE_ARCHETYPES.reduce((sum, wave) => sum + wave.durationMs, 0);
const ENEMY_HP_SCALE_BY_TYPE = {
  swarm: 0.06,
  brute: 0.12,
  infiltrator: 0.08,
  anchor: 0.10,
};

export const CORE_DEFENSE_ENEMY_DEFS = {
  swarm: {
    id: 'swarm',
    name: '基础潮怪',
    color: 0xd6e4ff,
    radius: 14,
    hp: 34,
    speed: 34,
    threat: 0.8,
    pressure: 1.0,
    goldDropChance: 0.42,
    goldDrop: 3,
    score: 1,
  },
  brute: {
    id: 'brute',
    name: '厚皮推进怪',
    color: 0xffb86b,
    radius: 22,
    hp: 100,
    speed: 24,
    threat: 2.8,
    pressure: 2.4,
    goldDropChance: 1,
    goldDrop: 9,
    score: 3,
  },
  infiltrator: {
    id: 'infiltrator',
    name: '渗透怪',
    color: 0xff6b8a,
    radius: 12,
    hp: 28,
    speed: 58,
    threat: 2.2,
    pressure: 1.8,
    goldDropChance: 0.88,
    goldDrop: 7,
    score: 2,
  },
  anchor: {
    id: 'anchor',
    name: '停驻施压怪',
    color: 0x8de2ff,
    radius: 18,
    hp: 64,
    speed: 30,
    threat: 1.6,
    pressure: 1.2,
    remoteThreat: 0.9,
    remotePressure: 1.3,
    anchorYRatio: 0.46,
    goldDropChance: 1,
    goldDrop: 12,
    score: 4,
  },
};

function buildScaledWeights(baseWeights, groupIndex, waveKey) {
  const scaled = {
    swarm: Number(baseWeights.swarm || 0),
    brute: Number(baseWeights.brute || 0),
    infiltrator: Number(baseWeights.infiltrator || 0),
    anchor: Number(baseWeights.anchor || 0),
  };

  if (groupIndex <= 0) return scaled;

  scaled.swarm += Math.min(4, Math.floor(groupIndex / 2));
  if (waveKey !== 'build') {
    scaled.brute += Math.max(1, Math.floor((groupIndex + 1) * 0.55));
  }
  if (waveKey === 'pressure' || waveKey === 'peak' || waveKey === 'layer') {
    scaled.infiltrator += Math.floor(groupIndex / 3);
  }
  if (waveKey === 'peak' || waveKey === 'layer') {
    scaled.anchor += Math.floor(groupIndex / 4);
  }

  return scaled;
}

function getDirectorThreatStage(waveKey, groupIndex, isRecoveryWindow) {
  const safeGroupIndex = Math.max(0, Number(groupIndex || 0));

  if (safeGroupIndex >= 3) {
    if (waveKey === 'layer') return isRecoveryWindow ? '终局余震' : '终局攻城';
    if (waveKey === 'peak') return isRecoveryWindow ? '高压回整' : '裂口冲击';
    if (waveKey === 'pressure') return isRecoveryWindow ? '战线喘息' : '持续压境';
    return '战线胶着';
  }

  if (safeGroupIndex >= 1) {
    if (waveKey === 'layer') return isRecoveryWindow ? '攻城整备' : '攻城升级';
    if (waveKey === 'peak') return isRecoveryWindow ? '峰后整理' : '峰值冲锋';
    if (waveKey === 'pressure') return isRecoveryWindow ? '回压整理' : '加压逼近';
    return '前线建立';
  }

  if (waveKey === 'layer') return isRecoveryWindow ? '层后回整' : '层级压进';
  if (waveKey === 'peak') return isRecoveryWindow ? '短暂缓冲' : '第一轮峰值';
  if (waveKey === 'pressure') return isRecoveryWindow ? '低压回整' : '前线加压';
  return '战线建立';
}

export function getWaveDirectorState(elapsedMs) {
  const safeElapsedMs = Math.max(0, Number(elapsedMs || 0));
  const groupIndex = Math.floor(safeElapsedMs / TOTAL_GROUP_DURATION_MS);
  const elapsedInGroupMs = safeElapsedMs % TOTAL_GROUP_DURATION_MS;

  let cursorMs = elapsedInGroupMs;
  let waveIndexInGroup = 0;
  let wave = WAVE_ARCHETYPES[0];
  for (let i = 0; i < WAVE_ARCHETYPES.length; i += 1) {
    if (cursorMs < WAVE_ARCHETYPES[i].durationMs) {
      wave = WAVE_ARCHETYPES[i];
      waveIndexInGroup = i;
      break;
    }
    cursorMs -= WAVE_ARCHETYPES[i].durationMs;
  }

  const waveProgress = wave.durationMs <= 0 ? 1 : (cursorMs / wave.durationMs);
  let segment = wave.segments[wave.segments.length - 1];
  for (let i = 0; i < wave.segments.length; i += 1) {
    if (waveProgress <= wave.segments[i].untilRatio) {
      segment = wave.segments[i];
      break;
    }
  }

  const spawnIntervalMs = Math.max(320, Math.round(segment.spawnIntervalMs * Math.pow(0.95, groupIndex)));
  const weights = buildScaledWeights(segment.weights, groupIndex, wave.key);
  const isRecoveryWindow = waveProgress >= 0.78;
  const threatStageLabel = getDirectorThreatStage(wave.key, groupIndex, isRecoveryWindow);

  return {
    waveKey: wave.key,
    waveName: wave.name,
    waveIndex: (groupIndex * WAVE_ARCHETYPES.length) + waveIndexInGroup + 1,
    waveIndexInGroup,
    groupIndex,
    spawnIntervalMs,
    weights,
    waveProgress,
    isRecoveryWindow,
    threatStageLabel,
  };
}

export function getEnemyHpMultiplier(enemyType, groupIndex) {
  const safeGroupIndex = Math.max(0, Number(groupIndex || 0));
  const scalePerGroup = Number(ENEMY_HP_SCALE_BY_TYPE[enemyType] || 0.08);
  return 1 + (safeGroupIndex * scalePerGroup);
}

export function rollEnemyType(randomValue, weights) {
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
