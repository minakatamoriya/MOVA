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
  archer: 'scatter',
  druid: 'drone',
  warlock: 'warlock'
});

export const CORE_UPGRADE_IDS = /** @type {const} */ ({
  warrior: 'warrior_core',
  paladin: 'paladin_core',
  mage: 'mage_core',
  archer: 'scatter_core',
  druid: 'drone_core',
  warlock: 'warlock_core'
});

export const CLASSES = [
  {
    id: CLASS_IDS.warrior,
    name: '战士',
    icon: '战主',
    coreUpgradeId: CORE_UPGRADE_IDS.warrior,
    coreKey: CORE_KEYS.warrior,
    coreDesc: '基础攻击变为劈砍，生命上限提升'
  },
  {
    id: CLASS_IDS.archer,
    name: '猎人',
    icon: '猎主',
    coreUpgradeId: CORE_UPGRADE_IDS.archer,
    coreKey: CORE_KEYS.archer,
    coreDesc: '基础攻击为散射箭，覆盖更广'
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
    coreDesc: '基础攻击切换为激光聚焦'
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
    coreDesc: '基础攻击变为剧毒新星：每 2 秒在脚下留下毒圈并逐渐扩大（走位引导）'
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
  return CLASSES.find(c => c.coreUpgradeId === coreUpgradeId) || null;
}

export function coreUpgradeIdToCoreKey(coreUpgradeId) {
  const def = getClassByCoreUpgradeId(coreUpgradeId);
  return def ? def.coreKey : null;
}
