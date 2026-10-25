'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Item, FolderItem, FileItem, TrashedItem } from '@/lib/types';
import QuickLookModal from './QuickLookModal';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForFile, getIconKindForFolder } from '@/components/icons/iconRegistry';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';
import { useContextMenu, ContextMenuItem } from './ContextMenu';

export type ViewMode = 'icons' | 'list' | 'columns' | 'gallery';
export type SortField = 'name' | 'date' | 'size' | 'kind';

interface FolderViewProps {
  folder: FolderItem;
  canEdit: boolean;
  isAdmin?: boolean;
  rootFolders?: FolderItem[];
  trashItems?: TrashedItem[];
  onOpenFile: (file: FileItem) => void;
  onNavigateFolder: (folder: FolderItem) => void;
  onAddItem: (parentId: string, kind: 'folder' | 'file') => void;
  onRenameItem: (itemId: string, newName: string) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveToTrash?: (itemId: string) => void;
  onRestoreTrash?: (itemId: string) => void;
  onEmptyTrash?: () => void;
  initialIsTrashView?: boolean;
  onSetWallpaper?: (file: FileItem) => void;
  onImportFromPC?: (fileData: { name: string; content?: string; base64?: string }) => void;
  breadcrumbs: { id: string; name: string }[];
  onBreadcrumbClick: (index: number) => void;
}

function renderFileGlyph(item: Item, size: number = 42) {
  const kind =
    item.kind === 'folder'
      ? getIconKindForFolder(item.id, item.name)
      : getIconKindForFile(item.name);
  return <PortOSIcon kind={kind} size={size} />;
}

function getItemKindLabel(item: Item): string {
  if (item.kind === 'folder') return 'Folder';
  const name = item.name.toLowerCase();
  if (name.endsWith('.md')) return 'Markdown Document';
  if (name.endsWith('.ts') || name.endsWith('.js')) return 'Script File';
  if (name.endsWith('.go')) return 'Go Source File';
  if (name.includes('cert')) return 'Certificate';
  return 'Document';
}

export default function FolderView({
  folder,
  canEdit,
  isAdmin = false,
  rootFolders = [],
  trashItems = [],
  onOpenFile,
  onNavigateFolder,
  onAddItem,
  onRenameItem,
  onDeleteItem,
  onMoveToTrash,
  onRestoreTrash,
  onEmptyTrash,
  initialIsTrashView = false,
  onSetWallpaper,
  onImportFromPC,
  breadcrumbs,
  onBreadcrumbClick,
}: FolderViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('icons');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [quickLookItem, setQuickLookItem] = useState<Item | null>(null);
  const [isTrashView, setIsTrashView] = useState(initialIsTrashView || folder.id === 'trash');
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [navHistory, setNavHistory] = useState<FolderItem[]>([folder]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    if (initialIsTrashView || folder.id === 'trash') {
      setIsTrashView(true);
    }
  }, [initialIsTrashView, folder.id]);

  useEffect(() => {
    setNavHistory((prev) => {
      const current = prev[historyIndex];
      if (!current || current.id !== folder.id) {
        const next = [...prev.slice(0, historyIndex + 1), folder];
        setHistoryIndex(next.length - 1);
        return next;
      }
      return prev;
    });
  }, [folder.id]);

  const handleNavBack = () => {
    if (historyIndex > 0) {
      const prevFolder = navHistory[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      onNavigateFolder(prevFolder);
    }
  };

  const handleNavForward = () => {
    if (historyIndex < navHistory.length - 1) {
      const nextFolder = navHistory[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      onNavigateFolder(nextFolder);
    }
  };

  const { openContextMenu } = useContextMenu();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation & Quick Look on Spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingItemId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (quickLookItem) {
          setQuickLookItem(null);
        } else if (selectedItemId) {
          const item = folder.children?.find((c) => c.id === selectedItemId);
          if (item) setQuickLookItem(item);
        }
      } else if (e.key === 'Escape') {
        if (quickLookItem) setQuickLookItem(null);
      } else if (e.key === 'Enter') {
        if (selectedItemId) {
          const item = folder.children?.find((c) => c.id === selectedItemId);
          if (item) {
            e.preventDefault();
            if (item.kind === 'folder') onNavigateFolder(item as FolderItem);
            else onOpenFile(item as FileItem);
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canEdit && selectedItemId && onMoveToTrash) {
          e.preventDefault();
          onMoveToTrash(selectedItemId);
          setSelectedItemId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, quickLookItem, editingItemId, folder, canEdit, onMoveToTrash]);

  // Filter & Sort Items
  const displayedItems = useMemo(() => {
    if (isTrashView) {
      return trashItems.map((t) => t.item);
    }

    let items = folder.children || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((it) => {
        if (it.name.toLowerCase().includes(q)) return true;
        if (it.kind === 'file' && (it as FileItem).content?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return [...items].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortField === 'kind') {
        return a.kind.localeCompare(b.kind);
      }
      return 0;
    });
  }, [folder.children, searchQuery, sortField, isTrashView, trashItems]);

  // Handle Drag & Drop File Upload
  const handleDragOver = (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await simulateUploadFile(file);
    }
  };

  const simulateUploadFile = async (file: File) => {
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p === null || p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + 25;
      });
    }, 80);

    const reader = new FileReader();
    reader.onload = async () => {
      clearInterval(interval);
      setUploadProgress(100);
      const isImg = file.type.startsWith('image/');

      setTimeout(() => setUploadProgress(null), 400);

      if (onImportFromPC) {
        onImportFromPC({
          name: file.name,
          content: !isImg ? (reader.result as string) : undefined,
          base64: isImg ? (reader.result as string).split(',')[1] : undefined,
        });
      }
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Inline Rename
  const handleStartRename = (item: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditingItemId(item.id);
    setEditingName(item.name);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleSaveRename = (itemId: string) => {
    if (editingName.trim()) {
      onRenameItem(itemId, editingName.trim());
    }
    setEditingItemId(null);
  };

  // Right-Click Context Menu using Unified Provider
  const handleContextMenu = (e: React.MouseEvent, item: Item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItemId(item.id);

    const isFolder = item.kind === 'folder';
    const isImage = !isFolder && /\.(png|jpe?g|webp|gif|svg)$/i.test(item.name);

    const items: ContextMenuItem[] = [
      {
        id: 'ctx-finder-open',
        label: isFolder ? 'Open Folder' : 'Open',
        icon: <PortOSIcon kind={isFolder ? 'folder' : 'file'} size={14} />,
        action: () => {
          if (isFolder) onNavigateFolder(item as FolderItem);
          else onOpenFile(item as FileItem);
        },
      },
      {
        id: 'ctx-finder-quicklook',
        label: 'Quick Look',
        shortcut: 'Space',
        icon: <PortOSIcon kind="spotlight" size={14} />,
        action: () => setQuickLookItem(item),
      },
    ];

    if (canEdit && !initialIsTrashView) {
      items.push(
        { id: 'ctx-div-1', label: '', isDivider: true },
        {
          id: 'ctx-finder-rename',
          label: 'Rename',
          icon: <PortOSIcon kind="settings" size={14} />,
          action: () => {
            setEditingItemId(item.id);
            setEditingItemName(item.name);
          },
        },
        {
          id: 'ctx-finder-trash',
          label: 'Move to Trash',
          icon: <PortOSIcon kind="trash" size={14} />,
          danger: true,
          action: () => onMoveToTrash?.(item.id),
        }
      );
    }

    if (isImage && onSetWallpaper) {
      items.push({ id: 'ctx-div-wp', label: '', isDivider: true });
      items.push({
        id: 'ctx-finder-wallpaper',
        label: 'Set as Desktop Wallpaper',
        icon: <PortOSIcon kind="settings" size={14} />,
        action: () => onSetWallpaper(item as FileItem),
      });
    }

    if (initialIsTrashView && onRestoreTrash) {
      items.push({ id: 'ctx-div-trash', label: '', isDivider: true });
      items.push({
        id: 'ctx-finder-restore',
        label: 'Put Back',
        icon: <PortOSIcon kind="trash" size={14} />,
        action: () => onRestoreTrash(item.id),
      });
    }

    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: item.name,
      items,
    });
  };

  const handleContextMenuEmpty = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'ctx-finder-new-folder',
        label: 'New Folder',
        disabled: !canEdit || initialIsTrashView,
        action: () => {
          if (canEdit && !initialIsTrashView) {
            handleCreateNewFolder();
          }
        },
      },
      {
        id: 'ctx-finder-import',
        label: 'Import Files...',
        disabled: !canEdit || initialIsTrashView,
        action: () => {
          if (canEdit && fileInputRef.current) {
            fileInputRef.current.click();
          }
        },
      },
      { id: 'ctx-div-empty-1', label: '', isDivider: true },
      {
        id: 'ctx-finder-view-icons',
        label: 'View as Icons',
        action: () => setViewMode('icons'),
      },
      {
        id: 'ctx-finder-view-list',
        label: 'View as List',
        action: () => setViewMode('list'),
      },
    ];

    if (initialIsTrashView && onEmptyTrash) {
      items.push({ id: 'ctx-div-empty-trash', label: '', isDivider: true });
      items.push({
        id: 'ctx-finder-empty-trash',
        label: 'Empty Trash...',
        danger: true,
        disabled: !canEdit || (trashItems ? trashItems.length === 0 : true),
        action: () => onEmptyTrash(),
      });
    }

    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: folder.name || 'Finder',
      items,
    });
  };

  return (
    <div
      className="finder-window-container"
      onContextMenu={handleContextMenuEmpty}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(20, 22, 30, 0.92)',
        color: '#fff',
        fontFamily: 'var(--font-ui)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div
          className="upload-progress-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: 'rgba(255, 255, 255, 0.1)',
            zIndex: 100,
          }}
        >
          <div
            className="upload-progress-bar"
            style={{
              width: `${uploadProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div
          className="finder-drop-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(56, 189, 248, 0.25)',
            border: '2px dashed #38bdf8',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: 600,
            color: '#fff',
            pointerEvents: 'none',
          }}
        >
          Drop files to upload to {folder.name}
        </div>
      )}

      {/* F1: Finder Toolbar */}
      <div
        className="finder-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: 'rgba(28, 31, 42, 0.75)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          gap: '12px',
        }}
      >
        <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
          {/* Left: History Nav + View Mode Switcher + Quick Look */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* History Navigation */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <WarmTooltip content="Back" shortcut="⌘[" side="bottom">
                <button
                  type="button"
                  id="btn-finder-back"
                  disabled={historyIndex <= 0}
                  onClick={handleNavBack}
                  aria-label="Back"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: historyIndex > 0 ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                    cursor: historyIndex > 0 ? 'pointer' : 'default',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  ‹
                </button>
              </WarmTooltip>
              <WarmTooltip content="Forward" shortcut="⌘]" side="bottom">
                <button
                  type="button"
                  id="btn-finder-forward"
                  disabled={historyIndex >= navHistory.length - 1}
                  onClick={handleNavForward}
                  aria-label="Forward"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: historyIndex < navHistory.length - 1 ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                    cursor: historyIndex < navHistory.length - 1 ? 'pointer' : 'default',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  ›
                </button>
              </WarmTooltip>
            </div>

            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <WarmTooltip content="Icons View" shortcut="⌘1" side="bottom">
                <button
                  type="button"
                  id="btn-view-icons"
                  data-view="icons"
                  className={`btn-view-icons ${viewMode === 'icons' ? 'is-active' : ''}`}
                  aria-label="Icons View"
                  onClick={() => setViewMode('icons')}
                  style={{
                    background: viewMode === 'icons' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    color: viewMode === 'icons' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ⊞
                </button>
              </WarmTooltip>
              <WarmTooltip content="List View" shortcut="⌘2" side="bottom">
                <button
                  type="button"
                  id="btn-view-list"
                  data-view="list"
                  className={`btn-view-list ${viewMode === 'list' ? 'is-active' : ''}`}
                  aria-label="List View"
                  onClick={() => setViewMode('list')}
                  style={{
                    background: viewMode === 'list' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ☰
                </button>
              </WarmTooltip>
              <WarmTooltip content="Columns View" shortcut="⌘3" side="bottom">
                <button
                  type="button"
                  id="btn-view-columns"
                  data-view="columns"
                  className={`btn-view-columns ${viewMode === 'columns' ? 'is-active' : ''}`}
                  aria-label="Columns View"
                  onClick={() => setViewMode('columns')}
                  style={{
                    background: viewMode === 'columns' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    color: viewMode === 'columns' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ▥
                </button>
              </WarmTooltip>
              <WarmTooltip content="Gallery View" shortcut="⌘4" side="bottom">
                <button
                  type="button"
                  id="btn-view-gallery"
                  data-view="gallery"
                  className={`btn-view-gallery ${viewMode === 'gallery' ? 'is-active' : ''}`}
                  aria-label="Gallery View"
                  onClick={() => setViewMode('gallery')}
                  style={{
                    background: viewMode === 'gallery' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    color: viewMode === 'gallery' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <rect x="1" y="2" width="14" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="2" y="13" width="3" height="2" rx="0.5" fill="currentColor" />
                    <rect x="6.5" y="13" width="3" height="2" rx="0.5" fill="currentColor" />
                    <rect x="11" y="13" width="3" height="2" rx="0.5" fill="currentColor" />
                  </svg>
                </button>
              </WarmTooltip>
              <WarmTooltip content="Quick Look Preview" shortcut="Space" side="bottom">
                <button
                  type="button"
                  id="btn-finder-quicklook"
                  aria-label="Quick Look Preview"
                  disabled={!selectedItemId}
                  onClick={() => {
                    if (selectedItemId) {
                      const item = folder.children?.find((c) => c.id === selectedItemId);
                      if (item) setQuickLookItem(item);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 7px',
                    color: selectedItemId ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                    cursor: selectedItemId ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </WarmTooltip>
            </div>
          </div>

          {/* Center: Search input */}
          <div style={{ flex: 1, maxWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              className="finder-search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '4px 8px 4px 24px',
                fontSize: '11px',
                color: '#fff',
                outline: 'none',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="14.5" y2="14.5" strokeLinecap="round" />
              </svg>
            </span>
          </div>

          {/* Right: Admin Action Buttons */}
          {canEdit && !isTrashView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <WarmTooltip content="Create New File" side="bottom">
                <button
                  type="button"
                  id="btn-add-file"
                  onClick={() => onAddItem(folder.id, 'file')}
                  aria-label="Create New File"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#fff',
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  + File
                </button>
              </WarmTooltip>
              <WarmTooltip content="Create New Folder" side="bottom">
                <button
                  type="button"
                  id="btn-add-folder"
                  onClick={() => onAddItem(folder.id, 'folder')}
                  aria-label="Create New Folder"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#fff',
                    background: 'rgba(52, 211, 153, 0.2)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  + Folder
                </button>
              </WarmTooltip>
              <WarmTooltip content="Upload Local Files" side="bottom">
                <button
                  type="button"
                  id="btn-upload-file"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload Local Files"
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#fff',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Upload
                </button>
              </WarmTooltip>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    simulateUploadFile(e.target.files[0]);
                  }
                }}
              />
            </div>
          )}
        </WarmTooltipGroup>
      </div>

      {/* Main Body: Sidebar + Viewport */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* F1: Finder Sidebar */}
        <div
          className="finder-sidebar"
          style={{
            width: '160px',
            background: 'rgba(18, 20, 28, 0.85)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '11px',
          }}
        >
          {/* Section: Vault */}
          <div>
            <div style={{ padding: '0 6px 4px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Vault
            </div>
            {rootFolders.map((rf) => (
              <div
                key={rf.id}
                onClick={() => {
                  setIsTrashView(false);
                  onNavigateFolder(rf);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: folder.id === rf.id && !isTrashView ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: folder.id === rf.id && !isTrashView ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <PortOSIcon kind={getIconKindForFolder(rf.id, rf.name)} size={16} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rf.name}
                </span>
              </div>
            ))}
          </div>

          {/* Section: Trash (Admin only) */}
          {isAdmin && (
            <div>
              <div style={{ padding: '0 6px 4px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                System
              </div>

              {/* Trash Folder */}
              <div
                className="sidebar-item-trash"
                onClick={() => {
                  setIsTrashView(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: isTrashView ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  color: isTrashView ? '#f87171' : 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PortOSIcon kind={trashItems.length > 0 ? 'trash-full' : 'trash'} size={16} />
                  <span>Trash</span>
                </div>
                {trashItems.length > 0 && (
                  <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '1px 5px', borderRadius: '10px' }}>
                    {trashItems.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Viewport Content Area */}
        <div
          className={`finder-viewport finder-view-${viewMode}`}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            position: 'relative',
          }}
        >
          {/* TRASH VIEW */}
          {isTrashView ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PortOSIcon kind={trashItems.length > 0 ? 'trash-full' : 'trash'} size={20} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f87171' }}>Trash Bin</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({trashItems.length} items)</span>
                </div>
                {canEdit && trashItems.length > 0 && (
                  <WarmTooltip content="Permanently erase all items in Trash" side="bottom">
                    <button
                      id="btn-empty-trash"
                      type="button"
                      onClick={() => setShowEmptyConfirm(true)}
                      aria-label="Empty Trash"
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Empty Trash...
                    </button>
                  </WarmTooltip>
                )}
              </div>

              {/* Confirmation modal for Empty Trash */}
              {showEmptyConfirm && (
                <div
                  id="empty-trash-dialog"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      width: '320px',
                      background: '#1a1e29',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗑️</div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 6px 0', color: '#fff' }}>
                      Empty Trash?
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--tx-2, #94a3b8)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                      Are you sure you want to permanently erase the items in the Trash? You can’t undo this action.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                      <button
                        id="btn-cancel-empty-trash"
                        type="button"
                        onClick={() => setShowEmptyConfirm(false)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '12px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        id="btn-confirm-empty-trash"
                        type="button"
                        onClick={() => {
                          setShowEmptyConfirm(false);
                          onEmptyTrash?.();
                        }}
                        style={{
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          background: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Empty Trash
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {trashItems.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <PortOSIcon kind="trash" size={32} />
                  <span>Trash is empty.</span>
                </div>
              ) : (
                trashItems.map((trashed) => (
                  <div
                    key={trashed.id}
                    id={`trash-item-${trashed.id}`}
                    className="trash-item-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderFileGlyph(trashed.item, 20)}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{trashed.item.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Original folder: {trashed.originalParentId || 'Vault Root'} · {trashed.trashedAt ? new Date(trashed.trashedAt).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <WarmTooltip content="Put Back (Restore to original folder)" side="top">
                          <button
                            id={`btn-restore-${trashed.id}`}
                            type="button"
                            onClick={() => onRestoreTrash && onRestoreTrash(trashed.id)}
                            aria-label="Put Back"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 500,
                              background: 'rgba(52, 211, 153, 0.18)',
                              border: '1px solid rgba(52, 211, 153, 0.35)',
                              color: '#34d399',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Put Back
                          </button>
                        </WarmTooltip>
                        <WarmTooltip content="Delete Immediately" side="top">
                          <button
                            id={`btn-delete-perm-${trashed.id}`}
                            type="button"
                            onClick={() => onDeleteItem && onDeleteItem(trashed.id)}
                            aria-label="Delete Immediately"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </WarmTooltip>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : viewMode === 'icons' ? (
            /* 1. ICONS VIEW */
            <div
              className="finder-view-icons"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                gap: '16px',
                alignContent: 'start',
              }}
            >
              {displayedItems.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', paddingTop: '60px', fontSize: '12px' }}>
                  Empty folder
                </div>
              )}

              {displayedItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                const isEditing = editingItemId === item.id;
                const isFolder = item.kind === 'folder';

                return (
                  <div
                    key={item.id}
                    className={`finder-item folder-item-card ${isSelected ? 'is-selected' : ''}`}
                    id={`item-${item.id}`}
                    onClick={() => setSelectedItemId(item.id)}
                    onDoubleClick={() => {
                      if (isFolder) onNavigateFolder(item as FolderItem);
                      else onOpenFile(item as FileItem);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '8px 6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {renderFileGlyph(item)}
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        className="rename-input"
                        id={`rename-input-${item.id}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(item.id);
                          if (e.key === 'Escape') setEditingItemId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          marginTop: '4px',
                          fontSize: '11px',
                          width: '90%',
                          background: 'rgba(0,0,0,0.6)',
                          border: '1px solid #38bdf8',
                          borderRadius: '4px',
                          color: '#fff',
                          textAlign: 'center',
                          padding: '2px 4px',
                        }}
                      />
                    ) : (
                      <span
                        className="item-name-label"
                        aria-label={item.name}
                        style={{
                          marginTop: '4px',
                          fontSize: '11.5px',
                          textAlign: 'center',
                          color: '#fff',
                          lineHeight: '1.25',
                          maxWidth: '92px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          wordBreak: 'break-all',
                        }}
                      >
                        {item.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            /* 2. LIST VIEW */
            <div className="finder-view-list" style={{ width: '100%', fontSize: '11px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '6px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                <span>Name</span>
                <span>Date Modified</span>
                <span>Kind</span>
                <span>Size</span>
              </div>
              {displayedItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                const isFolder = item.kind === 'folder';

                return (
                  <div
                    key={item.id}
                    className={`finder-item finder-list-row ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedItemId(item.id)}
                    onDoubleClick={() => {
                      if (isFolder) onNavigateFolder(item as FolderItem);
                      else onOpenFile(item as FileItem);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      padding: '7px 12px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderFileGlyph(item, 18)}
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>Oct 20, 2026</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{getItemKindLabel(item)}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {isFolder
                        ? `${(item as FolderItem).children?.length || 0} items`
                        : `${(((item as FileItem).content?.length || 1024) / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'columns' ? (
            /* 3. COLUMNS VIEW */
            <div className="finder-view-columns" style={{ display: 'flex', height: '100%', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px' }}>
              <div style={{ width: '220px', borderRight: '1px solid rgba(255, 255, 255, 0.08)', overflowY: 'auto' }}>
                {displayedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`finder-item ${selectedItemId === item.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedItemId(item.id)}
                    onDoubleClick={() => {
                      if (item.kind === 'folder') onNavigateFolder(item as FolderItem);
                      else onOpenFile(item as FileItem);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    onDoubleClick={() => {
                      if (item.kind === 'folder') onNavigateFolder(item as FolderItem);
                      else onOpenFile(item as FileItem);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      fontSize: '11px',
                      background: selectedItemId === item.id ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderFileGlyph(item, 16)}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    {item.kind === 'folder' && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>&gt;</span>}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {selectedItemId ? (() => {
                  const sel = displayedItems.find((i) => i.id === selectedItemId);
                  if (!sel) return null;
                  return (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ marginBottom: '12px' }}>
                        {renderFileGlyph(sel, 54)}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        {sel.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Press Spacebar for Quick Look
                      </div>
                    </div>
                  );
                })() : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Select an item to preview</span>
                )}
              </div>
            </div>
          ) : (
            /* 4. GALLERY VIEW */
            <div className="finder-view-gallery" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '20px',
                }}
              >
                {selectedItemId ? (() => {
                  const sel = displayedItems.find((i) => i.id === selectedItemId);
                  if (!sel) return null;
                  return (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ marginBottom: '14px' }}>
                        {renderFileGlyph(sel, 72)}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>
                        {sel.name}
                      </div>
                    </div>
                  );
                })() : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Select an item</span>
                )}
              </div>

              {/* Thumbnail Strip */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {displayedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`finder-item ${selectedItemId === item.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedItemId(item.id)}
                    onDoubleClick={() => {
                      if (item.kind === 'folder') onNavigateFolder(item as FolderItem);
                      else onOpenFile(item as FileItem);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    style={{
                      flexShrink: 0,
                      width: '64px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      borderRadius: '6px',
                      background: selectedItemId === item.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: selectedItemId === item.id ? '1px solid #38bdf8' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {renderFileGlyph(item, 28)}
                    </div>
                    <div style={{ fontSize: '10px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '56px' }}>
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* F1: Path Bar (Breadcrumbs) at bottom */}
      <div
        className="finder-path-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 14px',
          fontSize: '11px',
          background: 'rgba(22, 24, 32, 0.8)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Vault &gt;</span>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            {idx > 0 && <span style={{ color: 'var(--text-muted)' }}>&gt;</span>}
            <button
              type="button"
              onClick={() => onBreadcrumbClick(idx)}
              style={{
                background: 'none',
                border: 'none',
                color: idx === breadcrumbs.length - 1 ? '#fff' : 'var(--text-secondary)',
                fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                fontSize: '11px',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* F1: Status Bar */}
      <div
        className="finder-status-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 14px',
          fontSize: '10px',
          background: 'rgba(16, 18, 24, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          color: 'var(--text-muted)',
        }}
      >
        <span>{displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'}</span>
        <span>{selectedItemId ? '1 item selected' : ''}</span>
        <span>Portfolio Vault</span>
      </div>

      {/* Quick Look Modal */}
      {quickLookItem && (
        <QuickLookModal
          item={quickLookItem}
          allItems={displayedItems}
          onClose={() => setQuickLookItem(null)}
          onNavigateItem={(next) => {
            setQuickLookItem(next);
            setSelectedItemId(next.id);
          }}
          onSetWallpaper={(f) => {
            if (onSetWallpaper) onSetWallpaper(f);
            setQuickLookItem(null);
          }}
        />
      )}
    </div>
  );
}
