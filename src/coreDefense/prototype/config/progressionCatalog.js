export const PROTOTYPE_UPGRADES = [
  {
    id: 'player_damage',
    name: '火力校准',
    maxLevel: 6,
    unlockLevel: 1,
    getCost: (level) => 28 + (level * 18),
    getDesc: () => '下一级：攻击 +4，提高清潮与精英处理效率。',
    apply: (scene) => {
      scene.upgradeLevels.player_damage += 1;
      scene.classOption.attackDamage += 4;
    },
  },
  {
    id: 'player_range',
    name: '前线视距',
    maxLevel: 5,
    unlockLevel: 1,
    getCost: (level) => 34 + (level * 20),
    getDesc: () => '下一级：射程 +18，让你更早接住进入前线的怪。',
    apply: (scene) => {
      scene.upgradeLevels.player_range += 1;
      scene.classOption.attackRange += 18;
    },
  },
  {
    id: 'player_fire_rate',
    name: '射击节奏',
    maxLevel: 5,
    unlockLevel: 1,
    getCost: (level) => 38 + (level * 22),
    getDesc: () => '下一级：攻击间隔缩短 55ms，持续输出更顺。',
    apply: (scene) => {
      scene.upgradeLevels.player_fire_rate += 1;
      scene.classOption.fireIntervalMs = Math.max(180, scene.classOption.fireIntervalMs - 55);
    },
  },
  {
    id: 'player_stride',
    name: '战线步幅',
    maxLevel: 4,
    unlockLevel: 1,
    getCost: (level) => 30 + (level * 20),
    getDesc: () => '下一级：移动速度 +16，回防和拉扯更从容。',
    apply: (scene) => {
      scene.upgradeLevels.player_stride += 1;
      scene.playerMoveSpeed += 16;
    },
  },
  {
    id: 'player_crit',
    name: '弱点校准',
    maxLevel: 4,
    unlockLevel: 10,
    getCost: (level) => 72 + (level * 34),
    getDesc: () => '下一级：暴击率 +7%，提升中后期精英爆发。',
    apply: (scene) => {
      scene.upgradeLevels.player_crit += 1;
      scene.playerCritChance = Math.min(0.6, scene.playerCritChance + 0.07);
    },
  },
  {
    id: 'player_crit_damage',
    name: '终结放大',
    maxLevel: 3,
    unlockLevel: 10,
    getCost: (level) => 86 + (level * 40),
    getDesc: () => '下一级：暴击倍率 +0.35，专门补终结伤害。',
    apply: (scene) => {
      scene.upgradeLevels.player_crit_damage += 1;
      scene.playerCritMultiplier += 0.35;
    },
  },
];

export const CORE_MODULES = [
  {
    id: 'core_interceptor',
    name: '拦截矩阵',
    maxLevel: 4,
    unlockLevel: 1,
    getCost: (level) => 90 + (level * 42),
    getDesc: () => '下一级：核心承伤减免继续提升，压阵精英在场时额外生效。',
    apply: (scene) => {
      scene.coreModuleLevels.core_interceptor += 1;
    },
  },
  {
    id: 'core_burn',
    name: '灼烧线圈',
    maxLevel: 5,
    unlockLevel: 1,
    getCost: (level) => 110 + (level * 34),
    getDesc: () => '下一级：灼烧伤害提升并缩短触发间隔，强化近核止损。',
    apply: (scene) => {
      scene.coreModuleLevels.core_burn += 1;
    },
  },
  {
    id: 'core_recovery',
    name: '回生脉冲',
    maxLevel: 4,
    unlockLevel: 1,
    getCost: (level) => 96 + (level * 36),
    getDesc: () => '下一级：脱压护盾回复更快，并提高最低护盾容量。',
    apply: (scene) => {
      scene.coreModuleLevels.core_recovery += 1;
      scene.coreShieldMax = Math.max(scene.coreShieldMax, 30 + (scene.coreModuleLevels.core_recovery * 25));
      scene.coreShield = Math.min(scene.coreShieldMax, scene.coreShield + 20);
    },
  },
  {
    id: 'core_slowfield',
    name: '迟滞场',
    maxLevel: 3,
    unlockLevel: 10,
    getCost: (level) => 138 + (level * 48),
    getDesc: () => '下一级：威胁圈内怪物减速更明显，帮助前线回收。',
    apply: (scene) => {
      scene.coreModuleLevels.core_slowfield += 1;
    },
  },
  {
    id: 'core_overload',
    name: '过载脉冲',
    maxLevel: 3,
    unlockLevel: 10,
    getCost: (level) => 146 + (level * 56),
    getDesc: () => '下一级：周期性点杀压阵精英或近核高威胁怪。',
    apply: (scene) => {
      scene.coreModuleLevels.core_overload += 1;
    },
  },
  {
    id: 'core_bastion',
    name: '堡垒外壳',
    maxLevel: 3,
    unlockLevel: 10,
    getCost: (level) => 142 + (level * 52),
    getDesc: () => '下一级：扩大近核防守纵深，并抬高护盾底盘。',
    apply: (scene) => {
      scene.coreModuleLevels.core_bastion += 1;
      scene.coreShieldMax = Math.max(scene.coreShieldMax, 50 + (scene.coreModuleLevels.core_bastion * 20));
    },
  },
];

export function createInitialUpgradeLevels() {
  return {
    player_damage: 0,
    player_range: 0,
    player_fire_rate: 0,
    player_stride: 0,
    player_crit: 0,
    player_crit_damage: 0,
  };
}

export function createInitialCoreModuleLevels() {
  return {
    core_interceptor: 0,
    core_burn: 0,
    core_recovery: 0,
    core_slowfield: 0,
    core_overload: 0,
    core_bastion: 0,
  };
}

export function getNextBattleExp(level) {
  return 4 + (Math.max(1, level) * 2);
}

export function buildUpgradePips(currentLevel, maxLevel) {
  const filled = '■'.repeat(Math.max(0, currentLevel || 0));
  const empty = '□'.repeat(Math.max(0, (maxLevel || 0) - (currentLevel || 0)));
  return `${filled}${empty}`;
}