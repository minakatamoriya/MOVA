import Phaser from 'phaser';
import { CORE_OPTIONS } from '../classes/classDefs';
import { uiBus } from '../ui/bus';

/**
 * 升级场景 - 三选一技能/升级选择
 */
export default class LevelUpScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelUpScene' });
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  emitUiSnapshot() {
    uiBus.emit('phaser:uiSnapshot', {
      levelUp: {
        level: this.currentLevel || 1,
        options: this._upgrades || []
      }
    });
  }

  init(data) {
    // 接收传递的数据
    this.currentLevel = data.level || 1;
    this.choiceCount = data.choices || 3;
    this.options = data.options || null;
  }

  create() {
    console.log('LevelUpScene: 升级场景已加载 - 等级', this.currentLevel);

    // Build 流派选项池（混合流派）
    const buildOptions = [
      ...CORE_OPTIONS,
      { id: 'drone_count', category: 'build', name: '宠物数量', desc: '增加宠物数量，覆盖更多角度', icon: '德主' },
      { id: 'drone_rate', category: 'build', name: '宠物频率', desc: '提高宠物射速', icon: '德主' },
      { id: 'drone_tracking', category: 'build', name: '跟踪宠物', desc: '宠物子弹将追踪 Boss', icon: '德主' },
      { id: 'warrior_hp', category: 'build', name: '生命上限', desc: '提高生命上限并小幅回复', icon: '战主' },
      { id: 'warrior_thorns', category: 'build', name: '反伤强化', desc: '提高受击反伤比例', icon: '战主' },
      { id: 'mage_crit', category: 'build', name: '暴击精通', desc: '提高暴击率', icon: '法主' },
      { id: 'mage_critdmg', category: 'build', name: '爆伤精通', desc: '提高暴击伤害', icon: '法主' },
      { id: 'paladin_purge', category: 'build', name: '清弹强化', desc: '降低护盾脉冲冷却', icon: '骑主' },
      { id: 'paladin_reflect', category: 'build', name: '反弹强化', desc: '提高脉冲伤害与范围', icon: '骑主' },
      { id: 'warlock_poison', category: 'build', name: '剧毒强化', desc: '提高毒伤与持续时间', icon: '术主' },
      { id: 'warlock_weaken', category: 'build', name: '虚弱诅咒', desc: '降低 Boss 攻击与防御', icon: '术主' }
    ];

    const upgrades = this.options && this.options.length > 0
      ? this.options
      : this.pickRandomUpgrades(buildOptions, this.choiceCount);

    this._upgrades = upgrades;

    // React UI 模式：由 React 渲染三选一；Phaser 只负责状态与选择回传
    if (this.isReactUiMode()) {
      this.events.once('shutdown', this.shutdown, this);

      this._uiRequestSnapshotHandler = () => this.emitUiSnapshot();
      uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

      this._uiSelectHandler = (payload) => {
        const chosen = typeof payload === 'string'
          ? (this._upgrades || []).find((u) => u.id === payload)
          : payload;
        if (!chosen) return;
        this.game.events.emit('upgradeSelected', chosen);
        this.scene.resume('GameScene');
        this.scene.stop();
      };
      uiBus.on('ui:levelUp:select', this._uiSelectHandler);

      this.emitUiSnapshot();
      return;
    }

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    // 半透明背景
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7)
      .setOrigin(0);

    // 标题
    this.add.text(centerX, 80, `等级提升！ 等级 ${this.currentLevel}`, {
      fontSize: '42px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(centerX, 140, '选择一个升级选项', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const count = upgrades.length;
    const topY = 170;
    const bottomY = this.cameras.main.height - 60;
    const available = Math.max(180, bottomY - topY);
    const spacing = count <= 1 ? 0 : Phaser.Math.Clamp(Math.floor(available / (count - 1)), 96, 128);
    const totalHeight = spacing * Math.max(0, count - 1);
    const startY = topY + Math.max(0, Math.floor((available - totalHeight) / 2));

    this.upgradeCards = [];
    upgrades.forEach((upgrade, index) => {
      const card = this.createUpgradeCard(centerX, startY + index * spacing, upgrade, () => {
        console.log(`选择了：${upgrade.name}`);
        this.game.events.emit('upgradeSelected', upgrade);
        this.scene.resume('GameScene');
        this.scene.stop();
      });
      this.upgradeCards.push(card);
    });

    // 初始化选择
    this.selectedIndex = 0;
    this.updateSelection();

    // 鼠标悬停时同步选择
    this.upgradeCards.forEach((card, index) => {
      card.on('pointerover', () => this.setSelection(index));
    });

    // 键盘控制
    this.setupKeyboardControls();
  }

  shutdown() {
    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
    if (this._uiSelectHandler) {
      uiBus.off('ui:levelUp:select', this._uiSelectHandler);
      this._uiSelectHandler = null;
    }
  }

  /**
   * 随机挑选升级项
   */
  pickRandomUpgrades(options, count) {
    const pool = [...options];
    const result = [];
    while (pool.length > 0 && result.length < count) {
      const index = Phaser.Math.Between(0, pool.length - 1);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }

  /**
   * 创建升级卡片
   */
  createUpgradeCard(x, y, upgrade, callback) {
    const card = this.add.container(x, y);

    // 卡片背景
    const bg = this.textures.exists('ui_card')
      ? this.add.image(0, 0, 'ui_card').setDisplaySize(560, 96)
      : this.add.rectangle(0, 0, 560, 96, 0x1f1f2e, 0.98);
    const border = this.add.rectangle(0, 0, 560, 96, 0x000000, 0);
    border.setStrokeStyle(3, 0x00ff00);

    // 图标
    const icon = this.add.text(-240, 0, upgrade.icon, {
      fontSize: '48px'
    }).setOrigin(0.5);

    // 升级名称
    const name = this.add.text(-182, -18, upgrade.name, {
      fontSize: '24px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // 描述
    const desc = this.add.text(-182, 18, upgrade.desc, {
      fontSize: '16px',
      color: '#cfcfe6',
      wordWrap: { width: 360 }
    }).setOrigin(0, 0.5);

    card.add([bg, border, icon, name, desc]);
    card.setSize(560, 96);
    card.setInteractive({ useHandCursor: true });

    card.setData('bg', bg);
    card.setData('border', border);
    card.setData('upgrade', upgrade);
    card.setData('callback', callback);

    card.on('pointerup', () => {
      callback();
      this.updateSelection();
    });

    return card;
  }

  /**
   * 设置键盘控制
   */
  setupKeyboardControls() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      confirm: 'SPACE'
    });

    this.keys.up.on('down', () => this.moveSelection(-1));
    this.keys.down.on('down', () => this.moveSelection(1));
    this.keys.confirm.on('down', () => this.activateSelection());
  }

  /**
   * 移动选择
   */
  moveSelection(delta) {
    if (!this.upgradeCards || this.upgradeCards.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.upgradeCards.length) % this.upgradeCards.length;
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
    this.upgradeCards.forEach((card, index) => {
      const bg = card.getData('bg');
      const border = card.getData('border');
      const isSelected = index === this.selectedIndex;

      if (bg) {
        if (bg.setStrokeStyle) {
          bg.setStrokeStyle(3, isSelected ? 0xffff00 : 0x00ff00);
        }
        if (bg.setFillStyle) {
          bg.setFillStyle(isSelected ? 0x2f2f4f : 0x1f1f2e, isSelected ? 1 : 0.98);
        }
        if (bg.setTint) {
          if (isSelected) bg.setTint(0x9fb9ff);
          else bg.clearTint();
        }
      }

      if (border?.setStrokeStyle) {
        border.setStrokeStyle(3, isSelected ? 0xffff00 : 0x00ff00);
      }
    });
  }

  /**
   * 确认当前选择
   */
  activateSelection() {
    const card = this.upgradeCards[this.selectedIndex];
    if (!card) return;
    const callback = card.getData('callback');
    if (callback) {
      callback();
    }
  }
}
