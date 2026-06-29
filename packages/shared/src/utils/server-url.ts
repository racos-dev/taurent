/**
 * Normalize qBittorrent server URL
 * - Removes trailing slashes
 * - Removes /api/v2 suffix
 * - Adds https:// prefix if missing (configurable via defaultScheme)
 */
export function normalizeServerUrl(url: string, defaultScheme: string = 'https://'): string {
  let normalized = url.trim();

  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.endsWith("/api/v2")) {
    normalized = normalized.replace("/api/v2", "");
  }

  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `${defaultScheme}${normalized}`;
  }

  return normalized;
}