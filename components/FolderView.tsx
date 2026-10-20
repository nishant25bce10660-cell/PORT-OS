'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Item, FolderItem, FileItem, TrashedItem } from '@/lib/types';
import QuickLookModal from './QuickLookModal';

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
  onSetWallpaper?: (file: FileItem) => void;
  onImportFromPC?: (fileData: { name: string; content?: string; base64?: string }) => void;
  breadcrumbs: { id: string; name: string }[];
  onBreadcrumbClick: (index: number) => void;
}

function renderFileGlyph(item: Item) {
  if (item.kind === 'folder') {
    return (
      <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
        <path d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z" fill="#0284c7" />
        <path d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z" fill="#38bdf8" />
      </svg>
    );
  }

  const name = item.name.toLowerCase();
  if (name.endsWith('.md')) {
    return (
      <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
        <path d="M10 6C10 4.89543 10.8954 4 12 4H28L38 14V42C38 43.1046 37.1046 44 36 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1e293b" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <path d="M28 4V14H38" fill="#334155" />
        <rect x="15" y="24" width="18" height="12" rx="2" fill="#7C6CFF" fillOpacity="0.25" stroke="#7C6CFF" strokeWidth="1.2" />
        <text x="24" y="33" fontSize="8" fontWeight="bold" fill="#F5F7FA" textAnchor="middle" fontFamily="sans-serif">MD</text>
      </svg>
    );
  }

  if (name.endsWith('.go') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.py')) {
    return (
      <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
        <path d="M10 6C10 4.89543 10.8954 4 12 4H28L38 14V42C38 43.1046 37.1046 44 36 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#0f172a" stroke="rgba(53, 208, 186, 0.4)" strokeWidth="1.5" />
        <path d="M28 4V14H38" fill="#1e293b" />
        <text x="24" y="29" fontSize="11" fontWeight="bold" fill="#35D0BA" textAnchor="middle" fontFamily="monospace">&lt;/&gt;</text>
      </svg>
    );
  }

  if (name.includes('cert') || name.endsWith('.pdf')) {
    return (
      <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
        <path d="M10 6C10 4.89543 10.8954 4 12 4H28L38 14V42C38 43.1046 37.1046 44 36 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1c1917" stroke="rgba(254, 240, 138, 0.3)" strokeWidth="1.5" />
        <path d="M28 4V14H38" fill="#292524" />
        <circle cx="24" cy="27" r="7" fill="#ca8a04" fillOpacity="0.4" stroke="#fef08a" strokeWidth="1.2" />
        <path d="M24 23l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5z" fill="#fef08a" />
      </svg>
    );
  }

  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <path d="M10 6C10 4.89543 10.8954 4 12 4H28L38 14V42C38 43.1046 37.1046 44 36 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1e222d" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <path d="M28 4V14H38" fill="#2a303f" />
      <line x1="16" y1="22" x2="32" y2="22" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="28" x2="32" y2="28" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
  const [isTrashView, setIsTrashView] = useState(false);
  const [isPCView, setIsPCView] = useState(false);
  const [pcItems, setPcItems] = useState<any[]>([]);
  const [pcPath, setPcPath] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [navHistory, setNavHistory] = useState<FolderItem[]>([folder]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: Item | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PC items when PC view is activated
  useEffect(() => {
    if (isPCView && isAdmin) {
      fetch(`/api/pc/browse?path=${encodeURIComponent(pcPath)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.items) {
            setPcItems(data.items);
          }
        })
        .catch(console.error);
    }
  }, [isPCView, pcPath, isAdmin]);

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
        if (contextMenu.visible) setContextMenu((prev) => ({ ...prev, visible: false }));
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
  }, [selectedItemId, quickLookItem, editingItemId, folder, canEdit, onMoveToTrash, contextMenu]);

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

      const res = await fetch('/api/pc/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFolderId: folder.id,
          fileName: file.name,
          content: !isImg ? (reader.result as string) : undefined,
          base64: isImg ? (reader.result as string).split(',')[1] : undefined,
        }),
      });

      setTimeout(() => setUploadProgress(null), 400);

      if (res.ok && onImportFromPC) {
        onImportFromPC({
          name: file.name,
          content: !isImg ? (reader.result as string) : undefined,
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

  // Right-Click Context Menu
  const handleContextMenu = (e: React.MouseEvent, item: Item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItemId(item.id);
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  return (
    <div
      className="finder-window-container"
      onClick={() => {
        if (contextMenu.visible) setContextMenu((prev) => ({ ...prev, visible: false }));
      }}
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
        {/* Left: History Nav + View Mode Switcher */}
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
            <button
              type="button"
              id="btn-finder-back"
              disabled={historyIndex <= 0}
              onClick={handleNavBack}
              title="Back"
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
            <button
              type="button"
              id="btn-finder-forward"
              disabled={historyIndex >= navHistory.length - 1}
              onClick={handleNavForward}
              title="Forward"
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
          </div>

          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button
              type="button"
              className={`btn-view-icons ${viewMode === 'icons' ? 'is-active' : ''}`}
              title="Icons View"
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
            <button
              type="button"
              className={`btn-view-list ${viewMode === 'list' ? 'is-active' : ''}`}
              title="List View"
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
            <button
              type="button"
              className={`btn-view-columns ${viewMode === 'columns' ? 'is-active' : ''}`}
              title="Columns View"
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
            <button
              type="button"
              className={`btn-view-gallery ${viewMode === 'gallery' ? 'is-active' : ''}`}
              title="Gallery View"
              onClick={() => setViewMode('gallery')}
              style={{
                background: viewMode === 'gallery' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 7px',
                color: viewMode === 'gallery' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              🖼️
            </button>
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
              fontSize: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
        </div>

        {/* Right: Admin Action Buttons */}
        {canEdit && !isTrashView && !isPCView && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              id="btn-add-file"
              onClick={() => onAddItem(folder.id, 'file')}
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
            <button
              type="button"
              id="btn-add-folder"
              onClick={() => onAddItem(folder.id, 'folder')}
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
            <button
              type="button"
              id="btn-upload-file"
              onClick={() => fileInputRef.current?.click()}
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
                  setIsPCView(false);
                  onNavigateFolder(rf);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: folder.id === rf.id && !isTrashView && !isPCView ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: folder.id === rf.id && !isTrashView && !isPCView ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <span>📁</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rf.name}
                </span>
              </div>
            ))}
          </div>

          {/* Section: Favorites (Admin only) */}
          {isAdmin && (
            <div>
              <div style={{ padding: '0 6px 4px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Favorites
              </div>
              <div
                onClick={() => {
                  setIsTrashView(false);
                  setIsPCView(false);
                  if (rootFolders[0]) onNavigateFolder(rootFolders[0]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>🖥️</span> Desktop
              </div>

              {/* Trash Folder */}
              <div
                className="sidebar-item-trash"
                onClick={() => {
                  setIsTrashView(true);
                  setIsPCView(false);
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
                  <span>🗑️</span> Trash
                </div>
                {trashItems.length > 0 && (
                  <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '1px 5px', borderRadius: '10px' }}>
                    {trashItems.length}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* F2 & F3: Section Locations (Rendered ONLY if canEdit / Admin) */}
          {isAdmin && (
            <div>
              <div style={{ padding: '0 6px 4px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Locations
              </div>
              <div
                className="sidebar-item-pc"
                onClick={() => {
                  setIsPCView(true);
                  setIsTrashView(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: isPCView ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: isPCView ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <span>💻</span> This PC
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
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f87171' }}>Trash Bin</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{trashItems.length} items</span>
              </div>
              {trashItems.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px', fontSize: '12px' }}>
                  Trash is empty.
                </div>
              ) : (
                trashItems.map((trashed) => (
                  <div
                    key={trashed.id}
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
                    <span>{trashed.item.name}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onRestoreTrash && onRestoreTrash(trashed.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          background: 'rgba(52, 211, 153, 0.2)',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          color: '#34d399',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : isPCView ? (
            /* THIS PC VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                This PC &gt; {pcPath || 'Roots'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                {pcItems.map((pci) => (
                  <div
                    key={pci.name}
                    onClick={() => {
                      if (pci.isDirectory) {
                        setPcPath(pci.path);
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '10px 6px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>{pci.isDirectory ? '📁' : '📄'}</span>
                    <span style={{ fontSize: '11px', marginTop: '6px', textAlign: 'center', wordBreak: 'break-all' }}>
                      {pci.name}
                    </span>
                    {!pci.isDirectory && canEdit && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch(`/api/pc/read?path=${encodeURIComponent(pci.path)}`);
                          if (res.ok) {
                            const data = await res.json();
                            await fetch('/api/pc/import', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                targetFolderId: folder.id,
                                fileName: pci.name,
                                content: data.content,
                                base64: data.base64,
                              }),
                            });
                            alert(`Imported ${pci.name} into vault!`);
                          }
                        }}
                        style={{
                          marginTop: '6px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          background: 'rgba(56, 189, 248, 0.2)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#38bdf8',
                          cursor: 'pointer',
                        }}
                      >
                        Import
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'icons' ? (
            /* 1. ICONS VIEW */
            <div
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
                        title={item.name}
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
            <div style={{ width: '100%', fontSize: '11px' }}>
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
                      <span style={{ fontSize: '14px' }}>{isFolder ? '📁' : item.name.endsWith('.md') ? '📝' : item.name.includes('cert') ? '📜' : '📄'}</span>
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
            <div style={{ display: 'flex', height: '100%', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{item.kind === 'folder' ? '📁' : '📄'}</span>
                      <span>{item.name}</span>
                    </div>
                    {item.kind === 'folder' && <span style={{ color: 'var(--text-muted)' }}>&gt;</span>}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {selectedItemId ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {displayedItems.find((i) => i.id === selectedItemId)?.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Press Spacebar for Quick Look
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Select an item to preview</span>
                )}
              </div>
            </div>
          ) : (
            /* 4. GALLERY VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
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
                {selectedItemId ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '54px', marginBottom: '12px' }}>
                      {displayedItems.find((i) => i.id === selectedItemId)?.kind === 'folder' ? '📁' : '📄'}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>
                      {displayedItems.find((i) => i.id === selectedItemId)?.name}
                    </div>
                  </div>
                ) : (
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
                    style={{
                      flexShrink: 0,
                      width: '64px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      borderRadius: '6px',
                      background: selectedItemId === item.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: selectedItemId === item.id ? '1px solid #38bdf8' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '20px' }}>{item.kind === 'folder' ? '📁' : '📄'}</div>
                    <div style={{ fontSize: '10px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.item && (
        <div
          className="finder-context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            background: 'rgba(28, 32, 44, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: '4px',
            zIndex: 9999,
            minWidth: '150px',
            fontSize: '12px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={() => {
              if (contextMenu.item?.kind === 'folder') onNavigateFolder(contextMenu.item as FolderItem);
              else onOpenFile(contextMenu.item as FileItem);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Open
          </div>
          <div
            onClick={() => {
              setQuickLookItem(contextMenu.item);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Quick Look (Space)
          </div>
          {canEdit && (
            <>
              <div
                onClick={(e) => handleStartRename(contextMenu.item!, e)}
                style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Rename
              </div>
              <div
                onClick={() => {
                  if (onMoveToTrash) onMoveToTrash(contextMenu.item!.id);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', color: '#f87171' }}
              >
                Move to Trash
              </div>
            </>
          )}
        </div>
      )}

      {/* Quick Look Modal */}
      {quickLookItem && (
        <QuickLookModal
          item={quickLookItem}
          onClose={() => setQuickLookItem(null)}
          onSetWallpaper={(f) => {
            if (onSetWallpaper) onSetWallpaper(f);
            setQuickLookItem(null);
          }}
        />
      )}
    </div>
  );
}
