import React, { useEffect, useRef, useState } from 'react';
import { uiBus } from './bus';
import { useUiStore } from './store';
import { TREE_DEFS, getMaxLevel, getTreeSpentPoints } from '../classes/talentTrees';
import { DEPTH_SPEC_POOLS, TALENT_OFFER_WEIGHT_CONFIG, UPGRADE_POOLS, UNIVERSAL_POOLS } from '../classes/upgradePools';
import { getTalentOfferStage } from '../classes/dualClass';
import { getEquipState, getOwnedItemCount, getPurchaseState, ITEM_DEFS } from '../data/items';
import { getGlobalShopCatalog } from '../managers/ShopManager';
import { getUpgradeCardTheme, toRgba } from './upgradeCardTheme';

const GAME_VIEW_WIDTH = 720;
const GAME_VIEW_HEIGHT = 1280;
const OFFCLASS_ENTRY_IDS = new Set(['off_arcane', 'off_ranger', 'off_unyielding', 'off_summon', 'off_guardian', 'off_nature']);

const TALENT_NODE_META_BY_ID = (() => {
  const byId = {};

  const registerPool = (treeId, options, source) => {
    (options || []).forEach((option, index) => {
      if (!option?.id) return;
      byId[option.id] = {
        treeId,
        source,
        order: index,
        requiredSkillId: option.requiredSkillId || null,
        requiredSkillLevel: Math.max(1, Number(option.requiredSkillLevel || 1)),
        isDepth: source === 'depth' || String(option.category || '').startsWith('third_')
      };
    });
  };

  Object.entries(UPGRADE_POOLS || {}).forEach(([treeId, options]) => registerPool(treeId, options, 'main'));
  Object.entries(UNIVERSAL_POOLS || {}).forEach(([treeId, options]) => registerPool(treeId, options, 'off'));
  Object.entries(DEPTH_SPEC_POOLS || {}).forEach(([treeId, options]) => registerPool(treeId, options, 'depth'));

  return byId;
})();

const TREE_ICON_ROW_LAYOUTS = {
  archer: [
    ['archer_core'],
    ['archer_range', 'archer_volley', 'archer_rapidfire'],
    ['archer_nimble_evade', 'archer_arrowrain'],
    ['archer_bounce', 'archer_windfury', 'archer_eagleeye']
  ],
  druid: [
    ['druid_core'],
    ['druid_meteor_shower', 'druid_meteor', 'druid_starfire'],
    ['druid_nourish'],
    ['druid_kingofbeasts', 'druid_naturefusion', 'druid_astralstorm']
  ],
  warrior: [
    ['warrior_core'],
    ['warrior_range', 'warrior_swordqi', 'warrior_damage'],
    ['warrior_blood_conversion'],
    ['warrior_spin', 'warrior_berserkgod', 'warrior_unyielding']
  ],
  mage: [
    ['mage_core'],
    ['mage_frostbite', 'mage_cold_focus', 'mage_ice_veins'],
    ['mage_deep_freeze', 'mage_shatter', 'mage_frost_nova'],
    ['mage_dualcaster', 'mage_trilaser', 'mage_arcanomorph']
  ],
  paladin: [
    ['paladin_core'],
    ['paladin_pierce', 'paladin_repulse', 'paladin_triple'],
    ['paladin_stun', 'paladin_divine_shelter', 'paladin_pulse'],
    ['paladin_avenger', 'paladin_sacredshield', 'paladin_divine']
  ],
  warlock: [
    ['warlock_core'],
    ['warlock_toxicity', 'warlock_corrode', 'warlock_spread'],
    ['warlock_infernal', 'warlock_malady'],
    ['warlock_autoseek', 'warlock_souleater', 'warlock_netherlord']
  ],
  arcane: [
    ['off_arcane'],
    ['arcane_circle', 'arcane_circle_range', 'arcane_fire_circle'],
    ['arcane_frost_circle', 'arcane_resonance_mark', 'arcane_flowcasting']
  ],
  ranger: [
    ['off_ranger'],
    ['ranger_snaretrap', 'ranger_huntmark', 'ranger_blasttrap'],
    ['ranger_spiketrap', 'ranger_trapcraft', 'ranger_pack_hunter']
  ],
  unyielding: [
    ['off_unyielding'],
    ['unyielding_bloodrage', 'unyielding_battlecry', 'unyielding_sunder'],
    ['unyielding_hamstring', 'unyielding_standfast', 'unyielding_executioner']
  ],
  summon: [
    ['off_summon'],
    ['summon_necrotic_vitality', 'summon_skeleton_guard', 'summon_skeleton_mage'],
    ['summon_mage_empower', 'summon_guard_bulwark', 'summon_ember_echo']
  ],
  guardian: [
    ['off_guardian'],
    ['guardian_block', 'guardian_armor', 'guardian_counter'],
    ['guardian_sacred_seal', 'guardian_holy_rebuke', 'guardian_light_fortress']
  ],
  nature: [
    ['off_nature'],
    ['druid_pet_bear', 'druid_pet_hawk', 'druid_pet_treant'],
    ['nature_bear_guard', 'nature_hawk_huntmark', 'nature_treant_bloom']
  ]
};

const MENU_CLASS_OPTIONS = [
  {
    id: 'warrior',
    name: '战士',
    glyph: '⚔',
    color: '#f97316',
    accent: 'rgba(249,115,22,0.26)',
    tags: ['近战', '爆发', '硬冲'],
    summary: '挥砍贴脸，月牙外放。适合喜欢顶住压力正面压进的打法。',
    baseSkill: '月牙斩：前方扇形大范围挥斩，贴脸压场能力很强。',
    strengths: ['前线压制强', '血量和容错高', '清近身怪稳定'],
    showcase: ['剑气增程', '旋风连斩', '狂战神'],
    stats: [
      { label: '生存', value: 5 },
      { label: '输出', value: 4 },
      { label: '机动', value: 2 },
      { label: '上手', value: 4 }
    ]
  },
  {
    id: 'paladin',
    name: '圣骑士',
    glyph: '⛨',
    color: '#facc15',
    accent: 'rgba(250,204,21,0.24)',
    tags: ['防守', '反击', '控场'],
    summary: '护盾脉冲兼顾防守和反制，适合偏稳健、喜欢顶住弹幕慢慢推进。',
    baseSkill: '护盾脉冲：近身触发冲击，清弹并震退周围敌人。',
    strengths: ['减伤和格挡稳定', '近身清弹强', '对密集怪舒服'],
    showcase: ['重锤穿透', '神圣庇护', '圣光堡垒'],
    stats: [
      { label: '生存', value: 5 },
      { label: '输出', value: 3 },
      { label: '机动', value: 2 },
      { label: '上手', value: 5 }
    ]
  },
  {
    id: 'archer',
    name: '猎人',
    glyph: '➶',
    color: '#22c55e',
    accent: 'rgba(34,197,94,0.24)',
    tags: ['远程', '高频', '走位'],
    summary: '持续连射、节奏快、射程舒服，适合手机端边走边打的直觉体验。',
    baseSkill: '箭矢连射：自动索敌连续射击，可一路强化成多列箭雨。',
    strengths: ['射程稳定', '输出频率高', '走位容错好'],
    showcase: ['射程扩张', '多列箭雨', '风怒连发'],
    stats: [
      { label: '生存', value: 3 },
      { label: '输出', value: 4 },
      { label: '机动', value: 5 },
      { label: '上手', value: 5 }
    ]
  },
  {
    id: 'mage',
    name: '法师',
    glyph: '✦',
    color: '#38bdf8',
    accent: 'rgba(56,189,248,0.24)',
    tags: ['控制', '冻结', '射线'],
    summary: '冰弹起手，后期可转向极强控场与星界贯炮，成长上限很高。',
    baseSkill: '冰弹：命中叠加寒霜，持续强化后能冻结、碎裂并扩散。',
    strengths: ['控制能力强', '后期成长夸张', '对精英和 Boss 有压制感'],
    showcase: ['寒霜侵蚀', '冰霜新星', '星界贯炮'],
    stats: [
      { label: '生存', value: 2 },
      { label: '输出', value: 5 },
      { label: '机动', value: 3 },
      { label: '上手', value: 3 }
    ]
  },
  {
    id: 'warlock',
    name: '术士',
    glyph: '☠',
    color: '#a855f7',
    accent: 'rgba(168,85,247,0.24)',
    tags: ['持续伤害', '远程布场', '召唤'],
    summary: '以缓慢投掷和区域腐蚀压制战场，适合喜欢远程布场与持续结算的打法。',
    baseSkill: '腐疫沼弹：朝最近目标投出腐疫弹，落地化作毒沼；敌人停留其中会叠毒，满层时触发传染爆裂。',
    strengths: ['远程起手安全', '持续压血稳定', '后续可顺接召唤流'],
    showcase: ['毒性扩张', '腐蚀传播', '虚空领主'],
    stats: [
      { label: '生存', value: 3 },
      { label: '输出', value: 4 },
      { label: '机动', value: 4 },
      { label: '上手', value: 3 }
    ]
  },
  {
    id: 'druid',
    name: '德鲁伊',
    glyph: '✺',
    color: '#84cc16',
    accent: 'rgba(132,204,22,0.24)',
    tags: ['范围', '召星', '自然'],
    summary: '星落锁敌、打点柔和，后续还能接自然伙伴体系，属于均衡型职业。',
    baseSkill: '星落：锁定敌方落下范围伤害，节奏平稳，覆盖感很强。',
    strengths: ['范围伤害舒服', '成长路线全面', '对新手友好'],
    showcase: ['陨星连落', '自然滋养', '星界风暴'],
    stats: [
      { label: '生存', value: 4 },
      { label: '输出', value: 4 },
      { label: '机动', value: 3 },
      { label: '上手', value: 4 }
    ]
  }
];

function chunkTalentNodes(nodes, chunkSize) {
  const result = [];
  const size = Math.max(1, Math.floor(Number(chunkSize) || 1));
  for (let index = 0; index < nodes.length; index += size) {
    result.push(nodes.slice(index, index + size));
  }
  return result;
}

function getTalentNodeMeta(nodeId) {
  return TALENT_NODE_META_BY_ID[nodeId] || null;
}

function getDepthUnlockState(selectedTrees = [], skillTreeLevels = {}, levelUps = 0) {
  const mainTreeId = selectedTrees[0] || null;
  const offTreeId = selectedTrees[1] || null;
  const mainThreshold = Math.max(1, Number(TALENT_OFFER_WEIGHT_CONFIG?.depthSpecMainPointThreshold || 6));
  const offThreshold = Math.max(1, Number(TALENT_OFFER_WEIGHT_CONFIG?.depthSpecOffPointThreshold || 2));
  const normalizedLevelUps = Math.max(0, Number(levelUps) || 0);
  const stage = getTalentOfferStage(normalizedLevelUps);
  const mainSpent = mainTreeId ? getTreeSpentPoints(mainTreeId, skillTreeLevels) : 0;
  const offSpent = offTreeId ? getTreeSpentPoints(offTreeId, skillTreeLevels) : 0;
  const stageReady = stage === 'all';
  const mainReady = !!mainTreeId && mainSpent >= mainThreshold;
  const offReady = !!offTreeId && offSpent >= offThreshold;

  return {
    stage,
    stageReady,
    mainReady,
    offReady,
    unlocked: !!mainTreeId && !!offTreeId && stageReady && mainReady && offReady,
    levelUps: normalizedLevelUps,
    mainTreeId,
    offTreeId,
    mainSpent,
    offSpent,
    mainThreshold,
    offThreshold,
    remainingLevelUps: stageReady ? 0 : Math.max(0, 5 - normalizedLevelUps),
    remainingMainPoints: mainReady ? 0 : Math.max(0, mainThreshold - mainSpent),
    remainingOffPoints: offReady ? 0 : Math.max(0, offThreshold - offSpent)
  };
}

function buildTalentRows(def) {
  if (!def?.core) return [];

  const nodes = Array.isArray(def.nodes) ? def.nodes : [];
  const depthNodes = [];
  const rootNodes = [];
  const dependentByRequirement = new Map();
  const unorderedDependents = [];

  nodes.forEach((node) => {
    const meta = getTalentNodeMeta(node.id);
    if (meta?.isDepth) {
      depthNodes.push(node);
      return;
    }

    if (!meta?.requiredSkillId) {
      rootNodes.push(node);
      return;
    }

    const key = String(meta.requiredSkillId);
    if (!dependentByRequirement.has(key)) dependentByRequirement.set(key, []);
    dependentByRequirement.get(key).push(node);
  });

  const rows = [
    { key: `${def.id}:core`, label: '起点', tone: 'core', nodes: [def.core] }
  ];

  chunkTalentNodes(rootNodes, 4).forEach((group, index) => {
    rows.push({
      key: `${def.id}:base:${index}`,
      label: index === 0 ? '基础层' : '基础延展',
      tone: 'base',
      nodes: group
    });
  });

  rootNodes.forEach((rootNode) => {
    const children = dependentByRequirement.get(rootNode.id) || [];
    if (!children.length) return;
    chunkTalentNodes(children, 4).forEach((group, index) => {
      rows.push({
        key: `${def.id}:dep:${rootNode.id}:${index}`,
        label: `${rootNode.name} 后续`,
        tone: 'branch',
        requires: rootNode.name,
        nodes: group
      });
    });
    dependentByRequirement.delete(rootNode.id);
  });

  dependentByRequirement.forEach((children, requiredSkillId) => {
    unorderedDependents.push(...chunkTalentNodes(children, 4).map((group, index) => ({
      key: `${def.id}:dep:${requiredSkillId}:${index}`,
      label: '进阶层',
      tone: 'branch',
      requires: requiredSkillId,
      nodes: group
    })));
  });

  rows.push(...unorderedDependents);

  chunkTalentNodes(depthNodes, 3).forEach((group, index) => {
    rows.push({
      key: `${def.id}:depth:${index}`,
      label: '深度专精',
      tone: 'depth',
      nodes: group
    });
  });

  return rows;
}

function buildTalentIconRows(def, skillTreeLevels = {}) {
  if (!def?.core) return [];

  const nodes = [def.core, ...(Array.isArray(def.nodes) ? def.nodes : [])].filter(Boolean);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const layout = TREE_ICON_ROW_LAYOUTS[def.id] || [];
  const usedIds = new Set();
  const rows = [];

  layout.forEach((rowIds) => {
    const row = rowIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter(Boolean);
    row.forEach((node) => usedIds.add(node.id));
    if (row.length > 0) rows.push(row);
  });

  const remainingNodes = nodes
    .filter((node) => !usedIds.has(node.id))
    .sort((left, right) => {
      const leftMeta = getTalentNodeMeta(left.id);
      const rightMeta = getTalentNodeMeta(right.id);
      const leftLevel = Math.max(0, Number(skillTreeLevels?.[left.id] || 0));
      const rightLevel = Math.max(0, Number(skillTreeLevels?.[right.id] || 0));
      const leftBucket = leftLevel > 0 ? 0 : (leftMeta?.isDepth ? 2 : 1);
      const rightBucket = rightLevel > 0 ? 0 : (rightMeta?.isDepth ? 2 : 1);
      if (leftBucket !== rightBucket) return leftBucket - rightBucket;
      return Number(leftMeta?.order || 0) - Number(rightMeta?.order || 0);
    });

  rows.push(...chunkTalentNodes(remainingNodes, 4));
  return rows;
}

function getGameViewportRect() {
  if (typeof window === 'undefined') {
    return { width: GAME_VIEW_WIDTH, height: GAME_VIEW_HEIGHT };
  }

  const vv = window.visualViewport;
  const viewportWidth = Math.round(Number(vv?.width) || window.innerWidth || GAME_VIEW_WIDTH);
  const viewportHeight = Math.round(Number(vv?.height) || window.innerHeight || GAME_VIEW_HEIGHT);
  const scale = Math.max(0.1, Math.min(viewportWidth / GAME_VIEW_WIDTH, viewportHeight / GAME_VIEW_HEIGHT));

  return {
    width: Math.max(1, Math.round(GAME_VIEW_WIDTH * scale)),
    height: Math.max(1, Math.round(GAME_VIEW_HEIGHT * scale))
  };
}

export default function App() {
  const sceneKey = useUiStore((s) => s.sceneKey);
  const setSceneKey = useUiStore((s) => s.setSceneKey);
  const inGame = useUiStore((s) => s.inGame);
  const setInGame = useUiStore((s) => s.setInGame);

  const showDamage = useUiStore((s) => s.showDamage);
  const setShowDamage = useUiStore((s) => s.setShowDamage);
  const showEnemyOverlays = useUiStore((s) => s.showEnemyOverlays);
  const setShowEnemyOverlays = useUiStore((s) => s.setShowEnemyOverlays);
  const enemyHpMode = useUiStore((s) => s.enemyHpMode);
  const setEnemyHpMode = useUiStore((s) => s.setEnemyHpMode);

  const viewOpen = useUiStore((s) => s.viewOpen);
  const setViewOpen = useUiStore((s) => s.setViewOpen);
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const viewData = useUiStore((s) => s.viewData);
  const setViewData = useUiStore((s) => s.setViewData);
  const selectedTalent = useUiStore((s) => s.selectedTalent);
  const setSelectedTalent = useUiStore((s) => s.setSelectedTalent);
  const selectedItem = useUiStore((s) => s.selectedItem);
  const setSelectedItem = useUiStore((s) => s.setSelectedItem);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [floatingInfoText, setFloatingInfoText] = useState('');
  const [gameViewportRect, setGameViewportRect] = useState(() => getGameViewportRect());
  const [selectedMenuCore, setSelectedMenuCore] = useState(MENU_CLASS_OPTIONS[0]?.id || 'warrior');
  const [menuScreen, setMenuScreen] = useState('home');
  const floatingInfoTimerRef = useRef(null);
  const prevSceneKeyRef = useRef(sceneKey);

  const showFloatingInfo = (text) => {
    const t = String(text || '').trim();
    if (!t) return;
    setFloatingInfoText(t);
    if (floatingInfoTimerRef.current) {
      clearTimeout(floatingInfoTimerRef.current);
      floatingInfoTimerRef.current = null;
    }
    floatingInfoTimerRef.current = setTimeout(() => {
      setFloatingInfoText('');
      floatingInfoTimerRef.current = null;
    }, 3200);
  };

  useEffect(() => {
    return () => {
      if (floatingInfoTimerRef.current) {
        clearTimeout(floatingInfoTimerRef.current);
        floatingInfoTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const updateViewportRect = () => {
      setGameViewportRect((prev) => {
        const next = getGameViewportRect();
        if (prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };

    updateViewportRect();
    window.addEventListener('resize', updateViewportRect);
    window.addEventListener('orientationchange', updateViewportRect);
    window.visualViewport?.addEventListener?.('resize', updateViewportRect);

    return () => {
      window.removeEventListener('resize', updateViewportRect);
      window.removeEventListener('orientationchange', updateViewportRect);
      window.visualViewport?.removeEventListener?.('resize', updateViewportRect);
    };
  }, []);

  useEffect(() => {
    const onPhaserViewState = (open) => setViewOpen(!!open);
    uiBus.on('phaser:viewOpenChanged', onPhaserViewState);
    return () => {
      uiBus.off('phaser:viewOpenChanged', onPhaserViewState);
    };
  }, [setViewOpen]);

  useEffect(() => {
    const onSceneChanged = (key) => setSceneKey(key);
    const onInGameChanged = (v) => setInGame(!!v);
    uiBus.on('phaser:sceneChanged', onSceneChanged);
    uiBus.on('phaser:inGameChanged', onInGameChanged);
    return () => {
      uiBus.off('phaser:sceneChanged', onSceneChanged);
      uiBus.off('phaser:inGameChanged', onInGameChanged);
    };
  }, [setSceneKey, setInGame]);

  useEffect(() => {
    const onSnapshot = (data) => {
      setViewData(data);
    };
    uiBus.on('phaser:uiSnapshot', onSnapshot);
    return () => {
      uiBus.off('phaser:uiSnapshot', onSnapshot);
    };
  }, [setViewData]);

  useEffect(() => {
    const onSettingsChanged = (settings) => {
      setShowDamage(settings?.showDamage !== false);
      setShowEnemyOverlays(settings?.showEnemyOverlays === true);
      setEnemyHpMode(settings?.enemyHpMode === 'low' ? 'low' : 'normal');
    };
    uiBus.on('phaser:settingsChanged', onSettingsChanged);
    // 拉取一次当前设置（main.js 也会初始推送，但这里确保不漏）
    uiBus.emit('ui:settings:request');
    return () => {
      uiBus.off('phaser:settingsChanged', onSettingsChanged);
    };
  }, [setShowDamage, setShowEnemyOverlays, setEnemyHpMode]);

  useEffect(() => {
    if (!viewOpen) return;
    // 打开或切换 tab 时向 Phaser 拉取最新快照
    uiBus.emit('ui:requestSnapshot');
  }, [viewOpen, activeTab]);

  useEffect(() => {
    // 进入需要展示 registry 数据的菜单场景时拉取一次快照
    if (
      sceneKey === 'ItemShopScene' ||
      sceneKey === 'EquipmentScene' ||
      sceneKey === 'LevelUpScene' ||
      sceneKey === 'BuildTreeScene' ||
      sceneKey === 'ShopScene' ||
      sceneKey === 'GameOverScene'
    ) {
      uiBus.emit('ui:requestSnapshot');
    }
  }, [sceneKey]);

  useEffect(() => {
    // 离开主菜单时自动关闭设置弹层
    if (sceneKey !== 'MenuScene' && settingsOpen) setSettingsOpen(false);
  }, [sceneKey, settingsOpen]);

  useEffect(() => {
    if (sceneKey === 'MenuScene' && prevSceneKeyRef.current !== 'MenuScene') {
      setMenuScreen('home');
    }
    prevSceneKeyRef.current = sceneKey;
  }, [sceneKey]);

  useEffect(() => {
    // 离开游戏内或查看菜单关闭时，自动关闭退出确认
    if (!inGame || !viewOpen) {
      if (confirmExitOpen) setConfirmExitOpen(false);
      if (floatingInfoText) setFloatingInfoText('');
    }
  }, [inGame, viewOpen, confirmExitOpen, floatingInfoText]);

  const selectedTrees = viewData?.selectedTrees || [];
  const skillTreeLevels = viewData?.skillTreeLevels || {};
  const mainCore = viewData?.mainCore || null;
  const offFaction = viewData?.offFaction || null;
  const inventoryEquipped = viewData?.inventoryEquipped || [];
  const inventoryAcquired = viewData?.inventoryAcquired || [];
  const player = viewData?.player || null;
  const gameplayNowMs = Number(viewData?.gameplayNowMs || 0);
  const itemCooldowns = (viewData?.itemCooldowns && typeof viewData.itemCooldowns === 'object') ? viewData.itemCooldowns : {};
  const ownedItems = viewData?.ownedItems || [];
  const equippedItems = Array.isArray(viewData?.equippedItems) ? viewData.equippedItems : [];
  const levelUp = viewData?.levelUp || null;
  const shop = viewData?.shop || null;
  const gameOver = viewData?.gameOver || null;
  const runConsumables = (viewData?.runConsumables && typeof viewData.runConsumables === 'object') ? viewData.runConsumables : {};
  const levelUpPendingPoints = Math.max(0, Number(levelUp?.pendingPoints || 0));
  const rerollDiceCount = Math.max(
    0,
    Number(levelUp?.rerollDiceCount ?? runConsumables?.reroll_dice?.count ?? 0)
  );
  const levelUpOptions = Array.isArray(levelUp?.options) ? levelUp.options : [];
  const isOffClassChoice = levelUpOptions.length === OFFCLASS_ENTRY_IDS.size
    && levelUpOptions.every((opt) => OFFCLASS_ENTRY_IDS.has(String(opt?.id || '')));
  const rerollItemDef = ITEM_DEFS.find((it) => it.id === 'reroll_dice') || null;
  const denseLevelUpCards = levelUpOptions.length >= 4;
  const compactLevelUpCards = denseLevelUpCards || gameViewportRect.height < 680;
  const levelUpViewportWidth = Math.max(320, gameViewportRect.width);
  const levelUpViewportHeight = Math.max(568, gameViewportRect.height);
  const itemShopItems = Array.isArray(viewData?.itemShop?.items)
    ? viewData.itemShop.items
    : getGlobalShopCatalog({ ownedItems, globalCoins: viewData?.globalCoins || 0 });
  const isRoundVendorShop = shop?.mode === 'round_vendor';
  const levelUpPanelOpen = !!levelUp?.open && levelUpPendingPoints > 0;
  const levelUpAttentionBaseMs = Math.max(
    Number(levelUp?.pendingSinceMs || 0),
    Number(levelUp?.lastInteractionMs || 0)
  );
  const selectedMenuClass = MENU_CLASS_OPTIONS.find((item) => item.id === selectedMenuCore) || MENU_CLASS_OPTIONS[0];
  const menuViewportCompact = gameViewportRect.width <= 430;
  const levelUpAttentionElapsedMs = (!levelUpPanelOpen && levelUpPendingPoints > 0)
    ? Math.max(0, gameplayNowMs - levelUpAttentionBaseMs)
    : 0;
  const levelUpUrgency = levelUpAttentionElapsedMs >= 12000
    ? 2
    : (levelUpAttentionElapsedMs >= 6000 ? 1 : 0);

  // 装备系统（React 版）交互：点击=查看详情；详情卡片右侧按钮操作（装备/卸载）
  const [equipDetail, setEquipDetail] = useState(null);

  // 道具商店（React 版）交互：点击=查看详情（风格与装备查看类似）
  const [shopDetailItem, setShopDetailItem] = useState(null);

  const LONG_PRESS_MS = 420;

  const pressStateRef = useRef({ timer: null, fired: false, key: null });
  const clearPressState = () => {
    const t = pressStateRef.current?.timer;
    if (t) clearTimeout(t);
    pressStateRef.current = { timer: null, fired: false, key: null };
  };

  const startLongPress = (key, onLongPress, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    clearPressState();
    pressStateRef.current = {
      key,
      fired: false,
      timer: setTimeout(() => {
        // 触发长按
        pressStateRef.current = { ...pressStateRef.current, fired: true, timer: null };
        try {
          onLongPress?.();
        } catch (err) {
          // ignore
        }
      }, LONG_PRESS_MS)
    };
  };

  const endLongPress = (key, onShortPress, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const cur = pressStateRef.current;
    if (!cur || cur.key !== key) {
      clearPressState();
      return;
    }
    const fired = !!cur.fired;
    clearPressState();
    if (!fired) {
      try {
        onShortPress?.();
      } catch (err) {
        // ignore
      }
    }
  };

  const showShopDetail = (item) => {
    setShopDetailItem(item || null);
  };

  const showEquipDetail = (payload) => {
    if (!payload) {
      setEquipDetail(null);
      return;
    }
    const item = payload?.item || null;
    if (!item) return;
    setEquipDetail({
      item,
      kind: payload?.kind === 'equipped' ? 'equipped' : 'owned',
      slotIndex: Number.isFinite(Number(payload?.slotIndex)) ? Number(payload.slotIndex) : null
    });
  };

  useEffect(() => {
    return () => {
      clearPressState();
    };
  }, []);

  useEffect(() => {
    if (sceneKey !== 'EquipmentScene') {
      setEquipDetail(null);
    }
    if (sceneKey !== 'ItemShopScene' && sceneKey !== 'ShopScene') {
      setShopDetailItem(null);
    }
  }, [sceneKey]);

  useEffect(() => {
    if (!shopDetailItem?.id) return;
    if (sceneKey !== 'ItemShopScene' && sceneKey !== 'ShopScene') return;
    const currentItems = Array.isArray(shop?.items) ? shop.items : [];
    const nextItem = currentItems.find((item) => item?.id === shopDetailItem.id) || null;
    if (!nextItem) return;
    setShopDetailItem(nextItem);
  }, [sceneKey, shop?.items, shopDetailItem?.id]);

  const getOwnedCount = (itemId) => getOwnedItemCount(ownedItems, itemId);
  const getEquippedCount = (itemId) => getOwnedItemCount(equippedItems, itemId);

  const getStackedEquippedDisplay = (items) => {
    const source = Array.isArray(items) ? items : [];
    const grouped = [];
    const indexById = new Map();

    for (let i = 0; i < source.length; i += 1) {
      const item = source[i];
      if (!item?.id) continue;
      const existingIndex = indexById.get(item.id);
      if (existingIndex == null) {
        indexById.set(item.id, grouped.length);
        grouped.push({ ...item, count: 1, slots: [i] });
      } else {
        const current = grouped[existingIndex];
        grouped[existingIndex] = {
          ...current,
          count: Number(current.count || 0) + 1,
          slots: [...(current.slots || []), i]
        };
      }
    }

    while (grouped.length < 6) grouped.push(null);
    return grouped.slice(0, 6);
  };

  const attemptPurchaseShopItem = (item) => {
    if (!item?.id) return;
    const purchaseState = getPurchaseState(item, ownedItems, viewData?.globalCoins || 0);
    if (!purchaseState.ok) {
      if (purchaseState.reason === 'max_owned') {
        showFloatingInfo(`已达购买上限 ${purchaseState.maxOwned}`);
      } else if (purchaseState.reason === 'not_enough_coins') {
        showFloatingInfo('金币不足');
      }
      return;
    }
    uiBus.emit('ui:itemShop:purchase', item.id);
  };

  const attemptRoundVendorPurchase = (item) => {
    if (!item?.id || item?.canBuy === false) {
      if (item?.disabledReason === 'carry_limit') {
        showFloatingInfo(`已达携带上限 ${Math.max(0, Number(item?.carryLimit || 0))}`);
      }
      if (item?.disabledReason === 'backpack_full') {
        showFloatingInfo(`背包已满 ${Math.max(0, Number(item?.backpackCount || 0))}/${Math.max(0, Number(item?.backpackCapacity || 0))}`);
      }
      if (item?.disabledReason === 'not_enough_session_coins') showFloatingInfo('局内金币不足');
      if (item?.disabledReason === 'sold_out') showFloatingInfo('该商品已售出');
      return;
    }
    uiBus.emit('ui:shop:buy', item.id);
    return true;
  };

  const getRoundVendorDisabledText = (item) => {
    const reason = item?.disabledReason || '';
    if (reason === 'carry_limit') {
      const current = Math.max(0, Number(item?.currentCount || 0));
      const limit = Math.max(0, Number(item?.carryLimit || 0));
      return limit > 0 ? `已满 ${current}/${limit}` : '已满';
    }
    if (reason === 'backpack_full') {
      const current = Math.max(0, Number(item?.backpackCount || 0));
      const limit = Math.max(0, Number(item?.backpackCapacity || 0));
      return limit > 0 ? `背包满 ${current}/${limit}` : '背包已满';
    }
    if (reason === 'not_enough_session_coins') return '金币不足';
    if (reason === 'sold_out') return '已售';
    return '';
  };

  const getRoundVendorDetailHint = (item) => {
    const reason = item?.disabledReason || '';
    if (reason === 'carry_limit') {
      const current = Math.max(0, Number(item?.currentCount || 0));
      const limit = Math.max(0, Number(item?.carryLimit || 0));
      return `当前携带 ${current}/${limit}，已达到本轮上限`;
    }
    if (reason === 'backpack_full') {
      const current = Math.max(0, Number(item?.backpackCount || 0));
      const limit = Math.max(0, Number(item?.backpackCapacity || 0));
      return `背包容量 ${current}/${limit}，请先清出空位后再购买`;
    }
    if (reason === 'not_enough_session_coins') return '局内金币不足，暂时无法购买';
    if (reason === 'sold_out') return '该商品本轮已售出';
    if (item?.kind === 'consumable') {
      return `背包占用 ${Math.max(0, Number(item?.backpackCount || 0))}/${Math.max(0, Number(item?.backpackCapacity || 0))}，当前携带 ${Math.max(0, Number(item?.currentCount || 0))}/${Math.max(0, Number(item?.carryLimit || 0))}`;
    }
    return '购入后直接收入局内装备，装备栏当前不限制格子';
  };

  const getNextAutoEquipSlot = () => {
    const list = Array.isArray(equippedItems) ? equippedItems : [];
    for (let idx = 0; idx < 6; idx++) {
      if (!list[idx]) return idx;
    }
    return -1;
  };

  const autoEquipOwnedItem = (itemId) => {
    if (!itemId) return;
    // 每次都从左到右补第一个空槽位
    const slot = getNextAutoEquipSlot();
    if (slot < 0) return;
    const equipState = getEquipState(itemId, ownedItems, equippedItems);
    if (!equipState.ok) return;
    uiBus.emit('ui:equipment:setSlot', slot, itemId);
  };

  const unequipSlot = (slotIndex) => {
    const idx = Number(slotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= 6) return;
    uiBus.emit('ui:equipment:setSlot', idx, null);
  };

  const formatPercent = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`;

  const getUnifiedRangeMultiplier = (p = {}) => {
    const candidates = [
      [p.warriorRange, p.warriorRangeBase],
      [p.archerArrowRange, p.archerArrowRangeBase],
      [p.mageMissileRange, p.mageMissileRangeBase],
      [p.moonfireRange, p.moonfireRangeBase],
      [p.warlockRange, p.warlockRangeBase || p.warlockPoisonNovaRadiusBase],
      [p.druidStarfallRange, p.druidStarfallRangeBase]
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const [current, base] = candidates[i];
      const currentValue = Number(current || 0);
      const baseValue = Number(base || 0);
      if (currentValue > 0 && baseValue > 0) return currentValue / baseValue;
    }

    return 1;
  };

  const buildStatSummaryGroups = (p = {}, opts = {}) => {
    const includeExtended = opts.includeExtended === true;
    const maxHp = Number(p.maxHp || 0);
    const fireRate = Number(p.fireRate || 0);
    const bulletDamage = Number(p.bulletDamage || 0);
    const critChance = Number(p.critChance || 0);
    const critMultiplier = Number(p.critMultiplier || 1);
    const moveSpeed = Number(p.moveSpeed || 0);
    const regenPerSec = Number(p.regenPerSec || 0);
    const damageReduction = Number(p.damageReductionPercent || 0);
    const dodgeChance = Number(p.dodgeChance || p.dodgePercent || 0);
    const blockChance = Number(p.blockChance || 0);
    const lifesteal = Number(p.lifestealPercent || 0);
    const shields = Number(p.shieldCharges || 0);
    const rangeMult = getUnifiedRangeMultiplier(p);
    const attacksPerSecond = fireRate > 0 ? (1000 / fireRate) : 0;
    const critBonusPct = Math.max(0, (critMultiplier - 1) * 100);

    const groups = [
      {
        title: '十大属性',
        items: [
          { label: '攻击', value: `${Math.round(bulletDamage)}` },
          { label: '攻速', value: `${attacksPerSecond.toFixed(2)}/秒` },
          { label: '移速', value: `${Math.round(moveSpeed)}` },
          { label: '范围', value: `${rangeMult >= 1 ? '+' : ''}${Math.round((rangeMult - 1) * 100)}%` },
          { label: '生命', value: `${Math.round(maxHp)}` },
          { label: '减伤', value: formatPercent(damageReduction) },
          { label: '回复', value: `${regenPerSec.toFixed(1)}/秒` },
          { label: '暴击', value: formatPercent(critChance) },
          { label: '闪避', value: formatPercent(dodgeChance) },
          { label: '暴伤', value: `${critBonusPct >= 0 ? '+' : ''}${Math.round(critBonusPct)}%` }
        ]
      },
    ];

    if (includeExtended) {
      groups.push({
        title: '扩展属性',
        items: [
          { label: '吸血', value: formatPercent(lifesteal) },
          { label: '格挡', value: formatPercent(blockChance) },
          { label: '护盾', value: `${Math.round(shields)}` }
        ]
      });
    }

    return groups;
  };

  const buildRuntimeStatGroups = (p = {}) => {
    const maxHp = Number(p.maxHp || 0);
    const fireRate = Number(p.fireRate || 0);
    const dmg = Number(p.bulletDamage || 0);
    const critChance = Number(p.critChance || 0);
    const critMult = Number(p.critMultiplier || 1);
    const lifesteal = Number(p.lifestealPercent || 0);
    const shields = Number(p.shieldCharges || 0);
    const speed = Number(p.moveSpeed || 0);
    const damageReduction = Number(p.damageReductionPercent || 0);
    const dodge = Number(p.dodgeChance || p.dodgePercent || 0);
    const regenPerSec = Number(p.regenPerSec || 0);
    const blockChance = Number(p.blockChance || 0);
    const rangeMult = getUnifiedRangeMultiplier(p);
    const attacksPerSecond = fireRate > 0 ? (1000 / fireRate) : 0;
    const baseDps = fireRate > 0 ? (dmg * attacksPerSecond) : 0;
    const critFactor = 1 + critChance * Math.max(0, (critMult - 1));
    const approxDps = baseDps * critFactor;
    const powerScore = Math.max(0, Math.round(
      approxDps * 6 +
      maxHp * 1.2 +
      shields * 35 +
      lifesteal * 800 +
      speed * 0.15
    ));

    return [
      {
        title: '概览',
        items: [
          { label: '局内金币', value: `${viewData?.sessionCoins || 0}` },
          { label: '参考战力', value: `${powerScore}` }
        ]
      },
      ...buildStatSummaryGroups(p, { includeExtended: false }),
      {
        title: '输出估算',
        items: [
          { label: '单发伤害', value: `${Math.round(dmg)}` },
          { label: '射速', value: `${attacksPerSecond.toFixed(2)}/秒` },
          { label: '基础DPS', value: `${Math.round(baseDps)}` },
          { label: '期望DPS', value: `${Math.round(approxDps)}` },
          { label: '范围加成', value: `${rangeMult >= 1 ? '+' : ''}${Math.round((rangeMult - 1) * 100)}%` },
          { label: '减伤', value: formatPercent(damageReduction) },
          { label: '回复', value: `${regenPerSec.toFixed(1)}/秒` },
          { label: '格挡', value: formatPercent(blockChance) },
          { label: '闪避', value: formatPercent(dodge) },
          { label: '暴击系数', value: `${critFactor.toFixed(2)}x` }
        ]
      }
    ];
  };

  const renderMetricGroups = (groups = [], opts = {}) => {
    const compact = opts.compact !== false;
    const asGrid = opts.asGrid === true;

    return (
      <div
        style={asGrid ? {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: compact ? 10 : 14,
          alignContent: 'start'
        } : {
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 10 : 14
        }}
      >
        {groups.map((group) => (
          <div
            key={group.title}
            style={{
              borderRadius: compact ? 16 : 18,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
              padding: compact ? '12px 12px 10px' : '14px 14px 12px'
            }}
          >
            <div style={{ fontSize: compact ? 13 : 14, fontWeight: 900, opacity: 0.92, marginBottom: 10 }}>
              {group.title}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: compact ? 8 : 10 }}>
              {group.items.map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: 12,
                    background: 'rgba(11, 11, 24, 0.58)',
                    padding: compact ? '10px 10px 8px' : '12px 12px 10px',
                    minWidth: 0
                  }}
                >
                  <div style={{ fontSize: compact ? 12 : 13, opacity: 0.7 }}>{item.label}</div>
                  <div style={{ fontSize: compact ? 15 : 17, fontWeight: 900, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStatSummaryGrid = (p = {}, opts = {}) => renderMetricGroups(buildStatSummaryGroups(p, opts), opts);

  const renderTalentPanel = () => {
    if (!selectedTrees || selectedTrees.length === 0) {
      return (
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            padding: 14,
            lineHeight: 1.6,
            opacity: 0.85
          }}
        >
          尚未获得任何技能。首次三选一后将出现主修路线。
        </div>
      );
    }

    const mainTreeId = selectedTrees[0] || null;
    const offTreeId = selectedTrees[1] || null;
    const depthState = getDepthUnlockState(selectedTrees, skillTreeLevels, viewData?.levelUps || 0);

    const mainDef = mainTreeId ? TREE_DEFS.find((t) => t.id === mainTreeId) : null;
    const offDef = offTreeId ? TREE_DEFS.find((t) => t.id === offTreeId) : null;
    const panels = [
      { key: 'left', title: mainDef ? mainDef.name : '主职业（未选择）', def: mainDef },
      { key: 'right', title: offDef ? offDef.name : '副职业（未选择）', def: offDef }
    ];

    const toCssHex = (n) => {
      if (!Number.isFinite(n)) return 'rgba(42,42,58,1)';
      const hex = (n >>> 0).toString(16).padStart(6, '0').slice(-6);
      return `#${hex}`;
    };

    const toCssRgba = (n, a) => {
      if (!Number.isFinite(n)) return `rgba(42,42,58,${Number(a) || 1})`;
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return `rgba(${r},${g},${b},${Number(a) || 1})`;
    };

    const badgeTextFor = (level, maxLevel) => {
      if (!level || level <= 0) return '';
      if (!maxLevel || maxLevel <= 1) return 'max';
      if (level >= maxLevel) return 'max';
      if (level === 1) return '+1';
      if (level === 2) return '+2';
      return `+${level}`;
    };

    const getNodeKind = (node, def) => {
      if (node.id === def.core?.id) return 'core';
      return 'talent';
    };

    const getNodeBadgeText = (node, def) => {
      const kind = getNodeKind(node, def);
      if (kind === 'core') return '初始';
      const cleaned = String(node.name || '')
        .replace(/^初始：/, '')
        .replace(/^选择：/, '')
        .replace(/^（预留）/, '预留')
        .trim();
      return cleaned.slice(0, 2) || '天赋';
    };

    const renderDepthRequirementChip = (label, ready, detail, accentColor) => (
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${ready ? 'rgba(74,222,128,0.42)' : 'rgba(255,255,255,0.10)'}`,
          background: ready ? 'rgba(20,83,45,0.30)' : 'rgba(255,255,255,0.04)',
          padding: '10px 12px',
          minWidth: 0
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.72 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 900, marginTop: 4, color: ready ? '#bbf7d0' : (accentColor || '#ffffff') }}>{detail}</div>
      </div>
    );

    const TalentIconButton = ({ node, def }) => {
      const meta = getTalentNodeMeta(node.id);
      const level = skillTreeLevels?.[node.id] || 0;
      const maxLevel = node.maxLevel || getMaxLevel(node.id) || 1;
      const kind = getNodeKind(node, def);
      const badge = badgeTextFor(level, maxLevel);
      const isLearned = level > 0;
      const isDepth = !!meta?.isDepth;
      const borderColor = isLearned
        ? toCssHex(def?.color)
        : (isDepth ? '#d8b4fe' : 'rgba(148,163,184,0.65)');
      const iconText = getNodeBadgeText(node, def);
      const isSelected = selectedTalent?.node?.id === node.id;
      const hintText = kind === 'core'
        ? '起点'
        : (kind === 'ultimate' ? '终极' : String(node.name || '').replace(/^初始：|^终极：|^选择：/, '').trim().slice(0, 4));
      const labelText = String(node.name || hintText || '').replace(/^初始：|^选择：/, '').trim();

      return (
        <button
          type="button"
          onPointerDown={(e) => {
            startLongPress(`talent:${node.id}`, () => setSelectedTalent({ node, def, level, maxLevel }), e);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearPressState();
            setSelectedTalent(null);
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearPressState();
            setSelectedTalent(null);
          }}
          onPointerLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearPressState();
            setSelectedTalent(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            cursor: 'pointer',
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
            color: '#fff',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            gap: 5,
            width: 56,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none'
          }}
          title={node.name}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: isSelected ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: kind === 'talent' ? 13 : 11,
              background: isSelected
                ? (isLearned
                  ? `radial-gradient(circle at 30% 28%, ${toCssRgba(def?.color, 0.52)}, rgba(255,255,255,0.14) 42%, rgba(15,23,42,0.98) 100%)`
                  : (isDepth
                    ? 'radial-gradient(circle at 30% 28%, rgba(216,180,254,0.34), rgba(168,85,247,0.18) 42%, rgba(30,18,46,0.96) 100%)'
                    : 'radial-gradient(circle at 30% 28%, rgba(203,213,225,0.28), rgba(120,130,148,0.18) 48%, rgba(30,41,59,0.96) 100%)'))
                : (isLearned
                  ? `linear-gradient(180deg, ${toCssRgba(def?.color, 0.30)}, rgba(15,23,42,0.98))`
                  : (isDepth
                    ? 'linear-gradient(180deg, rgba(192,132,252,0.26), rgba(46,16,70,0.96))'
                    : 'linear-gradient(180deg, rgba(148,163,184,0.22), rgba(51,65,85,0.98))')),
              color: isLearned ? '#ffffff' : (isDepth ? '#f3e8ff' : 'rgba(226,232,240,0.88)'),
              letterSpacing: '0.04em',
              position: 'relative',
              boxShadow: isSelected
                ? `0 0 0 1px ${borderColor}44 inset, 0 0 18px ${isLearned ? toCssRgba(def?.color, 0.42) : (isDepth ? 'rgba(216,180,254,0.34)' : 'rgba(148,163,184,0.22)')}, 0 10px 22px rgba(0,0,0,0.28)`
                : `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 12px ${isLearned ? toCssRgba(def?.color, 0.20) : (isDepth ? 'rgba(192,132,252,0.20)' : 'rgba(15,23,42,0.18)')}, 0 6px 14px rgba(0,0,0,0.24)`,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isLearned
                  ? `linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0) 45%)`
                  : (isDepth
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 48%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 48%)'),
                pointerEvents: 'none'
              }}
            />
            {!isLearned ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: isDepth
                    ? 'repeating-linear-gradient(-45deg, rgba(216,180,254,0.14) 0 6px, rgba(30,41,59,0.0) 6px 12px)'
                    : 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.12) 0 6px, rgba(30,41,59,0.0) 6px 12px)',
                  opacity: isDepth ? 0.82 : 0.72,
                  pointerEvents: 'none'
                }}
              />
            ) : null}
            {badge ? (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  border: 'none',
                  background: isSelected
                    ? '#ffffff'
                    : (isLearned ? toCssRgba(def?.color, 0.92) : 'rgba(100,116,139,0.92)'),
                  color: isSelected ? '#111827' : '#ffffff',
                  fontSize: 9,
                  fontWeight: 900,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {badge.replace('+', '')}
              </div>
            ) : null}
            {iconText}
          </div>
          <div
            style={{
              minHeight: 24,
              fontSize: 10,
              lineHeight: 1.15,
              opacity: isLearned ? 0.96 : (isDepth ? 0.88 : 0.68),
              color: isLearned ? '#f8fafc' : (isDepth ? '#ead7ff' : 'rgba(226,232,240,0.72)'),
              textAlign: 'center',
              padding: '0 1px',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {labelText}
          </div>
        </button>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, minHeight: '100%' }}>
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${depthState.unlocked ? 'rgba(74,222,128,0.40)' : 'rgba(255,255,255,0.10)'}`,
            background: depthState.unlocked
              ? 'linear-gradient(180deg, rgba(20,83,45,0.36), rgba(9,20,16,0.92))'
              : 'linear-gradient(180deg, rgba(88,28,135,0.20), rgba(10,10,24,0.88))',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: depthState.unlocked ? '#bbf7d0' : '#f3e8ff' }}>深度专精进度</div>
              <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4, lineHeight: 1.5 }}>
                {depthState.unlocked
                  ? '已满足后段阶段、主树点数和副树点数条件，深度专精现在可以进入候选池。'
                  : `当前还未完全解锁。${!depthState.stageReady ? `后段阶段还差 ${depthState.remainingLevelUps} 次普通升级。` : ''}${!depthState.mainReady ? ` 主树还差 ${depthState.remainingMainPoints} 点。` : ''}${!depthState.offReady ? ` ${depthState.offTreeId ? `副树还差 ${depthState.remainingOffPoints} 点。` : '尚未选择副职业。'}` : ''}`}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', color: depthState.unlocked ? '#86efac' : '#e9d5ff', opacity: 0.92 }}>
              {depthState.unlocked ? 'DEPTH READY' : 'DEPTH LOCKED'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {renderDepthRequirementChip(
              '后段阶段',
              depthState.stageReady,
              depthState.stageReady ? '已进入 all 阶段' : `还需 ${depthState.remainingLevelUps} 次普通升级`,
              '#f8fafc'
            )}
            {renderDepthRequirementChip(
              '主树点数',
              depthState.mainReady,
              `${depthState.mainSpent}/${depthState.mainThreshold}`,
              mainDef ? toCssHex(mainDef.color) : '#f8fafc'
            )}
            {renderDepthRequirementChip(
              '副树点数',
              depthState.offReady,
              depthState.offTreeId ? `${depthState.offSpent}/${depthState.offThreshold}` : '未选择副职业',
              offDef ? toCssHex(offDef.color) : '#f8fafc'
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
            alignContent: 'start'
          }}
        >
          {panels.map((panel) => {
            const def = panel.def;
            const allNodes = def ? [def.core, ...(def.nodes || [])].filter(Boolean) : [];
            const learnedCount = def ? allNodes.filter((n) => (skillTreeLevels?.[n.id] || 0) > 0).length : 0;
            const talentRows = def ? buildTalentIconRows(def, skillTreeLevels) : [];

            return (
              <div
                key={panel.key}
                style={{
                  borderRadius: 0,
                  border: `1px solid ${def ? toCssRgba(def.color, 0.5) : 'rgba(255,255,255,0.10)'}`,
                  background: panel.key === 'right' && def?.variant === 'dual'
                    ? 'linear-gradient(180deg, rgba(38,16,52,0.72), rgba(18,20,34,0.9))'
                    : (panel.key === 'right' && def?.variant === 'depth'
                      ? 'linear-gradient(180deg, rgba(6,22,18,0.82), rgba(8,14,18,0.92))'
                      : `linear-gradient(180deg, ${def ? toCssRgba(def.color, 0.18) : 'rgba(255,255,255,0.05)'}, rgba(12,14,24,0.88))`),
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  minHeight: 0,
                  boxShadow: panel.key === 'right' && def?.variant === 'dual'
                    ? '0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 24px rgba(168,85,247,0.18)'
                    : (panel.key === 'right' && def?.variant === 'depth'
                      ? `0 0 0 1px ${toCssRgba(def?.color, 0.18)} inset, 0 0 28px ${toCssRgba(def?.color, 0.18)}`
                      : `0 0 0 1px ${def ? toCssRgba(def.color, 0.10) : 'rgba(255,255,255,0.04)'} inset`),
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {panel.key === 'right' && def?.variant === 'dual' ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 3,
                      background: 'linear-gradient(90deg, #ff6b6b, #ffb84d, #ffe066, #59f0a7, #66b3ff, #c084fc)'
                    }}
                  />
                ) : null}
                {panel.key === 'right' && def?.variant === 'depth' ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 3,
                      background: `linear-gradient(90deg, ${toCssRgba(def?.color, 0.28)}, ${toCssRgba(def?.color, 0.92)})`
                    }}
                  />
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, fontSize: 15, fontWeight: 900, lineHeight: 1.2, color: def ? toCssHex(def.color) : '#ffffff' }}>
                    {panel.title}
                  </div>
                  {def ? (
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: '0.06em',
                        color: panel.key === 'right' && def?.variant === 'dual' ? '#f5d0fe' : toCssHex(def?.color),
                        opacity: 0.92
                      }}
                    >
                      {`${learnedCount}/${allNodes.length} 已激活`}
                    </div>
                  ) : null}
                </div>

                {!def ? (
                  <div style={{ borderRadius: 0, background: 'rgba(11, 11, 24, 0.58)', padding: 12, fontSize: 13, lineHeight: 1.6, opacity: 0.75 }}>
                    {panel.key === 'right' ? '副职业尚未选择，选择后显示完整副职业天赋树。' : '等待选择'}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      padding: '8px 2px 10px',
                      minHeight: 0
                    }}
                  >
                    {talentRows.map((row) => (
                      <div
                        key={row.map((node) => node.id).join('|')}
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          gap: 14,
                          flexWrap: 'nowrap'
                        }}
                      >
                        {row.map((node) => (
                          <TalentIconButton key={node.id} node={node} def={def} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedTalent?.node ? (
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>天赋详情</div>
            <div style={{ borderRadius: 12, background: 'rgba(11, 11, 24, 0.58)', padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  border: `1px solid ${toCssHex(selectedTalent?.def?.color)}`,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 14,
                  flexShrink: 0
                }}
              >
                {getNodeBadgeText(selectedTalent.node, selectedTalent.def)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{selectedTalent.node.name}</div>
                <div style={{ fontSize: 12, opacity: 0.66, marginTop: 4 }}>
                  {`${selectedTalent.level || 0}/${selectedTalent.maxLevel || 1} · ${getNodeKind(selectedTalent.node, selectedTalent.def) === 'core' ? '职业起点' : (getNodeKind(selectedTalent.node, selectedTalent.def) === 'ultimate' ? '终局强化' : '普通节点')}`}
                </div>
                {getTalentNodeMeta(selectedTalent.node.id)?.requiredSkillId ? (
                  <div style={{ fontSize: 12, opacity: 0.62, marginTop: 6 }}>
                    前置条件：{([selectedTalent.def?.core, ...(selectedTalent.def?.nodes || [])].find((item) => item?.id === getTalentNodeMeta(selectedTalent.node.id)?.requiredSkillId)?.name) || getTalentNodeMeta(selectedTalent.node.id)?.requiredSkillId}
                  </div>
                ) : null}
                {getTalentNodeMeta(selectedTalent.node.id)?.isDepth ? (
                  <div style={{ fontSize: 12, opacity: 0.74, marginTop: 6, lineHeight: 1.6, color: depthState.unlocked ? '#bbf7d0' : '#f3e8ff' }}>
                    {depthState.unlocked
                      ? '深度专精已解锁，后续会在满足发牌阶段时进入候选。'
                      : `深度专精未解锁：${depthState.stageReady ? '后段阶段已满足' : `还差 ${depthState.remainingLevelUps} 次普通升级`}；${depthState.mainReady ? `主树已达 ${depthState.mainThreshold} 点` : `主树还差 ${depthState.remainingMainPoints} 点`}；${depthState.offReady ? `副树已达 ${depthState.offThreshold} 点` : `${depthState.offTreeId ? `副树还差 ${depthState.remainingOffPoints} 点` : '尚未选择副职业'}`}`}
                  </div>
                ) : null}
                {(selectedTalent.level || 0) <= 0 ? (
                  <div style={{ fontSize: 12, opacity: 0.62, marginTop: 6 }}>
                    当前未投入点数，灰色图标表示仅预览未激活节点。
                  </div>
                ) : null}
                <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, marginTop: 8 }}>{selectedTalent.node.desc || '暂无描述'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', padding: 12, fontSize: 13, opacity: 0.74, lineHeight: 1.5 }}>
            长按任意图标查看详情，松手后详情会自动隐藏。
          </div>
        )}
      </div>
    );
  };

  const renderBagPanel = () => {
    const showBagDetail = (item, slot) => {
      if (!item) {
        setSelectedItem(null);
        return;
      }
      setSelectedItem({ ...item, slot });
    };

    const getItemTheme = (item) => {
      const rarityColor = item?.rarityTextColor || '#d8dee8';
      const kind = item?.kind || '';
      if (kind === 'run_loot_equipment') {
        return {
          border: `2px solid ${rarityColor}`,
          background: `linear-gradient(180deg, rgba(18,20,34,0.96), rgba(10,12,22,0.84))`,
          boxShadow: `0 0 0 1px ${rarityColor}22 inset, 0 0 18px ${rarityColor}22`
        };
      }
      return {
        border: '2px solid rgba(42,42,58,1)',
        background: 'rgba(11, 11, 24, 0.62)',
        boxShadow: 'none'
      };
    };

    const getItemInfoText = (item, fallbackLabel = '') => {
      if (!item) return `${fallbackLabel}\n空`;
      const lines = Array.isArray(item?.statLines) && item.statLines.length > 0
        ? item.statLines
        : [item?.desc || ''];
      const rarityLine = item?.rarityLabel ? `品质: ${item.rarityLabel}` : '';
      const countLine = (Number(item?.count || 0) > 1) ? `数量: x${Number(item.count)}` : '';
      return [
        `${item.icon || ''} ${item.name || ''}`.trim(),
        rarityLine,
        countLine,
        ...lines
      ].filter(Boolean).join('\n');
    };

    const Slot = ({ item, slotLabel, label }) => {
      const isRunLootEquipment = item?.kind === 'run_loot_equipment';
      const def = item?.id ? ITEM_DEFS.find((d) => d.id === item.id) : null;
      const cdMs = Math.max(0, Number(def?.consumable?.cooldownMs || 0));
      const until = item?.id ? Math.max(0, Number(itemCooldowns?.[item.id] || 0)) : 0;
      const remaining = (cdMs > 0 && until > gameplayNowMs) ? (until - gameplayNowMs) : 0;
      const onCd = remaining > 0;
      const ratio = (onCd && cdMs > 0) ? Math.max(0, Math.min(1, remaining / cdMs)) : 0;

      const cdOverlayStyle = onCd
        ? {
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          backgroundImage: `conic-gradient(rgba(0,0,0,0.72) 0deg ${Math.round(ratio * 360)}deg, rgba(0,0,0,0) ${Math.round(ratio * 360)}deg 360deg)`,
          pointerEvents: 'none'
        }
        : null;

      const dimStyle = onCd
        ? {
          filter: 'grayscale(1) brightness(0.75)',
          opacity: 0.85
        }
        : null;
      const theme = getItemTheme(item);

      return (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerDown={(e) => {
            if (!item) return;
            startLongPress(`bag:${slotLabel}:${item.instanceId || item.id || 'empty'}`, () => showBagDetail(item, slotLabel), e);
          }}
          onPointerUp={(e) => {
            if (!item) {
              e.preventDefault();
              e.stopPropagation();
              clearPressState();
              if (label) showFloatingInfo(`${label}\n空`);
              return;
            }

            endLongPress(`bag:${slotLabel}:${item.instanceId || item.id || 'empty'}`, () => {
              showBagDetail(item, slotLabel || label);
            }, e);
          }}
          onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
          onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{
            cursor: 'pointer',
            width: isRunLootEquipment ? 82 : 92,
            height: isRunLootEquipment ? 82 : 92,
            borderRadius: 12,
            border: theme.border,
            background: theme.background,
            boxShadow: theme.boxShadow,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isRunLootEquipment ? 4 : 6,
            padding: isRunLootEquipment ? 6 : 8,
            position: 'relative',
            overflow: 'hidden',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none'
          }}
        >
          {cdOverlayStyle ? <div style={cdOverlayStyle} /> : null}
          {item?.count && Number(item.count) > 1 ? (
            <div
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                minWidth: 18,
                height: 18,
                padding: '0 6px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.65)',
                border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                lineHeight: 1,
                pointerEvents: 'none'
              }}
            >
              {Number(item.count)}
            </div>
          ) : null}
          <div style={{ fontWeight: 900, fontSize: isRunLootEquipment ? 14 : 16, ...(dimStyle || {}) }}>{item?.icon || label || ''}</div>
          <div style={{ opacity: 0.8, fontSize: isRunLootEquipment ? 11 : 12, textAlign: 'center', ...(dimStyle || {}) }}>{item?.name || ''}</div>
          {!isRunLootEquipment && item?.rarityLabel ? (
            <div style={{ position: 'absolute', left: 7, bottom: 6, fontSize: 10, fontWeight: 900, color: item.rarityTextColor || '#ffffff', textShadow: '0 1px 0 rgba(0,0,0,0.45)' }}>
              {item.rarityLabel}
            </div>
          ) : null}
        </button>
      );
    };

    const equipped6 = getStackedEquippedDisplay(inventoryEquipped);
    const lootList = Array.isArray(inventoryAcquired) ? inventoryAcquired.filter(Boolean) : [];
    const groupedLoot = [
      { key: 'legendary', title: '传说', color: '#ff9f2e', items: lootList.filter((it) => it?.kind === 'run_loot_equipment' && it?.rarityId === 'legendary') },
      { key: 'epic', title: '史诗', color: '#b56cff', items: lootList.filter((it) => it?.kind === 'run_loot_equipment' && it?.rarityId === 'epic') },
      { key: 'rare', title: '稀有', color: '#3aa0ff', items: lootList.filter((it) => it?.kind === 'run_loot_equipment' && it?.rarityId === 'rare') },
      { key: 'common', title: '普通', color: '#f4f7fb', items: lootList.filter((it) => it?.kind === 'run_loot_equipment' && it?.rarityId === 'common') }
    ].filter((group) => group.items.length > 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100%', padding: 12 }}>
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>携带栏</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {equipped6.map((it, idx) => (
              <Slot
                key={`eq-${idx}`}
                item={it}
                slotLabel={`携带 ${idx + 1}`}
                label={it ? undefined : '空'}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>局内装备</div>
          <div style={{ fontSize: 12, opacity: 0.62 }}>拾取或从商贩购入后立即生效，本局结束清空</div>
          <div className="mobile-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, paddingRight: 2 }}>
            {groupedLoot.length <= 0 ? (
              <div style={{ borderRadius: 12, background: 'rgba(11, 11, 24, 0.58)', padding: 12, opacity: 0.7 }}>暂未拾取战利品</div>
            ) : groupedLoot.map((group) => (
              <div key={group.key} style={{ borderRadius: 12, background: 'rgba(11, 11, 24, 0.58)', padding: 12 }}>
                <div style={{ fontWeight: 900, color: group.color, marginBottom: 8 }}>{group.title} · {group.items.length}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {group.items.map((it, idx) => (
                    <Slot
                      key={`${group.key}-${it.instanceId || it.id || idx}`}
                      item={it}
                      slotLabel={`${group.title}战利品`}
                      label={it ? undefined : ''}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedItem ? (
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>物品详情</div>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${selectedItem.rarityTextColor || 'rgba(255,255,255,0.12)'}`,
                background: 'rgba(11, 11, 24, 0.58)',
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      border: `1px solid ${selectedItem.rarityTextColor || 'rgba(255,255,255,0.12)'}`,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 900,
                      flexShrink: 0
                    }}
                  >
                    {selectedItem.icon || '✦'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: selectedItem.rarityTextColor || '#ffffff' }}>
                      {selectedItem.name || '未命名战利品'}
                    </div>
                    <div style={{ opacity: 0.78, fontSize: 12, marginTop: 2 }}>
                      {[selectedItem.slot, selectedItem.rarityLabel, selectedItem.categoryLabel].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(Array.isArray(selectedItem.statLines) && selectedItem.statLines.length > 0
                    ? selectedItem.statLines
                    : [selectedItem.desc || ''])
                    .filter(Boolean)
                    .map((line, idx) => (
                      <div key={`detail-line-${idx}`} style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.92 }}>
                        {line}
                      </div>
                    ))}
                </div>
              </div>

              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                {selectedItem.count && Number(selectedItem.count) > 1 ? (
                  <div style={{ fontWeight: 900, color: selectedItem.rarityTextColor || '#ffffff' }}>x{Number(selectedItem.count)}</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  style={{
                    marginTop: 10,
                    cursor: 'pointer',
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800
                  }}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', padding: 12, fontSize: 13, opacity: 0.74, lineHeight: 1.5 }}>
            长按或点选背包中的物品后，可以在这里查看更完整的说明。
          </div>
        )}
      </div>
    );
  };

  const renderStatsPanel = () => {
    const p = player || {};
    const groups = buildRuntimeStatGroups(p);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.92, padding: 12 }}>
        {renderMetricGroups(groups, { compact: true, asGrid: true })}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        @keyframes levelup-card-shimmer {
          0% { transform: translateX(-130%) rotate(-16deg); opacity: 0; }
          18% { opacity: 0.18; }
          50% { opacity: 0.24; }
          100% { transform: translateX(180%) rotate(-16deg); opacity: 0; }
        }

        @keyframes levelup-card-pulse {
          0% { box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 12px 30px rgba(0,0,0,0.22); }
          50% { box-shadow: 0 0 0 1px rgba(255,255,255,0.22), 0 18px 42px rgba(0,0,0,0.30); }
          100% { box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 12px 30px rgba(0,0,0,0.22); }
        }

        @keyframes levelup-indicator-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.18); }
          50% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        @keyframes levelup-indicator-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-2px) rotate(-2deg); }
          35% { transform: translateX(3px) rotate(2deg); }
          55% { transform: translateX(-3px) rotate(-2deg); }
          75% { transform: translateX(2px) rotate(1deg); }
        }

        .mobile-scroll {
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .mobile-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        @keyframes coin-gain-float {
          0% { transform: translateY(10px) scale(0.72); opacity: 0; }
          18% { transform: translateY(-2px) scale(1.18); opacity: 1; }
          40% { transform: translateY(-6px) scale(1.06); opacity: 1; }
          100% { transform: translateY(-28px) scale(0.92); opacity: 0; }
        }
      `}</style>
      {/* 主菜单（React 版）：只在 MenuScene 显示 */}
      {sceneKey === 'MenuScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}
        >
          <div
            style={{
              width: 640,
              maxWidth: '94%',
              maxHeight: '92%',
              overflowY: 'auto',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(15,16,26,0.96), rgba(8,10,18,0.98))',
              border: '2px solid rgba(42,42,58,1)',
              padding: menuViewportCompact ? 14 : 18,
              boxShadow: '0 20px 48px rgba(0,0,0,0.36)'
            }}
          >
            {/* <div style={{ fontSize: menuViewportCompact ? 34 : 44, fontWeight: 900, textAlign: 'center', marginBottom: 6 }}>MOVA</div> */}

            {menuScreen === 'home' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                  <button
                    type="button"
                    onClick={() => setMenuScreen('classSelect')}
                    style={{
                      ...menuBtnStyle,
                      width: '100%',
                      height: 56,
                      background: 'linear-gradient(180deg, rgba(245,158,11,0.30), rgba(255,255,255,0.10))',
                      border: '1px solid rgba(245,158,11,0.65)'
                    }}
                  >
                    开始游戏
                  </button>
                  <button type="button" onClick={() => uiBus.emit('ui:gotoScene', 'ItemShopScene')} style={{ ...menuBtnStyle, width: '100%' }}>道具商店</button>
                  <button type="button" onClick={() => uiBus.emit('ui:gotoScene', 'EquipmentScene')} style={{ ...menuBtnStyle, width: '100%' }}>装备系统</button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(true);
                      uiBus.emit('ui:settings:request');
                    }}
                    style={{ ...menuBtnStyle, width: '100%' }}
                  >
                    设置
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ opacity: 0.85, textAlign: 'center', marginBottom: 6 }}>主职业选择</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                  {MENU_CLASS_OPTIONS.map((item) => {
                    const selected = selectedMenuClass?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedMenuCore(item.id)}
                        style={{
                          cursor: 'pointer',
                          minHeight: menuViewportCompact ? 84 : 96,
                          borderRadius: 16,
                          border: selected ? `2px solid ${item.color}` : '1px solid rgba(255,255,255,0.12)',
                          background: selected ? `linear-gradient(180deg, ${item.accent}, rgba(11,11,24,0.92))` : 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px 8px',
                          boxShadow: selected ? `0 0 0 1px ${item.color}44 inset, 0 12px 24px ${item.color}22` : 'none'
                        }}
                      >
                        <div style={{ fontSize: menuViewportCompact ? 24 : 28, lineHeight: 1 }}>{item.glyph}</div>
                        <div style={{ fontSize: menuViewportCompact ? 13 : 14, fontWeight: 900 }}>{item.name}</div>
                      </button>
                    );
                  })}
                </div>

                {selectedMenuClass ? (
                  <div
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${selectedMenuClass.color}66`,
                      background: `linear-gradient(180deg, ${selectedMenuClass.accent}, rgba(11,11,24,0.88))`,
                      padding: menuViewportCompact ? 14 : 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      marginBottom: 14
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: menuViewportCompact ? 58 : 68,
                          height: menuViewportCompact ? 58 : 68,
                          borderRadius: 18,
                          background: 'rgba(255,255,255,0.08)',
                          border: `1px solid ${selectedMenuClass.color}66`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: menuViewportCompact ? 28 : 34,
                          flexShrink: 0
                        }}
                      >
                        {selectedMenuClass.glyph}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: menuViewportCompact ? 24 : 28, fontWeight: 900 }}>{selectedMenuClass.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {selectedMenuClass.tags.map((tag) => (
                            <div
                              key={tag}
                              style={{
                                height: 24,
                                padding: '0 10px',
                                borderRadius: 999,
                                border: '1px solid rgba(255,255,255,0.14)',
                                background: 'rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: 11,
                                fontWeight: 900,
                                opacity: 0.92
                              }}
                            >
                              {tag}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.9 }}>{selectedMenuClass.summary}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      {selectedMenuClass.stats.map((stat) => (
                        <div key={stat.label} style={{ borderRadius: 12, background: 'rgba(11,11,24,0.58)', padding: '10px 10px 8px' }}>
                          <div style={{ fontSize: 12, opacity: 0.68 }}>{stat.label}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                            {new Array(5).fill(null).map((_, index) => (
                              <div
                                key={`${stat.label}-${index}`}
                                style={{
                                  flex: 1,
                                  height: 7,
                                  borderRadius: 999,
                                  background: index < stat.value ? selectedMenuClass.color : 'rgba(255,255,255,0.08)',
                                  opacity: index < stat.value ? 0.95 : 1
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ borderRadius: 14, background: 'rgba(11,11,24,0.58)', padding: '12px 12px 10px' }}>
                        <div style={{ fontSize: 12, opacity: 0.68, marginBottom: 6 }}>基础攻击</div>
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{selectedMenuClass.baseSkill}</div>
                      </div>
                      <div style={{ borderRadius: 14, background: 'rgba(11,11,24,0.58)', padding: '12px 12px 10px' }}>
                        <div style={{ fontSize: 12, opacity: 0.68, marginBottom: 6 }}>职业优势</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, lineHeight: 1.5 }}>
                          {selectedMenuClass.strengths.map((text) => <div key={text}>{text}</div>)}
                        </div>
                      </div>
                      {/* <div style={{ borderRadius: 14, background: 'rgba(11,11,24,0.58)', padding: '12px 12px 10px' }}>
                        <div style={{ fontSize: 12, opacity: 0.68, marginBottom: 6 }}>代表成长</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {selectedMenuClass.showcase.map((text) => (
                            <div key={text} style={{ borderRadius: 999, padding: '6px 10px', background: 'rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 800 }}>
                              {text}
                            </div>
                          ))}
                        </div>
                      </div> */}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setMenuScreen('home')}
                    style={{ ...menuBtnStyle, width: 'auto', flex: '1 1 48%' }}
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    onClick={() => uiBus.emit('ui:gotoScene', 'GameScene', { selectedMainCore: selectedMenuClass?.id || 'warrior' })}
                    style={{ ...menuBtnStyle, width: 'auto', flex: '1 1 48%', height: 54, background: `linear-gradient(180deg, ${selectedMenuClass?.accent || 'rgba(255,255,255,0.12)'}, rgba(255,255,255,0.10))`, border: `1px solid ${selectedMenuClass?.color || 'rgba(255,255,255,0.25)'}` }}
                  >
                    以{selectedMenuClass?.name || '该职业'}进入试炼之地
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* 设置（React 版）：只在 MenuScene 弹层显示 */}
      {sceneKey === 'MenuScene' && settingsOpen ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: '92%',
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.98)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 18
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>设置</div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                style={{
                  cursor: 'pointer',
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800
                }}
              >
                关闭
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '2px solid rgba(42,42,58,1)',
                  background: 'rgba(11, 11, 24, 0.62)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>显示伤害数字</div>
                  <div style={{ opacity: 0.75, fontSize: 16, marginTop: 4 }}>关闭后将不再显示飘字伤害</div>
                </div>
                <input
                  type="checkbox"
                  checked={showDamage}
                  onChange={(e) => {
                    const v = !!e.target.checked;
                    setShowDamage(v);
                    uiBus.emit('ui:settings:setShowDamage', v);
                  }}
                  style={{ width: 20, height: 20 }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '2px solid rgba(42,42,58,1)',
                  background: 'rgba(11, 11, 24, 0.62)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>显示敌人头顶状态</div>
                  <div style={{ opacity: 0.75, fontSize: 16, marginTop: 4 }}>关闭时不显示小怪和精英头顶的血条与 debuff</div>
                </div>
                <input
                  type="checkbox"
                  checked={showEnemyOverlays}
                  onChange={(e) => {
                    const v = !!e.target.checked;
                    setShowEnemyOverlays(v);
                    uiBus.emit('ui:settings:setShowEnemyOverlays', v);
                  }}
                  style={{ width: 20, height: 20 }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '2px solid rgba(42,42,58,1)',
                  background: 'rgba(11, 11, 24, 0.62)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>爽刷模式敌人血量</div>
                  <div style={{ opacity: 0.75, fontSize: 16, marginTop: 4 }}>开启后普通敌人与精英生命降到 70%，更偏清怪爽感</div>
                </div>
                <input
                  type="checkbox"
                  checked={enemyHpMode === 'low'}
                  onChange={(e) => {
                    const mode = e.target.checked ? 'low' : 'normal';
                    setEnemyHpMode(mode);
                    uiBus.emit('ui:settings:setEnemyHpMode', mode);
                  }}
                  style={{ width: 20, height: 20 }}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {/* 道具商店（React 版）：只在 ItemShopScene 显示 */}
      {sceneKey === 'ItemShopScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            color: '#fff'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 0,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, opacity: 0.9 }}>点一下查看，再决定是否购买</div>
              <button
                type="button"
                onClick={() => uiBus.emit('ui:gotoScene', 'MenuScene')}
                style={{
                  cursor: 'pointer',
                  height: 30,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800
                }}
              >
                返回
              </button>
            </div>

            <div style={{ opacity: 0.92, fontSize: 18, fontWeight: 900 }}>
              全局金币: {viewData?.globalCoins || 0}
            </div>

            <div
              className="mobile-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                gap: 10,
                alignContent: 'start',
                paddingBottom: 8,
                userSelect: 'none'
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              {itemShopItems.map((item) => {
                const ownedCount = getOwnedCount(item.id);
                const purchaseState = getPurchaseState(item, ownedItems, viewData?.globalCoins || 0);
                const selected = shopDetailItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => showShopDetail(item)}
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      background: 'transparent',
                      color: '#fff',
                      padding: 0,
                      textAlign: 'center',
                      userSelect: 'none',
                      WebkitUserSelect: 'none'
                    }}
                    title={`${item.name}：${item.desc}`}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 16,
                        border: selected ? `2px solid ${item.qualityColor || 'rgba(125,211,252,0.95)'}` : '2px solid rgba(42,42,58,1)',
                        background: selected ? `${item.qualityGlow || 'rgba(29, 78, 216, 0.22)'}` : 'rgba(11, 11, 24, 0.62)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 22,
                        position: 'relative'
                      }}
                    >
                      {item.icon}
                      <div
                        style={{
                          position: 'absolute',
                          left: 6,
                          top: 6,
                          minWidth: 20,
                          height: 20,
                          borderRadius: 999,
                          padding: '0 6px',
                          fontSize: 10,
                          fontWeight: 900,
                          background: 'rgba(0,0,0,0.44)',
                          color: item.qualityColor || '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {item.qualityLabel}
                      </div>
                      {ownedCount > 0 ? (
                        <div
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            minWidth: 22,
                            height: 22,
                            borderRadius: 999,
                            padding: '0 6px',
                            fontSize: 11,
                            fontWeight: 900,
                            background: 'rgba(0,0,0,0.42)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {ownedCount}
                        </div>
                      ) : null}
                      <div
                        style={{
                          position: 'absolute',
                          left: 6,
                          right: 6,
                          bottom: 6,
                          borderRadius: 10,
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 900,
                          background: purchaseState.ok ? 'rgba(37,99,235,0.22)' : 'rgba(0,0,0,0.35)',
                          opacity: 0.92
                        }}
                      >
                        {`${ownedCount}/${purchaseState.maxOwned || 1}`}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontWeight: 900,
                        fontSize: 15,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ marginTop: 2, fontWeight: 900, fontSize: 14, color: '#ffd700' }}>{item.price} G</div>
                  </button>
                );
              })}
            </div>

            {/* 详情卡片：点击道具后出现（风格与装备查看类似），可在此购买 */}
            {shopDetailItem ? (
              (() => {
                const ownedCount = getOwnedCount(shopDetailItem.id);
                const purchaseState = getPurchaseState(shopDetailItem, ownedItems, viewData?.globalCoins || 0);
                return (
                  <div
                    style={{
                      borderRadius: 16,
                      border: '2px solid rgba(42,42,58,1)',
                      background: 'rgba(11, 11, 24, 0.92)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 14,
                          border: '1px solid rgba(255,255,255,0.14)',
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          flexShrink: 0
                        }}
                      >
                        {shopDetailItem.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>
                          {shopDetailItem.name}
                        </div>
                        <div style={{ opacity: 0.82, fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{shopDetailItem.desc}</div>
                        <div style={{ opacity: 0.64, fontSize: 12, marginTop: 6 }}>{`${shopDetailItem.qualityLabel}质 · ${shopDetailItem.categoryLabel || '商品'}`}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontWeight: 900, color: '#ffd700' }}>{shopDetailItem.price} G</div>
                        <div style={{ fontSize: 12, opacity: 0.72 }}>{`已拥有 ${ownedCount}/${purchaseState.maxOwned || 1}`}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          type="button"
                          disabled={!purchaseState.ok}
                          onClick={() => attemptPurchaseShopItem(shopDetailItem)}
                          style={{
                            cursor: purchaseState.ok ? 'pointer' : 'default',
                            height: 42,
                            padding: '0 18px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.18)',
                            background: purchaseState.ok ? 'rgba(59,130,246,0.26)' : 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 900,
                            opacity: purchaseState.ok ? 1 : 0.55
                          }}
                        >
                          购买
                        </button>
                        <button
                          type="button"
                          onClick={() => setShopDetailItem(null)}
                          style={{
                            cursor: 'pointer',
                            height: 42,
                            padding: '0 16px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 800
                          }}
                        >
                          关闭
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 装备系统（React 版）：只在 EquipmentScene 显示 */}
      {sceneKey === 'EquipmentScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            color: '#fff'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 0,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, opacity: 0.9 }}>点一下查看，再决定装备或卸载</div>
              <button
                type="button"
                onClick={() => uiBus.emit('ui:gotoScene', 'MenuScene')}
                style={{
                  cursor: 'pointer',
                  height: 30,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800
                }}
              >
                返回
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>已装备</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {new Array(6).fill(null).map((_, idx) => {
                  const itemId = equippedItems?.[idx] || null;
                  const item = itemId ? ITEM_DEFS.find((it) => it.id === itemId) : null;
                  const selected = equipDetail?.item?.id && item?.id === equipDetail.item.id && equipDetail?.kind === 'equipped' && equipDetail?.slotIndex === idx;
                  return (
                    <button
                      key={`slot-${idx}`}
                      type="button"
                      onClick={() => showEquipDetail(item ? { kind: 'equipped', slotIndex: idx, item } : null)}
                      style={{
                        cursor: 'pointer',
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 16,
                        border: selected ? '2px solid rgba(125,211,252,0.95)' : '2px solid rgba(42,42,58,1)',
                        background: selected ? 'rgba(29, 78, 216, 0.22)' : 'rgba(11, 11, 24, 0.62)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: item ? 22 : 15,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        boxShadow: selected ? '0 0 0 1px rgba(255,255,255,0.16) inset' : 'none'
                      }}
                      title={item ? item.name : `空槽位 ${idx + 1}`}
                    >
                      {item ? item.icon : '空'}
                    </button>
                  );
                })}
              </div>
            </div>

            {equipDetail?.item ? (
              (() => {
                const item = equipDetail.item;
                const list = Array.isArray(equippedItems) ? equippedItems : [];
                const equippedSlot = equipDetail?.kind === 'equipped'
                  ? Number(equipDetail?.slotIndex)
                  : list.indexOf(item.id);
                const equippedCount = getEquippedCount(item.id);
                const ownedCount = getOwnedCount(item.id);
                const equipState = getEquipState(item.id, ownedItems, equippedItems);
                const isEquipped = equippedSlot >= 0;
                const canEquip = equipDetail?.kind === 'owned' && getNextAutoEquipSlot() >= 0 && equipState.ok;
                const actionLabel = equipDetail?.kind === 'equipped' ? '卸载' : '装备';

                return (
                  <div
                    style={{
                      borderRadius: 16,
                      border: '2px solid rgba(42,42,58,1)',
                      background: 'rgba(11, 11, 24, 0.92)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 14,
                          border: '1px solid rgba(255,255,255,0.14)',
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          flexShrink: 0
                        }}
                      >
                        {item.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>{item.name}</div>
                        <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{item.desc}</div>
                        <div style={{ opacity: 0.62, fontSize: 12, marginTop: 6 }}>{`已拥有 ${ownedCount} · 已携带 ${equippedCount}`}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        disabled={equipDetail?.kind === 'equipped' ? !isEquipped : !canEquip}
                        onClick={() => {
                          if (equipDetail?.kind === 'equipped' && isEquipped) {
                            unequipSlot(equippedSlot);
                            showFloatingInfo('已卸载');
                            setEquipDetail(null);
                            return;
                          }
                          autoEquipOwnedItem(item.id);
                          showFloatingInfo(canEquip ? '已装备' : '无法继续携带');
                        }}
                        style={{
                          cursor: (equipDetail?.kind === 'equipped' ? isEquipped : canEquip) ? 'pointer' : 'default',
                          height: 42,
                          padding: '0 18px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: (equipDetail?.kind === 'equipped' ? isEquipped : canEquip) ? 'rgba(59,130,246,0.26)' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 900,
                          opacity: (equipDetail?.kind === 'equipped' ? isEquipped : canEquip) ? 1 : 0.55
                        }}
                      >
                        {actionLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEquipDetail(null)}
                        style={{
                          cursor: 'pointer',
                          height: 42,
                          padding: '0 16px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.14)',
                          background: 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 800
                        }}
                      >
                        关闭
                      </button>
                      {(equipDetail?.kind === 'owned' && !canEquip) ? (
                        <div style={{ fontSize: 12, opacity: 0.72 }}>
                          {getNextAutoEquipSlot() < 0 ? '没有空槽位' : '已达到携带上限'}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '14px 16px',
                  fontSize: 13,
                  opacity: 0.74,
                  lineHeight: 1.5
                }}
              >
                点击上方已装备格子或下方背包物品，查看详情后再决定装备或卸载。
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>已拥有</div>
              <div
                className="mobile-scroll"
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                  gap: 10,
                  alignContent: 'start',
                  paddingBottom: 8,
                  userSelect: 'none'
                }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                {ITEM_DEFS.filter((it) => getOwnedCount(it.id) > 0).length === 0 ? (
                  <div style={{ opacity: 0.8 }}>暂无已购买道具</div>
                ) : (
                  ITEM_DEFS.filter((it) => getOwnedCount(it.id) > 0).map((item) => (
                    (() => {
                      const ownedCount = getOwnedCount(item.id);
                      const equippedCount = getEquippedCount(item.id);
                      const fullyEquipped = equippedCount > 0 && equippedCount >= ownedCount;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => showEquipDetail({ kind: 'owned', item })}
                          style={{
                            cursor: 'pointer',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            borderRadius: 16,
                            border: equipDetail?.item?.id === item.id ? '2px solid rgba(125,211,252,0.95)' : '2px solid rgba(42,42,58,1)',
                            background: equipDetail?.item?.id === item.id ? 'rgba(29, 78, 216, 0.22)' : 'rgba(11, 11, 24, 0.62)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: 22,
                            overflow: 'hidden',
                            opacity: fullyEquipped ? 0.52 : 1,
                            filter: fullyEquipped ? 'grayscale(0.35) brightness(0.92)' : 'none',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            boxShadow: equipDetail?.item?.id === item.id ? '0 0 0 1px rgba(255,255,255,0.16) inset' : 'none'
                          }}
                          title={`${item.name}：${item.desc}`}
                        >
                          {item.icon}
                          <div
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              minWidth: 22,
                              height: 22,
                              borderRadius: 999,
                              padding: '0 6px',
                              fontSize: 11,
                              fontWeight: 900,
                              background: 'rgba(0,0,0,0.42)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {ownedCount}
                          </div>
                          {equippedCount > 0 ? (
                            <div
                              style={{
                                position: 'absolute',
                                left: 6,
                                right: 6,
                                bottom: 6,
                                borderRadius: 10,
                                padding: '2px 6px',
                                fontSize: 10,
                                fontWeight: 900,
                                background: 'rgba(37,99,235,0.22)',
                                opacity: 0.92
                              }}
                            >
                              {`${equippedCount}/${ownedCount}`}
                            </div>
                          ) : null}
                        </button>
                      );
                    })()
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      ) : null}

      {/* 三选一升级（React 版）：暂停场景内连续加点 */}
      {sceneKey === 'LevelUpScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'rgba(0,0,0,0.70)'
          }}
        >
          <div
            style={{
              width: levelUpViewportWidth,
              height: levelUpViewportHeight,
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 0,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: compactLevelUpCards ? '8px 8px 10px' : '12px 12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: compactLevelUpCards ? 6 : 10,
              overflow: 'hidden'
            }}
          >
            {isOffClassChoice ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 900, lineHeight: 1.02, color: '#f8fafc' }}>
                    选择副职业
                  </div>
                  <div style={{ opacity: 0.84, fontSize: 15, lineHeight: 1.5, maxWidth: 560 }}>
                    从六个副职业中选择一个分支。选定后将解锁对应基础能力，并在天赋树中显示完整副职业路线。
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                    gap: 12,
                    alignContent: 'stretch'
                  }}
                >
                  {levelUpOptions.map((opt) => {
                    const theme = getUpgradeCardTheme(opt);
                    const iconText = theme.iconText || opt.icon;
                    const displayDesc = opt.offerDesc || opt.desc;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => uiBus.emit('ui:levelUp:select', opt.id)}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: '18px 18px 16px',
                          borderRadius: 18,
                          border: `2px solid ${toRgba(theme.border, 0.94)}`,
                          background: theme.gradient,
                          color: '#fff',
                          width: '100%',
                          minHeight: 0,
                          height: '100%',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: theme.shadow,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 12,
                          touchAction: 'manipulation'
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(180deg, ${toRgba(theme.accentSoft, 0.14)}, rgba(255,255,255,0))`,
                            pointerEvents: 'none'
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 14,
                            bottom: 14,
                            width: 7,
                            borderRadius: 999,
                            background: toRgba(theme.accent, 0.96),
                            boxShadow: `0 0 18px ${toRgba(theme.outerGlow, 0.38)}`,
                            pointerEvents: 'none'
                          }}
                        />
                        <div
                          style={{
                            alignSelf: 'flex-start',
                            padding: '5px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            color: theme.badgeColor,
                            background: theme.badgeBackground,
                            border: `1px solid ${theme.badgeBorder}`
                          }}
                        >
                          {theme.badge || '副职业'}
                        </div>

                        <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div
                            style={{
                              minWidth: 54,
                              height: 54,
                              borderRadius: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                              fontWeight: 900,
                              color: '#fff',
                              background: toRgba(theme.accent, 0.22),
                              border: `1px solid ${toRgba(theme.accentSoft, 0.44)}`,
                              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 20px ${toRgba(theme.outerGlow, 0.16)}`
                            }}
                          >
                            {iconText}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: theme.titleColor, lineHeight: 1.1 }}>
                              {opt.name}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.88, marginTop: 6 }}>
                              {theme.kicker || '副职业解锁'}
                            </div>
                          </div>
                        </div>

                        <div style={{ position: 'relative', color: theme.descColor, opacity: 0.94, fontSize: 13, lineHeight: 1.55 }}>
                          {displayDesc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: compactLevelUpCards ? 'clamp(24px, 5.2vw, 32px)' : 'clamp(30px, 6vw, 38px)', fontWeight: 900, color: '#ffff00', lineHeight: 1.05 }}>
                      剩余点数：{levelUpPendingPoints}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => uiBus.emit('ui:levelUp:close')}
                      style={{
                        cursor: 'pointer',
                        height: compactLevelUpCards ? 34 : 40,
                        padding: compactLevelUpCards ? '0 10px' : '0 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.22)',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        fontSize: compactLevelUpCards ? 11 : 14,
                        fontWeight: 800,
                        flexShrink: 0
                      }}
                    >
                      稍后再加
                    </button>
                  </div>
                </div>
                <div style={{ opacity: 0.92, fontSize: compactLevelUpCards ? 14 : 17, fontWeight: 800, lineHeight: 1.15 }}>
                  {`请选择一个升级选项`}
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr)',
                    gridAutoRows: 'max-content',
                    gap: compactLevelUpCards ? 6 : 10,
                    alignContent: 'start',
                    paddingRight: 4
                  }}
                >
                  {levelUpOptions.map((opt) => {
                    const theme = getUpgradeCardTheme(opt);
                    const isSpecial = theme.kind !== 'normal';
                    const iconText = theme.iconText || opt.icon;
                    const levelLabel = opt.offerLevelLabel || '';
                    const displayDesc = opt.offerDesc || opt.desc;
                    const hasTopMeta = !!(theme.badge || theme.kicker || levelLabel);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => uiBus.emit('ui:levelUp:select', opt.id)}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: compactLevelUpCards ? '10px 14px' : '16px 18px',
                          borderRadius: 16,
                          border: `2px solid ${toRgba(theme.border, isSpecial ? 0.92 : 0.55)}`,
                          background: theme.gradient,
                          color: '#fff',
                          width: '100%',
                          minHeight: compactLevelUpCards ? 92 : 112,
                          height: 'auto',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: theme.shadow,
                          animation: theme.kind.startsWith('third_') ? 'levelup-card-pulse 2.2s ease-in-out infinite' : 'none',
                          touchAction: 'manipulation',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(180deg, ${toRgba(theme.accentSoft, isSpecial ? 0.12 : 0.05)}, rgba(255,255,255,0))`,
                            pointerEvents: 'none'
                          }}
                        />
                        {theme.effectClassName ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: -20,
                              bottom: -20,
                              left: '-18%',
                              width: '30%',
                              background: `linear-gradient(180deg, rgba(255,255,255,0), ${toRgba(theme.accentSoft, 0.22)}, rgba(255,255,255,0))`,
                              filter: 'blur(10px)',
                              transform: 'rotate(-16deg)',
                              pointerEvents: 'none',
                              animation: `levelup-card-shimmer ${theme.kind === 'offclass' ? '2.4s' : '1.9s'} linear infinite`
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 10,
                            bottom: 10,
                            width: 6,
                            borderRadius: 999,
                            background: toRgba(theme.accent, isSpecial ? 0.95 : 0.40),
                            boxShadow: `0 0 16px ${toRgba(theme.outerGlow, isSpecial ? 0.35 : 0.16)}`,
                            pointerEvents: 'none'
                          }}
                        />
                        {theme.badge ? (
                          <div
                            style={{
                              position: 'absolute',
                              right: 12,
                              top: compactLevelUpCards ? 8 : 12,
                              padding: compactLevelUpCards ? '2px 7px' : '5px 11px',
                              borderRadius: 999,
                              fontSize: compactLevelUpCards ? 9 : 12,
                              fontWeight: 900,
                              letterSpacing: '0.08em',
                              color: theme.badgeColor,
                              background: theme.badgeBackground,
                              border: `1px solid ${theme.badgeBorder}`,
                              backdropFilter: 'blur(8px)'
                            }}
                          >
                            {theme.badge}
                          </div>
                        ) : null}
                        {theme.kicker ? (
                          <div
                            style={{
                              position: 'absolute',
                              right: 14,
                              top: compactLevelUpCards ? 26 : 38,
                              fontSize: compactLevelUpCards ? 9 : 12,
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              color: 'rgba(255,255,255,0.86)',
                              textShadow: '0 0 12px rgba(255,255,255,0.12)'
                            }}
                          >
                            {theme.kicker}
                          </div>
                        ) : null}
                        {levelLabel ? (
                          <div
                            style={{
                              position: 'absolute',
                              left: compactLevelUpCards ? 12 : 16,
                              top: compactLevelUpCards ? 8 : 12,
                              padding: compactLevelUpCards ? '4px 8px' : '6px 11px',
                              borderRadius: 999,
                              fontSize: compactLevelUpCards ? 11 : 15,
                              fontWeight: 900,
                              letterSpacing: '0.05em',
                              color: '#fffdf5',
                              background: toRgba(theme.accentSoft, 0.14),
                              backdropFilter: 'blur(8px)'
                            }}
                          >
                            {levelLabel}
                          </div>
                        ) : null}
                        {isSpecial ? (
                          <>
                            <div style={{ position: 'absolute', left: compactLevelUpCards ? 10 : 14, top: compactLevelUpCards ? 10 : 14, width: compactLevelUpCards ? 18 : 22, height: 6, borderRadius: 999, background: toRgba(theme.accentSoft, 0.34), transform: 'rotate(-40deg)', filter: 'blur(0.5px)' }} />
                            <div style={{ position: 'absolute', right: compactLevelUpCards ? 10 : 14, bottom: compactLevelUpCards ? 10 : 14, width: compactLevelUpCards ? 18 : 22, height: 6, borderRadius: 999, background: toRgba(theme.accentSoft, 0.26), transform: 'rotate(-40deg)', filter: 'blur(0.5px)' }} />
                          </>
                        ) : null}
                        <div style={{ position: 'relative', display: 'flex', gap: compactLevelUpCards ? 10 : 14, alignItems: 'flex-start', paddingTop: hasTopMeta ? (compactLevelUpCards ? 16 : 24) : 0, minHeight: 0, flex: 1 }}>
                          <div
                            style={{
                              minWidth: compactLevelUpCards ? 38 : 48,
                              height: compactLevelUpCards ? 38 : 48,
                              borderRadius: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: compactLevelUpCards ? 15 : 19,
                              fontWeight: 900,
                              color: '#fff',
                              background: isSpecial ? toRgba(theme.accent, 0.22) : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${toRgba(theme.accentSoft, isSpecial ? 0.48 : 0.18)}`,
                              boxShadow: isSpecial ? `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 20px ${toRgba(theme.outerGlow, 0.14)}` : 'none'
                            }}
                          >
                            {iconText}
                          </div>
                          <div style={{ minWidth: 0, flex: 1, paddingRight: theme.badge ? (compactLevelUpCards ? 72 : 92) : 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: compactLevelUpCards ? 1 : 2 }}>
                            <div style={{ fontWeight: 900, fontSize: compactLevelUpCards ? 16 : 21, color: theme.titleColor, lineHeight: compactLevelUpCards ? 1.1 : 1.15, whiteSpace: 'normal' }}>
                              {opt.name}
                            </div>
                            <div style={{
                              color: theme.descColor,
                              opacity: 0.96,
                              fontSize: compactLevelUpCards ? 13 : 17,
                              marginTop: compactLevelUpCards ? 6 : 8,
                              lineHeight: compactLevelUpCards ? 1.28 : 1.38,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                              paddingBottom: 2
                            }}>
                              {displayDesc}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 2 }}>
                  <button
                    type="button"
                    disabled={rerollDiceCount <= 0}
                    onClick={() => uiBus.emit('ui:levelUp:reroll')}
                    style={{
                      cursor: rerollDiceCount > 0 ? 'pointer' : 'not-allowed',
                      minWidth: compactLevelUpCards ? 108 : 132,
                      height: compactLevelUpCards ? 40 : 46,
                      padding: compactLevelUpCards ? '0 12px' : '0 16px',
                      borderRadius: 14,
                      border: `1px solid ${rerollDiceCount > 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)'}`,
                      background: rerollDiceCount > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                      color: rerollDiceCount > 0 ? '#fff' : 'rgba(255,255,255,0.45)',
                      fontSize: compactLevelUpCards ? 13 : 15,
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: compactLevelUpCards ? 8 : 10
                    }}
                  >
                    <span style={{ fontSize: compactLevelUpCards ? 18 : 20, lineHeight: 1 }}>{rerollItemDef?.icon || '🎲'}</span>
                    <span style={{ fontSize: compactLevelUpCards ? 14 : 16, lineHeight: 1 }}>{rerollDiceCount}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* 技能树展示（React 版）：只在 BuildTreeScene 显示 */}
      {sceneKey === 'BuildTreeScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'rgba(0,0,0,0.75)'
          }}
        >
          <div
            style={{
              width: 860,
              maxWidth: '96%',
              maxHeight: '92%',
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>技能树（双修）</div>
                <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>最多双修两系；技能从下至上成长（底部=初始，顶部=最高）</div>
              </div>
              <button
                type="button"
                onClick={() => uiBus.emit('ui:buildTree:close')}
                style={{
                  cursor: 'pointer',
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 800
                }}
              >
                关闭
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{renderTalentPanel()}</div>
          </div>
        </div>
      ) : null}

      {/* 神秘商店（React 版）：只在 ShopScene 显示 */}
      {sceneKey === 'ShopScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'rgba(0,0,0,0.80)'
          }}
        >
          <div
            style={{
              width: 760,
              maxWidth: '96%',
              maxHeight: '92%',
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#ffd700' }}>{isRoundVendorShop ? '🧺 小商贩补给' : '🏪 神秘商店'}</div>
                {shop?.subtitle ? (
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.78 }}>{shop.subtitle}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => uiBus.emit('ui:shop:close')}
                style={{
                  cursor: 'pointer',
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 800
                }}
              >
                {shop?.closeLabel || '关闭商店'}
              </button>
            </div>

            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffff00' }}>金币: {shop?.coins ?? 0}</div>
            {isRoundVendorShop ? (
              <div style={{ fontSize: 14, opacity: 0.82 }}>
                点击商品查看详情，在下方卡片中购买或取消。
              </div>
            ) : null}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 12, alignContent: 'start' }}>
              {(shop?.items || []).map((item) => {
                const purchased = (shop?.purchased || []).includes(item.id);
                const canBuy = isRoundVendorShop
                  ? !!item.canBuy
                  : (!purchased && (shop?.coins ?? 0) >= Number(item.price || 0));
                const disabledText = isRoundVendorShop
                  ? getRoundVendorDisabledText(item)
                  : '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isRoundVendorShop) {
                        showShopDetail(item);
                        return;
                      }
                      uiBus.emit('ui:shop:buy', item.id);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 136,
                      padding: 12,
                      borderRadius: 16,
                      border: `2px solid ${shopDetailItem?.id === item.id ? (item.rarityTextColor || '#ffe082') : 'rgba(42,42,58,1)'}`,
                      background: canBuy ? 'rgba(11, 11, 24, 0.72)' : 'rgba(11, 11, 24, 0.42)',
                      opacity: canBuy ? 1 : 0.74,
                      cursor: 'pointer',
                      color: '#fff',
                      position: 'relative',
                      textAlign: 'center'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: 10,
                        minWidth: 22,
                        height: 22,
                        padding: '0 6px',
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.44)',
                        color: item.rarityTextColor || '#ffffff',
                        fontSize: 11,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {item.qualityLabel || item.rarityLabel || '货'}
                    </div>
                    <div style={{ fontSize: 36, lineHeight: 1 }}>{item.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#ffd700' }}>{item.price} G</div>
                    {isRoundVendorShop && item.kind === 'consumable' ? (
                      <div style={{ fontSize: 11, opacity: 0.72 }}>
                        {`${Math.max(0, Number(item.currentCount || 0))}/${Math.max(0, Number(item.carryLimit || 0))}`}
                      </div>
                    ) : null}
                    {!canBuy ? (
                      <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.54)' }}>
                        {disabledText || (purchased ? '已购' : '不可购')}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, opacity: 0.62 }}>{isRoundVendorShop ? '点击查看' : '轻触购买'}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {shopDetailItem ? (
              <div
                style={{
                  borderRadius: 16,
                  border: '2px solid rgba(42,42,58,1)',
                  background: 'rgba(11, 11, 24, 0.92)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      border: `1px solid ${shopDetailItem.rarityTextColor || 'rgba(255,255,255,0.14)'}`,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      flexShrink: 0
                    }}
                  >
                    {shopDetailItem.icon}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2, color: shopDetailItem.rarityTextColor || '#ffffff' }}>
                      {shopDetailItem.name}
                    </div>
                    <div style={{ opacity: 0.82, fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{shopDetailItem.desc}</div>
                    {shopDetailItem.categoryLabel || shopDetailItem.rarityLabel ? (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
                        {[shopDetailItem.qualityLabel ? `${shopDetailItem.qualityLabel}质` : '', shopDetailItem.rarityLabel, shopDetailItem.categoryLabel].filter(Boolean).join(' · ')}
                      </div>
                    ) : null}
                  </div>
                </div>

                {(Array.isArray(shopDetailItem.previewLines) && shopDetailItem.previewLines.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {shopDetailItem.previewLines.map((line, index) => (
                      <div key={`${shopDetailItem.id}-line-${index}`} style={{ fontSize: 13, lineHeight: 1.45, color: String(line || '').includes('-') ? '#fca5a5' : '#dbeafe' }}>
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 900, color: '#ffd700' }}>{shopDetailItem.price} G</div>
                    {isRoundVendorShop ? (
                      <div style={{ fontSize: 12, opacity: 0.72 }}>
                        {getRoundVendorDetailHint(shopDetailItem)}
                      </div>
                    ) : null}
                  </div>

                  {isRoundVendorShop ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (attemptRoundVendorPurchase(shopDetailItem)) {
                            setShopDetailItem(null);
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          height: 36,
                          padding: '0 16px',
                          borderRadius: 12,
                          border: `1px solid ${shopDetailItem.canBuy ? 'rgba(96,165,250,0.72)' : 'rgba(255,255,255,0.16)'}`,
                          background: shopDetailItem.canBuy ? 'rgba(59,130,246,0.24)' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 900,
                          opacity: shopDetailItem.canBuy ? 1 : 0.72
                        }}
                      >
                        {shopDetailItem.canBuy ? '购买' : (getRoundVendorDisabledText(shopDetailItem) || '无法购买')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShopDetailItem(null)}
                        style={{
                          cursor: 'pointer',
                          height: 36,
                          padding: '0 16px',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 800
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.68 }}>轻触商品直接购买</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 结算（React 版）：只在 GameOverScene 显示 */}
      {sceneKey === 'GameOverScene' ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'rgba(0,0,0,0.70)'
          }}
        >
          <div
            style={{
              width: 660,
              maxWidth: '94%',
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div
              style={{
                fontSize: 44,
                fontWeight: 900,
                textAlign: 'center',
                color: gameOver?.victory ? '#88ff88' : '#ff8888'
              }}
            >
              {gameOver?.victory ? '🎉 胜利！' : '☠️ 游戏结束'}
            </div>

            <div
              style={{
                borderRadius: 12,
                border: '2px solid rgba(42,42,58,1)',
                background: 'rgba(11, 11, 24, 0.62)',
                padding: 14,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap'
              }}
            >
              {`最终得分: ${gameOver?.score ?? 0}\n`}
              {`存活时间: ${gameOver?.survived ?? '0:00'}\n`}
              {`击败 Boss: ${gameOver?.kills ?? 0}\n\n`}
              {`本局金币: ${gameOver?.sessionCoins ?? 0}\n`}
              {`全局金币: ${gameOver?.globalCoins ?? viewData?.globalCoins ?? 0}`}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => uiBus.emit('ui:gameOver:restart')}
                style={{
                  ...menuBtnStyle,
                  height: 46,
                  fontSize: 18
                }}
              >
                重新开始
              </button>
              <button
                type="button"
                onClick={() => uiBus.emit('ui:gameOver:menu')}
                style={{
                  ...menuBtnStyle,
                  height: 46,
                  fontSize: 18
                }}
              >
                返回菜单
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 底部按钮栏：只在游戏内显示 */}
      {/* 底部按钮栏已移除：横屏使用右上角图标入口；退出放入二级菜单并二次确认 */}

      {/* 查看菜单（React 版本） */}
      {inGame && viewOpen ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            color: '#fff'
          }}
          onMouseDown={(e) => {
            // 点击遮罩关闭；点击面板本身不关闭
            if (e.target === e.currentTarget) uiBus.emit('ui:setViewOpen', false);
          }}
        >
          <div
            style={{
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.7)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* 顶部 tab：从左侧移到上方 */}
            <div
              style={{
                padding: 8,
                display: 'flex',
                gap: 8,
                borderBottom: '2px solid rgba(42,42,58,1)',
                background: 'rgba(20, 20, 36, 0.75)'
              }}
            >
              {[
                { key: 'classes', label: '天赋' },
                { key: 'bag', label: '背包' },
                { key: 'stats', label: '属性' }
              ].map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(t.key);
                      if (floatingInfoText) setFloatingInfoText('');
                    }}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      height: 38,
                      borderRadius: 10,
                      border: `2px solid ${active ? 'rgba(102,204,255,1)' : 'rgba(42,42,58,1)'}`,
                      background: active ? 'rgba(42, 42, 68, 1)' : 'rgba(15, 16, 26, 0.92)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 900
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 右侧内容区：尽量扩大展示面积 */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 0 }}>
              {activeTab === 'classes' ? renderTalentPanel() : null}
              {activeTab === 'bag' ? renderBagPanel() : null}
              {activeTab === 'stats' ? renderStatsPanel() : null}
            </div>

            {/* 底部操作：返回 + 退出 */}
            <div
              style={{
                padding: 8,
                display: 'flex',
                gap: 10,
                borderTop: '2px solid rgba(42,42,58,1)',
                background: 'rgba(20, 20, 36, 0.75)'
              }}
            >
              <button
                type="button"
                onClick={() => uiBus.emit('ui:setViewOpen', false)}
                style={{
                  cursor: 'pointer',
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: '2px solid rgba(42,42,58,1)',
                  background: 'rgba(15, 16, 26, 0.92)',
                  color: 'rgba(255,255,255,0.86)',
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0 10px'
                }}
              >
                ← 返回
              </button>

              <button
                type="button"
                onClick={() => setConfirmExitOpen(true)}
                style={{
                  cursor: 'pointer',
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: '2px solid rgba(255, 77, 77, 0.65)',
                  background: 'rgba(255, 77, 77, 0.10)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0 10px'
                }}
              >
                退出
              </button>
            </div>

            {/* 点击浮框说明（不占用固定空间） */}
            {floatingInfoText ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 56,
                  padding: 12,
                  borderRadius: 0,
                  border: '2px solid rgba(42,42,58,1)',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  background: 'rgba(11, 11, 24, 0.88)',
                  color: '#fff',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  pointerEvents: 'none',
                  fontSize: 13,
                  maxHeight: '40%'
                }}
              >
                {floatingInfoText}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 退出二次确认（模态弹窗） */}
      {inGame && viewOpen && confirmExitOpen ? (
        <div
          className="ui-panel"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmExitOpen(false);
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: '92%',
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.98)',
              border: '2px solid rgba(42,42,58,1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>确定要退出吗？</div>
              <div style={{ opacity: 0.85, lineHeight: 1.6 }}>未保存进度将丢失。</div>
            </div>
            <div style={{ display: 'flex', borderTop: '2px solid rgba(42,42,58,1)' }}>
              <button
                type="button"
                onClick={() => setConfirmExitOpen(false)}
                style={{
                  cursor: 'pointer',
                  flex: 1,
                  height: 48,
                  border: 0,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 900
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmExitOpen(false);
                  uiBus.emit('ui:setViewOpen', false);
                  uiBus.emit('ui:goMenu');
                }}
                style={{
                  cursor: 'pointer',
                  flex: 1,
                  height: 48,
                  border: 0,
                  background: 'rgba(255, 77, 77, 0.18)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 900
                }}
              >
                退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const hudBtnStyle = {
  cursor: 'pointer',
  width: 96,
  height: 30,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 13
};

const menuBtnStyle = {
  cursor: 'pointer',
  width: '100%',
  height: 48,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 18,
  fontWeight: 800
};
