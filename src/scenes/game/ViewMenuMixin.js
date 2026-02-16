import Phaser from 'phaser';
import { uiBus } from '../../ui/bus';
import { TREE_DEFS, buildThirdTalentTreePlaceholder } from '../../classes/talentTrees';

/**
 * 查看菜单（职业配置 / 装备背包 / 全局属性）相关方法
 */
export function applyViewMenuMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    createViewMenu() {
      this.viewMenuOpen = false;
      this.viewMenuClosing = false;
      this.viewActiveTab = 'classes';

      const cam = this.cameras.main;
      const w = cam.width;
      const h = cam.height;
      const x = cam.centerX;
      const y = cam.centerY;

      const contentPad = 32;

      this.viewMenuRoot = this.add.container(0, 0);
      this.viewMenuRoot.setDepth(2000);
      this.viewMenuRoot.setScrollFactor(0);
      this.viewMenuRoot.setVisible(false);

      this.viewMenuDim = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.55).setOrigin(0, 0);

      this.viewMenuPanelRoot = this.add.container(0, cam.height);

      const panel = this.textures.exists('ui_panel')
        ? this.add.image(x, y, 'ui_panel').setDisplaySize(w, h)
        : this.add.rectangle(x, y, w, h, 0x0f101a, 0.98);
      if (panel.type === 'Rectangle') {
        panel.setStrokeStyle(2, 0x2a2a3a);
      }

      const title = this.add.text(x - w / 2 + contentPad, y - h / 2 + 18, '查看', {
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold'
      });

      const closeBtn = this.createButton(
        x + w / 2 - contentPad - 40,
        y - h / 2 + 28,
        '关闭',
        () => this.closeViewMenu(),
        80,
        30,
        '18px'
      );

      const tabY = y - h / 2 + 80;
      const tabGap = 10;
      const tabW = Math.floor((w - contentPad * 2 - tabGap * 2) / 3);
      const tabH = 52;
      const tabX0 = x - w / 2 + contentPad + tabW / 2;

      this.viewTabs = {
        classes: this.createViewTabButton(tabX0 + (tabW + tabGap) * 0, tabY, tabW, tabH, '职业配置', () => this.switchViewTab('classes'), { fontSize: 20 }),
        bag: this.createViewTabButton(tabX0 + (tabW + tabGap) * 1, tabY, tabW, tabH, '装备背包', () => this.switchViewTab('bag'), { fontSize: 20 }),
        stats: this.createViewTabButton(tabX0 + (tabW + tabGap) * 2, tabY, tabW, tabH, '全局属性', () => this.switchViewTab('stats'), { fontSize: 20 })
      };

      const contentY = tabY + 44;
      const contentH = h - 140;
      const contentW = w - contentPad * 2;
      const contentX = x;

      this.viewMenuLayout = {
        w,
        h,
        x,
        y,
        contentPad,
        tabY,
        tabH,
        contentY,
        contentH,
        contentW,
        contentX
      };

      this.viewContentRoot = this.add.container(0, 0);

      this.viewPanelClasses = this.add.container(0, 0);
      this.viewPanelBag = this.add.container(0, 0);
      this.viewPanelStats = this.add.container(0, 0);

      // Classes panel
      this.viewTalentRoot = this.add.container(0, 0);
      this.viewTalentDetailBg = this.textures.exists('ui_card')
        ? this.add.image(contentX, y + h / 2 - 70, 'ui_card').setDisplaySize(contentW, 92)
        : this.add.rectangle(contentX, y + h / 2 - 70, contentW, 92, 0x1a1a2a, 0.95);
      this.viewTalentDetailBorder = this.add.rectangle(contentX, y + h / 2 - 70, contentW, 92, 0x000000, 0);
      this.viewTalentDetailBorder.setStrokeStyle(2, 0x2a2a3a);
      this.viewTalentDetailText = this.add.text(contentX - contentW / 2 + 12, y + h / 2 - 104, '点击天赋节点查看说明', {
        fontSize: '18px',
        color: '#ffffff',
        wordWrap: { width: contentW - 24 }
      });
      this.viewPanelClasses.add([this.viewTalentRoot, this.viewTalentDetailBg, this.viewTalentDetailBorder, this.viewTalentDetailText]);

      // Bag panel
      this.viewBagEquippedSectionBg = this.textures.exists('ui_card')
        ? this.add.image(contentX, contentY + 120, 'ui_card').setDisplaySize(contentW, 160)
        : this.add.rectangle(contentX, contentY + 120, contentW, 160, 0x111126, 0.85);
      this.viewBagEquippedSectionBorder = this.add.rectangle(contentX, contentY + 120, contentW, 160, 0x000000, 0);
      this.viewBagEquippedSectionBorder.setStrokeStyle(2, 0x2a2a3a);
      this.viewBagEquippedTitle = this.add.text(contentX - contentW / 2 + 16, contentY + 48, '携带', {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold'
      });

      this.viewBagLootSectionBg = this.textures.exists('ui_card')
        ? this.add.image(contentX, contentY + 330, 'ui_card').setDisplaySize(contentW, 240)
        : this.add.rectangle(contentX, contentY + 330, contentW, 240, 0x111126, 0.85);
      this.viewBagLootSectionBorder = this.add.rectangle(contentX, contentY + 330, contentW, 240, 0x000000, 0);
      this.viewBagLootSectionBorder.setStrokeStyle(2, 0x2a2a3a);
      this.viewBagLootTitle = this.add.text(contentX - contentW / 2 + 16, contentY + 250, '战利品', {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold'
      });

      this.viewBagCells = [];
      this.viewLootCells = [];

      this.viewItemDetailBg = this.textures.exists('ui_card')
        ? this.add.image(contentX, y + h / 2 - 70, 'ui_card').setDisplaySize(contentW, 92)
        : this.add.rectangle(contentX, y + h / 2 - 70, contentW, 92, 0x1a1a2a, 0.95);
      this.viewItemDetailBorder = this.add.rectangle(contentX, y + h / 2 - 70, contentW, 92, 0x000000, 0);
      this.viewItemDetailBorder.setStrokeStyle(2, 0x2a2a3a);
      this.viewItemDetailText = this.add.text(contentX - contentW / 2 + 12, y + h / 2 - 104, '点击物品查看说明', {
        fontSize: '18px',
        color: '#ffffff',
        wordWrap: { width: contentW - 24 }
      });

      this.viewPanelBag.add([
        this.viewBagEquippedSectionBg,
        this.viewBagEquippedSectionBorder,
        this.viewBagEquippedTitle,
        this.viewBagLootSectionBg,
        this.viewBagLootSectionBorder,
        this.viewBagLootTitle,
        this.viewItemDetailBg,
        this.viewItemDetailBorder,
        this.viewItemDetailText
      ]);

      // Stats panel
      this.viewStatsText = this.add.text(contentX - contentW / 2 + 2, contentY + 12, '', {
        fontSize: '20px',
        color: '#ffffff',
        lineSpacing: 10
      });
      this.viewPanelStats.add([this.viewStatsText]);

      // Layout root
      this.viewContentRoot.add([this.viewPanelClasses, this.viewPanelBag, this.viewPanelStats]);

      this.viewMenuPanelRoot.add([panel, title, closeBtn, ...Object.values(this.viewTabs), this.viewContentRoot]);
      this.viewMenuRoot.add([this.viewMenuDim, this.viewMenuPanelRoot]);

      this.switchViewTab('classes');
    },

    createViewTabButton(x, y, width, height, label, onClick, options = {}) {
      const container = this.add.container(x, y);
      const bg = this.textures.exists('ui_tab')
        ? this.add.image(0, 0, 'ui_tab').setDisplaySize(width, height)
        : this.add.rectangle(0, 0, width, height, 0x141424, 0.95);
      if (bg.type === 'Rectangle') {
        bg.setStrokeStyle(3, 0x2a2a3a);
      }

      const border = this.add.rectangle(0, 0, width, height, 0x000000, 0);
      border.setStrokeStyle(3, 0x2a2a3a);

      const fontSize = options.fontSize || 13;
      const text = this.add.text(0, 0, label, { fontSize: `${fontSize}px`, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      container.add([bg, border, text]);
      container.setSize(width, height);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerup', onClick);
      container.setData('bg', bg);
      container.setData('text', text);
      container.setData('border', border);
      return container;
    },

    switchViewTab(key) {
      this.viewActiveTab = key;

      const setTabState = (tabKey, active) => {
        const tab = this.viewTabs?.[tabKey];
        const bg = tab?.getData('bg');
        if (bg) {
          if (bg.setFillStyle) {
            bg.setFillStyle(active ? 0x2a2a44 : 0x141424, active ? 1 : 0.95);
          }
          if (bg.setTint) {
            if (active) bg.setTint(0x9fb9ff);
            else bg.clearTint();
          }
        }

        const border = tab?.getData('border');
        if (border?.setStrokeStyle) {
          border.setStrokeStyle(3, active ? 0x66ccff : 0x2a2a3a, 1);
        }

        const text = tab?.getData('text');
        if (text) {
          text.setAlpha(active ? 1 : 0.9);
        }
      };

      setTabState('classes', key === 'classes');
      setTabState('bag', key === 'bag');
      setTabState('stats', key === 'stats');

      if (this.viewPanelClasses) this.viewPanelClasses.setVisible(key === 'classes');
      if (this.viewPanelBag) this.viewPanelBag.setVisible(key === 'bag');
      if (this.viewPanelStats) this.viewPanelStats.setVisible(key === 'stats');

      this.refreshViewMenuPanels();
    },

    openViewMenu() {
      // React UI 模式
      if (this.isReactUiMode()) {
        if (this.viewMenuOpen && !this.viewMenuClosing) return;

        // 打开暂停/查看界面前，先清空摇杆与模拟移动输入，避免恢复后延续旧方向。
        this.resetTouchJoystickInput?.();

        this.viewMenuOpen = true;
        this.viewMenuClosing = false;

        if (this.physics?.world) {
          this.physics.world.pause();
        }
        if (this.anims?.pauseAll) {
          this.anims.pauseAll();
        }
        if (this.time) {
          this.time.paused = true;
        }

        this.pauseNonMenuTweensForViewMenu();

        this.emitUiSnapshot();

        uiBus.emit('phaser:viewOpenChanged', true);
        return;
      }

      if (!this.viewMenuRoot) this.createViewMenu();
      if (this.viewMenuOpen && !this.viewMenuClosing) return;
      this.viewMenuOpen = true;
      this.viewMenuClosing = false;
      this.viewMenuRoot.setVisible(true);

      if (this.physics?.world) {
        this.physics.world.pause();
      }
      if (this.anims?.pauseAll) {
        this.anims.pauseAll();
      }
      if (this.time) {
        this.time.paused = true;
      }

      this.pauseNonMenuTweensForViewMenu();

      if (this.viewMenuPanelRoot) {
        this.tweens.killTweensOf(this.viewMenuPanelRoot);
        this.viewMenuPanelRoot.y = this.cameras.main.height;
        this.tweens.add({
          targets: this.viewMenuPanelRoot,
          y: 0,
          duration: 220,
          ease: 'Cubic.Out'
        });
      }

      this.refreshViewMenuPanels();

      uiBus.emit('phaser:viewOpenChanged', true);
    },

    closeViewMenu() {
      if (!this.viewMenuOpen || this.viewMenuClosing) return;

      // React UI 模式
      if (this.isReactUiMode()) {
        this.viewMenuClosing = false;
        this.viewMenuOpen = false;

        // 关闭菜单恢复前也再兜底清一次，防止菜单期间抬手/切换导致状态残留。
        this.resetTouchJoystickInput?.();

        if (this.anims?.resumeAll) {
          this.anims.resumeAll();
        }
        if (this.physics?.world) {
          this.physics.world.resume();
        }
        if (this.time) {
          this.time.paused = false;
        }

        this.resumeNonMenuTweensForViewMenu();

        this._viewMenuResumePending = true;

        uiBus.emit('phaser:viewOpenChanged', false);
        return;
      }

      this.viewMenuClosing = true;

      if (this.viewMenuPanelRoot) {
        this.tweens.killTweensOf(this.viewMenuPanelRoot);
        this.tweens.add({
          targets: this.viewMenuPanelRoot,
          y: this.cameras.main.height,
          duration: 180,
          ease: 'Cubic.In',
          onComplete: () => {
            if (this.viewMenuRoot) this.viewMenuRoot.setVisible(false);

            this.viewMenuOpen = false;
            this.viewMenuClosing = false;
            if (this.anims?.resumeAll) {
              this.anims.resumeAll();
            }
            if (this.physics?.world) {
              this.physics.world.resume();
            }
            if (this.time) {
              this.time.paused = false;
            }

            this.resumeNonMenuTweensForViewMenu();

            this._viewMenuResumePending = true;

            uiBus.emit('phaser:viewOpenChanged', false);
          }
        });
      } else {
        if (this.viewMenuRoot) this.viewMenuRoot.setVisible(false);
        this.viewMenuOpen = false;
        this.viewMenuClosing = false;
        if (this.anims?.resumeAll) {
          this.anims.resumeAll();
        }
        if (this.physics?.world) {
          this.physics.world.resume();
        }
        if (this.time) {
          this.time.paused = false;
        }

        this.resumeNonMenuTweensForViewMenu();

        this._viewMenuResumePending = true;

        uiBus.emit('phaser:viewOpenChanged', false);
      }
    },

    pauseNonMenuTweensForViewMenu() {
      this._viewMenuPausedTweens = [];
      const tweenMgr = this.tweens;
      if (!tweenMgr?.getAllTweens) return;

      const menuTargets = new Set([this.viewMenuRoot, this.viewMenuPanelRoot, this.viewMenuDim]);
      tweenMgr.getAllTweens().forEach((tween) => {
        if (!tween || tween.isPaused?.()) return;
        const targets = tween.targets || [];
        const hasMenuTarget = Array.isArray(targets) && targets.some(t => menuTargets.has(t));
        if (hasMenuTarget) return;

        if (tween.pause) {
          tween.pause();
          this._viewMenuPausedTweens.push(tween);
        }
      });
    },

    resumeNonMenuTweensForViewMenu() {
      const list = this._viewMenuPausedTweens;
      if (!list || list.length === 0) return;
      list.forEach((tween) => {
        if (!tween) return;
        if (tween.resume) tween.resume();
      });
      this._viewMenuPausedTweens = [];
    },

    refreshViewMenuPanels() {
      if (!this.viewMenuOpen) return;

      if (this.viewActiveTab === 'classes') {
        this.refreshViewTalentTrees();
      }

      if (this.viewActiveTab === 'bag') {
        this.refreshViewInventoryGrid();
      }

      if (this.viewActiveTab === 'stats') {
        this.refreshViewStatsPanel();
      }
    },

    refreshViewInventoryGrid() {
      if (!this.viewPanelBag) return;

      const destroyCells = (cells) => {
        if (!cells) return;
        cells.forEach((c) => {
          if (c?.container?.active) c.container.destroy();
        });
        cells.length = 0;
      };
      destroyCells(this.viewBagCells);
      destroyCells(this.viewLootCells);

      const cam = this.cameras.main;
      const layout = this.viewMenuLayout;
      const w = layout?.w ?? cam.width;
      const h = layout?.h ?? cam.height;
      const x = layout?.x ?? cam.centerX;
      const y = layout?.y ?? cam.centerY;
      const contentPad = layout?.contentPad ?? 32;
      const contentY = layout?.contentY ?? ((y - h / 2 + 80) + 44);
      const contentW = layout?.contentW ?? (w - contentPad * 2);
      const contentX = layout?.contentX ?? x;

      const cellSize = Phaser.Math.Clamp(Math.floor((contentW - 14 * 5) / 6), 72, 96);
      const gap = Phaser.Math.Clamp(Math.floor((contentW - cellSize * 6) / 5), 12, 28);
      const rowW = cellSize * 6 + gap * 5;
      const startX = contentX - rowW / 2 + cellSize / 2;

      const detailTop = (this.viewItemDetailBg?.y ?? (y + h / 2 - 70)) - ((this.viewItemDetailBg?.height ?? 92) / 2) - 16;
      const top = contentY + 10;

      const headerH = 34;
      const sectionPadY = 14;
      const equippedSectionH = headerH + sectionPadY * 2 + cellSize;
      const lootSectionH = headerH + sectionPadY * 2 + (cellSize * 2 + gap);
      const sectionGapY = 16;

      const needed = equippedSectionH + sectionGapY + lootSectionH;
      const available = Math.max(0, detailTop - top);
      const startY = top + Math.max(0, Math.floor((available - needed) / 2));

      const equippedCenterY = startY + equippedSectionH / 2;
      const lootCenterY = startY + equippedSectionH + sectionGapY + lootSectionH / 2;

      if (this.viewBagEquippedSectionBg) {
        this.viewBagEquippedSectionBg.setPosition(contentX, equippedCenterY);
        if (this.viewBagEquippedSectionBg.setSize) {
          this.viewBagEquippedSectionBg.setSize(contentW, equippedSectionH);
        } else if (this.viewBagEquippedSectionBg.setDisplaySize) {
          this.viewBagEquippedSectionBg.setDisplaySize(contentW, equippedSectionH);
        }
        if (this.viewBagEquippedSectionBg.setFillStyle) {
          this.viewBagEquippedSectionBg.setFillStyle(0x111126, 0.88);
        }
      }
      if (this.viewBagEquippedSectionBorder) {
        this.viewBagEquippedSectionBorder.setPosition(contentX, equippedCenterY);
        this.viewBagEquippedSectionBorder.setSize(contentW, equippedSectionH);
        this.viewBagEquippedSectionBorder.setStrokeStyle(2, 0x2a2a3a, 1);
      }
      if (this.viewBagEquippedTitle) {
        this.viewBagEquippedTitle.setPosition(contentX - contentW / 2 + 16, equippedCenterY - equippedSectionH / 2 + 10);
        this.viewBagEquippedTitle.setText('携带（固定 6 格）');
        this.viewBagEquippedTitle.setFontSize(22);
      }

      if (this.viewBagLootSectionBg) {
        this.viewBagLootSectionBg.setPosition(contentX, lootCenterY);
        if (this.viewBagLootSectionBg.setSize) {
          this.viewBagLootSectionBg.setSize(contentW, lootSectionH);
        } else if (this.viewBagLootSectionBg.setDisplaySize) {
          this.viewBagLootSectionBg.setDisplaySize(contentW, lootSectionH);
        }
        if (this.viewBagLootSectionBg.setFillStyle) {
          this.viewBagLootSectionBg.setFillStyle(0x111126, 0.88);
        }
      }
      if (this.viewBagLootSectionBorder) {
        this.viewBagLootSectionBorder.setPosition(contentX, lootCenterY);
        this.viewBagLootSectionBorder.setSize(contentW, lootSectionH);
        this.viewBagLootSectionBorder.setStrokeStyle(2, 0x2a2a3a, 1);
      }
      if (this.viewBagLootTitle) {
        this.viewBagLootTitle.setPosition(contentX - contentW / 2 + 16, lootCenterY - lootSectionH / 2 + 10);
        this.viewBagLootTitle.setText('战利品（默认展示前 12 个）');
        this.viewBagLootTitle.setFontSize(22);
      }

      const createCell = (cx, cy, item, size) => {
        const container = this.add.container(cx, cy);
        const bg = this.textures.exists('ui_slot')
          ? this.add.image(0, 0, 'ui_slot').setDisplaySize(size, size)
          : this.add.rectangle(0, 0, size, size, 0x1a1a2a, 0.95);
        if (bg.type === 'Rectangle') {
          bg.setStrokeStyle(2, 0x2a2a3a);
        }
        const icon = this.add.text(0, -Math.floor(size * 0.10), item?.icon || '', { fontSize: `${Math.max(18, Math.floor(size * 0.30))}px`, color: '#ffffff' }).setOrigin(0.5);
        const name = this.add.text(0, Math.floor(size * 0.32), item?.name || '', { fontSize: `${Math.max(14, Math.floor(size * 0.18))}px`, color: '#cccccc', align: 'center', wordWrap: { width: Math.max(90, Math.floor(size * 1.6)) } }).setOrigin(0.5);

        let badge = null;
        const count = item?.count ? Math.max(0, Number(item.count || 0)) : 0;
        if (count > 1) {
          badge = this.add.text(Math.floor(size * 0.5) - 8, -Math.floor(size * 0.5) + 6, String(count), {
            fontSize: `${Math.max(12, Math.floor(size * 0.16))}px`,
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.55)',
            padding: { left: 6, right: 6, top: 2, bottom: 2 }
          }).setOrigin(1, 0);
        }

        const cdG = this.add.graphics();
        let onCd = false;
        if (item?.id && item?.consumable?.cooldownMs && this.player?.itemCooldowns) {
          const cdMs = Math.max(0, Number(item.consumable.cooldownMs || 0));
          const until = Math.max(0, Number(this.player.itemCooldowns[item.id] || 0));
          const remaining = Math.max(0, until - Number(this._gameplayNowMs || 0));
          if (cdMs > 0 && remaining > 0) {
            onCd = true;
            const ratio = Phaser.Math.Clamp(remaining / cdMs, 0, 1);
            const r = Math.floor(size * 0.5);
            const start = -Math.PI / 2;
            const end = start + Math.PI * 2 * ratio;
            cdG.fillStyle(0x000000, 0.55);
            cdG.beginPath();
            cdG.moveTo(0, 0);
            cdG.arc(0, 0, r, start, end, false);
            cdG.closePath();
            cdG.fillPath();

            icon.setAlpha(0.55);
            name.setAlpha(0.65);
            if (bg.setTint) bg.setTint(0x777777);
          }
        }

        const nodes = onCd ? [bg, cdG, icon, name] : [bg, icon, name];
        if (badge) nodes.push(badge);
        container.add(nodes);
        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerup', () => {
          if (!item) {
            this.viewItemDetailText?.setText('空');
            return;
          }

          const eff = item.effects ? JSON.stringify(item.effects) : '{}';
          this.viewItemDetailText?.setText(`${item.icon || ''} ${item.name}\n${item.desc || ''}\n效果: ${eff}`);
        });

        return { container };
      };

      const equippedRowY = equippedCenterY - equippedSectionH / 2 + headerH + sectionPadY + cellSize / 2;
      for (let i = 0; i < 6; i++) {
        const cx = startX + i * (cellSize + gap);
        const item = this.inventoryEquipped?.[i] || null;
        const cell = createCell(cx, equippedRowY, item, cellSize);
        this.viewBagCells.push(cell);
        this.viewPanelBag.add(cell.container);
      }

      const lootTopY = lootCenterY - lootSectionH / 2 + headerH + sectionPadY + cellSize / 2;
      const looted = this.inventoryAcquired || [];
      for (let i = 0; i < 12; i++) {
        const cx = startX + (i % 6) * (cellSize + gap);
        const cy = lootTopY + Math.floor(i / 6) * (cellSize + gap);
        const item = looted[i] || null;
        const cell = createCell(cx, cy, item, cellSize);
        this.viewLootCells.push(cell);
        this.viewPanelBag.add(cell.container);
      }
    },

    refreshViewStatsPanel() {
      if (!this.viewStatsText) return;

      const p = this.player;
      const maxHp = p?.maxHp ?? 0;
      const fireRate = p?.fireRate ?? 999999;
      const dmg = p?.bulletDamage ?? 0;
      const critChance = p?.critChance ?? 0;
      const critMult = p?.critMultiplier ?? 1;

      const dps = fireRate > 0 ? (dmg * (1000 / fireRate)) : 0;
      const critFactor = 1 + critChance * Math.max(0, (critMult - 1));
      const approxDps = dps * critFactor;

      const lifesteal = p?.lifestealPercent ?? 0;
      const shields = p?.shieldCharges ?? 0;
      const speed = p?.moveSpeed ?? 0;

      const damageReduction = p?.damageReductionPercent ?? 0;
      const dodge = p?.dodgePercent ?? 0;
      const regenPerSec = p?.regenPerSec ?? 0;

      const powerScore = Math.max(0, Math.round(
        approxDps * 6 +
        maxHp * 1.2 +
        shields * 35 +
        lifesteal * 800 +
        speed * 0.15
      ));

      const coinsLine = `金币（局内）: ${this.sessionCoins}    全局金币: ${this.globalCoins}`;

      this.viewStatsText.setText(
        [
          coinsLine,
          '',
          `总战斗力（参考分）: ${powerScore}`,
          '',
          `关键属性汇总：`,
          `减伤%: ${(damageReduction * 100).toFixed(1)}%`,
          `闪避%: ${(dodge * 100).toFixed(1)}%`,
          `暴击率%: ${(critChance * 100).toFixed(1)}%`,
          `暴击伤害倍率: x${(critMult).toFixed(2)}`,
          `每秒回复: ${Number(regenPerSec).toFixed(1)}`,
          `吸血%: ${(lifesteal * 100).toFixed(1)}%`,
          `护盾层数: ${shields}`,
          `移速: ${Math.round(speed)}`,
          '',
          `输出估算：`,
          `单发伤害: ${Math.round(dmg)}`,
          `射速(发/秒): ${(fireRate > 0 ? (1000 / fireRate) : 0).toFixed(2)}`,
          `估算DPS(含暴击期望): ${Math.round(approxDps)}`
        ].join('\n')
      );
    },

    refreshViewTalentTrees() {
      if (!this.viewTalentRoot) return;

      this.viewTalentRoot.removeAll(true);

      const cam = this.cameras.main;
      const w = cam.width - 120;
      const h = cam.height - 160;
      const x = cam.centerX;
      const y = cam.centerY - 10;
      const contentY = (y - h / 2 + 52) + 26;
      const contentW = w - 40;
      const contentX = x;

      const areaTop = contentY + 18;
      const areaBottom = y + h / 2 - 122;

      const bg = this.add.rectangle(contentX, (areaTop + areaBottom) / 2, contentW, areaBottom - areaTop, 0x111126, 0.85);
      bg.setStrokeStyle(2, 0x2a2a3a);
      this.viewTalentRoot.add(bg);

      const selectedTrees = this.registry.get('selectedTrees') || [];
      const skillTreeLevels = this.registry.get('skillTreeLevels') || {};

      const mainCore = this.registry.get('mainCore') || this.buildState?.core || null;
      const offFaction = this.registry.get('offFaction') || null;

      const mainTreeId = selectedTrees[0] || null;
      const offTreeId = selectedTrees[1] || null;
      const mainDef = mainTreeId ? TREE_DEFS.find(t => t.id === mainTreeId) : null;
      const offDef = offTreeId ? TREE_DEFS.find(t => t.id === offTreeId) : null;
      const thirdDef = buildThirdTalentTreePlaceholder({
        mainCoreKey: mainCore,
        offFaction,
        mainTreeDef: mainDef,
        offTreeDef: offDef
      });

      this._viewTalentThirdFrameBorder = null;
      this._viewTalentThirdFrameGlow1 = null;
      this._viewTalentThirdFrameGlow2 = null;
      this._viewTalentThirdVariant = null;

      if (!selectedTrees || selectedTrees.length === 0) {
        const t = this.add.text(contentX, (areaTop + areaBottom) / 2, '尚未获得任何技能\n首次三选一后将出现主修路线', {
          fontSize: '16px',
          color: '#cccccc',
          align: 'center'
        }).setOrigin(0.5);
        this.viewTalentRoot.add(t);
        return;
      }

      const cols = 3;
      const colWidth = contentW / cols;

      const panels = [
        { key: 'main', title: mainDef ? mainDef.name : '主职业（未选择）', def: mainDef },
        { key: 'off', title: offDef ? offDef.name : '副职业（未选择）', def: offDef },
        { key: 'third', title: thirdDef ? thirdDef.name : '第三天赋（未解锁）', def: thirdDef }
      ];

      for (let col = 0; col < cols; col++) {
        const { title, def } = panels[col];

        const x0 = contentX - contentW / 2 + col * colWidth;
        const cx = x0 + colWidth / 2;

        const header = this.add.text(cx, areaTop + 14, title, {
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);
        this.viewTalentRoot.add(header);

        const frameTop = areaTop + 40;
        const frameBottom = areaBottom - 12;
        const frameH = frameBottom - frameTop;
        const frameW = colWidth - 18;

        const frameBg = this.add.rectangle(cx, (frameTop + frameBottom) / 2, frameW, frameH, 0x0b0b18, 0.35);
        const frameBorder = this.add.rectangle(cx, (frameTop + frameBottom) / 2, frameW, frameH, 0x000000, 0);
        frameBorder.setStrokeStyle(2, def?.color ?? 0x2a2a3a);
        this.viewTalentRoot.add(frameBg);
        this.viewTalentRoot.add(frameBorder);

        if (col === 2 && def === thirdDef) {
          this._viewTalentThirdFrameBorder = frameBorder;
          this._viewTalentThirdVariant = thirdDef?.variant || null;

          if (thirdDef?.variant === 'depth' && def?.color) {
            const glow1 = this.add.rectangle(cx, (frameTop + frameBottom) / 2, frameW + 10, frameH + 10, 0x000000, 0);
            glow1.setStrokeStyle(8, def.color, 0.18);
            const glow2 = this.add.rectangle(cx, (frameTop + frameBottom) / 2, frameW + 20, frameH + 20, 0x000000, 0);
            glow2.setStrokeStyle(14, def.color, 0.09);
            this.viewTalentRoot.add(glow2);
            this.viewTalentRoot.add(glow1);

            if (this.viewTalentRoot?.bringToTop) this.viewTalentRoot.bringToTop(frameBorder);
          }

          if (thirdDef?.variant === 'dual') {
            const initial = 0xff66ff;
            frameBorder.setStrokeStyle(3, initial);

            const glow1 = this.add.rectangle(cx, (frameTop + frameBottom) / 2, frameW + 10, frameH + 10, 0x000000, 0);
            glow1.setStrokeStyle(8, initial, 0.22);
            const glow2 = this.add.rectangle(cx, (frameTop + frameBottom) / 2, frameW + 20, frameH + 20, 0x000000, 0);
            glow2.setStrokeStyle(14, initial, 0.10);
            this.viewTalentRoot.add(glow2);
            this.viewTalentRoot.add(glow1);

            this._viewTalentThirdFrameGlow1 = glow1;
            this._viewTalentThirdFrameGlow2 = glow2;

            if (this.viewTalentRoot?.bringToTop) this.viewTalentRoot.bringToTop(frameBorder);
          }
        }

        if (!def) {
          const tip = this.add.text(cx, (frameTop + frameBottom) / 2, '等待选择', {
            fontSize: '14px',
            color: '#aaaaaa',
            align: 'center'
          }).setOrigin(0.5);
          this.viewTalentRoot.add(tip);
          continue;
        }

        const allNodes = [def.core, ...(def.nodes || []), def.ultimate].filter(Boolean);
        const acquired = allNodes.filter(n => (skillTreeLevels[n.id] || 0) > 0);
        if (acquired.length === 0) {
          const tip = this.add.text(cx, (frameTop + frameBottom) / 2, '尚未获得天赋', {
            fontSize: '14px',
            color: '#aaaaaa',
            align: 'center'
          }).setOrigin(0.5);
          this.viewTalentRoot.add(tip);
          continue;
        }

        const gridCols = 3;
        const padX = 10;
        const padTop = 12;
        const innerW = frameW - padX * 2;
        const cellW = innerW / gridCols;
        const iconSize = Phaser.Math.Clamp(Math.floor(cellW * 0.62), 44, 74);
        const cellH = iconSize + 30;

        const maxRows = Math.max(1, Math.floor((frameH - padTop - 8) / cellH));
        const maxItems = maxRows * gridCols;

        const show = acquired.slice(0, maxItems);
        for (let i = 0; i < show.length; i++) {
          const node = show[i];
          const level = skillTreeLevels[node.id] || 0;
          const maxLevel = node.maxLevel || 1;
          const row = Math.floor(i / gridCols);
          const colIdx = i % gridCols;

          const px = (x0 + 9) + padX + colIdx * cellW + cellW / 2;
          const py = frameTop + padTop + row * cellH + iconSize / 2;

          const nodeContainer = this.createTalentNodeIcon(px, py, iconSize, node, def, level, maxLevel);
          this.viewTalentRoot.add(nodeContainer);
        }
      }
    },

    createTalentNodeIcon(x, y, size, node, treeDef, level, maxLevel) {
      const c = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, size, size, 0x0b0b18, 1);
      bg.setStrokeStyle(2, level > 0 ? treeDef.color : 0x333355);

      const isCore = node.id === treeDef.core.id;
      const isUltimate = node.id === treeDef.ultimate.id;
      const symbol = isUltimate ? '◎' : (isCore ? '★' : '◆');
      const icon = this.add.text(0, -6, symbol, {
        fontSize: `${Math.floor(size * 0.5)}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const name = this.add.text(0, size / 2 + 10, node.name, {
        fontSize: '11px',
        color: '#cccccc',
        align: 'center',
        wordWrap: { width: Math.max(120, Math.floor(size * 1.9)) }
      }).setOrigin(0.5, 0);

      const badgeText = (() => {
        if (!level || level <= 0) return '';
        if (!maxLevel || maxLevel <= 1) return 'max';
        if (level >= maxLevel) return 'max';
        if (level === 1) return '+1';
        if (level === 2) return '+2';
        return `+${level}`;
      })();

      const badge = badgeText
        ? this.add.text(size / 2 - 6, -size / 2 + 6, badgeText, {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(1, 0)
        : null;

      const parts = [bg, icon, name];
      if (badge) parts.push(badge);
      c.add(parts);
      c.setSize(size, size);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        if (this.viewTalentDetailText) {
          this.viewTalentDetailText.setText(`${node.name}\n${node.desc || ''}\n等级: ${level}/${maxLevel}`);
        }
      });
      return c;
    },

    updateInventoryUI() {
      if (this.viewMenuOpen && this.viewActiveTab === 'bag') {
        this.refreshViewInventoryGrid();
      }

      if (this.isReactUiMode() && this.viewMenuOpen) {
        this.emitUiSnapshot();
      }
    }

  });
}
