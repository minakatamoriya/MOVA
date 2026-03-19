// 升级池：按“主职业专精输出(UPGRADE_POOLS)”与“通用天赋(UNIVERSAL_POOLS)”拆分。
// 约束：
// - 主职业专精只在第一次选择的职业生效
// - 副职业只提供通用被动，不提供第二套攻击形态

// 升级天赋出现权重。
// - 所有候选默认 weight=1，可在单项上单独覆盖。
// - testing 用于测试期定向提高某个分支/某个技能的出现率，方便验证功能。
export const TALENT_OFFER_WEIGHT_CONFIG = {
  mainCoreWeightByStage: {
    main_only: 5.0,
    main_and_off: 2.6,
    all: 1.5,
  },
  offFactionEntryWeight: 2.4,
  ownedOffFactionWeight: 2.8,
  thirdSpecWeight: 0.8,
  repeatLevelDecay: 0.72,
  repeatableTalentWeight: 1.35,
  repeatableTalentDecay: 0.9,
  testing: {
    enabled: false,
    favoredTree: 'curse',
    favoredTreeMultiplier: 3.5,
    favoredOffFactionEntryMultiplier: 4.0,
    favoredIds: {
      curse_skeleton_guard: 18,
      curse_skeleton_mage: 10,
    },
    favoredRepeatableNoDecay: true,
  }
};

// 主职业专精（只从 mainCore 抽取）
export const UPGRADE_POOLS = {
  // 🟢 猎人·散射（主职业输出）
  archer: [
    { id: 'archer_range', category: 'build', name: '射程', desc: '基础射击射程提升（+12%/+24%/+36%）', icon: '猎主', maxLevel: 3 },
    { id: 'archer_volley', category: 'build', name: '箭矢齐射', desc: '基础射击初始为1列；升级后变为3列→5列→7列（中心列始终锁定目标）', icon: '猎主', maxLevel: 3 },
    { id: 'archer_nimble_evade', category: 'build', name: '灵巧回避', desc: '生命低于30%时自动触发：闪避率 +40%/+60%/+80%，持续3秒，冷却30秒', icon: '猎主', maxLevel: 3 },
    { id: 'archer_evade_mastery', category: 'build', name: '残影步调', desc: '强化灵巧回避：持续时间提高至5/8/10秒', icon: '猎主', maxLevel: 3, requiredSkillId: 'archer_nimble_evade' },
  ],

  // 🌿 德鲁伊·星落（主职业输出）
  drone: [
    { id: 'druid_meteor_shower', category: 'build', name: '流星雨', desc: '星落数量 +2，但单次伤害略微降低', icon: '德主' },
    { id: 'druid_meteor', category: 'build', name: '陨石', desc: '每 10 秒，下一次星落变为巨型陨石：范围更大，伤害更高', icon: '德主' },
    { id: 'druid_starfire', category: 'build', name: '星火', desc: '星落命中后有 30% 概率在同位置额外触发一次（不连锁）', icon: '德主' },
    { id: 'druid_nourish', category: 'build', name: '自然滋养', desc: '生命低于30%时自动触发：在15/10/5秒内缓慢回复30%生命，冷却30秒', icon: '德主', maxLevel: 3 },
    { id: 'druid_nourish_growth', category: 'build', name: '丰饶脉动', desc: '强化自然滋养：总回复量额外提高50%/80%/100%', icon: '德主', maxLevel: 3, requiredSkillId: 'druid_nourish' }
  ],

  // 🟠 战士·旋风斩（此项目内为“近战挥砍/半月波”）
  warrior: [
    { id: 'warrior_spin', category: 'build', name: '回旋', desc: '挥砍变为 360° 回旋斩，造成范围伤害', icon: '战主' },
    { id: 'warrior_swordqi', category: 'build', name: '剑气', desc: '挥砍时额外发射一道月牙剑气（保留近战判定）', icon: '战主' },
    { id: 'warrior_endure', category: 'build', name: '持久', desc: '战士近战形态获得 20% 伤害减免', icon: '战主' },
    { id: 'warrior_range', category: 'build', name: '月牙扩展', desc: '月牙斩有效范围提升（可叠加）', icon: '战主' },
    { id: 'warrior_blood_conversion', category: 'build', name: '猩红嗜血', desc: '生命低于30%时自动触发：攻击伤害转化为100%吸血，持续5/10/15秒，冷却30秒', icon: '战主', maxLevel: 3 },
    { id: 'warrior_bloodlust_mastery', category: 'build', name: '狂血渴饮', desc: '强化猩红嗜血：攻击伤害转化提高至120%/150%/200%', icon: '战主', maxLevel: 3, requiredSkillId: 'warrior_blood_conversion' }
  ],

  // 🔵 法师·激光
  mage: [
    { id: 'mage_refract', category: 'build', name: '折射', desc: '激光命中目标后，从该目标分裂 2 道短射线到附近敌人，伤害为 50%', icon: '法主' },
    { id: 'mage_arcane_perception', category: 'build', name: '奥术感知', desc: '奥术射线索敌范围提升（可叠加）', icon: '法主' },
    { id: 'mage_energy_focus', category: 'build', name: '能量汇集', desc: '奥术射线伤害 +10%，并随层数变粗更亮（可叠加）', icon: '法主' },
    { id: 'mage_frost_nova', category: 'build', name: '冰霜新星', desc: '生命低于30%时自动触发：冻结周围敌人 3/5/10 秒，冷却30秒', icon: '法主', maxLevel: 3 },
    { id: 'mage_frost_domain', category: 'build', name: '极寒疆域', desc: '强化冰霜新星：冻结范围扩大至300/380/480', icon: '法主', maxLevel: 3, requiredSkillId: 'mage_frost_nova' }
  ],

  // 🛡️ 圣骑士·矛
  paladin: [
    { id: 'paladin_pierce', category: 'build', name: '重锤', desc: '锤击范围与伤害提高', icon: '骑主' },
    { id: 'paladin_holyfire', category: 'build', name: '圣焰', desc: '锤击命中后在地上留下圣焰，造成持续伤害', icon: '骑主' },
    { id: 'paladin_triple', category: 'build', name: '连锤', desc: '每 5 秒，下一次锤击额外追加 2 次余震落点', icon: '3X' },
    { id: 'paladin_stun', category: 'build', name: '制裁', desc: '锤击有 10%/20%/30% 概率使敌人眩晕', icon: '骑主' },
    { id: 'paladin_divine_shelter', category: 'build', name: '神圣庇护', desc: '生命低于30%时自动触发：获得40%/60%/80%减伤，持续5秒，冷却30秒', icon: '骑主', maxLevel: 3 },
    { id: 'paladin_shelter_extension', category: 'build', name: '圣佑绵延', desc: '强化神圣庇护：持续时间提高至8/10/12秒', icon: '骑主', maxLevel: 3, requiredSkillId: 'paladin_divine_shelter' }
  ],

  // 🟣 术士·暗影箭
  warlock: [
    { id: 'warlock_toxicity', category: 'build', name: '毒性浓度', desc: '剧毒 debuff 最大层数 +1（可叠加，最多 3 层）', icon: '术主', maxLevel: 3 },
    { id: 'warlock_corrode', category: 'build', name: '腐蚀', desc: '毒圈持续时间 +1 秒（可叠加，最多 3 层）', icon: '术主', maxLevel: 3 },
    { id: 'warlock_spread', category: 'build', name: '扩散', desc: '毒圈范围 +20%（可叠加，最多 3 层）', icon: '术主', maxLevel: 3 },
    { id: 'warlock_infernal', category: 'build', name: '炼狱魔火', desc: '生命低于30%时自动触发：消耗15%生命召唤地狱火 10 秒，冷却30秒。等级提升会强化地狱火生命、攻击与每击回血', icon: '术主', maxLevel: 3 },
    { id: 'warlock_infernal_contract', category: 'build', name: '灰烬契约', desc: '强化炼狱魔火：生命消耗降低至10%/5%/0%', icon: '术主', maxLevel: 3, requiredSkillId: 'warlock_infernal' }
  ]
};

// 通用天赋（副职业池）
export const UNIVERSAL_POOLS = {
  // 🔵 法师·奥术
  arcane: [
    { id: 'arcane_circle', category: 'build', name: '奥能法阵', desc: '周期生成奥能法阵。1/2/3级：每10/8/6秒生成1个法阵，持续3/4/5秒；阵内你的伤害 +10%/+15%/+20%', icon: '法副', maxLevel: 3 },
    { id: 'arcane_circle_range', category: 'build', name: '法阵扩张', desc: '扩大奥能法阵范围。1/2/3级：法阵半径 +15%/+30%/+45%', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_fire_circle', category: 'build', name: '烈焰法阵', desc: '法阵结束时爆炸。1/2/3级：造成80%/120%/160%攻击力范围伤害；2级范围+20%，3级附带2秒灼烧', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_frost_circle', category: 'build', name: '冰霜法阵', desc: '法阵内敌人减速。1/2/3级：敌人移动速度 -20%/-30%/-40%；3级离开法阵后仍保留1秒减速', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_resonance_mark', category: 'build', name: '共鸣刻印', desc: '进一步扩大奥能法阵增伤。1/2/3级：法阵提供的增伤额外 +6%/+12%/+18%', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' },
    { id: 'arcane_flowcasting', category: 'build', name: '流动施法', desc: '离开法阵后短时间保留法阵增益。1/2/3级：保留1/2/3秒', icon: '法副', maxLevel: 3, requiredSkillId: 'arcane_circle' }
  ],

  // 🟢 猎人·游侠
  ranger: [
    { id: 'ranger_snaretrap', category: 'build', name: '绊索陷阱', desc: '自动布置绊索陷阱。1/2/3级：每10/8/6秒布置1个陷阱，触发后定身敌人1/1.5/2秒', icon: '猎副', maxLevel: 3 },
    { id: 'ranger_huntmark', category: 'build', name: '猎手印记', desc: '被陷阱触发的敌人受到你的伤害提高。1/2/3级：+10%/+20%/+30%', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_spiketrap', category: 'build', name: '钉刺陷阱', desc: '陷阱触发后造成伤害与减速。1/2/3级：造成60%/90%/120%攻击力伤害，并使敌人减速25%/35%/45%', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_blasttrap', category: 'build', name: '爆裂陷阱', desc: '陷阱触发时额外爆炸。1/2/3级：造成80%/120%/160%攻击力范围伤害；3级范围+25%', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_trapcraft', category: 'build', name: '熟练布置', desc: '强化陷阱覆盖能力。1级：同时存在的陷阱数量 +1；2级：触发范围 +20%；3级：陷阱数量再 +1，触发范围总计 +35%', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_snaretrap' },
    { id: 'ranger_pack_hunter', category: 'build', name: '围猎本能', desc: '强化你对被控制或被标记目标的暴击收益。1/2/3级：暴击率 +8%/+16%/+24%；3级额外获得 +20% 暴击伤害', icon: '猎副', maxLevel: 3, requiredSkillId: 'ranger_huntmark' }
  ],

  // 🟠 战士·不屈
  unyielding: [
    { id: 'unyielding_bloodrage', category: 'build', name: '血怒', desc: '生命越低伤害越高。1/2/3级：生命每降低10%，伤害 +2%/+3%/+4%', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_battlecry', category: 'build', name: '战吼', desc: '受伤后短时间增伤。1/2/3级：受到伤害时有20%概率触发，3秒内伤害 +10%/+20%/+30%', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_hamstring', category: 'build', name: '断筋', desc: '近距离命中使敌人减速。1/2/3级：减速15%/25%/35%，持续1.5/1.5/2秒', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_sunder', category: 'build', name: '破甲', desc: '持续命中同一目标时提高对其伤害。1/2/3级：+6%/+12%/+18%', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_standfast', category: 'build', name: '不退', desc: '近距离存在敌人时获得减伤与抗击退。1/2/3级：受到伤害 -6%/-12%/-18%；3级额外获得少量抗击退', icon: '战副', maxLevel: 3 },
    { id: 'unyielding_executioner', category: 'build', name: '处决本能', desc: '对低血敌人造成额外伤害。1/2/3级：对生命低于35%的敌人伤害 +12%/+24%/+36%', icon: '战副', maxLevel: 3 }
  ],

  // 🟣 术士·诅咒
  curse: [
    { id: 'curse_necrotic_vitality', category: 'build', name: '死灵共鸣', desc: '提高召唤物生命。1/2/3级：召唤物生命 +12%/+24%/+36%', icon: '术副', maxLevel: 3 },
    { id: 'curse_skeleton_guard', category: 'build', name: '骷髅卫士', desc: '召唤近战骷髅卫士。1/2/3级：上限为 1/3/5', icon: '术副', maxLevel: 3 },
    { id: 'curse_skeleton_mage', category: 'build', name: '骷髅法师', desc: '召唤远程骷髅法师。1/2/3级：上限为 1/3/5', icon: '术副', maxLevel: 3 },
    { id: 'curse_mage_empower', category: 'build', name: '白骨灌能', desc: '强化骷髅法师输出。1/2/3级：骷髅法师伤害 +15%/+30%/+45%；3级攻击间隔额外缩短15%', icon: '术副', maxLevel: 3, requiredSkillId: 'curse_skeleton_mage' },
    { id: 'curse_guard_bulwark', category: 'build', name: '骸骨壁垒', desc: '强化骷髅卫士生存与前排能力。1/2/3级：生命额外 +20%/+40%/+60%，受到伤害 -10%/-15%/-20%；3级额外提高拦截倾向', icon: '术副', maxLevel: 3, requiredSkillId: 'curse_skeleton_guard' },
    { id: 'curse_ember_echo', category: 'build', name: '魂火余烬', desc: '召唤物死亡后为你提供短时间增伤/减伤。1级：每死1名召唤物获得1层魂火，持续4秒，每层伤害 +3%，最多3层；2级：每层同时提供2%减伤；3级：持续时间延长至6秒，每层伤害提高至 +4%，减伤提高至3%', icon: '术副', maxLevel: 3 }
  ],

  // 🛡️ 圣骑士·守护
  guardian: [
    { id: 'guardian_block', category: 'build', name: '坚盾', desc: '概率格挡，格挡时减伤。1/2/3级：格挡率 5%/8%/12%，格挡减伤 50%', icon: '骑副', maxLevel: 3 },
    { id: 'guardian_armor', category: 'build', name: '护甲', desc: '固定减伤。1/2/3级：所有受到的伤害 -2/-4/-6', icon: '骑副', maxLevel: 3 },
    { id: 'guardian_counter', category: 'build', name: '反制', desc: '格挡成功后反击。1/2/3级：反击造成80%/120%/160%攻击力伤害', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_block' },
    { id: 'guardian_sacred_seal', category: 'build', name: '庇护圣印', desc: '受击或格挡时积累圣印。1/2/3级：圣印上限 3/4/5 层', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_block' },
    { id: 'guardian_holy_rebuke', category: 'build', name: '神圣回击', desc: '累计满圣印后，下次格挡或受击触发范围冲击。1/2/3级：造成100%/150%/200%攻击力伤害；3级附带20%减速，持续2秒', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_sacred_seal' },
    { id: 'guardian_light_fortress', category: 'build', name: '光铸壁垒', desc: '低血时自动消耗全部圣印生成护盾。1/2/3级：每层圣印提供4%/6%/8%最大生命护盾', icon: '骑副', maxLevel: 3, requiredSkillId: 'guardian_sacred_seal' }
  ],

  // 🌿 德鲁伊·自然伙伴
  nature: [
    { id: 'druid_pet_bear', category: 'build', name: '熊灵', desc: '召唤熊灵协同作战。1/2/3级：负责近战拦截；后续提升生命、仇恨与减伤能力', icon: '德副', maxLevel: 3 },
    { id: 'druid_pet_hawk', category: 'build', name: '战鹰', desc: '召唤战鹰协同作战。1/2/3级：负责高频打击；后续提升攻速、索敌与追击倾向', icon: '德副', maxLevel: 3 },
    { id: 'druid_pet_treant', category: 'build', name: '树精', desc: '召唤树精协同作战。1/2/3级：负责周期治疗；后续提升治疗量、频率与护盾能力', icon: '德副', maxLevel: 3 },
    { id: 'nature_bear_guard', category: 'build', name: '熊灵守护', desc: '强化熊灵承担伤害与拦截能力。1/2/3级：玩家受击时熊灵分担8%/16%/24%伤害；3级额外获得概率震地减速', icon: '德副', maxLevel: 3, requiredSkillId: 'druid_pet_bear' },
    { id: 'nature_hawk_huntmark', category: 'build', name: '战鹰猎印', desc: '强化战鹰标记与增伤。1/2/3级：战鹰命中的敌人被标记，你对其伤害 +8%/+16%/+24%；3级对Boss稳定生效', icon: '德副', maxLevel: 3, requiredSkillId: 'druid_pet_hawk' },
    { id: 'nature_treant_bloom', category: 'build', name: '树精繁茂', desc: '强化树精治疗与护盾。1/2/3级：治疗量 +15%/+30%/+45%，并有15%/30%/45%概率附带2%最大生命护盾', icon: '德副', maxLevel: 3, requiredSkillId: 'druid_pet_treant' }
  ]
};

// 第二次三选一：副职业“入门节点”选项（直接给真实被动/入口）
// 说明：
// - 选中这些节点时，会在 GameScene.applyUpgrade 中自动写入 offFaction
// - 自然伙伴：这里先解锁德鲁伊副职业，后续再从自然伙伴池中抽取熊/鹰/树精与其强化
export const OFF_FACTION_ENTRY_OPTIONS = [
  { id: 'off_arcane', category: 'build', name: '奥术', desc: '获得奥能法阵，并使所有攻击间隔 -8%。', icon: '解锁法师副职业！' },
  { id: 'off_ranger', category: 'build', name: '游侠', desc: '获得陷阱体系，并使闪避率 +10%。', icon: '解锁猎人副职业！' },
  { id: 'off_unyielding', category: 'build', name: '不屈', desc: '获得不屈战意，并使暴击率 +15%。', icon: '解锁战士副职业！' },
  { id: 'off_curse', category: 'build', name: '诅咒', desc: '获得亡灵军势，并使造成的伤害 +8%。', icon: '解锁术士副职业！' },
  { id: 'off_guardian', category: 'build', name: '守护', desc: '获得格挡与圣印，并使受到的伤害 -10%。', icon: '解锁圣骑士副职业！' },
  { id: 'off_nature', category: 'build', name: '自然伙伴', desc: '获得自然伙伴，并每秒恢复 0.8% 最大生命。', icon: '解锁德鲁伊副职业！' }
];

// ====== 第三天赋：深度专精 / 双职业专精（占位池，后续由策划填充） ======
// 设计约束：深度专精池 与 双职业池 完全互斥。
// - depth：主/副同主题（例如 法师主 + 奥术副 => 法师深度专精）
// - dual：主/副不同主题（例如 法师主 + 自然伙伴副 => 法师+德鲁伊双职业）

export const THIRD_SPEC_PREP_OPTIONS = {
  depth: { id: 'third_depth_prep', category: 'build', name: '本职业深度专精天赋', desc: '解锁深度专精天赋', icon: '专精' },
  dual: { id: 'third_dual_prep', category: 'build', name: '双职业天赋', desc: '解锁双职业天赋', icon: '双职' }
};

// 深度专精池：按主职业主题拆分
export const DEPTH_SPEC_POOLS = {
  mage: [
    { id: 'mage_dualcaster', category: 'third_depth', name: '双倍施法', desc: '激光有 20% 概率同时发射两道（可叠加过热/蓄能）', icon: '法深', maxLevel: 1 },
    { id: 'mage_trilaser', category: 'third_depth', name: '三重激光', desc: '激光分裂为 3 道，每道伤害为原伤害的 60%', icon: '法深', maxLevel: 1 },
    { id: 'mage_arcanomorph', category: 'third_depth', name: '奥术化身', desc: '每层使法阵效果翻倍，且法阵内移动不消失（上限3层）', icon: '法深', maxLevel: 3 }
  ],
  archer: [
    { id: 'archer_hundred', category: 'third_depth', name: '百发百中', desc: '每层使暴击伤害 +30%', icon: '猎深', maxLevel: 3 },
    { id: 'archer_windfury', category: 'third_depth', name: '疾风连射', desc: '每次攻击有 15% 概率触发一次额外攻击（可触发自身）', icon: '猎深', maxLevel: 1 },
    { id: 'archer_eagleeye', category: 'third_depth', name: '鹰眼化身', desc: '攻击无视敌人 30% 防御，且猎手标记对任何血量生效', icon: '猎深', maxLevel: 1 },
    { id: 'archer_bounce', category: 'third_depth', name: '箭矢弹射', desc: '箭矢命中后可在敌人之间额外弹射 1 次', icon: '猎深', maxLevel: 1 }
  ],
  warrior: [
    { id: 'warrior_bladestorm', category: 'third_depth', name: '剑刃风暴', desc: '旋风斩持续期间，自身周围持续产生剑气，每0.5秒造成伤害', icon: '战深', maxLevel: 1 },
    { id: 'warrior_berserkgod', category: 'third_depth', name: '战神下凡', desc: '每层使血怒的最大增伤上限提升至 50%（原30%）', icon: '战深', maxLevel: 3 },
    { id: 'warrior_unyielding', category: 'third_depth', name: '不灭化身', desc: '死斗状态下免疫控制，且攻击速度加成翻倍', icon: '战深', maxLevel: 1 }
  ],
  warlock: [
    { id: 'warlock_infinite', category: 'third_depth', name: '无限回响', desc: '暗影箭回响法阵持续时间翻倍，且可存在多个', icon: '术深', maxLevel: 1 },
    { id: 'warlock_souleater', category: 'third_depth', name: '噬魂者', desc: '每层使吞噬的斩杀线提高至 40%，且斩杀后回复 5% 生命', icon: '术深', maxLevel: 3 },
    { id: 'warlock_netherlord', category: 'third_depth', name: '虚空领主', desc: '连环弹射次数 +2，且每次弹射伤害不衰减', icon: '术深', maxLevel: 1 },
    { id: 'warlock_autoseek', category: 'third_depth', name: '索敌毒径', desc: '深度专精：毒圈会缓慢贴向敌人（移动炮台风格）', icon: '术深', maxLevel: 1 }
  ],
  paladin: [
    { id: 'paladin_avenger', category: 'third_depth', name: '复仇者', desc: '每层使反制伤害提高 100% 攻击力', icon: '骑深', maxLevel: 3 },
    { id: 'paladin_sacredshield', category: 'third_depth', name: '圣盾术', desc: '格挡成功后，获得 1 层护盾（可吸收 20% 生命值）', icon: '骑深', maxLevel: 1 },
    { id: 'paladin_divine', category: 'third_depth', name: '神圣化身', desc: '圣焰持续伤害 +100%，且可叠加 2 层', icon: '骑深', maxLevel: 1 }
  ],
  drone: [
    { id: 'druid_kingofbeasts', category: 'third_depth', name: '万兽之主', desc: '三宠同场：熊、鹰、树精同时存在（属性为正常的 40%/60%/40%）', icon: '德深', maxLevel: 1 },
    { id: 'druid_naturefusion', category: 'third_depth', name: '自然化身', desc: '永久获得熊的 20% 减伤、鹰的 20% 攻速、树精的 0.5%/秒回血', icon: '德深', maxLevel: 1 },
    { id: 'druid_astralstorm', category: 'third_depth', name: '星辰风暴', desc: '每层使星落范围 +15%，且流星雨可触发陨石效果', icon: '德深', maxLevel: 3 }
  ]
};

// 双职业专精池：按（主职业主题 -> 副职业主题）拆分
export const DUAL_SPEC_POOLS = {
  mage: {
    drone: [
      { id: 'dual_mage_drone_arcanebear', category: 'third_dual', name: '奥术之熊', desc: '你的熊灵继承你法阵效果，在法阵内减伤 +20%、攻击力 +30%', icon: '法德', maxLevel: 1 },
      { id: 'dual_mage_drone_starwisdom', category: 'third_dual', name: '星辰智慧', desc: '每层使星落命中后，你的激光冷却 -2%（最高 30%）', icon: '法德', maxLevel: 3 },
      { id: 'dual_mage_drone_natureoverflow', category: 'third_dual', name: '自然溢流', desc: '自然伙伴节点出现权重提高，且熊灵/战鹰/树精强化不会晚于对应宠物本体出现', icon: '法德', maxLevel: 1 }
    ]
  },
  archer: {
    mage: [
      { id: 'dual_scatter_mage_enchantedarrow', category: 'third_dual', name: '附魔箭矢', desc: '你的箭矢有 20% 概率附加一次激光伤害（50% 攻击力）', icon: '猎法', maxLevel: 1 },
      { id: 'dual_scatter_mage_hastefocus', category: 'third_dual', name: '迅捷专注', desc: '每层使猎人攻速 +5%，同时法师迅捷效果 +2%', icon: '猎法', maxLevel: 3 },
      { id: 'dual_scatter_mage_archercircle', category: 'third_dual', name: '射手法阵', desc: '你可以在法阵内移动，且法阵内暴击伤害 +30%', icon: '猎法', maxLevel: 1 }
    ]
  },
  warrior: {
    paladin: [
      { id: 'dual_warrior_paladin_crusade', category: 'third_dual', name: '十字军', desc: '你的旋风斩每命中一个敌人，格挡率 +5%，持续 3 秒（可叠加）', icon: '战骑', maxLevel: 1 },
      { id: 'dual_warrior_paladin_righteousrage', category: 'third_dual', name: '正义血怒', desc: '每层使血怒每层增伤额外 +1%，且血怒状态下格挡率 +10%', icon: '战骑', maxLevel: 3 },
      { id: 'dual_warrior_paladin_sacredspin', category: 'third_dual', name: '神圣旋风', desc: '旋风斩变为神圣伤害，对亡灵/恶魔敌人伤害 +50%', icon: '战骑', maxLevel: 1 }
    ]
  },
  warlock: {
    drone: [
      { id: 'dual_warlock_drone_decay', category: 'third_dual', name: '腐败滋养', desc: '你的宠物攻击时有 25% 概率施加腐蚀，且腐蚀伤害可治疗宠物', icon: '术德', maxLevel: 1 },
      { id: 'dual_warlock_drone_witheringroar', category: 'third_dual', name: '凋零咆哮', desc: '熊灵咆哮时，对周围敌人施加虚弱（伤害 -20%）', icon: '术德', maxLevel: 1 },
      { id: 'dual_warlock_drone_soulbloom', category: 'third_dual', name: '灵魂绽放', desc: '每层使树精的治疗有 10% 概率同时移除一个负面效果', icon: '术德', maxLevel: 3 }
    ]
  },
  paladin: {
    archer: [
      { id: 'dual_paladin_scatter_holyrain', category: 'third_dual', name: '圣光箭雨', desc: '你的箭雨变为神圣箭雨，对敌人造成额外 20% 神圣伤害并致盲 1 秒', icon: '骑猎', maxLevel: 1 },
      { id: 'dual_paladin_scatter_blessedquiver', category: 'third_dual', name: '祝福箭袋', desc: '每层使你的暴击率 +3%，且暴击时有 20% 概率为自己回复 2% 生命', icon: '骑猎', maxLevel: 3 },
      { id: 'dual_paladin_scatter_retribution', category: 'third_dual', name: '惩戒射击', desc: '对攻击你的敌人，你的下次攻击必定暴击且附加圣焰', icon: '骑猎', maxLevel: 1 }
    ]
  },
  drone: {
    warrior: [
      { id: 'dual_drone_warrior_ironbark', category: 'third_dual', name: '铁木之熊', desc: '你的熊灵获得战士不屈特性：生命低于 50% 时伤害 +30%', icon: '德战', maxLevel: 1 },
      { id: 'dual_drone_warrior_predator', category: 'third_dual', name: '掠食者', desc: '每层使战鹰对生命低于 50% 的敌人伤害 +10%', icon: '德战', maxLevel: 3 },
      { id: 'dual_drone_warrior_ancestral', category: 'third_dual', name: '先祖韧性', desc: '你的树精每 5 秒为战士提供一层血怒（无伤害，仅增伤）', icon: '德战', maxLevel: 1 }
    ]
  }
};

// 技能树 id -> GameScene.buildState.core key
export const TREE_TO_CORE_KEY = {
  archer: 'archer',
  druid: 'drone',
  warrior: 'warrior',
  mage: 'mage',
  paladin: 'paladin',
  warlock: 'warlock'
};
