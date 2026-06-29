// Mock @tauri-apps/plugin-dialog for VITE_AUTOMATION=1 browser automation.
// Returns null for all dialog operations (no real file picker in headless mode).

/**
 * Stub for the dialog `open` function.
 * In automation mode there is no real file picker, so this always resolves to null.
 */
export async function open(_options?: Record<string, unknown>): Promise<string | string[] | null> {
  return null;
}
