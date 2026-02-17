import Phaser from 'phaser';
import { STAGE_FLOW, LINE_META, NEUTRAL, getLayerChoices, getMapById } from '../../data/mapPool';
import { getMapMinions, getMapElites, getRoleSize, getRoleHp, getLayerScaling } from '../../data/mapMonsters';
import { BALANCE_CONSTANTS, getExitDoorWorldRect, getStageBalance } from '../../data/balanceConfig';
import { applyCoreUpgrade } from '../../classes/attacks/coreEnablers';
import { getBaseColorForCoreKey } from '../../classes/visual/basicSkillColors';
import TestMinion from '../../enemies/minions/TestMinion';

/**
 * 关卡推进/武器选择/Boss门/路径/怪物生成 相关方法
 */
export function applyLevelProgressionMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    advanceToNextLevel() {
      this.currentLevel = (this.currentLevel || 1) + 1;

      this.cleanupPathChoiceObjects();
      this._pathChoiceActive = false;

      this.exitDoorActive = false;
      if (this.exitDoorZone) {
        this.exitDoorZone.destroy();
        this.exitDoorZone = null;
      }
      if (Array.isArray(this.exitDoorVisuals)) {
        this.exitDoorVisuals.forEach(v => v?.destroy?.());
      }
      this.exitDoorVisuals = null;

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

      if (!this.currentMapInfo || this.currentMapInfo.id === 'start_room' || this.currentMapInfo.id === 'tutorial_level') {
        const stageEntry = STAGE_FLOW.find(s => s.layer === this.currentStage);
        if (stageEntry && stageEntry.mapId) {
          const fixedMap = getMapById(stageEntry.mapId);
          if (fixedMap) {
            this.currentMapInfo = { ...fixedMap };
            this.runState.visitedMapIds.push(fixedMap.id);
          }
        }
      }

      console.log('[MapBranch] advancing to level', this.currentLevel, 'stage', this.currentStage, 'map:', this.currentMapInfo?.name);

      this.setupWorldMapForLevel(this.currentLevel);

      this.setupSoftFogOfWar();
      this.setupMiniMap();

      const mapId = this.currentMapInfo?.id;
      if (mapId) {
        this.spawnMapMonsters(mapId);
      }

      this.levelBossTriggered = false;
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

      if (this.inStartRoom) {
        this.spawnStartRoomDoor();
      }

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

        this.systemMessage.show(`你获得了${className}技能 ${baseSkillName}，开始你的冒险吧！`, {
          key: 'startroom_got_skill',
          durationMs: 3200,
          onDismiss: () => {
          }
        });
      }

      this.levelBossTriggered = false;
    },

    onBossDefeatedOpenExitDoor() {
      if (!this.mapConfig) return;
      if (this.exitDoorActive) return;
      if (this._pathChoiceActive) return;

      try { this.bulletManager?.clearBossBullets?.(); } catch (_) { /* ignore */ }

      this.currentStage = (this.currentStage || 0) + 1;

      const flow = STAGE_FLOW.find(s => s.layer === this.currentStage);
      if (!flow) {
        this.showVictorySettlement();
        return;
      }

      if (flow.type === 'intro' || flow.type === 'choice') {
        this.showPathChoiceUI();
      } else if (flow.type === 'fixed') {
        const fixedMap = getMapById(flow.mapId);
        if (fixedMap) {
          this.currentMapInfo = { ...fixedMap };
          this.runState.visitedMapIds.push(fixedMap.id);
        }
        this.spawnSingleExitDoor();
      } else {
        this.spawnSingleExitDoor();
      }
    },

    spawnSingleExitDoor() {
      const { x, y, w, h } = getExitDoorWorldRect(this.mapConfig);

      this.exitDoorZone = this.add.zone(x, y, w, h);
      this.exitDoorActive = true;

      const frame = this.add.rectangle(x, y, w, h, 0x0b0b18, 0.65);
      frame.setStrokeStyle(3, 0xffdd88, 0.95);
      frame.setDepth(210);

      const txt = this.add.text(x, y, '进入大门\n下一关', {
        fontSize: '20px',
        color: '#ffdd88',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);
      txt.setDepth(211);

      this.exitDoorVisuals = [frame, txt];

      if (this.systemMessage) {
        this.systemMessage.show('Boss 已被击败！前往最上方大门进入下一关。', {
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
      const doorY = Math.floor(cell * 0.55);

      this._pathDoorZones = [];

      choices.forEach((choice, i) => {
        const cx = startX + i * (doorW + gap);
        const cy = doorY;

        const doorColor = (LINE_META[choice.line] || LINE_META[NEUTRAL])?.color || 0x888888;

        const doorBg = this.add.rectangle(cx, cy, doorW, doorH, 0x0b0b20, 0.85);
        doorBg.setStrokeStyle(3, doorColor, 0.95);
        doorBg.setDepth(210);

        const colorBar = this.add.rectangle(cx, cy - doorH / 2 + 5, doorW - 8, 5, doorColor, 0.9);
        colorBar.setDepth(211);

        const nameText = this.add.text(cx, cy - 10, choice.name, {
          fontSize: '16px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: doorW - 10 }
        }).setOrigin(0.5);
        nameText.setDepth(212);

        const subText = this.add.text(cx, cy + 14, choice.subtitle, {
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

        this._pathDoorZones.push({ zone, choice });
        this._pathChoiceObjects.push(doorBg, colorBar, nameText, subText, zone);
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

      const spawn = this.getSpawnPoint();
      const offsets = [
        { x: -140, y: -220 },
        { x: 120, y: -260 },
        { x: -40, y: -330 },
        { x: 180, y: -360 },
        { x: -180, y: -380 }
      ];

      const minions = offsets.map((o, idx) => {
        const m = new TestMinion(this, {
          x: spawn.x + o.x,
          y: spawn.y + o.y,
          type: 'chaser',
          name: `游荡小怪${idx + 1}`,
          hp: 170,
          size: 18,
          moveSpeed: 92,
          contactDamage: 12,
          expReward: 100,
          isElite: false
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

      const ringR = 140;
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.12, 0.12);
        const ox = Math.cos(a) * ringR + Phaser.Math.Between(-6, 6);
        const oy = Math.sin(a) * (ringR * 0.75) + Phaser.Math.Between(-6, 6);
        const m = new TestMinion(this, {
          x: centerX + ox,
          y: topY + oy,
          type: 'chaser',
          name: `第一波小怪${i + 1}`,
          hp: 30,
          size: 16,
          moveSpeed: 125,
          contactDamage: 8,
          expReward: 20,
          isElite: false,
          aggroOnSeen: true,
          hitReactionCdMs: Infinity
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
      const spawned = [];

      for (let i = 0; i < minionCount; i++) {
        const def = minions[i % minions.length];
        const size = getRoleSize('minion');
        const hp   = Math.round(balance.minions.hp);

        const mx = Phaser.Math.Between(Math.floor(cell * 1.5), Math.floor(worldSize - cell * 1.5));
        const my = Phaser.Math.Between(Math.floor(worldSize * 0.4), Math.floor(worldSize * 0.8));

        const m = new TestMinion(this, {
          x: mx,
          y: my,
          type: def.moveType === 'shooter' ? 'shooter' : 'chaser',
          name: def.name,
          hp,
          size,
          color: def.color,
          moveSpeed: balance.minions.speed[def.moveType] ?? balance.minions.speed.chaser,
          contactDamage: balance.minions.contactDamage,
          expReward: balance.minions.exp,
          isElite: false,
          aggroOnSeen: true,
          aggroRampMs: BALANCE_CONSTANTS.aggro.rampMs,
          shootCdMs: (def.moveType === 'shooter') ? balance.minions.projectiles.cdMs : undefined,
          shootBulletCount: (def.moveType === 'shooter') ? balance.minions.projectiles.count : undefined,
          shootBulletSpread: (def.moveType === 'shooter') ? balance.minions.projectiles.spread : undefined,
          shootBulletSpeed: (def.moveType === 'shooter') ? balance.minions.projectiles.speed : undefined,
          shootBulletDamage: (def.moveType === 'shooter') ? balance.minions.projectiles.damage : undefined,
          // 前两关显著降低弹幕：把“受击反击”基本关掉
          hitReactionCdMs: (stage <= 2) ? Infinity : undefined,
        });
        spawned.push(m);
      }

      const eliteCount = Phaser.Math.Between(balance.elites.countMin, balance.elites.countMax);
      for (let i = 0; i < eliteCount; i++) {
        const def = elites[i % elites.length];
        const size = getRoleSize('elite');
        const hp   = Math.round(balance.elites.hp);

        const ex = Phaser.Math.Between(Math.floor(cell * 2), Math.floor(worldSize - cell * 2));
        const ey = Phaser.Math.Between(Math.floor(worldSize * 0.15), Math.floor(worldSize * 0.45));

        const m = new TestMinion(this, {
          x: ex,
          y: ey,
          type: def.moveType === 'shooter' ? 'shooter' : 'chaser',
          name: def.name,
          hp,
          size,
          color: def.color,
          moveSpeed: balance.elites.speed[def.moveType] ?? balance.elites.speed.chaser,
          contactDamage: balance.elites.contactDamage,
          expReward: balance.elites.exp,
          isElite: true,
          aggroOnSeen: true,
          aggroRampMs: BALANCE_CONSTANTS.aggro.rampMs,
          shootCdMs: (def.moveType === 'shooter') ? balance.elites.projectiles.cdMs : undefined,
          shootBulletCount: (def.moveType === 'shooter') ? balance.elites.projectiles.count : undefined,
          shootBulletSpread: (def.moveType === 'shooter') ? balance.elites.projectiles.spread : undefined,
          shootBulletSpeed: (def.moveType === 'shooter') ? balance.elites.projectiles.speed : undefined,
          shootBulletDamage: (def.moveType === 'shooter') ? balance.elites.projectiles.damage : undefined,
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
