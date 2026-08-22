/**
 * URL validation utility for server URL input.
 *
 * Normalization is delegated to the bridge (`bridgeServers.normalizeServerUrl`).
 */

/**
 * Validates a URL string.
 *
 * Accepts URLs with or without a scheme. When a scheme is present, validates
 * the full URL structure. Without a scheme, only checks that the input is
 * non-empty (auto-detect will handle scheme during test connection).
 *
 * @returns null if valid, or a semantic validation code if invalid.
 */
export type ServerUrlValidationError = 'urlRequired' | 'urlHostnameMissing' | 'invalidUrl';

export function validateUrl(url: string): ServerUrlValidationError | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'urlRequired';
  }

  // If URL has a scheme, validate the full structure
  if (trimmed.includes('://')) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname || parsed.hostname.length === 0) {
        return 'urlHostnameMissing';
      }
      return null;
    } catch {
      return 'invalidUrl';
    }
  }

  // No scheme — accept it; auto-detect will handle scheme during test connection
  return null;
}
