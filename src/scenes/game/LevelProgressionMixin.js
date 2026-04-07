import Phaser from 'phaser';
import { ALL_MAPS, NEUTRAL, getMapById } from '../../data/mapPool';
import { getMapBoss, getMapMinions, getMapElites, getRoleSize, getRoleHp, getLayerScaling } from '../../data/mapMonsters';
import { BALANCE_CONSTANTS, TUTORIAL_EXP_REWARDS, getBossArenaWorldRect, getExitDoorWorldRect, getStageBalance } from '../../data/balanceConfig';
import { rollEliteAffixes } from '../../data/eliteAffixes';
import { OUTRUN_ITEM_SLOT_COUNT } from '../../data/items';
import { buildBossRunPlan, getAllBossDefinitions, getBossDefinitionById, getBossEncounterPresentation } from '../../enemies/bosses/bossRegistry';
import { applyCoreUpgrade } from '../../classes/attacks/coreEnablers';
import { getBaseColorForCoreKey } from '../../classes/visual/basicSkillColors';
import { createRiftPortal, getDefaultRiftTouchPadPx } from '../../classes/visual/riftPortal';
import { rollVendorCurseEquipment, rollVendorEquipment } from '../../data/lootItems';
import TestMinion from '../../enemies/minions/TestMinion';

function distributeExpRewards(totalExp, count) {
  const nCount = Math.max(0, Math.floor(count || 0));
  if (nCount <= 0) return [];

  const nTotal = Math.max(0, Math.floor(totalExp || 0));
  const baseReward = Math.floor(nTotal / nCount);
  const remainder = nTotal % nCount;

  return Array.from({ length: nCount }, (_, index) => baseReward + (index < remainder ? 1 : 0));
}

function resolveDirectedMinionType(moveType, waveIndex = 0, stage = 1) {
  if (moveType === 'shooter') {
    return stage >= 4 && waveIndex % 10 === 0 ? 'ring_shooter' : 'chaser';
  }
  if (moveType === 'chaser') {
    return waveIndex % 5 === 0 ? 'charger' : 'chaser';
  }
  return 'chaser';
}

/**
 * 关卡推进/武器选择/Boss门/路径/怪物生成 相关方法
 */
export function applyLevelProgressionMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    getChaosArenaMaxRounds() {
      return Math.max(1, Math.floor(Number(this.chaosArenaMaxRounds) || 6));
    },

    clearChaosArenaCountdownOverlay() {
      if (this._roundClearCountdownText) {
        this._roundClearCountdownText.destroy();
        this._roundClearCountdownText = null;
      }
      if (this._roundClearCountdownSubText) {
        this._roundClearCountdownSubText.destroy();
        this._roundClearCountdownSubText = null;
      }
      if (this._roundClearCountdownTimer) {
        this._roundClearCountdownTimer.remove();
        this._roundClearCountdownTimer = null;
      }
    },

    resetChaosArenaRoundFlow() {
      this.clearChaosArenaCountdownOverlay();
      this.cleanupRoundVendor?.();
      this._roundBossDefeated = false;
      this._roundClearCountdownActive = false;
      this._roundClearCountdownSeconds = 0;
      this._roundVendorPending = false;
      this._roundVendorOpen = false;
      this._roundVendorSpawned = false;
      this._roundVendorRequireExitBeforeReopen = false;
    },

    cleanupRoundVendor() {
      this.roundVendorActive = false;
      this.roundVendorAnchor = null;
      this.roundVendorStock = [];
      this._roundVendorRequireExitBeforeReopen = false;
      if (this.roundVendorZone) {
        this.roundVendorZone.destroy();
        this.roundVendorZone = null;
      }
      if (this.roundVendorSmoke) {
        this.roundVendorSmoke.destroy();
        this.roundVendorSmoke = null;
      }
      if (Array.isArray(this.roundVendorVisuals)) {
        this.roundVendorVisuals.forEach((obj) => obj?.destroy?.());
      }
      this.roundVendorVisuals = null;
    },

    buildRoundVendorStock() {
      const stock = [
        { id: 'potion_small', kind: 'consumable', itemId: 'potion_small' },
        { id: 'reroll_dice', kind: 'consumable', itemId: 'reroll_dice' }
      ];

      const vendorGearCount = this.currentStage >= 3 ? 2 : 1;
      const seenBaseIds = new Set();
      for (let index = 0; index < vendorGearCount; index += 1) {
        const gear = rollVendorEquipment({
          rng: Math.random,
          instanceId: this.nextRunLootItemInstanceId?.('vendor') || `vendor_${Date.now()}_${index}`,
          source: 'vendor'
        });
        if (!gear || seenBaseIds.has(gear.baseId)) continue;
        seenBaseIds.add(gear.baseId);
        stock.push({
          id: `vendor:${gear.instanceId}`,
          kind: 'run_loot_equipment',
          item: gear,
          purchased: false
        });
      }

      if (Math.random() < 0.24) {
        const cursed = rollVendorCurseEquipment({
          rng: Math.random,
          instanceId: this.nextRunLootItemInstanceId?.('vendor_curse') || `vendor_curse_${Date.now()}`,
          source: 'vendor'
        });
        if (cursed) {
          stock.push({
            id: `vendor:${cursed.instanceId}`,
            kind: 'run_loot_equipment',
            item: cursed,
            purchased: false
          });
        }
      }

      this.roundVendorStock = stock;
      return stock;
    },

    getRoundVendorStock() {
      return Array.isArray(this.roundVendorStock) ? this.roundVendorStock : [];
    },

    getRunConsumableBackpackState() {
      const consumables = this.runConsumables && typeof this.runConsumables === 'object'
        ? Object.values(this.runConsumables)
        : [];
      const usedSlots = consumables.reduce((sum, count) => {
        return sum + Math.max(0, Math.floor(Number(count || 0)));
      }, 0);
      const capacity = OUTRUN_ITEM_SLOT_COUNT;
      return {
        usedSlots,
        capacity,
        full: usedSlots >= capacity
      };
    },

    getRoundVendorOfferState(offerId) {
      const entry = this.getRoundVendorStock().find((candidate) => candidate?.id === offerId || candidate?.itemId === offerId);
      if (!entry) return { ok: false, reason: 'missing', price: 0 };

      if (entry.kind === 'consumable') {
        return this.canBuyRunVendorItem(entry.itemId);
      }

      const item = entry.item;
      const price = Math.max(0, Number(item?.price || 0));
      if (entry.purchased) return { ok: false, reason: 'sold_out', price };
      if (Number(this.sessionCoins || 0) < price) return { ok: false, reason: 'not_enough_session_coins', price };
      return { ok: true, reason: '', price };
    },

    getRoundVendorSnapshot() {
      return this.getRoundVendorStock().map((entry) => {
        if (!entry) return null;
        if (entry.kind === 'consumable') {
          const def = this.itemPool?.find?.((item) => item.id === entry.itemId) || null;
          const state = this.canBuyRunVendorItem(entry.itemId);
          const backpackState = this.getRunConsumableBackpackState();
          return def ? {
            id: entry.id,
            itemId: def.id,
            kind: 'consumable',
            name: def.name,
            icon: def.icon,
            desc: def.desc,
            price: this.getRunVendorPrice(def),
            currentCount: this.getRunConsumableCount(def.id),
            carryLimit: Math.max(0, Math.floor(Number(def.carryLimit || def.maxOwned || 0))),
            canBuy: !!state.ok,
            disabledReason: state.reason || '',
            backpackCount: backpackState.usedSlots,
            backpackCapacity: backpackState.capacity,
            rarityLabel: `${def.qualityLabel || '白'}质`,
            rarityTextColor: def.qualityColor || '#fef08a',
            qualityLabel: def.qualityLabel || '白',
            previewLines: [def.desc]
          } : null;
        }

        const item = entry.item;
        const state = this.getRoundVendorOfferState(entry.id);
        return item ? {
          id: entry.id,
          itemId: item.instanceId,
          kind: 'run_loot_equipment',
          name: item.name,
          icon: item.icon,
          desc: item.desc,
          price: Math.max(0, Number(item.price || 0)),
          canBuy: !!state.ok,
          disabledReason: state.reason || '',
          rarityLabel: item.rarityLabel,
          rarityTextColor: item.rarityTextColor,
          qualityLabel: item.qualityLabel,
          categoryLabel: item.categoryLabel,
          vendorSummary: item.vendorSummary,
          previewLines: Array.isArray(item.statLines) ? item.statLines : [],
          purchased: !!entry.purchased
        } : null;
      }).filter(Boolean);
    },

    getRoundVendorSpawnPoint() {
      const player = this.player;
      const { world, view } = this.getArenaWorldAndViewRect();
      const safeInset = Math.max(72, Math.round((this.mapConfig?.cellSize || 128) * 0.75));
      const safeLeft = Math.max(world.x + safeInset, view.x + safeInset);
      const safeRight = Math.min(world.right - safeInset, view.right - safeInset);
      const safeTop = Math.max(world.y + safeInset, view.y + safeInset);
      const safeBottom = Math.min(world.bottom - safeInset, view.bottom - safeInset);
      const fallbackX = Phaser.Math.Clamp(Number(player?.x || view.centerX), safeLeft, safeRight);
      const fallbackY = Phaser.Math.Clamp(Number(player?.y || view.centerY), safeTop, safeBottom);

      const radius = Math.max(110, Math.round((this.mapConfig?.cellSize || 128) * 1.05));
      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: 0.82, y: -0.58 },
        { x: -0.82, y: -0.58 },
        { x: 0.82, y: 0.58 },
        { x: -0.82, y: 0.58 }
      ];

      let best = { x: fallbackX, y: fallbackY, score: -Infinity };
      directions.forEach((dir) => {
        const targetX = Number(player?.x || fallbackX) + dir.x * radius;
        const targetY = Number(player?.y || fallbackY) + dir.y * radius;
        const x = Phaser.Math.Clamp(targetX, safeLeft, safeRight);
        const y = Phaser.Math.Clamp(targetY, safeTop, safeBottom);
        const distToPlayer = Phaser.Math.Distance.Between(Number(player?.x || fallbackX), Number(player?.y || fallbackY), x, y);
        const clampPenalty = Phaser.Math.Distance.Between(targetX, targetY, x, y);
        const centerBias = Phaser.Math.Distance.Between(x, y, view.centerX, view.centerY) * 0.08;
        const score = distToPlayer - clampPenalty - centerBias;
        if (score > best.score) {
          best = { x, y, score };
        }
      });

      return { x: best.x, y: best.y };
    },

    spawnRoundVendorSmoke(x, y, durationMs = 2000) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (this.roundVendorSmoke) {
        this.roundVendorSmoke.destroy();
        this.roundVendorSmoke = null;
      }

      const smoke = this.add.container(x, y).setDepth(219);
  const groundRing = this.add.ellipse(0, 44, 156, 48, 0xd6d3d1, 0.18).setStrokeStyle(3, 0xf8fafc, 0.38);
  const flash = this.add.circle(0, 8, 18, 0xfff7ed, 0.85);
  smoke.add(groundRing);
  smoke.add(flash);
      const puffs = [];
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        const dist = Phaser.Math.Between(10, 34);
        const puff = this.add.circle(
          Math.cos(angle) * dist * 0.45,
          Math.sin(angle) * dist * 0.35,
          Phaser.Math.Between(12, 22),
          Phaser.Math.Between(0, 1) ? 0xcbd5e1 : 0x94a3b8,
          Phaser.Math.FloatBetween(0.18, 0.34)
        );
        smoke.add(puff);
        puffs.push(puff);

        this.tweens.add({
          targets: puff,
          x: puff.x + Math.cos(angle) * Phaser.Math.Between(26, 58),
          y: puff.y + Math.sin(angle) * Phaser.Math.Between(18, 46),
          scale: Phaser.Math.FloatBetween(1.2, 1.7),
          alpha: 0,
          duration: durationMs,
          ease: 'Cubic.Out'
        });
      }

      this.tweens.add({
        targets: groundRing,
        scaleX: 1.28,
        scaleY: 1.36,
        alpha: 0,
        duration: durationMs,
        ease: 'Quad.Out'
      });

      this.tweens.add({
        targets: flash,
        scale: 6.2,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.Out',
        onComplete: () => flash.destroy()
      });

      this.roundVendorSmoke = smoke;
      this.time.delayedCall(durationMs, () => {
        if (this.roundVendorSmoke === smoke) {
          smoke.destroy();
          this.roundVendorSmoke = null;
        }
      });
    },

    spawnRoundVendor() {
      if (this.roundVendorActive || this._roundVendorSpawned || !this.player) return false;

      const { x, y } = this.getRoundVendorSpawnPoint();
      this.cleanupRoundVendor?.();
      this.buildRoundVendorStock?.();
      this._roundVendorSpawned = true;
      this.roundVendorActive = true;
      this.roundVendorAnchor = { x, y };

      const zone = this.add.zone(x, y, 128, 104).setDepth(220);
      this.roundVendorZone = zone;

      const root = this.add.container(x, y).setDepth(220);
      const shadow = this.add.ellipse(0, 44, 118, 34, 0x000000, 0.24);
      const base = this.add.circle(0, 10, 34, 0x2a1f17, 0.98).setStrokeStyle(4, 0xd6a04f, 0.95);
      const hood = this.add.circle(0, -10, 26, 0x6b2d1f, 0.98).setStrokeStyle(3, 0xf0c36b, 0.9);
      const face = this.add.circle(0, -6, 12, 0xf4d7a4, 0.92);
      const pack = this.add.circle(22, 8, 14, 0x8b5a2b, 0.96).setStrokeStyle(2, 0xf0c36b, 0.8);
      const dice = this.add.text(0, 8, '商', {
        fontSize: '18px',
        color: '#fff7d6',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);
      const label = this.add.text(0, -58, '小商贩', {
        fontSize: '20px',
        color: '#ffe7aa',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);
      const hint = this.add.text(0, 66, '靠近交易', {
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);

      root.add([shadow, base, hood, face, pack, dice, label, hint]);
      this.roundVendorVisuals = [root];

      this.tweens.add({
        targets: [base, hood, pack],
        y: '+=4',
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.tweens.add({
        targets: label,
        angle: { from: -2.8, to: 2.8 },
        duration: 560,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut'
      });

      this.tweens.add({
        targets: hint,
        alpha: { from: 0.55, to: 1 },
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.spawnRoundVendorSmoke?.(x, y + 4, 2000);
      this.systemMessage?.show('小商贩现身，靠近后可反复交易，倒计时结束进入下一轮。', {
        key: 'round_vendor_spawn',
        durationMs: 2200
      });
      return true;
    },

    getRemainingCombatantCounts() {
      const remaining = this.bossManager?.getMinions?.() || [];
      let minions = 0;
      let elites = 0;
      for (let i = 0; i < remaining.length; i++) {
        const unit = remaining[i];
        if (!unit || !unit.isAlive) continue;
        if (unit.isElite) elites += 1;
        else minions += 1;
      }
      return {
        minions,
        elites,
        total: minions + elites,
      };
    },

    aggroRemainingEnemies() {
      const remaining = this.bossManager?.getMinions?.() || [];
      const now = this.time?.now ?? 0;
      remaining.forEach((unit) => {
        if (!unit || !unit.isAlive) return;
        unit.aggroOnSeen = false;
        unit.aggroActive = true;
        unit.forceChasePlayerAfterBoss = true;
        unit.followBoss = null;
        unit._aggroStartAt = now;
      });
    },

    updateRemainingEnemiesPrompt() {
      if (!this._roundBossDefeated || this._roundClearCountdownActive) return;

      const counts = this.getRemainingCombatantCounts();
      if (counts.total <= 0) {
        this.systemMessage?.hide('chaos_remaining_enemies', { immediate: true });
        return;
      }

      const parts = [];
      if (counts.minions > 0) parts.push(`小怪 ${counts.minions}`);
      if (counts.elites > 0) parts.push(`精英 ${counts.elites}`);
      const text = `Boss 已击败，清场后开始下一轮。剩余：${parts.join(' / ')}`;
      this.systemMessage?.show(text, {
        key: 'chaos_remaining_enemies',
        sticky: true
      });
    },

    startChaosArenaClearCountdown() {
      if (this._roundClearCountdownActive) return;

      this._roundClearCountdownActive = true;
      this._roundVendorPending = true;
      this._roundVendorSpawned = false;
      this._roundClearCountdownSeconds = 10;
      this.systemMessage?.hide('chaos_remaining_enemies', { immediate: true });
      this.spawnRoundVendor?.();

      const cam = this.cameras.main;
      this.clearChaosArenaCountdownOverlay();

      this._roundClearCountdownText = this.add.text(cam.centerX, cam.centerY - 16, '10', {
        fontSize: '108px',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2800);

      this._roundClearCountdownSubText = this.add.text(cam.centerX, cam.centerY + 64, '战场已清空，10 秒后小商贩离开', {
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2800);

      this._roundClearCountdownTimer = this.time.addEvent({
        delay: 1000,
        repeat: 9,
        callback: () => {
          if (!this.scene?.isActive?.('GameScene')) return;
          this._roundClearCountdownSeconds -= 1;

          if (this.roundVendorActive && this._roundClearCountdownSeconds <= 2) {
            this.cleanupRoundVendor?.();
          }

          if (this._roundClearCountdownSeconds <= 0) {
            this.resetChaosArenaRoundFlow();
            this.advanceToNextLevel();
            return;
          }

          if (this._roundClearCountdownText) {
            this._roundClearCountdownText.setText(String(this._roundClearCountdownSeconds));
          }
          if (this._roundClearCountdownSubText) {
            if (this._roundClearCountdownSeconds <= 2) {
              this._roundClearCountdownSubText.setText(`战场已清空，小商贩即将离开（${this._roundClearCountdownSeconds}）`);
            } else {
              this._roundClearCountdownSubText.setText(`战场已清空，${this._roundClearCountdownSeconds} 秒后小商贩离开`);
            }
          }
        }
      });
    },

    evaluateChaosArenaRoundState() {
      if (!this._roundBossDefeated) return;

      const counts = this.getRemainingCombatantCounts();
      if (counts.total > 0) {
        this.aggroRemainingEnemies();
        this.updateRemainingEnemiesPrompt();
        return;
      }

      this.startChaosArenaClearCountdown();
    },

    cleanupRoundTransitionObjects() {
      this.cleanupPathChoiceObjects?.();
      this._pathChoiceActive = false;
      this.cleanupPostBossRewardUI?.();
      this.resetChaosArenaRoundFlow?.();

      this.exitDoorActive = false;
      this.exitDoorRift = null;
      if (this.exitDoorZone) {
        this.exitDoorZone.destroy();
        this.exitDoorZone = null;
      }
      if (Array.isArray(this.exitDoorVisuals)) {
        this.exitDoorVisuals.forEach(v => v?.destroy?.());
      }
      this.exitDoorVisuals = null;
    },

    getChaosArenaEncounterForStage(stage) {
      const targetStage = Math.max(1, Math.floor(stage || 1));
      const maxRounds = this.getChaosArenaMaxRounds();

      if (targetStage >= maxRounds) {
        const finalMap = getMapById('chaos_throne');
        return finalMap ? { ...finalMap } : {
          id: 'chaos_throne',
          name: '混沌王座',
          subtitle: '最终决战',
          line: NEUTRAL,
        };
      }

      const visited = new Set(this.runState?.visitedMapIds || []);
      const pool = ALL_MAPS.filter((map) => map && !visited.has(map.id));
      const fallback = ALL_MAPS.filter(Boolean);
      const candidates = pool.length > 0 ? pool : fallback;
      const choice = Phaser.Utils.Array.GetRandom(candidates);

      return choice ? { ...choice } : {
        id: `chaos_round_${targetStage}`,
        name: '混沌竞技场',
        subtitle: `第${targetStage}轮`,
        line: NEUTRAL,
      };
    },

    ensureChaosBossPlan() {
      const maxRounds = this.getChaosArenaMaxRounds();
      const bossPool = getAllBossDefinitions();
      const desiredCount = Math.min(maxRounds, bossPool.length);

      if (!this.runState || typeof this.runState !== 'object') {
        this.runState = { visitedMapIds: [], bossPlanIds: [], defeatedBossIds: [] };
      }

      const existing = Array.isArray(this.runState.bossPlanIds)
        ? this.runState.bossPlanIds.filter((bossId, index, arr) => !!getBossDefinitionById(bossId) && arr.indexOf(bossId) === index)
        : [];

      if (existing.length >= desiredCount) {
        this.runState.bossPlanIds = existing.slice(0, desiredCount);
        return this.runState.bossPlanIds;
      }

      const needed = desiredCount - existing.length;
      const generated = buildBossRunPlan(needed, existing);
      this.runState.bossPlanIds = [...existing, ...generated];
      return this.runState.bossPlanIds;
    },

    getBossEncounterDefForStage(stage) {
      const targetStage = Math.max(1, Math.floor(stage || 1));
      const plan = this.ensureChaosBossPlan();
      if (plan.length <= 0) return null;
      const index = Math.min(targetStage, plan.length) - 1;
      return getBossDefinitionById(plan[index]) || null;
    },

    getChaosArenaPresentation(stage, mapInfo) {
      const maxRounds = this.getChaosArenaMaxRounds();
      const boss = this.getBossEncounterDefForStage(stage);
      const presentation = getBossEncounterPresentation(stage, boss || mapInfo, {
        isFinalRound: stage >= maxRounds,
        fallbackName: mapInfo?.name || 'Boss 挑战'
      });

      return {
        name: presentation.title,
        subtitle: presentation.subtitle
      };
    },

    getArenaWorldAndViewRect() {
      const world = this.worldBoundsRect || new Phaser.Geom.Rectangle(0, 0, (this.mapConfig?.gridSize || 20) * (this.mapConfig?.cellSize || 128), (this.mapConfig?.gridSize || 20) * (this.mapConfig?.cellSize || 128));
      const cam = this.cameras?.main;
      const view = cam?.worldView
        ? new Phaser.Geom.Rectangle(cam.worldView.x, cam.worldView.y, cam.worldView.width, cam.worldView.height)
        : new Phaser.Geom.Rectangle(world.x, world.y, world.width, world.height);
      return { world, view };
    },

    buildArenaSpawnPointForSide(side, t, options = {}) {
      const { world, view } = this.getArenaWorldAndViewRect();
      const offscreenPad = Math.max(48, Math.round(options.offscreenPad || 96));
      const edgeInset = Math.max(24, Math.round(options.edgeInset || 48));
      const laneInset = Math.max(24, Math.round(options.laneInset || 72));
      const insideView = options.insideView === true;
      const jitter = Math.max(0, Math.round(options.jitter || 0));
      const safeT = Phaser.Math.Clamp(Number(t) || 0.5, 0.12, 0.88);

      const clampX = (x) => Phaser.Math.Clamp(x, world.x + edgeInset, world.right - edgeInset);
      const clampY = (y) => Phaser.Math.Clamp(y, world.y + edgeInset, world.bottom - edgeInset);

      const horizontalMin = Math.max(world.x + laneInset, Math.min(view.x + laneInset, world.right - laneInset));
      const horizontalMax = Math.min(world.right - laneInset, Math.max(view.right - laneInset, world.x + laneInset));
      const verticalMin = Math.max(world.y + laneInset, Math.min(view.y + laneInset, world.bottom - laneInset));
      const verticalMax = Math.min(world.bottom - laneInset, Math.max(view.bottom - laneInset, world.y + laneInset));

      let x = world.centerX;
      let y = world.centerY;

      if (side === 'top' || side === 'bottom') {
        const minX = Math.min(horizontalMin, horizontalMax);
        const maxX = Math.max(horizontalMin, horizontalMax);
        x = Phaser.Math.Linear(minX, maxX, safeT);
        y = side === 'top'
          ? (insideView ? view.y + offscreenPad : view.y - offscreenPad)
          : (insideView ? view.bottom - offscreenPad : view.bottom + offscreenPad);
      } else {
        const minY = Math.min(verticalMin, verticalMax);
        const maxY = Math.max(verticalMin, verticalMax);
        y = Phaser.Math.Linear(minY, maxY, safeT);
        x = side === 'left'
          ? (insideView ? view.x + offscreenPad : view.x - offscreenPad)
          : (insideView ? view.right - offscreenPad : view.right + offscreenPad);
      }

      if (jitter > 0) {
        if (side === 'top' || side === 'bottom') x += Phaser.Math.Between(-jitter, jitter);
        else y += Phaser.Math.Between(-jitter, jitter);
      }

      return { x: clampX(x), y: clampY(y), side };
    },

    getAvailableArenaSpawnSides(options = {}) {
      const { world, view } = this.getArenaWorldAndViewRect();
      const offscreenPad = Math.max(48, Math.round(options.offscreenPad || 96));
      const sides = [];
      if ((view.y - world.y) > offscreenPad) sides.push('top');
      if ((world.bottom - view.bottom) > offscreenPad) sides.push('bottom');
      if ((view.x - world.x) > offscreenPad) sides.push('left');
      if ((world.right - view.right) > offscreenPad) sides.push('right');
      return sides;
    },

    getDynamicSpawnPoint(index = 0, total = 1, options = {}) {
      const player = this.player;
      const { view } = this.getArenaWorldAndViewRect();
      const safeTotal = Math.max(1, Math.floor(total || 1));
      const availableSides = this.getAvailableArenaSpawnSides(options);
      const fallbackSides = ['top', 'right', 'bottom', 'left'];
      const sides = availableSides.length > 0 ? availableSides : fallbackSides;
      const t = (Math.max(0, index) + 1) / (safeTotal + 1);
      const minPlayerDistance = Math.max(140, Math.round(options.minPlayerDistance || 240));
      const insideView = options.insideView === true;

      const orderedSides = [...sides].sort((a, b) => {
        const pa = this.buildArenaSpawnPointForSide(a, t, options);
        const pb = this.buildArenaSpawnPointForSide(b, t, options);
        const da = player ? Phaser.Math.Distance.Between(pa.x, pa.y, player.x, player.y) : 0;
        const db = player ? Phaser.Math.Distance.Between(pb.x, pb.y, player.x, player.y) : 0;
        return db - da;
      });

      for (let i = 0; i < orderedSides.length; i++) {
        const side = orderedSides[(index + i) % orderedSides.length];
        const point = this.buildArenaSpawnPointForSide(side, t, options);
        const dist = player ? Phaser.Math.Distance.Between(point.x, point.y, player.x, player.y) : Infinity;
        const inView = Phaser.Geom.Rectangle.Contains(view, point.x, point.y);
        if (dist >= minPlayerDistance && (!!insideView === inView || !insideView)) {
          return point;
        }
      }

      return this.buildArenaSpawnPointForSide(orderedSides[0] || 'top', t, options);
    },

    getEnemyHpMultiplier() {
      const mode = this.enemyHpMode || this.registry?.get?.('enemyHpMode') || 'normal';
      return mode === 'low' ? 0.7 : 1;
    },

    buildMinionRuntimeConfig(def, stage, waveIndex, point) {
      const balance = getStageBalance(stage);
      const resolvedType = resolveDirectedMinionType(def?.moveType, waveIndex, stage);
      const baseMoveSpeed = balance.minions.speed[def?.moveType] ?? balance.minions.speed.chaser;
      const resolvedMoveSpeed = resolvedType === 'charger'
        ? Math.max(baseMoveSpeed + 18, Math.round(balance.minions.speed.chaser * 1.55))
        : (resolvedType === 'ring_shooter'
          ? Math.max(baseMoveSpeed + 10, Math.round(balance.minions.speed.chaser * 1.12))
          : Math.max(baseMoveSpeed, balance.minions.speed.chaser));

      return {
        x: point.x,
        y: point.y,
        type: resolvedType,
        name: def?.name || '逼近怪群',
        hp: Math.max(8, Math.round(balance.minions.hp * this.getEnemyHpMultiplier())),
        size: getRoleSize('minion'),
        color: def?.color,
        moveSpeed: resolvedMoveSpeed,
        contactDamage: balance.minions.contactDamage,
        expReward: Math.max(1, Math.round(balance.minions.exp || 1)),
        isElite: false,
        aggroOnSeen: false,
        spawnProtectedUntilVisible: true,
        aggroRampMs: Math.max(180, Math.round(BALANCE_CONSTANTS.aggro.rampMs * 0.5)),
        aggroRadius: 680,
        shootRange: resolvedType === 'ring_shooter' ? 240 : undefined,
        shootCdMs: resolvedType === 'ring_shooter' ? Math.max(1500, balance.minions.projectiles.cdMs + 480) : undefined,
        shootBulletCount: resolvedType === 'ring_shooter' ? 1 : undefined,
        shootBurstCount: resolvedType === 'ring_shooter' ? 2 : undefined,
        shootBurstSpacingMs: resolvedType === 'ring_shooter' ? 180 : undefined,
        shootBulletSpread: resolvedType === 'ring_shooter' ? 0 : undefined,
        shootBulletSpeed: resolvedType === 'ring_shooter' ? Math.max(100, balance.minions.projectiles.speed - 28) : undefined,
        shootBulletDamage: resolvedType === 'ring_shooter' ? Math.max(1, Math.round(balance.minions.projectiles.damage * 0.85)) : undefined,
        chargeRange: resolvedType === 'charger' ? 155 : undefined,
        chargeDamage: resolvedType === 'charger' ? Math.max(1, Math.round(balance.minions.contactDamage * 1.25)) : undefined,
        chargeSpeed: resolvedType === 'charger' ? 380 : undefined,
        hitReactionCdMs: Infinity,
      };
    },

    buildEliteRuntimeConfig(def, stage, eliteIndex, point) {
      const balance = getStageBalance(stage);
      const hpMult = this.getEnemyHpMultiplier();
      const resolvedEliteType = def?.moveType === 'shooter'
        ? 'ring_shooter'
        : (eliteIndex % 2 === 0 ? 'charger' : 'chaser');
      const baseMoveSpeed = balance.elites.speed[def?.moveType] ?? balance.elites.speed.chaser;
      const resolvedMoveSpeed = resolvedEliteType === 'charger'
        ? Math.max(baseMoveSpeed + 24, Math.round(balance.elites.speed.chaser * 1.6))
        : (resolvedEliteType === 'ring_shooter'
          ? Math.max(baseMoveSpeed + 12, Math.round(balance.elites.speed.chaser * 1.16))
          : Math.max(baseMoveSpeed, balance.elites.speed.chaser));
      const eliteAffixes = rollEliteAffixes({
        stage,
        role: resolvedEliteType
      });

      return {
        x: point.x,
        y: point.y,
        type: resolvedEliteType,
        name: def?.name || '精英单位',
        hp: Math.max(18, Math.round(balance.elites.hp * hpMult)),
        size: getRoleSize('elite'),
        color: def?.color,
        moveSpeed: resolvedMoveSpeed,
        contactDamage: balance.elites.contactDamage,
        expReward: Math.max(1, Math.round(balance.elites.exp || 1)),
        isElite: true,
        eliteAffixes,
        aggroOnSeen: false,
        spawnProtectedUntilVisible: true,
        aggroRampMs: Math.max(180, Math.round(BALANCE_CONSTANTS.aggro.rampMs * 0.45)),
        aggroRadius: 760,
        shootRange: def?.moveType === 'shooter' ? 260 : undefined,
        shootCdMs: def?.moveType === 'shooter' ? Math.max(1400, balance.elites.projectiles.cdMs + 260) : undefined,
        shootBulletCount: def?.moveType === 'shooter' ? 1 : undefined,
        shootBurstCount: def?.moveType === 'shooter' ? 2 : undefined,
        shootBurstSpacingMs: def?.moveType === 'shooter' ? 160 : undefined,
        shootBulletSpread: def?.moveType === 'shooter' ? 0 : undefined,
        shootBulletSpeed: def?.moveType === 'shooter' ? Math.max(112, balance.elites.projectiles.speed - 18) : undefined,
        shootBulletDamage: def?.moveType === 'shooter' ? Math.max(1, Math.round(balance.elites.projectiles.damage * 0.9)) : undefined,
        chargeRange: def?.moveType === 'chaser' ? 178 : undefined,
        chargeDamage: def?.moveType === 'chaser' ? Math.max(1, Math.round(balance.elites.contactDamage * 1.35)) : undefined,
        chargeSpeed: def?.moveType === 'chaser' ? 430 : undefined,
        hitReactionCdMs: stage <= 2 ? Infinity : undefined,
      };
    },

    spawnDirectedMinion({ mapId, stage, point, def, waveIndex } = {}) {
      if (!mapId || !point || !def || !this.bossManager) return null;
      const runtimeConfig = this.buildMinionRuntimeConfig(def, stage || (this.currentStage || 1), waveIndex || 0, point);
      const minion = new TestMinion(this, runtimeConfig);
      if (!Array.isArray(this.bossManager.minions)) this.bossManager.minions = [];
      this.bossManager.minions.push(minion);
      return minion;
    },

    spawnDirectedElite({ mapId, stage, point, def, eliteIndex } = {}) {
      if (!mapId || !point || !def || !this.bossManager) return null;
      const runtimeConfig = this.buildEliteRuntimeConfig(def, stage || (this.currentStage || 1), eliteIndex || 0, point);
      const elite = new TestMinion(this, runtimeConfig);
      elite.spawnDirectorWave = true;
      if (!Array.isArray(this.bossManager.minions)) this.bossManager.minions = [];
      this.bossManager.minions.push(elite);
      return elite;
    },

    spawnMapElites(mapId) {
      if (!mapId || !this.bossManager || !this.player) return [];

      const elites = getMapElites(mapId);
      if (elites.length === 0) return [];

      const cfg = this.mapConfig;
      if (!cfg) return [];

      const cell = cfg.cellSize;
      const stage = this.currentStage || 1;
      const balance = getStageBalance(stage);
      const eliteCount = Phaser.Math.Between(balance.elites.countMin, balance.elites.countMax);
      const eliteExpRewards = distributeExpRewards(balance.elites.totalExp, eliteCount);
      const hpMult = this.getEnemyHpMultiplier();
      const spawned = [];

      for (let i = 0; i < eliteCount; i++) {
        const def = elites[i % elites.length];
        const size = getRoleSize('elite');
        const hp = Math.max(18, Math.round(balance.elites.hp * hpMult));
        const spawnPt = this.getDynamicSpawnPoint(i, eliteCount, {
          offscreenPad: Math.max(84, Math.round(cell * 0.95)),
          edgeInset: Math.max(32, Math.round(cell * 0.35)),
          laneInset: Math.max(48, Math.round(cell * 0.75)),
          minPlayerDistance: Math.max(260, Math.round(cell * 2.3)),
          jitter: Math.max(14, Math.round(cell * 0.16)),
        });

        const resolvedEliteType = def.moveType === 'shooter' ? 'ring_shooter' : (i % 2 === 0 ? 'charger' : 'chaser');
        const eliteAffixes = rollEliteAffixes({
          stage,
          role: resolvedEliteType
        });

        const minion = new TestMinion(this, {
          x: spawnPt.x,
          y: spawnPt.y,
          type: resolvedEliteType,
          name: def.name,
          hp,
          size,
          color: def.color,
          moveSpeed: balance.elites.speed[def.moveType] ?? balance.elites.speed.chaser,
          contactDamage: balance.elites.contactDamage,
          expReward: eliteExpRewards[i] ?? 0,
          isElite: true,
          eliteAffixes,
          aggroOnSeen: false,
          spawnProtectedUntilVisible: true,
          aggroRampMs: BALANCE_CONSTANTS.aggro.rampMs,
          aggroRadius: 460,
          shootRange: def.moveType === 'shooter' ? 260 : undefined,
          shootCdMs: def.moveType === 'shooter' ? Math.max(1400, balance.elites.projectiles.cdMs + 260) : undefined,
          shootBulletCount: def.moveType === 'shooter' ? 1 : undefined,
          shootBurstCount: def.moveType === 'shooter' ? 2 : undefined,
          shootBurstSpacingMs: def.moveType === 'shooter' ? 160 : undefined,
          shootBulletSpread: def.moveType === 'shooter' ? 0 : undefined,
          shootBulletSpeed: def.moveType === 'shooter' ? Math.max(112, balance.elites.projectiles.speed - 18) : undefined,
          shootBulletDamage: def.moveType === 'shooter' ? Math.max(1, Math.round(balance.elites.projectiles.damage * 0.9)) : undefined,
          chargeRange: def.moveType === 'chaser' ? 178 : undefined,
          chargeDamage: def.moveType === 'chaser' ? Math.max(1, Math.round(balance.elites.contactDamage * 1.35)) : undefined,
          chargeSpeed: def.moveType === 'chaser' ? 430 : undefined,
          hitReactionCdMs: stage <= 2 ? Infinity : undefined,
        });
        spawned.push(minion);
      }

      if (!Array.isArray(this.bossManager.minions)) this.bossManager.minions = [];
      this.bossManager.minions.push(...spawned);
      return spawned;
    },

    getBossArenaEntryPoint() {
      return this.getDynamicSpawnPoint(0, 1, {
        insideView: true,
        offscreenPad: 110,
        edgeInset: 84,
        laneInset: 120,
        minPlayerDistance: 320,
        jitter: 18,
      });
    },

    spawnDirectedBoss({ mapId, stage, def, point } = {}) {
      if (!mapId || !def || !this.bossManager?.spawnMapBoss) return null;

      const spawnPoint = point || this.getBossArenaEntryPoint();
      const boss = this.bossManager.spawnMapBoss(def, spawnPoint, stage || (this.currentStage || 1), true);
      if (!boss) return null;

      if (typeof boss.setCombatActive === 'function') {
        boss.setCombatActive(false);
      } else {
        boss.combatActive = false;
      }

      if (this.mapConfig) {
        const arena = getBossArenaWorldRect(this.mapConfig);
        if (typeof boss.setMoveBoundsRect === 'function') boss.setMoveBoundsRect(arena);
        else boss.moveBoundsRect = arena;
        if (typeof boss.clampToBounds === 'function') boss.clampToBounds();
      }

      this.levelBossTriggered = true;
      this.systemMessage?.show?.('Boss 正在逼近战场中央。', {
        key: 'chaos_boss_approach',
        durationMs: 1800
      });
      this.bossManager.showBossWarning?.(boss);
      return boss;
    },

    startChaosArenaRound(stage, opts = {}) {
      const targetStage = Math.max(1, Math.floor(stage || 1));
      const mapInfo = this.getChaosArenaEncounterForStage(targetStage);
      const preservePlayerPosition = targetStage > 1;
      const bossEntryPoint = preservePlayerPosition ? this.getBossArenaEntryPoint() : null;

      this.cleanupRoundTransitionObjects();

      this.clearManagedBullets?.();

      if (Array.isArray(this.drops)) {
        this.drops.forEach(d => {
          if (d?.sprite && d.sprite.destroy) d.sprite.destroy();
        });
        this.drops = [];
      }

      if (this.bossManager?.destroyMinions) {
        this.bossManager.destroyMinions();
      }

      const currentBoss = this.bossManager?.getCurrentBoss?.();
      if (currentBoss?.destroy) {
        currentBoss.destroy();
        this.bossManager.currentBoss = null;
      }

      this.currentLevel = targetStage;
      this.currentStage = targetStage;
      this.currentMapInfo = { ...mapInfo };
      this.currentLine = mapInfo?.line || NEUTRAL;
      this.levelBossTriggered = false;

      if (!Array.isArray(this.runState?.visitedMapIds)) {
        this.runState = { visitedMapIds: [] };
      }
      if (mapInfo?.id && !this.runState.visitedMapIds.includes(mapInfo.id)) {
        this.runState.visitedMapIds.push(mapInfo.id);
      }

      this.fogMode = 'none';

      this.setupWorldMapForLevel(this.currentLevel, {
        backgroundKey: 'map1',
        preservePlayerPosition,
        overrideBossSpawnPoint: bossEntryPoint,
        suppressBossSpawn: true,
      });
      if (this._fogWorldObjects) {
        this._fogWorldObjects.forEach(o => o?.destroy?.());
      }
      this._fogWorldObjects = [];
      if (this.fogWorldRT) { this.fogWorldRT.destroy(); this.fogWorldRT = null; }
      if (this.fogBrushImage) { this.fogBrushImage.destroy(); this.fogBrushImage = null; }
      if (this.miniMapRoot) { this.miniMapRoot.destroy(); this.miniMapRoot = null; }
      this.miniMap = null;

      if (mapInfo?.id) {
        this.spawnMapMonsters(mapInfo.id);
      }

      this.resetChaosArenaRoundFlow();

      if (this.player?.fireTimer) {
        this.player.fireTimer.paused = false;
      }
      if (this.player?.weaponType !== 'warrior_melee') {
        this.player.canFire = true;
      }

      const presentation = this.getChaosArenaPresentation(targetStage, mapInfo);
      this.showSceneEntryPresentation?.(presentation, {
        durationMs: opts.durationMs || 1800
      });
    },

    advanceToNextLevel() {
      const nextStage = Math.max(1, Math.floor(this.currentStage || 0) + 1);
      if (nextStage > this.getChaosArenaMaxRounds()) {
        this.showVictorySettlement();
        return;
      }

      console.log('[ChaosArena] advancing to round', nextStage);
      this.startChaosArenaRound(nextStage);
    },

    getMaxExpForLevel(level) {
      const lv = Math.max(1, Math.floor(level || 1));
      // 目标：前两关升级更频繁（第1关≈+2级，第2关≈+2~3级），后期再逐步拉开
      if (lv <= 15) {
        return 120 + (lv - 1) * 40;
      }
      // 16+：指数增长，避免后期无限膨胀
      return Math.floor(720 * Math.pow(1.18, lv - 15));
    },

    addExp(amount, opts = {}) {
      if (!this.playerData) return;
      const gain = Math.max(0, Math.floor(amount || 0));
      if (gain <= 0) return;

      this.playerData.exp += gain;

      while (this.playerData.exp >= this.playerData.maxExp) {
        this.playerData.exp -= this.playerData.maxExp;
        this.playerData.level += 1;
        this.playerData.maxExp = this.getMaxExpForLevel(this.playerData.level);
        this._pendingLevelUpLevels.push(this.playerData.level);
        this._pendingLevelUpPoints = Math.max(0, Number(this._pendingLevelUpPoints || 0)) + 1;
        if (this._pendingLevelUpPoints === 1) {
          this._levelUpPendingSinceMs = Number(this._gameplayNowMs || 0);
          this._levelUpLastInteractionMs = 0;
        }
        this.startNextPendingLevelUp();
      }

      if (!opts?.silent) {
        this.updateInfoPanel();
      }

      this.emitUiSnapshot?.();
    },

    grantTestLevelUp() {
      if (!this.playerData) return false;
      const neededExp = Math.max(1, Math.ceil((this.playerData.maxExp || 0) - (this.playerData.exp || 0)));
      this.addExp(neededExp, { source: 'debug_levelup' });
      console.log('[DebugLevelUp] granted one level via U key', {
        level: this.playerData.level,
        pending: Array.isArray(this._pendingLevelUpLevels) ? this._pendingLevelUpLevels.length : 0
      });
      return true;
    },

    startNextPendingLevelUp() {
      if (!Array.isArray(this._pendingLevelUpLevels) || this._pendingLevelUpLevels.length === 0) return;
      if (this.viewMenuOpen || this.viewMenuClosing) return;

      const nextLevel = this._pendingLevelUpLevels.shift();
      this.triggerLevelUp({ levelOverride: nextLevel });
    },

    setupStartingWeaponPickups(options = {}) {
      const force = !!options.force;
      if (this.weaponSelected && !force) return;
      if ((this.currentLevel || 1) !== 1 && !this.inStartRoom && !force) return;
      if (!this.player || !this.mapConfig) return;

      if (Array.isArray(this.weaponPickupColliders) && this.weaponPickupColliders.length > 0) {
        this.weaponPickupColliders.forEach(c => c?.destroy?.());
      }
      this.weaponPickupColliders = [];
      if (Array.isArray(this.weaponPickups) && this.weaponPickups.length > 0) {
        this.weaponPickups.forEach(p => p?.destroy?.());
      }
      this.weaponPickups = [];

      const cam = this.cameras.main;
      const view = cam.worldView;

      const cell = (this.mapConfig?.cellSize || 128);
      const minDist = Math.floor(cell * 1.55);
      let centerX;
      let centerY;
      const useScreenSpace = (this.inStartRoom || options.layout === 'startRoom');
      if (useScreenSpace) {
        const playerScreenX = this.player.x - view.x;
        const playerScreenY = this.player.y - view.y;
        centerX = playerScreenX;
        centerY = playerScreenY;
      } else {
        centerX = view.x + cam.width * 0.5;
        centerY = view.y + cam.height * 0.43;
        centerY = Math.min(centerY, this.player.y - minDist);
      }

      const items = [
        { id: 'warrior_core', coreKey: 'warrior', label: '战士', glyph: '⚔' },
        { id: 'paladin_core', coreKey: 'paladin', label: '圣骑士', glyph: '⛨' },
        { id: 'archer_core', coreKey: 'archer', label: '猎人', glyph: '➶' },
        { id: 'mage_core', coreKey: 'mage', label: '法师', glyph: '✦' },
        { id: 'warlock_core', coreKey: 'warlock', label: '术士', glyph: '☠' },
        { id: 'druid_core', coreKey: 'druid', label: '德鲁伊', glyph: '✺' }
      ];

      const iconR = 34;

      let arcRadius;
      let startDeg;
      let endDeg;
      if (useScreenSpace) {
        // 六选一：围绕角色均匀分布成圆形（每 60 度）
        arcRadius = Math.floor(Math.min(cell * 1.95, Math.min(cam.width, cam.height) * 0.22));
        startDeg = -90;
        endDeg = startDeg + 300;

        const margin = 14;
        const minCenterX = arcRadius + iconR + margin;
        const maxCenterX = cam.width - (arcRadius + iconR + margin);
        const minCenterY = arcRadius + iconR + margin;
        const maxCenterY = cam.height - (arcRadius + iconR + margin);
        centerX = Phaser.Math.Clamp(centerX, minCenterX, maxCenterX);
        centerY = Phaser.Math.Clamp(centerY, minCenterY, maxCenterY);
      } else {
        arcRadius = Math.floor(Math.min(cam.width * 0.55, cell * 5.0));
        startDeg = 235;
        endDeg = 305;
      }

      this.weaponPickupNodes = [];

      const debugSpawn = [];

      items.forEach((it, idx) => {
        const deg = useScreenSpace
          ? (startDeg + (idx * 60))
          : Phaser.Math.Linear(startDeg, endDeg, (items.length <= 1) ? 0.5 : (idx / (items.length - 1)));
        const rad = Phaser.Math.DegToRad(deg);
        const cx = centerX + Math.cos(rad) * arcRadius;
        const cy = centerY + Math.sin(rad) * arcRadius;

        const iconBg = this.add.circle(cx, cy, iconR, 0x0b0b18, 0.94);
        iconBg.setStrokeStyle(4, getBaseColorForCoreKey(it.coreKey), 0.98);
        iconBg.setDepth(1200);

        if (useScreenSpace) iconBg.setScrollFactor(0);

        const glyph = this.add.text(cx, cy, it.glyph, {
          fontSize: '28px',
          color: '#ffffff'
        }).setOrigin(0.5);
        glyph.setDepth(1201);

        if (useScreenSpace) glyph.setScrollFactor(0);

        const label = this.add.text(cx, cy + iconR + 18, it.label, {
          fontSize: '16px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
        label.setDepth(1201);

        if (useScreenSpace) label.setScrollFactor(0);

        iconBg.setScale(0.65);
        glyph.setScale(0.65);
        this.tweens.add({ targets: [iconBg, glyph], scale: 1, duration: 220, ease: 'Back.Out' });

        this.tweens.add({ targets: iconBg, scale: { from: 1.0, to: 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.weaponPickups.push(iconBg, glyph, label);
        this.weaponPickupNodes.push({
          coreUpgradeId: it.id,
          displayName: it.label,
          x: cx,
          y: cy,
          radius: Math.floor(iconR * 1.35)
        });

        debugSpawn.push({
          id: it.id,
          name: it.label,
          x: Math.round(cx),
          y: Math.round(cy),
          depth: iconBg.depth,
          visible: iconBg.visible,
          alpha: iconBg.alpha,
          scale: iconBg.scaleX,
          screenSpace: useScreenSpace
        });
      });

      try {
        const viewRect = { x: Math.round(view.x), y: Math.round(view.y), w: Math.round(view.width), h: Math.round(view.height) };
        console.log('[WeaponPick] spawned', {
          inStartRoom: this.inStartRoom,
          level: this.currentLevel,
          weaponSelected: this.weaponSelected,
          count: this.weaponPickupNodes.length,
          screenSpace: useScreenSpace,
          cam: {
            scrollX: Math.round(cam.scrollX),
            scrollY: Math.round(cam.scrollY),
            zoom: cam.zoom,
            width: cam.width,
            height: cam.height
          },
          view: viewRect,
          player: this.player ? { x: Math.round(this.player.x), y: Math.round(this.player.y) } : null,
          nodes: debugSpawn.map(n => ({
            ...n,
            inView: useScreenSpace ? (n.x >= 0 && n.x <= cam.width && n.y >= 0 && n.y <= cam.height) : Phaser.Geom.Rectangle.Contains(view, n.x, n.y)
          }))
        });
      } catch (e) {
        console.warn('[WeaponPick] debug spawn log failed', e);
      }
    },

    selectStartingWeapon(coreUpgradeId, displayName) {
      if (this.weaponSelected) return;
      if (!this.player) return;

      this.weaponSelected = true;
      console.log('[WeaponPick] picked:', coreUpgradeId, displayName);

      if (Array.isArray(this.weaponPickupColliders) && this.weaponPickupColliders.length > 0) {
        this.weaponPickupColliders.forEach(c => c?.destroy?.());
      }
      this.weaponPickupColliders = [];
      if (Array.isArray(this.weaponPickups)) {
        this.weaponPickups.forEach(p => p?.destroy?.());
      }
      this.weaponPickups = [];

      const ok = applyCoreUpgrade(this, coreUpgradeId);
      if (!ok) {
        if (this.player) this.player.canFire = true;
        console.warn('applyCoreUpgrade failed for:', coreUpgradeId);
      }

      this.weaponPickupNodes = [];

      if (this.systemMessage) {
        this.systemMessage.hide('startroom_pick_weapon', { immediate: false });

        const className = displayName ? `${displayName}` : '新职业';
        const baseSkillName = (() => {
          switch (coreUpgradeId) {
            case 'warrior_core':
              return '月牙斩';
            case 'archer_core':
              return '箭矢连射';
            case 'mage_core':
              return '冰弹';
            case 'paladin_core':
              return '护盾脉冲';
            case 'warlock_core':
              return '腐疫沼弹';
            case 'druid_core':
            case 'drone_core':
              return '星落';
            default:
              return '基础技能';
          }
        })();

        this.systemMessage.show(`你获得了${className}技能 ${baseSkillName}，混沌竞技场即将开启。`, {
          key: 'startroom_got_skill',
          durationMs: 1800,
          onDismiss: () => {
          }
        });
      }

      this.levelBossTriggered = false;

      if (this.inStartRoom) {
        this.time.delayedCall(180, () => {
          if (this.scene?.isActive?.('GameScene')) {
            this.beginAdventureFromStartRoom?.();
          }
        });
      }
    },

    createPostBossRewardButton(x, y, title, subtitle, accentColor, onClick) {
      const container = this.add.container(x, y).setScrollFactor(0).setDepth(2802);
      const bg = this.add.rectangle(0, 0, 240, 132, 0x111827, 0.96);
      bg.setStrokeStyle(3, accentColor, 0.95);
      const titleText = this.add.text(0, -24, title, {
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5);
      const subText = this.add.text(0, 26, subtitle, {
        fontSize: '15px',
        fontFamily: 'Arial, sans-serif',
        color: '#d1d5db',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: 200 }
      }).setOrigin(0.5);

      container.add([bg, titleText, subText]);
      container.setSize(240, 132);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => bg.setFillStyle(0x1f2937, 1));
      container.on('pointerout', () => bg.setFillStyle(0x111827, 0.96));
      container.on('pointerdown', () => onClick?.());

      return container;
    },

    showPostBossContinuePrompt(message) {
      const cam = this.cameras.main;
      const bottomPanel = this.add.container(cam.centerX, cam.height - 88).setScrollFactor(0).setDepth(2805);
      const bg = this.add.rectangle(0, 0, 440, 72, 0x05070c, 0.90);
      bg.setStrokeStyle(2, 0xffdd88, 0.95);
      const text = this.add.text(0, -10, message, {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: 380 }
      }).setOrigin(0.5);
      const hint = this.add.text(0, 20, '点击这里或按空格开始下一轮', {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      bottomPanel.add([bg, text, hint]);
      bottomPanel.setSize(440, 72);
      bottomPanel.setInteractive({ useHandCursor: true });
      bottomPanel.on('pointerdown', () => this.confirmPostBossRewardAndContinue());
      this._postBossRewardObjects.push(bottomPanel);
    },

    cleanupPostBossRewardUI(options = {}) {
      if (Array.isArray(this._postBossRewardObjects)) {
        this._postBossRewardObjects.forEach(o => o?.destroy?.());
      }
      this._postBossRewardObjects = [];

      if (options.keepState) return;

      this._postBossRewardActive = false;
      this._postBossRewardChoiceMade = false;
      this._postBossRewardSelected = null;
      this._postBossRewardPayload = null;
    },

    resolvePostBossReward(choice) {
      if (!this._postBossRewardActive || this._postBossRewardChoiceMade) return;

      const payload = this._postBossRewardPayload || {};
      this._postBossRewardChoiceMade = true;
      this._postBossRewardSelected = choice;

      this.cleanupPostBossRewardUI({ keepState: true });

      if (choice === 'loot') {
        const rewardBoss = payload.rewardBoss || {
          x: this.player?.x || 0,
          y: this.player?.y || 0,
          attackPatterns: [{}]
        };
        this.spawnBossDrops?.(rewardBoss);
        this.systemMessage?.show('你选择了战利品补给。整理完毕后，确认开启下一轮。', {
          key: 'chaos_reward_loot',
          durationMs: 2400
        });
        this.showPostBossContinuePrompt('已投放战利品补给');
        return;
      }

      const healAmount = Math.max(12, Math.round((this.player?.maxHp || 100) * 0.35));
      const restored = this.player?.heal?.(healAmount) || 0;
      this.events.emit('updatePlayerInfo');
      this.systemMessage?.show(`你选择了恢复，回复了 ${restored} 点生命。`, {
        key: 'chaos_reward_heal',
        durationMs: 2200
      });
      this.showPostBossContinuePrompt('已完成恢复');
    },

    openPostBossRewardChoice(payload = {}) {
      if (this._postBossRewardActive) return;

      const boss = payload?.boss || null;
      this.cleanupPostBossRewardUI();
      this._postBossRewardActive = true;
      this._postBossRewardChoiceMade = false;
      this._postBossRewardSelected = null;
      this._postBossRewardPayload = {
        rewardBoss: boss ? {
          x: Number(boss.x) || 0,
          y: Number(boss.y) || 0,
          bossId: boss.bossId || null,
          bossName: boss.bossName || 'Boss',
          attackPatterns: Array.isArray(boss.attackPatterns) ? boss.attackPatterns : [{}]
        } : null
      };

      const cam = this.cameras.main;
      const overlay = this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.64)
        .setScrollFactor(0)
        .setDepth(2800);
      const panel = this.add.rectangle(cam.centerX, cam.centerY - 20, 620, 260, 0x090d16, 0.95)
        .setScrollFactor(0)
        .setDepth(2801);
      panel.setStrokeStyle(3, 0xffdd88, 0.95);

      const title = this.add.text(cam.centerX, cam.centerY - 112, boss?.bossName ? `已击败 ${boss.bossName}` : '本轮 Boss 已击败', {
        fontSize: '34px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2802);

      const subtitle = this.add.text(cam.centerX, cam.centerY - 74, '选择本轮结算奖励，然后确认开启下一轮战斗', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#d1d5db',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2802);

      const lootButton = this.createPostBossRewardButton(
        cam.centerX - 150,
        cam.centerY + 18,
        '战利品补给',
        '投放一批 Boss 战利品，适合继续做构筑。',
        0x60a5fa,
        () => this.resolvePostBossReward('loot')
      );

      const healButton = this.createPostBossRewardButton(
        cam.centerX + 150,
        cam.centerY + 18,
        '恢复生命',
        '立即恢复 35% 最大生命，提升下轮容错。',
        0x34d399,
        () => this.resolvePostBossReward('heal')
      );

      this._postBossRewardObjects.push(overlay, panel, title, subtitle, lootButton, healButton);
    },

    confirmPostBossRewardAndContinue() {
      if (!this._postBossRewardActive || !this._postBossRewardChoiceMade) return;
      this.cleanupPostBossRewardUI();
      this.advanceToNextLevel();
    },

    onBossDefeatedOpenExitDoor(payload = {}) {
      if (!this.mapConfig) return;
      if (this._pathChoiceActive) return;

      try { this.clearManagedBullets?.('boss'); } catch (_) { /* ignore */ }

      if (this.player?.fireTimer) {
        this.player.fireTimer.paused = false;
      }
      if (this.player?.weaponType !== 'warrior_melee') {
        this.player.canFire = true;
      }

      this._roundBossDefeated = true;
      this._roundClearCountdownActive = false;

      this.evaluateChaosArenaRoundState();
    },

    spawnSingleExitDoor() {
      const { x, y, w, h } = getExitDoorWorldRect(this.mapConfig);

      this.exitDoorZone = this.add.zone(x, y, w, h);
      this.exitDoorActive = true;

      const portal = createRiftPortal(this, x, y, {
        width: w,
        height: h,
        depth: 210,
        label: '空间裂隙\n下一关',
        labelFontSize: '20px',
        labelColor: '#ffdd88'
      });

      this.exitDoorRift = {
        x,
        y,
        a: portal.a,
        b: portal.b,
        touchPadPx: getDefaultRiftTouchPadPx(this.mapConfig?.cellSize)
      };

      this.exitDoorVisuals = [portal.root];

      if (this.systemMessage) {
        this.systemMessage.show('Boss 已被击败！前往上方空间裂隙进入下一关。', {
          key: 'boss_defeated_exit_door',
          durationMs: 3600
        });
      }
    },

    showVictorySettlement() {
      const cam = this.cameras.main;

      if (this.player) {
        this.player.canMove = false;
        this.player.clearAnalogMove?.();
      }

      const overlay = this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0)
        .setScrollFactor(0).setDepth(2000);

      this.tweens.add({
        targets: overlay,
        alpha: 0.75,
        duration: 1200,
      });

      const title = this.add.text(cam.centerX, cam.centerY - 120, '🎉  通关！', {
        fontSize: '52px',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setAlpha(0);

      const bossCount = this.bossManager?.defeatedBossCount || 0;
      const score = this.playerData?.score || 0;
      const playTime = this.bossManager?.getPlayTime?.() || '0:00';
      const playerLevel = this.playerData?.level || 1;

      const statsLines = [
        `最终得分:  ${score}`,
        `击败Boss:  ${bossCount}`,
        `角色等级:  Lv.${playerLevel}`,
        `游戏时长:  ${playTime}`,
      ].join('\n');

      const stats = this.add.text(cam.centerX, cam.centerY + 10, statsLines, {
        fontSize: '22px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        lineSpacing: 12,
        align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setAlpha(0);

      const hint = this.add.text(cam.centerX, cam.centerY + 150, '即将返回主界面...', {
        fontSize: '16px',
        color: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setAlpha(0);

      this.tweens.add({
        targets: title,
        alpha: 1,
        y: cam.centerY - 100,
        duration: 800,
        ease: 'Back.easeOut',
        delay: 600,
      });

      this.tweens.add({
        targets: stats,
        alpha: 1,
        duration: 600,
        delay: 1400,
      });

      this.tweens.add({
        targets: hint,
        alpha: 1,
        duration: 600,
        delay: 2200,
      });

      this.time.delayedCall(5500, () => {
        this.scene.start('GameOverScene', {
          victory: true,
          score,
          survived: playTime,
          sessionCoins: this.sessionCoins || 0,
        });
      });
    },

    // [DEPRECATED] 旧三路线系统 —— 混沌竞技场模式下不再调用
    showPathChoiceUI() {
      if (this._pathChoiceActive) return;
      console.warn('[DEPRECATED] showPathChoiceUI: path-choice flow disabled in chaos arena mode');
    },

    selectPathChoice(choice) {
      if (!this._pathChoiceActive) return;
      this._pathChoiceActive = false;

      console.log('[MapBranch] selected:', choice.id, choice.name, 'line:', choice.line);

      this.runState.visitedMapIds.push(choice.id);
      this.currentMapInfo = { ...choice };

      if (choice.line && choice.line !== NEUTRAL) {
        this.currentLine = choice.line;
      }

      const cam = this.cameras.main;
      const flash = this.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0xffffff, 0);
      flash.setScrollFactor(0);
      flash.setDepth(1200);

      this.tweens.add({
        targets: flash,
        alpha: 0.8,
        duration: 250,
        yoyo: true,
        onComplete: () => {
          flash.destroy();
          this.cleanupPathChoiceObjects();
          this.advanceToNextLevel();
        }
      });
    },

    cleanupPathChoiceObjects() {
      if (Array.isArray(this._pathChoiceObjects)) {
        this._pathChoiceObjects.forEach(o => o?.destroy?.());
      }
      this._pathChoiceObjects = [];
      this._pathDoorZones = [];
    },

    spawnAmbientMinionsForLevel(level) {
      if ((level || 1) !== 1) return;
      if (!this.bossManager) return;

      const stage = this.currentStage || 1;
      const balance = getStageBalance(stage);

      const spawn = this.getSpawnPoint();
      const offsets = [
        { x: -140, y: -220 },
        { x: 120, y: -260 },
        { x: -40, y: -330 },
        { x: 180, y: -360 },
        { x: -180, y: -380 }
      ];

      const minions = offsets.map((o, idx) => {
        const minionType = idx === 1 ? 'ring_shooter' : (idx === 3 ? 'charger' : 'chaser');
        const m = new TestMinion(this, {
          x: spawn.x + o.x,
          y: spawn.y + o.y,
          type: minionType,
          name: `游荡小怪${idx + 1}`,
          hp: Math.round(balance.minions.hp),
          size: 18,
          moveSpeed: balance.minions.speed.chaser,
          contactDamage: balance.minions.contactDamage,
          expReward: balance.minions.exp,
          isElite: false,
          shootBulletSpeed: 132,
          shootBulletDamage: Math.max(1, Math.round(balance.minions.projectiles.damage || 5)),
          chargeDamage: Math.max(1, Math.round(balance.minions.contactDamage * 1.2))
        });
        return m;
      });

      if (!Array.isArray(this.bossManager.minions)) this.bossManager.minions = [];
      this.bossManager.minions.push(...minions);
    },

    spawnLevel1IntroWave() {
      if (!this.bossManager || !this.player) return;
      if (this._level1IntroWaveActive || this._level1IntroWaveCleared) return;

      this._level1IntroWaveActive = true;
      this._level1BossPendingSpawn = false;

      const centerX = this.player.x;
      const topY = this.player.y - 420;

      const count = 5;
      const spawned = [];
  const introWaveExpRewards = distributeExpRewards(TUTORIAL_EXP_REWARDS.introWaveTotal, count);

      const stage = this.currentStage || 1;
      const balance = getStageBalance(stage);

      const ringR = 140;
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.12, 0.12);
        const ox = Math.cos(a) * ringR + Phaser.Math.Between(-6, 6);
        const oy = Math.sin(a) * (ringR * 0.75) + Phaser.Math.Between(-6, 6);
        const minionType = i === 1 ? 'ring_shooter' : (i === 3 ? 'charger' : 'chaser');
        const m = new TestMinion(this, {
          x: centerX + ox,
          y: topY + oy,
          type: minionType,
          name: `第一波小怪${i + 1}`,
          hp: Math.max(8, Math.round(balance.minions.hp * 0.25)),
          size: 16,
          moveSpeed: balance.minions.speed.chaser,
          contactDamage: balance.minions.contactDamage,
          expReward: introWaveExpRewards[i] ?? 0,
          isElite: false,
          aggroOnSeen: true,
          hitReactionCdMs: Infinity,
          shootBulletSpeed: 126,
          shootBulletDamage: Math.max(1, Math.round((balance.minions.projectiles.damage || 5) * 0.9)),
          chargeDamage: Math.max(1, Math.round(balance.minions.contactDamage * 1.1))
        });
        m.isIntroWave = true;
        spawned.push(m);
      }

      // 首波小怪迷雾揭露：合并为中心点单次揭露，避免 5 次 force erase 的 GPU 峰值
      if (this.fogMode === 'soft' && typeof this.revealFogAt === 'function' && spawned.length > 0) {
        this.revealFogAt(centerX, topY, true, 2.2, { tag: 'intro_group', minIntervalMs: 0, minDist: 0 });
      }

      if (!Array.isArray(this.bossManager.minions)) this.bossManager.minions = [];
      this.bossManager.minions.push(...spawned);
      console.log('[Level1] intro wave spawned:', spawned.length);
    },

    spawnMapMonsters(mapId) {
      if (!mapId || !this.bossManager || !this.player) return;

      const minions = getMapMinions(mapId);
      const elites  = getMapElites(mapId);
      const stage = this.currentStage || 1;
      const bossDef = mapId === 'tutorial_level'
        ? getMapBoss(mapId)
        : this.getBossEncounterDefForStage(stage);
      if (minions.length === 0 && elites.length === 0 && !bossDef) return;

      const cfg = this.mapConfig;
      if (!cfg) return;

      const balance = getStageBalance(stage);

      const directorConfig = this.spawnDirector?.buildRoundConfig?.(stage, balance) || {};
      this.spawnDirector?.startRound?.({
        mapId,
        stage,
        minionDefs: minions,
        eliteDefs: elites,
        bossDef,
        ...directorConfig,
      });

      console.log(`[MapMonsters] spawn director armed for map "${mapId}" (stage ${stage}), elites=${elites.length}, boss=${bossDef?.name || 'none'}`);
    }

  });
}
