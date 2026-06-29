import React, { useCallback, useRef } from 'react';
import { cn, Check, ICON_SIZES } from '@taurent/shared';
import type { FilterListItemProps } from './types';
import {
  FILTER_LIST_ITEM_CONTROL_SIZE_CLASSES,
  FILTER_LIST_ITEM_LABEL_SIZE_CLASSES,
  useControlDensity,
} from '../../../controlSizing';

const LONG_PRESS_DELAY = 400;

export const FilterListItem = React.memo<FilterListItemProps>(({
  label,
  icon,
  isSelected = false,
  isChild = false,
  summary,
  onPress,
  onLongPress,
  showCheckmark = true,
}) => {
  const density = useControlDensity();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchingRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    if (!onLongPress) return;
    isTouchingRef.current = true;
    longPressTimerRef.current = setTimeout(() => {
      if (isTouchingRef.current) {
        onLongPress();
      }
    }, LONG_PRESS_DELAY);
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    isTouchingRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    isTouchingRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  return (
    <button
      onClick={onPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress?.();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={cn(
        'flex w-full items-center gap-2 text-left transition-colors',
        FILTER_LIST_ITEM_CONTROL_SIZE_CLASSES[density],
        isSelected
          ? 'bg-primary/10 text-primary active:bg-primary/20'
          : 'hover:bg-surface-interactive active:bg-surface-interactive text-text-primary',
        isChild ? 'ml-2' : ''
      )}
    >
      {icon ? (
        <span className={cn('flex-shrink-0', isSelected ? 'text-primary' : 'text-text-secondary')}>
          {icon}
        </span>
      ) : null}
      <span className={cn('flex-1 truncate', FILTER_LIST_ITEM_LABEL_SIZE_CLASSES[density])} title={label}>{label}</span>
      {summary && !isSelected ? (
        <span className={cn('text-text-secondary', FILTER_LIST_ITEM_LABEL_SIZE_CLASSES[density])}>{summary}</span>
      ) : null}
      {showCheckmark && isSelected ? (
        <Check size={ICON_SIZES.md} className="text-primary" />
      ) : null}
    </button>
  );
});

FilterListItem.displayName = 'FilterListItem';
