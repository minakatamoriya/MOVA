import Phaser from 'phaser';
import { START_ROOM, NEUTRAL } from '../../data/mapPool';
import { getMapBoss } from '../../data/mapMonsters';

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
        debugGrid: false
      };
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
        // 起始房间：出生点放在正中心，保证 UI/武器选择环不会出屏
        x: Math.floor(cfg.worldW / 2),
        y: Math.floor(cfg.worldH / 2)
      };
    },

    cleanupStartRoomObjects() {
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
    },

    enterStartRoom() {
      this.inStartRoom = true;
      this.adventureStarted = false;

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
        debugGrid: false
      };
      this.worldBoundsRect = new Phaser.Geom.Rectangle(0, 0, cfg.worldW, cfg.worldH);

      const bgKey = this.ensureGrassTileTexture('grass_tile_startroom', 256);
      const bg = this.add.tileSprite(0, 0, cfg.worldW, cfg.worldH, bgKey).setOrigin(0, 0);
      bg.setDepth(-100);
      this._startRoomObjects.push(bg);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, cfg.worldW, cfg.worldH);

      const spawn = this.getStartRoomSpawnPoint();
      this.player.setPosition(spawn.x, spawn.y);
      cam.startFollow(this.player, true, 0.18, 0.18);
      cam.setFollowOffset(0, 0);

      this.weaponSelected = false;
      this.setupStartingWeaponPickups({ force: true, layout: 'startRoom' });

      this.currentMapInfo = { ...START_ROOM };
      this.setupStartRoomMiniMap();

      if (this.systemMessage) {
        this.systemMessage.show('请选择一件趁手的武器！', {
          key: 'startroom_pick_weapon',
          sticky: true
        });
      }

      console.log('[StartRoom] entered. weaponSelected=', this.weaponSelected);
    },

    spawnStartRoomDoor() {
      if (this.startRoomDoorActive) return;
      if (!this.weaponSelected) return;

      const cfg = this.getStartRoomConfig();
      const x = Math.floor(cfg.worldW / 2);
      const y = Math.floor(cfg.cellSize * 0.65);

      this.startRoomDoorZone = this.add.zone(x, y, cfg.cellSize * 2.0, cfg.cellSize * 1.0);
      this.startRoomDoorActive = true;

      const frame = this.add.rectangle(x, y, cfg.cellSize * 2.0, cfg.cellSize * 1.0, 0x0b0b18, 0.70);
      frame.setStrokeStyle(4, 0xffffff, 0.95);
      frame.setDepth(380);

      const txt = this.add.text(x, y, '进入大门\n开始冒险', {
        fontSize: '22px',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);
      txt.setDepth(381);

      this.startRoomDoorVisuals = [frame, txt];
      this._startRoomObjects.push(frame, txt, this.startRoomDoorZone);
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
      this.currentStage = 0;
      this.levelBossTriggered = false;

      this.currentMapInfo = { id: 'tutorial_level', name: '试炼之地', subtitle: '教程', line: NEUTRAL };

      this.cleanupStartRoomObjects();

      this.fogMode = 'soft';
      this.setupWorldMapForLevel(this.currentLevel);
      this.setupSoftFogOfWar();
      this.setupMiniMap();

      this.spawnLevel1IntroWave();
    },

    getBossSpawnPoint() {
      const cfg = this.mapConfig;
      if (!cfg) return { x: this.gameArea.x + this.gameArea.width / 2, y: this.gameArea.y + 150 };

      const worldSize = cfg.gridSize * cfg.cellSize;
      return {
        x: Math.floor(worldSize / 2),
        y: Math.floor(cfg.cellSize * 1.25)
      };
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

      this.worldBoundsRect = new Phaser.Geom.Rectangle(0, 0, worldSize, worldSize);

      const grassKey = this.ensureGrassTileTexture();
      const bg = this.add.tileSprite(0, 0, worldSize, worldSize, grassKey).setOrigin(0, 0);
      bg.setDepth(-100);
      this._worldMapObjects.push(bg);

      if (debugGrid) {
        const g = this.add.graphics();
        g.setDepth(-90);
        g.lineStyle(1, 0x222244, 0.55);
        for (let i = 0; i <= gridSize; i++) {
          const p = i * cellSize;
          g.beginPath();
          g.moveTo(0, p);
          g.lineTo(worldSize, p);
          g.strokePath();

          g.beginPath();
          g.moveTo(p, 0);
          g.lineTo(p, worldSize);
          g.strokePath();
        }
        this._worldMapObjects.push(g);
        this.debugGridGraphics = g;
      }

      const bossPt = this.getBossSpawnPoint();
      this.bossRoomZone = this.add.zone(bossPt.x, bossPt.y, cellSize * 2, cellSize * 2);
      this.bossRoomZone.setDepth(-80);
      this._worldMapObjects.push(this.bossRoomZone);
      this.levelBossTriggered = false;

      const cam = this.cameras.main;
      cam.setBounds(0, 0, worldSize, worldSize);
      if (this.player) {
        const spawn = this.getSpawnPoint();
        this.player.setPosition(spawn.x, spawn.y);
        cam.startFollow(this.player, true, 0.12, 0.12);
        cam.setFollowOffset(0, 0);
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
            const bPt = this.getBossSpawnPoint();
            this.bossManager.spawnMapBoss(mapBossData, bPt, this.currentStage || 1, true);
          }

          const b = this.bossManager.getCurrentBoss?.();
          if (b && typeof b.setCombatActive === 'function') {
            b.setCombatActive(false);
          } else if (b) {
            b.combatActive = false;
          }
          this.levelBossTriggered = true;
        }
      }
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

      this.fogBrushImage.setAlpha(1);
      this.fogBrushImage.setScale(baseScale * 1.35);
      this.fogWorldRT.erase(this.fogBrushImage, x, y);

      this.fogBrushImage.setScale(baseScale * 0.78);
      this.fogWorldRT.erase(this.fogBrushImage, x, y);

      this.fogBrushImage.setScale(baseScale);

      if (this.miniMap?.fogRT && this.miniMap?.sx && this.miniMap?.sy && this.miniMap?.fogBrushImage) {
        const mx = x * this.miniMap.sx;
        const my = y * this.miniMap.sy;
        const b = this.miniMap.fogBrushImage;
        const bScaleRaw = this._miniFogBrushBaseScale || b.scaleX || 1;
        const bScale = bScaleRaw * (Number.isFinite(scaleMult) ? scaleMult : 1);

        b.setAlpha(1);
        b.setScale(bScale * 1.35);
        this.miniMap.fogRT.erase(b, mx, my);

        b.setScale(bScale * 0.78);
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

      const cam = this.cameras.main;

      const margin = 16;
      const miniW = 130;
      const miniH = 130;
      const x0 = margin;
      const y0 = cam.height - margin - miniH;

      this.miniMapRoot = this.add.container(0, 0);
      this.miniMapRoot.setDepth(950);
      this.miniMapRoot.setScrollFactor(0);

      const bg = this.add.rectangle(x0, y0, miniW, miniH, 0x060610, 0.82).setOrigin(0, 0);
      bg.setStrokeStyle(2, 0x2a2a3a, 0.9);
      bg.setScrollFactor(0);

      const mapG = this.add.graphics();
      mapG.setScrollFactor(0);
      mapG.setPosition(x0, y0);

      const cfg = this.mapConfig;
      const worldSize = cfg.gridSize * cfg.cellSize;
      const sx = miniW / worldSize;
      const sy = miniH / worldSize;

      mapG.clear();
      // 小地图底色：略调亮，提高与“未探索迷雾”的对比度
      mapG.fillStyle(0x222a44, 1);
      mapG.fillRect(0, 0, miniW, miniH);

      mapG.lineStyle(1, 0x222244, 0.35);
      for (let i = 0; i <= cfg.gridSize; i++) {
        const p = i * cfg.cellSize;
        mapG.beginPath();
        mapG.moveTo(0, p * sy);
        mapG.lineTo(miniW, p * sy);
        mapG.strokePath();

        mapG.beginPath();
        mapG.moveTo(p * sx, 0);
        mapG.lineTo(p * sx, miniH);
        mapG.strokePath();
      }

      const overlay = this.add.graphics();
      overlay.setScrollFactor(0);
      overlay.setPosition(x0, y0);

      const fogRT = this.make.renderTexture({ x: x0, y: y0, width: miniW, height: miniH }, true);
      fogRT.setOrigin(0, 0);
      fogRT.setScrollFactor(0);
      fogRT.setDepth(951);
      // 未探索迷雾：更黑更不透明，突出“未探索 vs 已探索”的差异
      fogRT.fill(0x000000, 0.94);

      const brushKey = this.ensureRadialLightTexture('minimap_fog_brush_soft', 128);
      const fogBrushImage = this.make.image({ x: 0, y: 0, key: brushKey, add: false });
      fogBrushImage.setOrigin(0.5, 0.5);
      const miniDesiredRadius = 26;
      const miniBaseRadius = 64;
      this._miniFogBrushBaseScale = miniDesiredRadius / miniBaseRadius;
      fogBrushImage.setScale(this._miniFogBrushBaseScale);

      this.miniMap = {
        x0,
        y0,
        w: miniW,
        h: miniH,
        sx,
        sy,
        overlay,
        fogRT,
        fogBrushImage
      };

      this.miniMapRoot.add([bg, mapG, fogRT, overlay]);

      this.updateMapNameText();
    },

    setupStartRoomMiniMap() {
      if (this.miniMapRoot) this.miniMapRoot.destroy();
      this.miniMap = null;

      const cam = this.cameras.main;
      const margin = 16;
      const miniW = 130;
      const miniH = 130;
      const x0 = margin;
      const y0 = cam.height - margin - miniH;

      this.miniMapRoot = this.add.container(0, 0);
      this.miniMapRoot.setDepth(950);
      this.miniMapRoot.setScrollFactor(0);

      const bg = this.add.rectangle(x0, y0, miniW, miniH, 0x060610, 0.82).setOrigin(0, 0);
      bg.setStrokeStyle(2, 0x2a2a3a, 0.9);
      bg.setScrollFactor(0);

      const mapG = this.add.graphics();
      mapG.setScrollFactor(0);
      mapG.setPosition(x0, y0);

      mapG.clear();
      mapG.fillStyle(0x222a44, 1);
      mapG.fillRect(0, 0, miniW, miniH);

      const cx = miniW / 2;
      const cy = miniH / 2;
      const armW = 8;
      const armL = 40;
      mapG.fillStyle(0x4466aa, 0.6);
      mapG.fillRect(cx - armW / 2, cy - armL, armW, armL * 2);
      mapG.fillRect(cx - armL, cy - armW / 2, armL * 2, armW);
      mapG.fillStyle(0x88bbff, 0.8);
      mapG.fillCircle(cx, cy, 6);

      const overlay = this.add.graphics();
      overlay.setScrollFactor(0);
      overlay.setPosition(x0, y0);

      const cfg = this.getStartRoomConfig();
      const sx = miniW / cfg.worldW;
      const sy = miniH / cfg.worldH;

      this.miniMap = {
        x0, y0,
        w: miniW, h: miniH,
        sx, sy,
        overlay,
        fogRT: null,
        fogBrushImage: null
      };

      this.miniMapRoot.add([bg, mapG, overlay]);

      this.updateMapNameText();
    },

    updateMapNameText() {
      if (this._mapNameText) {
        this._mapNameText.destroy();
        this._mapNameText = null;
      }
      if (!this.miniMap) return;

      const name = this.currentMapInfo?.name || '未知地点';
      const { x0, y0, w } = this.miniMap;

      this._mapNameText = this.add.text(x0 + w / 2, y0 - 10, name, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#ccddff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
      }).setOrigin(0.5, 1);
      this._mapNameText.setScrollFactor(0);
      this._mapNameText.setDepth(952);
    },

    updateMiniMapOverlay() {
      if (!this.miniMap || !this.player) return;

      const now = this.time?.now ?? 0;
      if (this._miniMapOverlayNextAt && now < this._miniMapOverlayNextAt) return;
      this._miniMapOverlayNextAt = now + 50;

      const cfg = this.mapConfig;
      const worldW = this.inStartRoom ? (this.getStartRoomConfig().worldW) : (cfg.gridSize * cfg.cellSize);
      const worldH = this.inStartRoom ? (this.getStartRoomConfig().worldH) : (cfg.gridSize * cfg.cellSize);

      const { overlay, sx, sy } = this.miniMap;
      const cam = this.cameras.main;
      const view = cam.worldView;

      // 若玩家移动到小地图遮挡区域：淡化小地图
      {
        const { x0, y0, w, h } = this.miniMap;
        const zoom = (cam && Number.isFinite(cam.zoom)) ? cam.zoom : 1;
        const bounds = (typeof this.player.getBounds === 'function')
          ? this.player.getBounds()
          : { left: this.player.x - 16, right: this.player.x + 16, top: this.player.y - 16, bottom: this.player.y + 16 };
        const pad = 2;
        const pLeft = (bounds.left - view.x) * zoom;
        const pRight = (bounds.right - view.x) * zoom;
        const pTop = (bounds.top - view.y) * zoom;
        const pBottom = (bounds.bottom - view.y) * zoom;

        // 以“边界矩形”判定，而不是中心点；一旦边界触碰到小地图区域就淡化
        const mmLeft = x0;
        const mmRight = x0 + w;
        const mmTop = y0;
        const mmBottom = y0 + h;

        const overlapped = !(pRight < (mmLeft - pad) || pLeft > (mmRight + pad) || pBottom < (mmTop - pad) || pTop > (mmBottom + pad));
        const targetAlpha = overlapped ? 0.2 : 1;

        if (this.miniMapRoot && this.miniMapRoot.alpha !== targetAlpha) {
          this.miniMapRoot.setAlpha(targetAlpha);
        }
        if (this._mapNameText && this._mapNameText.alpha !== targetAlpha) {
          this._mapNameText.setAlpha(targetAlpha);
        }
      }

      const px = Phaser.Math.Clamp(this.player.x, 0, worldW);
      const py = Phaser.Math.Clamp(this.player.y, 0, worldH);

      const mx = px * sx;
      const my = py * sy;

      const vx = Phaser.Math.Clamp(view.x, 0, worldW) * sx;
      const vy = Phaser.Math.Clamp(view.y, 0, worldH) * sy;
      const vw = Phaser.Math.Clamp(view.width, 0, worldW) * sx;
      const vh = Phaser.Math.Clamp(view.height, 0, worldH) * sy;

      overlay.clear();
      overlay.lineStyle(2, 0xffffff, 0.9);
      overlay.strokeRect(vx, vy, vw, vh);

      overlay.fillStyle(0x00ffff, 1);
      overlay.fillCircle(mx, my, 3);
    },

    /**
     * 屏幕尺寸变化时重新定位小地图（底部锚定）
     */
    repositionMiniMap() {
      if (!this.miniMapRoot || !this.miniMap) return;

      // 重建小地图以正确定位
      if (this.inStartRoom) {
        this.setupStartRoomMiniMap();
      } else {
        this.setupMiniMap();
      }
    }

  });
}
