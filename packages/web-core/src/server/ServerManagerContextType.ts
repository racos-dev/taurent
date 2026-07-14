import type { Server } from '@taurent/shared/types/server';

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
    apiKey?: string,
  ) => Promise<Server>;
  removeServer: (serverId: string) => Promise<void>;
  updateServer: (
    serverId: string,
    updates: {
      name?: string;
      url?: string;
      username?: string;
      password?: string;
      rememberPassword?: boolean;
      apiKey?: string;
    },
  ) => Promise<void>;
  updateServerCredentials?: (
    serverId: string,
    url: string,
    username: string,
    password: string,
  ) => Promise<void>;
  refreshServers: () => Promise<void>;
  switchServer: (serverId: string) => Promise<void>;
}
