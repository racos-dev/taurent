// Future web runtime placeholder
// This file documents the contract a web implementation must satisfy.
// It is NOT yet implemented - calling these will throw an error.
//
// To implement web support in a future phase:
// 1. Create a web transport using fetch() to a hosted backend
// 2. Implement the same Transport interface from ./transport.ts
// 3. Export a createWebBridge(transport) factory function
// 4. The shared feature layer (web-core, web-ui) will work without changes
//
// Example web transport outline:
//   const webTransport: Transport = {
//     async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
//       const response = await fetch(`/api/${cmd}`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(args),
//       });
//       if (!response.ok) throw new Error(`API error: ${response.status}`);
//       return response.json();
//     },
//     listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
//       // WebSocket/EventSource connection would go here
//       throw new Error('WebSocket not implemented');
//     },
//   };

import type { Transport } from './transport';

export class WebPlatformNotSupportedError extends Error {
  constructor() {
    super(
      'Web runtime is not yet implemented. ' +
        'A future phase will add web transport support using fetch/WebSocket.'
    );
    this.name = 'WebPlatformNotSupportedError';
  }
}

/**
 * Placeholder transport that throws an error if used.
 * Replace with a real web transport implementation in a future phase.
 */
export function createWebTransport(): Transport {
  throw new WebPlatformNotSupportedError();
}

/**
 * Placeholder web bridge factory.
 * Replace with a real implementation in a future phase.
 */
export function createWebBridge(_transport: Transport): unknown {
  throw new WebPlatformNotSupportedError();
}

/**
 * Re-export Transport type for convenience in web implementations.
 */
export type { Transport, TransportFactory } from './transport';
