'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Wallpaper from '@/components/Wallpaper';
import MenuBar from '@/components/MenuBar';
import DesktopIcons from '@/components/DesktopIcons';
import Dock, { MinimizedWindowInfo } from '@/components/Dock';
import Window, { WindowState } from '@/components/Window';
import FolderView from '@/components/FolderView';
import FileEditor from '@/components/FileEditor';
import OwnerProfileView from '@/components/OwnerProfileView';
import SystemSettings from '@/components/SystemSettings';
import Widgets from '@/components/Widgets';
import LoginModal from '@/components/LoginModal';
import BootScreen from '@/components/BootScreen';
import PowerOverlay, { PowerState } from '@/components/PowerOverlay';
import SpotlightModal from '@/components/SpotlightModal';
import ContextMenu, { ContextMenuItem } from '@/components/ContextMenu';
import ToastContainer from '@/components/ToastContainer';
import TerminalView from '@/components/TerminalView';
import ControlCenter from '@/components/ControlCenter';
import AboutModal from '@/components/AboutModal';
import { toastManager } from '@/lib/toast';
import { sound } from '@/lib/sound';
import { PortfolioData, FolderItem, FileItem, Item, Widget, OwnerInfo, SystemSettings as ISystemSettings, DEFAULT_SETTINGS } from '@/lib/types';
import { findItemById, findParentFolder, addItemToTree, updateItemInTree, removeItemFromTree } from '@/lib/tree';

interface WindowContentMeta {
  type: 'folder' | 'file' | 'owner' | 'widgets' | 'settings' | 'terminal' | 'about';
  itemId?: string;
  folderNavId?: string; // current active folder within the window
}

interface FullWindowState extends WindowState {
  meta: WindowContentMeta;
}

const getStorageKey = (role?: string) => `portfolio_os_windows_${role || 'viewer'}_v2`;

export default function DesktopPage() {
  const [user, setUser] = useState<{
    role: 'viewer' | 'admin';
    name?: string;
    email?: string;
    username?: string;
  } | null>(null);

  const [loadingSession, setLoadingSession] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [windows, setWindows] = useState<FullWindowState[]>([]);
  const [topZ, setTopZ] = useState(100);
  const [snapPreview, setSnapPreview] = useState<{ visible: boolean; x: number; y: number; w: number; h: number } | null>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(80);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    sound.setMasterVolume(val / 100);
  }, []);

  const hasMaximizedWindow = useMemo(() => {
    return windows.some((w) => !w.isMinimized && w.snapMode === 'fullscreen');
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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.window-shell') ||
      target.closest('.window-container') ||
      target.closest('.dock-container') ||
      target.closest('.menu-bar')
    ) {
      return;
    }
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);
  const [powerState, setPowerState] = useState<PowerState>(() => {
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem('portos_booted') === 'true') {
          return 'running';
        }
      } catch {}
    }
    return 'booting';
  });
  const portfolioDataRef = useRef<PortfolioData | null>(null);

  // Check if session already booted
  useEffect(() => {
    try {
      if (sessionStorage.getItem('portos_booted') === 'true') {
        setPowerState('running');
      }
    } catch {}
  }, []);

  const handlePowerOn = useCallback(() => {
    try {
      sessionStorage.removeItem('portos_booted');
    } catch {}
    setPowerState('booting');
  }, []);

  const handleWakeFromSleep = useCallback(() => {
    setPowerState('running');
  }, []);

  const handleSleep = useCallback(() => {
    setPowerState('sleeping');
  }, []);

  const handleRestart = useCallback(() => {
    try {
      sessionStorage.removeItem('portos_booted');
    } catch {}
    setPowerState('restarting');
    sound.playShutdownSound();
    setTimeout(() => {
      setPowerState('booting');
    }, 700);
  }, []);

  const handleShutdown = useCallback(() => {
    try {
      sessionStorage.removeItem('portos_booted');
    } catch {}
    sound.playShutdownSound();
    setPowerState('shutdown');
  }, []);

  useEffect(() => {
    portfolioDataRef.current = portfolioData;
  }, [portfolioData]);

  // 1. Fetch Session & Portfolio Data (Zero-leak lock screen: only load portfolio data if authenticated)
  const loadPortfolioData = useCallback(async () => {
    try {
      const dataRes = await fetch('/api/portfolio');
      if (dataRes.ok) {
        const dataJson = await dataRes.json();
        setPortfolioData(dataJson);
        portfolioDataRef.current = dataJson;
      }
    } catch (err) {
      console.error('Failed to load portfolio data:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const sessionRes = await fetch('/api/session');
      const sessionJson = await sessionRes.json();

      if (sessionJson.user) {
        setUser(sessionJson.user);
        await loadPortfolioData();
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to initialize session:', err);
    } finally {
      setLoadingSession(false);
    }
  }, [loadPortfolioData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Restore Windows from localStorage once user is logged in
  useEffect(() => {
    if (!user) return;
    try {
      const key = getStorageKey(user.role);
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: FullWindowState[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWindows(parsed);
          const maxZ = parsed.reduce((max, w) => Math.max(max, w.zIndex || 100), 100);
          setTopZ(maxZ + 1);
        }
      }
    } catch (e) {
      console.warn('Failed to restore windows from localStorage:', e);
    }
  }, [user]);

  // 3. Persist Windows to localStorage on change
  useEffect(() => {
    if (!user) return;
    try {
      const key = getStorageKey(user.role);
      localStorage.setItem(key, JSON.stringify(windows));
    } catch (e) {
      console.warn('Failed to persist windows to localStorage:', e);
    }
  }, [windows, user]);

  // If user is not admin, turn off editMode
  useEffect(() => {
    if (user?.role !== 'admin' && editMode) {
      setEditMode(false);
    }
  }, [user, editMode]);

  // Window Focus
  const focusWindow = useCallback(
    (id: string) => {
      setTopZ((prev) => {
        const nextZ = prev + 1;
        setWindows((wins) =>
          wins.map((w) => (w.id === id ? { ...w, zIndex: nextZ, isMinimized: false } : w))
        );
        return nextZ;
      });
    },
    []
  );

  // Close Window
  const closeWindow = useCallback((id: string) => {
    setWindows((wins) => wins.filter((w) => w.id !== id));
  }, []);

  // Minimize Window
  const minimizeWindow = useCallback((id: string) => {
    setWindows((wins) =>
      wins.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
  }, []);

  // Restore Window
  const restoreWindow = useCallback(
    (id: string) => {
      focusWindow(id);
    },
    [focusWindow]
  );

  // Update bounds / position / snap
  const updateWindowBounds = useCallback((id: string, bounds: Partial<WindowState>) => {
    setWindows((wins) =>
      wins.map((w) => (w.id === id ? { ...w, ...bounds } : w))
    );
  }, []);

  // Open or Bring to Front a Window
  const openWindow = useCallback(
    (
      id: string,
      title: string,
      meta: WindowContentMeta,
      customBounds?: { width?: number; height?: number }
    ) => {
      setWindows((prevWins) => {
        const existing = prevWins.find((w) => w.id === id);
        const nextZ = topZ + 1;
        setTopZ(nextZ);

        if (existing) {
          return prevWins.map((w) =>
            w.id === id
              ? {
                  ...w,
                  isMinimized: false,
                  zIndex: nextZ,
                  meta: { ...w.meta, ...meta },
                }
              : w
          );
        }

        // Determine cascade coordinates (centered in workspace, +28px cascade, never at x=0)
        const offsetIndex = prevWins.length % 6;
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

        const wWidth = Math.max(360, Math.min(screenW - 60, customBounds?.width || 680));
        const wHeight = Math.max(240, Math.min(screenH - 28 - 68 - 30, customBounds?.height || 460));
        const baseX = Math.max(48, Math.round((screenW - wWidth) / 2) + offsetIndex * 28);
        const baseY = Math.max(36, Math.round((screenH - 28 - 68 - wHeight) / 2) + offsetIndex * 28);

        const newWin: FullWindowState = {
          id,
          title,
          x: baseX,
          y: baseY,
          width: wWidth,
          height: wHeight,
          zIndex: nextZ,
          isMinimized: false,
          snapMode: 'normal',
          meta,
        };

        return [...prevWins, newWin];
      });
    },
    [topZ]
  );

  // Quick Open Handlers
  const handleOpenProjects = useCallback(() => {
    openWindow('folder-projects', 'Projects', {
      type: 'folder',
      itemId: 'folder-projects',
      folderNavId: 'folder-projects',
    });
  }, [openWindow]);

  const handleOpenCertEducation = useCallback(() => {
    openWindow('folder-cert-edu', 'Certification & Education', {
      type: 'folder',
      itemId: 'folder-cert-edu',
      folderNavId: 'folder-cert-edu',
    });
  }, [openWindow]);

  const handleOpenOwnersData = useCallback(() => {
    openWindow('window-owners-data', "Owner's Data", {
      type: 'owner',
    });
  }, [openWindow]);

  const handleOpenWidgetsManager = useCallback(() => {
    openWindow('window-widgets-manager', 'Widgets Manager', {
      type: 'widgets',
    }, { width: 500, height: 380 });
  }, [openWindow]);

  const handleOpenSettings = useCallback(() => {
    openWindow('system-settings', 'System Settings', {
      type: 'settings',
    }, { width: 760, height: 520 });
  }, [openWindow]);

  const handleOpenTerminal = useCallback(() => {
    openWindow('terminal', 'Terminal — portsh', {
      type: 'terminal',
    }, { width: 680, height: 440 });
  }, [openWindow]);

  const handleOpenAbout = useCallback(() => {
    openWindow('about-portos', 'About PORT OS', {
      type: 'about',
    }, { width: 440, height: 400 });
  }, [openWindow]);

  const handleNewFolderOnDesktop = useCallback(async () => {
    if (user?.role !== 'admin' || !editMode || !portfolioData) return;
    const folderName = prompt('Enter new folder name:', 'New Folder') || 'New Folder';
    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name: folderName,
      kind: 'folder',
      children: [],
    };

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: null, item: newFolder }),
      });

      if (res.ok) {
        const json = await res.json();
        setPortfolioData((prev) => (prev ? { ...prev, root: json.root } : null));
        toastManager.notify({
          type: 'success',
          title: 'New Folder',
          message: `Created folder "${newFolder.name}"`,
        });
        openWindow(newFolder.id, newFolder.name, {
          type: 'folder',
          itemId: newFolder.id,
          folderNavId: newFolder.id,
        });
      }
    } catch (err) {
      console.error('Failed to create new folder:', err);
    }
  }, [user, editMode, portfolioData, openWindow]);

  // Dock App launcher
  const handleDockOpenApp = useCallback(
    (appId: string) => {
      switch (appId) {
        case 'finder':
          handleOpenProjects();
          break;
        case 'projects':
          handleOpenProjects();
          break;
        case 'certifications':
          handleOpenCertEducation();
          break;
        case 'owner':
          handleOpenOwnersData();
          break;
        case 'widgets':
          handleOpenWidgetsManager();
          break;
        case 'settings':
          handleOpenSettings();
          break;
        case 'terminal':
          handleOpenTerminal();
          break;
        case 'about':
          handleOpenAbout();
          break;
        case 'trash':
          handleOpenProjects();
          break;
        default:
          break;
      }
    },
    [handleOpenProjects, handleOpenCertEducation, handleOpenOwnersData, handleOpenWidgetsManager, handleOpenSettings, handleOpenTerminal, handleOpenAbout]
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
    setEditMode(false);
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

  // Add Item (file or folder)
  const handleAddItem = useCallback(
    async (parentId: string, kind: 'folder' | 'file') => {
      if (user?.role !== 'admin' || !editMode) return;
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
    [user, editMode]
  );

  // Rename Item
  const handleRenameItem = useCallback(
    async (itemId: string, newName: string) => {
      if (user?.role !== 'admin' || !editMode) return;
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
    [user, editMode]
  );

  // Delete Item
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (user?.role !== 'admin' || !editMode) return;
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
    [user, editMode]
  );

  // F8: Move to Trash
  const handleMoveToTrash = useCallback(
    async (itemId: string) => {
      if (user?.role !== 'admin' || !editMode) return;
      try {
        const res = await fetch('/api/items/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId }),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) => (prev ? { ...prev, root: json.root, trash: json.trash } : null));
          setWindows((prev) => prev.filter((w) => w.meta.itemId !== itemId && w.id !== itemId));
          toastManager.notify({
            type: 'warning',
            title: 'Moved to Trash',
            message: 'Item has been moved to Trash',
          });
        }
      } catch (err) {
        console.error('Failed to move item to trash:', err);
      }
    },
    [user, editMode]
  );

  // F8: Restore from Trash
  const handleRestoreTrash = useCallback(
    async (itemId: string) => {
      if (user?.role !== 'admin' || !editMode) return;
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
    [user, editMode]
  );

  // S1: Save System Settings
  const handleSaveSettings = useCallback(
    async (nextSettings: Partial<ISystemSettings>) => {
      if (user?.role !== 'admin') return;
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextSettings),
        });

        if (res.ok) {
          const json = await res.json();
          setPortfolioData((prev) =>
            prev ? { ...prev, settings: json.settings, owner: json.owner || prev.owner } : null
          );
        }
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    },
    [user]
  );

  // S3: Reset Settings to Defaults
  const handleResetSettings = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_SETTINGS),
      });

      if (res.ok) {
        const json = await res.json();
        setPortfolioData((prev) =>
          prev ? { ...prev, settings: json.settings, owner: json.owner || prev.owner } : null
        );
      }
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  }, [user]);

  // F7: Set as Desktop Picture
  const handleSetWallpaper = useCallback(
    async (file: FileItem) => {
      if (user?.role !== 'admin') return;
      const wpVal = file.content?.startsWith('data:image') ? file.content : 'silk-midnight';
      await handleSaveSettings({
        appearance: {
          wallpaper: wpVal,
        } as any,
      });
      toastManager.notify({
        type: 'success',
        title: 'Desktop Picture',
        message: `Set "${file.name}" as desktop wallpaper`,
      });
    },
    [user, handleSaveSettings]
  );

  // Import from PC / Drag & Drop refresh
  const handleImportFromPC = useCallback(() => {
    loadData();
  }, [loadData]);

  // Save File content
  const handleSaveFileContent = useCallback(
    async (fileId: string, newContent: string) => {
      if (user?.role !== 'admin' || !editMode) {
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
    [user, editMode]
  );

  // Save Owner Profile
  const handleSaveOwner = useCallback(
    async (updatedOwner: OwnerInfo) => {
      if (user?.role !== 'admin' || !editMode) {
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
    [user, editMode]
  );

  // Widget updates
  const handleUpdateWidgetPosition = useCallback(
    async (id: string, x: number, y: number) => {
      if (user?.role !== 'admin' || !editMode || !portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.map((w) =>
        w.id === id ? { ...w, x, y } : w
      );
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      try {
        await fetch('/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgets: nextWidgets }),
        });
      } catch (err) {
        console.error('Failed to save widget position:', err);
      }
    },
    [user, editMode]
  );

  const handleUpdateWidgetText = useCallback(
    async (id: string, text: string) => {
      if (user?.role !== 'admin' || !editMode || !portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.map((w) =>
        w.id === id ? { ...w, text } : w
      );
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      try {
        await fetch('/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgets: nextWidgets }),
        });
      } catch (err) {
        console.error('Failed to save widget text:', err);
      }
    },
    [user, editMode]
  );

  const handleDeleteWidget = useCallback(
    async (id: string) => {
      if (user?.role !== 'admin' || !editMode || !portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const nextWidgets = currentWidgets.filter((w) => w.id !== id);
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      try {
        await fetch('/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgets: nextWidgets }),
        });
      } catch (err) {
        console.error('Failed to delete widget:', err);
      }
    },
    [user, editMode]
  );

  const handleAddWidget = useCallback(
    async (type: 'clock' | 'note' | 'counter') => {
      if (user?.role !== 'admin' || !editMode || !portfolioDataRef.current) return;
      const currentWidgets = portfolioDataRef.current.widgets;
      const newWidget: Widget = {
        id: `widget-${Date.now()}`,
        type,
        x: Math.max(30, Math.min(typeof window !== 'undefined' ? window.innerWidth - 240 : 800, 60 + currentWidgets.length * 30)),
        y: Math.max(60, Math.min(typeof window !== 'undefined' ? window.innerHeight - 200 : 600, 100 + currentWidgets.length * 40)),
        text:
          type === 'clock'
            ? 'Tokyo, JP'
            : type === 'note'
            ? 'New reminder note...'
            : 'Stats counter',
      };
      const nextWidgets = [...currentWidgets, newWidget];
      portfolioDataRef.current = { ...portfolioDataRef.current, widgets: nextWidgets };
      setPortfolioData({ ...portfolioDataRef.current });

      try {
        await fetch('/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgets: nextWidgets }),
        });
      } catch (err) {
        console.error('Failed to add widget:', err);
      }
    },
    [user, editMode]
  );

  // Compute stats for counter widget
  const { totalFiles, totalProjects } = useMemo(() => {
    if (!portfolioData) return { totalFiles: 0, totalProjects: 0 };
    let files = 0;
    let projects = 0;

    const countItems = (items: Item[], inProjects: boolean) => {
      for (const it of items) {
        if (it.kind === 'file') {
          files++;
          if (inProjects) projects++;
        } else if (it.kind === 'folder' && it.children) {
          countItems(it.children, inProjects || it.name.toLowerCase().includes('project'));
        }
      }
    };

    countItems(portfolioData.root, false);
    return { totalFiles: files, totalProjects: projects };
  }, [portfolioData]);

  // Minimized windows for the dock
  const minimizedWindows: MinimizedWindowInfo[] = useMemo(() => {
    return windows
      .filter((w) => w.isMinimized)
      .map((w) => ({
        id: w.id,
        title: w.title,
        iconType: w.meta.type,
      }));
  }, [windows]);

  // Active window IDs for the dock
  const activeWindowIds = useMemo(() => {
    return windows.map((w) => w.id);
  }, [windows]);

  // Topmost active window ID
  const topActiveWindowId = useMemo(() => {
    const visible = windows.filter((w) => !w.isMinimized);
    if (visible.length === 0) return null;
    return visible.reduce((highest, current) => (current.zIndex > highest.zIndex ? current : highest)).id;
  }, [windows]);

  const canEdit = user?.role === 'admin' && editMode;

  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    return [
      {
        id: 'ctx-new-folder',
        label: 'New Folder',
        icon: '📁',
        disabled: !canEdit,
        action: handleNewFolderOnDesktop,
      },
      {
        id: 'ctx-div-1',
        label: '',
        isDivider: true,
      },
      {
        id: 'ctx-get-info',
        label: 'Get Info',
        icon: 'ℹ️',
        action: handleOpenOwnersData,
      },
      {
        id: 'ctx-change-wallpaper',
        label: 'Change Wallpaper...',
        icon: '🖼️',
        action: () => handleOpenSettings(),
      },
      {
        id: 'ctx-settings',
        label: 'System Settings...',
        icon: '⚙️',
        action: () => handleOpenSettings(),
      },
      {
        id: 'ctx-clean-up',
        label: 'Clean Up Icons',
        icon: '✨',
        action: () => {
          toastManager.notify({
            type: 'info',
            title: 'Desktop Aligned',
            message: 'Desktop icons aligned to grid',
          });
        },
      },
      {
        id: 'ctx-div-2',
        label: '',
        isDivider: true,
      },
      {
        id: 'ctx-spotlight',
        label: 'Spotlight Search (Ctrl+K)',
        icon: '🔍',
        action: () => setSpotlightOpen(true),
      },
      {
        id: 'ctx-lock',
        label: 'Lock Screen',
        icon: '🔒',
        action: handleSignOut,
      },
    ];
  }, [canEdit, handleNewFolderOnDesktop, handleOpenOwnersData, handleOpenSettings, handleSignOut]);

  return (
    <div
      className="desktop-container"
      id="portfolio-desktop-os"
      onContextMenu={handleContextMenu}
    >
      {/* Three.js Silk Wave Shader Wallpaper */}
      <Wallpaper
        wallpaper={portfolioData?.settings?.appearance?.wallpaper}
        hasMaximizedWindow={hasMaximizedWindow}
      />

      {/* Boot Screen */}
      {powerState === 'booting' && (
        <BootScreen onComplete={() => setPowerState('running')} />
      )}

      {/* Power Overlay (Shutdown screen / Sleep screen) */}
      <PowerOverlay
        powerState={powerState}
        onPowerOn={handlePowerOn}
        onWakeFromSleep={handleWakeFromSleep}
      />

      {/* Login Modal Overlay (shown when not logged in) */}
      {!loadingSession && !user && powerState === 'running' && (
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
          editMode={editMode}
          onToggleEditMode={() => setEditMode(!editMode)}
          onNewFolderClick={handleNewFolderOnDesktop}
          onSignOut={handleSignOut}
          onSleep={handleSleep}
          onRestart={handleRestart}
          onShutdown={handleShutdown}
          onAboutClick={handleOpenAbout}
          onSettingsClick={handleOpenSettings}
          onSpotlightClick={() => setSpotlightOpen(true)}
          onControlCenterClick={() => setControlCenterOpen((prev) => !prev)}
        />
      )}

      {/* Desktop Workspace (Mounted only when authenticated - Zero Data Leak) */}
      {user && (
        <main
          className="desktop-workspace"
          id="desktop-workspace"
          onContextMenu={handleContextMenu}
        >
        {/* Desktop Widgets */}
        {portfolioData && (
          <Widgets
            widgets={portfolioData.widgets}
            canEdit={canEdit}
            onUpdateWidgetPosition={handleUpdateWidgetPosition}
            onUpdateWidgetText={handleUpdateWidgetText}
            onDeleteWidget={handleDeleteWidget}
            onAddWidget={handleAddWidget}
            totalFiles={totalFiles}
            totalProjects={totalProjects}
          />
        )}

        {/* Right Desktop Icons */}
        <DesktopIcons
          editMode={canEdit}
          onOpenProjects={handleOpenProjects}
          onOpenCertEducation={handleOpenCertEducation}
          onOpenOwnersData={handleOpenOwnersData}
          onNewFolder={handleNewFolderOnDesktop}
        />

        {/* Open Windows */}
        {windows.map((win) => {
          let content: React.ReactNode = null;

          if (win.meta.type === 'folder' && portfolioData) {
            // Locate current folder from root
            const activeFolderId = win.meta.folderNavId || win.meta.itemId || 'folder-projects';
            const target = findItemById(portfolioData.root, activeFolderId);
            const folder = (target && target.kind === 'folder' ? target : portfolioData.root[0]) as FolderItem;

            // Build breadcrumbs
            const crumbs: { id: string; name: string }[] = [];
            let curr: FolderItem | null = folder;
            while (curr) {
              crumbs.unshift({ id: curr.id, name: curr.name });
              curr = findParentFolder(portfolioData.root, curr.id);
            }

            content = (
              <FolderView
                folder={folder}
                canEdit={canEdit}
                isAdmin={user?.role === 'admin'}
                rootFolders={portfolioData.root.filter((r) => r.kind === 'folder') as FolderItem[]}
                trashItems={portfolioData.trash || []}
                onOpenFile={handleOpenFile}
                onNavigateFolder={(f) => handleNavigateFolderInWindow(win.id, f)}
                onAddItem={handleAddItem}
                onRenameItem={handleRenameItem}
                onDeleteItem={handleDeleteItem}
                onMoveToTrash={handleMoveToTrash}
                onRestoreTrash={handleRestoreTrash}
                onSetWallpaper={handleSetWallpaper}
                onImportFromPC={handleImportFromPC}
                breadcrumbs={crumbs}
                onBreadcrumbClick={(idx) => {
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
                  canEdit={canEdit}
                  isAdmin={user?.role === 'admin'}
                  onSaveContent={handleSaveFileContent}
                />
              );
            } else {
              content = (
                <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
                  File no longer exists.
                </div>
              );
            }
          } else if (win.meta.type === 'owner' && portfolioData) {
            content = (
              <OwnerProfileView
                owner={portfolioData.owner}
                canEdit={canEdit}
                onSaveOwner={handleSaveOwner}
              />
            );
          } else if (win.meta.type === 'settings' && portfolioData) {
            content = (
              <SystemSettings
                settings={portfolioData.settings || DEFAULT_SETTINGS}
                canEdit={canEdit}
                isAdmin={user?.role === 'admin'}
                onSaveSettings={handleSaveSettings}
                onResetDefaults={handleResetSettings}
              />
            );
          } else if (win.meta.type === 'widgets' && portfolioData) {
            content = (
              <div style={{ padding: '20px', color: '#fff' }}>
                <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Widgets Configuration</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {canEdit
                    ? 'Use the floating widget bar on the desktop to add and drag widgets.'
                    : 'Widgets are currently read-only. Switch to Admin Edit Mode to configure.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {portfolioData.widgets.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>
                        {w.type} Widget ({w.x}px, {w.y}px)
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{w.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          } else if (win.meta.type === 'terminal') {
            content = (
              <TerminalView
                portfolioData={portfolioData}
                userRole={user?.role || 'viewer'}
                userName={user?.username || user?.name || 'guest'}
                onClose={() => closeWindow(win.id)}
                onOpenWindow={(id, title, meta) => openWindow(id, title, meta)}
                onSetWallpaper={(wp) => handleSaveSettings({ appearance: { ...portfolioData?.settings?.appearance, wallpaper: wp } } as any)}
              />
            );
          } else if (win.meta.type === 'about') {
            content = (
              <AboutModal
                onOpenSettings={() => {
                  closeWindow(win.id);
                  handleOpenSettings();
                }}
                onOpenOwner={() => {
                  closeWindow(win.id);
                  handleOpenOwnersData();
                }}
              />
            );
          }

          return (
            <Window
              key={win.id}
              window={win}
              isActive={topActiveWindowId === win.id}
              onFocus={focusWindow}
              onClose={closeWindow}
              onMinimize={minimizeWindow}
              onUpdateBounds={updateWindowBounds}
              onSnapPreview={setSnapPreview}
            >
              {content}
            </Window>
          );
        })}

        {/* Snap Preview Overlay */}
        {snapPreview && snapPreview.visible && (
          <div
            className="snap-preview-overlay"
            style={{
              left: `${snapPreview.x}px`,
              top: `${snapPreview.y}px`,
              width: `${snapPreview.w}px`,
              height: `${snapPreview.h}px`,
            }}
          />
        )}
        </main>
      )}

      {/* macOS Dock (Mounted only when authenticated) */}
      {user && (
        <Dock
          onOpenApp={handleDockOpenApp}
          onRestoreWindow={restoreWindow}
          onSignOut={handleSignOut}
          minimizedWindows={minimizedWindows}
          activeWindowIds={activeWindowIds}
        />
      )}

      {/* M8.3: Toast Notifications */}
      <ToastContainer />

      {/* M8.2: Global Desktop Right-Click Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* M9.2: macOS Control Center Popover */}
      <ControlCenter
        isOpen={controlCenterOpen}
        onClose={() => setControlCenterOpen(false)}
        brightness={brightness}
        onBrightnessChange={setBrightness}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        onOpenSettings={() => {
          setControlCenterOpen(false);
          handleOpenSettings();
        }}
      />

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

      {/* M8.1: Global Spotlight Search Modal */}
      <SpotlightModal
        isOpen={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        portfolioData={portfolioData}
        isAdmin={user?.role === 'admin'}
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
