// 基础技能配色（主职业=核心色块；副职业=边缘/脉络/尾迹）

import { CLASS_COLORS, resolveClassColor } from './classColors';

function clamp01(t) {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

export function lerpColor(a, b, t) {
  const tt = clamp01(t);
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;

  const rr = Math.round(ar + (br - ar) * tt);
  const rg = Math.round(ag + (bg - ag) * tt);
  const rb = Math.round(ab + (bb - ab) * tt);
  return (rr << 16) | (rg << 8) | rb;
}

export const CORE_BASE_COLORS = {
  // 向后兼容：旧名字保留，但真正的定义在 classColors.js
  ...CLASS_COLORS
};

// 向后兼容：旧的“accent token”到颜色（尽量少用；推荐直接用 offCoreKey）
export const ACCENT_TOKEN_COLORS = {
  gold: CORE_BASE_COLORS.paladin,
  arcane: CORE_BASE_COLORS.mage,
  nature: CORE_BASE_COLORS.scatter,
  shadow: CORE_BASE_COLORS.warlock,
  red: CORE_BASE_COLORS.warrior,
  feather: 0xe6fff6
};

export function getBaseColorForCoreKey(coreKey) {
  if (!coreKey) return 0xffffff;
  return resolveClassColor(coreKey);
}

export function getBasicSkillColorScheme(mainCoreKey, offCoreKey) {
  const coreColor = getBaseColorForCoreKey(mainCoreKey);

  // 默认：无副职业时，accent 做成“同色系更亮的边缘”
  let accentColor = lerpColor(coreColor, 0xffffff, 0.28);
  if (offCoreKey) {
    accentColor = getBaseColorForCoreKey(offCoreKey);
  }

  // 用于内核/高光：让核心更“亮且干净”一点
  const coreBright = lerpColor(coreColor, 0xffffff, 0.42);

  // 用于光晕：稍微偏亮，但仍以主色为主
  const glowColor = lerpColor(coreColor, 0xffffff, 0.18);

  return {
    coreColor,
    coreBright,
    accentColor,
    glowColor,
    trailColor: accentColor
  };
}
