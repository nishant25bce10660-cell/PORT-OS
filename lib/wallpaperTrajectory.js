/**
 * PORT OS — Round 20 Derived Wallpaper Trajectory, Geometry & State Engine (ESM runtime)
 */

export const SCENE_WIDTH = 1920;
export const SCENE_HEIGHT = 1080;

export const PATH_GEOMETRY = {
  SCENE_WIDTH: 1920,
  SCENE_HEIGHT: 1080,
  LEFT_COL: 537,
  RIGHT_COL: 1370,
  TOP_Y: 50,
  BOTTOM_Y: 1029,
  SAFE_REGION: {
    minX: 220,
    maxX: 1699,
    minY: 0,
    maxY: 1080,
    width: 1479,
    height: 1080,
  },
  START_ZONE: {
    x: 537,
    y: 1029,
    radius: 160,
  },
  CORRIDOR_TOLERANCE: 90,
  STROKE1_END_PROGRESS: 0.3018,
  STROKE2_END_PROGRESS: 0.6982,
  STROKE3_END_PROGRESS: 1.0,
  FRAME_COUNT_76: 76,
  F76_STROKE1_START: 6,
  F76_STROKE1_END: 25,
  F76_STROKE2_START: 26,
  F76_STROKE2_END: 40,
  F76_STROKE3_START: 41,
  F76_STROKE3_END: 54,
  F76_RETRACT_START: 55,
  F76_RETRACT_END: 64,
  F76_SETTLE_START: 65,
  F76_SETTLE_END: 76,
};

export function computeSceneViewportMapping(viewportW, viewportH) {
  const coverScale = Math.max(viewportW / SCENE_WIDTH, viewportH / SCENE_HEIGHT);
  const safeW = 1420 - 480; // 940 px
  const safeH = 1040 - 40;  // 1000 px
  const maxSafeScale = Math.min(viewportW / safeW, viewportH / safeH);
  const scale = Math.min(coverScale, maxSafeScale);
  const offsetX = (viewportW - SCENE_WIDTH * scale) / 2;
  const offsetY = (viewportH - SCENE_HEIGHT * scale) / 2;
  return { scale, offsetX, offsetY };
}

export function sceneToViewport(sceneX, sceneY, viewportW, viewportH) {
  const { scale, offsetX, offsetY } = computeSceneViewportMapping(viewportW, viewportH);
  return {
    x: sceneX * scale + offsetX,
    y: sceneY * scale + offsetY,
  };
}

export function viewportToScene(vpX, vpY, viewportW, viewportH) {
  const { scale, offsetX, offsetY } = computeSceneViewportMapping(viewportW, viewportH);
  return {
    x: (vpX - offsetX) / scale,
    y: (vpY - offsetY) / scale,
  };
}

export function getIdealPointForProgress(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const s1End = PATH_GEOMETRY.STROKE1_END_PROGRESS;
  const s2End = PATH_GEOMETRY.STROKE2_END_PROGRESS;

  if (p <= s1End) {
    const t = p / s1End;
    const y = PATH_GEOMETRY.BOTTOM_Y - t * (PATH_GEOMETRY.BOTTOM_Y - PATH_GEOMETRY.TOP_Y);
    return { x: PATH_GEOMETRY.LEFT_COL, y, stroke: 1 };
  } else if (p <= s2End) {
    const t = (p - s1End) / (s2End - s1End);
    const x = PATH_GEOMETRY.LEFT_COL + t * (PATH_GEOMETRY.RIGHT_COL - PATH_GEOMETRY.LEFT_COL);
    const y = PATH_GEOMETRY.TOP_Y + t * (PATH_GEOMETRY.BOTTOM_Y - PATH_GEOMETRY.TOP_Y);
    return { x, y, stroke: 2 };
  } else {
    const t = (p - s2End) / (1.0 - s2End);
    const y = PATH_GEOMETRY.BOTTOM_Y - t * (PATH_GEOMETRY.BOTTOM_Y - PATH_GEOMETRY.TOP_Y);
    return { x: PATH_GEOMETRY.RIGHT_COL, y, stroke: 3 };
  }
}

export function progressToFrame(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const s1End = PATH_GEOMETRY.STROKE1_END_PROGRESS;
  const s2End = PATH_GEOMETRY.STROKE2_END_PROGRESS;

  if (p <= s1End) {
    const t = p / s1End;
    return PATH_GEOMETRY.F76_STROKE1_START + t * (PATH_GEOMETRY.F76_STROKE1_END - PATH_GEOMETRY.F76_STROKE1_START);
  } else if (p <= s2End) {
    const t = (p - s1End) / (s2End - s1End);
    return PATH_GEOMETRY.F76_STROKE2_START + t * (PATH_GEOMETRY.F76_STROKE2_END - PATH_GEOMETRY.F76_STROKE2_START);
  } else {
    const t = (p - s2End) / (1.0 - s2End);
    return PATH_GEOMETRY.F76_STROKE3_START + t * (PATH_GEOMETRY.F76_STROKE3_END - PATH_GEOMETRY.F76_STROKE3_START);
  }
}

export function projectPointerOntoCorridor(sceneX, sceneY, currentProgress, searchRadius = 0.08, tolerance = PATH_GEOMETRY.CORRIDOR_TOLERANCE) {
  const steps = 30;
  const minP = Math.max(0, currentProgress - searchRadius);
  const maxP = Math.min(1.0, currentProgress + searchRadius);

  let bestP = currentProgress;
  let bestDist = Infinity;

  for (let i = 0; i <= steps; i++) {
    const p = minP + (i / steps) * (maxP - minP);
    const pt = getIdealPointForProgress(p);
    const d = Math.hypot(sceneX - pt.x, sceneY - pt.y);
    if (d < bestDist) {
      bestDist = d;
      bestP = p;
    }
  }

  if (bestDist <= tolerance) {
    return { progress: bestP, distance: bestDist };
  }
  return null;
}

export function isInStartZone(sceneX, sceneY) {
  const d = Math.hypot(sceneX - PATH_GEOMETRY.START_ZONE.x, sceneY - PATH_GEOMETRY.START_ZONE.y);
  return d <= PATH_GEOMETRY.START_ZONE.radius;
}
