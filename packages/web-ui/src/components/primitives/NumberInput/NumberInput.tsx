import React, { useRef, useImperativeHandle, useState } from 'react';
import { cn, ChevronUp, ChevronDown, ICON_SIZES } from '@taurent/shared';
import type { ByteUnit, NumberInputProps } from './types';

const BYTE_UNITS: Array<{ value: ByteUnit; label: string; factor: number }> = [
  { value: 'b', label: 'B', factor: 1 },
  { value: 'kb', label: 'KB', factor: 1024 },
  { value: 'mb', label: 'MB', factor: 1024 ** 2 },
  { value: 'gb', label: 'GB', factor: 1024 ** 3 },
];

function getByteUnit(unit: ByteUnit) {
  return BYTE_UNITS.find((item) => item.value === unit) ?? BYTE_UNITS[1];
}

function formatUnitValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(3)));
}

function getDecimalPlaces(value: number): number {
  if (Number.isInteger(value)) return 0;
  const str = String(value);
  const idx = str.indexOf('.');
  return idx === -1 ? 0 : str.length - idx - 1;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

export const NumberInput = React.memo(
  React.forwardRef<HTMLInputElement, NumberInputProps>(
    (
      {
        className,
        disabled,
        min,
        max,
        step = 1,
        value,
        onChange,
        onValueChange,
        unitMode,
        unitDefault = 'kb',
        ...props
      },
      ref,
    ) => {
      const internalRef = useRef<HTMLInputElement>(null);
      const [selectedUnit, setSelectedUnit] = useState<ByteUnit>(unitDefault);
      useImperativeHandle(ref, () => internalRef.current as HTMLInputElement, []);

      const selectedByteUnit = getByteUnit(selectedUnit);
      const rawValue = value === undefined || value === '' ? 0 : Number(value);
      const currentValue = unitMode ? rawValue / selectedByteUnit.factor : rawValue;
      const inputValue = unitMode ? formatUnitValue(currentValue) : value;
      const inputMin = unitMode && min !== undefined ? Number(min) / selectedByteUnit.factor : min;
      const inputMax = unitMode && max !== undefined ? Number(max) / selectedByteUnit.factor : max;
      const decimalPlaces = Math.max(
        getDecimalPlaces(Number(step)),
        getDecimalPlaces(currentValue),
      );

      const atMin = min !== undefined && rawValue <= Number(min);
      const atMax = max !== undefined && rawValue >= Number(max);

      const emitValue = (nextValue: number) => {
        const normalized = Number.isFinite(nextValue) ? nextValue : 0;
        onValueChange?.(normalized);

        if (onChange) {
          onChange({
            target: { value: String(normalized) },
            currentTarget: { value: String(normalized) },
          } as React.ChangeEvent<HTMLInputElement>);
        }
      };

      const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!unitMode) {
          const parsed = Number.parseFloat(event.target.value);
          onValueChange?.(Number.isFinite(parsed) ? parsed : 0);
          onChange?.(event);
          return;
        }

        const parsed = Number.parseFloat(event.target.value);
        const nextValue = Number.isFinite(parsed)
          ? Math.round(parsed * selectedByteUnit.factor)
          : 0;
        emitValue(nextValue);
      };

      const handleStep = (direction: 1 | -1) => {
        if (disabled) return;
        const raw = currentValue + direction * Number(step);
        const clamped = clamp(
          raw,
          inputMin === undefined ? undefined : Number(inputMin),
          inputMax === undefined ? undefined : Number(inputMax),
        );
        const rounded = Number(clamped.toFixed(decimalPlaces));
        const nextValue = unitMode ? Math.round(rounded * selectedByteUnit.factor) : rounded;

        if (unitMode) {
          emitValue(nextValue);
          return;
        }

        const input = internalRef.current;
        if (input) {
          onValueChange?.(nextValue);
          if (onChange) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value',
            )?.set;
            nativeInputValueSetter?.call(input, String(rounded));
            onChange({ target: input } as React.ChangeEvent<HTMLInputElement>);
          }
        }
      };

      const input = (
        <div className={cn('relative flex min-w-0 items-center', unitMode ? 'flex-1' : 'w-full')}>
          <input
            ref={internalRef}
            type="number"
            disabled={disabled}
            min={inputMin}
            max={inputMax}
            step={step}
            value={inputValue}
            onChange={handleInputChange}
            className={cn(
              'appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              '[-moz-appearance:textfield]',
              'rounded-sm border border-border-input bg-background h-9 px-3 pr-6 text-sm text-text-primary placeholder:text-text-secondary',
              'focus-visible:border-border-focus focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors',
              className,
            )}
            {...props}
          />
          <div className="absolute right-1 flex flex-col h-full pointer-events-none w-5">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden={true}
              disabled={disabled || atMax}
              onClick={() => handleStep(1)}
              className="pointer-events-auto flex-1 flex items-center justify-center rounded-tr-sm border-l border-b border-border-input text-text-muted transition-colors hover:bg-surface-interactive hover:text-text-primary active:bg-primary active:text-text-on-primary disabled:text-text-disabled disabled:cursor-not-allowed"
            >
              <ChevronUp size={ICON_SIZES.xs} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden={true}
              disabled={disabled || atMin}
              onClick={() => handleStep(-1)}
              className="pointer-events-auto flex-1 flex items-center justify-center rounded-br-sm border-l border-border-input text-text-muted transition-colors hover:bg-surface-interactive hover:text-text-primary active:bg-primary active:text-text-on-primary disabled:text-text-disabled disabled:cursor-not-allowed"
            >
              <ChevronDown size={ICON_SIZES.xs} />
            </button>
          </div>
        </div>
      );

      if (unitMode) {
        return (
          <div className="flex w-full min-w-0 items-center gap-2">
            {input}
            <select
              aria-label="Unit"
              disabled={disabled}
              value={selectedUnit}
              onChange={(event) => setSelectedUnit(event.target.value as ByteUnit)}
              className={cn(
                'h-9 shrink-0 rounded-sm border border-border-input bg-background px-2 text-sm text-text-primary',
                'focus-visible:border-border-focus focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {BYTE_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unitMode === 'bytes-per-second' ? `${unit.label}/s` : unit.label}
                </option>
              ))}
            </select>
          </div>
        );
      }

      return (
        <div className="relative flex w-full items-center">{input}</div>
      );
    },
  ),
);

NumberInput.displayName = 'NumberInput';
