'use client';

type AnimationCallback = (time: number, delta: number) => void;

class AnimationScheduler {
  private subscribers: Map<string, AnimationCallback> = new Map();
  private rafId: number | null = null;
  private lastTime: number = 0;
  private isPaused: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pause();
        } else {
          this.resume();
        }
      });
    }
  }

  public subscribe(id: string, callback: AnimationCallback): () => void {
    this.subscribers.set(id, callback);
    if (!this.rafId && !this.isPaused && this.subscribers.size > 0) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
    return () => this.unsubscribe(id);
  }

  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0 && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (now: number) => {
    if (this.isPaused || this.subscribers.size === 0) {
      this.rafId = null;
      return;
    }

    const delta = this.lastTime ? now - this.lastTime : 16;
    this.lastTime = now;

    this.subscribers.forEach((cb) => {
      try {
        cb(now, delta);
      } catch (err) {
        console.error('AnimationScheduler callback error:', err);
      }
    });

    this.rafId = requestAnimationFrame(this.tick);
  };

  public pause(): void {
    this.isPaused = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resume(): void {
    this.isPaused = false;
    if (this.subscribers.size > 0 && !this.rafId) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  }
}

export const animationScheduler = new AnimationScheduler();
