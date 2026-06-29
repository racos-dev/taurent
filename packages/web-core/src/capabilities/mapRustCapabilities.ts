import type { RustResolvedCapabilities } from '@taurent/bridge';

export interface AppCapabilities {
  supportsSearch: boolean | null;
  supportsRss: boolean | null;
  supportsPauseResume: boolean | null;
  hasUnknownCapabilities: boolean;
}

/**
 * Maps the Rust-resolved tri-state capabilities into the simplified AppCapabilities
 * format consumed by the UI layer.
 *
 * - 'confirmed' → true
 * - 'unsupported' → false
 * - 'unknown' → null (and sets hasUnknownCapabilities = true)
 */
export function mapRustCapabilitiesToFlags(
  capabilities: RustResolvedCapabilities,
): AppCapabilities {
  let hasUnknownCapabilities = false;

  const resolve = (value: string): boolean | null => {
    if (value === 'confirmed') return true;
    if (value === 'unsupported') return false;
    hasUnknownCapabilities = true;
    return null;
  };

  return {
    supportsSearch: resolve(capabilities.supports_search),
    supportsRss: resolve(capabilities.supports_rss),
    supportsPauseResume: resolve(capabilities.supports_pause_resume),
    hasUnknownCapabilities,
  };
}
