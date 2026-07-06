import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_APP_CAPABILITIES,
  toAppCapabilities,
  type AppCapabilities,
} from '../capabilities';
import type { SessionSnapshot } from '@taurent/bridge';
import type { SessionController } from './sessionController';
import type { QBClientContextValue } from './QBClientContextValue';

// Bridge interface capturing the surface area needed for capability discovery.
//
// `getSessionSnapshot` is the single source of capability truth in v2 — Rust
// resolves `supports_search` / `supports_rss` / `supports_webseed_management`
// from the qBittorrent webapi version and includes them in the session
// snapshot. No separate `get_server_capabilities` invoke is required.
export interface CapabilityBridge {
  getSessionSnapshot?(): Promise<SessionSnapshot>;
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
  const [apiVersion, setApiVersion] = useState<string | null>(null);
  // Rust-resolved capability flags. Non-nullable: defaults to all-false when
  // disconnected, hydrated to the snapshot's `capabilities` block on first snapshot.
  const [capabilities, setCapabilities] = useState<AppCapabilities>(DEFAULT_APP_CAPABILITIES);

  // Initial load + subsequent refreshes driven by sessionGeneration changes.
  useEffect(() => {
    if (!bridge.getSessionSnapshot) return;

    // Fetch on mount and whenever sessionGeneration changes.
    bridge
      .getSessionSnapshot()
      .then((snapshot: SessionSnapshot) => {
        setServerName(snapshot.server_name);
        setServerUrl(snapshot.server_url);
        setApiVersion(snapshot.api_version);
        setCapabilities(toAppCapabilities(snapshot.capabilities));
      })
      .catch(() => {
        // Best-effort — ignore errors
      });
  }, [bridge, controller.sessionGeneration]);

  return useMemo(
    () => ({
      ...controller,
      serverName,
      serverUrl,
      apiVersion,
      capabilities,
    }),
    [controller, serverName, serverUrl, apiVersion, capabilities],
  );
}
