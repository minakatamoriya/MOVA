import { getTreeIdForSkill, getMaxLevel, normalizeSkillId } from './talentTrees';
import { CORE_UPGRADE_IDS, normalizeCoreKey } from './classDefs';

export function migrateLegacyProgressionRegistry(registry) {
  if (!registry?.get || !registry?.set) return false;

  let changed = false;

  const mainCore = registry.get('mainCore');
  const normalizedMainCore = normalizeCoreKey(mainCore);
  if (normalizedMainCore !== mainCore) {
    registry.set('mainCore', normalizedMainCore || null);
    changed = true;
  }

  const offCore = registry.get('offCore');
  const normalizedOffCore = normalizeCoreKey(offCore);
  if (normalizedOffCore !== offCore) {
    registry.set('offCore', normalizedOffCore || null);
    changed = true;
  }

  const offFaction = registry.get('offFaction');
  if (offFaction === 'curse') {
    registry.set('offFaction', 'summon');
    changed = true;
  }

  const selectedTrees = registry.get('selectedTrees') || [];
  if (Array.isArray(selectedTrees) && selectedTrees.includes('curse')) {
    registry.set('selectedTrees', selectedTrees.map((treeId) => (treeId === 'curse' ? 'summon' : treeId)));
    changed = true;
  }

  const normalizedSelectedTrees = registry.get('selectedTrees') || [];
  if (normalizedMainCore && Array.isArray(normalizedSelectedTrees) && !normalizedSelectedTrees.includes(normalizedMainCore) && normalizedSelectedTrees.length < 2) {
    registry.set('selectedTrees', [...normalizedSelectedTrees, normalizedMainCore]);
    changed = true;
  }

  const rejectedOffFactionEntries = registry.get('rejectedOffFactionEntries') || [];
  if (Array.isArray(rejectedOffFactionEntries) && rejectedOffFactionEntries.includes('off_curse')) {
    registry.set('rejectedOffFactionEntries', rejectedOffFactionEntries.map((entryId) => (entryId === 'off_curse' ? 'off_summon' : entryId)));
    changed = true;
  }

  const skillTreeLevels = registry.get('skillTreeLevels') || {};
  const migratedSkillTreeLevels = {};
  let levelMapChanged = false;
  Object.entries(skillTreeLevels).forEach(([skillId, level]) => {
    const normalizedSkillId = normalizeSkillId(skillId);
    if (normalizedSkillId !== skillId) levelMapChanged = true;
    const current = migratedSkillTreeLevels[normalizedSkillId] || 0;
    migratedSkillTreeLevels[normalizedSkillId] = Math.max(current, Number(level) || 0);
  });

  const legacyMageFrostNovaLevel = Number(migratedSkillTreeLevels.mage_frost_nova || 0);
  const legacyMageFrostDomainLevel = Number(migratedSkillTreeLevels.mage_frost_domain || 0);
  const mergedMageFrostNovaLevel = legacyMageFrostDomainLevel > 0 || legacyMageFrostNovaLevel >= 2
    ? 2
    : (legacyMageFrostNovaLevel >= 1 ? 1 : 0);
  if (mergedMageFrostNovaLevel !== legacyMageFrostNovaLevel || legacyMageFrostDomainLevel > 0) {
    migratedSkillTreeLevels.mage_frost_nova = mergedMageFrostNovaLevel;
    delete migratedSkillTreeLevels.mage_frost_domain;
    levelMapChanged = true;
  }

  const legacyPaladinShelterLevel = Number(migratedSkillTreeLevels.paladin_divine_shelter || 0);
  const legacyPaladinShelterExtensionLevel = Number(migratedSkillTreeLevels.paladin_shelter_extension || 0);
  const mergedPaladinShelterLevel = legacyPaladinShelterExtensionLevel > 0 || legacyPaladinShelterLevel >= 2
    ? 2
    : (legacyPaladinShelterLevel >= 1 ? 1 : 0);
  if (mergedPaladinShelterLevel !== legacyPaladinShelterLevel || legacyPaladinShelterExtensionLevel > 0) {
    migratedSkillTreeLevels.paladin_divine_shelter = mergedPaladinShelterLevel;
    delete migratedSkillTreeLevels.paladin_shelter_extension;
    levelMapChanged = true;
  }

  const legacyArcherEvadeLevel = Number(migratedSkillTreeLevels.archer_nimble_evade || 0);
  const legacyArcherEvadeMasteryLevel = Number(migratedSkillTreeLevels.archer_evade_mastery || 0);
  const mergedArcherEvadeLevel = legacyArcherEvadeMasteryLevel > 0 || legacyArcherEvadeLevel >= 2
    ? 2
    : (legacyArcherEvadeLevel >= 1 ? 1 : 0);
  if (mergedArcherEvadeLevel !== legacyArcherEvadeLevel || legacyArcherEvadeMasteryLevel > 0) {
    migratedSkillTreeLevels.archer_nimble_evade = mergedArcherEvadeLevel;
    delete migratedSkillTreeLevels.archer_evade_mastery;
    levelMapChanged = true;
  }

  const legacyDruidNourishLevel = Number(migratedSkillTreeLevels.druid_nourish || 0);
  const legacyDruidNourishGrowthLevel = Number(migratedSkillTreeLevels.druid_nourish_growth || 0);
  const mergedDruidNourishLevel = legacyDruidNourishGrowthLevel > 0 || legacyDruidNourishLevel >= 2
    ? 2
    : (legacyDruidNourishLevel >= 1 ? 1 : 0);
  if (mergedDruidNourishLevel !== legacyDruidNourishLevel || legacyDruidNourishGrowthLevel > 0) {
    migratedSkillTreeLevels.druid_nourish = mergedDruidNourishLevel;
    delete migratedSkillTreeLevels.druid_nourish_growth;
    levelMapChanged = true;
  }

  const legacyWarriorBloodConversionLevel = Number(migratedSkillTreeLevels.warrior_blood_conversion || 0);
  const legacyWarriorBloodlustMasteryLevel = Number(migratedSkillTreeLevels.warrior_bloodlust_mastery || 0);
  const mergedWarriorBloodLevel = legacyWarriorBloodlustMasteryLevel > 0 || legacyWarriorBloodConversionLevel >= 2
    ? 2
    : (legacyWarriorBloodConversionLevel >= 1 ? 1 : 0);
  if (mergedWarriorBloodLevel !== legacyWarriorBloodConversionLevel || legacyWarriorBloodlustMasteryLevel > 0) {
    migratedSkillTreeLevels.warrior_blood_conversion = mergedWarriorBloodLevel;
    delete migratedSkillTreeLevels.warrior_bloodlust_mastery;
    levelMapChanged = true;
  }

  const legacyWarlockInfernalLevel = Number(migratedSkillTreeLevels.warlock_infernal || 0);
  const legacyWarlockInfernalContractLevel = Number(migratedSkillTreeLevels.warlock_infernal_contract || 0);
  const mergedWarlockInfernalLevel = legacyWarlockInfernalContractLevel > 0 || legacyWarlockInfernalLevel >= 2
    ? 2
    : (legacyWarlockInfernalLevel >= 1 ? 1 : 0);
  if (mergedWarlockInfernalLevel !== legacyWarlockInfernalLevel || legacyWarlockInfernalContractLevel > 0) {
    migratedSkillTreeLevels.warlock_infernal = mergedWarlockInfernalLevel;
    delete migratedSkillTreeLevels.warlock_infernal_contract;
    levelMapChanged = true;
  }

  const legacyArcherRangeLevel = Number(migratedSkillTreeLevels.archer_range || 0);
  if (legacyArcherRangeLevel > 1) {
    migratedSkillTreeLevels.archer_range = 1;
    levelMapChanged = true;
  }

  const legacyWarriorRangeLevel = Number(migratedSkillTreeLevels.warrior_range || 0);
  if (legacyWarriorRangeLevel > 1) {
    migratedSkillTreeLevels.warrior_range = 1;
    levelMapChanged = true;
  }

  const legacyWarriorEndureLevel = Number(migratedSkillTreeLevels.warrior_endure || 0);
  if (legacyWarriorEndureLevel > 1) {
    migratedSkillTreeLevels.warrior_endure = 1;
    levelMapChanged = true;
  }

  Object.keys(migratedSkillTreeLevels).forEach((skillId) => {
    const clampedLevel = Math.min(getMaxLevel(skillId), Number(migratedSkillTreeLevels[skillId]) || 0);
    if (clampedLevel !== migratedSkillTreeLevels[skillId]) {
      migratedSkillTreeLevels[skillId] = clampedLevel;
      levelMapChanged = true;
    }
  });

  if (levelMapChanged) {
    registry.set('skillTreeLevels', migratedSkillTreeLevels);
    changed = true;
  }

  if (normalizedMainCore) {
    const coreUpgradeId = CORE_UPGRADE_IDS[normalizedMainCore] || null;
    if (coreUpgradeId && !(Number(migratedSkillTreeLevels[coreUpgradeId]) > 0)) {
      migratedSkillTreeLevels[coreUpgradeId] = 1;
      registry.set('skillTreeLevels', migratedSkillTreeLevels);
      changed = true;
    }
  }

  return changed;
}

// 由升级驱动写入 registry，供技能树 UI 展示与双树进度判断
export function recordSkillTreeProgress(registry, upgrade) {
  if (!registry?.get || !registry?.set) return;
  if (!upgrade || (upgrade.category !== 'build' && upgrade.category !== 'mix' && upgrade.category !== 'third_depth')) return;

  const skillId = normalizeSkillId(upgrade.id);
  const treeId = getTreeIdForSkill(skillId);
  if (!treeId) return;

  const selectedTrees = registry.get('selectedTrees') || [];
  const skillTreeLevels = registry.get('skillTreeLevels') || {};

  if (!selectedTrees.includes(treeId)) {
    if (selectedTrees.length < 2) {
      selectedTrees.push(treeId);
    } else {
      return;
    }
  }

  const current = skillTreeLevels[skillId] || skillTreeLevels[upgrade.id] || 0;
  const maxLevel = getMaxLevel(skillId);
  skillTreeLevels[skillId] = Math.min(maxLevel, current + 1);

  registry.set('selectedTrees', selectedTrees);
  registry.set('skillTreeLevels', skillTreeLevels);
}

// 新开一局/重新开始：清空天赋树进度与本局职业分支选择。
// 注意：不要清空 globalCoins / uiMode 等跨局数据。
export function resetSkillTreeProgress(registry) {
  if (!registry?.set) return;

  registry.set('selectedTrees', []);
  registry.set('skillTreeLevels', {});

  // 与天赋树展示相关的 registry key
  registry.set('mainCore', null);
  registry.set('offCore', null);
  registry.set('offFaction', null);
  registry.set('naturePetType', null);
}
