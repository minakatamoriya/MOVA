import { getTalentSummary } from './talentNodeText';

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

function getCoreDesc(coreUpgradeId, fallback = '') {
  return getTalentSummary(coreUpgradeId, fallback);
}

export const CLASSES = [
  {
    id: CLASS_IDS.warrior,
    name: '战士',
    icon: '战主',
    coreUpgradeId: CORE_UPGRADE_IDS.warrior,
    coreKey: CORE_KEYS.warrior,
    coreDesc: getCoreDesc(CORE_UPGRADE_IDS.warrior)
  },
  {
    id: CLASS_IDS.archer,
    name: '猎人',
    icon: '猎主',
    coreUpgradeId: CORE_UPGRADE_IDS.archer,
    coreKey: CORE_KEYS.archer,
    coreDesc: getCoreDesc(CORE_UPGRADE_IDS.archer)
  },
  {
    id: CLASS_IDS.paladin,
    name: '圣骑士',
    icon: '骑主',
    coreUpgradeId: CORE_UPGRADE_IDS.paladin,
    coreKey: CORE_KEYS.paladin,
    coreDesc: getCoreDesc(CORE_UPGRADE_IDS.paladin)
  },
  {
    id: CLASS_IDS.mage,
    name: '法师',
    icon: '法主',
    coreUpgradeId: CORE_UPGRADE_IDS.mage,
    coreKey: CORE_KEYS.mage,
    coreDesc: getCoreDesc(CORE_UPGRADE_IDS.mage)
  },
  {
    id: CLASS_IDS.druid,
    name: '德鲁伊',
    icon: '德主',
    coreUpgradeId: CORE_UPGRADE_IDS.druid,
    coreKey: CORE_KEYS.druid,
    coreDesc: getCoreDesc(CORE_UPGRADE_IDS.druid)
  },
  {
    id: CLASS_IDS.warlock,
    name: '术士',
    icon: '术主',
    coreUpgradeId: CORE_UPGRADE_IDS.warlock,
    coreKey: CORE_KEYS.warlock,
    coreDesc: getCoreDesc(CORE_UPGRADE_IDS.warlock)
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
