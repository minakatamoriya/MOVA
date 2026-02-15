import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

export function fireArcherArrow(player) {
  if (!player?.scene) return;

  const scene = player.scene;
  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];

  const pickTarget = (x, y) => {
    const enemies = [];
    if (boss && boss.isAlive) enemies.push(boss);
    if (Array.isArray(minions) && minions.length > 0) {
      minions.forEach((m) => {
        if (m && m.isAlive) enemies.push(m);
      });
    }
    if (enemies.length === 0) return null;

    let best = enemies[0];
    let bestD = (best.x - x) ** 2 + (best.y - y) ** 2;
    for (let i = 1; i < enemies.length; i++) {
      const e = enemies[i];
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  };

  const scheme = getBasicSkillColorScheme(player.mainCoreKey, player.offCoreKey);

  const spawnX = player.x;
  const spawnY = player.y - player.visualRadius - 4;

  const target = pickTarget(spawnX, spawnY);

  const angle = target && target.isAlive
    ? Phaser.Math.Angle.Between(spawnX, spawnY, target.x, target.y)
    : -Math.PI / 2;

  const now = scene.time?.now ?? 0;

  const shouldArrowRain = (() => {
    if (!player.archerArrowRain) return false;
    player._arrowRainNextAt = player._arrowRainNextAt || (now + 5000);
    if (!player._arrowRainCharged && now >= player._arrowRainNextAt) {
      player._arrowRainCharged = true;
    }
    if (player._arrowRainCharged) {
      player._arrowRainCharged = false;
      player._arrowRainNextAt = now + 5000;
      return true;
    }
    return false;
  })();

  const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);

  if (shouldArrowRain && target && target.isAlive) {
    // AOE 判定（当前项目以 Boss 为主；用“短寿命大半径子弹”做范围伤害）
    const aoe = scene.bulletManager.createPlayerBullet(
      target.x,
      target.y,
      scheme.coreColor,
      {
        radius: 110,
        speed: 0,
        damage: Math.max(1, Math.round(player.bulletDamage * 1.8)),
        angleOffset: 0,
        isAbsoluteAngle: true,
        hasGlow: false,
        hasTrail: false,
        glowRadius: 0,
        homing: false,
        explode: false,
        skipUpdate: false
      }
    );
    if (aoe) {
      aoe.alpha = 0.001;
      aoe.maxLifeMs = 90;
      aoe.hitCooldownMs = 999999;
      aoe.noCrit = false;
      applyEnhancementsToBullet(aoe, enh, scheme);
      player.bullets.push(aoe);
    }

    // 纯表现：几根“落箭”闪一下
    for (let i = 0; i < 7; i++) {
      const dx = Phaser.Math.Between(-90, 90);
      const dy = Phaser.Math.Between(-90, 90);
      const p = scene.add.rectangle(target.x + dx, target.y - 220 + dy, 4, 18, scheme.coreBright, 0.9);
      p.setStrokeStyle(1, scheme.accentColor, 0.9);
      scene.tweens.add({
        targets: p,
        y: target.y + dy,
        alpha: 0,
        duration: 240,
        ease: 'Quad.In',
        onComplete: () => p.destroy()
      });
    }
    return;
  }

  const fireVolley = (allowRapidProc = true) => {
    const spread = 0.16;
    const offsets = [-spread, 0, spread];
    offsets.forEach((off) => {
      const b = scene.bulletManager.createPlayerBullet(
        spawnX,
        spawnY,
        scheme.coreColor,
        {
          radius: 5,
          speed: 720,
          damage: Math.max(1, Math.round(player.bulletDamage * 0.42)),
          angleOffset: angle + off,
          isAbsoluteAngle: true,
          hasGlow: true,
          hasTrail: true,
          glowRadius: 10,
          glowColor: scheme.glowColor,
          strokeColor: scheme.accentColor,
          trailColor: scheme.trailColor,
          homing: false,
          explode: false,
          skipUpdate: false
        }
      );

      if (!b) return;
      b.hitCooldownMs = 120;

      if (player.archerPierce) {
        b.pierce = true;
        b.maxHits = 2;
      }

      applyEnhancementsToBullet(b, enh, scheme);
      player.bullets.push(b);
    });

    if (allowRapidProc && player.archerRapidfire && Math.random() < 0.1) {
      fireVolley(false);
    }
  };

  fireVolley(true);
}
