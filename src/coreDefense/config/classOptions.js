export const CORE_DEFENSE_CLASS_OPTIONS = [
  { id: 'warrior', name: '战士', color: 0xf97316, attackRange: 140, attackDamage: 26, fireIntervalMs: 220, moveSpeed: 360 },
  { id: 'paladin', name: '圣骑士', color: 0xfacc15, attackRange: 150, attackDamage: 22, fireIntervalMs: 240, moveSpeed: 340 },
  { id: 'archer', name: '猎人', color: 0x22c55e, attackRange: 260, attackDamage: 20, fireIntervalMs: 180, moveSpeed: 380 },
  { id: 'mage', name: '法师', color: 0x38bdf8, attackRange: 250, attackDamage: 24, fireIntervalMs: 230, moveSpeed: 350 },
  { id: 'warlock', name: '术士', color: 0xa855f7, attackRange: 235, attackDamage: 18, fireIntervalMs: 170, moveSpeed: 360 },
  { id: 'druid', name: '德鲁伊', color: 0x84cc16, attackRange: 220, attackDamage: 21, fireIntervalMs: 210, moveSpeed: 355 },
];

export function getCoreDefenseClassOption(classId) {
  return CORE_DEFENSE_CLASS_OPTIONS.find((item) => item.id === classId) || CORE_DEFENSE_CLASS_OPTIONS[0];
}
