type MockEvent<T> = {
  event: string;
  id: number;
  payload: T;
};

type Listener<T> = (event: MockEvent<T>) => void | Promise<void>;

const emittedEvents: MockEvent<unknown>[] = [];

export type Event<T> = MockEvent<T>;
export type UnlistenFn = () => void;

declare global {
  interface Window {
    __TAURENT_TAURI_EVENTS__?: {
      getEmittedEvents: () => MockEvent<unknown>[];
      clearEmittedEvents: () => void;
      emitEvent: <T>(eventName: string, payload?: T) => Promise<void>;
    };
  }
}

const listeners = new Map<string, Set<Listener<unknown>>>();
let nextEventId = 1;

function getListeners(eventName: string) {
  let eventListeners = listeners.get(eventName);
  if (!eventListeners) {
    eventListeners = new Set();
    listeners.set(eventName, eventListeners);
  }
  return eventListeners;
}

export async function listen<T>(eventName: string, listener: Listener<T>): Promise<UnlistenFn> {
  const eventListeners = getListeners(eventName);
  eventListeners.add(listener as Listener<unknown>);

  return () => {
    eventListeners.delete(listener as Listener<unknown>);
    if (eventListeners.size === 0) {
      listeners.delete(eventName);
    }
  };
}

export async function emit<T>(eventName: string, payload?: T): Promise<void> {
  const event: MockEvent<T> = {
    event: eventName,
    id: nextEventId++,
    payload: payload as T,
  };

  emittedEvents.push(event as MockEvent<unknown>);

  const eventListeners = listeners.get(eventName);
  if (!eventListeners || eventListeners.size === 0) {
    return;
  }

  await Promise.all([...eventListeners].map((listener) => listener(event as MockEvent<unknown>)));
}

if (typeof window !== 'undefined') {
  window.__TAURENT_TAURI_EVENTS__ = {
    getEmittedEvents: () => [...emittedEvents],
    clearEmittedEvents: () => {
      emittedEvents.length = 0;
    },
    emitEvent: (eventName, payload) => emit(eventName, payload),
  };
}
