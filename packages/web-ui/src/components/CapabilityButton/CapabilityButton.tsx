import React from 'react';
import { Button } from '../primitives/Button';

export interface CapabilityButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'title' | 'disabled'> {
  /** Whether the connected server supports this capability. */
  enabled: boolean;
  /** App version where the capability was added (e.g. "v4.2.0"), or null. */
  requiresVersion?: string | null;
  /** Whether the capability was removed from a later qBittorrent version. */
  isRemoved?: boolean;
  /** The version where the capability was removed. Only meaningful when isRemoved is true. */
  removedIn?: string | null;
  /** Whether this capability has no stable qBittorrent release yet. */
  isUnreleased?: boolean;
}

export const CapabilityButton = React.memo(function CapabilityButton({
  enabled,
  requiresVersion,
  isRemoved = false,
  removedIn,
  isUnreleased = false,
  ...buttonProps
}: CapabilityButtonProps) {
  const tooltip = buildTooltip({ enabled, requiresVersion, isRemoved, removedIn, isUnreleased });

  return (
    <Button
      {...buttonProps}
      disabled={!enabled}
      title={tooltip}
    />
  );
});

function buildTooltip({
  enabled,
  requiresVersion,
  isRemoved,
  removedIn,
  isUnreleased,
}: {
  enabled: boolean;
  requiresVersion?: string | null;
  isRemoved: boolean;
  removedIn?: string | null;
  isUnreleased: boolean;
}): string | undefined {
  if (enabled) return undefined;
  if (isRemoved && removedIn) return `Removed in qBittorrent ${removedIn}+`;
  if (isUnreleased) return 'Requires a future qBittorrent release.';
  if (requiresVersion) return `Requires qBittorrent ${requiresVersion}+`;
  return undefined;
}