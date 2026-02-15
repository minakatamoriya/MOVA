// 升级池：按“主职业专精输出(UPGRADE_POOLS)”与“通用天赋(UNIVERSAL_POOLS)”拆分。
// 约束：
// - 主职业专精只在第一次选择的职业生效
// - 副职业只提供通用被动，不提供第二套攻击形态

// 主职业专精（只从 mainCore 抽取）
export const UPGRADE_POOLS = {
  // 🟢 猎人·散射（主职业输出）
  scatter: [
    { id: 'archer_rapidfire', category: 'build', name: '连射', desc: '每次攻击后，10% 概率免费再射一轮', icon: '猎主' },
    { id: 'archer_pierce', category: 'build', name: '穿透', desc: '箭矢命中后不消失，最多可额外穿透 1 次', icon: '猎主' },
    { id: 'archer_arrowrain', category: 'build', name: '箭雨', desc: '每 5 秒，下一次攻击变为箭雨，覆盖更大范围，伤害翻倍', icon: '猎主' },

    // 基础技能数值升级（可叠加 3 级）
    { id: 'archer_range', category: 'build', name: '射程', desc: '基础射击射程提升（+1/+2/+3）', icon: '距', maxLevel: 3 },
    { id: 'archer_rate', category: 'build', name: '射速', desc: '基础射击攻速提升（+1/+2/+3）', icon: '速', maxLevel: 3 },
    { id: 'archer_damage', category: 'build', name: '攻击力', desc: '基础射击伤害提升（+1/+2/+3）', icon: '力', maxLevel: 3 },
    { id: 'archer_scatter', category: 'build', name: '散射', desc: '基础射击散射升级：1列→3列→5列（扇形不宜过宽）', icon: '散', maxLevel: 3 }
  ],

  // 🌿 德鲁伊·星落（主职业输出）
  drone: [
    { id: 'druid_meteor_shower', category: 'build', name: '流星雨', desc: '星落数量 +2，但单次伤害略微降低', icon: '德主' },
    { id: 'druid_meteor', category: 'build', name: '陨石', desc: '每 10 秒，下一次星落变为巨型陨石：范围更大，伤害更高', icon: '德主' },
    { id: 'druid_starfire', category: 'build', name: '星火', desc: '星落命中后有 30% 概率在同位置额外触发一次（不连锁）', icon: '德主' }
  ],

  // 🟠 战士·旋风斩（此项目内为“近战挥砍/半月波”）
  warrior: [
    { id: 'warrior_spin', category: 'build', name: '回旋', desc: '挥砍变为 360° 回旋斩，造成范围伤害', icon: '战主' },
    { id: 'warrior_swordqi', category: 'build', name: '剑气', desc: '挥砍时额外发射一道月牙剑气（保留近战判定）', icon: '战主' },
    { id: 'warrior_endure', category: 'build', name: '持久', desc: '战士近战形态获得 20% 伤害减免', icon: '战主' },
    { id: 'warrior_range', category: 'build', name: '月牙扩展', desc: '月牙斩有效范围提升（可叠加）', icon: '战主' }
  ],

  // 🔵 法师·激光
  mage: [
    { id: 'mage_refract', category: 'build', name: '折射', desc: '激光额外生成 2 道较短的折射光束（清群质变）', icon: '法主' },
    { id: 'mage_overheat', category: 'build', name: '过热', desc: '激光持续命中同一目标 3 秒后引发爆炸，造成范围伤害', icon: '法主' },
    { id: 'mage_charge', category: 'build', name: '蓄能', desc: '激光每 2 秒充能一次，下一次攻击造成 3 倍伤害并击退', icon: '法主' }
    ,
    { id: 'mage_arcane_perception', category: 'build', name: '奥术感知', desc: '奥术射线索敌范围提升（可叠加）', icon: '法主' },
    { id: 'mage_energy_focus', category: 'build', name: '能量汇集', desc: '奥术射线伤害 +10%，并随层数变粗更亮（可叠加）', icon: '法主' },
    { id: 'mage_arcane_split', category: 'build', name: '奥术分裂', desc: '多目标时额外分裂 1/2/3 股射线，分裂射线伤害为 50%（可叠加）', icon: '法主' }
  ],

  // 🛡️ 圣骑士·矛
  paladin: [
    { id: 'paladin_pierce', category: 'build', name: '重锤', desc: '锤击范围略微扩大，落点更靠前', icon: '骑主' },
    { id: 'paladin_holyfire', category: 'build', name: '圣焰', desc: '锤击命中后在地上留下圣焰，造成持续伤害', icon: '骑主' },
    { id: 'paladin_triple', category: 'build', name: '连锤', desc: '每 5 秒，下一次锤击额外追加 2 次余震落点', icon: '3X' },
    { id: 'paladin_stun', category: 'build', name: '制裁', desc: '锤击有 10%/20%/30% 概率使敌人眩晕', icon: '骑主' }
  ],

  // 🟣 术士·暗影箭
  warlock: [
    { id: 'warlock_toxicity', category: 'build', name: '毒性浓度', desc: '剧毒 debuff 最大层数 +1（可叠加，最多 3 层）', icon: '术主', maxLevel: 3 },
    { id: 'warlock_corrode', category: 'build', name: '腐蚀', desc: '毒圈持续时间 +1 秒（可叠加，最多 3 层）', icon: '术主', maxLevel: 3 },
    { id: 'warlock_spread', category: 'build', name: '扩散', desc: '毒圈范围 +20%（可叠加，最多 3 层）', icon: '术主', maxLevel: 3 }
  ]
};

// 自然伙伴：结契选择（固定三选一）
export const NATURE_CONTRACT_OPTIONS = [
  { id: 'druid_pet_bear', category: 'build', name: '契约：熊灵', desc: '熊：坦克与嘲讽，吸引火力', icon: '熊契' },
  { id: 'druid_pet_hawk', category: 'build', name: '契约：战鹰', desc: '鹰：高频打击，优先低血目标', icon: '鹰契' },
  { id: 'druid_pet_treant', category: 'build', name: '契约：树精', desc: '树精：周期治疗，偏续航', icon: '树契' }
];

// 通用天赋（副职业池）：纯被动
export const UNIVERSAL_POOLS = {
  // 🔵 法师·奥术
  arcane: [
    { id: 'arcane_swift', category: 'build', name: '迅捷', desc: '所有攻击的攻击速度/冷却时间 -8%', icon: '法副' },
    { id: 'arcane_enlighten', category: 'build', name: '启迪', desc: '每次升级三选一变为四选一（选项 +1）', icon: '+1' },
    { id: 'arcane_circle', category: 'build', name: '法阵', desc: '站立不动 2 秒后生成法阵：阵内攻击力 +20%，移动则消失', icon: '法副' }
  ],

  // 🟢 猎人·游侠
  ranger: [
    { id: 'ranger_precise', category: 'build', name: '精准', desc: '暴击率 +10%', icon: '猎副' },
    { id: 'ranger_agile', category: 'build', name: '灵巧', desc: '闪避率 +8%', icon: '猎副' },
    { id: 'ranger_hunter', category: 'build', name: '猎手', desc: '对生命值高于 80% 的敌人，暴击率额外 +15%', icon: '猎副' }
  ],

  // 🟠 战士·不屈
  unyielding: [
    { id: 'unyielding_bloodrage', category: 'build', name: '血怒', desc: '生命值每降低 10%，造成的伤害 +3%', icon: '战副' },
    { id: 'unyielding_battlecry', category: 'build', name: '战吼', desc: '受到伤害时，20% 概率触发：3 秒内伤害 +15%', icon: '战副' },
    { id: 'unyielding_duel', category: 'build', name: '死斗', desc: '生命值低于 30% 时，攻击速度 +25%', icon: '战副' }
  ],

  // 🟣 术士·诅咒
  curse: [
    { id: 'curse_corrosion', category: 'build', name: '腐蚀', desc: '攻击有 15% 概率施加剧毒：每秒造成 5% 攻击力伤害，持续 3 秒', icon: '术副' },
    { id: 'curse_weakness', category: 'build', name: '虚弱', desc: '攻击有 20% 概率使敌人造成的伤害 -15%，持续 3 秒', icon: '术副' },
    { id: 'curse_wither', category: 'build', name: '凋零', desc: '持续伤害效果可叠加 2 层', icon: '2X' }
  ],

  // 🛡️ 圣骑士·守护
  guardian: [
    { id: 'guardian_block', category: 'build', name: '坚盾', desc: '5% 概率格挡，格挡时减伤 50%', icon: '骑副' },
    { id: 'guardian_armor', category: 'build', name: '护甲', desc: '所有受到的伤害 -3（固定减伤）', icon: '-3' },
    { id: 'guardian_counter', category: 'build', name: '反制', desc: '格挡成功后，对攻击者造成 100% 攻击力的反击伤害', icon: '骑副' }
  ],

  // 🌿 德鲁伊·自然伙伴（第一层在 GameScene 强制提供“结契：熊/鹰/树精”）
  nature: []
};

// 第二次三选一：副职业“入门节点”选项（直接给真实被动/入口）
// 说明：
// - 选中这些节点时，会在 GameScene.applyUpgrade 中自动写入 offFaction
// - 自然伙伴：第二次三选一里直接出现“熊/鹰/树精”契约选项（不再需要中间入口）
export const OFF_FACTION_ENTRY_OPTIONS = [
  // 奥术 -> 迅捷
  { id: 'arcane_swift', category: 'build', name: '迅捷', desc: '所有攻击的攻击速度/冷却时间 -8%', icon: '法副' },
  // 游侠 -> 精准
  { id: 'ranger_precise', category: 'build', name: '精准', desc: '暴击率 +10%', icon: '猎副' },
  // 不屈 -> 血怒
  { id: 'unyielding_bloodrage', category: 'build', name: '血怒', desc: '生命值每降低 10%，造成的伤害 +3%', icon: '战副' },
  // 诅咒 -> 腐蚀
  { id: 'curse_corrosion', category: 'build', name: '腐蚀', desc: '攻击有 15% 概率施加剧毒：每秒造成 5% 攻击力伤害，持续 3 秒', icon: '术副' },
  // 守护 -> 坚盾
  { id: 'guardian_block', category: 'build', name: '坚盾', desc: '5% 概率格挡，格挡时减伤 50%', icon: '骑副' },
  // 自然伙伴：直接结契
  { id: 'druid_pet_bear', category: 'build', name: '契约：熊灵', desc: '熊：坦克与嘲讽，吸引火力', icon: '熊契' },
  { id: 'druid_pet_hawk', category: 'build', name: '契约：战鹰', desc: '鹰：高频打击，优先低血目标', icon: '鹰契' },
  { id: 'druid_pet_treant', category: 'build', name: '契约：树精', desc: '树精：周期治疗，偏续航', icon: '树契' }
];

// 自然伙伴：结契后只从对应分支强化池抽取
export const NATURE_BRANCH_POOLS = {
  bear: [
    { id: 'nature_bear_solidarity', category: 'build', name: '共担', desc: '玩家受到伤害时，熊灵替你承担一部分（可叠加）', icon: '熊副' },
    { id: 'nature_bear_strength', category: 'build', name: '蛮力', desc: '提高你的攻击力（可叠加）', icon: '熊副' },
    { id: 'nature_bear_carapace', category: 'build', name: '甲壳', desc: '降低你受到的伤害（可叠加）', icon: '熊副' },
    { id: 'nature_bear_rage', category: 'build', name: '自然之怒', desc: '熊灵受击后，你短时间内伤害提高（可叠加）', icon: '熊副' },
    { id: 'nature_bear_earthquake', category: 'build', name: '震地', desc: '熊灵受击时有概率眩晕 Boss 1 秒（可叠加）', icon: '熊副' },
    { id: 'nature_bear_thornshield', category: 'build', name: '荆棘护体', desc: '提高你的反伤比例（可叠加）', icon: '熊副' }
  ],
  hawk: [
    { id: 'nature_hawk_crit', category: 'build', name: '锐眼', desc: '暴击率提升（可叠加）', icon: '鹰副' },
    { id: 'nature_hawk_evade', category: 'build', name: '疾羽', desc: '闪避率提升（可叠加）', icon: '鹰副' },
    { id: 'nature_hawk_speed', category: 'build', name: '风行', desc: '移动速度提升（可叠加）', icon: '鹰副' },
    { id: 'nature_hawk_windslash', category: 'build', name: '风刃', desc: '战鹰周期性触发风刃追加伤害（可叠加）', icon: '鹰副' },
    { id: 'nature_hawk_skycall', category: 'build', name: '天降', desc: '战鹰攻击有概率引发额外打击（可叠加）', icon: '鹰副' },
    { id: 'nature_hawk_huntmark', category: 'build', name: '猎手标记', desc: '战鹰命中后给 Boss 上标记：你对其伤害提高（可叠加）', icon: '鹰副' }
  ],
  treant: [
    { id: 'nature_treant_regen', category: 'build', name: '回春', desc: '提高树精治疗量/频率（可叠加）', icon: '树副' },
    { id: 'nature_treant_root', category: 'build', name: '缠绕', desc: '树精治疗时有概率短暂定身 Boss（可叠加）', icon: '树副' },
    { id: 'nature_treant_armor', category: 'build', name: '树皮', desc: '提高固定减伤（可叠加）', icon: '树副' },
    { id: 'nature_treant_thorns', category: 'build', name: '荆棘', desc: '提高反伤比例（可叠加）', icon: '树副' },
    { id: 'nature_treant_summon', category: 'build', name: '萌芽', desc: '树精治疗时有概率额外提供护盾（可叠加）', icon: '树副' },
    { id: 'nature_treant_reborn', category: 'build', name: '再生', desc: '树精被击败后的回归冷却更短（可叠加）', icon: '树副' }
  ]
};

// ====== 第三天赋：深度专精 / 双职业专精（占位池，后续由策划填充） ======
// 设计约束：深度专精池 与 双职业池 完全互斥。
// - depth：主/副同主题（例如 法师主 + 奥术副 => 法师深度专精）
// - dual：主/副不同主题（例如 法师主 + 自然伙伴副 => 法师+德鲁伊双职业）

export const THIRD_SPEC_PREP_OPTIONS = {
  depth: { id: 'third_depth_prep', category: 'build', name: '深度专精（前置）', desc: '解锁深度专精天赋（稍后提供）', icon: '深度' },
  dual: { id: 'third_dual_prep', category: 'build', name: '双职业专精（前置）', desc: '解锁双职业天赋（稍后提供）', icon: '双职' }
};

// 深度专精池：按主职业主题拆分
export const DEPTH_SPEC_POOLS = {
  mage: [
    { id: 'mage_dualcaster', category: 'third_depth', name: '双倍施法', desc: '激光有 20% 概率同时发射两道（可叠加过热/蓄能）', icon: '法深', maxLevel: 1 },
    { id: 'mage_trilaser', category: 'third_depth', name: '三重激光', desc: '激光分裂为 3 道，每道伤害为原伤害的 60%', icon: '法深', maxLevel: 1 },
    { id: 'mage_arcanomorph', category: 'third_depth', name: '奥术化身', desc: '每层使法阵效果翻倍，且法阵内移动不消失（上限3层）', icon: '法深', maxLevel: 3 }
  ],
  scatter: [
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
      { id: 'dual_mage_drone_natureoverflow', category: 'third_dual', name: '自然溢流', desc: '你的启迪（四选一）对德鲁伊宠物强化天赋也生效', icon: '法德', maxLevel: 1 }
    ]
  },
  scatter: {
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
    scatter: [
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
  archer: 'scatter',
  druid: 'drone',
  warrior: 'warrior',
  mage: 'mage',
  paladin: 'paladin',
  warlock: 'warlock'
};
