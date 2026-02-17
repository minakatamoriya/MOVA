import Phaser from 'phaser';

export default class SystemMessageOverlay {
  constructor(scene, opts = {}) {
    this.scene = scene;

    this.depth = opts.depth ?? 2000;
    // 默认放到屏幕最下方居中（默认与 Toast 的锚点保持一致）
    this.anchorY = opts.anchorY ?? 0.92;
    // 作为“贴底”时的底部 margin（与 ToastOverlay 的 margin 含义一致）
    this.marginBottomPx = opts.marginBottomPx ?? 16;
    this.marginTopPx = opts.marginTopPx ?? 28;

    this._current = null;
    this._hideTimer = null;
    this._progressTween = null;
    this._fadeTween = null;

    // 兜底：场景退出时销毁
    this.scene.events.once('shutdown', () => this.destroy());
    this.scene.events.once('destroy', () => this.destroy());
  }

  destroy() {
    this._clearTimersAndTweens();
    this._destroyCurrent();
    this.scene = null;
  }

  _clearTimersAndTweens() {
    if (this._hideTimer) {
      this._hideTimer.remove(false);
      this._hideTimer = null;
    }
    if (this._progressTween) {
      this._progressTween.stop();
      this._progressTween = null;
    }
    if (this._fadeTween) {
      this._fadeTween.stop();
      this._fadeTween = null;
    }
  }

  _destroyCurrent() {
    if (!this._current) return;
    try { this._current.container?.destroy?.(true); } catch (_) { /* ignore */ }
    this._current = null;
  }

  isShowing(key) {
    return !!this._current && (!key || this._current.key === key);
  }

  hide(key, opts = {}) {
    if (!this._current) return;
    if (key && this._current.key && this._current.key !== key) return;

    const immediate = !!opts.immediate;
    const onDismiss = this._current?.onDismiss;

    this._clearTimersAndTweens();

    const container = this._current.container;
    const finalize = () => {
      const dismissedKey = this._current?.key;
      this._destroyCurrent();
      try { onDismiss?.({ key: dismissedKey }); } catch (_) { /* ignore */ }
      if (this.scene?.events) {
        this.scene.events.emit('systemMessage:dismissed', { key: dismissedKey });
      }
    };

    if (!container || immediate) {
      finalize();
      return;
    }

    // 渐隐 + 轻微下沉（底部提示更自然）
    this._fadeTween = this.scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y + 10,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: finalize
    });
  }

  show(text, opts = {}) {
    if (!this.scene) return;

    const key = opts.key ?? null;
    const durationMs = (opts.durationMs === 0 || opts.durationMs == null) ? null : Math.max(0, opts.durationMs);
    const sticky = !!opts.sticky || durationMs == null;
    const onDismiss = typeof opts.onDismiss === 'function' ? opts.onDismiss : null;

    // 新提示出现时，旧提示立即消失（避免堆叠遮挡）
    if (this._current) {
      this.hide(null, { immediate: true });
    }

    const cam = this.scene.cameras.main;
    const x = cam.centerX;
    const hasAnchorY = Number.isFinite(Number(opts.anchorY));
    const hasInstanceAnchorY = Number.isFinite(Number(this.anchorY));
    const bottomHudH = this.scene.bottomPanelHeight || 0;

    // 默认：使用实例 anchorY；如显式传入 opts.anchorY，则优先使用 opts.anchorY。
    // 如实例未提供 anchorY，则退回到“贴底”逻辑（与 ToastOverlay 的锚点一致）。
    let y;
    if (hasAnchorY) {
      const anchorY = Number(opts.anchorY);
      y = Math.floor(cam.height * anchorY);
    } else if (hasInstanceAnchorY) {
      y = Math.floor(cam.height * Number(this.anchorY));
    } else {
      // ToastOverlay._getAnchor(): y = cam.height - margin - bottomHudH - 22
      y = Math.floor(cam.height - this.marginBottomPx - bottomHudH - 22);
    }

    // 强制留出上下边距，避免贴边/被遮挡
    y = Phaser.Math.Clamp(y, this.marginTopPx, cam.height - Math.max(8, this.marginBottomPx));

    const maxW = Math.floor(cam.width * 0.86);
    const padX = 18;
    const padY = 14;

    const ringR = 12;
    const ringLine = 3;
    const ringGap = 10;
    const clockLeftGutter = 10; // 让时钟离左侧更远一点

    const container = this.scene.add.container(x, y);
    container.setScrollFactor(0);
    container.setDepth(this.depth);
    container.setAlpha(0);

    // 文字（自动换行）
    const txt = this.scene.add.text(0, 0, String(text ?? ''), {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: '600',
      align: 'center',
      wordWrap: { width: Math.max(120, maxW - padX * 2), useAdvancedWrap: true },
      lineSpacing: 4
    }).setOrigin(0.5);

    // 避免字体上沿看起来被“吃掉”（Phaser Text 的测量偏紧时更明显）
    try { txt.setPadding(0, 4, 0, 4); } catch (_) { /* ignore */ }

    // 轻微阴影：提升可读性（无外边框）
    try { txt.setShadow(0, 2, 'rgba(0,0,0,0.55)', 3, false, true); } catch (_) { /* ignore */ }

    // 计算尺寸
    const showClock = !sticky;
    const contentW = showClock
      ? (clockLeftGutter + (ringR * 2) + ringGap + txt.width)
      : txt.width;
    const w = Math.min(maxW, Math.max(220, Math.ceil(contentW + padX * 2)));
    const h = Math.max(46, Math.ceil(txt.height + padY * 2));

    // 背景（圆角；轻薄；无外边框）
    const bg = this.scene.add.graphics();
    const drawBg = () => {
      bg.clear();
      bg.fillStyle(0x070712, 0.62);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    drawBg();

    // 倒计时“时钟转圈”（非 sticky 才显示）
    const clock = this.scene.add.graphics();
    let clockX = 0;
    const clockY = 0;

    const renderClock = (elapsed01) => {
      if (!showClock) {
        clock.setVisible(false);
        return;
      }

      const clamped = Phaser.Math.Clamp(Number(elapsed01) || 0, 0, 1);
      const remain = 1 - clamped;
      const start = Phaser.Math.DegToRad(-90);
      // 避免 0/1 的“全圆”渲染边界问题
      const sweep = Phaser.Math.DegToRad(360 * Phaser.Math.Clamp(remain, 0.001, 0.999));

      clock.clear();

      // 底圈
      clock.lineStyle(ringLine, 0xffffff, 0.16);
      clock.strokeCircle(clockX, clockY, ringR);

      // 进度弧（剩余时间）
      clock.lineStyle(ringLine, 0xffffff, 0.82);
      clock.beginPath();
      clock.arc(clockX, clockY, ringR, start, start + sweep, false);
      clock.strokePath();
    };
    renderClock(0);

    // 布局：整体居中；文字视觉垂直居中；时钟离左侧更远
    // 注意：Phaser Text 的测量会让视觉中心略偏上，这里做轻微下移补偿。
    const textShiftY = 2;
    if (showClock) {
      const left = -Math.floor(contentW / 2);
      clockX = left + clockLeftGutter + ringR;
      const txtX = left + clockLeftGutter + (ringR * 2) + ringGap + Math.floor(txt.width / 2);
      txt.setPosition(txtX, textShiftY);
      renderClock(0);
    } else {
      txt.setPosition(0, textShiftY);
    }

    container.add([bg, clock, txt]);

    // 入场动画（从底部轻微上浮）
    container.y = y + 8;
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      y,
      duration: 180,
      ease: 'Cubic.Out'
    });

    this._current = { key, container, onDismiss };

    if (this.scene?.events) {
      this.scene.events.emit('systemMessage:shown', { key, text: String(text ?? '') });
    }

    // sticky：不自动消失，也不显示倒计时
    if (sticky) {
      clock.setVisible(false);
      return;
    }

    // 自动消失 + 时钟转圈
    const state = { p: 0 };
    this._progressTween = this.scene.tweens.add({
      targets: state,
      p: 1,
      duration: durationMs,
      ease: 'Linear',
      onUpdate: () => renderClock(state.p),
      onComplete: () => {
        renderClock(1);
        // 时钟走完后，文字渐隐消失
        this.hide(key);
      }
    });
  }
}
