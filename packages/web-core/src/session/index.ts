// Session module — shared headless session controller
// Platform-agnostic: injects bridge/listener/query dependencies

export {
  useSessionController,
  type SessionBridge,
  type SessionEventListener,
  type QueryInvalidator,
  type SessionControllerState,
  type SessionController,
  type UseSessionControllerOptions,
} from './sessionController';

export {
  useSessionBootstrap,
  type UseSessionBootstrapOptions,
  type UseSessionBootstrapReturn,
} from './useSessionBootstrap';

export { createSessionProvider, type UseSessionOptions } from './createSessionProvider';
export { createServerManagerProvider } from './createServerManagerProvider';
export { type QBClientContextValue } from './QBClientContextValue';
export { useStandardContextValue, type UseStandardContextValueOptions, type CapabilityBridge } from './useStandardContextValue';
export { createDefaultInvalidator } from './resourceInvalidation';

export { createQBClientContext } from './createQBClientContext';
export {
  createSessionBridge,
  createSessionListeners,
  type CreateSessionBridgeOptions,
  type CreateSessionListenersOptions,
  type SessionLifecycleBridgeAdapter,
} from './createSessionBridge';

export {
  createServerManagerContextValue,
  type CreateServerManagerContextValueOptions,
} from './createServerManagerContextValue';
export { createServerManagerContext } from './createServerManagerContext';
export { createServerManagerBindings, type CreateServerManagerBindingsOptions } from './createServerManagerBindings';
export { createSessionAdapter, type CreateSessionAdapterOptions, type RetryConfig } from './createSessionAdapter';
export { createQBClientBootstrap } from './createQBClientBootstrap';
export { createAuthBoundary, type CreateAuthBoundaryOptions } from './createAuthBoundary';
