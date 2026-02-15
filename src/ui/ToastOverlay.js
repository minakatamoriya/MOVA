import Phaser from 'phaser';

export default class ToastOverlay {
  constructor(scene, opts = {}) {
    this.scene = scene;

    this.depth = opts.depth ?? 2600;
    this.margin = opts.margin ?? 16;
    this.durationMs = opts.durationMs ?? 1600;
    this.gap = opts.gap ?? 10;

    this._toasts = [];
    this._nextId = 1;

    this.scene.events.once('shutdown', () => this.destroy());
    this.scene.events.once('destroy', () => this.destroy());
  }

  destroy() {
    if (Array.isArray(this._toasts)) {
      this._toasts.forEach((t) => {
        if (t?.container?.active) {
          try { t.container.destroy(true); } catch (_) { /* ignore */ }
        }
      });
      this._toasts.length = 0;
    }
    this.scene = null;
  }

  show(payload, opts = {}) {
    if (!this.scene) return;

    const resolved = (() => {
      if (payload && typeof payload === 'object') {
        const text = String(payload.text ?? '');
        const icon = payload.icon == null ? '' : String(payload.icon);
        return { text, icon: icon || 'ℹ️' };
      }
      return { text: String(payload ?? ''), icon: 'ℹ️' };
    })();

    const durationMs = Math.max(0, opts.durationMs ?? this.durationMs);
    const id = this._nextId++;
    const toast = this._createToast({ id, ...resolved, durationMs });
    if (!toast) return;

    this._toasts.push(toast);
    this._layoutToasts({ animate: true });

    toast.hideTimer = this.scene.time.delayedCall(durationMs, () => {
      this._dismissToast(id);
    });
  }

  _getAnchor() {
    const cam = this.scene.cameras.main;
    const bottomHudH = this.scene.bottomPanelHeight || 0;
    return {
      cam,
      x: cam.width - this.margin,
      y: cam.height - this.margin - bottomHudH - 22
    };
  }

  _createToast({ id, text, icon, durationMs }) {
    if (!this.scene) return null;

    const { cam, x, y } = this._getAnchor();

    const container = this.scene.add.container(x, y);
    container.setScrollFactor(0);
    container.setDepth(this.depth);
    container.setAlpha(0);

    const iconText = icon
      ? this.scene.add.text(0, 0, icon, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0, 0.5)
      : null;

    const msgText = this.scene.add.text(0, 0, String(text ?? ''), {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'left',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: Math.floor(cam.width * 0.42), useAdvancedWrap: true }
    }).setOrigin(0, 0.5);

    const padX = 16;
    const padY = 10;
    const gap = iconText ? 10 : 0;
    const innerW = (iconText ? iconText.width : 0) + gap + msgText.width;

    const w = Phaser.Math.Clamp(Math.ceil(innerW + padX * 2), 180, Math.floor(cam.width * 0.46));
    const h = Phaser.Math.Clamp(Math.ceil(Math.max(iconText?.height || 0, msgText.height) + padY * 2), 44, 120);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0b0b18, 0.86);
    bg.fillRoundedRect(-w, -h / 2, w, h, 10);
    bg.lineStyle(2, 0xffffff, 0.18);
    bg.strokeRoundedRect(-w, -h / 2, w, h, 10);

    const leftX = -w + padX;
    if (iconText) {
      iconText.setPosition(leftX, 0);
      msgText.setPosition(leftX + iconText.width + gap, 0);
      container.add([bg, iconText, msgText]);
    } else {
      msgText.setPosition(leftX, 0);
      container.add([bg, msgText]);
    }

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 140,
      ease: 'Cubic.Out'
    });

    return { id, container, w, h, durationMs, hideTimer: null, _dismissed: false };
  }

  _layoutToasts(opts = {}) {
    if (!this.scene) return;
    const animate = !!opts.animate;
    const { x, y: baseY } = this._getAnchor();

    // 底部=最新；从下往上堆叠
    let y = baseY;
    for (let i = this._toasts.length - 1; i >= 0; i--) {
      const t = this._toasts[i];
      if (!t?.container?.active) continue;
      t.container.x = x;
      const targetY = y;
      if (animate && Math.abs((t.container.y || 0) - targetY) > 0.5) {
        this.scene.tweens.add({
          targets: t.container,
          y: targetY,
          duration: 160,
          ease: 'Cubic.Out'
        });
      } else {
        t.container.y = targetY;
      }
      y -= (t.h + this.gap);
    }
  }

  _dismissToast(id) {
    if (!this.scene) return;
    const idx = this._toasts.findIndex(t => t && t.id === id);
    if (idx < 0) return;
    const toast = this._toasts[idx];
    if (!toast || toast._dismissed) return;
    toast._dismissed = true;

    if (toast.hideTimer) {
      try { toast.hideTimer.remove(false); } catch (_) { /* ignore */ }
      toast.hideTimer = null;
    }

    const container = toast.container;
    if (!container || !container.active) {
      this._toasts.splice(idx, 1);
      this._layoutToasts({ animate: true });
      return;
    }

    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 10,
      duration: 240,
      ease: 'Cubic.Out',
      onComplete: () => {
        try { container.destroy(true); } catch (_) { /* ignore */ }
        const k = this._toasts.findIndex(t => t && t.id === id);
        if (k >= 0) this._toasts.splice(k, 1);
        this._layoutToasts({ animate: true });
      }
    });
  }
}
