import React from 'react';
import { cn, ChevronDown, ICON_SIZES } from '@taurent/shared';
import { useDropdownPanel } from '../Dropdown/useDropdownPanel';
import { DropdownPanel } from '../Dropdown/DropdownPanel';
import type { SelectProps } from './types';
import {
  useControlDensity,
  SELECT_CONTROL_TRIGGER_SIZE_CLASSES,
} from '../../../controlSizing';

type SelectComponent = <T extends string | number = string>(
  props: SelectProps<T>
) => React.JSX.Element;

const SelectInner = <T extends string | number>({
  autoFocus,
  className,
  containerClassName,
  dataTestid,
  disabled,
  error,
  form,
  id,
  label,
  name,
  onBlur,
  onChange,
  onClick,
  onFocus,
  onKeyDown,
  options,
  required,
  tabIndex,
  value,
  alignment,
  ...buttonProps
}: SelectProps<T>) => {
  const reactId = React.useId();
  const triggerId = id ?? `select-${reactId}`;
  const labelId = `${triggerId}-label`;

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  const {
    triggerRef,
    panelRef,
    optionRefs,
    isOpen,
    activeIndex,
    panelPosition,
    setActiveIndex,
    selectIndex,
    handleKeyNavigation,
    handleTriggerClick,
    handleTriggerBlur,
    handlePanelBlur,
  } = useDropdownPanel({
    options,
    getOptionLabel: (opt) => opt.label,
    isOptionDisabled: (opt) => Boolean(opt.disabled),
    onSelect: (opt) => {
      onChange?.(opt.value);
    },
    role: 'listbox',
    labelId,
    disabled,
    alignment,
  });

  const density = useControlDensity();
  const densitySizeClasses = SELECT_CONTROL_TRIGGER_SIZE_CLASSES[density];

  const triggerClasses = cn(
    'flex w-full items-center justify-between gap-2 rounded-sm border bg-background text-left text-text-primary',
    'border-border-input focus-visible:border-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus',
    'disabled:cursor-not-allowed disabled:text-text-disabled',
    densitySizeClasses,
    error ? 'border-error focus-visible:border-error focus-visible:ring-error' : '',
    className ?? '',
  );

  return (
    <div className={cn('min-w-0', containerClassName)}>
      {label ? (
        <label
          id={labelId}
          htmlFor={triggerId}
          className="mb-2 block text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      ) : null}
      <div className="relative min-w-0">
        {name ? (
          <input
            type="hidden"
            name={name}
            form={form}
            value={selectedOption ? String(selectedOption.value) : ''}
          />
        ) : null}
        <button
          {...buttonProps}
          ref={triggerRef}
          id={triggerId}
          type="button"
          disabled={disabled}
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          data-testid={dataTestid}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? `${triggerId}-listbox` : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-labelledby={label ? `${labelId} ${triggerId}` : buttonProps['aria-labelledby']}
          className={triggerClasses}
          onBlur={(event) => {
            handleTriggerBlur(event);
            onBlur?.(event);
          }}
          onClick={(event) => {
            handleTriggerClick(event);
            onClick?.(event);
          }}
          onFocus={onFocus}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) {
              handleKeyNavigation(event);
            }
          }}
        >
          <span className="min-w-0 flex-1 truncate" title={selectedOption?.label ? String(selectedOption.label) : undefined}>
            {selectedOption?.label ?? ''}
          </span>
          <ChevronDown
            size={ICON_SIZES.md}
            className={cn(
              'shrink-0 text-text-muted transition-transform',
              isOpen ? 'rotate-180' : '',
            )}
          />
        </button>

        <DropdownPanel
          isOpen={isOpen}
          panelPosition={panelPosition}
          role="listbox"
          panelRef={panelRef}
          onBlur={handlePanelBlur}
          onKeyDown={handleKeyNavigation}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            const isDisabled = Boolean(option.disabled);

            return (
              <div
                key={String(option.value)}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                className={cn(
                  'cursor-pointer px-3 py-2 text-left transition-colors',
                  isSelected ? 'bg-primary/10 text-primary' : 'text-text-primary',
                  isActive && !isSelected ? 'bg-surface-interactive' : '',
                  isDisabled
                    ? 'cursor-not-allowed text-text-muted'
                    : 'hover:bg-surface-interactive',
                  isDisabled && isSelected ? 'text-text-muted' : '',
                )}
                onMouseEnter={() => {
                  if (!isDisabled) {
                    setActiveIndex(index);
                  }
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  if (!isDisabled) {
                    selectIndex(index);
                  }
                }}
              >
                <span className="block whitespace-nowrap">
                  {option.label}
                </span>
              </div>
            );
          })}
        </DropdownPanel>
      </div>
      {error ? (
        <p className="mt-1 text-sm text-error">{error}</p>
      ) : null}
    </div>
  );
};

SelectInner.displayName = 'Select';

const MemoizedSelect = React.memo(SelectInner);

MemoizedSelect.displayName = 'Select';

export const Select = MemoizedSelect as SelectComponent;
