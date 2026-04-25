function setBarWidth(bar, width, height) {
  if (!bar) return;
  if (typeof bar.setSize === 'function') {
    bar.setSize(Math.max(0, width), height);
    return;
  }
  bar.width = Math.max(0, width);
  bar.height = height;
}

function getCoreBarColor(hpPercent) {
  if (hpPercent > 0.6) return 0x52d66f;
  if (hpPercent > 0.3) return 0xe5d85c;
  return 0xff5d73;
}

function updateCoreHpBar(scene) {
  const hud = scene.topHud;
  if (!hud) return;

  const hpPercent = Math.max(0, Math.min(1, scene.coreHp / Math.max(1, scene.coreMaxHp)));
  const targetWidth = Math.max(2, Math.round(hud.coreBarWidth * hpPercent));
  const lagWidth = Number(hud.coreBarLag.width || hud.coreBarLag.displayWidth || targetWidth);
  const previousTargetWidth = Number(hud.lastCoreTargetWidth ?? lagWidth);
  const currentWidth = previousTargetWidth;
  const tookDamage = targetWidth < currentWidth;
  const healed = targetWidth > lagWidth;

  hud.coreBar.setFillStyle(getCoreBarColor(hpPercent), 1);
  setBarWidth(hud.coreBar, targetWidth, hud.coreBarHeight);

  if (tookDamage) {
    hud.coreDamageFlash.setAlpha(0.72);
    setBarWidth(hud.coreDamageFlash, Math.max(6, currentWidth - targetWidth), hud.coreBarHeight + 2);
    hud.coreDamageFlash.setPosition(hud.coreBar.x + targetWidth, hud.coreDamageFlash.y);
    scene.tweens.add({
      targets: hud.coreDamageFlash,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
    });
    scene.tweens.add({
      targets: hud.coreFrame,
      alpha: 1,
      duration: 90,
      yoyo: true,
      ease: 'Sine.Out',
      onStart: () => {
        hud.coreFrame.setStrokeStyle(2, 0xffffff, 0.95);
      },
      onComplete: () => {
        hud.coreFrame.setStrokeStyle(2, 0xffd7de, 0.4);
      },
    });

    if (hud.pendingLagTargetWidth !== targetWidth) {
      hud.pendingLagTargetWidth = targetWidth;
      hud.lagTween?.stop?.();
      hud.lagDelay?.remove?.();
      setBarWidth(hud.coreBarLag, Math.max(lagWidth, currentWidth), hud.coreBarHeight);
      hud.coreBarLag.setPosition(hud.coreBar.x, hud.coreBarLag.y);
      hud.lagDelay = scene.time.delayedCall(180, () => {
        hud.lagTween = scene.tweens.add({
          targets: hud.coreBarLag,
          width: targetWidth,
          duration: 420,
          ease: 'Cubic.Out',
          onUpdate: () => {
            setBarWidth(hud.coreBarLag, hud.coreBarLag.width, hud.coreBarHeight);
            hud.coreBarLag.setPosition(hud.coreBar.x, hud.coreBarLag.y);
          },
        });
      });
    }
  }

  if (healed) {
    hud.pendingLagTargetWidth = targetWidth;
    setBarWidth(hud.coreBarLag, targetWidth, hud.coreBarHeight);
    hud.coreBarLag.setPosition(hud.coreBar.x, hud.coreBarLag.y);
  }

  hud.lastCoreTargetWidth = targetWidth;
}

function updateExpBar(scene) {
  const hud = scene.topHud;
  if (!hud) return;
  const expPercent = Math.max(0, Math.min(1, scene.battleExp / Math.max(1, scene.nextBattleExp)));
  const expWidth = Math.max(2, Math.round(hud.expBarWidth * expPercent));
  setBarWidth(hud.expBar, expWidth, hud.expBarHeight);
}

export function createTopHud(scene) {
  const panelHeight = 120;
  const width = scene.scale.width;
  const centerX = Math.round(width * 0.5);
  const depthBase = 920;
  const sidePadding = 18;
  const barGap = 14;
  const menuReserve = 0;
  const availableBarWidth = Math.max(320, width - (sidePadding * 2) - menuReserve);
  const barWidth = Math.max(150, Math.floor((availableBarWidth - barGap) / 2));
  const coreBarWidth = barWidth;
  const coreBarHeight = 14;
  const expBarWidth = barWidth;
  const expBarHeight = 14;

  scene.topPanelHeight = panelHeight;

  const bg = scene.add.rectangle(centerX, panelHeight * 0.5, width, panelHeight, 0x050b12, 0)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase);
  bg.setStrokeStyle(0, 0xffffff, 0);
  const topLine = scene.add.line(0, 0, 0, 6, width, 6, 0x90e0ff, 0.22)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(depthBase + 1);
  const bottomLine = scene.add.line(0, 0, 0, panelHeight - 4, width, panelHeight - 4, 0xffc46b, 0)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(depthBase + 1);

  const topBarY = 20;
  const topTextY = 31;
  const leftBarX = sidePadding;
  const rightBarX = leftBarX + coreBarWidth + barGap;

  const classText = scene.add.text(18, 16, '', {
    fontSize: '20px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 1);
  classText.setVisible(false);

  const goldText = scene.add.text(18, 50, '', {
    fontSize: '16px',
    color: '#ffe18a',
    fontStyle: 'bold',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const scoreText = scene.add.text(18, 70, '', {
    fontSize: '16px',
    color: '#cce7ff',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const timerText = scene.add.text(width - 18, 50, '', {
    fontSize: '20px',
    color: '#ffe18a',
    fontStyle: 'bold',
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const waveText = scene.add.text(width - 18, 72, '', {
    fontSize: '15px',
    color: '#d9ecff',
    fontStyle: 'bold',
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const stageText = scene.add.text(width - 18, 90, '', {
    fontSize: '15px',
    color: '#ffcf80',
    fontStyle: 'bold',
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const threatText = scene.add.text(18, 90, '', {
    fontSize: '14px',
    color: '#ffd36b',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const pressureText = scene.add.text(width - 18, 108, '', {
    fontSize: '14px',
    color: '#9ce6ff',
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const coreTitleText = scene.add.text(leftBarX, topTextY, '核心 0/0', {
    fontSize: '14px',
    color: '#ffd6ef',
    fontStyle: 'bold',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 6);

  const coreBarY = topBarY;
  const expBarY = topBarY;

  const coreBarBg = scene.add.rectangle(leftBarX, coreBarY, coreBarWidth + 4, coreBarHeight + 4, 0x10161f, 1)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 1);
  coreBarBg.setStrokeStyle(1, 0xffffff, 0.12);

  const coreFrame = scene.add.rectangle(leftBarX + (coreBarWidth + 4) * 0.5, coreBarY, coreBarWidth + 8, coreBarHeight + 8, 0x000000, 0)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 2);
  coreFrame.setStrokeStyle(2, 0xffd7de, 0.4);

  const coreBarLag = scene.add.rectangle(leftBarX + 2, coreBarY, coreBarWidth, coreBarHeight, 0xd8b85d, 0.72)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 3);

  const coreBar = scene.add.rectangle(leftBarX + 2, coreBarY, coreBarWidth, coreBarHeight, 0x52d66f, 1)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 4);

  const coreDamageFlash = scene.add.rectangle(leftBarX + 2, coreBarY, 0, coreBarHeight + 2, 0xffffff, 0)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 5);

  const coreValueText = scene.add.text(leftBarX, topTextY, '', {
    fontSize: '14px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 6);

  const shieldText = scene.add.text(18, 108, '', {
    fontSize: '14px',
    color: '#b6d6ff',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 1);

  const expLabelText = scene.add.text(rightBarX, topTextY, '', {
    fontSize: '14px',
    color: '#d4e7ff',
    fontStyle: 'bold',
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(depthBase + 6);

  const expBarBg = scene.add.rectangle(rightBarX, expBarY, expBarWidth + 4, expBarHeight + 4, 0x10161f, 1)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 1);
  expBarBg.setStrokeStyle(1, 0xffffff, 0.1);

  const expBar = scene.add.rectangle(rightBarX + 2, expBarY, expBarWidth, expBarHeight, 0x7bd8ff, 1)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 3);

  const levelPulse = scene.add.rectangle(rightBarX + (expBarWidth + 4) * 0.5, expBarY, expBarWidth + 8, expBarHeight + 8, 0x9ce6ff, 0)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(depthBase + 4);

  scene.topHud = {
    bg,
    topLine,
    bottomLine,
    classText,
    goldText,
    scoreText,
    timerText,
    waveText,
    stageText,
    threatText,
    pressureText,
    coreTitleText,
    coreBarBg,
    coreFrame,
    coreBarLag,
    coreBar,
    coreDamageFlash,
    coreValueText,
    shieldText,
    expLabelText,
    expBarBg,
    expBar,
    levelPulse,
    coreBarWidth,
    coreBarHeight,
    expBarWidth,
    expBarHeight,
    lagTween: null,
    lagDelay: null,
    lastBattleLevel: scene.battleLevel,
    lastCoreTargetWidth: coreBarWidth,
    pendingLagTargetWidth: coreBarWidth,
  };

  refreshTopHud(scene, { instant: true });
}

export function refreshTopHud(scene, options = {}) {
  const hud = scene.topHud;
  if (!hud) return;

  const leveledUp = scene.battleLevel > (hud.lastBattleLevel || scene.battleLevel);
  hud.lastBattleLevel = scene.battleLevel;

  hud.classText.setText('');
  hud.goldText.setText(`金币：${scene.gold}`);
  hud.scoreText.setText(`清除：${scene.score}`);
  hud.timerText.setText(`坚守 ${String(Math.floor(scene.survivedMs / 60000)).padStart(2, '0')}:${String(Math.floor(scene.survivedMs / 1000) % 60).padStart(2, '0')}`);
  hud.waveText.setText(scene.currentWaveLabel);
  hud.stageText.setText(`战局：${scene.currentThreatStageLabel}`);
  hud.threatText.setText(`威胁 ${(Number(scene.currentThreat || 0)).toFixed(1)} ${scene.currentThreatTier}`);
  hud.pressureText.setText(`施压 ${(Number(scene.currentPressure || 0)).toFixed(1)}`);
  hud.coreTitleText.setText('');
  hud.coreValueText.setText(`核心 ${Math.max(0, Math.round(scene.coreHp))}/${scene.coreMaxHp}`);
  hud.shieldText.setText(`护盾 ${Math.max(0, Math.round(scene.coreShield))}/${scene.coreShieldMax}`);
  hud.expLabelText.setText(`Lv.${scene.battleLevel} 经验 ${scene.battleExp}/${scene.nextBattleExp}`);

  if (options.instant) {
    const hpPercent = Math.max(0, Math.min(1, scene.coreHp / Math.max(1, scene.coreMaxHp)));
    const hpWidth = Math.max(2, Math.round(hud.coreBarWidth * hpPercent));
    setBarWidth(hud.coreBar, hpWidth, hud.coreBarHeight);
    setBarWidth(hud.coreBarLag, hpWidth, hud.coreBarHeight);
    hud.coreBarLag.setPosition(hud.coreBar.x, hud.coreBarLag.y);
    hud.coreBar.setFillStyle(getCoreBarColor(hpPercent), 1);
    hud.lastCoreTargetWidth = hpWidth;
    hud.pendingLagTargetWidth = hpWidth;

    const expPercent = Math.max(0, Math.min(1, scene.battleExp / Math.max(1, scene.nextBattleExp)));
    setBarWidth(hud.expBar, Math.max(2, Math.round(hud.expBarWidth * expPercent)), hud.expBarHeight);
    return;
  }

  updateCoreHpBar(scene);
  updateExpBar(scene);

  if (leveledUp) {
    hud.levelPulse.setAlpha(0.65);
    hud.levelPulse.setScale(1);
    scene.tweens.add({
      targets: hud.levelPulse,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.65,
      duration: 360,
      ease: 'Cubic.Out',
    });
    scene.tweens.add({
      targets: hud.expLabelText,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 120,
      yoyo: true,
      ease: 'Back.Out',
    });
  }
}