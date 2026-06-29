import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  ContextMenuItem,
  PanelPosition,
  UseContextMenuOptions,
  UseContextMenuReturn,
} from './types';

const VIEWPORT_PADDING = 8;

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.min(Math.max(value, min), max);
}

function isInsideSubMenu(el: Node | null): boolean {
  return el !== null && 'closest' in (el as Element) && (el as Element).closest('[data-contextmenu-type="submenu"]') !== null;
}

/** Collect only enabled navigable items, preserving their original indices. */
function getNavigableItems(
  items: ContextMenuItem[],
  isItemDisabled: (item: ContextMenuItem) => boolean
): Array<{ item: ContextMenuItem; index: number }> {
  const navigable: Array<{ item: ContextMenuItem; index: number }> = [];
  items.forEach((item, i) => {
    if ((item.kind === 'item' || item.kind === 'submenu') && !isItemDisabled(item)) {
      navigable.push({ item, index: i });
    }
  });
  return navigable;
}

/**
 * Manages coordinate-based context menu behavior: viewport-aware positioning,
 * keyboard navigation, and outside-click dismiss.
 *
 * @see ContextMenu/types.ts for input/output types.
 */
export function useContextMenu({
  x,
  y,
  items,
  isItemDisabled,
  onSelect,
  onClose,
}: UseContextMenuOptions): UseContextMenuReturn {
  const [isOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(() => ({
    top: y,
    left: x,
    maxHeight: Math.max(window.innerHeight - y - VIEWPORT_PADDING, 0),
  }));

  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  // ─── Focus on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // ─── Viewport positioning ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Clamp left so the panel stays within the viewport with padding.
    const left = clamp(x, VIEWPORT_PADDING, viewportWidth - rect.width - VIEWPORT_PADDING);

    // Clamp top so the panel stays within the viewport with padding.
    // If there isn't enough room below, flip above the cursor.
    const spaceBelow = viewportHeight - y;
    let top: number;
    let maxHeight: number;

    if (rect.height <= spaceBelow - VIEWPORT_PADDING) {
      // Open downward.
      top = clamp(y, VIEWPORT_PADDING, viewportHeight - rect.height - VIEWPORT_PADDING);
      maxHeight = viewportHeight - top - VIEWPORT_PADDING;
    } else {
      // Flip upward.
      const spaceAbove = y;
      top = clamp(spaceAbove - rect.height, VIEWPORT_PADDING, viewportHeight - rect.height - VIEWPORT_PADDING);
      maxHeight = spaceAbove - VIEWPORT_PADDING;
    }

    setPanelPosition({ top, left, maxHeight: Math.max(maxHeight, 0) });
  }, [x, y]);

  // ─── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    function handleKeyDown(e: KeyboardEvent) {
      const navigable = getNavigableItems(items, isItemDisabled);
      if (navigable.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const current = navigable.findIndex(({ index }) => index === activeIndex);
          const nextIdx = (current + 1) % navigable.length;
          setActiveIndex(navigable[nextIdx].index);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const current = navigable.findIndex(({ index }) => index === activeIndex);
          const prevIdx = (current - 1 + navigable.length) % navigable.length;
          setActiveIndex(navigable[prevIdx].index);
          break;
        }
        case 'ArrowRight':
        case 'ArrowLeft': {
          // handled in ContextMenuSubMenu
          break;
        }
        case 'Home': {
          e.preventDefault();
          setActiveIndex(navigable[0].index);
          break;
        }
        case 'End': {
          e.preventDefault();
          setActiveIndex(navigable[navigable.length - 1].index);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const activeItem = navigable.find(({ index }) => index === activeIndex);
          if (activeItem && activeItem.item.kind === 'item') {
            onSelect(activeItem.item);
            onClose();
          }
          break;
        }
        case 'Escape': {
          onClose();
          break;
        }
        default:
          break;
      }
    }

    panel.addEventListener('keydown', handleKeyDown);
    return () => panel.removeEventListener('keydown', handleKeyDown);
  }, [items, activeIndex, isItemDisabled, onSelect, onClose]);

  // ─── Outside-click dismiss ─────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const panelEl = panelRef.current;
      if (!panelEl) return;
      const target = e.target as Node;
      if (!panelEl.contains(target) && !isInsideSubMenu(target)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // ─── Scroll active item into view ──────────────────────────────────────────
  useEffect(() => {
    const itemEl = activeIndex >= 0 ? itemRefs.current.get(activeIndex) : null;
    itemEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);


  const handlePanelBlur = useCallback((_event: React.FocusEvent<HTMLDivElement>) => {
    requestAnimationFrame(() => {
      const panelEl = panelRef.current;
      if (panelEl && !panelEl.contains(document.activeElement) && !isInsideSubMenu(document.activeElement)) {
        onClose();
      }
    });
  }, [onClose]);

  const registerItemRef = useCallback((index: number) => (node: HTMLElement | null) => {
    if (node) {
      itemRefs.current.set(index, node);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);


  return {
    panelRef,
    panelPosition,
    isOpen,
    activeIndex,
    registerItemRef,
    handlePanelBlur,
  };
}
