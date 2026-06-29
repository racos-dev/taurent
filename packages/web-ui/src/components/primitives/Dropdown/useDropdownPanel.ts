import React from 'react';
import type {
  PanelPosition,
  UseDropdownPanelOptions,
  UseDropdownPanelReturn,
} from './types';

/** Vertical gap between trigger bottom and panel top (or panel bottom and trigger top). */
const PANEL_GAP = 4;
/** Minimum distance from panel edge to nearest viewport edge. */
const VIEWPORT_PADDING = 8;
/** Minimum panel height when no vertical space is available. */
const PANEL_MIN_HEIGHT = 56;
/** Combined vertical border width (top + bottom) on the panel container. */
const VERTICAL_BORDER = 2;
/** How long without a typeahead keystroke before resetting the typeahead buffer. */
const TYPEAHEAD_RESET_MS = 500;

function clamp(value: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function findNextEnabledIndex<T>(
  options: T[],
  startIndex: number,
  direction: 1 | -1,
  isOptionDisabled: (opt: T) => boolean,
): number {
  if (options.length === 0) {
    return -1;
  }
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (startIndex + direction * offset + options.length) % options.length;
    if (!isOptionDisabled(options[index])) {
      return index;
    }
  }
  return -1;
}

function findFirstEnabledIndex<T>(
  options: T[],
  isOptionDisabled: (opt: T) => boolean,
): number {
  return options.findIndex((opt) => !isOptionDisabled(opt));
}

function findMatchingOptionIndex<T>(
  options: T[],
  query: string,
  startIndex: number,
  getOptionLabel: (opt: T) => string,
  isOptionDisabled: (opt: T) => boolean,
): number {
  if (!query) {
    return -1;
  }
  const normalizedQuery = query.toLocaleLowerCase();
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (startIndex + offset + options.length) % options.length;
    const option = options[index];
    if (!option || isOptionDisabled(option)) {
      continue;
    }
    if (getOptionLabel(option).toLocaleLowerCase().startsWith(normalizedQuery)) {
      return index;
    }
  }
  return -1;
}

/**
 * Manages all generic dropdown-panel behavior: viewport-aware positioning,
 * position lifecycle, keyboard navigation, typeahead, outside-click dismissal,
 * focus management, and ARIA wiring.
 *
 * Generic concerns extracted from Select.tsx. No Select-specific logic.
 */
export function useDropdownPanel<T>({
  options,
  getOptionLabel,
  isOptionDisabled = () => false,
  onSelect,
  role = 'listbox',
  labelId,
  enableTypeahead = true,
  enableHoverMode = false,
  disabled = false,
  initialActiveIndex,
  alignment = 'left',
}: UseDropdownPanelOptions<T>): UseDropdownPanelReturn {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = React.useRef({ value: '', updatedAt: 0 });
  const reactId = React.useId();
  const panelId = `dropdown-panel-${reactId}`;

  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [panelPosition, setPanelPosition] =
    React.useState<PanelPosition | null>(null);

  const isDisabled = React.useCallback(
    (opt: T) => isOptionDisabled(opt),
    [isOptionDisabled],
  );

  const getInitialActiveIndex = React.useCallback(() => {
    if (initialActiveIndex !== undefined) {
      return initialActiveIndex;
    }
    const firstEnabled = findFirstEnabledIndex(options, isDisabled);
    return firstEnabled;
  }, [initialActiveIndex, isDisabled, options]);

  const closeDropdown = React.useCallback(
    (focusTrigger = false) => {
      setIsOpen(false);
      setActiveIndex(-1);
      if (focusTrigger) {
        requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    },
    [],
  );

  const openDropdown = React.useCallback(
    (nextActiveIndex?: number) => {
      if (options.length === 0 || disabled) {
        return;
      }
      setActiveIndex(nextActiveIndex ?? getInitialActiveIndex());
      setIsOpen(true);
    },
    [disabled, getInitialActiveIndex, options.length],
  );

  // Track last selected index to skip re-firing onChange when same item is
  // selected again (e.g. clicking the already-selected item in a listbox).
  const lastSelectedIndexRef = React.useRef<number | null>(null);

  const selectIndex = React.useCallback(
    (index: number) => {
      if (index === lastSelectedIndexRef.current) {
        return;
      }
      const option = options[index];
      if (!option || isDisabled(option)) {
        return;
      }
      lastSelectedIndexRef.current = index;
      onSelect(option);
      setActiveIndex(index);
      setIsOpen(false);
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    },
    [isDisabled, onSelect, options],
  );

  const updatePanelPosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(trigger);
    const panel = panelRef.current;
    const contentHeight = panel?.scrollHeight ?? 240;
    const spaceBelow = Math.max(
      window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_PADDING,
      0,
    );
    const spaceAbove = Math.max(
      rect.top - PANEL_GAP - VIEWPORT_PADDING,
      0,
    );
    const openUpward =
      spaceBelow < contentHeight && spaceAbove > spaceBelow;
    const availableHeight = openUpward ? spaceAbove : spaceBelow;
    // Account for the panel's 1px top + 1px bottom border so the scrollbar
    // only appears when content genuinely overflows.
    const maxHeight = availableHeight > 0
      ? Math.min(contentHeight, availableHeight - VERTICAL_BORDER) + VERTICAL_BORDER
      : PANEL_MIN_HEIGHT;
    const panelHeight = Math.min(contentHeight, maxHeight);
    const minWidth = Math.max(rect.width, 0);
    let left: number;
    let right: number | undefined;

    if (alignment === 'right') {
      right = window.innerWidth - (rect.left + rect.width);
      left = 0;
    } else {
      left = clamp(
        rect.left,
        VIEWPORT_PADDING,
        window.innerWidth - VIEWPORT_PADDING - minWidth,
      );
      right = undefined;
    }

    const top = openUpward
      ? Math.max(VIEWPORT_PADDING, rect.top - PANEL_GAP - panelHeight)
      : Math.min(
          window.innerHeight - VIEWPORT_PADDING - panelHeight,
          rect.bottom + PANEL_GAP,
        );

    setPanelPosition({
      top,
      left,
      right,
      minWidth,
      maxHeight,
      fontSize: computedStyle.fontSize,
      lineHeight: computedStyle.lineHeight,
      fontFamily: computedStyle.fontFamily,
      fontWeight: computedStyle.fontWeight,
    });
  }, [alignment]);

  // Position lifecycle: update position when opened and re-subscribe to
  // viewport changes via ResizeObserver + scroll/resize listeners.
  React.useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePanelPosition();

    const handleViewportChange = () => {
      updatePanelPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(handleViewportChange)
        : null;

    if (triggerRef.current) {
      resizeObserver?.observe(triggerRef.current);
    }
    if (panelRef.current) {
      resizeObserver?.observe(panelRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, { capture: true });
      resizeObserver?.disconnect();
    };
  }, [isOpen, updatePanelPosition]);

  // Focus panel when opened; attach capture-phase pointerdown to close on
  // outside clicks.
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    panelRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closeDropdown(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [closeDropdown, isOpen]);

  // Scroll active item into view.
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (activeIndex < 0 || isDisabled(options[activeIndex])) {
      return;
    }
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isDisabled, isOpen, options]);

  // Hover mode: open menu on trigger mouseenter when another menu is already open.
  // Used by menubar-style navigation in DropdownMenu.
  const handleTriggerMouseEnter = React.useCallback(
    (_event: React.MouseEvent<HTMLButtonElement>) => {
      if (enableHoverMode && !isOpen) {
        openDropdown(-1);
      }
    },
    [enableHoverMode, isOpen, openDropdown],
  );

  const handleTypeahead = React.useCallback(
    (key: string) => {
      if (!enableTypeahead) {
        return;
      }
      const now = Date.now();
      const nextValue =
        now - typeaheadRef.current.updatedAt > TYPEAHEAD_RESET_MS
          ? key
          : `${typeaheadRef.current.value}${key}`;

      typeaheadRef.current = {
        value: nextValue,
        updatedAt: now,
      };

      const startIndex = activeIndex >= 0 ? activeIndex : 0;
      const matchingIndex = findMatchingOptionIndex(
        options,
        nextValue,
        startIndex,
        getOptionLabel,
        isDisabled,
      );

      if (matchingIndex >= 0) {
        if (!isOpen) {
          openDropdown(matchingIndex);
          return;
        }
        setActiveIndex(matchingIndex);
        return;
      }

      // Fallback: search from start with just this keystroke.
      if (nextValue.length > 1) {
        const fallbackIndex = findMatchingOptionIndex(
          options,
          key,
          0,
          getOptionLabel,
          isDisabled,
        );
        if (fallbackIndex >= 0) {
          typeaheadRef.current = {
            value: key,
            updatedAt: now,
          };
          if (!isOpen) {
            openDropdown(fallbackIndex);
            return;
          }
          setActiveIndex(fallbackIndex);
        }
      }
    },
    [
      activeIndex,
      enableTypeahead,
      getOptionLabel,
      isDisabled,
      isOpen,
      openDropdown,
      options,
    ],
  );

  const handleKeyNavigation = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!isOpen) {
          const initial = findFirstEnabledIndex(options, isDisabled);
          openDropdown(initial);
          return;
        }
        const nextIndex = findNextEnabledIndex(
          options,
          activeIndex,
          1,
          isDisabled,
        );
        if (nextIndex >= 0) {
          setActiveIndex(nextIndex);
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!isOpen) {
          const initial = findFirstEnabledIndex(options, isDisabled);
          openDropdown(initial);
          return;
        }
        const startIndex = activeIndex >= 0 ? activeIndex : getInitialActiveIndex();
        const nextIndex = findNextEnabledIndex(
          options,
          startIndex,
          -1,
          isDisabled,
        );
        if (nextIndex >= 0) {
          setActiveIndex(nextIndex);
        }
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        const nextIndex = findFirstEnabledIndex(options, isDisabled);
        if (!isOpen) {
          openDropdown(nextIndex);
          return;
        }
        setActiveIndex(nextIndex);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        // Find last non-disabled item.
        let nextIndex = -1;
        for (let i = options.length - 1; i >= 0; i -= 1) {
          if (!isDisabled(options[i])) {
            nextIndex = i;
            break;
          }
        }
        if (!isOpen) {
          openDropdown(nextIndex);
          return;
        }
        setActiveIndex(nextIndex);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
          return;
        }
        if (activeIndex >= 0) {
          selectIndex(activeIndex);
        }
        return;
      }

      if (event.key === 'Escape') {
        if (!isOpen) {
          return;
        }
        event.preventDefault();
        closeDropdown(true);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const isShift = event.shiftKey;
        closeDropdown(false);

        const focusableSelector = [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'textarea:not([disabled])',
          'select:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', ');
        const root = triggerRef.current?.getRootNode() as
          | Document
          | ShadowRoot
          | null;
        if (root && triggerRef.current) {
          const allFocusable = Array.from(
            root.querySelectorAll<HTMLElement>(focusableSelector),
          );
          const currentIndex = allFocusable.indexOf(triggerRef.current);
          const target = allFocusable[currentIndex + (isShift ? -1 : 1)];
          if (target) {
            requestAnimationFrame(() => target.focus());
          }
        }
        return;
      }

      if (
        enableTypeahead &&
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        handleTypeahead(event.key.toLocaleLowerCase());
      }
    },
    [
      activeIndex,
      closeDropdown,
      enableTypeahead,
      getInitialActiveIndex,
      handleTypeahead,
      isDisabled,
      isOpen,
      openDropdown,
      options,
      selectIndex,
    ],
  );

  const handleTriggerClick = React.useCallback(
    (_event: React.MouseEvent<HTMLButtonElement>) => {
      if (isOpen) {
        closeDropdown(false);
        return;
      }
      openDropdown();
    },
    [closeDropdown, isOpen, openDropdown],
  );

  const handleTriggerBlur = React.useCallback(
    (_event: React.FocusEvent<HTMLButtonElement>) => {
      // Focus management for the trigger is handled by closeDropdown.
      // Keep this handler present so consumers can attach it.
    },
    [],
  );

  const handlePanelBlur = React.useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const relatedTarget = event.relatedTarget as Node | null;
      if (
        relatedTarget &&
        (panelRef.current?.contains(relatedTarget) ||
          triggerRef.current?.contains(relatedTarget))
      ) {
        return;
      }
      // In Tauri/Electron WebViews, blur events from portal'ed elements
      // may have null relatedTarget. Let the pointerdown capture handler
      // close on outside clicks, and the trigger click handler close on toggle.
      if (!relatedTarget) {
        return;
      }
      closeDropdown(false);
    },
    [closeDropdown],
  );

  const getTriggerAria = (): Record<string, unknown> => ({
    'aria-haspopup': role,
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? panelId : undefined,
  });

  const getPanelAria = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {
      role,
      tabIndex: -1,
      'aria-labelledby': labelId,
    };

    if (role === 'listbox') {
      base['aria-activedescendant'] =
        activeIndex >= 0
          ? `${panelId}-option-${activeIndex}`
          : undefined;
    }

    return base;
  };

  return {
    triggerRef,
    panelRef,
    optionRefs,
    isOpen,
    activeIndex,
    panelPosition,
    openDropdown,
    closeDropdown,
    setActiveIndex,
    selectIndex,
    handleKeyNavigation,
    handleTriggerClick,
    handleTriggerBlur,
    handleTriggerMouseEnter,
    handlePanelBlur,
    getTriggerAria,
    getPanelAria,
  };
}
