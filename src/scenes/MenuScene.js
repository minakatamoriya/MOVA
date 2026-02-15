import Phaser from 'phaser';
import { uiBus } from '../ui/bus';
import { resetSkillTreeProgress } from '../classes/progression';

/**
 * 主菜单场景
 */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    console.log('MenuScene: 主菜单已加载');

    // React UI 模式：主菜单由 React 渲染
    if (this.registry?.get('uiMode') === 'react') {
      uiBus.emit('phaser:sceneChanged', 'MenuScene');
      uiBus.emit('phaser:inGameChanged', false);
      this.cameras.main.setBackgroundColor('#0a0a1a');
      return;
    }

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // 游戏标题
    this.add.text(centerX, centerY - 150, 'MOVA', {
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 90, '走位类 Roguelike 游戏', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 创建菜单按钮
    this.menuButtons = [
      this.createButton(centerX, centerY - 40, '开始游戏', () => {
        console.log('点击：开始游戏');
        resetSkillTreeProgress(this.registry);
        this.scene.start('GameScene');
      }),
      this.createButton(centerX, centerY + 30, '道具商店', () => {
        this.scene.start('ItemShopScene');
      }),
      this.createButton(centerX, centerY + 100, '装备系统', () => {
        this.scene.start('EquipmentScene');
      }),
      this.createButton(centerX, centerY + 170, '设置', () => {
        console.log('点击：设置（暂未实现）');
      }),
      this.createButton(centerX, centerY + 240, '退出游戏', () => {
        console.log('点击：退出游戏');
        // 在实际应用中可以关闭窗口或返回上一级
      })
    ];

    // 全局金币显示
    this.coinsText = this.add.text(centerX, centerY + 310, '', {
      fontSize: '18px',
      color: '#ffd700'
    }).setOrigin(0.5);

    // 添加说明文字
    this.add.text(centerX, this.cameras.main.height - 30, 'WASD 选择，空格确认', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5);

    // 初始化选择
    this.selectedIndex = 0;
    this.updateMenuSelection();

    // 鼠标悬停时同步选择
    this.menuButtons.forEach((button, index) => {
      button.on('pointerover', () => this.setSelection(index));
    });

    // 键盘控制
    this.setupMenuControls();

    this.refreshCoins();
  }

  /**
   * 创建可点击按钮
   */
  createButton(x, y, text, callback) {
    const button = this.add.container(x, y);

    // 按钮背景（优先使用 UI 资源）
    const bg = this.textures.exists('ui_button')
      ? this.add.image(0, 0, 'ui_button').setDisplaySize(250, 60)
      : this.add.rectangle(0, 0, 250, 60, 0x4a4a4a);
    if (bg.type === 'Rectangle') {
      bg.setStrokeStyle(2, 0xffffff);
    }

    // 按钮文本
    const label = this.add.text(0, 0, text, {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    button.add([bg, label]);
    button.setSize(250, 60);
    button.setInteractive({ useHandCursor: true });

    button.setData('bg', bg);
    button.setData('label', label);
    button.setData('callback', callback);

    // 点击效果
    button.on('pointerdown', () => {
      if (bg.setTint) bg.setTint(0x6b7cff);
      if (bg.setFillStyle) bg.setFillStyle(0x333333);
    });

    button.on('pointerup', () => {
      if (bg.clearTint) bg.clearTint();
      callback();
      this.updateMenuSelection();
    });

    return button;
  }

  /**
   * 设置键盘控制
   */
  setupMenuControls() {
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
    if (!this.menuButtons || this.menuButtons.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.menuButtons.length) % this.menuButtons.length;
    this.updateMenuSelection();
  }

  /**
   * 设置选择索引
   */
  setSelection(index) {
    this.selectedIndex = index;
    this.updateMenuSelection();
  }

  /**
   * 更新菜单选择样式
   */
  updateMenuSelection() {
    this.menuButtons.forEach((button, index) => {
      const bg = button.getData('bg');
      const label = button.getData('label');
      const isSelected = index === this.selectedIndex;

      if (bg) {
        if (bg.setTint) {
          if (isSelected) bg.setTint(0x9fb9ff);
          else bg.clearTint();
        }
        if (bg.setFillStyle) {
          bg.setFillStyle(isSelected ? 0x4a6aff : 0x4a4a4a);
        }
        if (bg.setStrokeStyle) {
          bg.setStrokeStyle(2, isSelected ? 0xffffff : 0xaaaaaa);
        }
      }

      if (label) {
        label.setColor(isSelected ? '#ffffff' : '#dddddd');
      }
    });
  }

  refreshCoins() {
    if (!this.coinsText) return;
    const globalCoins = this.registry.get('globalCoins') || 0;
    this.coinsText.setText(`全局金币: ${globalCoins}`);
  }

  /**
   * 确认当前选择
   */
  activateSelection() {
    const button = this.menuButtons[this.selectedIndex];
    if (!button) return;
    const callback = button.getData('callback');
    if (callback) {
      callback();
    }
  }
}
