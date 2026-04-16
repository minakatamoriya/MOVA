const BOSS_PROTOTYPE_MAP = Object.freeze({
  boss_mirror_executioner: {
    patternFamily: 'custom',
    currentTemplate: 'formal_mirror_executioner',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含旋转灼镜、定点十字审判与镜锚扇射。'
  },
  boss_toxic_weaver: {
    patternFamily: 'custom',
    currentTemplate: 'formal_toxic_weaver',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含横纵毒线、网格封锁与交点毒卵。'
  },
  boss_tide_eye: {
    patternFamily: 'custom',
    currentTemplate: 'formal_tide_eye',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含外放回收球与黑环坍缩。'
  },
  boss_broodmother: {
    patternFamily: 'custom',
    currentTemplate: 'formal_broodmother',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含巢穴投放、黏液地毯与狂孵波次。'
  },
  boss_thunder_warden: {
    patternFamily: 'custom',
    currentTemplate: 'formal_thunder_warden',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含落雷立柱、电链闭环与雷暴脉冲。'
  },
  boss_tide_devourer: {
    patternFamily: 'custom',
    currentTemplate: 'formal_tide_devourer',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含潮线波墙、漩核滞留与吞星坠点。'
  },
  boss_time_bishop: {
    patternFamily: 'custom',
    currentTemplate: 'formal_time_bishop',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含延时圣裁、错拍判决与旧位追罚。'
  },
  boss_star_royalist: {
    patternFamily: 'custom',
    currentTemplate: 'formal_star_royalist',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含黑白换相、对立星区与双色轰炸。'
  }
});

export function getBossPrototypeConfig(bossId) {
  if (!bossId) return null;
  const entry = BOSS_PROTOTYPE_MAP[bossId];
  return entry ? { ...entry } : null;
}

export function getAllBossPrototypeConfigs() {
  return Object.entries(BOSS_PROTOTYPE_MAP).map(([bossId, config]) => ({
    bossId,
    ...config,
  }));
}