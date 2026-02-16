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

    const movePatternMap = {
      chaser: 'random',
      shooter: 'static',
      patrol: 'horizontal',
      static: 'static',
    };

    const cfg = {
      x: spawnPt.x,
      y: spawnPt.y,
      name: bossData.name,
      hp: Math.round(balance.boss.hp),
      size: bossSize,
      color: bossData.color,
      movePattern: movePatternMap[bossData.moveType] || 'random',
      moveSpeed: balance.boss.moveSpeed,
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
   * 生成简易教程 Boss（试炼之地专用，低血量、不动、无攻击）
   * @param {object} spawnPt { x, y }
   */
  spawnTutorialBoss(spawnPt) {
    const cfg = {
      x: spawnPt.x,
      y: spawnPt.y,
      name: '教程目标',
      hp: 30,
      size: 36,
      color: 0x66ccff,
      movePattern: 'static',
      attackPatterns: [],
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
      this.minions = this.minions.filter((m) => m && m.active && m.isAlive);
      this.minions.forEach((m) => {
        if (m && m.update) m.update(time, delta, player);
      });
    }
  }

  destroy() {
    this.scene.events.off('bossDefeated');
    if (this.currentBoss) {
      this.currentBoss.destroy();
    }
  }
}
