/**
 * ═══════════════════════════════════════════════════
 *  第 1 关 Boss · 裂牙兽王
 * ═══════════════════════════════════════════════════
 *
 * 定位：近战肉搏型 Boss，追踪玩家 + 近战挥砍为核心。
 *
 * 攻击时间线：
 *   ① 近距离 → 半月斩（crescent slash）
 *   ② 中距离 → 地面震波（ground slam / ring）
 *   ③ <50% 血量 → 狂暴（攻击频率加快，震波范围增大）
 *
 * 所有攻击走 AttackTimeline + PatternSystem，数据与逻辑分离。
 */

import Phaser from 'phaser';

// ─── Boss 元数据 ────────────────────────────────
export const BOSS_META = {
  name: '裂牙兽王',
  color: 0xdd7733,
};

// ─── 数值常量（方便调参）──────────────────────────
const NORMAL_INTERVAL = 2600;       // 普通阶段攻击间隔 ms
const ENRAGE_INTERVAL = 1800;       // 狂暴阶段攻击间隔 ms
const ENRAGE_HP_RATIO = 0.5;        // 血量低于此比例进入狂暴

// 半月斩参数
const SLASH_RANGE_BASE = 160;       // 基础判定范围
const SLASH_ARC_DEG = 150;          // 弧度
const SLASH_WINDUP_MS = 500;        // 起手时间
const SLASH_MS = 600;               // 斩击动画时间
const SLASH_DAMAGE = 12;            // 基础伤害

// 地面震波参数
const SLAM_TELEGRAPH_MS = 800;      // 预警时间
const SLAM_RING_COUNT = 10;         // 环形弹幕数量
const SLAM_SPEED = 130;             // 弹速
const SLAM_RADIUS = 8;             // 弹丸半径
const SLAM_DAMAGE = 10;             // 环形弹伤害
const SLAM_TELEGRAPH_RADIUS = 72;   // 预警圈大小
const SLAM_ENRAGE_RING_COUNT = 14;  // 狂暴阶段环形数量

// ─── 辅助：获取玩家目标点 ─────────────────────────
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

// ─── 是否进入狂暴阶段 ──────────────────────────────
function isEnraged(boss) {
  if (!boss || !boss.isAlive) return false;
  return (boss.currentHp / boss.maxHp) <= ENRAGE_HP_RATIO;
}

// ─── 攻击：半月斩 ─────────────────────────────────
function executeSlash(boss) {
  const scene = boss.scene;
  if (!scene) return;

  const enraged = isEnraged(boss);

  // 狂暴时弧度更大、起手更快
  const arcDeg = enraged ? 200 : SLASH_ARC_DEG;
  const windupMs = enraged ? 360 : SLASH_WINDUP_MS;
  const damage = enraged ? Math.round(SLASH_DAMAGE * 1.3) : SLASH_DAMAGE;

  boss.castCrescentSlashAtPlayer({
    range: SLASH_RANGE_BASE + (boss.bossSize || 44),
    arcDeg,
    windupMs,
    slashMs: SLASH_MS,
    lingerMs: 380,
    color: enraged ? 0xff6633 : 0xffaa55,
    damage,
  });
}

// ─── 攻击：地面震波 ─────────────────────────────────
function executeSlamTimeline(boss) {
  const scene = boss.scene;
  if (!scene?.attackTimeline?.startTimeline) return;

  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!target?.active || target.isAlive === false) return;

  const tp = getTargetPoint(target);
  if (!tp) return;

  const enraged = isEnraged(boss);
  const ringCount = enraged ? SLAM_ENRAGE_RING_COUNT : SLAM_RING_COUNT;
  const telegraphRadius = enraged ? SLAM_TELEGRAPH_RADIUS + 20 : SLAM_TELEGRAPH_RADIUS;

  // 头顶预警图标
  boss.showAlertIcon?.(SLAM_TELEGRAPH_MS);

  // 蓄力特效
  scene.vfxSystem?.playCharge?.(boss.x, boss.y, {
    radius: 20,
    color: 0xff8844,
    durationMs: 280,
  });

  scene.attackTimeline.stopOwnerTimelines?.(boss);
  scene.attackTimeline.startTimeline({
    prefix: 'stage1_slam',
    owner: boss,
    phases: [
      {
        durationMs: SLAM_TELEGRAPH_MS + 100,
        onEnter: () => {
          // 地面预警圈
          const telegraph = scene.patternSystem?.emitGroundTelegraph?.({
            x: tp.x,
            y: tp.y,
            telegraphRadius,
            telegraphColor: 0xff6644,
            durationMs: SLAM_TELEGRAPH_MS,
          });
          if (telegraph) boss._trackHazardObject?.(telegraph);
        },
        events: [
          {
            // 预警结束 → 爆发环形弹幕
            atMs: SLAM_TELEGRAPH_MS,
            run: () => {
              if (!boss.isAlive) return;

              // 爆发特效
              scene.vfxSystem?.playBurst?.(tp.x, tp.y, {
                radius: telegraphRadius,
                color: 0xff9955,
                durationMs: 200,
              });

              // 环形弹幕从落点向外扩散
              scene.patternSystem?.emitRing?.({
                side: 'boss',
                x: tp.x,
                y: tp.y,
                count: ringCount,
                offsetRad: Phaser.Math.DegToRad(Math.random() * 360),
                speed: SLAM_SPEED,
                color: 0xff8844,
                radius: SLAM_RADIUS,
                damage: SLAM_DAMAGE,
                tags: ['stage1_slam_ring'],
                options: {
                  type: 'circle',
                  hasTrail: true,
                  trailColor: 0xffaa66,
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

// ─── 主执行函数（由 BaseBoss attackPatterns 调度）──
function executeStage1Pattern(boss) {
  if (!boss?.isAlive) return;

  const scene = boss.scene;
  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!scene || !target?.active || target.isAlive === false) return;

  const tp = getTargetPoint(target);
  if (!tp) return;

  const dx = tp.x - boss.x;
  const dy = tp.y - boss.y;
  const dist = Math.hypot(dx, dy);

  // 禁入圈距离
  const padding = scene.bossNoGoPadding ?? 0;
  const meleeRange = Math.max(150, (boss.bossSize || 44) + padding + (tp.radius || 0) + 30);

  if (dist <= meleeRange) {
    // 近距离 → 半月斩
    executeSlash(boss);
  } else {
    // 中远距离 → 地面震波
    executeSlamTimeline(boss);
  }
}

// ─── 导出：攻击模式数组 ──────────────────────────
/**
 * 生成第 1 关 Boss 的攻击模式列表。
 * 返回值直接赋给 BaseBoss.attackPatterns。
 * @param {BaseBoss} boss  Boss 实例（用于检查血量阶段等）
 */
export function getAttackPatterns(boss) {
  return [
    {
      // interval 会在 BaseBoss.startAttackPattern 里用 TimerEvent 循环触发
      get interval() {
        return isEnraged(boss) ? ENRAGE_INTERVAL : NORMAL_INTERVAL;
      },
      execute: executeStage1Pattern,
    },
  ];
}
