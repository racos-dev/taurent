import { getAllWebviewWindows } from './mockTauriWebviewWindow';

export interface CloseRequestedEvent {
  preventDefault: () => void;
}

type CloseRequestedHandler = (event: CloseRequestedEvent) => void | Promise<void>;

function resolveWindowLabel(): string {
  if (typeof window === 'undefined') return 'automation-window';

  switch (window.location.pathname) {
    case '/dialog-host-window':
      return 'dialog-host';
    case '/settings-window':
      return 'settings';
    case '/statistics-window':
      return 'statistics';
    case '/add-torrent-window':
      return 'add-torrent';
    default:
      return 'main';
  }
}

class MockWindow {
  private closeRequestedHandlers = new Set<CloseRequestedHandler>();
  private visible = true;
  private position = { x: 80, y: 80 };
  private size = { width: 1280, height: 800 };

  get label() {
    return resolveWindowLabel();
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

  async setTitle(_title: string) {}

  async setSize(_size: unknown) {}

  async setPosition(position: unknown) {
    if (position && typeof position === 'object' && 'x' in position && 'y' in position) {
      this.position = {
        x: Number((position as { x: unknown }).x),
        y: Number((position as { y: unknown }).y),
      };
    }
  }

  async setMinSize(_size: unknown) {}

  async isVisible() {
    return this.visible;
  }

  async outerPosition() {
    return this.position;
  }

  async outerSize() {
    return this.size;
  }

  async innerSize() {
    return this.size;
  }

  async setFocus() {}

  async onCloseRequested(handler: CloseRequestedHandler) {
    this.closeRequestedHandlers.add(handler);

    return () => {
      this.closeRequestedHandlers.delete(handler);
    };
  }

  async requestClose() {
    let prevented = false;
    const event: CloseRequestedEvent = {
      preventDefault: () => {
        prevented = true;
      },
    };

    for (const handler of this.closeRequestedHandlers) {
      await handler(event);
    }

    return !prevented;
  }
}

const currentWindow = new MockWindow();

declare global {
  interface Window {
    __TAURENT_TAURI_WINDOW__?: {
      requestClose: () => Promise<boolean>;
      isVisible: () => Promise<boolean>;
      label: () => string;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__TAURENT_TAURI_WINDOW__ = {
    requestClose: () => currentWindow.requestClose(),
    isVisible: () => currentWindow.isVisible(),
    label: () => currentWindow.label,
  };
}

export function getCurrentWindow() {
  return currentWindow;
}

export const Window = {
  async getByLabel(label: string) {
    if (label === currentWindow.label) {
      return currentWindow;
    }

    const windows = await getAllWebviewWindows();
    return windows.find((win) => win.label === label) ?? null;
  },
};

export async function availableMonitors() {
  return [{
    name: 'Mock Monitor',
    size: { width: 1920, height: 1080 },
    position: { x: 0, y: 0 },
    workArea: {
      size: { width: 1920, height: 1040 },
      position: { x: 0, y: 0 },
    },
    scaleFactor: 1,
  }];
}
