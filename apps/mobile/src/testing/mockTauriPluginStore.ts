// Mock @tauri-apps/plugin-store for VITE_AUTOMATION=1 browser automation.
// In-memory key-value store backed by a Map.

const stores = new Map<string, Map<string, unknown>>();

/**
 * In-memory Store class that mirrors @tauri-apps/plugin-store's Store API.
 * Each instance is keyed by its `label` and persists data in a shared Map.
 */
export class Store {
  private data: Map<string, unknown>;

  constructor(label: string, _options?: Record<string, unknown>) {
    if (!stores.has(label)) {
      stores.set(label, new Map());
    }
    const data = stores.get(label);
    if (!data) {
      throw new Error(`Store "${label}" was not initialized`);
    }

    this.data = data;
  }

  /** Get a value by key. */
  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  /** Set a value by key. */
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  /** Check if a key exists. */
  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  /** Delete a key. */
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  /** Load the store from disk (no-op in mock). */
  async load(): Promise<void> {
    // No-op: data is already in memory
  }

  /** Save the store to disk (no-op in mock). */
  async save(): Promise<void> {
    // No-op: data is already in memory
  }
}
