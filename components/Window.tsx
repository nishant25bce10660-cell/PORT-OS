'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';

export type SnapMode = 'normal' | 'left' | 'right' | 'max';

export interface WindowState {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isActive?: boolean;
  isRestoring?: boolean;
  snapMode: SnapMode;
  prevBounds?: { x: number; y: number; width: number; height: number };
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface WindowProps {
  window: WindowState;
  isActive?: boolean;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onUpdateBounds: (id: string, bounds: Partial<WindowState>) => void;
  onCycleSnap?: (id: string) => void;
  onToggleMaximize?: (id: string) => void;
  onSnapPreview?: (preview: { visible: boolean; x: number; y: number; w: number; h: number } | null) => void;
  onContextMenu?: (e: React.MouseEvent, windowId: string) => void;
  children: React.ReactNode;
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const MENUBAR_HEIGHT = 28;
const DOCK_RESERVE = 68;

export default function Window({
  window: win,
  isActive = true,
  onFocus,
  onClose,
  onMinimize,
  onUpdateBounds,
  onCycleSnap,
  onToggleMaximize,
  onSnapPreview,
  onContextMenu,
  children,
}: WindowProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [animState, setAnimState] = useState<'idle' | 'minimizing' | 'closing'>('idle');
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  // Ensure animState and shell styles reset to idle on non-minimized idle state
  useEffect(() => {
    if (!win.isMinimized && !win.isRestoring) {
      setAnimState('idle');
      if (shellRef.current) {
        shellRef.current.style.opacity = '1';
        shellRef.current.style.pointerEvents = 'auto';
        shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y}px, 0)`;
      }
    }
  }, [win.isMinimized, win.isRestoring, win.x, win.y]);

  const handleMinimizeClick = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (animState === 'minimizing' || animState === 'closing') return;

    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (shellRef.current) {
        shellRef.current.style.transition = 'opacity 0.12s ease';
        shellRef.current.style.opacity = '0';
      }
      animTimerRef.current = setTimeout(() => {
        onMinimize(win.id);
      }, 120);
      return;
    }

    setAnimState('minimizing');

    // Phase 1 (0–180 ms): Compresses slightly (scale ~0.97), starts fading, drifts down ~12 px
    // Transform origin at its bottom centre; titlebar remains interactive for rapid interrupts
    if (shellRef.current) {
      shellRef.current.style.transformOrigin = '50% 100%';
      shellRef.current.style.willChange = 'transform, opacity';
      shellRef.current.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1)';
      shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y + 12}px, 0) scale(0.97)`;
      shellRef.current.style.opacity = '0.75';
    }

    // Phase 2 (180–480 ms, duration 300ms): Glides along curve to dock target, shrinking to ~0.12, fading to 0
    phaseTimerRef.current = setTimeout(() => {
      if (!shellRef.current) return;

      let destX = typeof window !== 'undefined' ? window.innerWidth / 2 : 720;
      let destY = typeof window !== 'undefined' ? window.innerHeight - 28 : 850;

      const targetEl =
        document.getElementById(`dock-item-${win.id}`) ||
        document.getElementById(`dock-minimized-${win.id}`) ||
        document.getElementById('dock-item-finder') ||
        document.getElementById('macos-dock');

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        destX = rect.left + rect.width / 2;
        destY = rect.top + rect.height / 2;
      }

      const winBottomCenterX = win.x + win.width / 2;
      const winBottomCenterY = win.y + win.height;
      const deltaX = destX - winBottomCenterX;
      const deltaY = destY - winBottomCenterY;

      shellRef.current.style.transformOrigin = '50% 100%';
      shellRef.current.style.willChange = 'transform, opacity';
      shellRef.current.style.transition = 'transform 0.30s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.30s cubic-bezier(0.4, 0, 0.2, 1)';
      shellRef.current.style.transform = `translate3d(${win.x + deltaX}px, ${win.y + deltaY}px, 0) scale(0.12)`;
      shellRef.current.style.opacity = '0';
      shellRef.current.style.pointerEvents = 'none';
    }, 180);

    animTimerRef.current = setTimeout(() => {
      setAnimState('idle');
      onMinimize(win.id);
    }, 470);
  }, [animState, win.id, win.x, win.y, win.width, win.height, onMinimize]);

  const handleCloseClick = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (animState === 'closing') return;

    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (shellRef.current) {
        shellRef.current.style.transition = 'opacity 0.12s ease';
        shellRef.current.style.opacity = '0';
      }
      animTimerRef.current = setTimeout(() => {
        onClose(win.id);
      }, 120);
      return;
    }

    setAnimState('closing');

    // Close: 180 ms: scale 1 to 0.94, translate down 6 px, opacity to 0, then unmount
    if (shellRef.current) {
      shellRef.current.style.transformOrigin = 'center center';
      shellRef.current.style.transition = 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)';
      shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y + 6}px, 0) scale(0.94)`;
      shellRef.current.style.opacity = '0';
      shellRef.current.style.pointerEvents = 'none';
    }

    animTimerRef.current = setTimeout(() => {
      onClose(win.id);
    }, 180);
  }, [animState, win.id, win.x, win.y, onClose]);

  // Handle Restore animation: 420 ms reverse glide from dock target to original rectangle
  useEffect(() => {
    if (win.isRestoring && shellRef.current) {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      setAnimState('idle');
      const el = shellRef.current;
      const prefersReducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        el.style.transformOrigin = '50% 100%';
        el.style.transform = `translate3d(${win.x}px, ${win.y}px, 0) scale(1)`;
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.12s ease';
        const raf = requestAnimationFrame(() => {
          el.style.opacity = '1';
        });
        const t = setTimeout(() => {
          onUpdateBounds(win.id, { isRestoring: false });
          onFocus(win.id);
        }, 120);
        return () => {
          cancelAnimationFrame(raf);
          clearTimeout(t);
        };
      }

      let destX = typeof window !== 'undefined' ? window.innerWidth / 2 : 720;
      let destY = typeof window !== 'undefined' ? window.innerHeight - 28 : 850;

      const targetEl =
        document.getElementById(`dock-minimized-${win.id}`) ||
        document.getElementById(`dock-item-${win.id}`) ||
        document.getElementById('dock-item-finder') ||
        document.getElementById('macos-dock');

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        destX = rect.left + rect.width / 2;
        destY = rect.top + rect.height / 2;
      }

      const winBottomCenterX = win.x + win.width / 2;
      const winBottomCenterY = win.y + win.height;
      const deltaX = destX - winBottomCenterX;
      const deltaY = destY - winBottomCenterY;

      // Start frame at dock target
      el.style.transformOrigin = '50% 100%';
      el.style.transition = 'none';
      el.style.transform = `translate3d(${win.x + deltaX}px, ${win.y + deltaY}px, 0) scale(0.12)`;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';

      // Force reflow so initial transform commits
      void el.offsetWidth;

      const raf = requestAnimationFrame(() => {
        el.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = `translate3d(${win.x}px, ${win.y}px, 0) scale(1)`;
        el.style.opacity = '1';
      });

      const finishTimer = setTimeout(() => {
        if (shellRef.current) {
          shellRef.current.style.transition = '';
          shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y}px, 0)`;
          shellRef.current.style.opacity = '1';
          shellRef.current.style.pointerEvents = 'auto';
        }
        onUpdateBounds(win.id, { isRestoring: false });
        onFocus(win.id);
      }, 420);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(finishTimer);
      };
    }
  }, [win.isRestoring, win.id, win.x, win.y, win.width, win.height, onUpdateBounds, onFocus]);

  // Support external programmatic trigger (e.g. from context menu or dock item click)
  useEffect(() => {
    const handleExtMinimize = (e: any) => {
      if (e.detail?.id === win.id) {
        handleMinimizeClick();
      }
    };
    const handleExtClose = (e: any) => {
      if (e.detail?.id === win.id) {
        handleCloseClick();
      }
    };
    const handleExtRestore = (e: any) => {
      if (e.detail?.id === win.id) {
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
        setAnimState('idle');
        if (shellRef.current) {
          shellRef.current.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
          shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y}px, 0) scale(1)`;
          shellRef.current.style.opacity = '1';
          shellRef.current.style.pointerEvents = 'auto';
        }
        onUpdateBounds(win.id, { isRestoring: false, isMinimized: false });
        onFocus(win.id);
      }
    };
    window.addEventListener('portos-trigger-minimize', handleExtMinimize);
    window.addEventListener('portos-trigger-close', handleExtClose);
    window.addEventListener('portos-trigger-restore', handleExtRestore);
    return () => {
      window.removeEventListener('portos-trigger-minimize', handleExtMinimize);
      window.removeEventListener('portos-trigger-close', handleExtClose);
      window.removeEventListener('portos-trigger-restore', handleExtRestore);
    };
  }, [win.id, win.x, win.y, handleMinimizeClick, handleCloseClick, onUpdateBounds, onFocus]);

  const isDraggingRef = useRef(false);
  const dragDataRef = useRef({
    pointerStartX: 0,
    pointerStartY: 0,
    origX: 0,
    origY: 0,
    currentX: 0,
    currentY: 0,
  });

  const snapCandidateRef = useRef<'left' | 'right' | 'max' | null>(null);

  const isResizingRef = useRef<ResizeDir | null>(null);
  const resizeDataRef = useRef({
    pointerStartX: 0,
    pointerStartY: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
    currentX: 0,
    currentY: 0,
    currentW: 0,
    currentH: 0,
  });

  // Sync shell style when props change (if not actively dragging, resizing, or animating)
  useEffect(() => {
    if (!shellRef.current || isDraggingRef.current || isResizingRef.current || animState !== 'idle') return;
    shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y}px, 0)`;
    shellRef.current.style.width = `${win.width}px`;
    shellRef.current.style.height = `${win.height}px`;
    shellRef.current.style.zIndex = `${win.zIndex}`;
  }, [win.x, win.y, win.width, win.height, win.zIndex, animState]);

  // Focus on outer container pointerdown
  const handleContainerPointerDown = useCallback(() => {
    onFocus(win.id);
  }, [onFocus, win.id]);

  // Title bar drag handling with Pointer Capture
  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.traffic-lights')) return;
    onFocus(win.id);

    // If window is currently snapped, un-snap to prevBounds centered around cursor
    let startX = win.x;
    let startY = win.y;

    if (win.snapMode !== 'normal' && win.prevBounds) {
      startX = Math.max(20, Math.min(window.innerWidth - win.prevBounds.width - 20, e.clientX - win.prevBounds.width / 2));
      startY = Math.max(MENUBAR_HEIGHT, Math.min(window.innerHeight - win.prevBounds.height - DOCK_RESERVE, e.clientY - 18));
      onUpdateBounds(win.id, {
        snapMode: 'normal',
        x: startX,
        y: startY,
        width: win.prevBounds.width,
        height: win.prevBounds.height,
      });
      if (shellRef.current) {
        shellRef.current.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
        shellRef.current.style.width = `${win.prevBounds.width}px`;
        shellRef.current.style.height = `${win.prevBounds.height}px`;
      }
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isDraggingRef.current = true;
    setIsDragging(true);

    dragDataRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      origX: startX,
      origY: startY,
      currentX: startX,
      currentY: startY,
    };
  };

  const handleTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragDataRef.current.pointerStartX;
    const dy = e.clientY - dragDataRef.current.pointerStartY;

    const nextX = dragDataRef.current.origX + dx;
    // Window can never go above the menu bar (y >= 28)
    const nextY = Math.max(MENUBAR_HEIGHT, dragDataRef.current.origY + dy);

    dragDataRef.current.currentX = nextX;
    dragDataRef.current.currentY = nextY;

    if (shellRef.current) {
      shellRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }

    // Snap detection
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const usableH = vpH - MENUBAR_HEIGHT - DOCK_RESERVE;

    if (e.clientX <= 14) {
      onSnapPreview?.({ visible: true, x: 0, y: MENUBAR_HEIGHT, w: Math.floor(vpW / 2), h: usableH });
      snapCandidateRef.current = 'left';
    } else if (e.clientX >= vpW - 14) {
      onSnapPreview?.({ visible: true, x: Math.floor(vpW / 2), y: MENUBAR_HEIGHT, w: Math.floor(vpW / 2), h: usableH });
      snapCandidateRef.current = 'right';
    } else if (e.clientY <= MENUBAR_HEIGHT + 8) {
      onSnapPreview?.({ visible: true, x: 0, y: MENUBAR_HEIGHT, w: vpW, h: usableH });
      snapCandidateRef.current = 'max';
    } else {
      onSnapPreview?.(null);
      snapCandidateRef.current = null;
    }
  };

  const handleTitlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    onSnapPreview?.(null);

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const usableH = vpH - MENUBAR_HEIGHT - DOCK_RESERVE;

    if (snapCandidateRef.current === 'left') {
      snapCandidateRef.current = null;
      onUpdateBounds(win.id, {
        snapMode: 'left',
        prevBounds: { x: dragDataRef.current.origX, y: dragDataRef.current.origY, width: win.width, height: win.height },
        x: 0,
        y: MENUBAR_HEIGHT,
        width: Math.floor(vpW / 2),
        height: usableH,
      });
    } else if (snapCandidateRef.current === 'right') {
      snapCandidateRef.current = null;
      onUpdateBounds(win.id, {
        snapMode: 'right',
        prevBounds: { x: dragDataRef.current.origX, y: dragDataRef.current.origY, width: win.width, height: win.height },
        x: Math.floor(vpW / 2),
        y: MENUBAR_HEIGHT,
        width: Math.floor(vpW / 2),
        height: usableH,
      });
    } else if (snapCandidateRef.current === 'max') {
      snapCandidateRef.current = null;
      onUpdateBounds(win.id, {
        snapMode: 'max',
        prevBounds: { x: dragDataRef.current.origX, y: dragDataRef.current.origY, width: win.width, height: win.height },
        x: 0,
        y: MENUBAR_HEIGHT,
        width: vpW,
        height: usableH,
      });
    } else {
      onUpdateBounds(win.id, {
        x: dragDataRef.current.currentX,
        y: dragDataRef.current.currentY,
      });
    }
  };

  // Double click title bar toggles maximize
  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.traffic-lights')) return;
    if (onToggleMaximize) {
      onToggleMaximize(win.id);
    } else {
      // Default toggle maximize behavior
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const usableH = vpH - MENUBAR_HEIGHT - DOCK_RESERVE;

      if (win.snapMode !== 'max') {
        onUpdateBounds(win.id, {
          snapMode: 'max',
          prevBounds: { x: win.x, y: win.y, width: win.width, height: win.height },
          x: 0,
          y: MENUBAR_HEIGHT,
          width: vpW,
          height: usableH,
        });
      } else {
        const prev = win.prevBounds || { x: 80, y: 60, width: 680, height: 460 };
        onUpdateBounds(win.id, {
          snapMode: 'normal',
          x: prev.x,
          y: prev.y,
          width: prev.width,
          height: prev.height,
        });
      }
    }
  };

  // 8-point resize handlers with Pointer Capture
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onFocus(win.id);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isResizingRef.current = dir;
    setIsResizing(true);

    resizeDataRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      origX: win.x,
      origY: win.y,
      origW: win.width,
      origH: win.height,
      currentX: win.x,
      currentY: win.y,
      currentW: win.width,
      currentH: win.height,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    const dir = isResizingRef.current;
    const data = resizeDataRef.current;
    const dx = e.clientX - data.pointerStartX;
    const dy = e.clientY - data.pointerStartY;

    let newX = data.origX;
    let newY = data.origY;
    let newW = data.origW;
    let newH = data.origH;

    // Horizontal resize
    if (dir.includes('e')) {
      newW = Math.max(MIN_WIDTH, data.origW + dx);
    } else if (dir.includes('w')) {
      const maxDx = data.origW - MIN_WIDTH;
      const clampedDx = Math.min(dx, maxDx);
      newW = data.origW - clampedDx;
      newX = data.origX + clampedDx;
    }

    // Vertical resize
    if (dir.includes('s')) {
      newH = Math.max(MIN_HEIGHT, data.origH + dy);
    } else if (dir.includes('n')) {
      const maxDy = data.origH - MIN_HEIGHT;
      let clampedDy = Math.min(dy, maxDy);
      if (data.origY + clampedDy < MENUBAR_HEIGHT) {
        clampedDy = MENUBAR_HEIGHT - data.origY;
      }
      newH = data.origH - clampedDy;
      newY = data.origY + clampedDy;
    }

    data.currentX = newX;
    data.currentY = newY;
    data.currentW = newW;
    data.currentH = newH;

    if (shellRef.current) {
      shellRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      shellRef.current.style.width = `${newW}px`;
      shellRef.current.style.height = `${newH}px`;
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    isResizingRef.current = null;
    setIsResizing(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    onUpdateBounds(win.id, {
      x: resizeDataRef.current.currentX,
      y: resizeDataRef.current.currentY,
      width: resizeDataRef.current.currentW,
      height: resizeDataRef.current.currentH,
      snapMode: 'normal',
    });
  };

  // Traffic Light green cycle: snap-left -> snap-right -> restore
  const handleSnapCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocus(win.id);

    if (onCycleSnap) {
      onCycleSnap(win.id);
      return;
    }

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const usableH = vpH - MENUBAR_HEIGHT - DOCK_RESERVE;

    if (win.snapMode === 'normal') {
      onUpdateBounds(win.id, {
        snapMode: 'left',
        prevBounds: { x: win.x, y: win.y, width: win.width, height: win.height },
        x: 0,
        y: MENUBAR_HEIGHT,
        width: Math.floor(vpW / 2),
        height: usableH,
      });
    } else if (win.snapMode === 'left') {
      onUpdateBounds(win.id, {
        snapMode: 'right',
        x: Math.floor(vpW / 2),
        y: MENUBAR_HEIGHT,
        width: Math.floor(vpW / 2),
        height: usableH,
      });
    } else {
      const prev = win.prevBounds || { x: 80, y: 60, width: 680, height: 460 };
      onUpdateBounds(win.id, {
        snapMode: 'normal',
        x: prev.x,
        y: prev.y,
        width: prev.width,
        height: prev.height,
      });
    }
  };

  if (win.isMinimized) {
    return null;
  }

  const resizeHandles: ResizeDir[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

  return (
    <div
      ref={shellRef}
      className={`window-container window-shell window-shell-${win.id} ${isActive ? 'is-active' : 'is-inactive'} ${isDragging ? 'is-dragging' : ''} ${isResizing ? 'is-resizing' : ''}`}
      id={`window-${win.id}`}
      data-window-shell={`window-shell-${win.id}`}
      onPointerDown={handleContainerPointerDown}
      style={{
        width: `${win.width}px`,
        height: `${win.height}px`,
        transform: `translate3d(${win.x}px, ${win.y}px, 0)`,
        zIndex: win.zIndex,
        position: 'absolute',
        top: 0,
        left: 0,
        touchAction: 'none',
      }}
    >
      {/* 8 Resize Handles on Outer Shell */}
      {resizeHandles.map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-handle-${dir}`}
          data-direction={dir}
          onPointerDown={(e) => handleResizePointerDown(e, dir)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
        />
      ))}

      {/* Inner Surface with visual styling and entrance scale animation only */}
      <div className="window-surface">
        <div
          className="window-titlebar"
          onPointerDown={handleTitlePointerDown}
          onPointerMove={handleTitlePointerMove}
          onPointerUp={handleTitlePointerUp}
          onPointerCancel={handleTitlePointerUp}
          onDoubleClick={handleTitleDoubleClick}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(e, win.id);
            }
          }}
        >
          <div className={`traffic-lights ${isActive ? 'is-active' : 'is-inactive'}`}>
            <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
              {/* Close */}
              <WarmTooltip content="Close" side="bottom">
                <button
                  type="button"
                  className="traffic-light traffic-light-close"
                  id={`btn-close-${win.id}`}
                  onClick={handleCloseClick}
                  aria-label="Close"
                >
                  <span className="traffic-icon">✕</span>
                </button>
              </WarmTooltip>

              {/* Minimize (Hidden for utility/about modal sheets) */}
              {!(win.id === 'about-portos' || win.id.includes('about')) && (
                <WarmTooltip content="Minimize" side="bottom">
                  <button
                    type="button"
                    className="traffic-light traffic-light-minimize"
                    id={`btn-minimize-${win.id}`}
                    onClick={handleMinimizeClick}
                    aria-label="Minimize"
                  >
                    <span className="traffic-icon">−</span>
                  </button>
                </WarmTooltip>
              )}

              {/* Maximize / Snap cycle (Hidden for utility/about modal sheets) */}
              {!(win.id === 'about-portos' || win.id.includes('about')) && (
                <WarmTooltip
                  content={
                    win.snapMode === 'normal'
                      ? 'Snap Left'
                      : win.snapMode === 'left'
                      ? 'Snap Right'
                      : 'Restore'
                  }
                  side="bottom"
                >
                  <button
                    type="button"
                    className="traffic-light traffic-light-maximize"
                    id={`btn-snap-${win.id}`}
                    onClick={handleSnapCycle}
                    aria-label="Zoom / Snap"
                  >
                    <span className="traffic-icon">⤢</span>
                  </button>
                </WarmTooltip>
              )}
            </WarmTooltipGroup>
          </div>

          <div className="window-title">{win.title}</div>

          <div style={{ width: '48px' }} />
        </div>

        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}
