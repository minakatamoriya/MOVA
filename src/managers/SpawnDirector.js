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
      reinforcementSpawned: 0,
      eliteTotal,
      eliteSpawned: 0,
      eliteConcurrentMax: Math.max(1, Math.round(Number(config.eliteConcurrentMax) || 1)),
      eliteFirstProgress: Phaser.Math.Clamp(Number(config.eliteFirstProgress) || 0.28, 0.08, 0.95),
      eliteProgressStep: Phaser.Math.Clamp(Number(config.eliteProgressStep) || 0.18, 0.05, 0.4),
      eliteInitialDelayMs: Math.max(1200, Math.round(Number(config.eliteInitialDelayMs) || 12000)),
      eliteIntervalMs: Math.max(1200, Math.round(Number(config.eliteIntervalMs) || 16000)),
      nextEliteAt: now + Math.max(1200, Math.round(Number(config.eliteInitialDelayMs) || 12000)),
      bossDelayMs: Math.max(0, Math.round(Number(config.bossDelayMs) || 1600)),
      bossQueuedAt: 0,
      bossSpawned: false,
      initialAlive,
      maxAlive,
      aliveRampMs: Math.max(900, Math.round(Number(config.aliveRampMs) || 4200)),
      aliveStep: Math.max(1, Math.round(Number(config.aliveStep) || 3)),
      burstMin: Math.max(1, Math.round(Number(config.burstMin) || 4)),
      burstMax: Math.max(1, Math.round(Number(config.burstMax) || 7)),
      burstIntervalMs: Math.max(360, Math.round(Number(config.burstIntervalMs) || 980)),
      minBurstIntervalMs: Math.max(220, Math.round(Number(config.minBurstIntervalMs) || 520)),
      burstIntervalDecayMs: Math.max(0, Math.round(Number(config.burstIntervalDecayMs) || 70)),
      safeSideDurationMs: Math.max(900, Math.round(Number(config.safeSideDurationMs) || 1800)),
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
      reinforcementAliveFloor: Math.max(
        5,
        Math.round(Number(config.reinforcementAliveFloor) || Math.max(8, Math.min(maxAlive - 2, initialAlive * 0.9)))
      ),
      reinforcementBurstMin: Math.max(1, Math.round(Number(config.reinforcementBurstMin) || 3)),
      reinforcementBurstMax: Math.max(1, Math.round(Number(config.reinforcementBurstMax) || 5)),
      reinforcementIntervalScale: Phaser.Math.Clamp(Number(config.reinforcementIntervalScale) || 0.68, 0.45, 1.2),
      earlyCycleMs: Math.max(4200, Math.round(Number(config.earlyCycleMs) || 7200)),
      earlySurgeMs: Math.max(2600, Math.round(Number(config.earlySurgeMs) || 5600)),
      lateCycleMs: Math.max(3600, Math.round(Number(config.lateCycleMs) || 5400)),
      lateSurgeMs: Math.max(2200, Math.round(Number(config.lateSurgeMs) || 4200)),
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

    if ((state.minionDefs || []).length === 0) {
      return;
    }

    if (now < state.nextBurstAt) return;

    const pacing = this.getPacingProfile(now);
    const activeElites = this.countActiveDirectedElites();
    const reinforcementMode = this.shouldSpawnReinforcements(activeElites);
    if (!reinforcementMode && state.spawnedTotal >= state.totalBudget) {
      return;
    }

    const aliveMinions = this.countActiveDirectedMinions();
    const targetAlive = reinforcementMode
      ? this.getReinforcementTargetAlive(now, activeElites)
      : this.getTargetAliveCount(now);
    if (aliveMinions >= targetAlive) {
      const idleDelay = reinforcementMode
        ? (pacing.isSurge ? 60 : 90)
        : (pacing.isSurge ? 80 : 120);
      const idleScale = reinforcementMode
        ? state.reinforcementIntervalScale * 0.18
        : (pacing.isSurge ? 0.12 : 0.18);
      state.nextBurstAt = now + Math.min(idleDelay, Math.round(state.burstIntervalMs * idleScale));
      return;
    }

    const remainingBudget = Math.max(0, state.totalBudget - state.spawnedTotal);
    const burstLimit = reinforcementMode
      ? Math.max(1, this.getReinforcementBurstLimit(now, activeElites))
      : Math.max(1, this.getBurstLimit(now));
    const spawnCount = reinforcementMode
      ? Math.min(targetAlive - aliveMinions, burstLimit)
      : Math.min(remainingBudget, targetAlive - aliveMinions, burstLimit);
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

      const waveIndex = reinforcementMode
        ? (state.totalBudget + state.reinforcementSpawned)
        : state.spawnedTotal;
      const minion = scene.spawnDirectedMinion?.({
        mapId: state.mapId,
        stage: state.stage,
        point,
        def,
        waveIndex,
      }) || null;
      if (!minion) continue;

      minion.spawnDirectorWave = true;
      if (!reinforcementMode) {
        state.spawnedTotal += 1;
      } else {
        state.reinforcementSpawned += 1;
      }
      spawnedThisBurst += 1;
    }

    state.burstIndex += 1;
    const nextInterval = Math.max(
      state.minBurstIntervalMs,
      Math.round(
        (state.burstIntervalMs - (state.burstIndex * state.burstIntervalDecayMs))
        * pacing.intervalMult
        * (reinforcementMode ? state.reinforcementIntervalScale : 1)
      )
    );
    state.nextBurstAt = now + nextInterval;
    if (spawnedThisBurst <= 0) {
      state.nextBurstAt = now + (reinforcementMode ? (pacing.isSurge ? 90 : 120) : (pacing.isSurge ? 120 : 180));
    }
  }

  shouldSpawnReinforcements(activeElites = 0) {
    const state = this.state;
    if (!state?.active) return false;
    if (state.totalBudget <= 0 || state.spawnedTotal < state.totalBudget) return false;
    if ((state.minionDefs || []).length <= 0) return false;

    const elitesPending = state.eliteSpawned < state.eliteTotal;
    return elitesPending || activeElites > 0;
  }

  getReinforcementTargetAlive(now, activeElites = 0) {
    const state = this.state;
    if (!state) return 0;

    const pacing = this.getPacingProfile(now);
    const elitePressureBonus = Math.min(4, Math.max(0, activeElites) * 2);
    const target = state.reinforcementAliveFloor + elitePressureBonus + Math.max(0, pacing.targetBonus - 1);
    return Math.min(Math.max(state.reinforcementAliveFloor, target), Math.max(state.reinforcementAliveFloor, state.maxAlive - 2));
  }

  getReinforcementBurstLimit(now, activeElites = 0) {
    const state = this.state;
    if (!state) return 1;

    const pacing = this.getPacingProfile(now);
    const maxBurst = Math.max(state.reinforcementBurstMin, state.reinforcementBurstMax + (activeElites > 0 ? 1 : 0));
    return Phaser.Math.Between(state.reinforcementBurstMin, maxBurst) + Math.max(0, pacing.burstBonus - 1);
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
      targetBonus: isSurge ? (isLateGame ? 7 : 5) : (isLateGame ? 4 : 3),
      burstBonus: isSurge ? (isLateGame ? 4 : 3) : 1,
      intervalMult: isSurge ? (isLateGame ? 0.42 : 0.54) : (isLateGame ? 0.62 : 0.74),
      clusterSideBonus: isSurge ? (isLateGame ? 2 : 2) : 1,
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

    if (elapsed >= 20000) {
      target += state.aliveStep * 2;
    }
    if (elapsed >= 45000) {
      target += state.aliveStep * 3;
    }
    if (elapsed >= 70000) {
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
    const earlyMax = Math.max(state.burstMin + 1, state.burstMax - 1);
    const midMax = Math.max(state.burstMin + 2, state.burstMax);
    const pacing = this.getPacingProfile(now);

    if (elapsed < 25000) {
      return Phaser.Math.Between(state.burstMin, earlyMax) + pacing.burstBonus;
    }
    if (elapsed < 55000) {
      return Phaser.Math.Between(state.burstMin + 1, midMax) + pacing.burstBonus;
    }
    return Phaser.Math.Between(Math.max(state.burstMin + 1, midMax), state.burstMax + 1) + pacing.burstBonus;
  }

  getPlayerFlowVector() {
    const player = this.scene?.player;
    const vx = Number(player?.worldVelocity?.x || 0);
    const vy = Number(player?.worldVelocity?.y || 0);
    const speed = Math.hypot(vx, vy);
    if (speed > 0.001) {
      return { x: vx / speed, y: vy / speed, speed };
    }

    const lx = Number(player?.lastMoveIntent?.x || 0);
    const ly = Number(player?.lastMoveIntent?.y || 0);
    const lastSpeed = Math.hypot(lx, ly);
    if (lastSpeed > 0.001) {
      return { x: lx / lastSpeed, y: ly / lastSpeed, speed: lastSpeed };
    }

    return { x: 0, y: 1, speed: 0 };
  }

  scoreSpawnSide(side) {
    const flow = this.getPlayerFlowVector();
    const normals = {
      top: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    };
    const normal = normals[side] || { x: 0, y: 0 };
    const forwardDot = (normal.x * flow.x) + (normal.y * flow.y);
    const sideCross = Math.abs((normal.x * flow.y) - (normal.y * flow.x));
    return forwardDot + sideCross * 0.42;
  }

  getBurstSides() {
    const state = this.state;
    if (!state) return [];
    const availableSides = this.scene?.getAvailableArenaSpawnSides?.({ offscreenPad: state.offscreenPad }) || [];
    const fallbackSides = ['top', 'right', 'bottom', 'left'];
    const sides = availableSides.length > 0 ? availableSides : fallbackSides;
    const filtered = sides.filter((side) => side !== state.safeSide);
    const ranked = (filtered.length > 0 ? filtered : sides).slice().sort((a, b) => this.scoreSpawnSide(b) - this.scoreSpawnSide(a));
    return ranked;
  }

  refreshSafeSide(now, force) {
    const state = this.state;
    if (!state) return;

    const availableSides = this.scene?.getAvailableArenaSpawnSides?.({ offscreenPad: state.offscreenPad }) || [];
    const sides = availableSides.length > 0 ? availableSides : ['top', 'right', 'bottom', 'left'];
    const ranked = sides.slice().sort((a, b) => this.scoreSpawnSide(a) - this.scoreSpawnSide(b));
    const pool = force ? ranked : ranked.filter((side) => side !== state.safeSide);
    const nextSides = pool.length > 0 ? pool : ranked;
    state.safeSide = nextSides[0] || null;
    state.safeSideUntil = now + state.safeSideDurationMs;
  }

  buildClusterSeeds(spawnCount, now) {
    const state = this.state;
    if (!state) return [];
    const sides = this.getBurstSides();
    if (sides.length <= 0) return [];

    const elapsed = Math.max(0, Number(now || 0) - state.startedAt);
    const pacing = this.getPacingProfile(now);
    const baseSideCount = elapsed >= 45000 ? Math.min(3, state.maxClusterSides + 1, sides.length) : Math.min(3, sides.length);
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
    const initialAlive = Math.max(18, Math.min(28, Math.round(totalBudget * 0.56)));
    const maxAlive = Math.max(36, Math.min(68, Math.round(totalBudget * 1.18)));

    return {
      stage,
      totalBudget,
      eliteTotal,
      eliteConcurrentMax: stage >= 5 ? 2 : 1,
      eliteFirstProgress: stage >= 4 ? 0.16 : 0.22,
      eliteProgressStep: stage >= 4 ? 0.12 : 0.15,
      eliteInitialDelayMs: Math.max(3200, 6800 - stage * 520),
      eliteIntervalMs: Math.max(3600, 7600 - stage * 420),
      bossDelayMs: 1400,
      initialAlive,
      maxAlive,
      aliveRampMs: Math.max(900, 2400 - stage * 110),
      aliveStep: stage >= 4 ? 6 : 5,
      burstMin: stage >= 4 ? 7 : 6,
      burstMax: stage >= 4 ? 13 : 11,
      reinforcementAliveFloor: Math.max(10, Math.min(maxAlive - 3, Math.round(initialAlive * 0.96))),
      reinforcementBurstMin: stage >= 4 ? 4 : 3,
      reinforcementBurstMax: stage >= 4 ? 7 : 6,
      reinforcementIntervalScale: stage >= 4 ? 0.6 : 0.68,
      burstIntervalMs: Math.max(420, 760 - stage * 42),
      minBurstIntervalMs: 240,
      burstIntervalDecayMs: 64,
      initialDelayMs: 120,
      safeSideDurationMs: 1000,
      earlyCycleMs: 6800,
      earlySurgeMs: 5200,
      lateCycleMs: 5000,
      lateSurgeMs: 3900,
      offscreenPad: Math.max(110, Math.round(cellSize * 1.08)),
      edgeInset: Math.max(52, Math.round(cellSize * 0.55)),
      laneInset: Math.max(72, Math.round(cellSize * 0.78)),
      minPlayerDistance: Math.max(160, Math.round(cellSize * 1.32)),
      jitter: Math.max(10, Math.round(cellSize * 0.12)),
      clusterRadius: Math.max(46, Math.round(cellSize * 0.58)),
      clusterDepthJitter: Math.max(26, Math.round(cellSize * 0.34)),
      maxClusterSides: 4,
    };
  }
}