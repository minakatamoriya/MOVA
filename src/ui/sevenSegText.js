import Phaser from 'phaser';

const DIGIT_SEGMENTS = {
  '0': ['A', 'B', 'C', 'D', 'E', 'F'],
  '1': ['B', 'C'],
  '2': ['A', 'B', 'G', 'E', 'D'],
  '3': ['A', 'B', 'C', 'D', 'G'],
  '4': ['F', 'G', 'B', 'C'],
  '5': ['A', 'F', 'G', 'C', 'D'],
  '6': ['A', 'F', 'E', 'D', 'C', 'G'],
  '7': ['A', 'B', 'C'],
  '8': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  '9': ['A', 'B', 'C', 'D', 'F', 'G']
};

function toFillColor(color) {
  if (typeof color === 'number') return color;
  return Phaser.Display.Color.HexStringToColor(color).color;
}

function drawSegment(graphics, segmentId, x, y, width, height, thickness) {
  const halfH = height / 2;

  // Horizontal segments
  if (segmentId === 'A') graphics.fillRect(x + thickness, y, width - thickness * 2, thickness);
  if (segmentId === 'G') graphics.fillRect(x + thickness, y + halfH - thickness / 2, width - thickness * 2, thickness);
  if (segmentId === 'D') graphics.fillRect(x + thickness, y + height - thickness, width - thickness * 2, thickness);

  // Vertical segments
  const vLen = halfH - thickness;
  if (segmentId === 'F') graphics.fillRect(x, y + thickness, thickness, vLen);
  if (segmentId === 'B') graphics.fillRect(x + width - thickness, y + thickness, thickness, vLen);
  if (segmentId === 'E') graphics.fillRect(x, y + halfH, thickness, vLen);
  if (segmentId === 'C') graphics.fillRect(x + width - thickness, y + halfH, thickness, vLen);
}

function computeTextWidth(text, digitWidth, spacing) {
  let count = 0;
  for (const ch of String(text)) {
    if (ch === ' ') {
      count += 0.6;
      continue;
    }
    if (ch === '.') {
      count += 0.45;
      continue;
    }
    if (ch === '+') {
      count += 0.9;
      continue;
    }
    if (ch === '-') {
      count += 0.9;
      continue;
    }
    count += 1;
  }
  if (count === 0) return 0;
  return count * digitWidth + Math.max(0, Math.ceil(count) - 1) * spacing;
}

function drawSevenSegLine(graphics, text, opts) {
  const {
    color,
    digitWidth,
    digitHeight,
    thickness,
    spacing,
    align
  } = opts;

  graphics.clear();
  graphics.fillStyle(toFillColor(color), 1);

  const str = String(text);
  const totalWidth = computeTextWidth(str, digitWidth, spacing);
  let cursorX = 0;

  if (align === 'center') cursorX = -totalWidth / 2;
  if (align === 'right') cursorX = -totalWidth;

  for (const ch of str) {
    if (ch === ' ') {
      cursorX += digitWidth * 0.6 + spacing;
      continue;
    }

    if (ch === '.') {
      const dotSize = Math.max(2, Math.floor(thickness * 0.9));
      graphics.fillRect(cursorX + digitWidth - dotSize, digitHeight - dotSize, dotSize, dotSize);
      cursorX += digitWidth * 0.45 + spacing;
      continue;
    }

    if (ch === '-') {
      drawSegment(graphics, 'G', cursorX, 0, digitWidth, digitHeight, thickness);
      cursorX += digitWidth * 0.9 + spacing;
      continue;
    }

    if (ch === '+') {
      // plus = middle horizontal + short vertical center
      const centerX = cursorX + digitWidth / 2 - thickness / 2;
      const centerY = digitHeight / 2 - thickness / 2;
      graphics.fillRect(cursorX + thickness, centerY, digitWidth - thickness * 2, thickness);
      graphics.fillRect(centerX, thickness, thickness, digitHeight - thickness * 2);
      cursorX += digitWidth * 0.9 + spacing;
      continue;
    }

    const segments = DIGIT_SEGMENTS[ch];
    if (!segments) {
      // Unknown: just skip width
      cursorX += digitWidth + spacing;
      continue;
    }

    for (const seg of segments) {
      drawSegment(graphics, seg, cursorX, 0, digitWidth, digitHeight, thickness);
    }

    cursorX += digitWidth + spacing;
  }

  return { totalWidth, digitHeight };
}

/**
 * Create a seven-segment "digital" text container.
 * Returns a Phaser Container with 2-3 Graphics layers (glow/main/core).
 */
export function createSevenSegText(scene, x, y, text, options = {}) {
  const {
    color = '#ffff00',
    glowColor = '#fff3a6',
    coreColor = '#ffffff',
    digitWidth = 22,
    digitHeight = 40,
    thickness = 6,
    spacing = 6,
    align = 'center',
    glowAlpha = 0.6,
    coreAlpha = 0.4,
    depth = 999,
    addCore = true
  } = options;

  const container = scene.add.container(x, y);
  container.setDepth(depth);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.setAlpha(glowAlpha);
  drawSevenSegLine(glow, text, {
    color: glowColor,
    digitWidth,
    digitHeight,
    thickness: thickness + 4,
    spacing,
    align
  });

  const main = scene.add.graphics();
  main.setAlpha(1);
  drawSevenSegLine(main, text, {
    color,
    digitWidth,
    digitHeight,
    thickness,
    spacing,
    align
  });

  container.add(glow);
  container.add(main);

  let core = null;
  if (addCore) {
    core = scene.add.graphics();
    core.setBlendMode(Phaser.BlendModes.ADD);
    core.setAlpha(coreAlpha);
    drawSevenSegLine(core, text, {
      color: coreColor,
      digitWidth,
      digitHeight,
      thickness: Math.max(2, thickness - 3),
      spacing,
      align
    });
    container.add(core);
  }

  return { container, glow, main, core };
}
