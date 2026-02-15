import Phaser from 'phaser';
import { uiBus } from '../ui/bus';

/**
 * 商店场景 - 购买道具和升级
 */
export default class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  getShopItems() {
    return [
      { id: 'potion_hp', name: '生命药水', price: 50, desc: '恢复50点生命', icon: '🧪' },
      { id: 'buff_atk', name: '攻击强化', price: 100, desc: '永久+5攻击力', icon: '⚔️' },
      { id: 'buff_shield', name: '护盾', price: 80, desc: '获得临时护盾', icon: '🛡️' },
      { id: 'buff_luck', name: '幸运硬币', price: 120, desc: '提升掉落率', icon: '🪙' }
    ];
  }

  loadRegistryData() {
    if (!this.registry.has('globalCoins')) {
      this.registry.set('globalCoins', 0);
    }
    if (!this.registry.has('mysteryShopPurchased')) {
      this.registry.set('mysteryShopPurchased', []);
    }

    this.globalCoins = Number(this.registry.get('globalCoins') || 0);
    this.purchased = Array.isArray(this.registry.get('mysteryShopPurchased'))
      ? this.registry.get('mysteryShopPurchased')
      : [];
  }

  emitUiSnapshot() {
    uiBus.emit('phaser:uiSnapshot', {
      shop: {
        coins: this.globalCoins || 0,
        items: this.getShopItems(),
        purchased: this.purchased || []
      }
    });
  }

  create() {
    console.log('ShopScene: 商店场景已加载');

    // React UI 模式：由 React 负责渲染与交互；Phaser 仅维护数据/registry
    if (this.isReactUiMode()) {
      this.cameras.main.setBackgroundColor('#000000');
      this.loadRegistryData();

      this.events.once('shutdown', this.shutdown, this);

      this._uiRequestSnapshotHandler = () => {
        this.loadRegistryData();
        this.emitUiSnapshot();
      };
      uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

      this._uiBuyHandler = (itemId) => {
        this.loadRegistryData();
        const item = this.getShopItems().find((i) => i.id === itemId);
        if (!item) return;
        if (this.purchased.includes(item.id)) return;
        if (this.globalCoins < item.price) return;

        // 目前仅实现扣币+标记已购买（具体效果后续再接入玩法逻辑）
        this.globalCoins -= item.price;
        this.purchased = [...this.purchased, item.id];
        this.registry.set('globalCoins', this.globalCoins);
        this.registry.set('mysteryShopPurchased', this.purchased);

        this.emitUiSnapshot();
      };
      uiBus.on('ui:shop:buy', this._uiBuyHandler);

      this._uiCloseHandler = () => {
        this.scene.resume('GameScene');
        this.scene.stop();
      };
      uiBus.on('ui:shop:close', this._uiCloseHandler);

      this.emitUiSnapshot();
      return;
    }

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // 半透明背景
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8)
      .setOrigin(0);

    // 标题
    this.add.text(centerX, 60, '🏪 神秘商店', {
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 金币显示
    this.add.text(centerX, 120, '金币: 500', {
      fontSize: '24px',
      color: '#ffff00'
    }).setOrigin(0.5);

    // 商品列表
    const items = [
      { name: '生命药水', price: 50, desc: '恢复50点生命', icon: '🧪' },
      { name: '攻击强化', price: 100, desc: '永久+5攻击力', icon: '⚔️' },
      { name: '护盾', price: 80, desc: '获得临时护盾', icon: '🛡️' },
      { name: '幸运硬币', price: 120, desc: '提升掉落率', icon: '🪙' }
    ];

    const startY = 200;
    const spacing = 100;

    this.shopEntries = [];
    items.forEach((item, index) => {
      const entry = this.createShopItem(centerX, startY + index * spacing, item, () => {
        console.log(`购买了：${item.name}`);
        // 这里可以添加购买逻辑
      });
      this.shopEntries.push(entry);
    });

    // 关闭商店按钮
    const closeEntry = this.createButton(centerX, this.cameras.main.height - 60, '关闭商店', () => {
      console.log('关闭商店');
      this.scene.resume('GameScene');
      this.scene.stop();
    });
    this.shopEntries.push(closeEntry);

    // 初始化选择
    this.selectedIndex = 0;
    this.updateSelection();

    // 鼠标悬停同步选择
    this.shopEntries.forEach((entry, index) => {
      entry.on('pointerover', () => this.setSelection(index));
    });

    // 键盘控制
    this.setupKeyboardControls();
  }

  shutdown() {
    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
    if (this._uiBuyHandler) {
      uiBus.off('ui:shop:buy', this._uiBuyHandler);
      this._uiBuyHandler = null;
    }
    if (this._uiCloseHandler) {
      uiBus.off('ui:shop:close', this._uiCloseHandler);
      this._uiCloseHandler = null;
    }
  }

  /**
   * 创建商店物品
   */
  createShopItem(x, y, item, callback) {
    const container = this.add.container(x, y);

    // 物品背景
    const bg = this.textures.exists('ui_card')
      ? this.add.image(0, 0, 'ui_card').setDisplaySize(600, 80)
      : this.add.rectangle(0, 0, 600, 80, 0x3a3a3a);
    const border = this.add.rectangle(0, 0, 600, 80, 0x000000, 0);
    border.setStrokeStyle(2, 0x666666);

    // 图标
    const icon = this.add.text(-250, 0, item.icon, {
      fontSize: '48px'
    }).setOrigin(0.5);

    // 物品名称
    const name = this.add.text(-180, -15, item.name, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // 描述
    const desc = this.add.text(-180, 15, item.desc, {
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0, 0.5);

    // 价格和购买按钮
    const price = this.add.text(150, 0, `${item.price} 💰`, {
      fontSize: '20px',
      color: '#ffff00'
    }).setOrigin(0.5);

    const buyBtn = this.textures.exists('ui_button')
      ? this.add.image(240, 0, 'ui_button').setDisplaySize(100, 50)
      : this.add.rectangle(240, 0, 100, 50, 0x00aa00);
    const buyText = this.add.text(240, 0, '购买', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    container.add([bg, border, icon, name, desc, price, buyBtn, buyText]);
    container.setSize(600, 80);
    container.setInteractive({ useHandCursor: true });

    container.setData('bg', bg);
    container.setData('border', border);
    container.setData('baseColor', 0x3a3a3a);
    container.setData('buyBtn', buyBtn);
    container.setData('buyText', buyText);
    container.setData('callback', callback);

    container.on('pointerdown', () => {
      if (buyBtn.setFillStyle) buyBtn.setFillStyle(0x008800);
      if (buyBtn.setTint) buyBtn.setTint(0x66ff66);
    });

    container.on('pointerup', () => {
      callback();
      this.updateSelection();
    });

    return container;
  }

  /**
   * 创建可点击按钮
   */
  createButton(x, y, text, callback) {
    const button = this.add.container(x, y);

    const bg = this.textures.exists('ui_button')
      ? this.add.image(0, 0, 'ui_button').setDisplaySize(200, 50)
      : this.add.rectangle(0, 0, 200, 50, 0xaa0000);
    if (bg.type === 'Rectangle') {
      bg.setStrokeStyle(2, 0xff0000);
    }

    const label = this.add.text(0, 0, text, {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    button.add([bg, label]);
    button.setSize(200, 50);
    button.setInteractive({ useHandCursor: true });

    button.setData('bg', bg);
    button.setData('baseColor', 0xaa0000);
    button.setData('label', label);
    button.setData('callback', callback);

    button.on('pointerdown', () => {
      if (bg.setTint) bg.setTint(0x6b7cff);
      if (bg.setFillStyle) bg.setFillStyle(0x880000);
    });
    button.on('pointerup', () => {
      if (bg.clearTint) bg.clearTint();
      callback();
      this.updateSelection();
    });

    return button;
  }

  /**
   * 设置键盘控制
   */
  setupKeyboardControls() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      confirm: 'SPACE'
    });

    this.keys.up.on('down', () => this.moveSelection(-1));
    this.keys.left.on('down', () => this.moveSelection(-1));
    this.keys.down.on('down', () => this.moveSelection(1));
    this.keys.right.on('down', () => this.moveSelection(1));
    this.keys.confirm.on('down', () => this.activateSelection());
  }

  /**
   * 移动选择
   */
  moveSelection(delta) {
    if (!this.shopEntries || this.shopEntries.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.shopEntries.length) % this.shopEntries.length;
    this.updateSelection();
  }

  /**
   * 设置选择索引
   */
  setSelection(index) {
    this.selectedIndex = index;
    this.updateSelection();
  }

  /**
   * 更新选择样式
   */
  updateSelection() {
    this.shopEntries.forEach((entry, index) => {
      const bg = entry.getData('bg');
      const border = entry.getData('border');
      const buyBtn = entry.getData('buyBtn');
      const buyText = entry.getData('buyText');
      const label = entry.getData('label');
      const isSelected = index === this.selectedIndex;
      const baseColor = entry.getData('baseColor');

      if (bg) {
        if (bg.setFillStyle) {
          bg.setFillStyle(isSelected ? 0x4a4a4a : (baseColor || 0x3a3a3a));
        }
        if (bg.setTint) {
          if (isSelected) bg.setTint(0x9fb9ff);
          else bg.clearTint();
        }
      }

      if (border?.setStrokeStyle) {
        border.setStrokeStyle(2, isSelected ? 0xffff00 : 0x666666);
      }

      if (buyBtn) {
        if (buyBtn.setFillStyle) buyBtn.setFillStyle(isSelected ? 0x00ff00 : 0x00aa00);
        if (buyBtn.setTint) {
          if (isSelected) buyBtn.setTint(0x66ff66);
          else buyBtn.clearTint();
        }
      }

      if (buyText) {
        buyText.setColor(isSelected ? '#ffffff' : '#dddddd');
      }

      if (label) {
        label.setColor(isSelected ? '#ffffff' : '#dddddd');
      }
    });
  }

  /**
   * 确认当前选择
   */
  activateSelection() {
    const entry = this.shopEntries[this.selectedIndex];
    if (!entry) return;
    const callback = entry.getData('callback');
    if (callback) {
      callback();
    }
  }
}
