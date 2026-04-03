export const MAGE_CORE_FROST_TRIGGER_STACKS = 5;

export const MAGE_SHATTER_TRIGGER_STACKS_BY_LEVEL = [5, 3, 3, 3];
export const MAGE_SHATTER_RADIUS_BY_LEVEL = [92, 120, 150, 185];
export const MAGE_SHATTER_DAMAGE_SCALE_BY_LEVEL = [0.45, 0.7, 1.0, 1.35];
export const MAGE_SHATTER_SPREAD_STACKS_BY_LEVEL = [1, 1, 1, 2];

export const MAGE_CORE_DESC = `攻击变为单发冰弹，命中叠加寒霜，叠满 ${MAGE_CORE_FROST_TRIGGER_STACKS} 层爆炸并传染。`;
export const MAGE_DEEP_FREEZE_DESC = '碎冰后额外冻结主目标 1.7 秒。';
export const MAGE_SHATTER_DESC = 'Lv1 将寒霜触发层数由 5 降至 3，并把碎冰半径提升到 120、伤害提升到 70%；Lv2 半径提升到 150、伤害提升到 100%；Lv3 半径提升到 185、伤害提升到 135%，传染提升为 2 层寒霜。';
export const MAGE_SHATTER_LEVEL_DESCS = [
  '寒霜触发层数 5 -> 3；碎冰半径 92 -> 120，伤害 45% -> 70%，传染维持 1 层寒霜。',
  '碎冰半径 120 -> 150，伤害 70% -> 100%。',
  '碎冰半径 150 -> 185，伤害 100% -> 135%，传染层数 1 -> 2。'
];

export function getMageShatterTriggerStacks(level = 0) {
  const normalizedLevel = Math.max(0, Math.min(3, Number(level) || 0));
  return MAGE_SHATTER_TRIGGER_STACKS_BY_LEVEL[normalizedLevel] || MAGE_CORE_FROST_TRIGGER_STACKS;
}

export function getMageShatterRadius(level = 0) {
  const normalizedLevel = Math.max(0, Math.min(3, Number(level) || 0));
  return MAGE_SHATTER_RADIUS_BY_LEVEL[normalizedLevel] || MAGE_SHATTER_RADIUS_BY_LEVEL[0];
}

export function getMageShatterDamageScale(level = 0) {
  const normalizedLevel = Math.max(0, Math.min(3, Number(level) || 0));
  return MAGE_SHATTER_DAMAGE_SCALE_BY_LEVEL[normalizedLevel] || MAGE_SHATTER_DAMAGE_SCALE_BY_LEVEL[0];
}

export function getMageShatterSpreadStacks(level = 0) {
  const normalizedLevel = Math.max(0, Math.min(3, Number(level) || 0));
  return MAGE_SHATTER_SPREAD_STACKS_BY_LEVEL[normalizedLevel] || MAGE_SHATTER_SPREAD_STACKS_BY_LEVEL[0];
}