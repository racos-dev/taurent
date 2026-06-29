/**
 * Mock for @taurent/bridge/logging in automation mode.
 * setupTauriLogging is a no-op since there is no real Tauri logging backend.
 */
export async function setupTauriLogging(): Promise<void> {
  // no-op in automation mode
}
