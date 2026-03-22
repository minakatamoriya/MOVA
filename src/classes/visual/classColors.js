// 职业主色（单一可信来源）
// - 这里的 key 既包含“职业/天赋树 id”，也包含当前运行时会直接使用的主题 key
// - 约定：warrior / paladin / mage / warlock / archer / druid 用于 UI/天赋树

export const CLASS_COLORS = {
  // 用户指定：战士红 / 圣骑金 / 法师普鲁士蓝 / 术士荧光紫 / 德鲁伊淡青 / 猎人深绿
  warrior: 0xff3b2f,
  paladin: 0xffd26a,
  mage: 0x0b3d91, // 普鲁士蓝（偏深，UI/描边更稳）
  warlock: 0xcc00ff, // 荧光紫
  druid: 0x88ffef, // 淡青
  archer: 0x1f5f34 // 深绿（猎人）
};

export function resolveClassColor(key) {
  if (!key) return 0xffffff;
  return CLASS_COLORS[key] ?? 0xffffff;
}
