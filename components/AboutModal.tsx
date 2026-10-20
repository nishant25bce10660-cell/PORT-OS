'use client';

import React from 'react';
import GeometricLogo from '@/components/GeometricLogo';

interface AboutModalProps {
  onOpenSettings?: () => void;
  onOpenOwner?: () => void;
}

export default function AboutModal({ onOpenSettings, onOpenOwner }: AboutModalProps) {
  return (
    <div
      id="window-about-portos"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 24px 20px 24px',
        color: '#f5f7fa',
        fontFamily: 'inherit',
        userSelect: 'none',
        height: '100%',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(24, 28, 37, 0.95) 0%, rgba(18, 21, 28, 0.98) 100%)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Geometric Metallic N Logo */}
        <div style={{ marginBottom: '14px' }}>
          <GeometricLogo size={56} hasSpecularSweep={true} />
        </div>

        {/* Title & Version */}
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
          PORT OS
        </h2>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px', fontWeight: 500 }}>
          Version 1.0.0 (Build 24A348)
        </div>
      </div>

      {/* Hardware / Software Specs Card with fixed 120px label column */}
      <div
        style={{
          width: '100%',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '11.5px',
          margin: '12px 0',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
          <span style={{ color: '#7d8696', fontWeight: 500 }}>Platform</span>
          <span style={{ fontWeight: 500, textAlign: 'right', color: '#F5F7FA' }}>macOS Web Desktop</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
          <span style={{ color: '#7d8696', fontWeight: 500 }}>Engine</span>
          <span style={{ fontWeight: 500, textAlign: 'right', color: '#F5F7FA' }}>Next.js 14 App Router</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
          <span style={{ color: '#7d8696', fontWeight: 500 }}>Graphics</span>
          <span style={{ fontWeight: 500, textAlign: 'right', color: '#F5F7FA' }}>Silk Wave GLSL Shader</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
          <span style={{ color: '#7d8696', fontWeight: 500 }}>Audio</span>
          <span style={{ fontWeight: 500, textAlign: 'right', color: '#F5F7FA' }}>Web Audio Synthesizer</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
          <span style={{ color: '#7d8696', fontWeight: 500 }}>Security</span>
          <span style={{ fontWeight: 500, textAlign: 'right', color: '#35D0BA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Server RBAC & H1–H5
          </span>
        </div>
      </div>

      {/* Footer Navigation Buttons */}
      <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' }}>
        {onOpenSettings && (
          <button
            type="button"
            id="btn-about-settings"
            onClick={onOpenSettings}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f5f7fa',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            System Settings...
          </button>
        )}
        {onOpenOwner && (
          <button
            type="button"
            id="btn-about-owner"
            onClick={onOpenOwner}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f5f7fa',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Owner Profile
          </button>
        )}
      </div>
    </div>
  );
}
