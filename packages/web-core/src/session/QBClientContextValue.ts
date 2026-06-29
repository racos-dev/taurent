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
  error: string | null;
  retryState: {
    isRetrying: boolean;
    attemptCount: number;
    maxAttempts: number;
  };
  capabilities: AppCapabilities | null;
  capabilitiesLoading: boolean;
  capabilitiesError: string | null;
  refreshCapabilities: () => void;
}
