/**
 * 关卡数值平衡配置
 * - 目标：所有“每关数量/血量/速度/经验/门与Boss位置”集中在这里，方便快速调整
 * - 约定：stage 从 1 开始（对应 currentStage）
 */

export const BALANCE_CONSTANTS = {
  // 出口门（击败 Boss 后出现）的默认位置（相对 cellSize）
  exitDoor: {
    yFrac: 0.35,
    widthCells: 1.2,
    heightCells: 0.8,
  },

  // Boss 生成点：固定在“出口门下方”
  boss: {
    // bossY = exitDoorCenterY + exitDoorHeight/2 + belowDoorOffsetCells * cellSize
    // 以“门底边”为基准更直观，确保 Boss 固定出现在门前下方一定距离。
    belowDoorOffsetCells: 0.50,

    // Boss 活动范围：以“出口门中心”为基准的固定区域（单位：cellSize）。
    // 目的：Boss 不会跑到地图深处，也避免因边界 clamp 产生“漂移”。
    arenaHalfWidthCells: 5.0,
    arenaHalfHeightCells: 4.0,
  },

  // 小怪“看到玩家后缓缓接近”的速度爬升
  aggro: {
    rampMs: 650,
  },
};

const STAGE_OVERRIDES = {
  1: {
    minions: {
      countMin: 20,
      countMax: 24,
      hp: 60,
      exp: 12,
      speed: { chaser: 60, shooter: 52, patrol: 40, static: 0 },
      contactDamage: 6,
      projectiles: {
        enabled: true,
        cdMs: 1600,
        count: 1,
        spread: 0.10,
        speed: 145,
        damage: 5,
      },
    },
    elites: {
      countMin: 1,
      countMax: 1,
      hp: 220,
      exp: 90,
      speed: { chaser: 55, shooter: 50, patrol: 42, static: 0 },
      contactDamage: 10,
      projectiles: {
        enabled: true,
        cdMs: 1500,
        count: 1,
        spread: 0.12,
        speed: 150,
        damage: 6,
      },
    },
    boss: {
      hp: 420,
      moveSpeed: 45,
    },
  },

  2: {
    minions: {
      countMin: 24,
      countMax: 28,
      hp: 75,
      exp: 14,
      speed: { chaser: 66, shooter: 55, patrol: 42, static: 0 },
      contactDamage: 7,
      projectiles: {
        enabled: true,
        cdMs: 1450,
        count: 1,
        spread: 0.12,
        speed: 155,
        damage: 6,
      },
    },
    elites: {
      countMin: 2,
      countMax: 2,
      hp: 280,
      exp: 110,
      speed: { chaser: 60, shooter: 52, patrol: 45, static: 0 },
      contactDamage: 12,
      projectiles: {
        enabled: true,
        cdMs: 1400,
        count: 1,
        spread: 0.14,
        speed: 160,
        damage: 7,
      },
    },
    boss: {
      hp: 520,
      moveSpeed: 48,
    },
  },
};

function scaleStageValue(base, stage, perStageMult, minValue = 1) {
  const s = Math.max(1, Math.floor(stage || 1));
  const mult = Math.pow(perStageMult, Math.max(0, s - 1));
  return Math.max(minValue, Math.round(base * mult));
}

/**
 * 获取某一关（stage）的平衡参数。
 * - stage 1/2 有明确覆盖
 * - 3+ 按指数缓慢上调（保持割草感，不会突然暴涨）
 */
export function getStageBalance(stage) {
  const s = Math.max(1, Math.floor(stage || 1));

  // 默认基线（用于 stage >= 3 的推导）以 stage2 为基础
  const base = STAGE_OVERRIDES[2];

  const derived = {
    minions: {
      countMin: scaleStageValue(base.minions.countMin, s, 1.03, 18),
      countMax: scaleStageValue(base.minions.countMax, s, 1.03, 22),
      hp: scaleStageValue(base.minions.hp, s, 1.12, 40),
      exp: scaleStageValue(base.minions.exp, s, 1.08, 6),
      speed: { ...base.minions.speed },
      contactDamage: scaleStageValue(base.minions.contactDamage, s, 1.10, 1),
      projectiles: {
        enabled: true,
        cdMs: 1200,
        count: 2,
        spread: 0.18,
        speed: 175,
        damage: 8,
        ...(base.minions.projectiles || {})
      },
    },
    elites: {
      countMin: scaleStageValue(base.elites.countMin, s, 1.02, 1),
      countMax: scaleStageValue(base.elites.countMax, s, 1.02, 1),
      hp: scaleStageValue(base.elites.hp, s, 1.12, 80),
      exp: scaleStageValue(base.elites.exp, s, 1.08, 20),
      speed: { ...base.elites.speed },
      contactDamage: scaleStageValue(base.elites.contactDamage, s, 1.10, 1),
      projectiles: {
        enabled: true,
        cdMs: 1150,
        count: 2,
        spread: 0.20,
        speed: 180,
        damage: 9,
        ...(base.elites.projectiles || {})
      },
    },
    boss: {
      hp: scaleStageValue(base.boss.hp, s, 1.18, 120),
      moveSpeed: scaleStageValue(base.boss.moveSpeed, s, 1.02, 25),
    },
  };

  const override = STAGE_OVERRIDES[s];
  if (!override) return derived;

  return {
    minions: {
      ...derived.minions,
      ...override.minions,
      speed: { ...derived.minions.speed, ...(override.minions?.speed || {}) },
      projectiles: { ...derived.minions.projectiles, ...(override.minions?.projectiles || {}) },
    },
    elites: {
      ...derived.elites,
      ...override.elites,
      speed: { ...derived.elites.speed, ...(override.elites?.speed || {}) },
      projectiles: { ...derived.elites.projectiles, ...(override.elites?.projectiles || {}) },
    },
    boss: { ...derived.boss, ...override.boss },
  };
}

export function getExitDoorWorldRect(mapConfig) {
  const cfg = mapConfig;
  if (!cfg) return { x: 0, y: 0, w: 0, h: 0 };

  const worldSize = cfg.gridSize * cfg.cellSize;
  const x = Math.floor(worldSize / 2);
  const y = Math.floor(cfg.cellSize * BALANCE_CONSTANTS.exitDoor.yFrac);
  const w = cfg.cellSize * BALANCE_CONSTANTS.exitDoor.widthCells;
  const h = cfg.cellSize * BALANCE_CONSTANTS.exitDoor.heightCells;

  return { x, y, w, h };
}

export function getBossSpawnWorldPoint(mapConfig) {
  const cfg = mapConfig;
  if (!cfg) return { x: 0, y: 0 };

  // 以“出口门”几何位置推导 Boss 出场点：门底边 + 偏移
  const door = getExitDoorWorldRect(cfg);
  const x = Math.floor(door.x);
  const y = Math.floor(door.y + (door.h * 0.5) + (cfg.cellSize * BALANCE_CONSTANTS.boss.belowDoorOffsetCells));

  return { x, y };
}

export function getBossArenaWorldRect(mapConfig) {
  const cfg = mapConfig;
  if (!cfg) return { x: 0, y: 0, width: 0, height: 0 };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const worldSize = cfg.gridSize * cfg.cellSize;
  const door = getExitDoorWorldRect(cfg);
  const cx = Number(door.x) || 0;
  const cy = Number(door.y) || 0;

  const halfW = Math.max(1, (cfg.cellSize || 128) * (BALANCE_CONSTANTS.boss.arenaHalfWidthCells || 5));
  const halfH = Math.max(1, (cfg.cellSize || 128) * (BALANCE_CONSTANTS.boss.arenaHalfHeightCells || 4));

  let left = Math.floor(cx - halfW);
  let right = Math.floor(cx + halfW);
  let top = Math.floor(cy - halfH);
  let bottom = Math.floor(cy + halfH);

  left = clamp(left, 0, Math.max(0, worldSize - 1));
  right = clamp(right, 1, worldSize);
  top = clamp(top, 0, Math.max(0, worldSize - 1));
  bottom = clamp(bottom, 1, worldSize);

  // 保证至少 2px 宽高
  if (right - left < 2) right = Math.min(worldSize, left + 2);
  if (bottom - top < 2) bottom = Math.min(worldSize, top + 2);

  return { x: left, y: top, width: right - left, height: bottom - top };
}
