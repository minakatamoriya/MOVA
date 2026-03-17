import { resolveClassColor } from '../classes/visual/classColors';
import { getTreeIdForSkill } from '../classes/talentTrees';
import { DEPTH_SPEC_POOLS, DUAL_SPEC_POOLS } from '../classes/upgradePools';

const OFF_CLASS_TREE_BY_ID = {
  arcane_swift: 'mage',
  ranger_precise: 'archer',
  unyielding_bloodrage: 'warrior',
  off_curse: 'warlock',
  guardian_block: 'paladin',
  off_nature: 'druid'
};

const TREE_DISPLAY_NAME = {
  archer: '猎人',
  druid: '德鲁伊',
  warrior: '战士',
  mage: '法师',
  paladin: '圣骑士',
  warlock: '术士',
  arcane: '法师',
  ranger: '猎人',
  unyielding: '战士',
  curse: '术士',
  guardian: '圣骑士',
  nature: '德鲁伊',
  drone: '德鲁伊',
  scatter: '猎人'
};

const TREE_TO_COLOR_KEY = {
  archer: 'archer',
  druid: 'druid',
  warrior: 'warrior',
  mage: 'mage',
  paladin: 'paladin',
  warlock: 'warlock',
  arcane: 'mage',
  ranger: 'archer',
  unyielding: 'warrior',
  curse: 'warlock',
  guardian: 'paladin',
  nature: 'druid'
};

const MAIN_TREE_IDS = new Set(['archer', 'druid', 'warrior', 'mage', 'paladin', 'warlock']);
const OFF_TREE_IDS = new Set(['arcane', 'ranger', 'unyielding', 'curse', 'guardian', 'nature']);

const DEPTH_CARD_THEME_BY_ID = (() => {
  const entries = {};
  Object.entries(DEPTH_SPEC_POOLS || {}).forEach(([mainKey, options]) => {
    (options || []).forEach((option) => {
      if (option?.id) entries[option.id] = mainKey;
    });
  });
  return entries;
})();

const DUAL_CARD_THEME_BY_ID = (() => {
  const entries = {};
  Object.entries(DUAL_SPEC_POOLS || {}).forEach(([mainKey, byOff]) => {
    Object.entries(byOff || {}).forEach(([offKey, options]) => {
      (options || []).forEach((option) => {
        if (option?.id) entries[option.id] = { mainKey, offKey };
      });
    });
  });
  return entries;
})();

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  const normalized = Number(hex) || 0;
  return {
    r: clampChannel((normalized >> 16) & 0xff),
    g: clampChannel((normalized >> 8) & 0xff),
    b: clampChannel(normalized & 0xff)
  };
}

function toRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function brighten(hex, factor = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  const next = {
    r: clampChannel(r + (255 - r) * factor),
    g: clampChannel(g + (255 - g) * factor),
    b: clampChannel(b + (255 - b) * factor)
  };
  return (next.r << 16) | (next.g << 8) | next.b;
}

function createDefaultTheme(accent = 0x5c6f8f) {
  const accentSoft = brighten(accent, 0.26);
  const selectedBorder = brighten(accent, 0.48);
  return {
    kind: 'normal',
    badge: '',
    iconText: null,
    accent,
    accentSoft,
    panelFill: accent,
    panelSelectedFill: accentSoft,
    panelAlpha: 0.12,
    panelSelectedAlpha: 0.18,
    border: accent,
    selectedBorder,
    outerGlow: accent,
    shadow: `0 0 0 1px ${toRgba(accent, 0.22)}, 0 16px 32px rgba(0,0,0,0.28)`,
    gradient: `linear-gradient(180deg, ${toRgba(accent, 0.18)}, rgba(16, 18, 30, 0.96) 28%, rgba(10, 10, 21, 0.94))`,
    badgeBackground: toRgba(accent, 0.10),
    badgeBorder: toRgba(accentSoft, 0.22),
    badgeColor: '#dfe7ff',
    titleColor: '#ffff00',
    descColor: '#cfcfe6',
    effectClassName: ''
  };
}

function getNormalCardAccent(upgrade) {
  const treeId = getTreeIdForSkill(upgrade?.id || '');
  const colorKey = TREE_TO_COLOR_KEY[treeId] || null;
  if (colorKey) return resolveClassColor(colorKey);

  if ((upgrade?.category || '').startsWith('third_')) {
    return 0xd6b96f;
  }

  return 0x5c6f8f;
}

function createOffClassTheme(treeKey) {
  const accent = resolveClassColor(treeKey);
  const brightAccent = brighten(accent, 0.22);
  const treeName = TREE_DISPLAY_NAME[treeKey] || treeKey;
  return {
    kind: 'offclass',
    badge: `${treeName}副职业`,
    kicker: '入门解锁',
    iconText: '副职',
    accent,
    accentSoft: brightAccent,
    panelFill: accent,
    panelSelectedFill: brightAccent,
    panelAlpha: 0.18,
    panelSelectedAlpha: 0.24,
    border: brightAccent,
    selectedBorder: 0xffffff,
    outerGlow: accent,
    shadow: `0 0 0 1px ${toRgba(accent, 0.30)}, 0 20px 42px ${toRgba(accent, 0.26)}, inset 0 1px 0 ${toRgba(0xffffff, 0.24)}`,
    gradient: `linear-gradient(145deg, ${toRgba(accent, 0.34)}, rgba(10, 14, 24, 0.98) 54%, ${toRgba(brightAccent, 0.18)})`,
    badgeBackground: toRgba(accent, 0.16),
    badgeBorder: toRgba(brightAccent, 0.48),
    badgeColor: '#fdfefe',
    titleColor: '#ffffff',
    descColor: '#eff4ff',
    effectClassName: 'levelup-card-shimmer'
  };
}

function createMainTheme(treeKey) {
  return createDefaultTheme(resolveClassColor(treeKey));
}

function createOffTreeTheme(treeKey) {
  const accent = resolveClassColor(treeKey);
  const brightAccent = brighten(accent, 0.26);
  return {
    kind: 'offtree',
    badge: '副职业',
    iconText: null,
    accent,
    accentSoft: brightAccent,
    panelFill: accent,
    panelSelectedFill: brightAccent,
    panelAlpha: 0.12,
    panelSelectedAlpha: 0.17,
    border: brightAccent,
    selectedBorder: 0xffffff,
    outerGlow: accent,
    shadow: `0 0 0 1px ${toRgba(accent, 0.22)}, 0 14px 30px rgba(0,0,0,0.24), inset 0 1px 0 ${toRgba(0xffffff, 0.08)}`,
    gradient: `linear-gradient(145deg, ${toRgba(accent, 0.18)}, rgba(9, 13, 22, 0.96) 60%, ${toRgba(brightAccent, 0.08)})`,
    badgeBackground: toRgba(accent, 0.14),
    badgeBorder: toRgba(brightAccent, 0.38),
    badgeColor: '#eff5ff',
    titleColor: '#f6fbff',
    descColor: '#dce6f6',
    effectClassName: ''
  };
}

function createDepthTheme(mainKey) {
  const accent = resolveClassColor(TREE_TO_COLOR_KEY[mainKey] || mainKey);
  const jewel = brighten(accent, 0.36);
  const treeName = TREE_DISPLAY_NAME[TREE_TO_COLOR_KEY[mainKey] || mainKey] || TREE_DISPLAY_NAME[mainKey] || mainKey;
  return {
    kind: 'third_depth',
    badge: `${treeName}专精`,
    kicker: '本职业专精入门',
    iconText: '深度',
    accent,
    accentSoft: jewel,
    panelFill: accent,
    panelSelectedFill: jewel,
    panelAlpha: 0.18,
    panelSelectedAlpha: 0.24,
    border: jewel,
    selectedBorder: 0xffffff,
    outerGlow: accent,
    shadow: `0 0 0 1px ${toRgba(jewel, 0.32)}, 0 24px 48px ${toRgba(accent, 0.28)}, inset 0 1px 0 ${toRgba(0xffffff, 0.24)}`,
    gradient: `linear-gradient(145deg, ${toRgba(accent, 0.32)}, rgba(16, 14, 28, 0.96) 52%, ${toRgba(jewel, 0.18)})`,
    badgeBackground: toRgba(accent, 0.18),
    badgeBorder: toRgba(jewel, 0.46),
    badgeColor: '#fff8ef',
    titleColor: '#fff8e8',
    descColor: '#eef2ff',
    effectClassName: 'levelup-card-pulse'
  };
}

function createDualTheme(mainKey, offKey) {
  const mainAccent = resolveClassColor(TREE_TO_COLOR_KEY[mainKey] || mainKey);
  const offAccent = resolveClassColor(TREE_TO_COLOR_KEY[offKey] || offKey);
  const brightMain = brighten(mainAccent, 0.2);
  const brightOff = brighten(offAccent, 0.2);
  const mainName = TREE_DISPLAY_NAME[TREE_TO_COLOR_KEY[mainKey] || mainKey] || TREE_DISPLAY_NAME[mainKey] || mainKey;
  const offName = TREE_DISPLAY_NAME[TREE_TO_COLOR_KEY[offKey] || offKey] || TREE_DISPLAY_NAME[offKey] || offKey;
  return {
    kind: 'third_dual',
    badge: `${mainName} x ${offName}`,
    kicker: '双职业专精',
    iconText: '双职',
    accent: mainAccent,
    accentSoft: brightOff,
    secondaryAccent: offAccent,
    secondaryAccentSoft: brightMain,
    splitBackground: true,
    panelFill: mainAccent,
    secondaryFill: offAccent,
    panelSelectedFill: brightMain,
    secondarySelectedFill: brightOff,
    panelAlpha: 0.16,
    secondaryAlpha: 0.16,
    panelSelectedAlpha: 0.22,
    secondarySelectedAlpha: 0.22,
    border: brighten(((mainAccent & 0xfefefe) + (offAccent & 0xfefefe)) / 2, 0.18),
    selectedBorder: 0xffffff,
    outerGlow: brightMain,
    shadow: `0 0 0 1px ${toRgba(mainAccent, 0.24)}, 0 22px 44px ${toRgba(offAccent, 0.24)}, inset 0 1px 0 ${toRgba(0xffffff, 0.22)}`,
    gradient: `linear-gradient(115deg, ${toRgba(mainAccent, 0.28)} 0%, ${toRgba(mainAccent, 0.18)} 46%, ${toRgba(offAccent, 0.18)} 54%, ${toRgba(offAccent, 0.28)} 100%)`,
    badgeBackground: `linear-gradient(90deg, ${toRgba(mainAccent, 0.22)}, ${toRgba(offAccent, 0.22)})`,
    badgeBorder: toRgba(brightOff, 0.46),
    badgeColor: '#fffdf8',
    titleColor: '#fffdf7',
    descColor: '#eef3ff',
    effectClassName: 'levelup-card-shimmer'
  };
}

function createThirdTheme(kind) {
  const accent = kind === 'third_depth' ? 0xffd26a : 0x7ad7ff;
  const secondary = kind === 'third_depth' ? 0xfff2c1 : 0xb8a5ff;
  const badge = kind === 'third_depth' ? '本职业专精入门' : '双职业专精入门';
  const iconText = kind === 'third_depth' ? '深度' : '双职';
  return {
    kind,
    badge,
    kicker: kind === 'third_depth' ? '深度专精' : '双职业专精',
    iconText,
    accent,
    accentSoft: secondary,
    panelFill: accent,
    panelSelectedFill: secondary,
    panelAlpha: 0.16,
    panelSelectedAlpha: 0.22,
    border: secondary,
    selectedBorder: 0xffffff,
    outerGlow: accent,
    shadow: `0 0 0 1px ${toRgba(accent, 0.30)}, 0 22px 46px ${toRgba(accent, 0.28)}, inset 0 1px 0 ${toRgba(0xffffff, 0.28)}`,
    gradient: kind === 'third_depth'
      ? `linear-gradient(145deg, ${toRgba(accent, 0.28)}, rgba(31, 20, 8, 0.94) 56%, ${toRgba(secondary, 0.16)})`
      : `linear-gradient(145deg, ${toRgba(accent, 0.20)}, rgba(10, 16, 30, 0.94) 55%, ${toRgba(secondary, 0.18)})`,
    badgeBackground: toRgba(accent, 0.18),
    badgeBorder: toRgba(secondary, 0.50),
    badgeColor: '#fffdf5',
    titleColor: '#fff9d8',
    descColor: '#f2f4ff',
    effectClassName: 'levelup-card-pulse'
  };
}

export function getUpgradeCardTheme(upgrade) {
  const id = upgrade?.id || '';
  const offClassTree = OFF_CLASS_TREE_BY_ID[id];
  if (offClassTree) return createOffClassTheme(offClassTree);
  if (id === 'third_depth_prep') return createThirdTheme('third_depth');
  if (id === 'third_dual_prep') return createThirdTheme('third_dual');

  if (DEPTH_CARD_THEME_BY_ID[id]) {
    return createDepthTheme(DEPTH_CARD_THEME_BY_ID[id]);
  }

  if (DUAL_CARD_THEME_BY_ID[id]) {
    const pair = DUAL_CARD_THEME_BY_ID[id];
    return createDualTheme(pair.mainKey, pair.offKey);
  }

  const treeId = getTreeIdForSkill(id);
  if (MAIN_TREE_IDS.has(treeId)) {
    return createMainTheme(TREE_TO_COLOR_KEY[treeId] || treeId);
  }

  if (OFF_TREE_IDS.has(treeId)) {
    return createOffTreeTheme(TREE_TO_COLOR_KEY[treeId] || treeId);
  }

  return createDefaultTheme(getNormalCardAccent(upgrade));
}

export { toRgba, brighten };