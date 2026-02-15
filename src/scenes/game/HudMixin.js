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
      const dividerY = this.bottomHudTopY || (this.gameArea.y + this.gameArea.height);

      this.bottomHudBg = this.add.rectangle(0, dividerY, this.cameras.main.width, this.bottomPanelHeight, 0x0b0b18, 0.92)
        .setOrigin(0, 0);
      this.bottomHudBg.setScrollFactor(0);
      this.bottomHudBg.setDepth(900);

      this.bottomDivider = this.add.graphics();
      this.bottomDivider.lineStyle(2, 0x2a2a3a, 1);
      this.bottomDivider.beginPath();
      this.bottomDivider.moveTo(0, dividerY);
      this.bottomDivider.lineTo(this.cameras.main.width, dividerY);
      this.bottomDivider.strokePath();
      this.bottomDivider.setScrollFactor(0);
      this.bottomDivider.setDepth(901);

      const hpRowY = dividerY + 28;
      const btnRowY = dividerY + 78;

      if (!this.isReactUiMode()) {
        const viewBtn = this.createButton(84, btnRowY, '查看', () => {
          if (this.viewMenuOpen) this.closeViewMenu();
          else this.openViewMenu();
        }, 96, 30, '13px');
        viewBtn.setDepth(910);

        const exitBtn = this.createButton(this.cameras.main.width - 84, btnRowY, '退出', () => {
          console.log('返回主菜单');
          this.scene.start('MenuScene');
        }, 96, 30, '13px');
        exitBtn.setDepth(910);
      }

      const barMarginX = 240;
      const barX = Math.floor(barMarginX / 2);
      const barY = hpRowY;
      const barWidth = this.cameras.main.width - barMarginX;
      const barHeight = 14;

      this.hpBarWidth = barWidth - 4;
      this.hpBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x0b0b18, 0.95)
        .setOrigin(0, 0.5);
      this.hpBarBg.setStrokeStyle(1, 0x2a2a3a);
      this.hpBarBg.setScrollFactor(0);
      this.hpBarBg.setDepth(920);

      this.hpBarFill = this.add.rectangle(barX + 2, barY, this.hpBarWidth, barHeight - 4, 0x00ff5a, 1)
        .setOrigin(0, 0.5);
      this.hpBarFill.setScrollFactor(0);
      this.hpBarFill.setDepth(921);

      this.hpBarText = this.add.text(barX + barWidth + 10, barY, '100/100', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      this.hpBarText.setScrollFactor(0);
      this.hpBarText.setDepth(922);

      if (!this.isReactUiMode()) {
        this.createViewMenu();
      }
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
