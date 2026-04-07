import { getBossPrototypeConfig } from './bossPrototypeMap';

const BOSS_REGISTRY = Object.freeze([
  {
    id: 'boss_mirror_executioner',
    name: '灼镜行刑官',
    color: 0xff7a3d,
  },
  {
    id: 'boss_toxic_weaver',
    name: '毒网织母',
    color: 0x55aa44,
  },
  {
    id: 'boss_tide_eye',
    name: '归潮魔眼',
    color: 0x7c56d6,
  },
  {
    id: 'boss_broodmother',
    name: '百巢兽母',
    color: 0x6b9c3d,
  },
  {
    id: 'boss_thunder_warden',
    name: '雷牢执政官',
    color: 0xf3c13a,
  },
  {
    id: 'boss_tide_devourer',
    name: '潮汐吞星兽',
    color: 0x4fb8c8,
  },
  {
    id: 'boss_time_bishop',
    name: '时刑主教',
    color: 0xc18cff,
  },
  {
    id: 'boss_star_royalist',
    name: '王庭观星者',
    color: 0xdde7b7,
  },
]);

const BOSS_STAGE_PROFILES = Object.freeze([
  { stage: 1, hpMultiplier: 1.00, damageMultiplier: 1.00 },
  { stage: 2, hpMultiplier: 1.08, damageMultiplier: 1.12 },
  { stage: 3, hpMultiplier: 1.18, damageMultiplier: 1.26 },
  { stage: 4, hpMultiplier: 1.30, damageMultiplier: 1.42 },
  { stage: 5, hpMultiplier: 1.44, damageMultiplier: 1.60 },
  { stage: 6, hpMultiplier: 1.60, damageMultiplier: 1.82 },
  { stage: 7, hpMultiplier: 1.78, damageMultiplier: 2.06 },
  { stage: 8, hpMultiplier: 1.98, damageMultiplier: 2.34 },
]);

function cloneBossDefinition(def) {
  if (!def) return null;
  const prototypeConfig = getBossPrototypeConfig(def.id);
  return prototypeConfig ? { ...def, ...prototypeConfig } : { ...def };
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = current;
  }
  return items;
}

export function getAllBossDefinitions() {
  return BOSS_REGISTRY.map(cloneBossDefinition);
}

export function getBossDefinitionById(id) {
  if (!id) return null;
  const def = BOSS_REGISTRY.find((entry) => entry.id === id);
  return cloneBossDefinition(def);
}

export function resolveBossDefinition(defOrId) {
  if (!defOrId) return null;
  if (typeof defOrId === 'string') return getBossDefinitionById(defOrId);
  if (defOrId.id) {
    const registered = getBossDefinitionById(defOrId.id);
    return registered ? { ...registered, ...defOrId } : { ...defOrId };
  }
  return { ...defOrId };
}

export function getBossDisplayName(defOrId, fallback = 'Boss') {
  const def = resolveBossDefinition(defOrId);
  return def?.name || fallback;
}

export function getBossEncounterPresentation(stage, defOrId, options = {}) {
  const resolvedStage = Math.max(1, Math.floor(Number(stage) || 1));
  const bossName = getBossDisplayName(defOrId, options.fallbackName || 'Boss 挑战');
  const isFinalRound = options.isFinalRound === true;
  return {
    title: isFinalRound ? '混沌竞技场' : `混沌竞技场·第${resolvedStage}轮`,
    subtitle: bossName,
  };
}

export function getBossWarningCopy(stage, defOrId) {
  const resolvedStage = Math.max(1, Math.floor(Number(stage) || 1));
  const bossName = getBossDisplayName(defOrId, 'Boss');
  return {
    title: `${bossName} 来袭`,
    message: `第${resolvedStage}轮首领已进入战场。`,
  };
}

export function getBossHudCopy(defOrId) {
  return {
    label: getBossDisplayName(defOrId, 'Boss'),
    hpLabel: '生命',
  };
}

export function buildBossRunPlan(count, excludeIds = []) {
  const excluded = new Set(Array.isArray(excludeIds) ? excludeIds : []);
  const candidates = BOSS_REGISTRY.filter((entry) => !excluded.has(entry.id)).map((entry) => entry.id);
  shuffleInPlace(candidates);
  return candidates.slice(0, Math.max(0, Math.floor(Number(count) || 0)));
}

export function getBossStageProfile(stage) {
  const resolvedStage = Math.max(1, Math.floor(Number(stage) || 1));
  const capped = Math.min(resolvedStage, BOSS_STAGE_PROFILES.length);
  const baseProfile = BOSS_STAGE_PROFILES[capped - 1] || BOSS_STAGE_PROFILES[0];

  if (resolvedStage <= BOSS_STAGE_PROFILES.length) {
    return { ...baseProfile, stage: resolvedStage };
  }

  const extraStages = resolvedStage - BOSS_STAGE_PROFILES.length;
  return {
    stage: resolvedStage,
    hpMultiplier: Number((baseProfile.hpMultiplier * Math.pow(1.16, extraStages)).toFixed(3)),
    damageMultiplier: Number((baseProfile.damageMultiplier * Math.pow(1.12, extraStages)).toFixed(3)),
  };
}