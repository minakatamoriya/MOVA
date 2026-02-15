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

    this.add.text(centerX, this.cameras.main.height - 30, 'W/S 选择  |  空格购买  |  A/D 返回菜单', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.loadRegistryData();
    this.createShopList();

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

  createShopList() {
    const startY = 180;
    const spacing = 85;

    this.entries = [];

    ITEM_DEFS.forEach((item, index) => {
      const y = startY + index * spacing;
      const entry = this.createEntry(this.cameras.main.centerX, y, item);
      this.entries.push(entry);
    });

    this.refreshCoinsText();
  }

  createEntry(x, y, item) {
    const container = this.add.container(x, y);

    const bg = this.textures.exists('ui_card')
      ? this.add.image(0, 0, 'ui_card').setDisplaySize(560, 70)
      : this.add.rectangle(0, 0, 560, 70, 0x1c1c2b);
    if (bg.type === 'Rectangle') {
      bg.setStrokeStyle(2, 0x3a3a55);
    }

    const icon = this.add.text(-250, 0, item.icon, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const name = this.add.text(-210, -12, item.name, {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    const desc = this.add.text(-210, 12, item.desc, {
      fontSize: '14px',
      color: '#cccccc'
    }).setOrigin(0, 0.5);

    const price = this.add.text(200, 0, `${item.price} G`, {
      fontSize: '18px',
      color: '#ffd700'
    }).setOrigin(0.5);

    const status = this.add.text(260, 0, '', {
      fontSize: '14px',
      color: '#88ff88'
    }).setOrigin(0.5);

    container.add([bg, icon, name, desc, price, status]);
    container.setSize(560, 70);
    container.setInteractive({ useHandCursor: true });

    container.setData('bg', bg);
    container.setData('status', status);
    container.setData('item', item);

    container.on('pointerover', () => {
      this.setSelection(this.entries.indexOf(container));
    });

    container.on('pointerup', () => {
      this.purchaseItem(item);
      this.updateSelection();
    });

    return container;
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
        if (bg.setFillStyle) {
          bg.setFillStyle(isSelected ? 0x2a2a44 : 0x1c1c2b);
        }
        if (bg.setStrokeStyle) {
          bg.setStrokeStyle(2, isSelected ? 0xffff00 : 0x3a3a55);
        }
        if (bg.setTint) {
          if (isSelected) bg.setTint(0x9fb9ff);
          else bg.clearTint();
        }
      }

      if (status) {
        status.setText(isOwned ? '已拥有' : '');
        status.setColor(isOwned ? '#88ff88' : '#ffffff');
      }
    });

    this.refreshCoinsText();
  }

  activateSelection() {
    const entry = this.entries[this.selectedIndex];
    if (!entry) return;
    const item = entry.getData('item');
    this.purchaseItem(item);
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
