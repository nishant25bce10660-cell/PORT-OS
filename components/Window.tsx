'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';

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
  children,
}: WindowProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

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

  // Sync shell style when props change (if not actively dragging or resizing)
  useEffect(() => {
    if (!shellRef.current || isDraggingRef.current || isResizingRef.current) return;
    shellRef.current.style.transform = `translate3d(${win.x}px, ${win.y}px, 0)`;
    shellRef.current.style.width = `${win.width}px`;
    shellRef.current.style.height = `${win.height}px`;
    shellRef.current.style.zIndex = `${win.zIndex}`;
  }, [win.x, win.y, win.width, win.height, win.zIndex]);

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
        >
          <div className={`traffic-lights ${isActive ? 'is-active' : 'is-inactive'}`}>
            {/* Close */}
            <button
              type="button"
              className="traffic-light traffic-light-close"
              id={`btn-close-${win.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(win.id);
              }}
              title="Close"
              aria-label="Close"
            >
              <span className="traffic-icon">✕</span>
            </button>

            {/* Minimize (Hidden for utility/about modal sheets) */}
            {!(win.id === 'about-portos' || win.id.includes('about')) && (
              <button
                type="button"
                className="traffic-light traffic-light-minimize"
                id={`btn-minimize-${win.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMinimize(win.id);
                }}
                title="Minimize"
                aria-label="Minimize"
              >
                <span className="traffic-icon">−</span>
              </button>
            )}

            {/* Maximize / Snap cycle (Hidden for utility/about modal sheets) */}
            {!(win.id === 'about-portos' || win.id.includes('about')) && (
              <button
                type="button"
                className="traffic-light traffic-light-maximize"
                id={`btn-snap-${win.id}`}
                onClick={handleSnapCycle}
                title={
                  win.snapMode === 'normal'
                    ? 'Snap Left'
                    : win.snapMode === 'left'
                    ? 'Snap Right'
                    : 'Restore'
                }
                aria-label="Zoom / Snap"
              >
                <span className="traffic-icon">⤢</span>
              </button>
            )}
          </div>

          <div className="window-title">{win.title}</div>

          <div style={{ width: '48px' }} />
        </div>

        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}
