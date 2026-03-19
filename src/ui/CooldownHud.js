import Phaser from 'phaser';

function buildSectorPoints(radius, startAngle, endAngle, steps = 40) {
  const points = [new Phaser.Geom.Point(0, 0)];
  const span = endAngle - startAngle;
  const count = Math.max(2, Math.ceil(Math.abs(span) / (Math.PI / 20)));
  const total = Math.max(count, steps);

  for (let i = 0; i <= total; i += 1) {
    const t = i / total;
    const a = startAngle + span * t;
    points.push(new Phaser.Geom.Point(Math.cos(a) * radius, Math.sin(a) * radius));
  }

  return points;
}

export default class CooldownHud {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.depth = opts.depth ?? 2450;
    this.slotSize = opts.slotSize ?? 74;
    this.gap = opts.gap ?? 14;
    this.leftPadding = opts.leftPadding ?? 18;
    this.rightPadding = opts.rightPadding ?? 18;
    this.bottomPadding = opts.bottomPadding ?? 8;
    this.labelGap = opts.labelGap ?? 8;
    this.rowGap = opts.rowGap ?? 22;

    this.order = [];
    this.slots = new Map();
    this.activeTooltip = null;
    this.tooltipPointerId = null;

    if (this.scene.input) {
      this._onPointerDown = (pointer) => {
        const slot = this.getSlotAtPoint(pointer?.x, pointer?.y);
        if (!slot) return;
        this.tooltipPointerId = pointer?.id ?? null;
        this._showTooltip(slot);
      };
      this._onPointerMove = (pointer) => {
        if (this.tooltipPointerId == null) return;
        if ((pointer?.id ?? null) !== this.tooltipPointerId) return;
        const slot = this.getSlotAtPoint(pointer?.x, pointer?.y);
        if (!slot) {
          this._hideTooltip();
          this.tooltipPointerId = null;
        }
      };
      this._onPointerUp = (pointer) => {
        if (this.tooltipPointerId == null) return;
        if ((pointer?.id ?? null) !== this.tooltipPointerId) return;
        this._hideTooltip();
        this.tooltipPointerId = null;
      };

      this.scene.input.on('pointerdown', this._onPointerDown);
      this.scene.input.on('pointermove', this._onPointerMove);
      this.scene.input.on('pointerup', this._onPointerUp);
      this.scene.input.on('pointerupoutside', this._onPointerUp);
    }

    this.scene.events.once('shutdown', () => this.destroy());
    this.scene.events.once('destroy', () => this.destroy());
  }

  destroy() {
    if (this.scene?.input) {
      try { this.scene.input.off('pointerdown', this._onPointerDown); } catch (_) { /* ignore */ }
      try { this.scene.input.off('pointermove', this._onPointerMove); } catch (_) { /* ignore */ }
      try { this.scene.input.off('pointerup', this._onPointerUp); } catch (_) { /* ignore */ }
      try { this.scene.input.off('pointerupoutside', this._onPointerUp); } catch (_) { /* ignore */ }
    }
    this.order.forEach((id) => {
      const slot = this.slots.get(id);
      if (!slot) return;
      try { slot.container?.destroy?.(true); } catch (_) { /* ignore */ }
    });
    this._hideTooltip();
    this.tooltipPointerId = null;
    this.order = [];
    this.slots.clear();
    this.scene = null;
  }

  registerSlot(config = {}) {
    if (!this.scene) return null;

    const id = String(config.id || '').trim();
    if (!id) return null;

    const existing = this.slots.get(id);
    const state = existing || this._createSlotState(config);

    state.label = String(config.label || state.label || id);
    state.description = String(config.description || state.description || '');
    state.iconText = String(config.iconText || state.iconText || '✦');
    state.cooldownMs = Math.max(0, Number(config.cooldownMs ?? state.cooldownMs ?? 0));
    state.accentColor = Number.isFinite(Number(config.accentColor))
      ? Number(config.accentColor)
      : (state.accentColor || 0x7dd3fc);
    state.visible = config.visible !== false;

    if (!existing) {
      this.slots.set(id, state);
      this.order.push(id);
      state.container = this._createSlotVisual(state);
    }

    this._applyStaticVisuals(state);
    this.layout();
    this.syncSlot(id, {
      startMs: state.startMs,
      endMs: state.endMs,
      cooldownMs: state.cooldownMs
    });
    return state;
  }

  syncSlot(id, patch = {}) {
    const slot = this.slots.get(id);
    if (!slot) return;

    if (patch.label != null) slot.label = String(patch.label || slot.label || id);
    if (patch.description != null) slot.description = String(patch.description || '');
    if (patch.iconText != null) slot.iconText = String(patch.iconText || '');
    if (patch.cooldownMs != null) slot.cooldownMs = Math.max(0, Number(patch.cooldownMs || 0));
    if (patch.startMs != null) slot.startMs = Math.max(0, Number(patch.startMs || 0));
    if (patch.endMs != null) slot.endMs = Math.max(0, Number(patch.endMs || 0));
    if (patch.visible != null) slot.visible = !!patch.visible;
    if (patch.accentColor != null && Number.isFinite(Number(patch.accentColor))) {
      slot.accentColor = Number(patch.accentColor);
      this._applyStaticVisuals(slot);
    }

    this._renderSlot(slot, Number(this.scene?._gameplayNowMs || 0));
  }

  update(nowMs) {
    if (!this.scene) return;
    const now = Number.isFinite(nowMs) ? nowMs : Number(this.scene?._gameplayNowMs || 0);

    this.order.forEach((id) => {
      const slot = this.slots.get(id);
      if (!slot || !slot.visible) return;

      const wasCoolingDown = slot.isCoolingDown;
      const isCoolingDown = slot.endMs > now;
      slot.isCoolingDown = isCoolingDown;
      this._renderSlot(slot, now);

      if (wasCoolingDown && !isCoolingDown) {
        this._playReadyEffect(slot);
      }
    });
  }

  layout() {
    if (!this.scene) return;
    const cam = this.scene.cameras?.main;
    if (!cam) return;

    const visibleIds = this.order.filter((id) => this.slots.get(id)?.visible !== false);
    const count = visibleIds.length;
    if (!count) return;

    const leftLimit = this.leftPadding + this.slotSize * 0.5;
    const rightLimit = cam.width - this.rightPadding - this.slotSize * 0.5;
    const availableWidth = Math.max(this.slotSize, rightLimit - leftLimit);
    const minGap = Math.max(4, this.gap);
    const columns = Math.max(1, Math.floor((availableWidth + minGap) / (this.slotSize + minGap)));
    const rowPitch = this.slotSize + this.labelGap + this.rowGap;

    const squareCenterY = cam.height - this.bottomPadding - 18 - this.slotSize * 0.5;

    this.order.forEach((id) => {
      const slot = this.slots.get(id);
      if (!slot?.container) return;
      if (!slot.visible) {
        slot.container.setVisible(false);
      }
    });

    visibleIds.forEach((id, index) => {
      const slot = this.slots.get(id);
      if (!slot?.container) return;

      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = leftLimit + col * (this.slotSize + minGap);
      const y = squareCenterY - row * rowPitch;

      slot.container.setVisible(true);
      slot.container.setPosition(x, y);
    });
  }

  _createSlotState(config) {
    return {
      id: String(config.id || ''),
      label: String(config.label || ''),
      description: String(config.description || ''),
      iconText: String(config.iconText || '✦'),
      cooldownMs: Math.max(0, Number(config.cooldownMs || 0)),
      accentColor: Number.isFinite(Number(config.accentColor)) ? Number(config.accentColor) : 0x7dd3fc,
      startMs: 0,
      endMs: 0,
      isCoolingDown: false,
      visible: config.visible !== false,
      container: null,
      tooltipShown: false
    };
  }

  containsPoint(x, y) {
    return !!this.getSlotAtPoint(x, y);
  }

  getSlotAtPoint(x, y) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

    const half = this.slotSize * 0.5;
    for (const id of this.order) {
      const slot = this.slots.get(id);
      const container = slot?.container;
      if (!slot?.visible || !container?.visible) continue;
      if (px >= (container.x - half) && px <= (container.x + half)
        && py >= (container.y - half) && py <= (container.y + half)) {
        return slot;
      }
    }
    return null;
  }

  _createSlotVisual(state) {
    const size = this.slotSize;
    const half = size * 0.5;
    const container = this.scene.add.container(0, 0);
    container.setDepth(this.depth);
    container.setScrollFactor(0);

    const frameGlow = this.scene.add.rectangle(0, 0, size + 12, size + 12);
    frameGlow.setStrokeStyle(6, state.accentColor, 0);
    frameGlow.setAlpha(0);

    const frame = this.scene.add.rectangle(0, 0, size, size, 0x000000, 0.12);
    frame.setStrokeStyle(2, 0xe2e8f0, 0.22);

    const iconText = this.scene.add.text(0, -2, state.iconText || '✦', {
      fontSize: '30px',
      color: '#f8fafc',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    const shade = this.scene.add.graphics();

    const pointer = this.scene.add.graphics();
    const pointerMaskGraphics = this.scene.add.graphics();
    pointerMaskGraphics.setAlpha(0.01);
    pointerMaskGraphics.fillStyle(0xffffff, 1);
    pointerMaskGraphics.fillRect(-half, -half, size, size);
    pointer.setMask(pointerMaskGraphics.createGeometryMask());

    const secondsText = this.scene.add.text(0, 0, '', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5);

    const labelText = this.scene.add.text(0, half + this.labelGap, state.label || '', {
      fontSize: '14px',
      color: '#dbeafe',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5, 0);

    container.add([
      pointerMaskGraphics,
      frameGlow,
      frame,
      iconText,
      shade,
      pointer,
      secondsText,
      labelText
    ]);

    container.setSize(size, size);
    container.setData('isUI', true);

    state.frameGlow = frameGlow;
    state.frame = frame;
    state.iconTextNode = iconText;
    state.shade = shade;
    state.pointer = pointer;
    state.pointerMaskGraphics = pointerMaskGraphics;
    state.secondsText = secondsText;
    state.labelText = labelText;

    return container;
  }

  _applyStaticVisuals(slot) {
    if (!slot) return;
    slot.frame?.setStrokeStyle?.(2, 0xe2e8f0, 0.22);
    slot.labelText?.setText?.(slot.label || '');
    slot.iconTextNode?.setText?.(slot.iconText || '✦');
  }

  _renderSlot(slot, now) {
    const remaining = Math.max(0, Number(slot.endMs || 0) - now);
    const cooling = remaining > 0 && slot.endMs > slot.startMs;
    const progress = cooling
      ? Phaser.Math.Clamp((now - slot.startMs) / Math.max(1, slot.endMs - slot.startMs), 0, 1)
      : 1;

    slot.isCoolingDown = cooling;
    slot.secondsText.setVisible(cooling);

    if (cooling) {
      const remainingSeconds = Math.max(1, Math.ceil(remaining / 1000));
      slot.secondsText.setText(String(remainingSeconds));
      this._drawCooldownShade(slot.shade, progress);
      this._drawPointer(slot.pointer, progress, slot.accentColor);
      slot.shade.setVisible(true);
      slot.frame.setStrokeStyle(2, 0xe2e8f0, 0.14);
      slot.iconTextNode.setAlpha(0.82);
    } else {
      slot.shade.clear();
      slot.shade.setVisible(false);
      slot.pointer.clear();
      slot.frame.setStrokeStyle(2, 0xe2e8f0, 0.22);
      slot.iconTextNode.setAlpha(1);
      if (slot.endMs > 0) slot.secondsText.setText('');
    }
  }

  _drawCooldownShade(shade, progress) {
    shade.clear();
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    if (clamped <= 0) {
      shade.setVisible(true);
      shade.fillStyle(0x020817, 0.66);
      shade.fillRect(-this.slotSize * 0.5, -this.slotSize * 0.5, this.slotSize, this.slotSize);
      return;
    }
    if (clamped >= 1) {
      shade.setVisible(false);
      return;
    }

    const radius = this.slotSize * 0.47;
    const start = -Math.PI / 2 + Phaser.Math.PI2 * clamped;
    const end = -Math.PI / 2 + Phaser.Math.PI2;
    const points = buildSectorPoints(radius, start, end, 52);

    shade.fillStyle(0x020817, 0.66);
    shade.fillPoints(points, true, true);
  }

  _drawPointer(graphics, progress, color) {
    graphics.clear();
    const angle = -Math.PI / 2 + Phaser.Math.PI2 * progress;
    const end = this._getSquareRayIntersection(angle);

    graphics.lineStyle(5, color, 0.42);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(end.x, end.y);
    graphics.strokePath();

    graphics.lineStyle(2.6, 0xffffff, 0.98);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(end.x, end.y);
    graphics.strokePath();

    graphics.fillStyle(0xffffff, 0.96);
    graphics.fillCircle(0, 0, 2.6);
  }

  _getSquareRayIntersection(angle) {
    const half = this.slotSize * 0.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const denom = Math.max(Math.abs(cos), Math.abs(sin), 0.0001);
    const scale = half / denom;
    return {
      x: cos * scale,
      y: sin * scale
    };
  }

  _playReadyEffect(slot) {
    if (!this.scene || !slot?.container?.active) return;

    try { slot._glowTween?.stop?.(); } catch (_) { /* ignore */ }
    try { slot._pulseTween?.stop?.(); } catch (_) { /* ignore */ }

    slot.frameGlow.setStrokeStyle(7, slot.accentColor, 0.82);
    slot.frameGlow.setAlpha(0.96);

    slot._glowTween = this.scene.tweens.add({
      targets: slot.frameGlow,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.Out'
    });

    slot._pulseTween = this.scene.tweens.add({
      targets: slot.container,
      scaleX: 1.1,
      scaleY: 1.1,
      yoyo: true,
      duration: 160,
      repeat: 1,
      ease: 'Back.Out',
      onComplete: () => {
        if (slot.container?.active) slot.container.setScale(1);
      }
    });

    const originX = slot.container.x;
    const originY = slot.container.y;
    for (let i = 0; i < 14; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
      const distance = Phaser.Math.Between(30, 56);
      const particle = this.scene.add.circle(originX, originY, Phaser.Math.Between(2, 4), slot.accentColor, 0.95);
      particle.setScrollFactor(0);
      particle.setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: particle,
        x: originX + Math.cos(angle) * distance,
        y: originY + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(360, 520),
        ease: 'Cubic.Out',
        onComplete: () => particle.destroy()
      });
    }
  }

  _showTooltip(slot) {
    if (!this.scene || !slot?.container?.active) return;
    this._hideTooltip();

    const cam = this.scene.cameras.main;
    const text = String(slot.description || slot.label || '').trim();
    if (!text) return;

    const bottomY = cam.height - Math.max(52, this.bottomPadding + this.slotSize + 44);
    const container = this.scene.add.container(cam.centerX, bottomY);
    container.setDepth(this.depth + 8);
    container.setScrollFactor(0);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '15px',
      color: '#f8fafc',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: Math.min(360, Math.floor(cam.width * 0.72)), useAdvancedWrap: true },
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    const width = Math.ceil(label.width + 28);
    const height = Math.ceil(label.height + 18);
    const bg = this.scene.add.rectangle(0, 0, width, height, 0x020617, 0.92);
    bg.setStrokeStyle(2, 0xe2e8f0, 0.28);

    container.add([bg, label]);
    container.setAlpha(0);

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      y: container.y - 6,
      duration: 120,
      ease: 'Cubic.Out'
    });

    slot.tooltipShown = true;
    this.activeTooltip = { id: slot.id, container };
  }

  _hideTooltip(id) {
    if (!this.activeTooltip) return;
    if (id && this.activeTooltip.id !== id) return;
    try { this.activeTooltip.container?.destroy?.(true); } catch (_) { /* ignore */ }
    this.activeTooltip = null;
    this.order.forEach((slotId) => {
      const slot = this.slots.get(slotId);
      if (slot) slot.tooltipShown = false;
    });
  }
}