/**
 * PORT OS — Round 19 Interactive Mirror Wallpaper Engine (SPEC S1–S14)
 * Scale- and position-invariant N recognizer, critically-damped smoothing,
 * dual-layer frame/trail rendering, ImageBitmap LRU cache, and quality governor.
 */

import { QualityTier, qualityGovernor } from './qualityGovernor';

export type MirrorState = 'IDLE' | 'WAKE' | 'DRAWING' | 'COMPLETE' | 'RESETTING';

export interface MirrorManifest {
  count: number;
  width: number;
  height: number;
  durationSec: number;
  keyframes: {
    ready: number;       // 0.25 (index ~75)
    stroke1End: number;  // 0.375 (index ~112)
    stroke2End: number;  // 0.52 (index ~155)
    stroke3End: number;  // 0.77 (index ~230)
    end: number;         // 1.0 (index 299)
  };
  bytesHi: number;
  bytesMed: number;
  frame0Bytes: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
  speed: number;
}

export interface Drip {
  x: number;
  y: number;
  len: number;
  alpha: number;
}

export class MirrorEngine {
  private frameCanvas: HTMLCanvasElement;
  private trailCanvas: HTMLCanvasElement;
  private frameCtx: CanvasRenderingContext2D | null = null;
  private trailCtx: CanvasRenderingContext2D | null = null;

  public state: MirrorState = 'IDLE';
  public manifest: MirrorManifest | null = null;

  // Frame indices & timing
  public targetFrame: number = 0;
  public displayFrame: number = 0;
  public drawnFrame: number = -1;
  public drawnFramesCount: number = 0;
  public rafCount: number = 0;

  // LRU ImageBitmap cache (S9)
  private cache: Map<number, ImageBitmap> = new Map();
  private pendingFetches: Set<number> = new Set();
  private currentTier: QualityTier = 'high';
  private unregisterGovernor: (() => void) | null = null;

  // State transitions & animations
  private wakeStartTime: number = 0;
  private completeStartTime: number = 0;
  private completeStartFrame: number = 0;
  private resetStartTime: number = 0;
  private resetStartFrame: number = 0;
  private isRafRunning: boolean = false;
  private rafHandle: number | null = null;
  private lastRafTime: number = 0;

  // Idle reset clock (S7)
  private lastWallpaperMoveTime: number = 0;
  private idleCheckTimer: NodeJS.Timeout | null = null;
  public timerCount: number = 0;

  // Gating & Pointer (S3)
  private isPointerOnWallpaper: boolean = false;
  private isPointerInteracting: boolean = false;
  private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };
  private pauseTimestamp: number = 0;

  // Scale- & Position-Invariant N Recognizer (S4)
  private strokeIndex: 1 | 2 | 3 = 1;
  private strokeStart: { x: number; y: number } = { x: 0, y: 0 };
  private strokePeak: { x: number; y: number } = { x: 0, y: 0 };
  private strokeValley: { x: number; y: number } = { x: 0, y: 0 };
  private stroke1Length: number = 0;
  private lastGoodProgressTime: number = 0;
  private strokeProgress: number = 0;

  // Mirror Trail Canvas (S6)
  private trailRing: TrailPoint[] = [];
  private lastDripTime: number = 0;
  private drips: Drip[] = [];
  private lastTrailDrawnIndex: number = 0;
  private trailOpacity: number = 1.0;

  // ResizeObserver & Parallax (S5, S10)
  private resizeObserver: ResizeObserver | null = null;
  private debounceResizeTimer: NodeJS.Timeout | null = null;
  public parallaxOffset: { x: number; y: number } = { x: 0, y: 0 };

  // Listener management (D5)
  public listenerCount: number = 0;

  // Completion session latch (D1)
  private isPermanentlyCompleted: boolean = false;

  constructor(frameCanvas: HTMLCanvasElement, trailCanvas: HTMLCanvasElement) {
    this.frameCanvas = frameCanvas;
    this.trailCanvas = trailCanvas;
    this.frameCtx = frameCanvas.getContext('2d', { alpha: false });
    this.trailCtx = trailCanvas.getContext('2d', { alpha: true });

    this.currentTier = qualityGovernor.getTier();
    this.unregisterGovernor = qualityGovernor.onTierChange((t) => this.onTierChanged(t));

    this.initResize();
    this.bindWindowEvents();
    this.setupTestHook();
  }

  public async init(manifestData?: MirrorManifest): Promise<void> {
    if (manifestData) {
      this.manifest = manifestData;
    } else {
      try {
        const res = await fetch('/wallpaper/mirror/manifest.json');
        if (res.ok) {
          this.manifest = await res.json();
        }
      } catch (err) {
        console.warn('MirrorEngine: Could not fetch manifest, using fallback keyframes');
      }
    }

    if (!this.manifest) {
      this.manifest = {
        count: 300,
        width: 1920,
        height: 1080,
        durationSec: 10.0,
        keyframes: {
          ready: 0.25,
          stroke1End: 0.375,
          stroke2End: 0.52,
          stroke3End: 0.77,
          end: 1.0,
        },
        bytesHi: 71826780,
        bytesMed: 42797070,
        frame0Bytes: 290380,
      };
    }

    // Preload frame 0 immediately
    await this.ensureFrame(0);
    this.renderFrame(0);
  }

  // -------------------------------------------------------------
  // Dynamic Quality Governor (S11)
  // -------------------------------------------------------------
  private onTierChanged(newTier: QualityTier): void {
    if (this.currentTier !== newTier) {
      this.currentTier = newTier;
      // Clear cache on tier switch to free memory
      this.clearCache();
      this.ensureFrame(Math.round(this.displayFrame)).then(() => {
        this.renderFrame(this.displayFrame);
      });
    }
  }

  public setTier(tier: QualityTier): void {
    qualityGovernor.setMode(tier);
  }

  // -------------------------------------------------------------
  // ImageBitmap LRU Cache & Prefetching (S9)
  // -------------------------------------------------------------
  private getMaxCacheSize(): number {
    return this.currentTier === 'medium' ? 36 : 24;
  }

  private clearCache(): void {
    for (const bitmap of this.cache.values()) {
      try {
        bitmap.close();
      } catch {}
    }
    this.cache.clear();
  }

  private async fetchBitmap(index: number): Promise<ImageBitmap | null> {
    const tierFolder = this.currentTier === 'medium' ? 'med' : 'hi';
    const filename = `f_${String(index).padStart(3, '0')}.webp`;
    const url = `/wallpaper/mirror/${tierFolder}/${filename}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      return bitmap;
    } catch {
      return null;
    }
  }

  public async ensureFrame(index: number): Promise<ImageBitmap | null> {
    if (this.cache.has(index)) {
      const b = this.cache.get(index)!;
      // Refresh in LRU order
      this.cache.delete(index);
      this.cache.set(index, b);
      return b;
    }

    if (this.pendingFetches.has(index)) {
      return null;
    }

    this.pendingFetches.add(index);
    const bitmap = await this.fetchBitmap(index);
    this.pendingFetches.delete(index);

    if (bitmap) {
      // Evict if exceeding cap
      const maxBitmaps = this.getMaxCacheSize();
      if (this.cache.size >= maxBitmaps) {
        const oldestIndex = this.cache.keys().next().value;
        if (oldestIndex !== undefined) {
          const old = this.cache.get(oldestIndex);
          try {
            old?.close();
          } catch {}
          this.cache.delete(oldestIndex);
        }
      }
      this.cache.set(index, bitmap);
    }
    return bitmap;
  }

  private prefetchLookahead(currentIndex: number, forward: boolean = true): void {
    if (!this.manifest) return;
    const count = this.manifest.count;
    const step = forward ? 1 : -1;
    const windowSize = 12;

    const requestIdle = (typeof window !== 'undefined' && (window as any).requestIdleCallback) || ((cb: any) => setTimeout(cb, 10));

    requestIdle(() => {
      for (let i = 1; i <= windowSize; i++) {
        const target = currentIndex + i * step;
        if (target >= 0 && target < count && !this.cache.has(target) && !this.pendingFetches.has(target)) {
          this.ensureFrame(target);
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Window Resizing & DPR Management (S1, S10)
  // -------------------------------------------------------------
  private initResize(): void {
    const handleResize = () => {
      if (this.debounceResizeTimer) clearTimeout(this.debounceResizeTimer);
      this.debounceResizeTimer = setTimeout(() => {
        this.updateCanvasDimensions();
      }, 150);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize, { passive: true });
      this.listenerCount++;
      this.updateCanvasDimensions();
    }
  }

  private updateCanvasDimensions(): void {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.currentTier === 'high' ? 1.5 : 1.0);

    // Frame Canvas (full res)
    this.frameCanvas.width = Math.round(vw * dpr);
    this.frameCanvas.height = Math.round(vh * dpr);
    this.frameCanvas.style.width = `${vw}px`;
    this.frameCanvas.style.height = `${vh}px`;

    // Trail Canvas (half res per S6)
    this.trailCanvas.width = Math.round((vw * dpr) / 2);
    this.trailCanvas.height = Math.round((vh * dpr) / 2);
    this.trailCanvas.style.width = `${vw}px`;
    this.trailCanvas.style.height = `${vh}px`;

    this.renderFrame(this.displayFrame);
  }

  // -------------------------------------------------------------
  // Event Gating: Single Passive Listener on Window (S3)
  // -------------------------------------------------------------
  private bindWindowEvents(): void {
    if (typeof window === 'undefined') return;

    const onPointerMove = (e: PointerEvent) => {
      this.handlePointerMove(e);
    };

    const onPointerDown = (e: PointerEvent) => {
      this.handlePointerMove(e);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.processPointerCoords(t.clientX, t.clientY, e.target);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    this.listenerCount += 3;

    // Visibility pause (S8)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopRaf();
      } else {
        if (this.state !== 'IDLE' && this.state !== 'COMPLETE') {
          this.startRaf();
        }
      }
    });

    // Start idle clock timer checking
    this.startIdleClockTimer();
  }

  private isEventOnWallpaper(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;

    // Foreground UI exclusions (S3)
    if (
      target.closest(
        '.window-shell, .window-container, [data-window-shell], ' +
        '.desktop-icon-item, .di-slot, .di-hit-box, .di-zoom, ' +
        '.desktop-widget, .dock-container, .dock-item, .dock-wrapper, ' +
        '.menu-bar, .menu-item, .menu-dropdown, ' +
        '.context-menu, .context-menu-item, .context-menu-backdrop, ' +
        '.spotlight-modal, .spotlight-backdrop, ' +
        '.toast-notification, .toast-container, ' +
        '.modal-overlay, .modal-backdrop, #login-modal-overlay, #boot-screen-overlay, ' +
        '.quick-look-modal, #quick-look-modal'
      )
    ) {
      return false;
    }

    // Must be on the wallpaper surface
    return Boolean(target.closest('[data-wallpaper-surface]'));
  }

  private handlePointerMove(e: PointerEvent): void {
    // If dragging foreground object (pointer capture active) ignore
    if (e.buttons !== 0 && (e.target as Element)?.hasPointerCapture?.(e.pointerId)) {
      return;
    }

    // Support coalesced events for smoothness
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      this.processPointerCoords(ev.clientX, ev.clientY, ev.target);
    }
  }

  private processPointerCoords(clientX: number, clientY: number, target: EventTarget | null): void {
    if (this.isPermanentlyCompleted) return;

    const onWallpaper = this.isEventOnWallpaper(target);
    const now = performance.now();

    if (!onWallpaper) {
      // Pointer left wallpaper surface mid-gesture: freeze current frame, pause trail (S4)
      if (this.isPointerOnWallpaper) {
        this.isPointerOnWallpaper = false;
        this.pauseTimestamp = now;
      }
      return;
    }

    // On Wallpaper
    this.lastWallpaperMoveTime = now;
    const prevPos = { ...this.lastPointerPos };
    this.lastPointerPos = { x: clientX, y: clientY };

    if (!this.isPointerOnWallpaper) {
      this.isPointerOnWallpaper = true;
      // Re-entry retains state and stroke start
      this.strokeStart = { x: clientX, y: clientY };
    }

    // Pointer Parallax (S5): max 6px on frame layer
    const vw = window.innerWidth || 1920;
    const vh = window.innerHeight || 1080;
    const normX = (clientX / vw - 0.5) * 2;
    const normY = (clientY / vh - 0.5) * 2;
    this.parallaxOffset = {
      x: Math.round(normX * 6),
      y: Math.round(normY * 6),
    };
    if (this.frameCanvas) {
      this.frameCanvas.style.transform = `translate3d(${this.parallaxOffset.x}px, ${this.parallaxOffset.y}px, 0)`;
    }

    // Calculate speed for trail
    const dt = Math.max(1, now - (this.lastRafTime || now - 16));
    const dist = Math.hypot(clientX - prevPos.x, clientY - prevPos.y);
    const speed = dist / dt;

    // Append to Trail (S6)
    if (this.state !== 'COMPLETE') {
      this.appendTrailPoint(clientX, clientY, now, speed);
    }

    // State Machine Transitions (S4)
    if (this.state === 'IDLE' || this.state === 'RESETTING') {
      this.state = 'WAKE';
      this.wakeStartTime = now;
      this.strokeIndex = 1;
      this.strokeStart = { x: clientX, y: clientY };
      this.strokePeak = { x: clientX, y: clientY };
      this.stroke1Length = 0;
      this.strokeProgress = 0;
      this.startRaf();
    } else if (this.state === 'WAKE') {
      // First upward movement begins DRAWING
      const dy = clientY - this.strokeStart.y;
      const dx = clientX - this.strokeStart.x;
      if (dy < -10 && Math.abs(dx) <= Math.abs(dy) * 0.700 + 15) {
        this.state = 'DRAWING';
        this.strokeIndex = 1;
        this.strokeStart = { x: clientX, y: clientY - dy }; // anchor
        this.strokePeak = { x: clientX, y: clientY };
        this.stroke1Length = Math.max(80, -dy);
        this.lastGoodProgressTime = now;
        this.updateDrawingProgress(clientX, clientY, now);
      }
    } else if (this.state === 'DRAWING') {
      this.updateDrawingProgress(clientX, clientY, now);
    }
  }

  // -------------------------------------------------------------
  // Scale- & Position-Invariant N Recognizer (S4)
  // -------------------------------------------------------------
  private updateDrawingProgress(x: number, y: number, now: number): void {
    if (!this.manifest) return;
    const kf = this.manifest.keyframes;
    const count = this.manifest.count;

    const fWake = Math.round(kf.ready * (count - 1));
    const fS1End = Math.round(kf.stroke1End * (count - 1));
    const fS2End = Math.round(kf.stroke2End * (count - 1));
    const fS3End = Math.round(kf.stroke3End * (count - 1));

    if (this.strokeIndex === 1) {
      // Stroke 1: Upward within 35 deg of vertical. Min length 80 px.
      const dyFromStart = y - this.strokeStart.y;
      const dxFromStart = x - this.strokeStart.x;

      const dxFromPeak = x - this.strokePeak.x;
      const dyFromPeak = y - this.strokePeak.y;
      const height = this.strokeStart.y - this.strokePeak.y;

      // Check for Corner 1 -> Direction change to down-right diagonal from peak
      if (height >= 60 && dyFromPeak > 8 && dxFromPeak > 5) {
        const distFromPeak = Math.hypot(dxFromPeak, dyFromPeak);
        if (distFromPeak <= 60) {
          // Corner 1 detected: lock L1 and advance to stroke 2
          this.stroke1Length = height;
          this.strokeIndex = 2;
          this.strokeStart = { x: this.strokePeak.x, y: this.strokePeak.y };
          this.strokeValley = { x, y };
          this.strokeProgress = 0;
          this.lastGoodProgressTime = now;
          this.targetFrame = fS1End;
          return;
        }
      }

      // Track peak (topmost point)
      if (y < this.strokePeak.y) {
        this.strokePeak = { x, y };
      }

      // Upward or scrubbing along vertical stroke 1
      const isVertical = Math.abs(dxFromStart) <= Math.abs(dyFromStart) * 0.700 + 20;
      if (isVertical && dyFromStart <= 0) {
        const currentHeight = Math.max(0, -dyFromStart);
        this.stroke1Length = Math.max(this.stroke1Length, currentHeight);
        const nominalHeight = Math.max(150, Math.min(350, this.stroke1Length));
        this.strokeProgress = Math.min(1.0, currentHeight / nominalHeight);
        this.lastGoodProgressTime = now;
        this.targetFrame = Math.round(fWake + this.strokeProgress * (fS1End - fWake));
        this.prefetchLookahead(this.targetFrame, true);
      }
    } else if (this.strokeIndex === 2) {
      // Stroke 2: Down-right diagonal (aspect ~0.9, angle within 30 deg of expected ~48 deg)
      const dx = x - this.strokeStart.x;
      const dy = y - this.strokeStart.y;

      const dyFromValley = y - this.strokeValley.y;
      const dxFromValley = x - this.strokeValley.x;
      const distFromValley = Math.hypot(dxFromValley, dyFromValley);

      // Check for Corner 2 -> Direction change upward from valley
      if (this.strokeProgress >= 0.5 && dyFromValley < -8 && distFromValley <= 60) {
        // Corner 2 detected: advance to stroke 3
        this.strokeIndex = 3;
        this.strokeStart = { x: this.strokeValley.x, y: this.strokeValley.y };
        this.strokeProgress = 0;
        this.lastGoodProgressTime = now;
        this.targetFrame = fS2End;
        return;
      }

      // Track valley (bottommost point of diagonal)
      if (y > this.strokeValley.y) {
        this.strokeValley = { x, y };
      }

      const expectedLength = Math.hypot(this.stroke1Length, this.stroke1Length * 0.9);

      if (dx > 0 && dy > 0) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // ~48 deg expected
        if (angle >= 15 && angle <= 80) {
          const ux = 0.9 / Math.hypot(1, 0.9);
          const uy = 1.0 / Math.hypot(1, 0.9);
          const proj = dx * ux + dy * uy;
          this.strokeProgress = Math.max(0, Math.min(1.0, proj / expectedLength));
          this.lastGoodProgressTime = now;
          this.targetFrame = Math.round(fS1End + this.strokeProgress * (fS2End - fS1End));
          this.prefetchLookahead(this.targetFrame, true);
        }
      }
    } else if (this.strokeIndex === 3) {
      // Stroke 3: Upward within 35 deg of vertical, length 0.6 to 1.6x stroke 1
      const dx = x - this.strokeStart.x;
      const dy = y - this.strokeStart.y;

      const isUpward = dy < 0 && Math.abs(dx) <= Math.abs(dy) * 0.700 + 20;
      if (isUpward) {
        const currentHeight = -dy;
        this.strokeProgress = Math.min(1.0, currentHeight / this.stroke1Length);
        this.lastGoodProgressTime = now;
        this.targetFrame = Math.round(fS2End + this.strokeProgress * (fS3End - fS2End));
        this.prefetchLookahead(this.targetFrame, true);

        // COMPLETE trigger: Stroke 3 >= 90% (S4)
        if (this.strokeProgress >= 0.90) {
          this.triggerComplete();
        }
      }
    }

    // Stroke tolerance check: leaving stroke tolerance for > 400ms eases back to last completed keyframe
    if (now - this.lastGoodProgressTime > 400 && this.state === 'DRAWING') {
      if (this.strokeIndex === 1) {
        this.targetFrame = fWake;
      } else if (this.strokeIndex === 2) {
        this.targetFrame = fS1End;
      } else if (this.strokeIndex === 3) {
        this.targetFrame = fS2End;
      }
    }
  }

  // -------------------------------------------------------------
  // Complete Settle Sequence (S4)
  // -------------------------------------------------------------
  public triggerComplete(): void {
    if (this.state === 'COMPLETE') return;
    this.state = 'COMPLETE';
    this.isPermanentlyCompleted = true;
    this.completeStartTime = performance.now();
    this.completeStartFrame = this.displayFrame;
    this.startRaf();
  }

  // -------------------------------------------------------------
  // 5-Second Idle Reset Timer (S7)
  // -------------------------------------------------------------
  private startIdleClockTimer(): void {
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    this.idleCheckTimer = setInterval(() => {
      this.checkIdleReset();
    }, 100);
    this.timerCount = 1;
  }

  private checkIdleReset(): void {
    if (this.state === 'IDLE' || this.state === 'COMPLETE' || this.state === 'RESETTING') {
      return;
    }

    const now = performance.now();
    const elapsedSinceLastMove = now - this.lastWallpaperMoveTime;

    // 5000 ms (+/- 150 ms)
    if (elapsedSinceLastMove >= 4850) {
      this.startReset();
    }
  }

  public startReset(): void {
    if (this.state === 'IDLE' || this.state === 'RESETTING') return;
    this.state = 'RESETTING';
    this.resetStartTime = performance.now();
    this.resetStartFrame = this.displayFrame;

    // Fade trail over 500ms
    if (this.trailCanvas) {
      this.trailCanvas.style.transition = 'opacity 500ms ease-out';
      this.trailCanvas.style.opacity = '0';
      setTimeout(() => {
        this.clearTrail();
        if (this.trailCanvas) {
          this.trailCanvas.style.transition = '';
          this.trailCanvas.style.opacity = '1';
        }
      }, 500);
    }

    this.startRaf();
  }

  public armNow(): void {
    this.isPermanentlyCompleted = false;
    this.state = 'IDLE';
    this.strokeIndex = 1;
    this.stroke1Length = 0;
    this.strokeProgress = 0;
    this.targetFrame = 0;
    this.displayFrame = 0;
    this.drawnFrame = -1;
    this.clearTrail();
    this.renderFrame(0);
    this.stopRaf();
  }

  public resetNow(): void {
    this.startReset();
  }

  // -------------------------------------------------------------
  // Mirror Trail Canvas Incremental Renderer (S6)
  // -------------------------------------------------------------
  private appendTrailPoint(x: number, y: number, t: number, speed: number): void {
    // Ring buffer <= 400 points
    if (this.trailRing.length >= 400) {
      this.trailRing.shift();
      if (this.lastTrailDrawnIndex > 0) this.lastTrailDrawnIndex--;
    }
    this.trailRing.push({ x, y, t, speed });

    // Pause >= 300ms creates condensation drip on High tier
    if (this.currentTier === 'high' && speed < 0.05 && t - this.lastDripTime > 300) {
      this.lastDripTime = t;
      this.drips.push({
        x,
        y,
        len: Math.floor(8 + Math.random() * 12),
        alpha: 0.7,
      });
      if (this.drips.length > 20) this.drips.shift();
    }
  }

  private drawTrailIncremental(): void {
    if (!this.trailCtx || this.trailRing.length < 2) return;
    const ctx = this.trailCtx;

    // Half-res scale factor
    const dpr = Math.min(window.devicePixelRatio || 1, this.currentTier === 'high' ? 1.5 : 1.0);
    const scale = dpr / 2;

    const startIdx = Math.max(1, this.lastTrailDrawnIndex);
    for (let i = startIdx; i < this.trailRing.length; i++) {
      const p1 = this.trailRing[i - 1];
      const p2 = this.trailRing[i];

      const x1 = p1.x * scale;
      const y1 = p1.y * scale;
      const x2 = p2.x * scale;
      const y2 = p2.y * scale;

      // Soft light core: 18-26 px wide (9-13 px on half res), tapering with speed
      const taper = Math.max(6, Math.min(13, 13 - p2.speed * 1.5));

      // 1. Soft wipe core
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = taper;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.stroke();

      // 2. Cyan-white specular sheen edges
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = Math.max(1.5, taper * 0.25);
      ctx.strokeStyle = 'rgba(180, 240, 255, 0.65)';
      ctx.stroke();
    }
    this.lastTrailDrawnIndex = this.trailRing.length - 1;

    // Draw drips (High tier only)
    if (this.currentTier === 'high' && this.drips.length > 0) {
      for (const d of this.drips) {
        ctx.beginPath();
        ctx.moveTo(d.x * scale, d.y * scale);
        ctx.lineTo(d.x * scale, (d.y + d.len) * scale);
        ctx.lineWidth = 2 * scale;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(180, 240, 255, ${d.alpha * 0.6})`;
        ctx.stroke();
      }
    }
  }

  private clearTrail(): void {
    this.trailRing = [];
    this.drips = [];
    this.lastTrailDrawnIndex = 0;
    if (this.trailCtx && this.trailCanvas) {
      this.trailCtx.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
    }
  }

  // -------------------------------------------------------------
  // Render & Smoothing Loop (S4, S7, S10)
  // -------------------------------------------------------------
  public startRaf(): void {
    if (this.isRafRunning) return;
    this.isRafRunning = true;
    this.lastRafTime = performance.now();
    this.rafLoop();
  }

  public stopRaf(): void {
    this.isRafRunning = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private rafLoop = (): void => {
    if (!this.isRafRunning) return;
    this.rafCount++;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastRafTime) / 1000);
    this.lastRafTime = now;

    const count = this.manifest?.count || 300;
    const fWake = Math.round((this.manifest?.keyframes.ready || 0.25) * (count - 1));
    const fEnd = count - 1;

    let needsAnotherRaf = false;

    // State Machine Timing Eases
    if (this.state === 'WAKE') {
      // 900 ms ease f0 -> fWake (S4)
      const elapsed = now - this.wakeStartTime;
      const p = Math.min(1.0, elapsed / 900);
      const ease = 1 - Math.pow(1 - p, 3);
      this.targetFrame = ease * fWake;
      if (p < 1.0) needsAnotherRaf = true;
    } else if (this.state === 'COMPLETE') {
      // Auto-play remaining frames to fEnd at 24 fps (S4)
      const elapsed = (now - this.completeStartTime) / 1000;
      const advanceFrames = elapsed * 24;
      this.targetFrame = Math.min(fEnd, this.completeStartFrame + advanceFrames);
      if (this.targetFrame < fEnd) {
        needsAnotherRaf = true;
      } else {
        // Complete held; 0 rAF frames afterwards
        this.targetFrame = fEnd;
        this.displayFrame = fEnd;
        this.renderFrame(fEnd);
        this.stopRaf();
        return;
      }
    } else if (this.state === 'RESETTING') {
      // 900 ms ease back to frame 0 (S7)
      const elapsed = now - this.resetStartTime;
      const p = Math.min(1.0, elapsed / 900);
      const ease = 1 - Math.pow(1 - p, 2);
      this.targetFrame = this.resetStartFrame * (1 - ease);
      if (p >= 1.0) {
        this.state = 'IDLE';
        this.targetFrame = 0;
        this.displayFrame = 0;
        this.renderFrame(0);
        this.stopRaf();
        return;
      } else {
        needsAnotherRaf = true;
      }
    } else if (this.state === 'DRAWING') {
      // Continues as long as pointer is active or smoothing is converging
      needsAnotherRaf = this.isPointerOnWallpaper || Math.abs(this.targetFrame - this.displayFrame) >= 0.02;
    }

    // Critically Damped Smoothing: tau = 90 ms (S10)
    const omega = 11.11; // 1 / 0.090
    this.displayFrame += (this.targetFrame - this.displayFrame) * (1.0 - Math.exp(-omega * dt));

    // Redraw only when |display - drawn| >= 0.02 frame (S10)
    if (Math.abs(this.displayFrame - this.drawnFrame) >= 0.02) {
      this.renderFrame(this.displayFrame);
      needsAnotherRaf = true;
    }

    // Incremental trail draw
    this.drawTrailIncremental();

    if (needsAnotherRaf && this.isRafRunning) {
      this.rafHandle = requestAnimationFrame(this.rafLoop);
    } else if (!needsAnotherRaf) {
      this.stopRaf();
    }
  };

  // -------------------------------------------------------------
  // Frame Rendering: Cover-Fit & Crossfade (S1, S10)
  // -------------------------------------------------------------
  public renderFrame(frameValue: number): void {
    if (!this.frameCtx || !this.manifest) return;
    const ctx = this.frameCtx;
    const count = this.manifest.count;
    const clampedVal = Math.max(0, Math.min(count - 1, frameValue));

    const fLow = Math.floor(clampedVal);
    const fHigh = Math.min(count - 1, fLow + 1);
    const alpha = clampedVal - fLow;

    const bitmapLow = this.cache.get(fLow);
    const bitmapHigh = this.cache.get(fHigh);

    // If frames not cached, trigger fetch and hold
    if (!bitmapLow) {
      this.ensureFrame(fLow);
      return;
    }

    const vw = this.frameCanvas.width;
    const vh = this.frameCanvas.height;
    const sw = this.manifest.width;
    const sh = this.manifest.height;

    // Cover-fit math (S1)
    const scale = Math.max(vw / sw, vh / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (vw - dw) / 2;
    const dy = (vh - dh) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    if (this.currentTier === 'high' && alpha > 0.02 && bitmapHigh) {
      // High tier: crossfades two neighbouring frames (S10)
      ctx.globalAlpha = 1.0 - alpha;
      ctx.drawImage(bitmapLow, dx, dy, dw, dh);
      ctx.globalAlpha = alpha;
      ctx.drawImage(bitmapHigh, dx, dy, dw, dh);
    } else {
      // Medium / Low tier or single frame
      ctx.globalAlpha = 1.0;
      ctx.drawImage(bitmapLow, dx, dy, dw, dh);
    }
    ctx.restore();

    this.drawnFrame = clampedVal;
    this.drawnFramesCount++;
  }

  // -------------------------------------------------------------
  // Test Hook Injection (D5)
  // -------------------------------------------------------------
  private setupTestHook(): void {
    if (typeof window === 'undefined') return;

    // Expose window.__MIRROR__ test hook
    (window as any).__MIRROR__ = {
      getState: () => this.state,
      get state() {
        return (window as any).__MIRROR_ENGINE__?.state;
      },
      get frameIndex() {
        return Math.round((window as any).__MIRROR_ENGINE__?.displayFrame || 0);
      },
      get drawnFrames() {
        return (window as any).__MIRROR_ENGINE__?.drawnFramesCount || 0;
      },
      get rafCount() {
        return (window as any).__MIRROR_ENGINE__?.rafCount || 0;
      },
      get cacheSize() {
        return (window as any).__MIRROR_ENGINE__?.cache.size || 0;
      },
      get listenerCount() {
        return (window as any).__MIRROR_ENGINE__?.listenerCount || 0;
      },
      get timerCount() {
        return (window as any).__MIRROR_ENGINE__?.timerCount || 0;
      },
      get trailPoints() {
        return (window as any).__MIRROR_ENGINE__?.trailRing.length || 0;
      },
      armNow: () => this.armNow(),
      resetNow: () => this.resetNow(),
      setTier: (t: QualityTier) => this.setTier(t),
      triggerComplete: () => this.triggerComplete(),
    };

    (window as any).__MIRROR_ENGINE__ = this;
  }

  public destroy(): void {
    this.stopRaf();
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    if (this.debounceResizeTimer) clearTimeout(this.debounceResizeTimer);
    if (this.unregisterGovernor) this.unregisterGovernor();
    this.clearCache();
    if (typeof window !== 'undefined') {
      delete (window as any).__MIRROR__;
      delete (window as any).__MIRROR_ENGINE__;
    }
  }
}
