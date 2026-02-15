// 主职业决定普攻形态；副职业只叠加“强化效果”（尽量复用同一种弹体/少量效果标记）

import { ACCENT_TOKEN_COLORS, getBaseColorForCoreKey } from '../visual/basicSkillColors';

export function getBasicAttackEnhancements(mainCoreKey, offCoreKey) {
  if (!mainCoreKey || !offCoreKey) return null;
  if (mainCoreKey === offCoreKey) return null;

  // 用于碰撞系统统一处理的效果标记
  const enh = {
    // 视觉：默认用副职业的主色作为边缘/尾迹（满足“一眼认主，细看见副”的层级）
    accentKey: offCoreKey,
    accent: offCoreKey,
    shieldOnHit: 0, // 累计护盾进度（1.0=+1层护盾）
    explodeOnHit: 0, // 额外爆炸伤害倍率（相对本次命中伤害）
    markOnHit: 0, // 叠层印记（每次命中 +n 层）
    petFocusOnHit: false,
    bounce: 0, // 弹射次数（主要给月火术）
    chargeSplit: false, // “蓄力后分裂”的手感（实现为周期性强化弹）
    pierce: false // 穿透（实现为允许额外命中次数）
  };

  // 新版本：副职业不再提供“联动命中特效”，仅用于视觉层级（副色描边/尾迹）。
  return enh;
}

export function getOffCorePassive(mainCoreKey, offCoreKey) {
  return { fireRateMult: 1 };
}

export function applyEnhancementsToBullet(bullet, enhancements, colorScheme = null) {
  if (!bullet || !enhancements) return;

  bullet.basicEnh = {
    accent: enhancements.accent,
    accentKey: enhancements.accentKey || enhancements.accent || null,
    shieldOnHit: enhancements.shieldOnHit || 0,
    explodeOnHit: enhancements.explodeOnHit || 0,
    markOnHit: enhancements.markOnHit || 0,
    petFocusOnHit: !!enhancements.petFocusOnHit,
    bounce: enhancements.bounce || 0,
    chargeSplit: !!enhancements.chargeSplit,
    pierce: !!enhancements.pierce
  };

  // 视觉：尽量不做新资源，仅改描边/颜色提示
  if (typeof bullet.setStrokeStyle === 'function') {
    const accentKey = enhancements.accentKey || enhancements.accent;
    const schemeAccent = colorScheme?.accentColor;

    let resolvedAccent = schemeAccent;
    if (resolvedAccent == null) {
      // 优先：把副职业 coreKey 当作色源
      resolvedAccent = getBaseColorForCoreKey(accentKey);

      // 兼容：旧 token
      if (accentKey && ACCENT_TOKEN_COLORS[accentKey] != null) {
        resolvedAccent = ACCENT_TOKEN_COLORS[accentKey];
      }
    }

    if (typeof resolvedAccent === 'number') {
      bullet.setStrokeStyle(2, resolvedAccent, 1);
      bullet.visualAccentColor = resolvedAccent;
    }
  }
}
