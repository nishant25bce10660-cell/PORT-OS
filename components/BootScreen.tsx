'use client';

import React, { useState, useEffect, useRef } from 'react';
import GeometricLogo from './GeometricLogo';
import { sound } from '@/lib/sound';

interface BootScreenProps {
  onComplete: () => void;
  customBootText?: string;
}

export default function BootScreen({
  onComplete,
  customBootText = 'PORT OS',
}: BootScreenProps) {
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const completeFiredRef = useRef(false);

  useEffect(() => {
    // B1: If already booted in this session, skip immediately
    try {
      const alreadyBooted = sessionStorage.getItem('portos_booted');
      if (alreadyBooted === 'true') {
        onComplete();
        return;
      }
    } catch {}

    setIsMounted(true);

    // Play B5 synthesized boot chime
    sound.playBootChime();

    // Enable skip after 1.5s
    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, 1500);

    // Smooth progress bar increment reaching 100% at ~3.5s
    const startTime = Date.now();
    const duration = 3400; // 3.4 seconds total progress

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        finishBoot();
      }
    }, 30);

    return () => {
      clearTimeout(skipTimer);
      clearInterval(interval);
    };
  }, []);

  const finishBoot = () => {
    if (completeFiredRef.current) return;
    completeFiredRef.current = true;
    try {
      sessionStorage.setItem('portos_booted', 'true');
    } catch {}

    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  const handleSkip = () => {
    if (!canSkip) return;
    finishBoot();
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div
      id="boot-screen-overlay"
      className={`boot-screen-container ${isFadingOut ? 'fade-out' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, #111827 0%, #07090e 100%)',
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        transition: 'opacity 0.45s ease',
        opacity: isFadingOut ? 0 : 1,
      }}
    >
      {/* B2: Metallic Geometric N Logo with Specular Sweep */}
      <div style={{ marginBottom: '24px' }}>
        <GeometricLogo size={84} hasSpecularSweep={true} />
      </div>

      {/* B3: Boot Text */}
      <div
        id="boot-screen-text"
        style={{
          fontFamily: 'var(--font-mac)',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.22em',
          color: 'var(--tx-2, #a9b1bf)',
          textTransform: 'uppercase',
          marginBottom: '32px',
        }}
      >
        {customBootText}
      </div>

      {/* Progress Track & Bar */}
      <div
        id="boot-progress-track"
        style={{
          width: '210px',
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(255, 255, 255, 0.16)',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div
          id="boot-progress-bar"
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #D9DEE6 0%, #FFFFFF 100%)',
            borderRadius: '2px',
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.6)',
            transition: 'width 0.04s linear',
          }}
        />
      </div>

      {/* Skip Button (B1: Works after 1.5s) */}
      {canSkip && (
        <button
          type="button"
          id="btn-boot-skip"
          onClick={handleSkip}
          style={{
            position: 'absolute',
            bottom: '36px',
            right: '36px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '20px',
            color: 'var(--tx-2, #a9b1bf)',
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 14px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--tx-2, #a9b1bf)';
          }}
        >
          Skip ⇥
        </button>
      )}
    </div>
  );
}
