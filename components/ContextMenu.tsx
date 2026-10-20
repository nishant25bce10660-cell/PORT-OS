'use client';

import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  isDivider?: boolean;
  action?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, isOpen, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate clamped coordinates
  const menuWidth = 200;
  const menuHeight = items.length * 30 + 16;
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

  const posX = Math.min(x, screenW - menuWidth - 10);
  const posY = Math.min(y, screenH - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      id="desktop-context-menu"
      className="context-menu-popover"
      style={{
        position: 'fixed',
        left: `${posX}px`,
        top: `${posY}px`,
        width: `${menuWidth}px`,
        background: 'rgba(24, 28, 37, 0.96)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '10px',
        padding: '6px',
        boxShadow: '0 18px 45px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(24px)',
        zIndex: 8500,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        userSelect: 'none',
      }}
    >
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

        return (
          <div
            key={item.id}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (item.disabled) return;
              item.action?.();
              onClose();
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              color: item.disabled ? '#4b5563' : '#f5f7fa',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: item.disabled ? 'default' : 'pointer',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background = 'rgba(124, 108, 255, 0.25)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {item.icon && <span style={{ width: '16px', fontSize: '13px' }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
