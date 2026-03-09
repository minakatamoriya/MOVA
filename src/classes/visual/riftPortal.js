import Phaser from 'phaser';

const TEX_CORE = 'rift_portal_core_v1';
const TEX_GLOW = 'rift_portal_glow_v1';

export function ensureRiftPortalTextures(scene) {
  if (!scene || !scene.textures) return;
  if (scene.textures.exists(TEX_CORE) && scene.textures.exists(TEX_GLOW)) return;

  // Core: soft radial gradient with transparent edges
  if (!scene.textures.exists(TEX_CORE)) {
    const size = 256;
    const tex = scene.textures.createCanvas(TEX_CORE, size, size);
    const ctx = tex.getContext();
    const cx = size / 2;
    const cy = size / 2;

    ctx.clearRect(0, 0, size, size);

    const grad = ctx.createRadialGradient(cx, cy, size * 0.06, cx, cy, size * 0.49);
    grad.addColorStop(0.00, 'rgba(245, 252, 255, 0.92)');
    grad.addColorStop(0.18, 'rgba(170, 235, 255, 0.80)');
    grad.addColorStop(0.42, 'rgba(110, 175, 255, 0.55)');
    grad.addColorStop(0.70, 'rgba(80, 110, 255, 0.28)');
    grad.addColorStop(1.00, 'rgba(20, 10, 40, 0.00)');

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.42, size * 0.30, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // A subtle inner swirl-ish highlight (kept minimal)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy - 4, size * 0.22, size * 0.14, Math.PI * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180, 245, 255, 1)';
    ctx.fill();

    ctx.restore();
    tex.refresh();
  }

  // Glow: bright rim with blur
  if (!scene.textures.exists(TEX_GLOW)) {
    const size = 256;
    const tex = scene.textures.createCanvas(TEX_GLOW, size, size);
    const ctx = tex.getContext();
    const cx = size / 2;
    const cy = size / 2;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = 'rgba(130, 220, 255, 0.85)';

    // outer rim
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(190, 245, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.43, size * 0.31, 0, 0, Math.PI * 2);
    ctx.stroke();

    // inner rim (adds depth)
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(110, 170, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.36, size * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    tex.refresh();
  }
}

/**
 * Creates a Diablo-3-ish rift portal: elliptical, gradient core + pulsing glow.
 * Returns { root, a, b } where a/b are ellipse radii in pixels.
 */
export function createRiftPortal(scene, x, y, opts = {}) {
  ensureRiftPortalTextures(scene);

  const width = Math.max(32, Math.floor(opts.width || 160));
  const height = Math.max(32, Math.floor(opts.height || 110));
  const depth = Number.isFinite(opts.depth) ? opts.depth : 210;

  const root = scene.add.container(x, y);
  root.setDepth(depth);

  const glow = scene.add.image(0, 0, TEX_GLOW);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.setAlpha(0.55);
  glow.displayWidth = width;
  glow.displayHeight = height;

  const glow2 = scene.add.image(0, 0, TEX_GLOW);
  glow2.setBlendMode(Phaser.BlendModes.ADD);
  glow2.setAlpha(0.25);
  glow2.displayWidth = width * 1.06;
  glow2.displayHeight = height * 1.08;

  const core = scene.add.image(0, 0, TEX_CORE);
  core.setBlendMode(Phaser.BlendModes.SCREEN);
  core.setAlpha(0.80);
  core.displayWidth = width;
  core.displayHeight = height;

  root.add([glow2, glow, core]);

  const label = (opts.label != null) ? String(opts.label) : '';
  let labelText = null;
  if (label) {
    labelText = scene.add.text(0, -height * 0.62 - 6, label, {
      fontSize: (opts.labelFontSize || '18px'),
      color: (opts.labelColor || '#ffffff'),
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    root.add(labelText);
  }

  // Pulsing glow
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.35, to: 0.95 },
    duration: 820,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  scene.tweens.add({
    targets: glow2,
    alpha: { from: 0.10, to: 0.45 },
    scale: { from: 1.0, to: 1.05 },
    duration: 1180,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  scene.tweens.add({
    targets: core,
    alpha: { from: 0.65, to: 0.90 },
    duration: 980,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // A very subtle wobble (kept tiny; reads as energy)
  scene.tweens.add({
    targets: root,
    angle: { from: -1.2, to: 1.2 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  const a = width * 0.5;
  const b = height * 0.5;

  return { root, labelText, a, b };
}

export function getDefaultRiftTouchPadPx(cellSize) {
  const cell = Number(cellSize) || 128;
  return Phaser.Math.Clamp(Math.floor(cell * 0.08), 6, 16);
}
