import {
  buildUpgradePips,
  CORE_MODULES,
  PROTOTYPE_UPGRADES,
} from '../../config/progressionCatalog';
import { clamp } from '../../utils/math';

export function createUpgradeMenu(scene) {
  scene.upgradeMenu = scene.add.container(0, 0).setDepth(1000).setVisible(false);

  const panelBg = scene.add.rectangle(scene.scale.width * 0.5, scene.scale.height * 0.5, scene.scale.width, scene.scale.height, 0x061018, 0.97)
    .setStrokeStyle(2, 0xffd36b, 0.16);
  const title = scene.add.text(22, 26, '成长终端', {
    fontSize: '34px',
    color: '#ffe18a',
    fontStyle: 'bold',
  }).setOrigin(0, 0);
  scene.upgradeMenuGoldText = scene.add.text(22, 66, '金币：0', {
    fontSize: '22px',
    color: '#ffffff',
  }).setOrigin(0, 0);
  scene.upgradeMenuLevelText = scene.add.text(200, 66, '等级：1', {
    fontSize: '22px',
    color: '#d7e9ff',
  }).setOrigin(0, 0);
  const closeButton = scene.add.rectangle(scene.scale.width - 34, 34, 42, 42, 0x3a2433, 0.98)
    .setStrokeStyle(2, 0xffd6ef, 0.34)
    .setInteractive({ useHandCursor: true });
  const closeButtonLabel = scene.add.text(scene.scale.width - 34, 34, '关', {
    fontSize: '20px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  closeButton.on('pointerdown', () => {
    closeUpgradeMenu(scene);
  });

  scene.upgradeMenuTabs = {
    player: {
      button: scene.add.rectangle(108, 114, 172, 42, 0x163247, 0.96)
        .setStrokeStyle(2, 0x9fd6ff, 0.26)
        .setInteractive({ useHandCursor: true }),
      label: scene.add.text(108, 114, '玩家升级', {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5),
    },
    core: {
      button: scene.add.rectangle(292, 114, 172, 42, 0x163247, 0.96)
        .setStrokeStyle(2, 0x9fd6ff, 0.26)
        .setInteractive({ useHandCursor: true }),
      label: scene.add.text(292, 114, '核心模块', {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5),
    },
  };
  scene.upgradeMenuTabs.player.button.on('pointerdown', () => switchUpgradeMenuTab(scene, 'player'));
  scene.upgradeMenuTabs.core.button.on('pointerdown', () => switchUpgradeMenuTab(scene, 'core'));

  scene.upgradeScrollViewport = {
    x: 16,
    y: 156,
    width: scene.scale.width - 32,
    height: scene.scale.height - 188,
  };
  const maskGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
  maskGraphics.fillRect(
    scene.upgradeScrollViewport.x,
    scene.upgradeScrollViewport.y,
    scene.upgradeScrollViewport.width,
    scene.upgradeScrollViewport.height,
  );
  scene.upgradeScrollContent = scene.add.container(scene.upgradeScrollViewport.x, scene.upgradeScrollViewport.y);
  scene.upgradeScrollContent.setMask(maskGraphics.createGeometryMask());
  scene.upgradeScrollZone = scene.add.zone(
    scene.upgradeScrollViewport.x,
    scene.upgradeScrollViewport.y,
    scene.upgradeScrollViewport.width,
    scene.upgradeScrollViewport.height,
  ).setOrigin(0).setInteractive();
  scene.upgradeScrollOffset = 0;
  scene.upgradeScrollMaxOffset = 0;
  scene.upgradeScrollDragState = null;
  scene.upgradeScrollZone.on('pointerdown', (pointer) => {
    if (!scene.isUpgradeMenuOpen) return;
    scene.upgradeScrollDragState = {
      pointerId: pointer.id,
      startY: pointer.y,
      startOffset: scene.upgradeScrollOffset,
    };
  });

  scene.upgradeOptionRows = Array.from({ length: Math.max(PROTOTYPE_UPGRADES.length, CORE_MODULES.length) }, (_, index) => {
    const rowY = 36 + (index * 126);
    const dividerLine = scene.add.rectangle(scene.upgradeScrollViewport.width * 0.5, rowY - 40, scene.upgradeScrollViewport.width - 16, 2, 0xffd36b, 0.18)
      .setOrigin(0.5);
    const dividerText = scene.add.text(8, rowY - 58, '', {
      fontSize: '16px',
      color: '#ffcf80',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const button = scene.add.rectangle(118, rowY, 200, 40, 0x163247, 0.98)
      .setStrokeStyle(2, 0x9fd6ff, 0.26)
      .setInteractive({ useHandCursor: true });
    const nameText = scene.add.text(118, rowY, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const rankText = scene.add.text(scene.upgradeScrollViewport.width - 12, rowY, '', {
      fontSize: '22px',
      color: '#ffe18a',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    const descText = scene.add.text(8, rowY + 34, '', {
      fontSize: '16px',
      color: '#c7ddf7',
      wordWrap: { width: scene.upgradeScrollViewport.width - 16 },
    }).setOrigin(0, 0);
    const costText = scene.add.text(scene.upgradeScrollViewport.width - 12, rowY + 34, '', {
      fontSize: '16px',
      color: '#ffe18a',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    button.on('pointerdown', () => {
      purchaseUpgradeMenuEntry(scene, index);
    });

    return {
      dividerLine,
      dividerText,
      button,
      nameText,
      rankText,
      descText,
      costText,
      entryId: null,
      entryType: null,
    };
  });

  const closeHint = scene.add.text(scene.scale.width * 0.5, scene.scale.height - 16, '上方切换分页，列表支持手指上下滑动，点右上角关闭或按 ESC 继续战斗', {
    fontSize: '18px',
    color: '#c8d6e5',
  }).setOrigin(0.5, 1);

  scene.upgradeMenu.add([
    panelBg,
    title,
    scene.upgradeMenuGoldText,
    scene.upgradeMenuLevelText,
    closeButton,
    closeButtonLabel,
    scene.upgradeMenuTabs.player.button,
    scene.upgradeMenuTabs.player.label,
    scene.upgradeMenuTabs.core.button,
    scene.upgradeMenuTabs.core.label,
    scene.upgradeScrollZone,
    scene.upgradeScrollContent,
    closeHint,
  ]);
  scene.upgradeOptionRows.forEach((row) => {
    scene.upgradeScrollContent.add([
      row.dividerLine,
      row.dividerText,
      row.button,
      row.nameText,
      row.rankText,
      row.descText,
      row.costText,
    ]);
  });
}

export function openUpgradeMenu(scene) {
  if (scene.gameResolved || scene.isUpgradeMenuOpen) return;
  scene.isUpgradeMenuOpen = true;
  scene.upgradeMenuOpenedAt = scene.time.now;
  scene.upgradeMenuTab = 'player';
  scene.pointerTarget = null;
  setUpgradeScrollOffset(scene, 0);
  refreshUpgradeMenu(scene);
  scene.upgradeMenu.setVisible(true);
}

export function closeUpgradeMenu(scene) {
  if (!scene.isUpgradeMenuOpen) return;
  scene.isUpgradeMenuOpen = false;
  scene.upgradeScrollDragState = null;
  scene.pausedAccumulatedMs += Math.max(0, scene.time.now - scene.upgradeMenuOpenedAt);
  scene.upgradeMenu.setVisible(false);
}

export function refreshUpgradeMenu(scene) {
  scene.upgradeMenuGoldText.setText(`金币：${scene.gold}`);
  scene.upgradeMenuLevelText.setText(`等级：${scene.battleLevel}`);
  Object.entries(scene.upgradeMenuTabs).forEach(([tabKey, tabUi]) => {
    const active = scene.upgradeMenuTab === tabKey;
    tabUi.button.setFillStyle(active ? 0x5a3a16 : 0x163247, 0.96);
    tabUi.button.setStrokeStyle(2, active ? 0xffd36b : 0x7f8a96, active ? 0.38 : 0.22);
    tabUi.label.setColor(active ? '#ffe18a' : '#d7e9ff');
  });

  const entries = scene.upgradeMenuTab === 'player' ? PROTOTYPE_UPGRADES : CORE_MODULES;
  scene.upgradeOptionRows.forEach((row, index) => {
    const entry = entries[index];
    const visible = Boolean(entry);
    row.dividerLine.setVisible(false);
    row.dividerText.setVisible(false);
    row.button.setVisible(visible);
    row.nameText.setVisible(visible);
    row.rankText.setVisible(visible);
    row.descText.setVisible(visible);
    row.costText.setVisible(visible);

    if (!visible) {
      row.entryId = null;
      row.entryType = null;
      return;
    }

    row.entryId = entry.id;
    row.entryType = scene.upgradeMenuTab;

    const currentLevel = scene.upgradeMenuTab === 'player'
      ? (scene.upgradeLevels[entry.id] || 0)
      : (scene.coreModuleLevels[entry.id] || 0);
    const locked = scene.battleLevel < entry.unlockLevel;
    const maxed = currentLevel >= entry.maxLevel;
    const cost = locked || maxed ? null : entry.getCost(currentLevel);
    const affordable = cost != null && scene.gold >= cost;
    const needsDivider = index > 0 && entries[index - 1] && entries[index - 1].unlockLevel < entry.unlockLevel;

    row.dividerLine.setVisible(needsDivider);
    row.dividerText.setVisible(needsDivider);
    if (needsDivider) {
      row.dividerText.setText(`Lv.${entry.unlockLevel} 解锁区`);
    }

    row.nameText.setText(entry.name);
    row.rankText.setText(buildUpgradePips(currentLevel, entry.maxLevel));

    if (locked) {
      row.descText.setText(`达到等级 ${entry.unlockLevel} 后解锁。当前可先投入初始可升级技能。`);
      row.costText.setText(`Lv.${entry.unlockLevel} 解锁`);
    } else if (maxed) {
      row.descText.setText('已达到当前原型允许的最高档位。');
      row.costText.setText('已满级');
    } else {
      row.descText.setText(entry.getDesc(scene, currentLevel));
      row.costText.setText(`${cost} 金币`);
    }

    row.button.setFillStyle((!locked && !maxed && affordable) ? 0x163247 : 0x3a3944, 0.96);
    row.button.setStrokeStyle(2, (!locked && !maxed && affordable) ? 0xffd36b : 0x7f8a96, 0.28);
    row.nameText.setColor(locked ? '#92a0b4' : '#ffffff');
    row.rankText.setColor(maxed ? '#8df0b2' : (locked ? '#66758a' : '#ffe18a'));
    row.descText.setColor(locked ? '#7f8a96' : '#c7ddf7');
    row.costText.setColor(maxed ? '#8df0b2' : (locked ? '#7f8a96' : '#ffe18a'));
  });

  const contentHeight = (entries.length * 126) + 8;
  scene.upgradeScrollMaxOffset = Math.max(0, contentHeight - scene.upgradeScrollViewport.height);
  setUpgradeScrollOffset(scene, scene.upgradeScrollOffset);
}

export function setUpgradeScrollOffset(scene, nextOffset) {
  scene.upgradeScrollOffset = clamp(Number(nextOffset || 0), 0, scene.upgradeScrollMaxOffset);
  if (scene.upgradeScrollContent) {
    scene.upgradeScrollContent.y = scene.upgradeScrollViewport.y - scene.upgradeScrollOffset;
  }
}

export function switchUpgradeMenuTab(scene, tabKey) {
  if (tabKey !== 'player' && tabKey !== 'core') return;
  if (scene.upgradeMenuTab === tabKey) return;
  scene.upgradeMenuTab = tabKey;
  setUpgradeScrollOffset(scene, 0);
  refreshUpgradeMenu(scene);
}

export function purchaseUpgradeMenuEntry(scene, index) {
  const row = scene.upgradeOptionRows[index];
  if (!row?.entryId || !row?.entryType) return;
  if (row.entryType === 'player') {
    purchasePrototypeUpgrade(scene, row.entryId);
    return;
  }
  purchaseCoreModule(scene, row.entryId);
}

export function purchasePrototypeUpgrade(scene, upgradeId) {
  const upgrade = PROTOTYPE_UPGRADES.find((item) => item.id === upgradeId);
  if (!upgrade) return;
  const currentLevel = scene.upgradeLevels[upgrade.id] || 0;
  if (scene.battleLevel < upgrade.unlockLevel) return;
  if (currentLevel >= upgrade.maxLevel) return;
  const cost = upgrade.getCost(currentLevel);
  if (scene.gold < cost) return;
  scene.gold -= cost;
  upgrade.apply(scene);
  refreshUpgradeMenu(scene);
}

export function purchaseCoreModule(scene, moduleId) {
  const module = CORE_MODULES.find((item) => item.id === moduleId);
  if (!module) return;
  const currentLevel = scene.coreModuleLevels[module.id] || 0;
  if (scene.battleLevel < module.unlockLevel) return;
  if (currentLevel >= module.maxLevel) return;
  const cost = module.getCost(currentLevel);
  if (scene.gold < cost) return;
  scene.gold -= cost;
  module.apply(scene);
  refreshUpgradeMenu(scene);
}

export function updateUpgradeMenuScroll(scene) {
  if (!scene.upgradeScrollDragState) return;
  const pointer = scene.input.activePointer;
  if (!pointer?.isDown || pointer.id !== scene.upgradeScrollDragState.pointerId) {
    scene.upgradeScrollDragState = null;
    return;
  }
  const deltaY = pointer.y - scene.upgradeScrollDragState.startY;
  setUpgradeScrollOffset(scene, scene.upgradeScrollDragState.startOffset - deltaY);
}