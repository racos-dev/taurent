import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapRustCapabilitiesToFlags, type AppCapabilities } from '../capabilities';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import type { RustCapabilitiesResponse } from '@taurent/bridge';
import type { SessionController } from './sessionController';
import type { QBClientContextValue } from './QBClientContextValue';

// Bridge interface capturing the surface area needed for capability discovery.
// Uses a permissive return type so both bridge-typed and shared-typed
// SyncMainData implementations satisfy the constraint.
//
// getSessionSnapshot is optional — when present (desktop/mobile bridges), server metadata
// is derived automatically and serverName/serverUrl are populated without any app-level wrapper.
// getServerCapabilities is optional — when absent (e.g. mocks), `capabilities` stays null and
// consumers branch on null to gate feature UI.
export interface CapabilityBridge {
  getSessionSnapshot?(): Promise<{ server_name: string | null; server_url: string | null }>;
  getServerCapabilities?(): Promise<RustCapabilitiesResponse>;
}

export interface UseStandardContextValueOptions {
  controller: SessionController;
  bridge: CapabilityBridge;
}

export function useStandardContextValue({
  controller,
  bridge,
}: UseStandardContextValueOptions): QBClientContextValue {
  // Server metadata state — auto-derived from bridge.getSessionSnapshot() when available
  // (desktop/mobile bridges expose this at the root level). When absent, serverName/serverUrl
  // remain null and can be enriched by the app-level provider if needed.
  const [serverName, setServerName] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  // Rust capability flags — fetched from bridge when connected.
  // Rust is the single source of truth for capability discovery.
  const [capabilities, setCapabilities] = useState<AppCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState<boolean>(true);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);

  // Initial load + subsequent refreshes driven by sessionGeneration changes.
  useEffect(() => {
    if (!bridge.getSessionSnapshot) return;

    // Fetch on mount and whenever sessionGeneration changes.
    bridge
      .getSessionSnapshot()
      .then((snapshot) => {
        setServerName(snapshot.server_name);
        setServerUrl(snapshot.server_url);
      })
      .catch(() => {
        // Best-effort — ignore errors
      });
  }, [bridge, controller.sessionGeneration]);

  // Fetch Rust capabilities when connected and serverId is available.
  const fetchCapabilities = useCallback(async () => {
    if (!bridge.getServerCapabilities) {
      // No Rust capability source — leave capabilities null. Consumers must branch on null.
      setCapabilitiesLoading(false);
      setCapabilities(null);
      return;
    }
    if (!controller.isConnected || controller.serverId === null) {
      // Not connected yet — don't surface an error, and avoid indefinite loading.
      setCapabilitiesLoading(false);
      return;
    }

    try {
      const response = await bridge.getServerCapabilities();
      setCapabilities(mapRustCapabilitiesToFlags(response.capabilities));
      setCapabilitiesError(null);
    } catch (err) {
      setCapabilitiesError(formatUserMessageForContext(err, 'connection'));
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [bridge, controller.isConnected, controller.serverId]);

  useEffect(() => {
    setCapabilitiesLoading(true);
    setCapabilitiesError(null);
    void fetchCapabilities();
  }, [fetchCapabilities]);

  const refreshCapabilities = useCallback(() => {
    setCapabilitiesLoading(true);
    setCapabilitiesError(null);
    void fetchCapabilities();
  }, [fetchCapabilities]);

  return useMemo(
    () => ({
      ...controller,
      serverName,
      serverUrl,
      capabilities,
      capabilitiesLoading,
      capabilitiesError,
      refreshCapabilities,
    }),
    [
      controller,
      serverName,
      serverUrl,
      capabilities,
      capabilitiesLoading,
      capabilitiesError,
      refreshCapabilities,
    ],
  );
}
