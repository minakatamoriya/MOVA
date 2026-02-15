import Phaser from 'phaser';
import { getItemById } from '../../data/items';

/**
 * 掉落物/背包/碎片 相关方法
 */
export function applyDropsInventoryMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    applyEquippedEffects() {
      if (!this.player) return;

      const mods = {
        damageMult: 1,
        fireRateMult: 1,
        speedMult: 1,
        critChance: 0,
        critMultiplier: 0,
        lifestealPercent: 0,
        magnetRadius: 0,
        shieldCharges: 0,
        dodgeChance: 0
      };

      this.inventoryEquipped.forEach((item) => {
        if (!item || !item.effects) return;
        if (item.effects.damageMult) mods.damageMult *= item.effects.damageMult;
        if (item.effects.fireRateMult) mods.fireRateMult *= item.effects.fireRateMult;
        if (item.effects.speedMult) mods.speedMult *= item.effects.speedMult;
        if (item.effects.critChance) mods.critChance += item.effects.critChance;
        if (item.effects.critMultiplier) mods.critMultiplier += item.effects.critMultiplier;
        if (item.effects.lifestealPercent) mods.lifestealPercent += item.effects.lifestealPercent;
        if (item.effects.magnetRadius) mods.magnetRadius += item.effects.magnetRadius;
        if (item.effects.shieldCharges) mods.shieldCharges += item.effects.shieldCharges;
        if (item.effects.dodgeChance) mods.dodgeChance += item.effects.dodgeChance;
      });

      this.player.applyStatMultipliers(mods);
      this.player.applyEquipmentEffects(mods);
    },

    testAttackBoss(pointer) {
      const boss = this.bossManager.getCurrentBoss();
      if (boss && boss.isAlive) {
        if (boss.isInvincible) return;
        const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, boss.x, boss.y);
        if (distance < boss.bossSize + 20) {
          boss.takeDamage(100);
          this.showDamageNumber(boss.x, boss.y - 60, 100);
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

      {
        const shardPool = Array.isArray(this.itemPool) ? this.itemPool.filter((it) => it && it.kind === 'shard' && it.shard) : [];
        if (shardPool.length > 0) {
          const phases = Array.isArray(boss?.attackPatterns) ? boss.attackPatterns.length : 1;
          const dropCount = Phaser.Math.Clamp(phases, 1, 4);
          for (let i = 0; i < dropCount; i++) {
            const item = Phaser.Math.RND.pick(shardPool);
            this.spawnItemDrop(
              dropX + Phaser.Math.Between(-60, 60),
              dropY + Phaser.Math.Between(6, 46),
              item
            );
          }
        }
      }
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
      const bg = this.add.rectangle(0, 0, 34, 34, 0x2b2b3f);
      bg.setStrokeStyle(2, 0xffd700);
      const label = this.add.text(0, 0, '🧰', {
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0.5);

      const container = this.add.container(x, y, [bg, label]);

      container.setScale(0.7);
      this.tweens.add({ targets: container, scale: 1, duration: 200, ease: 'Back.Out' });

      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const sp = Phaser.Math.Between(60, 120);
      const vx = Math.cos(a) * sp;
      const vy = Math.sin(a) * sp;

      const spawnData = {
        type: 'item',
        item,
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

        if (pickupRadius > 28 && distSq < pickupRadiusSq && distSq > basePickupRadiusSq) {
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
      }

      if (drop.sprite) {
        drop.sprite.destroy();
      }
    },

    addSessionCoins(amount) {
      this.sessionCoins += amount;
      this.updateInfoPanel();
    },

    addItemToInventory(item) {
      if (!item) return;

      if (item.kind === 'shard' && item.shard) {
        if (!this._runLootShardCounts) this._runLootShardCounts = Object.create(null);
        const prev = Math.max(0, Number(this._runLootShardCounts[item.id] || 0));
        const next = prev + 1;
        this._runLootShardCounts[item.id] = next;

        this.rebuildRunLootShardInventory();
        this.applyRunLootShardBonuses();

        const text = this.formatShardPickupToast(item);
        if (text) {
          this.toast?.show?.({ icon: item.icon || '📦', text });
        } else {
          this.toast?.show?.({ icon: item.icon || '📦', text: `拾取了 ${item.name || '道具'}` });
        }

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

    rebuildRunLootShardInventory() {
      const counts = this._runLootShardCounts || Object.create(null);
      const getCount = (id) => Math.max(0, Number(counts[id] || 0));

      const shardIdsInOrder = ['shard_fire', 'shard_water', 'shard_wind'];
      const list = [];
      shardIdsInOrder.forEach((id) => {
        const c = getCount(id);
        if (c <= 0) return;
        const def = getItemById(id);
        if (!def) return;

        const pct = Math.round((def?.shard?.pct || 0) * 100);
        const total = pct * c;
        let totalText = '';
        if (def.shard.stat === 'damage') totalText = `攻击力 +${total}%`;
        else if (def.shard.stat === 'moveSpeed') totalText = `移动速度 +${total}%`;
        else if (def.shard.stat === 'attackSpeed') totalText = `攻击速度 +${total}%`;
        else totalText = `加成 +${total}%`;

        list.push({
          id: def.id,
          icon: def.icon,
          name: def.name,
          desc: totalText,
          effects: { stacks: c, totalPct: total },
          count: c,
          kind: def.kind,
          shard: def.shard
        });
      });

      this.inventoryAcquired = list;
    },

    applyRunLootShardBonuses() {
      const p = this.player;
      if (!p) return;
      const counts = this._runLootShardCounts || Object.create(null);
      const fire = Math.max(0, Number(counts.shard_fire || 0));
      const water = Math.max(0, Number(counts.shard_water || 0));
      const wind = Math.max(0, Number(counts.shard_wind || 0));

      const damageMult = 1 + fire * 0.01;
      const speedMult = 1 + water * 0.01;
      const attackSpeedBonus = wind * 0.01;
      const fireRateMult = 1 / (1 + attackSpeedBonus);

      p.runLootMods = {
        damageMult: Math.max(0.1, damageMult),
        speedMult: Math.max(0.1, speedMult),
        fireRateMult: Math.max(0.1, fireRateMult)
      };

      p.applyStatMultipliers(p.equipmentMods || { damageMult: 1, fireRateMult: 1, speedMult: 1 });
      this.events.emit('updatePlayerInfo');
    },

    formatShardPickupToast(item) {
      const stat = item?.shard?.stat || '';
      const pct = Math.round((Number(item?.shard?.pct || 0)) * 100);
      if (!pct) return '';
      if (stat === 'damage') return `攻击力 +${pct}%`;
      if (stat === 'moveSpeed') return `移动速度 +${pct}%`;
      if (stat === 'attackSpeed') return `攻击速度 +${pct}%`;
      return `属性 +${pct}%`;
    },

    hasEquippedItem(itemId) {
      if (!itemId) return -1;
      const list = Array.isArray(this.inventoryEquipped) ? this.inventoryEquipped : [];
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === itemId) return i;
      }
      return -1;
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
      this.player.hp = Math.max(1, Math.round((this.player.maxHp || 1) * 0.4));
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
      if (hpPct >= 0.3) return;
      if (this.player.hp >= this.player.maxHp) return;

      const tryAutoHeal = (itemId) => {
        const slot = this.hasEquippedItem(itemId);
        if (slot < 0) return false;

        const def = getItemById(itemId);
        const cfg = def?.consumable;
        if (!cfg || cfg.mode !== 'autoHeal') return false;

        const cd = Math.max(0, cfg.cooldownMs || 0);
        const until = Math.max(0, Number(this.player.itemCooldowns?.[itemId] || 0));
        if (cd > 0 && now < until) return false;

        const healAmount = Math.max(1, Math.round((this.player.maxHp || 1) * (cfg.healPct || 0)));
        if (!this.player.itemCooldowns) this.player.itemCooldowns = Object.create(null);
        this.player.itemCooldowns[itemId] = now + cd;
        if (!this._itemCooldownReadyNotified) this._itemCooldownReadyNotified = Object.create(null);
        this._itemCooldownReadyNotified[itemId] = false;
        this.player.heal(healAmount);
        this.toast?.show?.({ icon: def?.icon || '🧪', text: `使用了 ${def?.name || '消耗品'}` });
        return true;
      };

      if (tryAutoHeal('potion_small')) return;
      tryAutoHeal('potion_big');
    },

    checkEquippedItemCooldownReadyToasts(nowMs) {
      if (!this.player || !this.toast?.show) return;
      const now = Number.isFinite(nowMs) ? nowMs : Number(this._gameplayNowMs || 0);
      const cds = this.player.itemCooldowns;
      if (!cds || typeof cds !== 'object') return;

      if (!this._itemCooldownReadyNotified) this._itemCooldownReadyNotified = Object.create(null);

      Object.keys(cds).forEach((itemId) => {
        if (!itemId) return;
        const slot = this.hasEquippedItem(itemId);
        if (slot < 0) return;

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
