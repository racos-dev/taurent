// @taurent/bridge
// Runtime-agnostic root - safe for shared frontend consumers.
// Platform-specific Tauri bridges stay behind explicit subpaths.

// Pure types, events, and interfaces - no Tauri dependencies
export * from './contracts/capabilities';
export * from './contracts/interfaces';
export * from './events';
export * from './types';

// Runtime-agnostic transport contract
export * from './transport/transport';

// Platform types for future web support
export * from './platform';

// Web placeholder - throws if used until web runtime is implemented
export { createWebBridge, createWebTransport, WebPlatformNotSupportedError } from './web';

// Operation notification registration (runtime-agnostic)
export { registerOperationFailedNotifier, onOperationFailed } from './operationNotifications';

export type { UnlistenFn } from './transport/transport';
