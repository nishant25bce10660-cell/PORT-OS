'use client';

import React, { useRef, useState, useCallback } from 'react';
import { sound } from '@/lib/sound';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForApp } from '@/components/icons/iconRegistry';

export interface MinimizedWindowInfo {
  id: string;
  title: string;
  iconType?: string;
}

interface DockProps {
  onOpenApp: (appId: string) => void;
  onRestoreWindow: (windowId: string) => void;
  onSignOut: () => void;
  minimizedWindows: MinimizedWindowInfo[];
  activeWindowIds: string[];
  onContextMenu?: (e: React.MouseEvent, itemId?: string) => void;
}

interface DockItemDef {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export default function Dock({
  onOpenApp,
  onRestoreWindow,
  onSignOut,
  minimizedWindows,
  activeWindowIds,
  onContextMenu,
}: DockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [bouncingId, setBouncingId] = useState<string | null>(null);

  // Layered Apple-inspired app icons
  const baseItems: DockItemDef[] = [
    {
      id: 'finder',
      name: 'Finder',
      icon: <PortOSIcon kind="finder" size={38} />,
    },
    {
      id: 'projects',
      name: 'Projects',
      icon: <PortOSIcon kind="projects" size={38} />,
    },
    {
      id: 'certifications',
      name: 'Certifications & Education',
      icon: <PortOSIcon kind="cert-education" size={38} />,
    },
    {
      id: 'owner',
      name: "Owner's Data",
      icon: <PortOSIcon kind="owners-data" size={38} />,
    },
    {
      id: 'widgets',
      name: 'Widgets',
      icon: <PortOSIcon kind="widgets" size={38} />,
    },
    {
      id: 'settings',
      name: 'System Settings',
      icon: <PortOSIcon kind="settings" size={38} />,
    },
    {
      id: 'terminal',
      name: 'Terminal',
      icon: <PortOSIcon kind="terminal" size={38} />,
    },
  ];

  // D2: High-Performance GPU Magnification via live DOM styling (Zero React per-frame re-renders)
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dockRef.current) return;
    const buttons = dockRef.current.querySelectorAll<HTMLButtonElement>('.dock-item-btn');
    const mouseClientX = e.clientX;
    const influenceRadius = 78;

    buttons.forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(mouseClientX - itemCenterX);

      if (distance < influenceRadius) {
        // Cosine decay peaking at 1.55x (D2: 1.5 - 1.65x)
        const factor = (Math.cos((distance / influenceRadius) * Math.PI) + 1) / 2;
        const scale = 1 + factor * 0.55;
        const translateY = -(scale - 1) * 16;
        btn.style.transform = `scale(${scale}) translateY(${translateY}px) translateZ(0)`;
      } else {
        btn.style.transform = 'scale(1) translateY(0) translateZ(0)';
      }
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (!dockRef.current) return;
    const buttons = dockRef.current.querySelectorAll<HTMLButtonElement>('.dock-item-btn');
    buttons.forEach((btn) => {
      btn.style.transform = 'scale(1) translateY(0) translateZ(0)';
    });
  }, []);

  // D3: Open bounce with 3 decreasing hops (-18px, -10px, -4px)
  const handleClickItem = (id: string, isApp: boolean = true) => {
    sound.playClickSound();
    setBouncingId(id);
    setTimeout(() => setBouncingId(null), 850);
    if (isApp) {
      onOpenApp(id);
    } else {
      onRestoreWindow(id);
    }
  };

  return (
    <div className="dock-wrapper">
      {/* D1: Computed style: backdrop-filter: none; background: #10131A (96% opaque) */}
      <div
        className="dock-container"
        ref={dockRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        id="macos-dock"
      >
        {/* Core Apps */}
        {baseItems.map((item) => {
          const isOpen = activeWindowIds.includes(item.id) || activeWindowIds.includes(`folder-${item.id}`);
          const isBouncing = bouncingId === item.id;

          return (
            <button
              key={item.id}
              className={`dock-item-btn ${isBouncing ? 'dock-bouncing-hops' : ''}`}
              id={`dock-item-${item.id}`}
              onClick={() => handleClickItem(item.id, true)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu?.(e, item.id);
              }}
              style={{
                transformOrigin: 'bottom center',
              }}
            >
              <span className="dock-tooltip">{item.name}</span>
              <div className="dock-squircle">{item.icon}</div>
              {/* D4: Running dot indicator */}
              {isOpen && <div className="dock-dot" />}
            </button>
          );
        })}

        {/* Divider */}
        <div className="dock-divider" />

        {/* Minimized Windows (D4: Render on right of divider) */}
        {minimizedWindows.map((win) => {
          const isBouncing = bouncingId === win.id;

          return (
            <button
              key={win.id}
              className={`dock-item-btn ${isBouncing ? 'dock-bouncing-hops' : ''}`}
              id={`dock-minimized-${win.id}`}
              onClick={() => handleClickItem(win.id, false)}
              style={{
                transformOrigin: 'bottom center',
              }}
            >
              <span className="dock-tooltip">{win.title}</span>
              <div className="dock-squircle">
                <PortOSIcon kind={getIconKindForApp(win.id)} size={38} />
              </div>
              <div className="dock-dot" style={{ background: '#ffbd2e' }} />
            </button>
          );
        })}

        {/* D10: Native macOS Trash Can */}
        <button
          className={`dock-item-btn ${bouncingId === 'trash' ? 'dock-bouncing-hops' : ''}`}
          id="dock-item-trash"
          onClick={() => handleClickItem('trash', true)}
          style={{
            transformOrigin: 'bottom center',
          }}
        >
          <span className="dock-tooltip">Trash</span>
          <div className="dock-squircle">
            <PortOSIcon kind="trash" size={38} />
          </div>
        </button>

        {/* D10: Sleek neutral sign-out button (retaining id for test harness compatibility) */}
        <button
          className="dock-item-btn"
          id="dock-sign-out"
          onClick={() => {
            sound.playLogoutSound();
            onSignOut();
          }}
          style={{
            transformOrigin: 'bottom center',
          }}
        >
          <span className="dock-tooltip">Sign Out</span>
          <div
            className="dock-squircle"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                stroke="rgba(255, 255, 255, 0.75)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 17L21 12L16 7"
                stroke="rgba(255, 255, 255, 0.75)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 12H9"
                stroke="rgba(255, 255, 255, 0.75)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
