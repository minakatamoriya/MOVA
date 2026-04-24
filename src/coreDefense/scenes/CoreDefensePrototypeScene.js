import Phaser from 'phaser';
import { buildArenaMetrics } from '../config/arenaLayout';
import { getCoreDefenseClassOption } from '../config/classOptions';
import { CORE_DEFENSE_ENEMY_DEFS, getEnemyHpMultiplier, getWaveDirectorState, rollEnemyType } from '../config/waveTimeline';
import {
  createInitialCoreModuleLevels,
  createInitialUpgradeLevels,
  getNextBattleExp,
} from '../prototype/config/progressionCatalog';
import { createInitialEliteDropState } from '../prototype/config/eliteDropCatalog';
import {
  CORE_APPROACH_OFFSET_Y,
  CORE_TOUCH_HEIGHT,
  CORE_TOUCH_OFFSET_Y,
  CORE_TOUCH_WIDTH,
  PRESSURE_TICK_MS,
  UPGRADE_INTERACT_RADIUS,
} from '../prototype/config/prototypeSceneConfig';
import { clamp, distanceSq } from '../prototype/utils/math';
import { createTopHud, refreshTopHud } from '../prototype/ui/topHud';
import {
  closeUpgradeMenu as closeUpgradeMenuUi,
  createUpgradeMenu as createUpgradeMenuUi,
  openUpgradeMenu as openUpgradeMenuUi,
  purchaseCoreModule as purchaseCoreModuleUi,
  purchasePrototypeUpgrade as purchasePrototypeUpgradeUi,
  purchaseUpgradeMenuEntry as purchaseUpgradeMenuEntryUi,
  refreshUpgradeMenu as refreshUpgradeMenuUi,
  setUpgradeScrollOffset as setUpgradeScrollOffsetUi,
  switchUpgradeMenuTab as switchUpgradeMenuTabUi,
  updateUpgradeMenuScroll as updateUpgradeMenuScrollUi,
} from '../prototype/ui/upgradeMenu/menu';
import {
  canPlayerAttackEnemy as canPlayerAttackEnemySystem,
  findOverloadTarget as findOverloadTargetSystem,
  gainBattleExp as gainBattleExpSystem,
  handleEnemyDefeat as handleEnemyDefeatSystem,
  hasActiveEliteAnchor as hasActiveEliteAnchorSystem,
  shouldSpawnEliteAnchorForWave as shouldSpawnEliteAnchorForWaveSystem,
  updateAutoAttack as updateAutoAttackSystem,
  updateCoreModules as updateCoreModulesSystem,
  updateEnemies as updateEnemiesSystem,
  updatePressure as updatePressureSystem,
} from '../prototype/systems/combatSystems';
import { clearCoinDrops, updateCoinDrops } from '../prototype/systems/coinDrops';

export default class CoreDefensePrototypeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoreDefensePrototypeScene' });
  }

  init(data = {}) {
    this.selectedClassId = data.selectedMainCore || this.registry.get('preferredMainCore') || 'warrior';
  }

  create() {
    this.cameras.main.setBackgroundColor('#07131e');
    this.metrics = buildArenaMetrics(this.scale.width, this.scale.height);
    this.classOption = getCoreDefenseClassOption(this.selectedClassId);
    this.roundStartedAt = this.time.now;
    this.lastPressureTickAt = this.roundStartedAt;
    this.lastAttackAt = 0;
    this.score = 0;
    this.gold = 0;
    this.battleLevel = 1;
    this.battleExp = 0;
    this.nextBattleExp = getNextBattleExp(this.battleLevel);
    this.survivedMs = 0;
    this.pausedAccumulatedMs = 0;
    this.currentThreat = 0;
    this.currentPressure = 0;
    this.currentThreatTier = '低';
    this.currentWaveLabel = '第1波 建立波';
    this.currentThreatStageLabel = '战线建立';
    this.currentEliteAnchorId = null;
    this.currentEliteWaveIndex = null;
    this.isUpgradeMenuOpen = false;
    this.upgradeMenuOpenedAt = 0;
    this.upgradeMenuTab = 'player';
    this.upgradeLevels = createInitialUpgradeLevels();
    this.coreModuleLevels = createInitialCoreModuleLevels();
    this.eliteDropState = createInitialEliteDropState();
    this.coreModuleRuntime = {
      lastBurnAt: 0,
      lastRecoveryAt: 0,
      lastOverloadAt: 0,
    };
    this.playerCritChance = 0;
    this.playerCritMultiplier = 1.75;
    this.gameResolved = false;
    this.pointerTarget = null;
    this.skipNextGroundPointerDown = false;
    this.enemies = [];
    this.coinDrops = [];

    this.createArena();
    this.createCore();
    this.createPlayer();
    this.createHud();
    this.createInput();
    this.createUpgradeMenu();

    this.spawnTimer = this.time.addEvent({
      delay: getWaveDirectorState(0).spawnIntervalMs,
      loop: true,
      callback: () => this.spawnEnemy(),
    });
  }

  createArena() {
    const { width, zones, laneCenters, laneWidth } = this.metrics;
    const zoneDefs = [
      ['入口带', zones.entrance, 0x163247],
      ['前线交战带', zones.frontline, 0x163f36],
      ['中段缓冲带', zones.mid, 0x21354d],
      ['核心守卫带', zones.core, 0x35234d],
    ];

    zoneDefs.forEach(([label, zone, color]) => {
      this.add.rectangle(width * 0.5, zone.y + zone.height * 0.5, width, zone.height, color, 0.66).setOrigin(0.5);
      this.add.text(22, zone.y + 14, label, {
        fontSize: '18px',
        color: '#d7e9ff',
        fontStyle: 'bold',
      }).setOrigin(0, 0);
    });

    [laneCenters.left, laneCenters.mid, laneCenters.right].forEach((centerX) => {
      this.add.rectangle(centerX, this.scale.height * 0.5, laneWidth, this.scale.height, 0xffffff, 0.03).setOrigin(0.5);
    });

    [zones.frontline.y, zones.mid.y, zones.core.y].forEach((lineY) => {
      this.add.rectangle(width * 0.5, lineY, width, 4, 0xffffff, 0.08).setOrigin(0.5);
    });
  }

  createCore() {
    const { core } = this.metrics;
    this.coreMaxHp = 1000;
    this.coreHp = this.coreMaxHp;
    this.coreShieldMax = 0;
    this.coreShield = 0;
    this.coreThreatFlashAlpha = 0.1;
    const openCoreUpgrade = () => {
      if (this.gameResolved || this.isUpgradeMenuOpen) return;
      this.skipNextGroundPointerDown = true;
      this.openUpgradeMenu();
    };
    this.coreTouchTarget = this.add.zone(core.x, core.y + CORE_TOUCH_OFFSET_Y, CORE_TOUCH_WIDTH, CORE_TOUCH_HEIGHT)
      .setOrigin(0.5)
      .setDepth(50);
    this.coreTouchTarget.setInteractive({ useHandCursor: true });
    this.coreTouchTarget.on('pointerdown', openCoreUpgrade);
    this.core = this.add.circle(core.x, core.y, core.radius, 0x7c5cff, 0.95).setStrokeStyle(4, 0xe7dcff, 0.95);
    this.core.setInteractive(new Phaser.Geom.Circle(0, 0, core.radius), Phaser.Geom.Circle.Contains);
    this.core.on('pointerdown', openCoreUpgrade);
    this.coreThreatAura = this.add.circle(core.x, core.y, core.threatRadius, 0xffd36b, 0.06).setStrokeStyle(2, 0xffd36b, 0.22);
    this.coreAura = this.add.circle(core.x, core.y, core.pressureRadius, 0x7c5cff, 0.08).setStrokeStyle(2, 0xb89cff, 0.34);
  }

  createPlayer() {
    const start = this.metrics.playerStart;
    this.player = this.add.circle(start.x, start.y, 20, this.classOption.color, 0.98).setStrokeStyle(3, 0xffffff, 0.9);
    this.playerMoveSpeed = this.classOption.moveSpeed;
  }

  createHud() {
    createTopHud(this);
    this.interactHintText = this.add.text(this.scale.width * 0.5, this.scale.height - 46, '', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
    }).setOrigin(0.5).setScrollFactor(0);
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escapeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.on('pointerdown', (pointer) => {
      if (this.isUpgradeMenuOpen || this.gameResolved) return;
      if (this.skipNextGroundPointerDown) {
        this.skipNextGroundPointerDown = false;
        return;
      }
      this.pointerTarget = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointermove', (pointer) => {
      if (this.isUpgradeMenuOpen || this.gameResolved) return;
      if (!pointer.isDown) return;
      this.pointerTarget = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointerup', () => {
      if (this.isUpgradeMenuOpen || this.gameResolved) return;
      this.pointerTarget = null;
    });
  }

  createUpgradeMenu() {
    createUpgradeMenuUi(this);
  }

  isPlayerNearCore() {
    return distanceSq(this.player.x, this.player.y, this.metrics.core.x, this.metrics.core.y) <= (UPGRADE_INTERACT_RADIUS * UPGRADE_INTERACT_RADIUS);
  }

  setCoreApproachTarget(pointer) {
    const targetX = this.metrics.core.x;
    const targetY = this.metrics.core.y - CORE_APPROACH_OFFSET_Y;
    const fallbackX = clamp(targetX, 28, this.scale.width - 28);
    const fallbackY = clamp(targetY, this.metrics.zones.frontline.y + 16, this.scale.height - 32);

    this.pointerTarget = {
      x: fallbackX,
      y: fallbackY,
    };

    if (pointer) {
      pointer.event?.preventDefault?.();
    }
  }

  openUpgradeMenu() {
    openUpgradeMenuUi(this);
  }

  closeUpgradeMenu() {
    closeUpgradeMenuUi(this);
  }

  refreshUpgradeMenu() {
    refreshUpgradeMenuUi(this);
  }

  setUpgradeScrollOffset(nextOffset) {
    setUpgradeScrollOffsetUi(this, nextOffset);
  }

  switchUpgradeMenuTab(tabKey) {
    switchUpgradeMenuTabUi(this, tabKey);
  }

  purchaseUpgradeMenuEntry(index) {
    purchaseUpgradeMenuEntryUi(this, index);
  }

  purchasePrototypeUpgrade(upgradeId) {
    purchasePrototypeUpgradeUi(this, upgradeId);
  }

  purchaseCoreModule(moduleId) {
    purchaseCoreModuleUi(this, moduleId);
  }

  spawnEnemy() {
    if (this.gameResolved) return;
    const elapsedMs = Math.max(0, this.time.now - this.roundStartedAt);
    const directorState = getWaveDirectorState(elapsedMs);
    if (this.spawnTimer) {
      this.spawnTimer.delay = directorState.spawnIntervalMs;
    }

    const laneKeys = ['left', 'mid', 'right'];
    const shouldSpawnEliteAnchor = this.shouldSpawnEliteAnchorForWave(directorState);
    const laneKey = shouldSpawnEliteAnchor ? 'mid' : laneKeys[Phaser.Math.Between(0, laneKeys.length - 1)];
    const enemyType = shouldSpawnEliteAnchor ? 'anchor' : rollEnemyType(Math.random(), directorState.weights);
    const def = CORE_DEFENSE_ENEMY_DEFS[enemyType];
    const hpMultiplier = getEnemyHpMultiplier(enemyType, directorState.groupIndex) * (shouldSpawnEliteAnchor ? 2.6 : 1);
    const drift = shouldSpawnEliteAnchor
      ? 0
      : Phaser.Math.Between(-Math.round(this.metrics.laneWidth * 0.28), Math.round(this.metrics.laneWidth * 0.28));
    const x = clamp(this.metrics.laneCenters[laneKey] + drift, def.radius + 6, this.scale.width - def.radius - 6);
    const y = this.metrics.spawnY;
    const body = this.add.circle(x, y, shouldSpawnEliteAnchor ? def.radius + 6 : def.radius, def.color, 0.96)
      .setStrokeStyle(shouldSpawnEliteAnchor ? 3 : 2, shouldSpawnEliteAnchor ? 0xffe08a : 0x000000, shouldSpawnEliteAnchor ? 0.85 : 0.35);
    const scaledHp = Math.max(1, Math.round(def.hp * hpMultiplier));

    const enemyId = `${enemyType}_${this.time.now}_${Math.random().toString(16).slice(2, 6)}`;
    if (shouldSpawnEliteAnchor) {
      this.currentEliteAnchorId = enemyId;
      this.currentEliteWaveIndex = directorState.waveIndex;
    }

    this.enemies.push({
      id: enemyId,
      type: enemyType,
      laneKey,
      x,
      y,
      radius: shouldSpawnEliteAnchor ? def.radius + 6 : def.radius,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: shouldSpawnEliteAnchor ? Math.max(16, def.speed * 0.9) : def.speed,
      pressure: shouldSpawnEliteAnchor ? ((def.pressure || 0) * 1.6) : def.pressure,
      threat: shouldSpawnEliteAnchor ? ((def.threat || def.pressure || 0) * 1.8) : (def.threat || def.pressure),
      remoteThreat: shouldSpawnEliteAnchor ? ((def.remoteThreat || 0) * 1.6) : (def.remoteThreat || 0),
      remotePressure: shouldSpawnEliteAnchor ? ((def.remotePressure || 0) * 1.7) : (def.remotePressure || 0),
      score: shouldSpawnEliteAnchor ? Math.max(6, (def.score || 1) * 3) : (def.score || 1),
      anchorY: enemyType === 'anchor' ? this.scale.height * def.anchorYRatio : null,
      stopped: false,
      enteredFrontline: false,
      isEliteAnchor: shouldSpawnEliteAnchor,
      display: body,
    });
  }

  update(time, delta) {
    if (this.gameResolved) return;

    if (this.isUpgradeMenuOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
        this.closeUpgradeMenu();
      }
      this.updateUpgradeMenuScroll();
      this.refreshHud();
      return;
    }

    this.updateDirectorState(time);
    this.updateTimer(time);
    this.updateInteractionHint();
    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateCoreModules(time);
    this.updatePressure(time);
    this.updateAutoAttack(time);
    updateCoinDrops(this, delta);

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.isPlayerNearCore()) {
      this.openUpgradeMenu();
    }

    this.refreshHud();
  }

  updateTimer(time) {
    this.survivedMs = Math.max(0, time - this.roundStartedAt - this.pausedAccumulatedMs);
  }

  updateDirectorState(time) {
    const elapsedMs = Math.max(0, time - this.roundStartedAt - this.pausedAccumulatedMs);
    const directorState = getWaveDirectorState(elapsedMs);
    const eliteAnchorAlive = this.hasActiveEliteAnchor();
    this.currentWaveLabel = eliteAnchorAlive && directorState.isRecoveryWindow
      ? `第${directorState.waveIndex}波 ${directorState.waveName}·精英未清`
      : `第${directorState.waveIndex}波 ${directorState.waveName}`;
    this.currentThreatStageLabel = eliteAnchorAlive && directorState.isRecoveryWindow ? '精英压阵' : directorState.threatStageLabel;
    if (this.spawnTimer) {
      this.spawnTimer.delay = eliteAnchorAlive && directorState.isRecoveryWindow
        ? Math.min(780, directorState.spawnIntervalMs)
        : directorState.spawnIntervalMs;
    }
  }

  updateInteractionHint() {
    if (this.isPlayerNearCore()) {
      this.interactHintText.setText('点核心可随时打开升级，靠近核心时也可按 E');
      this.interactHintText.setVisible(true);
      return;
    }
    const nearCoreBand = distanceSq(this.player.x, this.player.y, this.metrics.core.x, this.metrics.core.y) <= ((UPGRADE_INTERACT_RADIUS + 90) * (UPGRADE_INTERACT_RADIUS + 90));
    if (nearCoreBand) {
      this.interactHintText.setText('点核心可直接打开升级');
      this.interactHintText.setVisible(true);
      return;
    }
    this.interactHintText.setVisible(false);
  }

  updatePlayer(delta) {
    const dt = Math.max(0, Number(delta || 0)) / 1000;
    let dx = 0;
    let dy = 0;

    if (this.pointerTarget) {
      const tx = this.pointerTarget.x - this.player.x;
      const ty = this.pointerTarget.y - this.player.y;
      const dist = Math.hypot(tx, ty);
      if (dist > 6) {
        dx = tx / dist;
        dy = ty / dist;
      }
    } else {
      dx = (this.cursors.right.isDown || this.wasd.right.isDown ? 1 : 0) - (this.cursors.left.isDown || this.wasd.left.isDown ? 1 : 0);
      dy = (this.cursors.down.isDown || this.wasd.down.isDown ? 1 : 0) - (this.cursors.up.isDown || this.wasd.up.isDown ? 1 : 0);
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
      }
    }

    this.player.x = clamp(this.player.x + dx * this.playerMoveSpeed * dt, 24, this.scale.width - 24);
    this.player.y = clamp(this.player.y + dy * this.playerMoveSpeed * dt, this.metrics.zones.frontline.y + 12, this.scale.height - 24);
  }

  updateEnemies(delta) {
    updateEnemiesSystem(this, delta);
  }

  getLaneBias(enemy) {
    if (!enemy) return 0;
    if (enemy.type === 'infiltrator') {
      return enemy.laneKey === 'left' ? -52 : (enemy.laneKey === 'right' ? 52 : 0);
    }
    return enemy.laneKey === 'left' ? -24 : (enemy.laneKey === 'right' ? 24 : 0);
  }

  updatePressure(time) {
    updatePressureSystem(this, time);
  }

  updateCoreModules(time) {
    updateCoreModulesSystem(this, time);
  }

  updateAutoAttack(time) {
    updateAutoAttackSystem(this, time);
  }

  handleEnemyDefeat(enemy, burstColor) {
    handleEnemyDefeatSystem(this, enemy, burstColor);
  }

  canPlayerAttackEnemy(enemy) {
    return canPlayerAttackEnemySystem(this, enemy);
  }

  findOverloadTarget() {
    return findOverloadTargetSystem(this);
  }

  hasActiveEliteAnchor() {
    return hasActiveEliteAnchorSystem(this);
  }

  shouldSpawnEliteAnchorForWave(directorState) {
    return shouldSpawnEliteAnchorForWaveSystem(this, directorState);
  }

  gainBattleExp(amount) {
    gainBattleExpSystem(this, amount);
  }

  updateUpgradeMenuScroll() {
    updateUpgradeMenuScrollUi(this);
  }

  refreshHud() {
    refreshTopHud(this);
  }

  resolveRound(victory, message) {
    if (this.gameResolved) return;
    this.gameResolved = true;
    this.spawnTimer?.remove?.();
    clearCoinDrops(this);

    const title = victory ? '原型结算' : '原型失败';
    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width * 0.82, 220, 0x000000, 0.72).setOrigin(0.5);
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 38, title, {
      fontSize: '46px',
      fontStyle: 'bold',
      color: victory ? '#ffe18a' : '#ff9aa2',
    }).setOrigin(0.5);
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 + 14, message, {
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: this.scale.width * 0.72 },
    }).setOrigin(0.5);
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 + 72, '按 R 重新开始，按 ESC 返回菜单', {
      fontSize: '20px',
      color: '#c8d6e5',
    }).setOrigin(0.5);

    this.upgradeMenu?.setVisible(false);

    this.input.keyboard.once('keydown-R', () => {
      this.scene.restart({ selectedMainCore: this.selectedClassId });
    });
    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }
}
