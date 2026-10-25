'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { sound } from '@/lib/sound';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForApp } from '@/components/icons/iconRegistry';
import WarmTooltip, { WarmTooltipGroup } from '@/components/WarmTooltip';

export interface MinimizedWindowInfo {
  id: string;
  title: string;
  iconType?: string;
}

export interface DockMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  separator?: boolean;
  checked?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

interface DockProps {
  onOpenApp: (appId: string) => void;
  onRestoreWindow: (windowId: string) => void;
  onSignOut: () => void;
  minimizedWindows: MinimizedWindowInfo[];
  activeWindowIds: string[];
}

interface ActiveMenuState {
  itemId: string;
  items: DockMenuItem[];
  anchorRect: { left: number; top: number; width: number; height: number };
}

// Generate SVG speech-bubble callout path with rounded corners and centered tail pointing to the dock item
function buildSpeechBubblePath(w: number, h: number, tailX: number, r: number = 10, tailW: number = 14, tailH: number = 7): string {
  const minX = r + tailW / 2 + 3;
  const maxX = w - r - tailW / 2 - 3;
  const clampedTip = Math.max(minX, Math.min(maxX, tailX));

  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${clampedTip + tailW / 2}`,
    `L ${clampedTip} ${h + tailH}`,
    `L ${clampedTip - tailW / 2} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

// React Bits DockMenu Right-Click Callout Bubble Component
function DockMenuCallout({
  state,
  onClose,
}: {
  state: ActiveMenuState;
  onClose: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);
  const [blinkingIdx, setBlinkingIdx] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const menuWidth = 208;
  const itemRowHeight = 27;
  const separatorHeight = 9;
  const paddingY = 10;

  // Compute exact menu height
  const menuContentHeight = useMemo(() => {
    let height = paddingY;
    state.items.forEach((item) => {
      height += item.separator ? separatorHeight : itemRowHeight;
    });
    return height;
  }, [state.items]);

  const tailHeight = 7;
  const totalSvgHeight = menuContentHeight + tailHeight;

  // Window-size auto-adjustment: Clamp menu to viewport bounds and calculate tail alignment
  const { menuLeft, menuTop, tailX } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { menuLeft: 100, menuTop: 100, tailX: menuWidth / 2 };
    }
    const itemCenter = state.anchorRect.left + state.anchorRect.width / 2;
    const rawLeft = itemCenter - menuWidth / 2;
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rawLeft));
    const rawTop = state.anchorRect.top - totalSvgHeight - 8;
    const clampedTop = Math.max(34, rawTop);
    const calculatedTailX = itemCenter - clampedLeft;
    return {
      menuLeft: clampedLeft,
      menuTop: clampedTop,
      tailX: calculatedTailX,
    };
  }, [state.anchorRect, menuWidth, totalSvgHeight]);

  const svgPath = useMemo(() => {
    return buildSpeechBubblePath(menuWidth, menuContentHeight, tailX, 10, 14, tailHeight);
  }, [menuWidth, menuContentHeight, tailX, tailHeight]);

  // Handle row click with Apple-inspired selection blink
  const handleItemClick = (item: DockMenuItem, index: number) => {
    if (item.disabled || item.separator) return;
    sound.playClickSound();
    setBlinkingIdx(index);
    setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        item.onClick?.();
        onClose();
      }, 90);
    }, 70);
  };

  // Close on outside click, window resize, or Escape
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsClosing(true);
        setTimeout(onClose, 90);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsClosing(true);
        setTimeout(onClose, 90);
      }
    };
    const handleWindowChange = () => {
      setIsClosing(true);
      setTimeout(onClose, 90);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [onClose]);

  // Compute highlight bar position
  const activeRow = hoveredIdx >= 0 ? rowRefs.current[hoveredIdx] : null;
  const highlightStyle = useMemo(() => {
    if (!activeRow) return { opacity: 0, transform: 'translateY(0)', height: `${itemRowHeight}px` };
    const top = activeRow.offsetTop;
    const height = activeRow.offsetHeight;
    return {
      opacity: 1,
      transform: `translateY(${top}px)`,
      height: `${height}px`,
    };
  }, [activeRow, itemRowHeight]);

  return createPortal(
    <div
      ref={menuRef}
      className={`dock-menu ${isClosing ? 'dock-menu-animated-out' : 'dock-menu-animated-in'}`}
      style={{
        left: `${menuLeft}px`,
        top: `${menuTop}px`,
        width: `${menuWidth}px`,
        height: `${totalSvgHeight}px`,
        transformOrigin: `${tailX}px ${totalSvgHeight}px`,
      }}
      role="menu"
      aria-label="Dock Context Menu"
    >
      {/* SVG Speech Bubble Callout Container */}
      <svg
        width={menuWidth}
        height={totalSvgHeight}
        viewBox={`0 0 ${menuWidth} ${totalSvgHeight}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <path
          d={svgPath}
          fill="rgba(20, 22, 30, 0.94)"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="1"
          style={{
            backdropFilter: 'blur(28px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
          }}
        />
      </svg>

      {/* Menu Rows and Sliding Highlight Bar */}
      <div
        className="dock-menu-list"
        style={{
          position: 'relative',
          width: `${menuWidth}px`,
          padding: '5px',
          boxSizing: 'border-box',
          zIndex: 2,
        }}
      >
        {/* Sliding Highlight Pill */}
        <div
          className={`dock-menu-highlight ${blinkingIdx !== null ? 'dock-menu-blinking' : ''}`}
          style={{
            ...highlightStyle,
            position: 'absolute',
            left: '5px',
            right: '5px',
            borderRadius: '6px',
            backgroundColor: '#0a84ff',
            pointerEvents: 'none',
            transition: 'transform 0.14s cubic-bezier(0.2, 0.9, 0.3, 1.2), height 0.14s ease, opacity 0.12s ease',
          }}
        />

        {state.items.map((item, idx) => {
          if (item.separator) {
            return (
              <div
                key={`sep-${idx}`}
                className="dock-menu-separator"
                style={{
                  height: '1px',
                  margin: '4px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                }}
              />
            );
          }

          const isHovered = hoveredIdx === idx;
          const isBlinking = blinkingIdx === idx;

          return (
            <button
              key={`row-${idx}`}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
              className="dock-menu-row"
              data-active={isHovered ? 'true' : undefined}
              aria-disabled={item.disabled}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(-1)}
              onClick={() => handleItemClick(item, idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: `${itemRowHeight}px`,
                padding: '0 10px',
                border: 0,
                background: isBlinking ? 'rgba(255, 255, 255, 0.9)' : 'none',
                color: isBlinking ? '#000000' : isHovered ? '#ffffff' : 'rgba(243, 244, 246, 0.92)',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '6px',
                cursor: item.disabled ? 'default' : 'pointer',
                textAlign: 'left',
                outline: 'none',
                userSelect: 'none',
              }}
            >
              {item.icon && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '8px',
                    opacity: isHovered ? 1 : 0.85,
                  }}
                >
                  {item.icon}
                </span>
              )}
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
              {item.shortcut && (
                <span
                  style={{
                    marginLeft: '12px',
                    fontSize: '11px',
                    color: isHovered ? 'rgba(255, 255, 255, 0.75)' : 'rgba(156, 163, 175, 0.75)',
                  }}
                >
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
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
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);
  const [fitRatio, setFitRatio] = useState<number>(1);

  // Cached geometry and rAF magnification engine (Zero forced layout on move)
  const cachedButtonsRef = useRef<HTMLButtonElement[]>([]);
  const cachedCentersRef = useRef<number[]>([]);
  const mouseXRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const updateCachedCenters = useCallback(() => {
    if (!dockRef.current) return;
    const buttons = Array.from(
      dockRef.current.querySelectorAll('.dock-item-btn') as NodeListOf<HTMLButtonElement>
    );
    cachedButtonsRef.current = buttons;
    cachedCentersRef.current = buttons.map((btn) => {
      const rect = btn.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
  }, []);

  // Auto-adjustable Window Size: Dynamic scaling ratio based on viewport width
  useEffect(() => {
    const updateFit = () => {
      const parentWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
      // 4 core apps + 2 utility + 1 divider + minimized + magnification spread allowance
      const itemCount = 6 + (minimizedWindows.length ? 1 + minimizedWindows.length : 0);
      const neededWidth = itemCount * 72 + 200;
      const available = parentWidth - 32;
      const ratio = Math.min(1, Math.max(0.55, available / neededWidth));
      setFitRatio(ratio);
      updateCachedCenters();
    };

    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, [minimizedWindows.length, updateCachedCenters]);

  // Core Apple-inspired app specifications with zero external emojis and proprietary PORT OS vectors
  const baseItems = useMemo(
    () => [
      {
        id: 'finder',
        name: 'Finder',
        icon: <PortOSIcon kind="finder" size={38} />,
        getMenu: (): DockMenuItem[] => [
          { label: 'Open Finder', onClick: () => handleClickItem('finder', true) },
          { label: 'New Finder Window', onClick: () => handleClickItem('finder', true) },
          { separator: true },
          { label: 'Show All Windows', onClick: () => onOpenApp('finder') },
        ],
      },
      {
        id: 'widgets',
        name: 'Widgets',
        icon: <PortOSIcon kind="widgets" size={38} />,
        getMenu: (): DockMenuItem[] => [
          { label: 'Open Widget Studio', onClick: () => handleClickItem('widgets', true) },
          { label: 'Widget Gallery', onClick: () => handleClickItem('widgets', true) },
          { separator: true },
          { label: 'Reset Widgets', onClick: () => handleClickItem('widgets', true) },
        ],
      },
      {
        id: 'settings',
        name: 'System Settings',
        icon: <PortOSIcon kind="settings" size={38} />,
        getMenu: (): DockMenuItem[] => [
          { label: 'Open System Settings', onClick: () => handleClickItem('settings', true) },
          { label: 'Customization & Effects', onClick: () => handleClickItem('settings', true) },
          { label: 'Wallpaper Settings', onClick: () => handleClickItem('settings', true) },
        ],
      },
      {
        id: 'terminal',
        name: 'Terminal',
        icon: <PortOSIcon kind="terminal" size={38} />,
        getMenu: (): DockMenuItem[] => [
          { label: 'Open Terminal', onClick: () => handleClickItem('terminal', true) },
          { label: 'New Terminal Window', onClick: () => handleClickItem('terminal', true) },
          { separator: true },
          { label: 'Clear History', onClick: () => handleClickItem('terminal', true) },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // React Bits Magnification Engine: Cached Centers + Single rAF Loop (Zero Forced Layout)
  const handlePointerEnter = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-dock-hovered', 'true');
    }
    if (dockRef.current) {
      dockRef.current.setAttribute('data-dock-active', 'true');
    }
    updateCachedCenters();

    if (!rafIdRef.current) {
      const loop = () => {
        const mouseX = mouseXRef.current;
        const buttons = cachedButtonsRef.current;
        const centers = cachedCentersRef.current;
        const influenceRadius = 78 * fitRatio;

        if (mouseX !== null && buttons.length > 0 && buttons.length === centers.length) {
          for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (!btn) continue;
            const distance = Math.abs(mouseX - centers[i]);

            if (distance < influenceRadius) {
              const factor = (Math.cos((distance / influenceRadius) * Math.PI) + 1) / 2;
              const scale = 1 + factor * 0.55;
              const translateY = -(scale - 1) * 16 * fitRatio;
              const newTransform = `scale(${scale.toFixed(3)}) translateY(${translateY.toFixed(1)}px) translateZ(0)`;
              if (btn.style.transform !== newTransform) {
                btn.style.transform = newTransform;
              }
            } else if (btn.style.transform !== '') {
              btn.style.transform = '';
            }
          }
        }
        rafIdRef.current = requestAnimationFrame(loop);
      };
      rafIdRef.current = requestAnimationFrame(loop);
    }
  }, [fitRatio, updateCachedCenters]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    mouseXRef.current = e.clientX;
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.removeAttribute('data-dock-hovered');
    }
    if (dockRef.current) {
      dockRef.current.removeAttribute('data-dock-active');
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    mouseXRef.current = null;
    const buttons = cachedButtonsRef.current;
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (btn && btn.style.transform !== '') {
        btn.style.transform = '';
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-dock-hovered');
      }
    };
  }, []);

  // Open bounce with 3 decreasing hops (-18px, -10px, -4px)
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

  // Open the React Bits Speech-Bubble Callout Menu
  const handleOpenItemMenu = (
    e: React.MouseEvent,
    itemId: string,
    items: DockMenuItem[]
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    setActiveMenu({
      itemId,
      items,
      anchorRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  return (
    <div className="dock-wrapper">
      {/* D1: Computed style: backdrop-filter: none; background: #10131A (96% opaque) */}
      <div
        className="dock dock-container"
        ref={dockRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        id="macos-dock"
        style={{
          transformOrigin: 'bottom center',
          ['--dock-scale' as any]: `${fitRatio.toFixed(3)}`,
        }}
      >
        {/* Core Apps & Tools wrapped in WarmTooltipGroup */}
        <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
          {baseItems.map((item) => {
            const isOpen =
              activeWindowIds.includes(item.id) ||
              activeWindowIds.includes(`folder-${item.id}`) ||
              (item.id === 'finder' && activeWindowIds.some((id) => id.startsWith('folder-') || id === 'finder'));
            const isBouncing = bouncingId === item.id;

            return (
              <div
                key={item.id}
                className={`dock-bounce-wrapper ${isBouncing ? 'dock-bouncing-hops is-bouncing' : ''}`}
              >
                <WarmTooltip content={item.name} side="top">
                  <button
                    className={`dock-item-btn ${isBouncing ? 'dock-bouncing-hops is-bouncing' : ''}`}
                    id={`dock-item-${item.id}`}
                    onClick={() => handleClickItem(item.id, true)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenItemMenu(e, item.id, item.getMenu());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenItemMenu(e as any, item.id, item.getMenu());
                      }
                    }}
                    style={{
                      transformOrigin: 'bottom center',
                    }}
                    aria-label={item.name}
                  >
                    <div className="dock-squircle">{item.icon}</div>
                    {/* D4: Running dot indicator */}
                    {isOpen && <div className="dock-dot" />}
                  </button>
                </WarmTooltip>
              </div>
            );
          })}

          {/* Divider */}
          <div className="dock-divider" />

          {/* Minimized Windows (D4: Render on right of divider) */}
          {minimizedWindows.map((win) => {
            const isBouncing = bouncingId === win.id;

            return (
              <div
                key={win.id}
                className={`dock-bounce-wrapper ${isBouncing ? 'dock-bouncing-hops is-bouncing' : ''}`}
              >
                <WarmTooltip content={win.title} side="top">
                  <button
                    className={`dock-item-btn ${isBouncing ? 'dock-bouncing-hops is-bouncing' : ''}`}
                    id={`dock-minimized-${win.id}`}
                    onClick={() => handleClickItem(win.id, false)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenItemMenu(e, win.id, [
                        { label: 'Restore Window', onClick: () => handleClickItem(win.id, false) },
                        { separator: true },
                        { label: 'Close Window', onClick: () => onRestoreWindow(win.id) },
                      ]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenItemMenu(e as any, win.id, [
                          { label: 'Restore Window', onClick: () => handleClickItem(win.id, false) },
                          { separator: true },
                          { label: 'Close Window', onClick: () => onRestoreWindow(win.id) },
                        ]);
                      }
                    }}
                    style={{
                      transformOrigin: 'bottom center',
                    }}
                    aria-label={win.title}
                  >
                    <div className="dock-squircle">
                      <PortOSIcon kind={getIconKindForApp(win.id)} size={38} />
                    </div>
                    <div className="dock-dot" style={{ background: '#ffbd2e' }} />
                  </button>
                </WarmTooltip>
              </div>
            );
          })}

          {/* D10: Native macOS Trash Can */}
          <div
            className={`dock-bounce-wrapper ${bouncingId === 'trash' ? 'dock-bouncing-hops is-bouncing' : ''}`}
          >
            <WarmTooltip content="Trash" side="top">
              <button
                className={`dock-item-btn ${bouncingId === 'trash' ? 'dock-bouncing-hops is-bouncing' : ''}`}
                id="dock-item-trash"
                onClick={() => handleClickItem('trash', true)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenItemMenu(e, 'trash', [
                    { label: 'Open Trash', onClick: () => handleClickItem('trash', true) },
                    { separator: true },
                    {
                      label: 'Empty Trash...',
                      onClick: () => {
                        sound.playTrashEmptySound?.();
                        onOpenApp('trash');
                      },
                    },
                  ]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenItemMenu(e as any, 'trash', [
                      { label: 'Open Trash', onClick: () => handleClickItem('trash', true) },
                      { separator: true },
                      {
                        label: 'Empty Trash...',
                        onClick: () => {
                          sound.playTrashEmptySound?.();
                          onOpenApp('trash');
                        },
                      },
                    ]);
                  }
                }}
                style={{
                  transformOrigin: 'bottom center',
                }}
                aria-label="Trash"
              >
                <div className="dock-squircle">
                  <PortOSIcon kind="trash" size={38} />
                </div>
              </button>
            </WarmTooltip>
          </div>

          {/* D10: Sleek neutral sign-out button (retaining id for test harness compatibility) */}
          <div className="dock-bounce-wrapper">
            <WarmTooltip content="Sign Out" side="top">
              <button
                className="dock-item-btn"
                id="dock-sign-out"
                onClick={() => {
                  sound.playLogoutSound();
                  onSignOut();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenItemMenu(e, 'sign-out', [
                    { label: 'Lock Screen', onClick: () => onSignOut() },
                    { label: 'Log Out', onClick: () => onSignOut() },
                  ]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenItemMenu(e as any, 'sign-out', [
                      { label: 'Lock Screen', onClick: () => onSignOut() },
                      { label: 'Log Out', onClick: () => onSignOut() },
                    ]);
                  }
                }}
                style={{
                  transformOrigin: 'bottom center',
                }}
                aria-label="Sign Out"
              >
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
            </WarmTooltip>
          </div>
        </WarmTooltipGroup>
      </div>

      {/* React Bits Dock Right-Click Speech Bubble Callout */}
      {activeMenu && (
        <DockMenuCallout
          state={activeMenu}
          onClose={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
}