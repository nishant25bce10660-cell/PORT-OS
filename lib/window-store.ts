import { create } from 'zustand';

export type WindowMode = 'normal' | 'min' | 'max' | 'snapL' | 'snapR';

export interface WindowMeta {
  type: 'folder' | 'file' | 'owner' | 'widgets' | 'settings' | 'terminal' | 'trash';
  itemId?: string;
  folderNavId?: string;
}

export interface WindowItem {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  mode: WindowMode;
  prevBounds?: { x: number; y: number; w: number; h: number };
  meta: WindowMeta;
}

interface WindowStoreState {
  windows: Record<string, WindowItem>;
  windowOrder: string[]; // IDs in render order
  activeWindowId: string | null;
  topZ: number;
  cascadeIndex: number;
  snapPreview: { visible: boolean; x: number; y: number; w: number; h: number } | null;

  // Actions
  openWindow: (def: {
    id: string;
    title: string;
    meta: WindowMeta;
    width?: number;
    height?: number;
  }) => void;
  focusWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: Partial<WindowItem>) => void;
  cycleTrafficSnap: (id: string) => void;
  toggleMaximize: (id: string) => void;
  setSnapPreview: (preview: { visible: boolean; x: number; y: number; w: number; h: number } | null) => void;
  hydrateFromStorage: (role: string) => void;
  persistToStorage: (role: string) => void;
}

const STORAGE_PREFIX = 'portos_windows_';
const MENUBAR_HEIGHT = 28;
const DOCK_RESERVE = 68;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;

export const useWindowStore = create<WindowStoreState>((set, get) => ({
  windows: {},
  windowOrder: [],
  activeWindowId: null,
  topZ: 100,
  cascadeIndex: 0,
  snapPreview: null,

  openWindow: ({ id, title, meta, width, height }) => {
    const state = get();
    const existing = state.windows[id];

    if (existing) {
      // Bring existing to front and unminimize
      const nextZ = state.topZ + 1;
      set({
        windows: {
          ...state.windows,
          [id]: {
            ...existing,
            title,
            meta: { ...existing.meta, ...meta },
            mode: existing.mode === 'min' ? 'normal' : existing.mode,
            z: nextZ,
          },
        },
        activeWindowId: id,
        topZ: nextZ,
      });
      return;
    }

    // New Window Placement (Centered + Cascade, never x=0)
    const vpW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;

    const w = Math.max(MIN_WIDTH, Math.min(vpW - 60, width || 680));
    const h = Math.max(MIN_HEIGHT, Math.min(vpH - MENUBAR_HEIGHT - DOCK_RESERVE - 20, height || 460));

    // Center in free screen area, then offset by cascade
    const offset = (state.cascadeIndex % 6) * 28;
    const centerX = Math.max(48, Math.round((vpW - w) / 2) + offset);
    const centerY = Math.max(MENUBAR_HEIGHT + 16, Math.round((vpH - MENUBAR_HEIGHT - DOCK_RESERVE - h) / 2) + offset);

    const nextZ = state.topZ + 1;

    const newWindow: WindowItem = {
      id,
      title,
      x: centerX,
      y: centerY,
      w,
      h,
      z: nextZ,
      mode: 'normal',
      meta,
    };

    set({
      windows: { ...state.windows, [id]: newWindow },
      windowOrder: [...state.windowOrder.filter((wid) => wid !== id), id],
      activeWindowId: id,
      topZ: nextZ,
      cascadeIndex: state.cascadeIndex + 1,
    });
  },

  focusWindow: (id: string) => {
    const state = get();
    const win = state.windows[id];
    if (!win) return;

    if (state.activeWindowId === id && win.z === state.topZ && win.mode !== 'min') {
      return;
    }

    const nextZ = state.topZ + 1;
    set({
      windows: {
        ...state.windows,
        [id]: {
          ...win,
          z: nextZ,
          mode: win.mode === 'min' ? 'normal' : win.mode,
        },
      },
      activeWindowId: id,
      topZ: nextZ,
    });
  },

  closeWindow: (id: string) => {
    const state = get();
    const nextWindows = { ...state.windows };
    delete nextWindows[id];

    const nextOrder = state.windowOrder.filter((wid) => wid !== id);
    const nextActive = nextOrder.length > 0 ? nextOrder[nextOrder.length - 1] : null;

    set({
      windows: nextWindows,
      windowOrder: nextOrder,
      activeWindowId: nextActive,
    });
  },

  minimizeWindow: (id: string) => {
    const state = get();
    const win = state.windows[id];
    if (!win) return;

    const nextWindows = {
      ...state.windows,
      [id]: { ...win, mode: 'min' as WindowMode },
    };

    // Find next active window that is not minimized
    const visibleWindows = state.windowOrder.filter(
      (wid) => wid !== id && nextWindows[wid] && nextWindows[wid].mode !== 'min'
    );
    const nextActive = visibleWindows.length > 0 ? visibleWindows[visibleWindows.length - 1] : null;

    set({
      windows: nextWindows,
      activeWindowId: nextActive,
    });
  },

  restoreWindow: (id: string) => {
    get().focusWindow(id);
  },

  updateWindowBounds: (id: string, bounds: Partial<WindowItem>) => {
    const state = get();
    const win = state.windows[id];
    if (!win) return;

    set({
      windows: {
        ...state.windows,
        [id]: { ...win, ...bounds },
      },
    });
  },

  cycleTrafficSnap: (id: string) => {
    const state = get();
    const win = state.windows[id];
    if (!win) return;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const usableH = vpH - MENUBAR_HEIGHT - DOCK_RESERVE;

    if (win.mode === 'normal') {
      // Snap Left
      set({
        windows: {
          ...state.windows,
          [id]: {
            ...win,
            prevBounds: { x: win.x, y: win.y, w: win.w, h: win.h },
            x: 0,
            y: MENUBAR_HEIGHT,
            w: Math.floor(vpW / 2),
            h: usableH,
            mode: 'snapL',
          },
        },
      });
    } else if (win.mode === 'snapL') {
      // Snap Right
      set({
        windows: {
          ...state.windows,
          [id]: {
            ...win,
            x: Math.floor(vpW / 2),
            y: MENUBAR_HEIGHT,
            w: Math.floor(vpW / 2),
            h: usableH,
            mode: 'snapR',
          },
        },
      });
    } else {
      // Restore
      const prev = win.prevBounds || {
        x: Math.round((vpW - 680) / 2),
        y: MENUBAR_HEIGHT + 30,
        w: 680,
        h: 460,
      };
      set({
        windows: {
          ...state.windows,
          [id]: {
            ...win,
            x: prev.x,
            y: prev.y,
            w: prev.w,
            h: prev.h,
            mode: 'normal',
          },
        },
      });
    }
  },

  toggleMaximize: (id: string) => {
    const state = get();
    const win = state.windows[id];
    if (!win) return;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const usableH = vpH - MENUBAR_HEIGHT - DOCK_RESERVE;

    if (win.mode !== 'max') {
      set({
        windows: {
          ...state.windows,
          [id]: {
            ...win,
            prevBounds: { x: win.x, y: win.y, w: win.w, h: win.h },
            x: 0,
            y: MENUBAR_HEIGHT,
            w: vpW,
            h: usableH,
            mode: 'max',
          },
        },
      });
    } else {
      const prev = win.prevBounds || {
        x: Math.round((vpW - 680) / 2),
        y: MENUBAR_HEIGHT + 30,
        w: 680,
        h: 460,
      };
      set({
        windows: {
          ...state.windows,
          [id]: {
            ...win,
            x: prev.x,
            y: prev.y,
            w: prev.w,
            h: prev.h,
            mode: 'normal',
          },
        },
      });
    }
  },

  setSnapPreview: (preview) => {
    set({ snapPreview: preview });
  },

  hydrateFromStorage: (role: string) => {
    try {
      const key = `${STORAGE_PREFIX}${role}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.windows && typeof parsed.windows === 'object') {
          const keys = Object.keys(parsed.windows);
          if (keys.length > 0) {
            let maxZ = 100;
            keys.forEach((k) => {
              maxZ = Math.max(maxZ, parsed.windows[k].z || 100);
            });
            set({
              windows: parsed.windows,
              windowOrder: keys,
              activeWindowId: parsed.activeWindowId || keys[keys.length - 1],
              topZ: maxZ + 1,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Storage hydration failed:', e);
    }
  },

  persistToStorage: (role: string) => {
    try {
      const state = get();
      const key = `${STORAGE_PREFIX}${role}`;
      const payload = {
        windows: state.windows,
        activeWindowId: state.activeWindowId,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      console.warn('Storage persistence failed:', e);
    }
  },
}));
