import Phaser from 'phaser';
import BaseBoss from '../enemies/bosses/BaseBoss';
import TestMinion from '../enemies/minions/TestMinion';
import { getRoleSize, getRoleHp, getLayerScaling } from '../data/mapMonsters';
import { TUTORIAL_EXP_REWARDS, getStageBalance } from '../data/balanceConfig';

function getTargetPoint(target) {
  if (!target) return { x: 0, y: 0, radius: 0 };
  if (typeof target.getHitboxPosition === 'function') {
    const hp = target.getHitboxPosition();
    if (hp && Number.isFinite(hp.x) && Number.isFinite(hp.y)) {
      return {
        x: hp.x,
        y: hp.y,
        radius: Math.max(0, Number(hp.radius || 0))
      };
    }
  }
  return {
    x: Number(target.x || 0),
    y: Number(target.y || 0),
    radius: Math.max(0, Number(target.hitRadius || target.visualRadius || 0))
  };
}

function playBossShowcaseFan(scene, boss, targetPoint) {
  if (!scene || !boss?.isAlive) return;

  scene.vfxSystem?.playCastFlash?.(boss.x, boss.y - Math.max(8, (boss.bossSize || 50) * 0.18), {
    color: 0xffd580,
    radius: 30,
    durationMs: 140
  });

  scene.patternSystem?.emitFan?.({
    side: 'boss',
    x: boss.x,
    y: boss.y,
    target: { x: targetPoint.x, y: targetPoint.y },
    count: 7,
    spreadRad: Phaser.Math.DegToRad(10),
    speed: 170,
    color: 0xff9b54,
    radius: 9,
    damage: 10,
    tags: ['boss_showcase_fan'],
    options: {
      type: 'diamond',
      hasTrail: true,
      trailColor: 0xffc27a,
      hasGlow: false
    }
  });
}

function playBossShowcaseBurst(scene, boss, targetPoint, telegraphRadius) {
  if (!scene || !boss?.isAlive) return;

  scene.vfxSystem?.playBurst?.(targetPoint.x, targetPoint.y, {
    radius: telegraphRadius,
    color: 0xffcf8a,
    durationMs: 220
  });

  scene.patternSystem?.emitRing?.({
    side: 'boss',
    x: targetPoint.x,
    y: targetPoint.y,
    count: 10,
    offsetRad: Phaser.Math.DegToRad(18),
    speed: 145,
    color: 0xffd580,
    radius: 8,
    damage: 10,
    tags: ['boss_showcase_burst'],
    options: {
      type: 'circle',
      hasTrail: true,
      trailColor: 0xffd580,
      hasGlow: false
    }
  });

  const blast = scene.bulletCore?.createBossBullet?.({
    x: targetPoint.x,
    y: targetPoint.y,
    angle: 0,
    speed: 0,
    color: 0xffd580,
    radius: Math.max(22, Math.round(telegraphRadius * 0.78)),
    damage: 10,
    tags: ['boss_showcase_ground_blast'],
    options: {
      type: 'ring',
      hasTrail: false,
      hasGlow: false
    }
  });

  if (blast) {
    blast.alpha = 0.22;
    boss._trackHazardObject?.(blast);
    const blastCleanupTimer = scene.time?.delayedCall?.(110, () => {
      scene.bulletCore?.destroyBullet?.(blast, { side: 'boss', reason: 'expire' });
    });
    if (blastCleanupTimer) boss._trackHazardTimer?.(blastCleanupTimer);
  }
}

function scheduleBossShowcasePattern(boss, targetPoint, telegraphRadius, telegraphMs) {
  const scene = boss?.scene;
  if (!scene) return;

  // 优先走 AttackTimeline，让 Boss 攻击节奏真正归入今天新增的 system/bullets 模块。
  if (scene.attackTimeline?.startTimeline) {
    scene.attackTimeline.stopOwnerTimelines?.(boss);
    scene.attackTimeline.startTimeline({
      prefix: 'boss_showcase',
      owner: boss,
      phases: [
        {
          durationMs: telegraphMs + 120,
          onEnter: () => {
            const telegraph = scene.patternSystem?.emitGroundTelegraph?.({
              x: targetPoint.x,
              y: targetPoint.y,
              telegraphRadius,
              telegraphColor: 0xff7a66,
              durationMs: telegraphMs
            });
            if (telegraph) boss._trackHazardObject?.(telegraph);
          },
          events: [
            {
              atMs: 420,
              run: () => {
                const target = (typeof boss.getPrimaryTarget === 'function') ? boss.getPrimaryTarget() : null;
                if (!boss.isAlive || !target?.active || target.isAlive === false) return;
                playBossShowcaseFan(scene, boss, targetPoint);
              }
            },
            {
              atMs: telegraphMs,
              run: () => {
                playBossShowcaseBurst(scene, boss, targetPoint, telegraphRadius);
              }
            }
          ]
        }
      ]
    });
    return;
  }

  // 兜底：如果时间轴系统不可用，仍然保持旧的 delayedCall 调度方式。
  const telegraph = scene.patternSystem?.emitGroundTelegraph?.({
    x: targetPoint.x,
    y: targetPoint.y,
    telegraphRadius,
    telegraphColor: 0xff7a66,
    durationMs: telegraphMs
  });
  if (telegraph) boss._trackHazardObject?.(telegraph);

  const fanTimer = scene.time?.delayedCall?.(420, () => {
    const target = (typeof boss.getPrimaryTarget === 'function') ? boss.getPrimaryTarget() : null;
    if (!boss.isAlive || !target?.active || target.isAlive === false) return;
    playBossShowcaseFan(scene, boss, targetPoint);
  });
  if (fanTimer) boss._trackHazardTimer?.(fanTimer);

  const burstTimer = scene.time?.delayedCall?.(telegraphMs, () => {
    playBossShowcaseBurst(scene, boss, targetPoint, telegraphRadius);
  });
  if (burstTimer) boss._trackHazardTimer?.(burstTimer);
}

function executeBossPatternShowcase(boss) {
  if (!boss || !boss.isAlive) return;

  const scene = boss.scene;
  const target = (typeof boss.getPrimaryTarget === 'function') ? boss.getPrimaryTarget() : null;
  if (!scene || !target || !target.active || target.isAlive === false) return;

  const targetPoint = getTargetPoint(target);
  const dx = targetPoint.x - boss.x;
  const dy = targetPoint.y - boss.y;
  const dist = Math.hypot(dx, dy);

  const padding = boss?.scene?.bossNoGoPadding ?? 0;
  const minReach = (boss.bossSize || 50) + padding + (targetPoint.radius || 0) + 8;
  const meleeRange = Math.max(150, Math.round(minReach));

  if (dist <= meleeRange) {
    boss.castCrescentSlashAtPlayer?.({
      range: meleeRange,
      arcDeg: 150,
      windupMs: 560,
      slashMs: 680,
      lingerMs: 420,
      color: 0xffffff,
      damage: 10
    });
    return;
  }

  // 首个正式示例：地面预警 + 扇形弹幕 + 延迟爆发。
  // 使用新系统做表现与模式编排，同时沿用现有 Boss attackPatterns 调度。
  const telegraphRadius = Math.max(54, Math.round((boss.bossSize || 50) * 1.35));
  const telegraphMs = 900;

  boss.showAlertIcon?.(900);
  scene.vfxSystem?.playCharge?.(boss.x, boss.y - Math.max(10, (boss.bossSize || 50) * 0.28), {
    radius: 18,
    color: 0xffb86b,
    durationMs: 240
  });

  scheduleBossShowcasePattern(boss, targetPoint, telegraphRadius, telegraphMs);
}

/**
 * Boss 管理器
 * 负责 Boss 的生成、战斗流程管理
 * 所有 Boss 统一使用 BaseBoss + mapMonsters 数据驱动
 */
export default class BossManager {
  constructor(scene) {
    this.scene = scene;

    // 当前 Boss
    this.currentBoss = null;

    // 场上小怪/精英
    this.minions = [];

    // 已击败 Boss 数量（本次冒险）
    this.defeatedBossCount = 0;

    // 绑定事件
    this.setupEvents();
  }

  setupEvents() {
    this.scene.events.on('bossDefeated', (data) => {
      this.onBossDefeated(data);
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  Boss 生成（地图数据驱动）
  // ══════════════════════════════════════════════════════════════

  /**
   * 根据 mapMonsters 数据生成地图特定 Boss（BaseBoss 通用模板）
   * @param {object} bossData  来自 getMapBoss(mapId)
   * @param {object} spawnPt   { x, y }
   * @param {number} layer     当前层级（0-10），用于计算缩放
   * @param {boolean} silent   是否跳过警告动画
   */
  spawnMapBoss(bossData, spawnPt, layer = 1, silent = true) {
    if (!bossData) return null;

    const stage = Math.max(1, Math.floor(layer || 1));
    const balance = getStageBalance(stage);
    const bossSize = getRoleSize('boss');
    const cellSize = Math.max(64, Math.round(this.scene?.mapConfig?.cellSize || 128));
    const aggroRadius = Phaser.Math.Clamp(Math.floor(cellSize * 6.0), 520, 980);

    // 需求：Boss 预警发现玩家后，应缓慢、智能地朝玩家移动（而不是左右巡逻/随机漂移）。
    // 因此地图 Boss 统一采用 tracking。
    const resolvedMovePattern = 'tracking';

    // 默认攻击模式：近身半月斩；中距离时展示新弹幕系统示例。
    // 首个正式示例：地面预警 + 扇形弹幕 + 延迟爆发。
    const defaultAttackPatterns = [
      {
        interval: 2800,
        execute: executeBossPatternShowcase
      }
    ];

    const cfg = {
      x: spawnPt.x,
      y: spawnPt.y,
      name: bossData.name,
      hp: Math.round(balance.boss.hp),
      expReward: balance.boss.exp,
      size: bossSize,
      color: bossData.color,
      movePattern: resolvedMovePattern,
      moveSpeed: balance.boss.moveSpeed,
      aggroRadius,
      // 近战：靠近玩家但不要贴脸（玩家会被 Boss 禁入圈推开）
      trackingStopDist: 150,
      attackPatterns: defaultAttackPatterns,
      combatActive: false,
      entryType: 'fade',
      entryDuration: 400,
    };

    this.currentBoss = new BaseBoss(this.scene, cfg);
    this.updateBossInfo();

    if (!silent) {
      this.showBossWarning(bossData.name);
    }

    return this.currentBoss;
  }

  /**
   * 生成教程 Boss（试炼之地专用）：纳入统一 Boss 管理（tracking 靠近 + 近战半月斩）
   * @param {object} spawnPt { x, y }
   */
  spawnTutorialBoss(spawnPt) {
    const attackPatterns = [
      {
        interval: 1500,
        execute: (boss) => {
          if (!boss || !boss.isAlive) return;

          const target = (typeof boss.getPrimaryTarget === 'function') ? boss.getPrimaryTarget() : null;
          if (!target || !target.active || target.isAlive === false) return;

          const dx = target.x - boss.x;
          const dy = target.y - boss.y;
          const dist = Math.hypot(dx, dy);

          // 与地图 Boss 一致：覆盖“Boss 禁入圈”推开距离
          const padding = boss?.scene?.bossNoGoPadding ?? 0;
          const hitbox = (typeof target.getHitboxPosition === 'function')
            ? target.getHitboxPosition()
            : { radius: Math.max(10, target.visualRadius || 16) };
          const minReach = (boss.bossSize || 36) + padding + (hitbox.radius || 0) + 6;
          const meleeRange = Math.max(140, Math.round(minReach));

          if (dist <= meleeRange) {
            boss.castCrescentSlashAtPlayer?.({
              range: meleeRange,
              arcDeg: 150,
              windupMs: 560,
              slashMs: 680,
              lingerMs: 420,
              color: 0xffffff,
              damage: 6
            });
          }
        }
      }
    ];

    const cellSize = Math.max(64, Math.round(this.scene?.mapConfig?.cellSize || 128));
    const aggroRadius = Phaser.Math.Clamp(Math.floor(cellSize * 6.0), 520, 980);

    const cfg = {
      x: spawnPt.x,
      y: spawnPt.y,
      name: '教程目标',
      hp: 18,
      expReward: TUTORIAL_EXP_REWARDS.boss,
      size: 36,
      color: 0x66ccff,
      movePattern: 'tracking',
      moveSpeed: 85,
      trackingStopDist: 150,
      attackPatterns,
      entryType: 'fade',
      entryDuration: 600,
      combatActive: false,
      aggroRadius,
    };

    this.currentBoss = new BaseBoss(this.scene, cfg);
    this.updateBossInfo();
    return this.currentBoss;
  }

  // ══════════════════════════════════════════════════════════════
  //  小怪管理
  // ══════════════════════════════════════════════════════════════

  destroyMinions() {
    if (!Array.isArray(this.minions) || this.minions.length === 0) {
      this.minions = [];
      return;
    }
    this.minions.forEach((m) => {
      if (m?.destroy) m.destroy();
    });
    this.minions = [];
  }

  getMinions() {
    return (this.minions || []).filter((m) => m && m.isAlive);
  }

  // ══════════════════════════════════════════════════════════════
  //  Boss 被击败
  // ══════════════════════════════════════════════════════════════

  onBossDefeated(data) {
    console.log(`Boss ${data.name} 被击败！获得分数: ${data.score}, 经验: ${data.exp}`);

    // 教程 Boss：交由场景触发首次三选一
    if (this.scene._isTutorialBoss) {
      this.scene._isTutorialBoss = false;
      this.currentBoss = null;
      this.scene.petManager?.resetPositionsAroundPlayer?.();
      this.scene.undeadSummonManager?.onBossDefeated?.();
      this.scene.events.emit('tutorialBossDefeated', data);
      return;
    }

    this.defeatedBossCount++;
    const defeatedBoss = this.currentBoss;

    // 更新玩家数据
    if (this.scene.playerData) {
      this.scene.playerData.score += data.score;
      if (typeof this.scene.addExp === 'function') {
        this.scene.addExp(data.exp || 0, { source: 'boss' });
      } else {
        this.scene.playerData.exp += data.exp;
        if (this.scene.playerData.exp >= this.scene.playerData.maxExp) {
          this.scene.triggerLevelUp();
        }
      }
      this.scene.events.emit('updatePlayerInfo');
    }

    if (this.scene.spawnBossDrops && defeatedBoss) {
      this.scene.spawnBossDrops(defeatedBoss, data);
    }

    this.currentBoss = null;
    this.scene.petManager?.resetPositionsAroundPlayer?.();
    this.scene.undeadSummonManager?.onBossDefeated?.();

    // 新流程：击败 Boss -> 等待清场，清场后倒计时进入下一轮
    if (this.scene && typeof this.scene.onBossDefeatedOpenExitDoor === 'function') {
      this.scene.onBossDefeatedOpenExitDoor({ boss: defeatedBoss, data });
      return;
    }

    // 兜底：旧流程（直接下一关）
    if (this.scene && typeof this.scene.advanceToNextLevel === 'function') {
      this.scene.advanceToNextLevel();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  UI & 工具
  // ══════════════════════════════════════════════════════════════

  showBossWarning(bossName) {
    return bossName;
  }

  updateBossInfo() {
    if (!this.currentBoss) return;

    const bossText = this.scene?.infoTexts?.boss;
    const bossHpText = this.scene?.infoTexts?.bossHp;

    if (bossText && bossText.setText) {
      bossText.setText(`Boss: ${this.currentBoss.bossName}`);
    }
    if (bossHpText && bossHpText.setText) {
      bossHpText.setText(`Boss HP: ${this.currentBoss.currentHp}/${this.currentBoss.maxHp}`);
    }
  }

  getPlayTime() {
    const seconds = Math.floor(this.scene.time.now / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getCurrentBoss() {
    return this.currentBoss;
  }

  // ══════════════════════════════════════════════════════════════
  //  每帧更新
  // ══════════════════════════════════════════════════════════════

  update(time, delta) {
    if (this.currentBoss && this.currentBoss.isAlive) {
      const bossHpText = this.scene?.infoTexts?.bossHp;
      if (bossHpText && bossHpText.setText) {
        bossHpText.setText(`Boss HP: ${this.currentBoss.currentHp}/${this.currentBoss.maxHp}`);
      }

      // Boss 行为更新（tracking 追踪等）
      if (typeof this.currentBoss.update === 'function') {
        this.currentBoss.update(time, delta);
      }
    }

    if (Array.isArray(this.minions) && this.minions.length > 0) {
      const player = this.scene?.player;

      // 避免每帧 filter 创建新数组（GC 压力）：原地清理 + 遍历
      let writeIdx = 0;
      for (let i = 0; i < this.minions.length; i++) {
        const m = this.minions[i];
        if (m && m.active && m.isAlive) {
          this.minions[writeIdx++] = m;
          m.update(time, delta, player);
        }
      }
      this.minions.length = writeIdx;
    }
  }

  destroy() {
    this.scene.events.off('bossDefeated');
    if (this.currentBoss) {
      this.currentBoss.destroy();
    }
  }
}
