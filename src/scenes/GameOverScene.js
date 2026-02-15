import Phaser from 'phaser';
import { uiBus } from '../ui/bus';
import { resetSkillTreeProgress } from '../classes/progression';

/**
 * 游戏结束场景
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  init(data) {
    // 接收传递的游戏数据
    this.finalScore = data.score || 0;
    this.survivalTime = data.survived || '0:00';
    this.isVictory = data.victory || false;
    this.sessionCoins = data.sessionCoins || 0;

    this._coinsApplied = false;
  }

  applyCoinsOnce() {
    if (this._coinsApplied) return;
    const globalCoins = Number(this.registry.get('globalCoins') || 0);
    const newGlobalCoins = globalCoins + Number(this.sessionCoins || 0);
    this.registry.set('globalCoins', newGlobalCoins);
    this._coinsApplied = true;
  }

  emitUiSnapshot() {
    const globalCoins = Number(this.registry.get('globalCoins') || 0);
    uiBus.emit('phaser:uiSnapshot', {
      sessionCoins: Number(this.sessionCoins || 0),
      globalCoins,
      gameOver: {
        victory: !!this.isVictory,
        score: Number(this.finalScore || 0),
        survived: this.survivalTime || '0:00',
        kills: Math.floor(Number(this.finalScore || 0) / 200),
        sessionCoins: Number(this.sessionCoins || 0),
        globalCoins
      }
    });
  }

  create() {
    console.log('GameOverScene: 游戏结束场景已加载');

    // React UI 模式：由 React 负责渲染与交互；Phaser 仅维护数据/registry
    if (this.isReactUiMode()) {
      this.cameras.main.setBackgroundColor(this.isVictory ? '#001100' : '#110000');
      this.applyCoinsOnce();

      this.events.once('shutdown', this.shutdown, this);

      this._uiRequestSnapshotHandler = () => {
        this.emitUiSnapshot();
      };
      uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

      this._uiRestartHandler = () => {
        resetSkillTreeProgress(this.registry);
        this.scene.start('GameScene');
      };
      uiBus.on('ui:gameOver:restart', this._uiRestartHandler);

      this._uiMenuHandler = () => {
        this.scene.start('MenuScene');
      };
      uiBus.on('ui:gameOver:menu', this._uiMenuHandler);

      this.emitUiSnapshot();
      return;
    }

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // 背景
    this.cameras.main.setBackgroundColor(this.isVictory ? '#001100' : '#110000');

    // 标题
    const titleText = this.isVictory ? '🎉 胜利！' : '☠️ 游戏结束';
    const titleColor = this.isVictory ? '#00ff00' : '#ff0000';

    this.add.text(centerX, centerY - 150, titleText, {
      fontSize: '64px',
      color: titleColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 统计数据面板
    const statsPanel = this.add.container(centerX, centerY);

    const panelBg = this.textures.exists('ui_panel')
      ? this.add.image(0, 0, 'ui_panel').setDisplaySize(520, 300)
      : this.add.rectangle(0, 0, 520, 300, 0x2a2a2a, 0.9);
    const panelBorder = this.add.rectangle(0, 0, 520, 300, 0x000000, 0);
    panelBorder.setStrokeStyle(3, this.isVictory ? 0x00ff00 : 0xff0000);

    const statsTitle = this.add.text(0, -90, '游戏统计', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const scoreText = this.add.text(0, -60, `最终得分: ${this.finalScore}`, {
      fontSize: '24px',
      color: '#ffff00'
    }).setOrigin(0.5);

    const timeText = this.add.text(0, -20, `存活时间: ${this.survivalTime}`, {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const killsText = this.add.text(0, 20, `击败 Boss: ${Math.floor(this.finalScore / 200)}`, {
      fontSize: '24px',
      color: '#ff6666'
    }).setOrigin(0.5);

    const sessionCoinsText = this.add.text(0, 70, `本局金币: ${this.sessionCoins}`, {
      fontSize: '22px',
      color: '#ffd700'
    }).setOrigin(0.5);

    const globalCoins = this.registry.get('globalCoins') || 0;
    const newGlobalCoins = globalCoins + this.sessionCoins;
    this.registry.set('globalCoins', newGlobalCoins);

    const globalCoinsText = this.add.text(0, 110, `全局金币: ${newGlobalCoins}`, {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    statsPanel.add([
      panelBg,
      panelBorder,
      statsTitle,
      scoreText,
      timeText,
      killsText,
      sessionCoinsText,
      globalCoinsText
    ]);

    // 按钮组
    this.menuButtons = [
      this.createButton(centerX - 110, centerY + 200, '重新开始', () => {
        console.log('重新开始游戏');
        resetSkillTreeProgress(this.registry);
        this.scene.start('GameScene');
      }),
      this.createButton(centerX + 110, centerY + 200, '返回菜单', () => {
        console.log('返回主菜单');
        this.scene.start('MenuScene');
      })
    ];

    // 提示文字
    this.add.text(centerX, this.cameras.main.height - 40, 'WASD 选择，空格确认', {
      fontSize: '18px',
      color: '#888888'
    }).setOrigin(0.5);

    // 初始化选择
    this.selectedIndex = 0;
    this.updateMenuSelection();

    // 鼠标悬停同步选择
    this.menuButtons.forEach((button, index) => {
      button.on('pointerover', () => this.setSelection(index));
    });

    // 键盘控制
    this.setupMenuControls();
  }

  shutdown() {
    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
    if (this._uiRestartHandler) {
      uiBus.off('ui:gameOver:restart', this._uiRestartHandler);
      this._uiRestartHandler = null;
    }
    if (this._uiMenuHandler) {
      uiBus.off('ui:gameOver:menu', this._uiMenuHandler);
      this._uiMenuHandler = null;
    }
  }

  /**
   * 创建可点击按钮
   */
  createButton(x, y, text, callback) {
    const button = this.add.container(x, y);

    const bg = this.textures.exists('ui_button')
      ? this.add.image(0, 0, 'ui_button').setDisplaySize(200, 60)
      : this.add.rectangle(0, 0, 200, 60, 0x4a4a4a);
    if (bg.type === 'Rectangle') {
      bg.setStrokeStyle(2, 0xffffff);
    }

    const label = this.add.text(0, 0, text, {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    button.add([bg, label]);
    button.setSize(200, 60);
    button.setInteractive({ useHandCursor: true });

    button.setData('bg', bg);
    button.setData('label', label);
    button.setData('callback', callback);

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
      left: 'A',
      right: 'D',
      up: 'W',
      down: 'S',
      confirm: 'SPACE'
    });

    this.keys.left.on('down', () => this.moveSelection(-1));
    this.keys.up.on('down', () => this.moveSelection(-1));
    this.keys.right.on('down', () => this.moveSelection(1));
    this.keys.down.on('down', () => this.moveSelection(1));
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
