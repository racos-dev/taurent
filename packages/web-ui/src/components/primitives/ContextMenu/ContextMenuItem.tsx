import React, { forwardRef } from 'react';

interface ContextMenuItemProps {
  /** Accessible identifier; forwarded as the element id for aria-activedescendant. */
  id: string;
  /** Left-side icon component. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Primary label text. */
  label: string;
  /** Keyboard shortcut hint shown on the right. */
  shortcut?: string;
  /** Prevents interaction when true. */
  disabled?: boolean;
  /** Applies destructive red stylistyling. */
  destructive?: boolean;
  /** Highlights the item as keyboard-active. */
  active?: boolean;
  /** Invoked on click. */
  onClick?: () => void;
  /** Attached to the native `onMouseEnter` event. */
  onMouseEnter?: () => void;
  /** Attached to the native `onMouseLeave` event. */
  onMouseLeave?: () => void;
}

export const ContextMenuItem = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  (
    {
      id,
      icon: Icon,
      label,
      shortcut,
      disabled = false,
      destructive = false,
      active = false,
      onClick,
      onMouseEnter,
      onMouseLeave,
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="menuitem"
        aria-label={label}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={[
          'flex w-full items-center gap-2 px-2 py-1 text-left text-xs select-none',
          disabled
            ? 'cursor-not-allowed text-text-muted'
            : destructive
              ? active
                ? 'bg-error-20 text-error'
                : 'text-error hover:bg-error-20'
              : active
                ? 'bg-surface-interactive text-text-primary'
                : 'text-text-primary hover:bg-surface-interactive',
        ].join(' ')}
      >
        {Icon && (
          <Icon
            className={[
              'h-4 w-4 shrink-0',
              disabled ? 'text-text-muted' : destructive ? 'text-error' : 'text-text-muted',
            ].join(' ')}
          />
        )}
        <span className="truncate flex-1" title={label}>{label}</span>
        {shortcut && <span className="text-xs text-text-muted font-mono">{shortcut}</span>}
      </button>
    );
  }
);

ContextMenuItem.displayName = 'ContextMenuItem';
