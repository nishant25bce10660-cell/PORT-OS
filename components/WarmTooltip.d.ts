import React from 'react';

export interface WarmTooltipGroupProps {
  children?: React.ReactNode;
  delay?: number;
  warmWindow?: number;
  travel?: number;
  lean?: number;
}

export declare const WarmTooltipGroup: React.FC<WarmTooltipGroupProps>;

export interface WarmTooltipProps {
  children: React.ReactElement | React.ReactNode;
  content: React.ReactNode;
  shortcut?: string | string[];
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
  className?: string;
  disabled?: boolean;
}

export declare const WarmTooltip: React.FC<WarmTooltipProps>;
export default WarmTooltip;
