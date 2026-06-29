import React, { useState, useCallback, forwardRef } from 'react';
import { X } from '@taurent/shared';
import { cn } from '@taurent/shared';
import type { InputWebProps } from './types';
import {
  useControlDensity,
  INPUT_CONTROL_SIZE_CLASSES,
  INPUT_CONTROL_ICON_PADDING,
  INPUT_CONTROL_CLEAR_PADDING,
} from '../../../controlSizing';
import {
  INPUT_CONTROL_ICON_OFFSET,
  INPUT_CONTROL_CLEAR_OFFSET,
} from '../../../controlSizing/controlSizeClasses';

const InputComponent: React.FC<InputWebProps & { ref?: React.Ref<HTMLInputElement> }> = React.memo(({
  id,
  label,
  error,
  helperText,
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  type = 'text',
  size = 'md',
  autoComplete = 'off',
  disabled = false,
  icon,
  clearable = false,
  className = '',
  autoFocus = false,
  ref,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  }, [isControlled, onChange]);

  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const handleClear = useCallback(() => {
    if (!isControlled) {
      setInternalValue('');
    }
    onChange?.('');
  }, [isControlled, onChange]);

  const isSm = size === 'sm';
  const density = useControlDensity();
  const sizeKey = isSm ? 'sm' : 'md';
  const sizeStyles = INPUT_CONTROL_SIZE_CLASSES[density][sizeKey];
  const iconPadding = INPUT_CONTROL_ICON_PADDING[density][sizeKey];
  const clearPadding = INPUT_CONTROL_CLEAR_PADDING[density][sizeKey];
  const iconLeftOffset = INPUT_CONTROL_ICON_OFFSET[density][sizeKey];
  const clearRightOffset = INPUT_CONTROL_CLEAR_OFFSET[density][sizeKey];

  const baseStyles = cn(
    'w-full rounded-sm border border-border-input bg-background text-text-primary transition-colors',
    'focus-visible:border-border-focus focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none',
    sizeStyles,
  );

  const errorStyles = error ? 'border-error focus-visible:border-error focus-visible:ring-error' : '';
  const disabledStyles = disabled ? 'text-text-disabled cursor-not-allowed' : '';
  const iconStyles = icon ? iconPadding : '';
  const showClear = clearable && currentValue;
  const clearButtonSize = isSm ? 14 : 16;

  return (
    <div className={className || 'w-full'}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className={cn(
            'absolute top-1/2 -translate-y-1/2 text-text-muted',
            iconLeftOffset,
          )}>
            {icon}
          </div>
        )}
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear input"
            className={cn(
              'absolute top-1/2 -translate-y-1/2 cursor-pointer text-text-muted hover:text-text-primary transition-colors',
              clearRightOffset,
            )}
          >
            <X size={clearButtonSize} />
          </button>
        )}
        <input
          id={id}
          ref={ref}
          type={type}
          value={currentValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          disabled={disabled}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCorrect="off"
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            baseStyles,
            errorStyles,
            disabledStyles,
            iconStyles,
            showClear ? clearPadding : '',
            'placeholder:text-text-placeholder',
          )}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
      {!error && helperText && (
        <p className="mt-1 text-sm text-text-secondary">{helperText}</p>
      )}
    </div>
  );
});

InputComponent.displayName = 'InputComponent';

export const Input = forwardRef<HTMLInputElement, InputWebProps>((props, ref) => (
  <InputComponent {...props} ref={ref} />
));

Input.displayName = 'Input';
