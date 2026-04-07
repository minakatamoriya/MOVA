/**
 * ═══════════════════════════════════════════════════
 *  Boss 原型 B · 远程调度模板
 * ═══════════════════════════════════════════════════
 *
 * 定位：远程弹幕型 Boss，保持距离 + 多种弹型交替施放。
 *
 * 攻击时间线：
 *   ① 螺旋弹幕（spiral） — 持续旋转射出，迫使玩家走位
 *   ② 瞄准扇形（aimed fan） — 快速朝玩家方向射出扇形弹
 *   ③ 预警 + 延迟爆发（telegraph → burst ring）
 *   ④ <50% 血量 → 狂暴：双层螺旋 + 更密集的爆发
 *
 * 招式循环 (cycle)：
 *   Normal:  spiral → fan → telegraph burst → (重复)
 *   Enraged: 双层 spiral → fan(更多弹) → double burst → (重复)
 */

import Phaser from 'phaser';

// ─── Boss 元数据 ────────────────────────────────
export const BOSS_META = {
  name: 'Boss 原型 B',
  color: 0x9966ff,
};

// ─── 数值常量 ───────────────────────────────────
const CYCLE_INTERVAL = 3200;           // 普通周期间隔 ms
const ENRAGE_CYCLE_INTERVAL = 2400;    // 狂暴周期间隔 ms
const ENRAGE_HP_RATIO = 0.5;

// 螺旋弹幕
const SPIRAL_SHOTS = 10;
const SPIRAL_DELAY_MS = 70;            // 每发间隔
const SPIRAL_SPEED = 155;
const SPIRAL_DAMAGE = 8;
const SPIRAL_RADIUS = 7;

// 扇形
const FAN_COUNT = 7;
const FAN_SPREAD_DEG = 12;
const FAN_SPEED = 175;
const FAN_DAMAGE = 9;
const FAN_RADIUS = 8;
const FAN_ENRAGE_COUNT = 10;

// 延迟爆发
const BURST_TELEGRAPH_MS = 750;
const BURST_RING_COUNT = 12;
const BURST_SPEED = 140;
const BURST_DAMAGE = 9;
const BURST_RADIUS = 7;
const BURST_TELEGRAPH_RADIUS = 60;
const BURST_ENRAGE_RING_COUNT = 16;

// ─── 辅助 ───────────────────────────────────────
function getTargetPoint(target) {
  if (!target) return null;
  if (typeof target.getHitboxPosition === 'function') {
    const hp = target.getHitboxPosition();
    if (hp && Number.isFinite(hp.x) && Number.isFinite(hp.y)) {
      return { x: hp.x, y: hp.y, radius: Math.max(0, Number(hp.radius || 0)) };
    }
  }
  return {
    x: Number(target.x || 0),
    y: Number(target.y || 0),
    radius: Math.max(0, Number(target.hitRadius || target.visualRadius || 0)),
  };
}

function isEnraged(boss) {
  if (!boss?.isAlive) return false;
  return (boss.currentHp / boss.maxHp) <= ENRAGE_HP_RATIO;
}

// ─── 招式：螺旋弹幕 ─────────────────────────────
function castSpiral(boss) {
  const scene = boss.scene;
  if (!scene?.patternSystem) return;

  const enraged = isEnraged(boss);
  const loops = enraged ? 2 : 1;
  const shotsPerLoop = SPIRAL_SHOTS;
  const damage = boss.scaleAttackDamage?.(SPIRAL_DAMAGE) ?? SPIRAL_DAMAGE;

  // 蓄力闪光
  scene.vfxSystem?.playCastFlash?.(boss.x, boss.y, {
    color: 0xbb88ff,
    radius: 28,
    durationMs: 160,
  });

  scene.patternSystem.emitSpiral({
    side: 'boss',
    x: boss.x,
    y: boss.y,
    loops,
    shotsPerLoop,
    delayMs: SPIRAL_DELAY_MS,
    speed: SPIRAL_SPEED,
    color: 0xaa77ff,
    radius: SPIRAL_RADIUS,
    damage,
    tags: ['stage2_spiral'],
    options: {
      type: 'diamond',
      hasTrail: true,
      trailColor: 0xcc99ff,
      hasGlow: false,
    },
  });
}

// ─── 招式：瞄准扇形 ──────────────────────────────
function castAimedFan(boss) {
  const scene = boss.scene;
  if (!scene?.patternSystem) return;

  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!target?.active || target.isAlive === false) return;

  const tp = getTargetPoint(target);
  if (!tp) return;

  const enraged = isEnraged(boss);
  const count = enraged ? FAN_ENRAGE_COUNT : FAN_COUNT;
  const damage = boss.scaleAttackDamage?.(FAN_DAMAGE) ?? FAN_DAMAGE;

  scene.vfxSystem?.playCastFlash?.(boss.x, boss.y, {
    color: 0xddaaff,
    radius: 24,
    durationMs: 120,
  });

  scene.patternSystem.emitFan({
    side: 'boss',
    x: boss.x,
    y: boss.y,
    target: { x: tp.x, y: tp.y },
    count,
    spreadRad: Phaser.Math.DegToRad(FAN_SPREAD_DEG),
    speed: FAN_SPEED,
    color: 0xcc88ff,
    radius: FAN_RADIUS,
    damage,
    tags: ['stage2_fan'],
    options: {
      type: 'diamond',
      hasTrail: true,
      trailColor: 0xddaaff,
      hasGlow: false,
    },
  });
}

// ─── 招式：预警 + 延迟爆发 ──────────────────────
function castTelegraphBurst(boss) {
  const scene = boss.scene;
  if (!scene?.attackTimeline?.startTimeline) return;

  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!target?.active || target.isAlive === false) return;

  const tp = getTargetPoint(target);
  if (!tp) return;

  const enraged = isEnraged(boss);
  const ringCount = enraged ? BURST_ENRAGE_RING_COUNT : BURST_RING_COUNT;
  const telegraphRadius = enraged ? BURST_TELEGRAPH_RADIUS + 18 : BURST_TELEGRAPH_RADIUS;
  const damage = boss.scaleAttackDamage?.(BURST_DAMAGE) ?? BURST_DAMAGE;

  boss.showAlertIcon?.(BURST_TELEGRAPH_MS);

  scene.vfxSystem?.playCharge?.(boss.x, boss.y, {
    radius: 18,
    color: 0xbb88ff,
    durationMs: 240,
  });

  scene.attackTimeline.stopOwnerTimelines?.(boss);
  scene.attackTimeline.startTimeline({
    prefix: 'stage2_burst',
    owner: boss,
    phases: [
      {
        durationMs: BURST_TELEGRAPH_MS + 100,
        onEnter: () => {
          const tg = scene.patternSystem?.emitGroundTelegraph?.({
            x: tp.x,
            y: tp.y,
            telegraphRadius,
            telegraphColor: 0xaa66ff,
            durationMs: BURST_TELEGRAPH_MS,
          });
          if (tg) boss._trackHazardObject?.(tg);
        },
        events: [
          {
            atMs: BURST_TELEGRAPH_MS,
            run: () => {
              if (!boss.isAlive) return;

              scene.vfxSystem?.playBurst?.(tp.x, tp.y, {
                radius: telegraphRadius,
                color: 0xbb88ff,
                durationMs: 200,
              });

              scene.patternSystem?.emitRing?.({
                side: 'boss',
                x: tp.x,
                y: tp.y,
                count: ringCount,
                offsetRad: Phaser.Math.DegToRad(Math.random() * 360),
                speed: BURST_SPEED,
                color: 0xaa77ff,
                radius: BURST_RADIUS,
                damage,
                tags: ['stage2_burst_ring'],
                options: {
                  type: 'circle',
                  hasTrail: true,
                  trailColor: 0xcc99ff,
                  hasGlow: false,
                },
              });
            },
          },
        ],
      },
    ],
  });
}

// ─── 招式循环计数器 ──────────────────────────────
const CYCLE_SEQUENCE = [castSpiral, castAimedFan, castTelegraphBurst];

// 使用 WeakMap 为每个 Boss 实例维护独立的循环索引
const _cycleIndexMap = new WeakMap();

function getNextCycleIndex(boss) {
  const idx = _cycleIndexMap.get(boss) || 0;
  _cycleIndexMap.set(boss, (idx + 1) % CYCLE_SEQUENCE.length);
  return idx;
}

// ─── 主执行函数 ──────────────────────────────────
function executeStage2Pattern(boss) {
  if (!boss?.isAlive) return;

  const scene = boss.scene;
  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!scene || !target?.active || target.isAlive === false) return;

  // 近身时也用扇形弹幕逼退（奥术型不会近战）
  const tp = getTargetPoint(target);
  if (!tp) return;

  const dx = tp.x - boss.x;
  const dy = tp.y - boss.y;
  const dist = Math.hypot(dx, dy);

  // 如果玩家贴脸（<120），用扇形弹幕逼退
  if (dist < 120) {
    castAimedFan(boss);
    return;
  }

  // 正常循环
  const idx = getNextCycleIndex(boss);
  CYCLE_SEQUENCE[idx](boss);
}

// ─── 导出 ────────────────────────────────────────
/**
 * 生成第 2 关 Boss 的攻击模式列表。
 * @param {BaseBoss} boss
 */
export function getAttackPatterns(boss) {
  return [
    {
      get interval() {
        return isEnraged(boss) ? ENRAGE_CYCLE_INTERVAL : CYCLE_INTERVAL;
      },
      execute: executeStage2Pattern,
    },
  ];
}
