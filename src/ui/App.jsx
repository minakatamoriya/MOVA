import React, { useEffect, useRef, useState } from 'react';
import { uiBus } from './bus';
import { useUiStore } from './store';
import { TREE_DEFS, buildThirdTalentTreePlaceholder, getMaxLevel } from '../classes/talentTrees';
import { getEquipState, getOwnedItemCount, getPurchaseState, ITEM_DEFS } from '../data/items';
import { getUpgradeCardTheme, toRgba } from './upgradeCardTheme';

export default function App() {
  const sceneKey = useUiStore((s) => s.sceneKey);
  const setSceneKey = useUiStore((s) => s.setSceneKey);
  const inGame = useUiStore((s) => s.inGame);
  const setInGame = useUiStore((s) => s.setInGame);

  const showDamage = useUiStore((s) => s.showDamage);
  const setShowDamage = useUiStore((s) => s.setShowDamage);
  const showEnemyOverlays = useUiStore((s) => s.showEnemyOverlays);
  const setShowEnemyOverlays = useUiStore((s) => s.setShowEnemyOverlays);

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
  const floatingInfoTimerRef = useRef(null);

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
    };
    uiBus.on('phaser:settingsChanged', onSettingsChanged);
    // 拉取一次当前设置（main.js 也会初始推送，但这里确保不漏）
    uiBus.emit('ui:settings:request');
    return () => {
      uiBus.off('phaser:settingsChanged', onSettingsChanged);
    };
  }, [setShowDamage, setShowEnemyOverlays]);

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
    if (sceneKey !== 'ItemShopScene') {
      setShopDetailItem(null);
    }
  }, [sceneKey]);

  const getOwnedCount = (itemId) => getOwnedItemCount(ownedItems, itemId);
  const getEquippedCount = (itemId) => getOwnedItemCount(equippedItems, itemId);

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
      [p.warlockRange, p.warlockPoisonNovaRadiusBase],
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

    const mainDef = mainTreeId ? TREE_DEFS.find((t) => t.id === mainTreeId) : null;
    const offDef = offTreeId ? TREE_DEFS.find((t) => t.id === offTreeId) : null;
    const thirdDef = buildThirdTalentTreePlaceholder({
      mainCoreKey: mainCore,
      offFaction,
      mainTreeDef: mainDef,
      offTreeDef: offDef
    });

    const panels = [
      { key: 'left', title: mainDef ? mainDef.name : '主职业（未选择）', def: mainDef },
      { key: 'mid', title: offDef ? offDef.name : '副职业（未选择）', def: offDef },
      { key: 'right', title: thirdDef ? thirdDef.name : '第三天赋（未解锁）', def: thirdDef }
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
      if (node.id === def.ultimate?.id) return 'ultimate';
      return 'talent';
    };

    const getNodeBadgeText = (node, def) => {
      const kind = getNodeKind(node, def);
      if (kind === 'core') return '初始';
      if (kind === 'ultimate') return '终极';
      const cleaned = String(node.name || '')
        .replace(/^初始：/, '')
        .replace(/^终极：/, '')
        .replace(/^选择：/, '')
        .replace(/^（预留）/, '预留')
        .trim();
      return cleaned.slice(0, 2) || '天赋';
    };

    const TalentIconButton = ({ node, def }) => {
      const level = skillTreeLevels?.[node.id] || 0;
      const maxLevel = node.maxLevel || getMaxLevel(node.id) || 1;
      const kind = getNodeKind(node, def);
      const badge = badgeTextFor(level, maxLevel);
      const borderColor = toCssHex(def?.color);
      const iconText = getNodeBadgeText(node, def);
      const isSelected = selectedTalent?.node?.id === node.id;
      const hintText = kind === 'core'
        ? '起点'
        : (kind === 'ultimate' ? '终极' : String(node.name || '').replace(/^初始：|^终极：|^选择：/, '').trim().slice(0, 4));

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
            gap: 6,
            width: '100%',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none'
          }}
          title={node.name}
        >
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 0,
              border: isSelected ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: kind === 'talent' ? 16 : 14,
              background: isSelected ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              letterSpacing: '0.04em',
              position: 'relative',
              boxShadow: isSelected ? `0 0 0 1px ${borderColor}33 inset` : 'none'
            }}
          >
            {badge ? (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  minWidth: 20,
                  height: 20,
                  padding: '0 5px',
                  borderRadius: 0,
                  border: 'none',
                  background: isSelected ? '#ffffff' : toCssRgba(def?.color, 0.92),
                  color: isSelected ? '#111827' : '#ffffff',
                  fontSize: 10,
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
              fontSize: 11,
              lineHeight: 1.2,
              opacity: 0.78,
              textAlign: 'center',
              padding: '0 2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {hintText || node.name}
          </div>
        </button>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, minHeight: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
            alignContent: 'start'
          }}
        >
          {panels.map((panel) => {
            const def = panel.def;
            const borderColor = toCssHex(def?.color);
            const allNodes = def ? [def.core, ...(def.nodes || []), def.ultimate].filter(Boolean) : [];
            const acquired = def ? allNodes.filter((n) => (skillTreeLevels?.[n.id] || 0) > 0) : [];

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
                  {panel.key === 'right' && def?.variant ? (
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: '0.06em',
                        color: panel.key === 'right' && def.variant === 'dual' ? '#f5d0fe' : toCssHex(def.color),
                        opacity: 0.92
                      }}
                    >
                      {def.variant === 'dual' ? '双职业' : '深度专精'}
                    </div>
                  ) : null}
                </div>

                {!def ? (
                  <div style={{ borderRadius: 0, background: 'rgba(11, 11, 24, 0.58)', padding: 12, fontSize: 13, lineHeight: 1.6, opacity: 0.75 }}>
                    等待选择
                  </div>
                ) : acquired.length === 0 ? (
                  <div style={{ borderRadius: 0, background: 'rgba(11, 11, 24, 0.58)', padding: 12, fontSize: 13, lineHeight: 1.6, opacity: 0.75 }}>
                    尚未获得天赋
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 10,
                      userSelect: 'none',
                      WebkitUserSelect: 'none'
                    }}
                  >
                    {acquired.map((node) => (
                      <TalentIconButton key={node.id} node={node} def={def} />
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
      return [
        `${item.icon || ''} ${item.name || ''}`.trim(),
        rarityLine,
        ...lines
      ].filter(Boolean).join('\n');
    };

    const Slot = ({ item, slotLabel, label }) => {
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
            showFloatingInfo(getItemInfoText(item, slotLabel || label));
          }, e);
        }}
        onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
        onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{
          cursor: 'pointer',
          width: 92,
          height: 92,
          borderRadius: 12,
          border: theme.border,
          background: theme.background,
          boxShadow: theme.boxShadow,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: 8,
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
        <div style={{ fontWeight: 900, fontSize: 16, ...(dimStyle || {}) }}>{item?.icon || label || ''}</div>
        <div style={{ opacity: 0.8, fontSize: 12, textAlign: 'center', ...(dimStyle || {}) }}>{item?.name || ''}</div>
        {item?.rarityLabel ? (
          <div style={{ position: 'absolute', left: 7, bottom: 6, fontSize: 10, fontWeight: 900, color: item.rarityTextColor || '#ffffff', textShadow: '0 1px 0 rgba(0,0,0,0.45)' }}>
            {item.rarityLabel}
          </div>
        ) : null}
      </button>
      );
    };

    const equipped6 = new Array(6).fill(null).map((_, i) => inventoryEquipped?.[i] || null);
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
          <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.72 }}>战利品</div>
          <div style={{ fontSize: 12, opacity: 0.62 }}>局内即时生效，不进入携带栏</div>
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
      `}</style>
      {/* 游戏内：右上角“查看”图标（圆形） */}
      {inGame ? (
        <button
          type="button"
          className="ui-panel"
          onClick={() => uiBus.emit('ui:setViewOpen', !viewOpen)}
          title="查看"
          aria-label="查看"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: '2px solid rgba(42,42,58,1)',
            background: 'rgba(15, 16, 26, 0.92)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 22,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ☰
        </button>
      ) : null}
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
              width: 520,
              maxWidth: '92%',
              borderRadius: 12,
              background: 'rgba(15, 16, 26, 0.92)',
              border: '2px solid rgba(42,42,58,1)',
              padding: 18
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 900, textAlign: 'center', marginBottom: 6 }}>MOVA</div>
            <div style={{ opacity: 0.85, textAlign: 'center', marginBottom: 16 }}>走位·策略·双职业·三选一</div>
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" onClick={() => uiBus.emit('ui:gotoScene', 'GameScene')} style={{ ...menuBtnStyle, width: 'auto', flex: '1 1 48%' }}>开始游戏</button>
              <button type="button" onClick={() => uiBus.emit('ui:gotoScene', 'ItemShopScene')} style={{ ...menuBtnStyle, width: 'auto', flex: '1 1 48%' }}>道具商店</button>
              <button type="button" onClick={() => uiBus.emit('ui:gotoScene', 'EquipmentScene')} style={{ ...menuBtnStyle, width: 'auto', flex: '1 1 48%' }}>装备系统</button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  uiBus.emit('ui:settings:request');
                }}
                style={{ ...menuBtnStyle, width: 'auto', flex: '1 1 48%' }}
              >
                设置
              </button>
            </div>
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
              {ITEM_DEFS.map((item) => {
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
                        border: selected ? '2px solid rgba(125,211,252,0.95)' : '2px solid rgba(42,42,58,1)',
                        background: selected ? 'rgba(29, 78, 216, 0.22)' : 'rgba(11, 11, 24, 0.62)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 22,
                        position: 'relative'
                      }}
                    >
                      {item.icon}
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

      {/* 三选一升级（React 版）：只在 LevelUpScene 显示 */}
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
              width: 720,
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
            <div style={{ fontSize: 34, fontWeight: 900, color: '#ffff00' }}>
              等级提升！ 等级 {levelUp?.level || 1}
            </div>
            <div style={{ opacity: 0.92, fontSize: 18, fontWeight: 800 }}>选择一个升级选项</div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
                alignContent: 'flex-start'
              }}
            >
              {(levelUp?.options || []).map((opt) => {
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
                      padding: isSpecial ? 16 : 14,
                      borderRadius: 16,
                      border: `2px solid ${toRgba(theme.border, isSpecial ? 0.92 : 0.55)}`,
                      background: theme.gradient,
                      color: '#fff',
                      width: '100%',
                      minHeight: 136,
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: theme.shadow,
                      animation: theme.kind.startsWith('third_') ? 'levelup-card-pulse 2.2s ease-in-out infinite' : 'none'
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
                          top: 10,
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11,
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
                          top: 38,
                          fontSize: 11,
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
                          left: 18,
                          top: 10,
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: 16,
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
                        <div style={{ position: 'absolute', left: 14, top: 14, width: 22, height: 6, borderRadius: 999, background: toRgba(theme.accentSoft, 0.34), transform: 'rotate(-40deg)', filter: 'blur(0.5px)' }} />
                        <div style={{ position: 'absolute', right: 14, bottom: 14, width: 22, height: 6, borderRadius: 999, background: toRgba(theme.accentSoft, 0.26), transform: 'rotate(-40deg)', filter: 'blur(0.5px)' }} />
                      </>
                    ) : null}
                    <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start', paddingTop: hasTopMeta ? 24 : 0 }}>
                      <div
                        style={{
                          minWidth: isSpecial ? 58 : 44,
                          height: isSpecial ? 58 : 44,
                          borderRadius: isSpecial ? 14 : 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isSpecial ? 15 : 22,
                          fontWeight: 900,
                          color: '#fff',
                          background: isSpecial ? toRgba(theme.accent, 0.22) : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${toRgba(theme.accentSoft, isSpecial ? 0.48 : 0.18)}`,
                          boxShadow: isSpecial ? `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 20px ${toRgba(theme.outerGlow, 0.14)}` : 'none'
                        }}
                      >
                        {iconText}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: theme.badge ? 88 : 0 }}>
                        <div style={{ fontWeight: 900, fontSize: isSpecial ? 21 : 20, color: theme.titleColor, lineHeight: 1.2 }}>
                          {opt.name}
                        </div>
                        <div style={{ color: theme.descColor, opacity: 0.9, fontSize: 14, marginTop: 8, lineHeight: 1.45 }}>
                          {displayDesc}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
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
              <div style={{ fontSize: 32, fontWeight: 900, color: '#ffd700' }}>🏪 神秘商店</div>
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
                关闭商店
              </button>
            </div>

            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffff00' }}>金币: {shop?.coins ?? 0}</div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(shop?.items || []).map((item) => {
                const purchased = (shop?.purchased || []).includes(item.id);
                const canBuy = !purchased && (shop?.coins ?? 0) >= Number(item.price || 0);
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                      padding: 12,
                      borderRadius: 12,
                      border: '2px solid rgba(42,42,58,1)',
                      background: 'rgba(11, 11, 24, 0.62)'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{item.icon} {item.name}</div>
                      <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>{item.desc}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, color: '#ffff00' }}>{item.price} 💰</div>
                      {purchased ? (
                        <div style={{ fontWeight: 900, color: '#88ff88' }}>已购买</div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => uiBus.emit('ui:shop:buy', item.id)}
                          style={{
                            cursor: canBuy ? 'pointer' : 'not-allowed',
                            height: 34,
                            padding: '0 14px',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.25)',
                            background: canBuy ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
                            color: canBuy ? '#fff' : 'rgba(255,255,255,0.55)',
                            fontSize: 14,
                            fontWeight: 800
                          }}
                        >
                          购买
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
