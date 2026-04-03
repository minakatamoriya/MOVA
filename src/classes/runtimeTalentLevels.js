import { getMaxLevel, normalizeSkillId } from './talentTrees';

const RUNTIME_LEVEL_BY_PLAYER_RANK = {
  mage_frostbite: [0, 3],
  mage_cold_focus: [0, 3],
  mage_ice_veins: [0, 3],
  mage_deep_freeze: [0, 3],
  paladin_stun: [0, 3],
  warlock_spread: [0, 3],
  warlock_corrode: [0, 3],
  arcane_circle: [0, 2, 3],
  arcane_circle_range: [0, 3],
  arcane_fire_circle: [0, 3],
  arcane_frost_circle: [0, 3],
  arcane_resonance_mark: [0, 3],
  ranger_snaretrap: [0, 2, 3],
  ranger_huntmark: [0, 3],
  ranger_blasttrap: [0, 3],
  ranger_pack_hunter: [0, 3],
  unyielding_battlecry: [0, 3],
  unyielding_hamstring: [0, 3],
  unyielding_sunder: [0, 3],
  unyielding_standfast: [0, 2, 3],
  unyielding_executioner: [0, 3],
  summon_necrotic_vitality: [0, 3],
  summon_mage_empower: [0, 2, 3],
  summon_guard_bulwark: [0, 3],
  guardian_block: [0, 2, 3],
  guardian_counter: [0, 3],
  guardian_sacred_seal: [0, 2, 3],
  guardian_holy_rebuke: [0, 2, 3],
  guardian_light_fortress: [0, 3]
  ,nature_bear_guard: [0, 2, 3]
  ,nature_hawk_huntmark: [0, 2, 3]
  ,nature_treant_bloom: [0, 2, 3]
};

function clampPlayerRank(skillId, playerRank) {
  const normalizedSkillId = normalizeSkillId(skillId);
  const maxLevel = Math.max(0, Number(getMaxLevel(normalizedSkillId) || 0));
  return Math.max(0, Math.min(maxLevel, Math.round(Number(playerRank) || 0)));
}

export function getPlayerSkillRank(skillTreeLevelsOrRegistry, skillId) {
  const normalizedSkillId = normalizeSkillId(skillId);
  const skillTreeLevels = typeof skillTreeLevelsOrRegistry?.get === 'function'
    ? (skillTreeLevelsOrRegistry.get('skillTreeLevels') || {})
    : (skillTreeLevelsOrRegistry || {});
  const rawRank = skillTreeLevels[normalizedSkillId] || skillTreeLevels[skillId] || 0;
  return clampPlayerRank(normalizedSkillId, rawRank);
}

export function getRuntimeTalentLevelForRank(skillId, playerRank) {
  const normalizedSkillId = normalizeSkillId(skillId);
  const clampedRank = clampPlayerRank(normalizedSkillId, playerRank);
  const mapping = RUNTIME_LEVEL_BY_PLAYER_RANK[normalizedSkillId];
  if (!Array.isArray(mapping) || mapping.length === 0) return clampedRank;
  const mappedLevel = mapping[Math.min(clampedRank, mapping.length - 1)];
  return Math.max(0, Math.round(Number(mappedLevel) || 0));
}

export function getRuntimeTalentLevel(skillTreeLevelsOrRegistry, skillId) {
  return getRuntimeTalentLevelForRank(skillId, getPlayerSkillRank(skillTreeLevelsOrRegistry, skillId));
}
