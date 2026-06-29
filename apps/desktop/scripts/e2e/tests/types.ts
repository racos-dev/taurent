// Shared test types for Tauri E2E tests.

import type { Browser } from 'webdriverio';

// ---------------------------------------------------------------------------
// Backend session
// ---------------------------------------------------------------------------

export interface FakeBackendSession {
  cookie: string;
}

export interface FakeBackendResponse {
  status: number;
  text: string;
  headers: Headers;
}

// ---------------------------------------------------------------------------
// Test context
// ---------------------------------------------------------------------------

export interface TestContext {
  browser: Browser;
  fakeUrl: string;
  backendSession: FakeBackendSession;
  mainHandle: string;
  baseHandleCount: number;
}

// ---------------------------------------------------------------------------
// Test module shape
// ---------------------------------------------------------------------------

export interface TestModule {
  name: string;
  timeoutMs: number;
  run: (ctx: TestContext) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Diagnostic types (re-exported from helpers for convenience)
// ---------------------------------------------------------------------------

export type { WebDriverDiagnostics } from '../helpers.js';