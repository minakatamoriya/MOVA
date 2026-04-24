import { CORE_MODULES } from './progressionCatalog';

const ELITE_DROP_STACK_CAP = 3;

function findCoreModule(moduleId) {
  return CORE_MODULES.find((entry) => entry.id === moduleId) || null;
}

function canGrantModuleLevel(scene, moduleId) {
  const module = findCoreModule(moduleId);
  if (!module) return false;
  const currentLevel = Number(scene.coreModuleLevels?.[moduleId] || 0);
  return currentLevel < module.maxLevel;
}

function applyModuleDrop(scene, moduleId) {
  const module = findCoreModule(moduleId);
  if (!module || !canGrantModuleLevel(scene, moduleId)) return false;
  module.apply(scene);
  return true;
}

export function createInitialEliteDropState() {
  return {
    frontlineBountyLevel: 0,
    eliteHunterLevel: 0,
    emergencyPlatingLevel: 0,
    dropsCollected: 0,
    lastDropId: null,
    lastDropName: '',
  };
}

const ELITE_DROP_POOL = [
  {
    id: 'drop_interceptor_salvage',
    name: '拦截矩阵样片',
    color: '#8de8ff',
    summary: '核心模块 +1：拦截矩阵',
    isEligible: (scene) => canGrantModuleLevel(scene, 'core_interceptor'),
    apply: (scene) => applyModuleDrop(scene, 'core_interceptor'),
  },
  {
    id: 'drop_burn_salvage',
    name: '灼烧线圈样片',
    color: '#ffb37d',
    summary: '核心模块 +1：灼烧线圈',
    isEligible: (scene) => canGrantModuleLevel(scene, 'core_burn'),
    apply: (scene) => applyModuleDrop(scene, 'core_burn'),
  },
  {
    id: 'drop_recovery_salvage',
    name: '回生脉冲样片',
    color: '#b4fbff',
    summary: '核心模块 +1：回生脉冲',
    isEligible: (scene) => canGrantModuleLevel(scene, 'core_recovery'),
    apply: (scene) => applyModuleDrop(scene, 'core_recovery'),
  },
  {
    id: 'drop_frontline_bounty',
    name: '前线赏金模块',
    color: '#ffe18a',
    summary: '前线击杀收益提升',
    isEligible: (scene) => Number(scene.eliteDropState?.frontlineBountyLevel || 0) < ELITE_DROP_STACK_CAP,
    apply: (scene) => {
      scene.eliteDropState.frontlineBountyLevel += 1;
      return true;
    },
  },
  {
    id: 'drop_elite_hunter',
    name: '精英猎手战利品',
    color: '#ffd2a8',
    summary: '对压阵精英伤害提升',
    isEligible: (scene) => Number(scene.eliteDropState?.eliteHunterLevel || 0) < ELITE_DROP_STACK_CAP,
    apply: (scene) => {
      scene.eliteDropState.eliteHunterLevel += 1;
      return true;
    },
  },
  {
    id: 'drop_emergency_plating',
    name: '缓冲护板',
    color: '#c8ffd4',
    summary: '核心护盾底盘抬升',
    isEligible: (scene) => Number(scene.eliteDropState?.emergencyPlatingLevel || 0) < ELITE_DROP_STACK_CAP,
    apply: (scene) => {
      scene.eliteDropState.emergencyPlatingLevel += 1;
      scene.coreShieldMax = Math.max(scene.coreShieldMax, 40 + (scene.eliteDropState.emergencyPlatingLevel * 35));
      scene.coreShield = Math.min(scene.coreShieldMax, scene.coreShield + 28);
      return true;
    },
  },
];

export function getFrontlineBountyReward(scene, enemy) {
  const level = Number(scene.eliteDropState?.frontlineBountyLevel || 0);
  if (level <= 0) return { gold: 0, exp: 0 };
  const enteredFrontline = Boolean(enemy?.enteredFrontline || enemy?.y >= scene.metrics?.zones?.frontline?.y);
  if (!enteredFrontline) return { gold: 0, exp: 0 };
  return {
    gold: level * 3,
    exp: level,
  };
}

export function getEliteHunterBonus(scene, enemy) {
  const level = Number(scene.eliteDropState?.eliteHunterLevel || 0);
  if (level <= 0 || !enemy?.isEliteAnchor) {
    return { damage: 0, critChance: 0 };
  }
  return {
    damage: level * 8,
    critChance: level * 0.06,
  };
}

export function awardEliteDrop(scene) {
  const eligibleDrops = ELITE_DROP_POOL.filter((entry) => entry.isEligible(scene));
  if (!eligibleDrops.length) return null;
  const selected = eligibleDrops[Math.floor(Math.random() * eligibleDrops.length)];
  const applied = selected.apply(scene);
  if (!applied) return null;

  scene.eliteDropState.dropsCollected += 1;
  scene.eliteDropState.lastDropId = selected.id;
  scene.eliteDropState.lastDropName = selected.name;

  return {
    id: selected.id,
    name: selected.name,
    color: selected.color,
    summary: selected.summary,
  };
}