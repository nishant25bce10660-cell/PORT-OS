/**
 * PORT OS — Round 20 Derived Wallpaper Trajectory, Geometry & State Engine
 * Grounded in measured path data from public/wallpaper/wallpaper-path.json (1920x1080 scene).
 */

export type WallpaperState =
  | 'INACTIVE'
  | 'READY'
  | 'FOLLOWING'
  | 'HOLD'
  | 'COMPLETING'
  | 'COMPLETE'
  | 'RESETTING'
  | 'ERROR_RECOVERY';

export const SCENE_WIDTH = 1920;
export const SCENE_HEIGHT = 1080;

// Measured N Geometry from scripts/derive-wallpaper-path.mjs
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
  CORRIDOR_TOLERANCE: 90, // px at 1080p scene scale
  // Milestone progress points (0.0 to 1.0 along the 3 strokes)
  STROKE1_END_PROGRESS: 0.3018,
  STROKE2_END_PROGRESS: 0.6982,
  STROKE3_END_PROGRESS: 1.0,
  // 76-frame index milestones
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

/**
 * Computes exact viewport-to-scene scale and offset.
 * Guarantees that the whole N safe region is always visible and reachable on any viewport (desktop, ultrawide, phone).
 */
export function computeSceneViewportMapping(viewportW: number, viewportH: number): {
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  const coverScale = Math.max(viewportW / SCENE_WIDTH, viewportH / SCENE_HEIGHT);
  // Safe bounds containing the full N polyline with drawing tolerance
  const safeW = 1420 - 480; // 940 px
  const safeH = 1040 - 40;  // 1000 px
  
  // The maximum scale that allows the safe N region to fit fully inside the viewport
  const maxSafeScale = Math.min(viewportW / safeW, viewportH / safeH);
  
  // Use coverScale unless it clips the N; clamp to maxSafeScale on extreme aspect ratios
  const scale = Math.min(coverScale, maxSafeScale);
  
  // Center scene in viewport
  const offsetX = (viewportW - SCENE_WIDTH * scale) / 2;
  const offsetY = (viewportH - SCENE_HEIGHT * scale) / 2;

  return { scale, offsetX, offsetY };
}

/**
 * Maps scene coordinates (1920x1080) to viewport coordinates (screen px).
 */
export function sceneToViewport(
  sceneX: number,
  sceneY: number,
  viewportW: number,
  viewportH: number
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = computeSceneViewportMapping(viewportW, viewportH);
  return {
    x: sceneX * scale + offsetX,
    y: sceneY * scale + offsetY,
  };
}

/**
 * Maps viewport coordinates (screen px) to scene coordinates (1920x1080).
 */
export function viewportToScene(
  vpX: number,
  vpY: number,
  viewportW: number,
  viewportH: number
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = computeSceneViewportMapping(viewportW, viewportH);
  return {
    x: (vpX - offsetX) / scale,
    y: (vpY - offsetY) / scale,
  };
}

/**
 * Calculates progress (0 to 1) along the N polyline given scene (X, Y).
 * Evaluates points in 3 sequential strokes:
 * - Stroke 1: (537, 1029) -> (537, 50)
 * - Stroke 2: (537, 50) -> (1370, 1029)
 * - Stroke 3: (1370, 1029) -> (1370, 50)
 */
export function getIdealPointForProgress(progress: number): { x: number; y: number; stroke: 1 | 2 | 3 } {
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

/**
 * Converts progress along the N (0.0 to 1.0) to fractional frame index (6.0 to 54.0 in 76-frame tier).
 */
export function progressToFrame(progress: number): number {
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

/**
 * Projects a cursor scene position (sceneX, sceneY) onto the corridor around current progress.
 * Restricts search to a bounded local window around current progress (±8% of total path).
 * Returns new progress if within corridor tolerance (90px), or null to hold.
 */
export function projectPointerOntoCorridor(
  sceneX: number,
  sceneY: number,
  currentProgress: number,
  searchRadius: number = 0.08,
  tolerance: number = PATH_GEOMETRY.CORRIDOR_TOLERANCE
): { progress: number; distance: number } | null {
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

/**
 * Checks if pointer is inside the initial start capture zone (radius 160px around bottom left of Stroke 1).
 */
export function isInStartZone(sceneX: number, sceneY: number): boolean {
  const d = Math.hypot(sceneX - PATH_GEOMETRY.START_ZONE.x, sceneY - PATH_GEOMETRY.START_ZONE.y);
  return d <= PATH_GEOMETRY.START_ZONE.radius;
}
