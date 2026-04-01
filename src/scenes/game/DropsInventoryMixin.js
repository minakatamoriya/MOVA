import Phaser from 'phaser';
import { getEquippedSupportSummary, getItemById } from '../../data/items';
import { getCoinMagnetConfig, rollBossCoinDrops } from '../../data/currencyConfig';
import { calculateResolvedDamage, combineStatMods, normalizeStatMods } from '../../combat/damageModel';
import { formatLootEffectLines, formatLootPickupLine, getLootRarity, getLootSourceProfile, rollLootEquipment } from '../../data/lootItems';

/**
 * 掉落物/背包 相关方法
 */
export function applyDropsInventoryMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    applyEquippedEffects() {
      if (!this.player) return;

      // 装备区先把所有加成聚合成一份结构，再统一交给玩家派生属性刷新
      const mods = {
        damageMult: 1,
        fireRateMult: 1,
        speedMult: 1,
        rangeMult: 1,
        maxHpFlat: 0,
        critChance: 0,
        critMultiplier: 0,
        lifestealPercent: 0,
        magnetRadius: 0,
        shieldCharges: 0,
        dodgeChance: 0,
        regenPerSec: 0,
        damageReductionPercent: 0,
        blockChance: 0
      };

      this.inventoryEquipped.forEach((item) => {
        if (!item || !item.effects) return;
        if (item.effects.damageMult) mods.damageMult *= item.effects.damageMult;
        if (item.effects.fireRateMult) mods.fireRateMult *= item.effects.fireRateMult;
        if (item.effects.speedMult) mods.speedMult *= item.effects.speedMult;
        if (item.effects.rangeMult) mods.rangeMult *= item.effects.rangeMult;
        if (item.effects.critChance) mods.critChance += item.effects.critChance;
        if (item.effects.critMultiplier) mods.critMultiplier += item.effects.critMultiplier;
        if (item.effects.lifestealPercent) mods.lifestealPercent += item.effects.lifestealPercent;
        if (item.effects.magnetRadius) mods.magnetRadius += item.effects.magnetRadius;
        if (item.effects.shieldCharges) mods.shieldCharges += item.effects.shieldCharges;
        if (item.effects.dodgeChance) mods.dodgeChance += item.effects.dodgeChance;
        if (item.effects.maxHpFlat) mods.maxHpFlat += item.effects.maxHpFlat;
        if (item.effects.regenPerSec) mods.regenPerSec += item.effects.regenPerSec;
        if (item.effects.damageReductionPercent) mods.damageReductionPercent += item.effects.damageReductionPercent;
        if (item.effects.blockChance) mods.blockChance += item.effects.blockChance;
      });

      // 规范化后可同时兼容伤害、攻速、范围和各种附加属性
      const resolvedMods = normalizeStatMods(mods);
      const combinedMods = combineStatMods(resolvedMods, this.player.runLootMods || {});
      this.player.applyStatMultipliers(resolvedMods);
      this.player.applyEquipmentEffects(combinedMods);
    },

    ensureRunLootState() {
      if (!Array.isArray(this._runLootGearItems)) this._runLootGearItems = [];
      if (!Number.isFinite(this._runLootItemSeq)) this._runLootItemSeq = 0;
    },

    nextRunLootItemInstanceId(baseId = 'loot') {
      this.ensureRunLootState();
      this._runLootItemSeq += 1;
      return `runloot_${baseId}_${this._runLootItemSeq}`;
    },

    rebuildRunLootInventory() {
      this.ensureRunLootState();

      const mergedGearMap = new Map();
      [...this._runLootGearItems].forEach((item) => {
        const key = `${item?.baseId || item?.id || 'loot'}::${item?.rarityId || 'common'}`;
        if (!mergedGearMap.has(key)) {
          mergedGearMap.set(key, {
            ...item,
            count: 1,
            mergedInstanceIds: [item?.instanceId || item?.id]
          });
          return;
        }

        const entry = mergedGearMap.get(key);
        entry.count = Math.max(1, Number(entry.count || 1) + 1);
        entry.mergedInstanceIds = [...(entry.mergedInstanceIds || []), item?.instanceId || item?.id];
        entry.desc = `${item?.rarityLabel || ''} ${item?.categoryLabel || ''}装备 x${entry.count}`.trim();
        entry.shortDesc = `${(item?.shortDesc || '').trim()} ×${entry.count}`.trim();
        entry.statLines = Array.isArray(item?.statLines) ? [...item.statLines] : [];
      });

      const gearItems = [...mergedGearMap.values()]
        .sort((left, right) => {
          const rarityDiff = Number(right?.raritySort || 0) - Number(left?.raritySort || 0);
          if (rarityDiff !== 0) return rarityDiff;
          const orderDiff = Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);
          if (orderDiff !== 0) return orderDiff;
          return String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-Hans-CN');
        });

      this.inventoryAcquired = [...gearItems];
    },

    applyRunLootBonuses() {
      const p = this.player;
      if (!p) return;

      this.ensureRunLootState();

      const gearMods = this._runLootGearItems.map((item) => normalizeStatMods(item?.effects || {}));

      p.runLootMods = combineStatMods(...gearMods);
      this.applyEquippedEffects();
      this.events.emit('updatePlayerInfo');
    },

    rollAndSpawnEquipmentDrops(source, x, y, options = {}) {
      this.ensureRunLootState();
      const profile = getLootSourceProfile(source);
      const equippedIds = Array.isArray(this.registry?.get?.('equippedItems')) ? this.registry.get('equippedItems') : [];
      const support = getEquippedSupportSummary(equippedIds);
      const rng = typeof options.rng === 'function' ? options.rng : Math.random;
      const count = Math.max(
        0,
        Number.isFinite(options.count)
          ? Number(options.count)
          : Phaser.Math.Between(profile.minCount, profile.maxCount) + (source === 'boss' ? Number(support.bossExtraDropCount || 0) : 0)
      );
      const dropChance = Phaser.Math.Clamp(Number(profile.dropChance || 0) + Number(support.lootDropChanceBonus || 0), 0, 1);
      const rarityWeights = (Array.isArray(profile.rarityWeights) ? profile.rarityWeights : []).map((entry) => ({
        id: entry.id,
        weight: Math.max(0, Number(entry.weight || 0) + Number(support.rarityWeightBonus?.[entry.id] || 0))
      }));
      let spawned = 0;

      const pickRarityId = () => {
        const totalWeight = rarityWeights.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight || 0)), 0);
        if (totalWeight <= 0) return null;
        let roll = rng() * totalWeight;
        for (let i = 0; i < rarityWeights.length; i += 1) {
          roll -= Math.max(0, Number(rarityWeights[i].weight || 0));
          if (roll <= 0) return rarityWeights[i].id;
        }
        return rarityWeights[rarityWeights.length - 1]?.id || null;
      };

      if (source === 'boss') {
        const guaranteedLegendary = rollLootEquipment({
          source,
          rng,
          instanceId: this.nextRunLootItemInstanceId(source),
          rarityId: 'legendary'
        });
        if (guaranteedLegendary) {
          const burst = this.createBossDropBurstProfile(0, Math.max(1, count + 1), { speedMin: 300, speedMax: 420, scatterRadius: 86 });
          this.spawnItemDrop(
            x + burst.offsetX,
            y + burst.offsetY,
            guaranteedLegendary,
            { source, launchAngle: burst.angle, launchSpeed: burst.speed }
          );
          spawned += 1;
        }
      }

      for (let index = 0; index < count; index += 1) {
        if (rng() > dropChance) continue;
        const item = rollLootEquipment({
          source,
          rng,
          instanceId: this.nextRunLootItemInstanceId(source),
          rarityId: pickRarityId() || undefined
        });
        if (!item) continue;
        if (source === 'boss') {
          const burst = this.createBossDropBurstProfile(index + 1, Math.max(2, count + 1), { speedMin: 260, speedMax: 380, scatterRadius: 104 });
          this.spawnItemDrop(
            x + burst.offsetX,
            y + burst.offsetY,
            item,
            { source, launchAngle: burst.angle, launchSpeed: burst.speed }
          );
        } else {
          this.spawnItemDrop(
            x + Phaser.Math.Between(-68, 68),
            y + Phaser.Math.Between(-28, 40),
            item,
            { source }
          );
        }
        spawned += 1;
      }

      return spawned;
    },

    testAttackBoss(pointer) {
      const boss = this.bossManager.getCurrentBoss();
      if (boss && boss.isAlive) {
        if (boss.isInvincible) return;
        const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, boss.x, boss.y);
        if (distance < boss.bossSize + 20) {
          // 调试伤害也复用统一结算，方便直接验证 debuff/承伤是否生效
          const damageResult = calculateResolvedDamage({ attacker: this.player, target: boss, baseDamage: 100, now: this.time?.now ?? 0, canCrit: false });
          boss.takeDamage(damageResult.amount);
          this.showDamageNumber(boss.x, boss.y - 60, damageResult.amount);
        }
      }
    },

    spawnBossDrops(boss) {
      if (!boss) return;

      const dropX = boss.x;
      const dropY = boss.y + 20;

      const bossCoinDrops = rollBossCoinDrops({ stage: this.currentStage || 1, rng: Math.random });
      const totalBossDrops = bossCoinDrops.coins.length + bossCoinDrops.bags.length + Phaser.Math.Between(2, 3);
      bossCoinDrops.coins.forEach((amount, index) => {
        const burst = this.createBossDropBurstProfile(index, Math.max(1, totalBossDrops), { speedMin: 170, speedMax: 230, scatterRadius: 26 });
        this.spawnCoinDrop(
          dropX + burst.offsetX,
          dropY + burst.offsetY,
          amount,
          { launchAngle: burst.angle, launchSpeed: burst.speed }
        );
      });
      bossCoinDrops.bags.forEach((amount, index) => {
        const burst = this.createBossDropBurstProfile(index + bossCoinDrops.coins.length, Math.max(1, totalBossDrops), { speedMin: 120, speedMax: 180, scatterRadius: 22 });
        this.spawnCoinBagDrop(
          dropX + burst.offsetX,
          dropY + burst.offsetY,
          amount,
          { launchAngle: burst.angle, launchSpeed: burst.speed }
        );
      });

      this.rollAndSpawnEquipmentDrops('boss', dropX, dropY, {
        count: totalBossDrops - bossCoinDrops.coins.length - bossCoinDrops.bags.length
      });
    },

    spawnCoinDrop(x, y, amount, options = {}) {
      const glow = this.add.circle(0, 0, 18, 0xffd766, 0.16);
      const outer = this.add.circle(0, 0, 11, 0xffd54f, 1);
      outer.setStrokeStyle(2, 0xfff8d6, 0.9);
      const inner = this.add.circle(0, 0, 7, 0xfff2a8, 0.92);
      const shine = this.add.circle(-3, -3, 3, 0xffffff, 0.35);
      const mark = this.add.text(0, 0, 'G', {
        fontSize: '12px',
        color: '#7a4a00',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const sparkA = this.add.circle(-10, -9, 2, 0xfff0a8, 0.80);
      const sparkB = this.add.circle(12, -6, 1.6, 0xffffff, 0.75);

      const coin = this.add.container(x, y, [glow, sparkA, sparkB, outer, inner, shine, mark]);
      const shadow = this.createDropShadow(x, y + 10, 'coin');

      coin.setScale(0.6);
      this.tweens.add({ targets: coin, scale: 1, duration: 220, ease: 'Back.Out' });
      this.tweens.add({ targets: glow, alpha: { from: 0.10, to: 0.30 }, duration: 540, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: [sparkA, sparkB], alpha: { from: 0.25, to: 1 }, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: coin, angle: { from: -5, to: 5 }, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

      const a = Number.isFinite(options.launchAngle) ? Number(options.launchAngle) : Phaser.Math.FloatBetween(0, Math.PI * 2);
      const sp = Number.isFinite(options.launchSpeed) ? Number(options.launchSpeed) : Phaser.Math.Between(70, 150);
      const vx = Math.cos(a) * sp;
      const vy = Math.sin(a) * sp;

      const spawnData = {
        type: 'coin',
        amount,
        sprite: coin,
        velocity: { x: vx, y: vy },
        shadow,
        spawnX: x,
        spawnY: y,
        bornAt: this.time?.now ?? 0,
        maxDrift: 110,
        launch: this.createDropLaunchProfile(x, y, { x: vx, y: vy }, { maxDrift: 110, isBossDrop: false })
      };

      this.drops.push(spawnData);
    },

    spawnCoinBagDrop(x, y, amount, options = {}) {
      const glow = this.add.circle(0, 8, 28, 0xffb84d, 0.14);
      const body = this.add.ellipse(0, 2, 34, 38, 0x7a4a1b, 0.98);
      body.setStrokeStyle(3, 0xf3cd7b, 0.95);
      const tie = this.add.rectangle(0, -10, 18, 8, 0xf7df98, 0.96);
      const tieKnot = this.add.circle(0, -12, 4, 0xfff6c8, 0.95);
      const emblem = this.add.text(0, 6, '¥', {
        fontSize: '16px',
        color: '#fff2b3',
        fontStyle: 'bold',
        stroke: '#4a2a00',
        strokeThickness: 3
      }).setOrigin(0.5);
      const sparkleA = this.add.circle(-16, -14, 2, 0xfff1a8, 0.85);
      const sparkleB = this.add.circle(14, -12, 2, 0xffffff, 0.75);

      const bag = this.add.container(x, y, [glow, sparkleA, sparkleB, body, tie, tieKnot, emblem]);
      const shadow = this.createDropShadow(x, y + 12, 'bag');
      bag.setScale(0.72);
      bag.setDepth(18);

      this.tweens.add({ targets: bag, scale: 1, duration: 260, ease: 'Back.Out' });
      const hoverTween = this.tweens.add({ targets: bag, y: y - 7, duration: 920, yoyo: true, repeat: -1, ease: 'Sine.InOut', paused: true });
      this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.30 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

      const a = Number.isFinite(options.launchAngle) ? Number(options.launchAngle) : Phaser.Math.FloatBetween(0, Math.PI * 2);
      const sp = Number.isFinite(options.launchSpeed) ? Number(options.launchSpeed) : Phaser.Math.Between(50, 90);
      const spawnData = {
        type: 'coin_bag',
        amount,
        sprite: bag,
        velocity: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
        shadow,
        spawnX: x,
        spawnY: y,
        bornAt: this.time?.now ?? 0,
        maxDrift: 120,
        launch: this.createDropLaunchProfile(x, y, { x: Math.cos(a) * sp, y: Math.sin(a) * sp }, { maxDrift: 120, isBossDrop: false }),
        hoverTween
      };

      this.drops.push(spawnData);
    },

    showCoinCollectFx(x, y, amount, variant = 'coin') {
      const color = variant === 'coin_bag' ? 0xffb84d : 0xffd766;
      const ring = this.add.circle(x, y, variant === 'coin_bag' ? 18 : 12, color, 0.18).setDepth(22);
      ring.setStrokeStyle(variant === 'coin_bag' ? 4 : 3, 0xfff2b3, 0.92);

      const burst = this.add.text(x, y - 6, `+${Math.max(0, Math.round(Number(amount || 0)))}`, {
        fontSize: variant === 'coin_bag' ? '22px' : '18px',
        color: '#ffe7a8',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(23);

      this.tweens.add({
        targets: ring,
        scale: variant === 'coin_bag' ? 3.2 : 2.3,
        alpha: 0,
        duration: variant === 'coin_bag' ? 420 : 260,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy()
      });
      this.tweens.add({
        targets: burst,
        y: y - (variant === 'coin_bag' ? 54 : 34),
        alpha: 0,
        duration: variant === 'coin_bag' ? 720 : 480,
        ease: 'Cubic.Out',
        onComplete: () => burst.destroy()
      });
    },

    createBossDropBurstProfile(index, total, options = {}) {
      const count = Math.max(1, Number(total || 1));
      const speedMin = Number(options.speedMin || 160);
      const speedMax = Math.max(speedMin, Number(options.speedMax || speedMin + 40));
      const scatterRadius = Math.max(0, Number(options.scatterRadius || 18));
      const baseAngle = (Math.PI * 2 * index) / count;
      const jitter = Phaser.Math.FloatBetween(-0.18, 0.18);
      const radius = Phaser.Math.Between(0, scatterRadius);
      return {
        angle: baseAngle + jitter,
        speed: Phaser.Math.Between(speedMin, speedMax),
        offsetX: Math.cos(baseAngle) * radius,
        offsetY: Math.sin(baseAngle) * radius * 0.6
      };
    },

    createDropShadow(x, y, type = 'coin') {
      const size = type === 'item' ? { w: 34, h: 13, alpha: 0.24 } : (type === 'bag' ? { w: 26, h: 10, alpha: 0.16 } : { w: 18, h: 8, alpha: 0.14 });
      const shadow = this.add.ellipse(x, y, size.w, size.h, 0x000000, size.alpha);
      shadow.setDepth(12);
      return shadow;
    },

    playDropLandFx(x, y, type = 'coin', rarity = null) {
      const color = type === 'item'
        ? (rarity?.beamColor || 0xb56cff)
        : (type === 'coin_bag' ? 0xffc35e : 0xffe08a);
      const ring = this.add.ellipse(x, y + 3, type === 'item' ? 28 : 18, type === 'item' ? 12 : 8, color, 0.14).setDepth(14);
      ring.setStrokeStyle(type === 'item' ? 2 : 1.5, 0xffffff, 0.7);
      this.tweens.add({
        targets: ring,
        scaleX: type === 'item' ? 2.1 : 1.8,
        scaleY: type === 'item' ? 1.9 : 1.5,
        alpha: 0,
        duration: type === 'item' ? 240 : 180,
        ease: 'Quad.Out',
        onComplete: () => ring.destroy()
      });
    },

    createDropLaunchProfile(x, y, velocity, options = {}) {
      const maxDrift = Math.max(24, Number(options.maxDrift || 100));
      const isBossDrop = options.isBossDrop === true;
      const vx = Number(velocity?.x || 0);
      const vy = Number(velocity?.y || 0);
      const speed = Math.sqrt(vx * vx + vy * vy) || 1;
      const nx = vx / speed;
      const ny = vy / speed;
      const travel = Math.min(maxDrift * 0.78, Math.max(30, speed * (isBossDrop ? 0.34 : 0.26)));

      return {
        active: true,
        elapsedMs: 0,
        durationMs: isBossDrop ? Phaser.Math.Between(460, 620) : Phaser.Math.Between(320, 460),
        startX: x,
        startY: y,
        endX: x + nx * travel,
        endY: y + ny * travel,
        peakHeight: isBossDrop ? Phaser.Math.Between(54, 82) : Phaser.Math.Between(26, 44)
      };
    },

    playItemDropSpawnFx(x, y, rarity, options = {}) {
      const source = options?.source || 'minion';
      const isBossDrop = source === 'boss';
      const burstColor = rarity?.beamColor || rarity?.color || 0xffffff;
      const ring = this.add.circle(x, y, isBossDrop ? 18 : 14, burstColor, isBossDrop ? 0.22 : 0.16).setDepth(24);
      ring.setStrokeStyle(isBossDrop ? 4 : 3, 0xffffff, 0.9);
      this.tweens.add({
        targets: ring,
        scale: isBossDrop ? 4.6 : 3.2,
        alpha: 0,
        duration: isBossDrop ? 440 : 320,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy()
      });

      const rayCount = isBossDrop ? 8 : 5;
      for (let index = 0; index < rayCount; index += 1) {
        const angle = (Math.PI * 2 * index) / rayCount + Phaser.Math.FloatBetween(-0.16, 0.16);
        const len = isBossDrop ? Phaser.Math.Between(68, 126) : Phaser.Math.Between(38, 78);
        const ray = this.add.rectangle(x, y, 3, len, burstColor, isBossDrop ? 0.34 : 0.24).setDepth(24);
        ray.setAngle(Phaser.Math.RadToDeg(angle));
        ray.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: ray,
          alpha: 0,
          scaleY: { from: 0.3, to: 1.25 },
          duration: isBossDrop ? 360 : 260,
          ease: 'Cubic.Out',
          onComplete: () => ray.destroy()
        });
      }
    },

    spawnItemDrop(x, y, item, options = {}) {
      const rarity = getLootRarity(item?.rarityId || 'common');
      const source = options?.source || item?.source || 'minion';
      let container = null;

      if (item?.kind === 'run_loot_equipment') {
        const beamColor = rarity.id === 'legendary' ? 0xff9f2e : (rarity.id === 'epic' ? 0xb56cff : rarity.beamColor);
        const groundRing = (rarity.id === 'epic' || rarity.id === 'legendary')
          ? this.add.ellipse(0, 18, rarity.id === 'legendary' ? 72 : 58, rarity.id === 'legendary' ? 24 : 18, beamColor, rarity.id === 'legendary' ? 0.28 : 0.22)
          : null;
        const groundGlow = (rarity.id === 'epic' || rarity.id === 'legendary')
          ? this.add.ellipse(0, 18, rarity.id === 'legendary' ? 118 : 88, rarity.id === 'legendary' ? 34 : 26, beamColor, rarity.id === 'legendary' ? 0.14 : 0.10)
          : null;
        const runeOuter = (rarity.id === 'epic' || rarity.id === 'legendary')
          ? this.add.ellipse(0, 18, rarity.id === 'legendary' ? 82 : 64, rarity.id === 'legendary' ? 28 : 22, beamColor, 0)
          : null;
        const runeInner = (rarity.id === 'epic' || rarity.id === 'legendary')
          ? this.add.ellipse(0, 18, rarity.id === 'legendary' ? 48 : 36, rarity.id === 'legendary' ? 15 : 11, beamColor, 0)
          : null;
        const flareH = rarity.id === 'legendary'
          ? this.add.rectangle(0, 18, 76, 3, 0xffe1a3, 0.20)
          : null;
        const flareV = rarity.id === 'legendary'
          ? this.add.rectangle(0, 18, 3, 34, 0xffd26e, 0.18)
          : null;
        const aura = this.add.circle(0, 0, 24, rarity.auraColor, rarity.id === 'legendary' ? 0.22 : 0.15);
        aura.setStrokeStyle(2, rarity.borderColor, 0.55);

        if (runeOuter?.setStrokeStyle) runeOuter.setStrokeStyle(rarity.id === 'legendary' ? 2 : 1, rarity.borderColor, rarity.id === 'legendary' ? 0.55 : 0.42);
        if (runeInner?.setStrokeStyle) runeInner.setStrokeStyle(1, rarity.borderColor, rarity.id === 'legendary' ? 0.42 : 0.34);

        if (groundRing) groundRing.setBlendMode(Phaser.BlendModes.ADD);
        if (groundGlow) groundGlow.setBlendMode(Phaser.BlendModes.ADD);
        if (runeOuter) runeOuter.setBlendMode(Phaser.BlendModes.ADD);
        if (runeInner) runeInner.setBlendMode(Phaser.BlendModes.ADD);
        if (flareH) flareH.setBlendMode(Phaser.BlendModes.ADD);
        if (flareV) flareV.setBlendMode(Phaser.BlendModes.ADD);

        const base = this.add.rectangle(0, 6, 34, 22, rarity.bgColor, 0.96);
        base.setStrokeStyle(2, rarity.borderColor, 1);
        const lid = this.add.rectangle(0, -8, 30, 12, rarity.color, 0.92);
        lid.setStrokeStyle(2, rarity.borderColor, 1);
        const clasp = this.add.rectangle(0, 1, 8, 10, 0xf9e7a8, 0.95);
        const icon = this.add.text(0, -2, item?.icon || '✦', {
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
        const name = this.add.text(0, 26, item?.name || '', {
          fontSize: '11px',
          color: rarity.textColor,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center'
        }).setOrigin(0.5);
        const showGroundName = rarity.id === 'epic' || rarity.id === 'legendary';
        name.setAlpha(showGroundName ? 0.92 : 0);
        name.setVisible(showGroundName);

        const shimmerA = (rarity.id === 'legendary' || rarity.id === 'epic')
          ? this.add.rectangle(-10, -34, 2, rarity.id === 'legendary' ? 88 : 72, rarity.id === 'legendary' ? 0xffd26e : 0xd5a9ff, rarity.id === 'legendary' ? 0.24 : 0.20).setAngle(-12)
          : null;
        const shimmerB = (rarity.id === 'legendary' || rarity.id === 'epic')
          ? this.add.rectangle(10, -32, 2, rarity.id === 'legendary' ? 80 : 64, rarity.id === 'legendary' ? 0xfff0a0 : 0xf0d6ff, rarity.id === 'legendary' ? 0.20 : 0.18).setAngle(14)
          : null;
        const moteCount = rarity.id === 'legendary' ? 4 : (rarity.id === 'epic' ? 3 : 0);
        const motes = new Array(moteCount).fill(null).map((_, index) => {
          const radius = rarity.id === 'legendary' ? 2.4 : 2;
          const px = -18 + index * 12;
          const py = rarity.id === 'legendary' ? -12 - index * 10 : -6 - index * 8;
          const mote = this.add.circle(px, py, radius, beamColor, rarity.id === 'legendary' ? 0.9 : 0.75);
          mote.setBlendMode(Phaser.BlendModes.ADD);
          return mote;
        });

        container = this.add.container(x, y, [groundGlow, flareH, flareV, runeOuter, runeInner, groundRing, aura, shimmerA, shimmerB, ...motes, base, lid, clasp, icon, name].filter(Boolean));
        aura.setBlendMode(Phaser.BlendModes.ADD);

        if (rarity.id !== 'common') {
          this.tweens.add({
            targets: aura,
            alpha: { from: 0.12, to: rarity.id === 'legendary' ? 0.35 : 0.22 },
            duration: rarity.id === 'legendary' ? 560 : 880,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (groundRing) {
          this.tweens.add({
            targets: groundRing,
            alpha: { from: rarity.id === 'legendary' ? 0.14 : 0.10, to: rarity.id === 'legendary' ? 0.30 : 0.22 },
            scaleX: { from: 0.94, to: 1.08 },
            scaleY: { from: 0.94, to: 1.12 },
            duration: rarity.id === 'legendary' ? 480 : 760,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (groundGlow) {
          this.tweens.add({
            targets: groundGlow,
            alpha: { from: 0.05, to: rarity.id === 'legendary' ? 0.14 : 0.10 },
            duration: rarity.id === 'legendary' ? 560 : 880,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (runeOuter) {
          this.tweens.add({
            targets: runeOuter,
            angle: { from: 0, to: rarity.id === 'legendary' ? 360 : -360 },
            duration: rarity.id === 'legendary' ? 8200 : 9800,
            repeat: -1,
            ease: 'Linear'
          });
          this.tweens.add({
            targets: runeOuter,
            alpha: { from: rarity.id === 'legendary' ? 0.18 : 0.12, to: rarity.id === 'legendary' ? 0.42 : 0.28 },
            duration: rarity.id === 'legendary' ? 560 : 840,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (runeInner) {
          this.tweens.add({
            targets: runeInner,
            angle: { from: 0, to: rarity.id === 'legendary' ? -360 : 360 },
            duration: rarity.id === 'legendary' ? 6200 : 7600,
            repeat: -1,
            ease: 'Linear'
          });
          this.tweens.add({
            targets: runeInner,
            alpha: { from: 0.10, to: rarity.id === 'legendary' ? 0.28 : 0.20 },
            duration: rarity.id === 'legendary' ? 480 : 760,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (flareH && flareV) {
          this.tweens.add({
            targets: [flareH, flareV],
            alpha: { from: 0.12, to: 0.32 },
            scaleX: { from: 0.92, to: 1.10 },
            duration: 420,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (shimmerA && shimmerB) {
          this.tweens.add({
            targets: [shimmerA, shimmerB],
            alpha: { from: 0.10, to: 0.42 },
            y: '-=10',
            duration: 480,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
          });
        }
        if (motes.length > 0) {
          motes.forEach((mote, index) => {
            this.tweens.add({
              targets: mote,
              y: mote.y - (rarity.id === 'legendary' ? 18 : 12),
              x: mote.x + (index % 2 === 0 ? -4 : 4),
              alpha: { from: mote.alpha, to: 0.08 },
              duration: rarity.id === 'legendary' ? 760 + index * 90 : 920 + index * 70,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.InOut'
            });
            this.tweens.add({
              targets: mote,
              scale: { from: 0.8, to: rarity.id === 'legendary' ? 1.35 : 1.18 },
              duration: rarity.id === 'legendary' ? 520 + index * 60 : 700 + index * 40,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.InOut'
            });
          });
        }
      } else {
        const crystal = this.add.circle(0, 0, 13, 0x243852, 0.92);
        crystal.setStrokeStyle(2, 0x8fdcff, 1);
        const shard = this.add.rectangle(0, 0, 10, 20, 0xbef3ff, 0.92);
        shard.setAngle(18);
        const label = this.add.text(0, 0, item?.icon || '✦', {
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
        container = this.add.container(x, y, [crystal, shard, label]);
      }

      const shadow = this.createDropShadow(x, y + 14, 'item');
      container.setScale(0.7);
      container.setDepth(18);
      this.tweens.add({ targets: container, scale: 1, duration: 240, ease: 'Back.Out' });

      this.playItemDropSpawnFx(x, y, rarity, { source });

      const launchAngle = Number.isFinite(options.launchAngle) ? Number(options.launchAngle) : Phaser.Math.FloatBetween(0, Math.PI * 2);
      const launchSpeed = Number.isFinite(options.launchSpeed)
        ? Number(options.launchSpeed)
        : (source === 'boss' ? Phaser.Math.Between(220, 320) : Phaser.Math.Between(90, 150));
      const velocity = {
        x: Math.cos(launchAngle) * launchSpeed,
        y: Math.sin(launchAngle) * launchSpeed
      };
      const launch = this.createDropLaunchProfile(x, y, velocity, {
        maxDrift: source === 'boss' ? 240 : 116,
        isBossDrop: source === 'boss'
      });

      const spawnData = {
        type: 'item',
        item,
        rarity,
        sprite: container,
        velocity,
        shadow,
        spawnX: x,
        spawnY: y,
        bornAt: this.time?.now ?? 0,
        maxDrift: source === 'boss' ? 240 : 116,
        launch
      };
      this.drops.push(spawnData);
    },

    updateDrops(delta) {
      if (!this.player || !this.drops || this.drops.length === 0) return;

      const magnetConfig = getCoinMagnetConfig(this.player.getPickupRadius());
      const coinPickupRadiusSq = magnetConfig.attractRadius * magnetConfig.attractRadius;
      const coinCollectRadiusSq = magnetConfig.collectRadius * magnetConfig.collectRadius;
      const itemCollectRadiusSq = magnetConfig.itemCollectRadius * magnetConfig.itemCollectRadius;

      const worldBounds = this.worldBoundsRect || null;

      for (let i = this.drops.length - 1; i >= 0; i--) {
        const drop = this.drops[i];
        if (!drop || !drop.sprite || !drop.sprite.active) {
          this.drops.splice(i, 1);
          continue;
        }

        if (!drop.velocity) {
          drop.velocity = { x: 0, y: 0 };
        }

        const dt = (delta || 0) / 1000;

        if (drop.launch?.active) {
          drop.launch.elapsedMs += delta || 0;
          const progress = Phaser.Math.Clamp(drop.launch.elapsedMs / Math.max(1, drop.launch.durationMs || 1), 0, 1);
          const groundX = Phaser.Math.Linear(drop.launch.startX, drop.launch.endX, progress);
          const groundY = Phaser.Math.Linear(drop.launch.startY, drop.launch.endY, progress);
          const lift = 4 * Number(drop.launch.peakHeight || 0) * progress * (1 - progress);

          drop.sprite.x = groundX;
          drop.sprite.y = groundY - lift;
          if (drop.shadow?.active) {
            const squash = 0.68 + progress * 0.42;
            drop.shadow.x = groundX;
            drop.shadow.y = groundY + (drop.type === 'item' ? 12 : 10);
            drop.shadow.setScale(squash, squash);
            drop.shadow.setAlpha(Phaser.Math.Linear(0.06, drop.type === 'item' ? 0.20 : 0.16, progress));
          }

          if (worldBounds) {
            drop.sprite.x = Phaser.Math.Clamp(drop.sprite.x, worldBounds.x + 10, worldBounds.right - 10);
            drop.sprite.y = Phaser.Math.Clamp(drop.sprite.y, worldBounds.y + 10, worldBounds.bottom - 10);
            if (drop.shadow?.active) {
              drop.shadow.x = Phaser.Math.Clamp(drop.shadow.x, worldBounds.x + 10, worldBounds.right - 10);
              drop.shadow.y = Phaser.Math.Clamp(drop.shadow.y, worldBounds.y + 10, worldBounds.bottom - 10);
            }
          }

          if (progress >= 1) {
            drop.launch.active = false;
            drop.spawnX = drop.launch.endX;
            drop.spawnY = drop.launch.endY;
            drop.sprite.x = drop.spawnX;
            drop.sprite.y = drop.spawnY;
            drop.velocity.x = 0;
            drop.velocity.y = 0;
            if (drop.shadow?.active) {
              drop.shadow.x = drop.spawnX;
              drop.shadow.y = drop.spawnY + (drop.type === 'item' ? 12 : 10);
              drop.shadow.setScale(1);
            }
            this.playDropLandFx(drop.spawnX, drop.spawnY, drop.type, drop.rarity);
          } else {
            continue;
          }
        }

        const damp = 0.90;
        drop.velocity.x *= Math.pow(damp, Math.max(1, dt * 60));
        drop.velocity.y *= Math.pow(damp, Math.max(1, dt * 60));

        drop.sprite.x += drop.velocity.x * dt;
        drop.sprite.y += drop.velocity.y * dt;
        if (drop.shadow?.active) {
          drop.shadow.x = drop.sprite.x;
          drop.shadow.y = drop.sprite.y + (drop.type === 'item' ? 12 : 10);
        }

        const sx = drop.spawnX ?? drop.sprite.x;
        const sy = drop.spawnY ?? drop.sprite.y;
        const maxDrift = drop.maxDrift ?? 110;
        const ddx = drop.sprite.x - sx;
        const ddy = drop.sprite.y - sy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0;
        if (maxDrift > 0 && dist > maxDrift) {
          const nx = ddx / dist;
          const ny = ddy / dist;
          drop.sprite.x = sx + nx * maxDrift;
          drop.sprite.y = sy + ny * maxDrift;
          drop.velocity.x *= 0.35;
          drop.velocity.y *= 0.35;
        }

        if (worldBounds) {
          drop.sprite.x = Phaser.Math.Clamp(drop.sprite.x, worldBounds.x + 10, worldBounds.right - 10);
          drop.sprite.y = Phaser.Math.Clamp(drop.sprite.y, worldBounds.y + 10, worldBounds.bottom - 10);
          if (drop.shadow?.active) {
            drop.shadow.x = Phaser.Math.Clamp(drop.shadow.x, worldBounds.x + 10, worldBounds.right - 10);
            drop.shadow.y = Phaser.Math.Clamp(drop.shadow.y, worldBounds.y + 10, worldBounds.bottom - 10);
          }
        }

        const dx = drop.sprite.x - this.player.x;
        const dy = drop.sprite.y - this.player.y;
        const distSq = dx * dx + dy * dy;

        const isCurrency = drop.type === 'coin' || drop.type === 'coin_bag';
        const collectRadiusSq = isCurrency ? coinCollectRadiusSq : itemCollectRadiusSq;

        if (isCurrency && distSq < coinPickupRadiusSq && distSq > coinCollectRadiusSq) {
          const dist = Math.sqrt(distSq) || 1;
          const speed = drop.type === 'coin_bag' ? magnetConfig.bagSpeed : magnetConfig.coinSpeed;
          drop.sprite.x -= (dx / dist) * speed * (delta / 1000);
          drop.sprite.y -= (dy / dist) * speed * (delta / 1000);
          if (drop.shadow?.active) {
            drop.shadow.x = drop.sprite.x;
            drop.shadow.y = drop.sprite.y + (drop.type === 'item' ? 12 : 10);
          }
        }

        if (distSq < collectRadiusSq) {
          this.collectDrop(drop);
          this.drops.splice(i, 1);
        }
      }
    },

    collectDrop(drop) {
      if (drop.type === 'coin' || drop.type === 'coin_bag') {
        this.addSessionCoins(drop.amount);
        this.showCoinCollectFx(drop.sprite.x, drop.sprite.y, drop.amount, drop.type);
      } else if (drop.type === 'item') {
        this.addItemToInventory(drop.item);

        const burstColor = drop?.item?.kind === 'run_loot_equipment'
          ? (drop?.rarity?.beamColor || 0xffffff)
          : 0x8fdcff;
        const ring = this.add.circle(drop.sprite.x, drop.sprite.y, 12, burstColor, 0.16).setDepth(22);
        ring.setStrokeStyle(3, burstColor, 0.9);
        this.tweens.add({
          targets: ring,
          scale: drop?.item?.kind === 'run_loot_equipment' ? 2.8 : 2.1,
          alpha: 0,
          duration: drop?.item?.kind === 'run_loot_equipment' ? 340 : 240,
          ease: 'Cubic.Out',
          onComplete: () => ring.destroy()
        });
      }

      if (drop.sprite) {
        drop.sprite.destroy();
      }
      if (drop.shadow) {
        drop.shadow.destroy();
      }
      drop.hoverTween?.stop?.();
    },

    addSessionCoins(amount) {
      const equippedIds = Array.isArray(this.registry?.get?.('equippedItems')) ? this.registry.get('equippedItems') : [];
      const support = getEquippedSupportSummary(equippedIds);
      const resolvedAmount = Math.max(0, Math.round(Number(amount || 0) * Number(support.sessionCoinMult || 1)));
      this.sessionCoins += resolvedAmount;
      this.showSessionCoinGain?.(resolvedAmount);
      this.updateInfoPanel();
      this.emitUiSnapshot?.();
    },

    addItemToInventory(item) {
      if (!item) return;

      this.ensureRunLootState();

      if (item.kind === 'run_loot_equipment') {
        const gearItem = {
          ...item,
          id: item.instanceId || item.id || this.nextRunLootItemInstanceId(item.baseId || 'gear'),
          instanceId: item.instanceId || item.id || this.nextRunLootItemInstanceId(item.baseId || 'gear'),
          statLines: Array.isArray(item.statLines) && item.statLines.length > 0
            ? item.statLines
            : formatLootEffectLines(item.effects || {})
        };

        this._runLootGearItems.push(gearItem);
        this.rebuildRunLootInventory();
        this.applyRunLootBonuses();

        const pickupLine = formatLootPickupLine(gearItem.effects || {}) || gearItem.statLines[0] || '';
        this.toast?.show?.({
          icon: gearItem.icon || '✦',
          title: gearItem.name,
          value: pickupLine,
          text: [gearItem.name, pickupLine].filter(Boolean).join(' · '),
          variant: 'loot',
          accentColor: gearItem.rarityTextColor || '#ffffff',
          accentFill: gearItem.rarityId === 'legendary'
            ? '#2f1403'
            : (gearItem.rarityId === 'epic' ? '#231035' : (gearItem.rarityId === 'rare' ? '#102238' : '#0b0b18'))
        }, { durationMs: 2600 });

        this.updateInventoryUI();
        return;
      }

      if (!Array.isArray(this.inventoryAcquired)) {
        this.inventoryAcquired = [];
      }

      const acquiredIndex = this.inventoryAcquired.findIndex(slot => !slot);
      if (acquiredIndex !== -1) {
        this.inventoryAcquired[acquiredIndex] = item;
      } else {
        this.inventoryAcquired.push(item);
      }

      this.updateInventoryUI();
    },

    hasEquippedItem(itemId) {
      if (!itemId) return -1;
      const list = Array.isArray(this.inventoryEquipped) ? this.inventoryEquipped : [];
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === itemId) return i;
      }
      return -1;
    },

    hasOwnedOrEquippedItem(itemId) {
      if (!itemId) return false;
      if (this.hasEquippedItem(itemId) >= 0) return true;
      const owned = Array.isArray(this.registry?.get?.('ownedItems')) ? this.registry.get('ownedItems') : [];
      return owned.includes(itemId);
    },

    hasEquippedConsumable(itemId) {
      if (!itemId) return false;
      if ((this.getRunConsumableCount?.(itemId) || 0) > 0) return true;
      return this.hasEquippedItem(itemId) >= 0;
    },

    useAutoHealConsumable(itemId, opts = {}) {
      if (!this.player || !this.player.isAlive) return false;
      if (!this.hasEquippedConsumable(itemId)) return false;

      const def = getItemById(itemId);
      const cfg = def?.consumable;
      if (!cfg || cfg.mode !== 'autoHeal') return false;

      const now = Number.isFinite(opts.nowMs) ? Number(opts.nowMs) : Number(this._gameplayNowMs || 0);
      const cd = Math.max(0, Number(cfg.cooldownMs || 0));
      const until = Math.max(0, Number(this.player.itemCooldowns?.[itemId] || 0));
      if (cd > 0 && now < until) return false;

      const healAmount = Math.max(1, Math.round((this.player.maxHp || 1) * (cfg.healPct || 0)));
      if (!this.player.itemCooldowns) this.player.itemCooldowns = Object.create(null);
      this.player.itemCooldowns[itemId] = now + cd;
      if (!this._itemCooldownReadyNotified) this._itemCooldownReadyNotified = Object.create(null);
      this._itemCooldownReadyNotified[itemId] = false;
      this.player.heal(healAmount);

      if ((this.getRunConsumableCount?.(itemId) || 0) > 0) {
        this.consumeRunConsumable?.(itemId, 1, { emitUi: false });
      } else {
        this.consumeEquippedItem(itemId);
      }

      this.toast?.show?.({ icon: def?.icon || '🧪', text: `使用了 ${def?.name || '消耗品'}` });
      this.emitUiSnapshot?.();
      return true;
    },

    consumeEquippedItem(itemId) {
      const idx = this.hasEquippedItem(itemId);
      if (idx < 0) return false;

      this.inventoryEquipped[idx] = null;

      const raw = this.registry.get('equippedItems') || new Array(6).fill(null);
      const next = [...raw].slice(0, 6);
      while (next.length < 6) next.push(null);
      next[idx] = null;
      this.registry.set('equippedItems', next);

      const owned = Array.isArray(this.registry.get('ownedItems')) ? [...this.registry.get('ownedItems')] : [];
      const k = owned.indexOf(itemId);
      if (k >= 0) {
        owned.splice(k, 1);
        this.registry.set('ownedItems', owned);
      }

      if (Array.isArray(this.inventoryAcquired)) {
        const j = this.inventoryAcquired.findIndex(it => it && it.id === itemId);
        if (j >= 0) this.inventoryAcquired.splice(j, 1);
      }

      this.applyEquippedEffects();
      this.updateInventoryUI();
      return true;
    },

    tryPlayerRevive() {
      if (!this.player) return false;
      const slot = this.hasEquippedItem('revive_cross');
      if (slot < 0) return false;

      const consumed = this.consumeEquippedItem('revive_cross');
      if (!consumed) return false;

      this.player.isAlive = true;
      this.player.hp = Math.max(1, Math.round((this.player.maxHp || 1) * Number(getItemById('revive_cross')?.consumable?.reviveHpPct || 1)));
      this.player.isInvincible = false;
      this.player.becomeInvincible();

      {
        const def = getItemById('revive_cross');
        this.toast?.show?.({ icon: def?.icon || '✝', text: `使用了 ${def?.name || '复活道具'}` });
      }
      this.events.emit('updatePlayerInfo');
      return true;
    },

    updateAutoConsumables(time) {
      if (!this.player || !this.player.isAlive) return;

      const now = Number.isFinite(time) ? time : Number(this._gameplayNowMs || 0);
      const hpPct = (this.player.maxHp > 0) ? (this.player.hp / this.player.maxHp) : 1;
      if (this.player.hp >= this.player.maxHp) return;

      const tryAutoHeal = (itemId) => {
        if (!this.hasEquippedConsumable(itemId)) return false;

        const def = getItemById(itemId);
        const cfg = def?.consumable;
        if (!cfg || cfg.mode !== 'autoHeal') return false;
        const thresholdPct = Math.max(0, Number(cfg.thresholdPct || 0));
        if (hpPct > thresholdPct) return false;

        if (this.cooldownSkills?.[itemId]) {
          return this.triggerCooldownSkill(itemId, { nowMs: now });
        }

        return this.useAutoHealConsumable(itemId, { nowMs: now });
      };

      tryAutoHeal('potion_small');
    },

    checkEquippedItemCooldownReadyToasts(nowMs) {
      if (!this.player || !this.toast?.show) return;
      const now = Number.isFinite(nowMs) ? nowMs : Number(this._gameplayNowMs || 0);
      const cds = this.player.itemCooldowns;
      if (!cds || typeof cds !== 'object') return;

      if (!this._itemCooldownReadyNotified) this._itemCooldownReadyNotified = Object.create(null);

      Object.keys(cds).forEach((itemId) => {
        if (!itemId) return;
        if (this.cooldownSkills?.[itemId]) return;
        if (!this.hasEquippedConsumable(itemId)) return;

        const until = Math.max(0, Number(cds[itemId] || 0));
        if (!until) return;
        if (now < until) return;
        if (this._itemCooldownReadyNotified[itemId]) return;

        const def = getItemById(itemId);
        const name = def?.name || itemId;
        const icon = def?.icon || '';
        this.toast.show({ icon, text: `${name} 冷却完成` }, { durationMs: 2200 });
        this._itemCooldownReadyNotified[itemId] = true;
      });
    }

  });
}
