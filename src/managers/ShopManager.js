import {
  ITEM_DEFS,
  ITEM_QUALITY_DEFS,
  getItemById,
  getOwnedItemCount,
  getOwnedItemIds,
  getPurchaseState,
  normalizeEquippedItems
} from '../data/items';

const QUALITY_SORT_ORDER = {
  white: 0,
  blue: 1,
  purple: 2,
  orange: 3
};

export function ensureGlobalShopState(registry) {
  if (!registry) {
    return {
      globalCoins: 0,
      ownedItems: [],
      equippedItems: new Array(6).fill(null)
    };
  }

  if (!registry.has('globalCoins')) {
    registry.set('globalCoins', 0);
  }

  if (!registry.has('ownedItems')) {
    registry.set('ownedItems', []);
  }

  if (!registry.has('equippedItems')) {
    registry.set('equippedItems', new Array(6).fill(null));
  }

  const globalCoins = Math.max(0, Number(registry.get('globalCoins') || 0));
  const ownedItems = getOwnedItemIds(registry.get('ownedItems'));
  const equippedItems = normalizeEquippedItems(registry.get('equippedItems'), ownedItems);

  registry.set('globalCoins', globalCoins);
  registry.set('ownedItems', ownedItems);
  registry.set('equippedItems', equippedItems);

  return {
    globalCoins,
    ownedItems,
    equippedItems
  };
}

export function getGlobalShopCatalog({ ownedItems = [], globalCoins = 0 } = {}) {
  return ITEM_DEFS
    .filter((item) => item?.shopVisible !== false)
    .map((item) => {
      const quality = ITEM_QUALITY_DEFS[item?.qualityId] || ITEM_QUALITY_DEFS.white;
      const ownedCount = getOwnedItemCount(ownedItems, item.id);
      const purchaseState = getPurchaseState(item, ownedItems, globalCoins);
      return {
        ...item,
        qualityLabel: quality.label,
        qualityName: quality.name,
        qualityColor: quality.color,
        qualityGlow: quality.glow,
        ownedCount,
        canBuy: !!purchaseState.ok,
        purchaseReason: purchaseState.reason || ''
      };
    })
    .sort((left, right) => {
      const qualityDiff = (QUALITY_SORT_ORDER[left?.qualityId] || 0) - (QUALITY_SORT_ORDER[right?.qualityId] || 0);
      if (qualityDiff !== 0) return qualityDiff;
      const priceDiff = Number(left?.price || 0) - Number(right?.price || 0);
      if (priceDiff !== 0) return priceDiff;
      const orderDiff = Number(left?.shopOrder || 0) - Number(right?.shopOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-Hans-CN');
    });
}

export function purchaseGlobalShopItem(registry, itemId) {
  const state = ensureGlobalShopState(registry);
  const item = getItemById(itemId);
  if (!item) {
    return { ok: false, reason: 'missing', globalCoins: state.globalCoins, ownedItems: state.ownedItems };
  }

  const purchaseState = getPurchaseState(item, state.ownedItems, state.globalCoins);
  if (!purchaseState.ok) {
    return {
      ok: false,
      reason: purchaseState.reason,
      price: purchaseState.price,
      globalCoins: state.globalCoins,
      ownedItems: state.ownedItems,
      item
    };
  }

  const nextGlobalCoins = Math.max(0, state.globalCoins - Number(item.price || 0));
  const nextOwnedItems = getOwnedItemIds([...state.ownedItems, item.id]);
  const nextEquippedItems = normalizeEquippedItems(state.equippedItems, nextOwnedItems);

  registry.set('globalCoins', nextGlobalCoins);
  registry.set('ownedItems', nextOwnedItems);
  registry.set('equippedItems', nextEquippedItems);

  return {
    ok: true,
    reason: '',
    item,
    price: Number(item.price || 0),
    globalCoins: nextGlobalCoins,
    ownedItems: nextOwnedItems,
    equippedItems: nextEquippedItems
  };
}