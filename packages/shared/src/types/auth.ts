export interface LoginCredentials {
  username: string;
  password: string;
  baseUrl?: string;
  /**
   * Optional qBittorrent API key. When provided, the backend prefers
   * `X-Api-Key` header authentication over basic auth (username/password).
   */
  apiKey?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: unknown | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}
