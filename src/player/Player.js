import Phaser from 'phaser';
import {
  fireLaser,
  updateArcaneRay,
  destroyArcaneRay,
  fireMoonfire,
  fireStarfall,
  fireScatter,
  fireWarriorWave,
  fireArcherArrow,
  fireMageMissile,
  firePaladinSpear,
  firePaladinHammer,
  fireWarlockShadow,
  fireWarlockPoisonNova
} from '../classes/attacks/weapons';

import { getOffCorePassive } from '../classes/attacks/basicAttackMods';
import { getBaseColorForCoreKey, lerpColor } from '../classes/visual/basicSkillColors';

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
    this.maxHp = 100;
    this.isAlive = true;
    this.isInvincible = false; // 受伤后短暂无敌
    this.invincibleTime = 1500; // 无敌时长（毫秒）- 增加到1.5秒以避免持续扣血
    this.shieldCharges = 0;
    
    // 移动属性
    this.baseMoveSpeed = 250;
    this.moveSpeed = this.baseMoveSpeed; // 移动速度
    this.hitboxRadius = 8; // 核心判定半径（小型圆形）
    this.visualRadius = 15; // 视觉大小

    // 移动输入：可由 Scene 注入（移动端隐藏摇杆等）
    this.analogMoveActive = false;
    this.analogMove = { x: 0, y: 0 };
    
    // 射击属性
    this.baseFireRate = 240;
    // 猎人基础射击：不追求夸张频率（避免夸张 DPS）
    this.baseFireRateScatter = 320;
    this.baseFireRateMoonfire = 460;
    this.fireRate = this.baseFireRate; // 射击间隔（毫秒）
    this.bulletSpeed = 380; // 子弹速度
    this.baseBulletDamage = 34;
    this.bulletDamage = this.baseBulletDamage; // 子弹伤害
    this.canFire = true;
    this.weaponType = 'scatter'; // scatter | laser | moonfire

    // 双职业：主职业决定普攻形态；副职业只提供强化
    this.mainCoreKey = null;
    this.offCoreKey = null;
    this.offFireRateMult = 1;
    this.laserDamageMult = 2;

    // 圣骑：制裁（眩晕）
    this.paladinStunLevel = 0;
    this.paladinStunChance = 0;

    // 通用被动（副职业派系）
    this.universalFireRateMult = 1;
    this.universalDamageMult = 1;
    this.dodgeChance = 0;
    this.equipmentDodgeChance = 0;
    this.blockChance = 0;
    this.flatDamageReduction = 0;
    this.counterOnBlock = false;

    // 物品（消耗品）冷却
    // 约定：itemId -> cooldownUntilGameplayMs（可暂停的局内时钟）
    this.itemCooldowns = Object.create(null);

    // 奥术：法阵（站立不动 2 秒后启用）
    this.arcaneCircleEnabled = false;
    this._arcaneStillMs = 0;
    this.arcaneCircleActive = false;

    // 不屈：战吼（受伤触发临时增伤）
    this.battlecryEnabled = false;
    this.battlecryUntil = 0;

    // 不屈：死斗（低血加速）
    this.deathDuelEnabled = false;
    this.deathDuelFireRateMult = 1;

    // 德鲁伊（月火术）
    this.moonfireDamageMult = 0.35;
    this.moonfireSpeedMult = 0.6; // 比常规更慢
    this.moonfireGravity = 0;
    // 亲和吸附：轻微拐弯（不要像追踪弹）
    this.moonfireAffinityConeDeg = 55;
    this.moonfireAffinityTurnDegPerSec = 28;

    // Build 流派属性（散射）
    this.scatterEnabled = true;
    // 猎人基础：默认单列
    this.scatterSpread = 0;
    this.scatterBulletCount = 1;
    this.scatterMode = 'fan'; // fan | ring
    this.scatterRingCount = 10;
    // 多列会天然放大输出，因此单箭倍率略低，靠升级补
    this.scatterDamageMult = 0.55;
    this.scatterHoming = false;
    this.scatterHomingTurn = 0.04;
    this.scatterExplode = false;
    this.buildFireRateMult = 1;

    // 猎人基础技能（箭矢）专属升级参数
    this.archerArrowRangeBase = 680; // 中长距离
    this.archerArrowRange = this.archerArrowRangeBase;
    this.archerArrowDamageMult = 1;
    this.archerArrowRangeLevel = 0;
    this.archerArrowRateLevel = 0;
    this.archerArrowDamageLevel = 0;
    this.archerArrowScatterLevel = 0;
    this.archerArrowBounce = 0;

    // 装备倍率缓存
    this.equipmentMods = { damageMult: 1, fireRateMult: 1, speedMult: 1 };

    // 局内战利品（碎片等）倍率缓存：一次性，本局结束清空；不进入装备系统
    this.runLootMods = { damageMult: 1, fireRateMult: 1, speedMult: 1 };

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

    // 动画状态
    this.animConfig = PLAYER_ANIM_CONFIG;
    this.animState = 'idle';
    this.actionLock = null;
    this.lastDirection = 'down';
    this.attackFrameFired = false;
    this.skillFrameFired = false;
    this.lastSkillTime = 0;
    this.onAttackHit = null;
    this.onSkillEffect = null;
    
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

    this.sprite = this.scene.add.sprite(0, 0, this.animConfig.sheetKey, 0);
    this.sprite.isPlayer = true;
    this.sprite.setOrigin(0.5, 0.5);
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

    this.bindAnimationEvents();
    this.playBaseAnimation('idle', this.lastDirection);
  }

  ensureAnimations() {
    const { sheetKey, directions, states, framesPerDirection } = this.animConfig || PLAYER_ANIM_CONFIG;
    directions.forEach((direction) => {
      const rowIndex = this.getDirectionRow(direction);
      Object.entries(states).forEach(([stateName, config]) => {
        const key = this.getAnimKey(stateName, direction);
        if (this.scene.anims.exists(key)) return;

        const frames = config.frames.map((frameIndex) => rowIndex * framesPerDirection + frameIndex);

        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(sheetKey, { frames }),
          frameRate: config.frameRate,
          repeat: config.repeat,
          yoyo: Boolean(config.yoyo)
        });
      });
    });
  }

  bindAnimationEvents() {
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (animation, frame) => {
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
    return `player_${state}_${direction}`;
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

  /**
   * 发射子弹
   */
  fire() {
    if (!this.isAlive || !this.canFire) return;

    // 战士（月牙斩近战）由 GameScene.updateMelee 驱动；此处不发射投射物
    if (this.weaponType === 'warrior_melee') {
      this.playAttackAnimation();
      return;
    }

    // 月火术：自动逐发（无需按住鼠标；按住时可用鼠标引导方向）
    if (this.weaponType === 'moonfire') {
      const pointer = this.scene?.input?.activePointer;
      this.playAttackAnimation();
      fireMoonfire(this, pointer);
      return;
    }

    // 德鲁伊：星落（锁定敌方，无限射程，落点范围伤害）
    if (this.weaponType === 'starfall') {
      this.playAttackAnimation();
      fireStarfall(this);
      return;
    }

    if (this.weaponType === 'warrior_wave') {
      this.playAttackAnimation();
      fireWarriorWave(this);
      return;
    }

    if (this.weaponType === 'archer_arrow') {
      this.playAttackAnimation();
      fireArcherArrow(this);
      return;
    }

    if (this.weaponType === 'mage_missile') {
      this.playAttackAnimation();
      fireMageMissile(this);
      return;
    }

    if (this.weaponType === 'paladin_spear') {
      this.playAttackAnimation();
      firePaladinSpear(this);
      return;
    }

    if (this.weaponType === 'paladin_hammer') {
      const didFire = firePaladinHammer(this);
      if (didFire) this.playAttackAnimation();
      return;
    }

    if (this.weaponType === 'warlock_shadow') {
      this.playAttackAnimation();
      fireWarlockShadow(this);
      return;
    }

    if (this.weaponType === 'warlock_poisonnova') {
      this.playAttackAnimation();
      fireWarlockPoisonNova(this);
      return;
    }

    if (this.weaponType === 'laser') {
      fireLaser(this);
      return;
    }

    const didFire = fireScatter(this);
    if (didFire) {
      this.playAttackAnimation();
    }
  }

  /**
   * 创建子弹（支持角度散射）
   * 青绿色玩家子弹，具有粒子尾迹效果
   */
  createBulletAtAngle(angleOffset, isAbsoluteAngle = false) {
    const coreKey = this.mainCoreKey || this.scene?.registry?.get?.('mainCore') || 'scatter';
    const isArcher = coreKey === 'scatter';
    // 猎人箭矢：固定荧光色（00ffff）
    const coreColor = isArcher ? 0x00ffff : getBaseColorForCoreKey(coreKey);
    const accent = isArcher ? 0x00ffff : lerpColor(coreColor, 0xffffff, 0.42);

    const rangePx = isArcher ? (this.archerArrowRange || this.archerArrowRangeBase || 680) : null;
    const maxLifeMs = (isArcher && rangePx != null)
      ? Math.max(220, Math.round((rangePx / Math.max(1, this.bulletSpeed)) * 1000))
      : null;

    // 通过 BulletManager 创建子弹
    const bullet = this.scene.bulletManager.createPlayerBullet(
      this.x,
      this.y - this.visualRadius,
      coreColor,
      {
        radius: 5,
        speed: this.bulletSpeed,
        damage: Math.max(1, Math.round(this.bulletDamage * this.scatterDamageMult * (isArcher ? (this.archerArrowDamageMult || 1) : 1))),
        angleOffset: angleOffset,
        isAbsoluteAngle: isAbsoluteAngle,
        type: isArcher ? 'arrow' : 'circle',
        hasGlow: true,
        hasTrail: true,
        glowRadius: 9,
        glowColor: coreColor,
        strokeColor: accent,
        homing: this.scatterHoming,
        homingTurn: this.scatterHomingTurn,
        explode: this.scatterExplode,
        skipUpdate: false,
        maxLifeMs
      }
    );

    // 猎人深度专精：弹射
    if (isArcher && (this.archerArrowBounce || 0) > 0 && bullet) {
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
    
    // 更新移动
    this.updateMovement(delta);

    // 法师主普攻：奥术射线（持续连线光束）
    if (this.weaponType === 'laser') {
      updateArcaneRay(this, delta);
    }
    
    // 更新子弹
    this.updateBullets(delta);
    
    // 限制在游戏区域内
    this.constrainToGameArea();
  }

  /**
   * 更新移动
   */
  updateMovement(delta) {
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
    
    // 应用移动
    this.x += velocityX * currentSpeed * (delta / 1000);
    this.y += velocityY * currentSpeed * (delta / 1000);

    this.updateDirection(velocityX, velocityY);
    this.updateMovementVisuals(velocityX, velocityY);
    this.updateBaseAnimation(velocityX, velocityY);

    const isMoving = velocityX !== 0 || velocityY !== 0;
    this.updateArcaneCircle(delta, isMoving);
  }

  updateArcaneCircle(delta, isMoving) {
    if (!this.arcaneCircleEnabled) return;

    if (isMoving) {
      this._arcaneStillMs = 0;
      if (this.arcaneCircleActive) {
        this.arcaneCircleActive = false;
        this.universalDamageMult = 1;
        this.applyStatMultipliers(this.equipmentMods);
      }
      return;
    }

    this._arcaneStillMs = (this._arcaneStillMs || 0) + delta;
    if (!this.arcaneCircleActive && this._arcaneStillMs >= 2000) {
      this.arcaneCircleActive = true;
      this.universalDamageMult = 1.2;
      this.applyStatMultipliers(this.equipmentMods);
    }
  }

  updateDirection(velocityX, velocityY) {
    if (velocityX === 0 && velocityY === 0) return;

    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      this.lastDirection = velocityX > 0 ? 'right' : 'left';
    } else {
      this.lastDirection = velocityY > 0 ? 'down' : 'up';
    }
  }

  updateMovementVisuals(velocityX, velocityY) {
    if (!this.sprite) return;

    const targetTilt = velocityX * 8;
    this.sprite.angle = Phaser.Math.Linear(this.sprite.angle, targetTilt, 0.2);

    const targetScaleX = Phaser.Math.Clamp(1 - velocityY * 0.06, 0.92, 1.08);
    const targetScaleY = Phaser.Math.Clamp(1 + velocityY * 0.06, 0.92, 1.08);
    this.sprite.scaleX = Phaser.Math.Linear(this.sprite.scaleX, targetScaleX, 0.2);
    this.sprite.scaleY = Phaser.Math.Linear(this.sprite.scaleY, targetScaleY, 0.2);
  }

  updateBaseAnimation(velocityX, velocityY) {
    if (this.actionLock) return;

    const isMoving = velocityX !== 0 || velocityY !== 0;
    const state = isMoving ? 'run' : 'idle';
    this.animState = state;

    if (this.lastDirection === 'left' && this.animConfig.useFlipForLeft) {
      this.sprite.setFlipX(true);
    } else if (this.lastDirection !== 'left') {
      this.sprite.setFlipX(false);
    }

    this.playBaseAnimation(state, this.lastDirection);
  }

  playAttackAnimation() {
    if (this.actionLock) return;

    this.actionLock = 'attack';
    this.attackFrameFired = false;
    this.playBaseAnimation('attack', this.lastDirection);
  }

  playSkillAnimation() {
    const cooldown = this.animConfig.states.skill.cooldown || 0;
    const now = this.scene.time.now;
    if (now - this.lastSkillTime < cooldown) return false;

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
    this.actionLock = 'hurt';
    this.playBaseAnimation('hurt', this.lastDirection);
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
      const padding = this.scene?.bossNoGoPadding ?? 60;
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
    
    if (!this.isAlive || this.isInvincible) {
      console.log('[takeDamage] 被跳过 - 无敌或已死亡');
      return false;
    }

    // 闪避（先于一切减伤结算；基础无 MISS，只有携带/升级提供）
    const dodgeChanceTotal = Math.max(0, (this.dodgeChance || 0) + (this.equipmentDodgeChance || 0));
    if (dodgeChanceTotal > 0 && Math.random() < dodgeChanceTotal) {
      this.lastDamageEvent = { dodged: true, blocked: false, shielded: false, tookDamage: 0 };
      if (this.scene?.showDamageNumber) {
        this.scene.showDamageNumber(this.x, this.y - 44, 'MISS', { color: '#ffffff', fontSize: 22 });
      }
      return false;
    }

    // 固定减伤
    let finalDamage = Math.max(0, Math.round((damage || 0) - (this.flatDamageReduction || 0)));

    // 自然伙伴：甲壳/树皮等（受击倍率）
    finalDamage = Math.max(0, Math.round(finalDamage * (this.natureDamageTakenMult || 1)));

    // 战士主职业持久：20% 减伤
    if (this.warriorEndure && this.mainCoreKey === 'warrior') {
      finalDamage = Math.max(0, Math.round(finalDamage * 0.8));
    }

    // 格挡：50% 减伤
    let blocked = false;
    if ((this.blockChance || 0) > 0 && Math.random() < this.blockChance) {
      blocked = true;
      finalDamage = Math.max(0, Math.round(finalDamage * 0.5));
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

    // 不屈：死斗（低血加速）
    this.updateDeathDuelState();
    
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
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 2
    });
  }

  /**
   * 进入无敌状态
   */
  becomeInvincible() {
    this.isInvincible = true;
    this.shield.setVisible(true);
    
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
    });
  }

  /**
   * 治疗
   */
  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this.scene.events.emit('updatePlayerInfo');
    console.log(`玩家恢复 ${amount} 点生命值，当前 HP: ${this.hp}/${this.maxHp}`);
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

  /**
   * 应用属性倍率（用于装备加成）
   */
  applyStatMultipliers(mods) {
    const damageMult = mods.damageMult || 1;
    const fireRateMult = mods.fireRateMult || 1;
    const speedMult = mods.speedMult || 1;

    this.equipmentMods = { damageMult, fireRateMult, speedMult };

    const lootDamageMult = this.runLootMods?.damageMult || 1;
    const lootFireRateMult = this.runLootMods?.fireRateMult || 1;
    const lootSpeedMult = this.runLootMods?.speedMult || 1;

    const extraDamageMult = (this.universalDamageMult || 1) * (this.natureDamageMult || 1);
    const extraFireRateMult = (this.universalFireRateMult || 1) * (this.deathDuelFireRateMult || 1);

    this.bulletDamage = Math.max(1, Math.round(this.baseBulletDamage * damageMult * lootDamageMult * extraDamageMult));
    this.fireRate = Math.max(60, Math.round(this.baseFireRate * fireRateMult * lootFireRateMult * this.buildFireRateMult * (this.offFireRateMult || 1) * extraFireRateMult));
    this.moveSpeed = Math.max(50, Math.round(this.baseMoveSpeed * speedMult * lootSpeedMult * (this.natureMoveSpeedMult || 1)));

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
    this.weaponType = type;
    console.log(`武器切换为: ${this.weaponType}`);
  }

  /**
   * 应用装备效果
   */
  applyEquipmentEffects(effects) {
    this.critChance = this.baseCritChance + (effects.critChance || 0);
    this.critMultiplier = this.baseCritMultiplier + (effects.critMultiplier || 0);
    this.lifestealPercent = effects.lifestealPercent || 0;
    this.magnetRadius = this.baseMagnetRadius + (effects.magnetRadius || 0);
    this.shieldCharges = effects.shieldCharges || 0;
    this.equipmentDodgeChance = effects.dodgeChance || 0;
    this.updateShieldIndicator();
  }

  /**
   * 启用散射流派
   */
  enableScatterBuild() {
    this.scatterEnabled = true;
    this.weaponType = 'scatter';
    this.baseFireRate = this.baseFireRateScatter;
    this.scatterDamageMult = 0.55;
    // 箭矢需要更快的弹速与明确射程
    this.bulletSpeed = 720;
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeArcherRange() {
    this.archerArrowRangeLevel = Math.min(3, (this.archerArrowRangeLevel || 0) + 1);
    const inc = [0, 90, 180, 270][this.archerArrowRangeLevel] || 0;
    this.archerArrowRange = Math.round((this.archerArrowRangeBase || 680) + inc);
  }

  upgradeArcherRate() {
    this.archerArrowRateLevel = Math.min(3, (this.archerArrowRateLevel || 0) + 1);
    // 每级约 -8% 间隔（不做夸张值）
    this.buildFireRateMult = Math.max(0.72, (this.buildFireRateMult || 1) * 0.92);
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeArcherDamage() {
    this.archerArrowDamageLevel = Math.min(3, (this.archerArrowDamageLevel || 0) + 1);
    // 每级 +12% 基础技能伤害
    this.archerArrowDamageMult = 1 + 0.12 * (this.archerArrowDamageLevel || 0);
  }

  upgradeArcherScatter() {
    this.archerArrowScatterLevel = Math.min(3, (this.archerArrowScatterLevel || 0) + 1);

    // L1: 3 列；L2: 5 列；L3: 5 列但扇形略加宽（仍不宜过宽）
    if (this.archerArrowScatterLevel === 1) {
      this.scatterBulletCount = 3;
      this.scatterSpread = Phaser.Math.DegToRad(7);
    } else if (this.archerArrowScatterLevel === 2) {
      this.scatterBulletCount = 5;
      this.scatterSpread = Phaser.Math.DegToRad(7);
    } else {
      this.scatterBulletCount = 5;
      this.scatterSpread = Phaser.Math.DegToRad(8.5);
    }
  }

  /**
   * 启用德鲁伊（月火术）基础攻击
   */
  enableDruidMoonfire() {
    this.disableScatterBuild();
    this.disableLaserBuild();
    this.weaponType = 'moonfire';

    this.baseFireRate = this.baseFireRateMoonfire;
    this.buildFireRateMult = 1;
    this.applyStatMultipliers(this.equipmentMods);
  }

  setMainCoreAttack(coreKey) {
    if (this.weaponType === 'laser' && coreKey !== 'mage') {
      destroyArcaneRay(this);
    }
    this.mainCoreKey = coreKey;
    this.offCoreKey = this.offCoreKey || null;

    // 主职业锁定普攻形态
    if (coreKey === 'warrior') {
      // 战士主普攻：回退为旧“月牙斩近战”系统（在 GameScene.updateMelee 里渲染/结算）
      this.weaponType = 'warrior_melee';
      this.baseFireRate = 999999;
    } else if (coreKey === 'paladin') {
      // 圣骑主普攻：重锤砸地（近身 AoE，不空挥）
      this.weaponType = 'paladin_hammer';
      this.baseFireRate = 780;
    } else if (coreKey === 'scatter') {
      // 猎人
      this.enableScatterBuild();
    } else if (coreKey === 'mage') {
      // 法师主普攻：恢复激光
      this.weaponType = 'laser';
      this.baseFireRate = 320;
    } else if (coreKey === 'drone') {
      // 德鲁伊主普攻：星落
      this.weaponType = 'starfall';
      this.baseFireRate = this.baseFireRateMoonfire;
    } else if (coreKey === 'warlock') {
      // 术士主普攻：剧毒新星（每 2 秒在脚下留下毒圈并扩张，无需瞄准）
      this.weaponType = 'warlock_poisonnova';
      this.baseFireRate = 2000;
    }

    this.buildFireRateMult = 1;
    this.offFireRateMult = getOffCorePassive(this.mainCoreKey, this.offCoreKey).fireRateMult || 1;
    this.applyStatMultipliers(this.equipmentMods);
  }

  setOffCore(coreKey) {
    this.offCoreKey = coreKey;
    this.offFireRateMult = getOffCorePassive(this.mainCoreKey, this.offCoreKey).fireRateMult || 1;
    this.applyStatMultipliers(this.equipmentMods);
  }

  disableScatterBuild() {
    this.scatterEnabled = false;
    this.scatterMode = 'fan';
  }

  disableLaserBuild() {
    if (this.weaponType === 'laser') {
      destroyArcaneRay(this);
      this.weaponType = 'scatter';
    }
  }

  /**
   * 散射范围提升
   */
  upgradeScatterRange() {
    this.scatterSpread = Math.min(0.5, this.scatterSpread + 0.06);
  }

  /**
   * 散射频率提升
   */
  upgradeScatterRate() {
    this.buildFireRateMult = Math.max(0.7, this.buildFireRateMult * 0.92);
    this.applyStatMultipliers(this.equipmentMods);
  }

  upgradeScatterCount() {
    this.scatterBulletCount = Math.min(6, this.scatterBulletCount + 1);
  }

  enableScatterRing() {
    this.scatterMode = 'ring';
    this.scatterRingCount = Math.min(20, this.scatterRingCount + 2);
  }

  enableScatterHoming() {
    this.scatterHoming = true;
  }

  enableScatterExplode() {
    this.scatterExplode = true;
  }

  /**
   * 计算暴击伤害
   */
  calculateDamage(baseDamage) {
    const isCrit = Math.random() < this.critChance;
    const amount = isCrit ? Math.round(baseDamage * this.critMultiplier) : baseDamage;
    return { amount, isCrit };
  }

  /**
   * 造成伤害后的吸血
   */
  onDealDamage(amount) {
    if (this.lifestealPercent <= 0) return;
    const healAmount = Math.floor(amount * this.lifestealPercent);
    if (healAmount > 0) {
      this.heal(healAmount);
    }
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
    console.log('玩家被击败！');
    
    // 停止射击
    if (this.fireTimer) {
      this.fireTimer.remove();
    }
    
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
    if (this.fireTimer) {
      this.fireTimer.remove();
    }
    
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
