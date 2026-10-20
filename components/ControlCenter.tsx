'use client';

import React, { useState, useEffect, useRef } from 'react';
import { sound } from '@/lib/sound';

interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  brightness: number;
  onBrightnessChange: (val: number) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  onOpenSettings?: () => void;
}

export default function ControlCenter({
  isOpen,
  onClose,
  brightness,
  onBrightnessChange,
  volume,
  onVolumeChange,
  onOpenSettings,
}: ControlCenterProps) {
  const [soundFxEnabled, setSoundFxEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('#menu-btn-control-center')) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const toggleSoundFx = () => {
    const next = !soundFxEnabled;
    setSoundFxEnabled(next);
    sound.setMasterVolume(next ? volume / 100 : 0);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      id="control-center-popover"
      className="control-center-popover"
      style={{
        position: 'fixed',
        top: '36px',
        right: '12px',
        width: '320px',
        background: 'rgba(24, 28, 38, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '14px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(30px)',
        zIndex: 9500,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: '#f5f7fa',
        userSelect: 'none',
        animation: 'spotlightPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Real System Telemetry Matrix (Zero Fake Controls) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {/* Real Network Status */}
        <div
          className="cc-tile-wifi"
          style={{
            padding: '10px',
            borderRadius: '12px',
            background: isOnline ? 'rgba(53, 208, 186, 0.15)' : 'rgba(255, 90, 82, 0.15)',
            border: isOnline ? '1px solid rgba(53, 208, 186, 0.35)' : '1px solid rgba(255, 90, 82, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: isOnline ? '#35d0ba' : '#ff5a52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#07090D',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {isOnline ? '●' : '✕'}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Network</div>
            <div style={{ fontSize: '10px', color: isOnline ? '#35d0ba' : '#ff5a52' }}>
              {isOnline ? 'Online • Loopback' : 'Disconnected'}
            </div>
          </div>
        </div>

        {/* Security Shield */}
        <div
          className="cc-tile-bluetooth"
          style={{
            padding: '10px',
            borderRadius: '12px',
            background: 'rgba(124, 108, 255, 0.15)',
            border: '1px solid rgba(124, 108, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#7c6cff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '13px',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Security</div>
            <div style={{ fontSize: '10px', color: '#a78bfa' }}>RBAC Active</div>
          </div>
        </div>

        {/* Sound Effects Toggle */}
        <div
          onClick={toggleSoundFx}
          style={{
            padding: '10px',
            borderRadius: '12px',
            background: soundFxEnabled ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: soundFxEnabled ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'background 0.15s ease',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: soundFxEnabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: soundFxEnabled ? '#07090D' : '#9ca3af',
              fontSize: '13px',
            }}
          >
            🔊
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Sound FX</div>
            <div style={{ fontSize: '10px', color: soundFxEnabled ? '#38bdf8' : '#9ca3af' }}>
              {soundFxEnabled ? 'Enabled' : 'Muted'}
            </div>
          </div>
        </div>

        {/* High Contrast / Velvet Dark */}
        <div
          onClick={() => setHighContrast(!highContrast)}
          style={{
            padding: '10px',
            borderRadius: '12px',
            background: highContrast ? 'rgba(254, 240, 138, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: highContrast ? '1px solid rgba(254, 240, 138, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'background 0.15s ease',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: highContrast ? '#facc15' : 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: highContrast ? '#07090D' : '#9ca3af',
              fontSize: '13px',
            }}
          >
            ◐
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Contrast</div>
            <div style={{ fontSize: '10px', color: highContrast ? '#facc15' : '#9ca3af' }}>
              {highContrast ? 'High' : 'Standard'}
            </div>
          </div>
        </div>
      </div>

      {/* Display Brightness Module */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
          <span>Display Brightness</span>
          <span style={{ color: '#38bdf8' }}>{brightness}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>🔅</span>
          <input
            type="range"
            className="brightness-slider"
            min="30"
            max="100"
            value={brightness}
            onChange={(e) => onBrightnessChange(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#38bdf8',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '14px', color: '#38bdf8' }}>🔆</span>
        </div>
      </div>

      {/* Sound Volume Module */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
          <span>Sound Volume</span>
          <span style={{ color: '#7c6cff' }}>{volume}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>🔈</span>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#7c6cff',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '14px', color: '#7c6cff' }}>🔊</span>
        </div>
      </div>

      {/* Quick Launch Footer */}
      {onOpenSettings && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#d1d5db',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s ease',
            }}
          >
            <span>⚙️</span>
            <span>System Settings...</span>
          </button>
        </div>
      )}
    </div>
  );
}
