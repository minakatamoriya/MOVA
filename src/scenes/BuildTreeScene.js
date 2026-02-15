import Phaser from 'phaser';
import { TREE_DEFS, getMaxLevel } from '../classes/talentTrees';
import { uiBus } from '../ui/bus';

export default class BuildTreeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BuildTreeScene' });
  }

  isReactUiMode() {
    return this.registry?.get('uiMode') === 'react';
  }

  getUiSnapshot() {
    return {
      selectedTrees: this.selectedTrees || [],
      skillTreeLevels: this.skillTreeLevels || {}
    };
  }

  emitUiSnapshot() {
    uiBus.emit('phaser:uiSnapshot', this.getUiSnapshot());
  }

  init(data) {
    this.returnSceneKey = data?.returnSceneKey || 'GameScene';
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // 读取状态（由升级系统写入；UI仅展示）
    this.selectedTrees = this.registry.get('selectedTrees') || [];
    this.skillTreeLevels = this.registry.get('skillTreeLevels') || {}; // { skillId: level }

    // React UI 模式：由 React 渲染展示；Phaser 只负责读 registry 与关闭/恢复
    if (this.isReactUiMode()) {
      this.events.once('shutdown', this.shutdown, this);

      this._uiRequestSnapshotHandler = () => this.emitUiSnapshot();
      uiBus.on('ui:requestSnapshot', this._uiRequestSnapshotHandler);

      this._uiCloseHandler = () => this.close();
      uiBus.on('ui:buildTree:close', this._uiCloseHandler);

      this.emitUiSnapshot();
      return;
    }

    // 背景遮罩
    this.add.rectangle(0, 0, w, h, 0x000000, 0.75).setOrigin(0);

    // 面板
    const panel = this.textures.exists('ui_panel')
      ? this.add.image(w / 2, h / 2, 'ui_panel').setDisplaySize(w - 60, h - 160)
      : this.add.rectangle(w / 2, h / 2, w - 60, h - 160, 0x0b0b18, 0.98);
    if (panel.type === 'Rectangle') {
      panel.setStrokeStyle(2, 0x2a2a3a);
    }

    // 标题
    this.add.text(w / 2, 70, '技能树（双修）', {
      fontSize: '34px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(w / 2, 106, '最多双修两系；技能从下至上成长（底部=初始，顶部=最高）', {
      fontSize: '14px',
      color: '#cccccc'
    }).setOrigin(0.5);

    // 关闭按钮
    const closeBtn = this.createButton(w - 70, 70, '关闭', () => this.close());
    closeBtn.setDepth(10);

    // 主区域：左右两棵树展示（由升级选择决定）
    this.treeArea = this.add.container(0, 0);

    this.render();

    // 快捷键
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  shutdown() {
    if (this._uiRequestSnapshotHandler) {
      uiBus.off('ui:requestSnapshot', this._uiRequestSnapshotHandler);
      this._uiRequestSnapshotHandler = null;
    }
    if (this._uiCloseHandler) {
      uiBus.off('ui:buildTree:close', this._uiCloseHandler);
      this._uiCloseHandler = null;
    }
  }

  close() {
    // UI只读展示；这里做一次回写以保证一致性
    this.registry.set('selectedTrees', this.selectedTrees);
    this.registry.set('skillTreeLevels', this.skillTreeLevels);

    this.scene.resume(this.returnSceneKey);
    this.scene.stop();
  }

  render() {
    // 重新绘制树展示
    this.treeArea.removeAll(true);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const areaLeft = 40;
    const areaRight = w - 40;
    const areaTop = 150;
    const areaBottom = h - 140;

    this.treeArea.add(this.add.rectangle((areaLeft + areaRight) / 2, (areaTop + areaBottom) / 2, areaRight - areaLeft, areaBottom - areaTop, 0x111126, 0.85)
      .setStrokeStyle(2, 0x2a2a3a));

    // 若 UI 资源可用，用 panel 皮肤替换区域底板（无资源保持原样）
    if (this.textures.exists('ui_panel')) {
      this.treeArea.removeAll(true);
      const areaW = areaRight - areaLeft;
      const areaH = areaBottom - areaTop;
      const areaBg = this.add.image((areaLeft + areaRight) / 2, (areaTop + areaBottom) / 2, 'ui_panel').setDisplaySize(areaW, areaH);
      const areaBorder = this.add.rectangle((areaLeft + areaRight) / 2, (areaTop + areaBottom) / 2, areaW, areaH, 0x000000, 0);
      areaBorder.setStrokeStyle(2, 0x2a2a3a);
      this.treeArea.add([areaBg, areaBorder]);
    }

    if (!this.selectedTrees || this.selectedTrees.length === 0) {
      this.treeArea.add(this.add.text((areaLeft + areaRight) / 2, (areaTop + areaBottom) / 2, '尚未获得任何技能\n首次三选一后将出现主修路线', {
        fontSize: '18px',
        color: '#cccccc',
        align: 'center'
      }).setOrigin(0.5));
      return;
    }

    const cols = 2;
    const colWidth = (areaRight - areaLeft) / cols;

    for (let col = 0; col < cols; col++) {
      const treeId = this.selectedTrees[col];
      if (!treeId) continue;

      const def = TREE_DEFS.find(t => t.id === treeId);
      if (!def) continue;

      const x0 = areaLeft + col * colWidth;
      const cx = x0 + colWidth / 2;

      // 树标题
      this.treeArea.add(this.add.text(cx, areaTop + 26, def.name, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5));

      // 节点布局：自下而上（底部=初始技能；顶部=终极/最高）
      const nodes = [def.core, ...def.nodes, def.ultimate];
      const yTop = areaTop + 80;
      const yBottom = areaBottom - 50;
      const stepY = (yBottom - yTop) / Math.max(1, nodes.length - 1);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const y = yBottom - i * stepY;

        // 连线
        if (i > 0) {
          const prevY = yBottom - (i - 1) * stepY;
          const line = this.add.rectangle(cx, (prevY + y) / 2, 4, Math.abs(y - prevY), 0x2a2a3a, 1);
          this.treeArea.add(line);
        }

        const level = this.skillTreeLevels[node.id] || 0;
        const maxLevel = node.maxLevel || getMaxLevel(node.id) || 1;
        const isUltimate = node.id === def.ultimate.id;
        const isCore = node.id === def.core.id;

        const nodeW = 220;
        const nodeH = isUltimate ? 64 : 54;
        const nodeBg = this.textures.exists('ui_card')
          ? this.add.image(cx, y, 'ui_card').setDisplaySize(nodeW, nodeH)
          : this.add.rectangle(cx, y, nodeW, nodeH, 0x0b0b18, 1);
        const nodeBorder = this.add.rectangle(cx, y, nodeW, nodeH, 0x000000, 0);
        nodeBorder.setStrokeStyle(2, level > 0 ? def.color : 0x333355);

        const nameText = this.add.text(cx - 98, y - (isUltimate ? 14 : 12), node.name, {
          fontSize: isUltimate ? '16px' : '14px',
          color: '#ffffff'
        }).setOrigin(0, 0.5);

        const lvText = this.add.text(cx - 98, y + (isUltimate ? 14 : 12), `等级 ${level}/${maxLevel}`, {
          fontSize: '12px',
          color: level > 0 ? '#aaffdd' : '#999999'
        }).setOrigin(0, 0.5);

        // 右侧标签
        let tag;
        if (isUltimate) {
          tag = this.add.text(cx + 88, y, '终极', {
            fontSize: '12px',
            color: '#ffff00',
            fontStyle: 'bold'
          }).setOrigin(1, 0.5);
        } else if (isCore) {
          tag = this.add.text(cx + 88, y, '初始', {
            fontSize: '12px',
            color: `#${def.color.toString(16).padStart(6, '0')}`,
            fontStyle: 'bold'
          }).setOrigin(1, 0.5);
        }

        this.treeArea.add(nodeBg);
        this.treeArea.add(nodeBorder);
        this.treeArea.add(nameText);
        this.treeArea.add(lvText);
        if (tag) this.treeArea.add(tag);
      }

      // 底部预览说明
      this.treeArea.add(this.add.text(cx, areaBottom - 12, `终极技能预览：${def.ultimate.name}`, {
        fontSize: '12px',
        color: '#cccccc'
      }).setOrigin(0.5));
    }
  }

  createButton(x, y, text, callback) {
    const btn = this.add.container(x, y);
    const bg = this.textures.exists('ui_button')
      ? this.add.image(0, 0, 'ui_button').setDisplaySize(90, 40)
      : this.add.rectangle(0, 0, 90, 40, 0x2a2a3a, 1);
    if (bg.type === 'Rectangle') {
      bg.setStrokeStyle(2, 0x66ccff);
    }
    const label = this.add.text(0, 0, text, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    btn.add([bg, label]);
    btn.setSize(90, 40);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerup', callback);
    btn.on('pointerover', () => {
      if (bg.setTint) bg.setTint(0x9fb9ff);
      if (bg.setFillStyle) bg.setFillStyle(0x3a3a4a, 1);
    });
    btn.on('pointerout', () => {
      if (bg.clearTint) bg.clearTint();
      if (bg.setFillStyle) bg.setFillStyle(0x2a2a3a, 1);
    });
    btn.setData('bg', bg);
    return btn;
  }

}
