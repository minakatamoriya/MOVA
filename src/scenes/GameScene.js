import Phaser from 'phaser';
import { uiBus } from '../ui/bus';
import BossManager from '../managers/BossManager';
import CollisionManager from '../managers/CollisionManager';
import BulletManager from '../managers/BulletManager';
import Player from '../player/Player';
import { ITEM_DEFS, getItemById, getOwnedItemIds, normalizeEquippedItems } from '../data/items';
import PetManager from '../classes/pets/PetManager';
import UndeadSummonManager from '../classes/pets/UndeadSummonManager';
import SummonRegistry from '../classes/pets/SummonRegistry';
import SystemMessageOverlay from '../ui/SystemMessageOverlay';
import ToastOverlay from '../ui/ToastOverlay';
import CooldownHud from '../ui/CooldownHud';
import { START_ROOM } from '../data/mapPool';
import { BulletCore, PatternSystem, VfxSystem, AttackTimeline, DebugOverlay } from '../systems/bullets';
import { normalizeCoreKey } from '../classes/classDefs';
import { normalizeSkillId } from '../classes/talentTrees';
import { migrateLegacyProgressionRegistry } from '../classes/progression';
import { getBaseColorForCoreKey, lerpColor } from '../classes/visual/basicSkillColors';
import { calculateResolvedDamage } from '../combat/damageModel';

const EMERGENCY_COOLDOWN_DEFS = {
  paladin: {
    talentId: 'paladin_divine_shelter',
    enhancementTalentId: 'paladin_shelter_extension',
    skillId: 'paladin_divine_shelter',
    label: '神圣庇护',
    iconText: '护',
    enhancedLabel: '圣佑绵延',
    enhancedIconText: '佑',
    accentColor: 0xfbbf24,
    durationMs: 5000,
    durationByEnhancementLevel: [5000, 8000, 10000, 12000],
    cooldownMs: 30000,
    values: [0, 0.4, 0.6, 0.8],
    describe(state) {
      const seconds = Math.max(0, Math.round((Number(state.durationMs) || 0) / 1000));
      return `生命低于30%时自动触发：获得${Math.round((state.value || 0) * 100)}%减伤，持续${seconds}秒。冷却30秒。`;
    }
  },
  archer: {
    talentId: 'archer_nimble_evade',
    enhancementTalentId: 'archer_evade_mastery',
    skillId: 'archer_nimble_evade',
    label: '灵巧回避',
    iconText: '避',
    enhancedLabel: '残影步调',
    enhancedIconText: '影',
    accentColor: 0x34d399,
    durationMs: 3000,
    durationByEnhancementLevel: [3000, 5000, 8000, 10000],
    cooldownMs: 30000,
    values: [0, 0.4, 0.6, 0.8],
    describe(state) {
      const seconds = Math.max(0, Math.round((Number(state.durationMs) || 0) / 1000));
      return `生命低于30%时自动触发：闪避率 +${Math.round((state.value || 0) * 100)}%，持续${seconds}秒。冷却30秒。`;
    }
  },
  warrior: {
    talentId: 'warrior_blood_conversion',
    enhancementTalentId: 'warrior_bloodlust_mastery',
    skillId: 'warrior_blood_conversion',
    label: '猩红嗜血',
    iconText: '血',
    enhancedLabel: '狂血渴饮',
    enhancedIconText: '狂',
    accentColor: 0xf87171,
    cooldownMs: 30000,
    values: [0, 1.0, 1.0, 1.0],
    lifestealMultiplierByEnhancementLevel: [1.0, 1.2, 1.5, 2.0],
    durationByLevel: [0, 5000, 10000, 15000],
    describe(state) {
      const seconds = Math.max(0, Math.round((Number(state.durationMs) || 0) / 1000));
      return `生命低于30%时自动触发：攻击伤害转化为${Math.round((state.value || 0) * 100)}%吸血，持续${seconds}秒。冷却30秒。`;
    }
  },
  mage: {
    talentId: 'mage_frost_nova',
    enhancementTalentId: 'mage_frost_domain',
    skillId: 'mage_frost_nova',
    label: '冰霜新星',
    iconText: '冰',
    enhancedLabel: '极寒疆域',
    enhancedIconText: '霜',
    accentColor: 0x7dd3fc,
    cooldownMs: 30000,
    radiusPx: 220,
    radiusByEnhancementLevel: [220, 300, 380, 480],
    values: [0, 3000, 5000, 10000],
    describe(state) {
      const seconds = Math.max(0, Math.round((Number(state.value) || 0) / 1000));
      return `生命低于30%时自动触发：释放冰霜新星，冻结周围敌人${seconds}秒，范围${Math.round(state.radiusPx || 0)}。冷却30秒。`;
    }
  },
  warlock: {
    talentId: 'warlock_infernal',
    enhancementTalentId: 'warlock_infernal_contract',
    skillId: 'warlock_infernal',
    label: '灵魂虹吸',
    iconText: '魂',
    enhancedLabel: '白骨护甲',
    enhancedIconText: '骨',
    accentColor: 0x22c55e,
    cooldownMs: 30000,
    values: [0, 0.30, 0.50, 1.0],
    durationByLevel: [0, 3000, 5000, 10000],
    overhealBarrierCapRatioByEnhancementLevel: [0, 0.10, 0.20, 0.30],
    describe(state) {
      const seconds = Math.max(0, Math.round((Number(state.durationMs) || 0) / 1000));
      const barrierCap = Math.round((Number(state.overhealBarrierCapRatio || 0)) * 100);
      const barrierText = barrierCap > 0 ? ` 过量治疗会转化为上限${barrierCap}%最大生命的白骨护盾。` : '';
      return `生命首次跌破30%时自动触发：持续${seconds}秒，将造成伤害的${Math.round((state.value || 0) * 100)}%转化为生命。冷却30秒。${barrierText}`;
    }
  },
  druid: {
    talentId: 'druid_nourish',
    enhancementTalentId: 'druid_nourish_growth',
    skillId: 'druid_nourish',
    label: '自然滋养',
    iconText: '养',
    enhancedLabel: '丰饶脉动',
    enhancedIconText: '丰',
    accentColor: 0x22c55e,
    cooldownMs: 30000,
    values: [0, 0.3, 0.3, 0.3],
    healMultiplierByEnhancementLevel: [1.0, 1.5, 1.8, 2.0],
    durationByLevel: [0, 15000, 10000, 5000],
    describe(state) {
      const seconds = Math.max(0, Math.round((Number(state.durationMs) || 0) / 1000));
      return `生命低于30%时自动触发：在${seconds}秒内缓慢回复${Math.round((state.value || 0) * 100)}%生命。冷却30秒。`;
    }
  }
};

function getPlayerTouchRadius(player) {
  if (!player) return 0;
  const r = (player.hitboxRadius != null) ? player.hitboxRadius : (player.getHitboxPosition?.().radius);
  return Math.max(1, Math.floor(Number(r) || 8));
}

// Ellipse touch (approx): player is a circle; we consider touch when the player center
// is within an ellipse expanded by (playerRadius + touchPadPx).
function isTouchingRiftPortal(player, rift) {
  if (!player || !rift) return false;
  const a = Number(rift.a) || 0;
  const b = Number(rift.b) || 0;
  if (a <= 1 || b <= 1) return false;

  const px = Number(player.x) || 0;
  const py = Number(player.y) || 0;
  const cx = Number(rift.x) || 0;
  const cy = Number(rift.y) || 0;
  const dx = px - cx;
  const dy = py - cy;

  const d = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
  const playerR = getPlayerTouchRadius(player);
  const touchPadPx = Math.max(0, Math.floor(Number(rift.touchPadPx) || 0));
  const minR = Math.max(1, Math.min(a, b));
  const expandN = (playerR + touchPadPx) / minR;

  return d <= (1 + expandN);
}

function clampTalentLevel(level) {
  return Math.max(0, Math.min(3, Math.round(Number(level) || 0)));
}

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
 *   DropsInventoryMixin    – 掉落物、背包、消耗品
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
    this.exitDoorRift = null;

    // 新流程：起始房间（无迷雾、无 Boss），选武器后进门进入第一关
    this.inStartRoom = true;
    this.adventureStarted = false;
    this.startRoomDoorActive = false;
    this.startRoomDoorZone = null;
    this.startRoomDoorVisuals = null;
    this.startRoomDoorRift = null;
    this._startRoomObjects = [];

    // 混沌竞技场不再使用迷雾与小地图
    this.fogMode = 'none';

    // 地图背景图缩放系数：1=按 Cover 铺满；<1 会让背景图更小（可能露出边缘空白）
    this.mapBgScaleMult = 1;

    // 开发期调试：网格线/编号/不可走格子标注
    this.debugGridEnabled = false;
    this.debugGridShowLabels = true;
    this.debugGridInteractive = true;
    this.debugBlockedCells = new Set();

    // 固定阻挡配置（按地图 id -> idx 列表/Set）
    // 例：this.blockedCellsByMapId = { tutorial_level: [0,1,2] }
    this.blockedCellsByMapId = Object.create(null);

    // 系统提示（居中偏上，带倒计时条/渐隐/可手动关闭）
    this.systemMessage = null;

    // 移动端：隐藏摇杆（按下出现、松开隐藏）
    this._touchJoystick = null;
    this._touchJoystickHandlers = null;

    // 索敌提示圈（战士/圣骑）
    this._warriorTargetRing = null;
    this._paladinTargetRing = null;
    this._archerRangeRing = null;
    this._mageRangeRing = null;
    this._druidRangeRing = null;
    this._warlockRangeRing = null;

    // 统一开关：攻击范围提示圈（默认开启）
    this.showRangeIndicators = true;

    // 通用 CD 技能槽：用于后续各职业主动技能的统一注册与管理
    this.cooldownSkills = Object.create(null);
    this.cooldownHud = null;

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
    this.chaosArenaMaxRounds = 6;
    this._roundBossDefeated = false;
    this._roundClearCountdownActive = false;
    this._roundClearCountdownSeconds = 0;
    this._roundClearCountdownText = null;
    this._roundClearCountdownSubText = null;
    this._roundClearCountdownTimer = null;
    this._postBossRewardActive = false;
    this._postBossRewardChoiceMade = false;
    this._postBossRewardSelected = null;
    this._postBossRewardPayload = null;
    this._postBossRewardObjects = [];
    this._arenaContinueKey = null;

    // 进图过场：半透明遮罩 + 居中文字，期间冻结局内逻辑
    this._sceneIntroActive = false;
    this._sceneIntroOverlay = null;
    this._sceneIntroRestoreState = null;
    this._sceneIntroHideTimer = null;

    // 战斗行为暂停：用于升级演出/三选一路径时停止自动攻击与战斗推进
    this._combatBehaviorPauseApplied = false;
    this._combatBehaviorPauseRestore = null;
  }

  init() {
    // 注意：Phaser 的 scene.start() 会复用 Scene 实例；constructor 不会再次执行。
    // 因此每次开新局都必须在 init() 重置"六选一/出口门/关卡"状态。

    // 迷雾/小地图默认关闭（用于性能排查）；由设置开关控制
    this.fogMode = 'none';

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

    // 玩家死亡状态（Scene 实例复用，需要重置）
    this._playerDeathHandled = false;
    this._levelUpCinematicActive = false;
    this.clearLevelUpPresentation?.();

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
    this._roundBossDefeated = false;
    this._roundClearCountdownActive = false;
    this._roundClearCountdownSeconds = 0;
    this._roundClearCountdownText = null;
    this._roundClearCountdownSubText = null;
    this._roundClearCountdownTimer = null;
    this._postBossRewardActive = false;
    this._postBossRewardChoiceMade = false;
    this._postBossRewardSelected = null;
    this._postBossRewardPayload = null;
    this._postBossRewardObjects = [];
    this._mapNameText = null;
    this._levelUpCinematicActive = false;
    this._combatBehaviorPauseApplied = false;
    this._combatBehaviorPauseRestore = null;
    this.clearSceneEntryPresentation({ immediate: true, restoreControls: false });

    // 范围圈全局开关（可由 UI/调试统一控制）
    const v = this.registry?.get?.('showRangeIndicators');
    this.showRangeIndicators = (typeof v === 'boolean') ? v : true;
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  isCombatBehaviorPaused() {
    return !!(
      this.viewMenuOpen
      || this.viewMenuClosing
      || this._sceneIntroActive
      || this._pathChoiceActive
      || this._postBossRewardActive
    );
  }

  syncCombatBehaviorPause() {
    const player = this.player;
    const shouldPause = this.isCombatBehaviorPaused();

    if (shouldPause) {
      if (this._combatBehaviorPauseApplied) return;

      const preservedCanFire = (() => {
        if (this._sceneIntroActive && this._sceneIntroRestoreState) {
          return this._sceneIntroRestoreState.canFire !== false;
        }
        return player ? (player.canFire !== false) : false;
      })();

      this._combatBehaviorPauseApplied = true;
      this._combatBehaviorPauseRestore = player ? {
        canFire: preservedCanFire,
        fireTimerPaused: !!player.fireTimer?.paused
      } : null;

      if (player) {
        player.canFire = false;
        if (player.fireTimer) player.fireTimer.paused = true;
      }
      return;
    }

    if (!this._combatBehaviorPauseApplied) return;
    this._combatBehaviorPauseApplied = false;

    if (player) {
      const restore = this._combatBehaviorPauseRestore;
      if (restore && Object.prototype.hasOwnProperty.call(restore, 'canFire')) {
        player.canFire = restore.canFire;
      }
      if (player.fireTimer) {
        player.fireTimer.paused = !!(restore?.fireTimerPaused);
      }
    }

    this._combatBehaviorPauseRestore = null;
  }

  getUiSnapshot() {
    const selectedTrees = this.registry.get('selectedTrees') || [];
    const skillTreeLevels = this.registry.get('skillTreeLevels') || {};
    const mainCore = this.registry.get('mainCore') || this.buildState?.core || null;
    const offFaction = this.registry.get('offFaction') || null;
    const naturePetType = this.registry.get('naturePetType') || null;

    const inventoryEquipped = Array.isArray(this.inventoryEquipped)
      ? this.inventoryEquipped.map(i => (i ? {
        id: i.id,
        name: i.name,
        desc: i.desc,
        icon: i.icon,
        effects: i.effects,
        count: i.count,
        kind: i.kind,
        category: i.category,
        categoryLabel: i.categoryLabel,
        consumable: i.consumable,
        rarityId: i.rarityId,
        rarityLabel: i.rarityLabel,
        rarityTextColor: i.rarityTextColor,
        statLines: i.statLines
      } : null))
      : [];
    const inventoryAcquired = Array.isArray(this.inventoryAcquired)
      ? this.inventoryAcquired.map(i => (i ? {
        id: i.id,
        instanceId: i.instanceId,
        baseId: i.baseId,
        name: i.name,
        desc: i.desc,
        shortDesc: i.shortDesc,
        icon: i.icon,
        effects: i.effects,
        count: i.count,
        kind: i.kind,
        category: i.category,
        categoryLabel: i.categoryLabel,
        rarityId: i.rarityId,
        rarityLabel: i.rarityLabel,
        rarityColor: i.rarityColor,
        rarityTextColor: i.rarityTextColor,
        raritySort: i.raritySort,
        statLines: i.statLines,
        source: i.source
      } : null))
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
      blockChance: p.blockChance,
      regenPerSec: p.regenPerSec
    };

    const itemCooldowns = (() => {
      const src = p.itemCooldowns || null;
      if (!src || typeof src !== 'object') return {};
      // 浅拷贝，避免 React 侧误改内部引用
      return { ...src };
    })();

    const currentLevelUpOffer = this.getCurrentLevelUpOffer?.() || null;
    const pendingLevelUpPoints = this.getPendingLevelUpPoints?.() || 0;
    const levelUp = (pendingLevelUpPoints > 0 || currentLevelUpOffer)
      ? {
        open: !!this._levelUpPanelOpen,
        level: currentLevelUpOffer?.level || this.playerData?.level || 1,
        options: currentLevelUpOffer?.options || [],
        pendingPoints: pendingLevelUpPoints,
        pendingSinceMs: Number(this._levelUpPendingSinceMs || 0),
        lastInteractionMs: Number(this._levelUpLastInteractionMs || 0),
        cinematicActive: !!this._levelUpCinematicActive
      }
      : null;

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
      levelUp,
      player,
      gameplayNowMs: Number(this._gameplayNowMs || 0),
      itemCooldowns,
      cooldownSkills: this.getCooldownSkillSnapshot()
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

    // 固定分辨率 1280×720 + FIT 缩放，所有设备体验完全一致
    this.bottomPanelHeight = 120;
    this.gameArea = {
      x: 50,
      y: 50,
      width: this.cameras.main.width - 100,
      height: this.cameras.main.height - 100 - this.bottomPanelHeight
    };
    this.bottomHudTopY = this.gameArea.y + this.gameArea.height;

    // 左上角血条 HUD
    this.createTopLeftHud();
    this.createMinimalBottomHud();
    this.setupCooldownSystem();

    // 系统提示 UI（Phaser 内 HUD 层）
    // 需求：提示框放到屏幕顶部（血条下方一定距离处）
    {
      const cam = this.cameras.main;
      const barY = Number(this.hpBarBg?.y ?? 22);
      const barH = Number(this.hpBarBg?.height ?? 12);
      const barBottom = barY + barH * 0.5;
      const yPx = Math.floor(barBottom + 26);
      const anchorY = Phaser.Math.Clamp(yPx / Math.max(1, cam.height), 0.06, 0.28);
      this.systemMessage = new SystemMessageOverlay(this, {
        anchorY,
        // 强制上边距：避免覆盖血条/经验条
        marginTopPx: Math.floor(barBottom + 200)
      });
    }

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
      this._runLootGearItems = [];
      this.drops = [];
      this.scene.start('MenuScene');
    };
    uiBus.on('ui:goMenu', this._uiGoMenuHandler);

    this._uiRequestSnapshotHandler = () => {
      this.emitUiSnapshot();
    };
    uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

    this._uiLevelUpOpenHandler = () => {
      this.openPendingLevelUpScene?.();
    };
    uiBus.on('ui:levelUp:open', this._uiLevelUpOpenHandler);

    this._uiLevelUpCloseHandler = () => {
      this.setLevelUpPanelOpen?.(false);
    };
    uiBus.on('ui:levelUp:close', this._uiLevelUpCloseHandler);

    // 范围圈开关（统一控制所有职业范围提示）
    this._uiSetRangeIndicatorsHandler = (enabled) => {
      const on = (typeof enabled === 'boolean') ? enabled : !!enabled;
      this.showRangeIndicators = on;
      try { this.registry?.set?.('showRangeIndicators', on); } catch (_) { /* ignore */ }
    };
    uiBus.on('ui:setRangeIndicators', this._uiSetRangeIndicatorsHandler);

    this._uiToggleRangeIndicatorsHandler = () => {
      const current = (typeof this.showRangeIndicators === 'boolean') ? this.showRangeIndicators : true;
      const next = !current;
      this.showRangeIndicators = next;
      try { this.registry?.set?.('showRangeIndicators', next); } catch (_) { /* ignore */ }
    };
    uiBus.on('ui:toggleRangeIndicators', this._uiToggleRangeIndicatorsHandler);

    // 确保场景切换时释放 uiBus 监听，避免重复绑定
    this.events.once('shutdown', this.shutdown, this);

    // 初始化游戏系统
    this.initGameSystems();

    // 兼容旧局内进度：把旧猎人技能/核心数据升级到 archer 语义，
    // 后续流程就不需要继续暴露旧入口。
    migrateLegacyProgressionRegistry(this.registry);

    // 新流程：先进入起始房间（小地图、无迷雾、无 Boss）
    this.enterStartRoom();

    // 开发期调试网格：按 G 显示/隐藏（可用于标记不可走格子）
    if (this.input?.keyboard) {
      try {
        if (this._debugGridKey && this._debugGridKeyHandler) {
          this._debugGridKey.off('down', this._debugGridKeyHandler);
        }
      } catch (_) { /* ignore */ }

      this._debugGridKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
      this._debugGridKeyHandler = () => {
        this.debugGridEnabled = !this.debugGridEnabled;
        if (this.mapConfig) this.mapConfig.debugGrid = !!this.debugGridEnabled;
        if (this.debugGridEnabled) this.renderDebugGridOverlay?.();
        else this.clearDebugGridOverlay?.();
        console.log('[DebugGrid] enabled=', this.debugGridEnabled);
      };
      this._debugGridKey.on('down', this._debugGridKeyHandler);

      // 打印当前不可走格子列表（idx）
      this._debugGridPrintKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      this._debugGridPrintHandler = () => {
        const set = (this.debugBlockedCells instanceof Set) ? this.debugBlockedCells
          : (this.blockedCells instanceof Set ? this.blockedCells : null);
        const arr = set ? Array.from(set) : [];
        arr.sort((a, b) => a - b);
        console.log('[DebugGrid] blocked idx list:', JSON.stringify(arr));
      };
      this._debugGridPrintKey.on('down', this._debugGridPrintHandler);

      this._debugLevelUpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U);
      this._debugLevelUpHandler = () => {
        this.grantTestLevelUp?.();
      };
      this._debugLevelUpKey.on('down', this._debugLevelUpHandler);

      this._arenaContinueKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    }

    // 监听屏幕尺寸变化（手机旋转等），重新计算游戏区域和 HUD 布局
    this.scale.on('resize', this.handleResize, this);

    // 从升级/商店等叠加场景恢复时，确保各系统解除暂停
    this.events.on('resume', () => {
      // 避免"暂停期间累积的巨大 delta"导致物品 CD 被补算
      this._skipGameplayDeltaOnce = true;

      // 恢复时先清掉摇杆/模拟移动输入，防止暂停期间抬手导致方向残留
      this.resetTouchJoystickInput?.();

      this._levelUpCinematicActive = false;
      this.clearLevelUpPresentation?.();

      if (this.physics?.world) this.physics.world.resume();
      if (this.anims) this.anims.resumeAll();
      if (this.time) this.time.paused = false;
      if (this.tweens) this.tweens.resumeAll();

      this._levelUpPanelOpen = false;
      this._levelUpActive = !!this._currentLevelUpOffer;
      this.emitUiSnapshot?.();
      if (this.time) {
        this.time.delayedCall(0, () => this.startNextPendingLevelUp());
      } else {
        this.startNextPendingLevelUp();
      }
    });
  }

  setMapBackground(textureKey) {
    if (!textureKey) return;

    const area = this.worldBoundsRect || this.gameArea || null;
    const cam = this.cameras?.main;
    const cx = area ? (area.x + area.width * 0.5) : (cam?.midPoint?.x ?? 0);
    const cy = area ? (area.y + area.height * 0.5) : (cam?.midPoint?.y ?? 0);

    const isValid = (img) => {
      if (!img) return false;
      if (img.destroyed) return false;
      if (img.active === false) return false;
      if (!img.scene) return false;
      if (img.scene !== this) return false;
      return true;
    };

    const recreate = () => {
      try { this.mapBgImage?.destroy?.(); } catch (_) { /* ignore */ }
      this.mapBgImage = this.add.image(cx, cy, textureKey)
        .setOrigin(0.5)
        .setDepth(-100);
    };

    if (!isValid(this.mapBgImage)) {
      recreate();
    } else {
      try {
        this.mapBgImage.setTexture(textureKey);
        this.mapBgImage.setPosition(cx, cy);
      } catch (_) {
        recreate();
      }
    }

    try { this.mapBgImage?.setVisible?.(true); } catch (_) { /* ignore */ }
    this.refitMapBackground();
  }

  refitMapBackground() {
    if (!this.mapBgImage) return;

    const key = this.mapBgImage.texture?.key;
    if (!key) return;

    const area = this.worldBoundsRect || this.gameArea || null;
    const cam = this.cameras?.main;
    const targetW = area ? area.width : (cam?.width ?? 0);
    const targetH = area ? area.height : (cam?.height ?? 0);
    if (!(targetW > 0 && targetH > 0)) return;

    const tex = this.textures?.get?.(key);
    const src = tex?.getSourceImage?.();
    const iw0 = src?.width || 0;
    const ih0 = src?.height || 0;
    const iw = iw0 || this.mapBgImage.width || 1;
    const ih = ih0 || this.mapBgImage.height || 1;

    // 某些流程下，纹理源尺寸可能在同一帧尚未可用；延迟一帧重试，避免 scale 计算异常导致“看起来没显示”。
    if (!(iw0 > 1 && ih0 > 1) && !(iw > 1 && ih > 1)) {
      const retries = (this._mapBgRefitRetries || 0);
      if (retries < 3 && this.time?.delayedCall) {
        this._mapBgRefitRetries = retries + 1;
        this.time.delayedCall(0, () => this.refitMapBackground());
      }
      return;
    }

    this._mapBgRefitRetries = 0;

    // Cover：等比铺满目标区域（可能会裁切边缘）
    const coverScale = Math.max(targetW / Math.max(1, iw), targetH / Math.max(1, ih));
    const mult = Number.isFinite(this.mapBgScaleMult) ? this.mapBgScaleMult : 1;
    this.mapBgImage.setScale(coverScale * mult);

    // 位置也随区域中心同步（resize 后 gameArea 会变化）
    if (area) {
      this.mapBgImage.setPosition(area.x + area.width * 0.5, area.y + area.height * 0.5);
    } else if (cam?.midPoint) {
      this.mapBgImage.setPosition(cam.midPoint.x, cam.midPoint.y);
    }
  }

  showSceneEntryPresentation(mapInfo, opts = {}) {
    if (!this.add || !this.cameras?.main) return;

    this.clearSceneEntryPresentation({ immediate: true, restoreControls: false });

    const cam = this.cameras.main;
    const centerX = cam.centerX;
    const centerY = cam.centerY;
    const mapName = String(mapInfo?.name || '未知区域');
    const subtitle = String(mapInfo?.subtitle || '');
    const durationMs = Math.max(1200, Math.floor(Number(opts.durationMs) || 2400));
    const overlayDepth = 2600;
    const titleFontSize = mapName.length >= 8 ? '48px' : '62px';
    const subtitleFontSize = '18px';
    const createOrnament = (y, width, opts = {}) => {
      const g = this.add.graphics();
      const accent = opts.accent ?? 0xe7dcc2;
      const glowColor = opts.glow ?? 0x8edbff;
      const half = Math.floor(width * 0.5);
      const innerGap = Math.floor(opts.innerGap ?? 56);
      const innerWing = Math.floor(opts.innerWing ?? 34);
      const outerWing = Math.floor(opts.outerWing ?? 108);
      const tipInset = Math.floor(opts.tipInset ?? 16);

      g.setPosition(0, y);
      g.lineStyle(2, accent, 0.82);
      g.beginPath();
      g.moveTo(-half, 0);
      g.lineTo(-outerWing, 0);
      g.moveTo(outerWing, 0);
      g.lineTo(half, 0);
      g.strokePath();

      g.lineStyle(2, accent, 0.62);
      g.beginPath();
      g.moveTo(-outerWing, 0);
      g.lineTo(-innerGap - innerWing, 0);
      g.lineTo(-innerGap - Math.floor(innerWing * 0.38), -10);
      g.lineTo(-innerGap, 0);
      g.lineTo(-innerGap - Math.floor(innerWing * 0.38), 10);
      g.lineTo(-innerGap - innerWing, 0);
      g.moveTo(outerWing, 0);
      g.lineTo(innerGap + innerWing, 0);
      g.lineTo(innerGap + Math.floor(innerWing * 0.38), -10);
      g.lineTo(innerGap, 0);
      g.lineTo(innerGap + Math.floor(innerWing * 0.38), 10);
      g.lineTo(innerGap + innerWing, 0);
      g.strokePath();

      g.lineStyle(1.5, glowColor, 0.32);
      g.beginPath();
      g.moveTo(-outerWing + 22, -8);
      g.lineTo(-outerWing + 10, 0);
      g.lineTo(-outerWing + 22, 8);
      g.moveTo(outerWing - 22, -8);
      g.lineTo(outerWing - 10, 0);
      g.lineTo(outerWing - 22, 8);
      g.strokePath();

      g.fillStyle(accent, 0.95);
      g.fillPoints([
        { x: 0, y: -6 },
        { x: 8, y: 0 },
        { x: 0, y: 6 },
        { x: -8, y: 0 }
      ], true, true);

      g.fillStyle(glowColor, 0.28);
      g.fillPoints([
        { x: -innerGap, y: -4 },
        { x: -innerGap + 5, y: 0 },
        { x: -innerGap, y: 4 },
        { x: -innerGap - 5, y: 0 }
      ], true, true);
      g.fillPoints([
        { x: innerGap, y: -4 },
        { x: innerGap + 5, y: 0 },
        { x: innerGap, y: 4 },
        { x: innerGap - 5, y: 0 }
      ], true, true);

      g.fillStyle(accent, 0.55);
      g.fillCircle(-half + tipInset, 0, 2.6);
      g.fillCircle(half - tipInset, 0, 2.6);

      g.setAlpha(0);
      g.setScale(0.84, 1);
      return g;
    };

    this._sceneIntroActive = true;

    if (this.player) {
      const preservedCanFire = this._combatBehaviorPauseApplied
        ? (this._combatBehaviorPauseRestore?.canFire !== false)
        : (this.player.canFire !== false);
      this._sceneIntroRestoreState = {
        canMove: this.player.canMove !== false,
        canFire: preservedCanFire
      };
      this.player.canMove = false;
      this.player.canFire = false;
      this.player.clearAnalogMove?.();
    } else {
      this._sceneIntroRestoreState = null;
    }

    const dim = this.add.rectangle(centerX, centerY, cam.width, cam.height, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(overlayDepth);

    const container = this.add.container(centerX, centerY)
      .setScrollFactor(0)
      .setDepth(overlayDepth + 2)
      .setAlpha(1)
      .setScale(1);

    const glow = this.add.ellipse(0, 6, Math.min(cam.width * 0.76, 860), 250, 0x5cc8ff, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);

    const halo = this.add.ellipse(0, 6, Math.min(cam.width * 0.86, 980), 320)
      .setStrokeStyle(2, 0xe8f7ff, 0.16)
      .setFillStyle(0x000000, 0);

    const impactFlash = this.add.rectangle(0, -12, Math.min(cam.width * 0.42, 420), 5, 0xf7fbff, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const whiteFlash = this.add.rectangle(0, 0, cam.width, cam.height, 0xffffff, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const impactRing = this.add.ellipse(0, -12, 90, 90)
      .setStrokeStyle(3, 0xf7fbff, 0)
      .setFillStyle(0x000000, 0);
    const burstStreaks = [-56, -34, -12, 12, 34, 56].map((offset, index) => {
      const streak = this.add.rectangle(0, -12 + offset, 0, 3 + (index % 2), 0xdff7ff, 0);
      streak.setAngle(index % 2 === 0 ? -24 : 24);
      streak.setBlendMode(Phaser.BlendModes.ADD);
      return streak;
    });
    const sparkDots = [
      { x: -92, y: -44, r: 4 },
      { x: -66, y: 20, r: 3 },
      { x: 72, y: -28, r: 4 },
      { x: 108, y: 18, r: 3 },
      { x: -18, y: -86, r: 3 },
      { x: 24, y: 76, r: 3 }
    ].map((point) => {
      const dot = this.add.circle(point.x * 0.35, point.y * 0.35 - 12, point.r, 0xf7fbff, 0);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      return dot;
    });

    const enterText = this.add.text(-Math.floor(cam.width * 0.62), -62, '进入', {
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#f4efe2',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 8, fill: true }
    }).setOrigin(0.5).setAlpha(0.96).setAngle(-4);

    const nameText = this.add.text(Math.floor(cam.width * 0.66), 34, mapName, {
      fontSize: titleFontSize,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#102033',
      strokeThickness: 8,
      align: 'center',
      shadow: { offsetX: 0, offsetY: 4, color: '#041019', blur: 12, fill: true }
    }).setOrigin(0.5).setAlpha(0.98).setAngle(3);

    const lineTop = createOrnament(-106, 320, {
      accent: 0xf1e4c5,
      glow: 0xb9e8ff,
      innerGap: 64,
      innerWing: 36,
      outerWing: 118,
      tipInset: 18
    });
    const lineBottom = createOrnament(92, Math.min(Math.max(nameText.width + 170, 360), 600), {
      accent: 0xcfd8e6,
      glow: 0x8edbff,
      innerGap: 76,
      innerWing: 44,
      outerWing: 154,
      tipInset: 20
    });

    const subText = subtitle
      ? this.add.text(0, 126, subtitle, {
        fontSize: subtitleFontSize,
        color: '#d5eefe',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5).setAlpha(0)
      : null;

    const accentLeft = this.add.triangle(-220, -12, 0, 0, 26, 14, 0, 28, 0xa5ecff, 0.46)
      .setAngle(180)
      .setBlendMode(Phaser.BlendModes.ADD);
    const accentRight = this.add.triangle(220, -12, 0, 0, 26, 14, 0, 28, 0xa5ecff, 0.46)
      .setBlendMode(Phaser.BlendModes.ADD);

    const pieces = [glow, halo, whiteFlash, lineTop, lineBottom, impactFlash, impactRing, ...burstStreaks, ...sparkDots, accentLeft, accentRight, enterText, nameText];
    if (subText) pieces.push(subText);
    container.add(pieces);

    this._sceneIntroOverlay = {
      dim,
      container,
      halo,
      glow,
      whiteFlash,
      lineTop,
      lineBottom,
      impactFlash,
      impactRing,
      burstStreaks,
      sparkDots,
      accentLeft,
      accentRight,
      enterText,
      nameText,
      subText
    };

    this.tweens.add({
      targets: whiteFlash,
      alpha: { from: 0, to: 0.55 },
      duration: 80,
      delay: 250,
      yoyo: true,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: enterText,
      x: 0,
      angle: 0,
      duration: 420,
      ease: 'Cubic.Out'
    });

    this.tweens.add({
      targets: nameText,
      x: 0,
      angle: 0,
      duration: 460,
      ease: 'Cubic.Out'
    });

    this.tweens.add({
      targets: lineTop,
      alpha: 1,
      scaleX: 1,
      duration: 240,
      delay: 220,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: lineBottom,
      alpha: 1,
      scaleX: 1,
      duration: 260,
      delay: 250,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: impactFlash,
      alpha: { from: 0, to: 0.95 },
      scaleX: { from: 0.35, to: 1.15 },
      duration: 140,
      delay: 280,
      yoyo: true,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: impactRing,
      alpha: { from: 0.95, to: 0 },
      scaleX: { from: 0.42, to: 2.1 },
      scaleY: { from: 0.42, to: 1.5 },
      duration: 320,
      delay: 280,
      ease: 'Cubic.Out'
    });

    burstStreaks.forEach((streak, index) => {
      const dir = index < 3 ? -1 : 1;
      const spread = 72 + (index % 3) * 26;
      this.tweens.add({
        targets: streak,
        width: { from: 0, to: 110 + (index % 2) * 36 },
        x: { from: 0, to: dir * spread },
        alpha: { from: 0, to: 0.95 },
        duration: 120,
        delay: 295,
        yoyo: true,
        ease: 'Cubic.Out'
      });
    });

    sparkDots.forEach((dot, index) => {
      const baseX = Number(dot.x) || 0;
      const baseY = Number(dot.y) || 0;
      const dirX = baseX >= 0 ? 1 : -1;
      const dirY = baseY >= 0 ? 1 : -1;
      this.tweens.add({
        targets: dot,
        x: { from: baseX * 0.35, to: baseX + dirX * (12 + index * 2) },
        y: { from: baseY * 0.35 - 12, to: baseY + dirY * (6 + index * 3) - 12 },
        alpha: { from: 0, to: 0.95 },
        scale: { from: 0.6, to: 1.35 },
        duration: 220,
        delay: 300,
        yoyo: true,
        ease: 'Quad.Out'
      });
    });

    this.tweens.add({
      targets: [enterText, nameText],
      scaleX: { from: 1.1, to: 1 },
      scaleY: { from: 0.9, to: 1 },
      duration: 180,
      delay: 300,
      ease: 'Back.Out'
    });

    this.tweens.add({
      targets: [halo, lineTop, lineBottom],
      alpha: { from: 0.16, to: 0.86 },
      duration: 1180,
      delay: 360,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: glow,
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.94, to: 1.1 },
      alpha: { from: 0.05, to: 0.16 },
      duration: 1050,
      delay: 340,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: accentLeft,
      x: { from: -248, to: -186 },
      alpha: { from: 0.12, to: 0.56 },
      duration: 900,
      delay: 340,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: accentRight,
      x: { from: 248, to: 186 },
      alpha: { from: 0.12, to: 0.56 },
      duration: 900,
      delay: 340,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: nameText,
      scale: { from: 1, to: 1.03 },
      duration: 900,
      delay: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    if (subText) {
      this.tweens.add({
        targets: subText,
        alpha: 1,
        y: 116,
        duration: 260,
        delay: 460,
        ease: 'Quad.Out'
      });
    }

    const exitLeadMs = 420;
    this._sceneIntroHideTimer = this.time.delayedCall(Math.max(320, durationMs - exitLeadMs), () => {
      this.clearSceneEntryPresentation({ immediate: false, restoreControls: true });
    });
  }

  clearSceneEntryPresentation(opts = {}) {
    const immediate = !!opts.immediate;
    const restoreControls = opts.restoreControls !== false;

    if (this._sceneIntroHideTimer) {
      this._sceneIntroHideTimer.remove(false);
      this._sceneIntroHideTimer = null;
    }

    const overlay = this._sceneIntroOverlay;
    if (!overlay) {
      this._sceneIntroActive = false;
      if (restoreControls) this.restoreSceneEntryPlayerControl();
      return;
    }

    const finalize = () => {
      Object.values(overlay).forEach((obj) => {
        try { obj?.destroy?.(); } catch (_) { /* ignore */ }
      });
      this._sceneIntroOverlay = null;
      this._sceneIntroActive = false;
      if (restoreControls) this.restoreSceneEntryPlayerControl();
    };

    if (immediate || !this.tweens) {
      finalize();
      return;
    }

    this.tweens.killTweensOf(overlay.container);
    this.tweens.killTweensOf(overlay.dim);
    this.tweens.killTweensOf(overlay.halo);
    this.tweens.killTweensOf(overlay.glow);
    this.tweens.killTweensOf(overlay.whiteFlash);
    this.tweens.killTweensOf(overlay.lineTop);
    this.tweens.killTweensOf(overlay.lineBottom);
    this.tweens.killTweensOf(overlay.impactFlash);
    this.tweens.killTweensOf(overlay.impactRing);
    if (Array.isArray(overlay.burstStreaks)) this.tweens.killTweensOf(overlay.burstStreaks);
    if (Array.isArray(overlay.sparkDots)) this.tweens.killTweensOf(overlay.sparkDots);
    this.tweens.killTweensOf(overlay.accentLeft);
    this.tweens.killTweensOf(overlay.accentRight);
    this.tweens.killTweensOf(overlay.enterText);
    this.tweens.killTweensOf(overlay.nameText);
    if (overlay.subText) this.tweens.killTweensOf(overlay.subText);

    this.tweens.add({
      targets: overlay.dim,
      alpha: 0,
      duration: 360,
      ease: 'Quad.In'
    });

    this.tweens.add({
      targets: overlay.container,
      alpha: 0,
      scale: 1.03,
      duration: 420,
      ease: 'Cubic.In',
      onComplete: finalize
    });
  }

  restoreSceneEntryPlayerControl() {
    const restore = this._sceneIntroRestoreState;
    this._sceneIntroRestoreState = null;
    if (!restore || !this.player || this.player.isAlive === false) return;
    this.player.canMove = restore.canMove;
    this.player.canFire = restore.canFire;
  }

  /**
   * 处理游戏分辨率变化（手机旋转导致宽度变化时触发）
   */
  handleResize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;

    // 重新计算游戏区域
    this.gameArea = {
      x: 50,
      y: 50,
      width: w - 100,
      height: h - 100 - (this.bottomPanelHeight || 0)
    };
    this.bottomHudTopY = this.gameArea.y + this.gameArea.height;

    // 底图适配新尺寸
    this.refitMapBackground?.();

    // 重建 HUD 和小地图
    this.rebuildTopLeftHud?.();
    this.rebuildBottomHud?.();
    this.bossManager?.getCurrentBoss?.()?.layoutScreenHud?.();

    console.log(`📐 游戏尺寸变化: ${w}×${h}`);
  }

  shutdown() {
    // 移除 resize 监听
    this.scale.off('resize', this.handleResize, this);

    // 本局掉落/战利品是一次性的：死亡或退出导致场景关闭时清空
    this.inventoryAcquired = [];
    this._runLootGearItems = [];
    this.drops = [];

    // 清理三选一 UI
    this.cleanupPathChoiceObjects();
    this.cleanupPostBossRewardUI?.();
    this.resetChaosArenaRoundFlow?.();
    this.clearSceneEntryPresentation({ immediate: true, restoreControls: false });

    // 底图对象可能在场景关闭时被 Phaser 自动销毁，但引用仍在；这里显式置空避免复用失效对象
    if (this.mapBgImage) {
      try { this.mapBgImage.destroy(); } catch (_) { /* ignore */ }
      this.mapBgImage = null;
    }
    this._mapBgRefitRetries = 0;

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

    if (this._uiLevelUpOpenHandler) {
      uiBus.off('ui:levelUp:open', this._uiLevelUpOpenHandler);
      this._uiLevelUpOpenHandler = null;
    }

    if (this._uiLevelUpCloseHandler) {
      uiBus.off('ui:levelUp:close', this._uiLevelUpCloseHandler);
      this._uiLevelUpCloseHandler = null;
    }

    if (this._uiLevelUpSelectHandler) {
      uiBus.off('ui:levelUp:select', this._uiLevelUpSelectHandler);
      this._uiLevelUpSelectHandler = null;
    }

    if (this._uiSetRangeIndicatorsHandler) {
      uiBus.off('ui:setRangeIndicators', this._uiSetRangeIndicatorsHandler);
      this._uiSetRangeIndicatorsHandler = null;
    }

    if (this._uiToggleRangeIndicatorsHandler) {
      uiBus.off('ui:toggleRangeIndicators', this._uiToggleRangeIndicatorsHandler);
      this._uiToggleRangeIndicatorsHandler = null;
    }

    if (this._updatePlayerInfoHandler) {
      this.events.off('updatePlayerInfo', this._updatePlayerInfoHandler);
      this._updatePlayerInfoHandler = null;
    }

    if (this._upgradeSelectedHandler) {
      this.game.events.off('upgradeSelected', this._upgradeSelectedHandler);
      this._upgradeSelectedHandler = null;
    }

    if (this._minionKilledHandler) {
      this.events.off('minionKilled', this._minionKilledHandler);
      this._minionKilledHandler = null;
    }

    if (this._tutorialBossDefeatedHandler) {
      this.events.off('tutorialBossDefeated', this._tutorialBossDefeatedHandler);
      this._tutorialBossDefeatedHandler = null;
    }

    if (this._playerDiedHandler) {
      this.events.off('playerDied', this._playerDiedHandler);
      this._playerDiedHandler = null;
    }

    if (this._sceneShutdownHandler) {
      this.events.off('shutdown', this._sceneShutdownHandler);
      this._sceneShutdownHandler = null;
    }

    // 解绑调试网格键与指针监听
    if (this._debugGridKey && this._debugGridKeyHandler) {
      try { this._debugGridKey.off('down', this._debugGridKeyHandler); } catch (_) { /* ignore */ }
    }
    if (this._debugGridPrintKey && this._debugGridPrintHandler) {
      try { this._debugGridPrintKey.off('down', this._debugGridPrintHandler); } catch (_) { /* ignore */ }
    }
    if (this._debugLevelUpKey && this._debugLevelUpHandler) {
      try { this._debugLevelUpKey.off('down', this._debugLevelUpHandler); } catch (_) { /* ignore */ }
    }
    this._debugGridKey = null;
    this._debugGridKeyHandler = null;
    this._debugGridPrintKey = null;
    this._debugGridPrintHandler = null;
    this._debugLevelUpKey = null;
    this._debugLevelUpHandler = null;
    this._arenaContinueKey = null;
    this.clearDebugGridOverlay?.();

    if (this.cooldownHud) {
      try { this.cooldownHud.destroy(); } catch (_) { /* ignore */ }
      this.cooldownHud = null;
    }
    this.cooldownSkills = Object.create(null);

    this.destroyBulletSystems();
  }

  setupCooldownSystem() {
    if (this.cooldownHud) {
      try { this.cooldownHud.destroy(); } catch (_) { /* ignore */ }
    }

    this.cooldownSkills = Object.create(null);
    this.cooldownHud = null;
  }

  // 场景级统一发弹入口：业务层不再直接依赖 BulletManager，
  // 优先走 BulletCore，旧 manager 仅作为兼容回退。
  createManagedPlayerBullet(x, y, color, options = {}) {
    const tags = Array.isArray(options.tags) ? options.tags : [];
    const { tags: _ignoredTags, ...bulletOptions } = options || {};

    if (this.bulletCore?.createPlayerBullet) {
      const angle = Number(bulletOptions.angleOffset ?? 0);
      const bullet = this.bulletCore.createPlayerBullet({
        x,
        y,
        angle,
        speed: Number(bulletOptions.speed ?? 0),
        color,
        radius: Number(bulletOptions.radius ?? 6),
        damage: Number(bulletOptions.damage ?? 0),
        tags,
        options: bulletOptions
      });
      if (bullet && tags.length > 0) bullet.bulletCoreTags = tags;
      return bullet;
    }

    const bullet = this.bulletManager?.createPlayerBullet?.(x, y, color, bulletOptions) || null;
    if (bullet && tags.length > 0) bullet.bulletCoreTags = tags;
    return bullet;
  }

  // 敌方统一入口与 BaseBoss/TestMinion 共用，保证敌方弹幕也能拿到统一元信息。
  createManagedBossBullet(x, y, angle, speed, color, options = {}) {
    const tags = Array.isArray(options.tags) ? options.tags : [];
    const { tags: _ignoredTags, ...bulletOptions } = options || {};

    if (this.bulletCore?.createBossBullet) {
      const bullet = this.bulletCore.createBossBullet({
        x,
        y,
        angle,
        speed,
        color,
        radius: Number(bulletOptions.radius ?? 7),
        damage: Number(bulletOptions.damage ?? 0),
        tags,
        options: bulletOptions
      });
      if (bullet && tags.length > 0) bullet.bulletCoreTags = tags;
      return bullet;
    }

    const bullet = this.bulletManager?.createBossBullet?.(x, y, angle, speed, color, bulletOptions) || null;
    if (bullet && tags.length > 0) bullet.bulletCoreTags = tags;
    return bullet;
  }

  getManagedBullets(side) {
    if (this.bulletCore?.getActiveBullets) {
      return this.bulletCore.getActiveBullets(side) || [];
    }

    if (side === 'boss') {
      return this.bulletManager?.getBossBullets?.() || [];
    }
    if (side === 'player') {
      return this.bulletManager?.getPlayerBullets?.() || [];
    }

    return [];
  }

  destroyManagedBullet(bullet, side, reason = 'cleanup') {
    if (!bullet) return false;

    if (this.bulletCore?.destroyBullet) {
      return this.bulletCore.destroyBullet(bullet, { side, reason });
    }

    if (this.bulletManager?.destroyBullet) {
      this.bulletManager.destroyBullet(bullet, side === 'player');
      return true;
    }

    bullet.destroy?.();
    return true;
  }

  clearManagedBullets(side) {
    if (side === 'boss') {
      if (this.bulletCore?.clearSide) {
        this.bulletCore.clearSide('boss');
        return;
      }
      this.bulletManager?.clearBossBullets?.();
      return;
    }

    if (side === 'player') {
      if (this.bulletCore?.clearSide) {
        this.bulletCore.clearSide('player');
        return;
      }
      this.bulletManager?.clearPlayerBullets?.();
      return;
    }

    if (this.bulletCore?.clearAll) {
      this.bulletCore.clearAll();
      return;
    }

    if (this.bulletManager?.destroyAllBullets) {
      this.bulletManager.destroyAllBullets();
      return;
    }

    this.bulletManager?.clearAll?.();
  }

  handleManagedBulletHit(payload = {}) {
    const side = payload.side === 'boss' ? 'boss' : 'player';
    const targetType = payload.targetType || '';

    if (side === 'player' && targetType === 'boss') {
      this.collisionManager.stats.bossHits += 1;
      this.applyManagedPlayerBossHitEffects(payload);
      return payload;
    }

    if (side === 'player' && targetType === 'minion') {
      this.applyManagedPlayerMinionHitEffects(payload);
      return payload;
    }

    if (side === 'boss' && targetType === 'player') {
      this.applyManagedBossPlayerHitEffects(payload);
      return payload;
    }

    if (side === 'boss' && (targetType === 'pet' || targetType === 'summon')) {
      this.applyManagedBossAllyHitEffects(payload);
      return payload;
    }

    return payload;
  }

  applyManagedBossAllyHitEffects(payload = {}) {
    const bullet = payload.bullet;
    const ally = payload.target;
    const boss = payload.attacker;
    const damage = Math.max(0, Math.round(Number(payload.damage || 0)));
    const killed = !!payload.killed;
    const hitX = Number(payload.hitX ?? ally?.x ?? bullet?.x ?? 0);
    const hitY = Number(payload.hitY ?? ally?.y ?? bullet?.y ?? 0);

    if (!bullet || !ally) return;

    if (ally.isUndeadSummon) {
      this.undeadSummonManager?.onSummonDamaged?.(ally, damage);
    } else if (this.petManager?.onPetDamaged) {
      this.petManager.onPetDamaged(ally, damage);
    }

    if (ally.petType === 'bear') {
      const rageLvl = this.player?.natureRageLevel || 0;
      if (rageLvl > 0) {
        const mult = 1.10 + 0.05 * (rageLvl - 1);
        this.player.natureRageUntil = (this.time?.now ?? 0) + 3000;
        this.player.natureRageMult = mult;
      }

      const quakeLvl = this.player?.natureEarthquakeLevel || 0;
      if (quakeLvl > 0 && boss && boss.isAlive && typeof boss.applyStun === 'function') {
        const chance = Math.min(0.45, 0.15 + 0.05 * (quakeLvl - 1));
        if (Math.random() < chance) {
          boss.applyStun(1000);
          this.showDamageNumber(boss.x, boss.y - 70, '眩晕', { color: '#88ffcc', fontSize: 18, whisper: true });
        }
      }
    }

    this.collisionManager?.createBossBulletHitEffect?.(hitX, hitY, bullet);
    this.showDamageNumber(hitX, hitY - 30, damage, { color: '#ffd6a5', fontSize: 20, whisper: true });

    if (killed) {
      if (ally.isUndeadSummon) {
        this.undeadSummonManager?.onSummonKilled?.(ally);
      } else if (this.petManager?.onPetKilled) {
        this.petManager.onPetKilled(ally.petType);
      } else if (ally.active) {
        ally.destroy?.();
      }
    }
  }

  applyManagedBossPlayerHitEffects(payload = {}) {
    const bullet = payload.bullet;
    const boss = payload.attacker;
    const damage = Math.max(0, Math.round(Number(payload.damage || 0)));
    const killed = !!payload.killed;
    const hitX = Number(payload.hitX ?? this.player?.x ?? bullet?.x ?? 0);
    const hitY = Number(payload.hitY ?? this.player?.y ?? bullet?.y ?? 0);

    if (!bullet) return;

    this.collisionManager.stats.playerHits += 1;

    if (this.player?.counterOnBlock && this.player?.lastDamageEvent?.blocked) {
      const currentBoss = this.bossManager?.getCurrentBoss?.();
      if (currentBoss && currentBoss.isAlive && !currentBoss.isInvincible) {
        const counterScale = [0, 0.8, 1.2, 1.6][Math.max(0, Math.min(3, Math.round(this.player?.guardianCounterLevel || 0)))] || 1;
        const counterResult = calculateResolvedDamage({
          attacker: this.player,
          target: currentBoss,
          baseDamage: Math.max(1, Math.round((this.player.bulletDamage || 1) * counterScale)),
          now: this.time?.now ?? 0,
          canCrit: false
        });
        currentBoss.takeDamage(counterResult.amount, { attacker: this.player, source: 'counterOnBlock', suppressHitReaction: true });
        this.showDamageNumber(currentBoss.x, currentBoss.y - 44, counterResult.amount, { color: '#88ccff', fontSize: 22, whisper: true });
        this.collisionManager?.createHitEffect?.(currentBoss.x, currentBoss.y, 0x88ccff);
      }
    }

    if (this.thornsPercent && boss && boss.isAlive && !boss.isInvincible) {
      const reflectBaseDamage = Math.round(damage * this.thornsPercent);
      const reflectResult = calculateResolvedDamage({
        attacker: this.player,
        target: boss,
        baseDamage: reflectBaseDamage,
        now: this.time?.now ?? 0,
        canCrit: false
      });
      boss.takeDamage(reflectResult.amount, { attacker: this.player, source: 'thorns', suppressHitReaction: true });
      this.showDamageNumber(boss.x, boss.y - 40, reflectResult.amount, '#ff9999');
    }

    this.collisionManager?.createBossBulletHitEffect?.(hitX, hitY, bullet);

    // 玩家受击反馈：轻震屏 + 受击闪红
    if (this.vfxSystem) {
      this.vfxSystem.shakeCamera(60, 0.003);
    }

    if (killed) {
      this.collisionManager?.onPlayerDeath?.();
    }
  }

  applyManagedPlayerBossHitEffects(payload = {}) {
    const bullet = payload.bullet;
    const boss = payload.target;
    const damage = Math.max(0, Math.round(Number(payload.damage || 0)));
    const now = Number(payload.at || this.time?.now || 0);
    const hitX = Number(payload.hitX ?? bullet?.x ?? boss?.x ?? 0);
    const hitY = Number(payload.hitY ?? bullet?.y ?? boss?.y ?? 0);
    const killed = !!payload.killed;
    const isCrit = !!payload.isCrit;

    if (!bullet || !boss || boss.isAlive === false) return;

    this.player?.onDealDamage?.(damage);
    this.applyWarriorMainHitEffects?.(boss, now, bullet);
    this.applyWarriorOffclassHitEffects?.(boss, now);
    this.applyMageFrostHitEffects?.(boss, { bullet, now, hitX, hitY, killedByHit: !!payload.killed });
    if ((bullet.onHitApplyArcaneExposure || 0) > 1) {
      boss.debuffs = boss.debuffs || {};
      boss.debuffs.arcaneCircleExposureUntil = now + Math.max(200, Number(bullet.onHitApplyArcaneExposureMs || 1200));
      boss.debuffs.arcaneCircleExposureMult = Number(bullet.onHitApplyArcaneExposure || 1);
    }

    if (!killed && (bullet.stunChance || 0) > 0 && typeof boss.applyStun === 'function') {
      const chance = Phaser.Math.Clamp(Number(bullet.stunChance || 0), 0, 0.95);
      if (Math.random() < chance) {
        const stunMs = Math.max(120, Number(bullet.stunMs || 650));
        boss.applyStun(stunMs);
        this.showDamageNumber(boss.x, boss.y - 70, '眩晕', { color: '#ffd26a', fontSize: 18, whisper: true });
      }
    }

    const enh = bullet.basicEnh;
    if (enh) {
      if (enh.shieldOnHit && this.player) {
        this.player.shieldChargeProgress = (this.player.shieldChargeProgress || 0) + enh.shieldOnHit;
        while (this.player.shieldChargeProgress >= 1) {
          this.player.shieldChargeProgress -= 1;
          this.player.shieldCharges = (this.player.shieldCharges || 0) + 1;
          if (this.player.updateShieldIndicator) this.player.updateShieldIndicator();
        }
      }

      if (enh.explodeOnHit && !boss.isInvincible) {
        const extra = Math.max(1, Math.round(damage * enh.explodeOnHit));
        boss.takeDamage(extra, { attacker: this.player, source: 'explodeOnHit', suppressHitReaction: true });
        this.showDamageNumber(boss.x, boss.y - 22, extra, { color: '#66ccff', fontSize: 22, whisper: true });
        this.createHitEffect(boss.x, boss.y, 0x66ccff);
      }

      if (enh.markOnHit) {
        boss.shadowMarks = boss.shadowMarks || { stacks: 0, lastAt: 0 };
        boss.shadowMarks.stacks = Math.min(12, (boss.shadowMarks.stacks || 0) + enh.markOnHit);
        boss.shadowMarks.lastAt = now;
        const markText = this.add.text(boss.x, boss.y + boss.bossSize + 8, `印记 x${boss.shadowMarks.stacks}`, {
          fontSize: '12px',
          color: '#caa6ff'
        }).setOrigin(0.5);
        this.tweens.add({
          targets: markText,
          alpha: 0,
          y: markText.y + 18,
          duration: 420,
          onComplete: () => markText.destroy()
        });
      }

      if (enh.petFocusOnHit && this.petManager?.commandFocus) {
        this.petManager.commandFocus(boss);
      }
    }

    if (this.applyWarlockOnHit && (bullet.poison || this.warlockDebuffEnabled)) {
      this.applyWarlockOnHit(boss, true);
    }

    this.presentManagedPlayerBossHit({ bullet, boss, hitX, hitY, damage, isCrit });
    this.spawnManagedPlayerBossHitZones({ bullet, boss, hitX, hitY, killed });
  }

  applyManagedPlayerMinionHitEffects(payload = {}) {
    const bullet = payload.bullet;
    const enemy = payload.target;
    const damage = Math.max(0, Math.round(Number(payload.damage || 0)));
    const now = Number(payload.at || this.time?.now || 0);
    const hitX = Number(payload.hitX ?? bullet?.x ?? enemy?.x ?? 0);
    const hitY = Number(payload.hitY ?? bullet?.y ?? enemy?.y ?? 0);
    const isCrit = !!payload.isCrit;

    if (!bullet || !enemy) return;

    this.player?.onDealDamage?.(damage);
    this.applyWarriorMainHitEffects?.(enemy, now, bullet);
    this.applyWarriorOffclassHitEffects?.(enemy, now);
    this.applyMageFrostHitEffects?.(enemy, { bullet, now, hitX, hitY, killedByHit: !!payload.killed });
    if ((bullet.onHitApplyArcaneExposure || 0) > 1) {
      enemy.debuffs = enemy.debuffs || {};
      enemy.debuffs.arcaneCircleExposureUntil = now + Math.max(200, Number(bullet.onHitApplyArcaneExposureMs || 1200));
      enemy.debuffs.arcaneCircleExposureMult = Number(bullet.onHitApplyArcaneExposure || 1);
    }
    this.presentManagedPlayerMinionHit({ bullet, enemy, hitX, hitY, damage, isCrit });
  }

  presentManagedPlayerMinionHit({ bullet, enemy, hitX, hitY, damage, isCrit } = {}) {
    if (!bullet || !enemy) return;

    const hitColor = bullet.hitEffectColor ?? (bullet.poison ? 0x66ff99 : (isCrit ? 0xff3333 : 0xffff00));
    const damageAnchorX = bullet.damageNumberAtTarget ? enemy.x : hitX;
    const damageAnchorY = bullet.damageNumberAtTarget
      ? (enemy.y - Math.max(22, (enemy.radius || enemy.bossSize || 18) + 8))
      : (hitY - 24);

    this.collisionManager?.createHitEffect?.(hitX, hitY, hitColor);
    this.showDamageNumber(damageAnchorX, damageAnchorY, damage, isCrit ? '#ff3333' : '#ffee00');

    if (bullet.explode) {
      this.collisionManager?.createHitEffect?.(hitX, hitY, 0xffaa66);
    }

    if (bullet.knockback && enemy.isAlive) {
      const angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, enemy.x, enemy.y);
      enemy.x += Math.cos(angle) * bullet.knockback;
      enemy.y += Math.sin(angle) * bullet.knockback;
    }
  }

  presentManagedPlayerBossHit({ bullet, boss, hitX, hitY, damage, isCrit } = {}) {
    if (!bullet || !boss) return;

    // 暴击震屏 + 时停反馈
    if (isCrit && this.vfxSystem) {
      this.vfxSystem.shakeCamera(100, 0.006);
      this.vfxSystem.hitlag(60);
    }

    // 粒子命中爆发（有 flare 纹理时使用）
    if (this.vfxSystem) {
      const hitColor = bullet.hitEffectColor ?? (bullet.poison ? 0x66ff99 : (isCrit ? 0xff3333 : 0xffff00));
      this.vfxSystem.playParticleHit(hitX, hitY, {
        color: hitColor,
        count: isCrit ? 12 : 6,
        tints: isCrit ? [0xff3333, 0xff6644, 0xffcc88] : [hitColor, 0xffcc88, 0xffd26a]
      });
    }

    const dmgOptions = { isCrit: !!isCrit };
    if (bullet.hitEffectType === 'moonfire') {
      dmgOptions.color = '#88ffcc';
      dmgOptions.fontSize = 24;
      dmgOptions.whisper = true;
    } else if (bullet.poison) {
      dmgOptions.color = '#66ff99';
    }
    this.showDamageNumber(hitX, hitY, damage, dmgOptions);

    if (bullet.hitEffectType === 'moonfire') {
      this.collisionManager?.createMoonfireRippleEffect?.(hitX, hitY);
    } else {
      const hitColor = bullet.hitEffectColor ?? (bullet.poison ? 0x66ff99 : (isCrit ? 0xff3333 : 0xffff00));
      this.collisionManager?.createHitEffect?.(hitX, hitY, hitColor);
    }

    if (bullet.explode) {
      this.collisionManager?.createHitEffect?.(hitX, hitY, 0xffaa66);
    }

    if (bullet.knockback && boss.isAlive) {
      const angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, boss.x, boss.y);
      boss.x += Math.cos(angle) * bullet.knockback;
      boss.y += Math.sin(angle) * bullet.knockback;
    }
  }

  spawnManagedPlayerBossHitZones({ bullet, boss, hitX, hitY, killed } = {}) {
    if (!bullet || !boss) return;

    if (killed && bullet.isPoisonZone && this.player?.warlockPoisonContagion) {
      const poisonCore = bullet.visualCoreColor ?? getBaseColorForCoreKey('warlock');
      const poisonStroke = lerpColor(poisonCore, 0xffffff, 0.45);
      const contagionZone = this.createManagedPlayerAreaBullet(
        hitX,
        hitY,
        poisonCore,
        {
          radius: Math.max(28, Math.round((bullet.radius || 96) * 0.55)),
          damage: Math.max(1, Math.round((bullet.damage || 1) * 0.65)),
          hasGlow: true,
          glowRadius: Math.max(42, Math.round((bullet.radius || 96) * 0.55) + 14),
          glowColor: poisonCore,
          strokeColor: poisonStroke,
          maxLifeMs: 3000,
          hitCooldownMs: 1000,
          fillAlpha: 0.06,
          strokeWidth: 2,
          strokeAlpha: 0.55,
          tags: ['player_poison_contagion_zone']
        }
      );
      if (contagionZone) {
        contagionZone.isPoisonZone = true;
        contagionZone.hitEffectType = 'poison_zone';
        this.player?.bullets?.push?.(contagionZone);
      }
    }


    if (this.player?.warlockEcho) {
      const warlockColor = getBaseColorForCoreKey('warlock');
      const echoRune = this.createManagedPlayerAreaBullet(
        hitX,
        hitY,
        warlockColor,
        {
          radius: 46,
          damage: Math.max(1, Math.round((this.player?.bulletDamage || 1) * 0.22)),
          alpha: 0.001,
          maxLifeMs: 650,
          noCrit: true,
          hitCooldownMs: 220,
          tags: ['player_warlock_echo_rune']
        }
      );
      if (echoRune) {
        echoRune.isRune = true;
        this.player?.bullets?.push?.(echoRune);
      }
    }
  }

  // 特殊弹统一配置：AoE、法阵、不可见 hitbox 等都经由这里写通用后处理。
  configureManagedBullet(bullet, config = {}) {
    if (!bullet) return null;

    if (config.alpha != null) bullet.alpha = Number(config.alpha);
    if (config.maxLifeMs != null) bullet.maxLifeMs = Math.max(1, Math.round(Number(config.maxLifeMs)));
    if (config.hitCooldownMs != null) bullet.hitCooldownMs = Math.max(0, Math.round(Number(config.hitCooldownMs)));
    if (config.maxHits != null) bullet.maxHits = Math.max(1, Math.round(Number(config.maxHits)));
    if (config.pierce != null) bullet.pierce = !!config.pierce;
    if (config.noCrit != null) bullet.noCrit = !!config.noCrit;
    if (config.damageNumberAtTarget != null) bullet.damageNumberAtTarget = !!config.damageNumberAtTarget;
    if (config.depth != null) bullet.setDepth?.(Number(config.depth));
    if (config.blendMode != null) bullet.setBlendMode?.(config.blendMode);
    if (config.fillAlpha != null && bullet.setFillStyle) bullet.setFillStyle(config.fillColor ?? bullet.visualCoreColor ?? 0xffffff, Number(config.fillAlpha));
    if (config.strokeWidth != null && bullet.setStrokeStyle) {
      bullet.setStrokeStyle(
        Math.max(0, Math.round(Number(config.strokeWidth))),
        config.strokeColor ?? bullet.visualAccentColor ?? bullet.visualCoreColor ?? 0xffffff,
        Number(config.strokeAlpha ?? 1)
      );
    }

    const flags = config.flags || {};
    Object.keys(flags).forEach((key) => {
      bullet[key] = flags[key];
    });

    return bullet;
  }

  createManagedPlayerAreaBullet(x, y, color, config = {}) {
    const {
      alpha,
      maxLifeMs,
      hitCooldownMs,
      maxHits,
      pierce,
      noCrit,
      damageNumberAtTarget,
      depth,
      blendMode,
      fillAlpha,
      fillColor,
      strokeWidth,
      strokeColor,
      strokeAlpha,
      flags,
      ...bulletOptions
    } = config || {};

    const bullet = this.createManagedPlayerBullet(x, y, color, {
      speed: 0,
      angleOffset: 0,
      isAbsoluteAngle: true,
      hasGlow: false,
      hasTrail: false,
      glowRadius: 0,
      homing: false,
      explode: false,
      skipUpdate: false,
      ...bulletOptions
    });

    return this.configureManagedBullet(bullet, {
      alpha,
      maxLifeMs,
      hitCooldownMs,
      maxHits,
      pierce,
      noCrit,
      damageNumberAtTarget,
      depth,
      blendMode,
      fillAlpha,
      fillColor,
      strokeWidth,
      strokeColor,
      strokeAlpha,
      flags
    });
  }

  setupBulletSystems() {
    this.destroyBulletSystems();

    // 统一接线顺序：BulletCore 作为底层适配，Pattern/Vfx/Timeline/Overlay 基于它往上叠。
    this.bulletCore = new BulletCore(this, {
      bulletManager: this.bulletManager,
      collisionManager: this.collisionManager,
      onHit: (payload) => this.handleManagedBulletHit(payload)
    });
    this.vfxSystem = new VfxSystem(this, { depth: 2400 });
    this.patternSystem = new PatternSystem(this, {
      bulletCore: this.bulletCore,
      vfxSystem: this.vfxSystem
    });
    this.attackTimeline = new AttackTimeline(this, {
      patternSystem: this.patternSystem,
      vfxSystem: this.vfxSystem
    });
    this.debugOverlay = new DebugOverlay(this, {
      bulletCore: this.bulletCore,
      attackTimeline: this.attackTimeline
    }, {
      depth: 2550
    });

    if (this.input?.keyboard) {
      try {
        if (this._bulletDebugOverlayKey && this._bulletDebugOverlayKeyHandler) {
          this._bulletDebugOverlayKey.off('down', this._bulletDebugOverlayKeyHandler);
        }
      } catch (_) { /* ignore */ }

      this._bulletDebugOverlayKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
      // F3 只负责切换 system/bullets 的调试覆盖层，不影响原有 HUD。
      this._bulletDebugOverlayKeyHandler = () => {
        this.debugOverlay?.toggle?.();
      };
      this._bulletDebugOverlayKey.on('down', this._bulletDebugOverlayKeyHandler);
    }
  }

  destroyBulletSystems() {
    if (this._bulletDebugOverlayKey && this._bulletDebugOverlayKeyHandler) {
      try { this._bulletDebugOverlayKey.off('down', this._bulletDebugOverlayKeyHandler); } catch (_) { /* ignore */ }
    }
    this._bulletDebugOverlayKey = null;
    this._bulletDebugOverlayKeyHandler = null;

    if (this.attackTimeline) {
      try {
        const items = this.attackTimeline.getMetrics?.() || [];
        items.forEach((item) => this.attackTimeline.stopTimeline?.(item.id));
      } catch (_) { /* ignore */ }
    }

    if (this.debugOverlay) {
      try { this.debugOverlay.destroy(); } catch (_) { /* ignore */ }
      this.debugOverlay = null;
    }

    this.attackTimeline = null;
    this.patternSystem = null;
    this.vfxSystem = null;
    this.bulletCore = null;
  }

  updateBulletSystemsDebugOverlay() {
    if (!this.debugOverlay) return;

    const descriptors = [];
    const hp = this.player?.getHitboxPosition?.();
    const centerX = Number(hp?.x ?? this.player?.x ?? 0);
    const centerY = Number(hp?.y ?? this.player?.y ?? 0);

    const pushCircle = (radius, color) => {
      const resolvedRadius = Number(radius || 0);
      if (!(resolvedRadius > 0)) return;
      descriptors.push({
        x: centerX,
        y: centerY,
        radius: resolvedRadius,
        color,
        alpha: 0.05,
        lineAlpha: 0.8
      });
    };

    pushCircle(this.player?.warriorRange, 0xf87171);
    pushCircle(this.player?.paladinRange, 0xfbbf24);
    pushCircle(this.player?.archerRange, 0x34d399);
    pushCircle(this.player?.mageRange, 0x7dd3fc);
    pushCircle(this.player?.druidRange, 0x22c55e);
    pushCircle(this.player?.warlockRange, 0xa3e635);

    const boss = this.bossManager?.getCurrentBoss?.();
    if (boss?.isAlive && boss.aggroRadius > 0) {
      descriptors.push({
        x: Number(boss.x || 0),
        y: Number(boss.y || 0),
        radius: Number(boss.aggroRadius || 0),
        color: 0xff6666,
        alpha: 0.04,
        lineAlpha: 0.7
      });
    }

    this.debugOverlay.setRanges(descriptors);
    this.debugOverlay.update();
  }

  registerCooldownSkill(config = {}) {
    const id = String(config.id || '').trim();
    if (!id) return null;
    if (!this.cooldownSkills || typeof this.cooldownSkills !== 'object') {
      this.cooldownSkills = Object.create(null);
    }

    const existing = this.cooldownSkills[id] || {};
    const skill = {
      id,
      label: String(config.label || existing.label || id),
      description: String(config.description || existing.description || ''),
      iconText: String(config.iconText || existing.iconText || '✦'),
      cooldownMs: Math.max(0, Number(config.cooldownMs ?? existing.cooldownMs ?? 0)),
      cooldownStartMs: Math.max(0, Number(existing.cooldownStartMs || 0)),
      cooldownUntilMs: Math.max(0, Number(existing.cooldownUntilMs || 0)),
      accentColor: Number.isFinite(Number(config.accentColor))
        ? Number(config.accentColor)
        : (existing.accentColor || 0x7dd3fc),
      visible: config.visible !== false,
      visibleWhen: typeof config.visibleWhen === 'function' ? config.visibleWhen : (existing.visibleWhen || null),
      shouldAutoTrigger: typeof config.shouldAutoTrigger === 'function' ? config.shouldAutoTrigger : (existing.shouldAutoTrigger || null),
      onTrigger: typeof config.onTrigger === 'function' ? config.onTrigger : (existing.onTrigger || null),
      onReady: typeof config.onReady === 'function' ? config.onReady : (existing.onReady || null),
      readyNotified: !!existing.readyNotified
    };

    this.cooldownSkills[id] = skill;
    this.cooldownHud?.registerSlot({
      id,
      label: skill.label,
      description: skill.description,
      iconText: skill.iconText,
      cooldownMs: skill.cooldownMs,
      accentColor: skill.accentColor,
      visible: skill.visible
    });
    this.cooldownHud?.syncSlot(id, {
      label: skill.label,
      description: skill.description,
      iconText: skill.iconText,
      startMs: skill.cooldownStartMs,
      endMs: skill.cooldownUntilMs,
      cooldownMs: skill.cooldownMs,
      accentColor: skill.accentColor,
      visible: skill.visible
    });
    return skill;
  }

  getCooldownSkillSnapshot() {
    const now = Number(this._gameplayNowMs || 0);
    const entries = this.cooldownSkills && typeof this.cooldownSkills === 'object'
      ? Object.values(this.cooldownSkills)
      : [];

    return entries.map((skill) => ({
      id: skill.id,
      label: skill.label,
      description: skill.description,
      iconText: skill.iconText,
      cooldownMs: Number(skill.cooldownMs || 0),
      cooldownStartMs: Number(skill.cooldownStartMs || 0),
      cooldownUntilMs: Number(skill.cooldownUntilMs || 0),
      remainingMs: Math.max(0, Number(skill.cooldownUntilMs || 0) - now)
    }));
  }

  triggerCooldownSkill(id, opts = {}) {
    const skill = this.cooldownSkills?.[id];
    if (!skill) return false;
    if (skill.visible === false) return false;

    const now = Number.isFinite(Number(opts.nowMs)) ? Number(opts.nowMs) : Number(this._gameplayNowMs || 0);
    const remainingMs = Math.max(0, Number(skill.cooldownUntilMs || 0) - now);
    if (remainingMs > 0) return false;

    try {
      skill.onTrigger?.(skill, this);
    } catch (error) {
      console.error('[CooldownSkill] trigger failed:', id, error);
      return false;
    }

    skill.cooldownStartMs = now;
    skill.cooldownUntilMs = now + Math.max(0, Number(skill.cooldownMs || 0));
    skill.readyNotified = false;
    this.cooldownHud?.syncSlot(id, {
      startMs: skill.cooldownStartMs,
      endMs: skill.cooldownUntilMs,
      cooldownMs: skill.cooldownMs
    });
    return true;
  }

  updateCooldownSkills(nowMs, opts = {}) {
    const now = Number.isFinite(nowMs) ? nowMs : Number(this._gameplayNowMs || 0);
    const allowAutoTrigger = opts.allowAutoTrigger !== false;
    this.cooldownHud?.update(now);

    const entries = this.cooldownSkills && typeof this.cooldownSkills === 'object'
      ? Object.values(this.cooldownSkills)
      : [];

    entries.forEach((skill) => {
      if (typeof skill.visibleWhen === 'function') {
        try {
          skill.visible = !!skill.visibleWhen(skill, this, now);
        } catch (error) {
          console.error('[CooldownSkill] visible check failed:', skill.id, error);
        }
      }

      this.cooldownHud?.syncSlot(skill.id, {
        label: skill.label,
        description: skill.description,
        iconText: skill.iconText,
        visible: skill.visible !== false,
        cooldownMs: skill.cooldownMs,
        startMs: skill.cooldownStartMs,
        endMs: skill.cooldownUntilMs,
        accentColor: skill.accentColor
      });

      if (skill.visible === false) return;

      const until = Math.max(0, Number(skill.cooldownUntilMs || 0));
      if (!until || now < until) return;
      if (skill.readyNotified) return;
      skill.readyNotified = true;
      try {
        skill.onReady?.(skill, this);
      } catch (error) {
        console.error('[CooldownSkill] ready callback failed:', skill.id, error);
      }
    });

    if (!allowAutoTrigger) return;
    if (this.isCombatBehaviorPaused?.()) return;

    entries.forEach((skill) => {
      if (skill.visible === false) return;
      if (typeof skill.shouldAutoTrigger !== 'function') return;
      if (Math.max(0, Number(skill.cooldownUntilMs || 0)) > now) return;
      let shouldTrigger = false;
      try {
        shouldTrigger = !!skill.shouldAutoTrigger(skill, this, now);
      } catch (error) {
        console.error('[CooldownSkill] auto trigger check failed:', skill.id, error);
      }
      if (shouldTrigger) {
        this.triggerCooldownSkill(skill.id, { nowMs: now });
      }
    });
  }

  hasCooldownItem(itemId) {
    if (!itemId) return false;
    return (this.hasEquippedItem?.(itemId) ?? -1) >= 0;
  }

  getSkillLevel(skillId) {
    if (!skillId) return 0;
    const skillTreeLevels = this.registry?.get?.('skillTreeLevels') || {};
    const normalizedSkillId = normalizeSkillId(skillId);
    return clampTalentLevel(skillTreeLevels[normalizedSkillId] || skillTreeLevels[skillId] || 0);
  }

  getEmergencyCooldownTalentState(coreKey) {
    const def = coreKey ? EMERGENCY_COOLDOWN_DEFS[normalizeCoreKey(coreKey)] : null;
    if (!def) return null;
    const level = this.getSkillLevel(def.talentId);
    const enhancementLevel = this.getSkillLevel(def.enhancementTalentId);
    let value = def.values[clampTalentLevel(level)] || 0;
    let durationMs = Array.isArray(def.durationByLevel)
      ? Number(def.durationByLevel[clampTalentLevel(level)] || 0)
      : Number(def.durationMs || 0);
    let radiusPx = Number(def.radiusPx || 0);
    let hpCostPct = Number(def.hpCostPct || 0);

    if (Array.isArray(def.durationByEnhancementLevel)) {
      durationMs = Number(def.durationByEnhancementLevel[clampTalentLevel(enhancementLevel)] || durationMs);
    }
    if (Array.isArray(def.healMultiplierByEnhancementLevel)) {
      value *= Number(def.healMultiplierByEnhancementLevel[clampTalentLevel(enhancementLevel)] || 1);
    }
    if (Array.isArray(def.lifestealMultiplierByEnhancementLevel)) {
      value *= Number(def.lifestealMultiplierByEnhancementLevel[clampTalentLevel(enhancementLevel)] || 1);
    }
    if (Array.isArray(def.radiusByEnhancementLevel)) {
      radiusPx = Number(def.radiusByEnhancementLevel[clampTalentLevel(enhancementLevel)] || radiusPx);
    }
    if (Array.isArray(def.hpCostPctByEnhancementLevel)) {
      hpCostPct = Number(def.hpCostPctByEnhancementLevel[clampTalentLevel(enhancementLevel)] ?? hpCostPct);
    }
    const overhealBarrierCapRatio = Array.isArray(def.overhealBarrierCapRatioByEnhancementLevel)
      ? Number(def.overhealBarrierCapRatioByEnhancementLevel[clampTalentLevel(enhancementLevel)] || 0)
      : Number(def.overhealBarrierCapRatio || 0);

    const state = {
      ...def,
      level,
      enhancementLevel,
      value,
      durationMs,
      radiusPx,
      hpCostPct,
      overhealBarrierCapRatio
    };
    if (enhancementLevel > 0) {
      state.label = String(def.enhancedLabel || def.label || def.skillId || '');
      state.iconText = String(def.enhancedIconText || def.iconText || '✦');
    } else {
      state.label = String(def.label || def.skillId || '');
      state.iconText = String(def.iconText || '✦');
    }
    state.description = typeof def.describe === 'function' ? def.describe(state) : '';
    return state;
  }

  triggerMageFrostNova(config = {}) {
    const player = this.player;
    if (!player?.isAlive) return;

    const radius = Math.max(80, Math.round(Number(config.radiusPx || 220)));
    const freezeMs = Math.max(250, Math.round(Number(config.value || 0)));
    if (freezeMs <= 0) return;

    player.playFrostNovaEffect?.(radius);

    const targets = [];
    const boss = this.bossManager?.getCurrentBoss?.();
    if (boss?.isAlive) targets.push(boss);

    const minions = this.bossManager?.getMinions?.() || [];
    minions.forEach((minion) => {
      if (minion?.isAlive) targets.push(minion);
    });

    targets.forEach((enemy) => {
      const distance = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (distance > radius) return;

      if (typeof enemy.applyFreeze === 'function') {
        enemy.applyFreeze(freezeMs, { source: 'mage_frost_nova', player, radius });
      } else if (typeof enemy.applyStun === 'function') {
        enemy.applyStun(freezeMs);
      }

      this.showDamageNumber?.(enemy.x, enemy.y - Math.max(26, (enemy.bossSize || enemy.radius || 20) + 18), '冻结', {
        color: '#9be7ff',
        fontSize: 18,
        whisper: true
      });
    });
  }

  triggerWarlockInfernal(config = {}) {
    const player = this.player;
    if (!player?.isAlive) return;
    if (!this.undeadSummonManager?.summonInfernal) return;

    const hpCost = Math.max(1, Math.round((player.maxHp || 1) * Math.max(0, Number(config.hpCostPct) || 0.15)));
    player.spendHealth?.(hpCost, { minRemaining: 1, color: '#86efac', fontSize: 20, whisper: true });

    this.undeadSummonManager.summonInfernal({
      level: Math.max(1, Math.round(Number(config.value || config.level || 1))),
      durationMs: Math.max(1000, Math.round(Number(config.durationMs) || 10000)),
      hpScale: Number(config.hpScaleByLevel?.[Math.max(0, Math.round(Number(config.value || config.level || 1)))]) || undefined,
      damageMult: Number(config.damageMultByLevel?.[Math.max(0, Math.round(Number(config.value || config.level || 1)))]) || undefined,
      healPerHit: Number(config.healPerHitByLevel?.[Math.max(0, Math.round(Number(config.value || config.level || 1)))]) || undefined
    });
  }

  installPassiveCooldownSkills() {
    const potionSmall = getItemById('potion_small');

    ['paladin', 'archer', 'warrior', 'mage', 'warlock', 'druid'].forEach((coreKey) => {
      const state = this.getEmergencyCooldownTalentState(coreKey);
      if (!state) return;

      this.registerCooldownSkill({
        id: state.skillId,
        label: state.label,
        description: state.description,
        iconText: state.iconText,
        cooldownMs: state.cooldownMs,
        accentColor: state.accentColor,
        visible: state.level > 0 && (this.player?.mainCoreKey === coreKey),
        visibleWhen: () => {
          const next = this.getEmergencyCooldownTalentState(coreKey);
          return !!next && next.level > 0 && this.player?.mainCoreKey === coreKey;
        },
        shouldAutoTrigger: () => {
          const next = this.getEmergencyCooldownTalentState(coreKey);
          if (!next || next.level <= 0 || !this.player || !this.player.isAlive) return false;
          const hpPct = this.player.maxHp > 0 ? (this.player.hp / this.player.maxHp) : 1;
          return hpPct <= 0.3;
        },
        onTrigger: () => {
          const next = this.getEmergencyCooldownTalentState(coreKey);
          if (!next || !this.player) return;
          const now = Number(this._gameplayNowMs || 0);
          if (coreKey === 'paladin') {
            this.player.emergencyMitigationMult = Math.max(0, 1 - next.value);
            this.player.emergencyMitigationUntil = now + next.durationMs;
            this.player.playDivineShelterEffect?.(next.durationMs);
          } else if (coreKey === 'archer') {
            this.player.emergencyDodgeBonus = next.value;
            this.player.emergencyDodgeUntil = now + next.durationMs;
          } else if (coreKey === 'warrior') {
            this.player.emergencyLifestealPercent = next.value;
            this.player.emergencyLifestealUntil = now + next.durationMs;
          } else if (coreKey === 'mage') {
            this.triggerMageFrostNova(next);
          } else if (coreKey === 'warlock') {
            this.player.emergencyLifestealPercent = next.value;
            this.player.emergencyLifestealUntil = now + next.durationMs;
            this.player.emergencyOverhealBarrierCapRatio = Math.max(0, Number(next.overhealBarrierCapRatio || 0));
            this.player.emergencyOverhealBarrierUntil = now + next.durationMs;
          } else if (coreKey === 'druid') {
            this.player.activateEmergencyRegen?.(next.value, next.durationMs);
          }
          this.toast?.show?.({ icon: next.iconText, text: `${next.label} 触发` }, { durationMs: 1000 });
        },
        onReady: () => {
          const next = this.getEmergencyCooldownTalentState(coreKey);
          if (!next) return;
          this.toast?.show?.({ icon: next.iconText, text: `${next.label} 冷却完成` }, { durationMs: 1200 });
        }
      });
    });

    this.registerCooldownSkill({
      id: 'potion_small',
      label: potionSmall?.name || '血瓶',
      description: potionSmall?.desc || '生命低于50%自动使用，回复30%生命。',
      iconText: potionSmall?.icon || '🧪',
      cooldownMs: Math.max(0, Number(potionSmall?.consumable?.cooldownMs || 10000)),
      accentColor: 0xef4444,
      visible: this.hasCooldownItem('potion_small'),
      visibleWhen: () => this.hasCooldownItem('potion_small'),
      shouldAutoTrigger: () => {
        if (!this.player || !this.player.isAlive) return false;
        if (!this.hasCooldownItem('potion_small')) return false;
        if (this.player.hp >= this.player.maxHp) return false;
        const threshold = Number(potionSmall?.consumable?.thresholdPct || 0.5);
        const hpPct = this.player.maxHp > 0 ? (this.player.hp / this.player.maxHp) : 1;
        return hpPct <= threshold;
      },
      onTrigger: () => {
        this.useAutoHealConsumable('potion_small', { syncCooldownSkill: false });
      },
      onReady: () => {
        this.toast?.show?.({ icon: potionSmall?.icon || '🧪', text: `${potionSmall?.name || '血瓶'} 冷却完成` }, { durationMs: 1200 });
      }
    });
  }

  playTestCooldownSkillEffect() {
    if (!this.player || !this.player.active) return;

    const x = this.player.x;
    const y = this.player.y;
    const flash = this.add.circle(x, y, 20, 0xffffff, 0.68).setDepth(38);
    const ring = this.add.circle(x, y, 28, 0x22c55e, 0.18).setDepth(37);
    ring.setStrokeStyle(5, 0x86efac, 0.95);

    this.tweens.add({
      targets: flash,
      scale: 2.4,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy()
    });

    this.tweens.add({
      targets: ring,
      scale: 3.8,
      alpha: 0,
      duration: 480,
      ease: 'Quart.Out',
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < 12; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
      const distance = Phaser.Math.Between(28, 88);
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0x86efac, 0.92).setDepth(38);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(280, 520),
        ease: 'Cubic.Out',
        onComplete: () => particle.destroy()
      });
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
    this._pendingLevelUpPoints = 0;
    this._levelUpActive = false;
    this._currentLevelUpOffer = null;
    this._levelUpPanelOpen = false;
    this._levelUpPendingSinceMs = 0;
    this._levelUpLastInteractionMs = 0;
    this._levelUpOfferSequence = 0;
    this._levelUpSelectionLocked = false;

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
    const owned = getOwnedItemIds(this.registry.get('ownedItems'));
    const equippedIds = normalizeEquippedItems(this.registry.get('equippedItems'), owned);
    this.registry.set('ownedItems', owned);
    this.registry.set('equippedItems', equippedIds);

    this.inventoryAcquired = [];
    this.inventoryEquipped = equippedIds.map(id => (id ? getItemById(id) : null));
    this._runLootGearItems = [];
    this._runLootItemSeq = 0;

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
    // Boss 禁入圈：与 Boss 体积圈一致（不再额外扩大），避免“Boss 触边就停/不攻击”的体感问题
    this.bossNoGoPadding = 0;

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
    // Paladin Pulse（定时脉冲圈）：只有点出升级后才启用
    this.paladinPulseRadius = 0;
    this.paladinPulseDamage = 0;

    this.warlockEnabled = false;
    // 术士体系：是否允许命中时附加中毒/易伤效果
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
    this.installPassiveCooldownSkills();

    // 移动端隐藏摇杆（不影响键盘 WASD）
    this.setupTouchJoystick();

    // 新流程：开局不启用散射自动射击；必须先选择地上的武器
    this.player.canFire = false;

    // 初始化召唤物统一注册表
    this.summonRegistry = new SummonRegistry();

    // 初始化宠物管理器（真实宠物：熊/鹰/树精）
    this.petManager = new PetManager(this);
    this.petManager.setPlayer(this.player);

    // 初始化亡灵召唤管理器（骷髅卫士 / 骷髅法师）
    this.undeadSummonManager = new UndeadSummonManager(this);
    this.undeadSummonManager.setPlayer(this.player);

    // 应用装备加成
    this.applyEquippedEffects();
    
    // 初始化 Boss 管理器
    this.bossManager = new BossManager(this);
    
    // 初始化碰撞检测管理器
    this.collisionManager = new CollisionManager(this);
    this.collisionManager.setPlayer(this.player);
    this.collisionManager.setBossManager(this.bossManager);

    // 弹幕系统模块最小接线：先作为统一入口层挂上，不改现有战斗分发。
    this.setupBulletSystems();
    
    // 监听玩家信息更新
    if (this._updatePlayerInfoHandler) {
      this.events.off('updatePlayerInfo', this._updatePlayerInfoHandler);
    }
    this._updatePlayerInfoHandler = () => {
      this.updateInfoPanel();
    };
    this.events.on('updatePlayerInfo', this._updatePlayerInfoHandler);

    // 监听升级选择
    if (this._upgradeSelectedHandler) {
      this.game.events.off('upgradeSelected', this._upgradeSelectedHandler);
    }
    this._upgradeSelectedHandler = (upgrade) => {
      this.consumeLevelUpSelection?.(upgrade);
    };
    this.game.events.on('upgradeSelected', this._upgradeSelectedHandler);

    // 小怪击杀：经验 + 概率掉金币
    if (this._minionKilledHandler) {
      this.events.off('minionKilled', this._minionKilledHandler);
    }
    this._minionKilledHandler = (payload) => {
      this.triggerWarlockSouleaterBurst?.(payload?.x ?? 0, payload?.y ?? 0);

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

      // 小怪/精英：掉落局内装备
      {
        const equipmentSource = payload?.isElite ? 'elite' : 'minion';
        this.rollAndSpawnEquipmentDrops?.(
          equipmentSource,
          (payload?.x ?? 0),
          (payload?.y ?? 0)
        );
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

      if (this._roundBossDefeated) {
        this.evaluateChaosArenaRoundState?.();
      }
    };
    this.events.on('minionKilled', this._minionKilledHandler);

    // 教程Boss：击杀后直接进入三选一路径（核心已在起始房间选武器时确定）
    if (this._tutorialBossDefeatedHandler) {
      this.events.off('tutorialBossDefeated', this._tutorialBossDefeatedHandler);
    }
    this._tutorialBossDefeatedHandler = (data) => {
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
    };
    this.events.on('tutorialBossDefeated', this._tutorialBossDefeatedHandler);
    
    // 监听玩家死亡
    if (this._playerDiedHandler) {
      this.events.off('playerDied', this._playerDiedHandler);
    }
    this._playerDiedHandler = () => {
      console.log('游戏结束 - 玩家死亡');
      // 兜底：所有死亡场景都能弹出结算菜单
      if (!this._playerDeathHandled) {
        this.handlePlayerDeathOnce();
      }
      // 延迟跳转，保证动画和爆炸效果播放
      this.time.delayedCall(1200, () => {
        if (this.scene && this.scene.isActive('GameScene')) {
          this.scene.start('GameOverScene', {
            victory: false,
            score: this.playerData?.score || 0,
            survived: typeof this.getPlayTime === 'function' ? this.getPlayTime() : '',
            sessionCoins: this.sessionCoins || 0
          });
        }
      });
    };
    this.events.on('playerDied', this._playerDiedHandler);

    // 监听场景关闭事件
    if (this._sceneShutdownHandler) {
      this.events.off('shutdown', this._sceneShutdownHandler);
    }
    this._sceneShutdownHandler = () => {
      this.onSceneShutdown();
    };
    this.events.on('shutdown', this._sceneShutdownHandler);
    
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
      // 全屏任意位置都可启动摇杆（支持右手操作）
      leftOnly: false,
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

      if (this.isPointerOverLevelUpHud?.(pointer.x, pointer.y)) {
        this.resetTouchJoystickInput?.();
        this.openPendingLevelUpScene?.();
        return;
      }

      if (this.cooldownHud?.containsPoint?.(pointer.x, pointer.y)) {
        return;
      }

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

      // leftOnly=false 时，全屏都可启动

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

  // 兜底：当场景被暂停/被 UI 覆盖时，pointerup 可能丢失，导致摇杆方向残留。
  // 这里把“摇杆状态 + 玩家模拟输入”都视作松手，防止恢复后继续朝旧方向移动。
  resetTouchJoystickInput() {
    try {
      const j = this._touchJoystick;
      if (j) {
        j.activePointerId = null;
        j.value?.set?.(0, 0);
        j.base?.setVisible?.(false);
        j.thumb?.setVisible?.(false);
      }
    } catch (_) {
      // ignore
    }
    this.player?.clearAnalogMove?.();
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
    this.syncCombatBehaviorPause();

    // 物品冷却等逻辑使用"可暂停时钟"：
    // - 打开查看菜单/升级/商店等暂停期间不推进
    // - 恢复后的第一帧跳过 delta，避免补算
    if (!Number.isFinite(this._gameplayNowMs)) this._gameplayNowMs = 0;
    const menuFrozen = (this.viewMenuOpen || this.viewMenuClosing || this._sceneIntroActive);
    if (this._skipGameplayDeltaOnce) {
      this._skipGameplayDeltaOnce = false;
    } else if (!menuFrozen) {
      const d = Number(delta || 0);
      if (d > 0) this._gameplayNowMs += d;
    }

    this.updateCooldownSkills(this._gameplayNowMs, { allowAutoTrigger: false });

    // 查看菜单打开/关闭动画中：冻结战斗更新，只允许菜单交互
    // 但允许菜单 UI 做轻量动画（例如双职业彩虹边框）。
    if (menuFrozen) {
      if (this.viewMenuOpen) {
        this.updateViewMenuUiAnimations(time, delta);
      }
      this.updateBulletSystemsDebugOverlay();
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

    this.updateLevelUpPresentationFollow?.();
    this.updateLevelUpPendingHud?.(this._gameplayNowMs || time || 0);

    // 玩家死亡：立即停止所有玩家攻击与机制（但不暂停 Scene 的 time/tweens，保证 GameOver 延迟跳转仍能发生）
    if (this.player && this.player.isAlive === false) {
      this.handlePlayerDeathOnce();
      return;
    }

    // 三选一期间允许玩家移动去碰路径门，但冻结所有战斗推进与自动攻击。
    if (this._pathChoiceActive) {
      // 路径选择期间仍需维持非战斗跟随更新：
      // - 掉落可正常吸附/拾取
      // - 术士毒圈继续扩张/消散
      // - 召唤物继续跟随玩家回位
      // - 各职业攻击范围圈持续跟随玩家
      if (this.bulletManager) {
        this.bulletManager.update(delta);
      }
      if (this.petManager) {
        this.petManager.update(time, delta);
      }
      if (this.undeadSummonManager) {
        this.undeadSummonManager.update(time, delta);
      }
      this.updateOffclassSystems?.(time, delta);
      this.updateDrops(delta);
      this.updateWarriorRangeRing?.(time);
      this.updatePaladinTargetingRing(time);
      this.updateArcherRangeRing(time);
      this.updateMageRangeRing?.(time);
      this.updateDruidRangeRing?.(time);
      this.updateWarlockRangeRing?.(time);

      if (Array.isArray(this._pathDoorZones) && this._pathDoorZones.length > 0 && this.player) {
        for (const entry of this._pathDoorZones) {
          const z = entry.zone;
          if (!z) continue;
          const touched = entry.rift
            ? isTouchingRiftPortal(this.player, entry.rift)
            : (() => {
              const dx = this.player.x - z.x;
              const dy = this.player.y - z.y;
              const hx = (z.width || 0) * 0.5;
              const hy = (z.height || 0) * 0.5;
              return (Math.abs(dx) <= hx && Math.abs(dy) <= hy);
            })();

          if (touched) {
            this.selectPathChoice(entry.choice);
            break;
          }
        }
      }
      this.updateBulletSystemsDebugOverlay();
      return;
    }

    if (this._postBossRewardActive) {
      if (this.bulletManager) {
        this.bulletManager.update(delta);
      }
      if (this.petManager) {
        this.petManager.update(time, delta);
      }
      if (this.undeadSummonManager) {
        this.undeadSummonManager.update(time, delta);
      }
      this.updateOffclassSystems?.(time, delta);
      this.updateDrops(delta);
      this.updateWarriorRangeRing?.(time);
      this.updatePaladinTargetingRing(time);
      this.updateArcherRangeRing(time);
      this.updateMageRangeRing?.(time);
      this.updateDruidRangeRing?.(time);
      this.updateWarlockRangeRing?.(time);

      if (this._postBossRewardChoiceMade && this._arenaContinueKey && Phaser.Input.Keyboard.JustDown(this._arenaContinueKey)) {
        this.confirmPostBossRewardAndContinue?.();
      }
      this.updateBulletSystemsDebugOverlay();
      return;
    }

    this.updateOffclassSystems?.(time, delta);
    
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

    // 可能在 collisionManager.update() 中触发死亡：同帧立即停机
    if (this.player && this.player.isAlive === false) {
      this.handlePlayerDeathOnce();
      return;
    }

    // 自动消耗品（装备后触发）：血瓶/大血瓶
    this.updateAutoConsumables(this._gameplayNowMs);

    // 在受伤/碰撞/自动消耗品结算之后再次检查被动 CD，避免跨阈值后一帧才触发。
    this.updateCooldownSkills(this._gameplayNowMs, { allowAutoTrigger: true });

    // CD 转好提示（右下角 Toast）
    this.checkEquippedItemCooldownReadyToasts(this._gameplayNowMs);

    // 更新宠物
    if (this.petManager) {
      this.petManager.update(time, delta);
    }
    if (this.undeadSummonManager) {
      this.undeadSummonManager.update(time, delta);
    }

    // 起始房间流程：选武器后直接进入混沌竞技场
    if (this.inStartRoom) {
      if (this.startRoomDoorActive && this.startRoomDoorZone && this.player) {
        const touched = this.startRoomDoorRift
          ? isTouchingRiftPortal(this.player, this.startRoomDoorRift)
          : (() => {
            const dx = this.player.x - this.startRoomDoorZone.x;
            const dy = this.player.y - this.startRoomDoorZone.y;
            const hx = (this.startRoomDoorZone.width || 0) * 0.5;
            const hy = (this.startRoomDoorZone.height || 0) * 0.5;
            return (Math.abs(dx) <= hx && Math.abs(dy) <= hy);
          })();

        if (touched) {
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
    this.updateWarriorRangeRing?.(time);
    this.updatePaladinTargetingRing(time);
    this.updateArcherRangeRing(time);
    this.updateMageRangeRing?.(time);
    this.updateDruidRangeRing?.(time);
    this.updateWarlockRangeRing?.(time);

    // 地图：迷雾（柔和永久揭开）+ 小地图
    // 帧预算保护：当前帧耗时过长（掉帧中）则跳过迷雾更新，优先保障流畅度
    if (this.fogMode === 'soft' && this.player && delta < 50) {
      const isTutorial = (this.currentMapInfo?.id === 'tutorial_level');
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
      // 玩家：适度频率（移动+时间双阈值）
      this.revealFogAt(this.player.x, this.player.y, false, playerScale, { tag: 'player', minIntervalMs: isTutorial ? 110 : 60, minDist: isTutorial ? 22 : 14 });

      // 额外揭开敌人周围（只在敌人接近时做，避免过度开图）
      const enemyRevealTriggerR = cell * 6;
      if (boss && boss.isAlive && boss.combatActive) {
        const dx = boss.x - this.player.x;
        const dy = boss.y - this.player.y;
        if ((dx * dx + dy * dy) <= (enemyRevealTriggerR * enemyRevealTriggerR)) {
          // Boss：低频即可（避免持续擦除带来的掉帧）
          this.revealFogAt(boss.x, boss.y, false, 1.9, { tag: 'boss', minIntervalMs: 200, minDist: 24 });
        }
      }
      // 小怪迷雾揭露：降频以减轻 GPU blit 压力（首波小怪在生成时已 force 揭露过）
      if (Array.isArray(minions) && minions.length > 0) {
        minions.forEach(m => {
          if (!m || !m.isAlive) return;
          const dx = m.x - this.player.x;
          const dy = m.y - this.player.y;
          if ((dx * dx + dy * dy) <= (enemyRevealTriggerR * enemyRevealTriggerR)) {
            const id = (m.__enemyId != null) ? String(m.__enemyId) : (m.minionName || 'm');
            this.revealFogAt(m.x, m.y, false, 1.5, { tag: `minion:${id}`, minIntervalMs: isTutorial ? 450 : 300, minDist: isTutorial ? 40 : 30 });
          }
        });
      }
    }

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
          const cellSize = Math.max(64, Math.round(this.mapConfig?.cellSize || 128));
          const fallbackAggroR = Phaser.Math.Clamp(Math.floor(cellSize * 6.0), 520, 980);
          const aggroR = (Number.isFinite(boss.aggroRadius) && boss.aggroRadius > 0) ? boss.aggroRadius : fallbackAggroR;
          if (typeof boss.setAggroRadius === 'function' && (!Number.isFinite(boss.aggroRadius) || boss.aggroRadius <= 0)) {
            boss.setAggroRadius(aggroR);
          }
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
      const touched = this.exitDoorRift
        ? isTouchingRiftPortal(this.player, this.exitDoorRift)
        : (() => {
          const dx = this.player.x - this.exitDoorZone.x;
          const dy = this.player.y - this.exitDoorZone.y;
          const hx = (this.exitDoorZone.width || 0) * 0.5;
          const hy = (this.exitDoorZone.height || 0) * 0.5;
          return (Math.abs(dx) <= hx && Math.abs(dy) <= hy);
        })();

      if (touched) {
        // 防止重复触发
        this.exitDoorActive = false;
        this.advanceToNextLevel();
      }
    }

    this.updateBulletSystemsDebugOverlay();

  }

  /**
   * 场景关闭时的清理
   */
  onSceneShutdown() {
    console.log('GameScene: 清理游戏资源');

    this.destroyBulletSystems();

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

    if (this.undeadSummonManager) {
      this.undeadSummonManager.destroy();
      this.undeadSummonManager = null;
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

  handlePlayerDeathOnce() {
    if (this._playerDeathHandled) return;
    this._playerDeathHandled = true;

    this.cleanupPostBossRewardUI?.();
    this.resetChaosArenaRoundFlow?.();

    // 禁用输入，避免残留移动/操作
    try { this.input.enabled = false; } catch (_) { /* ignore */ }
    try { if (this.input?.keyboard) this.input.keyboard.enabled = false; } catch (_) { /* ignore */ }
    this.destroyTouchJoystick();
    this.player?.clearAnalogMove?.();
    if (this.player) this.player.canFire = false;

    // 停止宠物
    if (this.petManager) {
      try {
        for (const pet of this.petManager.active?.values?.() || []) {
          pet?.destroy?.();
        }
        this.petManager.active?.clear?.();
      } catch (_) { /* ignore */ }
    }
    if (this.undeadSummonManager) {
      try {
        this.undeadSummonManager.clearUnits?.();
      } catch (_) { /* ignore */ }
    }

    // 停止 Build 相关机制与可视对象（无人机/近战扇形/提示圈等）
    this.droneEnabled = false;
    if (Array.isArray(this.droneUnits) && this.droneUnits.length > 0) {
      this.droneUnits.forEach((u) => { try { u?.destroy?.(); } catch (_) { /* ignore */ } });
      this.droneUnits = [];
    }

    this.meleeEnabled = false;
    try { this.destroySlashFan?.(); } catch (_) { /* ignore */ }

    if (this._warriorTargetRing) { try { this._warriorTargetRing.setVisible(false); } catch (_) { /* ignore */ } }
    if (this._paladinTargetRing) { try { this._paladinTargetRing.setVisible(false); } catch (_) { /* ignore */ } }
    if (this._archerRangeRing) { try { this._archerRangeRing.setVisible(false); } catch (_) { /* ignore */ } }
    if (this._mageRangeRing) { try { this._mageRangeRing.setVisible(false); } catch (_) { /* ignore */ } }
    if (this._druidRangeRing) { try { this._druidRangeRing.setVisible(false); } catch (_) { /* ignore */ } }
    if (this._warlockRangeRing) { try { this._warlockRangeRing.setVisible(false); } catch (_) { /* ignore */ } }

    this.paladinEnabled = false;
    this.warlockEnabled = false;
    this.warlockDebuffEnabled = false;

    // 清除玩家弹幕（包括毒池等持续伤害）
    try { this.bulletManager?.clearPlayerBullets?.(); } catch (_) { /* ignore */ }

    // 额外保险：清除非 BulletManager 托管、但标记为玩家弹幕的临时对象（例如近战判定 graphics）
    try {
      const list = Array.isArray(this.children?.list) ? this.children.list.slice() : [];
      list.forEach((child) => {
        if (!child || !child.active) return;
        if (child === this.player) return;
        if (child.isPlayerBullet) {
          child.destroy?.();
        }
      });
    } catch (_) { /* ignore */ }
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
