'use client';

import React from 'react';
import { Item, FileItem } from '@/lib/types';

interface QuickLookModalProps {
  item: Item | null;
  onClose: () => void;
  onSetWallpaper?: (item: FileItem) => void;
}

export default function QuickLookModal({ item, onClose, onSetWallpaper }: QuickLookModalProps) {
  if (!item) return null;

  const isFile = item.kind === 'file';
  const file = isFile ? (item as FileItem) : null;
  const isImage = file?.name.match(/\.(png|jpe?g|webp|svg|gif)$/i) || file?.content?.startsWith('data:image');

  return (
    <div
      id="quick-look-modal"
      className="quick-look-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="quick-look-window"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          background: 'rgba(24, 27, 36, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'quickLookIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Title Bar */}
        <div
          style={{
            height: '38px',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              id="btn-close-quick-look"
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#ff5f56',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
              }}
              title="Close (Esc or Space)"
            />
            <span
              className="quick-look-title"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {item.name}
            </span>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Quick Look (Press Space or Esc to exit)
          </span>
        </div>

        {/* Content Preview */}
        <div
          style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isImage ? 'center' : 'stretch',
            justifyContent: isImage ? 'center' : 'flex-start',
            minHeight: '260px',
          }}
        >
          {isImage ? (
            <div style={{ textAlign: 'center', maxWidth: '100%' }}>
              {file?.content?.startsWith('data:image') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.content}
                  alt={item.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '360px',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '320px',
                    height: '200px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="4" fill="#38bdf8" fillOpacity="0.2" />
                    <circle cx="8.5" cy="8.5" r="1.5" fill="#38bdf8" />
                    <polyline points="21 15 16 10 5 21" stroke="#38bdf8" strokeWidth="2" />
                  </svg>
                </div>
              )}
            </div>
          ) : isFile ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {file?.content || 'Empty file'}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
                <path
                  d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z"
                  fill="#0284c7"
                />
                <path
                  d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z"
                  fill="#38bdf8"
                />
              </svg>
              <h4 style={{ color: '#fff', fontSize: '15px', marginTop: '12px' }}>{item.name}</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Folder containing {(item as any).children?.length || 0} items
              </p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            {isFile ? `${file?.content?.length || 0} characters` : 'Folder'}
          </span>

          {isFile && onSetWallpaper && (
            <button
              type="button"
              className="btn-set-wallpaper"
              id="btn-set-as-desktop-picture"
              onClick={() => onSetWallpaper(file)}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#fff',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Set as Desktop Picture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
