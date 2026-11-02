'use client';

import React, { useState, useEffect, useRef } from 'react';
import GeometricLogo from './GeometricLogo';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';
import BorderGlow from './BorderGlow';

interface MenuBarProps {
  user: {
    role: 'viewer' | 'admin';
    name?: string;
    email?: string;
    username?: string;
  } | null;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  onNewFolderClick?: () => void;
  onSignOut?: () => void;
  onSleep?: () => void;
  onRestart?: () => void;
  onShutdown?: () => void;
  onAboutClick?: () => void;
  onSettingsClick?: () => void;
  onSpotlightClick?: () => void;
  onFinderClick?: () => void;
  onTerminalClick?: () => void;
  onHelpClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
  onFinderClick,
  onTerminalClick,
  onHelpClick,
  onContextMenu,
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

  return (
    <BorderGlow
      className="nav-bar-border-glow"
      borderRadius={0}
      edgeSensitivity={30}
      glowRadius={32}
      glowIntensity={1.0}
      coneSpread={25}
      backgroundColor="var(--menu-bar-bg, rgba(20, 24, 33, 0.94))"
      colors={['#c084fc', '#f472b6', '#38bdf8']}
      style={{
        width: '100%',
        height: '28px',
        position: 'relative',
        zIndex: 99999,
        border: 'none',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: 'none',
        overflow: 'visible',
      }}
    >
      <header
        className="menu-bar"
        ref={menuBarRef}
        id="portfolio-menubar"
        data-testid="macos-menu-bar"
        onContextMenu={(e) => {
          if (onContextMenu) {
            e.preventDefault();
            onContextMenu(e);
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          boxShadow: 'none',
        }}
      >
        <div className="menu-bar-left">
          <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
            {/* M1: Geometric "N" logo mark with BorderGlow */}
            <WarmTooltip content="PORT OS System Menu" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-system"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.2}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.05)"
                colors={['#38bdf8', '#818cf8', '#c084fc']}
                style={{
                  padding: '2px 6px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
              >
                <div
                  className="menu-apple-logo-wrap"
                  id="menu-btn-n-logo"
                  onClick={() => setActiveMenu(activeMenu === 'system' ? null : 'system')}
                  aria-label="PORT OS System Menu"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <GeometricLogo size={16} hasSpecularSweep={false} />
                </div>
              </BorderGlow>
            </WarmTooltip>

            {/* Clean macOS Menu Items with Logos: Finder, Terminal, Settings and Help */}
            <WarmTooltip content="Open Finder File Browser" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-finder"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.1}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.04)"
                colors={['#38bdf8', '#60a5fa', '#a78bfa']}
                style={{
                  padding: '2px 8px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
                onClick={() => {
                  setActiveMenu(null);
                  onFinderClick?.();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px' }}>📁</span>
                  <span
                    className="menu-item menu-app-name"
                    id="menu-item-top-finder"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                  >
                    Finder
                  </span>
                </div>
              </BorderGlow>
            </WarmTooltip>

            <WarmTooltip content="Open Terminal Shell" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-terminal"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.1}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.04)"
                colors={['#34d399', '#38bdf8', '#818cf8']}
                style={{
                  padding: '2px 8px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
                onClick={() => {
                  setActiveMenu(null);
                  onTerminalClick?.();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px' }}>💻</span>
                  <span
                    className="menu-item"
                    id="menu-item-top-terminal"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer', fontSize: '12px' }}
                  >
                    Terminal
                  </span>
                </div>
              </BorderGlow>
            </WarmTooltip>

            <WarmTooltip content="System Settings" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-settings"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.1}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.04)"
                colors={['#f472b6', '#c084fc', '#38bdf8']}
                style={{
                  padding: '2px 8px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
                onClick={() => {
                  setActiveMenu(null);
                  onSettingsClick?.();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px' }}>⚙️</span>
                  <span
                    className="menu-item"
                    id="menu-item-top-settings"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer', fontSize: '12px' }}
                  >
                    Settings
                  </span>
                </div>
              </BorderGlow>
            </WarmTooltip>

            <WarmTooltip content="About & Help" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-help"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.1}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.04)"
                colors={['#fbbf24', '#f472b6', '#38bdf8']}
                style={{
                  padding: '2px 8px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
                onClick={() => {
                  setActiveMenu(null);
                  onHelpClick?.();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px' }}>❓</span>
                  <span
                    className="menu-item"
                    id="menu-item-top-help"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer', fontSize: '12px' }}
                  >
                    Help
                  </span>
                </div>
              </BorderGlow>
            </WarmTooltip>
          </WarmTooltipGroup>
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
            <button
              type="button"
              className="menu-dropdown-item"
              id="menu-item-terminal"
              onClick={() => {
                setActiveMenu(null);
                onTerminalClick?.();
              }}
            >
              Terminal (portsh)...
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

        {/* Menu Bar Right Controls with BorderGlow */}
        <div className="menu-bar-right">
          <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
            {/* Spotlight Search Logo / Button */}
            <WarmTooltip content="Spotlight Search" shortcut="⌘K" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-spotlight"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.2}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.04)"
                colors={['#38bdf8', '#818cf8', '#c084fc']}
                style={{
                  padding: '2px 6px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
                onClick={onSpotlightClick}
              >
                <button
                  type="button"
                  id="menu-btn-spotlight"
                  aria-label="Spotlight Search"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tx-2)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
              </BorderGlow>
            </WarmTooltip>

            {/* User Profile Logo / Badge */}
            <BorderGlow
              className="nav-logo-glow nav-logo-user"
              borderRadius={6}
              glowRadius={16}
              edgeSensitivity={35}
              glowIntensity={1.1}
              coneSpread={28}
              backgroundColor="rgba(255, 255, 255, 0.04)"
              colors={user?.role === 'admin' ? ['#f43f5e', '#fb923c', '#eab308'] : ['#38bdf8', '#818cf8', '#c084fc']}
              style={{
                padding: '2px 8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: 'none',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--tx-2)', fontWeight: 500 }}>
                {user?.role === 'admin'
                  ? `🛡️ ${user.username || 'Admin'}`
                  : user?.name
                  ? `👤 ${user.name}`
                  : 'Guest'}
              </span>
            </BorderGlow>

            {/* Date & Time Clock Logo / Badge */}
            <WarmTooltip content="Date & Time" side="bottom">
              <BorderGlow
                className="nav-logo-glow nav-logo-clock"
                borderRadius={6}
                glowRadius={16}
                edgeSensitivity={35}
                glowIntensity={1.0}
                coneSpread={28}
                backgroundColor="rgba(255, 255, 255, 0.04)"
                colors={['#38bdf8', '#818cf8', '#c084fc']}
                style={{
                  padding: '2px 8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none',
                }}
              >
                <span style={{ fontSize: '12px', letterSpacing: '0.02em', minWidth: '120px', textAlign: 'right', fontWeight: 500, cursor: 'default' }}>
                  {timeString || 'Loading...'}
                </span>
              </BorderGlow>
            </WarmTooltip>
          </WarmTooltipGroup>
        </div>
      </header>
    </BorderGlow>
  );
}
