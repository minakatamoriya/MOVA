import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function fireWarriorWave(player) {
  if (!player?.scene) return;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  // 目标方向（朝 Boss；无 Boss 时朝上）
  const baseX = player.x;
  const baseY = player.y - player.visualRadius - 6;

  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  let target = enemies.length > 0 ? enemies[0] : null;
  if (enemies.length > 1) {
    let bestD = (target.x - baseX) ** 2 + (target.y - baseY) ** 2;
    for (let i = 1; i < enemies.length; i++) {
      const e = enemies[i];
      const d = (e.x - baseX) ** 2 + (e.y - baseY) ** 2;
      if (d < bestD) {
        target = e;
        bestD = d;
      }
    }
  }

  const angle = target && target.isAlive
    ? Phaser.Math.Angle.Between(baseX, baseY, target.x, target.y)
    : -Math.PI / 2;

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  // 左右交替出刀（左 -> 右 -> 左 ...），相对于“发射方向”的垂直方向偏移
  if (player._warriorCrescentSide !== 1 && player._warriorCrescentSide !== -1) {
    player._warriorCrescentSide = 1;
  }
  const nextSide = player._warriorCrescentSide;
  player._warriorCrescentSide *= -1;

  const spawnLateral = 16;
  const perp = angle + Math.PI / 2;
  const spawnX = baseX + Math.cos(perp) * spawnLateral * nextSide;
  const spawnY = baseY + Math.sin(perp) * spawnLateral * nextSide;

  const spawnCrescent = (a, damageMult = 1) => {
    // 月牙波：Graphics 本体作为子弹
    const g = scene.add.graphics({ x: spawnX, y: spawnY });
    g.setDepth(5);
    g.setBlendMode(Phaser.BlendModes.ADD);

    const crescentR = 26;
    const arcSpan = Math.PI * 0.95;
    const start = -arcSpan / 2;
    const end = arcSpan / 2;

    // 外发光（副色边缘/脉络）
    g.lineStyle(14, scheme.accentColor, 0.18);
    g.beginPath();
    g.arc(0, 0, crescentR + 2, start, end, false);
    g.strokePath();

    // 核心（月牙主体，主色更亮）
    g.lineStyle(8, scheme.coreBright, 0.92);
    g.beginPath();
    g.arc(0, 0, crescentR, start, end, false);
    g.strokePath();

    // 内沿勾线（让“波”更利）
    g.lineStyle(2, scheme.glowColor, 0.65);
    g.beginPath();
    g.arc(0, 0, crescentR - 5, start + 0.08, end - 0.08, false);
    g.strokePath();

    g.rotation = a;

    // 子弹参数
    g.damage = Math.max(1, Math.round(player.bulletDamage * 1.05 * damageMult));
    g.speed = 640;
    g.radius = 18;
    g.angleOffset = a;
    g.isAbsoluteAngle = true;
    g.homing = false;
    g.explode = false;
    g.skipUpdate = false;
    g.isPlayerBullet = true;
    g.active = true;
    g.markedForRemoval = false;

    // 短射程（可控，避免无限飞出去）
    g.maxLifeMs = 520;

    // 穿透/多段
    g.pierce = true;
    g.maxHits = 2;
    g.hitCooldownMs = 170;

    // 光晕
    const glow = scene.add.circle(spawnX, spawnY, 24, scheme.glowColor, 0.10);
    glow.setStrokeStyle(2, scheme.accentColor, 0.16);
    glow.depth = -1;
    g.glow = glow;

    // 尾迹（副职业色）
    g.trailTimer = scene.time.addEvent({
      delay: 85,
      repeat: -1,
      callback: () => {
        if (!g.active || g.markedForRemoval) {
          if (g.trailTimer) g.trailTimer.remove();
          g.trailTimer = null;
          return;
        }

        const p = scene.add.circle(
          g.x + Phaser.Math.Between(-3, 3),
          g.y + Phaser.Math.Between(-3, 3),
          2,
          scheme.trailColor,
          0.65
        );
        scene.tweens.add({
          targets: p,
          alpha: 0,
          scale: 0.2,
          duration: 220,
          onComplete: () => p.destroy()
        });
      }
    });

    if (scene.bulletManager?.playerBulletGroup) {
      scene.bulletManager.playerBulletGroup.add(g);
    }

    applyEnhancementsToBullet(g, enh, scheme);
    player.bullets.push(g);
    return g;
  };

  // 蓄力分裂：周期性三连月牙波（保持原“4 次一爆发”的节奏）
  if (enh?.chargeSplit) {
    player._chargeCounter = (player._chargeCounter || 0) + 1;
    if (player._chargeCounter % 4 === 0) {
      const spread = 0.16;
      [angle - spread, angle, angle + spread].forEach((a) => spawnCrescent(a, 0.82));
      return;
    }
  }

  spawnCrescent(angle, 1);
}
