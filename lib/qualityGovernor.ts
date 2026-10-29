'use client';

export type QualityTier = 'high' | 'medium' | 'low';

type TierChangeListener = (tier: QualityTier) => void;

class QualityGovernor {
  private currentTier: QualityTier = 'high';
  private forcedTier: QualityTier | null = null;
  private listeners: Set<TierChangeListener> = new Set();
  private cleanWindowCount = 0;

  getTier(): QualityTier {
    return this.forcedTier || this.currentTier;
  }

  getMode(): QualityTier {
    return this.getTier();
  }

  setMode(mode: QualityTier): void {
    this.forcedTier = mode;
    this.notify();
  }

  setForcedTier(tier: QualityTier | null): void {
    this.forcedTier = tier;
    this.notify();
  }

  applyTier(tier: QualityTier): void {
    if (this.currentTier !== tier) {
      this.currentTier = tier;
      this.notify();
    }
  }

  // 3-clean-window recovery rule (S11)
  recordSample(fps: number): void {
    if (this.forcedTier) return;

    if (fps < 35 && this.currentTier === 'high') {
      this.currentTier = 'medium';
      this.cleanWindowCount = 0;
      this.notify();
    } else if (fps < 20 && this.currentTier === 'medium') {
      this.currentTier = 'low';
      this.cleanWindowCount = 0;
      this.notify();
    } else if (fps >= 55) {
      this.cleanWindowCount++;
      if (this.cleanWindowCount >= 3) {
        if (this.currentTier === 'low') {
          this.currentTier = 'medium';
          this.cleanWindowCount = 0;
          this.notify();
        } else if (this.currentTier === 'medium') {
          this.currentTier = 'high';
          this.cleanWindowCount = 0;
          this.notify();
        }
      }
    } else {
      this.cleanWindowCount = 0;
    }
  }

  onTierChange(listener: TierChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const tier = this.getTier();
    for (const listener of this.listeners) {
      try {
        listener(tier);
      } catch {}
    }
  }
}

export const qualityGovernor = new QualityGovernor();
