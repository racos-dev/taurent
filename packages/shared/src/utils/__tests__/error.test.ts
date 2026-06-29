import { describe, expect, it } from 'vitest';
import {
  getErrorMessage,
  isError,
  parseApiError,
  isNetworkError,
  isAuthError,
  parseHttpError,
  isConflictError,
  extractHttpReason,
  classifyError,
  formatUserMessage,
  formatUserMessageForContext,
  getErrorMessageForCategory,
} from '../error';

// ─── getErrorMessage ─────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns error.message for Error instances', () => {
    const err = new Error('boom');
    expect(getErrorMessage(err)).toBe('boom');
  });

  it('returns the string itself for plain strings', () => {
    expect(getErrorMessage('just a string')).toBe('just a string');
  });

  it('returns message property for objects with .message', () => {
    expect(getErrorMessage({ message: 'from object' })).toBe('from object');
  });

  it('returns msg property for objects with .msg', () => {
    expect(getErrorMessage({ msg: 'from msg field' })).toBe('from msg field');
  });

  it('prefers .message over .msg when both present', () => {
    expect(getErrorMessage({ message: 'from message', msg: 'from msg' })).toBe('from message');
  });

  it('returns unknown error fallback for non-descriptive objects', () => {
    expect(getErrorMessage({ foo: 'bar' })).toBe('An unknown error occurred');
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
  });

  it('handles number inputs', () => {
    expect(getErrorMessage(42 as unknown)).toBe('An unknown error occurred');
  });
});

// ─── isError ─────────────────────────────────────────────────────────────────

describe('isError', () => {
  it('returns true for Error instances', () => {
    expect(isError(new Error('test'))).toBe(true);
  });

  it('returns false for non-Error objects', () => {
    expect(isError({ message: 'foo' })).toBe(false);
    expect(isError('string error')).toBe(false);
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
  });
});

// ─── parseApiError ───────────────────────────────────────────────────────────

describe('parseApiError', () => {
  it('extracts message from Error', () => {
    const result = parseApiError(new Error('api failure'));
    expect(result.message).toBe('api failure');
  });

  it('extracts message from plain object with message field', () => {
    const result = parseApiError({ message: 'from object' });
    expect(result.message).toBe('from object');
  });

  it('extracts message from plain string', () => {
    const result = parseApiError('plain string error');
    expect(result.message).toBe('plain string error');
  });

  it('returns default message for non-descriptive inputs', () => {
    const result = parseApiError({ foo: 'bar' });
    expect(result.message).toBe('An unknown error occurred');
  });

  it('returns an ApiError shape (message always present, optional fields may be undefined)', () => {
    const result = parseApiError(new Error('test'));
    expect(result).toHaveProperty('message');
    expect(result.message).toBe('test');
  });
});

// ─── isNetworkError ─────────────────────────────────────────────────────────

describe('isNetworkError', () => {
  it('detects network in message', () => {
    expect(isNetworkError(new Error('network error'))).toBe(true);
    expect(isNetworkError(new Error('NETWORK ERROR'))).toBe(true);
  });

  it('detects timeout in message', () => {
    expect(isNetworkError(new Error('request timeout'))).toBe(true);
  });

  it('detects failed to fetch', () => {
    expect(isNetworkError(new Error('failed to fetch'))).toBe(true);
  });

  it('detects connection in message', () => {
    expect(isNetworkError(new Error('connection refused'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isNetworkError(new Error('something else'))).toBe(false);
  });

  it('returns false for non-Error inputs', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

// ─── isAuthError ─────────────────────────────────────────────────────────────

describe('isAuthError', () => {
  it('detects unauthorized', () => {
    expect(isAuthError(new Error('unauthorized'))).toBe(true);
    expect(isAuthError(new Error('UNAUTHORIZED'))).toBe(true);
  });

  it('detects forbidden', () => {
    expect(isAuthError(new Error('forbidden'))).toBe(true);
  });

  it('detects 401 status code', () => {
    expect(isAuthError(new Error('HTTP 401'))).toBe(true);
  });

  it('detects 403 status code', () => {
    expect(isAuthError(new Error('HTTP 403'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isAuthError(new Error('bad request'))).toBe(false);
    expect(isAuthError(new Error('500 server error'))).toBe(false);
  });
});

// ─── parseHttpError ──────────────────────────────────────────────────────────

describe('parseHttpError', () => {
  it('parses HTTP error with Some() wrapper', () => {
    expect(parseHttpError(new Error('HTTP error 409 Some("Category already exists")'))).toEqual({
      status: 409,
      reason: 'Category already exists',
    });
  });

  it('parses HTTP error with bare string', () => {
    expect(parseHttpError(new Error('HTTP error 500 "Internal server error"'))).toEqual({
      status: 500,
      reason: 'Internal server error',
    });
  });

  it('parses HTTP error with single quotes', () => {
    expect(parseHttpError(new Error("HTTP error 409 Some('Category already exists')"))).toEqual({
      status: 409,
      reason: 'Category already exists',
    });
  });

  it('returns null for non-HTTP error messages', () => {
    expect(parseHttpError(new Error('plain error'))).toBeNull();
    expect(parseHttpError(new Error('HTTP error'))).toBeNull();
    expect(parseHttpError(new Error('HTTP error abc'))).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(parseHttpError(null)).toBeNull();
    expect(parseHttpError(undefined)).toBeNull();
  });

  it('returns null for non-Error inputs', () => {
    expect(parseHttpError(null)).toBeNull();
    expect(parseHttpError(undefined)).toBeNull();
  });

  it('returns null for non-numeric status', () => {
    expect(parseHttpError(new Error('HTTP error abc "test"'))).toBeNull();
  });
});

// ─── isConflictError ─────────────────────────────────────────────────────────

describe('isConflictError', () => {
  it('returns true for HTTP 409', () => {
    expect(isConflictError(new Error('HTTP error 409 Some("conflict")'))).toBe(true);
  });

  it('returns false for other HTTP status codes', () => {
    expect(isConflictError(new Error('HTTP error 500 "error"'))).toBe(false);
    expect(isConflictError(new Error('HTTP error 404 "not found"'))).toBe(false);
  });

  it('returns false for non-HTTP errors', () => {
    expect(isConflictError(new Error('plain error'))).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError(undefined)).toBe(false);
  });
});

// ─── extractHttpReason ───────────────────────────────────────────────────────

describe('extractHttpReason', () => {
  it('extracts reason from parsed HTTP error', () => {
    expect(extractHttpReason(new Error('HTTP error 409 Some("Category already exists")'))).toBe(
      'Category already exists',
    );
  });

  it('returns full message when not an HTTP error', () => {
    expect(extractHttpReason(new Error('plain error'))).toBe('plain error');
  });

  it('returns full message for non-Error inputs', () => {
    expect(extractHttpReason('some error string')).toBe('some error string');
  });
});

// ─── classifyError ───────────────────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies unauthorized as auth', () => {
    expect(classifyError(new Error('unauthorized'))).toBe('auth');
  });

  it('classifies forbidden as auth', () => {
    expect(classifyError(new Error('forbidden'))).toBe('auth');
  });

  it('classifies 401 as auth', () => {
    expect(classifyError(new Error('HTTP error 401'))).toBe('auth');
  });

  it('classifies 403 as auth', () => {
    expect(classifyError(new Error('HTTP error 403'))).toBe('auth');
  });

  it('classifies network error as network', () => {
    expect(classifyError(new Error('network error'))).toBe('network');
  });

  it('classifies timeout as network', () => {
    expect(classifyError(new Error('request timeout'))).toBe('network');
  });

  it('classifies failed to fetch as network', () => {
    expect(classifyError(new Error('failed to fetch'))).toBe('network');
  });

  it('classifies connection refused as network', () => {
    expect(classifyError(new Error('connection refused'))).toBe('network');
  });

  it('classifies HTTP 409 as conflict before generic HTTP', () => {
    expect(classifyError(new Error('HTTP error 409 Some("Category already exists")'))).toBe('conflict');
  });

  it('auth takes precedence over network when both patterns match', () => {
    expect(classifyError(new Error('unauthorized network connection'))).toBe('auth');
  });

  it('classifies unrelated errors as unknown', () => {
    expect(classifyError(new Error('something else'))).toBe('unknown');
  });

  it('classifies null as unknown', () => {
    expect(classifyError(null)).toBe('unknown');
  });

  it('classifies undefined as unknown', () => {
    expect(classifyError(undefined)).toBe('unknown');
  });

  it('classifies plain string input', () => {
    expect(classifyError('unauthorized access')).toBe('auth');
    expect(classifyError('network timeout')).toBe('network');
    expect(classifyError('generic failure')).toBe('unknown');
  });
});

// ─── getErrorMessageForCategory ──────────────────────────────────────────────

describe('getErrorMessageForCategory', () => {
  it('returns auth message for auth category', () => {
    const msg = getErrorMessageForCategory('auth', 'raw error');
    expect(msg).toContain('Authentication failed');
    expect(msg).toContain('Check your username and password');
  });

  it('returns network message for network category', () => {
    const msg = getErrorMessageForCategory('network', 'raw error');
    expect(msg).toContain('Cannot reach the server');
    expect(msg).toContain('network connection');
  });

  it('returns fallback for unknown category', () => {
    expect(getErrorMessageForCategory('unknown', 'raw error text')).toBe('raw error text');
  });
});

// ─── user-facing formatting ──────────────────────────────────────────────────

describe('formatUserMessage', () => {
  it('uses concise auth copy', () => {
    expect(formatUserMessage(new Error('HTTP error 401 Unauthorized'))).toBe(
      'Authentication failed. Check your username and password.',
    );
  });

  it('uses concise network copy', () => {
    expect(formatUserMessage(new Error('network error: connection refused ECONNREFUSED'))).toBe(
      'Cannot reach the server. Check the address and your network connection.',
    );
  });

  it('preserves actionable duplicate conflict reasons', () => {
    expect(formatUserMessage(new Error('HTTP error 409 Some("Category already exists")'))).toBe(
      'Category already exists',
    );
  });

  it('maps non-actionable unknown backend text to the context fallback', () => {
    expect(formatUserMessageForContext(new Error('Backend returned invalid search ID: -1'), 'search')).toBe(
      'Search failed. Try again.',
    );
  });

  it('preserves validation-like unknown messages', () => {
    expect(formatUserMessageForContext(new Error('Please enter a search query'), 'search')).toBe(
      'Please enter a search query',
    );
    expect(formatUserMessageForContext(new Error('Invalid URL format'), 'add-server')).toBe(
      'Invalid URL format',
    );
  });

  it('uses the generic fallback without context', () => {
    expect(formatUserMessage(new Error('MockSyncError'))).toBe('Something went wrong. Try again.');
  });
});
