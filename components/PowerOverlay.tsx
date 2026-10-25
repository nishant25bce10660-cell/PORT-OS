'use client';

import React, { useEffect } from 'react';
import { sound } from '@/lib/sound';
import WarmTooltip from './WarmTooltip';

export type PowerState = 'running' | 'shutdown' | 'restarting' | 'sleeping';

interface PowerOverlayProps {
  powerState: PowerState;
  onPowerOn: () => void;
  onWakeFromSleep: () => void;
}

export default function PowerOverlay({
  powerState,
  onPowerOn,
  onWakeFromSleep,
}: PowerOverlayProps) {
  // B6: Sleep mode wake on keypress or pointer down
  useEffect(() => {
    if (powerState !== 'sleeping') return;

    const handleWake = (e: Event) => {
      e.stopPropagation();
      onWakeFromSleep();
    };

    window.addEventListener('keydown', handleWake, { capture: true });
    window.addEventListener('pointerdown', handleWake, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleWake, { capture: true });
      window.removeEventListener('pointerdown', handleWake, { capture: true });
    };
  }, [powerState, onWakeFromSleep]);

  if (powerState === 'running') {
    return null;
  }

  // B6: SLEEP MODE - Total black screen waking on any input
  if (powerState === 'sleeping') {
    return (
      <div
        id="sleep-overlay"
        onClick={onWakeFromSleep}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#000000',
          zIndex: 99999999,
          cursor: 'none',
        }}
      />
    );
  }

  // B6: SHUTDOWN MODE - Pitch black with glowing power button
  if (powerState === 'shutdown') {
    return (
      <div
        id="shutdown-screen"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#000000',
          zIndex: 99999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <WarmTooltip content="Turn on PORT OS" side="top">
          <button
            type="button"
            id="btn-power-on"
            onClick={onPowerOn}
            className="power-button-glow"
            aria-label="Turn on PORT OS"
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              fontSize: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(255, 255, 255, 0.15)',
              transition: 'all 0.25s ease',
            }}
          >
            ⏻
          </button>
        </WarmTooltip>
        <span
          style={{
            fontFamily: 'var(--font-mac)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--tx-3, #7d8696)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: '16px',
          }}
        >
          Press to Power On
        </span>
      </div>
    );
  }

  // RESTARTING MODE - Blackout transition
  if (powerState === 'restarting') {
    return (
      <div
        id="restart-screen"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#000000',
          zIndex: 99999999,
        }}
      />
    );
  }

  return null;
}
