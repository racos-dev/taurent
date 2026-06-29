type OnceHandler = () => void;

interface WebviewWindowOptions {
  url: string;
  title?: string;
}

interface MockWebviewRecord {
  label: string;
  url: string;
  title: string;
  visible: boolean;
}

declare global {
  interface Window {
    __TAURENT_TAURI_WEBVIEWS__?: {
      getWindows: () => MockWebviewRecord[];
      clearWindows: () => void;
    };
  }
}

const windows = new Map<string, WebviewWindow>();

function snapshotWindows(): MockWebviewRecord[] {
  return [...windows.values()].map((win) => ({
    label: win.label,
    url: win.url,
    title: win.title,
    visible: win.visible,
  }));
}

export class WebviewWindow {
  public visible = false;
  public title: string;
  public url: string;
  private onceHandlers = new Map<string, Set<OnceHandler>>();

  constructor(
    public label: string,
    options: WebviewWindowOptions,
  ) {
    this.url = options.url;
    this.title = options.title ?? '';
    windows.set(label, this);

    queueMicrotask(() => {
      this.fire('tauri://created');
    });
  }

  once(eventName: string, handler: OnceHandler) {
    const handlers = this.onceHandlers.get(eventName) ?? new Set<OnceHandler>();
    handlers.add(handler);
    this.onceHandlers.set(eventName, handlers);
  }

  private fire(eventName: string) {
    const handlers = this.onceHandlers.get(eventName);
    if (!handlers) return;
    this.onceHandlers.delete(eventName);
    for (const handler of handlers) {
      handler();
    }
  }

  async show() {
    this.visible = true;
  }

  async hide() {
    this.visible = false;
  }

  async close() {
    this.visible = false;
  }

  async unminimize() {}

  async setFocus() {}

  async setTitle(title: string) {
    this.title = title;
  }

  async setSize(_size: unknown) {}

  async setResizable(_resizable: boolean) {}

  async setMinSize(_size: unknown) {}

  async setPosition(_position: unknown) {}
}

export async function getAllWebviewWindows() {
  return [...windows.values()];
}

if (typeof window !== 'undefined') {
  window.__TAURENT_TAURI_WEBVIEWS__ = {
    getWindows: () => snapshotWindows(),
    clearWindows: () => {
      windows.clear();
    },
  };
}
