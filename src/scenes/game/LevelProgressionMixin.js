import Phaser from 'phaser';
import { ALL_MAPS, STAGE_FLOW, LINE_META, NEUTRAL, getLayerChoices, getMapById } from '../../data/mapPool';
import { getMapBoss, getMapMinions, getMapElites, getRoleSize, getRoleHp, getLayerScaling } from '../../data/mapMonsters';
import { BALANCE_CONSTANTS, TUTORIAL_EXP_REWARDS, getExitDoorWorldRect, getStageBalance } from '../../data/balanceConfig';
import { rollEliteAffixes } from '../../data/eliteAffixes';
import { applyCoreUpgrade } from '../../classes/attacks/coreEnablers';
import { getBaseColorForCoreKey } from '../../classes/visual/basicSkillColors';
import { createRiftPortal, getDefaultRiftTouchPadPx } from '../../classes/visual/riftPortal';
import TestMinion from '../../enemies/minions/TestMinion';

function distributeExpRewards(totalExp, count) {
  const nCount = Math.max(0, Math.floor(count || 0));
  if (nCount <= 0) return [];

  const nTotal = Math.max(0, Math.floor(totalExp || 0));
  const baseReward = Math.floor(nTotal / nCount);
  const remainder = nTotal % nCount;

  return Array.from({ length: nCount }, (_, index) => baseReward + (index < remainder ? 1 : 0));
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
      this._roundBossDefeated = false;
      this._roundClearCountdownActive = false;
      this._roundClearCountdownSeconds = 0;
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
      this._roundClearCountdownSeconds = 10;
      this.systemMessage?.hide('chaos_remaining_enemies', { immediate: true });

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

      this._roundClearCountdownSubText = this.add.text(cam.centerX, cam.centerY + 64, '战场已清空，10 秒后开始下一轮', {
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

          if (this._roundClearCountdownSeconds <= 0) {
            this.resetChaosArenaRoundFlow();
            this.advanceToNextLevel();
            return;
          }

          if (this._roundClearCountdownText) {
            this._roundClearCountdownText.setText(String(this._roundClearCountdownSeconds));
          }
          if (this._roundClearCountdownSubText) {
            this._roundClearCountdownSubText.setText(`战场已清空，${this._roundClearCountdownSeconds} 秒后开始下一轮`);
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

    getChaosArenaPresentation(stage, mapInfo) {
      const maxRounds = this.getChaosArenaMaxRounds();
      const boss = mapInfo?.id ? getMapBoss(mapInfo.id) : null;

      if (stage >= maxRounds) {
        return {
          name: '混沌竞技场',
          subtitle: boss?.name || '最终决战'
        };
      }

      return {
        name: `混沌竞技场·第${stage}轮`,
        subtitle: boss?.name || mapInfo?.name || 'Boss 挑战'
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

    startChaosArenaRound(stage, opts = {}) {
      const targetStage = Math.max(1, Math.floor(stage || 1));
      const mapInfo = this.getChaosArenaEncounterForStage(targetStage);
      const preservePlayerPosition = targetStage > 1;
      const bossEntryPoint = preservePlayerPosition ? this.getBossArenaEntryPoint() : null;

      this.cleanupRoundTransitionObjects();

      if (this.bulletManager?.destroyAllBullets) {
        this.bulletManager.destroyAllBullets();
      }

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
      }

      if (!opts?.silent) {
        this.updateInfoPanel();
      }

      this.startNextPendingLevelUp();
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
      if (this._levelUpActive) return;
      if (!Array.isArray(this._pendingLevelUpLevels) || this._pendingLevelUpLevels.length === 0) return;
      if (this.viewMenuOpen || this.viewMenuClosing) return;

      this._levelUpActive = true;
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
        { id: 'scatter_core', coreKey: 'scatter', label: '猎人', glyph: '➶' },
        { id: 'mage_core', coreKey: 'mage', label: '法师', glyph: '✦' },
        { id: 'warlock_core', coreKey: 'warlock', label: '术士', glyph: '☠' },
        { id: 'drone_core', coreKey: 'drone', label: '德鲁伊', glyph: '✺' }
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
            case 'scatter_core':
              return '散射射击';
            case 'mage_core':
              return '奥术射线';
            case 'paladin_core':
              return '护盾脉冲';
            case 'warlock_core':
              return '剧毒新星';
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

      const title = this.add.text(cam.centerX, cam.centerY - 112, '本轮 Boss 已击败', {
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

      try { this.bulletManager?.clearBossBullets?.(); } catch (_) { /* ignore */ }

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

    showPathChoiceUI() {
      if (this._pathChoiceActive) return;
      this._pathChoiceActive = true;
      this.cleanupPathChoiceObjects();
      try { this.bulletManager?.destroyAllBullets?.(); } catch (_) { /* ignore */ }

      const { choices: rawChoices } = getLayerChoices(
        this.currentStage,
        this.currentLine,
        this.runState
      );
      const choices = rawChoices || [];
      while (choices.length < 3) {
        choices.push({ id: 'unknown', name: '未知路径', subtitle: '???', line: NEUTRAL, layers: [] });
      }

      const cfg = this.mapConfig;
      const worldSize = cfg.gridSize * cfg.cellSize;
      const cell = cfg.cellSize;

      const doorW = Math.floor(cell * 1.3);
      const doorH = Math.floor(cell * 0.9);
      const gap = Math.floor(cell * 0.6);
      const totalW = doorW * 3 + gap * 2;
      const startX = Math.floor((worldSize - totalW) / 2 + doorW / 2);
      // 不贴最顶端：沿用出口门的“世界高度比例”位置
      const yFrac = (BALANCE_CONSTANTS?.exitDoor?.yFrac != null) ? BALANCE_CONSTANTS.exitDoor.yFrac : 0.14;
      const doorY = Math.floor(worldSize * yFrac);

      this._pathDoorZones = [];

      choices.forEach((choice, i) => {
        const cx = startX + i * (doorW + gap);
        const cy = doorY;

        const doorColor = (LINE_META[choice.line] || LINE_META[NEUTRAL])?.color || 0x888888;

        const portal = createRiftPortal(this, cx, cy, {
          width: doorW,
          height: doorH,
          depth: 210,
          label: '',
        });

        // 用一条细色条保留“线路颜色”语义（不增加额外 UI 结构）
        const colorBar = this.add.rectangle(cx, cy - doorH / 2 - 6, Math.max(10, doorW - 10), 5, doorColor, 0.9);
        colorBar.setDepth(211);

        const nameText = this.add.text(cx, cy - doorH * 0.70, choice.name, {
          fontSize: '16px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: doorW - 10 }
        }).setOrigin(0.5);
        nameText.setDepth(212);

        const subText = this.add.text(cx, cy - doorH * 0.70 + 22, choice.subtitle, {
          fontSize: '13px',
          fontFamily: 'Arial, sans-serif',
          color: '#ccddaa',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: doorW - 10 }
        }).setOrigin(0.5);
        subText.setDepth(212);

        const zone = this.add.zone(cx, cy, doorW, doorH);

        this._pathDoorZones.push({
          zone,
          choice,
          rift: {
            x: cx,
            y: cy,
            a: portal.a,
            b: portal.b,
            touchPadPx: getDefaultRiftTouchPadPx(cell)
          }
        });
        this._pathChoiceObjects.push(portal.root, colorBar, nameText, subText, zone);
      });

      if (this.systemMessage) {
        this.systemMessage.show('Boss 已被击败！地图上方出现了三条路径，走入选择下一关。', {
          key: 'boss_defeated_path_choice',
          durationMs: 4500
        });
      }
    },

    getMapLineLabel(line) {
      const meta = LINE_META[line] || LINE_META[NEUTRAL];
      return meta ? `${meta.emoji} ${meta.label}` : line;
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
      if (minions.length === 0 && elites.length === 0) return;

      const cfg = this.mapConfig;
      if (!cfg) return;

      const worldSize = cfg.gridSize * cfg.cellSize;
      const cell = cfg.cellSize;
      const stage = this.currentStage || 1;
      const balance = getStageBalance(stage);

      const minionCount = Phaser.Math.Between(balance.minions.countMin, balance.minions.countMax);
      const minionExpRewards = distributeExpRewards(balance.minions.totalExp, minionCount);
      const spawned = [];

      // 地图层的 moveType 仍然沿用旧数据，但在这里映射到新的展示怪类型，
      // 这样不需要重写 mapMonsters 数据，也能逐步把小怪接入 system/bullets。
      const resolveSpawnType = (moveType, idx, isElite = false) => {
        if (moveType === 'shooter') return 'ring_shooter';
        if (moveType === 'chaser') {
          if (isElite) return (idx % 2 === 0) ? 'charger' : 'chaser';
          return (idx % 4 === 0) ? 'charger' : 'chaser';
        }
        return 'chaser';
      };

      // 首关强制给两个可验证样本：一个远程弹幕怪、一个冲锋怪。
      // 这样每次开局都能直接验证“今天接的系统”是否真正跑起来了。
      const forceStageOneShowcaseType = (idx, fallbackType) => {
        if (stage !== 1) return fallbackType;
        if (idx === 0) return 'ring_shooter';
        if (idx === 1) return 'charger';
        return fallbackType;
      };

      const stageOneShowcaseCount = stage === 1 ? 2 : 0;

      if (stageOneShowcaseCount > 0) {
        // 这两个展示怪放在屏内可见区域，避免首关因为随机刷点导致用户误判“新怪没生成”。
        const showcaseDefs = [
          {
            type: 'ring_shooter',
            name: '示例怪·光环射手',
            color: 0xff2ca8,
            moveSpeed: Math.max(48, balance.minions.speed.shooter || 52),
            shootRange: 230,
            shootCdMs: 1850,
            shootBulletCount: 1,
            shootBurstCount: 3,
            shootBurstSpacingMs: 220,
            shootBulletSpeed: 108,
            shootBulletDamage: Math.max(1, balance.minions.projectiles.damage || 5),
            size: getRoleSize('minion') + 2,
          },
          {
            type: 'charger',
            name: '示例怪·冲锋者',
            color: 0xff9a52,
            moveSpeed: Math.max(64, balance.minions.speed.chaser || 60),
            chargeRange: 165,
            chargeDamage: Math.max(1, Math.round(balance.minions.contactDamage * 1.35)),
            chargeSpeed: 760,
            chargeSpeedStart: 260,
            chargeAccelExponent: 2.8,
            chargeTravelPx: 320,
            chargeOvershootPx: 72,
            chargeCdMs: 1650,
            chargeWindupMs: 320,
            size: getRoleSize('minion') + 2,
          }
        ];

        for (let i = 0; i < showcaseDefs.length; i++) {
          const def = showcaseDefs[i];
          const spawnPt = this.getDynamicSpawnPoint(i, showcaseDefs.length, {
            insideView: true,
            offscreenPad: Math.max(80, Math.round(cell * 0.9)),
            edgeInset: Math.max(56, Math.round(cell * 0.55)),
            laneInset: Math.max(72, Math.round(cell * 0.7)),
            minPlayerDistance: Math.max(180, Math.round(cell * 1.6)),
            jitter: Math.max(8, Math.round(cell * 0.10)),
          });

          const m = new TestMinion(this, {
            x: spawnPt.x,
            y: spawnPt.y,
            type: def.type,
            name: def.name,
            hp: Math.round(balance.minions.hp),
            size: def.size,
            color: def.color,
            moveSpeed: def.moveSpeed,
            contactDamage: balance.minions.contactDamage,
            expReward: minionExpRewards[i] ?? 0,
            isElite: false,
            aggroOnSeen: false,
            spawnProtectedUntilVisible: false,
            aggroRampMs: BALANCE_CONSTANTS.aggro.rampMs,
            aggroRadius: 460,
            shootRange: def.shootRange,
            shootCdMs: def.shootCdMs,
            shootBulletCount: def.shootBulletCount,
            shootBurstCount: def.shootBurstCount,
            shootBurstSpacingMs: def.shootBurstSpacingMs,
            shootBulletSpeed: def.shootBulletSpeed,
            shootBulletDamage: def.shootBulletDamage,
            chargeRange: def.chargeRange,
            chargeDamage: def.chargeDamage,
            chargeSpeed: def.chargeSpeed,
            chargeSpeedStart: def.chargeSpeedStart,
            chargeAccelExponent: def.chargeAccelExponent,
            chargeTravelPx: def.chargeTravelPx,
            chargeOvershootPx: def.chargeOvershootPx,
            chargeCdMs: def.chargeCdMs,
            chargeWindupMs: def.chargeWindupMs,
            hitReactionCdMs: Infinity,
          });
          m.isStageOneShowcase = true;
          spawned.push(m);
        }
      }

      for (let i = stageOneShowcaseCount; i < minionCount; i++) {
        const def = minions[i % minions.length];
        const size = getRoleSize('minion');
        const hp   = Math.round(balance.minions.hp);
        const spawnPt = this.getDynamicSpawnPoint(i, minionCount, {
          offscreenPad: Math.max(72, Math.round(cell * 0.85)),
          edgeInset: Math.max(32, Math.round(cell * 0.35)),
          laneInset: Math.max(40, Math.round(cell * 0.65)),
          minPlayerDistance: Math.max(220, Math.round(cell * 2.0)),
          jitter: Math.max(12, Math.round(cell * 0.18)),
        });

        const resolvedType = forceStageOneShowcaseType(i, resolveSpawnType(def.moveType, i, false));
        const m = new TestMinion(this, {
          x: spawnPt.x,
          y: spawnPt.y,
          type: resolvedType,
          name: def.name,
          hp,
          size,
          color: def.color,
          moveSpeed: balance.minions.speed[def.moveType] ?? balance.minions.speed.chaser,
          contactDamage: balance.minions.contactDamage,
          expReward: minionExpRewards[i] ?? 0,
          isElite: false,
          aggroOnSeen: false,
          spawnProtectedUntilVisible: true,
          aggroRampMs: BALANCE_CONSTANTS.aggro.rampMs,
          aggroRadius: 420,
          // 远程展示怪的弹幕现在会优先走 scene.bulletCore.createBossBullet。
          shootRange: (resolvedType === 'ring_shooter') ? 210 : undefined,
          shootCdMs: (resolvedType === 'ring_shooter') ? Math.max(900, balance.minions.projectiles.cdMs + 120) : undefined,
          shootBulletCount: (resolvedType === 'ring_shooter') ? 1 : undefined,
          shootBurstCount: (resolvedType === 'ring_shooter') ? 3 : undefined,
          shootBurstSpacingMs: (resolvedType === 'ring_shooter') ? 110 : undefined,
          shootBulletSpread: (resolvedType === 'ring_shooter') ? 0 : undefined,
          shootBulletSpeed: (resolvedType === 'ring_shooter') ? Math.max(110, balance.minions.projectiles.speed - 10) : undefined,
          shootBulletDamage: (resolvedType === 'ring_shooter') ? balance.minions.projectiles.damage : undefined,
          // 冲锋展示怪走“前摇 + 穿体冲刺到玩家身后”的模型。
          chargeRange: (resolvedType === 'charger') ? 155 : undefined,
          chargeDamage: (resolvedType === 'charger') ? Math.max(1, Math.round(balance.minions.contactDamage * 1.35)) : undefined,
          chargeSpeed: (resolvedType === 'charger') ? 390 : undefined,
          // 前两关显著降低弹幕：把“受击反击”基本关掉
          hitReactionCdMs: (stage <= 2) ? Infinity : undefined,
        });
        spawned.push(m);
      }

      const eliteCount = Phaser.Math.Between(balance.elites.countMin, balance.elites.countMax);
      const eliteExpRewards = distributeExpRewards(balance.elites.totalExp, eliteCount);
      for (let i = 0; i < eliteCount; i++) {
        const def = elites[i % elites.length];
        const size = getRoleSize('elite');
        const hp   = Math.round(balance.elites.hp);
        const spawnPt = this.getDynamicSpawnPoint(i, eliteCount, {
          offscreenPad: Math.max(84, Math.round(cell * 0.95)),
          edgeInset: Math.max(32, Math.round(cell * 0.35)),
          laneInset: Math.max(48, Math.round(cell * 0.75)),
          minPlayerDistance: Math.max(260, Math.round(cell * 2.3)),
          jitter: Math.max(14, Math.round(cell * 0.16)),
        });

        const resolvedEliteType = resolveSpawnType(def.moveType, i, true);
        const eliteAffixes = rollEliteAffixes({
          stage,
          role: resolvedEliteType
        });

        const m = new TestMinion(this, {
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
          shootRange: (def.moveType === 'shooter') ? 240 : undefined,
          shootCdMs: (def.moveType === 'shooter') ? Math.max(850, balance.elites.projectiles.cdMs + 80) : undefined,
          shootBulletCount: (def.moveType === 'shooter') ? 1 : undefined,
          shootBurstCount: (def.moveType === 'shooter') ? 3 : undefined,
          shootBurstSpacingMs: (def.moveType === 'shooter') ? 95 : undefined,
          shootBulletSpread: (def.moveType === 'shooter') ? 0 : undefined,
          shootBulletSpeed: (def.moveType === 'shooter') ? Math.max(120, balance.elites.projectiles.speed - 5) : undefined,
          shootBulletDamage: (def.moveType === 'shooter') ? balance.elites.projectiles.damage : undefined,
          chargeRange: (def.moveType === 'chaser') ? 178 : undefined,
          chargeDamage: (def.moveType === 'chaser') ? Math.max(1, Math.round(balance.elites.contactDamage * 1.4)) : undefined,
          chargeSpeed: (def.moveType === 'chaser') ? 450 : undefined,
          hitReactionCdMs: (stage <= 2) ? Infinity : undefined,
        });
        spawned.push(m);
      }

      if (!Array.isArray(this.bossManager.minions)) this.bossManager.minions = [];
      this.bossManager.minions.push(...spawned);

      console.log(`[MapMonsters] spawned ${spawned.length} enemies for map "${mapId}" (stage ${stage})`);
    }

  });
}
