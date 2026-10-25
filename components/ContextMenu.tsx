'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  isDivider?: boolean;
  isHeading?: boolean;
  shortcut?: string;
  action?: () => void;
  danger?: boolean;
}

export interface ContextMenuOptions {
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
}

interface ContextMenuContextType {
  openContextMenu: (options: ContextMenuOptions) => void;
  closeContextMenu: () => void;
  isOpen: boolean;
}

const ContextMenuContext = createContext<ContextMenuContextType>({
  openContextMenu: () => {},
  closeContextMenu: () => {},
  isOpen: false,
});

export const useContextMenu = () => useContext(ContextMenuContext);

export interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  items: ContextMenuItem[];
  title?: string;
  onClose: () => void;
}

export function ContextMenuInternal({
  x,
  y,
  isOpen,
  items,
  title,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [mounted, setMounted] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ x: number; y: number; maxHeight?: number; ready: boolean }>({
    x,
    y,
    ready: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Precise geometry measurement and clamping with edge flipping
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) {
      setCoords({ x, y, ready: false });
      return;
    }
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const w = rect.width || 220;
    const h = rect.height || (items.length * 36 + (title ? 42 : 16));
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const margin = 8;

    // Horizontal placement: open at pointer; flip to left if overflowing right
    let posX: number;
    if (x + w <= screenW - margin) {
      posX = x;
    } else {
      posX = x - w;
    }
    posX = Math.max(margin, Math.min(screenW - w - margin, posX));

    // Vertical placement: open below pointer; flip upward if overflowing bottom
    const maxAvailableH = screenH - 2 * margin;
    let posY: number;
    if (y + h <= screenH - margin) {
      posY = y;
    } else {
      posY = y - h;
    }

    let maxHeight: number | undefined;
    if (h > maxAvailableH) {
      posY = margin;
      maxHeight = maxAvailableH;
    } else {
      posY = Math.max(margin, Math.min(screenH - h - margin, posY));
    }

    setCoords({
      x: posX,
      y: posY,
      maxHeight,
      ready: true,
    });
  }, [isOpen, x, y, items, title]);

  // Dismiss on outside click, window move/resize, scroll, blur, or Escape
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
      return;
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleWindowChange = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (
            next < items.length &&
            (items[next].isDivider || items[next].isHeading || items[next].disabled)
          ) {
            next++;
          }
          return next < items.length ? next : prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (
            next >= 0 &&
            (items[next].isDivider || items[next].isHeading || items[next].disabled)
          ) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          const item = items[focusedIndex];
          if (!item.disabled && !item.isDivider && !item.isHeading && item.action) {
            e.preventDefault();
            item.action();
            onClose();
          }
        }
      }
    };

    window.addEventListener('pointerdown', handleClickOutside, { capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, { capture: true });
    window.addEventListener('blur', handleWindowChange);

    return () => {
      window.removeEventListener('pointerdown', handleClickOutside, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, { capture: true });
      window.removeEventListener('blur', handleWindowChange);
    };
  }, [isOpen, items, focusedIndex, onClose]);

  if (!mounted || !isOpen || items.length === 0 || typeof document === 'undefined') {
    return null;
  }

  const portalTarget = document.getElementById('portal-root') || document.body;

  // Initial estimate before useLayoutEffect measurement to prevent any frame jitter
  const estW = 220;
  const estH = items.length * 36 + (title ? 42 : 16);
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const margin = 8;
  const initX = x + estW <= screenW - margin ? Math.max(margin, x) : Math.max(margin, x - estW);
  const initY = y + estH <= screenH - margin ? Math.max(margin, y) : Math.max(margin, y - estH);

  const finalX = coords.ready ? coords.x : initX;
  const finalY = coords.ready ? coords.y : initY;

  return createPortal(
    <div
      ref={menuRef}
      id="desktop-context-menu"
      className="context-menu context-menu-popover finder-context-menu"
      role="menu"
      aria-label={title || 'Context Menu'}
      style={{
        position: 'fixed',
        left: `${finalX}px`,
        top: `${finalY}px`,
        width: '220px',
        maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : undefined,
        overflowY: coords.maxHeight ? 'auto' : 'visible',
        background: 'rgba(24, 28, 38, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: '12px',
        padding: '6px',
        boxShadow:
          '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        userSelect: 'none',
        pointerEvents: 'auto',
        opacity: coords.ready ? 1 : 0.95,
        transform: 'scale(1)',
        transition: 'opacity 0.08s ease',
      }}
    >
      {title && (
        <div
          className="context-menu-header"
          style={{
            padding: '6px 10px 4px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-2, #38bdf8)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '4px',
          }}
        >
          {title}
        </div>
      )}

      {items.map((item, idx) => {
        if (item.isDivider) {
          return (
            <div
              key={`div-${idx}`}
              className="context-menu-divider"
              style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.08)',
                margin: '4px 6px',
              }}
            />
          );
        }

        if (item.isHeading) {
          return (
            <div
              key={`head-${idx}`}
              style={{
                padding: '4px 10px 2px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--tx-3, #9ca3af)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {item.label}
            </div>
          );
        }

        const isFocused = focusedIndex === idx;

        return (
          <div
            key={item.id}
            id={`context-menu-item-${item.id}`}
            role="menuitem"
            tabIndex={item.disabled ? -1 : 0}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${
              isFocused ? 'is-focused' : ''
            }`}
            onClick={() => {
              if (item.disabled) return;
              item.action?.();
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (item.disabled) return;
                e.preventDefault();
                item.action?.();
                onClose();
              }
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '13px',
              color: item.disabled
                ? 'rgba(255, 255, 255, 0.3)'
                : item.danger
                ? '#f87171'
                : '#f5f7fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              cursor: item.disabled ? 'default' : 'pointer',
              background: isFocused ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
              transition: 'background 0.1s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                setFocusedIndex(idx);
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isFocused) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden',
              }}
            >
              {item.icon && (
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
              )}
              <span
                style={{
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {item.label}
              </span>
            </div>
            {item.shortcut && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginLeft: 'auto',
                  flexShrink: 0,
                }}
              >
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>,
    portalTarget
  );
}

// Global Context Menu Provider that suppresses native menu except on real text inputs
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menuState, setMenuState] = useState<ContextMenuOptions & { isOpen: boolean }>({
    isOpen: false,
    x: 0,
    y: 0,
    title: undefined,
    items: [],
  });

  const openContextMenu = useCallback((options: ContextMenuOptions) => {
    setMenuState({
      isOpen: true,
      x: options.x,
      y: options.y,
      title: options.title,
      items: options.items,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Suppress browser native context menu everywhere except real text inputs/editable text
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isTextInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.getAttribute && target.getAttribute('contenteditable') === 'true') ||
        !!target.closest('input, textarea, [contenteditable="true"]');

      if (!isTextInput) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    };
  }, []);

  return (
    <ContextMenuContext.Provider
      value={{
        openContextMenu,
        closeContextMenu,
        isOpen: menuState.isOpen,
      }}
    >
      {children}
      <ContextMenuInternal
        x={menuState.x}
        y={menuState.y}
        isOpen={menuState.isOpen}
        items={menuState.items}
        title={menuState.title}
        onClose={closeContextMenu}
      />
    </ContextMenuContext.Provider>
  );
}

export default function ContextMenu(props: ContextMenuProps) {
  // Global contextmenu suppression listener if used standalone
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isTextInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.getAttribute && target.getAttribute('contenteditable') === 'true') ||
        !!target.closest('input, textarea, [contenteditable="true"]');

      if (!isTextInput) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    };
  }, []);

  return <ContextMenuInternal {...props} />;
}
