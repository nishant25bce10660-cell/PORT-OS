'use client';

import React, { useState, useEffect, useRef } from 'react';
import GeometricLogo from './GeometricLogo';

interface MenuBarProps {
  user: {
    role: 'viewer' | 'admin';
    name?: string;
    email?: string;
    username?: string;
  } | null;
  editMode: boolean;
  onToggleEditMode: () => void;
  onNewFolderClick?: () => void;
  onSignOut?: () => void;
  onSleep?: () => void;
  onRestart?: () => void;
  onShutdown?: () => void;
  onAboutClick?: () => void;
  onSettingsClick?: () => void;
  onSpotlightClick?: () => void;
  onControlCenterClick?: () => void;
}

export default function MenuBar({
  user,
  editMode,
  onToggleEditMode,
  onNewFolderClick,
  onSignOut,
  onSleep,
  onRestart,
  onShutdown,
  onAboutClick,
  onSettingsClick,
  onSpotlightClick,
  onControlCenterClick,
}: MenuBarProps) {
  const [timeString, setTimeString] = useState<string>('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      setTimeString(now.toLocaleString('en-US', options).replace(/,/g, ''));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const menuItems = ['Finder', 'File', 'Edit', 'View', 'Go', 'Window', 'Help'];

  return (
    <header className="menu-bar" ref={menuBarRef} id="macos-menu-bar">
      <div className="menu-bar-left">
        {/* M1: Geometric "N" logo mark */}
        <div
          className="menu-apple-logo-wrap"
          id="menu-btn-n-logo"
          onClick={() => setActiveMenu(activeMenu === 'system' ? null : 'system')}
          title="PORT OS System Menu"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px' }}
        >
          <GeometricLogo size={16} hasSpecularSweep={false} />
        </div>

        {/* Standard macOS Menu Items */}
        {menuItems.map((item) => (
          <span
            key={item}
            className={`menu-item ${item === 'Finder' ? 'menu-app-name' : ''}`}
            onClick={() => setActiveMenu(activeMenu === item ? null : item)}
          >
            {item}
          </span>
        ))}
      </div>

      {/* System "N" Dropdown Menu */}
      {activeMenu === 'system' && (
        <div
          className="menu-dropdown"
          id="menu-system-dropdown"
          style={{
            position: 'absolute',
            top: '28px',
            left: '8px',
            background: 'rgba(24, 28, 37, 0.96)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            boxShadow: '0 18px 45px rgba(0,0,0,0.65)',
            padding: '4px',
            minWidth: '220px',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-about"
            onClick={() => {
              setActiveMenu(null);
              onAboutClick?.();
            }}
          >
            About PORT OS
          </button>
          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-settings"
            onClick={() => {
              setActiveMenu(null);
              onSettingsClick?.();
            }}
          >
            System Settings...
          </button>

          <div className="menu-dropdown-divider" />

          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-sleep"
            onClick={() => {
              setActiveMenu(null);
              onSleep?.();
            }}
          >
            Sleep
          </button>
          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-restart"
            onClick={() => {
              setActiveMenu(null);
              onRestart?.();
            }}
          >
            Restart...
          </button>
          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-shutdown"
            onClick={() => {
              setActiveMenu(null);
              onShutdown?.();
            }}
          >
            Shut Down...
          </button>

          <div className="menu-dropdown-divider" />

          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-lock"
            onClick={() => {
              setActiveMenu(null);
              onSignOut?.();
            }}
          >
            Lock Screen
          </button>
          <button
            type="button"
            className="menu-dropdown-item"
            id="menu-item-logout"
            onClick={() => {
              setActiveMenu(null);
              onSignOut?.();
            }}
          >
            Log Out {user?.name || user?.username || ''}...
          </button>
        </div>
      )}

      {/* Menu Bar Right Controls */}
      <div className="menu-bar-right">
        {user?.role === 'admin' && (
          <button
            type="button"
            className={`menu-pill ${editMode ? 'menu-pill-edit-on' : 'menu-pill-edit-off'}`}
            onClick={onToggleEditMode}
            id="toggle-edit-mode-pill"
          >
            {editMode ? '● Edit Mode ON' : '○ Edit Mode'}
          </button>
        )}

        {/* Spotlight Search Button */}
        <button
          type="button"
          id="menu-btn-spotlight"
          onClick={onSpotlightClick}
          title="Spotlight Search (Ctrl+K / ⌘K)"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--tx-2)',
            cursor: 'pointer',
            padding: '2px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--tx-2)';
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* Control Center Button */}
        <button
          type="button"
          id="menu-btn-control-center"
          onClick={onControlCenterClick}
          title="Control Center"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--tx-2)',
            cursor: 'pointer',
            padding: '2px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--tx-2)';
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="6" rx="3" />
            <circle cx="8" cy="7" r="1.5" fill="currentColor" />
            <rect x="3" y="14" width="18" height="6" rx="3" />
            <circle cx="16" cy="17" r="1.5" fill="currentColor" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--tx-2)', fontWeight: 500 }}>
            {user?.role === 'admin'
              ? `🛡️ ${user.username || 'Admin'}`
              : user?.name
              ? `👤 ${user.name}`
              : 'Guest'}
          </span>
        </div>

        <span style={{ fontSize: '12px', letterSpacing: '0.02em', minWidth: '130px', textAlign: 'right', fontWeight: 500 }}>
          {timeString || 'Loading...'}
        </span>
      </div>
    </header>
  );
}
