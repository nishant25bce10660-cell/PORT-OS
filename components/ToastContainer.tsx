'use client';

import React, { useEffect, useState } from 'react';
import { toastManager, ToastMessage } from '@/lib/toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((list) => {
      setToasts(list);
    });
    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      id="portos-toast-container"
      style={{
        position: 'fixed',
        top: '36px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: '360px',
        width: 'calc(100vw - 32px)',
      }}
    >
      {toasts.map((toast) => {
        const accentColor =
          toast.type === 'success'
            ? '#30D158'
            : toast.type === 'error'
            ? '#FF5A52'
            : toast.type === 'warning'
            ? '#FFB340'
            : '#7C6CFF';

        const iconGlyph =
          toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ';

        return (
          <div
            key={toast.id}
            className="portos-toast-item"
            data-type={toast.type}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(18, 21, 28, 0.94)',
              border: `1px solid rgba(255, 255, 255, 0.12)`,
              borderLeft: `4px solid ${accentColor}`,
              borderRadius: '10px',
              padding: '10px 14px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              backdropFilter: 'blur(16px)',
              animation: 'toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: `${accentColor}25`,
                color: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              {iconGlyph}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="toast-title"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#f5f7fa',
                  lineHeight: '18px',
                }}
              >
                {toast.title}
              </div>
              <div
                className="toast-message"
                style={{
                  fontSize: '12px',
                  color: '#a9b1bf',
                  lineHeight: '16px',
                  marginTop: '2px',
                  wordBreak: 'break-word',
                }}
              >
                {toast.message}
              </div>
            </div>

            <button
              onClick={() => toastManager.remove(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#7d8696',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 4px',
                borderRadius: '4px',
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
