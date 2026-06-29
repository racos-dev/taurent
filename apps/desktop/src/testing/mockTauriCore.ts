/**
 * No-op mock for `@tauri-apps/api/core` used during Playwright E2E runs
 * (VITE_AUTOMATION=1). Prevents the production bridge's import of
 * `@tauri-apps/api/core` from breaking Vite module graph resolution
 * before the mock bridge can set `window.__TAURENT_AUTOMATION__`.
 */
export async function invoke<T>(_command: string, _payload?: unknown): Promise<T> {
  return {} as T;
}

export async function transformImage(_path: string): Promise<string> {
  return _path;
}

/**
 * Stub for Tauri's Resource base class.
 * Required by plugins that extend Resource (e.g. plugin-store) during
 * Vite dependency optimization in Playwright runs.
 */
export class Resource {
  constructor(_rid?: number) {}

  async close(): Promise<void> {
    // no-op in automation mock
  }
}
