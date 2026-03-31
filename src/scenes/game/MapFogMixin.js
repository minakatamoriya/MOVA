import Phaser from 'phaser';
import { START_ROOM, NEUTRAL } from '../../data/mapPool';
import { getMapBoss } from '../../data/mapMonsters';
import { getBossArenaWorldRect, getBossSpawnWorldPoint } from '../../data/balanceConfig';
import { createRiftPortal, getDefaultRiftTouchPadPx } from '../../classes/visual/riftPortal';
import TestMinion from '../../enemies/minions/TestMinion';
import { applyCoreUpgrade } from '../../classes/attacks/coreEnablers';

/**
 * 地图/迷雾/小地图 相关方法
 */
export function applyMapFogMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    getMapConfigForLevel(level) {
      return {
        level: level || 1,
        gridSize: 20,
        cellSize: 128,
        debugGrid: !!this.debugGridEnabled
      };
    },

    clearDebugGridOverlay() {
      if (Array.isArray(this._debugGridObjects) && this._debugGridObjects.length > 0) {
        this._debugGridObjects.forEach(o => o?.destroy?.());
      }
      this._debugGridObjects = [];

      if (this._debugGridPointerHandler && this.input) {
        try { this.input.off('pointerdown', this._debugGridPointerHandler); } catch (_) { /* ignore */ }
      }
      this._debugGridPointerHandler = null;

      this.debugGridGraphics = null;
      this.debugGridBlockedGraphics = null;
      this.debugGridLabelObjects = null;
    },

    renderDebugGridOverlay() {
      const cfg = this.mapConfig;
      if (!cfg || !cfg.debugGrid) return;

      const { gridSize, cellSize } = cfg;
      if (!(gridSize > 0 && cellSize > 0)) return;

      const worldW = this.worldBoundsRect?.width ?? (gridSize * cellSize);
      const worldH = this.worldBoundsRect?.height ?? (gridSize * cellSize);
      const showLabels = (typeof this.debugGridShowLabels === 'boolean') ? this.debugGridShowLabels : true;
      const interactive = (typeof this.debugGridInteractive === 'boolean') ? this.debugGridInteractive : true;

      this.clearDebugGridOverlay();
      this._debugGridObjects = [];

      // 网格线
      const g = this.add.graphics();
      g.setDepth(-90);
      g.lineStyle(1, 0x66ff99, 0.35);
      for (let i = 0; i <= gridSize; i += 1) {
        const p = i * cellSize;
        g.beginPath();
        g.moveTo(0, p);
        g.lineTo(worldW, p);
        g.strokePath();

        g.beginPath();
        g.moveTo(p, 0);
        g.lineTo(p, worldH);
        g.strokePath();
      }
      this._debugGridObjects.push(g);
      this.debugGridGraphics = g;

      // 不可走格子高亮层（开发期）
      const blockedG = this.add.graphics();
      blockedG.setDepth(-89);
      this._debugGridObjects.push(blockedG);
      this.debugGridBlockedGraphics = blockedG;

      const blockedSet = (() => {
        if (this.debugBlockedCells instanceof Set) return this.debugBlockedCells;
        if (Array.isArray(this.debugBlockedCells)) return new Set(this.debugBlockedCells);
        this.debugBlockedCells = new Set();
        return this.debugBlockedCells;
      })();

      const redrawBlocked = () => {
        if (!this.debugGridBlockedGraphics) return;
        this.debugGridBlockedGraphics.clear();
        this.debugGridBlockedGraphics.fillStyle(0xff3333, 0.22);
        this.debugGridBlockedGraphics.lineStyle(2, 0xff3333, 0.55);

        blockedSet.forEach((idx) => {
          if (!Number.isFinite(idx)) return;
          const gx = idx % gridSize;
          const gy = Math.floor(idx / gridSize);
          if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return;
          const x = gx * cellSize;
          const y = gy * cellSize;
          this.debugGridBlockedGraphics.fillRect(x, y, cellSize, cellSize);
          this.debugGridBlockedGraphics.strokeRect(x, y, cellSize, cellSize);
        });
      };
      redrawBlocked();

      // 编号标签（每格一个 idx：gy*gridSize+gx）
      if (showLabels) {
        this.debugGridLabelObjects = [];
        const fontSize = Math.max(12, Math.min(18, Math.floor(cellSize / 9)));
        for (let gy = 0; gy < gridSize; gy += 1) {
          for (let gx = 0; gx < gridSize; gx += 1) {
            const idx = gy * gridSize + gx;
            const x = gx * cellSize + 6;
            const y = gy * cellSize + 6;
            const t = this.add.text(x, y, String(idx), {
              fontSize: `${fontSize}px`,
              fontStyle: 'bold',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 4,
              backgroundColor: 'rgba(0,0,0,0.45)',
              padding: { left: 4, right: 4, top: 2, bottom: 2 }
            });
            t.setAlpha(0.92);
            t.setDepth(-88);
            this._debugGridObjects.push(t);
            this.debugGridLabelObjects.push(t);
          }
        }
      }

      if (interactive && this.input && this.cameras?.main) {
        this._debugGridPointerHandler = (pointer) => {
          try {
            const cam = this.cameras.main;
            const pt = cam.getWorldPoint(pointer.x, pointer.y);
            const gx = Math.floor(pt.x / cellSize);
            const gy = Math.floor(pt.y / cellSize);
            if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return;
            const idx = gy * gridSize + gx;
            if (blockedSet.has(idx)) blockedSet.delete(idx);
            else blockedSet.add(idx);

            // 保持到 scene 上，便于你后续复制这份列表
            this.debugBlockedCells = blockedSet;
            redrawBlocked();
            console.log(`[DebugGrid] toggle blocked cell gx=${gx} gy=${gy} idx=${idx} blocked=${blockedSet.has(idx)}`);
          } catch (_) { /* ignore */ }
        };
        this.input.on('pointerdown', this._debugGridPointerHandler);
      }
    },

    getSpawnPoint() {
      if (this.inStartRoom) {
        return this.getStartRoomSpawnPoint();
      }
      const cfg = this.mapConfig;
      if (!cfg) return { x: this.gameArea.x + this.gameArea.width / 2, y: this.gameArea.y + this.gameArea.height - 100 };

      const worldSize = cfg.gridSize * cfg.cellSize;
      return {
        x: Math.floor(worldSize / 2),
        y: Math.floor(worldSize - cfg.cellSize * 0.85)
      };
    },

    getStartRoomConfig() {
      const cam = this.cameras.main;
      const worldW = Math.floor(cam.width);
      const worldH = Math.floor(cam.height);
      return {
        level: 0,
        worldW,
        worldH,
        cellSize: Math.max(96, Math.floor(Math.min(worldW, worldH) / 6))
      };
    },

    getStartRoomSpawnPoint() {
      const cfg = this.getStartRoomConfig();
      return {
        // 起始房间：正式站位在偏下方，形成“从下往上推进”的阅读顺序
        x: Math.floor(cfg.worldW / 2),
        y: Math.floor(cfg.worldH * 0.78)
      };
    },

    getStartRoomEntryPoint() {
      const cfg = this.getStartRoomConfig();
      return {
        // 入场点更贴近底部，看起来像从下方踏入试炼之地
        x: Math.floor(cfg.worldW / 2),
        y: Math.floor(cfg.worldH * 0.93)
      };
    },

    playStartRoomEntryIntro() {
      if (!this.player) return;

      const player = this.player;
      const destination = this.getStartRoomSpawnPoint();

      if (this._startRoomEntryTween) {
        try { this._startRoomEntryTween.stop(); } catch (_) { /* ignore */ }
        this._startRoomEntryTween = null;
      }

      player.clearAnalogMove?.();
      player.canMove = false;
      player.canFire = false;
      player.isInvincible = true;
      player.freezeMovementAnimation?.();

      this._startRoomEntryTween = this.tweens.add({
        targets: player,
        x: destination.x,
        y: destination.y,
        duration: 520,
        ease: 'Sine.Out',
        onComplete: () => {
          this._startRoomEntryTween = null;
          if (!player || !player.active) return;
          player.canMove = true;
          player.canFire = true;
          player.isInvincible = false;
          player.freezeMovementAnimation?.();
        }
      });
    },

    cleanupStartRoomObjects() {
      const tutorialTarget = this.startRoomTutorialTarget;
      if (Array.isArray(this.bossManager?.minions) && tutorialTarget) {
        this.bossManager.minions = this.bossManager.minions.filter((unit) => unit && unit !== tutorialTarget);
      }
      if (this.startRoomTutorialTarget?.destroy) {
        this.startRoomTutorialTarget.destroy();
      }
      this.startRoomTutorialTarget = null;

      if (Array.isArray(this._startRoomObjects) && this._startRoomObjects.length > 0) {
        this._startRoomObjects.forEach(o => o?.destroy?.());
      }
      this._startRoomObjects = [];

      if (this.startRoomDoorZone) {
        this.startRoomDoorZone.destroy();
        this.startRoomDoorZone = null;
      }
      if (Array.isArray(this.startRoomDoorVisuals)) {
        this.startRoomDoorVisuals.forEach(v => v?.destroy?.());
      }
      this.startRoomDoorVisuals = null;
      this.startRoomDoorActive = false;
      this.startRoomDoorRift = null;
    },

    enterStartRoom() {
      this.inStartRoom = true;
      this.adventureStarted = false;

      // 起始房间不显示“关卡底图”（例如试炼之地的 map1）
      // 避免被 startroom 的 tileSprite 盖住导致误判是否生效
      if (this.mapBgImage) {
        try { this.mapBgImage.setVisible(false); } catch (_) { /* ignore */ }
      }

      this.fogMode = 'none';

      if (this._worldMapObjects) {
        this._worldMapObjects.forEach(o => o?.destroy?.());
      }
      this._worldMapObjects = [];

      if (this._fogWorldObjects) {
        this._fogWorldObjects.forEach(o => o?.destroy?.());
      }
      this._fogWorldObjects = [];
      if (this.fogWorldRT) { this.fogWorldRT.destroy(); this.fogWorldRT = null; }
      if (this.fogBrushImage) { this.fogBrushImage.destroy(); this.fogBrushImage = null; }
      if (this.miniMapRoot) { this.miniMapRoot.destroy(); this.miniMapRoot = null; }
      this.miniMap = null;

      this.cleanupStartRoomObjects();
      const cfg = this.getStartRoomConfig();
      this.mapConfig = {
        level: 0,
        gridSize: 1,
        cellSize: cfg.cellSize,
        debugGrid: !!this.debugGridEnabled
      };
      this.worldBoundsRect = new Phaser.Geom.Rectangle(0, 0, cfg.worldW, cfg.worldH);

      const bgKey = this.ensureGrassTileTexture('grass_tile_startroom', 256);
      const bg = this.add.tileSprite(0, 0, cfg.worldW, cfg.worldH, bgKey).setOrigin(0, 0);
      bg.setDepth(-100);
      this._startRoomObjects.push(bg);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, cfg.worldW, cfg.worldH);

      const spawn = this.getStartRoomEntryPoint();
      this.player.setPosition(spawn.x, spawn.y);
      cam.startFollow(this.player, true, 0.18, 0.18);
      cam.setFollowOffset(0, 0);
      this.petManager?.resetPositionsAroundPlayer?.();
      this.undeadSummonManager?.resetPositionsAroundPlayer?.();

      // 开发期调试网格覆盖层
      if (this.mapConfig.debugGrid) this.renderDebugGridOverlay();
      else this.clearDebugGridOverlay();

      this.weaponSelected = false;
      this.startRoomTutorialCleared = false;

      const selectedCore = this.selectedMainCore || this.registry?.get?.('preferredMainCore') || 'archer';
      if (selectedCore) {
        this.registry?.set?.('preferredMainCore', selectedCore);
        applyCoreUpgrade(this, `${selectedCore}_core`);
        this.weaponSelected = true;
      }

      this.currentMapInfo = { ...START_ROOM };
      if (this.miniMapRoot) { this.miniMapRoot.destroy(); this.miniMapRoot = null; }
      this.miniMap = null;

      if (this.systemMessage) {
        this.systemMessage.show('击败前方试炼傀儡，熟悉当前职业的基础攻击。', {
          key: 'startroom_trial_intro',
          sticky: true
        });
      }

      this.spawnStartRoomTutorialTarget();
      this.showSceneEntryPresentation?.(this.currentMapInfo, { durationMs: 2000 });
      this.playStartRoomEntryIntro();

      console.log('[StartRoom] entered. weaponSelected=', this.weaponSelected);
    },

    spawnStartRoomTutorialTarget() {
      if (!this.player || this.startRoomTutorialTarget?.active) return;

      const cfg = this.getStartRoomConfig();
      const neededExp = Math.max(1, Math.ceil((this.playerData?.maxExp || 120) - (this.playerData?.exp || 0)));
      const target = new TestMinion(this, {
        x: Math.floor(cfg.worldW * 0.5),
        y: Math.floor(cfg.worldH * 0.14),
        name: '试炼傀儡',
        hp: 20,
        expReward: neededExp,
        size: 24,
        color: 0x9bd7ff,
        type: 'shooter',
        moveSpeed: 44,
        aggroRadius: Math.floor(cfg.worldH),
        shootRange: 180,
        shootCdMs: 1650,
        shootBurstCount: 1,
        shootBulletCount: 1,
        shootBulletSpeed: 150,
        shootBulletDamage: 4,
        contactDamage: 0,
        spawnProtectedUntilVisible: false
      });

      target.isStartRoomTutorialTarget = true;
      target.showStatusUi = false;
      target.syncOverheadUiVisibility?.();
      target.hpBarBg?.setVisible?.(false);
      target.hpBar?.setVisible?.(false);
      target.hpText?.setVisible?.(false);
      target.debuffAnchor?.setVisible?.(false);

      this.startRoomTutorialTarget = target;
      if (Array.isArray(this.bossManager?.minions)) {
        this.bossManager.minions.push(target);
      }
      this._startRoomObjects.push(target);
    },

    spawnStartRoomDoor() {
      if (this.startRoomDoorActive) return;
      if (!this.weaponSelected) return;

      const cfg = this.getStartRoomConfig();
      const x = Math.floor(cfg.worldW / 2);
      // 试炼结束后，裂隙出现在最上方区域
      const y = Math.floor(cfg.worldH * 0.12);

      this.startRoomDoorZone = this.add.zone(x, y, cfg.cellSize * 2.0, cfg.cellSize * 1.0);
      this.startRoomDoorActive = true;

      const w = cfg.cellSize * 2.0;
      const h = cfg.cellSize * 1.0;

      const portal = createRiftPortal(this, x, y, {
        width: w,
        height: h,
        depth: 380,
        label: '空间裂隙\n进入混沌竞技场',
        labelFontSize: '22px',
        labelColor: '#ffffff'
      });

      this.startRoomDoorRift = {
        x,
        y,
        a: portal.a,
        b: portal.b,
        touchPadPx: getDefaultRiftTouchPadPx(cfg.cellSize)
      };

      this.startRoomDoorVisuals = [portal.root];
      this._startRoomObjects.push(portal.root, this.startRoomDoorZone);
    },

    beginAdventureFromStartRoom() {
      if (this.adventureStarted) return;
      if (!this.weaponSelected) {
        console.warn('[StartRoom] tried to start adventure without weapon');
        return;
      }

      this.adventureStarted = true;
      this.inStartRoom = false;

      this.systemMessage?.hide(null, { immediate: true });

      console.log('[StartRoom] beginAdventure. mainCore=', this.registry?.get?.('mainCore'), 'weaponType=', this.player?.weaponType);

      this.currentLevel = 1;
      this.currentStage = 1;
      this.levelBossTriggered = false;

      this.cleanupStartRoomObjects();

      this.time.delayedCall(60, () => {
        this.startChaosArenaRound?.(1, { durationMs: 2000 });
      });
    },

    getBossSpawnPoint() {
      const cfg = this.mapConfig;
      if (!cfg) return { x: this.gameArea.x + this.gameArea.width / 2, y: this.gameArea.y + 150 };

      return getBossSpawnWorldPoint(cfg);
    },

    setupWorldMapForLevel(level, opts = {}) {
      if (this._worldMapObjects) {
        this._worldMapObjects.forEach(o => {
          if (o && o.destroy) o.destroy();
        });
      }
      this._worldMapObjects = [];

      if (this._fogWorldObjects) {
        this._fogWorldObjects.forEach(o => {
          if (o && o.destroy) o.destroy();
        });
      }
      this._fogWorldObjects = [];

      this.mapConfig = this.getMapConfigForLevel(level);
      const { gridSize, cellSize, debugGrid } = this.mapConfig;
      const worldSize = gridSize * cellSize;

      // 当前关卡的阻挡格子集合（开发期可用 debugBlockedCells 直接当作阻挡）
      // 约定：this.blockedCells = Set<number>
      {
        const src = this.blockedCellsByMapId?.[this.currentMapInfo?.id] ?? null;
        if (src instanceof Set) this.blockedCells = src;
        else if (Array.isArray(src)) this.blockedCells = new Set(src);
        else if (this.debugBlockedCells instanceof Set) this.blockedCells = this.debugBlockedCells;
        else this.blockedCells = new Set();
      }

      // 精英词缀的临时墙体阻挡层：与地图固有 blockedCells 分开，便于战斗中动态增删。
      this.eliteAffixBlockedCells = new Set();

      this.worldBoundsRect = new Phaser.Geom.Rectangle(0, 0, worldSize, worldSize);

      // 自定义底图（例如试炼之地 map1.png）
      const backgroundKey = opts?.backgroundKey;
      if (backgroundKey && typeof this.setMapBackground === 'function') {
        try {
          this.setMapBackground(backgroundKey);
          if (this.mapBgImage) this.mapBgImage.setVisible(true);
        } catch (_) { /* ignore */ }
      } else if (this.mapBgImage) {
        // 没有指定自定义底图时，避免残留显示
        try { this.mapBgImage.setVisible(false); } catch (_) { /* ignore */ }
      }

      // 默认草地底纹：当没有自定义底图时才创建（否则会覆盖底图）
      if (!backgroundKey) {
        const grassKey = this.ensureGrassTileTexture();
        const bg = this.add.tileSprite(0, 0, worldSize, worldSize, grassKey).setOrigin(0, 0);
        bg.setDepth(-100);
        this._worldMapObjects.push(bg);
      }

      // 开发期调试网格覆盖层（网格线 + 编号 + 可点击标记不可走格子）
      if (debugGrid) this.renderDebugGridOverlay();
      else this.clearDebugGridOverlay();

      const bossPt = opts?.overrideBossSpawnPoint || this.getBossSpawnPoint();
      this.bossRoomZone = this.add.zone(bossPt.x, bossPt.y, cellSize * 2, cellSize * 2);
      this.bossRoomZone.setDepth(-80);
      this._worldMapObjects.push(this.bossRoomZone);
      this.levelBossTriggered = false;

      const cam = this.cameras.main;
      cam.setBounds(0, 0, worldSize, worldSize);
      if (this.player) {
        const preservePlayerPosition = !!opts?.preservePlayerPosition;
        const spawn = preservePlayerPosition
          ? {
              x: Phaser.Math.Clamp(this.player.x, 32, worldSize - 32),
              y: Phaser.Math.Clamp(this.player.y, 32, worldSize - 32)
            }
          : this.getSpawnPoint();
        this.player.setPosition(spawn.x, spawn.y);
        cam.startFollow(this.player, true, 0.12, 0.12);
        cam.setFollowOffset(0, 0);
        this.petManager?.resetPositionsAroundPlayer?.();
        this.undeadSummonManager?.resetPositionsAroundPlayer?.();
      }

      const suppressBossSpawn = !!opts.suppressBossSpawn;

      if (!suppressBossSpawn && this.bossManager) {
        const existing = this.bossManager.getCurrentBoss?.();
        if (!existing || !existing.isAlive) {
          const mapId = this.currentMapInfo?.id;
          const mapBossData = mapId ? getMapBoss(mapId) : null;

          if (mapId === 'tutorial_level') {
            const bPt = this.getBossSpawnPoint();
            this._isTutorialBoss = true;
            this.bossManager.spawnTutorialBoss(bPt);
          } else if (mapBossData && this.bossManager.spawnMapBoss) {
            const bPt = opts?.overrideBossSpawnPoint || this.getBossSpawnPoint();
            this.bossManager.spawnMapBoss(mapBossData, bPt, this.currentStage || 1, true);
          }

          const b = this.bossManager.getCurrentBoss?.();
          if (b && typeof b.setCombatActive === 'function') {
            b.setCombatActive(false);
          } else if (b) {
            b.combatActive = false;
          }

          // 限制 Boss 活动范围：以出口门为中心的固定区域
          if (b && this.mapConfig) {
            const arena = getBossArenaWorldRect(this.mapConfig);
            if (typeof b.setMoveBoundsRect === 'function') b.setMoveBoundsRect(arena);
            else b.moveBoundsRect = arena;
            if (typeof b.clampToBounds === 'function') b.clampToBounds();
          }
          this.levelBossTriggered = true;
        }
      }
    },

    isGridCellBlocked(gx, gy) {
      const cfg = this.mapConfig;
      if (!cfg) return false;
      const { gridSize } = cfg;
      if (!(gridSize > 0)) return false;
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) return false;
      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return false;

      const idx = gy * gridSize + gx;
      const set = this.blockedCells instanceof Set
        ? this.blockedCells
        : (this.debugBlockedCells instanceof Set ? this.debugBlockedCells : null);
      if (set?.has?.(idx)) return true;
      return !!this.eliteAffixBlockedCells?.has?.(idx);
    },

    isWorldPointBlocked(x, y) {
      const cfg = this.mapConfig;
      if (!cfg) return false;
      const { gridSize, cellSize } = cfg;
      if (!(gridSize > 0 && cellSize > 0)) return false;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      return this.isGridCellBlocked(gx, gy);
    },

    setupGridFogOfWar() {
      if (this.fogMode !== 'grid') return;

      const cfg = this.mapConfig;
      if (!cfg) return;

      const { gridSize, cellSize } = cfg;

      this.fogState = new Uint8Array(gridSize * gridSize);

      this.fogRevealRadiusCells = 2;

      this.fogCells = new Array(gridSize * gridSize);

      const baseDepth = 320;
      let idx = 0;
      for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
          const x = gx * cellSize;
          const y = gy * cellSize;
          const r = this.add.rectangle(x, y, cellSize, cellSize, 0x000000, 0.92).setOrigin(0, 0);
          r.setDepth(baseDepth);
          this.fogCells[idx] = r;
          idx++;
          this._fogWorldObjects.push(r);
        }
      }

      this.updateGridFogOfWar(true);
    },

    updateGridFogOfWar(forceFullRefresh = false) {
      if (this.fogMode !== 'grid') return;
      if (!this.player || !this.mapConfig || !this.fogState || !this.fogCells) return;

      const { gridSize, cellSize } = this.mapConfig;
      const radius = Math.max(1, this.fogRevealRadiusCells || 2);

      if (forceFullRefresh) {
        for (let i = 0; i < this.fogState.length; i++) {
          if (this.fogState[i] === 2) this.fogState[i] = 1;
        }
      } else {
        for (let i = 0; i < this.fogState.length; i++) {
          if (this.fogState[i] === 2) this.fogState[i] = 1;
        }
      }

      const px = Phaser.Math.Clamp(this.player.x, 0, gridSize * cellSize - 1);
      const py = Phaser.Math.Clamp(this.player.y, 0, gridSize * cellSize - 1);
      const pgx = Phaser.Math.Clamp(Math.floor(px / cellSize), 0, gridSize - 1);
      const pgy = Phaser.Math.Clamp(Math.floor(py / cellSize), 0, gridSize - 1);

      const r2 = radius * radius;
      const gx0 = Math.max(0, pgx - radius);
      const gx1 = Math.min(gridSize - 1, pgx + radius);
      const gy0 = Math.max(0, pgy - radius);
      const gy1 = Math.min(gridSize - 1, pgy + radius);

      for (let gy = gy0; gy <= gy1; gy++) {
        const dy = gy - pgy;
        for (let gx = gx0; gx <= gx1; gx++) {
          const dx = gx - pgx;
          if ((dx * dx + dy * dy) > r2) continue;
          const idx = gy * gridSize + gx;
          this.fogState[idx] = 2;
        }
      }

      for (let i = 0; i < this.fogState.length; i++) {
        const s = this.fogState[i];
        const cell = this.fogCells[i];
        if (!cell) continue;
        const a = (s === 2) ? 0 : (s === 1 ? 0.55 : 0.92);
        if (cell.alpha !== a) cell.setAlpha(a);
      }
    },

    ensureRadialLightTexture(key = 'fog_light_soft', size = 256) {
      if (this.textures.exists(key)) return key;

      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const r = Math.floor(size / 2);

      const steps = 64;
      for (let i = 0; i < steps; i++) {
        const t = (steps <= 1) ? 1 : (i / (steps - 1));
        const rad = Phaser.Math.Linear(r, 0, t);
        const alpha = Phaser.Math.Clamp(Math.pow(t, 2) * 0.38, 0, 1);
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(r, r, rad);
      }

      g.generateTexture(key, size, size);
      g.destroy();
      return key;
    },

    ensureGrassTileTexture(key = 'grass_tile_topdown', size = 256) {
      if (this.textures.exists(key)) return key;

      const g = this.make.graphics({ x: 0, y: 0, add: false });

      g.fillStyle(0x1d3b22, 1);
      g.fillRect(0, 0, size, size);

      for (let i = 0; i < 220; i++) {
        const x = Phaser.Math.Between(0, size);
        const y = Phaser.Math.Between(0, size);
        const r = Phaser.Math.Between(6, 22);
        const c = Phaser.Display.Color.GetColor(
          Phaser.Math.Between(18, 45),
          Phaser.Math.Between(60, 105),
          Phaser.Math.Between(22, 55)
        );
        const a = Phaser.Math.FloatBetween(0.06, 0.14);
        g.fillStyle(c, a);
        g.fillCircle(x, y, r);
      }

      for (let i = 0; i < 90; i++) {
        const x = Phaser.Math.Between(0, size);
        const y = Phaser.Math.Between(0, size);
        const r = Phaser.Math.Between(2, 6);
        g.fillStyle(0x3b2b18, Phaser.Math.FloatBetween(0.08, 0.18));
        g.fillCircle(x, y, r);
      }

      g.generateTexture(key, size, size);
      g.destroy();
      return key;
    },

    setupSoftFogOfWar() {
      if (this.fogMode !== 'soft') return;

      if (this.fogWorldRT) this.fogWorldRT.destroy();
      if (this.fogBrushImage) this.fogBrushImage.destroy();

      const cfg = this.mapConfig;
      if (!cfg) return;

      const worldSize = cfg.gridSize * cfg.cellSize;

      this.fogWorldRT = this.make.renderTexture({ x: 0, y: 0, width: worldSize, height: worldSize }, true);
      this.fogWorldRT.setOrigin(0, 0);
      this.fogWorldRT.setDepth(320);
      this.fogWorldRT.fill(0x000000, 0.90);

      const brushKey = this.ensureRadialLightTexture('fog_brush_soft', 256);
      this.fogBrushImage = this.make.image({ x: 0, y: 0, key: brushKey, add: false });
      this.fogBrushImage.setOrigin(0.5, 0.5);

      const desiredRadius = Math.floor(cfg.cellSize * 2.55);
      const baseRadius = 128;
      this._fogBrushBaseScale = desiredRadius / baseRadius;
      this.fogBrushImage.setScale(this._fogBrushBaseScale);

      this._fogRevealState = new Map();
      this._fogRevealMinDist = 10;

      this.revealFogAt(this.player?.x ?? 0, this.player?.y ?? 0, true, 1, { tag: 'spawn', minIntervalMs: 0, minDist: 0 });
    },

    revealFogAt(x, y, force = false, scaleMult = 1, opts = null) {
      if (this.fogMode !== 'soft') return;
      if (!this.fogWorldRT || !this.fogBrushImage) return;

      const o = (opts && typeof opts === 'object') ? opts : {};
      const tag = (typeof o.tag === 'string' && o.tag.length > 0) ? o.tag : 'default';
      const now = this.time?.now ?? 0;
      const minIntervalMs = Number.isFinite(o.minIntervalMs) ? o.minIntervalMs : 0;
      const minDist = Number.isFinite(o.minDist) ? o.minDist : (this._fogRevealMinDist || 0);

      if (!this._fogRevealState) this._fogRevealState = new Map();
      const prev = this._fogRevealState.get(tag) || null;
      if (!force && prev) {
        if (minIntervalMs > 0 && (now - (prev.at || 0)) < minIntervalMs) return;
        if (minDist > 0) {
          const dx = x - (prev.x || 0);
          const dy = y - (prev.y || 0);
          if ((dx * dx + dy * dy) < (minDist * minDist)) return;
        }
      }

      this._fogRevealState.set(tag, { x, y, at: now });

      const baseScaleRaw = this._fogBrushBaseScale || this.fogBrushImage.scaleX || 1;
      const baseScale = baseScaleRaw * (Number.isFinite(scaleMult) ? scaleMult : 1);

      // 单次擦除（原先双 pass 1.35x+0.78x 开销过大；合并为稍大的单次擦除即可）
      this.fogBrushImage.setAlpha(1);
      this.fogBrushImage.setScale(baseScale * 1.25);
      this.fogWorldRT.erase(this.fogBrushImage, x, y);
      this.fogBrushImage.setScale(baseScale);

      if (this.miniMap?.fogRT && this.miniMap?.sx && this.miniMap?.sy && this.miniMap?.fogBrushImage) {
        const mx = x * this.miniMap.sx;
        const my = y * this.miniMap.sy;
        const b = this.miniMap.fogBrushImage;
        const bScaleRaw = this._miniFogBrushBaseScale || b.scaleX || 1;
        const bScale = bScaleRaw * (Number.isFinite(scaleMult) ? scaleMult : 1);

        b.setAlpha(1);
        b.setScale(bScale * 1.25);
        this.miniMap.fogRT.erase(b, mx, my);
        b.setScale(bScale);
      }
    },

    setupFogOfWar() {
      if (this.fogLayer) this.fogLayer.destroy();
      if (this.lightSprite) this.lightSprite.destroy();

      const cam = this.cameras.main;
      this.fogLayer = this.make.renderTexture({
        x: 0,
        y: 0,
        width: cam.width,
        height: cam.height
      }, true);

      this.fogLayer.fill(0x000000, 0.88);
      this.fogLayer.setOrigin(0, 0);
      this.fogLayer.setScrollFactor(0);
      this.fogLayer.setDepth(400);

      const texKey = this.ensureRadialLightTexture();
      this.lightSprite = this.make.image({ x: 0, y: 0, key: texKey, add: false });
      this.lightSprite.setOrigin(0.5, 0.5);
      this.lightSprite.setScrollFactor(0);

      const desiredRadiusPx = Math.floor(Math.min(cam.width, cam.height) * 0.28);
      const baseRadius = 128;
      const scale = desiredRadiusPx / baseRadius;
      this.lightSprite.setScale(scale);

      this.fogLayer.mask = new Phaser.Display.Masks.BitmapMask(this, this.lightSprite);
      this.fogLayer.mask.invertAlpha = true;
    },

    setupMiniMap() {
      if (this.miniMapRoot) this.miniMapRoot.destroy();
      this.miniMapRoot = null;
      this.miniMap = null;
      if (this._mapNameText) {
        this._mapNameText.destroy();
        this._mapNameText = null;
      }
    },

    setupStartRoomMiniMap() {
      if (this.miniMapRoot) this.miniMapRoot.destroy();
      this.miniMap = null;
      this.miniMapRoot = null;
      if (this._mapNameText) {
        this._mapNameText.destroy();
        this._mapNameText = null;
      }
    },

    updateMapNameText() {
      if (this._mapNameText) {
        this._mapNameText.destroy();
        this._mapNameText = null;
      }
    },

    updateMiniMapOverlay() {
      return;
    },

    /**
     * 屏幕尺寸变化时重新定位小地图（底部锚定）
     */
    repositionMiniMap() {
      return;
    }

  });
}
