'use client';

import React from 'react';

interface GeometricLogoProps {
  size?: number;
  className?: string;
  hasSpecularSweep?: boolean;
}

export default function GeometricLogo({
  size = 48,
  className = '',
  hasSpecularSweep = true,
}: GeometricLogoProps) {
  return (
    <div
      className={`geometric-logo-wrap ${hasSpecularSweep ? 'has-specular-sweep' : ''} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="geometric-logo-svg"
      >
        <defs>
          {/* B2: Metallic gradient with >= 5 stops */}
          <linearGradient
            id="silverMetallicGrad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="18%" stopColor="#D9DEE6" />
            <stop offset="38%" stopColor="#9AA3B0" />
            <stop offset="52%" stopColor="#F3F5F8" />
            <stop offset="70%" stopColor="#7E8794" />
            <stop offset="86%" stopColor="#CBD1DA" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>

          {/* Specular highlight sweep */}
          <linearGradient id="specularSweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          <clipPath id="logoClip">
            {/* Geometric "N" Monogram */}
            {/* Left pillar */}
            <rect x="18" y="14" width="16" height="72" rx="4" />
            {/* Right pillar */}
            <rect x="66" y="14" width="16" height="72" rx="4" />
            {/* Angled diagonal */}
            <path
              d="M34 18L70 82C71.5 84.5 69.5 86 66 86H62L26 22C24.5 19.5 26.5 18 30 18H34Z"
            />
          </clipPath>
        </defs>

        {/* Base Metallic Monogram */}
        <g clipPath="url(#logoClip)">
          <rect x="0" y="0" width="100" height="100" fill="url(#silverMetallicGrad)" />

          {/* Specular Sweep Sheen Layer */}
          {hasSpecularSweep && (
            <rect
              className="specular-sweep-bar"
              x="-100"
              y="0"
              width="100"
              height="100"
              fill="url(#specularSweepGrad)"
              transform="skewX(-25)"
            />
          )}
        </g>
      </svg>
    </div>
  );
}
