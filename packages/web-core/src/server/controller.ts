// Headless server manager controller.
// Runtime-agnostic, but intentionally typed against shared bridge DTO and
// capability contracts so desktop/mobile adapters can inject their concrete
// server bridge implementations without duplicating request/response shapes.

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Server } from '@taurent/shared/types/server';
import type {
  SavedServerSummary,
  AddServerInput,
  UpdateServerInput,
  TestConnectionResult,
} from '@taurent/bridge/types';
import type { BridgeCapabilities } from '@taurent/bridge/contracts/capabilities';
import type { UnlistenFn } from '@taurent/bridge/transport';
import type { SessionChangedEvent } from '@taurent/bridge/events';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

// Canonical server bridge interface - platform implementations map their method names to this
export interface ServerBridgeInterface {
  listServers(): Promise<SavedServerSummary[]>;
  getActiveServer(): Promise<SavedServerSummary | null>;
  addServer(input: AddServerInput): Promise<SavedServerSummary>;
  updateServer(input: UpdateServerInput): Promise<SavedServerSummary>;
  removeServer(serverId: string): Promise<void>;
  selectServer(serverId: string): Promise<void>;
  testServerConnection(
    serverUrl: string,
    credentials: { username: string; password: string },
  ): Promise<TestConnectionResult>;
  testSavedServerConnection(serverId: string): Promise<TestConnectionResult>;
  /** Atomic saved-server switch: commits the new session only on success. On failure the
   *  previous session remains intact. Returns the new session generation on success. */
  sessionSwitchServerById(serverId: string): Promise<number>;
}

export interface ServerManagerState {
  servers: Server[];
  currentServer: Server | null;
  loading: boolean;
  error: string | null;
}

export interface ServerManagerController extends ServerManagerState {
  addServer: (name: string, url: string, username: string, password: string, rememberPassword?: boolean) => Promise<Server>;
  removeServer: (serverId: string) => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  updateServer: (
    serverId: string,
    updates: { name?: string; url?: string; username?: string; password?: string; rememberPassword?: boolean },
  ) => Promise<void>;
  updateServerCredentials?: (serverId: string, url: string, username: string, password: string) => Promise<void>;
  testServerConnection: (url: string, username: string, password: string) => Promise<TestConnectionResult>;
  testSavedServerConnection: (serverId: string) => Promise<TestConnectionResult>;
  refreshServers: () => Promise<void>;
  switchServer: (serverId: string) => Promise<void>;
}

// Map SavedServerSummary (bridge DTO) to safe Server type (no password)
export function toServer(summary: SavedServerSummary): Server {
  return {
    id: summary.id,
    name: summary.name,
    url: summary.url,
    username: summary.username,
    isAuthenticated: false,
    credentialStatus: summary.credential_status,
    credentialWarning: summary.credential_warning,
  };
}

interface UseServerManagerControllerOptions {
  bridge: ServerBridgeInterface;
  /** Bridge capability descriptor — used to conditionally expose platform features */
  capabilities?: BridgeCapabilities;
  /**
   * Optional listener factory for session-changed events.
   * When provided, the controller subscribes and refreshes server list on server
   * switches so independent webviews stay in sync without a full reconnect.
   */
  createSessionEventListener?: SessionEventListenerFactory;
}

/**
 * A factory that subscribes to session-changed events and returns an unlisten fn.
 * Platforms inject their concrete listener implementation (e.g. Tauri event listeners).
 */
export type SessionEventListenerFactory = (
  callback: (event: SessionChangedEvent) => void
) => Promise<UnlistenFn>;

export function useServerManagerController({
  bridge,
  capabilities,
  createSessionEventListener,
}: UseServerManagerControllerOptions): ServerManagerController {
  const supportsCredentialsUpdate = capabilities?.supportsCredentialsUpdate ?? false;
  const [state, setState] = useState<ServerManagerState>({
    servers: [],
    currentServer: null,
    loading: true,
    error: null,
  });

  const loadServers = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const [summaries, activeSummary] = await Promise.all([
        bridge.listServers(),
        bridge.getActiveServer(),
      ]);

      const servers = summaries.map(toServer);
      const nextCurrentServer = activeSummary ? toServer(activeSummary) : null;

      setState((prev) => {
        // Preserve reference identity when the active server ID hasn't changed.
        // This prevents downstream effects (e.g. useSessionBootstrap auto-connect)
        // from re-evaluating due to a new object with the same content.
        const currentServer =
          prev.currentServer?.id === nextCurrentServer?.id
            ? prev.currentServer
            : nextCurrentServer;
        return { servers, currentServer, loading: false, error: null };
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: formatUserMessageForContext(error, 'settings-load'),
      }));
    }
  }, [bridge]);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  // Subscribe to session-changed events and refresh server list on server switches.
  // This keeps independent webviews (main window, settings window) in sync when
  // a server switch happens in one window and the other hasn't yet re-synced.
  useEffect(() => {
    if (!createSessionEventListener) {
      return;
    }

    const listenerFactory = createSessionEventListener;
    let isMounted = true;
    let unlistenFn: UnlistenFn | undefined;

    listenerFactory(() => {
      if (!isMounted) return;
      // Refresh the server list so currentServer reflects the newly selected server.
      // This resolves cross-window lag where the main window holds stale currentServer.
      void loadServers();
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, [createSessionEventListener, loadServers]);

  const testServerConnection = useCallback(
    async (url: string, username: string, password: string): Promise<TestConnectionResult> => {
      try {
        const result = await bridge.testServerConnection(url, { username, password });
        return result;
      } catch (error) {
        return {
          success: false,
          error: formatUserMessageForContext(error, 'connection'),
        };
      }
    },
    [bridge],
  );

  const testSavedServerConnection = useCallback(
    async (serverId: string): Promise<TestConnectionResult> => {
      try {
        const result = await bridge.testSavedServerConnection(serverId);
        return result;
      } catch (error) {
        return {
          success: false,
          error: formatUserMessageForContext(error, 'connection'),
        };
      }
    },
    [bridge],
  );

  const addServer = useCallback(
    async (name: string, url: string, username: string, password: string, rememberPassword = true): Promise<Server> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const summary = await bridge.addServer({ name, url, username, password, remember_password: rememberPassword });

        const newServer = toServer(summary);

        setState((prev) => ({
          ...prev,
          servers: [...prev.servers, newServer],
          // Keep the first add flow stable until the caller persists selection.
          currentServer: prev.currentServer ?? newServer,
          loading: false,
          error: null,
        }));

        return newServer;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatUserMessageForContext(error, 'add-server'),
        }));
        throw error;
      }
    },
    [bridge],
  );

  const removeServer = useCallback(
    async (serverId: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        await bridge.removeServer(serverId);

        setState((prev) => {
          const updatedServers = prev.servers.filter((s) => s.id !== serverId);
          const currentServer =
            prev.currentServer?.id === serverId ? null : prev.currentServer;
          return {
            servers: updatedServers,
            currentServer,
            loading: false,
            error: null,
          };
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatUserMessageForContext(error, 'settings-save'),
        }));
        throw error;
      }
    },
    [bridge],
  );

  const updateServer = useCallback(
    async (
      serverId: string,
      updates: { name?: string; url?: string; username?: string; password?: string; rememberPassword?: boolean },
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const updatedSummary = await bridge.updateServer({
          id: serverId,
          name: updates.name,
          url: updates.url,
          username: updates.username,
          password: updates.password,
          remember_password: updates.rememberPassword,
        });

        const updatedServer = toServer(updatedSummary);

        setState((prev) => ({
          ...prev,
          servers: prev.servers.map((s) => (s.id === serverId ? updatedServer : s)),
          currentServer:
            prev.currentServer?.id === serverId ? updatedServer : prev.currentServer,
          loading: false,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatUserMessageForContext(error, 'settings-save'),
        }));
        throw error;
      }
    },
    [bridge],
  );

  const updateServerCredentials = useCallback(
    async (serverId: string, url: string, username: string, password: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const updatedSummary = await bridge.updateServer({
          id: serverId,
          url,
          username,
          password,
        });

        const updatedServer = toServer(updatedSummary);

        setState((prev) => ({
          ...prev,
          servers: prev.servers.map((s) => (s.id === serverId ? updatedServer : s)),
          currentServer:
            prev.currentServer?.id === serverId ? updatedServer : prev.currentServer,
          loading: false,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatUserMessageForContext(error, 'settings-save'),
        }));
        throw error;
      }
    },
    [bridge],
  );

  const switchServer = useCallback(
    async (serverId: string) => {
      setState((prev) => ({ ...prev, error: null }));

      // Atomic switch: loads credentials inside the backend, authenticates the candidate,
      // and commits the new session only on success. On failure the previous session
      // remains intact (no disconnect, no candidate select).
      await bridge.sessionSwitchServerById(serverId);

      const activeSummary = await bridge.getActiveServer();
      const nextCurrentServer = activeSummary ? toServer(activeSummary) : null;

      setState((prev) => {
        // Preserve reference identity when the active server ID hasn't changed.
        // This prevents downstream effects (e.g. useSessionBootstrap auto-connect)
        // from re-evaluating due to a new object with the same content.
        const currentServer =
          prev.currentServer?.id === nextCurrentServer?.id
            ? prev.currentServer
            : nextCurrentServer;
        return {
          ...prev,
          currentServer,
          error: null,
        };
      });
    },
    [bridge],
  );

  const refreshServers = useCallback(async () => {
    await loadServers();
  }, [loadServers]);

  const value = useMemo((): ServerManagerController => {
    const base: ServerManagerController = {
      ...state,
      addServer,
      removeServer,
      selectServer: switchServer,
      updateServer,
      testServerConnection,
      testSavedServerConnection,
      refreshServers,
      switchServer,
    };

    // Conditionally include updateServerCredentials based on capabilities
    if (supportsCredentialsUpdate) {
      return {
        ...base,
        updateServerCredentials,
      };
    }

    return base;
  }, [
    state,
    addServer,
    removeServer,
    updateServer,
    testServerConnection,
    testSavedServerConnection,
    refreshServers,
    switchServer,
    updateServerCredentials,
    supportsCredentialsUpdate,
  ]);

  return value;
}
