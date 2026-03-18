import { getTreeIdForSkill, getMaxLevel, normalizeSkillId } from './talentTrees';
import { normalizeCoreKey } from './classDefs';

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

  const skillTreeLevels = registry.get('skillTreeLevels') || {};
  const migratedSkillTreeLevels = {};
  let levelMapChanged = false;
  Object.entries(skillTreeLevels).forEach(([skillId, level]) => {
    const normalizedSkillId = normalizeSkillId(skillId);
    if (normalizedSkillId !== skillId) levelMapChanged = true;
    const current = migratedSkillTreeLevels[normalizedSkillId] || 0;
    migratedSkillTreeLevels[normalizedSkillId] = Math.max(current, Number(level) || 0);
  });
  if (levelMapChanged) {
    registry.set('skillTreeLevels', migratedSkillTreeLevels);
    changed = true;
  }

  return changed;
}

// 由升级驱动写入 registry，供技能树 UI 展示 & 双修判断
export function recordSkillTreeProgress(registry, upgrade) {
  if (!registry?.get || !registry?.set) return;
  if (!upgrade || (upgrade.category !== 'build' && upgrade.category !== 'mix' && upgrade.category !== 'third_depth' && upgrade.category !== 'third_dual')) return;

  const skillId = normalizeSkillId(upgrade.id);
  const treeId = getTreeIdForSkill(skillId);
  if (!treeId) return;

  const selectedTrees = registry.get('selectedTrees') || [];
  const skillTreeLevels = registry.get('skillTreeLevels') || {};

  if (!selectedTrees.includes(treeId)) {
    // 现版本：最多展示三套天赋（主职业/副职业/第三套：深度专精或双职业天赋）
    // 第三套天赋的具体内容稍后接入，这里先放开记录容量。
    if (selectedTrees.length < 3) {
      selectedTrees.push(treeId);
    } else {
      // 已经双修两系时，不再接纳第三系
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

  // 与天赋树展示/第三天赋路线判断相关的 registry key
  registry.set('mainCore', null);
  registry.set('offCore', null);
  registry.set('offFaction', null);
  registry.set('thirdSpecType', null);
  registry.set('naturePetType', null);
}
