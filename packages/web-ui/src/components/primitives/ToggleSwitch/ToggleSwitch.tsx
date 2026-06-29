import React from 'react';
import { cn } from '@taurent/shared';
import type { ToggleSwitchProps } from './types';
import { useControlDensity } from '../../../controlSizing';

const TOGGLE_GEOMETRY = {
  desktop: {
    hitWidth: 44,
    hitHeight: 28,
    trackWidth: 44,
    trackHeight: 24,
    thumbSize: 20,
    inset: 2,
  },
  mobile: {
    hitWidth: 64,
    hitHeight: 44,
    trackWidth: 56,
    trackHeight: 32,
    thumbSize: 28,
    inset: 2,
  },
} as const;

export const ToggleSwitch = React.memo<ToggleSwitchProps>(({ checked, onChange }) => {
  const density = useControlDensity();
  const geometry = TOGGLE_GEOMETRY[density];
  const thumbTravel = geometry.trackWidth - geometry.thumbSize - (geometry.inset * 2);
  const thumbTransform = `translateX(${checked ? thumbTravel : 0}px)`;

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      style={{
        width: geometry.hitWidth,
        height: geometry.hitHeight,
      }}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'relative block rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-border-input',
        )}
        style={{
          width: geometry.trackWidth,
          height: geometry.trackHeight,
        }}
      >
        <span
          className="absolute rounded-full bg-text-on-primary shadow-sm transition-transform"
          style={{
            top: geometry.inset,
            left: geometry.inset,
            width: geometry.thumbSize,
            height: geometry.thumbSize,
            transform: thumbTransform,
          }}
        />
      </span>
    </button>
  );
});

ToggleSwitch.displayName = 'ToggleSwitch';
