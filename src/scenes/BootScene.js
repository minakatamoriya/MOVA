import Phaser from 'phaser';

/**
 * 启动场景 - 游戏首次启动时的场景
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // 可以在这里加载启动所需的最小资源
    console.log('BootScene: 启动中...');
  }

  create() {
    console.log('BootScene: 启动完成，切换到加载场景');
    
    // 添加简单的启动文本
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'MOVA\n\n正在启动...',
      {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center'
      }
    ).setOrigin(0.5);

    // 1秒后切换到加载场景
    this.time.delayedCall(1000, () => {
      this.scene.start('PreloadScene');
    });
  }
}
