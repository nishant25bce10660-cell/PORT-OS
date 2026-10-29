'use client';

import React, { useRef } from 'react';
import Lightfall from './Lightfall';
import GradientASCII from './GradientASCII';

interface WallpaperProps {
  hasMaximizedWindow?: boolean;
  isLocked?: boolean;
  desktopSide?: 'left' | 'right';
}

export default function Wallpaper({
  hasMaximizedWindow = false,
  isLocked = false,
}: WallpaperProps) {
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div
      id="desktop-wallpaper-container"
      className="wallpaper-root-container"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        pointerEvents: isLocked ? 'auto' : 'none',
        zIndex: 0,
      }}
    >
      {/* Lock Screen Wallpaper: React Bits <Lightfall /> Component */}
      {isLocked ? (
        <div
          id="lockscreen-lightfall-container"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <Lightfall
            colors={['#ffffff']}
            backgroundColor="#94a3b8"
            speed={0.3}
            streakCount={2}
            streakWidth={0.8}
            twinkle={0.3}
            backgroundGlow={0.1}
            headGlow={0.6}
            bloom={0.35}
            mouseInteraction={true}
            holdToWarp={true}
            intro={true}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Hidden desktop frame canvas when locked for DOM selector compatibility */}
          <canvas
            ref={frameCanvasRef}
            id="wallpaper-frame-canvas"
            className="wallpaper-canvas"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <>
          {/* Home Screen Wallpaper: React Bits <GradientASCII /> Component */}
          <div
            id="desktop-gradient-ascii-container"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <GradientASCII
              colors={['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8']}
              shape="horizon"
              characters=" =+xX0S8#@"
              cellSize={18}
              density={0.8}
              mouseInteraction={true}
              clickEffect="wave"
              intro={true}
              paused={hasMaximizedWindow}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Background surface target for O(1) hit testing and legacy test compatibility */}
          <div
            id="wallpaper-surface"
            data-wallpaper-surface="true"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Hidden canvases for legacy DOM selector compatibility */}
          <canvas
            ref={frameCanvasRef}
            id="wallpaper-frame-canvas"
            className="wallpaper-canvas"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
          />
          <canvas
            ref={trailCanvasRef}
            id="wallpaper-trail-canvas"
            className="wallpaper-trail-canvas"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
          />
        </>
      )}
    </div>
  );
}
