import type { AppCapabilities } from '../capabilities';

export interface QBClientContextValue {
  connect: (serverId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  retry: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
  isHydrated: boolean;
  sessionGeneration: number;
  serverId: string | null;
  serverName: string | null;
  serverUrl: string | null;
  /** Webapi version reported in the current session snapshot (`null` when disconnected). */
  apiVersion: string | null;
  error: string | null;
  retryState: {
    isRetrying: boolean;
    attemptCount: number;
    maxAttempts: number;
  };
  /**
   * Server-resolved capability flags (Rust-owned, camelCase).
   * Defaults to `{ all false }` when the session is not connected so
   * consumers can rely on the boolean fields without null checks.
   */
  capabilities: AppCapabilities;
}
