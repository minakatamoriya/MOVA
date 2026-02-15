// 职业主色（单一可信来源）
// - 这里的 key 既包含“职业/天赋树 id”，也包含“coreKey”（技能系统沿用的 key）
// - 约定：
//   warrior / paladin / mage / warlock / archer / druid 用于 UI/天赋树
//   scatter / drone 是历史 coreKey（分别对应 archer/hunter 与 druid）

export const CLASS_COLORS = {
  // 用户指定：战士红 / 圣骑金 / 法师普鲁士蓝 / 术士荧光紫 / 德鲁伊淡青 / 猎人深绿
  warrior: 0xff3b2f,
  paladin: 0xffd26a,
  mage: 0x0b3d91, // 普鲁士蓝（偏深，UI/描边更稳）
  warlock: 0xcc00ff, // 荧光紫
  druid: 0x88ffef, // 淡青
  archer: 0x1f5f34, // 深绿（猎人）

  // coreKey 兼容映射
  scatter: 0x1f5f34,
  drone: 0x88ffef
};

export function resolveClassColor(key) {
  if (!key) return 0xffffff;
  return CLASS_COLORS[key] ?? 0xffffff;
}
