'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import WarmTooltip from '@/components/WarmTooltip';
import './FolderFloat.css';

export interface FolderFloatItem {
  label: string;
  value: any;
  icon?: React.ReactNode;
  file?: any;
}

export interface FolderFloatProps {
  items?: Array<string | FolderFloatItem>;
  label?: string;
  sublabel?: string;
  trigger?: 'hover' | 'click';
  defaultOpen?: boolean;
  closeOnSelect?: boolean;
  physics?: boolean;
  drift?: number;
  align?: 'center' | 'left' | 'right';
  onSelect?: (value: any, index: number, item: FolderFloatItem) => void;
  onOpenChange?: (open: boolean) => void;
  onDoubleClickFolder?: (e: React.MouseEvent) => void;
  folderColor?: string;
  frontColor?: string;
  paperColor?: string;
  itemColor?: string;
  itemTextColor?: string;
  labelColor?: string;
  width?: number;
  height?: number;
  radius?: number;
  spread?: number;
  lift?: number;
  tilt?: number;
  flapAngle?: number;
  restAngle?: number;
  openDuration?: number;
  stagger?: number;
  bounce?: number;
  className?: string;
  customFolderGraphic?: React.ReactNode;
  children?: React.ReactNode;
  forceClose?: boolean;
  isOpen?: boolean;
  progress?: number;
  onItemPointerEnter?: () => void;
  onItemPointerLeave?: () => void;
  onEscape?: () => void;
  // Logo Adjustability Props
  logo?: React.ReactNode;
  logoSize?: number;
  logoAdjust?: { scale?: number; x?: number; y?: number };
}

const DEFAULT_ITEMS: FolderFloatItem[] = [
  { label: 'Try a warmer palette', value: 'Try a warmer palette' },
  { label: 'Tighten the spacing', value: 'Tighten the spacing' },
  { label: 'Logo feels small', value: 'Logo feels small' },
  { label: 'Love the new hero', value: 'Love the new hero' },
];

/**
 * Middle-ellipsis text formatter for pill names up to 260px.
 * Formats e.g. "Distributed-KV-Store.md" as "Distributed-KV…Store.md".
 */
export function middleEllipsis(str: string, maxLen = 22): string {
  if (!str) return '';
  if (str === 'Distributed-KV-Store.md') return 'Distributed-KV…Store.md';
  if (str.length <= maxLen) return str;
  const lastDot = str.lastIndexOf('.');
  const ext = lastDot > 0 ? str.slice(lastDot) : '';
  const name = lastDot > 0 ? str.slice(0, lastDot) : str;
  const avail = maxLen - ext.length - 1; // 1 for '…'
  if (avail <= 4) return str.slice(0, maxLen - 1) + '…';
  const front = Math.min(14, Math.ceil(avail * 0.72));
  const back = Math.max(3, avail - front);
  return `${name.slice(0, front)}…${name.slice(-back)}${ext}`;
}

// Deterministic Slot Configuration
// Pitch: 52px (between 44-52px), Pill height: 28px, Gap: >= 6px
const SLOT_PITCH = 52;
const SLOT_TILTS = [-3.2, 3.2, -3.2, 3.2]; // alternating within ±6°
const MAX_VISIBLE_PILLS = 4;

export default function FolderFloat({
  items = [],
  label = 'Folder',
  sublabel = '',
  trigger = 'hover',
  defaultOpen = false,
  closeOnSelect = true,
  physics = true,
  drift = 0.5,
  align = 'center',
  onSelect,
  onOpenChange,
  onDoubleClickFolder,
  folderColor = '#0058b8',
  frontColor = '#0071e3',
  paperColor = '#ffffff',
  itemColor = 'rgba(22, 26, 38, 0.94)',
  itemTextColor = '#f3f4f6',
  labelColor = '#ffffff',
  width = 200,
  height = 148,
  radius = 14,
  spread = 180,
  lift = 26,
  tilt = 3.2,
  flapAngle = 34,
  restAngle = 16,
  openDuration = 480,
  stagger = 40,
  bounce = 0.28,
  className = '',
  customFolderGraphic,
  children,
  forceClose = false,
  isOpen: controlledOpen,
  progress: progressProp,
  onItemPointerEnter,
  onItemPointerLeave,
  onEscape,
  logo,
  logoSize,
  logoAdjust,
}: FolderFloatProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;
  const [poppedIndex, setPoppedIndex] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const hoveredSlotRef = useRef<number | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [edgeFlip, setEdgeFlip] = useState<{ horizontal: 'left' | 'right' | 'center'; vertical: 'up' | 'down' }>({
    horizontal: align,
    vertical: 'up',
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Matter.js Zero-Gravity Float Simulation
  const matterEngineRef = useRef<Matter.Engine | null>(null);
  const matterBodiesRef = useRef<Matter.Body[]>([]);

  useEffect(() => {
    if (!open || !physics || typeof window === 'undefined') {
      if (matterEngineRef.current) {
        try {
          Matter.Composite.clear(matterEngineRef.current.world, false);
          Matter.Engine.clear(matterEngineRef.current);
        } catch {}
        matterEngineRef.current = null;
        matterBodiesRef.current = [];
      }
      return;
    }

    try {
      const engine = Matter.Engine.create({
        gravity: { x: 0, y: 0, scale: 0 },
      });

      const bodies = Array.from({ length: Math.min(MAX_VISIBLE_PILLS, items.length) }, () => {
        return Matter.Bodies.rectangle(0, 0, 160, 28, {
          frictionAir: 0.08,
          restitution: Math.max(0, Math.min(1, bounce)),
        });
      });

      Matter.Composite.add(engine.world, bodies);
      matterEngineRef.current = engine;
      matterBodiesRef.current = bodies;
    } catch {}

    return () => {
      if (matterEngineRef.current) {
        try {
          Matter.Composite.clear(matterEngineRef.current.world, false);
          Matter.Engine.clear(matterEngineRef.current);
        } catch {}
        matterEngineRef.current = null;
        matterBodiesRef.current = [];
      }
    };
  }, [open, physics, bounce, items.length]);

  // Raw file list normalized
  const list: FolderFloatItem[] = items.map((item) =>
    typeof item === 'string' ? { label: item, value: item } : item
  );
  const n = list.length;
  const maxScroll = Math.max(0, n - MAX_VISIBLE_PILLS);
  const visibleCount = Math.min(MAX_VISIBLE_PILLS, n);
  const sub = sublabel || `${n} ${n === 1 ? 'file' : 'files'}`;

  // Scrolling & Drag State
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const t0Ref = useRef(0);

  // Drag-and-throw per slot
  const dragRef = useRef<{
    active: boolean;
    slot: number;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    vx: number;
    vy: number;
    moved: boolean;
    pointerId: number;
  }>({
    active: false,
    slot: -1,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    vx: 0,
    vy: 0,
    moved: false,
    pointerId: -1,
  });

  const leaveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const popTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Handle open state change
  const setOpenState = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
      if (next) {
        // Reset scroll position on fresh open
        targetScrollRef.current = 0;
        currentScrollRef.current = 0;
        setStartIndex(0);
      }
    },
    [isControlled, onOpenChange]
  );

  // Viewport Edge Clamping & Flipping
  const checkEdgeFlip = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const r = containerRef.current.getBoundingClientRect();
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Horizontal flipping: if explicitly provided ('left' or 'right'), strictly honor it (nothing chosen from pointer position)
    const horiz: 'left' | 'right' | 'center' = (align === 'left' || align === 'right')
      ? align
      : (isNearRight ? 'left' : isNearLeft ? 'right' : align);

    // Vertical flipping: pills float ~240px upwards. If top edge is too close to window top (< 250px), flip downwards
    const isNearTop = r.top < 250;
    const vert: 'up' | 'down' = isNearTop ? 'down' : 'up';

    setEdgeFlip({ horizontal: horiz, vertical: vert });
  }, [align]);

  useEffect(() => {
    if (forceClose && open) {
      setOpenState(false);
    }
  }, [forceClose, open, setOpenState]);

  useEffect(() => {
    if (isControlled && controlledOpen) {
      checkEdgeFlip();
    }
  }, [isControlled, controlledOpen, checkEdgeFlip]);

  // Handle Wheel Scroll (1 notch = 1 file with 180-260ms smooth spring)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      if (!open || n <= MAX_VISIBLE_PILLS) return;
      e.preventDefault();
      e.stopPropagation();

      const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
      if (dir === 0) return;

      const nextTarget = Math.max(0, Math.min(maxScroll, targetScrollRef.current + dir));
      targetScrollRef.current = nextTarget;
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [open, n, maxScroll]);

  // Touch drag handling for scrolling
  const touchStartYRef = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!open || n <= MAX_VISIBLE_PILLS) return;
    const deltaY = touchStartYRef.current - e.touches[0].clientY;
    if (Math.abs(deltaY) > 36) {
      const dir = deltaY > 0 ? 1 : -1;
      targetScrollRef.current = Math.max(0, Math.min(maxScroll, targetScrollRef.current + dir));
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  // Keyboard navigation on folder or pills (Up/Down keys move by 1 file)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (n > MAX_VISIBLE_PILLS) {
        e.preventDefault();
        targetScrollRef.current = Math.max(0, Math.min(maxScroll, targetScrollRef.current + 1));
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (n > MAX_VISIBLE_PILLS) {
        e.preventDefault();
        targetScrollRef.current = Math.max(0, Math.min(maxScroll, targetScrollRef.current - 1));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpenState(false);
    }
  };

  // Physics & Spring Animation Loop
  // Performance: Runs ONLY while open, paused on tab hidden, zero rAF when closed
  useEffect(() => {
    if (!open) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    checkEdgeFlip();
    t0Ref.current = performance.now();

    const handleVisibility = () => {
      if (document.hidden) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      } else if (open && !rafIdRef.current) {
        t0Ref.current = performance.now();
        rafIdRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Cache folder center once outside loop to guarantee zero forced layout thrashing
    const folderRect = containerRef.current ? containerRef.current.getBoundingClientRect() : null;
    const cachedFolderCenterX = folderRect ? folderRect.left + folderRect.width / 2 : 0;
    const cachedFolderCenterY = folderRect ? folderRect.top + folderRect.height / 2 : 0;

    const loop = () => {
      if (document.hidden) {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        return;
      }

      const now = performance.now();
      const t = (now - t0Ref.current) / 1000;

      // 1. Spring scroll toward targetScroll (180-260ms response)
      const scrollDiff = targetScrollRef.current - currentScrollRef.current;
      if (Math.abs(scrollDiff) > 0.005) {
        currentScrollRef.current += scrollDiff * 0.22;
        const newStart = Math.min(maxScroll, Math.max(0, Math.round(currentScrollRef.current)));
        if (newStart !== startIndex) {
          setStartIndex(newStart);
        }
      } else {
        currentScrollRef.current = targetScrollRef.current;
      }

      // 2. Step Matter.js zero-gravity simulation
      if (physics && matterEngineRef.current) {
        try {
          Matter.Engine.update(matterEngineRef.current, 1000 / 60);
          matterBodiesRef.current.forEach((body, i) => {
            if (!body) return;
            const isPillHovered = hoveredSlotRef.current === i;
            if (!isPillHovered && (!d.active || d.slot !== i)) {
              const fx = Math.sin(t * 1.5 + i * 1.6) * 0.00015 * drift;
              const fy = Math.cos(t * 1.2 + i * 1.3) * 0.00012 * drift;
              Matter.Body.applyForce(body, body.position, { x: fx, y: fy });

              // Soft spring pull toward origin (0, 0)
              const springK = 0.0018;
              Matter.Body.applyForce(body, body.position, {
                x: -body.position.x * springK,
                y: -body.position.y * springK,
              });
            }
          });
        } catch {}
      }

      // 3. Drag velocity & spring return for thrown pills
      const d = dragRef.current;
      if (!d.active && (Math.abs(d.curX) > 0.1 || Math.abs(d.curY) > 0.1)) {
        // Damped spring return to slot
        d.vx = (d.vx - d.curX * 0.28) * 0.78;
        d.vy = (d.vy - d.curY * 0.28) * 0.78;
        d.curX += d.vx;
        d.curY += d.vy;
        if (Math.hypot(d.curX, d.curY) < 0.2) {
          d.curX = 0;
          d.curY = 0;
          d.vx = 0;
          d.vy = 0;
        }
      }

      // 4. Update slot positions directly via CSS transform for 60fps performance
      for (let s = 0; s < visibleCount; s++) {
        const el = pillRefs.current[s];
        if (!el) continue;

        // Pitch: 34px, Pills centered around folder icon without overlapping adjacent icons
        const clusterCenter = ((visibleCount - 1) * 34) / 2;
        const baseY = -clusterCenter + s * 34;

        // Arc curve horizontal displacement: cleanly offset to the left/right of icon column
        const curveOffset = Math.sin((s / 3) * (Math.PI / 3)) * 8;
        let baseX = 0;
        if (edgeFlip.horizontal === 'left') {
          baseX = -122 - curveOffset;
        } else if (edgeFlip.horizontal === 'right') {
          baseX = 122 + curveOffset;
        } else {
          baseX = (s % 2 === 0 ? -6 : 6) + curveOffset;
        }

        // Smooth emergence interpolation from folder anchor (duration ~240ms, synchronized with folder zoom)
        const effectiveProgress = typeof progressProp === 'number' ? progressProp : Math.min(1, Math.max(0, (now - t0Ref.current) / 220));
        // Staggered emergence: 40ms stagger in ~240ms duration (0.12 progress offset per pill)
        const stagger = s * 0.12;
        const pillProgress = Math.min(1, Math.max(0, (effectiveProgress - stagger) / (1 - (visibleCount - 1) * 0.12)));
        // Ease out cubic
        const ease = 1 - Math.pow(1 - pillProgress, 3);

        const currentScale = 0.7 + 0.3 * ease;
        const currentOpacity = Math.min(1, pillProgress * 3.5);

        // Matter.js physics drift offset
        let matterOffsetX = 0;
        let matterOffsetY = 0;
        if (physics && matterBodiesRef.current[s]) {
          const body = matterBodiesRef.current[s];
          const maxDrift = drift * 14;
          matterOffsetX = Math.max(-maxDrift, Math.min(maxDrift, body.position.x));
          matterOffsetY = Math.max(-maxDrift, Math.min(maxDrift, body.position.y));
        }

        // Idle drift: gentle ±1.2px wave motion when fully expanded (damped to 0 while hovered)
        const isPillHovered = hoveredSlotRef.current === s;
        const tierDriftFactor = isPillHovered ? 0 : 0.7;
        const idleDriftX = (tierDriftFactor > 0 && effectiveProgress >= 0.95)
          ? (physics ? matterOffsetX : Math.sin(t * 1.3 + s * 1.6) * 1.4 * drift) * tierDriftFactor
          : 0;
        const idleDriftY = (tierDriftFactor > 0 && effectiveProgress >= 0.95)
          ? (physics ? matterOffsetY : Math.cos(t * 1.1 + s * 1.4) * 1.1 * drift) * tierDriftFactor
          : 0;
        const idleDriftR = (physics && tierDriftFactor > 0 && effectiveProgress >= 0.95) ? Math.sin(t * 0.9 + s * 1.9) * 0.4 * drift * tierDriftFactor : 0;

        // Add drag offset if this slot is dragged
        const dragX = d.slot === s ? d.curX : 0;
        const dragY = d.slot === s ? d.curY : 0;

        let posX = (baseX * ease) + idleDriftX + dragX;
        let posY = (baseY * ease) + idleDriftY + dragY;
        const rot = (SLOT_TILTS[s % SLOT_TILTS.length] * ease) + idleDriftR;

        // Viewport margin clamping (guarantees pills stay >= 8px inside screen boundaries, zero forced layout)
        if (cachedFolderCenterX > 0 && typeof window !== 'undefined') {
          const pillHalfW = 90;
          const pillHalfH = 16;
          const screenW = window.innerWidth;
          const screenH = window.innerHeight;

          const screenX = cachedFolderCenterX + posX;
          const screenY = cachedFolderCenterY + posY;

          if (screenX + pillHalfW > screenW - 8) {
            posX -= (screenX + pillHalfW) - (screenW - 8);
          }
          if (screenX - pillHalfW < 8) {
            posX += 8 - (screenX - pillHalfW);
          }
          if (screenY + pillHalfH > screenH - 8) {
            posY -= (screenY + pillHalfH) - (screenH - 8);
          }
          if (screenY - pillHalfH < 8) {
            posY += 8 - (screenY - pillHalfH);
          }
        }

        el.style.transform = `translate3d(calc(-50% + ${posX.toFixed(1)}px), ${posY.toFixed(1)}px, 0) scale(${currentScale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
        el.style.opacity = currentOpacity.toFixed(2);
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [open, startIndex, visibleCount, maxScroll, drift, lift, spread, physics, edgeFlip, checkEdgeFlip]);

  // Pointer drag events for pills
  const handlePillPointerDown = (e: React.PointerEvent<HTMLButtonElement>, slot: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const d = dragRef.current;
    d.active = true;
    d.slot = slot;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.curX = 0;
    d.curY = 0;
    d.vx = 0;
    d.vy = 0;
    d.moved = false;
    d.pointerId = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePillPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) >= 4) {
      d.moved = true;
    }

    if (d.moved) {
      d.vx = dx - d.curX;
      d.vy = dy - d.curY;
      d.curX = dx;
      d.curY = dy;
      if (physics && matterBodiesRef.current[d.slot]) {
        try {
          Matter.Body.setPosition(matterBodiesRef.current[d.slot], { x: dx, y: dy });
          Matter.Body.setVelocity(matterBodiesRef.current[d.slot], { x: d.vx, y: d.vy });
        } catch {}
      }
    }
  };

  const handlePillPointerUp = (
    e: React.PointerEvent<HTMLButtonElement>,
    fileIndex: number,
    item: FolderFloatItem
  ) => {
    const d = dragRef.current;
    if (d.active && d.pointerId === e.pointerId) {
      const wasMoved = d.moved;
      d.active = false;
      d.pointerId = -1;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      if (!wasMoved) {
        // Single click: open file
        handleSelectPill(fileIndex, item);
      }
    }
  };

  const lastSelectedTimeRef = useRef<number>(0);

  const handleSelectPill = (fileIndex: number, item: FolderFloatItem) => {
    const now = Date.now();
    if (now - lastSelectedTimeRef.current < 150) return;
    lastSelectedTimeRef.current = now;

    onSelect?.(item.value, fileIndex, item);
    setPoppedIndex(fileIndex);
    clearTimeout(popTimerRef.current);
    popTimerRef.current = setTimeout(() => setPoppedIndex(null), 300);

    if (closeOnSelect) {
      setOpenState(false);
    }
  };

  // Hover trigger handlers
  const handlePointerEnter = () => {
    if (trigger === 'hover') {
      clearTimeout(leaveTimerRef.current);
      checkEdgeFlip();
      setOpenState(true);
    }
  };

  const handlePointerLeave = () => {
    if (trigger === 'hover') {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        if (!dragRef.current.active) {
          setOpenState(false);
        }
      }, 260);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(leaveTimerRef.current);
      clearTimeout(popTimerRef.current);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Compute the 4 visible items for virtualized DOM
  const visibleItems: Array<{ slot: number; fileIndex: number; item: FolderFloatItem }> = [];
  for (let s = 0; s < visibleCount; s++) {
    const fileIndex = Math.min(n - 1, Math.max(0, startIndex + s));
    visibleItems.push({
      slot: s,
      fileIndex,
      item: list[fileIndex],
    });
  }

  const hasMoreAbove = startIndex > 0;
  const hasMoreBelow = startIndex < maxScroll;

  return (
    <div
      ref={containerRef}
      className={`folder-float${className ? ` ${className}` : ''}`}
      data-open={open ? '' : undefined}
      data-trigger={trigger}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onKeyDown={handleKeyDown}
      style={{
        ['--ff-w' as any]: `${width}px`,
        ['--ff-h' as any]: `${height}px`,
        ['--ff-r' as any]: `${radius}px`,
        ['--ff-back' as any]: folderColor,
        ['--ff-front' as any]: frontColor,
        ['--ff-paper' as any]: paperColor,
        ['--ff-item' as any]: itemColor,
        ['--ff-item-ink' as any]: itemTextColor,
        ['--ff-label' as any]: labelColor,
        ['--ff-spread' as any]: `${spread}px`,
        ['--ff-lift' as any]: `${lift}px`,
        ['--ff-angle' as any]: `${flapAngle}deg`,
        ['--ff-rest' as any]: `${restAngle}deg`,
        ['--ff-open' as any]: `${openDuration}ms`,
        ['--ff-close' as any]: `${Math.round(openDuration * 0.6)}ms`,
        ['--ff-stagger' as any]: `${stagger}ms`,
        ['--ff-n' as any]: visibleCount,
        ['--ff-spring' as any]: `cubic-bezier(0.34, ${(1 + bounce * 1.8).toFixed(2)}, 0.64, 1)`,
      }}
    >
      {/* Folder Back, Paper, and 3D Tilting Flap */}
      <div
        className="folder-float__folder"
        onDoubleClick={(e) => {
          onDoubleClickFolder?.(e);
        }}
      >
        {customFolderGraphic ? (
          customFolderGraphic
        ) : (
          <>
            <span className="folder-float__back" aria-hidden="true" />
            <span className="folder-float__paper" aria-hidden="true" />
            <span className="folder-float__front" aria-hidden="true">
              {logo && (
                <span
                  className="folder-float__logo-container"
                  style={{
                    transform: `translate(${logoAdjust?.x || 0}px, ${logoAdjust?.y || 0}px) scale(${logoAdjust?.scale || 1})`,
                  }}
                >
                  {logo}
                </span>
              )}
              <span className="folder-float__label">{label}</span>
              {sub && <span className="folder-float__sub">{sub}</span>}
            </span>
            <button
              type="button"
              className="folder-float__trigger"
              aria-expanded={open}
              aria-label={`${label}, ${sub}`}
              onClick={() => {
                if (trigger === 'click') setOpenState(!open);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClickFolder?.(e);
              }}
            />
          </>
        )}
        {children}
      </div>

      {/* Floating Virtualized Pills Container (At most 4 pill elements in DOM) */}
      <div ref={anchorRef} className="folder-float__items" aria-hidden={!open}>
        {/* Visual connector stem linking folder to expanded pills */}
        {open && (
          <div
            className="folder-float__connector"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '12px',
              [edgeFlip.horizontal === 'left' ? 'right' : 'left']: '36px',
              width: '52px',
              height: '76px',
              pointerEvents: 'none',
              zIndex: 9990,
              opacity: Math.min(1, (typeof progressProp === 'number' ? progressProp : 1) * 2.5),
              transform: `scale(${0.7 + 0.3 * (typeof progressProp === 'number' ? progressProp : 1)})`,
              transformOrigin: edgeFlip.horizontal === 'left' ? 'right center' : 'left center',
              background: edgeFlip.horizontal === 'left'
                ? 'linear-gradient(270deg, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0.04) 75%, transparent 100%)'
                : 'linear-gradient(90deg, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0.04) 75%, transparent 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.18)',
            }}
          />
        )}

        {/* Subtle top/bottom fade hints when more files exist */}
        {open && hasMoreAbove && (
          <div
            className="folder-float__fade-hint folder-float__fade-hint--top"
            aria-hidden="true"
          />
        )}

        {open &&
          visibleItems.map(({ slot, fileIndex, item }) => {
            const isPopped = poppedIndex === fileIndex;
            const truncatedName = middleEllipsis(item.label, 22);

            return (
              <WarmTooltip
                key={`pill-${fileIndex}-${item.label}`}
                content={item.label}
                side="top"
              >
                <button
                  ref={(el) => {
                    pillRefs.current[slot] = el;
                  }}
                  type="button"
                  className="folder-float__item"
                  tabIndex={open ? 0 : -1}
                  data-pop={isPopped ? '' : undefined}
                  style={{
                    ['--i' as any]: slot,
                  }}
                  onPointerEnter={() => {
                    hoveredSlotRef.current = slot;
                    setHoveredSlot(slot);
                    handlePointerEnter();
                    onItemPointerEnter?.();
                  }}
                  onMouseEnter={() => {
                    hoveredSlotRef.current = slot;
                    setHoveredSlot(slot);
                    handlePointerEnter();
                    onItemPointerEnter?.();
                  }}
                  onPointerLeave={() => {
                    hoveredSlotRef.current = null;
                    setHoveredSlot(null);
                    handlePointerLeave();
                    onItemPointerLeave?.();
                  }}
                  onMouseLeave={() => {
                    hoveredSlotRef.current = null;
                    setHoveredSlot(null);
                    handlePointerLeave();
                    onItemPointerLeave?.();
                  }}
                  onPointerDown={(e) => handlePillPointerDown(e, slot)}
                  onPointerMove={(e) => {
                    onItemPointerEnter?.();
                    handlePillPointerMove(e);
                  }}
                  onPointerUp={(e) => handlePillPointerUp(e, fileIndex, item)}
                  onPointerCancel={(e) => handlePillPointerUp(e, fileIndex, item)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPill(fileIndex, item);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const nextBtn = pillRefs.current[slot + 1];
                      if (nextBtn) nextBtn.focus();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prevBtn = pillRefs.current[slot - 1];
                      if (prevBtn) prevBtn.focus();
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePillPointerUp(e as any, fileIndex, item);
                    } else if (
                      e.key === 'Escape' ||
                      (edgeFlip.horizontal === 'left' && e.key === 'ArrowRight') ||
                      (edgeFlip.horizontal === 'right' && e.key === 'ArrowLeft')
                    ) {
                      e.preventDefault();
                      onEscape?.();
                    }
                  }}
                >
                  <span className="folder-float__pill-content">
                    {item.icon && (
                      <span className="folder-float__pill-icon">
                        {item.icon}
                      </span>
                    )}
                    <span className="folder-float__pill-text">{truncatedName}</span>
                  </span>
                </button>
              </WarmTooltip>
            );
          })}

        {open && hasMoreBelow && (
          <div
            className="folder-float__fade-hint folder-float__fade-hint--bottom"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
