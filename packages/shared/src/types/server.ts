export interface Server {
  id: string;
  name: string;
  url: string;
  username: string;
  isAuthenticated: boolean;
  lastConnected?: number;
  /** Reflects whether credentials were stored securely, session-only, or unavailable. */
  credentialStatus?: CredentialStatus;
  /** Human-readable warning when credential storage has a known issue (e.g. secure storage unavailable). */
  credentialWarning?: string;
}

/** Mirrors @taurent/bridge/types.CredentialStatus */
export type CredentialStatus =
  | 'stored'
  | 'session_only'
  | 'missing'
  | 'unavailable'
  | 'not_requested'
  | 'unknown';

// NOTE: This type is mirrored from @taurent/bridge/types to avoid
// a dependency from shared onto bridge. Keep in sync with the canonical definition.
export interface TestConnectionResult {
  success: boolean;
  error?: string;
}

export interface ServerManagerState {
  servers: Server[];
  currentServer: Server | null;
  loading: boolean;
  error: string | null;
}

export interface ServerManagerContextType extends ServerManagerState {
  addServer: (
    name: string,
    url: string,
    username: string,
    password: string,
    rememberPassword?: boolean,
  ) => Promise<Server>;
  removeServer: (serverId: string) => Promise<void>;
  updateServer: (
    serverId: string,
    updates: { name?: string; url?: string; username?: string; password?: string; rememberPassword?: boolean },
  ) => Promise<void>;
  updateServerCredentials?: (
    serverId: string,
    url: string,
    username: string,
    password: string,
  ) => Promise<void>;
  testServerConnection: (
    url: string,
    username: string,
    password: string,
  ) => Promise<TestConnectionResult>;
  testSavedServerConnection: (
    serverId: string,
  ) => Promise<TestConnectionResult>;
  refreshServers: () => Promise<void>;
  switchServer: (serverId: string) => Promise<void>;
}
