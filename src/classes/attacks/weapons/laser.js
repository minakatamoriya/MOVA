import Phaser from 'phaser';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../basicAttackMods';
import { getBasicSkillColorScheme } from '../../visual/basicSkillColors';
import { calculateResolvedDamage } from '../../../combat/damageModel';

function getRangeCenter(player) {
  // 与全局“职业射程圈”一致：以玩家核心判定点为中心
  if (player && typeof player.getHitboxPosition === 'function') {
    const hp = player.getHitboxPosition();
    if (hp && Number.isFinite(hp.x) && Number.isFinite(hp.y)) {
      return { x: hp.x, y: hp.y };
    }
  }
  return { x: player.x, y: player.y };
}

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
    beamHoldUntil: 0,
    hitbox: null,
    lastTargetId: null,
    lastEnd: null,
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
  if (scene?.destroyManagedBullet) {
    scene.destroyManagedBullet(hitbox, 'player', 'cleanup');
  } else if (hitbox.destroy) {
    hitbox.destroy();
  }
}

function ensureCircle(scene, state, player, scheme) {
  const range = Math.max(60, player.arcaneRayRange || player.arcaneRayBaseRange || 220);
  const rc = getRangeCenter(player);
  if (!state.circle || !state.circle.active) {
    const c = scene.add.circle(rc.x, rc.y, range, scheme.accentColor, 0);
    c.setStrokeStyle(2, scheme.accentColor, 0.55);
    c.setDepth(2);
    c.setVisible(false);
    c.alpha = 0;
    state.circle = c;
  }

  if (state.circle.setRadius) state.circle.setRadius(range);
  state.circle.x = rc.x;
  state.circle.y = rc.y;
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
    const hb = scene.createManagedPlayerBullet
      ? scene.createManagedPlayerAreaBullet(player.x, player.y, scheme.coreBright, {
          radius: 2,
          damage: baseDamage,
          skipUpdate: true,
          alpha: 0.001,
          pierce: true,
          maxHits: 999999,
          hitCooldownMs: Math.max(60, Math.round(player.fireRate || 320)),
          tags: ['player_laser_hitbox']
        })
      : scene.add.circle(player.x, player.y, 2, scheme.coreBright, 0);

    if (!hb) return;

    hb.isPlayerBullet = true;
    hb.active = true;
    hb.skipUpdate = true;
    hb.markedForRemoval = false;
    hb.radius = 2;
    hb.damage = baseDamage;
    hb.laserBeam = true;

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
  if (!enemy) return 0;

  const candidates = [
    enemy.hitRadius,
    enemy.collisionRadius,
    enemy.bodyRadius,
    enemy.visualRadius,
    enemy.radius,
    enemy.bossSize,
    enemy.body?.radius,
    enemy.body?.width,
    enemy.body?.height,
    enemy.sprite?.radius,
  ];

  let r = 0;
  for (let i = 0; i < candidates.length; i++) {
    const v = Number(candidates[i]);
    if (Number.isFinite(v) && v > r) r = v;
  }

  // 兜底：仅在没有明确半径字段时，才尝试用显示尺寸/Bounds。
  // 注意：小怪常为 Container，内部包含血条/文字等 UI，displayWidth/getBounds
  // 会被这些子节点“撑大”，导致半径被错误放大，进而让激光命中点/生效范围看起来不对。
  if (!(r > 0)) {
    const dw = Number(enemy.displayWidth ?? enemy.width ?? 0);
    const dh = Number(enemy.displayHeight ?? enemy.height ?? 0);
    if (Number.isFinite(dw) && Number.isFinite(dh) && (dw > 0 || dh > 0)) {
      r = Math.max(r, 0.5 * Math.max(dw, dh));
    } else if (Number.isFinite(dw) && dw > 0) {
      r = Math.max(r, 0.5 * dw);
    } else if (Number.isFinite(dh) && dh > 0) {
      r = Math.max(r, 0.5 * dh);
    }
  }

  // 最后兜底：bounds（仅在其它信息都缺失时使用）
  if (!(r > 0) && typeof enemy.getBounds === 'function') {
    try {
      const b = enemy.getBounds();
      const bw = Number(b?.width ?? 0);
      const bh = Number(b?.height ?? 0);
      if (Number.isFinite(bw) && Number.isFinite(bh) && (bw > 0 || bh > 0)) {
        r = 0.5 * Math.max(bw, bh);
      }
    } catch (_) { /* ignore */ }
  }

  return Math.max(0, r);
}

function isEnemyTouchingRange(px, py, range, enemy) {
  if (!enemy || enemy.isAlive === false) return false;

  // 统一规则：仅用“敌人中心点”做射程判定。
  // 需求：当攻击范围触碰到怪物中心点就开始施放；不要求包裹敌方体积。
  const d = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
  return d <= range;
}

function getBeamStart(player) {
  return {
    x: player.x,
    y: player.y - (player.visualRadius || 15) * 0.55
  };
}

function getExtendedBeamEnd(start, target, range) {
  const dx = (target?.x || 0) - start.x;
  const dy = (target?.y || 0) - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const beamLen = Math.max(dist, range);
  return {
    x: start.x + (dx / dist) * beamLen,
    y: start.y + (dy / dist) * beamLen
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

function updateBeamDraw(state, player, end, scheme, beamAlpha) {
  if (!state.beamG || !state.beamGlowG) return;
  if (!end) {
    clearBeamGraphics(state);
    return;
  }

  const s = getBeamStart(player);
  const startX = s.x;
  const startY = s.y;

  // 视觉：终点连到目标点（敌人中心 / 残留点）
  const endX = end.x;
  const endY = end.y;

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

  // 激光的逐 tick 直伤也走统一结算，避免和弹道/宠物/DOT 出现不同公式
  const dr = calculateResolvedDamage({ attacker: player, target: enemy, baseDamage, now });

  enemy.takeDamage?.(dr.amount);
  player.onDealDamage?.(dr.amount);

  if (scene.showDamageNumber) {
    scene.showDamageNumber(hitX, hitY, dr.amount, { isCrit: dr.isCrit, color: '#88ccff', fontSize: 22, whisper: true });
  }
  if (scene.createHitEffect) {
    scene.createHitEffect(hitX, hitY, scheme?.coreBright ?? 0x66ccff);
  }
}

function updateRefractBeams(state, player, start, refractTargets, scheme, delta, enabled) {
  const scene = player.scene;
  const beams = state._refract || [];
  state._refract = beams;

  const targets = Array.isArray(refractTargets) ? refractTargets.filter(Boolean) : [];
  const need = (enabled && start && targets.length > 0) ? Math.min(2, targets.length) : 0;

  while (beams.length > 2) {
    const b = beams.pop();
    if (b && b.active) b.destroy();
  }

  while (beams.length < 2) {
    const g = scene.add.graphics();
    g.setDepth(6);
    g.alpha = 0;
    beams.push(g);
  }

  const baseWidth = Math.max(6, Math.round((player.arcaneRayWidth || 16) * 0.50));
  const beamAlpha = Math.min(1, state.beamAlpha) * 0.70;

  for (let i = 0; i < beams.length; i++) {
    const g = beams[i];
    if (!g || !g.active) continue;

    const has = i < need;
    g.alpha = expApproach(g.alpha, has ? beamAlpha : 0, delta, has ? 110 : 180);
    g.clear();

    if (!has || g.alpha <= 0.01) continue;

    const t = targets[i];
    const sx = start.x;
    const sy = start.y;
    const ex = t.x;
    const ey = t.y;

    // 外层微弱辉光 + 内层亮芯
    g.lineStyle(Math.round(baseWidth * 1.8), scheme.glowColor, Math.min(0.30, 0.12 * g.alpha));
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.strokePath();

    g.lineStyle(baseWidth, scheme.coreBright, Math.min(1, 0.72 * g.alpha));
    g.beginPath();
    g.moveTo(sx, sy);
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
  const range = Math.max(60, player.arcaneRayRange || player.arcaneRayBaseRange || 220);
  let targetRadius = 0;
  const rc = getRangeCenter(player);

  if (enemies.length > 0) {
    if (boss && boss.isAlive) {
      const br = getEnemyRadius(boss);
      const bd = Phaser.Math.Distance.Between(rc.x, rc.y, boss.x, boss.y);
      if (bd <= range) {
        target = boss;
        targetRadius = br;
      }
    }

    if (!target) {
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const r = getEnemyRadius(e);
      const d = Phaser.Math.Distance.Between(rc.x, rc.y, e.x, e.y);
      const inR = isEnemyTouchingRange(rc.x, rc.y, range, e);
      if (!inR) continue;
      const score = d;
      if (score < bestScore) {
        bestScore = score;
        target = e;
        targetRadius = r;
      }
    }
    }
  }

  ensureCircle(scene, state, player, scheme);

  // 触碰范围：以“圆圈触碰到敌方中心点”为进入/脱离标准
  // - 进入：distance(center, center) <= range
  // - 脱离：distance(center, center) > range
  const inRange = !!(target && isEnemyTouchingRange(rc.x, rc.y, range, target));

  // 折射：命中 A 后，从 A 分裂两道短束到附近 B/C（小范围寻怪）
  const refractEnabled = !!(player.mageRefract && inRange && target && target.isAlive);
  const refractStart = refractEnabled ? { x: target.x, y: target.y } : null;
  const refractTargets = [];
  if (refractEnabled) {
    const refractSearchR = 180; // 先定一个“小幅度范围”
    const candidates = enemies.filter((e) => e && e.isAlive && e !== target);
    candidates.sort((a, b) => Phaser.Math.Distance.Between(target.x, target.y, a.x, a.y) - Phaser.Math.Distance.Between(target.x, target.y, b.x, b.y));
    for (let i = 0; i < candidates.length; i++) {
      const e = candidates[i];
      const d = Phaser.Math.Distance.Between(target.x, target.y, e.x, e.y);
      if (d <= refractSearchR) refractTargets.push(e);
      if (refractTargets.length >= 2) break;
    }
  }

  // 记录上一帧终点：用于“敌人瞬死”时仍能看到完整光束
  if (target && target.isAlive) {
    state.lastEnd = { x: target.x, y: target.y, until: now + 260 };
  }

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
      // 起手更快：避免小怪瞬死导致只看到很淡的蓄力
      state.chargeEndAt = now + 80;
      spawnChargeFx(scene, player, scheme);
      if (typeof player.playAttackAnimation === 'function') {
        player.playAttackAnimation();
      }
    }
  } else {
    if (state.phase === 'charging' || state.phase === 'beam') {
      state.phase = 'fading';
      // 保证淡出期间至少有一个“可画的终点”
      if (state.lastEnd && typeof state.lastEnd.x === 'number' && typeof state.lastEnd.y === 'number') {
        state.lastEnd.until = Math.max(state.lastEnd.until || 0, now + 260);
      }
    }
  }

  if (state.phase === 'charging' && now >= (state.chargeEndAt || 0)) {
    state.phase = 'beam';
    state.beamHoldUntil = now + 140;
  }

  // 允许短暂保持可见（击杀瞬间）但不继续造成伤害
  const wantBeamVisible = state.phase === 'beam' && (inRange || now < (state.beamHoldUntil || 0));
  const beamTargetAlpha = wantBeamVisible ? 1 : 0;
  state.beamAlpha = expApproach(state.beamAlpha || 0, beamTargetAlpha, delta, wantBeamVisible ? 55 : 220);

  const hasAnyBeam = (state.beamAlpha || 0) > 0.01 || state.phase === 'beam' || state.phase === 'fading';
  if (hasAnyBeam) {
    ensureBeamGraphics(scene, state);
    const drawEnd = target
      ? getExtendedBeamEnd(getBeamStart(player), target, range)
      : ((state.lastEnd && now <= (state.lastEnd.until || 0)) ? { x: state.lastEnd.x, y: state.lastEnd.y } : null);
    updateBeamDraw(state, player, drawEnd, scheme, state.beamAlpha || 0);

    // 折射束：仅在“命中 A 且 A 周围找到 B/C”时绘制（从 A 身上发出）
    updateRefractBeams(state, player, refractStart, refractTargets, scheme, delta, refractEnabled);
  } else {
    clearBeamGraphics(state);
  }

  // 命中判定：用“隐形 hitbox 子弹”复用既有碰撞/伤害/特效/天赋
  if (wantBeamVisible && target) {
    const focusLvl = Math.max(0, Math.min(3, player.mageEnergyFocusLevel || 0));
    const focusMult = 1 + 0.10 * focusLvl;
    const baseDamage = Math.max(1, Math.round((player.bulletDamage || 1) * (player.laserDamageMult || 2) * focusMult));
    ensureBeamHitbox(scene, state, player, scheme, baseDamage);

    // “截断”：命中点固定到敌方外圈（不穿透）
    const s = getBeamStart(player);
    const startX = s.x;
    const startY = s.y;
    const extendedEnd = getExtendedBeamEnd({ x: startX, y: startY }, target, range);
    const dx = extendedEnd.x - startX;
    const dy = extendedEnd.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    state.hitbox.x = extendedEnd.x;
    state.hitbox.y = extendedEnd.y;

    // ====== 路径伤害 ======
    const tickIntervalMs = Math.max(60, Math.round(player.fireRate || 320));
    const start = getBeamStart(player);
    // 主目标直伤：
    // - 常规情况下（Boss）由碰撞系统扣血
    // - 兜底：若教程/试炼 Boss 的碰撞链路异常，走直伤 tick，避免“激光不掉血”
    {
      const r = getEnemyRadius(target);
      const hp = r > 0
        ? getHitPointOnCircleEdge(start.x, start.y, target.x, target.y, target.x, target.y, r)
        : { x: target.x, y: target.y };

      const isBossTarget = !!(boss && target === boss);
      const lastHitAt = state.hitbox?.lastHitAt || 0;
      const collisionLikelyApplied = isBossTarget && lastHitAt > 0 && (now - lastHitAt) < (tickIntervalMs * 1.1);
      if (!isBossTarget || !collisionLikelyApplied) {
        const key = `primary:${getEnemyUid(scene, target)}`;
        applyArcaneRayDirectDamage(scene, player, target, baseDamage, hp.x, hp.y, scheme, now, key, tickIntervalMs);
      }
    }

    // 路径伤害：主束对“路径上的其它敌人”
    const mainEndX = extendedEnd.x;
    const mainEndY = extendedEnd.y;
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

    // ====== 折射：从 A 分裂到 B/C（50% 伤害，小范围） ======
    if (refractEnabled && refractStart && refractTargets.length > 0) {
      const tickIntervalMs2 = Math.max(60, Math.round(player.fireRate || 320));
      for (let i = 0; i < Math.min(2, refractTargets.length); i++) {
        const e = refractTargets[i];
        if (!e || !e.isAlive) continue;
        const r = getEnemyRadius(e);
        const hp = (r > 0)
          ? getHitPointOnCircleEdge(refractStart.x, refractStart.y, e.x, e.y, e.x, e.y, r)
          : { x: e.x, y: e.y };
        const key = `refract${i}:${getEnemyUid(scene, e)}`;
        applyArcaneRayDirectDamage(scene, player, e, baseDamage * 0.5, hp.x, hp.y, scheme, now, key, tickIntervalMs2);
      }
    }
  } else {
    if (state.hitbox) {
      destroyHitbox(scene, state.hitbox);
      state.hitbox = null;
    }
  }

  // 淡出结束：清理光束图形
  if (!wantBeamVisible && state.phase === 'fading' && (state.beamAlpha || 0) <= 0.01) {
    destroyBeam(state);
    // 折射束
    if (Array.isArray(state._refract) && state._refract.length > 0) {
      state._refract.forEach((g) => g && g.active && g.destroy());
      state._refract = [];
    }
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

  delete player._arcaneRayState;
}
