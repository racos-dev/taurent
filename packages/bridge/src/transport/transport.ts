// Runtime-agnostic transport contract
// This interface defines the minimum contract any transport must implement
// to be used with the bridge adapters in desktop.ts and mobile-tauri.ts.
// A future web runtime can implement this contract using fetch/WebSocket
// or any other HTTP client that can call the appropriate backend endpoints.

/**
 * Unlisten function - returned by listen() to allow removing the listener.
 * This is the same signature as @tauri-apps/api/event's UnlistenFn.
 */
export type UnlistenFn = () => void | Promise<void>;

/**
 * The minimum transport interface that any platform bridge must implement.
 * Contains only invoke (request/response) and listen (event subscription).
 *
 * A web implementation would replace Tauri-specific invoke/listen with:
 * - invoke: fetch() to a hosted backend or local companion service
 * - listen: WebSocket or EventSource for push events
 */
export interface Transport {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn>;
}

/**
 * Transport factory - creates a transport instance.
 * Any transport implementation (Tauri, web fetch, etc.) must satisfy this.
 */
export type TransportFactory = () => Transport;

/**
 * Wrap a transport factory to also return the transport instance.
 */
export interface TransportWithFactory {
  transport: Transport;
  factory: TransportFactory;
}

/**
 * Create a transport with its factory.
 */
export function createTransportWithFactory(factory: TransportFactory): TransportWithFactory {
  return {
    transport: factory(),
    factory,
  };
}
