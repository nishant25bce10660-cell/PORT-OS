'use client';

import React from 'react';
import { PortOSIconKind, ICON_METADATA, renderIconArtwork } from './iconRegistry';

export interface PortOSIconProps {
  kind: PortOSIconKind;
  size?: number;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  ariaHidden?: boolean;
  style?: React.CSSProperties;
  variant?: 'app' | 'folder' | 'file' | 'utility';
}

export default function PortOSIcon({
  kind,
  size = 48,
  label,
  selected = false,
  disabled = false,
  className = '',
  ariaHidden = false,
  style = {},
  variant,
}: PortOSIconProps) {
  const meta = ICON_METADATA[kind] || ICON_METADATA['generic-file'];
  const effectiveVariant = variant || meta.category;

  const isFolderOrDoc = effectiveVariant === 'folder' || effectiveVariant === 'file';
  const effectiveLabel = label || meta.label;
  const shouldHide = ariaHidden === true;

  const containerStyle: React.CSSProperties = {
    '--portos-icon-size': `${size}px`,
    width: `${size}px`,
    height: `${size}px`,
    opacity: disabled ? 0.45 : 1,
    ...style,
  } as React.CSSProperties;

  return (
    <div
      className={`portos-app-icon ${selected ? 'portos-app-icon--selected' : ''} ${
        disabled ? 'portos-app-icon--disabled' : ''
      } ${isFolderOrDoc ? 'portos-app-icon--glyph-mode' : ''} ${className}`}
      data-kind={kind}
      data-category={effectiveVariant}
      style={containerStyle}
      role={shouldHide ? undefined : 'img'}
      aria-label={shouldHide ? undefined : effectiveLabel}
      aria-hidden={shouldHide ? true : undefined}
    >
      {/* Background Layer with subtle gradient */}
      <div className="portos-app-icon__background" aria-hidden="true" />

      {/* Semantic Foreground Symbol Artwork */}
      <div className="portos-app-icon__symbol" aria-hidden="true">
        {renderIconArtwork(kind)}
      </div>
    </div>
  );
}

export type { PortOSIconKind } from './iconRegistry';
