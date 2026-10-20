'use client';

import React, { useRef, useState, useCallback } from 'react';
import { sound } from '@/lib/sound';

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
}: DockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [bouncingId, setBouncingId] = useState<string | null>(null);

  // Original geometric icons (Zero copyrighted Apple assets)
  const baseItems: DockItemDef[] = [
    {
      id: 'finder',
      name: 'Finder',
      icon: (
        // Geometric Dual-Tone File Organizer (No smiley face)
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#1e293b" />
          <path d="M4 8C4 6.89543 4.89543 6 6 6H10L12 8H18C19.1046 8 20 8.89543 20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V8Z" fill="#38bdf8" />
          <path d="M4 11H20V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V11Z" fill="#0284c7" />
          <path d="M8 14H16" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'projects',
      name: 'Projects',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#2563eb" />
          <path d="M8 9L5 12L8 15M16 9L19 12L16 15M13 7L11 17" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'certifications',
      name: 'Certifications & Education',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#7c3aed" />
          <path d="M12 6L4 10L12 14L20 10L12 6Z" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 11.5V16C7 17.5 9.23858 18.5 12 18.5C14.7614 18.5 17 17.5 17 16V11.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'owner',
      name: "Owner's Data",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#059669" />
          <circle cx="12" cy="10" r="3.2" stroke="#ffffff" strokeWidth="1.6" />
          <path d="M6.5 18C6.5 15.5 8.8 14 12 14C15.2 14 17.5 15.5 17.5 18" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'widgets',
      name: 'Widgets',
      icon: (
        // D10: macOS Widget Grid glyph (replacing orange clock icon)
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#6366f1" />
          <rect x="5" y="5" width="6" height="6" rx="2" fill="#ffffff" fillOpacity="0.9" />
          <rect x="13" y="5" width="6" height="6" rx="2" fill="#ffffff" fillOpacity="0.55" />
          <rect x="5" y="13" width="6" height="6" rx="2" fill="#ffffff" fillOpacity="0.55" />
          <rect x="13" y="13" width="6" height="6" rx="2" fill="#ffffff" fillOpacity="0.9" />
        </svg>
      ),
    },
    {
      id: 'settings',
      name: 'System Settings',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#475569" />
          <circle cx="12" cy="12" r="3" stroke="#ffffff" strokeWidth="1.6" />
          <path d="M12 4V6M12 18V20M4 12H6M18 12H20M6.34 6.34L7.75 7.75M16.24 16.24L17.66 17.66M6.34 17.66L7.75 16.24M16.24 7.75L17.66 6.34" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'terminal',
      name: 'Terminal',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#0f172a" />
          <path d="M6 8L10 12L6 16" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="16" x2="18" y2="16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                  <path d="M7 8H17" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M7 12H13" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
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
          <div
            className="dock-squircle"
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
