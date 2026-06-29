import type { ByteUnit, NumberInputUnitMode } from '../../primitives/NumberInput';

export interface NumberInputModalProps {
  title: string;
  subtitle?: string;
  currentValue: number;
  onSubmit: (value: number) => void;
  onCancel: () => void;
  unit?: string;
  unitMode?: NumberInputUnitMode;
  unitDefault?: ByteUnit;
  submitLabel?: string;
  cancelLabel?: string;
}
