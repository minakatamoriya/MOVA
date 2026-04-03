import { getTalentOfferDescription } from './talentNodeText';

export function getUpgradeOfferPresentation(option, currentLevel = 0, maxLevel = 1) {
  if (!option?.id) return option;

  const nextLevel = Math.min(maxLevel, Math.max(1, currentLevel + 1));
  const levelDesc = getTalentOfferDescription(option.id, nextLevel, option.desc);

  return {
    ...option,
    offerCurrentLevel: currentLevel,
    offerLevel: nextLevel,
    offerMaxLevel: maxLevel,
    offerLevelLabel: maxLevel > 1 ? `Lv.${nextLevel}/${maxLevel}` : '',
    offerDesc: levelDesc || option.desc
  };
}