import {
  MAGE_CORE_DESC,
  MAGE_DEEP_FREEZE_DESC,
  MAGE_SHATTER_DESC,
  MAGE_SHATTER_LEVEL_DESCS
} from './mageFrostData';

export const TALENT_SUMMARY_BY_ID = {
  archer_core: '解锁箭矢连射。',
  archer_range: '基础射击射程直接提升到 +36%。',
  archer_volley: '基础射击初始为3列；1级变为5列，2级变为7列，3级变为9列，并逐级强化锁定与弹道收束。',
  archer_rapidfire: '基础射击有概率立刻追加一轮追射。',
  archer_arrowrain: '每 5 秒蓄满一次坠落箭雨，额外压制目标区域。',
  archer_nimble_evade: '生命低于30%时自动触发：1级闪避率 +60%，持续8秒；2级闪避率 +80%，持续10秒；冷却30秒。',

  druid_core: '解锁星落（定位敌方，星星下落造成范围伤害）。',
  druid_meteor_shower: '强化星落的锁定与落点覆盖。1/2/3级分别将索敌范围提高到 350/395/440，爆炸半径提高到 80/92/106。',
  druid_meteor: '强化单次星落质量。1/2/3级分别使星落伤害提高 15%/30%/45%，下坠时间压缩到 235/210/185 毫秒。',
  druid_starfire: '星落命中后有概率在原地引发一次追击星火。1/2/3级概率与伤害分别为 20%/45%、30%/60%、40%/75%（不连锁）。',
  druid_nourish: '生命低于30%时自动触发：1级在10秒内回复54%生命；2级在5秒内回复60%生命；冷却30秒。',

  warrior_core: '攻击变为近战月牙斩，前方大范围挥斩敌人。',
  warrior_range: '强化月牙斩范围。1/2/3级分别提升到 280/340/420，索敌范围与攻击范围保持一致。',
  warrior_swordqi: '月牙斩角度从 180 度扩展到 360 度。',
  warrior_damage: '直接提高战士基础技能伤害。1/2/3级分别提高 12%/24%/40%。',
  warrior_blood_conversion: '生命低于30%时自动触发：1级攻击伤害转化为150%吸血，持续10秒；2级转化为200%吸血，持续15秒；冷却30秒。',

  mage_core: MAGE_CORE_DESC,
  mage_frostbite: '冰弹自带强减速，并在命中已冻结或已挂寒霜目标时额外补 1 层寒霜。',
  mage_cold_focus: '冰弹会优先追猎已冻结或高寒霜目标，并额外提高少量索敌范围。',
  mage_ice_veins: '强化冰弹本体，并在命中关键冰目标时分裂次级寒流袭向附近敌人。',
  mage_deep_freeze: MAGE_DEEP_FREEZE_DESC,
  mage_shatter: MAGE_SHATTER_DESC,
  mage_frost_nova: '生命低于30%时自动触发冰霜新星。1级冻结 5 秒、范围 380；2级冻结 10 秒、范围 480；冷却30秒。',

  paladin_core: '护盾脉冲清弹并反击。',
  paladin_pierce: '锤击范围与伤害提高。',
  paladin_repulse: '锤击命中附带明显击退。',
  paladin_triple: '每 5 秒，下一次锤击额外追加 2 次余震落点。',
  paladin_stun: '锤击有 30% 概率使敌人眩晕。',
  paladin_divine_shelter: '生命低于30%时自动触发：1级获得 60% 减伤并持续 8 秒；2级获得 80% 减伤并持续 12 秒；冷却30秒。',
  paladin_pulse: '围绕自身展开定时神圣脉冲，并在后续升级中继续扩大范围与伤害。',

  warlock_core: '解锁基础技能：腐疫沼弹（朝最近目标投出腐疫弹，落地生成持续 4 秒的毒沼）。',
  warlock_toxicity: '剧毒 debuff 最大层数 +1（可叠加）。',
  warlock_corrode: '毒沼持续时间额外 +3 秒。',
  warlock_spread: '毒沼范围 +60%。',
  warlock_infernal: '生命首次跌破30%时自动触发：1级持续5秒，50%伤害吸血，并可转化20%最大生命护盾；2级持续10秒，100%吸血，并可转化30%最大生命护盾；冷却30秒。',
  warlock_malady: '显著提高毒沼与中毒目标的持续伤害强度。',

  off_arcane: '作为副职业，立即获得基础奥术炮台；首座炮台会快速完成一次开场射击。',
  arcane_circle: '把基础奥术炮台强化到中后期压场档位。',
  arcane_circle_range: '大幅提升炮台索敌范围。',
  arcane_fire_circle: '大幅提高炮台单次激光伤害。',
  arcane_frost_circle: '大幅提高炮台持续时间与驻场能力。',
  arcane_resonance_mark: '炮台激光命中会附加强力易伤。',
  arcane_flowcasting: '缩短布置循环，并提升同时存在的炮台数量。',

  off_ranger: '作为副职业，立即获得基础诱饵假人；首个假人落地时会立刻触发一次牵引脉冲。',
  ranger_snaretrap: '把基础诱饵假人强化到稳定控场档位。',
  ranger_huntmark: '被假人牵制的敌人会被标记，承受你更多伤害。',
  ranger_spiketrap: '假人周围形成束缚力场，持续减速并附带持续压制。',
  ranger_blasttrap: '显著强化假人结束时的范围爆炸伤害。',
  ranger_trapcraft: '强化假人持续时间、冷却与同时存在数量。',
  ranger_pack_hunter: '强化你对被标记或被牵制目标的暴击收益。',

  off_unyielding: '作为副职业，立即获得基础血怒，并立刻爆发一次战吼脉冲，震退并迟滞近身敌人。',
  unyielding_bloodrage: '把基础血怒强化到终局档位。',
  unyielding_battlecry: '受伤后短时间大幅提高伤害。',
  unyielding_hamstring: '近距离命中使敌人显著减速。',
  unyielding_sunder: '持续命中同一目标时显著提高对其伤害。',
  unyielding_standfast: '近距离时获得更高贴身减伤。',
  unyielding_executioner: '对低血敌人造成高额额外伤害。',

  off_summon: '作为副职业，立即获得 1 名骷髅卫士与 1 名骷髅法师，并解锁召唤系天赋池。',
  summon_necrotic_vitality: '提高召唤物生命，并在亡灵阵亡时为其他亡灵回补生命。',
  summon_skeleton_guard: '扩充骷髅卫士军势，分两段提高前排规模。',
  summon_skeleton_mage: '扩充骷髅法师军势，分两段提高后排规模。',
  summon_mage_empower: '分两段强化骷髅法师输出与节奏。',
  summon_guard_bulwark: '大幅强化骷髅卫士生存与拦截能力。',
  summon_ember_echo: '召唤物死亡后为你提供短时间增伤，并在后续升级中进入滚雪球阈值。',

  off_guardian: '作为副职业，立即获得基础格挡与圣印，并解锁守护系天赋池。',
  guardian_block: '把基础格挡强化到终局档位。',
  guardian_armor: '提高固定减伤，并在受击后周期性生成护甲屏障。',
  guardian_counter: '格挡成功后触发强力反击。',
  guardian_sacred_seal: '把基础圣印强化到终局档位。',
  guardian_holy_rebuke: '消耗圣印触发更强的范围冲击。',
  guardian_light_fortress: '低血时高效把圣印转为护盾。',

  off_nature: '作为副职业，立即获得 1 只熊灵，并解锁自然伙伴天赋池。',
  druid_pet_bear: '把基础熊灵提升到稳定前排档位，出场时会咆哮震慑周围敌人。',
  druid_pet_hawk: '解锁战鹰，并让其基础攻击自带轻度猎印。',
  druid_pet_treant: '解锁树精，并在出场时立刻提供一次萌芽治疗与护盾。',
  nature_bear_guard: '强化熊灵承担伤害与拦截能力。',
  nature_hawk_huntmark: '强化战鹰标记与对 Boss 增伤。',
  nature_treant_bloom: '强化树精治疗与护盾。'
};

export const TALENT_LEVEL_DESC_BY_ID = {
  archer_range: [
    '基础射击射程直接提升到 +36%。'
  ],
  archer_volley: [
    '箭列数 3 -> 5，形成第一段清屏质变。',
    '箭列数 5 -> 7，进一步收束散射角并强化锁定。',
    '箭列数 7 -> 9，形成后期箭幕。'
  ],
  archer_rapidfire: [
    '基础射击有概率立刻追加一轮追射。'
  ],
  archer_arrowrain: [
    '每 5 秒蓄满一次坠落箭雨，对目标区域进行额外压制。'
  ],
  archer_nimble_evade: [
    '低血自动闪避提升到 60%，持续 8 秒。',
    '低血自动闪避提升到 80%，持续 10 秒。'
  ],
  druid_nourish: [
    '在 10 秒内缓慢回复 54% 生命。',
    '在 5 秒内缓慢回复 60% 生命。'
  ],
  druid_meteor_shower: [
    '星落索敌范围 310 -> 350，爆炸半径 70 -> 80。',
    '星落索敌范围 350 -> 395，爆炸半径 80 -> 92。',
    '星落索敌范围 395 -> 440，爆炸半径 92 -> 106。'
  ],
  druid_meteor: [
    '星落伤害 100% -> 115%，下坠时间 260ms -> 235ms。',
    '星落伤害 115% -> 130%，下坠时间 235ms -> 210ms。',
    '星落伤害 130% -> 145%，下坠时间 210ms -> 185ms。'
  ],
  druid_starfire: [
    '解锁追击星火：20% 概率在原地追加 45% 伤害。',
    '追击星火触发率 20% -> 30%，伤害 45% -> 60%。',
    '追击星火触发率 30% -> 40%，伤害 60% -> 75%。'
  ],
  warrior_range: [
    '月牙斩范围提高到 280，索敌范围同步提高。',
    '月牙斩范围提高到 340，索敌范围同步提高。',
    '月牙斩范围提高到 420，索敌范围同步提高。'
  ],
  warrior_swordqi: [
    '月牙斩角度从 180 度扩展到 360 度。'
  ],
  warrior_damage: [
    '基础技能伤害提高 0% -> 12%。',
    '基础技能伤害提高 12% -> 24%。',
    '基础技能伤害提高 24% -> 40%。'
  ],
  warrior_blood_conversion: [
    '低血时获得 150% 吸血，持续 10 秒。',
    '低血时获得 200% 吸血，持续 15 秒。'
  ],
  mage_frostbite: [
    '冰弹减速直接提升到 48%，持续 2.7 秒；命中已冻结或已挂寒霜目标时额外补 1 层寒霜。'
  ],
  mage_cold_focus: [
    '冰弹会优先追猎已冻结或高寒霜目标，并额外获得 +90 索敌范围。'
  ],
  mage_ice_veins: [
    '冰弹伤害加成直接提升到 30%；命中高寒霜或冻结目标时，会分裂一道次级寒流袭向附近敌人。'
  ],
  mage_deep_freeze: [
    '额外冻结时长直接提升到 1.7 秒。'
  ],
  mage_shatter: MAGE_SHATTER_LEVEL_DESCS,
  mage_frost_nova: [
    '冰霜新星冻结 5 秒，范围直接提升到 380。',
    '冰霜新星冻结 10 秒，范围直接提升到 480。'
  ],
  paladin_stun: [
    '锤击眩晕率直接提升到 30%。'
  ],
  paladin_divine_shelter: [
    '低血时获得 60% 减伤，持续 8 秒。',
    '低血时获得 80% 减伤，持续 12 秒。'
  ],
  paladin_pulse: [
    '围绕自身展开定时神圣脉冲。',
    '神圣脉冲的范围与伤害进一步提高。'
  ],
  warlock_toxicity: [
    '剧毒最大层数 0 -> 1。',
    '剧毒最大层数 1 -> 2。',
    '剧毒最大层数 2 -> 3。'
  ],
  warlock_malady: [
    '显著提高毒圈与中毒目标的持续伤害强度。'
  ],
  warlock_corrode: [
    '毒圈持续时间直接额外增加 3 秒。'
  ],
  warlock_spread: [
    '毒圈范围加成直接提升到 60%。'
  ],
  warlock_infernal: [
    '持续 5 秒，50% 伤害吸血，并可转化 20% 最大生命护盾。',
    '持续 10 秒，100% 伤害吸血，并可转化 30% 最大生命护盾。'
  ],
  summon_skeleton_guard: [
    '骷髅卫士总上限 1 -> 3。',
    '骷髅卫士总上限 3 -> 5。'
  ],
  summon_skeleton_mage: [
    '骷髅法师总上限 1 -> 3。',
    '骷髅法师总上限 3 -> 5。'
  ],
  arcane_circle: [
    '法阵增伤直接提升到 16%，部署间隔直接提升到 8.6 秒，开火间隔直接提升到 2.56 秒。',
    '法阵增伤进一步提升到 24%，部署间隔进一步提升到 7.9 秒，开火间隔进一步提升到 2.34 秒。'
  ],
  arcane_circle_range: [
    '炮台索敌范围 +0 -> +80。',
    '炮台索敌范围 +80 -> +160。',
    '炮台索敌范围 +160 -> +240。'
  ],
  arcane_fire_circle: [
    '炮台激光额外伤害系数 0% -> 24%。',
    '炮台激光额外伤害系数 24% -> 48%。',
    '炮台激光额外伤害系数 48% -> 72%。'
  ],
  arcane_frost_circle: [
    '炮台驻场时间 15.0秒 -> 16.8秒。',
    '炮台驻场时间 16.8秒 -> 18.6秒。',
    '炮台驻场时间 18.6秒 -> 20.4秒。'
  ],
  arcane_resonance_mark: [
    '易伤倍率 0% -> 6%。',
    '易伤倍率 6% -> 12%。',
    '易伤倍率 12% -> 18%。'
  ],
  arcane_flowcasting: [
    '炮台布置间隔 10.0秒 -> 9.1秒。',
    '并存炮台数量 1 -> 2，布置间隔 9.1秒 -> 8.2秒。',
    '并存炮台数量 2 -> 3，布置间隔 8.2秒 -> 7.3秒。'
  ],
  ranger_snaretrap: [
    '牵引半径直接提升到 216，箭矢伤害系数直接提升到 32%，定身直接提升到 380 毫秒。',
    '牵引半径进一步提升到 238，箭矢伤害系数进一步提升到 42%，定身进一步提升到 520 毫秒。'
  ],
  ranger_huntmark: [
    '猎印承伤 0% -> 10%。',
    '猎印承伤 10% -> 16%。',
    '猎印承伤 16% -> 22%。'
  ],
  ranger_spiketrap: [
    '爆炸追加伤害 0% -> 18%，持续伤害系数 0% -> 8%，持续时间 0秒 -> 2.2秒。',
    '爆炸追加伤害 18% -> 26%，持续伤害系数 8% -> 12%，持续时间 2.2秒 -> 3.0秒。'
  ],
  ranger_blasttrap: [
    '结束爆炸伤害 0% -> 78%。',
    '结束爆炸伤害 78% -> 102%。',
    '结束爆炸伤害 102% -> 135%。'
  ],
  ranger_trapcraft: [
    '假人布置间隔 10.0秒 -> 8.8秒。',
    '并存假人数量 1 -> 2，布置间隔 8.8秒 -> 7.6秒。'
  ],
  ranger_pack_hunter: [
    '对猎印目标的暴击率 0% -> 6%，暴击伤害 0% -> 12%。',
    '对猎印目标的暴击率 6% -> 10%，暴击伤害 12% -> 20%。',
    '对猎印目标的暴击率 10% -> 14%，暴击伤害 20% -> 30%。'
  ],
  unyielding_bloodrage: [
    '基础血怒已解锁。',
    '每损失10%生命的增伤直接提升到 4%。'
  ],
  unyielding_battlecry: [
    '战吼增伤 0% -> 10%。',
    '战吼增伤 10% -> 20%。',
    '战吼增伤 20% -> 30%。'
  ],
  unyielding_hamstring: [
    '断筋减速 0% -> 15%，持续 0秒 -> 1.5秒。',
    '断筋减速 15% -> 25%，持续维持 1.5 秒。',
    '断筋减速 25% -> 35%，持续 1.5秒 -> 2秒。'
  ],
  unyielding_sunder: [
    '破甲承伤 0% -> 6%。',
    '破甲承伤 6% -> 12%。',
    '破甲承伤 12% -> 18%。'
  ],
  unyielding_standfast: [
    '贴身减伤直接提升到 12%。',
    '贴身减伤直接提升到 18%。'
  ],
  unyielding_executioner: [
    '处决增伤 0% -> 12%。',
    '处决增伤 12% -> 24%。',
    '处决增伤 24% -> 36%。'
  ],
  summon_necrotic_vitality: [
    '召唤物生命加成直接提升到 36%，并在亡灵阵亡时为其余亡灵回复 12% 最大生命。'
  ],
  summon_guard_bulwark: [
    '卫士生命加成 0% -> 20%，减伤 0% -> 10%。',
    '卫士生命加成 20% -> 40%，减伤 10% -> 15%。',
    '卫士生命加成 40% -> 60%，减伤 15% -> 20%，并强化拦截倾向。'
  ],
  summon_mage_empower: [
    '法师伤害加成直接提升到 30%。',
    '法师伤害加成直接提升到 45%，攻击间隔额外缩短 15%。'
  ],
  summon_ember_echo: [
    '每次亡灵死亡获得魂火层数 0 -> 1，层数上限 0 -> 3；每层伤害固定 +4%，持续 6 秒。',
    '魂火层数上限 3 -> 5。'
  ],
  guardian_block: [
    '基础格挡已解锁。',
    '格挡率直接提升到 15%。'
  ],
  guardian_armor: [
    '固定减伤直接提升到 3；每隔 5 秒首次受到有效伤害后，获得 6% 最大生命的护甲屏障。'
  ],
  guardian_counter: [
    '反击伤害 0% -> 80%。',
    '反击伤害 80% -> 120%。',
    '反击伤害 120% -> 160%。'
  ],
  guardian_sacred_seal: [
    '基础圣印已解锁。',
    '圣印上限直接提升到 5 层，单层减伤直接提升到 4%。'
  ],
  guardian_holy_rebuke: [
    '神圣回击半径直接提升到 135，伤害直接提升到 150%。',
    '神圣回击半径直接提升到 150，伤害直接提升到 200%，并追加 0.5 秒冻结。'
  ],
  guardian_light_fortress: [
    '每层圣印护盾转化 0% -> 4%。',
    '每层圣印护盾转化 4% -> 6%。',
    '每层圣印护盾转化 6% -> 8%。'
  ],
  druid_pet_bear: [
    '把基础熊灵提升到稳定前排档位；出场时会咆哮震慑周围敌人。'
  ],
  druid_pet_hawk: [
    '解锁战鹰，并让其基础攻击自带轻度猎印。'
  ],
  druid_pet_treant: [
    '解锁树精，并在出场时立刻提供一次萌芽治疗与护盾。'
  ],
  nature_bear_guard: [
    '熊灵分担伤害显著提升。',
    '熊灵分担伤害进一步提升，并解锁震地减速。'
  ],
  nature_hawk_huntmark: [
    '战鹰建立稳定猎印增伤。',
    '战鹰猎印进一步强化，并稳定对 Boss 生效。'
  ],
  nature_treant_bloom: [
    '树精治疗加成与护盾概率显著提升。',
    '树精进入完整护持形态，治疗与护盾进一步强化。'
  ],
  mage_arcanomorph: [
    '奥术叠界强度提升到第 1 档。',
    '奥术叠界强度提升到第 2 档。',
    '奥术叠界强度提升到第 3 档。'
  ],
  mage_dualcaster: [
    '星界贯炮启动：站定后展开贯穿全屏的重型主炮。',
    '主炮进一步变粗、增伤，并缩短蓄力前摇。',
    '主炮到达终局形态：射程、宽度与滞敌效果再次提升。'
  ],
  mage_trilaser: [
    '主炮命中后裂出 1 道副光束。',
    '副光束提升到 2 道，并强化折射伤害。',
    '副光束提升到 3 道，形成完整棱镜清屏。'
  ],
  archer_bounce: [
    '箭矢获得 1 次弹射追猎。',
    '箭矢弹射次数 1 -> 2。',
    '箭矢弹射次数 2 -> 3。'
  ],
  archer_windfury: [
    '基础射击进化为 360° 箭环，并追加 1 波延迟箭幕。',
    '箭环数量提高，并追加第 2 波延迟箭幕。',
    '箭环密度再提高，并追加第 3 波延迟箭幕。'
  ],
  archer_eagleeye: [
    '箭幕基础伤害提高，对猎印目标获得更高暴击权重。',
    '暴击权重与箭幕伤害进一步提升。',
    '对猎印目标的暴击与斩杀能力达到终局档。'
  ],
  warrior_spin: [
    '终极技能解锁：每 30 秒自动进入回旋斩，持续 10 秒。'
  ],
  warrior_berserkgod: [
    '永动旋刃期间额外追加 1 次延迟追斩。',
    '永动旋刃期间额外追加 2 次延迟追斩。',
    '永动旋刃期间额外追加 3 次延迟追斩。'
  ],
  warrior_unyielding: [
    '低血时旋刃获得第 1 档暴走加速。',
    '低血时旋刃伤害与速度进一步提高。',
    '低血时暴走战躯达到终局档，并追加更多追斩。'
  ],
  warlock_souleater: [
    '腐灭连环扩散强度提升到第 1 档。',
    '腐灭连环扩散强度提升到第 2 档。',
    '腐灭连环扩散强度提升到第 3 档。'
  ],
  warlock_autoseek: [
    '毒圈获得第 1 档主动索敌漂移。',
    '毒圈漂移速度、持续与压场范围进一步提升。',
    '毒圈达到终局追猎档，覆盖与黏敌能力再次增强。'
  ],
  warlock_netherlord: [
    '地狱火获得第 1 档体型、生命、伤害与灼烧压场强化。',
    '地狱火与毒圈的双线压场进一步提升。',
    '炼狱君王达到终局档：毒圈与地狱火双重压场。'
  ],
  paladin_avenger: [
    '震退反制强度提升到第 1 档。',
    '震退反制强度提升到第 2 档。',
    '震退反制强度提升到第 3 档，并可追加眩晕。'
  ],
  paladin_sacredshield: [
    '圣棘回响启动：受击与格挡会向周围反震神圣伤害。',
    '回响范围与伤害进一步提高。',
    '圣棘回响达到终局档，形成稳定反制光环。'
  ],
  paladin_divine: [
    '审判禁区启动：受击、回击与锤击都会触发审判波。',
    '审判波范围与伤害进一步提高。',
    '审判禁区达到终局档，并有更高概率追加短控。'
  ],
  druid_kingofbeasts: [
    '群星坠世启动：星落额外追加 1 颗陨星，并强化自然伙伴体型。',
    '额外陨星数 1 -> 2，星落范围进一步扩大。',
    '额外陨星数 2 -> 3，群星坠世达到终局覆盖。'
  ],
  druid_naturefusion: [
    '陨石命中后追加 1 段连星陨爆。',
    '连星陨爆追加次数 1 -> 2。',
    '连星陨爆追加次数 2 -> 3。'
  ],
  druid_astralstorm: [
    '星落循环提速到第 1 档。',
    '星落循环提速到第 2 档。',
    '星落循环提速到第 3 档。'
  ],
  off_arcane: [
    '作为副职业，立即获得基础奥术炮台；首座炮台会快速完成一次开场射击。'
  ],
  off_ranger: [
    '作为副职业，立即获得基础诱饵假人；首个假人落地时会立刻触发一次牵引脉冲。'
  ],
  off_unyielding: [
    '作为副职业，立即获得基础血怒，并立刻爆发一次战吼脉冲，震退并迟滞近身敌人。'
  ],
  off_summon: [
    '作为副职业，立即获得 1 名骷髅卫士与 1 名骷髅法师，并解锁召唤系天赋池。'
  ],
  off_guardian: [
    '作为副职业，立即获得基础格挡与圣印，并解锁守护系天赋池。'
  ],
  off_nature: [
    '作为副职业，立即获得 1 只熊灵，并解锁自然伙伴天赋池。'
  ]
};

export function getTalentSummary(id, fallback = '') {
  return TALENT_SUMMARY_BY_ID[id] || fallback;
}

export function getTalentLevelDescriptions(id) {
  return TALENT_LEVEL_DESC_BY_ID[id] || null;
}

export function getTalentOfferDescription(id, nextLevel, fallback = '') {
  const levelDescriptions = getTalentLevelDescriptions(id);
  return levelDescriptions?.[nextLevel - 1] || getTalentSummary(id, fallback);
}

export function applyTalentSummary(option) {
  if (!option?.id) return option;
  const desc = getTalentSummary(option.id, option.desc);
  if (desc === option.desc) return option;
  return {
    ...option,
    desc
  };
}