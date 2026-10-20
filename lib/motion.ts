/**
 * PORT OS Motion System
 * Precision spring physics and timing curves.
 */

export const MOTION = {
  curves: {
    easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.2, 0.9, 0.3, 1.25)',
  },
  durations: {
    instant: 0,
    fast: 120,
    normal: 200,
    spring: 320,
    slow: 520,
    glide: 900,
    ambient: 1600,
  },
  springs: {
    window: { stiffness: 320, damping: 26 },
    dock: { stiffness: 420, damping: 18 },
  },
} as const;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
