import Phaser from 'phaser';

const PET_TYPES = /** @type {const} */ ({
  bear: 'bear',
  hawk: 'hawk',
  treant: 'treant'
});

export default class PetManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;

    this.owned = new Set();
    this.active = new Map(); // type -> container
    this.cooldownUntil = new Map(); // type -> ms

    // 行为节奏
    this.bearAttackCd = 1250;
    this.hawkAttackCd = 520;
    this.treantHealCd = 3000;

    // 记录
    this.lastBearAttackAt = 0;
    this.lastHawkAttackAt = 0;
    this.lastTreantHealAt = 0;

    // 受击反馈
    this.lastPetHitAt = 0;
    this.lastPetHitType = null;

    this.focusUntil = 0;
    this.focusTarget = null;
  }

  commandFocus(target) {
    const now = this.scene.time?.now ?? 0;
    this.focusUntil = now + 1600;
    this.focusTarget = target || null;

    // 反馈：熊低吼（文本闪一下）
    const bear = this.active.get(PET_TYPES.bear);
    if (bear && bear.active) {
      const t = this.scene.add.text(bear.x, bear.y - 42, '吼！', { fontSize: '14px', color: '#88ffcc' }).setOrigin(0.5);
      this.scene.tweens.add({ targets: t, alpha: 0, y: t.y - 20, duration: 420, onComplete: () => t.destroy() });
    }
  }

  setPlayer(player) {
    this.player = player;
  }

  hasAnyPet() {
    return this.owned.size > 0;
  }

  isPetOwned(upgradeId) {
    const type = this.upgradeIdToType(upgradeId);
    if (!type) return false;
    return this.owned.has(type);
  }

  upgradeIdToType(upgradeId) {
    switch (upgradeId) {
      case 'druid_pet_bear':
        return PET_TYPES.bear;
      case 'druid_pet_hawk':
        return PET_TYPES.hawk;
      case 'druid_pet_treant':
        return PET_TYPES.treant;
      default:
        return null;
    }
  }

  unlockPetByUpgradeId(upgradeId) {
    const type = this.upgradeIdToType(upgradeId);
    if (!type) return false;

    if (!this.owned.has(type)) {
      this.owned.add(type);
    }

    // 立即尝试生成（若在冷却则等冷却结束自动回归）
    this.ensureSpawn(type);
    return true;
  }

  getTankPet() {
    const bear = this.active.get(PET_TYPES.bear);
    if (bear && bear.active && bear.currentHp > 0) return bear;
    return null;
  }

  getHealerPet() {
    const treant = this.active.get(PET_TYPES.treant);
    if (treant && treant.active && treant.currentHp > 0) return treant;
    return null;
  }

  getHittablePets() {
    const pets = [];
    for (const pet of this.active.values()) {
      if (!pet || !pet.active) continue;
      if ((pet.hitRadius || 0) <= 0) continue;
      if ((pet.currentHp || 0) <= 0) continue;
      pets.push(pet);
    }
    return pets;
  }

  getCurrentTarget() {
    const boss = this.scene?.bossManager?.getCurrentBoss?.();
    const now = this.scene.time?.now ?? 0;
    if (this.focusTarget && now < (this.focusUntil || 0) && this.focusTarget.active) {
      return this.focusTarget;
    }
    if (boss && boss.isAlive) return boss;
    return null;
  }

  ensureSpawn(type) {
    if (!this.player) return;

    const existing = this.active.get(type);
    if (existing && existing.active) return;

    const now = this.scene.time?.now ?? 0;
    const cd = this.cooldownUntil.get(type) || 0;
    if (now < cd) return;

    let pet = null;
    if (type === PET_TYPES.bear) pet = this.createBear();
    if (type === PET_TYPES.hawk) pet = this.createHawk();
    if (type === PET_TYPES.treant) pet = this.createTreant();

    if (pet) this.active.set(type, pet);
  }

  createBear() {
    const x = this.player.x - 18;
    const y = this.player.y + 26;

    const body = this.scene.add.circle(0, 0, 18, 0x6b4b2a, 1);
    body.setStrokeStyle(2, 0x3a2a18, 1);

    const snout = this.scene.add.circle(6, 4, 6, 0x8a623a, 1);
    snout.setStrokeStyle(1, 0x3a2a18, 0.9);

    const icon = this.scene.add.text(0, -28, '熊', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const pet = this.scene.add.container(x, y, [body, snout, icon]);
    pet.setDepth(6);

    pet.isPet = true;
    pet.petType = PET_TYPES.bear;
    pet.hitRadius = 16;

    const maxHp = Math.max(25, Math.round((this.player.maxHp || 100) * 0.85));
    pet.maxHp = maxHp;
    pet.currentHp = maxHp;

    pet.moveSpeed = 210;
    pet.chargeBonus = 1.35;

    // 嘲讽/硬扛：Boss 目标选择会优先它
    pet.threat = 1;

    // 近战攻击参数（慢速、高伤害、可暴击）
    pet.attackRange = 22;
    pet.damageMult = 1.05;
    pet.bossSeparation = 8;

    return pet;
  }

  createHawk() {
    const x = this.player.x;
    const y = this.player.y - 58;

    const wingL = this.scene.add.triangle(-10, 0, 0, 0, -18, 6, -18, -6, 0xaee8ff, 0.95);
    const wingR = this.scene.add.triangle(10, 0, 0, 0, 18, 6, 18, -6, 0xaee8ff, 0.95);
    const core = this.scene.add.circle(0, 0, 4, 0xffffff, 0.95);

    const icon = this.scene.add.text(0, -20, '鹰', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const pet = this.scene.add.container(x, y, [wingL, wingR, core, icon]);
    pet.setDepth(7);

    pet.isPet = true;
    pet.petType = PET_TYPES.hawk;
    pet.hitRadius = 0; // 不可被攻击

    pet.maxHp = 1;
    pet.currentHp = 1;

    pet.orbitRadius = 46;
    pet.orbitOmega = (Math.PI * 2) / 1400;
    pet.orbitPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    return pet;
  }

  createTreant() {
    const x = this.player.x + 22;
    const y = this.player.y + 26;

    const body = this.scene.add.rectangle(0, 0, 16, 18, 0x3fa35b, 0.95);
    body.setStrokeStyle(2, 0x1f5f34, 1);

    const leaf = this.scene.add.circle(0, -14, 8, 0x88ffcc, 0.85);
    leaf.setStrokeStyle(1, 0x1f5f34, 0.8);

    const icon = this.scene.add.text(0, -28, '树', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const pet = this.scene.add.container(x, y, [leaf, body, icon]);
    pet.setDepth(6);

    pet.isPet = true;
    pet.petType = PET_TYPES.treant;
    pet.hitRadius = 12;

    const maxHp = Math.max(10, Math.round((this.player.maxHp || 100) * 0.18));
    pet.maxHp = maxHp;
    pet.currentHp = maxHp;

    pet.followLerp = 0.12;

    pet.panicUntil = 0;
    pet.healPausedUntil = 0;

    return pet;
  }

  onPetDamaged(pet, damage) {
    if (!pet || !pet.active) return;

    const now = this.scene.time?.now ?? 0;
    this.lastPetHitAt = now;
    this.lastPetHitType = pet.petType;

    if (pet.petType === PET_TYPES.treant) {
      pet.panicUntil = Math.max(pet.panicUntil || 0, now + 2200);
      pet.healPausedUntil = Math.max(pet.healPausedUntil || 0, now + 2200);

      // 轻微闪白
      this.scene.tweens.add({
        targets: pet,
        alpha: { from: 1, to: 0.6 },
        duration: 90,
        yoyo: true,
        repeat: 2
      });
    }
  }

  onPetKilled(type) {
    const now = this.scene.time?.now ?? 0;
    if (type === PET_TYPES.bear) {
      this.cooldownUntil.set(type, now + 7000);
    } else if (type === PET_TYPES.treant) {
      const rebornLvl = this.player?.natureTreantRebornLevel || 0;
      const cd = Math.max(3000, Math.round(9000 * (1 - 0.18 * rebornLvl)));
      this.cooldownUntil.set(type, now + cd);
    }

    const existing = this.active.get(type);
    if (existing && existing.active) existing.destroy();
    this.active.delete(type);
  }

  update(time, delta) {
    if (!this.player) return;

    // 自动回归（冷却结束）
    for (const type of this.owned.values()) {
      this.ensureSpawn(type);
    }

    // 更新每个宠物
    const target = this.getCurrentTarget();

    for (const [type, pet] of this.active.entries()) {
      if (!pet || !pet.active) {
        this.active.delete(type);
        continue;
      }

      if (type === PET_TYPES.hawk) {
        this.updateHawk(pet, target, time, delta);
      } else if (type === PET_TYPES.bear) {
        this.updateBear(pet, target, time, delta);
      } else if (type === PET_TYPES.treant) {
        this.updateTreant(pet, target, time, delta);
      }
    }
  }

  updateBear(pet, target, time, delta) {
    // 跟随/冲锋到目标
    const dx = (target ? target.x : this.player.x) - pet.x;
    const dy = (target ? target.y : this.player.y) - pet.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const speed = pet.moveSpeed;
    const step = (speed * (delta / 1000));

    // 冲锋感：距离较远时更快
    const mult = dist > 220 ? pet.chargeBonus : 1;

    pet.x += (dx / dist) * step * mult;
    pet.y += (dy / dist) * step * mult;

    if (target && target.isAlive) {
      // 不允许与 Boss 重叠：保持最小分离距离
      const minDist = (target.bossSize || 0) + (pet.hitRadius || 0) + (pet.bossSeparation || 0);
      if (dist > 0 && dist < minDist) {
        pet.x = target.x + (dx / dist) * minDist;
        pet.y = target.y + (dy / dist) * minDist;
      }

      pet.rotation = Phaser.Math.Angle.Between(pet.x, pet.y, target.x, target.y);

      // 近身攻击：在“分离圈”附近也能打到
      const attackRange = minDist + (pet.attackRange || 18);
      const focusMult = (this.focusUntil && time < this.focusUntil) ? 0.75 : 1;
      if (dist <= attackRange && time - this.lastBearAttackAt >= this.bearAttackCd * focusMult) {
        this.lastBearAttackAt = time;
        if (!target.isInvincible) {
          const base = Math.max(1, Math.round((this.player.bulletDamage || 30) * (pet.damageMult || 1)));
          const damageResult = this.player?.calculateDamage ? this.player.calculateDamage(base) : { amount: base, isCrit: false };
          target.takeDamage(damageResult.amount);
          this.scene.showDamageNumber(target.x, target.y - 42, damageResult.amount, { isCrit: damageResult.isCrit, color: '#ffdd88', fontSize: 26 });

          // 轻微撞击特效
          const puff = this.scene.add.circle(target.x, target.y, 10, 0xffcc88, 0.45);
          this.scene.tweens.add({
            targets: puff,
            alpha: 0,
            scale: 2.1,
            duration: 220,
            onComplete: () => puff.destroy()
          });
        }
      }
    }
  }

  updateHawk(pet, target, time, delta) {
    const now = time;
    // 盘旋在玩家头顶
    const t = time;
    const angle = pet.orbitPhase + pet.orbitOmega * t;

    const desiredX = this.player.x + Math.cos(angle) * pet.orbitRadius;
    const desiredY = this.player.y - 72 + Math.sin(angle) * (pet.orbitRadius * 0.45);

    pet.x = Phaser.Math.Linear(pet.x, desiredX, 0.22);
    pet.y = Phaser.Math.Linear(pet.y, desiredY, 0.22);

    if (!target || !target.isAlive) return;

    // 100% 命中：直接结算伤害（超快弹道风味）
    const focusMult = (this.focusUntil && time < this.focusUntil) ? 0.75 : 1;
    if (time - this.lastHawkAttackAt >= this.hawkAttackCd * focusMult) {
      this.lastHawkAttackAt = time;
      if (!target.isInvincible) {
        const dmg = Math.max(1, Math.round((this.player.bulletDamage || 30) * 0.22));
        target.takeDamage(dmg);
        this.scene.showDamageNumber(target.x, target.y - 34, dmg, { color: '#aee8ff', fontSize: 22, whisper: true });

        // 鹰系：猎手标记（提高玩家对 Boss 伤害）
        const markLvl = this.player?.natureHuntMarkLevel || 0;
        if (markLvl > 0) {
          target.debuffs = target.debuffs || {};
          target.debuffs.huntMarkEnd = now + (3500 + 500 * (markLvl - 1));
          target.debuffs.huntMarkMult = 1.10 + 0.03 * (markLvl - 1);
        }

        // 鹰系：风刃（周期性追加伤害）
        const windLvl = this.player?.natureWindSlashLevel || 0;
        if (windLvl > 0) {
          const cd = Math.max(2600, 5200 - windLvl * 700);
          this._windSlashNextAt = this._windSlashNextAt || (now + cd);
          if (now >= this._windSlashNextAt) {
            this._windSlashNextAt = now + cd;
            const extra = Math.max(1, Math.round((this.player.bulletDamage || 30) * (0.28 + 0.06 * (windLvl - 1))));
            target.takeDamage(extra);
            this.scene.showDamageNumber(target.x, target.y - 18, extra, { color: '#d7f6ff', fontSize: 20, whisper: true });
            if (this.scene.createHitEffect) this.scene.createHitEffect(target.x, target.y, 0xaee8ff);
          }
        }

        // 鹰系：天降（概率触发额外打击）
        const skyLvl = this.player?.natureSkyCallLevel || 0;
        if (skyLvl > 0) {
          const chance = Math.min(0.5, 0.12 + 0.05 * (skyLvl - 1));
          if (Math.random() < chance) {
            const extra = Math.max(1, Math.round((this.player.bulletDamage || 30) * (0.45 + 0.08 * (skyLvl - 1))));
            target.takeDamage(extra);
            this.scene.showDamageNumber(target.x, target.y - 52, extra, { color: '#ffffff', fontSize: 22, whisper: true });
            if (this.scene.createHitEffect) this.scene.createHitEffect(target.x, target.y, 0xffffff);
          }
        }

        // 一道极短的“啄击光线”
        const line = this.scene.add.line(0, 0, pet.x, pet.y, target.x, target.y, 0xaee8ff, 0.55);
        line.setLineWidth(2, 2);
        line.setDepth(5);
        this.scene.tweens.add({
          targets: line,
          alpha: 0,
          duration: 90,
          onComplete: () => line.destroy()
        });
      }
    }
  }

  updateTreant(pet, target, time, delta) {
    const now = time;

    // 跟随玩家（被攻击时惊慌：更慢、更抖）
    const inPanic = now < (pet.panicUntil || 0);
    const lerp = inPanic ? 0.045 : (pet.followLerp || 0.12);

    let desiredX = this.player.x + 26;
    let desiredY = this.player.y + 30;

    if (inPanic) {
      desiredX += Phaser.Math.Between(-10, 10);
      desiredY += Phaser.Math.Between(-6, 6);
    }

    pet.x = Phaser.Math.Linear(pet.x, desiredX, lerp);
    pet.y = Phaser.Math.Linear(pet.y, desiredY, lerp);

    // 治疗（被攻击时暂停）
    if (now < (pet.healPausedUntil || 0)) return;

    // 树精：回春（影响治疗节奏）
    const regenLvl = this.player?.natureTreantRegenLevel || 0;
    this.treantHealCd = Math.max(1800, Math.round(3000 * (1 - 0.10 * regenLvl)));

    if (now - this.lastTreantHealAt >= this.treantHealCd) {
      this.lastTreantHealAt = now;
      const amount = 3 + regenLvl;
      if (this.player?.heal) {
        this.player.heal(amount);
        this.scene.showDamageNumber(this.player.x, this.player.y - 60, `+${amount}`, { color: '#88ffcc', fontSize: 22, whisper: true });

        const ring = this.scene.add.circle(this.player.x, this.player.y, 16, 0x88ffcc, 0.12);
        ring.setStrokeStyle(2, 0x88ffcc, 0.35);
        this.scene.tweens.add({
          targets: ring,
          alpha: 0,
          scale: 2.2,
          duration: 300,
          onComplete: () => ring.destroy()
        });

        // 树精：萌芽（治疗时概率给护盾）
        const summonLvl = this.player?.natureTreantSummonLevel || 0;
        if (summonLvl > 0 && this.player?.updateShieldIndicator) {
          const chance = Math.min(0.65, 0.15 + 0.10 * (summonLvl - 1));
          if (Math.random() < chance) {
            this.player.shieldCharges = (this.player.shieldCharges || 0) + 1;
            this.player.updateShieldIndicator();
          }
        }

        // 树精：缠绕（治疗时概率短暂定身 Boss）
        const rootLvl = this.player?.natureTreantRootLevel || 0;
        if (rootLvl > 0) {
          const boss = this.scene?.bossManager?.getCurrentBoss?.();
          const chance = Math.min(0.55, 0.10 + 0.05 * (rootLvl - 1));
          if (boss && boss.isAlive && typeof boss.applyStun === 'function' && Math.random() < chance) {
            boss.applyStun(400);
          }
        }
      }
    }
  }

  destroy() {
    for (const pet of this.active.values()) {
      if (pet && pet.active) pet.destroy();
    }
    this.active.clear();
    this.owned.clear();
    this.cooldownUntil.clear();
  }
}

export { PET_TYPES };
