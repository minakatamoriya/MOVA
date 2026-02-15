export const ITEM_DEFS = [
  { id: 'damage_up', name: 'Damage +', desc: '提升攻击力', icon: '⚔️', price: 120, effects: { damageMult: 1.15 } },
  { id: 'fire_rate', name: 'Fire Rate', desc: '提升射速', icon: '⚡', price: 140, effects: { fireRateMult: 0.85 } },
  { id: 'move_speed', name: 'Move Speed', desc: '提升移速', icon: '👟', price: 100, effects: { speedMult: 1.15 } },
  { id: 'shield', name: 'Shield', desc: '获得护盾', icon: '🛡️', price: 180, effects: { shieldCharges: 1 } },
  { id: 'crit', name: 'Crit', desc: '提升暴击率', icon: '🎯', price: 160, effects: { critChance: 0.1, critMultiplier: 0.5 } },
  { id: 'range', name: 'Range', desc: '提升攻击范围', icon: '🏹', price: 110, effects: {} },
  { id: 'lifesteal', name: 'Lifesteal', desc: '攻击吸血', icon: '🩸', price: 200, effects: { lifestealPercent: 0.05 } },
  { id: 'magnet', name: 'Magnet', desc: '吸附掉落物', icon: '🧲', price: 90, effects: { magnetRadius: 100 } },

  // ====== 局内战利品（一次性，死亡/退出清空，不进入装备系统） ======
  // 约定：shard.pct 表示“每个碎片提供的百分比（0.01=1%）”，可叠加。
  { id: 'shard_fire', name: '火元素碎片', desc: '攻击力 +1%（可叠加）', icon: '🔥', price: 0, kind: 'shard', effects: {}, shard: { stat: 'damage', pct: 0.01 } },
  { id: 'shard_water', name: '水元素碎片', desc: '移动速度 +1%（可叠加）', icon: '💧', price: 0, kind: 'shard', effects: {}, shard: { stat: 'moveSpeed', pct: 0.01 } },
  { id: 'shard_wind', name: '风元素碎片', desc: '攻击速度 +1%（可叠加）', icon: '🌪️', price: 0, kind: 'shard', effects: {}, shard: { stat: 'attackSpeed', pct: 0.01 } },

  // ====== 消耗品（装备后自动触发） ======
  {
    id: 'potion_small',
    name: '血瓶',
    desc: '生命低于30%自动使用，回复30%生命（20秒冷却）',
    icon: '🧪',
    price: 0,
    kind: 'consumable',
    effects: {},
    consumable: { mode: 'autoHeal', thresholdPct: 0.3, healPct: 0.3, cooldownMs: 20000 }
  },
  {
    id: 'potion_big',
    name: '大血瓶',
    desc: '生命低于30%自动使用，回复50%生命（60秒冷却）',
    icon: '🧴',
    price: 0,
    kind: 'consumable',
    effects: {},
    consumable: { mode: 'autoHeal', thresholdPct: 0.3, healPct: 0.5, cooldownMs: 60000 }
  },
  {
    id: 'revive_cross',
    name: '复活十字章',
    desc: '死亡后自动复活（一次性），保留当前经验/金币',
    icon: '✝️',
    price: 0,
    kind: 'consumable',
    effects: {},
    consumable: { mode: 'revive', reviveHpPct: 0.4 }
  },

  // ====== 被动增益（装备后生效） ======
  { id: 'passive_move10', name: '轻盈短靴', desc: '移动速度 +10%', icon: '移', price: 0, kind: 'passive', effects: { speedMult: 1.10 } },
  { id: 'passive_damage10', name: '强袭徽记', desc: '攻击力 +10%', icon: '攻', price: 0, kind: 'passive', effects: { damageMult: 1.10 } },
  { id: 'passive_as15', name: '急速指环', desc: '攻击速度 +15%', icon: '速', price: 0, kind: 'passive', effects: { fireRateMult: 0.87 } },
  { id: 'passive_dodge5', name: '闪避饰品', desc: '闪避 +5%（触发 MISS）', icon: '闪', price: 0, kind: 'passive', effects: { dodgeChance: 0.05 } }
];

export function getItemById(id) {
  return ITEM_DEFS.find(item => item.id === id) || null;
}
