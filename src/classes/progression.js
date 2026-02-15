import { getTreeIdForSkill, getMaxLevel } from './talentTrees';

// 由升级驱动写入 registry，供技能树 UI 展示 & 双修判断
export function recordSkillTreeProgress(registry, upgrade) {
  if (!registry?.get || !registry?.set) return;
  if (!upgrade || (upgrade.category !== 'build' && upgrade.category !== 'mix' && upgrade.category !== 'third_depth' && upgrade.category !== 'third_dual')) return;

  const treeId = getTreeIdForSkill(upgrade.id);
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

  const current = skillTreeLevels[upgrade.id] || 0;
  const maxLevel = getMaxLevel(upgrade.id);
  skillTreeLevels[upgrade.id] = Math.min(maxLevel, current + 1);

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
