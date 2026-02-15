import Phaser from 'phaser';

/**
 * 预加载场景 - 加载游戏所需的所有资源
 */
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    console.log('PreloadScene: 加载资源中...');

    // 获取屏幕中心位置
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // 添加加载文本
    const loadingText = this.add.text(centerX, centerY - 50, '加载中...', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 创建进度条背景
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(centerX - 160, centerY - 25, 320, 50);

    // 进度百分比文本
    const percentText = this.add.text(centerX, centerY, '0%', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 监听加载进度
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(centerX - 150, centerY - 15, 300 * value, 30);
      percentText.setText(parseInt(value * 100) + '%');
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // 在这里加载游戏资源
    this.load.spritesheet('player', 'assets/characters/player/player_sheet.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    // UI 资源（SVG，可缩放）
    this.load.svg('ui_panel', 'assets/ui/panel.svg');
    this.load.svg('ui_button', 'assets/ui/button.svg');
    this.load.svg('ui_tab', 'assets/ui/tab.svg');
    this.load.svg('ui_card', 'assets/ui/card.svg');
    this.load.svg('ui_slot', 'assets/ui/slot.svg');
  }

  create() {
    console.log('PreloadScene: 资源加载完成，切换到主菜单');
    
    // 短暂延迟后切换到主菜单
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }
}
