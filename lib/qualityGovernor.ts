'use client';

export type QualityTier = 'high' | 'medium' | 'low';
export type QualityMode = 'auto' | 'high' | 'low';

class QualityGovernor {
  private currentTier: QualityTier = 'high';
  private mode: QualityMode = 'auto';
  private frameDeltas: number[] = [];
  private highLatencyStartTime: number | null = null;
  private stableStartTime: number | null = null;
  private listeners: Set<(tier: QualityTier) => void> = new Set();
  private rafId: number | null = null;
  private lastTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('portos_performance_mode') as QualityMode | null;
      if (storedMode) {
        this.setMode(storedMode);
      } else {
        this.applyTier('high');
        this.initAutoMonitor();
      }
    }
  }

  public setMode(mode: QualityMode): void {
    this.mode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('portos_performance_mode', mode);
    }
    if (mode === 'high') {
      this.applyTier('high');
      this.stopAutoMonitor();
    } else if (mode === 'low') {
      this.applyTier('low');
      this.stopAutoMonitor();
    } else {
      this.initAutoMonitor();
    }
  }

  public getMode(): QualityMode {
    return this.mode;
  }

  public getTier(): QualityTier {
    return this.currentTier;
  }

  public onTierChange(cb: (tier: QualityTier) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public applyTier(tier: QualityTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-quality-tier', tier);
      document.documentElement.setAttribute('data-quality-tier', tier);
    }
    this.listeners.forEach((cb) => cb(tier));
  }

  private initAutoMonitor(): void {
    if (this.rafId || typeof window === 'undefined') return;
    this.lastTime = performance.now();
    this.frameDeltas = [];

    const handleVisibility = () => {
      if (document.hidden) {
        this.stopAutoMonitor();
      } else if (this.mode === 'auto') {
        this.initAutoMonitor();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const monitor = (now: number) => {
      if (document.hidden) {
        this.stopAutoMonitor();
        return;
      }

      const delta = now - this.lastTime;
      this.lastTime = now;

      this.frameDeltas.push(delta);
      if (this.frameDeltas.length > 90) {
        this.frameDeltas.shift();
      }

      // Check p95 periodically (every 10 frames) to minimize garbage collection
      if (this.frameDeltas.length % 10 === 0 && this.frameDeltas.length >= 15) {
        const sorted = [...this.frameDeltas].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)];

        // Fast adaptive step-down: immediate drop if frame spikes >40ms, or if p95 > 22ms for ~1.8s
        if (delta > 40 || p95 > 22) {
          this.stableStartTime = null;
          if (delta > 40) {
            if (this.currentTier === 'high') {
              this.applyTier('medium');
              this.highLatencyStartTime = now;
            } else if (this.currentTier === 'medium') {
              this.applyTier('low');
              this.highLatencyStartTime = null;
            }
          } else if (this.highLatencyStartTime === null) {
            this.highLatencyStartTime = now;
          } else if (now - this.highLatencyStartTime >= 1800) {
            if (this.currentTier === 'high') {
              this.applyTier('medium');
              this.highLatencyStartTime = now;
            } else if (this.currentTier === 'medium') {
              this.applyTier('low');
              this.highLatencyStartTime = null;
            }
          }
        } else {
          this.highLatencyStartTime = null;
          // Step back up after 10s of stable frames (p95 <= 18ms)
          if (p95 <= 18) {
            if (this.stableStartTime === null) {
              this.stableStartTime = now;
            } else if (now - this.stableStartTime >= 10000) {
              if (this.currentTier === 'low') {
                this.applyTier('medium');
                this.stableStartTime = now;
              } else if (this.currentTier === 'medium') {
                this.applyTier('high');
                this.stableStartTime = null;
              }
            }
          } else {
            this.stableStartTime = null;
          }
        }
      }

      this.rafId = requestAnimationFrame(monitor);
    };

    this.rafId = requestAnimationFrame(monitor);
  }

  private stopAutoMonitor(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const qualityGovernor = new QualityGovernor();
