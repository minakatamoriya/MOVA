import Phaser from 'phaser';
import { getCoinMagnetConfig } from '../../../data/currencyConfig';
import { showDamageNumber } from '../utils/combatFeedback';

function buildCoinChunks(totalAmount, isElite) {
  const total = Math.max(0, Math.round(Number(totalAmount || 0)));
  if (total <= 0) return [];

  const targetChunkValue = isElite ? 20 : 8;
  const maxChunks = isElite ? 4 : 3;
  const chunkCount = Math.max(1, Math.min(maxChunks, Math.ceil(total / targetChunkValue)));
  const chunks = [];
  let remaining = total;

  for (let index = 0; index < chunkCount; index += 1) {
    const slotsLeft = chunkCount - index;
    const amount = index === chunkCount - 1
      ? remaining
      : Math.max(1, Math.round(remaining / slotsLeft));
    chunks.push(amount);
    remaining -= amount;
  }

  return chunks;
}

function createCoinSprite(scene, x, y, amount, variant) {
  if (variant === 'coin_bag') {
    const glow = scene.add.circle(0, 8, 20, 0xffb84d, 0.16);
    const body = scene.add.ellipse(0, 2, 28, 32, 0x7a4a1b, 0.98);
    body.setStrokeStyle(2, 0xf3cd7b, 0.95);
    const tie = scene.add.rectangle(0, -8, 14, 6, 0xf7df98, 0.96);
    const mark = scene.add.text(0, 5, '¥', {
      fontSize: '14px',
      color: '#fff2b3',
      fontStyle: 'bold',
      stroke: '#4a2a00',
      strokeThickness: 3,
    }).setOrigin(0.5);
    const bag = scene.add.container(x, y, [glow, body, tie, mark]);
    bag.setDepth(42);
    return bag;
  }

  const glow = scene.add.circle(0, 0, 14, 0xffd766, 0.16);
  const outer = scene.add.circle(0, 0, 9, 0xffd54f, 1);
  outer.setStrokeStyle(2, 0xfff8d6, 0.9);
  const inner = scene.add.circle(0, 0, 5, 0xfff2a8, 0.92);
  const mark = scene.add.text(0, 0, 'G', {
    fontSize: '10px',
    color: '#7a4a00',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const coin = scene.add.container(x, y, [glow, outer, inner, mark]);
  coin.setDepth(42);
  return coin;
}

function showCoinCollectFx(scene, x, y, amount, variant) {
  const ringColor = variant === 'coin_bag' ? 0xffb84d : 0xffd766;
  const ring = scene.add.circle(x, y, variant === 'coin_bag' ? 18 : 12, ringColor, 0.18).setDepth(46);
  ring.setStrokeStyle(variant === 'coin_bag' ? 4 : 3, 0xfff2b3, 0.92);
  scene.tweens.add({
    targets: ring,
    scaleX: 1.8,
    scaleY: 1.8,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });

  showDamageNumber(scene, x, y - 10, `+${Math.max(0, Math.round(Number(amount || 0)))}`, {
    color: '#ffe7a8',
    fontSize: variant === 'coin_bag' ? 22 : 18,
    whisper: true,
  });
}

export function spawnCoinBurst(scene, x, y, totalAmount, options = {}) {
  const chunks = buildCoinChunks(totalAmount, options.isElite);
  if (!chunks.length) return;
  if (!Array.isArray(scene.coinDrops)) {
    scene.coinDrops = [];
  }

  chunks.forEach((amount, index) => {
    const variant = amount >= 20 ? 'coin_bag' : 'coin';
    const sprite = createCoinSprite(scene, x, y, amount, variant);
    const angle = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1) + ((index - (chunks.length - 1) * 0.5) * 0.18);
    const speed = variant === 'coin_bag' ? Phaser.Math.Between(90, 130) : Phaser.Math.Between(110, 170);

    sprite.setScale(0.7);
    scene.tweens.add({
      targets: sprite,
      scale: 1,
      duration: 180,
      ease: 'Back.Out',
    });

    scene.coinDrops.push({
      type: variant,
      amount,
      sprite,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      spawnX: x,
      spawnY: y,
      maxDrift: variant === 'coin_bag' ? 118 : 92,
    });
  });
}

export function updateCoinDrops(scene, delta) {
  if (!scene.player || !Array.isArray(scene.coinDrops) || scene.coinDrops.length === 0) return;

  const dt = Math.max(0, Number(delta || 0)) / 1000;
  const magnetConfig = getCoinMagnetConfig(0);
  const attractRadiusSq = magnetConfig.attractRadius * magnetConfig.attractRadius;
  const collectRadiusSq = magnetConfig.collectRadius * magnetConfig.collectRadius;
  const minX = 14;
  const maxX = scene.scale.width - 14;
  const minY = scene.topPanelHeight ? scene.topPanelHeight + 8 : 8;
  const maxY = scene.scale.height - 14;

  for (let index = scene.coinDrops.length - 1; index >= 0; index -= 1) {
    const drop = scene.coinDrops[index];
    if (!drop?.sprite?.active) {
      scene.coinDrops.splice(index, 1);
      continue;
    }

    drop.velocity.x *= Math.pow(0.9, Math.max(1, dt * 60));
    drop.velocity.y *= Math.pow(0.9, Math.max(1, dt * 60));
    drop.sprite.x += drop.velocity.x * dt;
    drop.sprite.y += drop.velocity.y * dt;

    const driftX = drop.sprite.x - drop.spawnX;
    const driftY = drop.sprite.y - drop.spawnY;
    const drift = Math.sqrt((driftX * driftX) + (driftY * driftY)) || 0;
    if (drift > drop.maxDrift) {
      const ratio = drop.maxDrift / drift;
      drop.sprite.x = drop.spawnX + (driftX * ratio);
      drop.sprite.y = drop.spawnY + (driftY * ratio);
      drop.velocity.x *= 0.4;
      drop.velocity.y *= 0.4;
    }

    drop.sprite.x = Phaser.Math.Clamp(drop.sprite.x, minX, maxX);
    drop.sprite.y = Phaser.Math.Clamp(drop.sprite.y, minY, maxY);

    const dx = drop.sprite.x - scene.player.x;
    const dy = drop.sprite.y - scene.player.y;
    const distSq = (dx * dx) + (dy * dy);

    if (distSq < attractRadiusSq && distSq > collectRadiusSq) {
      const dist = Math.sqrt(distSq) || 1;
      const speed = drop.type === 'coin_bag' ? magnetConfig.bagSpeed : magnetConfig.coinSpeed;
      drop.sprite.x -= (dx / dist) * speed * dt;
      drop.sprite.y -= (dy / dist) * speed * dt;
    }

    if (distSq <= collectRadiusSq) {
      scene.gold += Math.max(0, Math.round(Number(drop.amount || 0)));
      showCoinCollectFx(scene, drop.sprite.x, drop.sprite.y, drop.amount, drop.type);
      drop.sprite.destroy();
      scene.coinDrops.splice(index, 1);
    }
  }
}

export function clearCoinDrops(scene) {
  if (!Array.isArray(scene.coinDrops)) return;
  scene.coinDrops.forEach((drop) => drop?.sprite?.destroy?.());
  scene.coinDrops.length = 0;
}