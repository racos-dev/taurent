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
 * @returns null if valid, or a human-readable error string if invalid.
 */
export function validateUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'URL is required';
  }

  // If URL has a scheme, validate the full structure
  if (trimmed.includes('://')) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname || parsed.hostname.length === 0) {
        return 'URL hostname is missing';
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  }

  // No scheme — accept it; auto-detect will handle scheme during test connection
  return null;
}