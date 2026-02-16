import React, { useEffect, useRef, useState } from 'react';
import { uiBus } from './bus';
import { useUiStore } from './store';
import { TREE_DEFS, buildThirdTalentTreePlaceholder, getMaxLevel } from '../classes/talentTrees';
import { ITEM_DEFS } from '../data/items';

export default function App() {
  const sceneKey = useUiStore((s) => s.sceneKey);
  const setSceneKey = useUiStore((s) => s.setSceneKey);
  const inGame = useUiStore((s) => s.inGame);
  const setInGame = useUiStore((s) => s.setInGame);

  const showDamage = useUiStore((s) => s.showDamage);
  const setShowDamage = useUiStore((s) => s.setShowDamage);

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
    };
    uiBus.on('phaser:settingsChanged', onSettingsChanged);
    // 拉取一次当前设置（main.js 也会初始推送，但这里确保不漏）
    uiBus.emit('ui:settings:request');
    return () => {
      uiBus.off('phaser:settingsChanged', onSettingsChanged);
    };
  }, [setShowDamage]);

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
  const equipDetailTimerRef = useRef(null);

  // 道具商店（React 版）交互：点击=查看详情（风格与装备查看类似）
  const [shopDetailItem, setShopDetailItem] = useState(null);
  const shopDetailTimerRef = useRef(null);

  const DETAIL_AUTO_HIDE_MS = 3000;
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
    if (!item) return;
    setShopDetailItem(item);
    if (shopDetailTimerRef.current) {
      clearTimeout(shopDetailTimerRef.current);
      shopDetailTimerRef.current = null;
    }
    shopDetailTimerRef.current = setTimeout(() => {
      setShopDetailItem(null);
      shopDetailTimerRef.current = null;
    }, DETAIL_AUTO_HIDE_MS);
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

    if (equipDetailTimerRef.current) {
      clearTimeout(equipDetailTimerRef.current);
      equipDetailTimerRef.current = null;
    }
    equipDetailTimerRef.current = setTimeout(() => {
      setEquipDetail(null);
      equipDetailTimerRef.current = null;
    }, DETAIL_AUTO_HIDE_MS);
  };

  useEffect(() => {
    return () => {
      if (shopDetailTimerRef.current) {
        clearTimeout(shopDetailTimerRef.current);
        shopDetailTimerRef.current = null;
      }
      if (equipDetailTimerRef.current) {
        clearTimeout(equipDetailTimerRef.current);
        equipDetailTimerRef.current = null;
      }
      clearPressState();
    };
  }, []);

  const attemptPurchaseShopItem = (item) => {
    if (!item?.id) return;
    const isOwned = ownedItems.includes(item.id);
    if (isOwned) {
      showFloatingInfo('已拥有');
      return;
    }
    const coins = Number(viewData?.globalCoins || 0);
    const price = Number(item.price || 0);
    if (coins < price) {
      showFloatingInfo('金币不足');
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
    const list = Array.isArray(equippedItems) ? equippedItems : [];
    // 禁止重复装备相同道具
    if (list.includes(itemId)) return;
    // 每次都从左到右补第一个空槽位
    const slot = getNextAutoEquipSlot();
    if (slot < 0) return;
    uiBus.emit('ui:equipment:setSlot', slot, itemId);
  };

  const unequipSlot = (slotIndex) => {
    const idx = Number(slotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= 6) return;
    uiBus.emit('ui:equipment:setSlot', idx, null);
  };

  const renderTalentPanel = () => {
    if (!selectedTrees || selectedTrees.length === 0) {
      return (
        <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
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
      { key: 'main', title: mainDef ? mainDef.name : '主职业（未选择）', def: mainDef },
      { key: 'off', title: offDef ? offDef.name : '副职业（未选择）', def: offDef },
      { key: 'third', title: thirdDef ? thirdDef.name : '第三天赋（未解锁）', def: thirdDef }
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

    const TalentCard = ({ node, def }) => {
      const level = skillTreeLevels?.[node.id] || 0;
      const maxLevel = node.maxLevel || getMaxLevel(node.id) || 1;
      const isCore = node.id === def.core?.id;
      const isUltimate = node.id === def.ultimate?.id;
      const symbol = isUltimate ? '◎' : isCore ? '★' : '◆';
      const badge = badgeTextFor(level, maxLevel);
      const borderColor = toCssHex(def?.color);

      return (
        <button
          type="button"
          onClick={() => {
            setSelectedTalent({ node, def, level, maxLevel });
            showFloatingInfo(`${node.name}\n${node.desc || ''}\n等级: ${level}/${maxLevel}`);
          }}
          style={{
            cursor: 'pointer',
            borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.14)',
            background: 'rgba(11, 11, 24, 0.62)',
            color: '#fff',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
            minHeight: 110
          }}
          title={node.desc || node.name}
        >
          {badge ? (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                padding: '2px 6px',
                borderRadius: 999,
                border: `1px solid ${borderColor}`,
                background: 'rgba(0,0,0,0.35)',
                fontSize: 11,
                fontWeight: 900
              }}
            >
              {badge}
            </div>
          ) : null}

          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              border: `2px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 22,
              background: 'rgba(0,0,0,0.25)'
            }}
          >
            {symbol}
          </div>

          <div style={{ fontSize: 16, fontWeight: 900, textAlign: 'center', lineHeight: 1.15 }}>
            {node.name}
          </div>
        </button>
      );
    };

    return (
      <>
        <style>{`
          @keyframes rainbowBorderShift {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
        `}</style>
        <div style={{ display: 'flex', gap: 12, height: '100%' }}>
          {panels.map((p) => {
          const def = p.def;
          const borderColor = toCssHex(def?.color);
          const glowA = toCssRgba(def?.color, 0.30);
          const glowB = toCssRgba(def?.color, 0.16);

          const allNodes = def ? [def.core, ...(def.nodes || []), def.ultimate].filter(Boolean) : [];
          const acquired = def ? allNodes.filter((n) => (skillTreeLevels?.[n.id] || 0) > 0) : [];

          const isThird = p.key === 'third';
          const thirdVariant = isThird ? def?.variant : null;

          const innerPanelStyle = {
            borderRadius: 12,
            border: `2px solid ${def ? borderColor : 'rgba(42,42,58,1)'}`,
            background: 'rgba(11, 11, 24, 0.35)',
            padding: 10,
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            minHeight: 0,
            boxShadow: (isThird && thirdVariant === 'depth' && def)
              ? `0 0 16px ${glowA}, 0 0 38px ${glowB}`
              : undefined
          };

          const renderPanelBody = () => {
            if (!def) return <div style={{ opacity: 0.7, lineHeight: 1.6 }}>等待选择</div>;
            if (acquired.length === 0) return <div style={{ opacity: 0.7, lineHeight: 1.6 }}>尚未获得天赋</div>;
            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 10
                }}
              >
                {acquired.map((n) => (
                  <TalentCard key={n.id} node={n} def={def} />
                ))}
              </div>
            );
          };

          return (
            <div
              key={p.key}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 0
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16 }}>{p.title}</div>

              {isThird && thirdVariant === 'dual' ? (
                <div
                  style={{
                    borderRadius: 14,
                    padding: 2,
                    backgroundImage: 'linear-gradient(90deg, #ff3b2f, #ff8a00, #ffe600, #2cff7a, #4aa3ff, #a46bff, #ff3b2f)',
                    backgroundSize: '200% 200%',
                    animation: 'rainbowBorderShift 2.8s linear infinite',
                    flex: 1,
                    minHeight: 0,
                    display: 'flex'
                  }}
                >
                  <div style={{ ...innerPanelStyle, border: 'none', flex: 1 }}>
                    {renderPanelBody()}
                  </div>
                </div>
              ) : (
                <div style={innerPanelStyle}>
                  {renderPanelBody()}
                </div>
              )}
            </div>
          );
          })}
        </div>
      </>
    );
  };

  const renderBagPanel = () => {
    const Slot = ({ item, onClick, label }) => {
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

      return (
      <button
        type="button"
        onClick={() => {
          if (typeof onClick === 'function') onClick();
          if (item) {
            showFloatingInfo(`${item.icon || ''} ${item.name || ''}\n${item.desc || ''}\n效果: ${item.effects ? JSON.stringify(item.effects) : '{}'}`);
          } else if (label) {
            showFloatingInfo(`${label}\n空`);
          }
        }}
        style={{
          cursor: 'pointer',
          width: 92,
          height: 92,
          borderRadius: 12,
          border: '2px solid rgba(42,42,58,1)',
          background: 'rgba(11, 11, 24, 0.62)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: 8,
          position: 'relative',
          overflow: 'hidden'
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
      </button>
      );
    };

    const equipped6 = new Array(6).fill(null).map((_, i) => inventoryEquipped?.[i] || null);
    const loot12 = new Array(12).fill(null).map((_, i) => inventoryAcquired?.[i] || null);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>携带（固定 6 格）</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {equipped6.map((it, idx) => (
              <Slot
                key={`eq-${idx}`}
                item={it}
                label={it ? undefined : '空'}
                onClick={() => setSelectedItem(it ? { ...it, slot: `携带 ${idx + 1}` } : { name: '空', desc: '' })}
              />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>战利品（默认展示前 12 个）</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {loot12.map((it, idx) => (
              <Slot
                key={`loot-${idx}`}
                item={it}
                label={it ? undefined : ''}
                onClick={() => setSelectedItem(it ? { ...it, slot: `战利品 ${idx + 1}` } : null)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStatsPanel = () => {
    const p = player || {};
    const maxHp = Number(p.maxHp || 0);
    const fireRate = Number(p.fireRate || 0);
    const dmg = Number(p.bulletDamage || 0);
    const critChance = Number(p.critChance || 0);
    const critMult = Number(p.critMultiplier || 1);

    const dps = fireRate > 0 ? (dmg * (1000 / fireRate)) : 0;
    const critFactor = 1 + critChance * Math.max(0, (critMult - 1));
    const approxDps = dps * critFactor;

    const lifesteal = Number(p.lifestealPercent || 0);
    const shields = Number(p.shieldCharges || 0);
    const speed = Number(p.moveSpeed || 0);

    const damageReduction = Number(p.damageReductionPercent || 0);
    const dodge = Number(p.dodgePercent || 0);
    const regenPerSec = Number(p.regenPerSec || 0);

    const powerScore = Math.max(0, Math.round(
      approxDps * 6 +
      maxHp * 1.2 +
      shields * 35 +
      lifesteal * 800 +
      speed * 0.15
    ));

    return (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, opacity: 0.92 }}>
        {`金币（局内）: ${viewData?.sessionCoins || 0}    全局金币: ${viewData?.globalCoins || 0}\n\n`}
        {`总战斗力（参考分）: ${powerScore}\n\n`}
        {`关键属性汇总：\n`}
        {`减伤%: ${(damageReduction * 100).toFixed(1)}%\n`}
        {`闪避%: ${(dodge * 100).toFixed(1)}%\n`}
        {`暴击率%: ${(critChance * 100).toFixed(1)}%\n`}
        {`暴击伤害倍率: x${critMult.toFixed(2)}\n`}
        {`每秒回复: ${regenPerSec.toFixed(1)}\n`}
        {`吸血%: ${(lifesteal * 100).toFixed(1)}%\n`}
        {`护盾层数: ${shields}\n`}
        {`移速: ${Math.round(speed)}\n\n`}
        {`输出估算：\n`}
        {`单发伤害: ${Math.round(dmg)}\n`}
        {`射速(发/秒): ${(fireRate > 0 ? (1000 / fireRate) : 0).toFixed(2)}\n`}
        {`估算DPS(含暴击期望): ${Math.round(approxDps)}\n`}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
              <div style={{ fontSize: 18, fontWeight: 900, opacity: 0.9 }}>点击购买，长按查看</div>
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
              className="ui-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 92px)',
                gap: 10,
                justifyContent: 'center',
                alignContent: 'start',
                paddingBottom: 84,
                userSelect: 'none'
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              {ITEM_DEFS.map((item) => {
                const isOwned = ownedItems.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onPointerDown={(e) => startLongPress(`shop:${item.id}`, () => showShopDetail(item), e)}
                    onPointerUp={(e) => endLongPress(`shop:${item.id}`, () => attemptPurchaseShopItem(item), e)}
                    onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
                    onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    style={{
                      cursor: 'pointer',
                      width: 92,
                      border: 'none',
                      background: 'transparent',
                      color: '#fff',
                      padding: 0,
                      textAlign: 'center',
                      opacity: isOwned ? 0.55 : 1,
                      filter: isOwned ? 'grayscale(1) brightness(0.9)' : 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      touchAction: 'none'
                    }}
                    title={`${item.name}：${item.desc}`}
                  >
                    <div
                      style={{
                        width: 92,
                        height: 92,
                        borderRadius: 12,
                        border: '2px solid rgba(42,42,58,1)',
                        background: 'rgba(11, 11, 24, 0.62)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 20,
                        position: 'relative'
                      }}
                    >
                      {item.icon}
                      {isOwned ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 6,
                            right: 6,
                            bottom: 6,
                            borderRadius: 10,
                            padding: '2px 6px',
                            fontSize: 11,
                            fontWeight: 900,
                            background: 'rgba(0,0,0,0.35)'
                          }}
                        >
                          已拥有
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontWeight: 900,
                        fontSize: 16,
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
                const isOwned = ownedItems.includes(shopDetailItem.id);
                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: 18,
                      right: 18,
                      bottom: 18,
                      borderRadius: 12,
                      border: '2px solid rgba(42,42,58,1)',
                      background: 'rgba(11, 11, 24, 0.92)',
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shopDetailItem.icon} {shopDetailItem.name}
                      </div>
                      <div style={{ opacity: 0.82, fontSize: 15, marginTop: 4 }}>{shopDetailItem.desc}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, color: '#ffd700' }}>{shopDetailItem.price} G</div>
                      {isOwned ? (
                        <div style={{ fontWeight: 900, color: '#88ff88' }}>已拥有</div>
                      ) : null}
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
              <div style={{ fontSize: 18, fontWeight: 900, opacity: 0.9 }}>点击装备/卸载，长按查看</div>
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

            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 92px)', gap: 10, justifyContent: 'center' }}>
                {new Array(6).fill(null).map((_, idx) => {
                  const itemId = equippedItems?.[idx] || null;
                  const item = itemId ? ITEM_DEFS.find((it) => it.id === itemId) : null;
                  return (
                    <button
                      key={`slot-${idx}`}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onPointerDown={(e) => {
                        if (!item) return;
                        startLongPress(`equipSlot:${idx}`, () => showEquipDetail({ kind: 'equipped', slotIndex: idx, item }), e);
                      }}
                      onPointerUp={(e) => {
                        if (!item) {
                          e.preventDefault();
                          e.stopPropagation();
                          clearPressState();
                          return;
                        }
                        endLongPress(`equipSlot:${idx}`, () => {
                          unequipSlot(idx);
                          showFloatingInfo('已卸载');
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
                        border: '2px solid rgba(42,42,58,1)',
                        background: 'rgba(11, 11, 24, 0.62)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 20,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        touchAction: 'none'
                      }}
                      title={item ? item.name : `空槽位 ${idx + 1}`}
                    >
                      {item ? item.icon : '空'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, 92px)',
                  gap: 10,
                  justifyContent: 'center',
                  alignContent: 'start',
                  paddingBottom: 84,
                  userSelect: 'none'
                }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                {ITEM_DEFS.filter((it) => ownedItems.includes(it.id)).length === 0 ? (
                  <div style={{ opacity: 0.8 }}>暂无已购买道具</div>
                ) : (
                  ITEM_DEFS.filter((it) => ownedItems.includes(it.id)).map((item) => (
                    (() => {
                      const isEquipped = Array.isArray(equippedItems) && equippedItems.includes(item.id);
                      const equippedSlot = Array.isArray(equippedItems) ? equippedItems.indexOf(item.id) : -1;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onPointerDown={(e) => startLongPress(`owned:${item.id}`, () => showEquipDetail({ kind: 'owned', item }), e)}
                          onPointerUp={(e) => endLongPress(`owned:${item.id}`, () => {
                            if (equippedSlot >= 0) {
                              unequipSlot(equippedSlot);
                              showFloatingInfo('已卸载');
                              return;
                            }
                            autoEquipOwnedItem(item.id);
                          }, e)}
                          onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
                          onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); clearPressState(); }}
                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          style={{
                            cursor: 'pointer',
                            width: 92,
                            height: 92,
                            borderRadius: 12,
                            border: '2px solid rgba(42,42,58,1)',
                            background: 'rgba(11, 11, 24, 0.62)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: 20,
                            overflow: 'hidden',
                            opacity: isEquipped ? 0.35 : 1,
                            filter: isEquipped ? 'grayscale(1) brightness(0.85)' : 'none',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            touchAction: 'none'
                          }}
                          title={`${item.name}：${item.desc}`}
                        >
                          {item.icon}
                        </button>
                      );
                    })()
                  ))
                )}
              </div>
            </div>

            {/* 详情卡片：长按展示；3 秒后自动消失 */}
            {equipDetail?.item ? (
              (() => {
                const item = equipDetail.item;
                const list = Array.isArray(equippedItems) ? equippedItems : [];
                const isEquipped = list.includes(item.id);

                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: 18,
                      right: 18,
                      bottom: 18,
                      borderRadius: 12,
                      border: '2px solid rgba(42,42,58,1)',
                      background: 'rgba(11, 11, 24, 0.92)',
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.icon} {item.name}
                      </div>
                      <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>{item.desc}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {isEquipped ? <div style={{ fontWeight: 900, color: '#88ff88' }}>已装备</div> : null}
                    </div>
                  </div>
                );
              })()
            ) : null}
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
              {(levelUp?.options || []).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => uiBus.emit('ui:levelUp:select', opt.id)}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 14,
                    borderRadius: 12,
                    border: '2px solid rgba(0,255,0,0.55)',
                    background: 'rgba(11, 11, 24, 0.62)',
                    color: '#fff',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 900, fontSize: 20, color: '#ffff00' }}>
                      <span style={{ marginRight: 10, fontSize: 22 }}>{opt.icon}</span>
                      {opt.name}
                    </div>
                  </div>
                  <div style={{ opacity: 0.82, fontSize: 14, marginTop: 6 }}>{opt.desc}</div>
                </button>
              ))}
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
