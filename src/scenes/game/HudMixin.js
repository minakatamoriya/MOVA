import Phaser from 'phaser';

/**
 * HUD 相关方法：信息面板、血条、经验条、伤害数字、消息提示、按钮
 */
export function applyHudMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    createInfoPanel() {
      const panelX = 10;
      const panelY = 10;

      this.infoTexts = {
        coins: this.add.text(panelX, panelY, '金币: 0', {
          fontSize: '16px',
          color: '#ffd700',
          fontStyle: 'bold'
        })
      };
    },

    showDamageNumber(x, y, damage, colorOrOptions, maybeOptions) {
      if (this.registry?.get('showDamage') === false) return;

      let options = {};
      if (typeof colorOrOptions === 'string') {
        options.color = colorOrOptions;
        if (maybeOptions && typeof maybeOptions === 'object') options = { ...options, ...maybeOptions };
      } else if (typeof colorOrOptions === 'object' && colorOrOptions) {
        options = { ...colorOrOptions };
      }

      const isCrit = !!options.isCrit;
      const color = isCrit ? '#ff3333' : (options.color || '#ffee00');
      const fontSize = options.fontSize || (isCrit ? 46 : 34);
      const text = isCrit ? `暴击 ${damage}` : `${damage}`;

      const damageText = this.add.text(x, y, text, {
        fontSize: `${fontSize}px`,
        fontFamily: 'Arial',
        color,
        fontStyle: 'bold',
        resolution: 2,
        letterSpacing: 1
      }).setOrigin(0.5);

      damageText.setDepth(999);

      damageText.setScale(isCrit ? 0.92 : 0.88);
      this.tweens.add({
        targets: damageText,
        scale: isCrit ? 1.55 : 1.18,
        duration: isCrit ? 140 : 120,
        ease: 'Back.Out'
      });

      this.tweens.add({
        targets: damageText,
        y: y - (isCrit ? 85 : 60),
        duration: isCrit ? 980 : 780,
        ease: isCrit ? 'Cubic.Out' : 'Power2',
        onComplete: () => {
          damageText.destroy();
        }
      });

      if (isCrit) {
        this.tweens.add({
          targets: damageText,
          x: x + Phaser.Math.Between(-10, 10),
          yoyo: true,
          repeat: 2,
          duration: 60,
          ease: 'Sine.InOut'
        });
      }
    },

    showStartMessage() {
      const centerX = this.cameras.main.centerX;
      const centerY = this.cameras.main.centerY;

      const msg = this.weaponSelected
        ? '前往北方挑战 Boss！'
        : '六选一：先选择武器\n然后前往北方挑战火焰领主';

      const startText = this.add.text(centerX, centerY,
        msg,
        {
          fontSize: '36px',
          color: '#ffffff',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 4
        }
      ).setOrigin(0.5);

      this.tweens.add({
        targets: startText,
        alpha: 0,
        y: centerY - 100,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => startText.destroy()
      });
    },

    showControlsHint() {
      const hintText = this.add.text(
        this.cameras.main.width / 2,
        this.gameArea.y + this.gameArea.height - 30,
        'WASD/方向键: 移动  |  Shift: 慢速移动  |  自动射击',
        {
          fontSize: '14px',
          color: '#888888',
          align: 'center'
        }
      ).setOrigin(0.5);

      this.time.delayedCall(5000, () => {
        this.tweens.add({
          targets: hintText,
          alpha: 0,
          duration: 1000,
          onComplete: () => hintText.destroy()
        });
      });
    },

    updateInfoPanel() {
      if (this.player) {
        const hpPercent = this.player.hp / this.player.maxHp;
        this.updateHpProgressBar(hpPercent);

        if (this.hpBarText) {
          this.hpBarText.setText(`${this.player.hp}`);
          if (hpPercent > 0.6) {
            this.hpBarText.setColor('#caffca');
          } else if (hpPercent > 0.3) {
            this.hpBarText.setColor('#fff4a8');
          } else {
            this.hpBarText.setColor('#ffb3b3');
          }
        }
      }

      if (this.playerData) {
        const expPercent = (this.playerData.maxExp > 0)
          ? (this.playerData.exp / this.playerData.maxExp)
          : 0;
        this.updateExpProgressBar(expPercent);
        if (this.expBarText) {
          this.expBarText.setText(`Lv.${this.playerData.level}  ${this.playerData.exp}/${this.playerData.maxExp}`);
        }
      }

      if (this.viewMenuOpen) {
        this.refreshViewMenuPanels();
      }
    },

    updateHpProgressBar(hpPercent) {
      if (!this.hpBarFill || !this.hpBarBg) return;
      const percent = Phaser.Math.Clamp(hpPercent, 0, 1);
      const fillWidth = Math.max(2, Math.floor(this.hpBarWidth * percent));
      this.hpBarFill.width = fillWidth;

      let fillColor;
      if (percent >= 0.5) {
        const t = (1 - percent) / 0.5;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0x00ff5a),
          Phaser.Display.Color.ValueToColor(0xfff000),
          100,
          Math.floor(t * 100)
        );
        fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      } else {
        const t = (0.5 - percent) / 0.5;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xfff000),
          Phaser.Display.Color.ValueToColor(0xff2a2a),
          100,
          Math.floor(t * 100)
        );
        fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      }
      this.hpBarFill.setFillStyle(fillColor, 1);
    },

    updateExpProgressBar(expPercent) {
      if (!this.expBarFill || !this.expBarBg) return;
      const percent = Phaser.Math.Clamp(expPercent, 0, 1);
      const fillWidth = Math.max(2, Math.floor(this.expBarWidth * percent));
      this.expBarFill.width = fillWidth;
      this.expBarFill.setFillStyle(0x00ffff, 1);
    },

    updateViewMenuUiAnimations(time, delta) {
      if (!this._viewTalentThirdFrameBorder || this._viewTalentThirdVariant !== 'dual') return;

      const hue = ((time || 0) * 0.00018) % 1;
      const rgb = Phaser.Display.Color.HSVToRGB(hue, 1, 1);
      const color = Phaser.Display.Color.GetColor(rgb.r, rgb.g, rgb.b);
      if (this._viewTalentThirdFrameBorder?.setStrokeStyle) {
        this._viewTalentThirdFrameBorder.setStrokeStyle(3, color);
      }

      if (this._viewTalentThirdFrameGlow1?.setStrokeStyle) {
        this._viewTalentThirdFrameGlow1.setStrokeStyle(8, color, 0.22);
      }
      if (this._viewTalentThirdFrameGlow2?.setStrokeStyle) {
        this._viewTalentThirdFrameGlow2.setStrokeStyle(14, color, 0.10);
      }
    },

    createMinimalBottomHud() {
      const oldElements = [
        this.bottomHudBg,
        this.bottomDivider,
        this.bottomHudViewBtn,
        this.bottomHudExitBtn,
        this.bottomHudHpBarBg,
        this.bottomHudHpBarFill,
        this.bottomHudHpBarText,
        this.levelUpHudContainer,
        this.levelUpHudGlow,
        this.levelUpHudPulse,
        this.levelUpHudCircle,
        this.levelUpHudText
      ];
      oldElements.forEach((el) => {
        if (el?.destroy) el.destroy();
      });

      this.bottomHudBg = null;
      this.bottomDivider = null;
      this.bottomHudViewBtn = null;
      this.bottomHudExitBtn = null;
      this.bottomHudHpBarBg = null;
      this.bottomHudHpBarFill = null;
      this.bottomHudHpBarText = null;
      this.levelUpHudContainer = null;
      this.levelUpHudGlow = null;
      this.levelUpHudPulse = null;
      this.levelUpHudCircle = null;
      this.levelUpHudText = null;

      this.createLevelUpPendingHud();
    },

    rebuildBottomHud() {
      this.createMinimalBottomHud();
      this.updateLevelUpPendingHud(this._gameplayNowMs || 0);
      this.cooldownHud?.layout?.();
    },

    isPointerOverLevelUpHud(pointerX, pointerY) {
      const container = this.levelUpHudContainer;
      if (!container?.visible) return false;

      const x = Number(pointerX);
      const y = Number(pointerY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

      const dx = x - Number(container.x || 0);
      const dy = y - Number(container.y || 0);
      return (dx * dx + dy * dy) <= (44 * 44);
    },

    createLevelUpPendingHud() {
      const cam = this.cameras.main;
      const x = cam.width - 86;
      const y = cam.height - 112;

      const glow = this.add.circle(0, 0, 50, 0xf59e0b, 0.12);
      const pulse = this.add.circle(0, 0, 40, 0xf59e0b, 0.08);
      const circle = this.add.circle(0, 0, 40, 0x78350f, 0.96)
        .setStrokeStyle(4, 0xf59e0b, 0.96);
      const text = this.add.text(0, 0, '0', {
        fontSize: '34px',
        color: '#fff7ed',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const container = this.add.container(x, y, [glow, pulse, circle, text]);
      container.setScrollFactor(0);
      container.setDepth(10020);
      container.setSize(112, 112);
      container.setVisible(false);
      container.setData('ui', true);
      container.setData('isUI', true);
      container.setInteractive(new Phaser.Geom.Circle(0, 0, 44), Phaser.Geom.Circle.Contains);
      container.on('pointerdown', (pointer, localX, localY, event) => {
        event?.stopPropagation?.();
        this.resetTouchJoystickInput?.();
        this.openPendingLevelUpScene?.();
      });

      this.levelUpHudContainer = container;
      this.levelUpHudGlow = glow;
      this.levelUpHudPulse = pulse;
      this.levelUpHudCircle = circle;
      this.levelUpHudText = text;
    },

    updateLevelUpPendingHud(now = 0) {
      const container = this.levelUpHudContainer;
      const glow = this.levelUpHudGlow;
      const pulseRing = this.levelUpHudPulse;
      const circle = this.levelUpHudCircle;
      const text = this.levelUpHudText;
      if (!container || !glow || !pulseRing || !circle || !text) return;

      const points = Math.max(0, Number(this.getPendingLevelUpPoints?.() || 0));
      const sceneActive = !!this.scene?.isActive?.('LevelUpScene');
      if (points <= 0 || sceneActive) {
        container.setVisible(false);
        return;
      }

      let fill = 0x7c4a03;
      let stroke = 0xf59e0b;
      let pulseAmount = 0.038;
      let glowAlpha = 0.14;
      let ringAlpha = 0.10;
      let textScaleAmount = 0.024;
      let ringBaseScale = 1.04;
      let circleStrokeWidth = 4;
      let circleAlpha = 0.96;
      let pulseSpeed = 180;

      if (points >= 10) {
        fill = 0x450a0a;
        stroke = 0xdc2626;
        pulseAmount = 0.18;
        glowAlpha = 0.34;
        ringAlpha = 0.28;
        textScaleAmount = 0.10;
        ringBaseScale = 1.12;
        circleStrokeWidth = 6;
        circleAlpha = 0.99;
        pulseSpeed = 68;
      } else if (points >= 7) {
        fill = 0x6f1d1b;
        stroke = 0xf87171;
        pulseAmount = 0.115;
        glowAlpha = 0.25;
        ringAlpha = 0.21;
        textScaleAmount = 0.06;
        ringBaseScale = 1.08;
        circleStrokeWidth = 5;
        pulseSpeed = 102;
      } else if (points >= 4) {
        fill = 0x9a3412;
        stroke = 0xfb7185;
        pulseAmount = 0.07;
        glowAlpha = 0.20;
        ringAlpha = 0.16;
        textScaleAmount = 0.04;
        ringBaseScale = 1.06;
        pulseSpeed = 132;
      }

      const wave = Math.sin(Number(now || 0) / pulseSpeed);
      const pulse = 1 + wave * pulseAmount;
      const textScale = 1 + wave * textScaleAmount;
      const ringScale = ringBaseScale + wave * (pulseAmount * 0.95);

      circle.setFillStyle(fill, circleAlpha);
      circle.setStrokeStyle(circleStrokeWidth, stroke, 0.98);
      glow.setFillStyle(stroke, glowAlpha);
      glow.setScale(1.02 + pulseAmount * 0.95 + Math.max(0, wave) * pulseAmount * 0.4, 1.02 + pulseAmount * 0.95 + Math.max(0, wave) * pulseAmount * 0.4);
      pulseRing.setFillStyle(stroke, ringAlpha);
      pulseRing.setScale(ringScale, ringScale);
      text.setText(String(points));
      text.setFontSize(points >= 10 ? '32px' : (points >= 7 ? '33px' : '34px'));
      text.setScale(textScale);
      circle.setScale(pulse, pulse);
      container.setPosition(this.cameras.main.width - 86, this.cameras.main.height - 112);
      container.setScale(1);
      container.setVisible(true);
    },

    createTopLeftHud() {
      const x = 14;
      const y = 10;

      const heart = this.add.text(x, y, '❤️', {
        fontSize: '18px',
        color: '#ffffff'
      }).setOrigin(0, 0);
      heart.setScrollFactor(0);
      heart.setDepth(920);
      this.hpHeartText = heart;

      const barX = x + 28;
      const barY = y + 12;
      const barWidth = Math.min(360, Math.max(220, Math.floor(this.cameras.main.width * 0.28)));
      const barHeight = 12;

      this.hpBarWidth = barWidth - 4;
      this.hpBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x0b0b18, 0.92).setOrigin(0, 0.5);
      this.hpBarBg.setStrokeStyle(1, 0x2a2a3a);
      this.hpBarBg.setScrollFactor(0);
      this.hpBarBg.setDepth(920);

      this.hpBarFill = this.add.rectangle(barX + 2, barY, this.hpBarWidth, barHeight - 4, 0x00ff5a, 1).setOrigin(0, 0.5);
      this.hpBarFill.setScrollFactor(0);
      this.hpBarFill.setDepth(921);

      this.hpBarText = this.add.text(barX + barWidth + 10, barY, '100', {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      this.hpBarText.setScrollFactor(0);
      this.hpBarText.setDepth(922);

      const expIconX = barX + barWidth + 10 + 44;
      const expIcon = this.add.text(expIconX, y, '⭐', {
        fontSize: '18px',
        color: '#ffffff'
      }).setOrigin(0, 0);
      expIcon.setScrollFactor(0);
      expIcon.setDepth(920);
      this.expIconText = expIcon;

      const expBarX = expIconX + 26;
      const expBarY = barY;
      const expBarWidth = barWidth;
      const expBarHeight = barHeight;

      this.expBarWidth = expBarWidth - 4;
      this.expBarBg = this.add.rectangle(expBarX, expBarY, expBarWidth, expBarHeight, 0x0b0b18, 0.85).setOrigin(0, 0.5);
      this.expBarBg.setStrokeStyle(1, 0x2a2a3a);
      this.expBarBg.setScrollFactor(0);
      this.expBarBg.setDepth(920);

      this.expBarFill = this.add.rectangle(expBarX + 2, expBarY, this.expBarWidth, expBarHeight - 4, 0x00ffff, 1).setOrigin(0, 0.5);
      this.expBarFill.setScrollFactor(0);
      this.expBarFill.setDepth(921);

      this.expBarText = this.add.text(expBarX + expBarWidth + 10, expBarY, 'Lv.1  0/100', {
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0, 0.5);
      this.expBarText.setScrollFactor(0);
      this.expBarText.setDepth(922);
    },

    /**
     * 重建左上角 HUD（屏幕尺寸变化后调用）
     * 销毁旧的 HUD 元素并重新创建
     */
    rebuildTopLeftHud() {
      // 销毁旧的 HUD 元素
      const oldElements = [
        this.hpHeartText, this.hpBarBg, this.hpBarFill, this.hpBarText,
        this.expIconText, this.expBarBg, this.expBarFill, this.expBarText
      ];
      oldElements.forEach(el => { if (el && el.destroy) el.destroy(); });

      // 重新创建
      this.createTopLeftHud();

      // 恢复 HUD 数值显示
      this.updateInfoPanel();
    },

    createButton(x, y, text, callback, width = 140, height = 50, fontSize = '14px') {
      const button = this.add.container(x, y);

      const bg = this.textures.exists('ui_button')
        ? this.add.image(0, 0, 'ui_button').setDisplaySize(width, height)
        : this.add.rectangle(0, 0, width, height, 0x4a4a4a);
      if (bg.type === 'Rectangle') {
        bg.setStrokeStyle(2, 0xffffff);
      }

      const label = this.add.text(0, 0, text, {
        fontSize: fontSize,
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

      button.add([bg, label]);
      button.setSize(width, height);
      button.setInteractive({ useHandCursor: true });

      button.on('pointerover', () => {
        if (bg.setTint) bg.setTint(0x9fb9ff);
        if (bg.setFillStyle) bg.setFillStyle(0x666666);
      });
      button.on('pointerout', () => {
        if (bg.clearTint) bg.clearTint();
        if (bg.setFillStyle) bg.setFillStyle(0x4a4a4a);
      });
      button.on('pointerdown', () => {
        if (bg.setTint) bg.setTint(0x6b7cff);
        if (bg.setFillStyle) bg.setFillStyle(0x333333);
      });
      button.on('pointerup', () => {
        if (bg.setTint) bg.setTint(0x9fb9ff);
        if (bg.setFillStyle) bg.setFillStyle(0x666666);
        callback();
      });

      return button;
    }

  });
}
