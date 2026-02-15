import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';

function expApproach(current, target, deltaMs, timeConstantMs) {
  const tc = Math.max(1, timeConstantMs || 1);
  const t = 1 - Math.exp(-(deltaMs || 0) / tc);
  return current + (target - current) * t;
}

function ensureArcaneRayState(player) {
  if (player._arcaneRayState) return player._arcaneRayState;
  player._arcaneRayState = {
    circle: null,
    circleAlpha: 0,
    beamG: null,
    beamGlowG: null,
    beamAlpha: 0,
    phase: 'idle', // idle | charging | beam | fading
    chargeEndAt: 0,
    hitbox: null,
    lastTargetId: null,
    _refract: []
  };
  return player._arcaneRayState;
}

function destroyGraphicsObject(obj) {
  if (!obj) return;
  if (obj.active) obj.destroy();
}

function destroyHitbox(scene, hitbox) {
  if (!hitbox) return;
  if (scene?.bulletManager) {
    scene.bulletManager.destroyBullet(hitbox, true);
  } else if (hitbox.destroy) {
    hitbox.destroy();
  }
}

function ensureCircle(scene, state, player, scheme) {
  const range = Math.max(60, player.arcaneRayRange || 220);
  if (!state.circle || !state.circle.active) {
    const c = scene.add.circle(player.x, player.y, range, scheme.accentColor, 0);
    c.setStrokeStyle(2, scheme.accentColor, 0.55);
    c.setDepth(2);
    c.setVisible(false);
    c.alpha = 0;
    state.circle = c;
  }

  if (state.circle.setRadius) state.circle.setRadius(range);
  state.circle.x = player.x;
  state.circle.y = player.y;
  state.circle.setStrokeStyle(2, scheme.accentColor, 0.55);
}

function ensureBeamGraphics(scene, state) {
  if (!state.beamGlowG || !state.beamGlowG.active) {
    state.beamGlowG = scene.add.graphics();
    state.beamGlowG.setDepth(6);
  }
  if (!state.beamG || !state.beamG.active) {
    state.beamG = scene.add.graphics();
    state.beamG.setDepth(7);
  }
}

function clearBeamGraphics(state) {
  if (state.beamG && state.beamG.active) state.beamG.clear();
  if (state.beamGlowG && state.beamGlowG.active) state.beamGlowG.clear();
}

function destroyBeam(state) {
  destroyGraphicsObject(state.beamG);
  destroyGraphicsObject(state.beamGlowG);
  state.beamG = null;
  state.beamGlowG = null;
  state.beamAlpha = 0;
}

function ensureBeamHitbox(scene, state, player, scheme, baseDamage) {
  if (!state.hitbox || !state.hitbox.active) {
    const hb = scene.bulletManager?.createPlayerBullet
      ? scene.bulletManager.createPlayerBullet(player.x, player.y, scheme.coreBright, {
          radius: 2,
          speed: 0,
          damage: baseDamage,
          angleOffset: 0,
          isAbsoluteAngle: true,
          hasGlow: false,
          hasTrail: false,
          glowRadius: 0,
          skipUpdate: true
        })
      : scene.add.circle(player.x, player.y, 2, scheme.coreBright, 0);

    hb.alpha = 0.001;
    hb.isPlayerBullet = true;
    hb.active = true;
    hb.skipUpdate = true;
    hb.markedForRemoval = false;
    hb.radius = 2;
    hb.damage = baseDamage;
    hb.laserBeam = true;

    // 持续光束：命中不销毁，但视觉上“截断到敌人身上”
    hb.pierce = true;
    hb.maxHits = 999999;
    hb.hitCooldownMs = Math.max(60, Math.round(player.fireRate || 320));

    hb.visualCoreColor = scheme.coreBright;
    hb.visualAccentColor = scheme.accentColor;
    hb.hitEffectColor = scheme.coreBright;

    const enh = getBasicAttackEnhancements(player.mainCoreKey, player.offCoreKey);
    applyEnhancementsToBullet(hb, enh, scheme);

    state.hitbox = hb;
    player.bullets.push(hb);
  }

  state.hitbox.damage = baseDamage;
  state.hitbox.hitCooldownMs = Math.max(60, Math.round(player.fireRate || 320));
  state.hitbox.hitEffectColor = scheme.coreBright;
}

function spawnChargeFx(scene, player, scheme) {
  const cx = player.x;
  const cy = player.y - (player.visualRadius || 15) * 0.35;

  const ring = scene.add.circle(cx, cy, 10, scheme.glowColor, 0.12);
  ring.setStrokeStyle(2, scheme.accentColor, 0.25);
  ring.setDepth(8);

  const core = scene.add.circle(cx, cy, 4, scheme.coreBright, 0.75);
  core.setDepth(9);

  scene.tweens.add({
    targets: [ring, core],
    scale: { from: 0.35, to: 2.0 },
    alpha: { from: 0.75, to: 0 },
    duration: 180,
    ease: 'Cubic.In',
    onComplete: () => {
      ring.destroy();
      core.destroy();
    }
  });
}

function getEnemyRadius(enemy) {
  return Math.max(0, enemy?.bossSize ?? enemy?.radius ?? 0);
}

function getBeamStart(player) {
  return {
    x: player.x,
    y: player.y - (player.visualRadius || 15) * 0.55
  };
}

function closestPointOnSegment(ax, ay, bx, by, px, py) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 <= 0.000001) return { x: ax, y: ay, t: 0 };
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
  return { x: ax + abx * t, y: ay + aby * t, t };
}

function segmentIntersectsCircle(ax, ay, bx, by, cx, cy, r) {
  const p = closestPointOnSegment(ax, ay, bx, by, cx, cy);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return (dx * dx + dy * dy) <= (r * r);
}

function getHitPointOnCircleEdge(ax, ay, bx, by, cx, cy, r) {
  const p = closestPointOnSegment(ax, ay, bx, by, cx, cy);
  const vx = p.x - cx;
  const vy = p.y - cy;
  const len = Math.sqrt(vx * vx + vy * vy) || 0.0001;
  return {
    x: cx + (vx / len) * r,
    y: cy + (vy / len) * r
  };
}

function updateBeamDraw(state, player, target, scheme, beamAlpha) {
  if (!state.beamG || !state.beamGlowG) return;
  if (!target) {
    clearBeamGraphics(state);
    return;
  }

  const s = getBeamStart(player);
  const startX = s.x;
  const startY = s.y;

  // 视觉：终点连到敌人中心（命中/脱离仍按外边缘计算）
  const endX = target.x;
  const endY = target.y;

  const focusLvl = Math.max(0, Math.min(3, player.mageEnergyFocusLevel || 0));
  const widthScale = 1 + 0.12 * focusLvl;
  const brightScale = 1 + 0.10 * focusLvl;

  const baseWidth = Math.max(10, (player.arcaneRayWidth || 16) * widthScale);
  const glowWidth = Math.round(baseWidth * 1.9);

  state.beamGlowG.clear();
  state.beamGlowG.lineStyle(glowWidth, scheme.glowColor, Math.min(0.40, 0.18 * beamAlpha * brightScale));
  state.beamGlowG.beginPath();
  state.beamGlowG.moveTo(startX, startY);
  state.beamGlowG.lineTo(endX, endY);
  state.beamGlowG.strokePath();

  state.beamG.clear();
  state.beamG.lineStyle(baseWidth, scheme.coreBright, Math.min(1, 0.86 * beamAlpha * (0.96 + 0.10 * focusLvl)));
  state.beamG.beginPath();
  state.beamG.moveTo(startX, startY);
  state.beamG.lineTo(endX, endY);
  state.beamG.strokePath();

  // 内芯
  state.beamG.lineStyle(Math.max(3, Math.round(baseWidth * 0.35)), 0xffffff, Math.min(0.9, 0.55 * beamAlpha * (0.96 + 0.10 * focusLvl)));
  state.beamG.beginPath();
  state.beamG.moveTo(startX, startY);
  state.beamG.lineTo(endX, endY);
  state.beamG.strokePath();

  // 末端点（更明确的“命中终点”）
  state.beamG.fillStyle(scheme.accentColor, Math.min(0.55, 0.25 * beamAlpha * brightScale));
  state.beamG.fillCircle(endX, endY, Math.max(6, Math.round(baseWidth * 0.55)));
}

function ensureSplitGraphics(scene, state, count) {
  state._splits = state._splits || [];
  const arr = state._splits;

  while (arr.length > count) {
    const g = arr.pop();
    if (g && g.active) g.destroy();
  }
  while (arr.length < count) {
    const g = scene.add.graphics();
    g.setDepth(6);
    g.alpha = 0;
    arr.push(g);
  }

  return arr;
}

function clearSplitGraphics(state) {
  if (!Array.isArray(state._splits)) return;
  state._splits.forEach((g) => g && g.active && g.clear());
}

function destroySplitGraphics(state) {
  if (!Array.isArray(state._splits)) {
    state._splits = [];
    return;
  }
  state._splits.forEach((g) => g && g.active && g.destroy());
  state._splits = [];
}

function getEnemyUid(scene, enemy) {
  if (!enemy) return '0';
  if (!scene._enemyUidSeq) scene._enemyUidSeq = 1;
  if (!enemy.__enemyUid) enemy.__enemyUid = `${scene._enemyUidSeq++}`;
  return enemy.__enemyUid;
}

function applyArcaneRayDirectDamage(scene, player, enemy, baseDamage, hitX, hitY, scheme, now, tickKey, tickIntervalMs) {
  if (!scene || !player || !enemy || !enemy.isAlive) return;

  player._arcaneRayTickNext = player._arcaneRayTickNext || new Map();
  const nextAt = player._arcaneRayTickNext.get(tickKey) || 0;
  if (now < nextAt) return;
  player._arcaneRayTickNext.set(tickKey, now + tickIntervalMs);

  const dmg = Math.max(1, Math.round(baseDamage));
  const dr = player.calculateDamage ? player.calculateDamage(dmg) : { amount: dmg, isCrit: false };

  enemy.takeDamage?.(dr.amount);
  player.onDealDamage?.(dr.amount);

  if (scene.showDamageNumber) {
    scene.showDamageNumber(hitX, hitY, dr.amount, { isCrit: dr.isCrit, color: '#88ccff', fontSize: 22, whisper: true });
  }
  if (scene.createHitEffect) {
    scene.createHitEffect(hitX, hitY, scheme?.coreBright ?? 0x66ccff);
  }
}

function updateRefractBeams(state, player, target, scheme, delta, inRange) {
  const scene = player.scene;
  const beams = state._refract || [];
  state._refract = beams;

  const need = player.mageRefract && inRange ? 2 : 0;

  while (beams.length > need) {
    const b = beams.pop();
    if (b && b.active) b.destroy();
  }

  while (beams.length < need) {
    const g = scene.add.graphics();
    g.setDepth(6);
    g.alpha = 0;
    beams.push(g);
  }

  if (need === 0) return;

  const baseWidth = Math.max(8, Math.round((player.arcaneRayWidth || 16) * 0.55));
  const beamAlpha = Math.min(1, state.beamAlpha) * 0.65;
  const startX = player.x;
  const startY = player.y - (player.visualRadius || 15) * 0.55;
  const baseAngle = Phaser.Math.Angle.Between(startX, startY, target.x, target.y);
  const offsets = [-0.16, 0.16];
  const len = Math.min(240, Phaser.Math.Distance.Between(startX, startY, target.x, target.y) * 0.55);

  for (let i = 0; i < beams.length; i++) {
    const g = beams[i];
    if (!g || !g.active) continue;

    g.alpha = expApproach(g.alpha, beamAlpha, delta, 120);
    g.clear();

    const a = baseAngle + offsets[i];
    const ex = startX + Math.cos(a) * len;
    const ey = startY + Math.sin(a) * len;

    g.lineStyle(baseWidth, scheme.coreColor, 0.55 * g.alpha);
    g.beginPath();
    g.moveTo(startX, startY);
    g.lineTo(ex, ey);
    g.strokePath();
  }
}

export function fireLaser(player) {
  // 现在的“法师激光”升级为：奥术射线（范围锁定持续光束）
  if (!player?.scene) return;
  ensureArcaneRayState(player);
}

export function updateArcaneRay(player, delta) {
  if (!player?.scene) return;
  const scene = player.scene;
  const now = scene.time?.now ?? 0;

  const state = ensureArcaneRayState(player);
  const scheme = getBasicSkillColorScheme(player.mainCoreKey || 'mage', player.offCoreKey);

  const boss = scene?.bossManager?.getCurrentBoss?.();
  const minions = scene?.bossManager?.getMinions?.() || scene?.bossManager?.minions || [];
  const enemies = [];
  if (boss && boss.isAlive) enemies.push(boss);
  if (Array.isArray(minions) && minions.length > 0) {
    minions.forEach((m) => {
      if (m && m.isAlive) enemies.push(m);
    });
  }

  // 选目标：若 Boss 在圈内，优先 Boss；否则选最近的可达目标
  let target = null;
  const range = Math.max(60, player.arcaneRayRange || 220);
  let targetRadius = 0;

  if (enemies.length > 0) {
    if (boss && boss.isAlive) {
      const br = getEnemyRadius(boss);
      const bd = Phaser.Math.Distance.Between(player.x, player.y, boss.x, boss.y);
      if (bd <= (range + br)) {
        target = boss;
        targetRadius = br;
      }
    }

    if (!target) {
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const r = getEnemyRadius(e);
      const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
      const inR = d <= (range + r);
      if (!inR) continue;
      const score = Math.max(0, d - r);
      if (score < bestScore) {
        bestScore = score;
        target = e;
        targetRadius = r;
      }
    }
    }
  }

  ensureCircle(scene, state, player, scheme);

  // 触碰范围：以“圆圈边界触碰到敌方外边缘”为进入/脱离标准
  // - 进入：distance(center, center) <= range + enemyRadius
  // - 脱离：distance(center, center) > range + enemyRadius
  const inRange = !!(target && Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y) <= (range + targetRadius));

  // ====== 圆圈：常驻极淡；有敌人进入范围时更明显并微脉动 ======
  let circleTargetAlpha = 0.07;
  if (inRange) circleTargetAlpha = (state.phase === 'beam') ? 0.10 : 0.26;

  state.circleAlpha = expApproach(state.circleAlpha || 0, circleTargetAlpha, delta, 300);
  if (state.circle) {
    const shouldShow = state.circleAlpha > 0.01;
    state.circle.setVisible(shouldShow);
    state.circle.alpha = state.circleAlpha;

    if (shouldShow && inRange && target) {
      const seed = (target.x * 0.07 + target.y * 0.05);
      const pulse = 1 + 0.018 * Math.sin((now * 0.012) + seed);
      state.circle.setScale(pulse);
    } else {
      state.circle.setScale(1);
    }
  }

  // ====== 相位机：进入范围 -> 蓄力 -> 持续光束；脱离 -> 淡出 ======
  if (inRange) {
    if (state.phase === 'idle' || state.phase === 'fading') {
      state.phase = 'charging';
      state.chargeEndAt = now + 180;
      spawnChargeFx(scene, player, scheme);
      if (typeof player.playAttackAnimation === 'function') {
        player.playAttackAnimation();
      }
    }
  } else {
    if (state.phase === 'charging' || state.phase === 'beam') {
      state.phase = 'fading';
    }
  }

  if (state.phase === 'charging' && now >= (state.chargeEndAt || 0)) {
    state.phase = 'beam';
  }

  const wantBeamVisible = state.phase === 'beam' && inRange;
  const beamTargetAlpha = wantBeamVisible ? 1 : 0;
  state.beamAlpha = expApproach(state.beamAlpha || 0, beamTargetAlpha, delta, wantBeamVisible ? 90 : 240);

  const hasAnyBeam = (state.beamAlpha || 0) > 0.01 || state.phase === 'beam' || state.phase === 'fading';
  if (hasAnyBeam) {
    ensureBeamGraphics(scene, state);
    updateBeamDraw(state, player, target, scheme, state.beamAlpha || 0);
    updateRefractBeams(state, player, target, scheme, delta, inRange);
  } else {
    clearBeamGraphics(state);
    clearSplitGraphics(state);
  }

  // 命中判定：用“隐形 hitbox 子弹”复用既有碰撞/伤害/特效/天赋
  if (wantBeamVisible && target) {
    // 蓄能：每 2 秒下一次射线强化（3 倍伤害 + 击退）
    let chargeMult = 1;
    let chargeKnockback = 0;
    if (player.mageCharge) {
      player._mageChargeNextAt = player._mageChargeNextAt || (now + 2000);
      if (!player._mageChargeCharged && now >= player._mageChargeNextAt) {
        player._mageChargeCharged = true;
      }
      if (player._mageChargeCharged) {
        player._mageChargeCharged = false;
        player._mageChargeNextAt = now + 2000;
        chargeMult = 3;
        chargeKnockback = 30;
      }
    }

    const focusLvl = Math.max(0, Math.min(3, player.mageEnergyFocusLevel || 0));
    const focusMult = 1 + 0.10 * focusLvl;
    const baseDamage = Math.max(1, Math.round((player.bulletDamage || 1) * (player.laserDamageMult || 2) * chargeMult * focusMult));
    ensureBeamHitbox(scene, state, player, scheme, baseDamage);

    // “截断”：命中点固定到敌方外圈（不穿透）
    const s = getBeamStart(player);
    const startX = s.x;
    const startY = s.y;
    const dx = target.x - startX;
    const dy = target.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const cut = Math.max(0, dist - targetRadius);
    state.hitbox.x = startX + (dx / dist) * cut;
    state.hitbox.y = startY + (dy / dist) * cut;

    // 以玩家朝向为参考的击退方向（更自然）
    if (chargeKnockback > 0) {
      state.hitbox.knockback = chargeKnockback;
    } else {
      delete state.hitbox.knockback;
    }

    // ====== 奥术分裂 + 路径伤害 ======
    const splitLvl = Math.max(0, Math.min(3, player.mageArcaneSplitLevel || 0));
    const tickIntervalMs = Math.max(60, Math.round(player.fireRate || 320));
    const start = getBeamStart(player);
    // 分裂起点：主束首次接触点（命中外圈点）
    const splitStart = { x: state.hitbox.x, y: state.hitbox.y };

    // 若主目标不是 Boss（例如测试小怪），需要走 direct tick 才能扣血
    if (target !== boss) {
      const r = getEnemyRadius(target);
      const hp = r > 0
        ? getHitPointOnCircleEdge(start.x, start.y, target.x, target.y, target.x, target.y, r)
        : { x: target.x, y: target.y };
      const key = `primary:${getEnemyUid(scene, target)}`;
      applyArcaneRayDirectDamage(scene, player, target, baseDamage, hp.x, hp.y, scheme, now, key, tickIntervalMs);
    }

    // 分裂目标：按距离挑选（排除主目标）
    const extraTargets = [];
    if (splitLvl > 0) {
      const candidates = enemies.filter((e) => e && e.isAlive && e !== target);
      candidates.sort((a, b) => Phaser.Math.Distance.Between(start.x, start.y, a.x, a.y) - Phaser.Math.Distance.Between(start.x, start.y, b.x, b.y));
      for (let i = 0; i < Math.min(splitLvl, candidates.length); i++) {
        extraTargets.push(candidates[i]);
      }
    }

    // 画分裂束
    const splitGs = ensureSplitGraphics(scene, state, extraTargets.length);
    for (let i = 0; i < splitGs.length; i++) {
      const g = splitGs[i];
      const t = extraTargets[i];
      if (!g || !g.active || !t) continue;
      g.alpha = expApproach(g.alpha, Math.min(1, state.beamAlpha) * 0.85, delta, 120);
      g.clear();

      const endX = t.x;
      const endY = t.y;

      const focusLvl2 = Math.max(0, Math.min(3, player.mageEnergyFocusLevel || 0));
      const widthScale = 1 + 0.12 * focusLvl2;
      const baseWidth = Math.max(8, (player.arcaneRayWidth || 16) * widthScale * 0.72);
      const glowWidth = Math.round(baseWidth * 1.9);

      g.lineStyle(glowWidth, scheme.glowColor, Math.min(0.35, 0.12 * g.alpha));
      g.beginPath();
      g.moveTo(splitStart.x, splitStart.y);
      g.lineTo(endX, endY);
      g.strokePath();

      g.lineStyle(baseWidth, scheme.coreBright, Math.min(1, 0.72 * g.alpha));
      g.beginPath();
      g.moveTo(splitStart.x, splitStart.y);
      g.lineTo(endX, endY);
      g.strokePath();

      g.lineStyle(Math.max(3, Math.round(baseWidth * 0.35)), 0xffffff, Math.min(0.9, 0.45 * g.alpha));
      g.beginPath();
      g.moveTo(splitStart.x, splitStart.y);
      g.lineTo(endX, endY);
      g.strokePath();
    }

    // 路径伤害：主束对“路径上的其它敌人”；分裂束对各自路径
    const mainEndX = target.x;
    const mainEndY = target.y;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.isAlive || e === target) continue;
      const r = getEnemyRadius(e);
      if (r <= 0) continue;
      if (!segmentIntersectsCircle(start.x, start.y, mainEndX, mainEndY, e.x, e.y, r)) continue;
      const hp = getHitPointOnCircleEdge(start.x, start.y, mainEndX, mainEndY, e.x, e.y, r);
      const key = `main:${getEnemyUid(scene, e)}`;
      applyArcaneRayDirectDamage(scene, player, e, baseDamage, hp.x, hp.y, scheme, now, key, tickIntervalMs);
    }

    for (let si = 0; si < extraTargets.length; si++) {
      const t = extraTargets[si];
      if (!t || !t.isAlive) continue;
      const endX = t.x;
      const endY = t.y;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || !e.isAlive) continue;
        const r = getEnemyRadius(e);
        if (r <= 0) continue;
        if (!segmentIntersectsCircle(splitStart.x, splitStart.y, endX, endY, e.x, e.y, r)) continue;
        const hp = getHitPointOnCircleEdge(splitStart.x, splitStart.y, endX, endY, e.x, e.y, r);
        const key = `split${si}:${getEnemyUid(scene, e)}`;
        applyArcaneRayDirectDamage(scene, player, e, baseDamage * 0.5, hp.x, hp.y, scheme, now, key, tickIntervalMs);
      }
    }
  } else {
    if (state.hitbox) {
      destroyHitbox(scene, state.hitbox);
      state.hitbox = null;
    }
    clearSplitGraphics(state);
  }

  // 淡出结束：清理光束图形
  if (!wantBeamVisible && state.phase === 'fading' && (state.beamAlpha || 0) <= 0.01) {
    destroyBeam(state);
    // 折射束
    if (Array.isArray(state._refract) && state._refract.length > 0) {
      state._refract.forEach((g) => g && g.active && g.destroy());
      state._refract = [];
    }

    destroySplitGraphics(state);
    state.phase = 'idle';
  }
}

export function destroyArcaneRay(player) {
  if (!player?._arcaneRayState || !player?.scene) return;
  const state = player._arcaneRayState;
  const scene = player.scene;

  if (state.circle) destroyGraphicsObject(state.circle);
  state.circle = null;

  if (state.hitbox) destroyHitbox(scene, state.hitbox);
  state.hitbox = null;

  destroyBeam(state);

  if (Array.isArray(state._refract) && state._refract.length > 0) {
    state._refract.forEach((g) => g && g.active && g.destroy());
  }
  state._refract = [];

  if (Array.isArray(state._splits) && state._splits.length > 0) {
    state._splits.forEach((g) => g && g.active && g.destroy());
  }
  state._splits = [];

  delete player._arcaneRayState;
}
