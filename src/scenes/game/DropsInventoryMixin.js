import Phaser from 'phaser';
import { getEquippedSupportSummary, getItemById } from '../../data/items';
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
          this.spawnItemDrop(
            x + Phaser.Math.Between(-40, 40),
            y + Phaser.Math.Between(-18, 22),
            guaranteedLegendary
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
        this.spawnItemDrop(
          x + Phaser.Math.Between(-48, 48),
          y + Phaser.Math.Between(-18, 28),
          item
        );
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

      const coinCount = Phaser.Math.Between(3, 6);
      const coinValue = Phaser.Math.Between(20, 50);
      for (let i = 0; i < coinCount; i++) {
        this.spawnCoinDrop(dropX + Phaser.Math.Between(-40, 40), dropY + Phaser.Math.Between(-20, 20), coinValue);
      }

      this.rollAndSpawnEquipmentDrops('boss', dropX, dropY, {
        count: Phaser.Math.Between(2, 3)
      });
    },

    spawnCoinDrop(x, y, amount) {
      const outer = this.add.circle(0, 0, 10, 0xffd700, 1);
      outer.setStrokeStyle(2, 0xffffff, 0.65);
      const inner = this.add.circle(-2, -2, 4, 0xffffff, 0.28);

      const coin = this.add.container(x, y, [outer, inner]);

      coin.setScale(0.6);
      this.tweens.add({ targets: coin, scale: 1, duration: 180, ease: 'Back.Out' });
      this.tweens.add({ targets: coin, alpha: { from: 0.85, to: 1 }, duration: 420, yoyo: true, repeat: -1 });

      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const sp = Phaser.Math.Between(70, 150);
      const vx = Math.cos(a) * sp;
      const vy = Math.sin(a) * sp;

      const spawnData = {
        type: 'coin',
        amount,
        sprite: coin,
        velocity: { x: vx, y: vy },
        spawnX: x,
        spawnY: y,
        bornAt: this.time?.now ?? 0,
        maxDrift: 110
      };

      this.drops.push(spawnData);
    },

    spawnItemDrop(x, y, item) {
      const rarity = getLootRarity(item?.rarityId || 'common');
      let container = null;

      if (item?.kind === 'run_loot_equipment') {
        const aura = this.add.circle(0, 0, 24, rarity.auraColor, rarity.id === 'legendary' ? 0.22 : 0.15);
        aura.setStrokeStyle(2, rarity.borderColor, 0.55);

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

        container = this.add.container(x, y, [aura, base, lid, clasp, icon, name]);
        aura.setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
          targets: lid,
          angle: { from: -4, to: 4 },
          duration: rarity.id === 'legendary' ? 820 : 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });

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

      container.setScale(0.7);
      container.setDepth(18);
      this.tweens.add({ targets: container, scale: 1, duration: 200, ease: 'Back.Out' });
      this.tweens.add({
        targets: container,
        y: y - 5,
        duration: 820,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });

      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const sp = Phaser.Math.Between(60, 120);
      const vx = Math.cos(a) * sp;
      const vy = Math.sin(a) * sp;

      const spawnData = {
        type: 'item',
        item,
        rarity,
        sprite: container,
        velocity: { x: vx, y: vy },
        spawnX: x,
        spawnY: y,
        bornAt: this.time?.now ?? 0,
        maxDrift: 95
      };
      this.drops.push(spawnData);
    },

    updateDrops(delta) {
      if (!this.player || !this.drops || this.drops.length === 0) return;

      const pickupRadius = this.player.getPickupRadius();
      const pickupRadiusSq = pickupRadius * pickupRadius;
      const basePickupRadiusSq = 28 * 28;

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

        const damp = 0.90;
        drop.velocity.x *= Math.pow(damp, Math.max(1, dt * 60));
        drop.velocity.y *= Math.pow(damp, Math.max(1, dt * 60));

        drop.sprite.x += drop.velocity.x * dt;
        drop.sprite.y += drop.velocity.y * dt;

        const sx = drop.spawnX ?? drop.sprite.x;
        const sy = drop.spawnY ?? drop.sprite.y;
        const maxDrift = drop.maxDrift ?? 110;
        const ddx = drop.sprite.x - sx;
        const ddy = drop.sprite.y - sy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0;
        if (dist > maxDrift) {
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
        }

        const dx = drop.sprite.x - this.player.x;
        const dy = drop.sprite.y - this.player.y;
        const distSq = dx * dx + dy * dy;

        if (drop.type === 'coin' && pickupRadius > 28 && distSq < pickupRadiusSq && distSq > basePickupRadiusSq) {
          const dist = Math.sqrt(distSq) || 1;
          const speed = 320;
          drop.sprite.x -= (dx / dist) * speed * (delta / 1000);
          drop.sprite.y -= (dy / dist) * speed * (delta / 1000);
        }

        if (distSq < basePickupRadiusSq) {
          this.collectDrop(drop);
          this.drops.splice(i, 1);
        }
      }
    },

    collectDrop(drop) {
      if (drop.type === 'coin') {
        this.addSessionCoins(drop.amount);
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
    },

    addSessionCoins(amount) {
      const equippedIds = Array.isArray(this.registry?.get?.('equippedItems')) ? this.registry.get('equippedItems') : [];
      const support = getEquippedSupportSummary(equippedIds);
      const resolvedAmount = Math.max(0, Math.round(Number(amount || 0) * Number(support.sessionCoinMult || 1)));
      this.sessionCoins += resolvedAmount;
      this.updateInfoPanel();
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
          variant: 'loot'
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
