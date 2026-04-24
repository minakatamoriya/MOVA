export const CORE_DEFENSE_LAYOUT = {
  entranceRatio: 0.12,
  frontlineRatio: 0.30,
  midRatio: 0.23,
  coreRatio: 0.35,
  coreYRatio: 0.78,
  coreRadius: 52,
  coreThreatRadius: 224,
  corePressureRadius: 132,
  playerStartYRatio: 0.34,
  leftLaneCenterRatio: 0.23,
  midLaneCenterRatio: 0.5,
  rightLaneCenterRatio: 0.77,
  laneWidthRatio: 0.28,
  spawnOffscreenMargin: 56,
};

export function buildArenaMetrics(width, height) {
  const safeWidth = Math.max(1, Number(width || 720));
  const safeHeight = Math.max(1, Number(height || 1280));
  const entranceHeight = safeHeight * CORE_DEFENSE_LAYOUT.entranceRatio;
  const frontlineHeight = safeHeight * CORE_DEFENSE_LAYOUT.frontlineRatio;
  const midHeight = safeHeight * CORE_DEFENSE_LAYOUT.midRatio;
  const coreHeight = safeHeight - entranceHeight - frontlineHeight - midHeight;

  const zones = {
    entrance: { y: 0, height: entranceHeight },
    frontline: { y: entranceHeight, height: frontlineHeight },
    mid: { y: entranceHeight + frontlineHeight, height: midHeight },
    core: { y: entranceHeight + frontlineHeight + midHeight, height: coreHeight },
  };

  const laneCenters = {
    left: safeWidth * CORE_DEFENSE_LAYOUT.leftLaneCenterRatio,
    mid: safeWidth * CORE_DEFENSE_LAYOUT.midLaneCenterRatio,
    right: safeWidth * CORE_DEFENSE_LAYOUT.rightLaneCenterRatio,
  };

  const laneWidth = safeWidth * CORE_DEFENSE_LAYOUT.laneWidthRatio;
  const core = {
    x: safeWidth * 0.5,
    y: safeHeight * CORE_DEFENSE_LAYOUT.coreYRatio,
    radius: CORE_DEFENSE_LAYOUT.coreRadius,
    threatRadius: CORE_DEFENSE_LAYOUT.coreThreatRadius,
    pressureRadius: CORE_DEFENSE_LAYOUT.corePressureRadius,
  };

  return {
    width: safeWidth,
    height: safeHeight,
    zones,
    laneCenters,
    laneWidth,
    core,
    playerStart: {
      x: safeWidth * 0.5,
      y: safeHeight * CORE_DEFENSE_LAYOUT.playerStartYRatio,
    },
    spawnY: -Math.max(24, Number(CORE_DEFENSE_LAYOUT.spawnOffscreenMargin || 56)),
  };
}
