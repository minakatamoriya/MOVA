const BOSS_PROTOTYPE_MAP = Object.freeze({
  boss_mirror_executioner: {
    patternFamily: 'custom',
    currentTemplate: 'formal_mirror_executioner',
    implementationStatus: 'implemented',
    notes: '已切到独立 Boss 类，当前包含旋转灼镜、定点十字审判与镜锚扇射。'
  },
  boss_toxic_weaver: {
    patternFamily: 'showcase',
    currentTemplate: 'prototype_showcase_ground_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前先借地面预警与延迟爆发模板，后续替换成真正的横纵毒线。'
  },
  boss_tide_eye: {
    patternFamily: 'stage2',
    currentTemplate: 'prototype_b_ranged_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前先用远程节奏模板占位，后续替换成外放回收球状态机。'
  },
  boss_broodmother: {
    patternFamily: 'stage3',
    currentTemplate: 'prototype_c_summon_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前最接近正式方向，后续重点把召唤改为巢穴体系。'
  },
  boss_thunder_warden: {
    patternFamily: 'stage2',
    currentTemplate: 'prototype_b_ranged_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前先借远程模板承载节奏，后续换成雷柱落点、电链和脉冲。'
  },
  boss_tide_devourer: {
    patternFamily: 'showcase',
    currentTemplate: 'prototype_showcase_ground_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前先借地面调度模板占位，后续换成潮线波墙、滞留漩涡与轨道陨核。'
  },
  boss_time_bishop: {
    patternFamily: 'showcase',
    currentTemplate: 'prototype_showcase_ground_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前先借延迟地面预警模板，后续扩成多计时判决系统。'
  },
  boss_star_royalist: {
    patternFamily: 'stage2',
    currentTemplate: 'prototype_b_ranged_pattern',
    implementationStatus: 'prototype-bound',
    notes: '当前先借远程调度模板承载星图前的轰炸节奏。'
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