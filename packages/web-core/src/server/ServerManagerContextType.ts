import type { Server } from '@taurent/shared/types/server';
import type { TestConnectionResult } from '@taurent/bridge/types';

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
  testSavedServerConnection: (serverId: string) => Promise<TestConnectionResult>;
  refreshServers: () => Promise<void>;
  switchServer: (serverId: string) => Promise<void>;
}
