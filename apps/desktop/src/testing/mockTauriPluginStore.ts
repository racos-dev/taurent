const stores = new Map<string, Map<string, unknown>>();

function getStoreData(label: string): Map<string, unknown> {
  let data = stores.get(label);
  if (!data) {
    data = new Map();
    stores.set(label, data);
  }
  return data;
}

export class Store {
  private data: Map<string, unknown>;

  constructor(label: string, _options?: Record<string, unknown>) {
    this.data = getStoreData(label);
  }

  static async load(label: string, options?: Record<string, unknown>) {
    const store = new Store(label, options);
    await store.load();
    return store;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }

  async load(): Promise<void> {}

  async save(): Promise<void> {}
}
