const LEVEL_DESC_BY_ID = {
  archer_range: [
    '基础射击射程提升 +12%。',
    '基础射击射程提升 +24%。',
    '基础射击射程提升 +36%。'
  ],
  archer_scatter: [
    '基础射击变为 3 列散射，中心列始终锁定目标。',
    '基础射击变为 5 列散射，中心列始终锁定目标。',
    '基础射击变为 7 列散射，中心列始终锁定目标。'
  ],
  archer_nimble_evade: [
    '生命低于30%时自动触发：闪避率 +40%，持续3秒，冷却30秒。',
    '生命低于30%时自动触发：闪避率 +60%，持续3秒，冷却30秒。',
    '生命低于30%时自动触发：闪避率 +80%，持续3秒，冷却30秒。'
  ],
  archer_evade_mastery: [
    '强化灵巧回避：持续时间提高至 5 秒。',
    '强化灵巧回避：持续时间提高至 8 秒。',
    '强化灵巧回避：持续时间提高至 10 秒。'
  ],
  druid_nourish: [
    '生命低于30%时自动触发：在 15 秒内缓慢回复 30% 生命，冷却30秒。',
    '生命低于30%时自动触发：在 10 秒内缓慢回复 30% 生命，冷却30秒。',
    '生命低于30%时自动触发：在 5 秒内缓慢回复 30% 生命，冷却30秒。'
  ],
  druid_nourish_growth: [
    '强化自然滋养：总回复量额外提高 50%。',
    '强化自然滋养：总回复量额外提高 80%。',
    '强化自然滋养：总回复量额外提高 100%。'
  ],
  warrior_blood_conversion: [
    '生命低于30%时自动触发：攻击伤害转化为 100% 吸血，持续 5 秒，冷却30秒。',
    '生命低于30%时自动触发：攻击伤害转化为 100% 吸血，持续 10 秒，冷却30秒。',
    '生命低于30%时自动触发：攻击伤害转化为 100% 吸血，持续 15 秒，冷却30秒。'
  ],
  warrior_bloodlust_mastery: [
    '强化猩红嗜血：攻击伤害转化提高至 120%。',
    '强化猩红嗜血：攻击伤害转化提高至 150%。',
    '强化猩红嗜血：攻击伤害转化提高至 200%。'
  ],
  mage_arcane_perception: [
    '奥术射线索敌范围额外提高 45。',
    '奥术射线索敌范围额外提高 90。',
    '奥术射线索敌范围额外提高 135。'
  ],
  mage_energy_focus: [
    '奥术射线伤害 +10%，光束更粗更亮。',
    '奥术射线伤害 +20%，光束更粗更亮。',
    '奥术射线伤害 +30%，光束更粗更亮。'
  ],
  mage_frost_nova: [
    '生命低于30%时自动触发：冻结周围敌人 3 秒，冷却30秒。',
    '生命低于30%时自动触发：冻结周围敌人 5 秒，冷却30秒。',
    '生命低于30%时自动触发：冻结周围敌人 10 秒，冷却30秒。'
  ],
  mage_frost_domain: [
    '强化冰霜新星：冻结范围扩大至 300。',
    '强化冰霜新星：冻结范围扩大至 380。',
    '强化冰霜新星：冻结范围扩大至 480。'
  ],
  paladin_stun: [
    '锤击有 10% 概率使敌人眩晕。',
    '锤击有 20% 概率使敌人眩晕。',
    '锤击有 30% 概率使敌人眩晕。'
  ],
  paladin_divine_shelter: [
    '生命低于30%时自动触发：获得 40% 减伤，持续5秒，冷却30秒。',
    '生命低于30%时自动触发：获得 60% 减伤，持续5秒，冷却30秒。',
    '生命低于30%时自动触发：获得 80% 减伤，持续5秒，冷却30秒。'
  ],
  paladin_shelter_extension: [
    '强化神圣庇护：持续时间提高至 8 秒。',
    '强化神圣庇护：持续时间提高至 10 秒。',
    '强化神圣庇护：持续时间提高至 12 秒。'
  ],
  warlock_infernal_contract: [
    '强化炼狱魔火：生命消耗降低至 10%。',
    '强化炼狱魔火：生命消耗降低至 5%。',
    '强化炼狱魔火：生命消耗降低至 0%。'
  ],
  curse_skeleton_guard: [
    '召唤近战骷髅卫士，上限提升至 1 名。',
    '召唤近战骷髅卫士，上限提升至 3 名。',
    '召唤近战骷髅卫士，上限提升至 5 名。'
  ],
  curse_skeleton_mage: [
    '召唤远程骷髅法师，上限提升至 1 名。',
    '召唤远程骷髅法师，上限提升至 3 名。',
    '召唤远程骷髅法师，上限提升至 5 名。'
  ],
  nature_bear_vitality: [
    '熊灵生命值提高 +25%。',
    '熊灵生命值提高 +50%。',
    '熊灵生命值提高 +75%。'
  ],
  nature_hawk_swiftness: [
    '战鹰攻击间隔缩短 12%。',
    '战鹰攻击间隔缩短 24%。',
    '战鹰攻击间隔缩短 36%。'
  ],
  nature_treant_bloom: [
    '树精单次治疗量提高 +2。',
    '树精单次治疗量提高 +4。',
    '树精单次治疗量提高 +6。'
  ]
};

export function getUpgradeOfferPresentation(option, currentLevel = 0, maxLevel = 1) {
  if (!option?.id) return option;

  const nextLevel = Math.min(maxLevel, Math.max(1, currentLevel + 1));
  const levelDesc = LEVEL_DESC_BY_ID[option.id]?.[nextLevel - 1] || option.desc;

  return {
    ...option,
    offerCurrentLevel: currentLevel,
    offerLevel: nextLevel,
    offerMaxLevel: maxLevel,
    offerLevelLabel: maxLevel > 1 ? `Lv.${nextLevel}/${maxLevel}` : '',
    offerDesc: levelDesc || option.desc
  };
}