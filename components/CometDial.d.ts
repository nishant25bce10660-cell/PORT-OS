import React from 'react';

export interface CometDialProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  strokeWidth?: number;
  accent?: string;
  ink?: string;
  track?: string;
  unit?: string;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}

export declare const CometDial: React.FC<CometDialProps>;
export default CometDial;
