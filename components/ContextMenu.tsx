'use client';

import React, { useEffect, useRef, useState } from 'react';
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
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  items: ContextMenuItem[];
  title?: string;
  onClose: () => void;
}

export default function ContextMenu({ x, y, isOpen, items, title, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close when clicking outside or pressing Escape, resize or scroll, handle arrow navigation
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
      return;
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleWindowResizeOrScroll = () => {
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
          while (next < items.length && (items[next].isDivider || items[next].isHeading || items[next].disabled)) {
            next++;
          }
          return next < items.length ? next : prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && (items[next].isDivider || items[next].isHeading || items[next].disabled)) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
      } else if (e.key === 'Enter') {
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

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowResizeOrScroll);
    window.addEventListener('scroll', handleWindowResizeOrScroll, true);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowResizeOrScroll);
      window.removeEventListener('scroll', handleWindowResizeOrScroll, true);
    };
  }, [isOpen, items, focusedIndex, onClose]);

  if (!mounted || !isOpen || items.length === 0 || typeof document === 'undefined') return null;

  // Viewport clamping calculations with edge flipping
  const menuWidth = 220;
  const itemHeight = 32;
  const menuHeight = items.length * itemHeight + (title ? 36 : 12);
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

  // If menu overflows right edge, flip to left of pointer; otherwise place directly at pointer
  const posX = x + menuWidth <= screenW - 8 ? Math.max(8, x) : Math.max(8, x - menuWidth);
  // If menu overflows bottom edge, flip above pointer; otherwise place directly at pointer
  const posY = y + menuHeight <= screenH - 8 ? Math.max(32, y) : Math.max(32, y - menuHeight);

  return createPortal(
    <div
      ref={menuRef}
      id="desktop-context-menu"
      className="context-menu context-menu-popover"
      role="menu"
      aria-label={title || 'Context Menu'}
      style={{
        position: 'fixed',
        left: `${posX}px`,
        top: `${posY}px`,
        width: `${menuWidth}px`,
        background: 'rgba(24, 28, 38, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: '12px',
        padding: '6px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(28px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        userSelect: 'none',
        animation: 'spotlightPop 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
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
            className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${isFocused ? 'is-focused' : ''}`}
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
              color: item.disabled ? 'rgba(255, 255, 255, 0.3)' : '#f5f7fa',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
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
              <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.label}</span>
            </div>
            {item.shortcut && (
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto', flexShrink: 0 }}>
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
