import type { AppCapabilities } from './generated/app-capabilities';
import { CAPABILITY_ADDED_IN, CAPABILITY_REMOVED_IN } from './generated/app-capabilities';

/** A camelCase capability name from AppCapabilities. */
export type CapabilityName = keyof AppCapabilities;

/** Resolved status of a single capability against the connected server. */
export interface CapabilityStatus {
  /** Whether the connected server supports this capability. */
  enabled: boolean;
  /** App version where the capability was added (e.g. "v4.2.0"), or "unreleased", or null. */
  requiresVersion: string | null;
  /** Whether this capability was removed from qBittorrent. */
  isRemoved: boolean;
  /** Version where removed. Only meaningful when isRemoved is true. */
  removedIn: string | null;
  /** Whether this capability has no stable qBittorrent release yet. */
  isUnreleased: boolean;
}

/**
 * Pure synchronous lookup for a single capability. No React dependency — callers
 * provide `capabilities` from `useQBClient()` or any `AppCapabilities` value.
 */
export function getCapabilityStatus(
  capabilities: AppCapabilities,
  capName: CapabilityName,
): CapabilityStatus {
  const enabled = capabilities[capName];
  const requiresVersion = CAPABILITY_ADDED_IN[capName] ?? null;
  const removedIn = CAPABILITY_REMOVED_IN[capName] ?? null;
  const isRemoved = removedIn !== null;
  const isUnreleased = requiresVersion === 'unreleased';

  return { enabled, requiresVersion, isRemoved, removedIn, isUnreleased };
}