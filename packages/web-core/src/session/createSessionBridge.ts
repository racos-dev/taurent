// Shared session bridge and listener factories.
//
// These are identical between desktop and mobile — both platforms map
// BridgeAdapter methods to the SessionBridge/Listener interfaces with
// no platform-specific transformation.
//
// The retry strategy (exponential backoff vs fixed) remains platform-specific
// and is handled in each app's sessionAdapter.

import type { SessionBridge, SessionEventListener } from './sessionController';
import type { SessionSnapshot } from '@taurent/bridge/types';
import type { SessionChangedEvent, ResourceInvalidatedEvent } from '@taurent/bridge/events';
import type { UnlistenFn } from '@taurent/bridge/transport';

/**
 * Minimal bridge interface capturing only the session lifecycle methods needed
 * by createSessionBridge. Platform bridges (desktop/mobile) both satisfy this shape.
 */
export interface SessionLifecycleBridgeAdapter {
  getSessionSnapshot(): Promise<SessionSnapshot>;
  sessionConnectById(serverId: string): Promise<number>;
  sessionDisconnect(): Promise<number>;
  sessionHealthCheck?(): Promise<boolean>;
}

export interface CreateSessionBridgeOptions {
  bridgeAdapter: Pick<
    SessionLifecycleBridgeAdapter,
    'getSessionSnapshot' | 'sessionConnectById' | 'sessionDisconnect' | 'sessionHealthCheck'
  >;
}

/**
 * Creates a platform-agnostic SessionBridge from a platform-specific BridgeAdapter.
 * Both desktop and mobile use the same mapping — this helper eliminates copy/paste.
 */
export function createSessionBridge({ bridgeAdapter }: CreateSessionBridgeOptions): SessionBridge {
  const healthCheck = bridgeAdapter.sessionHealthCheck;
  return {
    getSessionSnapshot: () => bridgeAdapter.getSessionSnapshot(),
    sessionConnectById: (serverId: string) => bridgeAdapter.sessionConnectById(serverId),
    sessionDisconnect: () => bridgeAdapter.sessionDisconnect(),
    ...(healthCheck ? { sessionHealthCheck: () => healthCheck.call(bridgeAdapter) } : {}),
  };
}

/**
 * Listener factory functions from tauriTransport — same signature on desktop and mobile.
 * Passed in rather than imported to keep web-core platform-agnostic.
 */
export interface ListenerFactories {
  createSessionEventListener: (
    callback: (event: SessionChangedEvent) => void
  ) => Promise<UnlistenFn>;
  createResourceInvalidatedListener: (
    callback: (event: ResourceInvalidatedEvent) => void
  ) => Promise<UnlistenFn>;
}

export interface CreateSessionListenersOptions {
  listenerFactories: ListenerFactories;
}

/**
 * Creates SessionEventListener from platform listener factory functions.
 * Both desktop and mobile use the same mapping — this helper eliminates copy/paste.
 */
export function createSessionListeners({
  listenerFactories,
}: CreateSessionListenersOptions): SessionEventListener {
  return {
    createSessionEventListener: (callback) => listenerFactories.createSessionEventListener(callback),
    createResourceInvalidatedListener: (callback) =>
      listenerFactories.createResourceInvalidatedListener(callback),
  };
}
