import Phaser from 'phaser';
import { CORE_OPTIONS } from '../classes/classDefs';
import { uiBus } from '../ui/bus';
import { getUpgradeCardTheme } from '../ui/upgradeCardTheme';

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

  createCardShine(theme, width, height) {
    if (!theme?.effectClassName) return null;

    const shine = this.add.rectangle(-width * 0.42, 0, 42, height + 16, theme.accentSoft, 0.16);
    shine.setRotation(-0.32);
    shine.setBlendMode(Phaser.BlendModes.ADD);

    const duration = theme.kind === 'offclass' ? 2200 : 1800;
    this.tweens.add({
      targets: shine,
      x: width * 0.42,
      alpha: { from: 0.06, to: 0.22 },
      duration,
      ease: 'Sine.easeInOut',
      yoyo: false,
      repeat: -1,
      repeatDelay: 240
    });

    return shine;
  }

  createCardAura(theme, width, height) {
    if (theme.kind === 'normal') return null;

    const aura = this.add.rectangle(0, 0, width + 22, height + 22, theme.outerGlow, 0.10);
    aura.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: aura,
      alpha: { from: theme.kind === 'offclass' ? 0.06 : 0.10, to: theme.kind === 'offclass' ? 0.18 : 0.24 },
      scaleX: { from: 0.985, to: 1.02 },
      scaleY: { from: 0.985, to: 1.02 },
      duration: theme.kind === 'offclass' ? 1500 : 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return aura;
  }

  getCardTextStyles(theme) {
    const isSpecial = theme.kind !== 'normal';
    return {
      name: {
        fontSize: isSpecial ? '25px' : '24px',
        color: theme.titleColor,
        fontStyle: 'bold'
      },
      desc: {
        fontSize: isSpecial ? '15px' : '16px',
        color: theme.descColor,
        wordWrap: { width: 360 }
      },
      icon: {
        fontSize: isSpecial ? '22px' : '48px',
        color: '#ffffff',
        fontStyle: isSpecial ? 'bold' : 'normal',
        align: 'center'
      },
      badge: {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    };
  }

  /**
   * 创建升级卡片
   */
  createUpgradeCard(x, y, upgrade, callback) {
    const card = this.add.container(x, y);
    const theme = getUpgradeCardTheme(upgrade);
    const styles = this.getCardTextStyles(theme);
    const cardWidth = 560;
    const cardHeight = 124;
    const levelLabel = upgrade.offerLevelLabel || '';
    const displayDesc = upgrade.offerDesc || upgrade.desc;
    const hasTopMeta = !!(theme.badge || theme.kicker || levelLabel);

    const aura = this.createCardAura(theme, cardWidth, cardHeight);
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, theme.panelFill, theme.panelAlpha);
    const splitBg = theme.splitBackground
      ? this.add.rectangle(cardWidth * 0.25, 0, cardWidth * 0.5, cardHeight, theme.secondaryFill || theme.accentSoft, theme.secondaryAlpha || theme.panelAlpha)
      : null;
    const border = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0);
    border.setStrokeStyle(theme.kind === 'normal' ? 3 : 4, theme.border, theme.kind === 'normal' ? 0.72 : 0.95);

    const innerBorder = this.add.rectangle(0, 0, cardWidth - 14, cardHeight - 14, 0x000000, 0);
    innerBorder.setStrokeStyle(1.5, theme.accentSoft, theme.kind === 'normal' ? 0.18 : 0.48);

    const accentBar = this.add.rectangle(-cardWidth / 2 + 10, 0, 6, cardHeight - 18, theme.accent, theme.kind === 'normal' ? 0.38 : 0.95)
      .setOrigin(0.5);
    accentBar.setBlendMode(theme.kind === 'normal' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
    const secondaryAccentBar = theme.splitBackground
      ? this.add.rectangle(cardWidth / 2 - 10, 0, 6, cardHeight - 18, theme.secondaryAccent || theme.accentSoft, 0.92).setOrigin(0.5)
      : null;
    if (secondaryAccentBar) {
      secondaryAccentBar.setBlendMode(Phaser.BlendModes.ADD);
    }

    const shine = this.createCardShine(theme, cardWidth, cardHeight);

    const cornerGlowTop = theme.kind !== 'normal'
      ? this.add.rectangle(-cardWidth / 2 + 34, -cardHeight / 2 + 22, 34, 10, theme.accentSoft, 0.28).setRotation(-0.55)
      : null;
    const cornerGlowBottom = theme.kind !== 'normal'
      ? this.add.rectangle(cardWidth / 2 - 34, cardHeight / 2 - 22, 34, 10, theme.accentSoft, 0.22).setRotation(-0.55)
      : null;
    if (cornerGlowTop) cornerGlowTop.setBlendMode(Phaser.BlendModes.ADD);
    if (cornerGlowBottom) cornerGlowBottom.setBlendMode(Phaser.BlendModes.ADD);

    const badgeText = theme.badge
      ? this.add.text(0, 0, theme.badge, styles.badge).setOrigin(0.5)
      : null;
    const badgeWidth = badgeText ? Math.max(118, badgeText.width + 26) : 0;
    const badgeX = cardWidth / 2 - 16 - badgeWidth / 2;
    const badgeBg = badgeText
      ? this.add.rectangle(badgeX, -cardHeight / 2 + 18, badgeWidth, 24, theme.accent, theme.kind === 'normal' ? 0.12 : 0.22)
      : null;
    if (badgeText) {
      badgeText.setPosition(badgeX, -cardHeight / 2 + 18);
    }
    if (badgeBg) {
      badgeBg.setStrokeStyle(1.5, theme.accentSoft, theme.kind === 'normal' ? 0.18 : 0.58);
    }
    const kickerText = theme.kicker
      ? this.add.text(0, 0, theme.kicker, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5)
      : null;
    if (kickerText) {
      kickerText.setPosition(cardWidth / 2 - 18, -cardHeight / 2 + 40);
      kickerText.setAlpha(0.88);
    }
    const levelBadgeBg = levelLabel
      ? this.add.rectangle(-136, -cardHeight / 2 + 20, 104, 30, theme.accentSoft, 0.24)
      : null;
    const levelBadgeText = levelLabel
      ? this.add.text(-136, -cardHeight / 2 + 20, levelLabel, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      : null;

    const iconLabel = theme.iconText || upgrade.icon;
    const iconX = theme.kind === 'normal' ? -240 : -228;
    const icon = this.add.text(iconX, 0, iconLabel, styles.icon).setOrigin(0.5);
    if (theme.kind !== 'normal') {
      icon.setPadding(10, 8, 10, 8);
      icon.setBackgroundColor('rgba(255,255,255,0.08)');
    }

    // 升级名称
    const name = this.add.text(-182, hasTopMeta ? -2 : -18, upgrade.name, styles.name).setOrigin(0, 0.5);

    // 描述
    const desc = this.add.text(-182, hasTopMeta ? 28 : 18, displayDesc, styles.desc).setOrigin(0, 0.5);

    const nodes = [aura, bg, splitBg, accentBar, secondaryAccentBar, shine, cornerGlowTop, cornerGlowBottom, border, innerBorder, badgeBg, badgeText, kickerText, levelBadgeBg, levelBadgeText, icon, name, desc].filter(Boolean);
    card.add(nodes);
    card.setSize(cardWidth, cardHeight);
    card.setInteractive({ useHandCursor: true });

    card.setData('bg', bg);
    card.setData('border', border);
    card.setData('innerBorder', innerBorder);
    card.setData('accentBar', accentBar);
    card.setData('splitBg', splitBg);
    card.setData('secondaryAccentBar', secondaryAccentBar);
    card.setData('aura', aura);
    card.setData('theme', theme);
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
      const innerBorder = card.getData('innerBorder');
      const accentBar = card.getData('accentBar');
      const splitBg = card.getData('splitBg');
      const secondaryAccentBar = card.getData('secondaryAccentBar');
      const aura = card.getData('aura');
      const theme = card.getData('theme') || getUpgradeCardTheme(card.getData('upgrade'));
      const isSelected = index === this.selectedIndex;

      if (bg) {
        if (bg.setFillStyle) {
          bg.setFillStyle(
            isSelected ? theme.panelSelectedFill : theme.panelFill,
            isSelected ? theme.panelSelectedAlpha : theme.panelAlpha
          );
        }
      }

      if (splitBg?.setFillStyle) {
        splitBg.setFillStyle(
          isSelected ? (theme.secondarySelectedFill || theme.secondaryFill || theme.accentSoft) : (theme.secondaryFill || theme.accentSoft),
          isSelected ? (theme.secondarySelectedAlpha || theme.panelSelectedAlpha) : (theme.secondaryAlpha || theme.panelAlpha)
        );
      }

      if (border?.setStrokeStyle) {
        border.setStrokeStyle(theme.kind === 'normal' ? 3 : 4, isSelected ? theme.selectedBorder : theme.border, isSelected ? 1 : 0.88);
      }

      if (innerBorder?.setStrokeStyle) {
        innerBorder.setStrokeStyle(1.5, isSelected ? theme.selectedBorder : theme.accentSoft, isSelected ? 0.5 : (theme.kind === 'normal' ? 0.18 : 0.42));
      }

      if (accentBar?.setFillStyle) {
        accentBar.setFillStyle(isSelected ? theme.selectedBorder : theme.accent, isSelected ? 1 : (theme.kind === 'normal' ? 0.38 : 0.92));
      }

      if (secondaryAccentBar?.setFillStyle) {
        secondaryAccentBar.setFillStyle(isSelected ? theme.selectedBorder : (theme.secondaryAccent || theme.accentSoft), isSelected ? 1 : 0.92);
      }

      if (aura) {
        aura.setAlpha(isSelected ? (theme.kind === 'normal' ? 0.10 : 0.26) : (theme.kind === 'normal' ? 0.04 : 0.12));
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
