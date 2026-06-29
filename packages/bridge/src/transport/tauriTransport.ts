// Tauri-specific transport - the only place @tauri-apps/api invoke/listen should exist
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn as TauriUnlistenFn } from '@tauri-apps/api/event';
import type { Transport } from './transport';
import type {
  SessionChangedEvent,
  ResourceInvalidatedEvent,
  OperationFailedEvent,
  ThemeChangedEvent,
} from '../events';
import type { MaindataSyncChangedEvent, WorkspaceView, WorkspaceViewRequest } from '../types';

// Re-export UnlistenFn for consumers that need the Tauri-specific version
export type { UnlistenFn as TauriUnlistenFn } from '@tauri-apps/api/event';

// Wrap invoke to normalize error handling
export function invokeWrap<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((e) => {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  });
}

// Generic invoke wrapper for typed Tauri commands
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invokeWrap(invoke<T>(cmd, args));
}

/**
 * Tauri transport implementation.
 * Implements the Transport interface from ./transport.ts
 */
export function createTauriTransport(): Transport {
  return {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => tauriInvoke<T>(cmd, args),
    listen: <T>(event: string, handler: (payload: T) => void) => {
      return listen<T>(event, (e) => handler(e.payload));
    },
  };
}

// Event listener creators - Tauri-specific, not part of the Transport interface
export function createSessionEventListener(
  callback: (event: SessionChangedEvent) => void
): Promise<TauriUnlistenFn> {
  return listen<SessionChangedEvent>('session-changed', (event) => {
    callback(event.payload);
  });
}

export function createResourceInvalidatedListener(
  callback: (event: ResourceInvalidatedEvent) => void
): Promise<TauriUnlistenFn> {
  return listen<ResourceInvalidatedEvent>('resource-invalidated', (event) => {
    callback(event.payload);
  });
}

export function createOperationFailedListener(
  callback: (event: OperationFailedEvent) => void
): Promise<TauriUnlistenFn> {
  return listen<OperationFailedEvent>('operation-failed', (event) => {
    callback(event.payload);
  });
}

export function createThemeChangedListener(
  callback: (event: ThemeChangedEvent) => void
): Promise<TauriUnlistenFn> {
  return listen<ThemeChangedEvent>('theme-changed', (event) => {
    callback(event.payload);
  });
}

export interface NativeNotificationPayload {
  title: string;
  body: string;
}

/**
 * Create a listener for the maindata-sync-changed event.
 * Emitted by the Rust sync manager whenever sync state or health transitions.
 */
export function createMaindataSyncChangedListener(
  callback: (event: MaindataSyncChangedEvent) => void
): Promise<TauriUnlistenFn> {
  return listen<MaindataSyncChangedEvent>('maindata-sync-changed', (event) => {
    callback(event.payload);
  });
}

/**
 * Invoke the `set_workspace_view` Tauri command.
 *
 * Rust-owned (P2.3-TS): mirrors `qb_core::workspace::WorkspaceViewRequest`.
 * Sets the active workspace view request on the Rust engine, recomputes the
 * view from the current maindata snapshot, and returns the view inline. The
 * `workspace-view-changed` event is emitted only when the recomputed view
 * differs from the cached one.
 */
export function invokeSetWorkspaceView(
  request: WorkspaceViewRequest
): Promise<WorkspaceView> {
  return tauriInvoke<WorkspaceView>('set_workspace_view', { request });
}

/**
 * Invoke the `get_workspace_view` Tauri command.
 *
 * Rust-owned (P2.3-TS): returns the cached last workspace view, or `null`
 * if none has been computed yet. Does not trigger a recompute — call
 * `invokeSetWorkspaceView` to refresh.
 */
export function invokeGetWorkspaceView(): Promise<WorkspaceView | null> {
  return tauriInvoke<WorkspaceView | null>('get_workspace_view');
}

/**
 * Create a listener for the workspace-view-changed event.
 * Emitted by the Rust workspace engine whenever the recomputed view
 * differs from the cached one under the active request.
 */
export function createWorkspaceViewChangedListener(
  callback: (event: WorkspaceView) => void
): Promise<TauriUnlistenFn> {
  return listen<WorkspaceView>('workspace-view-changed', (event) => {
    callback(event.payload);
  });
}
