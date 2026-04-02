/**
 * ═══════════════════════════════════════════════════
 *  第 3 关 Boss · 深渊守卫
 * ═══════════════════════════════════════════════════
 *
 * 定位：混合型 Boss，近战 + 弹幕 + 召唤小怪。
 *
 * 攻击时间线：
 *   Phase 1 (HP > 50%)：
 *     ① 追踪 + 扇形弹幕（fan aimed at player）
 *     ② 半月斩（近距离时）
 *     ③ 召唤 2 只小怪
 *
 *   Phase 2 (HP <= 50% · 狂暴)：
 *     ① 3 方向扇形弹幕（cross fan）
 *     ② 半月斩弧度扩大至 220°
 *     ③ 召唤 3 只小怪 + 速度提升 30%
 *     ④ 地面裂缝预警 + 十字线弹幕
 *
 * 招式循环:
 *   Normal:  fan → slash/slam → summon → fan → slash/slam → ...
 *   Enraged: cross-fan → slash → cross-crack → summon → ...
 */

import Phaser from 'phaser';

// ─── Boss 元数据 ────────────────────────────────
export const BOSS_META = {
  name: '深渊守卫',
  color: 0x446688,
};

// ─── 数值常量 ───────────────────────────────────
const CYCLE_INTERVAL = 3000;
const ENRAGE_CYCLE_INTERVAL = 2200;
const ENRAGE_HP_RATIO = 0.5;
const ENRAGE_SPEED_MULT = 1.3;        // 狂暴时移速倍率

// 扇形弹幕
const FAN_COUNT = 5;
const FAN_SPREAD_DEG = 14;
const FAN_SPEED = 160;
const FAN_DAMAGE = 9;
const FAN_RADIUS = 8;
const CROSS_FAN_DIRECTIONS = 3;       // 狂暴时多方向扇形

// 半月斩
const SLASH_RANGE_BASE = 155;
const SLASH_ARC_DEG = 140;
const SLASH_ENRAGE_ARC_DEG = 220;
const SLASH_WINDUP_MS = 480;
const SLASH_MS = 600;
const SLASH_DAMAGE = 14;

// 召唤
const SUMMON_COUNT_NORMAL = 2;
const SUMMON_COUNT_ENRAGE = 3;
const SUMMON_HP = 60;
const SUMMON_SIZE = 14;
const SUMMON_SPEED = 72;
const SUMMON_CONTACT_DAMAGE = 8;
const SUMMON_OFFSET = 80;             // 生成偏移距离

// 十字线弹幕（狂暴专属）
const CROSS_TELEGRAPH_MS = 700;
const CROSS_LINE_COUNT = 4;           // 4 条线（十字）
const CROSS_BULLETS_PER_LINE = 5;
const CROSS_SPEED = 140;
const CROSS_DAMAGE = 10;
const CROSS_RADIUS = 7;

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

// ─── 招式：扇形弹幕 ──────────────────────────────
function castFan(boss) {
  const scene = boss.scene;
  if (!scene?.patternSystem) return;

  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!target?.active || target.isAlive === false) return;

  const tp = getTargetPoint(target);
  if (!tp) return;

  const enraged = isEnraged(boss);

  scene.vfxSystem?.playCastFlash?.(boss.x, boss.y, {
    color: 0x5588bb,
    radius: 26,
    durationMs: 140,
  });

  if (!enraged) {
    // 普通：单方向扇形
    scene.patternSystem.emitFan({
      side: 'boss',
      x: boss.x,
      y: boss.y,
      target: { x: tp.x, y: tp.y },
      count: FAN_COUNT,
      spreadRad: Phaser.Math.DegToRad(FAN_SPREAD_DEG),
      speed: FAN_SPEED,
      color: 0x5588cc,
      radius: FAN_RADIUS,
      damage: FAN_DAMAGE,
      tags: ['stage3_fan'],
      options: { type: 'diamond', hasTrail: true, trailColor: 0x77aadd, hasGlow: false },
    });
  } else {
    // 狂暴：多方向扇形（以玩家方向为中心均匀展开）
    const baseAngle = Math.atan2(tp.y - boss.y, tp.x - boss.x);
    const angleStep = Phaser.Math.PI2 / CROSS_FAN_DIRECTIONS;

    for (let d = 0; d < CROSS_FAN_DIRECTIONS; d++) {
      const angle = baseAngle + d * angleStep;
      scene.patternSystem.emitFan({
        side: 'boss',
        x: boss.x,
        y: boss.y,
        angle,
        count: FAN_COUNT,
        spreadRad: Phaser.Math.DegToRad(FAN_SPREAD_DEG),
        speed: FAN_SPEED,
        color: 0x7744aa,
        radius: FAN_RADIUS,
        damage: FAN_DAMAGE,
        tags: ['stage3_cross_fan'],
        options: { type: 'diamond', hasTrail: true, trailColor: 0x9966cc, hasGlow: false },
      });
    }
  }
}

// ─── 招式：半月斩 ─────────────────────────────────
function castSlash(boss) {
  const enraged = isEnraged(boss);

  boss.castCrescentSlashAtPlayer({
    range: SLASH_RANGE_BASE + (boss.bossSize || 44),
    arcDeg: enraged ? SLASH_ENRAGE_ARC_DEG : SLASH_ARC_DEG,
    windupMs: SLASH_WINDUP_MS,
    slashMs: SLASH_MS,
    lingerMs: 350,
    color: enraged ? 0x8855cc : 0x5588bb,
    damage: enraged ? Math.round(SLASH_DAMAGE * 1.25) : SLASH_DAMAGE,
  });
}

// ─── 招式：召唤小怪 ──────────────────────────────
function castSummon(boss) {
  const scene = boss.scene;
  if (!scene) return;

  const bossManager = scene.bossManager;
  if (!bossManager) return;

  const enraged = isEnraged(boss);
  const count = enraged ? SUMMON_COUNT_ENRAGE : SUMMON_COUNT_NORMAL;

  // 召唤预警
  boss.showAlertIcon?.(600);
  scene.vfxSystem?.playCharge?.(boss.x, boss.y, {
    radius: 24,
    color: 0x446688,
    durationMs: 300,
  });

  // 延迟 400ms 后生成小怪（给玩家反应时间）
  const timer = scene.time?.delayedCall?.(400, () => {
    if (!boss.isAlive || !scene?.sys?.isActive()) return;

    for (let i = 0; i < count; i++) {
      // 围绕 Boss 均匀分布
      const angle = (Phaser.Math.PI2 / count) * i + Math.random() * 0.4;
      const spawnX = boss.x + Math.cos(angle) * SUMMON_OFFSET;
      const spawnY = boss.y + Math.sin(angle) * SUMMON_OFFSET;

      // 使用已有的 TestMinion 作为召唤物
      try {
        const TestMinion = scene._TestMinionClass;
        if (!TestMinion) continue;

        const minion = new TestMinion(scene, {
          x: spawnX,
          y: spawnY,
          name: '深渊爪牙',
          type: 'chaser',
          hp: SUMMON_HP,
          size: SUMMON_SIZE,
          moveSpeed: SUMMON_SPEED,
          contactDamage: SUMMON_CONTACT_DAMAGE,
          color: 0x556688,
          expReward: 0,
          isSummon: true,
          noKillRewards: true,
        });

        // 生成特效
        scene.vfxSystem?.playBurst?.(spawnX, spawnY, {
          radius: 20,
          color: 0x446688,
          durationMs: 180,
        });

        // 注册到 BossManager 的 minions 列表
        if (Array.isArray(bossManager.minions)) {
          bossManager.minions.push(minion);
        }
      } catch (e) {
        console.warn('[Stage3Boss] 召唤小怪失败:', e);
      }
    }
  });

  if (timer) boss._trackHazardTimer?.(timer);
}

// ─── 招式：十字线弹幕（狂暴专属）────────────────
function castCrossCrack(boss) {
  const scene = boss.scene;
  if (!scene?.attackTimeline?.startTimeline) return;

  boss.showAlertIcon?.(CROSS_TELEGRAPH_MS);

  scene.vfxSystem?.playCharge?.(boss.x, boss.y, {
    radius: 22,
    color: 0x8855cc,
    durationMs: 260,
  });

  scene.attackTimeline.stopOwnerTimelines?.(boss);
  scene.attackTimeline.startTimeline({
    prefix: 'stage3_cross',
    owner: boss,
    phases: [
      {
        durationMs: CROSS_TELEGRAPH_MS + 100,
        onEnter: () => {
          // 四方向线形预警
          for (let i = 0; i < CROSS_LINE_COUNT; i++) {
            const angle = (Phaser.Math.PI2 / CROSS_LINE_COUNT) * i;
            const tg = scene.vfxSystem?.playLineTelegraph?.(boss.x, boss.y, {
              angle,
              width: 20,
              length: 360,
              color: 0x8855cc,
              durationMs: CROSS_TELEGRAPH_MS,
            });
            if (tg) boss._trackHazardObject?.(tg);
          }
        },
        events: [
          {
            atMs: CROSS_TELEGRAPH_MS,
            run: () => {
              if (!boss.isAlive) return;

              scene.vfxSystem?.playBurst?.(boss.x, boss.y, {
                radius: 50,
                color: 0x8855cc,
                durationMs: 200,
              });

              // 四方向各发射一排弹丸
              for (let i = 0; i < CROSS_LINE_COUNT; i++) {
                const baseAngle = (Phaser.Math.PI2 / CROSS_LINE_COUNT) * i;

                for (let j = 0; j < CROSS_BULLETS_PER_LINE; j++) {
                  // 每颗弹略有速度差，形成"激光线"效果
                  const speed = CROSS_SPEED + j * 22;

                  scene.patternSystem?.emitAimed?.({
                    side: 'boss',
                    x: boss.x,
                    y: boss.y,
                    angle: baseAngle,
                    speed,
                    color: 0x7744aa,
                    radius: CROSS_RADIUS,
                    damage: CROSS_DAMAGE,
                    tags: ['stage3_cross_line'],
                    options: { type: 'circle', hasTrail: true, trailColor: 0x9966cc, hasGlow: false },
                  });
                }
              }
            },
          },
        ],
      },
    ],
  });
}

// ─── 招式循环 ────────────────────────────────────
// 普通阶段：fan → slash → summon → ...
const NORMAL_SEQUENCE = [castFan, castSlash, castSummon];
// 狂暴阶段：cross-fan → slash → cross-crack → summon → ...
const ENRAGE_SEQUENCE = [castFan, castSlash, castCrossCrack, castSummon];

const _cycleIndexMap = new WeakMap();
const _wasEnraged = new WeakMap();

function getNextAction(boss) {
  const enraged = isEnraged(boss);
  const seq = enraged ? ENRAGE_SEQUENCE : NORMAL_SEQUENCE;

  // 刚进入狂暴时重置循环索引
  if (enraged && !_wasEnraged.get(boss)) {
    _wasEnraged.set(boss, true);
    _cycleIndexMap.set(boss, 0);

    // 狂暴视觉反馈：闪屏 + 速度提升
    const scene = boss.scene;
    scene?.vfxSystem?.flashScreen?.({ color: 0x8855cc, durationMs: 120, alpha: 0.25 });

    // 提升移速（只加一次）
    if (!boss._stage3Enraged) {
      boss._stage3Enraged = true;
      boss.moveSpeed = Math.round(boss.moveSpeed * ENRAGE_SPEED_MULT);
    }
  }

  const idx = _cycleIndexMap.get(boss) || 0;
  _cycleIndexMap.set(boss, (idx + 1) % seq.length);
  return seq[idx];
}

// ─── 主执行函数 ──────────────────────────────────
function executeStage3Pattern(boss) {
  if (!boss?.isAlive) return;

  const scene = boss.scene;
  const target = typeof boss.getPrimaryTarget === 'function' ? boss.getPrimaryTarget() : null;
  if (!scene || !target?.active || target.isAlive === false) return;

  const tp = getTargetPoint(target);
  if (!tp) return;

  const dx = tp.x - boss.x;
  const dy = tp.y - boss.y;
  const dist = Math.hypot(dx, dy);

  const padding = scene.bossNoGoPadding ?? 0;
  const meleeRange = Math.max(150, (boss.bossSize || 44) + padding + (tp.radius || 0) + 30);

  // 近距离强制半月斩（打断循环）
  if (dist <= meleeRange * 0.7) {
    castSlash(boss);
    return;
  }

  // 正常循环
  const action = getNextAction(boss);
  action(boss);
}

// ─── 导出 ────────────────────────────────────────
/**
 * 生成第 3 关 Boss 的攻击模式列表。
 * @param {BaseBoss} boss
 */
export function getAttackPatterns(boss) {
  return [
    {
      get interval() {
        return isEnraged(boss) ? ENRAGE_CYCLE_INTERVAL : CYCLE_INTERVAL;
      },
      execute: executeStage3Pattern,
    },
  ];
}
