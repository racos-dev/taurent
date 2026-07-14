import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_APP_CAPABILITIES,
  toAppCapabilities,
  type AppCapabilities,
} from '../capabilities';
import type { SessionSnapshot } from '@taurent/bridge';
import type { SessionController } from './sessionController';
import type { QBClientContextValue } from './QBClientContextValue';

const SNAPSHOT_RETRY_DELAYS_MS = [1_000, 2_000, 5_000] as const;

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
  const [appVersion, setAppVersion] = useState<string | null>(null);
  // Rust-resolved capability flags. Non-nullable: defaults to all-false when
  // disconnected, hydrated to the snapshot's `capabilities` block on first snapshot.
  const [capabilities, setCapabilities] = useState<AppCapabilities>(DEFAULT_APP_CAPABILITIES);

  // Initial load + subsequent refreshes driven by sessionGeneration changes.
  useEffect(() => {
    if (!bridge.getSessionSnapshot) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const requestScope = {
      serverId: controller.serverId,
      sessionGeneration: controller.sessionGeneration,
    };

    const snapshotMatchesScope = (snapshot: SessionSnapshot) => {
      return (
        snapshot.session_generation === requestScope.sessionGeneration
        && snapshot.server_id === requestScope.serverId
      );
    };

    const scheduleSnapshotLoad = (attempt: number) => {
      const retryDelay = SNAPSHOT_RETRY_DELAYS_MS[Math.min(attempt, SNAPSHOT_RETRY_DELAYS_MS.length - 1)];
      retryTimer = setTimeout(() => {
        void loadSnapshot(attempt + 1);
      }, retryDelay);
    };

    const loadSnapshot = async (attempt = 0) => {
      try {
        const snapshot = await bridge.getSessionSnapshot?.();
        if (!snapshot || cancelled || !snapshotMatchesScope(snapshot)) return;

        setServerName(snapshot.server_name);
        setServerUrl(snapshot.server_url);
        setAppVersion(snapshot.app_version);
        setApiVersion(snapshot.api_version);
        setCapabilities(toAppCapabilities(snapshot.capabilities));
      } catch {
        if (!cancelled) {
          scheduleSnapshotLoad(attempt);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [bridge, controller.serverId, controller.sessionGeneration]);

  return useMemo(
    () => ({
      ...controller,
      serverName,
      serverUrl,
      apiVersion,
      appVersion,
      capabilities,
    }),
    [controller, serverName, serverUrl, apiVersion, appVersion, capabilities],
  );
}
