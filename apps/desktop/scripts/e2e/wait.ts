// Shared `waitFor` utility for Tauri E2E tests.

import { sleep } from './infrastructure.js';

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

/**
 * Poll until `predicate()` returns true, or throw on timeout.
 */
export async function waitFor(
  label: string,
  predicate: () => Promise<boolean>,
  options: WaitOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) return;
      lastError = undefined;
    } catch (err) {
      lastError = err;
    }
    await sleep(intervalMs);
  }

  const suffix = lastError instanceof Error
    ? ` Last error: ${lastError.message}`
    : lastError
      ? ` Last error: ${String(lastError)}`
      : '';
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}
