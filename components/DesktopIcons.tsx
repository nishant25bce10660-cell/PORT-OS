'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForApp, getIconKindForFolder } from '@/components/icons/iconRegistry';
import FolderFloat, { FolderFloatItem } from '@/components/FolderFloat';
import { Widget } from '@/lib/types';
import { computeDisplacements, getWidgetDimensions, Rect } from '@/lib/displacement';

export interface DesktopIconItemData {
  id: string;
  label: string;
  type: 'folder' | 'document' | 'user' | 'project';
  x: number;
  y: number;
}

interface DesktopIconsProps {
  isAdmin?: boolean;
  onOpenProjects: () => void;
  onOpenCertEducation: () => void;
  onOpenOwnersData: () => void;
  onOpenTerminal?: (initialCommand?: string) => void;
  onOpenSettings?: (section?: string) => void;
  onNewFolder?: () => void;
  onContextMenuIcon?: (e: React.MouseEvent, iconId: string, label: string) => void;
  initialPositions?: Record<string, { x: number; y: number }>;
  onSavePositions?: (positions: Record<string, { x: number; y: number }>) => void;
  iconSize?: 'small' | 'medium' | 'large';
  extraIcons?: Array<{ id: string; label: string; type: string }>;
  onOpenExtraIcon?: (icon: { id: string; label: string; type: string }) => void;
  folderItems?: Record<string, any[]>;
  onOpenFile?: (file: any) => void;
  onOpenFolder?: (folder: any) => void;
  desktopSide?: 'left' | 'right';
  widgets?: Widget[];
  onExpansionChange?: (info: { displacements: Record<string, { x: number; y: number }>; progress: number } | null) => void;
}

const DEFAULT_FOLDER_ITEMS: Record<string, any[]> = {};

const ICON_THEMES: Record<string, {
  folderColor: string;
  frontColor: string;
  paperColor: string;
  labelColor: string;
  itemColor: string;
  itemTextColor: string;
  iconKind: PortOSIconKind;
}> = {
  projects: {
    folderColor: '#1e3a8a',
    frontColor: '#2563eb',
    paperColor: '#ffffff',
    labelColor: '#ffffff',
    itemColor: 'rgba(22, 26, 38, 0.94)',
    itemTextColor: '#f3f4f6',
    iconKind: 'folder-projects',
  },
  'cert-education': {
    folderColor: '#4c1d95',
    frontColor: '#7c3aed',
    paperColor: '#ffffff',
    labelColor: '#ffffff',
    itemColor: 'rgba(22, 26, 38, 0.94)',
    itemTextColor: '#f3f4f6',
    iconKind: 'folder-cert-edu',
  },
  'owners-data': {
    folderColor: '#064e3b',
    frontColor: '#059669',
    paperColor: '#ffffff',
    labelColor: '#ffffff',
    itemColor: 'rgba(22, 26, 38, 0.94)',
    itemTextColor: '#f3f4f6',
    iconKind: 'folder-owner',
  },
  terminal: {
    folderColor: '#0f172a',
    frontColor: '#1e293b',
    paperColor: '#38bdf8',
    labelColor: '#38bdf8',
    itemColor: 'rgba(15, 23, 42, 0.95)',
    itemTextColor: '#38bdf8',
    iconKind: 'terminal',
  },
  settings: {
    folderColor: '#27272a',
    frontColor: '#3f3f46',
    paperColor: '#e4e4e7',
    labelColor: '#f4f4f5',
    itemColor: 'rgba(39, 39, 42, 0.95)',
    itemTextColor: '#f4f4f5',
    iconKind: 'settings',
  },
};

const getDefaultPositions = (side: 'left' | 'right' = 'right'): Record<string, { x: number; y: number }> => {
  if (side === 'left') {
    return {
      projects: { x: 24, y: 52 },
      'cert-education': { x: 24, y: 160 },
      'owners-data': { x: 24, y: 268 },
      terminal: { x: 24, y: 376 },
      settings: { x: 24, y: 484 },
    };
  }
  const rightX = typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 108) : 1330;
  return {
    projects: { x: rightX, y: 52 },
    'cert-education': { x: rightX, y: 160 },
    'owners-data': { x: rightX, y: 268 },
    terminal: { x: rightX, y: 376 },
    settings: { x: rightX, y: 484 },
  };
};

type HoverState =
  | { type: 'idle' }
  | { type: 'intent'; folderId: string }
  | { type: 'expanded'; folderId: string }
  | { type: 'closing'; folderId: string };

export default function DesktopIcons({
  isAdmin = false,
  onOpenProjects,
  onOpenCertEducation,
  onOpenOwnersData,
  onOpenTerminal,
  onOpenSettings,
  onNewFolder,
  onContextMenuIcon,
  initialPositions,
  onSavePositions,
  iconSize = 'medium',
  extraIcons = [],
  onOpenExtraIcon,
  folderItems,
  onOpenFile,
  onOpenFolder,
  desktopSide = 'right',
  widgets,
  onExpansionChange,
}: DesktopIconsProps) {
  const [localSide, setLocalSide] = useState<'left' | 'right' | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('portos_customization');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.desktopSide === 'left' || parsed.desktopSide === 'right') {
            return parsed.desktopSide;
          }
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    if (desktopSide) {
      setLocalSide(desktopSide);
    }
  }, [desktopSide]);

  const configuredSide = localSide || desktopSide || 'right';

  const [folderOrder, setFolderOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('portos_desktop_icon_order');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return ['projects', 'cert-education', 'owners-data', 'terminal', 'settings'];
  });

  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const [focusedId, setFocusedId] = useState<string>('projects');
  const escapedRef = useRef<boolean>(false);

  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateVp = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
      updateVp();
      window.addEventListener('resize', updateVp);
      return () => window.removeEventListener('resize', updateVp);
    }
  }, []);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const defaults = getDefaultPositions(configuredSide);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('portos_desktop_icons');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            return { ...defaults, ...parsed };
          }
        }
      } catch {}
    }
    return initialPositions && Object.keys(initialPositions).length > 0
      ? { ...defaults, ...initialPositions }
      : defaults;
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // -----------------------------------------------------------------
  // 1. Hover State Machine: idle -> intent (60ms) -> expanded -> closing (280ms) -> idle
  // -----------------------------------------------------------------
  const [hoverState, setHoverState] = useState<HoverState>({ type: 'idle' });
  const intentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (intentTimerRef.current) {
      clearTimeout(intentTimerRef.current);
      intentTimerRef.current = null;
    }
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current);
      closingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Window-level capture listener: clicking anywhere outside the active folder collapses it immediately
  useEffect(() => {
    const onGlobalPointerDown = (e: PointerEvent) => {
      const activeId = hoverState.type === 'expanded' || hoverState.type === 'closing' ? hoverState.folderId : null;
      if (activeId) {
        const target = e.target as HTMLElement | null;
        const isInsideActive = target?.closest(
          `#desktop-item-${activeId}, .folder-float-bridge-hitbox, .folder-float__item, .folder-float-container`
        );
        if (!isInsideActive) {
          clearTimers();
          setHoverState({ type: 'idle' });
        }
      }
    };
    window.addEventListener('pointerdown', onGlobalPointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown, { capture: true });
  }, [hoverState, clearTimers]);

  const activeFolderId = useMemo(() => {
    return hoverState.type === 'expanded' || hoverState.type === 'closing'
      ? hoverState.folderId
      : null;
  }, [hoverState]);

  // -----------------------------------------------------------------
  // Basic Folder Open & Tactile Animation Controller
  // Triggered on double-click, double-right-click, or context menu Open
  // -----------------------------------------------------------------
  const [openingFolderId, setOpeningFolderId] = useState<string | null>(null);
  const openingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRightClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const handleTriggerOpen = useCallback((iconId: string, onOpen: () => void) => {
    setOpeningFolderId(iconId);
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    openingTimerRef.current = setTimeout(() => {
      setOpeningFolderId(null);
    }, 400);
    onOpen();
  }, []);

  const handleFolderEnter = useCallback((_id: string) => {
    // Basic mode: Hovering does not trigger floating pills or neighbor displacement
  }, []);

  const handleFolderLeave = useCallback((_id: string) => {
    // Basic mode: Hovering does not trigger floating pills or neighbor displacement
  }, []);

  // -----------------------------------------------------------------
  // Unified Expansion Progress Controller (Round 18 Step 6)
  // Spring parameters: stiffness k = 300, damping c = 24, mass m = 1.0 (~240ms duration)
  // Reversible & interruptible mid-animation without > 2px jump
  // -----------------------------------------------------------------
  const [expansionProgress, setExpansionProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const velocityRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const lastAnimTimeRef = useRef<number>(0);

  const startSpringAnimation = useCallback(() => {
    if (animFrameRef.current) return;
    lastAnimTimeRef.current = performance.now();

    const mqlReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = (now: number) => {
      const dt = Math.min((now - lastAnimTimeRef.current) / 1000, 0.032);
      lastAnimTimeRef.current = now;

      const target = targetProgressRef.current;
      let pos = progressRef.current;
      let vel = velocityRef.current;

      if (mqlReduced) {
        pos = target;
        vel = 0;
      } else {
        const k = 300;
        const c = 24;
        const fSpring = -k * (pos - target);
        const fDamping = -c * vel;
        const a = fSpring + fDamping;

        vel += a * dt;

        // Softly damp velocity if reversing direction
        if ((target - pos) * vel < 0) {
          vel *= 0.5;
        }

        // Clamping maximum delta progress per frame so visual icon change NEVER exceeds 1.8px (budget: <= 2.0px)
        // Visual size change on 52px icon = delta * 13px <= 1.8px => delta <= 1.8 / 13 = 0.138
        const maxDelta = 1.8 / 13;
        const step = Math.max(-maxDelta, Math.min(maxDelta, vel * dt));
        pos += step;

        if (Math.abs(pos - target) < 0.001 && Math.abs(vel) < 0.001) {
          pos = target;
          vel = 0;
        }
      }

      progressRef.current = pos;
      velocityRef.current = vel;
      setExpansionProgress(pos);

      if (pos !== target || Math.abs(vel) > 0.001) {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        animFrameRef.current = null;
        lastAnimTimeRef.current = 0;
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (hoverState.type === 'expanded') {
      targetProgressRef.current = 1.0;
      startSpringAnimation();
    } else if (hoverState.type === 'closing' || hoverState.type === 'idle') {
      targetProgressRef.current = 0.0;
      startSpringAnimation();
    }
  }, [hoverState, startSpringAnimation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__portos_folder_controller = {
        getProgress: () => progressRef.current,
        getTarget: () => targetProgressRef.current,
        getVelocity: () => velocityRef.current,
        getActiveFolderId: () => activeFolderId,
      };
    }
  }, [activeFolderId]);

  // -----------------------------------------------------------------
  // 2. Drag & Click Separation Controller
  // -----------------------------------------------------------------
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasDragged: boolean;
    startTime: number;
  } | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastDraggedAtRef = useRef<number>(0);

  const savePositionsToStorage = useCallback(
    (newPositions: Record<string, { x: number; y: number }>) => {
      try {
        localStorage.setItem('portos_desktop_icons', JSON.stringify(newPositions));
      } catch {}
      if (onSavePositions) {
        onSavePositions(newPositions);
      }
    },
    [onSavePositions]
  );

  const iconScale = iconSize === 'small' ? 0.8 : iconSize === 'large' ? 1.25 : 1.0;
  const iconGraphicSize = Math.round(52 * iconScale);

  const defaultIcons = useMemo(
    () => [
      {
        id: 'projects',
        label: 'Projects',
        sublabel: folderItems?.['projects']?.length ? `${folderItems['projects'].length} items` : 'Empty',
        type: 'project' as const,
        onOpen: onOpenProjects,
      },
      {
        id: 'cert-education',
        label: 'Cert & Education',
        sublabel: folderItems?.['cert-education']?.length ? `${folderItems['cert-education'].length} items` : 'Empty',
        type: 'folder' as const,
        onOpen: onOpenCertEducation,
      },
      {
        id: 'owners-data',
        label: "Owner's Data",
        sublabel: folderItems?.['owners-data']?.length ? `${folderItems['owners-data'].length} items` : 'Empty',
        type: 'user' as const,
        onOpen: onOpenOwnersData,
      },
      {
        id: 'terminal',
        label: 'Terminal',
        sublabel: 'portsh shell',
        type: 'app' as const,
        onOpen: () => onOpenTerminal?.(),
      },
      {
        id: 'settings',
        label: 'Settings',
        sublabel: 'Preferences',
        type: 'app' as const,
        onOpen: () => onOpenSettings?.(),
      },
    ],
    [onOpenProjects, onOpenCertEducation, onOpenOwnersData, onOpenTerminal, onOpenSettings, folderItems]
  );

  const allIcons = useMemo(
    () => [
      ...defaultIcons,
      ...extraIcons.map((ei) => ({
        id: ei.id,
        label: ei.label,
        sublabel: folderItems?.[ei.id]?.length ? `${folderItems[ei.id].length} items` : 'Empty',
        type: (ei.type as any) || 'folder',
        onOpen: () => {
          if (onOpenExtraIcon) {
            onOpenExtraIcon(ei);
          } else if (onOpenFolder && (ei as any).folder) {
            onOpenFolder((ei as any).folder);
          }
        },
      })),
    ],
    [defaultIcons, extraIcons, onOpenExtraIcon, onOpenFolder, folderItems]
  );

  const orderedIcons = useMemo(() => {
    const list = [...allIcons];
    list.sort((a, b) => {
      let idxA = folderOrder.indexOf(a.id);
      let idxB = folderOrder.indexOf(b.id);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });
    return list;
  }, [allIcons, folderOrder]);

  const getIconPosition = useCallback(
    (id: string) => {
      const idx = orderedIcons.findIndex((ic) => ic.id === id);
      const safeIdx = idx !== -1 ? idx : 0;
      const slotW = Math.round(80 * iconScale);
      const startY = 48;
      const pitchY = Math.round(104 * iconScale);
      const maxY = viewport.height - 76; // Above dock
      const slotsPerCol = Math.max(1, Math.floor((maxY - startY) / pitchY));

      const col = Math.floor(safeIdx / slotsPerCol);
      const row = safeIdx % slotsPerCol;
      const y = startY + row * pitchY;
      let x = 0;
      if (configuredSide === 'right') {
        const baseRight = viewport.width - slotW - 24;
        x = baseRight - col * (slotW + 20);
      } else {
        const baseLeft = 24;
        x = baseLeft + col * (slotW + 20);
      }
      return { x, y };
    },
    [orderedIcons, iconScale, viewport, configuredSide]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return; // Right-click never starts a drag

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const cur = getIconPosition(id);

    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: cur.x,
      origY: cur.y,
      hasDragged: false,
      startTime: performance.now(),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!dragRef.current || dragRef.current.id !== id) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const dist = Math.hypot(dx, dy);

    if (!dragRef.current.hasDragged && dist >= 5) {
      dragRef.current.hasDragged = true;
      // Drag started: immediately collapse active folder and cancel displacement
      clearTimers();
      setHoverState({ type: 'idle' });
      setActiveDragId(id);
    }

    if (dragRef.current.hasDragged) {
      setDragDelta({ x: dx, y: dy });
      // Calculate target slot index in column
      const pitchY = Math.round(104 * iconScale);
      const targetSlot = Math.max(
        0,
        Math.min(orderedIcons.length - 1, Math.round((e.clientY - 48) / pitchY))
      );
      setHoveredSlotIndex(targetSlot);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!dragRef.current || dragRef.current.id !== id) return;

    const { startX, startY, hasDragged, startTime } = dragRef.current;
    const duration = performance.now() - startTime;
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    dragRef.current = null;
    setActiveDragId(null);
    setDragDelta({ x: 0, y: 0 });

    // Click versus drag: press < 5px and < 300ms is a pure click
    if (!hasDragged && dist < 5 && duration < 300) {
      setSelectedId(id);
      return;
    }

    if (hasDragged) {
      lastDraggedAtRef.current = Date.now();
      if (hoveredSlotIndex !== null) {
        const curIdx = orderedIcons.findIndex((ic) => ic.id === id);
        if (curIdx !== -1 && curIdx !== hoveredSlotIndex) {
          const nextOrder = orderedIcons.map((ic) => ic.id);
          const [moved] = nextOrder.splice(curIdx, 1);
          nextOrder.splice(hoveredSlotIndex, 0, moved);
          setFolderOrder(nextOrder);
          try {
            localStorage.setItem('portos_desktop_icon_order', JSON.stringify(nextOrder));
          } catch {}
        }
      }
      setHoveredSlotIndex(null);
    }
  };

  // -----------------------------------------------------------------
  // 3. Round 18 Step 7: Deterministic Expansion Zone & Neighbour Displacement
  // -----------------------------------------------------------------
  const calculatedDisplacements = useMemo(() => {
    if (!activeFolderId || activeDragId !== null) return {};
    const activeBase = getIconPosition(activeFolderId);
    if (!activeBase) return {};

    const items: Rect[] = allIcons.map((ic) => {
      const pos = getIconPosition(ic.id);
      return { id: ic.id, x: pos.x, y: pos.y, w: 80, h: 80, kind: 'icon' };
    });

    const vp = typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1920, height: 1080 };

    if (widgets && widgets.length > 0) {
      widgets.forEach((w, idx) => {
        const dims = getWidgetDimensions(w.type, w.config?.sizeMode, w.config?.customWidth, w.config?.customHeight);
        let effX = Math.max(16, Math.min(w.x, vp.width - dims.w - 16));
        let effY = w.y;
        if (vp.width < 500) {
          if (effY < 392) {
            effY = 392 + idx * 16;
          }
          effX = Math.max(16, Math.min(w.x, vp.width - dims.w - 16));
        } else {
          if (configuredSide === 'left') {
            if (effX < 280) effX = 290;
          } else {
            if (effX + dims.w > vp.width - 240) {
              effX = Math.max(16, vp.width - 240 - dims.w - 12);
            }
          }
        }
        items.push({ id: w.id, x: effX, y: effY, w: dims.w, h: dims.h, kind: 'widget' });
      });
    }

    return computeDisplacements(activeFolderId, activeBase, configuredSide, items, vp);
  }, [activeFolderId, activeDragId, configuredSide, getIconPosition, allIcons, widgets]);

  useEffect(() => {
    if (onExpansionChange) {
      if (activeFolderId && expansionProgress > 0.001) {
        onExpansionChange({ displacements: calculatedDisplacements, progress: expansionProgress });
      } else {
        onExpansionChange(null);
      }
    }
  }, [activeFolderId, expansionProgress, calculatedDisplacements, onExpansionChange]);

  // Sync positions when initialPositions or window resize occurs
  useEffect(() => {
    if (initialPositions && Object.keys(initialPositions).length > 0) {
      setPositions((prev) => {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('portos_desktop_icons');
          if (stored) return prev;
        }
        return { ...prev, ...initialPositions };
      });
    }
  }, [initialPositions]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('portos_desktop_icons');
        if (!stored) {
          setPositions(getDefaultPositions(configuredSide));
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [configuredSide]);

  const renderIconGraphic = (type: string, label: string, isSelected: boolean, iconId?: string) => {
    let kind: PortOSIconKind;
    if (type === 'folder') {
      kind = getIconKindForFolder(iconId, label);
    } else {
      kind = getIconKindForApp(label.toLowerCase());
    }
    return <PortOSIcon kind={kind} size={iconGraphicSize} selected={isSelected} />;
  };

  return (
    <div
      className="desktop-icons-container"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 20,
      }}
      onClick={() => setSelectedId(null)}
    >
      {/* Column Insertion Indicator during drag reordering */}
      {activeDragId !== null && hoveredSlotIndex !== null && (
        <div
          className="column-insertion-indicator"
          style={{
            position: 'absolute',
            left: `${configuredSide === 'right' ? viewport.width - Math.round(80 * iconScale) - 24 : 24}px`,
            top: `${48 + hoveredSlotIndex * Math.round(104 * iconScale) - 4}px`,
            width: `${Math.round(80 * iconScale)}px`,
            height: '3px',
            background: 'rgba(56, 189, 248, 0.95)',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.8)',
            borderRadius: '2px',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'top 0.12s ease-out',
          }}
        />
      )}

      {orderedIcons.map((icon) => {
        const slotIndex = orderedIcons.findIndex((ic) => ic.id === icon.id);
        const safeSlotIndex = slotIndex !== -1 ? slotIndex : 0;
        const basePos = getIconPosition(icon.id);
        const isSelected = selectedId === icon.id;
        const isDragging = activeDragId === icon.id;
        const isExpandedOrClosing = activeFolderId === icon.id;
        const targetDisp = calculatedDisplacements[icon.id] || { x: 0, y: 0 };
        const pushOffset = {
          x: targetDisp.x * expansionProgress,
          y: targetDisp.y * expansionProgress,
        };
        const isDisplaced = Math.abs(pushOffset.x) > 0.5 || Math.abs(pushOffset.y) > 0.5;
        const isOtherWhileExpanded = activeFolderId !== null && activeFolderId !== icon.id && (isDisplaced || expansionProgress > 0.05);

        const rawFiles = folderItems?.[icon.id] || DEFAULT_FOLDER_ITEMS[icon.id] || [];
        const floatItems: FolderFloatItem[] = rawFiles.map((f: any) => ({
          label: f.name || f.label || 'Document.md',
          value: f.id || f.name,
          file: f,
          icon: <PortOSIcon kind={f.kind === 'code' ? 'code' : f.kind === 'folder' ? 'folder' : 'markdown'} size={13} />,
        }));
        const theme = ICON_THEMES[icon.id] || {
          folderColor: '#1e3a8a',
          frontColor: '#2563eb',
          paperColor: '#ffffff',
          labelColor: '#ffffff',
          itemColor: 'rgba(22, 26, 38, 0.94)',
          itemTextColor: '#f3f4f6',
          iconKind: (icon.type === 'folder' ? getIconKindForFolder(icon.id, icon.label) : getIconKindForApp(icon.label.toLowerCase())) as PortOSIconKind,
        };

        const isLeft = configuredSide === 'left';

        return (
          <div
            key={icon.id}
            id={`desktop-item-${icon.id}`}
            className={`desktop-icon-item movable-icon di-slot ${isSelected ? 'is-selected' : ''}`}
            tabIndex={focusedId === icon.id ? 0 : -1}
            role="button"
            aria-label={icon.label}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate3d(var(--slot-x, ${basePos.x}px), var(--slot-y, ${basePos.y}px), 0)`,
              ['--slot-x' as any]: `${basePos.x}px`,
              ['--slot-y' as any]: `${basePos.y}px`,
              width: `${Math.round(88 * iconScale)}px`,
              display: 'block',
              padding: 0,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
              pointerEvents: isOtherWhileExpanded ? 'none' : 'auto',
              zIndex: isDragging ? 35 : isSelected ? 30 : isExpandedOrClosing ? 28 : 25,
              transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: isDragging ? '0ms' : `${safeSlotIndex * 40}ms`,
            }}
            onPointerDown={(e) => handlePointerDown(e, icon.id)}
            onPointerMove={(e) => handlePointerMove(e, icon.id)}
            onPointerUp={(e) => handlePointerUp(e, icon.id)}
            onPointerCancel={(e) => handlePointerUp(e, icon.id)}
            onLostPointerCapture={(e) => handlePointerUp(e, icon.id)}
            onPointerEnter={() => handleFolderEnter(icon.id)}
            onPointerLeave={() => handleFolderLeave(icon.id)}
            onFocus={() => {
              setFocusedId(icon.id);
              setSelectedId(icon.id);
              if (!escapedRef.current) {
                handleFolderEnter(icon.id);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastDraggedAtRef.current < 250) return;
              setSelectedId(icon.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastDraggedAtRef.current < 250) return;
              clearTimers();
              setHoverState({ type: 'idle' });
              handleTriggerOpen(icon.id, icon.onOpen);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                const curIdx = orderedIcons.findIndex((ic) => ic.id === icon.id);
                const nextIdx = (curIdx + 1) % orderedIcons.length;
                const nextId = orderedIcons[nextIdx].id;
                setFocusedId(nextId);
                setSelectedId(nextId);
                document.getElementById(`desktop-item-${nextId}`)?.focus();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const curIdx = orderedIcons.findIndex((ic) => ic.id === icon.id);
                const prevIdx = (curIdx - 1 + orderedIcons.length) % orderedIcons.length;
                const prevId = orderedIcons[prevIdx].id;
                setFocusedId(prevId);
                setSelectedId(prevId);
                document.getElementById(`desktop-item-${prevId}`)?.focus();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                clearTimers();
                setHoverState({ type: 'idle' });
                handleTriggerOpen(icon.id, icon.onOpen);
              } else if (
                (configuredSide === 'right' && e.key === 'ArrowLeft') ||
                (configuredSide === 'left' && e.key === 'ArrowRight')
              ) {
                // Arrow toward interior: move focus into the files!
                e.preventDefault();
                const firstPill = document.querySelector(
                  `#desktop-item-${icon.id} .folder-float__item`
                ) as HTMLElement;
                if (firstPill) {
                  firstPill.focus();
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                escapedRef.current = true;
                clearTimers();
                setHoverState({ type: 'idle' });
                setTimeout(() => {
                  escapedRef.current = false;
                }, 350);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedId(icon.id);
              clearTimers();
              setHoverState({ type: 'idle' });

              const now = Date.now();
              if (lastRightClickRef.current.id === icon.id && now - lastRightClickRef.current.time < 400) {
                // Double right click -> direct open with tactile opening animation!
                lastRightClickRef.current = { id: '', time: 0 };
                handleTriggerOpen(icon.id, icon.onOpen);
                return;
              }
              lastRightClickRef.current = { id: icon.id, time: now };

              onContextMenuIcon?.(e, icon.id, icon.label);
            }}
          >
            {/* LAYER 2: .di-push — Temporary displacement from displacement controller */}
            <div
              className="di-push"
              style={{
                width: '100%',
                transform: `translate3d(var(--push-x, ${pushOffset.x}px), var(--push-y, ${pushOffset.y}px), 0)`,
                ['--push-x' as any]: `${pushOffset.x}px`,
                ['--push-y' as any]: `${pushOffset.y}px`,
                transition: isDragging ? 'none' : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* LAYER 3: .di-drag — Drag offset from drag controller */}
              <div
                className="di-drag"
                style={{
                  width: '100%',
                  transform: isDragging
                    ? `translate3d(var(--drag-x, ${dragDelta.x}px), var(--drag-y, ${dragDelta.y}px), 0)`
                    : 'translate3d(0px, 0px, 0)',
                  ['--drag-x' as any]: isDragging ? `${dragDelta.x}px` : '0px',
                  ['--drag-y' as any]: isDragging ? `${dragDelta.y}px` : '0px',
                }}
              >
                {/* LAYER 4: .di-zoom – Tactile Folder Opening Animation & Original Basic Icon */}
                {(() => {
                  const isOpening = openingFolderId === icon.id;
                  const zoomScaleVal = isOpening ? 1.18 : 1;

                  return (
                    <div
                      className={`di-zoom ${isOpening ? 'is-opening' : ''}`}
                      style={{
                        width: '100%',
                        transform: `scale(${zoomScaleVal.toFixed(4)})`,
                        ['--zoom-scale' as any]: zoomScaleVal.toFixed(4),
                        transformOrigin: 'center center',
                        transition: isOpening
                          ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                          : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 4px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                        outline: isSelected ? '1px solid rgba(56, 189, 248, 0.45)' : 'none',
                      }}
                    >
                      <div
                        className={`desktop-icon-graphic ${isOpening ? 'is-opening' : ''}`}
                        data-opening={isOpening ? 'true' : undefined}
                        style={{
                          width: `${iconGraphicSize}px`,
                          height: `${iconGraphicSize}px`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          transform: isOpening ? 'scale(1.2)' : 'scale(1)',
                        }}
                      >
                        <PortOSIcon kind={theme.iconKind} size={iconGraphicSize} selected={isSelected} />
                      </div>
                      <span
                        className="desktop-icon-label"
                        style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#f8fafc',
                          textAlign: 'center',
                          textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: `${Math.round(80 * iconScale)}px`,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isSelected ? 'rgba(56, 189, 248, 0.45)' : 'transparent',
                        }}
                      >
                        {icon.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
