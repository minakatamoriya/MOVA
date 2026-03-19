import Phaser from 'phaser';
import { ITEM_DEFS, getEquipState, getItemById, getOwnedItemCount, getOwnedItemIds, normalizeEquippedItems, OUTRUN_ITEM_SLOT_COUNT } from '../data/items';
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
    const equippedItems = normalizeEquippedItems(this.equippedItems, this.ownedItems);
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
        if (!Number.isFinite(idx) || idx < 0 || idx >= OUTRUN_ITEM_SLOT_COUNT) return;

        if (!itemId) {
          this.equippedItems[idx] = null;
          this.equippedItems = normalizeEquippedItems(this.equippedItems, this.ownedItems);
          this.registry.set('equippedItems', this.equippedItems);
          this.emitUiSnapshot();
          return;
        }

        const trial = normalizeEquippedItems(this.equippedItems, this.ownedItems);
        trial[idx] = null;
        const equipState = getEquipState(itemId, this.ownedItems, trial);
        if (!equipState.ok) return;

        trial[idx] = itemId;
        this.equippedItems = normalizeEquippedItems(trial, this.ownedItems);
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
      this.registry.set('equippedItems', new Array(OUTRUN_ITEM_SLOT_COUNT).fill(null));
    }

    this.ownedItems = getOwnedItemIds(this.registry.get('ownedItems'));
    this.equippedItems = normalizeEquippedItems(this.registry.get('equippedItems'), this.ownedItems);
    this.registry.set('ownedItems', this.ownedItems);
    this.registry.set('equippedItems', this.equippedItems);
  }

  createPanels() {
    const listX = this.cameras.main.centerX - 160;
    const listY = 160;
    const listSpacing = 70;

    this.ownedEntries = [];

    ITEM_DEFS.forEach((item) => {
      if (getOwnedItemCount(this.ownedItems, item.id) <= 0) return;
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
    const ownedCount = getOwnedItemCount(this.ownedItems, item.id);

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

    const count = this.add.text(150, 0, `x${ownedCount}`, {
      fontSize: '18px',
      color: '#ffd36b',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    container.add([bg, border, icon, name, desc, count]);
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
      const trial = normalizeEquippedItems(this.equippedItems, this.ownedItems);
      trial[this.selectedSlotIndex] = null;
      const equipState = getEquipState(item.id, this.ownedItems, trial);
      if (!equipState.ok) return;
      trial[this.selectedSlotIndex] = item.id;
      this.equippedItems = normalizeEquippedItems(trial, this.ownedItems);
      this.registry.set('equippedItems', this.equippedItems);
      this.refreshEquippedUI();
    } else {
      this.equippedItems[this.selectedSlotIndex] = null;
      this.equippedItems = normalizeEquippedItems(this.equippedItems, this.ownedItems);
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
