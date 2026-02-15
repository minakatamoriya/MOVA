import Phaser from 'phaser';
import { ITEM_DEFS } from '../data/items';
import { uiBus } from '../ui/bus';

/**
 * 道具商店场景
 */
export default class ItemShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ItemShopScene' });
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  getUiSnapshot() {
    return {
      globalCoins: this.globalCoins || 0,
      ownedItems: Array.isArray(this.ownedItems) ? this.ownedItems : []
    };
  }

  emitUiSnapshot() {
    uiBus.emit('phaser:uiSnapshot', this.getUiSnapshot());
  }

  create() {
    console.log('ItemShopScene: 道具商店已加载');

    // React UI 模式：由 React 负责渲染列表与交互；Phaser 仅维护数据/registry
    if (this.isReactUiMode()) {
      this.cameras.main.setBackgroundColor('#0f0f1f');
      this.loadRegistryData();

      this.events.once('shutdown', this.shutdown, this);

      this._uiRequestSnapshotHandler = () => this.emitUiSnapshot();
      uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

      this._uiPurchaseHandler = (itemId) => {
        const item = ITEM_DEFS.find((it) => it.id === itemId);
        this.purchaseItem(item);
        this.emitUiSnapshot();
      };
      uiBus.on('ui:itemShop:purchase', this._uiPurchaseHandler);

      this.emitUiSnapshot();
      return;
    }

    const centerX = this.cameras.main.centerX;

    this.cameras.main.setBackgroundColor('#0f0f1f');

    this.add.text(centerX, 60, '道具商店', {
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.coinsText = this.add.text(centerX, 110, '', {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(centerX, this.cameras.main.height - 30, '拖动/滚轮滚动  |  点击查看  |  W/S 选择  |  空格购买  |  A/D 返回菜单', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.loadRegistryData();

    // icon 网格 + 可拖拽滚动（不显示滚动条）
    this.createShopGrid();

    // 详情面板：点击查看（购买入口也在这里）
    this.createDetailPanel();

    this.selectedIndex = 0;
    this.updateSelection();

    this.setupControls();
  }

  shutdown() {
    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
    if (this._uiPurchaseHandler) {
      uiBus.off('ui:itemShop:purchase', this._uiPurchaseHandler);
      this._uiPurchaseHandler = null;
    }
  }

  loadRegistryData() {
    if (!this.registry.has('globalCoins')) {
      this.registry.set('globalCoins', 0);
    }

    if (!this.registry.has('ownedItems')) {
      this.registry.set('ownedItems', []);
    }

    this.globalCoins = this.registry.get('globalCoins') || 0;
    this.ownedItems = this.registry.get('ownedItems') || [];
  }

  createShopGrid() {
    const cam = this.cameras.main;
    const centerX = cam.centerX;

    // 与 Phaser 装备槽位保持一致的 icon 尺寸
    this._shopTileSize = 64;
    this._shopTileExtraH = 32;
    this._shopTileH = this._shopTileSize + this._shopTileExtraH;

    const viewportW = Math.min(620, cam.width - 60);
    const viewportH = Math.max(220, cam.height - 260);
    const viewportX = Math.floor(centerX - viewportW / 2);
    const viewportY = 150;

    this._shopViewport = { x: viewportX, y: viewportY, w: viewportW, h: viewportH };

    // 内容容器（通过 y 偏移实现滚动）
    this._shopContent = this.add.container(viewportX, viewportY);

    // mask（裁切视窗）
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff);
    g.fillRect(viewportX, viewportY, viewportW, viewportH);
    const mask = g.createGeometryMask();
    this._shopContent.setMask(mask);

    // 网格布局
    const gap = 14;
    const padX = 10;
    const padY = 8;
    const cols = Math.max(3, Math.floor((viewportW - padX * 2 + gap) / (this._shopTileSize + gap)));

    this.entries = [];

    ITEM_DEFS.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = padX + col * (this._shopTileSize + gap) + this._shopTileSize / 2;
      const y = padY + row * (this._shopTileH + gap) + this._shopTileH / 2;

      const entry = this.createTileEntry(x, y, item);
      this._shopContent.add(entry);
      this.entries.push(entry);
    });

    // 计算滚动边界
    const rows = Math.ceil(ITEM_DEFS.length / cols);
    const contentH = padY * 2 + rows * this._shopTileH + Math.max(0, rows - 1) * gap;
    const maxScroll = Math.max(0, contentH - viewportH);
    this._shopScroll = {
      maxScroll,
      dragging: false,
      dragStartY: 0,
      contentStartY: viewportY
    };

    // 透明交互层：用于拖拽滚动（更像手机滑动）
    this._shopHitZone = this.add.rectangle(viewportX + viewportW / 2, viewportY + viewportH / 2, viewportW, viewportH, 0x000000, 0);
    this._shopHitZone.setInteractive({ useHandCursor: false });

    this._shopHitZone.on('pointerdown', (p) => {
      this._shopScroll.dragging = true;
      this._shopScroll.dragStartY = p.y;
      this._shopScroll.contentStartY = this._shopContent.y;
    });

    this._shopHitZone.on('pointermove', (p) => {
      if (!this._shopScroll.dragging) return;
      const dy = p.y - this._shopScroll.dragStartY;
      this.setShopScrollY(this._shopScroll.contentStartY + dy);
    });

    const endDrag = () => {
      this._shopScroll.dragging = false;
    };
    this._shopHitZone.on('pointerup', endDrag);
    this._shopHitZone.on('pointerupoutside', endDrag);

    // 滚轮滚动
    this.input.on('wheel', (_p, _dx, dy) => {
      if (!Number.isFinite(dy) || dy === 0) return;
      this.setShopScrollY(this._shopContent.y - dy * 0.6);
    });

    this.refreshCoinsText();
  }

  setShopScrollY(y) {
    if (!this._shopViewport || !this._shopScroll || !this._shopContent) return;
    const minY = this._shopViewport.y - (this._shopScroll.maxScroll || 0);
    const maxY = this._shopViewport.y;
    this._shopContent.y = Phaser.Math.Clamp(y, minY, maxY);
  }

  ensureSelectedVisible() {
    if (!this._shopViewport || !this._shopContent || !this._shopScroll) return;
    const entry = this.entries?.[this.selectedIndex];
    if (!entry) return;

    const viewportTop = this._shopViewport.y;
    const viewportBottom = this._shopViewport.y + this._shopViewport.h;
    const entryTop = this._shopContent.y + entry.y - this._shopTileH / 2;
    const entryBottom = entryTop + this._shopTileH;
    const pad = 8;

    if (entryTop < viewportTop + pad) {
      this.setShopScrollY(this._shopContent.y + (viewportTop + pad - entryTop));
    } else if (entryBottom > viewportBottom - pad) {
      this.setShopScrollY(this._shopContent.y - (entryBottom - (viewportBottom - pad)));
    }
  }

  createTileEntry(x, y, item) {
    const container = this.add.container(x, y);

    const size = this._shopTileSize;

    const bg = this.add.rectangle(0, -this._shopTileExtraH / 2, size, size, 0x1c1c2b);
    bg.setStrokeStyle(2, 0x3a3a55);

    const icon = this.add.text(0, -this._shopTileExtraH / 2, item.icon, {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const name = this.add.text(0, size / 2 + 4 - this._shopTileExtraH / 2, item.name, {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    const price = this.add.text(0, size / 2 + 18 - this._shopTileExtraH / 2, `${item.price} G`, {
      fontSize: '12px',
      color: '#ffd700'
    }).setOrigin(0.5, 0);

    const status = this.add.text(0, size / 2 - 12 - this._shopTileExtraH / 2, '', {
      fontSize: '11px',
      color: '#88ff88'
    }).setOrigin(0.5);

    container.add([bg, icon, name, price, status]);
    container.setSize(size, this._shopTileH);
    container.setInteractive({ useHandCursor: true });

    container.setData('bg', bg);
    container.setData('status', status);
    container.setData('item', item);

    container.on('pointerover', () => {
      this.setSelection(this.entries.indexOf(container));
    });

    // 点击只查看详情（购买在详情面板或空格键）
    container.on('pointerup', () => {
      this.setSelection(this.entries.indexOf(container));
      this.showItemDetail(item);
    });

    return container;
  }

  createDetailPanel() {
    const cam = this.cameras.main;
    const w = Math.min(640, cam.width - 40);
    const h = 96;
    const x = cam.centerX;
    const y = cam.height - 86;

    const panel = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, w, h, 0x0b0b18, 0.92);
    bg.setStrokeStyle(2, 0x2a2a3a);
    bg.setOrigin(0.5);

    const title = this.add.text(-w / 2 + 14, -h / 2 + 10, '', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0);

    const desc = this.add.text(-w / 2 + 14, -h / 2 + 40, '', {
      fontSize: '13px',
      color: '#cccccc'
    }).setOrigin(0, 0);

    const price = this.add.text(w / 2 - 160, -12, '', {
      fontSize: '16px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const owned = this.add.text(w / 2 - 160, 16, '', {
      fontSize: '13px',
      color: '#88ff88',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const buyBtnBg = this.add.rectangle(w / 2 - 70, 0, 96, 36, 0xffffff, 0.10);
    buyBtnBg.setStrokeStyle(1, 0xffffff, 0.25);
    buyBtnBg.setOrigin(0.5);

    const buyBtnText = this.add.text(w / 2 - 70, 0, '购买', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const buyBtn = this.add.container(0, 0);
    buyBtn.add([buyBtnBg, buyBtnText]);
    buyBtn.setPosition(0, 0);
    buyBtn.setSize(96, 36);
    buyBtn.setInteractive({ useHandCursor: true });

    // 右侧按钮整体相对 panel 的位置
    buyBtn.x = w / 2 - 70;
    buyBtn.y = 0;

    panel.add([bg, title, desc, price, owned, buyBtn]);
    panel.setDepth(9999);
    panel.setVisible(false);

    panel.setData('title', title);
    panel.setData('desc', desc);
    panel.setData('price', price);
    panel.setData('owned', owned);
    panel.setData('buyBtn', buyBtn);
    panel.setData('buyBtnBg', buyBtnBg);
    panel.setData('buyBtnText', buyBtnText);
    panel.setData('item', null);

    buyBtn.on('pointerup', () => {
      const item = panel.getData('item');
      if (!item) return;
      this.purchaseItem(item);
      this.updateSelection();
      this.showItemDetail(item); // 重新刷新状态
    });

    this._detailPanel = panel;
  }

  showItemDetail(item) {
    if (!this._detailPanel) return;
    if (!item) {
      this._detailPanel.setVisible(false);
      return;
    }

    const isOwned = this.ownedItems.includes(item.id);
    const coins = Number(this.globalCoins || 0);
    const canBuy = !isOwned && coins >= Number(item.price || 0);

    const title = this._detailPanel.getData('title');
    const desc = this._detailPanel.getData('desc');
    const price = this._detailPanel.getData('price');
    const owned = this._detailPanel.getData('owned');
    const buyBtnBg = this._detailPanel.getData('buyBtnBg');
    const buyBtnText = this._detailPanel.getData('buyBtnText');

    title.setText(`${item.icon} ${item.name}`);
    desc.setText(item.desc || '');
    price.setText(`${item.price} G`);
    owned.setText(isOwned ? '已拥有' : '');

    if (buyBtnBg && buyBtnText) {
      buyBtnBg.setFillStyle(0xffffff, canBuy ? 0.10 : 0.05);
      buyBtnText.setColor(canBuy ? '#ffffff' : 'rgba(255,255,255,0.55)');
    }

    this._detailPanel.setData('item', item);
    this._detailPanel.setVisible(true);
  }

  refreshCoinsText() {
    this.coinsText.setText(`全局金币: ${this.globalCoins}`);
  }

  setupControls() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      confirm: 'SPACE'
    });

    this.keys.up.on('down', () => this.moveSelection(-1));
    this.keys.down.on('down', () => this.moveSelection(1));
    this.keys.confirm.on('down', () => this.activateSelection());

    this.keys.left.on('down', () => this.scene.start('MenuScene'));
    this.keys.right.on('down', () => this.scene.start('MenuScene'));
  }

  moveSelection(delta) {
    if (!this.entries || this.entries.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.entries.length) % this.entries.length;
    this.updateSelection();
  }

  setSelection(index) {
    if (index < 0 || index >= this.entries.length) return;
    this.selectedIndex = index;
    this.updateSelection();
  }

  updateSelection() {
    this.entries.forEach((entry, index) => {
      const bg = entry.getData('bg');
      const status = entry.getData('status');
      const item = entry.getData('item');
      const isSelected = index === this.selectedIndex;
      const isOwned = this.ownedItems.includes(item.id);

      if (bg) {
        bg.setFillStyle(isSelected ? 0x2a2a44 : 0x1c1c2b);
        bg.setStrokeStyle(2, isSelected ? 0xffff00 : 0x3a3a55);
      }

      if (status) {
        status.setText(isOwned ? '已拥有' : '');
        status.setColor(isOwned ? '#88ff88' : '#ffffff');
      }
    });

    this.refreshCoinsText();
    this.ensureSelectedVisible();
  }

  activateSelection() {
    const entry = this.entries[this.selectedIndex];
    if (!entry) return;
    const item = entry.getData('item');
    this.purchaseItem(item);
    this.showItemDetail(item);
  }

  purchaseItem(item) {
    if (!item) return;

    if (this.ownedItems.includes(item.id)) {
      return;
    }

    if (this.globalCoins < item.price) {
      return;
    }

    this.globalCoins -= item.price;
    this.ownedItems.push(item.id);

    this.registry.set('globalCoins', this.globalCoins);
    this.registry.set('ownedItems', this.ownedItems);

    if (!this.isReactUiMode()) {
      this.updateSelection();
    }
  }
}
