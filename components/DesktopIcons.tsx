'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForApp } from '@/components/icons/iconRegistry';
import FolderFloat, { FolderFloatItem } from '@/components/FolderFloat';

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
}

const DEFAULT_FOLDER_ITEMS: Record<string, any[]> = {
  projects: [
    { id: 'file-proj-1', name: 'Distributed-KV-Store.md', kind: 'file' },
    { id: 'file-proj-2', name: 'Portfolio-OS.md', kind: 'file' },
    { id: 'file-proj-3', name: 'Realtime-Voxel-Engine.md', kind: 'file' },
    { id: 'file-proj-4', name: 'Micro-SaaS-Billing-Engine.md', kind: 'file' },
  ],
  'cert-education': [
    { id: 'file-cert-aws', name: 'AWS-Solutions-Architect-Pro.md', kind: 'file' },
    { id: 'file-cert-cka', name: 'CKA-Kubernetes-Administrator.md', kind: 'file' },
    { id: 'file-cert-gcp', name: 'Google-Cloud-Professional-Data-Engineer.md', kind: 'file' },
    { id: 'file-edu-degree', name: 'BS-Computer-Science.md', kind: 'file' },
  ],
  'owners-data': [
    { id: 'file-about-me', name: 'About-Me.md', kind: 'file' },
    { id: 'file-contact', name: 'Contact.md', kind: 'file' },
  ],
};

const getDefaultPositions = (): Record<string, { x: number; y: number }> => {
  const rightX = typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 108) : 1330;
  return {
    projects: { x: rightX, y: 52 },
    'cert-education': { x: rightX, y: 164 },
    'owners-data': { x: rightX, y: 276 },
  };
};

export default function DesktopIcons({
  isAdmin = false,
  onOpenProjects,
  onOpenCertEducation,
  onOpenOwnersData,
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
}: DesktopIconsProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const defaults = getDefaultPositions();
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

  // Sync when screen resizes or initialPositions change
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('portos_desktop_icons');
        if (!stored) {
          setPositions(getDefaultPositions());
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Pointer drag state
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
    targetEl: HTMLElement | null;
  } | null>(null);
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return;
    setSelectedId(id);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const defaults = getDefaultPositions();
    const cur = positions[id] || defaults[id] || { x: 1200, y: 52 };
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: cur.x,
      origY: cur.y,
      hasMoved: false,
      targetEl: e.currentTarget,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragRef.current.hasMoved = true;
    }

    if (dragRef.current.hasMoved) {
      const rawX = dragRef.current.origX + dx;
      const rawY = dragRef.current.origY + dy;

      // 16px Grid snapping
      const snappedX = Math.round(rawX / 16) * 16;
      const snappedY = Math.round(rawY / 16) * 16;

      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const clampedX = Math.max(16, Math.min(snappedX, screenW - 100));
      const clampedY = Math.max(40, Math.min(snappedY, screenH - 140));

      if (dragRef.current.targetEl) {
        dragRef.current.targetEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { id, hasMoved, targetEl } = dragRef.current;
    dragRef.current = null;

    if (hasMoved) {
      lastDraggedAtRef.current = Date.now();
      if (targetEl) {
        const match = targetEl.style.transform.match(/translate3d\((\d+)px,\s*(\d+)px/);
        if (match) {
          const x = parseInt(match[1], 10);
          const y = parseInt(match[2], 10);
          setPositions((prev) => {
            const next = { ...prev, [id]: { x, y } };
            savePositionsToStorage(next);
            return next;
          });
        }
      }
    }
  };

  // Keyboard navigation for selected icon (Arrow keys nudge by 16px)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowRight') dx = 16;
    else if (e.key === 'ArrowLeft') dx = -16;
    else if (e.key === 'ArrowDown') dy = 16;
    else if (e.key === 'ArrowUp') dy = -16;
    else return;

    e.preventDefault();
    setPositions((prev) => {
      const defaults = getDefaultPositions();
      const cur = prev[id] || defaults[id] || { x: 1200, y: 52 };
      const nextX = Math.max(16, Math.min(cur.x + dx, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 100));
      const nextY = Math.max(40, Math.min(cur.y + dy, (typeof window !== 'undefined' ? window.innerHeight : 800) - 140));
      const updated = { ...prev, [id]: { x: nextX, y: nextY } };
      savePositionsToStorage(updated);
      return updated;
    });
  };

  const iconScale = iconSize === 'small' ? 0.85 : iconSize === 'large' ? 1.2 : 1.0;
  const iconGraphicSize = iconSize === 'small' ? 40 : iconSize === 'large' ? 56 : 48;

  const renderIconGraphic = (type: string, label?: string, selected?: boolean) => {
    const kind = getIconKindForApp(type);
    return <PortOSIcon kind={kind} size={iconGraphicSize} label={label} selected={selected} />;
  };

  const allIcons = [
    { id: 'projects', label: 'Projects', type: 'projects', onOpen: onOpenProjects },
    { id: 'cert-education', label: 'Certification & Education', type: 'cert-education', onOpen: onOpenCertEducation },
    { id: 'owners-data', label: "Owner's Data", type: 'owners-data', onOpen: onOpenOwnersData },
    ...extraIcons.map((extra) => ({
      id: extra.id,
      label: extra.label,
      type: extra.type,
      onOpen: () => onOpenExtraIcon?.(extra),
    })),
  ];

  return (
    <div
      className="desktop-icons-container"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 25,
      }}
    >
      {allIcons.map((icon) => {
        const defaults = getDefaultPositions();
        const pos = positions[icon.id] || defaults[icon.id] || { x: 1200, y: 52 };
        const isSelected = selectedId === icon.id;

        // Resolve files inside this folder for React Bits FolderFloat
        const rawFiles = folderItems?.[icon.id] || DEFAULT_FOLDER_ITEMS[icon.id] || [];
        const floatItems: FolderFloatItem[] = rawFiles.map((f: any) => ({
          label: f.name || f.label || 'Document.md',
          value: f.id || f.name,
          file: f,
          icon: <PortOSIcon kind={f.kind === 'folder' ? 'folder' : 'document'} size={13} />,
        }));

        const isRightHalf = typeof window !== 'undefined' ? pos.x > window.innerWidth / 2 : true;

        return (
          <div
            key={icon.id}
            id={`desktop-item-${icon.id}`}
            className={`desktop-icon-item movable-icon ${isSelected ? 'is-selected' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={icon.label}
            style={{
              position: 'absolute',
              transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
              width: `${Math.round(80 * iconScale)}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 4px',
              borderRadius: '8px',
              cursor: 'grab',
              userSelect: 'none',
              pointerEvents: 'auto',
              zIndex: isSelected ? 30 : 25,
              background: isSelected ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
              border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
              transition: dragRef.current?.id === icon.id ? 'none' : 'background 0.15s ease',
              touchAction: 'none',
            }}
            onPointerDown={(e) => handlePointerDown(e, icon.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastDraggedAtRef.current < 250) return;
              setSelectedId(icon.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastDraggedAtRef.current < 250) return;
              icon.onOpen();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                icon.onOpen();
              } else {
                handleKeyDown(e, icon.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedId(icon.id);
              onContextMenuIcon?.(e, icon.id, icon.label);
            }}
          >
            {/* React Bits FolderFloat Physics Animation Integration */}
            {floatItems.length > 0 ? (
              <FolderFloat
                items={floatItems}
                label={icon.label}
                sublabel={`${floatItems.length} files`}
                trigger="hover"
                physics={true}
                drift={0.6}
                align={isRightHalf ? 'left' : 'right'}
                spread={Math.min(140, Math.max(100, pos.x - 24))}
                lift={52}
                openDuration={480}
                bounce={0.28}
                width={iconGraphicSize}
                height={iconGraphicSize}
                onSelect={(val, idx, item) => {
                  if (item.file) {
                    if (item.file.kind === 'folder' && onOpenFolder) {
                      onOpenFolder(item.file);
                    } else if (onOpenFile) {
                      onOpenFile(item.file);
                    }
                  }
                }}
                onDoubleClickFolder={() => {
                  icon.onOpen();
                }}
                className="desktop-folder-float"
                customFolderGraphic={
                  <div className="desktop-icon-graphic">
                    {renderIconGraphic(icon.type, icon.label, isSelected)}
                  </div>
                }
              />
            ) : (
              <div className="desktop-icon-graphic">
                {renderIconGraphic(icon.type, icon.label, isSelected)}
              </div>
            )}

            <span
              className="desktop-icon-label"
              style={{
                fontSize: `${Math.round(11 * iconScale)}px`,
                fontWeight: 500,
                color: '#ffffff',
                textAlign: 'center',
                lineHeight: '1.25',
                textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                wordBreak: 'break-word',
                padding: '1px 6px',
                borderRadius: '4px',
                background: isSelected ? 'rgba(2, 84, 184, 0.95)' : 'rgba(10, 14, 23, 0.65)',
              }}
            >
              {icon.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
