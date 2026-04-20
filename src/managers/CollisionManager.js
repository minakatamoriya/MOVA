import Phaser from 'phaser';
import { calculateResolvedDamage } from '../combat/damageModel';

/**
 * 碰撞检测管理器
 * 使用圆形碰撞检测（高效且精确）
 */
export default class CollisionManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.bossManager = null;

    this._enemyIdSeq = 1;

    // 碰撞检测开关
    this.enabled = true;

    // 统计数据
    this.stats = {
      playerHits: 0,
      bossHits: 0,
      totalBullets: 0
    };
  }

  findBounceTarget(exclude, fromX, fromY, maxRange) {
    const boss = this.bossManager?.getCurrentBoss?.() || null;
    const minions = this.bossManager?.getMinions?.() || [];
    const enemies = [];
    if (boss && boss.isAlive) enemies.push(boss);
    if (Array.isArray(minions) && minions.length > 0) {
      minions.forEach((m) => {
        if (m && m.isAlive) enemies.push(m);
      });
    }

    const maxD2 = (maxRange || 0) > 0 ? (maxRange * maxRange) : Infinity;

    let best = null;
    let bestD2 = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.isAlive) continue;
      if (exclude && e === exclude) continue;
      if (e.isInvincible) continue;
      const dx = e.x - fromX;
      const dy = e.y - fromY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= maxD2 && d2 < bestD2) {
        best = e;
        bestD2 = d2;
      }
    }

    return best;
  }
  setPlayer(player) {
    this.player = player;
  }

  /**
   * 设置 Boss 管理器引用
   */
  setBossManager(bossManager) {
    this.bossManager = bossManager;
  }

  getBulletCore() {
    return this.scene?.bulletCore || null;
  }

  getManagedBullets(side) {
    const bulletCore = this.getBulletCore();
    if (bulletCore?.getActiveBullets) {
      return bulletCore.getActiveBullets(side) || [];
    }

    if (side === 'boss') {
      return this.scene?.bulletManager?.getBossBullets?.() || [];
    }
    if (side === 'player') {
      return this.scene?.bulletManager?.getPlayerBullets?.() || [];
    }

    return [];
  }

  shouldIgnoreNonTargetCollision(bullet, target) {
    if (!bullet || !target) return false;
    if (!bullet.ignoreNonTargetCollision) return false;

    const locked = bullet.lockTarget || null;
    if (!locked || locked.active === false || locked.isAlive === false) return false;

    return locked !== target;
  }

  // 统一命中上报出口：之后无论挂调试、统计还是 on-hit 被动，都从这里接。
  notifyBulletHit(payload = {}) {
    this.getBulletCore()?.notifyHit?.(payload);
  }

  getTargetRadius(target) {
    if (!target) return 0;
    return Number.isFinite(Number(target.bossSize)) ? Number(target.bossSize) : (Number(target.radius) || Number(target.hitRadius) || 16);
  }

  getClosestPointOnSegment(ax, ay, bx, by, px, py) {
    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = (abx * abx) + (aby * aby);
    if (abLenSq <= 0.0001) {
      return { x: ax, y: ay };
    }

    const apx = px - ax;
    const apy = py - ay;
    const t = Phaser.Math.Clamp(((apx * abx) + (apy * aby)) / abLenSq, 0, 1);
    return {
      x: ax + abx * t,
      y: ay + aby * t
    };
  }

  getSweepLineHitPoint(bullet, target) {
    if (!bullet?.sweepLine || !target) return null;

    const startRaw = Number.isFinite(Number(bullet.sweepPrevAngleRaw))
      ? Number(bullet.sweepPrevAngleRaw)
      : Number(bullet.sweepCurrentAngleRaw || bullet.rotation || 0);
    const endRaw = Number.isFinite(Number(bullet.sweepCurrentAngleRaw))
      ? Number(bullet.sweepCurrentAngleRaw)
      : startRaw;
    const radius = Math.max(1, Number(bullet.sweepRadius || bullet.radius || 1));
    const thickness = Math.max(1, Number(bullet.sweepThickness || bullet.radius || 4));
    const stepRad = Math.max(Phaser.Math.DegToRad(2), Number(bullet.sweepCollisionStepRad || Phaser.Math.DegToRad(6)));
    const targetRadius = this.getTargetRadius(target);
    const delta = Math.abs(endRaw - startRaw);
    const steps = Math.max(1, Math.ceil(delta / stepRad));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 1 : (i / steps);
      const angle = Phaser.Math.Linear(startRaw, endRaw, t);
      const endX = bullet.x + Math.cos(angle) * radius;
      const endY = bullet.y + Math.sin(angle) * radius;
      const closest = this.getClosestPointOnSegment(bullet.x, bullet.y, endX, endY, target.x, target.y);
      if (this.circleCollision(closest.x, closest.y, thickness, target.x, target.y, targetRadius)) {
        return closest;
      }
    }

    return null;
  }

  // 统一销毁出口：CollisionManager 不再直接决定走哪套 manager。
  destroyManagedBullet(bullet, side, reason = 'hit') {
    if (!bullet) return;

    const bulletCore = this.getBulletCore();
    if (bulletCore?.destroyBullet) {
      bulletCore.destroyBullet(bullet, { side, reason });
      return;
    }

    if (this.scene?.bulletManager?.destroyBullet) {
      this.scene.bulletManager.destroyBullet(bullet, side === 'player');
      return;
    }

    bullet.destroy?.();
  }

  // ═══════════════════════════════════════════════════════════
  //  伤害结算：从碰撞检测中解耦的统一结算入口
  // ═══════════════════════════════════════════════════════════

  /**
   * 玩家子弹命中敌方目标的统一结算
   * @param {{ bullet, target, targetType, hitX, hitY, now }} hit
   */
  resolvePlayerBulletHit({ bullet, target, targetType, hitX, hitY, now }) {
    const damageResult = calculateResolvedDamage({
      attacker: this.player,
      target,
      baseDamage: Math.max(1, Math.round(bullet.damage || 1)),
      now,
      canCrit: !bullet.noCrit
    });

    target.takeDamage(damageResult.amount, {
      attacker: this.player,
      bullet,
      hitX,
      hitY,
      isCrit: damageResult.isCrit,
      fromPlayer: true
    });

    this.notifyBulletHit({
      bullet,
      side: 'player',
      attacker: this.player,
      target,
      targetType,
      hitX,
      hitY,
      damage: damageResult.amount,
      isCrit: damageResult.isCrit,
      killed: !target.isAlive
    });

    return damageResult;
  }

  /**
   * Boss 子弹命中宠物/召唤物的统一结算
   * @param {{ bullet, pet, boss, bossDamageMult }} hit
   */
  resolveBossBulletHitAlly({ bullet, pet, boss, bossDamageMult }) {
    const rawDmg = Math.max(0, Math.round(10 * bossDamageMult));
    const dmgMult = Math.max(0.1, Number(pet.damageTakenMult || 1));
    const dmg = Math.max(1, Math.round(rawDmg * dmgMult));
    let killed = false;

    if (typeof pet.takeDamage === 'function') {
      killed = !!pet.takeDamage(dmg, { attacker: boss, bullet, source: 'boss_bullet' });
    } else {
      pet.currentHp = Math.max(0, (pet.currentHp || 0) - dmg);
      killed = (pet.currentHp || 0) <= 0;
    }

    this.notifyBulletHit({
      bullet,
      side: 'boss',
      attacker: boss,
      target: pet,
      targetType: pet.isDecoy ? 'decoy' : (pet.isUndeadSummon ? 'summon' : 'pet'),
      hitX: pet.x,
      hitY: pet.y,
      damage: dmg,
      isCrit: false,
      killed
    });

    if (killed) {
      if (pet.isUndeadSummon && this.scene?.undeadSummonManager?.onSummonKilled) {
        this.scene.undeadSummonManager.onSummonKilled(pet);
      } else if (pet.petType && this.scene?.petManager?.onPetKilled) {
        this.scene.petManager.onPetKilled(pet.petType);
      }
    }

    return { amount: dmg, killed };
  }

  /**
   * Boss 子弹命中玩家的统一结算（含熊灵分摊）
   * @param {{ bullet, boss, bossDamageMult, playerPos }} hit
   * @returns {{ isDead: boolean, incoming: number }}
   */
  resolveBossBulletHitPlayer({ bullet, boss, bossDamageMult, playerPos }) {
    let incoming = Math.max(0, Math.round(10 * bossDamageMult));

    // 自然伙伴（熊系）：共担（玩家受击时分摊给熊灵）
    const splitPct = this.player?.natureBearSplit || 0;
    if (splitPct > 0 && this.scene?.petManager?.getTankPet) {
      const bear = this.scene.petManager.getTankPet();
      if (bear && bear.active && (bear.currentHp || 0) > 0) {
        const split = Math.max(0, Math.round(incoming * splitPct));
        if (split > 0) {
          incoming = Math.max(0, incoming - split);
          bear.currentHp = Math.max(0, (bear.currentHp || 0) - split);
          if (this.scene?.petManager?.onPetDamaged) this.scene.petManager.onPetDamaged(bear, split);
          if (bear.currentHp <= 0 && this.scene?.petManager?.onPetKilled) {
            this.scene.petManager.onPetKilled(bear.petType);
          }
        }
      }
    }

    const isDead = this.player.takeDamage(incoming);
    this.notifyBulletHit({
      bullet,
      side: 'boss',
      attacker: boss,
      target: this.player,
      targetType: 'player',
      hitX: playerPos.x,
      hitY: playerPos.y,
      damage: incoming,
      isCrit: false,
      killed: !!isDead
    });

    return { isDead: !!isDead, incoming };
  }

  /**
   * 更新碰撞检测（每帧调用）
   */
  update() {
    if (!this.enabled || !this.player || !this.player.isAlive) return;
    
    // 检测玩家子弹与 Boss 的碰撞
    this.checkPlayerBulletsVsBoss();

    // 检测玩家子弹与 Boss 小怪的碰撞
    this.checkPlayerBulletsVsMinions();
    
    // 检测 Boss 子弹与玩家的碰撞
    this.checkBossBulletsVsPlayer();
  }

  checkPlayerBulletsVsMinions() {
    const minions = this.bossManager?.getMinions?.() || [];
    if (!Array.isArray(minions) || minions.length === 0) return;

    const playerBullets = this.getManagedBullets('player');
    if (playerBullets.length === 0) return;

    const now = this.scene.time?.now ?? 0;

    for (let m = 0; m < minions.length; m++) {
      const enemy = minions[m];
      if (!enemy || !enemy.isAlive) continue;
      if (enemy.isInvincible) continue;

      // 给小怪分配稳定 id，便于毒圈等“持续接触”按目标节流
      if (!enemy.__enemyId) {
        enemy.__enemyId = this._enemyIdSeq++;
      }

      for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        if (!bullet || !bullet.active) continue;

        let collided = false;
        let hitX = bullet.x;
        let hitY = bullet.y;

        if (bullet.sweepLine) {
          const sweepHit = this.getSweepLineHitPoint(bullet, enemy);
          if (sweepHit) {
            collided = true;
            hitX = sweepHit.x;
            hitY = sweepHit.y;
          }
        } else if (Array.isArray(bullet.arcSamples) && bullet.arcSamples.length > 0) {
          const rot = bullet.rotation || 0;
          const cosR = Math.cos(rot);
          const sinR = Math.sin(rot);
          const sampleR = bullet.arcSampleRadius !== undefined ? bullet.arcSampleRadius : (bullet.radius !== undefined ? bullet.radius : 4);

          for (let s = 0; s < bullet.arcSamples.length; s++) {
            const pt = bullet.arcSamples[s];
            if (!pt) continue;
            const wx = bullet.x + (pt.x * cosR - pt.y * sinR);
            const wy = bullet.y + (pt.x * sinR + pt.y * cosR);
            if (this.circleCollision(wx, wy, sampleR, enemy.x, enemy.y, enemy.bossSize)) {
              collided = true;
              hitX = wx;
              hitY = wy;
              break;
            }
          }
        } else {
          const bulletRadius = bullet.radius !== undefined ? bullet.radius : 4;
          collided = this.circleCollision(
            bullet.x, bullet.y, bulletRadius,
            enemy.x, enemy.y, enemy.bossSize
          );
        }

        if (!collided) continue;
        if (this.shouldIgnoreNonTargetCollision(bullet, enemy)) continue;

        // ====== 剧毒新星：毒圈接触逻辑（小怪/精英与 Boss 同一套叠层体系） ======
        // 这里只负责：标记“仍在毒圈中”、进入时启动计时；具体叠层/扣血在 GameScene.updateWarlockDebuff 里统一驱动。
        if (bullet.isPoisonZone) {
          enemy.debuffs = enemy.debuffs || {};
          enemy.debuffs.poisonZone = enemy.debuffs.poisonZone || { stacks: 0, inZoneUntil: 0, nextGainAt: 0, nextDecayAt: 0, nextTickAt: 0 };
          const pz = enemy.debuffs.poisonZone;

          const wasInZone = (pz.inZoneUntil || 0) > now;
          pz.inZoneUntil = now + 250;

          if (!wasInZone) {
            // 进入毒圈：立刻记 1 层，并立即触发一次跳毒
            pz.stacks = Math.max(1, pz.stacks || 0);
            pz.nextGainAt = now + 1000;
            pz.nextDecayAt = 0;
            pz.nextTickAt = now;
          }

          // 毒圈不走常规“命中伤害/命中特效/销毁子弹”路径
          continue;
        }

        // 穿透/多段：同一子弹对同一小怪命中节流
        const hitCd = bullet.hitCooldownMs || 0;
        if (hitCd > 0) {
          bullet._hitAtByEnemy = bullet._hitAtByEnemy || new Map();
          const lastAt = bullet._hitAtByEnemy.get(enemy.__enemyId);
          if (lastAt != null && now - lastAt < hitCd) {
            continue;
          }
          bullet._hitAtByEnemy.set(enemy.__enemyId, now);
        }

        // 小怪命中统一走 resolvePlayerBulletHit
        const damageResult = this.resolvePlayerBulletHit({
          bullet, target: enemy, targetType: 'minion', hitX, hitY, now
        });

        // 弹射：命中后不立刻销毁，改为跳向另一个最近敌人
        const canBounce = bullet.motionType === 'moonfire' || bullet.shadowBase || bullet.canBounce;
        if (canBounce && bullet.basicEnh?.bounce && bullet.basicEnh.bounce > 0) {
          const next = this.findBounceTarget(enemy, enemy.x, enemy.y, 720);
          if (next && next.isAlive) {
            bullet.basicEnh.bounce -= 1;

            // 改向：以“命中敌人 -> 下一目标”为方向
            const a = Phaser.Math.Angle.Between(enemy.x, enemy.y, next.x, next.y);
            bullet.isAbsoluteAngle = true;
            bullet.angleRad = a;
            bullet.angleOffset = a;
            bullet.homing = false;
            bullet.homingMode = null;
            bullet.lockTarget = null;

            // 推出当前敌人外侧，避免同帧重复碰撞
            const push = (enemy.bossSize || 0) + (bullet.radius || 10) + 14;
            bullet.x = enemy.x + Math.cos(a) * push;
            bullet.y = enemy.y + Math.sin(a) * push;
          }
        } else {
          const maxHits = bullet.maxHits || (bullet.pierce ? 2 : 1);
          bullet.hitCount = (bullet.hitCount || 0) + 1;
          const shouldDestroy = !bullet.pierce || bullet.hitCount >= maxHits;
          if (shouldDestroy) {
            this.destroyManagedBullet(bullet, 'player', 'hit');
          }
        }
      }
    }
  }

  /**
   * 检测玩家子弹与 Boss 的碰撞
   */
  checkPlayerBulletsVsBoss() {
    const boss = this.bossManager?.getCurrentBoss();
    if (!boss || !boss.isAlive) return;
    if (boss.isInvincible) return;

    const playerBullets = this.getManagedBullets('player');

    if (playerBullets.length === 0) return;

    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (!bullet || !bullet.active) continue;

      let collided = false;
      let hitX = bullet.x;
      let hitY = bullet.y;

      // 特殊形状：旋转扫线/弧段采样点碰撞
      if (bullet.sweepLine) {
        const sweepHit = this.getSweepLineHitPoint(bullet, boss);
        if (sweepHit) {
          collided = true;
          hitX = sweepHit.x;
          hitY = sweepHit.y;
        }
      } else if (Array.isArray(bullet.arcSamples) && bullet.arcSamples.length > 0) {
        const rot = bullet.rotation || 0;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const sampleR = bullet.arcSampleRadius !== undefined ? bullet.arcSampleRadius : (bullet.radius !== undefined ? bullet.radius : 4);

        for (let s = 0; s < bullet.arcSamples.length; s++) {
          const pt = bullet.arcSamples[s];
          if (!pt) continue;
          const wx = bullet.x + (pt.x * cosR - pt.y * sinR);
          const wy = bullet.y + (pt.x * sinR + pt.y * cosR);
          if (this.circleCollision(wx, wy, sampleR, boss.x, boss.y, boss.bossSize)) {
            collided = true;
            hitX = wx;
            hitY = wy;
            break;
          }
        }
      } else {
        const bulletRadius = bullet.radius !== undefined ? bullet.radius : 4;
        collided = this.circleCollision(
          bullet.x, bullet.y, bulletRadius,
          boss.x, boss.y, boss.bossSize
        );
      }

      if (collided) {
        if (this.shouldIgnoreNonTargetCollision(bullet, boss)) continue;
        const now = this.scene.time?.now ?? 0;

        // ====== 剧毒新星：毒圈接触逻辑（不因命中而消失；按持续时间销毁） ======
        // 注意：毒圈需要“持续接触”判定，因此不能被 hitCooldownMs 节流。
        // Boss 与小怪/精英共用同一套 poisonZone 叠层体系。
        if (bullet.isPoisonZone) {
          boss.debuffs = boss.debuffs || {};
          boss.debuffs.poisonZone = boss.debuffs.poisonZone || { stacks: 0, inZoneUntil: 0, nextGainAt: 0, nextDecayAt: 0, nextTickAt: 0 };
          const pz = boss.debuffs.poisonZone;

          const wasInZone = (pz.inZoneUntil || 0) > now;
          pz.inZoneUntil = now + 250;

          if (!wasInZone) {
            pz.stacks = Math.max(1, pz.stacks || 0);
            pz.nextGainAt = now + 1000;
            pz.nextDecayAt = 0;
            pz.nextTickAt = now;
          }

          // 浓烟：毒圈内敌人造成伤害 -15%（接触时刷新）
          if (this.player?.warlockPoisonSmoke) {
            boss.debuffs.smokeEnd = now + 1200;
            boss.damageDealtMult = Math.min(boss.damageDealtMult || 1, 0.85);
          }

          // 毒圈不走常规“命中伤害/命中特效/销毁子弹”路径
          continue;
        }

        // 穿透/多段：同一子弹对 Boss 命中节流
        const hitCd = bullet.hitCooldownMs || 0;
        if (hitCd > 0 && bullet.lastHitAt && now - bullet.lastHitAt < hitCd) {
          continue;
        }
        bullet.lastHitAt = now;

        // Boss 命中走 resolvePlayerBulletHit
        const damageResult = this.resolvePlayerBulletHit({
          bullet, target: boss, targetType: 'boss', hitX, hitY, now
        });

        const isDead = !boss.isAlive;

        // 弹射：命中后不立刻销毁，重新朝向 Boss 再来一次
        // - 月火术：motionType === 'moonfire'
        // - 术士连环：shadowBase === true
        const canBounce = bullet.motionType === 'moonfire' || bullet.shadowBase || bullet.canBounce;
        if (canBounce && bullet.basicEnh?.bounce && bullet.basicEnh.bounce > 0) {
          const next = this.findBounceTarget(boss, boss.x, boss.y, 720);
          if (next && next.isAlive) {
            bullet.basicEnh.bounce -= 1;

            const a = Phaser.Math.Angle.Between(boss.x, boss.y, next.x, next.y);
            bullet.isAbsoluteAngle = true;
            bullet.angleRad = a;
            bullet.angleOffset = a;
            bullet.homing = false;
            bullet.homingMode = null;
            bullet.lockTarget = null;

            const push = (boss.bossSize || 0) + (bullet.radius || 10) + 14;
            bullet.x = boss.x + Math.cos(a) * push;
            bullet.y = boss.y + Math.sin(a) * push;
          }
        } else {
          // 穿透：允许多次命中；否则正常销毁
          const maxHits = bullet.maxHits || (bullet.pierce ? 2 : 1);
          bullet.hitCount = (bullet.hitCount || 0) + 1;
          const shouldDestroy = !bullet.pierce || bullet.hitCount >= maxHits;

          if (shouldDestroy) {
            this.destroyManagedBullet(bullet, 'player', 'hit');
          }
        }

        if (isDead) {
          console.log('Boss 被击败！');
        }
      }
    }
  }

  /**
   * 检测 Boss 子弹与玩家的碰撞
   */
  checkBossBulletsVsPlayer() {
    if (!this.player.isAlive) {
      console.log('[碰撞检测] 玩家已死亡，跳过');
      return;
    }
    
    if (this.player.isInvincible) {
      console.log('[碰撞检测] 玩家无敌状态，跳过');
      return;
    }
    
    const boss = this.bossManager?.getCurrentBoss?.();
    const bossDamageMult = boss?.damageDealtMult || 1;
    const now = this.scene?.time?.now ?? 0;

    const playerPos = this.player.getHitboxPosition();
    const allBossBullets = this.getManagedBullets('boss');

    const hittablePets = this.scene?.petManager?.getHittablePets?.() || [];
    const hittableUndead = this.scene?.undeadSummonManager?.getHittableSummons?.() || [];
    const hittableDecoys = this.scene?.getHittableDecoys?.() || [];
    const hittableAllies = hittableDecoys.concat(hittablePets, hittableUndead);
    
    if (allBossBullets.length === 0) {
      return;
    }
    
    console.log('[碰撞检测] 检测Boss子弹', allBossBullets.length, '发');
    
    for (let i = allBossBullets.length - 1; i >= 0; i--) {
      const bullet = allBossBullets[i];
      if (!bullet || !bullet.active) continue;

      // 若子弹不可见/几乎透明：视为无效，避免“看不见但被打到”的体验
      if (bullet.visible === false) continue;
      if (typeof bullet.alpha === 'number' && bullet.alpha <= 0.05) continue;
      
      // 获取子弹半径（根据类型可能不同）
      let bulletRadius = 6; // 默认半径
      if (bullet.radius !== undefined) {
        bulletRadius = bullet.radius;
      } else if (bullet.width) {
        bulletRadius = bullet.width / 2;
      }
      
      // 1) 先检测可受击宠物（熊/树精）
      let handledByPet = false;
      if (hittableAllies.length > 0) {
        for (let p = 0; p < hittableAllies.length; p++) {
          const pet = hittableAllies[p];
          if (!pet || !pet.active) continue;
          const petR = pet.hitRadius || 0;
          if (petR <= 0) continue;

          if (this.circleCollision(
            bullet.x, bullet.y, bulletRadius,
            pet.x, pet.y, petR
          )) {
            handledByPet = true;

            this.resolveBossBulletHitAlly({ bullet, pet, boss, bossDamageMult });

            // 销毁子弹
            this.destroyManagedBullet(bullet, 'boss', 'hit');

            break;
          }
        }
      }

      if (handledByPet) {
        continue;
      }

      // 2) 再检测玩家（使用玩家的小判定框）
      if (this.circleCollision(
        bullet.x, bullet.y, bulletRadius,
        playerPos.x, playerPos.y, playerPos.radius
      )) {
        console.log('[碰撞检测] 子弹命中玩家！触发伤害');
        
        const { isDead } = this.resolveBossBulletHitPlayer({ bullet, boss, bossDamageMult, playerPos });

        // 通过统一出口销毁子弹，避免新旧系统各记各的生命周期。
        this.destroyManagedBullet(bullet, 'boss', 'hit');
        
        // 被击中后进入无敌状态，不再检测其他子弹
        return;
      }
    }
  }

  /**
   * 圆形碰撞检测
   * @param {number} x1 - 圆1的x坐标
   * @param {number} y1 - 圆1的y坐标
   * @param {number} r1 - 圆1的半径
   * @param {number} x2 - 圆2的x坐标
   * @param {number} y2 - 圆2的y坐标
   * @param {number} r2 - 圆2的半径
   * @returns {boolean} - 是否发生碰撞
   */
  circleCollision(x1, y1, r1, x2, y2, r2) {
    const distanceSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const radiusSum = r1 + r2;
    return distanceSquared < radiusSum ** 2;
  }

  /**
   * 获取所有 Boss 子弹（向后兼容）
   */
  getAllBossBullets() {
    const bullets = this.getManagedBullets('boss');
    if (bullets.length > 0) return bullets;
    
    // 降级方案：直接从场景中查找
    const fallbackBullets = [];
    this.scene.children.list.forEach(child => {
      if (child.type === 'Arc' || child.type === 'Star' || child.type === 'Rectangle') {
        if (!child.isPlayerBullet && child.active) {
          if (!child.isBoss && !child.isPlayer) {
            fallbackBullets.push(child);
          }
        }
      }
    });
    
    return fallbackBullets;
  }

  /**
   * 显示伤害数字
   */
  showDamageNumber(x, y, damage, colorOrOptions = '#ffffff', maybeOptions) {
    if (this.scene?.registry?.get('showDamage') === false) return;

    let options = {};
    if (typeof colorOrOptions === 'string') {
      options.color = colorOrOptions;
      if (maybeOptions && typeof maybeOptions === 'object') options = { ...options, ...maybeOptions };
    } else if (typeof colorOrOptions === 'object' && colorOrOptions) {
      options = { ...colorOrOptions };
    }

    const isCrit = !!options.isCrit;
    const color = isCrit ? '#ff3333' : (options.color || '#ffee00');

    const fontSize = options.fontSize || (isCrit ? 40 : 30);
    const text = isCrit ? `暴击 ${damage}` : `${damage}`;

    const damageText = this.scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      fontFamily: 'Arial',
      color,
      fontStyle: 'bold',
      resolution: 2,
      letterSpacing: 1
    }).setOrigin(0.5);

    damageText.setDepth(999);

    const whisper = !!options.whisper;
    damageText.setScale(whisper ? 0.82 : (isCrit ? 0.92 : 0.88));

    this.scene.tweens.add({
      targets: damageText,
      scale: whisper ? 1.02 : (isCrit ? 1.5 : 1.16),
      duration: whisper ? 180 : (isCrit ? 140 : 120),
      ease: 'Back.Out'
    });

    this.scene.tweens.add({
      targets: damageText,
      y: y - (whisper ? 42 : (isCrit ? 78 : 60)),
      duration: whisper ? 820 : (isCrit ? 920 : 720),
      ease: isCrit ? 'Cubic.Out' : 'Power2',
      onComplete: () => {
        damageText.destroy();
      }
    });

    if (isCrit) {
      this.scene.tweens.add({
        targets: damageText,
        x: x + Phaser.Math.Between(-10, 10),
        yoyo: true,
        repeat: 2,
        duration: 60,
        ease: 'Sine.InOut'
      });
    }
  }

  /**
   * 创建命中特效
   */
  createHitEffect(x, y, color = 0xffff00) {
    // 创建小型爆炸效果
    for (let i = 0; i < 6; i++) {
      const particle = this.scene.add.circle(x, y, 3, color);
      const angle = (Math.PI * 2 * i) / 6;
      const speed = Phaser.Math.Between(40, 80);
      
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
    
    // 闪光效果
    const flash = this.scene.add.circle(x, y, 15, color, 0.6);
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * 月火术命中特效：无爆炸、无火花，只有淡绿涟漪
   */
  createMoonfireRippleEffect(x, y) {
    const ring = this.scene.add.circle(x, y, 10, 0x88ffcc, 0);
    ring.setStrokeStyle(3, 0x88ffcc, 0.45);
    ring.setDepth(998);

    const glow = this.scene.add.circle(x, y, 14, 0x88ffcc, 0.10);
    glow.setDepth(997);

    this.scene.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 360,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    });

    this.scene.tweens.add({
      targets: glow,
      scale: 2.6,
      alpha: 0,
      duration: 320,
      ease: 'Sine.Out',
      onComplete: () => glow.destroy()
    });
  }

  /**
   * Boss 子弹命中玩家的特效（按形状/危险感区分）
   */
  createBossBulletHitEffect(x, y, bullet) {
    const isSharp = !!(bullet && (bullet.isSharp || bullet.shapeType === 'diamond' || bullet.shapeType === 'star' || bullet.shapeType === 'cross'));
    if (isSharp) {
      this.createSharpSparkEffect(x, y, 0xff6655);
    } else {
      this.createBluntDustEffect(x, y, 0xffaa99);
    }
  }

  createSharpSparkEffect(x, y, color = 0xffaa66) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const length = Phaser.Math.Between(18, 34);
      const thickness = Phaser.Math.Between(2, 3);
      const spark = this.scene.add.rectangle(x, y, length, thickness, color, 1);
      spark.rotation = angle;
      spark.setOrigin(0.15, 0.5);

      const speed = Phaser.Math.Between(60, 140);
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        duration: Phaser.Math.Between(140, 220),
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy()
      });
    }

    const flash = this.scene.add.circle(x, y, 10, color, 0.7);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.6,
      alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy()
    });
  }

  createBluntDustEffect(x, y, color = 0xffcc99) {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Phaser.Math.Between(20, 70);
      const r = Phaser.Math.Between(2, 5);
      const p = this.scene.add.circle(x, y, r, color, 0.75);

      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 1.6,
        duration: Phaser.Math.Between(180, 280),
        ease: 'Power2',
        onComplete: () => p.destroy()
      });
    }

    const puff = this.scene.add.circle(x, y, 14, color, 0.35);
    this.scene.tweens.add({
      targets: puff,
      scale: 2.2,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.Out',
      onComplete: () => puff.destroy()
    });
  }

  /**
   * 玩家死亡处理
   */
  onPlayerDeath() {
    this.enabled = false;
    
    // 延迟显示游戏结束界面
    this.scene.time.delayedCall(2000, () => {
      this.scene.scene.start('GameOverScene', {
        victory: false,
        score: this.scene.playerData.score,
        survived: this.getPlayTime(),
        stats: this.stats,
        sessionCoins: this.scene.sessionCoins || 0
      });
    });
  }

  /**
   * 获取游戏时间
   */
  getPlayTime() {
    const seconds = Math.floor(this.scene.time.now / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * 启用/禁用碰撞检测
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return {
      ...this.stats,
      accuracy: this.stats.totalBullets > 0 
        ? (this.stats.bossHits / this.stats.totalBullets * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * 重置统计数据
   */
  resetStats() {
    this.stats = {
      playerHits: 0,
      bossHits: 0,
      totalBullets: 0
    };
  }

  /**
   * 清理
   */
  destroy() {
    this.player = null;
    this.bossManager = null;
  }
}
