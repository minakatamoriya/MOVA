import Phaser from 'phaser';
import {
  destroyArcaneRay,
  fireLaser,
  fireMageIceBolt,
  fireStarfall,
  fireArcherArrow,
  firePaladinHammer,
  fireWarlockPoisonNova,
  updateArcaneRay
} from '../classes/attacks/weapons';
import { normalizeCoreKey } from '../classes/classDefs';

import { getOffCorePassive } from '../classes/attacks/basicAttackMods';
import { getBaseColorForCoreKey, lerpColor } from '../classes/visual/basicSkillColors';
import {
  buildPlayerDerivedStats,
  calculateResolvedDamage,
  normalizeStatMods,
  resolvePlayerIncomingDamage
} from '../combat/damageModel';

const PLAYER_ANIM_CONFIG = {
  sheetKey: 'player',
  frameWidth: 64,
  frameHeight: 64,
  directions: ['down', 'up', 'left', 'right'],
  framesPerDirection: 20,
  directionRow: {
    down: 0,
    up: 1,
    left: 2,
    right: 3
  },
  useFlipForLeft: false,
  states: {
    idle: { frames: [0, 1, 2, 3], frameRate: 6, yoyo: true, repeat: -1 },
    run: { frames: [4, 5, 6, 7], frameRate: 10, repeat: -1 },
    attack: { frames: [8, 9, 10, 11], frameRate: 12, repeat: 0, hitFrame: 10 },
    skill: { frames: [12, 13, 14, 15], frameRate: 8, repeat: 0, effectFrame: 13, cooldown: 2000 },
    hurt: { frames: [16, 17, 18, 19], frameRate: 15, repeat: 0 }
  }
};

const ARCHER_ANIM_CONFIG = {
  // 使用单张 PNG 作为每一帧：key 由 PreloadScene 预先加载
  sheetKey: 'archer',
  frameWidth: 48,
  frameHeight: 48,
  // 放大显示（你选择了 2.0x）
  scale: 2.0,
  directions: [
    'south',
    'south-east',
    'east',
    'north-east',
    'north',
    'north-west',
    'west',
    'south-west'
  ],
  useFlipForLeft: false,
  frameKeyFor: (state, direction, frameIndex = 0) => {
    if (state === 'run') return `archer_walk_${direction}_${frameIndex}`;
    // idle / attack / skill / hurt：先用 rotations 做占位（避免缺动画导致锁死）
    return `archer_rotation_${direction}`;
  },
  states: {
    idle: { frameCount: 1, frameRate: 6, repeat: -1 },
    run: { frameCount: 8, frameRate: 10, repeat: -1 },
    attack: { frameCount: 1, frameRate: 12, repeat: 0 },
    skill: { frameCount: 1, frameRate: 10, repeat: 0, cooldown: 2000 },
    hurt: { frameCount: 1, frameRate: 15, repeat: 0 }
  }
};

// deluyi：当前仅提供向右行走帧序列；仍保留 8 方向移动逻辑
// 显示规则：右侧（右/右上/右下）用原帧；左侧（左/左上/左下）用 flipX 镜像；纯上/下保持上一次左右朝向。
// idle 暂时复用走路循环。
const DELUYI_ANIM_CONFIG = {
  sheetKey: 'deluyi',
  frameWidth: 64,
  frameHeight: 64,
  // 角色在画布中的显示缩放（同时会驱动 hitbox/visual 半径按比例放大）
  scale: 1.6,
  // 目前只有走路帧：攻击/技能/受伤不切动作动画，避免自动射击导致动画频繁被打断或卡锁。
  disableActionAnimations: true,
  // deluyi 只有左右镜像：为了避免 8 方向扇区切换导致动画 key 频繁变化而“重头播放”，
  // 动画统一固定使用同一方向（east）的 key；左右朝向仅由 flipX 控制。
  animDirectionFor: () => 'east',
  directions: [
    'south',
    'south-east',
    'east',
    'north-east',
    'north',
    'north-west',
    'west',
    'south-west'
  ],
  // spritesheet 为 4x4 网格（每行 4 帧）；动画用到 0~13 共 14 帧
  framesPerDirection: 4,
  directionRow: {
    south: 0,
    'south-east': 0,
    east: 0,
    'north-east': 0,
    north: 0,
    'north-west': 0,
    west: 0,
    'south-west': 0
  },
  useFlipForLeft: true,
  states: {
    // 停止移动：停在第 0 帧（不循环）
    idle: { frames: [0], frameRate: 1, repeat: 0 },
    run: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], frameRate: 10, repeat: -1 },
    attack: { frames: [0], frameRate: 12, repeat: 0, hitFrame: 0 },
    skill: { frames: [0], frameRate: 10, repeat: 0, effectFrame: 0, cooldown: 2000 },
    hurt: { frames: [0], frameRate: 15, repeat: 0 }
  }
};

/**
 * 玩家类
 * 可移动、自动射击的玩家角色
 */
export default class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    
    this.scene = scene;
    this.scene.add.existing(this);
    
    // 标记为玩家（用于碰撞检测识别）
    this.isPlayer = true;
    
    // 玩家属性
    this.hp = 100;
    this.baseMaxHp = 100;
    this.maxHp = this.baseMaxHp;
    this.isAlive = true;
    this.isInvincible = false; // 受伤后短暂无敌
    this.invincibleTime = 1500; // 无敌时长（毫秒）- 增加到1.5秒以避免持续扣血
    this.shieldCharges = 0;

    // 动画状态（默认使用 deluyi；旧 any/archer 方案保留在 ARCHER_ANIM_CONFIG）
    this.animConfig = DELUYI_ANIM_CONFIG;
    this.baseSpriteScale = (Number.isFinite(this.animConfig?.scale) && this.animConfig.scale > 0)
      ? this.animConfig.scale
      : 1;
    this.animState = 'idle';
    this.actionLock = null;
    this.lastDirection = 'south';
    this.attackFrameFired = false;
    this.skillFrameFired = false;
    this.lastSkillTime = 0;
    this.onAttackHit = null;
    this.onSkillEffect = null;
    
    // 移动属性
    this.baseMoveSpeed = 250;
    this.moveSpeed = this.baseMoveSpeed; // 移动速度
    this.controlMoveSpeedMult = 1;
    this._controlMoveSlowUntil = 0;
    this._controlRootUntil = 0;
    this.canMove = true;
    this.hitboxRadius = 8; // 核心判定半径（小型圆形）
    this.visualRadius = 15; // 视觉大小
    this.moveIntent = new Phaser.Math.Vector2(0, 0);
    this.lastMoveIntent = new Phaser.Math.Vector2(0, 1);
    this.worldVelocity = new Phaser.Math.Vector2(0, 0);

    // 若使用放大后的 archer 资源：同步放大判定/视觉圈（以旧 64px 为基准）
    {
      const fw = this.animConfig?.frameWidth;
      const scale = this.animConfig?.scale;
      if (Number.isFinite(fw) && Number.isFinite(scale) && fw > 0) {
        const targetPx = fw * scale;
        const mult = targetPx / 64;
        if (Number.isFinite(mult) && mult > 0) {
          this.hitboxRadius = Math.max(6, Math.round(this.hitboxRadius * mult));
          this.visualRadius = Math.max(10, Math.round(this.visualRadius * mult));
        }
      }
    }

    // 移动输入：可由 Scene 注入（移动端隐藏摇杆等）
    this.analogMoveActive = false;
    this.analogMove = { x: 0, y: 0 };
    
    // 射击属性
    // 统一下调初始攻速：让早期战斗更可读（伤害/数字从个位数起步）
    this.baseFireRate = 420;
    // 猎人基础射击：起步更慢，后续靠升级提速
    this.baseFireRateArcher = 560;
    this.baseFireRateMoonfire = 760;
    this.fireRate = this.baseFireRate; // 射击间隔（毫秒）
    this.bulletSpeed = 380; // 子弹速度
    // 初始伤害：个位数起步
    this.baseBulletDamage = 6;
    this.bulletDamage = this.baseBulletDamage; // 子弹伤害
    this.canFire = true;
    this.weaponType = 'archer_arrow'; // archer_arrow | mage_frostbolt | warrior_melee | paladin_hammer | starfall | warlock_poisonnova
    this.archerAttackWindupRatio = 0.23;
    this.archerAttackWindupMinMs = 74;
    this.archerAttackWindupMaxMs = 138;
    this.mageAttackWindupRatio = 0.2;
    this.mageAttackWindupMinMs = 56;
    this.mageAttackWindupMaxMs = 108;
    this.archerArrowRangeMax = 420;
    this._archerPendingShots = new Set();
    this._archerChargeFxSeq = 0;
    this._mageChargeEffectExpireAt = 0;
    this.isMoving = false;

    // 双职业：主职业决定普攻形态；副职业只提供强化
    this.mainCoreKey = null;
    this.offCoreKey = null;
    this.offFireRateMult = 1;
    // 圣骑：击退与制裁（眩晕）
    this.paladinKnockback = 0;
    this.paladinStunLevel = 0;
    this.paladinStunChance = 0;
    this.mageFrostbiteLevel = 0;
    this.mageColdFocusLevel = 0;
    this.mageIceVeinsLevel = 0;
    this.mageDeepFreezeLevel = 0;
    this.mageShatterLevel = 0;
    this.mageFrostNovaLevel = 0;
    this.mageFrostDomainLevel = 0;
    this.warriorArcLevel = 0;
    this.warriorSwordQiLevel = 0;
    this.warriorDamageLevel = 0;
    this.warriorSpin = false;
    this.warriorSpinActiveUntil = 0;
    this.warriorSpinNextAt = 0;
    this.druidMeteorShowerLevel = 0;
    this.druidMeteorLevel = 0;
    this.druidStarfireLevel = 0;
    this.warlockDepthInfernalUnlocked = false;

    // 通用被动（副职业派系）
    this.universalDamageMult = 1;
    this.thirdSpecDamageBonus = 0;
    this.thirdSpecFireRateBonus = 0;
    this.thirdSpecCritChanceBonus = 0;
    this.thirdSpecDamageReductionBonus = 0;
    this.thirdSpecDodgeChanceBonus = 0;
    this.thirdSpecBlockChanceBonus = 0;
    this.thirdSpecRegenRatioPerSec = 0;
    this.dodgeChance = 0;
    this.equipmentDodgeChance = 0;
    this.blockChance = 0;
    this.flatDamageReduction = 0;
    this.damageReductionPercent = 0;
    this.dodgePercent = 0;
    this.counterOnBlock = false;

    // 物品（消耗品）冷却
    // 约定：itemId -> cooldownUntilGameplayMs（可暂停的局内时钟）
    this.itemCooldowns = Object.create(null);

    // 副职业：奥术炮台、诱饵假人、圣印、魂火等运行态
    this.arcaneCircleEnabled = false;
    this.arcaneCircleLevel = 0;
    this.arcaneCircleRangeLevel = 0;
    this.arcaneFireCircleLevel = 0;
    this.arcaneFrostCircleLevel = 0;
    this.arcaneResonanceMarkLevel = 0;
    this.arcaneFlowcastingLevel = 0;
    this.arcaneCircleState = null;
    this.arcaneCircleBuffActive = false;
    this.arcaneFlowUntil = 0;
    this.arcaneCircleInsideLastFrame = false;

    this.rangerSnareTrapLevel = 0;
    this.rangerBeaconEnabled = false;
    this.rangerHuntmarkLevel = 0;
    this.rangerSpikeTrapLevel = 0;
    this.rangerBlastTrapLevel = 0;
    this.rangerTrapcraftLevel = 0;
    this.rangerPackHunterLevel = 0;

    this.guardianBlockLevel = 0;
    this.guardianBlockBonus = 0;
    this.guardianArmorLevel = 0;
    this.guardianArmorCooldownUntil = 0;
    this.guardianCounterLevel = 0;
    this.guardianSacredSealLevel = 0;
    this.guardianSealStacks = 0;
    this.guardianSealMaxStacks = 0;
    this.guardianSealUntil = 0;
    this.guardianHolyRebukeLevel = 0;
    this.guardianLightFortressLevel = 0;
    this.paladinShelterExtensionLevel = 0;
    this.guardianBarrierHp = 0;
    this.curseSkeletonGuardLevel = 0;
    this.curseSkeletonMageLevel = 0;
    this.unyieldingBloodrageLevel = 0;
    this.unyieldingBattlecryLevel = 0;
    this.unyieldingHamstringLevel = 0;
    this.unyieldingSunderLevel = 0;
    this.unyieldingStandfastLevel = 0;
    this.unyieldingExecutionerLevel = 0;
    this.unyieldingStandfastActive = false;

    this.curseNecroticVitalityLevel = 0;
    this.curseMageEmpowerLevel = 0;
    this.curseGuardBulwarkLevel = 0;
    this.curseEmberEchoLevel = 0;
    this.curseEmberStacks = 0;
    this.curseEmberUntil = 0;
    this.summonStarterGuardCount = 0;
    this.summonStarterMageCount = 0;

    this.druidPetBearLevel = 0;
    this.druidPetHawkLevel = 0;
    this.druidPetTreantLevel = 0;
    this.natureBearGuardLevel = 0;
    this.natureHawkHuntmarkLevel = 0;
    this.natureTreantBloomLevel = 0;

    // 不屈：战吼（受伤触发临时增伤）
    this.battlecryEnabled = false;
    this.battlecryUntil = 0;
    this.battlecryBonus = 0.15;

    // 不屈：死斗（低血加速）
    this.deathDuelEnabled = false;
    this.deathDuelFireRateMult = 1;
    this.bloodrageEnabled = false;
    this.bloodragePerStack = 0.03;

    // 主职业保命 CD：低血临时状态
    this.emergencyMitigationUntil = 0;
    this.emergencyMitigationMult = 1;
    this.emergencyDodgeUntil = 0;
    this.emergencyDodgeBonus = 0;
    this.emergencyLifestealUntil = 0;
    this.emergencyLifestealPercent = 0;
    this.emergencyOverhealBarrierUntil = 0;
    this.emergencyOverhealBarrierCapRatio = 0;
    this.emergencyRegenUntil = 0;
    this.emergencyRegenPerMs = 0;
    this.emergencyRegenRemaining = 0;
    this.emergencyRegenCarry = 0;
    this.passiveRegenPerSec = 0;
    this.regenPerSec = 0;
    this._emergencyFxAngle = 0;

    // 德鲁伊（月火术）
    this.moonfireDamageMult = 0.35;
    this.moonfireSpeedMult = 0.6; // 比常规更慢
    this.moonfireGravity = 0;
    // 月火术索敌范围（不再无限远）
    this.moonfireRangeBase = 300;
    this.moonfireRange = this.moonfireRangeBase;
    // 亲和吸附：轻微拐弯（不要像追踪弹）
    this.moonfireAffinityConeDeg = 55;
    this.moonfireAffinityTurnDegPerSec = 28;

    // 攻击范围（用于统一范围圈提示）
    // 德鲁伊：星落索敌范围（不再无限距离）
    this.druidStarfallRangeBase = 310;
    this.druidStarfallRange = this.druidStarfallRangeBase;
    this.druidStarfallBaseRadius = 70;

    // 法师飞弹：用于范围圈对齐（飞弹本身已用 maxLifeMs 限制）
    this.mageMissileRangeBase = 280;
    this.mageMissileRange = this.mageMissileRangeBase;

    // 术士：投掷索敌半径与毒沼基础半径
    this.warlockRangeBase = 248;
    this.warlockPoisonNovaRadiusBase = 96;
    this.warlockPoisonNovaRadius = this.warlockPoisonNovaRadiusBase;
    this.warlockRange = this.warlockRangeBase;

    // 战士：近战基础索敌/挥砍范围
    this.warriorRangeBase = 220;
    this.warriorRange = this.warriorRangeBase;
    this.warriorArcBaseDeg = 90;

    // 猎人基础技能（箭矢连射）
    this.archerEnabled = true;
    this.archerVolleySpread = Phaser.Math.DegToRad(6.4);
    this.archerVolleyCount = 3;
    this.archerVolleyMode = 'fan'; // fan | ring
    this.archerVolleyRingCount = 10;
    this.archerVolleyDamageMult = 0.64;
    this.archerVolleyHoming = false;
    this.archerVolleyHomingTurn = 0.04;
    this.archerVolleyExplode = false;
    this.archerVolleyLockAim = true;
    this.archerVolleyLockTurn = Phaser.Math.DegToRad(300);
    this.buildFireRateMult = 1;

    // 猎人基础技能（箭矢）专属升级参数
    // 注意：索敌范围与范围圈共用同一半径，猎人升级后上限放宽到 420
    this.archerArrowRangeBase = 330;
    this.archerArrowRange = this.archerArrowRangeBase;
    this.archerArrowDamageMult = 1;
    this.archerArrowRangeLevel = 0;
    this.archerArrowScatterLevel = 0;
    this.archerArrowBounce = 0;
    this.archerWindfury = 0;
    this.archerEagleeye = 0;
    this.mageDualcaster = 0;
    this.mageTrilaser = 0;
    this.warriorBladestorm = 0;
    this.warriorSpin = false;
    this.warriorUnyielding = 0;
    this.warlockPoisonAutoSeek = 0;
    this.warlockNetherlord = 0;
    this.paladinAvengerLevel = 0;
    this.paladinSacredshield = 0;
    this.paladinDivine = 0;
    this.druidKingofbeasts = 0;
    this.druidNaturefusion = 0;

    // 装备倍率缓存
    this.equipmentMods = { damageMult: 1, fireRateMult: 1, speedMult: 1, rangeMult: 1, maxHpFlat: 0, regenPerSec: 0, damageReductionPercent: 0, blockChance: 0 };

    // 局内战利品倍率缓存：一次性，本局结束清空；不进入局外装备系统
    this.runLootMods = { damageMult: 1, fireRateMult: 1, speedMult: 1, rangeMult: 1, maxHpFlat: 0, regenPerSec: 0, damageReductionPercent: 0, blockChance: 0 };

    // 装备效果属性
    this.baseCritChance = 0.05;
    this.critChance = this.baseCritChance;
    this.baseCritMultiplier = 1.5;
    this.critMultiplier = this.baseCritMultiplier;
    this.lifestealPercent = 0;
    this.baseMagnetRadius = 28;
    this.magnetRadius = this.baseMagnetRadius;
    
    // 子弹池
    this.bullets = [];
    // 仅用于向后兼容的引用列表，不再用于限制子弹射程
    this.maxBullets = this.scene?.bulletManager?.config?.maxPlayerBullets ?? 300;
    
    // 创建视觉元素
    this.createVisuals();
    
    // 设置控制
    this.setupControls();
    
    // 开始自动射击
    this.startAutoFire();
  }

  /**
   * 创建视觉元素
   */
  createVisuals() {
    this.ensureAnimations();

    const startKey = this.animConfig?.frameKeyFor
      ? this.animConfig.frameKeyFor('idle', this.lastDirection, 0)
      : this.animConfig.sheetKey;

    this.sprite = this.scene.add.sprite(0, 0, startKey, 0);
    this.sprite.isPlayer = true;
    this.sprite.setOrigin(0.5, 0.5);

    if (Number.isFinite(this.baseSpriteScale) && this.baseSpriteScale !== 1) {
      this.sprite.setScale(this.baseSpriteScale);
    }
    this.add(this.sprite);
    
    // 核心判定点（红色小圆点）
    this.hitbox = this.scene.add.circle(0, 0, this.hitboxRadius, 0xff0000, 0.3);
    this.hitbox.setStrokeStyle(1, 0xff0000, 0.8);
    this.hitbox.isPlayer = true; // 标记为玩家部件
    this.add(this.hitbox);
    
    // 护盾效果（无敌时显示）
    this.shield = this.scene.add.circle(0, 0, this.visualRadius + 8, 0x00ffff, 0);
    this.shield.setStrokeStyle(2, 0x00ffff, 0.6);
    this.shield.setVisible(false);
    this.add(this.shield);

    // 护盾充能指示
    this.shieldIndicator = this.scene.add.circle(0, 0, this.visualRadius + 6, 0x4d88ff, 0);
    this.shieldIndicator.setStrokeStyle(2, 0x4d88ff, 0.8);
    this.shieldIndicator.setVisible(false);
    this.add(this.shieldIndicator);

    this.archerChargeAura = this.scene.add.circle(0, -this.visualRadius * 0.2, this.visualRadius + 10, 0x7aff9a, 0);
    this.archerChargeAura.setStrokeStyle(2, 0xeafff2, 0);
    this.archerChargeAura.setBlendMode(Phaser.BlendModes.ADD);
    this.archerChargeAura.setVisible(false);
    this.add(this.archerChargeAura);

    this.archerChargeSpark = this.scene.add.rectangle(0, -this.visualRadius * 0.85, 10, 18, 0xf3fff6, 0);
    this.archerChargeSpark.setStrokeStyle(1, 0x7aff9a, 0);
    this.archerChargeSpark.setBlendMode(Phaser.BlendModes.ADD);
    this.archerChargeSpark.setAngle(18);
    this.archerChargeSpark.setVisible(false);
    this.add(this.archerChargeSpark);

    this.archerReleaseFlash = this.scene.add.rectangle(0, -this.visualRadius * 0.9, 14, 34, 0x52ff68, 0);
    this.archerReleaseFlash.setBlendMode(Phaser.BlendModes.ADD);
    this.archerReleaseFlash.setVisible(false);
    this.add(this.archerReleaseFlash);

    this.divineShelterAura = this.scene.add.circle(0, 0, this.visualRadius + 14, 0xfbbf24, 0.08);
    this.divineShelterAura.setStrokeStyle(3, 0xfde68a, 0.95);
    this.divineShelterAura.setVisible(false);
    this.add(this.divineShelterAura);

    this.divineShelterSigil = this.scene.add.graphics();
    this.divineShelterSigil.fillStyle(0xfbbf24, 0.42);
    this.divineShelterSigil.lineStyle(2, 0xfef3c7, 0.95);
    this.divineShelterSigil.beginPath();
    this.divineShelterSigil.moveTo(0, -10);
    this.divineShelterSigil.lineTo(8, -4);
    this.divineShelterSigil.lineTo(6, 8);
    this.divineShelterSigil.lineTo(0, 14);
    this.divineShelterSigil.lineTo(-6, 8);
    this.divineShelterSigil.lineTo(-8, -4);
    this.divineShelterSigil.closePath();
    this.divineShelterSigil.fillPath();
    this.divineShelterSigil.strokePath();
    this.divineShelterSigil.setPosition(0, -this.visualRadius - 12);
    this.divineShelterSigil.setVisible(false);
    this.add(this.divineShelterSigil);

    this.emergencyRegenAura = this.scene.add.circle(0, 0, this.visualRadius + 18, 0x22c55e, 0.06);
    this.emergencyRegenAura.setStrokeStyle(2, 0x86efac, 0.9);
    this.emergencyRegenAura.setVisible(false);
    this.add(this.emergencyRegenAura);

    this.emergencyRegenOrbs = [0, 1, 2].map(() => {
      const orb = this.scene.add.circle(0, 0, 3, 0x86efac, 0.95);
      orb.setVisible(false);
      this.add(orb);
      return orb;
    });

    this.bindAnimationEvents();
    this.playBaseAnimation('idle', this.lastDirection);
  }

  ensureAnimations() {
    const config = this.animConfig || PLAYER_ANIM_CONFIG;
    const { directions, states } = config;
    const isTextureKeyAnim = typeof config.frameKeyFor === 'function';

    directions.forEach((direction) => {
      Object.entries(states).forEach(([stateName, stateConfig]) => {
        const key = this.getAnimKey(stateName, direction);
        if (this.scene.anims.exists(key)) return;

        if (isTextureKeyAnim) {
          const frameCount = stateConfig.frameCount || 1;
          const frames = Array.from({ length: frameCount }, (_, i) => ({
            key: config.frameKeyFor(stateName, direction, i)
          }));

          this.scene.anims.create({
            key,
            frames,
            frameRate: stateConfig.frameRate,
            repeat: stateConfig.repeat,
            yoyo: Boolean(stateConfig.yoyo)
          });
          return;
        }

        const { sheetKey, framesPerDirection } = config;
        const rowIndex = this.getDirectionRow(direction);
        const frames = stateConfig.frames.map((frameIndex) => rowIndex * framesPerDirection + frameIndex);

        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(sheetKey, { frames }),
          frameRate: stateConfig.frameRate,
          repeat: stateConfig.repeat,
          yoyo: Boolean(stateConfig.yoyo)
        });
      });
    });
  }

  bindAnimationEvents() {
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (animation, frame) => {
      // 对于基于独立贴图帧（texture key）的动画，不再依赖 spritesheet 的 frame.index 触发帧事件。
      if (typeof this.animConfig?.frameKeyFor === 'function') return;

      if (animation.key.startsWith('player_attack_')) {
        const direction = this.getDirectionFromAnimKey(animation.key);
        const rowIndex = this.getDirectionRow(direction);
        const hitFrame = this.animConfig.states.attack.hitFrame;
        const expectedFrame = rowIndex * this.animConfig.framesPerDirection + hitFrame;
        if (!this.attackFrameFired && frame.index === expectedFrame) {
          this.attackFrameFired = true;
          this.scene.events.emit('playerAttackHit');
          if (this.onAttackHit) {
            this.onAttackHit();
          }
        }
      }

      if (animation.key.startsWith('player_skill_')) {
        const direction = this.getDirectionFromAnimKey(animation.key);
        const rowIndex = this.getDirectionRow(direction);
        const effectFrame = this.animConfig.states.skill.effectFrame;
        const expectedFrame = rowIndex * this.animConfig.framesPerDirection + effectFrame;
        if (!this.skillFrameFired && frame.index === expectedFrame) {
          this.skillFrameFired = true;
          this.scene.events.emit('playerSkillEffect');
          if (this.onSkillEffect) {
            this.onSkillEffect();
          }
        }
      }
    });

    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation) => {
      if (this.actionLock && animation.key.includes(this.actionLock)) {
        this.actionLock = null;
      }
    });
  }

  getAnimKey(state, direction) {
    const resolvedDir = (typeof this.animConfig?.animDirectionFor === 'function')
      ? this.animConfig.animDirectionFor(direction)
      : direction;
    return `player_${state}_${resolvedDir}`;
  }

  getDirectionRow(direction) {
    return this.animConfig.directionRow?.[direction] ?? 0;
  }

  getDirectionFromAnimKey(key) {
    const parts = key.split('_');
    return parts[parts.length - 1] || this.lastDirection;
  }

  playBaseAnimation(state, direction) {
    const key = this.getAnimKey(state, direction);
    this.sprite.anims.play(key, true);
  }

  /**
   * 设置控制键
   */
  setupControls() {
    // WASD 控制
    this.keys = {
      up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    
    // 方向键备用
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    
    // Shift 键慢速移动
    this.shiftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  setAnalogMove(x, y, active = true) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.analogMove.x = Phaser.Math.Clamp(x, -1, 1);
    this.analogMove.y = Phaser.Math.Clamp(y, -1, 1);
    this.analogMoveActive = !!active;
  }

  clearAnalogMove() {
    this.analogMove.x = 0;
    this.analogMove.y = 0;
    this.analogMoveActive = false;
  }

  /**
   * 开始自动射击
   */
  startAutoFire() {
    this.fireTimer = this.scene.time.addEvent({
      delay: this.fireRate,
      callback: () => this.fire(),
      loop: true
    });
  }

  restartAutoFireTimer() {
    if (this.fireTimer) {
      this.fireTimer.remove();
    }
    this.startAutoFire();
  }

  hasImmediateAutoFireTarget() {
    if (!this.isAlive || !this.canFire) return false;

    if (this.weaponType === 'archer_arrow') {
      return !!this.getArcherTargetInRange();
    }

    if (this.weaponType === 'mage_frostbolt') {
      return !!this.getMageTargetInRange();
    }

    if (this.weaponType === 'warlock_poisonnova') {
      return !!this.getWarlockTargetInRange();
    }

    return false;
  }

  /**
   * 发射子弹
   */
  fire() {
    if (!this.isAlive || !this.canFire) return;

    const activeCoreKey = normalizeCoreKey(this.mainCoreKey || this.scene?.registry?.get?.('mainCore') || 'archer');
    const useArcherWindup = this.weaponType === 'archer_arrow' && activeCoreKey === 'archer';
    if (useArcherWindup) {
      if (!this.getArcherTargetInRange()) return;
      this.queueArcherArrowShot();
      return;
    }

    // 战士（次元斩连发）由 GameScene.updateMelee 驱动；此处不直接发射投射物
    if (this.weaponType === 'warrior_melee') {
      this.playAttackAnimation();
      return;
    }

    // 德鲁伊：星落（锁定敌方，无限射程，落点范围伤害）
    if (this.weaponType === 'starfall') {
      this.playAttackAnimation();
      fireStarfall(this);
      return;
    }

    if (this.weaponType === 'archer_arrow') {
      this.playAttackAnimation();
      fireArcherArrow(this);
      return;
    }

    if (this.weaponType === 'paladin_hammer') {
      const didFire = firePaladinHammer(this);
      if (didFire) this.playAttackAnimation();
      return;
    }

    if (this.weaponType === 'warlock_poisonnova') {
      const didFire = fireWarlockPoisonNova(this);
      if (didFire) this.playAttackAnimation();
      return;
    }

    if (this.weaponType === 'mage_frostbolt') {
      if (this.mageDualcaster) {
        fireLaser(this);
        return;
      }
      if (!this.getMageTargetInRange()) return;
      this.queueMageIceBoltShot();
      return;
    }

    const didFire = fireArcherArrow(this);
    if (didFire) {
      this.playAttackAnimation();
    }
  }

  getArcherTargetInRange() {
    const scene = this.scene;
    const boss = scene?.bossManager?.getCurrentBoss?.();
    const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];
    const enemies = [];

    if (boss && boss.isAlive) enemies.push(boss);
    if (Array.isArray(minions) && minions.length > 0) {
      minions.forEach((unit) => {
        if (unit && unit.isAlive) enemies.push(unit);
      });
    }
    if (enemies.length === 0) return null;

    const hp = (typeof this.getHitboxPosition === 'function') ? this.getHitboxPosition() : null;
    const rangeX = (hp && Number.isFinite(hp.x)) ? hp.x : this.x;
    const rangeY = (hp && Number.isFinite(hp.y)) ? hp.y : this.y;
    const acquireRange = Phaser.Math.Clamp(
      Math.round(this.archerArrowRange || this.archerArrowRangeBase || 330),
      200,
      this.archerArrowRangeMax || 420
    );

    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const dx = enemy.x - rangeX;
      const dy = enemy.y - rangeY;
      const d = dx * dx + dy * dy;
      if (d <= acquireRange * acquireRange && d < bestD) {
        best = enemy;
        bestD = d;
      }
    }

    return best;
  }

  getMageTargetInRange() {
    const scene = this.scene;
    const boss = scene?.bossManager?.getCurrentBoss?.();
    const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];
    const enemies = [];

    if (boss && boss.isAlive) enemies.push(boss);
    if (Array.isArray(minions) && minions.length > 0) {
      minions.forEach((unit) => {
        if (unit && unit.isAlive) enemies.push(unit);
      });
    }
    if (enemies.length === 0) return null;

    const hp = (typeof this.getHitboxPosition === 'function') ? this.getHitboxPosition() : null;
    const rangeX = (hp && Number.isFinite(hp.x)) ? hp.x : this.x;
    const rangeY = (hp && Number.isFinite(hp.y)) ? hp.y : this.y;
    const acquireRange = Phaser.Math.Clamp(
      Math.round(this.mageMissileRange || this.mageMissileRangeBase || 280),
      120,
      520
    );

    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const dx = enemy.x - rangeX;
      const dy = enemy.y - rangeY;
      const d = dx * dx + dy * dy;
      if (d > acquireRange * acquireRange) continue;
      if (enemy.isBoss) return enemy;
      if (d < bestD) {
        best = enemy;
        bestD = d;
      }
    }

    return best;
  }

  getWarlockTargetInRange() {
    const scene = this.scene;
    const boss = scene?.bossManager?.getCurrentBoss?.();
    const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];
    const enemies = [];

    if (boss && boss.isAlive) enemies.push(boss);
    if (Array.isArray(minions) && minions.length > 0) {
      minions.forEach((unit) => {
        if (unit && unit.isAlive) enemies.push(unit);
      });
    }
    if (enemies.length === 0) return null;

    const hp = (typeof this.getHitboxPosition === 'function') ? this.getHitboxPosition() : null;
    const rangeX = (hp && Number.isFinite(hp.x)) ? hp.x : this.x;
    const rangeY = (hp && Number.isFinite(hp.y)) ? hp.y : this.y;
    const acquireRange = Phaser.Math.Clamp(
      Math.round(this.warlockRange || this.warlockRangeBase || this.warlockPoisonNovaRadiusBase || 96),
      80,
      520
    );

    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const dx = enemy.x - rangeX;
      const dy = enemy.y - rangeY;
      const d = dx * dx + dy * dy;
      if (d > acquireRange * acquireRange) continue;
      if (d < bestD) {
        best = enemy;
        bestD = d;
      }
    }

    return best;
  }

  getArcherWindupMs() {
    const fromFireRate = Math.round((this.fireRate || this.baseFireRateArcher || 560) * (this.archerAttackWindupRatio || 0.2));
    return Phaser.Math.Clamp(
      fromFireRate,
      this.archerAttackWindupMinMs || 60,
      this.archerAttackWindupMaxMs || 120
    );
  }

  getMageWindupMs() {
    const fromFireRate = Math.round((this.fireRate || this.baseFireRate || 460) * (this.mageAttackWindupRatio || 0.2));
    return Phaser.Math.Clamp(
      fromFireRate,
      this.mageAttackWindupMinMs || 56,
      this.mageAttackWindupMaxMs || 108
    );
  }

  clearArcherChargeEffects() {
    if (this.archerChargeAura) {
      this.archerChargeAura.setVisible(false);
      this.archerChargeAura.setAlpha(0);
      this.archerChargeAura.setScale(1);
      this.archerChargeAura.setStrokeStyle(2, 0xeafff2, 0);
    }
    if (this.archerChargeSpark) {
      this.archerChargeSpark.setVisible(false);
      this.archerChargeSpark.setAlpha(0);
      this.archerChargeSpark.setScale(1, 1);
      this.archerChargeSpark.setStrokeStyle(1, 0x7aff9a, 0);
    }
    if (this.archerReleaseFlash) {
      this.archerReleaseFlash.setVisible(false);
      this.archerReleaseFlash.setAlpha(0);
      this.archerReleaseFlash.setScale(1, 1);
      this.archerReleaseFlash.x = 0;
      this.archerReleaseFlash.y = -this.visualRadius * 0.9;
    }
    if (this.sprite?.clearTint) this.sprite.clearTint();
    if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
  }

  clearMageChargeEffects() {
    if (this.archerChargeAura) {
      this.scene?.tweens?.killTweensOf?.(this.archerChargeAura);
      this.archerChargeAura.setVisible(false);
      this.archerChargeAura.setAlpha(0);
      this.archerChargeAura.setScale(1);
      this.archerChargeAura.setStrokeStyle(2, 0xe9fbff, 0);
    }
    if (this.archerChargeSpark) {
      this.scene?.tweens?.killTweensOf?.(this.archerChargeSpark);
      this.archerChargeSpark.setVisible(false);
      this.archerChargeSpark.setAlpha(0);
      this.archerChargeSpark.setScale(1, 1);
      this.archerChargeSpark.setFillStyle(0xf4ffff, 0);
      this.archerChargeSpark.setStrokeStyle(1, 0x89dfff, 0);
      this.archerChargeSpark.setAngle(0);
      this.archerChargeSpark.x = 0;
      this.archerChargeSpark.y = -this.visualRadius * 0.85;
    }
    if (this.archerReleaseFlash) {
      this.scene?.tweens?.killTweensOf?.(this.archerReleaseFlash);
      this.archerReleaseFlash.setVisible(false);
      this.archerReleaseFlash.setAlpha(0);
      this.archerReleaseFlash.setFillStyle(0xbff6ff, 0);
      this.archerReleaseFlash.setScale(1, 1);
      this.archerReleaseFlash.setAngle(0);
      this.archerReleaseFlash.x = 0;
      this.archerReleaseFlash.y = -this.visualRadius * 0.9;
    }
    this._mageChargeEffectExpireAt = 0;
    if (this.sprite?.clearTint) this.sprite.clearTint();
    if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
  }

  cancelPendingAttackWindups() {
    if (this._archerPendingShots?.size) {
      for (const timer of this._archerPendingShots) {
        try { timer?.remove?.(); } catch (_) { /* ignore */ }
      }
      this._archerPendingShots.clear();
    }
  }

  clearTransientCombatEffects() {
    this.cancelPendingAttackWindups();
    this.clearArcherChargeEffects();
    this.clearMageChargeEffects();
    this.clearFrostNovaEffect();
  }

  playArcherAttackTelegraph(durationMs, fireAngle = -Math.PI / 2) {
    this.clearArcherChargeEffects();
  }

  playArcherShotKick(fireAngle = -Math.PI / 2) {
    if (!this.scene?.sys?.isActive?.() || !this.sprite) return;

    const kickX = -Math.cos(fireAngle) * 4.5;
    const kickY = -Math.sin(fireAngle) * 4.5;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.x = kickX;
    this.sprite.y = kickY;
    if (this.sprite.setAlpha) this.sprite.setAlpha(1);
    this.scene.tweens.add({
      targets: this.sprite,
      x: 0,
      y: 0,
      duration: 90,
      ease: 'Quad.Out',
      onComplete: () => {
        if (this.sprite?.clearTint) this.sprite.clearTint();
        if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
      }
    });

    if (this.archerReleaseFlash) {
      const aimDeg = Phaser.Math.RadToDeg(fireAngle) + 90;
      this.scene.tweens.killTweensOf(this.archerReleaseFlash);
      this.archerReleaseFlash.setVisible(true);
      this.archerReleaseFlash.setAlpha(0.72);
      this.archerReleaseFlash.setAngle(aimDeg);
      this.archerReleaseFlash.setScale(0.72, 1.05);
      this.archerReleaseFlash.x = Math.cos(fireAngle) * 7;
      this.archerReleaseFlash.y = -this.visualRadius * 0.9 + Math.sin(fireAngle) * 7;
      this.scene.tweens.add({
        targets: this.archerReleaseFlash,
        alpha: 0,
        scaleX: 0.18,
        scaleY: 1.6,
        x: Math.cos(fireAngle) * 13,
        y: -this.visualRadius * 0.9 + Math.sin(fireAngle) * 13,
        duration: 80,
        ease: 'Quad.Out',
        onComplete: () => {
          if (!this.archerReleaseFlash) return;
          this.archerReleaseFlash.setVisible(false);
          this.archerReleaseFlash.x = 0;
          this.archerReleaseFlash.y = -this.visualRadius * 0.9;
        }
      });
    }
  }

  playMageAttackTelegraph(durationMs, fireAngle = -Math.PI / 2) {
    this.clearMageChargeEffects();
    if (!this.scene?.sys?.isActive?.()) return;
    this._mageChargeEffectExpireAt = 0;
  }

  playMageShotKick(fireAngle = -Math.PI / 2) {
    if (!this.scene?.sys?.isActive?.() || !this.sprite) return;
    this._mageChargeEffectExpireAt = 0;

    const kickX = -Math.cos(fireAngle) * 3.5;
    const kickY = -Math.sin(fireAngle) * 3.5;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.x = kickX;
    this.sprite.y = kickY;
    if (this.sprite.setAlpha) this.sprite.setAlpha(1);
    this.scene.tweens.add({
      targets: this.sprite,
      x: 0,
      y: 0,
      duration: 78,
      ease: 'Quad.Out',
      onComplete: () => {
        if (this.sprite?.clearTint) this.sprite.clearTint();
        if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
      }
    });
  }

  queueArcherArrowShot() {
    const target = this.getArcherTargetInRange();
    if (!target) return;
    const windupMs = this.getArcherWindupMs();
    const fireAngle = Phaser.Math.Angle.Between(this.x, this.y - this.visualRadius, target.x, target.y);
    this.playArcherAttackTelegraph(windupMs, fireAngle);

    const timer = this.scene.time.delayedCall(windupMs, () => {
      this._archerPendingShots.delete(timer);
      if (!this.scene?.sys?.isActive?.()) return;
      if (!this.isAlive || !this.canFire || this.scene?.isCombatBehaviorPaused?.()) return;

      const didFire = fireArcherArrow(this);
      if (didFire) {
        this.playArcherShotKick(fireAngle);
        this.playAttackAnimation();
      }
    });

    this._archerPendingShots.add(timer);
  }

  queueMageIceBoltShot() {
    const target = this.getMageTargetInRange();
    if (!target) return;

    const windupMs = this.getMageWindupMs();
    const originY = this.y - this.visualRadius * 0.35;
    const initialAngle = Phaser.Math.Angle.Between(this.x, originY, target.x, target.y);
    this.playMageAttackTelegraph(windupMs, initialAngle);

    const timer = this.scene.time.delayedCall(windupMs, () => {
      this._archerPendingShots.delete(timer);
      if (!this.scene?.sys?.isActive?.()) {
        this.clearMageChargeEffects();
        return;
      }
      if (!this.isAlive || !this.canFire || this.scene?.isCombatBehaviorPaused?.()) {
        this.clearMageChargeEffects();
        return;
      }

      const releaseTarget = (target && target.isAlive) ? target : this.getMageTargetInRange();
      if (!releaseTarget) {
        this.clearMageChargeEffects();
        return;
      }

      const releaseAngle = Phaser.Math.Angle.Between(this.x, this.y - this.visualRadius * 0.35, releaseTarget.x, releaseTarget.y);
      const didFire = fireMageIceBolt(this, { target: releaseTarget, fireAngle: releaseAngle });
      if (didFire) {
        this.playMageShotKick(releaseAngle);
        this.playAttackAnimation();
      } else {
        this.clearMageChargeEffects();
      }
    });

    this._archerPendingShots.add(timer);
  }

  /**
   * 创建子弹（支持角度散射）
   * 青绿色玩家子弹，具有粒子尾迹效果
   */
  createBulletAtAngle(angleOffset, isAbsoluteAngle = false, opts = {}) {
    const coreKey = normalizeCoreKey(this.mainCoreKey || this.scene?.registry?.get?.('mainCore') || 'archer');
    const isArcher = coreKey === 'archer';
    const fireAngle = isAbsoluteAngle ? angleOffset : (-Math.PI / 2 + angleOffset);
    // 猎人箭矢：固定亮绿色（短细条形 + 中心荧光）
    const archerCore = 0x30ff52;
    const coreColor = isArcher ? archerCore : getBaseColorForCoreKey(coreKey);
    const accent = isArcher ? 0x68ff78 : lerpColor(coreColor, 0xffffff, 0.42);

    const rangePx = isArcher
      ? Phaser.Math.Clamp((this.archerArrowRange || this.archerArrowRangeBase || 330), 120, this.archerArrowRangeMax || 420)
      : null;
    const maxLifeMs = (isArcher && rangePx != null)
      ? Math.max(220, Math.round((rangePx / Math.max(1, this.bulletSpeed)) * 1000))
      : null;

    const muzzleBaseY = this.y - this.visualRadius * 0.28;
    const muzzleDistance = Math.max(12, this.visualRadius * 0.72);
    const spawnX = Number.isFinite(Number(opts.spawnX))
      ? Number(opts.spawnX)
      : (this.x + Math.cos(fireAngle) * muzzleDistance);
    const spawnY = Number.isFinite(Number(opts.spawnY))
      ? Number(opts.spawnY)
      : (muzzleBaseY + Math.sin(fireAngle) * muzzleDistance);

    // 玩家本体也统一走场景发弹入口，避免武器层关心底层实现。
    const bullet = this.scene.createManagedPlayerBullet(
      spawnX,
      spawnY,
      coreColor,
      {
        radius: isArcher ? 6 : 7,
        speed: this.bulletSpeed,
        damage: Math.max(1, Math.round(this.bulletDamage * this.archerVolleyDamageMult * (isArcher ? (this.archerArrowDamageMult || 1) : 1))),
        angleOffset: angleOffset,
        isAbsoluteAngle: isAbsoluteAngle,
        type: isArcher ? 'arrow' : 'circle',
        arrowLenMult: isArcher ? 2.18 : 1,
        arrowThickMult: isArcher ? 2.28 : 1,
        hasGlow: true,
        hasTrail: true,
        glowRadius: isArcher ? 14 : 11,
        glowColor: isArcher ? 0x38ff5f : coreColor,
        strokeColor: accent,
        trailColor: isArcher ? 0x2fd24f : undefined,
        trailIntervalMs: isArcher ? 28 : undefined,
        trailLifeMs: isArcher ? 210 : undefined,
        trailAlpha: isArcher ? 0.78 : undefined,
        trailScale: isArcher ? 1.08 : undefined,
        trailMode: isArcher ? 'streak' : undefined,
        trailScaleX: isArcher ? 6.2 : undefined,
        trailScaleY: isArcher ? 0.22 : undefined,
        arrowHighlightColor: isArcher ? 0x54ff68 : undefined,
        arrowFeatherColor: isArcher ? 0x25c944 : undefined,
        speedStartMult: isArcher ? 0.32 : undefined,
        speedEndMult: isArcher ? 1.35 : undefined,
        speedRampMs: isArcher ? 240 : undefined,
        homing: this.archerVolleyHoming,
        homingTurn: this.archerVolleyHomingTurn,
        explode: this.archerVolleyExplode,
        skipUpdate: false,
        maxLifeMs,
        tags: [isArcher ? 'player_archer_arrow' : `player_basic_${coreKey}`]
      }
    );

    if (!bullet) return null;

    // 猎人深度专精：弹射
    if (isArcher && (this.archerArrowBounce || 0) > 0) {
      bullet.basicEnh = bullet.basicEnh || {};
      bullet.basicEnh.bounce = Math.max(bullet.basicEnh.bounce || 0, this.archerArrowBounce);
      bullet.canBounce = true;
    }

    // 添加到 this.bullets 用于向后兼容
    this.bullets.push(bullet);

    // 限制引用列表长度（不销毁子弹，避免“射程被动缩短”）
    while (this.bullets.length > this.maxBullets) {
      this.bullets.shift();
    }

    return bullet;
  }

  /**
   * 更新（每帧调用）
   */
  update(time, delta) {
    if (!this.isAlive) return;

    const combatPaused = !!this.scene?.isCombatBehaviorPaused?.();
    const gameplayNow = this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? time ?? 0;

    if ((this._frostNovaEffectExpireAt || 0) > 0 && gameplayNow >= (this._frostNovaEffectExpireAt || 0)) {
      this.clearFrostNovaEffect();
    }
    if ((this._mageChargeEffectExpireAt || 0) > 0 && gameplayNow >= (this._mageChargeEffectExpireAt || 0)) {
      this.clearMageChargeEffects();
    }
    if ((this._mageChargeEffectExpireAt || 0) > 0 && (combatPaused || this.weaponType !== 'mage_frostbolt')) {
      this.clearMageChargeEffects();
    }
    if (this.weaponType !== 'mage_frostbolt' || !this.mageDualcaster) {
      destroyArcaneRay(this);
    }

    this.updateExternalSpeedModifiers(gameplayNow);

    const hasImmediateTarget = this.hasImmediateAutoFireTarget();
    if (!combatPaused && hasImmediateTarget && !this._hadImmediateAutoFireTarget) {
      this.fire();
      this.restartAutoFireTimer();
    }
    this._hadImmediateAutoFireTarget = hasImmediateTarget;

    this.updateEmergencyStatusEffects(time, delta, gameplayNow);
    
    // 更新移动
    this.updateMovement(delta);

    if (combatPaused) {
      if (this.scene?._pathChoiceActive && this.weaponType === 'warlock_poisonnova') {
        fireWarlockPoisonNova(this);
      }
      this.constrainToGameArea();
      return;
    }

    this.updateEmergencyRegen(delta, gameplayNow);
    this.updatePassiveRegen(delta);

    if (this.weaponType === 'warlock_poisonnova' && this._warlockPoisonNovaForceRefresh) {
      this._warlockPoisonNovaForceRefresh = false;
      this.playAttackAnimation();
      fireWarlockPoisonNova(this);
    }

    // 更新子弹
    this.updateBullets(delta);

    if (this.weaponType === 'mage_frostbolt' && this.mageDualcaster) {
      updateArcaneRay(this, delta);
    }
    
    // 限制在游戏区域内
    this.constrainToGameArea();
  }

  /**
   * 更新移动
   */
  updateMovement(delta) {
    if (this.canMove === false) {
      this.moveIntent.set(0, 0);
      this.worldVelocity.set(0, 0);
      this.updateMovementVisuals(0, 0);
      this.updateBaseAnimation(0, 0);
      this.updateArcaneCircle(delta, false);
      return;
    }

    let velocityX = 0;
    let velocityY = 0;

    const useAnalog = !!this.analogMoveActive
      && (Math.abs(this.analogMove.x) > 0.0001 || Math.abs(this.analogMove.y) > 0.0001);

    if (useAnalog) {
      velocityX = this.analogMove.x;
      velocityY = this.analogMove.y;
      const mag = Math.hypot(velocityX, velocityY);
      if (mag > 1) {
        velocityX /= mag;
        velocityY /= mag;
      }
    } else {
    
    // 检测按键
    if (this.keys.left.isDown || this.cursors.left.isDown) {
      velocityX = -1;
    } else if (this.keys.right.isDown || this.cursors.right.isDown) {
      velocityX = 1;
    }
    
    if (this.keys.up.isDown || this.cursors.up.isDown) {
      velocityY = -1;
    } else if (this.keys.down.isDown || this.cursors.down.isDown) {
      velocityY = 1;
    }
    
    // 归一化对角线移动速度
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707; // 1/sqrt(2)
      velocityY *= 0.707;
    }

    }
    
    // Shift 慢速移动
    let currentSpeed = this.moveSpeed;
    if (this.shiftKey.isDown) {
      currentSpeed *= 0.4; // 慢速模式
      this.hitbox.setAlpha(0.8); // 更明显的判定点
    } else {
      this.hitbox.setAlpha(0.3);
    }
    
    this.isMoving = Math.abs(velocityX) > 0.0001 || Math.abs(velocityY) > 0.0001;
    this.moveIntent.set(velocityX, velocityY);
    if (this.isMoving) {
      this.lastMoveIntent.set(velocityX, velocityY);
    }

    // 应用移动
    const step = (delta / 1000);
    const dx = velocityX * currentSpeed * step;
    const dy = velocityY * currentSpeed * step;
    this.worldVelocity.set(step > 0 ? (dx / step) : 0, step > 0 ? (dy / step) : 0);

    const scene = this.scene;
    const canBlock = scene && typeof scene.isWorldPointBlocked === 'function' && scene.mapConfig;
    if (canBlock && (dx !== 0 || dy !== 0)) {
      const nextX = this.x + dx;
      const nextY = this.y + dy;

      // 用“核心判定点”来判断是否进入阻挡格子（偏移略向下，让脚下更贴近）
      const probeOffsetY = Math.max(0, (this.visualRadius || 0) * 0.35);
      const isBlocked = (x, y) => scene.isWorldPointBlocked(x, y + probeOffsetY);

      if (!isBlocked(nextX, nextY)) {
        this.x = nextX;
        this.y = nextY;
      } else {
        // 尝试分轴移动，减少卡墙感
        const canX = dx !== 0 && !isBlocked(nextX, this.y);
        const canY = dy !== 0 && !isBlocked(this.x, nextY);
        if (canX) this.x = nextX;
        if (canY) this.y = nextY;
      }
    } else {
      this.x += dx;
      this.y += dy;
    }

    this.updateDirection(velocityX, velocityY);
    this.updateMovementVisuals(velocityX, velocityY);
    this.updateBaseAnimation(velocityX, velocityY);

    const isMoving = velocityX !== 0 || velocityY !== 0;
    this.updateArcaneCircle(delta, isMoving);
  }

  updateArcaneCircle(delta, isMoving) {
    if (!this.arcaneCircleEnabled || (this.arcaneCircleLevel || 0) <= 0) {
      this.arcaneFlowUntil = 0;
      this.arcaneCircleInsideLastFrame = false;
      this.setArcaneCircleBuffActive(false);
      return;
    }

    const state = this.arcaneCircleState;
    if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.radius)) {
      this.arcaneFlowUntil = 0;
      this.arcaneCircleInsideLastFrame = false;
      this.setArcaneCircleBuffActive(false);
      return;
    }

    const now = this.scene?.time?.now ?? 0;
    const circleActive = (state.endsAt || 0) > now;

    const dx = this.x - state.x;
    const dy = this.y - state.y;
    const inside = (dx * dx + dy * dy) <= (state.radius * state.radius);
    const retainMs = [0, 1200, 2000, 3000][Math.max(0, Math.min(3, this.arcaneFlowcastingLevel || 0))] || 0;

    if (circleActive && !inside && this.arcaneCircleInsideLastFrame && retainMs > 0) {
      this.arcaneFlowUntil = now + retainMs;
    }

    if (inside) {
      this.arcaneFlowUntil = Math.max(this.arcaneFlowUntil || 0, now + 120);
    }

    this.arcaneCircleInsideLastFrame = inside && circleActive;
    const retainActive = (this.arcaneFlowUntil || 0) > now;
    this.setArcaneCircleBuffActive(inside || retainActive);
  }

  setArcaneCircleBuffActive(active) {
    const nextActive = !!active;
    if (this.arcaneCircleBuffActive === nextActive) return;

    this.arcaneCircleBuffActive = nextActive;

    const baseBonus = [0, 0.08, 0.16, 0.24][Math.max(0, Math.min(3, this.arcaneCircleLevel || 0))] || 0;
    const resonanceBonus = [0, 0.06, 0.12, 0.18][Math.max(0, Math.min(3, this.arcaneResonanceMarkLevel || 0))] || 0;
    this.universalDamageMult = nextActive ? (1 + baseBonus + resonanceBonus) : 1;
    this.applyStatMultipliers(this.equipmentMods || {});
  }

  updateDirection(velocityX, velocityY) {
    if (velocityX === 0 && velocityY === 0) return;

    // 8 方向（用于 archer）或 4 方向（兼容旧 player_sheet）
    const dirs = this.animConfig?.directions || PLAYER_ANIM_CONFIG.directions;
    const wants8 = dirs.includes('north-east') || dirs.includes('south-east');
    if (!wants8) {
      if (Math.abs(velocityX) > Math.abs(velocityY)) {
        this.lastDirection = velocityX > 0 ? 'right' : 'left';
      } else {
        this.lastDirection = velocityY > 0 ? 'down' : 'up';
      }
      return;
    }

    // 注意：Phaser 坐标系 y 向下为正
    let deg = Phaser.Math.RadToDeg(Math.atan2(velocityY, velocityX));
    deg = (deg + 360) % 360;
    const sector = Math.round(deg / 45) % 8;
    const map = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    this.lastDirection = map[sector] || 'south';
  }

  updateMovementVisuals(velocityX, velocityY) {
    if (!this.sprite) return;

    const targetTilt = velocityX * 8;
    this.sprite.angle = Phaser.Math.Linear(this.sprite.angle, targetTilt, 0.2);

    const base = (Number.isFinite(this.baseSpriteScale) && this.baseSpriteScale > 0) ? this.baseSpriteScale : 1;
    const squashX = Phaser.Math.Clamp(1 - velocityY * 0.06, 0.92, 1.08);
    const squashY = Phaser.Math.Clamp(1 + velocityY * 0.06, 0.92, 1.08);
    const targetScaleX = base * squashX;
    const targetScaleY = base * squashY;
    this.sprite.scaleX = Phaser.Math.Linear(this.sprite.scaleX, targetScaleX, 0.2);
    this.sprite.scaleY = Phaser.Math.Linear(this.sprite.scaleY, targetScaleY, 0.2);
  }

  updateBaseAnimation(velocityX, velocityY) {
    if (this.actionLock) return;

    const isMoving = velocityX !== 0 || velocityY !== 0;
    const state = isMoving ? 'run' : 'idle';
    this.animState = state;

    if (this.animConfig.useFlipForLeft) {
      // 8 方向时 lastDirection 可能是 west/north-west/...；用 velocityX 决定左右，并在纯上下移动时保持上次朝向。
      if (velocityX < 0) this.sprite.setFlipX(true);
      else if (velocityX > 0) this.sprite.setFlipX(false);
    }

    this.playBaseAnimation(state, this.lastDirection);
  }

  playAttackAnimation() {
    if (this.actionLock) return;

    if (this.animConfig?.disableActionAnimations) {
      // walk-only：不切换动作动画
      return;
    }

    this.actionLock = 'attack';
    this.attackFrameFired = false;
    this.playBaseAnimation('attack', this.lastDirection);
  }

  playSkillAnimation() {
    const cooldown = this.animConfig.states.skill.cooldown || 0;
    const now = this.scene.time.now;
    if (now - this.lastSkillTime < cooldown) return false;

    if (this.animConfig?.disableActionAnimations) {
      this.lastSkillTime = now;
      return true;
    }

    this.actionLock = 'skill';
    this.skillFrameFired = false;
    this.lastSkillTime = now;
    this.playBaseAnimation('skill', this.lastDirection);
    return true;
  }

  triggerSkill() {
    return this.playSkillAnimation();
  }

  playHurtAnimation() {
    if (!this.isAlive) return;

    if (this.animConfig?.disableActionAnimations) {
      return;
    }
    this.actionLock = 'hurt';
    this.playBaseAnimation('hurt', this.lastDirection);
  }

  freezeMovementAnimation() {
    if (!this.sprite) return;

    this.clearAnalogMove?.();
    this.actionLock = null;
    this.animState = 'idle';
    this.updateMovementVisuals(0, 0);
    this.playBaseAnimation('idle', this.lastDirection);
  }

  setAttackCallback(callback) {
    this.onAttackHit = callback;
  }

  setSkillCallback(callback) {
    this.onSkillEffect = callback;
  }

  /**
   * 更新子弹
   */
  updateBullets(delta) {
    // 清理已销毁的子弹（由 BulletManager 管理）
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      if (!bullet || !bullet.active || bullet.markedForRemoval) {
        this.bullets.splice(i, 1);
      }
    }
  }

  /**
   * 限制在游戏区域内
   */
  constrainToGameArea() {
    const worldBounds = this.scene?.worldBoundsRect;
    const gameArea = this.scene?.gameArea;
    const bounds = worldBounds || gameArea;
    if (!bounds) return;

    const margin = (this.visualRadius || 0) + 5;

    const left = bounds.x + margin;
    const right = bounds.x + bounds.width - margin;
    const top = bounds.y + margin;
    const bottom = bounds.y + bounds.height - margin;

    if (this.x < left) this.x = left;
    else if (this.x > right) this.x = right;

    if (this.y < top) this.y = top;
    else if (this.y > bottom) this.y = bottom;

    // Boss 禁入区：玩家无法进入 Boss 判定圈，并保持额外缓冲距离
    const boss = this.scene?.bossManager?.getCurrentBoss?.();
    if (boss && boss.isAlive && boss.active) {
      const padding = this.scene?.bossNoGoPadding ?? 0;
      const bossR = (boss.bossSize || 0) + padding;
      const playerR = (this.visualRadius || 0) + 6;
      const minDist = bossR + playerR;

      const dx = this.x - boss.x;
      const dy = this.y - boss.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0;

      if (dist > 0 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.x = boss.x + nx * minDist;
        this.y = boss.y + ny * minDist;
      }

      // 如果刚好完全重叠（极少数情况），向下推开
      if (dist === 0) {
        this.y = boss.y + minDist;
      }
    }
  }

  /**
   * 受到伤害
   */
  takeDamage(damage) {
    console.log('[takeDamage] 受伤检查 - isAlive:', this.isAlive, 'isInvincible:', this.isInvincible);

    if (this.scene?.isCombatBehaviorPaused?.()) {
      console.log('[takeDamage] 被跳过 - 战斗行为已暂停');
      return false;
    }
    
    if (!this.isAlive || this.isInvincible) {
      console.log('[takeDamage] 被跳过 - 无敌或已死亡');
      return false;
    }

    // 闪避（先于一切减伤结算；基础无 MISS，只有携带/升级提供）
    const gameplayNow = this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0;
    const resolved = resolvePlayerIncomingDamage(this, damage, gameplayNow);
    if (resolved.dodged) {
      this.lastDamageEvent = { dodged: true, blocked: false, shielded: false, tookDamage: 0 };
      if (this.scene?.showDamageNumber) {
        this.scene.showDamageNumber(this.x, this.y - 44, 'MISS', { color: '#ffffff', fontSize: 22 });
      }
      return false;
    }

    let finalDamage = resolved.finalDamage;
    const blocked = !!resolved.blocked;

    const bearGuardLevel = Math.max(0, Math.min(3, Math.round(this.natureBearGuardLevel || 0)));
    const bearGuardPet = bearGuardLevel > 0 ? this.scene?.petManager?.getTankPet?.() : null;
    if (finalDamage > 0 && bearGuardPet?.active && (bearGuardPet.currentHp || 0) > 0) {
      const shareRatio = [0, 0.08, 0.16, 0.24][bearGuardLevel] || 0;
      const sharedDamage = Math.min(
        Math.max(0, Math.round(finalDamage * shareRatio)),
        Math.max(0, Math.round(bearGuardPet.currentHp || 0))
      );
      if (sharedDamage > 0) {
        finalDamage = Math.max(0, finalDamage - sharedDamage);
        bearGuardPet.currentHp = Math.max(0, Math.round((bearGuardPet.currentHp || 0) - sharedDamage));
        if (this.scene?.showDamageNumber) {
          this.scene.showDamageNumber(bearGuardPet.x, bearGuardPet.y - 34, `替${sharedDamage}`, { color: '#caa472', fontSize: 18, whisper: true });
        }
        if ((bearGuardPet.currentHp || 0) <= 0) {
          this.scene?.petManager?.onPetKilled?.(bearGuardPet.petType);
        } else if (bearGuardLevel >= 3) {
          this.scene?.triggerNatureBearGuardQuake?.(bearGuardPet);
        }
      }
    }

    if (this.guardianSacredSealLevel > 0) {
      this.guardianSealMaxStacks = 2 + this.guardianSacredSealLevel;
      this.guardianSealStacks = Math.min(this.guardianSealMaxStacks, (this.guardianSealStacks || 0) + 1);
      this.guardianSealUntil = gameplayNow + 6000;
    }

    this.tryTriggerGuardianLightFortress(finalDamage);

    let barrierAbsorbed = 0;
    if ((this.guardianBarrierHp || 0) > 0 && finalDamage > 0) {
      const absorbed = Math.min(finalDamage, Math.max(0, Math.round(this.guardianBarrierHp || 0)));
      this.guardianBarrierHp = Math.max(0, Math.round((this.guardianBarrierHp || 0) - absorbed));
      finalDamage -= absorbed;
      barrierAbsorbed += absorbed;
      if (absorbed > 0 && this.scene?.showDamageNumber) {
        this.scene.showDamageNumber(this.x, this.y - 60, `盾${absorbed}`, { color: '#9bd7ff', fontSize: 18, whisper: true });
      }
    }

    if (this.guardianHolyRebukeLevel > 0 && this.guardianSealStacks >= this.guardianSealMaxStacks) {
      this.scene?.triggerGuardianHolyRebuke?.({ blocked, source: 'guardian_sacred_seal' });
    }

    const sacredshieldLevel = Math.max(0, Math.min(3, Math.round(this.paladinSacredshield || 0)));
    const divineLevel = Math.max(0, Math.min(3, Math.round(this.paladinDivine || 0)));
    if (sacredshieldLevel > 0 && (blocked || finalDamage > 0 || barrierAbsorbed > 0)) {
      this.scene?.triggerPaladinSacredShield?.({
        blocked,
        incomingDamage: Math.max(0, Math.round(finalDamage + barrierAbsorbed)),
        absorbedDamage: barrierAbsorbed,
        level: sacredshieldLevel
      });
    }
    if (divineLevel > 0 && (blocked || finalDamage > 0)) {
      this.scene?.triggerPaladinDivinePulse?.({
        blocked,
        damage: Math.max(0, Math.round(finalDamage + barrierAbsorbed)),
        level: divineLevel,
        source: 'take_damage'
      });
    }

    if (this.shieldCharges > 0) {
      console.log('[takeDamage] 护盾挡住了伤害');
      this.shieldCharges--;
      this.updateShieldIndicator();
      this.isInvincible = true;
      this.scene.time.delayedCall(200, () => {
        this.isInvincible = false;
      });
      this.lastDamageEvent = { dodged: false, blocked, shielded: true, tookDamage: 0 };
      return false;
    }
    
    this.hp -= finalDamage;

    // 玩家受伤飘字（与敌方伤害数字一致的表现）
    if (finalDamage > 0 && this.scene?.showDamageNumber) {
      this.scene.showDamageNumber(this.x, this.y - 44, finalDamage, { color: '#ffd6a5', fontSize: 22 });
    }

    // 不屈：战吼（受伤时 20% 概率触发）
    if (finalDamage > 0 && this.battlecryEnabled && this.scene?.time) {
      if (Math.random() < 0.2) {
        this.battlecryUntil = (this.scene.time.now || 0) + 3000;
      }
    }

    if (finalDamage > 0 && (this.guardianArmorLevel || 0) > 0 && gameplayNow >= (this.guardianArmorCooldownUntil || 0)) {
      this.guardianArmorCooldownUntil = gameplayNow + 5000;
      const barrier = Math.max(4, Math.round((this.maxHp || 1) * 0.06));
      this.guardianBarrierHp = Math.max(0, Math.round(this.guardianBarrierHp || 0)) + barrier;
      if (this.scene?.showDamageNumber) {
        this.scene.showDamageNumber(this.x, this.y - 74, `甲+${barrier}`, { color: '#c7f0ff', fontSize: 18, whisper: true });
      }
    }

    // 不屈：死斗（低血加速）
    this.updateDeathDuelState();

    // 被动 CD 技能需要在掉血结算当下立即检查，避免跨阈值后一帧才触发。
    if (typeof this.scene?.updateCooldownSkills === 'function') {
      this.scene.updateCooldownSkills(this.scene._gameplayNowMs, { allowAutoTrigger: true });
    }
    
    console.log(`[takeDamage] 玩家受到 ${finalDamage} 点伤害，剩余 HP: ${this.hp}/${this.maxHp}`);
    
    // 更新 UI
    this.scene.events.emit('updatePlayerInfo');
    
    // 受伤闪烁
    this.flashDamage();

    this.playHurtAnimation();
    
    // 进入无敌状态
    this.becomeInvincible();
    
    // 检查死亡（若装备了复活物品，优先自动复活）
    if (this.hp <= 0) {
      const revived = (typeof this.scene?.tryPlayerRevive === 'function') ? this.scene.tryPlayerRevive() : false;
      if (revived) {
        this.scene?.events?.emit?.('updatePlayerInfo');
        this.becomeInvincible();
        this.lastDamageEvent = { dodged: false, blocked, shielded: false, tookDamage: finalDamage, died: false, revived: true };
        return false;
      }

      this.die();
      this.lastDamageEvent = { dodged: false, blocked, shielded: false, tookDamage: finalDamage, died: true };
      return true;
    }

    this.lastDamageEvent = { dodged: false, blocked, shielded: false, tookDamage: finalDamage, died: false };
    
    return false;
  }

  updateDeathDuelState() {
    if (!this.deathDuelEnabled) return;

    const hpPercent = this.maxHp > 0 ? (this.hp / this.maxHp) : 1;
    const next = hpPercent < 0.3 ? 0.75 : 1;
    if ((this.deathDuelFireRateMult || 1) !== next) {
      this.deathDuelFireRateMult = next;
      this.applyStatMultipliers(this.equipmentMods);
    }
  }

  /**
   * 受伤闪烁效果
   */
  flashDamage() {
    if (!this.sprite) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setAlpha(1);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
      }
    });
  }

  /**
   * 进入无敌状态
   */
  becomeInvincible() {
    this.isInvincible = true;
    this.shield.setVisible(true);
    if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
    
    // 护盾闪烁
    this.scene.tweens.add({
      targets: this.shield,
      alpha: { from: 0.3, to: 0.8 },
      duration: 200,
      yoyo: true,
      repeat: Math.floor(this.invincibleTime / 400)
    });
    
    // 无敌时间结束
    this.scene.time.delayedCall(this.invincibleTime, () => {
      this.isInvincible = false;
      this.shield.setVisible(false);
      if (this.sprite?.setAlpha) this.sprite.setAlpha(1);
    });
  }

  playDivineShelterEffect(durationMs = 0) {
    const flash = this.scene.add.circle(this.x, this.y, this.visualRadius + 10, 0xfbbf24, 0.22).setDepth(38);
    const ring = this.scene.add.circle(this.x, this.y, this.visualRadius + 16, 0xfbbf24, 0.08).setDepth(37);
    ring.setStrokeStyle(4, 0xfef3c7, 0.95);

    this.scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy()
    });

    this.scene.tweens.add({
      targets: ring,
      scale: 2.25,
      alpha: 0,
      duration: Math.max(420, Math.min(Number(durationMs) || 0, 900)),
      ease: 'Quart.Out',
      onComplete: () => ring.destroy()
    });
  }

  clearFrostNovaEffect() {
    const effect = this._frostNovaEffect || null;
    if (!effect) return;

    const nodes = Array.isArray(effect.nodes) ? effect.nodes : [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (!node) continue;
      try { this.scene?.tweens?.killTweensOf?.(node); } catch (_) { /* ignore */ }
      try { node.destroy?.(); } catch (_) { /* ignore */ }
    }

    this._frostNovaEffect = null;
    this._frostNovaEffectExpireAt = 0;
  }

  playFrostNovaEffect(radius = 0) {
    const scene = this.scene;
    if (!scene?.add || !scene?.tweens) return;

    this.clearFrostNovaEffect();

    const resolvedRadius = Math.max(this.visualRadius + 26, Math.round(Number(radius) || 0));
    const flash = scene.add.circle(this.x, this.y, this.visualRadius + 12, 0xbfe9ff, 0.34).setDepth(38);
    const ring = scene.add.circle(this.x, this.y, Math.max(18, Math.round(resolvedRadius * 0.18)), 0x7dd3fc, 0.08).setDepth(37);
    ring.setStrokeStyle(5, 0xe0f2fe, 0.96);
    const nodes = [flash, ring];

    scene.tweens.add({
      targets: flash,
      scale: 2.1,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.Out',
      onComplete: () => {
        try { flash.destroy(); } catch (_) { /* ignore */ }
      }
    });

    scene.tweens.add({
      targets: ring,
      scale: resolvedRadius / Math.max(1, ring.radius),
      alpha: 0,
      duration: 340,
      ease: 'Quart.Out',
      onComplete: () => {
        try { ring.destroy(); } catch (_) { /* ignore */ }
      }
    });

    for (let index = 0; index < 10; index++) {
      const angle = (Math.PI * 2 * index) / 10;
      const shard = scene.add.rectangle(this.x, this.y, 8, 22, 0xe0f7ff, 0.90).setDepth(39);
      shard.setStrokeStyle(2, 0x8fdcff, 0.85);
      shard.rotation = angle;
      nodes.push(shard);
      const travel = resolvedRadius * Phaser.Math.FloatBetween(0.72, 0.96);
      scene.tweens.add({
        targets: shard,
        x: this.x + Math.cos(angle) * travel,
        y: this.y + Math.sin(angle) * travel,
        scaleY: 0.35,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.Out',
        onComplete: () => {
          try { shard.destroy(); } catch (_) { /* ignore */ }
        }
      });
    }

    this._frostNovaEffect = { nodes };
    this._frostNovaEffectExpireAt = (this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0) + 520;
  }

  activateEmergencyRegen(healFraction, durationMs) {
    const totalHeal = Math.max(1, Math.round((this.maxHp || 1) * Math.max(0, Number(healFraction) || 0)));
    const totalDurationMs = Math.max(1, Math.round(Number(durationMs) || 0));

    this.emergencyRegenUntil = (this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0) + totalDurationMs;
    this.emergencyRegenPerMs = totalHeal / totalDurationMs;
    this.emergencyRegenRemaining = totalHeal;
    this.emergencyRegenCarry = 0;
    this.regenPerSec = this.passiveRegenPerSec + this.emergencyRegenPerMs * 1000;

    const pulse = this.scene.add.circle(this.x, this.y, this.visualRadius + 10, 0x22c55e, 0.18).setDepth(38);
    pulse.setStrokeStyle(3, 0x86efac, 0.92);
    this.scene.tweens.add({
      targets: pulse,
      scale: 2.2,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.Out',
      onComplete: () => pulse.destroy()
    });
  }

  clearEmergencyRegenState() {
    this.emergencyRegenUntil = 0;
    this.emergencyRegenPerMs = 0;
    this.emergencyRegenRemaining = 0;
    this.emergencyRegenCarry = 0;
    this.regenPerSec = this.passiveRegenPerSec;
  }

  updateEmergencyRegen(delta, gameplayNow) {
    if ((this.emergencyRegenUntil || 0) <= gameplayNow || (this.emergencyRegenRemaining || 0) <= 0 || (this.emergencyRegenPerMs || 0) <= 0) {
      if ((this.emergencyRegenUntil || 0) <= gameplayNow && (this.emergencyRegenRemaining || 0) > 0) {
        const finalHeal = Math.max(0, Math.round(this.emergencyRegenRemaining || 0));
        if (finalHeal > 0) {
          const restored = this.heal(finalHeal);
          if (restored > 0 && this.scene?.showDamageNumber) {
            this.scene.showDamageNumber(this.x, this.y - 52, `+${restored}`, { color: '#86efac', fontSize: 20 });
          }
        }
      }
      this.clearEmergencyRegenState();
      return;
    }

    this.emergencyRegenCarry += Math.max(0, Number(delta) || 0) * this.emergencyRegenPerMs;
    const healAmount = Math.min(this.emergencyRegenRemaining, Math.floor(this.emergencyRegenCarry));
    if (healAmount <= 0) return;

    this.emergencyRegenCarry -= healAmount;
    this.emergencyRegenRemaining -= healAmount;

    const restored = this.heal(healAmount);
    if (restored > 0 && this.scene?.showDamageNumber) {
      this.scene.showDamageNumber(this.x, this.y - 52, `+${restored}`, { color: '#86efac', fontSize: 20 });
    }
  }

  updatePassiveRegen(delta) {
    if (!this.isAlive) return;
    const regenPerSec = Math.max(0, Number(this.passiveRegenPerSec || 0))
      + Math.max(0, Number(this.thirdSpecRegenRatioPerSec || 0)) * Math.max(1, Number(this.maxHp || 0));
    if (regenPerSec <= 0 || this.hp >= this.maxHp) return;
    this.heal(regenPerSec * Math.max(0, Number(delta || 0)) / 1000);
  }

  updateEmergencyStatusEffects(time, delta, gameplayNow) {
    this._emergencyFxAngle += (Math.max(0, Number(delta) || 0) / 1000) * 2.4;

    const divineActive = (this.emergencyMitigationUntil || 0) > gameplayNow;
    if (this.divineShelterAura) {
      this.divineShelterAura.setVisible(divineActive);
      if (divineActive) {
        const pulse = 1 + Math.sin((time || 0) * 0.012) * 0.08;
        this.divineShelterAura.setScale(pulse);
        this.divineShelterAura.setAlpha(0.24 + Math.sin((time || 0) * 0.01) * 0.05);
      }
    }
    if (this.divineShelterSigil) {
      this.divineShelterSigil.setVisible(divineActive);
      if (divineActive) {
        this.divineShelterSigil.rotation = Math.sin((time || 0) * 0.005) * 0.08;
        this.divineShelterSigil.alpha = 0.82 + Math.sin((time || 0) * 0.014) * 0.14;
      }
    }

    const regenActive = (this.emergencyRegenUntil || 0) > gameplayNow && (this.emergencyRegenRemaining || 0) > 0;
    if (this.emergencyRegenAura) {
      this.emergencyRegenAura.setVisible(regenActive);
      if (regenActive) {
        const pulse = 1 + Math.sin((time || 0) * 0.014) * 0.1;
        this.emergencyRegenAura.setScale(pulse);
        this.emergencyRegenAura.setAlpha(0.18 + Math.sin((time || 0) * 0.01) * 0.05);
      }
    }
    if (Array.isArray(this.emergencyRegenOrbs)) {
      const orbitRadius = this.visualRadius + 15;
      this.emergencyRegenOrbs.forEach((orb, index) => {
        if (!orb) return;
        orb.setVisible(regenActive);
        if (!regenActive) return;
        const angle = this._emergencyFxAngle + (Math.PI * 2 * index) / this.emergencyRegenOrbs.length;
        orb.x = Math.cos(angle) * orbitRadius;
        orb.y = Math.sin(angle) * orbitRadius * 0.72;
      });
    }
  }

  /**
   * 治疗
   */
  heal(amount) {
    const scaledAmount = Math.max(0, Math.round((Number(amount) || 0) * (this.healingTakenMultiplier || 1)));
    const beforeHp = this.hp;
    this.hp = Math.min(this.hp + scaledAmount, this.maxHp);
    this.updateDeathDuelState();
    this.scene.events.emit('updatePlayerInfo');
    const restored = Math.max(0, this.hp - beforeHp);
    console.log(`玩家恢复 ${restored} 点生命值，当前 HP: ${this.hp}/${this.maxHp}`);
    return restored;
  }

  applyEmergencyOverhealBarrier(amount) {
    const gameplayNow = this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0;
    if ((this.emergencyOverhealBarrierUntil || 0) <= gameplayNow) return 0;
    const capRatio = Math.max(0, Number(this.emergencyOverhealBarrierCapRatio || 0));
    if (capRatio <= 0) return 0;

    const cap = Math.max(0, Math.round((this.maxHp || 0) * capRatio));
    if (cap <= 0) return 0;

    const current = Math.max(0, Math.round(this.guardianBarrierHp || 0));
    if (current >= cap) return 0;

    const gained = Math.min(Math.max(0, Math.round(amount || 0)), cap - current);
    if (gained <= 0) return 0;

    this.guardianBarrierHp = current + gained;
    this.scene?.events?.emit?.('updatePlayerInfo');
    this.scene?.showDamageNumber?.(this.x, this.y - 72, `骨甲+${gained}`, { color: '#d9f99d', fontSize: 18, whisper: true });
    return gained;
  }

  spendHealth(amount, options = {}) {
    const requested = Math.max(0, Math.round(Number(amount) || 0));
    if (requested <= 0) return 0;

    const minRemaining = Math.max(0, Math.round(Number(options.minRemaining) || 0));
    const beforeHp = Math.max(0, Math.round(this.hp || 0));
    const nextHp = Math.max(minRemaining, beforeHp - requested);
    const spent = Math.max(0, beforeHp - nextHp);
    if (spent <= 0) return 0;

    this.hp = nextHp;
    this.updateDeathDuelState();
    this.scene.events.emit('updatePlayerInfo');

    if (options.showNumber !== false && this.scene?.showDamageNumber) {
      this.scene.showDamageNumber(this.x, this.y - 52, `-${spent}`, {
        color: options.color || '#9aff8f',
        fontSize: options.fontSize || 20,
        whisper: options.whisper !== false
      });
    }

    return spent;
  }

  restoreFullHealth() {
    this.hp = this.maxHp;
    this.updateDeathDuelState();
    this.scene.events.emit('updatePlayerInfo');
    console.log(`玩家生命值已恢复至满状态，当前 HP: ${this.hp}/${this.maxHp}`);
  }

  /**
   * 升级属性
   */
  upgradeFireRate() {
    this.fireRate = Math.max(100, this.fireRate - 20);
    this.fireTimer.delay = this.fireRate;
    console.log(`射速提升！当前射击间隔: ${this.fireRate}ms`);
  }

  upgradeDamage() {
    this.bulletDamage += 10;
    console.log(`攻击力提升！当前伤害: ${this.bulletDamage}`);
  }

  upgradeSpeed() {
    this.moveSpeed += 30;
    console.log(`移动速度提升！当前速度: ${this.moveSpeed}`);
  }

  applyMoveSpeedSlow(percent, durationMs = 0) {
    const pct = Phaser.Math.Clamp(Number(percent || 0), 0, 0.9);
    if (pct <= 0) return;

    const now = this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0;
    const until = now + Math.max(0, Math.round(Number(durationMs || 0)));
    const nextMult = Math.max(0.1, 1 - pct);

    this.controlMoveSpeedMult = Math.min(Number(this.controlMoveSpeedMult || 1), nextMult);
    this._controlMoveSlowUntil = Math.max(Number(this._controlMoveSlowUntil || 0), until);
    this.applyStatMultipliers(this.equipmentMods);
  }

  applyRoot(durationMs = 0) {
    const now = this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0;
    const until = now + Math.max(0, Math.round(Number(durationMs || 0)));
    if (until <= now) return;

    this._controlRootUntil = Math.max(Number(this._controlRootUntil || 0), until);
    this.canMove = false;
  }

  clearMoveSpeedSlow() {
    if (
      Number(this.controlMoveSpeedMult || 1) >= 0.999
      && Number(this._controlMoveSlowUntil || 0) <= 0
      && Number(this._controlRootUntil || 0) <= 0
    ) return;
    this.controlMoveSpeedMult = 1;
    this._controlMoveSlowUntil = 0;
    this._controlRootUntil = 0;
    this.canMove = true;
    this.applyStatMultipliers(this.equipmentMods);
  }

  updateExternalSpeedModifiers(now) {
    const current = Number(now || 0);
    if (Number(this._controlRootUntil || 0) > current) {
      this.canMove = false;
      return;
    }
    if (Number(this._controlRootUntil || 0) > 0) {
      this._controlRootUntil = 0;
      this.canMove = true;
    }
    if (Number(this._controlMoveSlowUntil || 0) > current) return;
    if (Number(this.controlMoveSpeedMult || 1) >= 0.999) return;
    this.clearMoveSpeedSlow();
  }

  /**
   * 应用属性倍率（用于装备加成）
   */
  applyStatMultipliers(mods) {
    // 先把外部传入的装备/道具修正规整化，再统一推导所有战斗属性
    this.equipmentMods = normalizeStatMods(mods);

    const derived = buildPlayerDerivedStats(this, {
      equipmentMods: this.equipmentMods,
      lootMods: this.runLootMods
    });

    // 这些字段会被武器发射、范围提示圈和 DOT 逻辑直接读取，因此统一在这里回写
    const hpRatio = this.maxHp > 0 ? (this.hp / this.maxHp) : 1;
    this.maxHp = derived.maxHp;
    this.hp = Math.max(1, Math.min(this.maxHp, Math.round(this.maxHp * hpRatio)));
    this.bulletDamage = derived.bulletDamage;
    this.fireRate = derived.fireRate;
    this.moveSpeed = derived.moveSpeed;
    this.archerArrowRange = derived.archerArrowRange;
    this.moonfireRange = derived.moonfireRange;
    this.druidStarfallRange = derived.druidStarfallRange;
    this.mageMissileRange = derived.mageMissileRange;
    this.warriorRange = derived.warriorRange;
    this.warlockPoisonNovaRadius = derived.warlockPoisonNovaRadius;
    this.warlockRange = derived.warlockRange;

    if (this.scene?.meleeEnabled) {
      this.scene.meleeRange = derived.warriorRange;
    }

    if (this.fireTimer) {
      this.fireTimer.delay = this.fireRate;
    }
  }

  /**
   * 切换武器类型
   */
  setWeapon(type) {
    if (this.weaponType === 'laser' && type !== 'laser') {
      destroyArcaneRay(this);
    }
    this.clearTransientCombatEffects();
    this.weaponType = type;
    console.log(`武器切换为: ${this.weaponType}`);
  }

  /**
   * 应用装备效果
   */
  applyEquipmentEffects(effects) {
    // 非派生型数值（暴击、吸血、护盾、闪避）仍然统一从规范化结果回写
    const resolved = normalizeStatMods(effects);
    this.critChance = this.baseCritChance
      + resolved.critChance
      + Math.max(0, Number(this.thirdSpecCritChanceBonus || 0));
    this.critMultiplier = this.baseCritMultiplier + resolved.critMultiplier;
    this.lifestealPercent = resolved.lifestealPercent;
    this.magnetRadius = this.baseMagnetRadius + resolved.magnetRadius;
    this.shieldCharges = resolved.shieldCharges;
    this.equipmentDodgeChance = resolved.dodgeChance + Math.max(0, Number(this.thirdSpecDodgeChanceBonus || 0));
    this.dodgePercent = this.equipmentDodgeChance;
    this.damageReductionPercent = resolved.damageReductionPercent + Math.max(0, Number(this.thirdSpecDamageReductionBonus || 0));
    this.blockChance = resolved.blockChance + Math.max(0, Number(this.thirdSpecBlockChanceBonus || 0));
    this.passiveRegenPerSec = resolved.regenPerSec;
    this.regenPerSec = this.passiveRegenPerSec + (((this.emergencyRegenPerMs || 0) > 0) ? this.emergencyRegenPerMs * 1000 : 0);
    this.updateShieldIndicator();
  }

  /**
   * 启用散射流派
   */
  enableArcherBuild() {
    this.archerEnabled = true;
    this.weaponType = 'archer_arrow';
    this.baseFireRate = this.baseFireRateArcher;
    this.archerVolleyDamageMult = 0.64;
    this.archerVolleyCount = 3;
    this.archerVolleySpread = Phaser.Math.DegToRad(8.6);
    this.archerVolleyLockAim = true;
    this.archerVolleyLockTurn = Phaser.Math.DegToRad(300);
    // 箭矢需要更快的弹速与明确射程
    this.bulletSpeed = 720;
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeArcherRange() {
    this.archerArrowRangeLevel = 3;
    // 射程不再直接写当前值，改为走统一派生，避免被后续装备/掉落重算覆盖
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeArcherRate() {
    this.archerArrowRateLevel = Math.min(3, (this.archerArrowRateLevel || 0) + 1);
    // 每级约 -8% 间隔（不做夸张值）
    this.buildFireRateMult = Math.max(0.72, (this.buildFireRateMult || 1) * 0.92);
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeArcherDamage() {
    this.archerArrowDamageLevel = Math.min(3, (this.archerArrowDamageLevel || 0) + 1);
    // 每级 +15% 基础技能伤害
    this.archerArrowDamageMult = 1 + 0.15 * (this.archerArrowDamageLevel || 0);
  }

  upgradeArcherVolley() {

    this.archerArrowScatterLevel = Math.min(3, (this.archerArrowScatterLevel || 0) + 1);
    // 基础：3 列；L1: 5 列；L2: 7 列；L3: 9 列。
    if (this.archerArrowScatterLevel === 1) {
      this.archerVolleyCount = 5;
      this.archerVolleySpread = Phaser.Math.DegToRad(5.6);
    } else if (this.archerArrowScatterLevel === 2) {
      this.archerVolleyCount = 7;
      this.archerVolleySpread = Phaser.Math.DegToRad(4.7);
      this.archerVolleyLockTurn = Phaser.Math.DegToRad(420);
    } else {
      this.archerVolleyCount = 9;
      this.archerVolleySpread = Phaser.Math.DegToRad(4.0);
      this.archerVolleyLockTurn = Phaser.Math.DegToRad(540);
    }
  }

  setMainCoreAttack(coreKey) {
    coreKey = normalizeCoreKey(coreKey);
    if (this.weaponType === 'laser' && coreKey !== 'mage') {
      destroyArcaneRay(this);
    }
    this.mainCoreKey = coreKey;
    this.offCoreKey = this.offCoreKey || null;

    // 主职业锁定普攻形态
    if (coreKey === 'warrior') {
      // 战士主普攻：近战月牙斩（在 GameScene.updateMelee 里统一渲染/结算）
      this.weaponType = 'warrior_melee';
      this.baseFireRate = 999999;
    } else if (coreKey === 'paladin') {
      // 圣骑主普攻：重锤砸地（近身 AoE，不空挥）
      this.weaponType = 'paladin_hammer';
      this.baseFireRate = 1160;
    } else if (coreKey === 'archer') {
      // 猎人
      this.enableArcherBuild();
    } else if (coreKey === 'mage') {
      // 法师主普攻：单发冰弹
      this.weaponType = 'mage_frostbolt';
      this.baseFireRate = 460;
    } else if (coreKey === 'druid') {
      // 德鲁伊主普攻：星落
      this.weaponType = 'starfall';
      this.baseFireRate = this.baseFireRateMoonfire;
    } else if (coreKey === 'warlock') {
      // 术士主普攻：腐疫沼弹（慢速投掷，落地生成毒沼）
      this.weaponType = 'warlock_poisonnova';
      this.baseFireRate = 2000;
    }

    this.buildFireRateMult = 1;
    this.offFireRateMult = getOffCorePassive(this.mainCoreKey, this.offCoreKey).fireRateMult || 1;
    this.applyStatMultipliers(this.equipmentMods);
  }

  setOffCore(coreKey) {
    this.offCoreKey = normalizeCoreKey(coreKey);
    this.offFireRateMult = getOffCorePassive(this.mainCoreKey, this.offCoreKey).fireRateMult || 1;
    this.applyStatMultipliers(this.equipmentMods);
  }

  disableArcherBuild() {
    this.archerEnabled = false;
    this.archerVolleyMode = 'fan';
  }

  disableLaserBuild() {
    if (this.weaponType === 'laser') {
      destroyArcaneRay(this);
      this.weaponType = 'archer_arrow';
    }
  }

  /**
   * 散射范围提升
   */
  upgradeArcherVolleySpread() {
    this.archerVolleySpread = Math.max(Phaser.Math.DegToRad(4.8), this.archerVolleySpread - Phaser.Math.DegToRad(0.85));
  }

  /**
   * 散射频率提升
   */
  upgradeArcherVolleyRate() {
    this.buildFireRateMult = Math.max(0.7, this.buildFireRateMult * 0.92);
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeArcherVolleyCount() {
    if (this.archerVolleyCount <= 3) {
      this.archerVolleyCount = 5;
    } else if (this.archerVolleyCount <= 5) {
      this.archerVolleyCount = 7;
    } else {
      this.archerVolleyCount = 9;
    }
  }

  enableArcherVolleyRing() {
    this.archerVolleyMode = 'ring';
    this.archerVolleyRingCount = Math.min(20, this.archerVolleyRingCount + 2);
  }

  enableArcherVolleyHoming() {
    this.archerVolleyHoming = true;
  }

  enableArcherVolleyExplode() {
    this.archerVolleyExplode = true;
  }

  /**
   * 计算暴击伤害
   */
  calculateDamage(baseDamage) {
    // 兼容旧调用方：直接复用统一出伤公式，但不带目标承伤修正
    return calculateResolvedDamage({
      attacker: this,
      baseDamage,
      canCrit: true,
      includeTargetModifiers: false
    });
  }

  /**
   * 造成伤害后的吸血
   */
  onDealDamage(amount) {
    const gameplayNow = this.scene?._gameplayNowMs ?? this.scene?.time?.now ?? 0;
    const emergencyLifesteal = (this.emergencyLifestealUntil || 0) > gameplayNow
      ? (this.emergencyLifestealPercent || 0)
      : 0;
    const lifestealPercent = Math.max(0, (this.lifestealPercent || 0) + emergencyLifesteal);
    if (lifestealPercent <= 0) return;
    const healAmount = Math.floor(amount * lifestealPercent);
    if (healAmount > 0) {
      const restored = this.heal(healAmount);
      const overheal = Math.max(0, healAmount - restored);
      if (overheal > 0) {
        this.applyEmergencyOverhealBarrier(overheal);
      }
    }
  }

  onUndeadSummonDeath() {
    if ((this.curseEmberEchoLevel || 0) <= 0 || !this.scene?.time) return;

    const addStacks = [0, 1, 1, 2][Math.max(0, Math.min(3, this.curseEmberEchoLevel || 0))] || 0;
    const maxStacks = [0, 3, 5, 6][Math.max(0, Math.min(3, this.curseEmberEchoLevel || 0))] || 0;
    this.curseEmberStacks = Math.min(maxStacks, (this.curseEmberStacks || 0) + addStacks);
    this.curseEmberUntil = (this.scene.time.now || 0) + 6000;
  }

  tryTriggerGuardianLightFortress(incomingDamage = 0) {
    if ((this.guardianLightFortressLevel || 0) <= 0) return 0;
    if ((this.guardianSealStacks || 0) <= 0) return 0;
    if ((this.guardianBarrierHp || 0) > 0) return 0;

    const predictedHp = Math.max(0, (this.hp || 0) - Math.max(0, Number(incomingDamage || 0)));
    if (predictedHp > (this.maxHp || 1) * 0.3) return 0;

    const perSealRatio = [0, 0.04, 0.06, 0.08][Math.max(0, Math.min(3, this.guardianLightFortressLevel || 0))] || 0;
    const barrier = Math.max(0, Math.round((this.maxHp || 1) * perSealRatio * (this.guardianSealStacks || 0)));
    if (barrier <= 0) return 0;

    this.guardianBarrierHp = barrier;
    this.guardianSealStacks = 0;
    this.guardianSealUntil = 0;

    if (this.scene?.showDamageNumber) {
      this.scene.showDamageNumber(this.x, this.y - 68, `护盾+${barrier}`, { color: '#b8f2ff', fontSize: 18, whisper: true });
    }

    return barrier;
  }

  /**
   * 获取拾取半径
   */
  getPickupRadius() {
    return this.magnetRadius;
  }

  updateShieldIndicator() {
    if (!this.shieldIndicator) return;
    this.shieldIndicator.setVisible(this.shieldCharges > 0);
  }

  /**
   * 获取所有活跃的子弹
   */
  getBullets() {
    return this.bullets.filter(b => b && b.active);
  }

  /**
   * 获取核心判定位置（用于碰撞检测）
   */
  getHitboxPosition() {
    return {
      x: this.x,
      y: this.y,
      radius: this.hitboxRadius
    };
  }

  /**
   * 玩家死亡
   */
  die() {
    if (!this.isAlive) return;
    
    this.isAlive = false;
    this.canFire = false;
    this.clearAnalogMove?.();
    console.log('玩家被击败！');
    
    // 停止射击
    if (this.fireTimer) {
      this.fireTimer.remove();
    }
    this.clearTransientCombatEffects();

    // 终止持续类技能表现（例如法师奥术射线）
    try { destroyArcaneRay(this); } catch (_) { /* ignore */ }
    
    // 死亡动画
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0,
      angle: 360,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        this.scene.events.emit('playerDied');
      }
    });
    
    // 爆炸效果
    this.createExplosion();
  }

  /**
   * 创建爆炸效果
   */
  createExplosion() {
    for (let i = 0; i < 15; i++) {
      const particle = this.scene.add.circle(this.x, this.y, 4, 0x00ff00);
      const angle = (Math.PI * 2 * i) / 15;
      const speed = Phaser.Math.Between(100, 200);
      
      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 800,
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * 清理
   */
  destroy() {
    this.clearEmergencyRegenState();
    if (this.fireTimer) {
      this.fireTimer.remove();
    }
    this.clearTransientCombatEffects();
    
    // 清理所有子弹
    this.bullets.forEach(bullet => {
      if (bullet && bullet.active) {
        bullet.destroy();
      }
    });
    this.bullets = [];
    
    super.destroy();
  }
}
