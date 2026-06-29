// Platform contract for future web support
// These types define what a web runtime bridge must implement
// to be swappable with the Tauri-based desktop/mobile bridges.

import type { Transport, TransportFactory } from './transport';

/**
 * Runtime identifier for platform detection.
 * Used to conditionally use Tauri vs web transport.
 */
export type RuntimeType = 'desktop' | 'mobile-tauri' | 'web';

/**
 * Platform descriptor - describes the runtime environment.
 */
export interface PlatformDescriptor {
  runtime: RuntimeType;
  transport: Transport;
  transportFactory: TransportFactory;
}

/**
 * Factory function signature for creating a platform-specific bridge.
 * A web implementation would call this with a web-based transport.
 */
export type BridgeFactory<T> = (transport: Transport) => T;

/**
 * Creates a default transport factory.
 * For Tauri platforms this is createTauriTransport.
 * For web, this would be createWebTransport (not yet implemented).
 */
export type DefaultTransportFactory = () => Transport;

/**
 * Error thrown when a platform bridge is used in an unsupported runtime.
 */
export class PlatformNotSupportedError extends Error {
  constructor(runtime: string) {
    super(`Platform '${runtime}' is not supported in this build.`);
    this.name = 'PlatformNotSupportedError';
  }
}

/**
 * Guard to check if we're running in a Tauri environment.
 * Returns true if @tauri-apps/api is available.
 */
export function isTauriRuntime(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalThisAny = globalThis as any;
  return (
    typeof globalThisAny.__TAURI_INTERNALS__ !== 'undefined' ||
    (typeof globalThisAny.invoke === 'function' && globalThisAny.invoke.__tauriModule !== undefined)
  );
}

/**
 * Symbol for the global platform descriptor.
 * Allows runtime detection and transport swapping.
 */
export const PLATFORM_DESCRIPTOR_KEY = Symbol.for('qbittorrent.platform.descriptor');
