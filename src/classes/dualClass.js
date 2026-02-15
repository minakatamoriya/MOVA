import { TREE_TO_CORE_KEY } from './upgradePools';
import { coreUpgradeIdToCoreKey } from './classDefs';

export function getSelectedTrees(registry) {
  return registry?.get ? (registry.get('selectedTrees') || []) : [];
}

export function getChosenCoreKeysFromSelectedTrees(selectedTrees) {
  return (selectedTrees || []).map(t => TREE_TO_CORE_KEY[t]).filter(Boolean);
}

export function shouldOfferSecondCore(levelUps, selectedTreesLength) {
  return levelUps === 2 && selectedTreesLength === 1;
}

export function getRemainingCoreOptions(coreOptions, chosenCoreKeys) {
  const chosen = new Set(chosenCoreKeys || []);
  return (coreOptions || []).filter(c => {
    const coreKey = coreUpgradeIdToCoreKey(c.id);
    return coreKey && !chosen.has(coreKey);
  });
}
