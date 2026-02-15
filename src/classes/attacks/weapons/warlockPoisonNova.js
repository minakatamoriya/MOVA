import Phaser from 'phaser';
import { getBasicSkillColorScheme, lerpColor } from '../../visual/basicSkillColors';

// 术士基础技能：剧毒新星（毒圈）
// - 每 2 秒在玩家脚下留下 1 个毒圈，并在原地逐渐扩张
// - 玩家移动时毒圈会留在身后形成“地面控制”
// - 毒圈本质是“静止玩家子弹”，靠 hitCooldownMs 做每秒跳伤

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

export function fireWarlockPoisonNova(player) {
  if (!player?.scene?.bulletManager) return;
  const scene = player.scene;

  // 兜底：毒圈体系依赖 GameScene.updateWarlockDebuff 驱动。
  // 起始房间/核心选择流程若未正确打开 warlockEnabled，会导致“有毒圈但无 DOT/无层数显示”。
  if (scene) {
    scene.warlockEnabled = true;
    scene.warlockDebuffEnabled = false;
  }

  // 基础数值（0级）
  const baseIntervalMs = 2000;
  const baseRadiusPx = 96; // “2 格”的像素近似（后续可统一成 tileSize）
  // 持续略长一点，符合“走位引导”而不是瞬发 AOE
  const baseDurationMs = 7500;
  // 注意：Boss 的毒伤由 GameScene.updateWarlockDebuff 按“叠层”结算；
  // 这里的 damage 主要用于小怪接触跳伤/调试显示。
  // 使默认 bulletDamage=34 时单跳≈10（更贴近 1 层 10 的手感）。
  const baseDamagePctPerSec = 0.30;

  // 天赋加成（P1池）
  const radiusMult = 1 + 0.2 * Math.max(0, player.warlockPoisonSpreadStacks || 0);
  const durationMs = baseDurationMs + 1000 * Math.max(0, player.warlockPoisonCorrodeStacks || 0);
  const damageMult = 1 + 0.15 * Math.max(0, player.warlockPoisonDiseaseStacks || 0);

  // 频率：跟随 fireRate（冷却/攻速天赋会加快节奏）
  const now = scene.time?.now ?? 0;
  const intervalMs = Math.max(250, Math.round(player.fireRate || baseIntervalMs));
  if (player._warlockPoisonNovaLastAt && now - player._warlockPoisonNovaLastAt < intervalMs - 10) {
    return;
  }
  player._warlockPoisonNovaLastAt = now;

  const spawn = clampToWorldBounds(scene, player.x, player.y, 72);

  const scheme = getBasicSkillColorScheme('warlock', player.offCoreKey);
  const core = scheme.coreColor;
  const bright = scheme.coreBright;
  const stroke = lerpColor(core, 0x000000, 0.25);

  const radiusFinal = Math.round(baseRadiusPx * radiusMult);
  const radiusStart = Math.max(26, Math.round(radiusFinal * 0.35));
  const tickDamage = Math.max(1, Math.round((player.bulletDamage || 1) * baseDamagePctPerSec * damageMult));

  const bullet = scene.bulletManager.createPlayerBullet(
    spawn.x,
    spawn.y,
    core,
    {
      radius: radiusStart,
      speed: player.warlockPoisonAutoSeek ? 58 : 0,
      damage: tickDamage,
      angleOffset: 0,
      isAbsoluteAngle: true,
      hasGlow: true,
      glowRadius: radiusStart + 18,
      glowColor: core,
      hasTrail: false,
      strokeColor: stroke,
      trailColor: bright,
      homing: Boolean(player.warlockPoisonAutoSeek),
      homingTurn: player.warlockPoisonAutoSeek ? 0.035 : 0.04,
      explode: false,
      skipUpdate: false
    }
  );

  if (!bullet) return;

  // 渲染层级：毒圈在敌人/子弹视觉下方，不遮挡
  bullet.setDepth?.(-2);
  if (bullet.glow) {
    bullet.glow.setDepth?.((bullet.depth ?? -2) - 1);
  }

  // 视觉：半透明毒圈 + 外圈描边（邪能绿）
  if (bullet.setFillStyle) bullet.setFillStyle(core, 0.07);
  if (bullet.setStrokeStyle) bullet.setStrokeStyle(3, bright, 0.65);
  bullet.setBlendMode?.(Phaser.BlendModes.ADD);

  // 扩张：从小圈扩到目标半径（同时更新碰撞半径）
  scene.tweens?.addCounter({
    from: radiusStart,
    to: radiusFinal,
    duration: 720,
    ease: 'Sine.Out',
    onUpdate: (tw) => {
      if (!bullet?.active || bullet.markedForRemoval) return;
      const r = Math.round(tw.getValue());
      if (bullet.setRadius) bullet.setRadius(r);
      bullet.radius = r;
      if (bullet.glow?.setRadius) bullet.glow.setRadius(r + 18);
    }
  });

  // 逻辑：按秒跳伤；可叠加（上限由碰撞处逻辑控制）
  bullet.isPoisonZone = true;
  bullet.hitCooldownMs = 1000;
  bullet.maxLifeMs = durationMs;
  bullet.noCrit = false;
  bullet.hitEffectType = 'poison_zone';

  // 高级专精：索敌（给一个初始朝向，避免第一帧角度为 0）
  if (player.warlockPoisonAutoSeek) {
    const boss = scene?.bossManager?.getCurrentBoss?.();
    if (boss && boss.isAlive) {
      bullet.angleOffset = Phaser.Math.Angle.Between(bullet.x, bullet.y, boss.x, boss.y);
    } else {
      bullet.angleOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
    }
  }

  // 允许天赋在碰撞层识别
  bullet._poisonZoneOwnerId = 'warlock_poison_nova';

  // 向后兼容：记录到 player.bullets
  player.bullets.push(bullet);
}
