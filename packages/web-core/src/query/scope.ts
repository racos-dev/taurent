// Shared query scope — the minimal runtime context needed to scope queries
// to a specific server session. Used as the base for query key factories.

export interface QueryScope {
  serverId: string | null;
  sessionGeneration: number;
  isConnected: boolean;
}

/** Full scope including hydration state — useful for render-blocking queries */
export interface HydratedQueryScope extends QueryScope {
  isHydrated: boolean;
}

/** Default stale time for category/tag/preferences queries (1 minute) */
export const DEFAULT_STALE_TIME = 60_000;
