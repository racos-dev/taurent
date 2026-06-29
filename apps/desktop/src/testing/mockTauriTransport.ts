// Mock Tauri transport for VITE_AUTOMATION=1 browser automation.
// Stubs all transport functions and listener factories imported by desktop code
// from `@taurent/bridge/transport/tauri`.
import type { Transport } from '@taurent/bridge/transport/transport';
import type { UnlistenFn } from '@taurent/bridge/transport/transport';
import type {
  OperationFailedEvent,
  ResourceInvalidatedEvent,
  SessionChangedEvent,
  ThemeChangedEvent,
} from '@taurent/bridge/events';
import type { MaindataSyncChangedEvent, WorkspaceView } from '@taurent/bridge/types';

// ─── DnD Kit headless suppression ──────────────────────────────────────────
//
// In headless Chromium there are no real pointer events, so DnD Kit's
// PointerSensor.getPointerId() throws "Cannot read properties of undefined
// (reading 'pointerId')" when it encounters synthetic events.
//
// We suppress this by patching global Event classes to return a stable
// pointerId.  This runs at module-load time (before React boots) via the
// VITE_AUTOMATION alias so it affects both Vite dev and Playwright tests.

function patchPointerEventsForHeadless() {
  if (typeof window === 'undefined') return;
  try {
    const nativeDescriptor = Object.getOwnPropertyDescriptor(PointerEvent.prototype, 'pointerId');
    if (nativeDescriptor?.get == null) return;
    // Make PointerEvent.pointerId return 1 instead of undefined for all synthetic events
    // so PointerSensor's getPointerId() never throws.
    // We do this once at load time — it survives module re-evaluation because
    // it patches the shared global.
    if ((PointerEvent.prototype as { __taurentPatchedPointerId?: boolean }).__taurentPatchedPointerId) return;
    Object.defineProperty(PointerEvent.prototype, 'pointerId', {
      get() {
        const val = nativeDescriptor.get?.call(this);
        if (val !== undefined) return val;
        // Fallback: assign a stable pointerId for synthetic events (headless case)
        return 1;
      },
      configurable: true,
    });
    Object.defineProperty(PointerEvent.prototype, '__taurentPatchedPointerId', {
      value: true,
      configurable: true,
    });
  } catch {
    // If for any reason we can't patch, silently skip — real browsers are unaffected.
  }
}

// Only run in automation mode (Vite dev server with VITE_AUTOMATION=1)
if (typeof window !== 'undefined') {
  patchPointerEventsForHeadless();
}

// Mock transport that does nothing
function noopTransport(): Transport {
  return {
    invoke: async <T>(_cmd: string, _args?: Record<string, unknown>): Promise<T> => {
      return {} as T;
    },
    listen: async <T>(_event: string, _handler: (payload: T) => void): Promise<UnlistenFn> => {
      return async () => {};
    },
  };
}

export const createTauriTransport = noopTransport;

export type { UnlistenFn as TauriUnlistenFn } from '@taurent/bridge/transport/transport';

const sessionListeners = new Set<(event: SessionChangedEvent) => void>();
const resourceInvalidatedListeners = new Set<(event: ResourceInvalidatedEvent) => void>();
const operationFailedListeners = new Set<(event: OperationFailedEvent) => void>();
const themeChangedListeners = new Set<(event: ThemeChangedEvent) => void>();
const maindataSyncChangedListeners = new Set<(event: MaindataSyncChangedEvent) => void>();
const workspaceViewChangedListeners = new Set<(event: WorkspaceView) => void>();

function createListenerRegistrar<T>(listeners: Set<(event: T) => void>) {
  return async (callback: (event: T) => void): Promise<UnlistenFn> => {
    listeners.add(callback);
    return async () => {
      listeners.delete(callback);
    };
  };
}

function emitToListeners<T>(listeners: Set<(event: T) => void>, event: T) {
  for (const listener of listeners) {
    listener(event);
  }
}

export function emitSessionChanged(event: SessionChangedEvent) {
  emitToListeners(sessionListeners, event);
}

export function emitResourceInvalidated(event: ResourceInvalidatedEvent) {
  emitToListeners(resourceInvalidatedListeners, event);
}

export function emitOperationFailed(event: OperationFailedEvent) {
  emitToListeners(operationFailedListeners, event);
}

export function emitThemeChanged(event: ThemeChangedEvent) {
  emitToListeners(themeChangedListeners, event);
}

export function emitMaindataSyncChanged(event: MaindataSyncChangedEvent) {
  emitToListeners(maindataSyncChangedListeners, event);
}

export function emitWorkspaceViewChanged(event: WorkspaceView) {
  emitToListeners(workspaceViewChangedListeners, event);
}

// Session event listener factory
export const createSessionEventListener = createListenerRegistrar(sessionListeners);

// Resource invalidated listener factory
export const createResourceInvalidatedListener = createListenerRegistrar(resourceInvalidatedListeners);

// Operation failed listener factory
export const createOperationFailedListener = createListenerRegistrar(operationFailedListeners);

// Theme changed listener factory
export const createThemeChangedListener = createListenerRegistrar(themeChangedListeners);

// Maindata sync changed listener factory
export const createMaindataSyncChangedListener = createListenerRegistrar(maindataSyncChangedListeners);

// Workspace view changed listener factory
export const createWorkspaceViewChangedListener = createListenerRegistrar(workspaceViewChangedListeners);

// Re-export UnlistenFn for consumers
export { type UnlistenFn };
