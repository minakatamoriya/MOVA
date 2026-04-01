import Phaser from 'phaser';

function pickSpawnCount(minValue, maxValue) {
  const min = Math.max(0, Math.floor(Number(minValue) || 0));
  const max = Math.max(min, Math.floor(Number(maxValue) || 0));
  if (max <= min) return min;
  return Phaser.Math.Between(min, max);
}

export default class SpawnDirector {
  constructor(scene) {
    this.scene = scene;
    this.state = null;
  }

  startRound(config = {}) {
    this.stop();

    const stage = Math.max(1, Math.floor(Number(config.stage) || 1));
    const now = Number(this.scene?.time?.now || 0);
    const totalBudget = Math.max(0, Math.floor(Number(config.totalBudget) || 0));
    const initialAlive = Math.max(0, Math.floor(Number(config.initialAlive) || 0));
    const maxAlive = Math.max(initialAlive, Math.floor(Number(config.maxAlive) || initialAlive));
    const eliteTotal = Math.max(0, Math.floor(Number(config.eliteTotal) || 0));

    this.state = {
      active: totalBudget > 0 || eliteTotal > 0 || !!config.bossDef,
      mapId: config.mapId || null,
      stage,
      minionDefs: Array.isArray(config.minionDefs) ? config.minionDefs.slice() : [],
      eliteDefs: Array.isArray(config.eliteDefs) ? config.eliteDefs.slice() : [],
      bossDef: config.bossDef || null,
      totalBudget,
      spawnedTotal: 0,
      eliteTotal,
      eliteSpawned: 0,
      eliteConcurrentMax: Math.max(1, Math.round(Number(config.eliteConcurrentMax) || 1)),
      eliteFirstProgress: Phaser.Math.Clamp(Number(config.eliteFirstProgress) || 0.34, 0.08, 0.95),
      eliteProgressStep: Phaser.Math.Clamp(Number(config.eliteProgressStep) || 0.22, 0.05, 0.4),
      eliteInitialDelayMs: Math.max(1200, Math.round(Number(config.eliteInitialDelayMs) || 12000)),
      eliteIntervalMs: Math.max(1200, Math.round(Number(config.eliteIntervalMs) || 16000)),
      nextEliteAt: now + Math.max(1200, Math.round(Number(config.eliteInitialDelayMs) || 12000)),
      bossDelayMs: Math.max(0, Math.round(Number(config.bossDelayMs) || 1600)),
      bossQueuedAt: 0,
      bossSpawned: false,
      initialAlive,
      maxAlive,
      aliveRampMs: Math.max(1200, Math.round(Number(config.aliveRampMs) || 6500)),
      aliveStep: Math.max(1, Math.round(Number(config.aliveStep) || 2)),
      burstMin: Math.max(1, Math.round(Number(config.burstMin) || 3)),
      burstMax: Math.max(1, Math.round(Number(config.burstMax) || 5)),
      burstIntervalMs: Math.max(500, Math.round(Number(config.burstIntervalMs) || 1650)),
      minBurstIntervalMs: Math.max(360, Math.round(Number(config.minBurstIntervalMs) || 1000)),
      burstIntervalDecayMs: Math.max(0, Math.round(Number(config.burstIntervalDecayMs) || 70)),
      safeSideDurationMs: Math.max(1800, Math.round(Number(config.safeSideDurationMs) || 4200)),
      offscreenPad: Math.max(72, Math.round(Number(config.offscreenPad) || 180)),
      edgeInset: Math.max(32, Math.round(Number(config.edgeInset) || 72)),
      laneInset: Math.max(36, Math.round(Number(config.laneInset) || 120)),
      minPlayerDistance: Math.max(180, Math.round(Number(config.minPlayerDistance) || 320)),
      jitter: Math.max(0, Math.round(Number(config.jitter) || 18)),
      spawnCursor: 0,
      burstIndex: 0,
      startedAt: now,
      nextBurstAt: now + Math.max(0, Math.round(Number(config.initialDelayMs) || 900)),
      safeSide: null,
      safeSideUntil: now,
      clusterRadius: Math.max(28, Math.round(Number(config.clusterRadius) || 74)),
      clusterDepthJitter: Math.max(18, Math.round(Number(config.clusterDepthJitter) || 42)),
      maxClusterSides: Math.max(1, Math.round(Number(config.maxClusterSides) || 1)),
      earlyCycleMs: Math.max(6000, Math.round(Number(config.earlyCycleMs) || 12000)),
      earlySurgeMs: Math.max(3200, Math.round(Number(config.earlySurgeMs) || 7000)),
      lateCycleMs: Math.max(4800, Math.round(Number(config.lateCycleMs) || 9000)),
      lateSurgeMs: Math.max(2800, Math.round(Number(config.lateSurgeMs) || 6200)),
    };

    this.refreshSafeSide(now, true);
    return this.state;
  }

  stop() {
    this.state = null;
  }

  update(time) {
    const state = this.state;
    if (!state?.active) return;

    const scene = this.scene;
    const player = scene?.player;
    if (!player || player.isAlive === false) return;
    if (scene?._roundBossDefeated) {
      this.stop();
      return;
    }

    const boss = scene?.bossManager?.getCurrentBoss?.() || null;
    if (boss?.isAlive && boss.combatActive) {
      this.stop();
      return;
    }

    const now = Number(time ?? scene?.time?.now ?? 0);
    if (now >= state.safeSideUntil) {
      this.refreshSafeSide(now, false);
    }

    if (this.trySpawnBoss(now)) {
      return;
    }

    this.trySpawnElite(now);

    if ((state.minionDefs || []).length === 0 || state.spawnedTotal >= state.totalBudget) {
      return;
    }

    if (now < state.nextBurstAt) return;

    const pacing = this.getPacingProfile(now);
    const aliveMinions = this.countActiveDirectedMinions();
    const targetAlive = this.getTargetAliveCount(now);
    if (aliveMinions >= targetAlive) {
      const idleDelay = pacing.isSurge ? 120 : 180;
      state.nextBurstAt = now + Math.min(idleDelay, Math.round(state.burstIntervalMs * (pacing.isSurge ? 0.12 : 0.18)));
      return;
    }

    const remainingBudget = Math.max(0, state.totalBudget - state.spawnedTotal);
    const burstLimit = Math.max(1, this.getBurstLimit(now));
    const spawnCount = Math.min(remainingBudget, targetAlive - aliveMinions, burstLimit);
    if (spawnCount <= 0) return;

    const clusterSeeds = this.buildClusterSeeds(spawnCount, now);
    if (clusterSeeds.length <= 0) {
      state.nextBurstAt = now + 220;
      return;
    }

    let spawnedThisBurst = 0;
    for (let index = 0; index < spawnCount; index += 1) {
      const cluster = clusterSeeds[index % clusterSeeds.length];
      const point = this.buildClusterPoint(cluster, index, spawnCount);

      const distToPlayer = Phaser.Math.Distance.Between(point.x, point.y, player.x, player.y);
      if (distToPlayer < state.minPlayerDistance) continue;

      const def = state.minionDefs[state.spawnCursor % state.minionDefs.length] || null;
      state.spawnCursor += 1;
      if (!def) continue;

      const minion = scene.spawnDirectedMinion?.({
        mapId: state.mapId,
        stage: state.stage,
        point,
        def,
        waveIndex: state.spawnedTotal,
      }) || null;
      if (!minion) continue;

      minion.spawnDirectorWave = true;
      state.spawnedTotal += 1;
      spawnedThisBurst += 1;
    }

    state.burstIndex += 1;
    const nextInterval = Math.max(
      state.minBurstIntervalMs,
      Math.round((state.burstIntervalMs - (state.burstIndex * state.burstIntervalDecayMs)) * pacing.intervalMult)
    );
    state.nextBurstAt = now + nextInterval;
    if (spawnedThisBurst <= 0) {
      state.nextBurstAt = now + (pacing.isSurge ? 160 : 260);
    }
  }

  getPacingProfile(now) {
    const state = this.state;
    if (!state) {
      return {
        isSurge: false,
        targetBonus: 0,
        burstBonus: 0,
        intervalMult: 1,
        clusterSideBonus: 0,
      };
    }

    const elapsed = Math.max(0, Number(now || 0) - state.startedAt);
    const isLateGame = elapsed >= 60000;
    const cycleMs = isLateGame ? state.lateCycleMs : state.earlyCycleMs;
    const surgeMs = isLateGame ? state.lateSurgeMs : state.earlySurgeMs;
    const cyclePos = cycleMs > 0 ? (elapsed % cycleMs) : 0;
    const isSurge = cyclePos < surgeMs;

    return {
      isSurge,
      targetBonus: isSurge ? (isLateGame ? 5 : 3) : (isLateGame ? 2 : 1),
      burstBonus: isSurge ? (isLateGame ? 3 : 2) : 0,
      intervalMult: isSurge ? (isLateGame ? 0.56 : 0.68) : (isLateGame ? 0.78 : 0.9),
      clusterSideBonus: isSurge ? (isLateGame ? 2 : 1) : 1,
    };
  }

  countActiveDirectedMinions() {
    const minions = this.scene?.bossManager?.getMinions?.() || [];
    let count = 0;
    for (let index = 0; index < minions.length; index += 1) {
      const unit = minions[index];
      if (!unit || !unit.isAlive || unit.isElite || unit.isSummon) continue;
      count += 1;
    }
    return count;
  }

  countActiveDirectedElites() {
    const minions = this.scene?.bossManager?.getMinions?.() || [];
    let count = 0;
    for (let index = 0; index < minions.length; index += 1) {
      const unit = minions[index];
      if (!unit || !unit.isAlive || !unit.isElite || unit.isSummon) continue;
      count += 1;
    }
    return count;
  }

  trySpawnElite(now) {
    const state = this.state;
    if (!state?.active) return false;
    if ((state.eliteDefs || []).length <= 0) return false;
    if (state.eliteSpawned >= state.eliteTotal) return false;
    if (now < state.nextEliteAt) return false;

    const activeElites = this.countActiveDirectedElites();
    if (activeElites >= state.eliteConcurrentMax) return false;

    const progress = state.totalBudget > 0
      ? Phaser.Math.Clamp(state.spawnedTotal / state.totalBudget, 0, 1)
      : 1;
    const requiredProgress = Phaser.Math.Clamp(
      state.eliteFirstProgress + (state.eliteProgressStep * state.eliteSpawned),
      0,
      0.98
    );
    const elapsed = Math.max(0, now - state.startedAt);
    const elapsedGate = state.eliteInitialDelayMs + (state.eliteIntervalMs * state.eliteSpawned);
    if (progress < requiredProgress && elapsed < elapsedGate) return false;

    const def = state.eliteDefs[state.eliteSpawned % state.eliteDefs.length] || null;
    if (!def) return false;

    const point = this.scene?.getDynamicSpawnPoint?.(state.eliteSpawned, Math.max(1, state.eliteTotal), {
      offscreenPad: state.offscreenPad,
      edgeInset: state.edgeInset,
      laneInset: state.laneInset,
      minPlayerDistance: Math.max(state.minPlayerDistance, 320),
      jitter: state.jitter,
    });
    if (!point) return false;

    const elite = this.scene?.spawnDirectedElite?.({
      mapId: state.mapId,
      stage: state.stage,
      point,
      def,
      eliteIndex: state.eliteSpawned,
    }) || null;
    if (!elite) return false;

    state.eliteSpawned += 1;
    state.nextEliteAt = now + state.eliteIntervalMs;
    return true;
  }

  trySpawnBoss(now) {
    const state = this.state;
    if (!state?.active || state.bossSpawned || !state.bossDef) return false;

    const boss = this.scene?.bossManager?.getCurrentBoss?.() || null;
    if (boss?.isAlive) return false;

    const activeMinions = this.countActiveDirectedMinions();
    const activeElites = this.countActiveDirectedElites();
    const allMinionsSpawned = state.spawnedTotal >= state.totalBudget;
    const allElitesSpawned = state.eliteSpawned >= state.eliteTotal;

    if (!allMinionsSpawned || !allElitesSpawned) {
      state.bossQueuedAt = 0;
      return false;
    }
    if (activeMinions > 0 || activeElites > 0) {
      state.bossQueuedAt = 0;
      return false;
    }

    if (state.bossQueuedAt <= 0) {
      state.bossQueuedAt = now + state.bossDelayMs;
      return false;
    }
    if (now < state.bossQueuedAt) return false;

    const point = this.scene?.getBossArenaEntryPoint?.() || null;
    const spawnedBoss = this.scene?.spawnDirectedBoss?.({
      mapId: state.mapId,
      stage: state.stage,
      def: state.bossDef,
      point,
    }) || null;
    if (!spawnedBoss) return false;

    state.bossSpawned = true;
    state.active = false;
    return true;
  }

  getTargetAliveCount(now) {
    const state = this.state;
    if (!state) return 0;
    const elapsed = Math.max(0, Number(now || 0) - state.startedAt);
    let target = state.initialAlive;

    if (elapsed >= 30000) {
      target += state.aliveStep * 2;
    }
    if (elapsed >= 60000) {
      target += state.aliveStep * 3;
    }
    if (elapsed >= 90000) {
      target += state.aliveStep * 2;
    }

    const rampSteps = Math.floor(elapsed / state.aliveRampMs);
    target += rampSteps;
    target += this.getPacingProfile(now).targetBonus;
    target = Math.max(state.initialAlive - 1, target);
    return Math.min(state.maxAlive, target);
  }

  getBurstLimit(now) {
    const state = this.state;
    if (!state) return 1;
    const elapsed = Math.max(0, Number(now || 0) - state.startedAt);
    const earlyMax = Math.max(state.burstMin, state.burstMax - 2);
    const midMax = Math.max(state.burstMin + 1, state.burstMax - 1);
    const pacing = this.getPacingProfile(now);

    if (elapsed < 30000) {
      return Phaser.Math.Between(state.burstMin, earlyMax) + pacing.burstBonus;
    }
    if (elapsed < 60000) {
      return Phaser.Math.Between(state.burstMin + 1, midMax) + pacing.burstBonus;
    }
    return Phaser.Math.Between(Math.max(state.burstMin + 1, midMax), state.burstMax + 1) + pacing.burstBonus;
  }

  getBurstSides() {
    const state = this.state;
    if (!state) return [];
    const availableSides = this.scene?.getAvailableArenaSpawnSides?.({ offscreenPad: state.offscreenPad }) || [];
    const fallbackSides = ['top', 'right', 'bottom', 'left'];
    const sides = availableSides.length > 0 ? availableSides : fallbackSides;
    const filtered = sides.filter((side) => side !== state.safeSide);
    return filtered.length > 0 ? filtered : sides;
  }

  refreshSafeSide(now, force) {
    const state = this.state;
    if (!state) return;

    const availableSides = this.scene?.getAvailableArenaSpawnSides?.({ offscreenPad: state.offscreenPad }) || [];
    const sides = availableSides.length > 0 ? availableSides : ['top', 'right', 'bottom', 'left'];
    const pool = force ? sides : sides.filter((side) => side !== state.safeSide);
    const nextSides = pool.length > 0 ? pool : sides;
    state.safeSide = nextSides[(state.burstIndex + state.spawnCursor) % nextSides.length] || null;
    state.safeSideUntil = now + state.safeSideDurationMs;
  }

  buildClusterSeeds(spawnCount, now) {
    const state = this.state;
    if (!state) return [];
    const sides = this.getBurstSides();
    if (sides.length <= 0) return [];

    const elapsed = Math.max(0, Number(now || 0) - state.startedAt);
    const pacing = this.getPacingProfile(now);
    const baseSideCount = elapsed >= 60000 ? Math.min(3, state.maxClusterSides + 1, sides.length) : Math.min(2, sides.length);
    const clusterSideCount = Math.max(1, Math.min(sides.length, baseSideCount + pacing.clusterSideBonus));
    const clusters = [];

    for (let index = 0; index < clusterSideCount; index += 1) {
      const side = sides[(state.burstIndex + index) % sides.length];
      const baseT = Phaser.Math.Clamp(0.26 + (((state.burstIndex + index) % 5) * 0.14), 0.22, 0.78);
      const center = this.scene.buildArenaSpawnPointForSide(side, baseT, {
        offscreenPad: state.offscreenPad,
        edgeInset: state.edgeInset,
        laneInset: state.laneInset,
        jitter: state.jitter,
      });

      clusters.push({
        side,
        center,
        seed: state.burstIndex + index,
      });
    }

    return clusters;
  }

  buildClusterPoint(cluster, index, spawnCount) {
    const state = this.state;
    const radius = state?.clusterRadius || 64;
    const depthJitter = state?.clusterDepthJitter || 32;
    const point = { x: cluster.center.x, y: cluster.center.y };
    const ringIndex = index % Math.max(1, spawnCount);
    const spreadAngle = (Math.PI * 2 * ringIndex) / Math.max(3, spawnCount);
    const tangentOffset = Math.cos(spreadAngle) * radius * Phaser.Math.FloatBetween(0.35, 1);
    const depthOffset = Math.sin(spreadAngle) * depthJitter;

    if (cluster.side === 'top' || cluster.side === 'bottom') {
      point.x += tangentOffset;
      point.y += cluster.side === 'top' ? -Math.abs(depthOffset) : Math.abs(depthOffset);
    } else {
      point.y += tangentOffset;
      point.x += cluster.side === 'left' ? -Math.abs(depthOffset) : Math.abs(depthOffset);
    }

    point.x += Phaser.Math.Between(-state.jitter, state.jitter);
    point.y += Phaser.Math.Between(-state.jitter, state.jitter);

    const world = this.scene?.getArenaWorldAndViewRect?.().world;
    if (world) {
      point.x = Phaser.Math.Clamp(point.x, world.x + 24, world.right - 24);
      point.y = Phaser.Math.Clamp(point.y, world.y + 24, world.bottom - 24);
    }
    return point;
  }

  buildRoundConfig(stage, balance = {}) {
    const cellSize = Math.max(64, Math.round(this.scene?.mapConfig?.cellSize || 128));
    const totalBudget = Math.max(
      1,
      Math.round((pickSpawnCount(balance?.minions?.countMin, balance?.minions?.countMax) * 1.28) + stage * 2)
    );
    const eliteTotal = pickSpawnCount(balance?.elites?.countMin, balance?.elites?.countMax);

    return {
      stage,
      totalBudget,
      eliteTotal,
      eliteConcurrentMax: stage >= 5 ? 2 : 1,
      eliteFirstProgress: stage >= 4 ? 0.20 : 0.28,
      eliteProgressStep: stage >= 4 ? 0.15 : 0.18,
      eliteInitialDelayMs: Math.max(4200, 9000 - stage * 700),
      eliteIntervalMs: Math.max(4800, 10800 - stage * 520),
      bossDelayMs: 1400,
      initialAlive: Math.max(14, Math.min(22, Math.round(totalBudget * 0.42))),
      maxAlive: Math.max(30, Math.min(56, Math.round(totalBudget * 0.98))),
      aliveRampMs: Math.max(1200, 3600 - stage * 140),
      aliveStep: stage >= 4 ? 5 : 4,
      burstMin: stage >= 4 ? 6 : 5,
      burstMax: stage >= 4 ? 11 : 9,
      burstIntervalMs: Math.max(560, 980 - stage * 55),
      minBurstIntervalMs: 320,
      burstIntervalDecayMs: 64,
      initialDelayMs: 280,
      safeSideDurationMs: 1500,
      earlyCycleMs: 9000,
      earlySurgeMs: 7000,
      lateCycleMs: 7200,
      lateSurgeMs: 6000,
      offscreenPad: Math.max(110, Math.round(cellSize * 1.08)),
      edgeInset: Math.max(52, Math.round(cellSize * 0.55)),
      laneInset: Math.max(72, Math.round(cellSize * 0.78)),
      minPlayerDistance: Math.max(160, Math.round(cellSize * 1.32)),
      jitter: Math.max(10, Math.round(cellSize * 0.12)),
      clusterRadius: Math.max(46, Math.round(cellSize * 0.58)),
      clusterDepthJitter: Math.max(26, Math.round(cellSize * 0.34)),
      maxClusterSides: stage >= 4 ? 4 : 3,
    };
  }
}