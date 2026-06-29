import React from 'react';
import { cn, Icon, ICON_SIZES } from '@taurent/shared';
import type { ScreenHeaderProps } from './types';
import { IconButton } from '../../primitives/IconButton';
import {
  useControlDensity,
  HEADER_ICON_BUTTON_SIZE_CLASSES,
} from '../../../controlSizing';

const MOBILE_WIDTH_CLASSES: Record<NonNullable<ScreenHeaderProps['mobileWidth']>, string> = {
  compact: 'max-w-lg',
  wide: 'max-w-3xl',
};

export const ScreenHeader = React.memo<ScreenHeaderProps>(({
  title,
  subtitle,
  onBack,
  rightAction,
  variant = 'desktop',
  leftIcon,
  mobileWidth = 'compact',
}) => {
  const isMobile = variant === 'mobile';
  const density = useControlDensity();
  const iconButtonSize = HEADER_ICON_BUTTON_SIZE_CLASSES[density];

  if (!isMobile) {
    return (
      <header className="sticky top-0 z-10 border-b bg-surface border-divider px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack ? (
            <IconButton
              onClick={onBack}
              title="Back"
              variant="outline"
            >
              <Icon name="arrow-left" size={ICON_SIZES.lg} />
            </IconButton>
          ) : null}
          {leftIcon}
          <h1 className="font-semibold text-text-primary text-lg flex-1">
            {title}
          </h1>
          {rightAction}
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-20 touch-none select-none border-b border-border bg-background/90 px-2 py-2 backdrop-blur-lg"
    >
      <div
        className={cn(
          'mx-auto grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-2',
          MOBILE_WIDTH_CLASSES[mobileWidth],
        )}
      >
        <div className="flex min-w-0 justify-start">
          {onBack ? (
            <IconButton
              onClick={onBack}
              title="Back"
              variant="outline"
            >
              <Icon name="arrow-left" size={ICON_SIZES.lg} />
            </IconButton>
          ) : null}
        </div>

        <div className="min-w-0 text-center">
          <h1 className="truncate text-sm font-semibold text-text-primary">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 truncate text-xs text-text-secondary">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 justify-end">
          {rightAction ? rightAction : onBack ? (
            <div className={cn('shrink-0', iconButtonSize)} aria-hidden="true" />
          ) : null}
        </div>
      </div>
    </header>
  );
});

ScreenHeader.displayName = 'ScreenHeader';
