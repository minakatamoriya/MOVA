import Phaser from 'phaser';
import { ITEM_DEFS, getItemById } from '../data/items';
import { uiBus } from '../ui/bus';

/**
 * 装备系统场景
 */
export default class EquipmentScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EquipmentScene' });
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  getUiSnapshot() {
    const equippedItems = Array.isArray(this.equippedItems) ? [...this.equippedItems].slice(0, 6) : new Array(6).fill(null);
    while (equippedItems.length < 6) equippedItems.push(null);
    return {
      ownedItems: Array.isArray(this.ownedItems) ? this.ownedItems : [],
      equippedItems
    };
  }

  emitUiSnapshot() {
    uiBus.emit('phaser:uiSnapshot', this.getUiSnapshot());
  }

  create() {
    console.log('EquipmentScene: 装备系统已加载');

    // React UI 模式：由 React 负责渲染与交互；Phaser 仅维护数据/registry
    if (this.isReactUiMode()) {
      this.cameras.main.setBackgroundColor('#0f101a');
      this.loadRegistryData();

      this.events.once('shutdown', this.shutdown, this);

      this._uiRequestSnapshotHandler = () => this.emitUiSnapshot();
      uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

      this._uiSetSlotHandler = (slotIndex, itemId) => {
        const idx = Number(slotIndex);
        if (!Number.isFinite(idx) || idx < 0 || idx >= 6) return;
        if (itemId && !this.ownedItems.includes(itemId)) return;

        this.equippedItems[idx] = itemId || null;
        this.registry.set('equippedItems', this.equippedItems);
        this.emitUiSnapshot();
      };
      uiBus.on('ui:equipment:setSlot', this._uiSetSlotHandler);

      this.emitUiSnapshot();
      return;
    }

    const centerX = this.cameras.main.centerX;

    this.cameras.main.setBackgroundColor('#0f101a');

    this.add.text(centerX, 60, '装备系统', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 返回菜单按钮
    this.createButton(this.cameras.main.width - 90, 20, '返回菜单', () => {
      this.scene.start('MenuScene');
    }, 160, 35, '14px');

    this.add.text(centerX, this.cameras.main.height - 30, 'W/S 选择  |  A/D 切换区域  |  空格装备/卸下', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.loadRegistryData();
    this.createPanels();

    this.focus = 'owned';
    this.selectedOwnedIndex = 0;
    this.selectedSlotIndex = 0;

    this.updateSelection();
    this.setupControls();
  }

  shutdown() {
    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
    if (this._uiSetSlotHandler) {
      uiBus.off('ui:equipment:setSlot', this._uiSetSlotHandler);
      this._uiSetSlotHandler = null;
    }
  }

  loadRegistryData() {
    if (!this.registry.has('ownedItems')) {
      this.registry.set('ownedItems', []);
    }

    if (!this.registry.has('equippedItems')) {
      this.registry.set('equippedItems', new Array(6).fill(null));
    }

    // 测试物品：默认加入背包（不强制携带），便于玩家在装备界面自行测试
    const seeded = Array.isArray(this.registry.get('ownedItems')) ? [...this.registry.get('ownedItems')] : [];
    const testItemIds = [
      'potion_small',
      'potion_big',
      'revive_cross',
      'passive_move10',
      'passive_damage10',
      'passive_as15',
      'passive_dodge5'
    ];
    testItemIds.forEach((id) => {
      if (!seeded.includes(id) && getItemById(id)) seeded.push(id);
    });
    this.registry.set('ownedItems', seeded);

    this.ownedItems = seeded;
    const raw = this.registry.get('equippedItems') || new Array(6).fill(null);
    this.equippedItems = [...raw].slice(0, 6);
    while (this.equippedItems.length < 6) this.equippedItems.push(null);
  }

  createPanels() {
    const listX = this.cameras.main.centerX - 160;
    const listY = 160;
    const listSpacing = 70;

    this.ownedEntries = [];

    ITEM_DEFS.forEach((item, index) => {
      if (!this.ownedItems.includes(item.id)) return;
      const y = listY + this.ownedEntries.length * listSpacing;
      const entry = this.createOwnedEntry(listX, y, item);
      this.ownedEntries.push(entry);
    });

    if (this.ownedEntries.length === 0) {
      this.emptyText = this.add.text(listX, listY, '暂无已购买道具', {
        fontSize: '18px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
    }

    const slotsY = listY + 30;
    const slotSize = 64;
    const gap = 10;
    const totalWidth = slotSize * 6 + gap * 5;
    const startX = (this.cameras.main.width - totalWidth) / 2;

    this.slotEntries = [];

    for (let i = 0; i < 6; i++) {
      const x = startX + i * (slotSize + gap) + slotSize / 2;
      const slot = this.createSlotEntry(x, slotsY + 320, i);
      this.slotEntries.push(slot);
    }

    this.refreshEquippedUI();
  }

  createOwnedEntry(x, y, item) {
    const container = this.add.container(x, y);

    const bg = this.textures.exists('ui_card')
      ? this.add.image(0, 0, 'ui_card').setDisplaySize(360, 56)
      : this.add.rectangle(0, 0, 360, 56, 0x1c1c2b);
    const border = this.add.rectangle(0, 0, 360, 56, 0x000000, 0);
    border.setStrokeStyle(2, 0x3a3a55);

    const icon = this.add.text(-150, 0, item.icon, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const name = this.add.text(-120, -8, item.name, {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    const desc = this.add.text(-120, 10, item.desc, {
      fontSize: '12px',
      color: '#cccccc'
    }).setOrigin(0, 0.5);

    container.add([bg, border, icon, name, desc]);
    container.setSize(360, 56);
    container.setInteractive({ useHandCursor: true });

    container.setData('bg', bg);
    container.setData('border', border);
    container.setData('item', item);

    container.on('pointerover', () => {
      this.focus = 'owned';
      this.selectedOwnedIndex = this.ownedEntries.indexOf(container);
      this.updateSelection();
    });

    container.on('pointerup', () => {
      this.focus = 'owned';
      this.selectedOwnedIndex = this.ownedEntries.indexOf(container);
      this.activateSelection();
    });

    return container;
  }

  createSlotEntry(x, y, index) {
    const container = this.add.container(x, y);

    const bg = this.textures.exists('ui_slot')
      ? this.add.image(0, 0, 'ui_slot').setDisplaySize(64, 64)
      : this.add.rectangle(0, 0, 64, 64, 0x1a1a2a);
    const border = this.add.rectangle(0, 0, 64, 64, 0x000000, 0);
    border.setStrokeStyle(2, 0x334433);

    const label = this.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    container.add([bg, border, label]);
    container.setSize(64, 64);
    container.setInteractive({ useHandCursor: true });

    container.setData('bg', bg);
    container.setData('border', border);
    container.setData('label', label);
    container.setData('index', index);

    container.on('pointerover', () => {
      this.focus = 'slots';
      this.selectedSlotIndex = index;
      this.updateSelection();
    });

    container.on('pointerup', () => {
      this.focus = 'slots';
      this.selectedSlotIndex = index;
      this.activateSelection();
    });

    return container;
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
    this.keys.left.on('down', () => this.switchFocus('owned'));
    this.keys.right.on('down', () => this.switchFocus('slots'));
    this.keys.confirm.on('down', () => this.activateSelection());
  }

  moveSelection(delta) {
    if (this.focus === 'owned') {
      if (!this.ownedEntries || this.ownedEntries.length === 0) return;
      this.selectedOwnedIndex = (this.selectedOwnedIndex + delta + this.ownedEntries.length) % this.ownedEntries.length;
    } else {
      if (!this.slotEntries || this.slotEntries.length === 0) return;
      this.selectedSlotIndex = (this.selectedSlotIndex + delta + this.slotEntries.length) % this.slotEntries.length;
    }
    this.updateSelection();
  }

  switchFocus(target) {
    this.focus = target;
    this.updateSelection();
  }

  updateSelection() {
    if (this.ownedEntries) {
      this.ownedEntries.forEach((entry, index) => {
        const bg = entry.getData('bg');
        const border = entry.getData('border');
        const isSelected = this.focus === 'owned' && index === this.selectedOwnedIndex;
        if (bg) {
          if (bg.setFillStyle) {
            bg.setFillStyle(isSelected ? 0x2a2a44 : 0x1c1c2b);
          }
          if (bg.setTint) {
            if (isSelected) bg.setTint(0x9fb9ff);
            else bg.clearTint();
          }
        }
        if (border?.setStrokeStyle) {
          border.setStrokeStyle(2, isSelected ? 0xffff00 : 0x3a3a55);
        }
      });
    }

    if (this.slotEntries) {
      this.slotEntries.forEach((entry, index) => {
        const bg = entry.getData('bg');
        const border = entry.getData('border');
        const isSelected = this.focus === 'slots' && index === this.selectedSlotIndex;
        if (bg) {
          if (bg.setFillStyle) {
            bg.setFillStyle(isSelected ? 0x2a2a44 : 0x1a1a2a);
          }
          if (bg.setTint) {
            if (isSelected) bg.setTint(0x9fb9ff);
            else bg.clearTint();
          }
        }
        if (border?.setStrokeStyle) {
          border.setStrokeStyle(2, isSelected ? 0xffff00 : 0x334433);
        }
      });
    }
  }

  activateSelection() {
    if (this.focus === 'owned') {
      const entry = this.ownedEntries[this.selectedOwnedIndex];
      if (!entry) return;
      const item = entry.getData('item');
      if (!item) return;
      this.equippedItems[this.selectedSlotIndex] = item.id;
      this.registry.set('equippedItems', this.equippedItems);
      this.refreshEquippedUI();
    } else {
      this.equippedItems[this.selectedSlotIndex] = null;
      this.registry.set('equippedItems', this.equippedItems);
      this.refreshEquippedUI();
    }
  }

  refreshEquippedUI() {
    this.slotEntries.forEach((entry, index) => {
      const label = entry.getData('label');
      const itemId = this.equippedItems[index];
      const item = itemId ? getItemById(itemId) : null;
      if (label) {
        label.setText(item ? item.icon : '');
      }
    });
  }

  /**
   * 创建可点击按钮
   */
  createButton(x, y, text, callback, width = 140, height = 50, fontSize = '14px') {
    const button = this.add.container(x, y);

    const bg = this.textures.exists('ui_button')
      ? this.add.image(0, 0, 'ui_button').setDisplaySize(width, height)
      : this.add.rectangle(0, 0, width, height, 0x4a4a4a);
    if (bg.type === 'Rectangle') {
      bg.setStrokeStyle(2, 0xffffff);
    }

    const label = this.add.text(0, 0, text, {
      fontSize: fontSize,
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    button.add([bg, label]);
    button.setSize(width, height);
    button.setInteractive({ useHandCursor: true });

    button.on('pointerover', () => {
      if (bg.setTint) bg.setTint(0x9fb9ff);
      if (bg.setFillStyle) bg.setFillStyle(0x666666);
    });
    button.on('pointerout', () => {
      if (bg.clearTint) bg.clearTint();
      if (bg.setFillStyle) bg.setFillStyle(0x4a4a4a);
    });
    button.on('pointerdown', () => {
      if (bg.setTint) bg.setTint(0x6b7cff);
      if (bg.setFillStyle) bg.setFillStyle(0x333333);
    });
    button.on('pointerup', () => {
      if (bg.setTint) bg.setTint(0x9fb9ff);
      if (bg.setFillStyle) bg.setFillStyle(0x666666);
      callback();
    });

    return button;
  }
}
