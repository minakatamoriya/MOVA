import Phaser from 'phaser';
import { uiBus } from '../ui/bus';
import BossManager from '../managers/BossManager';
import CollisionManager from '../managers/CollisionManager';
import BulletManager from '../managers/BulletManager';
import Player from '../player/Player';
import { ITEM_DEFS, getItemById } from '../data/items';
import PetManager from '../classes/pets/PetManager';
import SystemMessageOverlay from '../ui/SystemMessageOverlay';
import ToastOverlay from '../ui/ToastOverlay';
import { START_ROOM } from '../data/mapPool';

// ── Mixins ───────────────────────────────────────────────
import { applyHudMixin } from './game/HudMixin';
import { applyMapFogMixin } from './game/MapFogMixin';
import { applyDropsInventoryMixin } from './game/DropsInventoryMixin';
import { applyLevelProgressionMixin } from './game/LevelProgressionMixin';
import { applyViewMenuMixin } from './game/ViewMenuMixin';
import { applyBuildClassMixin } from './game/BuildClassMixin';

/**
 * 主游戏场景 - 核心游戏玩法场景
 *
 * 逻辑按模块拆分到 ./game/ 目录下的 Mixin 文件：
 *   HudMixin              – HUD、血条、经验条、伤害数字、按钮
 *   MapFogMixin            – 大地图、迷雾、小地图、起始房间
 *   DropsInventoryMixin    – 掉落物、背包、碎片、消耗品
 *   LevelProgressionMixin  – 升级、经验、关卡流程、路径选择
 *   ViewMenuMixin          – 查看菜单（天赋/统计/背包面板）
 *   BuildClassMixin        – 职业/流派/无人机/战士/法师/圣骑/术士
 */
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    // 查看菜单关闭后的第一帧，用于重置基于 time 的节奏（避免暂停期间累计）
    this._viewMenuResumePending = false;

    // 关卡/地图（大地图 + 迷雾 + 小地图）
    this.currentLevel = 1;
    this.levelBossTriggered = false;

    // 开局流程：六把武器六选一（替代旧"六选一职业"）
    this.weaponSelected = false;
    this.weaponPickups = [];
    this.weaponPickupColliders = [];
    // 不依赖 Arcade Physics：用距离检测"触碰拾取"
    this.weaponPickupNodes = [];

    // 击败 Boss 后：出口门进入下一关
    this.exitDoorActive = false;
    this.exitDoorZone = null;
    this.exitDoorVisuals = null;

    // 新流程：起始房间（无迷雾、无 Boss），选武器后进门进入第一关
    this.inStartRoom = true;
    this.adventureStarted = false;
    this.startRoomDoorActive = false;
    this.startRoomDoorZone = null;
    this.startRoomDoorVisuals = null;
    this._startRoomObjects = [];

    // 迷雾模式：soft = "柔和笔刷式永久揭开（非网格）"
    this.fogMode = 'soft';

    // 系统提示（居中偏上，带倒计时条/渐隐/可手动关闭）
    this.systemMessage = null;

    // 移动端：隐藏摇杆（按下出现、松开隐藏）
    this._touchJoystick = null;
    this._touchJoystickHandlers = null;

    // 索敌提示圈（战士/圣骑）
    this._warriorTargetRing = null;
    this._paladinTargetRing = null;
    this._archerRangeRing = null;

    // ── 地图分支系统 ──
    this.currentMapInfo = null;        // 当前地图 { id, name, subtitle, line }
    this.currentStage = 0;             // 当前层（0=起点，1-10=正式层）
    this.currentLine = null;           // 当前主线 (LINE.HUNT / ARCANE / WAR)
    this.runState = {                  // 本局运行时状态
      visitedMapIds: [],               // 已走过的地图 id
    };
    this._mapNameText = null;          // 小地图上方的地图名称文本
    this._pathChoiceActive = false;    // 三选一 UI 是否激活
    this._pathChoiceObjects = [];      // 三选一 UI 对象
    this._pathDoorZones = [];          // 三选一碰撞区域
  }

  init() {
    // 注意：Phaser 的 scene.start() 会复用 Scene 实例；constructor 不会再次执行。
    // 因此每次开新局都必须在 init() 重置"六选一/出口门/关卡"状态。

    this.currentLevel = 1;
    this.levelBossTriggered = false;

    this.weaponSelected = false;

    if (Array.isArray(this.weaponPickupColliders) && this.weaponPickupColliders.length > 0) {
      this.weaponPickupColliders.forEach(c => c?.destroy?.());
    }
    this.weaponPickupColliders = [];

    if (Array.isArray(this.weaponPickups) && this.weaponPickups.length > 0) {
      this.weaponPickups.forEach(p => p?.destroy?.());
    }
    this.weaponPickups = [];

    this.weaponPickupNodes = [];

    this.exitDoorActive = false;
    this.exitDoorZone = null;
    this.exitDoorVisuals = null;

    this.inStartRoom = true;
    this.adventureStarted = false;
    this.startRoomDoorActive = false;
    this.startRoomDoorZone = null;
    this.startRoomDoorVisuals = null;
    this._startRoomObjects = [];

    // 从菜单/查看界面返回重新开局时：强制恢复可操作状态
    //（Scene 实例复用，上一局可能残留 pause）
    if (this.physics?.world) this.physics.world.resume();
    if (this.anims) this.anims.resumeAll();
    if (this.time) this.time.paused = false;
    if (this.tweens) this.tweens.resumeAll();
    if (this.input) this.input.enabled = true;
    if (this.input?.keyboard) this.input.keyboard.enabled = true;

    // 防止"上局查看菜单状态残留导致 update 直接 return"
    this.viewMenuOpen = false;
    this.viewMenuClosing = false;
    this._viewMenuResumePending = false;

    // 防止"上局升级/商店等叠加场景残留拦截输入"
    // 这里 stop 是幂等的：未运行则无影响。
    if (this.scene) {
      ['LevelUpScene', 'BuildTreeScene', 'ShopScene', 'ItemShopScene', 'EquipmentScene'].forEach((k) => {
        try { this.scene.stop(k); } catch (_) { /* ignore */ }
      });
    }

    // 新开一局：清理本局职业/天赋状态（避免上局残留导致"主武器不重新摆放/不切换"）
    if (this.registry) {
      this.registry.remove('mainCore');
      this.registry.remove('offCore');
      this.registry.remove('offFaction');
      this.registry.remove('thirdSpecType');
      this.registry.remove('naturePetType');
      this.registry.remove('selectedTrees');
      this.registry.remove('skillTreeLevels');
    }

    // 可暂停的"局内逻辑时钟"（用于物品冷却等需要在菜单暂停的节奏）
    this._gameplayNowMs = 0;
    this._skipGameplayDeltaOnce = false;
    this._itemCooldownReadyNotified = Object.create(null);

    // ── 地图分支系统重置 ──
    this.currentMapInfo = { ...START_ROOM };
    this.currentStage = 0;
    this.currentLine = null;
    this.runState = { visitedMapIds: [] };
    this._pathChoiceActive = false;
    this._pathChoiceObjects = [];
    this._pathDoorZones = [];
    this._mapNameText = null;
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  getUiSnapshot() {
    const selectedTrees = this.registry.get('selectedTrees') || [];
    const skillTreeLevels = this.registry.get('skillTreeLevels') || {};
    const mainCore = this.registry.get('mainCore') || this.buildState?.core || null;
    const offFaction = this.registry.get('offFaction') || null;
    const naturePetType = this.registry.get('naturePetType') || null;

    const inventoryEquipped = Array.isArray(this.inventoryEquipped)
      ? this.inventoryEquipped.map(i => (i ? { id: i.id, name: i.name, desc: i.desc, icon: i.icon, effects: i.effects, count: i.count } : null))
      : [];
    const inventoryAcquired = Array.isArray(this.inventoryAcquired)
      ? this.inventoryAcquired.map(i => (i ? { id: i.id, name: i.name, desc: i.desc, icon: i.icon, effects: i.effects, count: i.count } : null))
      : [];

    const p = this.player || {};
    const player = {
      maxHp: p.maxHp,
      fireRate: p.fireRate,
      bulletDamage: p.bulletDamage,
      critChance: p.critChance,
      critMultiplier: p.critMultiplier,
      lifestealPercent: p.lifestealPercent,
      shieldCharges: p.shieldCharges,
      moveSpeed: p.moveSpeed,
      damageReductionPercent: p.damageReductionPercent,
      dodgePercent: p.dodgePercent,
      regenPerSec: p.regenPerSec
    };

    const itemCooldowns = (() => {
      const src = p.itemCooldowns || null;
      if (!src || typeof src !== 'object') return {};
      // 浅拷贝，避免 React 侧误改内部引用
      return { ...src };
    })();

    return {
      selectedTrees,
      skillTreeLevels,
      mainCore,
      offFaction,
      naturePetType,
      inventoryEquipped,
      inventoryAcquired,
      sessionCoins: this.sessionCoins || 0,
      globalCoins: this.globalCoins || 0,
      player,
      gameplayNowMs: Number(this._gameplayNowMs || 0),
      itemCooldowns
    };
  }

  emitUiSnapshot() {
    if (!this.isReactUiMode()) return;
    uiBus.emit('phaser:uiSnapshot', this.getUiSnapshot());
  }

  create() {
    console.log('GameScene: 游戏场景已加载');

    uiBus.emit('phaser:sceneChanged', 'GameScene');
    uiBus.emit('phaser:inGameChanged', true);

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // 设置背景
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // 主界面保持"白纸"，血条 HUD 放在左上角（Canvas 内机制）
    this.bottomPanelHeight = 0;
    this.gameArea = {
      x: 50,
      y: 50,
      width: this.cameras.main.width - 100,
      height: this.cameras.main.height - 100 - this.bottomPanelHeight
    };

    this.bottomHudTopY = this.gameArea.y + this.gameArea.height;

    // 左上角血条 HUD
    this.createTopLeftHud();

    // 系统提示 UI（Phaser 内 HUD 层）
    // 需求：提示框再放上去一点，但不要挡住经验条
    this.systemMessage = new SystemMessageOverlay(this, { anchorY: 0.92 });

    // 右下角 Toast（队列化弹出并渐隐）
    this.toast = new ToastOverlay(this);

    // React UI -> Phaser
    this._uiToggleHandler = () => {
      if (this.viewMenuOpen) this.closeViewMenu();
      else this.openViewMenu();
    };
    uiBus.on('ui:toggleView', this._uiToggleHandler);

    this._uiSetViewHandler = (open) => {
      if (open) this.openViewMenu();
      else this.closeViewMenu();
    };
    uiBus.on('ui:setViewOpen', this._uiSetViewHandler);

    this._uiGoMenuHandler = () => {
      // React 的"退出/返回主菜单"按钮
      if (this.viewMenuOpen) this.closeViewMenu();
      // 本局战利品/掉落：退出时立刻清空（本局制，不进入装备系统）
      this.inventoryAcquired = [];
      this.drops = [];
      this.scene.start('MenuScene');
    };
    uiBus.on('ui:goMenu', this._uiGoMenuHandler);

    this._uiRequestSnapshotHandler = () => {
      this.emitUiSnapshot();
    };
    uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

    // 确保场景切换时释放 uiBus 监听，避免重复绑定
    this.events.once('shutdown', this.shutdown, this);

    // 初始化游戏系统
    this.initGameSystems();

    // 新流程：先进入起始房间（小地图、无迷雾、无 Boss）
    this.enterStartRoom();

    // 从升级/商店等叠加场景恢复时，确保各系统解除暂停
    this.events.on('resume', () => {
      // 避免"暂停期间累积的巨大 delta"导致物品 CD 被补算
      this._skipGameplayDeltaOnce = true;

      if (this.physics?.world) this.physics.world.resume();
      if (this.anims) this.anims.resumeAll();
      if (this.time) this.time.paused = false;
      if (this.tweens) this.tweens.resumeAll();

      // 升级选择场景结束：允许继续弹出后续升级
      this._levelUpActive = false;
      if (this.time) {
        this.time.delayedCall(0, () => this.startNextPendingLevelUp());
      } else {
        this.startNextPendingLevelUp();
      }
    });
  }

  shutdown() {
    // 本局掉落/战利品是一次性的：死亡或退出导致场景关闭时清空
    this.inventoryAcquired = [];
    this.drops = [];

    // 清理三选一 UI
    this.cleanupPathChoiceObjects();

    if (this._uiToggleHandler) {
      uiBus.off('ui:toggleView', this._uiToggleHandler);
      this._uiToggleHandler = null;
    }

    if (this._uiSetViewHandler) {
      uiBus.off('ui:setViewOpen', this._uiSetViewHandler);
      this._uiSetViewHandler = null;
    }

    if (this._uiGoMenuHandler) {
      uiBus.off('ui:goMenu', this._uiGoMenuHandler);
      this._uiGoMenuHandler = null;
    }

    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
  }

  /**
   * 初始化游戏系统
   */
  initGameSystems() {
    // 玩家数据
    this.playerData = {
      hp: 100,
      maxHp: 100,
      level: 1,
      exp: 0,
      maxExp: this.getMaxExpForLevel(1),
      score: 0
    };

    // 升级队列：支持一次获得多级时逐次弹出三选一
    this._pendingLevelUpLevels = [];
    this._levelUpActive = false;

    // 第一关流程：首波小怪 -> 升级三选一 -> 再遇 Boss
    this._level1IntroWaveActive = false;
    this._level1IntroWaveCleared = false;
    this._level1BossPendingSpawn = false;

    // 金币数据（仍保留数值，但不在主界面显示）
    this.sessionCoins = 0;
    this.globalCoins = this.registry.get('globalCoins') || 0;

    // 物品池（示例道具）
    this.itemPool = ITEM_DEFS;

    // 背包与携带栏
    // - 携带：固定 6 格
    // - 拾取：不限制个数（查看菜单默认展示前 12 个）
    const equippedIdsRaw = this.registry.get('equippedItems') || new Array(6).fill(null);
    const equippedIds = [...equippedIdsRaw].slice(0, 6);
    while (equippedIds.length < 6) equippedIds.push(null);

    this.inventoryAcquired = [];
    this.inventoryEquipped = equippedIds.map(id => (id ? getItemById(id) : null));

    // 局内战利品（碎片等）：堆叠计数，本局结束清空，不进入装备系统
    this._runLootShardCounts = Object.create(null);

    // 物品（测试用）：仅用于装备系统测试。
    // 注意：游戏内"战利品"(inventoryAcquired) 是本局打怪掉落的临时列表，应当开局为空，且本局结束后清空。
    const testItemIds = [
      'potion_small',
      'potion_big',
      'revive_cross',
      'shield',
      'crit',
      'lifesteal',
      'magnet',
      'move_speed'
    ];

    // 2) EquipmentScene 使用 registry.ownedItems
    const owned = Array.isArray(this.registry.get('ownedItems')) ? [...this.registry.get('ownedItems')] : [];
    testItemIds.forEach((id) => {
      if (!owned.includes(id)) owned.push(id);
    });
    this.registry.set('ownedItems', owned);

    // 掉落物列表
    this.drops = [];

    // 主动流派装备栏
    this.activeBuilds = [];

    // Build 状态
    this.buildState = {
      core: null,
      levelUps: 0,
      lastMixLevel: 0
    };

    // 测试阶段：后续三选一数量（未来可改 4 等）
    this.levelUpChoiceCount = 3;

    // 玩家无法靠近 Boss 的额外缓冲（像"Boss 专属区域"）
    this.bossNoGoPadding = 60;

    // Build 系统
    this.droneEnabled = false;
    this.droneCount = 0;
    this.droneFireRate = 750;
    this.droneLastShot = 0;
    this.droneLastHeal = 0;
    this.droneLastShield = 0;
    this.droneUnits = [];
    this.droneMaxCount = 9;
    this.droneTracking = false;
    this.droneTrackingTurn = 0.06;

    this.meleeEnabled = false;
    this.meleeCooldown = 900;
    this.meleeLastTime = 0;
    this.thornsPercent = 0.08;

    this.laserEnabled = false;

    this.paladinEnabled = false;
    this.paladinCooldown = 5000;
    this.paladinLastTime = 0;
    this.paladinPulseRadius = 130;
    this.paladinPulseDamage = 70;

    this.warlockEnabled = false;
    // 旧"中毒/虚弱 debuff"是否在命中时自动施加
    this.warlockDebuffEnabled = false;
    this.warlockPoisonDps = 6;
    this.warlockPoisonDuration = 3500;
    this.warlockWeakenAmount = 0.15;
    this.warlockSlowAmount = 0.15;

    // 初始化弹幕管理器（必须在玩家和Boss管理器之前）
    this.bulletManager = new BulletManager(this);
    
    // 初始化玩家
    const spawnX = this.gameArea.x + this.gameArea.width / 2;
    const spawnY = this.gameArea.y + this.gameArea.height - 100;
    this.player = new Player(this, spawnX, spawnY);

    // 移动端隐藏摇杆（不影响键盘 WASD）
    this.setupTouchJoystick();

    // 新流程：开局不启用散射自动射击；必须先选择地上的武器
    this.player.canFire = false;

    // 初始化宠物管理器（真实宠物：熊/鹰/树精）
    this.petManager = new PetManager(this);
    this.petManager.setPlayer(this.player);

    // 应用装备加成
    this.applyEquippedEffects();
    
    // 初始化 Boss 管理器
    this.bossManager = new BossManager(this);
    
    // 初始化碰撞检测管理器
    this.collisionManager = new CollisionManager(this);
    this.collisionManager.setPlayer(this.player);
    this.collisionManager.setBossManager(this.bossManager);
    
    // 监听玩家信息更新
    this.events.on('updatePlayerInfo', () => {
      this.updateInfoPanel();
    });

    // 监听升级选择
    this.game.events.on('upgradeSelected', (upgrade) => {
      this.applyUpgrade(upgrade);
    });

    // 小怪击杀：经验 + 概率掉金币
    this.events.on('minionKilled', (payload) => {
      const exp = Math.max(0, payload?.expReward || 0);
      if (exp > 0) this.addExp(exp, { source: 'minion' });

      // 小怪也能掉金币（更明显 + 体积更大）
      const chance = payload?.isElite ? 0.55 : 0.30;
      if (Math.random() < chance) {
        const amount = payload?.isElite
          ? Phaser.Math.Between(14, 26)
          : Phaser.Math.Between(6, 14);
        this.spawnCoinDrop(
          (payload?.x ?? 0) + Phaser.Math.Between(-18, 18),
          (payload?.y ?? 0) + Phaser.Math.Between(-12, 12),
          amount
        );
      }

      // 小怪/精英：小概率掉落"碎片宝箱"（局内一次性叠加属性）
      {
        const shardChance = payload?.isElite ? 0.10 : 0.035;
        const shardPool = Array.isArray(this.itemPool) ? this.itemPool.filter((it) => it && it.kind === 'shard' && it.shard) : [];
        if (shardPool.length > 0 && Math.random() < shardChance) {
          const item = Phaser.Math.RND.pick(shardPool);
          this.spawnItemDrop(
            (payload?.x ?? 0) + Phaser.Math.Between(-22, 22),
            (payload?.y ?? 0) + Phaser.Math.Between(-14, 14),
            item
          );
        }
      }

      this.events.emit('updatePlayerInfo');

      // 第一关：首波小怪清完后，Boss 延迟到"升级三选一结束"再生成
      if (this._level1IntroWaveActive && !this._level1IntroWaveCleared) {
        const alive = (this.bossManager?.getMinions?.() || []).filter((m) => m && m.isAlive && m.isIntroWave);
        if (alive.length === 0) {
          this._level1IntroWaveActive = false;
          this._level1IntroWaveCleared = true;
          this._level1BossPendingSpawn = false;
          console.log('[Level1] intro wave cleared');
        }
      }
    });

    // 教程Boss：击杀后直接进入三选一路径（核心已在起始房间选武器时确定）
    this.events.on('tutorialBossDefeated', (data) => {
      console.log('[TutorialBoss] defeated, scheduling path choice');

      // 给予Boss经验/分数奖励
      if (this.playerData) {
        this.playerData.score += (data?.score || 0);
        const exp = data?.exp || 0;
        if (exp > 0) this.addExp(exp, { source: 'boss' });
        this.events.emit('updatePlayerInfo');
      }

      // Boss掉落
      if (this.bossManager) {
        const boss = this.bossManager.currentBoss;
        // 教程Boss已在BossManager.onBossDefeated中被设null，用data坐标代替
      }

      // 延迟后直接打开三选一路径门
      this.time.delayedCall(700, () => {
        this.onBossDefeatedOpenExitDoor();
      });
    });
    
    // 监听玩家死亡
    this.events.on('playerDied', () => {
      console.log('游戏结束 - 玩家死亡');
    });

    // 监听场景关闭事件
    this.events.on('shutdown', () => {
      this.onSceneShutdown();
    });
    
    console.log('游戏系统初始化完成');
    
    // 延迟生成教程 Boss（击杀后进入第一次三选一）
    // 新关卡流程：Boss 由"进入 Boss 房间"触发生成
    //（保留旧逻辑入口：如果你后面还要做"初始选择武器/教程"，可以在这里按模式分支）
    
    // 注意：新流程 StartRoom 会显示"请选择武器"系统提示；这里不再弹旧的 start message，避免遮挡。
    
    // 显示操作提示
    // 初始化 HUD
    this.updateInfoPanel();
    this.updateInventoryUI();
  }

  setupTouchJoystick() {
    // Scene 实例会复用；避免重复绑定
    this.destroyTouchJoystick();

    // 支持多指（右侧按钮/点击与左侧摇杆并存）
    if (this.input?.addPointer) {
      this.input.addPointer(2);
    }

    const width = this.cameras?.main?.width || this.scale?.width || 0;

    // 目标：移动端手感尽量贴近 WASD（更大热区、更容易到满速、手指滑动不易“脱离摇杆”）
    const cfg = {
      // 摇杆最大位移半径（像素）
      maxRadius: 110,
      // 死区（像素）
      deadZone: 10,
      // 仅左半屏启动摇杆（避免与右侧操作冲突）
      leftOnly: true,
      // 跟随式：当手指超过 maxRadius 时，摇杆中心跟随手指移动，避免触控范围太小
      followWhenOutOfRange: true,
      // 让摇杆更接近“数字输入”（WASD 一按就满速）
      // - magnitude >= fullSpeedThreshold 时直接视为满速
      // - 否则使用加速曲线尽快抬升速度
      fullSpeedThreshold: 0.35,
      responseExponent: 0.65
    };

    const base = this.add.circle(0, 0, 44, 0x000000, 0.22)
      .setScrollFactor(0)
      .setDepth(10000)
      .setVisible(false);

    const thumb = this.add.circle(0, 0, 20, 0xffffff, 0.22)
      .setScrollFactor(0)
      .setDepth(10001)
      .setVisible(false);

    this._touchJoystick = {
      activePointerId: null,
      center: new Phaser.Math.Vector2(0, 0),
      value: new Phaser.Math.Vector2(0, 0),
      base,
      thumb,
      cfg
    };

    const onDown = (pointer, currentlyOver) => {
      if (!pointer) return;
      if (!this.player) return;

      // 避免抢 HUD/UI（按钮/卡片等 setInteractive 的物体会出现在 currentlyOver）
      // 但不阻止“世界物体”的点击（例如地面掉落物），避免摇杆经常无法启动
      if (Array.isArray(currentlyOver) && currentlyOver.length > 0) {
        const overUi = currentlyOver.some((obj) => {
          if (!obj) return false;
          const depth = obj.depth ?? 0;
          const sfX = obj.scrollFactorX ?? 1;
          const sfY = obj.scrollFactorY ?? 1;
          const isHudLike = (sfX === 0 && sfY === 0) || depth >= 9000;
          const flagged = !!(obj.getData?.('ui') || obj.getData?.('isUI') || obj.getData?.('isUi'));
          return isHudLike || flagged;
        });
        if (overUi) return;
      }

      if (this._touchJoystick.activePointerId != null) return;

      if (cfg.leftOnly && width > 0 && pointer.x > width * 0.5) return;

      this._touchJoystick.activePointerId = pointer.id;
      this._touchJoystick.center.set(pointer.x, pointer.y);
      this._touchJoystick.value.set(0, 0);

      base.setPosition(pointer.x, pointer.y).setVisible(true);
      thumb.setPosition(pointer.x, pointer.y).setVisible(true);

      this.player.setAnalogMove(0, 0, true);
    };

    const onMove = (pointer) => {
      if (!pointer) return;
      if (!this.player) return;
      if (this._touchJoystick.activePointerId == null) return;
      if (pointer.id !== this._touchJoystick.activePointerId) return;

      let cx = this._touchJoystick.center.x;
      let cy = this._touchJoystick.center.y;
      let dx = pointer.x - cx;
      let dy = pointer.y - cy;
      let dist = Math.hypot(dx, dy);

      if (dist <= cfg.deadZone) {
        this._touchJoystick.value.set(0, 0);
        thumb.setPosition(cx, cy);
        this.player.setAnalogMove(0, 0, true);
        return;
      }

      // 跟随式摇杆：当手指拉得太远，让中心向手指方向移动，避免“范围太小/手指滑出”
      if (cfg.followWhenOutOfRange && dist > cfg.maxRadius && dist > 0.0001) {
        const over = dist - cfg.maxRadius;
        const ux = dx / dist;
        const uy = dy / dist;
        cx += ux * over;
        cy += uy * over;
        this._touchJoystick.center.set(cx, cy);
        base.setPosition(cx, cy);
        dx = pointer.x - cx;
        dy = pointer.y - cy;
        dist = Math.hypot(dx, dy);
      }

      if (dist > cfg.maxRadius && dist > 0.0001) {
        dx = (dx / dist) * cfg.maxRadius;
        dy = (dy / dist) * cfg.maxRadius;
        dist = cfg.maxRadius;
      }

      // [-1,1] 的原始方向向量
      let nx = Phaser.Math.Clamp(dx / cfg.maxRadius, -1, 1);
      let ny = Phaser.Math.Clamp(dy / cfg.maxRadius, -1, 1);

      // 响应曲线：更接近 WASD 的“更快到满速”
      const mag = Math.hypot(nx, ny);
      if (mag > 0.0001) {
        const dirX = nx / mag;
        const dirY = ny / mag;

        const t = Phaser.Math.Clamp(mag / Math.max(0.0001, cfg.fullSpeedThreshold), 0, 1);
        const curved = Math.pow(t, cfg.responseExponent);
        const outMag = (mag >= cfg.fullSpeedThreshold) ? 1 : curved;

        nx = dirX * outMag;
        ny = dirY * outMag;
      } else {
        nx = 0;
        ny = 0;
      }

      this._touchJoystick.value.set(nx, ny);

      thumb.setPosition(cx + dx, cy + dy);
      this.player.setAnalogMove(nx, ny, true);
    };

    const onUp = (pointer) => {
      if (!pointer) return;
      if (this._touchJoystick.activePointerId == null) return;
      if (pointer.id !== this._touchJoystick.activePointerId) return;

      this._touchJoystick.activePointerId = null;
      this._touchJoystick.value.set(0, 0);
      base.setVisible(false);
      thumb.setVisible(false);
      this.player?.clearAnalogMove?.();
    };

    this._touchJoystickHandlers = { onDown, onMove, onUp };

    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this.input.on('pointerupoutside', onUp);
  }

  destroyTouchJoystick() {
    if (this._touchJoystickHandlers && this.input) {
      const { onDown, onMove, onUp } = this._touchJoystickHandlers;
      try { this.input.off('pointerdown', onDown); } catch (_) { /* ignore */ }
      try { this.input.off('pointermove', onMove); } catch (_) { /* ignore */ }
      try { this.input.off('pointerup', onUp); } catch (_) { /* ignore */ }
      try { this.input.off('pointerupoutside', onUp); } catch (_) { /* ignore */ }
    }

    if (this._touchJoystick?.base) {
      this._touchJoystick.base.destroy();
    }
    if (this._touchJoystick?.thumb) {
      this._touchJoystick.thumb.destroy();
    }

    this._touchJoystick = null;
    this._touchJoystickHandlers = null;

    // 确保玩家不会因残留输入持续移动
    this.player?.clearAnalogMove?.();
  }

  /**
   * 每帧更新
   */
  update(time, delta) {
    // 物品冷却等逻辑使用"可暂停时钟"：
    // - 打开查看菜单/升级/商店等暂停期间不推进
    // - 恢复后的第一帧跳过 delta，避免补算
    if (!Number.isFinite(this._gameplayNowMs)) this._gameplayNowMs = 0;
    const menuFrozen = (this.viewMenuOpen || this.viewMenuClosing);
    if (this._skipGameplayDeltaOnce) {
      this._skipGameplayDeltaOnce = false;
    } else if (!menuFrozen) {
      const d = Number(delta || 0);
      if (d > 0) this._gameplayNowMs += d;
    }

    // 查看菜单打开/关闭动画中：冻结战斗更新，只允许菜单交互
    // 但允许菜单 UI 做轻量动画（例如双职业彩虹边框）。
    if (menuFrozen) {
      if (this.viewMenuOpen) {
        this.updateViewMenuUiAnimations(time, delta);
      }
      return;
    }

    // 菜单刚关闭：重置若干节奏计时，避免"补帧/补刀"
    if (this._viewMenuResumePending) {
      this._viewMenuResumePending = false;
      if (this.meleeEnabled) {
        // 半月斩挥砍采用 while(time-start>=duration) 追赶节奏；暂停后需要对齐到当前时间
        this.slashSwingStartTime = time;
      }
    }

    // 更新玩家
    if (this.player) {
      this.player.update(time, delta);
    }
    
    // 更新 Boss 管理器
    if (this.bossManager) {
      this.bossManager.update(time, delta);
    }
    
    // 更新弹幕管理器（位置更新和清理）
    if (this.bulletManager) {
      this.bulletManager.update(delta);
    }
    
    // 更新碰撞检测
    if (this.collisionManager) {
      this.collisionManager.update();
    }

    // 自动消耗品（装备后触发）：血瓶/大血瓶
    this.updateAutoConsumables(this._gameplayNowMs);

    // CD 转好提示（右下角 Toast）
    this.checkEquippedItemCooldownReadyToasts(this._gameplayNowMs);

    // 更新宠物
    if (this.petManager) {
      this.petManager.update(time, delta);
    }

    // 起始房间流程：选武器 -> 出现门 -> 进门开始第一关
    if (this.inStartRoom) {
      if (this.weaponSelected && !this.startRoomDoorActive) {
        this.spawnStartRoomDoor();
      }
      if (this.startRoomDoorActive && this.startRoomDoorZone && this.player) {
        const dx = this.player.x - this.startRoomDoorZone.x;
        const dy = this.player.y - this.startRoomDoorZone.y;
        const hx = (this.startRoomDoorZone.width || 0) * 0.5;
        const hy = (this.startRoomDoorZone.height || 0) * 0.5;
        if (Math.abs(dx) <= hx && Math.abs(dy) <= hy) {
          this.beginAdventureFromStartRoom();
        }
      }
    }

    // 更新掉落物
    this.updateDrops(delta);

    // Build 逻辑更新
    this.updateDrones(time, delta);
    this.updateMelee(time);
    this.updatePaladinPulse(time);
    this.updateWarlockDebuff(time, delta);
    this.updatePaladinTargetingRing(time);
    this.updateArcherRangeRing(time);

    // 地图：迷雾（柔和永久揭开）+ 小地图
    if (this.fogMode === 'soft' && this.player) {
      // 若进入战斗/敌人接近，扩大视野，避免敌人躲在迷雾里攻击
      const cell = (this.mapConfig?.cellSize || 128);
      const boss = this.bossManager?.getCurrentBoss?.() || null;
      const minions = this.bossManager?.getMinions?.() || [];
      const inCombat = !!(boss && boss.isAlive && boss.combatActive);
      const closeEnemy = (!inCombat && (Array.isArray(minions) ? minions.some(m => {
        if (!m || !m.isAlive) return false;
        const dx = m.x - this.player.x;
        const dy = m.y - this.player.y;
        return (dx * dx + dy * dy) <= Math.pow(cell * 3.2, 2);
      }) : false));

      const playerScale = (inCombat || closeEnemy) ? 1.7 : 1.25;
      // 玩家：更频繁（移动+时间双阈值）
      this.revealFogAt(this.player.x, this.player.y, false, playerScale, { tag: 'player', minIntervalMs: 40, minDist: 10 });

      // 额外揭开敌人周围（只在敌人接近时做，避免过度开图）
      const enemyRevealTriggerR = cell * 6;
      if (boss && boss.isAlive && boss.combatActive) {
        const dx = boss.x - this.player.x;
        const dy = boss.y - this.player.y;
        if ((dx * dx + dy * dy) <= (enemyRevealTriggerR * enemyRevealTriggerR)) {
          // Boss：低频即可（避免持续擦除带来的掉帧）
          this.revealFogAt(boss.x, boss.y, false, 1.9, { tag: 'boss', minIntervalMs: 140, minDist: 18 });
        }
      }
      if (Array.isArray(minions) && minions.length > 0) {
        minions.forEach(m => {
          if (!m || !m.isAlive) return;
          const dx = m.x - this.player.x;
          const dy = m.y - this.player.y;
          if ((dx * dx + dy * dy) <= (enemyRevealTriggerR * enemyRevealTriggerR)) {
            // 小怪：更低频
            const id = (m.__enemyId != null) ? String(m.__enemyId) : (m.minionName || 'm');
            this.revealFogAt(m.x, m.y, false, 1.5, { tag: `minion:${id}`, minIntervalMs: 180, minDist: 22 });
          }
        });
      }
    }
    this.updateMiniMapOverlay();

    // 开局六选一：不依赖 Arcade Physics，使用距离触碰拾取
    // 起始房间的图标使用 scrollFactor=0（屏幕坐标），因此检测也要用"玩家屏幕坐标"。
    if (!this.weaponSelected && (this.currentLevel || 1) === 1 && this.player && Array.isArray(this.weaponPickupNodes) && this.weaponPickupNodes.length > 0) {
      const cam = this.cameras.main;
      const view = cam.worldView;
      const playerWorldX = this.player.x;
      const playerWorldY = this.player.y;
      const playerScreenX = playerWorldX - view.x;
      const playerScreenY = playerWorldY - view.y;
      const screenSpace = !!this.inStartRoom;

      for (let i = 0; i < this.weaponPickupNodes.length; i++) {
        const n = this.weaponPickupNodes[i];
        if (!n) continue;
        const dx = (screenSpace ? playerScreenX : playerWorldX) - n.x;
        const dy = (screenSpace ? playerScreenY : playerWorldY) - n.y;
        const r = n.radius || 40;
        if ((dx * dx + dy * dy) <= (r * r)) {
          this.selectStartingWeapon(n.coreUpgradeId, n.displayName);
          break;
        }
      }
    }

    // Boss 视野检测：Boss 常驻；玩家进入范围后才开始攻击
    if (this.player && this.bossManager?.getCurrentBoss) {
      const boss = this.bossManager.getCurrentBoss();
      if (boss && boss.isAlive) {
        // 第一关：未选武器前不允许开战（避免"没拿武器就被打"）
        const gated = ((this.currentLevel || 1) === 1 && !this.weaponSelected);
        if (!gated && boss.combatActive === false) {
          const aggroR = Math.floor((this.mapConfig?.cellSize || 128) * 3.0);
          const dx = this.player.x - boss.x;
          const dy = this.player.y - boss.y;
          if ((dx * dx + dy * dy) <= (aggroR * aggroR)) {
            if (typeof boss.setCombatActive === 'function') boss.setCombatActive(true);
            else boss.combatActive = true;

            if (typeof this.bossManager.showBossWarning === 'function') {
              this.bossManager.showBossWarning(boss.bossName || 'Boss');
            }
          }
        }
      }
    }

    // 出口门：击败 Boss 后，进入门才进入下一关
    if (this.exitDoorActive && this.exitDoorZone && this.player) {
      const dx = this.player.x - this.exitDoorZone.x;
      const dy = this.player.y - this.exitDoorZone.y;
      const hx = (this.exitDoorZone.width || 0) * 0.5;
      const hy = (this.exitDoorZone.height || 0) * 0.5;
      if (Math.abs(dx) <= hx && Math.abs(dy) <= hy) {
        // 防止重复触发
        this.exitDoorActive = false;
        this.advanceToNextLevel();
      }
    }

    // 三选一路径门：玩家走入任一门触发选择
    if (this._pathChoiceActive && Array.isArray(this._pathDoorZones) && this._pathDoorZones.length > 0 && this.player) {
      for (const entry of this._pathDoorZones) {
        const z = entry.zone;
        if (!z) continue;
        const dx = this.player.x - z.x;
        const dy = this.player.y - z.y;
        const hx = (z.width || 0) * 0.5;
        const hy = (z.height || 0) * 0.5;
        if (Math.abs(dx) <= hx && Math.abs(dy) <= hy) {
          this.selectPathChoice(entry.choice);
          break;
        }
      }
    }
  }

  /**
   * 场景关闭时的清理
   */
  onSceneShutdown() {
    console.log('GameScene: 清理游戏资源');

    // 清理移动端隐藏摇杆
    this.destroyTouchJoystick();
    
    // 销毁月牙斩扇形
    this.destroySlashFan();
    
    // 销毁弹幕管理器
    if (this.bulletManager) {
      this.bulletManager.destroy();
      this.bulletManager = null;
    }

    // 销毁宠物管理器
    if (this.petManager) {
      this.petManager.destroy();
      this.petManager = null;
    }

    // 销毁玩家
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    // 清理Boss
    if (this.bossManager) {
      this.bossManager.destroy();
      this.bossManager = null;
    }

    console.log('GameScene: 资源清理完成');
  }
}

// ── 应用 Mixins ──────────────────────────────────────────
applyHudMixin(GameScene);
applyMapFogMixin(GameScene);
applyDropsInventoryMixin(GameScene);
applyLevelProgressionMixin(GameScene);
applyViewMenuMixin(GameScene);
applyBuildClassMixin(GameScene);

export default GameScene;
