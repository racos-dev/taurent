import React from 'react';
import { cn } from '@taurent/shared';
import { useDropdownPanel, DropdownPanel } from '../Dropdown';
import type { DropdownMenuProps, MenuItem } from './types';

/**
 * Renders a text-button trigger that opens a menu-style panel with action items
 * and optional separators.
 *
 * Supports both uncontrolled (internal state) and controlled (open/onOpenChange)
 * modes. Controlled mode enables parent coordination (e.g. MenuBar
 * single-open-at-a-time).
 */
export function DropdownMenu({
  label,
  items,
  dataTestid,
  open,
  onOpenChange,
  onPanelMouseEnter,
  onPanelMouseLeave,
}: DropdownMenuProps): React.ReactElement {
  const isControlled = open !== undefined && onOpenChange !== undefined;

  const {
    triggerRef,
    panelRef,
    optionRefs,
    isOpen: hookIsOpen,
    activeIndex,
    panelPosition,
    setActiveIndex,
    handleKeyNavigation,
    handleTriggerClick,
    handleTriggerBlur,
    handleTriggerMouseEnter,
    handlePanelBlur,
    getTriggerAria,
    openDropdown,
    closeDropdown,
    getPanelAria,
  } = useDropdownPanel<MenuItem>({
    options: items,
    getOptionLabel: (item) => ('separator' in item ? '' : item.label),
    isOptionDisabled: (item) => ('separator' in item ? true : !!item.disabled),
    onSelect: (item) => {
      if ('separator' in item) return;
      if (item.onClick) {
        item.onClick();
      }
    },
    role: 'menu',
    enableHoverMode: true,
    initialActiveIndex: -1,
  });

  const isOpen = isControlled ? open : hookIsOpen;

  // Track previous hookIsOpen to detect true→false transitions
  const prevHookIsOpenRef = React.useRef(hookIsOpen);
  React.useEffect(() => {
    prevHookIsOpenRef.current = hookIsOpen;
  });

  // Hook → parent sync: only propagate when hook actually closes itself
  React.useEffect(() => {
    if (isControlled && prevHookIsOpenRef.current && !hookIsOpen && open) {
      onOpenChange(false);
    }
  }, [hookIsOpen, isControlled, open, onOpenChange]);

  // Parent → hook sync: bring hook state in line with controlled prop
  React.useEffect(() => {
    if (!isControlled) return;
    if (open && !hookIsOpen) {
      openDropdown(-1);
    } else if (!open && hookIsOpen) {
      closeDropdown();
    }
  }, [open, hookIsOpen, isControlled, openDropdown, closeDropdown]);

  // Clicking a menu item: fire the action, then close.
  const handleItemClick = (item: MenuItem) => {
    if ('separator' in item || item.disabled) return;
    item.onClick?.();
    if (isControlled) {
      onOpenChange(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid={dataTestid}
        onClick={isControlled ? () => onOpenChange(!open) : handleTriggerClick}
        onBlur={handleTriggerBlur}
        onMouseEnter={
          isControlled
            ? () => { if (!open) onOpenChange(true); }
            : handleTriggerMouseEnter
        }
        className="flex items-center gap-1 px-2 py-1 text-sm rounded-sm hover:bg-surface-interactive cursor-pointer select-none"
        {...getTriggerAria()}
      >
        {label}
      </button>

      <DropdownPanel
        isOpen={isOpen}
        panelPosition={panelPosition}
        role="menu"
        panelRef={panelRef}
        onBlur={handlePanelBlur}
        onKeyDown={handleKeyNavigation}
        onMouseEnter={onPanelMouseEnter}
        onMouseLeave={onPanelMouseLeave}
        {...getPanelAria()}
      >
        <div className="py-1 select-none">
          {items.map((item, index) => {
            if ('separator' in item) {
              return (
                <div key={index} className="border-t border-border mx-1 my-1" />
              );
            }

            const isActive = activeIndex === index;
            const isDisabled = item.disabled ?? false;

            return (
              <div
                key={index}
                ref={(el) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (optionRefs as any).current[index] = el;
                }}
                className="relative"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={isDisabled}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'w-full flex items-center justify-between px-6 py-1 text-sm text-left cursor-pointer select-none',
                    isActive && !isDisabled
                      ? 'bg-surface-interactive text-text-primary'
                      : 'text-text-primary hover:bg-surface-interactive',
                    isDisabled ? 'text-text-muted cursor-not-allowed' : '',
                  )}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="text-xs font-mono text-text-muted ml-8">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </DropdownPanel>
    </div>
  );
}
