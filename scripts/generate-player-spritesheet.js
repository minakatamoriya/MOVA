const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'characters', 'player', 'player_sheet.png');

const FRAME_SIZE = 64;
const FRAMES_PER_DIRECTION = 20;
const DIRECTIONS = ['down', 'up', 'left', 'right'];

const COLORS = {
  skin: '#f5d0b8',
  skinShadow: '#d9a785',
  hair: '#8b5a3c',
  suit: '#9c27b0',
  suitDark: '#7b1fa2',
  suitLight: '#ce93d8',
  boots: '#424242',
  glove: '#757575',
  hit: '#ff5252',
  skill: '#64ffda',
  energy: '#ffd54f'
};

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCharacter(ctx, ox, oy, local, state, lateralShift) {
  const bob = state === 'run' ? (local % 2 === 0 ? 1 : -1) : 0;
  const legSwing = state === 'run' ? (local % 2 === 0 ? 2 : -2) : 0;
  const centerX = ox + FRAME_SIZE / 2 + lateralShift;
  const centerY = oy + FRAME_SIZE / 2 + bob;

  ctx.save();
  ctx.translate(centerX, centerY);

  // Head (circle)
  const headY = -20;
  ctx.fillStyle = COLORS.skin;
  ctx.beginPath();
  ctx.arc(0, headY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = COLORS.hair;
  ctx.beginPath();
  ctx.ellipse(0, headY - 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-6, headY, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, headY, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.arc(-3, headY, 1.5, 0, Math.PI * 2);
  ctx.arc(3, headY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillStyle = COLORS.skin;
  ctx.fillRect(-2, headY + 6, 4, 4);

  // Torso
  const torsoY = headY + 10;
  drawRoundedRect(ctx, -8, torsoY, 16, 14, 4);
  const torsoGradient = ctx.createLinearGradient(0, torsoY, 0, torsoY + 14);
  torsoGradient.addColorStop(0, COLORS.suitLight);
  torsoGradient.addColorStop(0.5, COLORS.suit);
  torsoGradient.addColorStop(1, COLORS.suitDark);
  ctx.fillStyle = torsoGradient;
  ctx.fill();

  // Belt
  ctx.fillStyle = COLORS.energy;
  ctx.fillRect(-8, torsoY + 10, 16, 2);

  // Arms
  const armY = torsoY + 2;
  const armSwing = state === 'attack' ? -4 : 0;
  
  ctx.fillStyle = COLORS.suitDark;
  drawRoundedRect(ctx, -12, armY + armSwing, 3, 12, 1.5);
  ctx.fill();
  drawRoundedRect(ctx, 9, armY - armSwing, 3, 12, 1.5);
  ctx.fill();

  ctx.fillStyle = COLORS.glove;
  ctx.beginPath();
  ctx.arc(-10.5, armY + 12 + armSwing, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10.5, armY + 12 - armSwing, 2, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const legY = torsoY + 14;
  ctx.fillStyle = COLORS.suit;
  drawRoundedRect(ctx, -6, legY, 5, 12 + legSwing, 2);
  ctx.fill();
  drawRoundedRect(ctx, 1, legY, 5, 12 - legSwing, 2);
  ctx.fill();

  // Boots
  ctx.fillStyle = COLORS.boots;
  drawRoundedRect(ctx, -7, legY + 12 + legSwing, 6, 4, 2);
  ctx.fill();
  drawRoundedRect(ctx, 1, legY + 12 - legSwing, 6, 4, 2);
  ctx.fill();

  ctx.restore();
}

function drawThruster(ctx, ox, oy, local, lateralShift) {
  const centerX = ox + FRAME_SIZE / 2 + lateralShift;
  const baseY = oy + FRAME_SIZE / 2 + 20;
  const flicker = local % 2 === 0 ? 0.8 : 1.1;

  ctx.save();
  ctx.translate(centerX, baseY);

  // Boot thrusters
  ctx.fillStyle = COLORS.energy;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(-4, 8, 4 * flicker, 6 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, 8, 4 * flicker, 6 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.suitLight;
  ctx.beginPath();
  ctx.ellipse(-4, 6, 2.5 * flicker, 4 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, 6, 2.5 * flicker, 4 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAttackArc(ctx, ox, oy, lateralShift) {
  const centerX = ox + FRAME_SIZE / 2 + lateralShift;
  const centerY = oy + FRAME_SIZE / 2 - 6;
  ctx.save();
  ctx.strokeStyle = COLORS.energy;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX + 16, centerY, 12, -0.3, 1.1);
  ctx.stroke();
  ctx.restore();
}

function drawSkillRing(ctx, ox, oy) {
  const centerX = ox + FRAME_SIZE / 2;
  const centerY = oy + FRAME_SIZE / 2 + 6;
  ctx.save();
  ctx.strokeStyle = COLORS.skill;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHurtFlash(ctx, ox, oy) {
  ctx.save();
  ctx.strokeStyle = COLORS.hit;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + 18, oy + 16);
  ctx.lineTo(ox + 46, oy + 44);
  ctx.moveTo(ox + 46, oy + 16);
  ctx.lineTo(ox + 18, oy + 44);
  ctx.stroke();
  ctx.restore();
}

function drawFrame(ctx, col, row, frameIndex, direction) {
  const ox = col * FRAME_SIZE;
  const oy = row * FRAME_SIZE;

  const stateIndex = Math.floor(frameIndex / 4);
  const local = frameIndex % 4;
  const state = ['idle', 'run', 'attack', 'skill', 'hurt'][stateIndex] || 'idle';

  const lateralShift = direction === 'left' ? -6 : direction === 'right' ? 6 : 0;

  drawCharacter(ctx, ox, oy, local, state, lateralShift);

  if (state === 'run') {
    drawThruster(ctx, ox, oy, local, lateralShift);
  }

  if (state === 'attack' && local >= 1) {
    drawAttackArc(ctx, ox, oy, lateralShift);
  }

  if (state === 'skill') {
    drawSkillRing(ctx, ox, oy);
  }

  if (state === 'hurt') {
    drawHurtFlash(ctx, ox, oy);
  }
}

function generateSheet() {
  const width = FRAME_SIZE * FRAMES_PER_DIRECTION;
  const height = FRAME_SIZE * DIRECTIONS.length;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, width, height);

  DIRECTIONS.forEach((direction, row) => {
    for (let frameIndex = 0; frameIndex < FRAMES_PER_DIRECTION; frameIndex += 1) {
      drawFrame(ctx, frameIndex, row, frameIndex, direction);
    }
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, canvas.toBuffer('image/png'));
}

generateSheet();
console.log(`Generated spritesheet: ${OUTPUT_PATH}`);
