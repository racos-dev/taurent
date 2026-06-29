/**
 * Error Utilities
 * 
 * Centralized error handling utilities for consistent error processing
 * and type-safe error handling throughout the application.
 */

/**
 * Safely extracts error message from unknown error types
 * 
 * @param error - Unknown error object
 * @returns Human-readable error message
 * 
 * @example
 * try {
 *   await apiCall();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   Alert.alert('Error', message);
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  if (error && typeof error === 'object' && 'msg' in error) {
    return String(error.msg);
  }
  
  return 'An unknown error occurred';
}

/**
 * Type guard for Error instances
 * 
 * @param error - Unknown error object
 * @returns True if error is an Error instance
 * 
 * @example
 * if (isError(error)) {
 *   console.error(error.stack);
 * }
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Centralized error type for API responses
 */
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * Parse API response errors
 * 
 * @param error - Unknown error object
 * @returns Structured API error
 * 
 * @example
 * try {
 *   await apiCall();
 * } catch (error) {
 *   const apiError = parseApiError(error);
 *   if (apiError.status === 401) {
 *     // Handle unauthorized
 *   }
 * }
 */
export function parseApiError(error: unknown): ApiError {
  const message = getErrorMessage(error);
  
  return {
    message,
    // Add more parsing if API returns structured errors
  };
}

/**
 * Check if error is a network error
 * 
 * @param error - Unknown error object
 * @returns True if error appears to be network-related
 */
export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('connection')
  );
}

/**
 * Check if error is an authentication error
 * 
 * @param error - Unknown error object
 * @returns True if error appears to be auth-related
 */
export function isAuthError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403')
  );
}

/**
 * Parsed representation of a flattened HTTP error string.
 * 
 * @example
 * parseHttpError("HTTP error 409 Some(\"Category already exists\")")
 * // => { status: 409, reason: "Category already exists" }
 */
export interface ParsedHttpError {
  status: number;
  reason: string;
}

/**
 * Attempt to parse a flattened HTTP error string into structured parts.
 * 
 * Handles patterns like:
 * - "HTTP error 409 Some(\"Category already exists\")"
 * - "HTTP error 409 \"Category already exists\""
 * - "HTTP error 500 Some(\"Internal server error\")"
 * 
 * @param error - Unknown error object
 * @returns Parsed HTTP error or null if pattern doesn't match
 */
export function parseHttpError(error: unknown): ParsedHttpError | null {
  const message = getErrorMessage(error);
  
  // Match "HTTP error <status> Some(\"<reason>\")" or "HTTP error <status> \"<reason>\""
  const match = message.match(/^HTTP error (\d+)\s+(?:Some\()?["'](.*?)["')]\)?$/);
  if (!match) return null;
  
  const status = parseInt(match[1], 10);
  const reason = match[2];
  
  if (isNaN(status)) return null;
  
  return { status, reason };
}

/**
 * Check if error is an HTTP 409 conflict error.
 * 
 * Common conflict scenarios include:
 * - Category/tag rename conflicts (name already exists)
 * - Resource already exists
 * 
 * @param error - Unknown error object
 * @returns True if error is an HTTP 409 conflict
 */
export function isConflictError(error: unknown): boolean {
  const parsed = parseHttpError(error);
  return parsed !== null && parsed.status === 409;
}

/**
 * Extract the human-readable reason from a flattened HTTP error.
 * 
 * @param error - Unknown error object
 * @returns The reason string, or the full message if not a parsed HTTP error
 * 
 * @example
 * extractHttpReason("HTTP error 409 Some(\"Category already exists\")")
 * // => "Category already exists"
 */
export function extractHttpReason(error: unknown): string {
  const parsed = parseHttpError(error);
  return parsed ? parsed.reason : getErrorMessage(error);
}

/**
 * Check if error is an HTTP error (Rust Display format: "HTTP error <status> ...")
 *
 * @param error - Unknown error object
 * @returns True if error matches HTTP error pattern
 */
export function isHttpError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /^HTTP error \d+/i.test(message);
}

/**
 * Check if error is a parse error (Rust Display format: "parse error: ...")
 *
 * @param error - Unknown error object
 * @returns True if error matches parse error pattern
 */
export function isParseError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.toLowerCase().startsWith('parse error:');
}

/**
 * Check if error is an invalid response error (Rust Display format: "invalid response: ...")
 *
 * @param error - Unknown error object
 * @returns True if error matches invalid response pattern
 */
export function isInvalidResponseError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.toLowerCase().startsWith('invalid response:');
}

/**
 * Extended error category classification covering all user-facing error types.
 */
export type ErrorCategory = 'auth' | 'network' | 'http' | 'conflict' | 'parse' | 'invalid-response' | 'unknown';

/**
 * Classify an error into a broad cause category.
 * Uses existing `isAuthError` and `isNetworkError` checks;
 * auth takes precedence over network when both patterns match.
 */
export function classifyError(error: unknown): ErrorCategory {
  if (isAuthError(error)) return 'auth';
  if (isNetworkError(error)) return 'network';
  if (isConflictError(error)) return 'conflict';
  if (isHttpError(error)) return 'http';
  if (isParseError(error)) return 'parse';
  if (isInvalidResponseError(error)) return 'invalid-response';
  return 'unknown';
}

const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  auth: 'Authentication failed. Check your username and password.',
  network: 'Cannot reach the server. Check the address and your network connection.',
  http: 'The server returned an error. Try again.',
  conflict: 'This item already exists.',
  parse: 'Could not read the server response. Try again.',
  'invalid-response': 'Could not read the server response. Try again.',
  unknown: 'Something went wrong. Try again.',
};

export type ErrorMessageContext =
  | 'add-server'
  | 'add-torrent'
  | 'app-settings'
  | 'connection'
  | 'file-picker'
  | 'native-menu'
  | 'path-mappings'
  | 'rss'
  | 'search'
  | 'server-switch'
  | 'settings-load'
  | 'settings-save'
  | 'speed-limits'
  | 'torrent-action';

const CONTEXT_FALLBACK_MESSAGES: Record<ErrorMessageContext, string> = {
  'add-server': 'Could not add the server. Try again.',
  'add-torrent': 'Could not add the torrent. Try again.',
  'app-settings': 'Could not update app settings. Try again.',
  connection: 'Could not connect to the server. Try again.',
  'file-picker': 'Could not select torrent files. Try again.',
  'native-menu': 'Could not update the app menu.',
  'path-mappings': 'Could not update path mappings. Try again.',
  rss: 'Could not load RSS data. Try again.',
  search: 'Search failed. Try again.',
  'server-switch': 'Could not switch servers. Try again.',
  'settings-load': 'Could not load settings. Try again.',
  'settings-save': 'Could not save settings. Try again.',
  'speed-limits': 'Could not update speed limits. Try again.',
  'torrent-action': 'Torrent action failed. Try again.',
};

/**
 * Strip Rust Display artifacts from error messages.
 * Removes prefixes like "auth error: ", "HTTP error ", "parse error: ",
 * "network error: ", "invalid response: " and Some(...) wrappers.
 */
function stripRustDisplayArtifacts(message: string): string {
  let result = message;

  // Strip known prefixes
  const prefixes = [
    /^auth error:\s*/i,
    /^HTTP error \d+\s*/i,
    /^parse error:\s*/i,
    /^network error:\s*/i,
    /^invalid response:\s*/i,
  ];
  for (const prefix of prefixes) {
    result = result.replace(prefix, '');
  }

  // Strip Some(...) and None wrappers
  result = result.replace(/\bSome\((["'])(.*)\1\)/g, '$2');
  result = result.replace(/\bNone\b/g, '');

  return result.trim();
}

function isDescriptiveUnknownMessage(message: string): boolean {
  const cleaned = stripRustDisplayArtifacts(message);
  const lower = cleaned.toLowerCase();

  if (!cleaned || cleaned === 'An unknown error occurred') return false;
  if (lower.startsWith('error:')) return false;
  if (/^(backend|internal|mock|rust|tauri)\b/i.test(cleaned)) return false;
  if (/^(failed|could not|cannot|unable|please|invalid|missing|required|a |an |the |this )\b/i.test(cleaned)) {
    return true;
  }
  if (/\b(already exists|not found|not available|is required|must be|out of range)\b/i.test(cleaned)) {
    return true;
  }

  return false;
}

function formatConflictMessage(error: unknown): string {
  const reason = extractHttpReason(error);
  const cleaned = stripRustDisplayArtifacts(reason);
  if (/\balready exists\b/i.test(cleaned)) {
    return cleaned;
  }
  return ERROR_MESSAGES.conflict;
}

/**
 * Format an error into a user-friendly message.
 * Classifies the error and returns an appropriate human-readable message,
 * stripping Rust Display artifacts from the raw message.
 */
export function formatUserMessage(error: unknown): string {
  return formatUserMessageForContext(error);
}

/**
 * Format an error for visible UI. Runtime/backend details are mapped to
 * concise categories; actionable validation/conflict copy can pass through.
 */
export function formatUserMessageForContext(
  error: unknown,
  context?: ErrorMessageContext,
): string {
  const category = classifyError(error);

  if (category === 'conflict') {
    return formatConflictMessage(error);
  }

  if (category === 'unknown') {
    const rawMessage = getErrorMessage(error);
    const cleaned = stripRustDisplayArtifacts(rawMessage);
    if (isDescriptiveUnknownMessage(cleaned)) {
      return cleaned;
    }
    if (context) {
      return CONTEXT_FALLBACK_MESSAGES[context];
    }
    return ERROR_MESSAGES.unknown;
  }

  return ERROR_MESSAGES[category];
}

/**
 * Return a human-readable message for an error category, falling back
 * to the provided message when the category is unknown or the
 * original message carries more specific detail worth preserving.
 */
export function getErrorMessageForCategory(
  category: ErrorCategory,
  fallback: string,
): string {
  if (category === 'unknown') return fallback;
  return ERROR_MESSAGES[category];
}
