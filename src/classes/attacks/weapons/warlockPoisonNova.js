import Phaser from 'phaser';
import { lerpColor } from '../../visual/basicSkillColors';

const FEL_CORE = 0x7df56a;
const FEL_BRIGHT = 0xc8ff8a;
const FEL_DARK = 0x2e8f3a;
const FEL_SMOKE = 0x8cff72;

// 术士基础技能：腐疫沼弹
// - 朝最近目标投出一枚缓慢的腐疫弹
// - 腐疫弹在落点生成毒沼，敌人停留其中会持续叠毒
// - 满层时引发一次小范围传染爆裂，强调远程布场而非贴脸起手

function getWorldBounds(scene) {
  const rect = scene?.worldBoundsRect;
  if (rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
    return rect;
  }

  const cfg = scene?.mapConfig;
  if (cfg && Number.isFinite(cfg.gridSize) && Number.isFinite(cfg.cellSize)) {
    const worldSize = cfg.gridSize * cfg.cellSize;
    return new Phaser.Geom.Rectangle(0, 0, worldSize, worldSize);
  }

  const cam = scene?.cameras?.main;
  if (cam?.worldView) {
    return cam.worldView;
  }
  return new Phaser.Geom.Rectangle(0, 0, 800, 600);
}

function clampToWorldBounds(scene, x, y, pad = 72) {
  const b = getWorldBounds(scene);
  const clampedX = Phaser.Math.Clamp(x, b.x + pad, b.x + b.width - pad);
  const clampedY = Phaser.Math.Clamp(y, b.y + pad, b.y + b.height - pad);
  return { x: clampedX, y: clampedY };
}

function getWarlockAcquireRange(player) {
  return Phaser.Math.Clamp(
    Math.round(player?.warlockRange || player?.warlockRangeBase || player?.warlockPoisonNovaRadiusBase || 96),
    80,
    520
  );
}

function getPlayerCastOrigin(player) {
  const hp = player?.getHitboxPosition?.();
  return {
    x: (hp && Number.isFinite(hp.x)) ? hp.x : Number(player?.x || 0),
    y: (hp && Number.isFinite(hp.y)) ? hp.y : Number(player?.y || 0)
  };
}

function spawnWarlockTrailMote(scene, x, y, colors) {
  const mote = scene.add.circle(x, y, Phaser.Math.Between(2, 4), Phaser.Math.RND.pick([colors.bright, colors.smoke, colors.dark]), 0.82);
  mote.setBlendMode(Phaser.BlendModes.ADD);
  mote.setDepth(21);
  scene.tweens.add({
    targets: mote,
    alpha: 0,
    scale: Phaser.Math.FloatBetween(1.4, 2.1),
    x: x + Phaser.Math.Between(-10, 10),
    y: y + Phaser.Math.Between(-10, 10),
    duration: Phaser.Math.Between(170, 260),
    ease: 'Quad.Out',
    onComplete: () => mote.destroy()
  });
}

function spawnWarlockTossVfx(scene, start, end, colors, travelMs, onComplete) {
  const orb = scene.add.circle(start.x, start.y, 10, colors.core, 0.96);
  orb.setStrokeStyle(2, colors.bright, 0.96);
  orb.setBlendMode(Phaser.BlendModes.ADD);
  orb.setDepth(24);

  const halo = scene.add.circle(start.x, start.y, 18, colors.core, 0.22);
  halo.setBlendMode(Phaser.BlendModes.ADD);
  halo.setDepth(23);

  const smoke = scene.add.circle(start.x, start.y, 13, colors.dark, 0.16);
  smoke.setBlendMode(Phaser.BlendModes.SCREEN);
  smoke.setDepth(22);

  const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
  const arcHeight = Phaser.Math.Clamp(distance * 0.18, 26, 82);
  const tracker = { t: 0 };
  let lastTrailAt = 0;

  scene.tweens.add({
    targets: orb,
    scaleX: 1.18,
    scaleY: 0.82,
    yoyo: true,
    repeat: -1,
    duration: 140,
    ease: 'Sine.InOut'
  });

  scene.tweens.add({
    targets: halo,
    scale: 1.2,
    alpha: 0.08,
    yoyo: true,
    repeat: -1,
    duration: 200,
    ease: 'Sine.InOut'
  });

  scene.tweens.add({
    targets: smoke,
    scale: 1.35,
    alpha: 0.05,
    yoyo: true,
    repeat: -1,
    duration: 240,
    ease: 'Sine.InOut'
  });

  scene.tweens.add({
    targets: tracker,
    t: 1,
    duration: travelMs,
    ease: 'Sine.Out',
    onUpdate: () => {
      const t = Phaser.Math.Clamp(tracker.t || 0, 0, 1);
      const x = Phaser.Math.Linear(start.x, end.x, t);
      const y = Phaser.Math.Linear(start.y, end.y, t) - Math.sin(t * Math.PI) * arcHeight;

      if (orb?.active) {
        orb.x = x;
        orb.y = y;
      }
      if (halo?.active) {
        halo.x = x;
        halo.y = y;
      }
      if (smoke?.active) {
        smoke.x = x;
        smoke.y = y;
      }

      const now = scene.time?.now ?? 0;
      if (now - lastTrailAt >= 28) {
        lastTrailAt = now;
        spawnWarlockTrailMote(scene, x, y, colors);
      }
    },
    onComplete: () => {
      if (orb?.active) orb.destroy();
      if (halo?.active) halo.destroy();
      if (smoke?.active) smoke.destroy();
      onComplete?.();
    }
  });
}

function spawnWarlockLandingVfx(scene, x, y, radius) {
  const ripple = scene.add.circle(x, y, Math.max(18, radius * 0.32), FEL_CORE, 0.18);
  ripple.setStrokeStyle(3, FEL_BRIGHT, 0.95);
  ripple.setBlendMode(Phaser.BlendModes.ADD);
  ripple.setDepth(15);

  const stain = scene.add.circle(x, y, Math.max(14, radius * 0.26), FEL_DARK, 0.24);
  stain.setBlendMode(Phaser.BlendModes.SCREEN);
  stain.setDepth(14);

  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + Phaser.Math.FloatBetween(-0.1, 0.1);
    const droplet = scene.add.circle(x, y, Phaser.Math.Between(2, 5), Phaser.Math.RND.pick([FEL_CORE, FEL_BRIGHT, FEL_SMOKE]), 0.9);
    droplet.setBlendMode(Phaser.BlendModes.ADD);
    droplet.setDepth(16);
    scene.tweens.add({
      targets: droplet,
      alpha: 0,
      scale: Phaser.Math.FloatBetween(0.6, 1.8),
      x: x + Math.cos(angle) * Phaser.Math.Between(22, Math.max(30, Math.round(radius * 0.48))),
      y: y + Math.sin(angle) * Phaser.Math.Between(18, Math.max(24, Math.round(radius * 0.42))),
      duration: Phaser.Math.Between(220, 340),
      ease: 'Cubic.Out',
      onComplete: () => droplet.destroy()
    });
  }

  scene.tweens.add({
    targets: ripple,
    alpha: 0,
    scale: 2.4,
    duration: 320,
    ease: 'Cubic.Out',
    onComplete: () => ripple.destroy()
  });

  scene.tweens.add({
    targets: stain,
    alpha: 0,
    scale: 1.65,
    duration: 420,
    ease: 'Quad.Out',
    onComplete: () => stain.destroy()
  });
}

function createWarlockPoisonPool(player, x, y) {
  const scene = player?.scene;
  if (!scene?.createManagedPlayerAreaBullet) return null;

  const stroke = lerpColor(FEL_CORE, 0x000000, 0.25);
  const baseRadiusPx = Math.max(24, Math.round(player.warlockPoisonNovaRadius || player.warlockPoisonNovaRadiusBase || 96));
  const radiusMult = 1 + 0.2 * Math.max(0, player.warlockPoisonSpreadStacks || 0);
  const damageMult = 1 + 0.15 * Math.max(0, player.warlockPoisonDiseaseStacks || 0);
  const corrodeStacks = Math.max(0, player.warlockPoisonCorrodeStacks || 0);
  const netherlordLevel = Phaser.Math.Clamp(Math.round(player.warlockNetherlord || 0), 0, 3);

  const radiusFinal = Math.round(baseRadiusPx * radiusMult * ([1, 1.10, 1.22, 1.36][netherlordLevel] || 1));
  const radiusStart = Math.max(24, Math.round(radiusFinal * 0.38));
  const durationMs = 4000 + corrodeStacks * 3000 + netherlordLevel * 500;
  const tickDamage = Math.max(1, Math.round((player.bulletDamage || 1) * 0.30 * damageMult * ([1, 1.10, 1.24, 1.40][netherlordLevel] || 1)));

  const spawn = clampToWorldBounds(scene, x, y, 48);
  const bullet = scene.createManagedPlayerAreaBullet(
    spawn.x,
    spawn.y,
    FEL_CORE,
    {
      radius: radiusStart,
      damage: tickDamage,
      hasGlow: true,
      glowRadius: radiusStart + 18,
      glowColor: FEL_CORE,
      alpha: 1,
      maxLifeMs: durationMs,
      hitCooldownMs: 1000,
      noCrit: false,
      depth: -2,
      blendMode: Phaser.BlendModes.ADD,
      fillAlpha: 0.1,
      strokeWidth: 3,
      strokeColor: stroke,
      strokeAlpha: 0.78,
      tags: ['player_warlock_blight_pool']
    }
  );

  if (!bullet) return null;

  bullet.setDepth?.(-2);
  if (bullet.glow) bullet.glow.setDepth?.(-3);
  bullet.isPoisonZone = true;
  bullet.hitEffectType = 'poison_zone';
  bullet._poisonZoneOwnerId = 'warlock_blight_pool';
  bullet.netherlordLevel = netherlordLevel;

  scene.tweens?.addCounter({
    from: radiusStart,
    to: radiusFinal,
    duration: 260,
    ease: 'Sine.Out',
    onUpdate: (tw) => {
      if (!bullet?.active || bullet.markedForRemoval) return;
      const r = Math.round(tw.getValue());
      bullet.setRadius?.(r);
      bullet.radius = r;
      bullet.glow?.setRadius?.(r + 18);
    }
  });

  player.bullets.push(bullet);
  while (player.bullets.length > player.maxBullets) {
    player.bullets.shift();
  }

  spawnWarlockLandingVfx(scene, spawn.x, spawn.y, radiusFinal);
  scene.collisionManager?.createHitEffect?.(spawn.x, spawn.y, FEL_BRIGHT);
  return bullet;
}

export function fireWarlockPoisonNova(player) {
  if (!player?.scene?.createManagedPlayerAreaBullet) return false;
  const scene = player.scene;

  if (scene) {
    scene.warlockEnabled = true;
    scene.warlockDebuffEnabled = false;
  }

  const now = scene.time?.now ?? 0;
  const intervalMs = Math.max(1500, Math.round(player.fireRate || 2000));
  if (player._warlockPoisonNovaLastAt && now - player._warlockPoisonNovaLastAt < intervalMs - 10) {
    return false;
  }

  const target = player.getWarlockTargetInRange?.() || null;
  if (!target) return false;

  player._warlockPoisonNovaLastAt = now;

  const origin = getPlayerCastOrigin(player);
  const acquireRange = getWarlockAcquireRange(player);
  const targetAngle = Phaser.Math.Angle.Between(origin.x, origin.y, target.x, target.y);
  const targetDistance = Math.min(acquireRange, Phaser.Math.Distance.Between(origin.x, origin.y, target.x, target.y));
  const landing = clampToWorldBounds(
    scene,
    origin.x + Math.cos(targetAngle) * targetDistance,
    origin.y + Math.sin(targetAngle) * targetDistance,
    48
  );

  const tossSpeed = 420;
  const travelMs = Phaser.Math.Clamp(Math.round((targetDistance / tossSpeed) * 1000), 150, 460);

  spawnWarlockTossVfx(scene, origin, landing, { core: FEL_CORE, bright: FEL_BRIGHT, dark: FEL_DARK, smoke: FEL_SMOKE }, travelMs, () => {
    if (!scene?.sys?.isActive?.()) return;
    createWarlockPoisonPool(player, landing.x, landing.y);
  });

  return true;
}
