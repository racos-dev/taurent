import type { InputHTMLAttributes } from 'react';

export type ByteUnit = 'b' | 'kb' | 'mb' | 'gb';

export type NumberInputUnitMode = 'bytes' | 'bytes-per-second';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * When set, `value` and emitted values stay in raw bytes while the input
   * displays the selected unit.
   */
  unitMode?: NumberInputUnitMode;
  unitDefault?: ByteUnit;
  onValueChange?: (value: number) => void;
}
