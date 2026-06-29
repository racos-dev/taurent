export interface LoginCredentials {
  username: string;
  password: string;
  baseUrl?: string;
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
