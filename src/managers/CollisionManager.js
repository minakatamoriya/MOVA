import Phaser from 'phaser';

import { getBaseColorForCoreKey, lerpColor } from '../classes/visual/basicSkillColors';

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

    let playerBullets = [];
    if (this.scene?.bulletManager?.getPlayerBullets) {
      playerBullets = this.scene.bulletManager.getPlayerBullets() || [];
    } else {
      this.scene.children.list.forEach(child => {
        if (child?.isPlayerBullet && child.active) playerBullets.push(child);
      });
    }
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

        if (Array.isArray(bullet.arcSamples) && bullet.arcSamples.length > 0) {
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

        // 伤害（简化版：保留暴击与玩家增伤）
        let baseDamage = Math.max(1, Math.round(bullet.damage || 1));
        let damageMult = 1;

        // 不屈：血怒
        if (this.player?.bloodrageEnabled && this.player.maxHp > 0) {
          const missing = 1 - (this.player.hp / this.player.maxHp);
          const stacks = Math.max(0, Math.floor(missing / 0.1));
          damageMult *= (1 + stacks * 0.03);
        }

        // 不屈：战吼
        if ((this.player?.battlecryUntil || 0) > now) {
          damageMult *= 1.15;
        }

        baseDamage = Math.max(1, Math.round(baseDamage * damageMult));

        const damageResult = bullet.noCrit
          ? { amount: baseDamage, isCrit: false }
          : (() => {
            const critChance = Math.min(0.95, (this.player.critChance || 0));
            const isCrit = Math.random() < critChance;
            const amount = isCrit ? Math.round(baseDamage * (this.player.critMultiplier || 1.5)) : baseDamage;
            return { amount, isCrit };
          })();

        enemy.takeDamage(damageResult.amount, {
          attacker: this.player,
          bullet,
          hitX,
          hitY,
          isCrit: damageResult.isCrit,
          fromPlayer: true
        });

        // 命中特效与数字
        const hitColor = bullet.hitEffectColor ?? (bullet.poison ? 0x66ff99 : (damageResult.isCrit ? 0xff3333 : 0xffff00));
        this.createHitEffect(hitX, hitY, hitColor);
        this.showDamageNumber(hitX, hitY - 24, damageResult.amount, damageResult.isCrit ? '#ff3333' : '#ffee00');

        // 爆破散射
        if (bullet.explode) {
          this.createHitEffect(hitX, hitY, 0xffaa66);
        }

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
            if (this.scene.bulletManager) {
              this.scene.bulletManager.destroyBullet(bullet, true);
            } else {
              bullet.destroy();
            }
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

    let playerBullets = [];
    if (this.scene?.bulletManager?.getPlayerBullets) {
      playerBullets = this.scene.bulletManager.getPlayerBullets() || [];
    } else {
      // 降级方案：直接从场景中查找
      this.scene.children.list.forEach(child => {
        if (child?.isPlayerBullet && child.active) playerBullets.push(child);
      });
    }

    if (playerBullets.length === 0) return;

    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (!bullet || !bullet.active) continue;

      let collided = false;
      let hitX = bullet.x;
      let hitY = bullet.y;

      // 特殊形状：弧段采样点碰撞（用于半月斩等“弧形边缘”）
      if (Array.isArray(bullet.arcSamples) && bullet.arcSamples.length > 0) {
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
        const now = this.scene.time?.now ?? 0;

        // ====== 剧毒新星：毒圈接触逻辑（不因命中而消失；按持续时间销毁） ======
        // 注意：毒圈需要“持续接触”判定，因此不能被 hitCooldownMs 节流。
        // 这里仅负责：标记“仍在毒圈中”、处理进入判定、刷新浓烟；具体叠层/扣血在 GameScene.updateWarlockDebuff 里统一驱动。
        if (bullet.isPoisonZone) {
          boss.debuffs = boss.debuffs || { poisonEnd: 0, poisonTick: 0, weakenEnd: 0 };
          boss.debuffs.poisonZone = boss.debuffs.poisonZone || { stacks: 0, inZoneUntil: 0, nextGainAt: 0, nextDecayAt: 0, nextTickAt: 0 };
          const pz = boss.debuffs.poisonZone;

          const wasInZone = (pz.inZoneUntil || 0) > now;
          pz.inZoneUntil = now + 250;

          // 进入：不立刻给层数；仅启动“满 1 秒 +1 层”的计时（由 GameScene.updateWarlockDebuff 驱动）
          if (!wasInZone) {
            // 进入毒圈：立刻记 1 层，并立即触发一次跳毒
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

        // ====== 伤害修正（通用天赋/主职业专精） ======
        let baseDamage = bullet.damage;
        let damageMult = 1;

        // 不屈：血怒（血越少打越痛）
        if (this.player?.bloodrageEnabled && this.player.maxHp > 0) {
          const missing = 1 - (this.player.hp / this.player.maxHp);
          const stacks = Math.max(0, Math.floor(missing / 0.1));
          damageMult *= (1 + stacks * 0.03);
        }

        // 不屈：战吼（临时增伤）
        if ((this.player?.battlecryUntil || 0) > now) {
          damageMult *= 1.15;
        }

        // 自然伙伴（熊系）：自然之怒（临时增伤）
        if ((this.player?.natureRageUntil || 0) > now) {
          damageMult *= (this.player.natureRageMult || 1.1);
        }

        // 自然伙伴（鹰系）：猎手标记（对被标记的 Boss 增伤）
        if (boss?.debuffs?.huntMarkEnd && now < boss.debuffs.huntMarkEnd) {
          damageMult *= (boss.debuffs.huntMarkMult || 1.1);
        }

        // 术士专精：吞噬（斩杀）
        if (this.player?.warlockExecute && boss.maxHp > 0) {
          const hpPct = boss.currentHp / boss.maxHp;
          if (hpPct < 0.3) damageMult *= 2;
        }

        baseDamage = Math.max(1, Math.round(baseDamage * damageMult));

        // 暴击：游侠猎手（对高血敌人额外暴击率）
        const extraCrit = (this.player?.hunterCritBonus || 0) > 0 && boss.maxHp > 0 && (boss.currentHp / boss.maxHp) > 0.8
          ? (this.player.hunterCritBonus || 0)
          : 0;

        const damageResult = bullet.noCrit
          ? { amount: baseDamage, isCrit: false }
          : (() => {
            const critChance = Math.min(0.95, (this.player.critChance || 0) + extraCrit);
            const isCrit = Math.random() < critChance;
            const amount = isCrit ? Math.round(baseDamage * (this.player.critMultiplier || 1.5)) : baseDamage;
            return { amount, isCrit };
          })();

        // 造成伤害
        const isDead = boss.takeDamage(damageResult.amount, {
          attacker: this.player,
          bullet,
          hitX,
          hitY,
          isCrit: damageResult.isCrit,
          fromPlayer: true
        });

        // 圣骑：制裁（眩晕）- 仅对 Boss 生效
        if (!isDead && (bullet?.stunChance || 0) > 0 && typeof boss.applyStun === 'function') {
          const chance = Phaser.Math.Clamp(bullet.stunChance || 0, 0, 0.95);
          if (Math.random() < chance) {
            const stunMs = Math.max(120, bullet.stunMs || 650);
            boss.applyStun(stunMs);
            this.showDamageNumber(boss.x, boss.y - 70, '眩晕', { color: '#ffd26a', fontSize: 18, whisper: true });
          }
        }

        // 传染：毒圈内敌人死亡时留下小毒圈（Boss 死亡时触发；后续若有小怪系统可扩展）
        if (isDead && bullet.isPoisonZone && this.player?.warlockPoisonContagion && this.scene?.bulletManager?.createPlayerBullet) {
          const poisonCore = bullet?.visualCoreColor ?? getBaseColorForCoreKey('warlock');
          const poisonStroke = lerpColor(poisonCore, 0xffffff, 0.45);
          const small = this.scene.bulletManager.createPlayerBullet(
            hitX,
            hitY,
            poisonCore,
            {
              radius: Math.max(28, Math.round((bullet.radius || 96) * 0.55)),
              speed: 0,
              damage: Math.max(1, Math.round((bullet.damage || 1) * 0.65)),
              hasGlow: true,
              glowRadius: Math.max(42, Math.round((bullet.radius || 96) * 0.55) + 14),
              glowColor: poisonCore,
              hasTrail: false,
              strokeColor: poisonStroke,
              isAbsoluteAngle: true,
              angleOffset: 0,
              homing: false,
              explode: false,
              skipUpdate: false
            }
          );
          if (small) {
            if (small.setFillStyle) small.setFillStyle(poisonCore, 0.06);
            if (small.setStrokeStyle) small.setStrokeStyle(2, poisonStroke, 0.55);
            small.isPoisonZone = true;
            small.hitCooldownMs = 1000;
            small.maxLifeMs = 3000;
            small.hitEffectType = 'poison_zone';
            this.player.bullets.push(small);
          }
        }

        // 圣骑专精：圣焰（命中后留持续伤害区域）
        if (bullet?.holyfire && this.scene?.bulletManager?.createPlayerBullet) {
          const paladinColor = getBaseColorForCoreKey('paladin');
          const fire = this.scene.bulletManager.createPlayerBullet(
            hitX,
            hitY,
            paladinColor,
            {
              radius: 54,
              speed: 0,
              damage: Math.max(1, Math.round(this.player.bulletDamage * 0.18)),
              hasGlow: false,
              hasTrail: false,
              glowRadius: 0,
              isAbsoluteAngle: true,
              angleOffset: 0,
              homing: false,
              explode: false,
              skipUpdate: false
            }
          );
          if (fire) {
            fire.alpha = 0.001;
            fire.maxLifeMs = 850;
            fire.noCrit = true;
            fire.hitCooldownMs = Math.max(60, Math.round((this.player?.fireRate || 320) * (220 / 320)));
            fire.isHolyfire = true;
            this.player.bullets.push(fire);

            const ring = this.scene.add.circle(hitX, hitY, 54, paladinColor, 0.06);
            ring.setStrokeStyle(2, paladinColor, 0.65);
            this.scene.tweens.add({ targets: ring, alpha: 0, duration: 850, onComplete: () => ring.destroy() });
          }
        }

        // 法师专精：过热（持续命中 3 秒爆炸）
        if (this.player?.mageOverheat && bullet?.laserBeam) {
          boss._laserOverheat = boss._laserOverheat || { accMs: 0, lastAt: 0 };
          const prev = boss._laserOverheat.lastAt || 0;
          const deltaMs = prev > 0 ? (now - prev) : 0;
          boss._laserOverheat.lastAt = now;
          if (deltaMs > 0 && deltaMs < 260) {
            boss._laserOverheat.accMs += deltaMs;
          } else {
            boss._laserOverheat.accMs = 0;
          }

          if (boss._laserOverheat.accMs >= 3000) {
            boss._laserOverheat.accMs = 0;
            const extra = Math.max(1, Math.round(this.player.bulletDamage * 1.2));
            if (!boss.isInvincible) {
              boss.takeDamage(extra, { attacker: this.player, source: 'mageOverheat', suppressHitReaction: true });
              this.showDamageNumber(boss.x, boss.y - 26, extra, { color: '#66ccff', fontSize: 24, whisper: true });
              this.createHitEffect(boss.x, boss.y, 0x66ccff);
            }
          }
        }

        // 术士专精：回响（命中后留法阵）
        if (this.player?.warlockEcho && this.scene?.bulletManager?.createPlayerBullet) {
          const warlockColor = getBaseColorForCoreKey('warlock');
          const rune = this.scene.bulletManager.createPlayerBullet(
            hitX,
            hitY,
            warlockColor,
            {
              radius: 46,
              speed: 0,
              damage: Math.max(1, Math.round(this.player.bulletDamage * 0.22)),
              hasGlow: false,
              hasTrail: false,
              glowRadius: 0,
              isAbsoluteAngle: true,
              angleOffset: 0,
              homing: false,
              explode: false,
              skipUpdate: false
            }
          );
          if (rune) {
            rune.alpha = 0.001;
            rune.maxLifeMs = 650;
            rune.noCrit = true;
            rune.hitCooldownMs = 220;
            rune.isRune = true;
            this.player.bullets.push(rune);
          }
        }

        // 通用：诅咒（腐蚀/虚弱/凋零）
        if (this.player?.curseCorrosion && this.scene?.applyWarlockOnHit) {
          if (Math.random() < 0.15) {
            // 5% 攻击力/秒，持续 3 秒（tick=0.5s => *0.5）
            this.scene.warlockPoisonDuration = 3000;
            this.scene.warlockPoisonDps = Math.max(1, Math.round((this.player.bulletDamage || 1) * 0.05));
            this.scene.warlockWeakenAmount = 0;
            this.scene.applyWarlockOnHit(boss, true);
            boss.debuffs.poisonStacks = boss.debuffs.poisonStacks || 1;
          }
        }

        if (this.player?.curseWeakness) {
          if (Math.random() < 0.2) {
            boss.debuffs = boss.debuffs || { poisonEnd: 0, poisonTick: 0, weakenEnd: 0 };
            boss.debuffs.damageDownEnd = now + 3000;
            boss.damageDealtMult = 0.85;
          }
        }

        if (this.player?.curseWither && boss.debuffs && boss.debuffs.poisonEnd && now < boss.debuffs.poisonEnd) {
          boss.debuffs.poisonStacks = Math.min(2, (boss.debuffs.poisonStacks || 1) + 1);
        }

        // 副职业强化：命中触发
        const enh = bullet.basicEnh;
        if (enh) {
          // 1) 微量护盾（累积到 1.0 变成一层）
          if (enh.shieldOnHit && this.player) {
            this.player.shieldChargeProgress = (this.player.shieldChargeProgress || 0) + enh.shieldOnHit;
            while (this.player.shieldChargeProgress >= 1) {
              this.player.shieldChargeProgress -= 1;
              this.player.shieldCharges = (this.player.shieldCharges || 0) + 1;
              if (this.player.updateShieldIndicator) this.player.updateShieldIndicator();
            }
          }

          // 2) 小范围爆炸（此处只有 Boss，表现为额外伤害+特效）
          if (enh.explodeOnHit) {
            const extra = Math.max(1, Math.round(damageResult.amount * enh.explodeOnHit));
            if (!boss.isInvincible) {
              boss.takeDamage(extra, { attacker: this.player, source: 'explodeOnHit', suppressHitReaction: true });
              this.showDamageNumber(boss.x, boss.y - 22, extra, { color: '#66ccff', fontSize: 22, whisper: true });
              this.createHitEffect(boss.x, boss.y, 0x66ccff);
            }
          }

          // 3) 暗影印记叠层
          if (enh.markOnHit) {
            boss.shadowMarks = boss.shadowMarks || { stacks: 0, lastAt: 0 };
            boss.shadowMarks.stacks = Math.min(12, (boss.shadowMarks.stacks || 0) + enh.markOnHit);
            boss.shadowMarks.lastAt = now;
            const markText = this.scene.add.text(boss.x, boss.y + boss.bossSize + 8, `印记 x${boss.shadowMarks.stacks}`, {
              fontSize: '12px',
              color: '#caa6ff'
            }).setOrigin(0.5);
            this.scene.tweens.add({
              targets: markText,
              alpha: 0,
              y: markText.y + 18,
              duration: 420,
              onComplete: () => markText.destroy()
            });
          }

          // 4) 召唤物集火指令
          if (enh.petFocusOnHit && this.scene?.petManager?.commandFocus) {
            this.scene.petManager.commandFocus(boss);
          }
        }

        // 吸血
        this.player.onDealDamage(damageResult.amount);

        // 显示伤害数字（暴击固定红色；普通默认亮黄；毒弹可用绿色）
        const dmgOptions = { isCrit: damageResult.isCrit };
        if (bullet.hitEffectType === 'moonfire') {
          dmgOptions.color = '#88ffcc';
          dmgOptions.fontSize = 24;
          dmgOptions.whisper = true;
        } else if (bullet.poison) {
          dmgOptions.color = '#66ff99';
        }
        this.showDamageNumber(hitX, hitY, damageResult.amount, dmgOptions);

        // Warlock debuff on hit（旧系统）：仅在明确启用时触发
        // - bullet.poison: 来自“毒性附加/宠物减益”等
        // - scene.warlockDebuffEnabled: 场景侧显式开启“命中自动上毒”
        if (this.scene && this.scene.applyWarlockOnHit) {
          if (bullet.poison || this.scene.warlockDebuffEnabled) {
            this.scene.applyWarlockOnHit(boss, true);
          }
        }

        // 创建命中特效
        if (bullet.hitEffectType === 'moonfire') {
          this.createMoonfireRippleEffect(hitX, hitY);
        } else {
          const hitColor = bullet.hitEffectColor ?? (bullet.poison ? 0x66ff99 : (damageResult.isCrit ? 0xff3333 : 0xffff00));
          this.createHitEffect(hitX, hitY, hitColor);
        }

        // 爆破散射
        if (bullet.explode) {
          this.createHitEffect(hitX, hitY, 0xffaa66);
        }

        // 击退（投枪/盾击风味）
        if (bullet.knockback && boss && boss.isAlive) {
          const a = Phaser.Math.Angle.Between(bullet.x, bullet.y, boss.x, boss.y);
          boss.x += Math.cos(a) * bullet.knockback;
          boss.y += Math.sin(a) * bullet.knockback;
        }

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
            if (this.scene.bulletManager) {
              this.scene.bulletManager.destroyBullet(bullet, true);
            } else {
              bullet.destroy();
            }
          }
        }

        // 统计
        this.stats.bossHits++;

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
    const allBossBullets = this.scene.bulletManager?.getBossBullets() || [];

    const hittablePets = this.scene?.petManager?.getHittablePets?.() || [];
    
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
      if (hittablePets.length > 0) {
        for (let p = 0; p < hittablePets.length; p++) {
          const pet = hittablePets[p];
          if (!pet || !pet.active) continue;
          const petR = pet.hitRadius || 0;
          if (petR <= 0) continue;

          if (this.circleCollision(
            bullet.x, bullet.y, bulletRadius,
            pet.x, pet.y, petR
          )) {
            handledByPet = true;

            // 统一使用 10 点作为 Boss 子弹基础伤害（与玩家一致）
            const dmg = Math.max(0, Math.round(10 * bossDamageMult));
            pet.currentHp = Math.max(0, (pet.currentHp || 0) - dmg);

            if (this.scene?.petManager?.onPetDamaged) {
              this.scene.petManager.onPetDamaged(pet, dmg);
            }

            // 自然伙伴（熊系）：受击触发自然之怒 / 震地
            if (pet.petType === 'bear') {
              const rageLvl = this.player?.natureRageLevel || 0;
              if (rageLvl > 0) {
                const mult = 1.10 + 0.05 * (rageLvl - 1);
                this.player.natureRageUntil = now + 3000;
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

            // 命中特效与数字
            this.createBossBulletHitEffect(pet.x, pet.y, bullet);
            this.showDamageNumber(pet.x, pet.y - 30, dmg, { color: '#ffd6a5', fontSize: 20, whisper: true });

            // 销毁子弹
            if (this.scene.bulletManager) {
              this.scene.bulletManager.destroyBullet(bullet, false);
            } else {
              bullet.destroy();
            }

            // 宠物死亡：交给 PetManager 进入冷却并销毁
            if (pet.currentHp <= 0) {
              if (this.scene?.petManager?.onPetKilled) {
                this.scene.petManager.onPetKilled(pet.petType);
              } else if (pet.active) {
                pet.destroy();
              }
            }

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
        
        // 玩家被击中
        let incoming = Math.max(0, Math.round(10 * bossDamageMult)); // Boss 子弹伤害

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

        // 守护：反制（格挡成功后反击）
        if (this.player?.counterOnBlock && this.player?.lastDamageEvent?.blocked) {
          const b = this.bossManager?.getCurrentBoss?.();
          if (b && b.isAlive && !b.isInvincible) {
            const counter = Math.max(1, Math.round(this.player.bulletDamage || 1));
            b.takeDamage(counter, { attacker: this.player, source: 'counterOnBlock', suppressHitReaction: true });
            this.showDamageNumber(b.x, b.y - 44, counter, { color: '#88ccff', fontSize: 22, whisper: true });
            this.createHitEffect(b.x, b.y, 0x88ccff);
          }
        }

        // 战士反伤
        if (this.scene && this.scene.thornsPercent) {
          const boss = this.bossManager?.getCurrentBoss();
          if (boss && boss.isAlive) {
            const reflectDamage = Math.round(incoming * this.scene.thornsPercent);
            if (!boss.isInvincible) {
              boss.takeDamage(reflectDamage, { attacker: this.player, source: 'thorns', suppressHitReaction: true });
              this.showDamageNumber(boss.x, boss.y - 40, reflectDamage, '#ff9999');
            }
          }
        }
        
        // 创建命中特效（与子弹形状关联：尖锐=火花，圆钝=粉尘爆）
        this.createBossBulletHitEffect(playerPos.x, playerPos.y, bullet);
        
        // 通过BulletManager销毁子弹
        if (this.scene.bulletManager) {
          this.scene.bulletManager.destroyBullet(bullet, false);
        } else {
          bullet.destroy();
        }
        
        // 统计
        this.stats.playerHits++;
        
        if (isDead) {
          console.log('玩家死亡！');
          this.onPlayerDeath();
        }
        
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
    if (this.scene.bulletManager) {
      return this.scene.bulletManager.getBossBullets();
    }
    
    // 降级方案：直接从场景中查找
    const bullets = [];
    this.scene.children.list.forEach(child => {
      if (child.type === 'Arc' || child.type === 'Star' || child.type === 'Rectangle') {
        if (!child.isPlayerBullet && child.active) {
          if (!child.isBoss && !child.isPlayer) {
            bullets.push(child);
          }
        }
      }
    });
    
    return bullets;
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
