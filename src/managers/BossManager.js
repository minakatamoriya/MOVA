import BaseBoss from '../enemies/bosses/BaseBoss';
import TestMinion from '../enemies/minions/TestMinion';
import { getRoleSize, getRoleHp, getLayerScaling } from '../data/mapMonsters';
import { getStageBalance } from '../data/balanceConfig';

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

    // 需求：Boss 预警发现玩家后，应缓慢、智能地朝玩家移动（而不是左右巡逻/随机漂移）。
    // 因此地图 Boss 统一采用 tracking。
    const resolvedMovePattern = 'tracking';

    // 默认攻击模式：近战为主（半月斩，带起手闪光）。
    // 注：BaseBoss 内置支持 attackPatterns；若未来 mapMonsters 为 Boss 提供自定义 patterns，可在此替换。
    const defaultAttackPatterns = [
      {
        interval: 1350,
        execute: (boss) => {
          if (!boss || !boss.isAlive) return;

          const target = (typeof boss.getPrimaryTarget === 'function') ? boss.getPrimaryTarget() : null;
          if (!target || !target.active || target.isAlive === false) return;

          const dx = target.x - boss.x;
          const dy = target.y - boss.y;
          const dist = Math.hypot(dx, dy);

          // 玩家有“Boss 禁入圈”，距离过近会被推开；因此近战判定要覆盖这个最小距离
          const padding = boss?.scene?.bossNoGoPadding ?? 60;
          const hitbox = (typeof target.getHitboxPosition === 'function')
            ? target.getHitboxPosition()
            : { radius: Math.max(10, target.visualRadius || 16) };
          const minReach = (boss.bossSize || 50) + padding + (hitbox.radius || 0) + 8;
          const meleeRange = Math.max(150, Math.round(minReach));

          if (dist <= meleeRange) {
            if (typeof boss.castCrescentSlashAtPlayer === 'function') {
              boss.castCrescentSlashAtPlayer({
                range: meleeRange,
                arcDeg: 150,
                windupMs: 260,
                slashMs: 220,
                lingerMs: 240,
                color: 0xffffff,
                damage: 10
              });
            }
          }
        }
      }
    ];

    const cfg = {
      x: spawnPt.x,
      y: spawnPt.y,
      name: bossData.name,
      hp: Math.round(balance.boss.hp),
      size: bossSize,
      color: bossData.color,
      movePattern: resolvedMovePattern,
      moveSpeed: balance.boss.moveSpeed,
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
          const padding = boss?.scene?.bossNoGoPadding ?? 60;
          const hitbox = (typeof target.getHitboxPosition === 'function')
            ? target.getHitboxPosition()
            : { radius: Math.max(10, target.visualRadius || 16) };
          const minReach = (boss.bossSize || 36) + padding + (hitbox.radius || 0) + 6;
          const meleeRange = Math.max(140, Math.round(minReach));

          if (dist <= meleeRange) {
            boss.castCrescentSlashAtPlayer?.({
              range: meleeRange,
              arcDeg: 150,
              windupMs: 260,
              slashMs: 220,
              lingerMs: 240,
              color: 0xffffff,
              damage: 6
            });
          }
        }
      }
    ];

    const cfg = {
      x: spawnPt.x,
      y: spawnPt.y,
      name: '教程目标',
      hp: 30,
      size: 36,
      color: 0x66ccff,
      movePattern: 'tracking',
      moveSpeed: 85,
      trackingStopDist: 150,
      attackPatterns,
      entryType: 'fade',
      entryDuration: 600,
      combatActive: false,
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
      if (m && m.active && m.destroy) m.destroy();
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
      this.destroyMinions();
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

    // 掉落奖励
    if (this.scene.spawnBossDrops && defeatedBoss) {
      this.scene.spawnBossDrops(defeatedBoss, data);
    }

    this.currentBoss = null;
    this.destroyMinions();

    // 新关卡流程：击败 Boss -> 打开出口门（由场景负责）
    if (this.scene && typeof this.scene.onBossDefeatedOpenExitDoor === 'function') {
      this.scene.onBossDefeatedOpenExitDoor();
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
    const centerX = this.scene.cameras.main.centerX;
    const centerY = this.scene.cameras.main.centerY;

    const warningText = this.scene.add.text(centerX, centerY,
      `⚠️ WARNING ⚠️\n${bossName} 降临！`,
      {
        fontSize: '48px',
        color: '#ff0000',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6
      }
    ).setOrigin(0.5).setAlpha(0);

    this.scene.tweens.add({
      targets: warningText,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 500,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 1000,
      onComplete: () => { warningText.destroy(); }
    });

    this.scene.cameras.main.shake(500, 0.01);
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
