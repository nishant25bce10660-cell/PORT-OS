'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Wallpaper from '@/components/Wallpaper';
import CircularGallery from '@/components/CircularGallery';
import MenuBar from '@/components/MenuBar';
import DesktopIcons from '@/components/DesktopIcons';
import Dock, { MinimizedWindowInfo } from '@/components/Dock';
import Window, { WindowState } from '@/components/Window';
import FolderView from '@/components/FolderView';
import FileEditor from '@/components/FileEditor';
import OwnerProfileView from '@/components/OwnerProfileView';
import SystemSettings from '@/components/SystemSettings';
import Widgets from '@/components/Widgets';
import WidgetGallery from '@/components/WidgetGallery';
import LoginModal from '@/components/LoginModal';
import BootScreen from '@/components/BootScreen';
import PowerOverlay, { PowerState } from '@/components/PowerOverlay';
import SpotlightModal from '@/components/SpotlightModal';
import { ContextMenuItem, ContextMenuProvider, useContextMenu } from '@/components/ContextMenu';
import ToastContainer from '@/components/ToastContainer';
import TerminalView from '@/components/TerminalView';
import AboutModal from '@/components/AboutModal';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { toastManager } from '@/lib/toast';
import { sound } from '@/lib/sound';
import {
  PortfolioData,
  FolderItem,
  FileItem,
  Item,
  Widget,
  WidgetType,
  OwnerInfo,
  SystemSettings as ISystemSettings,
  DEFAULT_SETTINGS,
  DEFAULT_CLOCK_CONFIG,
  DEFAULT_CUSTOMIZATION,
  DEFAULT_EFFECTS_CONFIG,
} from '@/lib/types';
import { findItemById, findParentFolder } from '@/lib/tree';

interface WindowContentMeta {
  type: 'folder' | 'file' | 'owner' | 'widgets' | 'settings' | 'terminal' | 'about';
  itemId?: string;
  folderNavId?: string; // current active folder within the window
  initialCommand?: string;
}

interface FullWindowState extends WindowState {
  meta: WindowContentMeta;
}

type SystemPowerState = PowerState | 'booting';

const getStorageKey = (role?: string) => `portfolio_os_windows_${role || 'viewer'}_v2`;

function DesktopContent() {
  const { openContextMenu } = useContextMenu();
  const [user, setUser] = useState<{
    role: 'viewer' | 'admin';
    name?: string;
    email?: string;
    username?: string;
  } | null>(null);

  const [loadingSession, setLoadingSession] = useState(true);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [windows, setWindows] = useState<FullWindowState[]>([]);
  const [topZ, setTopZ] = useState(100);
  const [snapPreview, setSnapPreview] = useState<{ visible: boolean; x: number; y: number; w: number; h: number } | null>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(80);
  const [folderExpansion, setFolderExpansion] = useState<{
    displacements: Record<string, { x: number; y: number }>;
    progress: number;
  } | null>(null);

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    sound.setMasterVolume(val / 100);
  }, []);

  const hasMaximizedWindow = useMemo(() => {
    return windows.some((w) => !w.isMinimized && w.snapMode === 'max');
  }, [windows]);

  // Global Ctrl+K / Cmd+K listener for Spotlight
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const [powerState, setPowerState] = useState<SystemPowerState>('running');
  const portfolioDataRef = useRef<PortfolioData | null>(null);

  // Check if session needs initial boot sequence
  useEffect(() => {
    try {
      if (sessionStorage.getItem('portos_booted') !== 'true') {
        setPowerState('booting');
      }
    } catch {}
  }, []);

  // Fetch initial session & role from server
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/session');
        if (res.ok) {
          const data = await res.json();
          const session = data?.user || (data?.role ? data : null);
          if (session && session.role) {
            setUser({
              role: session.role,
              name: session.name,
              email: session.email,
              username: session.username,
            });
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setLoadingSession(false);
      }
    };
    checkSession();
  }, []);

  // Global suppression of right click until entering the main screen
  useEffect(() => {
    const blockPreLoginContextMenu = (e: MouseEvent) => {
      if (!user || powerState !== 'running') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('contextmenu', blockPreLoginContextMenu, { capture: true });
    return () => {
      window.removeEventListener('contextmenu', blockPreLoginContextMenu, { capture: true });
    };
  }, [user, powerState]);

  // Sync portfolioDataRef
  useEffect(() => {
    portfolioDataRef.current = portfolioData;
  }, [portfolioData]);

  // Load portfolio data
  const loadPortfolioData = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data: PortfolioData = await res.json();
        // Check for viewer local widget layout preferences
        if (typeof window !== 'undefined') {
          try {
            const storedWidgets = localStorage.getItem('portos_widgets_layout');
            if (storedWidgets) {
              const parsed = JSON.parse(storedWidgets);
              if (Array.isArray(parsed)) {
                data.widgets = parsed;
              }
            }
            const storedCustom = localStorage.getItem('portos_customization');
            if (storedCustom && data.settings) {
              const parsedCustom = JSON.parse(storedCustom);
              data.settings.customization = {
                ...data.settings.customization,
                ...parsedCustom,
              };
            }
          } catch {}
        }
        setPortfolioData(data);
      }
    } catch (err) {
      console.error('Failed to load portfolio data:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadPortfolioData();
    }
  }, [user, loadPortfolioData]);

  // Restore Window states from localStorage based on role
  useEffect(() => {
    if (!user) return;
    try {
      const key = getStorageKey(user.role);
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWindows(parsed);
          const maxZ = parsed.reduce((acc, curr) => Math.max(acc, curr.zIndex || 100), 100);
          setTopZ(maxZ + 1);
        }
      }
    } catch (e) {
      console.error('Failed to restore windows from localStorage:', e);
    }
  }, [user]);

  // Save Window states to localStorage debounced
  useEffect(() => {
    if (!user) return;
    const key = getStorageKey(user.role);
    try {
      localStorage.setItem(key, JSON.stringify(windows));
    } catch (e) {
      console.error('Failed to save windows to localStorage:', e);
    }
  }, [windows, user]);

  // Open a new or existing window, centered in viewport
  const openWindow = useCallback(
    (
      id: string,
      title: string,
      meta: WindowContentMeta,
      defaultDimensions: { width: number; height: number } = { width: 720, height: 480 }
    ) => {
      sound.playWindowOpenSound();
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === id);
        if (existing) {
          // Restore and bring to front
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('portos-trigger-restore', { detail: { id } }));
          }
          const newZ = topZ + 1;
          setTopZ(newZ);
          return prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  isMinimized: false,
                  isRestoring: true,
                  zIndex: newZ,
                  meta: { ...w.meta, ...meta },
                }
              : w
          );
        }

        // Center window in viewport
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
        const w = Math.min(defaultDimensions.width, screenW - 40);
        const h = Math.min(defaultDimensions.height, screenH - 120);
        // Calculate window position (centered for first, +28px cascade for successive)
        let x: number;
        let y: number;
        if (prev.length > 0) {
          const lastWin = prev[prev.length - 1];
          x = lastWin.x + 28;
          y = lastWin.y + 28;
        } else {
          x = Math.max(20, Math.round((screenW - w) / 2));
          y = Math.max(44, Math.round((screenH - h) / 2) - 10);
        }

        const newZ = topZ + 1;
        setTopZ(newZ);

        const newWin: FullWindowState = {
          id,
          title,
          x,
          y,
          width: w,
          height: h,
          isMinimized: false,
          snapMode: 'normal',
          zIndex: newZ,
          meta,
        };
        return [...prev, newWin];
      });
    },
    [topZ]
  );

  // Focus Window (bring to top)
  const focusWindow = useCallback(
    (id: string) => {
      setTopZ((prevTop) => {
        const nextZ = prevTop + 1;
        setWindows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, zIndex: nextZ } : w))
        );
        return nextZ;
      });
    },
    []
  );

  // Close Window
  const closeWindow = useCallback((id: string) => {
    sound.playWindowCloseSound();
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // Minimize Window
  const minimizeWindow = useCallback((id: string) => {
    sound.playWindowMinimizeSound();
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
  }, []);

  // Restore Window
  const restoreWindow = useCallback(
    (id: string) => {
      sound.playWindowOpenSound();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('portos-trigger-restore', { detail: { id } }));
      }
      setTopZ((prevTop) => {
        const nextZ = prevTop + 1;
        setWindows((prev) =>
          prev.map((w) =>
            w.id === id
              ? { ...w, isMinimized: false, isRestoring: true, zIndex: nextZ }
              : w
          )
        );
        return nextZ;
      });
    },
    []
  );

  // Toggle Zoom / Maximize Window
  const toggleZoomWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (w.snapMode === 'max') {
          return {
            ...w,
            snapMode: 'normal',
            x: (w as any).prevX || 60,
            y: (w as any).prevY || 60,
            width: (w as any).prevW || 720,
            height: (w as any).prevH || 480,
          };
        } else {
          return {
            ...w,
            snapMode: 'max',
            prevX: w.x,
            prevY: w.y,
            prevW: w.width,
            prevH: w.height,
          };
        }
      })
    );
  }, []);

  // Update Window State
  const updateWindowState = useCallback((id: string, patch: Partial<WindowState>) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  }, []);

  // Snap Preview update
  const handleSnapPreview = useCallback(
    (preview: { visible: boolean; x: number; y: number; w: number; h: number } | null) => {
      setSnapPreview(preview);
    },
    []
  );

  // Sign out handler
  const handleSignOut = async () => {
    sound.playLogoutSound();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    const currentRole = user?.role;
    setUser(null);
    setWindows([]);
    try {
      const key = getStorageKey(currentRole);
      localStorage.removeItem(key);
    } catch {}
  };

  // Login success
  const handleLoginSuccess = async (loggedInUser: {
    role: 'viewer' | 'admin';
    name?: string;
    email?: string;
    username?: string;
  }) => {
    setUser(loggedInUser);
    await loadPortfolioData();
  };

  // Folder navigation within a window
  const handleNavigateFolderInWindow = useCallback(
    (winId: string, folder: FolderItem) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === winId
            ? {
                ...w,
                title: folder.name,
                meta: { ...w.meta, folderNavId: folder.id },
              }
            : w
        )
      );
    },
    []
  );

  // Open file in new or focused window
  const handleOpenFile = useCallback(
    (file: FileItem) => {
      openWindow(`file-${file.id}`, file.name, {
        type: 'file',
        itemId: file.id,
      }, { width: 620, height: 440 });
    },
    [openWindow]
  );

  // Add Item (file or folder) - Owner authorized
  const handleAddItem = useCallback(
    async (parentId: string, kind: 'folder' | 'file') => {
      if (user?.role !== 'admin') return;
      const defaultName = kind === 'folder' ? 'Untitled Folder' : 'Untitled.md';
      const name = prompt(`Enter ${kind} name:`, defaultName);
      if (!name) return;

      const newItem: Item =
        kind === 'folder'
          ? { id: `folder-${Date.now()}`, name, kind: 'folder', children: [] }
          : { id: `file-${Date.now()}`, name, kind: 'file', content: `# ${name}\n\nEnter content here...` };

      try {
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId, item: newItem }),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
        }
      } catch (err) {
        console.error('Failed to add item:', err);
      }
    },
    [user]
  );

  // Rename Item
  const handleRenameItem = useCallback(
    async (itemId: string, newName: string) => {
      if (user?.role !== 'admin') return;
      try {
        const res = await fetch(`/api/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
          setWindows((prev) =>
            prev.map((w) =>
              w.meta.itemId === itemId ? { ...w, title: newName } : w
            )
          );
        }
      } catch (err) {
        console.error('Failed to rename item:', err);
      }
    },
    [user]
  );

  // Delete Item
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (user?.role !== 'admin') return;
      try {
        const res = await fetch(`/api/items/${itemId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
          setWindows((prev) => prev.filter((w) => w.meta.itemId !== itemId && w.id !== itemId));
        }
      } catch (err) {
        console.error('Failed to delete item:', err);
      }
    },
    [user]
  );

  const lastTrashedRef = useRef<string | null>(null);

  // Move to Trash
  const handleMoveToTrash = useCallback(
    async (itemId: string) => {
      if (user?.role !== 'admin') return;
      try {
        const res = await fetch('/api/items/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId }),
        });

        if (res.ok) {
          const json = await res.json();
          lastTrashedRef.current = itemId;
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root, trash: json.trash } : null));
          setWindows((prev) => prev.filter((w) => w.meta.itemId !== itemId && w.id !== itemId));
          toastManager.notify({
            type: 'warning',
            title: 'Moved to Trash',
            message: 'Item has been moved to Trash (Ctrl+Z to Undo)',
          });
        }
      } catch (err) {
        console.error('Failed to move item to trash:', err);
      }
    },
    [user]
  );

  // Restore from Trash
  const handleRestoreTrash = useCallback(
    async (itemId: string) => {
      if (user?.role !== 'admin') return;
      try {
        const res = await fetch('/api/items/trash/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId }),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root, trash: json.trash } : null));
          toastManager.notify({
            type: 'success',
            title: 'Item Restored',
            message: 'Item restored to original location',
          });
        }
      } catch (err) {
        console.error('Failed to restore trash item:', err);
      }
    },
    [user]
  );

  // Empty Trash
  const handleEmptyTrash = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/items/trash', {
        method: 'DELETE',
      });
      if (res.ok) {
        setPortfolioData((prev) => (prev ? { ...prev, trash: [] } : null));
        toastManager.notify({
          type: 'info',
          title: 'Trash Emptied',
          message: 'All items in Trash have been permanently deleted',
        });
      }
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  }, [user]);

  // Global keyboard shortcut for Undo (Ctrl+Z / Cmd+Z)
  useEffect(() => {
    const handleGlobalUndo = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (lastTrashedRef.current && user?.role === 'admin') {
          e.preventDefault();
          const targetId = lastTrashedRef.current;
          lastTrashedRef.current = null;
          handleRestoreTrash(targetId);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalUndo);
    return () => window.removeEventListener('keydown', handleGlobalUndo);
  }, [user, handleRestoreTrash]);

  // Save System Settings
  const handleSaveSettings = useCallback(
    async (nextSettings: Partial<ISystemSettings>) => {
      if (user?.role !== 'admin') {
        // Viewer: apply to local state and persist to localStorage so it survives reload
        if (nextSettings.customization) {
          try {
            const stored = localStorage.getItem('portos_customization');
            const prevCustom = stored ? JSON.parse(stored) : {};
            const updated = { ...prevCustom, ...nextSettings.customization };
            localStorage.setItem('portos_customization', JSON.stringify(updated));
          } catch {}
        }
        setPortfolioData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            settings: {
              ...prev.settings,
              ...nextSettings,
              customization: {
                ...prev.settings?.customization,
                ...nextSettings.customization,
              },
            } as ISystemSettings,
          };
        });
        return;
      }
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextSettings),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, settings: json.settings } : null));
        }
      } catch (err) {
        console.error('Failed to save settings:', err);
        throw err;
      }
    },
    [user]
  );

  // Reset to Defaults
  const handleResetSettings = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setPortfolioData((prev) => (prev ? { ...prev, settings: json.settings } : null));
      }
    } catch (err) {
      console.error('Failed to reset settings:', err);
      throw err;
    }
  }, [user]);

  // Import file from PC into Folder
  const handleImportFromPC = useCallback(
    async (targetFolderId: string, fileData: { name: string; content: string }) => {
      const newItem: Item = {
        id: `file-${Date.now()}`,
        name: fileData.name,
        kind: 'file',
        content: fileData.content,
      };

      try {
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetFolderId, item: newItem }),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
          toastManager.notify({
            type: 'success',
            title: 'File Imported',
            message: `Successfully imported "${fileData.name}"`,
          });
        }
      } catch (err) {
        console.error('Failed to import file:', err);
      }
    },
    []
  );

  // Save File content
  const handleSaveFileContent = useCallback(
    async (fileId: string, newContent: string) => {
      if (user?.role !== 'admin') {
        throw new Error('Unauthorized');
      }

      const res = await fetch(`/api/items/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });

      if (!res.ok) {
        throw new Error('Save failed');
      }

      const json = await res.json();
      setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
    },
    [user]
  );

  // Save Owner Profile
  const handleSaveOwner = useCallback(
    async (updatedOwner: OwnerInfo) => {
      if (user?.role !== 'admin') {
        throw new Error('Unauthorized');
      }

      const res = await fetch('/api/portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: updatedOwner }),
      });

      if (!res.ok) {
        throw new Error('Save owner profile failed');
      }

      setPortfolioData((prev) => (prev ? { ...prev, owner: updatedOwner } : null));
    },
    [user]
  );

  // Widget updates with personal/shared separation
  const handleUpdateWidgetPosition = useCallback(
    async (id: string, x: number, y: number) => {
      if (!portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.map((w) => (w.id === id ? { ...w, x, y } : w));
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      if (user?.role === 'admin') {
        try {
          await fetch('/api/widgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets: nextWidgets }),
          });
        } catch (err) {
          console.error('Failed to save widget position:', err);
        }
      } else {
        // Viewer: save to local storage
        try {
          localStorage.setItem('portos_widgets_layout', JSON.stringify(nextWidgets));
        } catch {}
      }
    },
    [user]
  );

  const handleUpdateWidgetText = useCallback(
    async (id: string, text: string) => {
      if (!portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.map((w) => (w.id === id ? { ...w, text } : w));
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      if (user?.role === 'admin') {
        try {
          await fetch('/api/widgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets: nextWidgets }),
          });
        } catch (err) {
          console.error('Failed to save widget text:', err);
        }
      } else {
        try {
          localStorage.setItem('portos_widgets_layout', JSON.stringify(nextWidgets));
        } catch {}
      }
    },
    [user]
  );

  const handleDeleteWidget = useCallback(
    async (id: string) => {
      if (!portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.filter((w) => w.id !== id);
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      if (user?.role === 'admin') {
        try {
          await fetch('/api/widgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets: nextWidgets }),
          });
        } catch (err) {
          console.error('Failed to delete widget:', err);
        }
      } else {
        try {
          localStorage.setItem('portos_widgets_layout', JSON.stringify(nextWidgets));
        } catch {}
      }
    },
    [user]
  );

  const handleUpdateWidgetConfig = useCallback(
    async (id: string, patch: Partial<Widget>) => {
      if (!portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      if (user?.role === 'admin') {
        try {
          await fetch('/api/widgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets: nextWidgets }),
          });
        } catch (err) {
          console.error('Failed to update widget config:', err);
        }
      } else {
        try {
          localStorage.setItem('portos_widgets_layout', JSON.stringify(nextWidgets));
        } catch {}
      }
    },
    [user]
  );

  const handleAddWidget = useCallback(
    async (type: WidgetType, customWidget?: Widget) => {
      if (!portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const widgetId = customWidget?.id || `widget-${Date.now()}`;
      const defaultX = Math.max(30, Math.min(typeof window !== 'undefined' ? window.innerWidth - 340 : 800, 60 + currentWidgets.length * 30));
      const defaultY = Math.max(60, Math.min(typeof window !== 'undefined' ? window.innerHeight - 280 : 500, 80 + currentWidgets.length * 40));

      let newWidget: Widget;
      if (customWidget) {
        newWidget = {
          ...customWidget,
          id: widgetId,
          x: customWidget.x ?? defaultX,
          y: customWidget.y ?? defaultY,
        };
      } else {
        let text = 'Widget';
        let config: Record<string, any> | undefined = undefined;

        switch (type) {
          case 'clock':
            text = 'Tokyo, JP';
            break;
          case 'analog-clock':
            text = 'San Francisco, CA';
            break;
          case 'calendar':
            text = 'Monthly View';
            break;
          case 'countdown':
            text = 'Launch Day';
            config = { targetDate: '2026-12-31T00:00', targetLabel: 'Launch Day' };
            break;
          case 'note':
            text = 'New reminder note...';
            break;
          case 'todo':
            text = 'Sprint Tasks';
            config = {
              todos: [
                { id: '1', text: 'Review pull requests', completed: false },
                { id: '2', text: 'Deploy to edge', completed: true },
              ],
            };
            break;
          case 'counter':
            text = 'Stats counter';
            break;
          case 'metric':
            text = 'System Uptime';
            config = { metricValue: '99.98%', metricTrend: '+0.04% vs last week', metricStatus: 'success' };
            break;
          case 'quote':
            text = 'Stay hungry, stay foolish.';
            config = { quoteAuthor: 'Steve Jobs' };
            break;
          case 'custom':
            text = 'Custom Widget';
            break;
        }

        newWidget = {
          id: widgetId,
          type,
          x: defaultX,
          y: defaultY,
          text,
          config,
        };
      }

      const nextWidgets = [...currentWidgets, newWidget];
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      if (user?.role === 'admin') {
        try {
          await fetch('/api/widgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets: nextWidgets }),
          });
        } catch (err) {
          console.error('Failed to add widget:', err);
        }
      } else {
        try {
          localStorage.setItem('portos_widgets_layout', JSON.stringify(nextWidgets));
        } catch {}
      }
    },
    [user]
  );

  // Compute stats for counter widget
  const { totalFiles, totalProjects } = useMemo(() => {
    if (!portfolioData) return { totalFiles: 0, totalProjects: 0 };
    let files = 0;
    let projects = 0;

    const countItems = (items: Item[]) => {
      for (const item of items) {
        if (item.kind === 'file') {
          files++;
        } else if (item.kind === 'folder') {
          if (item.id.includes('project') || item.name.toLowerCase().includes('project')) {
            projects++;
          }
          if (item.children) countItems(item.children);
        }
      }
    };

    countItems(portfolioData.root);
    return { totalFiles: files, totalProjects: projects || 4 };
  }, [portfolioData]);

  // Desktop shortcuts
  const handleOpenProjects = useCallback(() => {
    openWindow('folder-projects', 'Projects', {
      type: 'folder',
      itemId: 'folder-projects',
      folderNavId: 'folder-projects',
    }, { width: 780, height: 490 });
  }, [openWindow]);

  const handleOpenCertEducation = useCallback(() => {
    openWindow('folder-cert-edu', 'Certification & Education', {
      type: 'folder',
      itemId: 'folder-cert-edu',
      folderNavId: 'folder-cert-edu',
    }, { width: 720, height: 460 });
  }, [openWindow]);

  const handleOpenOwnersData = useCallback(() => {
    openWindow('owner-profile', "Owner's Data", {
      type: 'owner',
    }, { width: 700, height: 480 });
  }, [openWindow]);

  const handleOpenWidgetsManager = useCallback(() => {
    openWindow('widgets-manager', 'Widget Gallery & Studio', {
      type: 'widgets',
    }, { width: 780, height: 540 });
  }, [openWindow]);

  const handleOpenSettings = useCallback(() => {
    openWindow('system-settings', 'System Settings', {
      type: 'settings',
    }, { width: 780, height: 520 });
  }, [openWindow]);

  const handleOpenTerminal = useCallback((initialCommand?: string) => {
    openWindow('terminal', 'Terminal — portsh', {
      type: 'terminal',
      initialCommand,
    }, { width: 700, height: 440 });
  }, [openWindow]);

  const handleOpenAbout = useCallback(() => {
    openWindow('about-portos', 'About PORT OS', {
      type: 'about',
    }, { width: 500, height: 420 });
  }, [openWindow]);

  const isAdmin = user?.role === 'admin';

  // New folder directly on desktop (inside root)
  const handleNewFolderOnDesktop = useCallback(() => {
    if (!isAdmin || !portfolioData) return;
    const name = prompt('Enter new desktop folder name:', 'New Folder');
    if (!name) return;

    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name,
      kind: 'folder',
      children: [],
    };

    fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: 'root', item: newFolder }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) {
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
          openWindow(`folder-${newFolder.id}`, newFolder.name, {
            type: 'folder',
            itemId: newFolder.id,
            folderNavId: newFolder.id,
          });
        }
      })
      .catch((err) => console.error('Failed to create desktop folder:', err));
  }, [isAdmin, portfolioData, openWindow]);

  // Move an item from Finder or subfolder to desktop root
  const handleMoveItemToDesktop = useCallback(
    async (itemId: string, dropX?: number, dropY?: number) => {
      if (!isAdmin) return;
      try {
        const res = await fetch(`/api/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: 'root' }),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));

          if (dropX !== undefined && dropY !== undefined && typeof window !== 'undefined') {
            try {
              const stored = localStorage.getItem('portos_desktop_icons');
              const posMap = stored ? JSON.parse(stored) : {};
              posMap[itemId] = { x: Math.max(16, dropX - 40), y: Math.max(48, dropY - 40) };
              localStorage.setItem('portos_desktop_icons', JSON.stringify(posMap));
            } catch {}
          }

          toastManager.notify({
            type: 'success',
            title: 'Moved to Home Screen',
            message: 'Folder is now on your desktop',
          });
        }
      } catch (err) {
        console.error('Failed to move item to desktop:', err);
      }
    },
    [isAdmin]
  );

  // Save desktop icon positions
  const handleSaveDesktopPositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('portos_desktop_icons', JSON.stringify(positions));
        } catch {}
      }
      if (isAdmin && portfolioData) {
        handleSaveSettings({
          customization: {
            ...(portfolioData?.settings?.customization || DEFAULT_CUSTOMIZATION),
            desktopIcons: {
              size: (portfolioData?.settings?.customization as any)?.desktopIcons?.size || 'medium',
              positions,
            },
          },
        });
      }
    },
    [isAdmin, portfolioData, handleSaveSettings]
  );

  // Dock click handler
  const handleDockOpenApp = useCallback(
    (appId: string) => {
      switch (appId) {
        case 'finder':
        case 'projects':
          handleOpenProjects();
          break;
        case 'certifications':
          handleOpenCertEducation();
          break;
        case 'profile':
        case 'owner':
          handleOpenOwnersData();
          break;
        case 'terminal':
          handleOpenTerminal();
          break;
        case 'widgets':
          handleOpenWidgetsManager();
          break;
        case 'settings':
          handleOpenSettings();
          break;
        case 'about':
          handleOpenAbout();
          break;
        case 'trash':
          openWindow('folder-trash', 'Trash', {
            type: 'folder',
            itemId: 'trash',
            folderNavId: 'trash',
          }, { width: 700, height: 440 });
          break;
        default:
          break;
      }
    },
    [
      handleOpenProjects,
      handleOpenCertEducation,
      handleOpenOwnersData,
      handleOpenTerminal,
      handleOpenWidgetsManager,
      handleOpenSettings,
      handleOpenAbout,
      openWindow,
    ]
  );

  // Power actions
  const handlePowerOn = useCallback(() => {
    try {
      sessionStorage.removeItem('portos_booted');
    } catch {}
    sound.playStartupChime();
    setPowerState('booting');
  }, []);

  const handleWakeFromSleep = useCallback(() => {
    sound.playStartupChime();
    setPowerState('running');
  }, []);

  const handleSleep = useCallback(() => {
    sound.playSleepSound();
    setPowerState('sleeping');
  }, []);

  const handleRestart = useCallback(() => {
    try {
      sessionStorage.removeItem('portos_booted');
    } catch {}
    sound.playRestartSound();
    setPowerState('booting');
  }, []);

  const handleShutdown = useCallback(() => {
    sound.playShutdownSound();
    setPowerState('shutdown');
  }, []);

  // Active and minimized window lists for the dock
  const minimizedWindows: MinimizedWindowInfo[] = useMemo(() => {
    return windows
      .filter((w) => w.isMinimized)
      .map((w) => ({
        id: w.id,
        title: w.title,
        kind:
          w.meta.type === 'folder'
            ? 'folder'
            : w.meta.type === 'terminal'
            ? 'terminal'
            : w.meta.type === 'settings'
            ? 'settings'
            : w.meta.type === 'about'
            ? 'about'
            : w.meta.type === 'owner'
            ? 'owners-data'
            : w.title.toLowerCase().endsWith('.md')
            ? 'markdown'
            : 'generic-file',
      }));
  }, [windows]);

  const activeWindowIds = useMemo(() => {
    return windows.filter((w) => !w.isMinimized).map((w) => w.id);
  }, [windows]);

  // Object-Specific Context Menus
  const handleToggleDesktopSide = useCallback(
    async (side: 'left' | 'right') => {
      if (!isAdmin) return;
      await handleSaveSettings({
        customization: {
          ...(portfolioData?.settings?.customization || DEFAULT_CUSTOMIZATION),
          desktopSide: side,
        },
      });
      toastManager.notify({
        type: 'info',
        title: 'Folder Placement',
        message: `Folders placed on ${side}`,
      });
    },
    [isAdmin, handleSaveSettings, portfolioData]
  );

  const handleContextMenuDesktop = useCallback(
    (e: React.MouseEvent) => {
      if (!user || powerState !== 'running') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const target = e.target as HTMLElement;
      if (
        target.closest('.window-shell') ||
        target.closest('.window-container') ||
        target.closest('.dock-container') ||
        target.closest('.menu-bar') ||
        target.closest('.desktop-icon-item') ||
        target.closest('.desktop-widget')
      ) {
        return;
      }
      e.preventDefault();
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        title: 'Desktop Options',
        items: [
          {
            id: 'ctx-new-folder',
            label: 'New Folder',
            icon: <PortOSIcon kind="folder" size={14} />,
            disabled: !isAdmin,
            action: handleNewFolderOnDesktop,
          },
          {
            id: 'ctx-desktop-side',
            label: (portfolioData?.settings?.customization as any)?.desktopSide === 'left'
              ? 'Place Folders on Right'
              : 'Place Folders on Left',
            icon: <PortOSIcon kind="finder" size={14} />,
            disabled: !isAdmin,
            action: () => {
              if (!isAdmin) return;
              const currentSide = (portfolioData?.settings?.customization as any)?.desktopSide || 'right';
              const nextSide = currentSide === 'left' ? 'right' : 'left';
              handleToggleDesktopSide(nextSide);
            },
          },
          { id: 'ctx-div-1', label: '', isDivider: true },
          {
            id: 'ctx-effects',
            label: 'Visual Effects Library...',
            icon: <PortOSIcon kind="settings" size={14} />,
            disabled: !isAdmin,
            action: () => {
              if (!isAdmin) return;
              handleOpenSettings();
            },
          },
          {
            id: 'ctx-clean-up',
            label: 'Clean Up Icons',
            icon: (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="2" width="4" height="4" rx="1" />
                <rect x="10" y="2" width="4" height="4" rx="1" />
                <rect x="2" y="10" width="4" height="4" rx="1" />
                <rect x="10" y="10" width="4" height="4" rx="1" />
              </svg>
            ),
            disabled: !isAdmin,
            action: () => {
              if (!isAdmin) return;
              if (typeof window !== 'undefined') {
                localStorage.removeItem('portos_desktop_icons');
              }
              toastManager.notify({
                type: 'info',
                title: 'Desktop Aligned',
                message: 'Desktop icons aligned to grid',
              });
            },
          },
          { id: 'ctx-div-2', label: '', isDivider: true },
          {
            id: 'ctx-settings',
            label: 'System Settings...',
            icon: <PortOSIcon kind="settings" size={14} />,
            action: () => handleOpenSettings(),
          },
          {
            id: 'ctx-spotlight',
            label: 'Spotlight Search (Ctrl+K)',
            icon: (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="14.5" y2="14.5" strokeLinecap="round" />
              </svg>
            ),
            action: () => setSpotlightOpen(true),
          },
          {
            id: 'ctx-lock',
            label: 'Lock Screen',
            icon: <PortOSIcon kind="lock" size={14} />,
            action: handleSignOut,
          },
        ],
      });
    },
    [user, powerState, isAdmin, handleNewFolderOnDesktop, handleOpenSettings, handleSignOut, portfolioData, handleToggleDesktopSide, openContextMenu]
  );

  const handleContextMenuIcon = useCallback(
    (e: React.MouseEvent, iconId: string, label: string) => {
      e.preventDefault();
      e.stopPropagation();

      const isCustomFolder = !['projects', 'cert-education', 'owners-data'].includes(iconId);

      const openAction = () => {
        if (iconId === 'projects') handleOpenProjects();
        else if (iconId === 'cert-education') handleOpenCertEducation();
        else if (iconId === 'owners-data') handleOpenOwnersData();
        else {
          const item = findItemById(portfolioData?.root || [], iconId);
          if (item) {
            if (item.kind === 'folder') {
              openWindow(`folder-${item.id}`, item.name, {
                type: 'folder',
                itemId: item.id,
                folderNavId: item.id,
              });
            } else {
              handleOpenFile(item as FileItem);
            }
          }
        }
      };

      const items: ContextMenuItem[] = [
        {
          id: 'ctx-icon-open',
          label: 'Open',
          icon: <PortOSIcon kind="folder" size={14} />,
          action: openAction,
        },
      ];

      if (isCustomFolder && isAdmin) {
        items.push(
          {
            id: 'ctx-icon-rename',
            label: 'Rename...',
            icon: <PortOSIcon kind="edit" size={14} />,
            action: () => {
              const newName = prompt('Enter new folder name:', label);
              if (newName && newName.trim() && newName.trim() !== label) {
                handleRenameItem(iconId, newName.trim());
              }
            },
          },
          {
            id: 'ctx-icon-trash',
            label: 'Move to Trash',
            icon: <PortOSIcon kind="trash" size={14} />,
            action: () => {
              handleMoveToTrash(iconId);
            },
          }
        );
      }

      items.push(
        {
          id: 'ctx-icon-info',
          label: 'Get Info',
          icon: <PortOSIcon kind="about" size={14} />,
          action: () => {
            if (isCustomFolder) {
              openAction();
            } else {
              handleOpenOwnersData();
            }
          },
        },
        { id: 'ctx-div-icon-1', label: '', isDivider: true },
        {
          id: 'ctx-icon-reset',
          label: 'Reset Icon Position',
          icon: (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7h7a3 3 0 0 1 3 3v2" strokeLinecap="round" />
              <path d="M7 4L4 7l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ),
          disabled: !isAdmin,
          action: () => {
            if (!isAdmin) return;
            if (typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem('portos_desktop_icons');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  delete parsed[iconId];
                  localStorage.setItem('portos_desktop_icons', JSON.stringify(parsed));
                }
              } catch {}
            }
            toastManager.notify({
              type: 'info',
              title: 'Icon Reset',
              message: `${label} position reset to default`,
            });
          },
        },
        {
          id: 'ctx-icon-cleanup',
          label: 'Align All Icons to Grid',
          icon: (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="4" height="4" rx="1" />
              <rect x="10" y="2" width="4" height="4" rx="1" />
              <rect x="2" y="10" width="4" height="4" rx="1" />
              <rect x="10" y="10" width="4" height="4" rx="1" />
            </svg>
          ),
          disabled: !isAdmin,
          action: () => {
            if (!isAdmin) return;
            if (typeof window !== 'undefined') {
              localStorage.removeItem('portos_desktop_icons');
            }
            toastManager.notify({
              type: 'info',
              title: 'Icons Aligned',
              message: 'All desktop icons snapped to 16px grid',
            });
          },
        }
      );

      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        title: label,
        items,
      });
    },
    [
      isAdmin,
      handleOpenProjects,
      handleOpenCertEducation,
      handleOpenOwnersData,
      portfolioData,
      openWindow,
      handleOpenFile,
      handleRenameItem,
      handleMoveToTrash,
      openContextMenu,
    ]
  );

  const handleContextMenuWidget = useCallback(
    (e: React.MouseEvent, widget: Widget) => {
      e.preventDefault();
      e.stopPropagation();

      const items: ContextMenuItem[] = [
        {
          id: 'ctx-widget-settings',
          label: `Customize ${widget.type === 'clock' ? 'Clock' : widget.type === 'note' ? 'Quick Note' : 'Stats'}...`,
          icon: <PortOSIcon kind="widgets" size={14} />,
          action: () => handleOpenSettings(),
        },
        { id: 'ctx-div-w-1', label: '', isDivider: true },
      ];

      if (widget.type === 'clock') {
        items.push(
          {
            id: 'ctx-clock-reset',
            label: 'Reset Clock Appearance',
            icon: (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 7h7a3 3 0 0 1 3 3v2" strokeLinecap="round" />
                <path d="M7 4L4 7l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ),
            action: () => {
              handleSaveSettings({
                customization: {
                  ...(portfolioData?.settings?.customization || DEFAULT_CUSTOMIZATION),
                  clock: DEFAULT_CLOCK_CONFIG,
                },
              });
              toastManager.notify({
                type: 'info',
                title: 'Clock Reset',
                message: 'Clock styling restored to default',
              });
            },
          }
        );
      } else if (widget.type === 'note') {
        items.push({
          id: 'ctx-note-clear',
          label: 'Clear Note Content',
          icon: <PortOSIcon kind="trash" size={14} />,
          action: () => handleUpdateWidgetText(widget.id, ''),
        });
      } else if (widget.type === 'custom') {
        items.push({
          id: 'ctx-custom-edit',
          label: 'Edit in Widget Studio...',
          icon: <PortOSIcon kind="settings" size={14} />,
          action: () => handleOpenWidgetsManager(),
        });
      }

      items.push({
        id: 'ctx-widget-gallery',
        label: 'Widget Gallery...',
        icon: <PortOSIcon kind="finder" size={14} />,
        action: () => handleOpenWidgetsManager(),
      });

      items.push(
        { id: 'ctx-div-w-2', label: '', isDivider: true },
        {
          id: 'ctx-widget-remove',
          label: 'Remove Widget',
          icon: (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          ),
          action: () => handleDeleteWidget(widget.id),
        }
      );

      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        title: `${widget.type.toUpperCase()} WIDGET`,
        items,
      });
    },
    [handleOpenSettings, handleOpenWidgetsManager, handleSaveSettings, portfolioData, handleUpdateWidgetText, handleDeleteWidget, openContextMenu]
  );

  const handleContextMenuMenuBar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        title: 'Menu Bar',
        items: [
          {
            id: 'ctx-menu-settings',
            label: 'System Settings...',
            icon: <PortOSIcon kind="settings" size={14} />,
            action: () => handleOpenSettings(),
          },
          {
            id: 'ctx-menu-help',
            label: 'PORT OS Help',
            icon: <PortOSIcon kind="terminal" size={14} />,
            action: () => handleOpenTerminal('help'),
          },
          { id: 'ctx-menu-div-1', label: '', isDivider: true },
          {
            id: 'ctx-menu-about',
            label: 'About PORT OS',
            icon: <PortOSIcon kind="about" size={14} />,
            action: handleOpenAbout,
          },
          {
            id: 'ctx-menu-lock',
            label: 'Lock Screen',
            icon: <PortOSIcon kind="lock" size={14} />,
            action: handleSignOut,
          },
        ],
      });
    },
    [handleOpenSettings, handleOpenTerminal, handleOpenAbout, handleSignOut, openContextMenu]
  );

  const handleContextMenuWindow = useCallback(
    (e: React.MouseEvent, windowId: string) => {
      e.preventDefault();
      const win = windows.find((w) => w.id === windowId);
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        title: win?.title || 'Window Options',
        items: [
          {
            id: 'ctx-win-minimize',
            label: 'Minimize Window',
            icon: <PortOSIcon kind="finder" size={14} />,
            action: () => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('portos-trigger-minimize', { detail: { id: windowId } }));
              }
            },
          },
          { id: 'ctx-win-div-1', label: '', isDivider: true },
          {
            id: 'ctx-win-close',
            label: 'Close Window',
            icon: <PortOSIcon kind="trash" size={14} />,
            action: () => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('portos-trigger-close', { detail: { id: windowId } }));
              }
            },
          },
        ],
      });
    },
    [windows, minimizeWindow, closeWindow, openContextMenu]
  );

  const currentEffects = portfolioData?.settings?.customization?.effects || DEFAULT_EFFECTS_CONFIG;
  const effectClasses = [
    currentEffects.liquidGlass ? 'fx-liquid-glass' : '',
    currentEffects.glassmorphism ? 'fx-glassmorphism' : '',
    currentEffects.ambientGlow ? 'fx-ambient-glow' : '',
  ].filter(Boolean).join(' ');

  // Synchronize active visual effect classes to document.body for portaled elements (ContextMenu, Modals)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const fxClasses = [
      'fx-liquid-glass',
      'fx-glassmorphism',
      'fx-ambient-glow',
    ];
    document.body.classList.remove(...fxClasses);
    const active: string[] = [];
    if (currentEffects.liquidGlass) active.push('fx-liquid-glass');
    if (currentEffects.glassmorphism) active.push('fx-glassmorphism');
    if (currentEffects.ambientGlow) active.push('fx-ambient-glow');
    if (active.length > 0) {
      document.body.classList.add(...active);
    }
  }, [currentEffects]);

  // Custom desktop items (folders and files created on desktop outside the 3 fixed system hubs)
  const customDesktopItems = useMemo(() => {
    if (!portfolioData?.root) return [];
    const fixedFolderIds = new Set(['folder-projects', 'folder-cert-edu', 'folder-owners-data']);
    return portfolioData.root.filter((r) => !fixedFolderIds.has(r.id));
  }, [portfolioData]);

  const extraDesktopIcons = useMemo(() => {
    return customDesktopItems.map((item) => ({
      id: item.id,
      label: item.name,
      type: item.kind,
      folder: item,
    }));
  }, [customDesktopItems]);

  // Map files for Desktop FolderFloat physics cloud
  const folderItemsMap = useMemo(() => {
    if (!portfolioData?.root) return {};
    const map: Record<string, any[]> = {};

    // 1. Projects folder items
    const projectsFolder = portfolioData.root.find((r) => r.id === 'folder-projects');
    if (projectsFolder && projectsFolder.children) {
      map['projects'] = projectsFolder.children;
    }

    // 2. Cert & Education folder items (flatten files from subfolders if needed)
    const certEduFolder = portfolioData.root.find((r) => r.id === 'folder-cert-edu');
    if (certEduFolder && certEduFolder.children) {
      const allCertFiles: any[] = [];
      certEduFolder.children.forEach((child) => {
        if (child.kind === 'file') allCertFiles.push(child);
        else if (child.kind === 'folder' && child.children) {
          allCertFiles.push(...child.children);
        }
      });
      map['cert-education'] = allCertFiles;
    }

    // 3. Owners Data folder items
    const ownersFolder = portfolioData.root.find((r) => r.id === 'folder-owners-data');
    if (ownersFolder && ownersFolder.children) {
      map['owners-data'] = ownersFolder.children;
    }

    // 4. Custom desktop items
    portfolioData.root.forEach((r) => {
      if (!['folder-projects', 'folder-cert-edu', 'folder-owners-data'].includes(r.id)) {
        map[r.id] = r.children || [];
      }
    });

    return map;
  }, [portfolioData]);

  return (
    <div
      className={`desktop-container ${effectClasses}`}
      id="portfolio-desktop-os"
      onContextMenu={user && powerState === 'running' ? handleContextMenuDesktop : (e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Frame-Based Interactive Robot Wallpaper */}
      <Wallpaper
        hasMaximizedWindow={hasMaximizedWindow}
        isLocked={!user}
      />

      {/* Boot Screen */}
      {powerState === 'booting' && (
        <BootScreen onComplete={() => setPowerState('running')} />
      )}

      {/* Power Overlay (Shutdown screen / Sleep screen) */}
      <PowerOverlay
        powerState={powerState === 'booting' ? 'running' : powerState}
        onPowerOn={handlePowerOn}
        onWakeFromSleep={handleWakeFromSleep}
      />

      {/* Login Modal Overlay (shown when not logged in) */}
      {!user && powerState === 'running' && (
        <LoginModal
          onLoginSuccess={handleLoginSuccess}
          onSleep={handleSleep}
          onRestart={handleRestart}
          onShutdown={handleShutdown}
        />
      )}

      {/* Menu Bar (Mounted only when authenticated) */}
      {user && (
        <MenuBar
          user={user}
          onNewFolderClick={handleNewFolderOnDesktop}
          onSignOut={handleSignOut}
          onSleep={handleSleep}
          onRestart={handleRestart}
          onShutdown={handleShutdown}
          onAboutClick={handleOpenAbout}
          onSettingsClick={handleOpenSettings}
          onSpotlightClick={() => setSpotlightOpen(true)}
          onFinderClick={handleOpenProjects}
          onHelpClick={() => handleOpenTerminal('help')}
          onContextMenu={handleContextMenuMenuBar}
        />
      )}

      {/* Desktop Workspace (Mounted only when authenticated - Zero Data Leak) */}
      {user && (
        <main
          className="desktop-workspace"
          id="desktop-workspace"
          onContextMenu={handleContextMenuDesktop}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/json')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const raw = e.dataTransfer.getData('application/json');
              if (raw) {
                const data = JSON.parse(raw);
                if (data && data.id) {
                  handleMoveItemToDesktop(data.id, e.clientX, e.clientY);
                }
              }
            } catch (err) {
              console.error('Desktop drop error:', err);
            }
          }}
        >
          {/* Interactive Mid-Layer: React Bits <CircularGallery /> Component */}
          <div
            id="desktop-circular-gallery-layer"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 5,
              pointerEvents: 'auto',
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/json')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              try {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) {
                  const data = JSON.parse(raw);
                  if (data && data.id) {
                    handleMoveItemToDesktop(data.id, e.clientX, e.clientY);
                  }
                }
              } catch (err) {
                console.error('Gallery drop error:', err);
              }
            }}
          >
            <CircularGallery
              bend={3}
              textColor="#ffffff"
              borderRadius={0.05}
              scrollEase={0.05}
              paused={hasMaximizedWindow}
              onItemClick={(item, index) => {
                console.log('[CircularGallery] Selected item:', item?.text || item?.alt, index);
              }}
            />
          </div>

          {/* Movable Desktop Icons with React Bits FolderFloat Physics Animation */}
          <DesktopIcons
            isAdmin={isAdmin}
            onOpenProjects={handleOpenProjects}
            onOpenCertEducation={handleOpenCertEducation}
            onOpenOwnersData={handleOpenOwnersData}
            onOpenTerminal={handleOpenTerminal}
            onOpenSettings={handleOpenSettings}
            onNewFolder={handleNewFolderOnDesktop}
            onContextMenuIcon={handleContextMenuIcon}
            initialPositions={
              Array.isArray(portfolioData?.settings?.customization?.desktopIcons)
                ? undefined
                : portfolioData?.settings?.customization?.desktopIcons?.positions
            }
            onSavePositions={handleSaveDesktopPositions}
            iconSize={
              Array.isArray(portfolioData?.settings?.customization?.desktopIcons)
                ? 'medium'
                : portfolioData?.settings?.customization?.desktopIcons?.size || 'medium'
            }
            extraIcons={extraDesktopIcons}
            folderItems={folderItemsMap}
            widgets={isAdmin ? portfolioData?.widgets : []}
            desktopSide={(portfolioData?.settings?.customization as any)?.desktopSide || 'right'}
            onExpansionChange={setFolderExpansion}
            onOpenFile={handleOpenFile}
            onOpenFolder={(f) => {
              openWindow(`folder-${f.id}`, f.name, {
                type: 'folder',
                itemId: f.id,
                folderNavId: f.id,
              });
            }}
          />

          {/* Active Desktop Widgets (rendered only for Admin) */}
          {isAdmin && portfolioData?.widgets && portfolioData.widgets.length > 0 && (
            <Widgets
              widgets={portfolioData.widgets}
              canEdit={true}
              isAdmin={isAdmin}
              clockConfig={portfolioData?.settings?.clock || DEFAULT_CLOCK_CONFIG}
              onUpdateWidgetPosition={handleUpdateWidgetPosition}
              onUpdateWidgetText={handleUpdateWidgetText}
              onUpdateWidgetConfig={handleUpdateWidgetConfig}
              onDeleteWidget={handleDeleteWidget}
              onAddWidget={handleAddWidget}
              onEditCustomWidget={() => handleOpenWidgetsManager()}
              onContextMenuWidget={handleContextMenuWidget}
              totalFiles={totalFiles}
              totalProjects={totalProjects}
              expansionProgress={folderExpansion}
              desktopSide={(portfolioData?.settings?.customization as any)?.desktopSide || 'right'}
            />
          )}

          {/* Open Windows */}
          {windows.map((win) => {
            let content: React.ReactNode = null;

            if (win.meta.type === 'folder' && portfolioData) {
              const isTrashWindow = win.meta.itemId === 'trash' || win.meta.folderNavId === 'trash';
              const activeFolderId = win.meta.folderNavId || win.meta.itemId || 'folder-projects';
              let folder: FolderItem;
              if (isTrashWindow) {
                folder = { id: 'trash', name: 'Trash', kind: 'folder', children: [] };
              } else {
                const target = findItemById(portfolioData.root, activeFolderId);
                folder = (target && target.kind === 'folder' ? target : portfolioData.root[0]) as FolderItem;
              }

              const crumbs: { id: string; name: string }[] = isTrashWindow
                ? [{ id: 'trash', name: 'Trash' }]
                : [];
              if (!isTrashWindow) {
                let curr: FolderItem | null = folder;
                while (curr) {
                  crumbs.unshift({ id: curr.id, name: curr.name });
                  curr = findParentFolder(portfolioData.root, curr.id);
                }
              }

              content = (
                <FolderView
                  folder={folder}
                  canEdit={isAdmin}
                  isAdmin={isAdmin}
                  rootFolders={portfolioData.root.filter((r) => r.kind === 'folder') as FolderItem[]}
                  trashItems={portfolioData.trash || []}
                  initialIsTrashView={isTrashWindow}
                  onOpenFile={handleOpenFile}
                  onNavigateFolder={(f) => handleNavigateFolderInWindow(win.id, f)}
                  onAddItem={handleAddItem}
                  onRenameItem={handleRenameItem}
                  onDeleteItem={handleDeleteItem}
                  onMoveToTrash={handleMoveToTrash}
                  onRestoreTrash={handleRestoreTrash}
                  onEmptyTrash={handleEmptyTrash}
                  onMoveToDesktop={(itemId) => handleMoveItemToDesktop(itemId)}
                  onImportFromPC={(fileData) =>
                    handleImportFromPC(folder.id, {
                      name: fileData.name,
                      content: fileData.content || '',
                    })
                  }
                  breadcrumbs={crumbs}
                  onBreadcrumbClick={(idx) => {
                    if (isTrashWindow) return;
                    const targetCrumb = crumbs[idx];
                    if (targetCrumb) {
                      const f = findItemById(portfolioData.root, targetCrumb.id);
                      if (f && f.kind === 'folder') {
                        handleNavigateFolderInWindow(win.id, f as FolderItem);
                      }
                    }
                  }}
                />
              );
            } else if (win.meta.type === 'file' && portfolioData) {
              const fileItem = findItemById(portfolioData.root, win.meta.itemId || '') as FileItem;
              if (fileItem) {
                content = (
                  <FileEditor
                    file={fileItem}
                    canEdit={isAdmin}
                    isAdmin={isAdmin}
                    onSaveContent={(fileId: string, content: string) => handleSaveFileContent(fileId, content)}
                  />
                );
              }
            } else if (win.meta.type === 'owner' && portfolioData) {
              content = (
                <OwnerProfileView
                  owner={portfolioData.owner}
                  canEdit={isAdmin}
                  onSaveOwner={handleSaveOwner}
                />
              );
            } else if (win.meta.type === 'widgets' && portfolioData) {
              content = (
                <WidgetGallery
                  widgets={portfolioData.widgets}
                  canEdit={isAdmin}
                  onAddWidget={handleAddWidget}
                  onDeleteWidget={handleDeleteWidget}
                  onUpdateWidget={(w) => handleUpdateWidgetConfig(w.id, w)}
                  onClose={() => closeWindow(win.id)}
                />
              );
            } else if (win.meta.type === 'settings' && portfolioData) {
              content = (
                <SystemSettings
                  settings={portfolioData.settings || DEFAULT_SETTINGS}
                  canEdit={isAdmin}
                  isAdmin={isAdmin}
                  onSaveSettings={handleSaveSettings}
                  onResetDefaults={handleResetSettings}
                />
              );
            } else if (win.meta.type === 'terminal' && portfolioData) {
              content = (
                <TerminalView
                  portfolioData={portfolioData}
                  userRole={user.role}
                  userName={user.name || user.username || 'owner'}
                  onOpenWindow={(id, title, meta) => openWindow(id, title, meta)}
                  initialCommand={win.meta.initialCommand}
                />
              );
            } else if (win.meta.type === 'about') {
              content = (
                <AboutModal
                  onOpenSettings={handleOpenSettings}
                  onOpenOwner={handleOpenOwnersData}
                />
              );
            }

            return (
              <Window
                key={win.id}
                window={win}
                isActive={win.zIndex === topZ}
                onFocus={() => focusWindow(win.id)}
                onClose={() => closeWindow(win.id)}
                onMinimize={() => minimizeWindow(win.id)}
                onUpdateBounds={(id: string, bounds: Partial<WindowState>) => updateWindowState(id, bounds)}
                onSnapPreview={handleSnapPreview}
                onContextMenu={handleContextMenuWindow}
              >
                {content}
              </Window>
            );
          })}
        </main>
      )}

      {/* Snap Preview Ghost Outline */}
      {snapPreview && snapPreview.visible && (
        <div
          id="window-snap-preview"
          className="snap-preview-overlay"
          style={{
            position: 'fixed',
            left: `${snapPreview.x}px`,
            top: `${snapPreview.y}px`,
            width: `${snapPreview.w}px`,
            height: `${snapPreview.h}px`,
            borderRadius: '12px',
            border: '2px solid rgba(56, 189, 248, 0.75)',
            background: 'rgba(56, 189, 248, 0.15)',
            backdropFilter: 'blur(16px)',
            pointerEvents: 'none',
            zIndex: 99999,
            transition: 'all 0.12s ease-out',
            boxShadow: '0 0 35px rgba(56, 189, 248, 0.35)',
          }}
        />
      )}

      {/* macOS Dock (Mounted only when authenticated) */}
      {user && (
        <Dock
          isAdmin={isAdmin}
          onOpenApp={handleDockOpenApp}
          onRestoreWindow={restoreWindow}
          onSignOut={handleSignOut}
          minimizedWindows={minimizedWindows}
          activeWindowIds={activeWindowIds}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Brightness Dimmer Overlay */}
      {brightness < 100 && (
        <div
          id="display-brightness-dimmer"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000',
            opacity: ((100 - brightness) / 100) * 0.8,
            pointerEvents: 'none',
            zIndex: 999990,
            transition: 'opacity 0.15s ease',
          }}
        />
      )}

      {/* Global Spotlight Search Modal */}
      <SpotlightModal
        isOpen={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        portfolioData={portfolioData}
        isAdmin={isAdmin}
        onOpenProjects={handleOpenProjects}
        onOpenCertEducation={handleOpenCertEducation}
        onOpenOwnersData={handleOpenOwnersData}
        onOpenSettings={handleOpenSettings}
        onOpenWidgets={handleOpenWidgetsManager}
        onOpenFile={handleOpenFile}
        onOpenFolder={(f) => {
          openWindow(`folder-${f.id}`, f.name, {
            type: 'folder',
            itemId: f.id,
            folderNavId: f.id,
          });
        }}
        onNewFolder={handleNewFolderOnDesktop}
        onSleep={handleSleep}
        onRestart={handleRestart}
        onShutdown={handleShutdown}
        onSignOut={handleSignOut}
        onOpenTerminal={handleOpenTerminal}
        onOpenAbout={handleOpenAbout}
      />
    </div>
  );
}

export default function DesktopPage() {
  return (
    <ContextMenuProvider>
      <DesktopContent />
    </ContextMenuProvider>
  );
}
