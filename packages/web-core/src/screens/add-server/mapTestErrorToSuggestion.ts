/**
 * Maps connection test error patterns to actionable user suggestions.
 */

import { classifyError } from '@taurent/shared/utils/error';

interface SuggestionMap {
  pattern: RegExp;
  suggestion: string;
}

const SUGGESTION_MAPS: SuggestionMap[] = [
  {
    pattern: /(?:connection\s+refused ECONNREFUSED|econnrefused)/i,
    suggestion: 'Make sure qBittorrent Web UI is enabled and the port is correct.',
  },
  {
    pattern: /(?:timeout etimedout|etimedout)/i,
    suggestion: 'The server is not responding. Check the address and your network connection.',
  },
  {
    pattern: /(?:unauthorized|401|403)/i,
    suggestion: 'Check your username and password.',
  },
  {
    pattern: /(?:invalid\s+url|parse\s+error)/i,
    suggestion: 'Check your server URL format.',
  },
  {
    pattern: /(?:certificate|ssl|tls)/i,
    suggestion: 'There may be a certificate issue. Try using http:// instead of https://.',
  },
];

/**
 * Maps a connection test error string to an actionable suggestion.
 *
 * @returns A suggestion string if the error matches a known pattern,
 *          or null for unrecognized errors (UI will show raw error).
 */
export function mapTestErrorToSuggestion(error: string): string | null {
  if (!error) return null;

  // First, use classifyError for broad categorization
  const category = classifyError(error);

  // Check specific patterns first (higher priority)
  for (const { pattern, suggestion } of SUGGESTION_MAPS) {
    if (pattern.test(error)) {
      return suggestion;
    }
  }

  // Fall back to category-based suggestions
  switch (category) {
    case 'auth':
      return 'Check your username and password.';
    case 'network':
      return 'The server is not responding. Check the address and your network connection.';
    default:
      return null;
  }
}