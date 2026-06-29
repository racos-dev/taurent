// Shared preferences query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop):
//   const { preferences } = usePreferences({
//     scope: { serverId, sessionGeneration, isConnected },
//     queryFn: () => BridgeAdapter.application.getPreferences() as Promise<Preferences>,
//   });

import { useQuery } from '@tanstack/react-query';
import type { QueryScope, HydratedQueryScope } from '../query/scope';
import { preferencesKey } from '../query/keys';
import { DEFAULT_STALE_TIME } from '../query/scope';

export interface UsePreferencesOptions<TPreferences> {
  scope: QueryScope;
  /**
   * Bridge-provided fetch function.
   * Returns the raw preferences object.
   */
  queryFn: () => Promise<TPreferences>;
  staleTime?: number;
}

export interface UsePreferencesResult<TPreferences> {
  preferences: TPreferences | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePreferences<TPreferences>({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UsePreferencesOptions<TPreferences>): UsePreferencesResult<TPreferences> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TPreferences, Error>({
    queryKey: preferencesKey(scope),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    preferences: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

export function usePreferencesHydrated<TPreferences>({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: {
  scope: HydratedQueryScope;
  queryFn: () => Promise<TPreferences>;
  staleTime?: number;
}): UsePreferencesResult<TPreferences> {
  const { isConnected, isHydrated, serverId } = scope;

  const result = useQuery<TPreferences, Error>({
    queryKey: preferencesKey(scope),
    queryFn,
    enabled: isConnected && isHydrated && serverId !== null,
    staleTime,
  });


  return {
    preferences: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}