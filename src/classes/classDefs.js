// 六大职业定义：统一管理职业元数据与核心升级

export const CLASS_IDS = /** @type {const} */ ({
  warrior: 'warrior',
  paladin: 'paladin',
  mage: 'mage',
  archer: 'archer',
  druid: 'druid',
  warlock: 'warlock'
});

// 当前项目里“buildState.core”的内部 key（历史原因不完全等于职业id）
export const CORE_KEYS = /** @type {const} */ ({
  warrior: 'warrior',
  paladin: 'paladin',
  mage: 'mage',
  archer: 'archer',
  druid: 'druid',
  warlock: 'warlock'
});

export const CORE_KEY_ALIASES = /** @type {const} */ ({
  drone: 'druid'
});

export const CORE_UPGRADE_IDS = /** @type {const} */ ({
  warrior: 'warrior_core',
  paladin: 'paladin_core',
  mage: 'mage_core',
  archer: 'archer_core',
  druid: 'druid_core',
  warlock: 'warlock_core'
});

export const CORE_UPGRADE_ID_ALIASES = /** @type {const} */ ({
  drone_core: 'druid_core'
});

export const CLASSES = [
  {
    id: CLASS_IDS.warrior,
    name: '战士',
    icon: '战主',
    coreUpgradeId: CORE_UPGRADE_IDS.warrior,
    coreKey: CORE_KEYS.warrior,
    coreDesc: '基础攻击变为近战月牙斩，生命上限提升'
  },
  {
    id: CLASS_IDS.archer,
    name: '猎人',
    icon: '猎主',
    coreUpgradeId: CORE_UPGRADE_IDS.archer,
    coreKey: CORE_KEYS.archer,
    coreDesc: '基础攻击为箭矢连射，可继续强化为多列箭雨'
  },
  {
    id: CLASS_IDS.paladin,
    name: '圣骑士',
    icon: '骑主',
    coreUpgradeId: CORE_UPGRADE_IDS.paladin,
    coreKey: CORE_KEYS.paladin,
    coreDesc: '获得护盾脉冲清弹并反击'
  },
  {
    id: CLASS_IDS.mage,
    name: '法师',
    icon: '法主',
    coreUpgradeId: CORE_UPGRADE_IDS.mage,
    coreKey: CORE_KEYS.mage,
    coreDesc: '基础攻击切换为单发冰弹，命中叠加寒霜，叠满三层爆炸并传染'
  },
  {
    id: CLASS_IDS.druid,
    name: '德鲁伊',
    icon: '德主',
    coreUpgradeId: CORE_UPGRADE_IDS.druid,
    coreKey: CORE_KEYS.druid,
    coreDesc: '基础攻击变为星落（定位敌方，星星下落造成范围伤害）'
  },
  {
    id: CLASS_IDS.warlock,
    name: '术士',
    icon: '术主',
    coreUpgradeId: CORE_UPGRADE_IDS.warlock,
    coreKey: CORE_KEYS.warlock,
    coreDesc: '基础攻击变为腐疫沼弹：朝最近目标投出腐疫弹，落地生成毒沼并持续叠毒'
  }
];

export const CORE_OPTIONS = CLASSES.map(c => ({
  id: c.coreUpgradeId,
  category: 'build',
  name: `${c.name}核心`,
  desc: c.coreDesc,
  icon: c.icon
}));

export function getClassByCoreUpgradeId(coreUpgradeId) {
  const normalizedUpgradeId = CORE_UPGRADE_ID_ALIASES[coreUpgradeId] || coreUpgradeId;
  return CLASSES.find(c => c.coreUpgradeId === normalizedUpgradeId) || null;
}

export function coreUpgradeIdToCoreKey(coreUpgradeId) {
  const def = getClassByCoreUpgradeId(coreUpgradeId);
  return def ? def.coreKey : null;
}

export function normalizeCoreKey(coreKey) {
  if (!coreKey) return coreKey;
  return CORE_KEY_ALIASES[coreKey] || coreKey;
}

export function coreKeysEqual(left, right) {
  if (!left || !right) return left === right;
  return normalizeCoreKey(left) === normalizeCoreKey(right);
}
