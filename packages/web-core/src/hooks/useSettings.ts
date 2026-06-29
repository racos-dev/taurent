// Settings hook factory — creates platform-specific settings hooks from bridge adapters.
//
// All heavy lifting (mutation lifecycle, invalidation) lives in web-core hooks.
// Apps provide the platform bridge methods and a scope provider; this factory
// wires them together so hooks remain zero-argument.
//
// Usage:
//   import { createSettingsHooks } from '@taurent/web-core/hooks';
//   import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
//   import { useQBClient } from '../connection';
//
//   const { usePreferences, useUpdatePreference, useSetPreferences, useSetGlobalDownloadLimit, useSetGlobalUploadLimit } =
//     createSettingsHooks({
//       adapters: {
//         getPreferences: () => BridgeAdapter.application.getPreferences().then(r => r.preferences),
//         setPreferences: (prefs) => BridgeAdapter.application.setPreferences(prefs),
//         setGlobalDownloadLimit: (limit) => BridgeAdapter.transfer.setDownloadLimit(limit),
//         setGlobalUploadLimit: (limit) => BridgeAdapter.transfer.setUploadLimit(limit),
//       },
//       scopeProvider: useQBClient,
//     });

import { useQueryClient } from '@tanstack/react-query';
import { usePreferencesHydrated } from './usePreferences';
import {
  useUpdatePreference as useCoreUpdatePreference,
  useSetPreferences as useCoreSetPreferences,
  useSetGlobalDownloadLimit as useCoreSetGlobalDownloadLimit,
  useSetGlobalUploadLimit as useCoreSetGlobalUploadLimit,
} from './usePreferencesMutations';
import {
  useToggleSpeedLimitsMode as useCoreToggleSpeedLimitsMode,
} from './useTransfer';
import type { Preferences } from '@taurent/shared';
import type { QBClientContextValue } from '../session';
import { invalidatePreferences } from '../query';
import { preferencesKey } from '../query/keys';

export interface SettingsAdapters {
  getPreferences: () => Promise<Preferences>;
  setPreferences: (prefs: Record<string, unknown>) => Promise<unknown>;
  setGlobalDownloadLimit: (limitBytes: number) => Promise<unknown>;
  setGlobalUploadLimit: (limitBytes: number) => Promise<unknown>;
  toggleSpeedLimitsMode: () => Promise<unknown>;
}

export interface CreateSettingsHooksOptions {
  adapters: SettingsAdapters;
  /**
   * A function that returns the current QB client context value.
   * Typically `useQBClient` from the app's connection module.
   * Called inside each hook at render time to stay reactive to session changes.
   */
  scopeProvider: () => QBClientContextValue;
}

export function createSettingsHooks({ adapters, scopeProvider }: CreateSettingsHooksOptions) {
  function usePreferences() {
    const { isConnected, isHydrated, serverId, sessionGeneration } = scopeProvider();

    const { preferences, isLoading, error, refetch } = usePreferencesHydrated({
      scope: { serverId, sessionGeneration, isConnected, isHydrated },
      queryFn: async () => {
        const response = await adapters.getPreferences();
        return response as Preferences;
      },
    });

    return {
      preferences,
      isLoading,
      error,
      refetch,
    };
  }

  function useUpdatePreference() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    const { updatePreference, isPending, error } = useCoreUpdatePreference({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: async ({ key, value }) => {
        const prefs = { [key]: value };
        return adapters.setPreferences(prefs);
      },
    });

    return {
      updatePreference,
      isPending,
      error,
    };
  }

  function useSetPreferences() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    const mutation = useCoreSetPreferences({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: async (prefs: Record<string, unknown>) => {
        return adapters.setPreferences(prefs);
      },
    });

    return {
      mutate: mutation.mutate,
      mutateAsync: mutation.mutateAsync,
      setPreferences: mutation.mutateAsync,
      reset: mutation.reset,
      isSuccess: mutation.isSuccess,
      isPending: mutation.isPending,
      error: mutation.error,
    };
  }

  function useSetGlobalDownloadLimit() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    const mutation = useCoreSetGlobalDownloadLimit({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: async (limitBytes: number) => {
        return adapters.setGlobalDownloadLimit(limitBytes);
      },
    });

    return {
      setDownloadLimit: mutation.mutateAsync,
      isPending: mutation.isPending,
      error: mutation.error,
    };
  }

  function useSetGlobalUploadLimit() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    const mutation = useCoreSetGlobalUploadLimit({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: async (limitBytes: number) => {
        return adapters.setGlobalUploadLimit(limitBytes);
      },
    });

    return {
      setUploadLimit: mutation.mutateAsync,
      isPending: mutation.isPending,
      error: mutation.error,
    };
  }

  function useToggleSpeedLimitsMode() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();
    const queryClient = useQueryClient();
    const scope = { serverId, sessionGeneration, isConnected };
    const key = preferencesKey(scope);

    const mutation = useCoreToggleSpeedLimitsMode({
      scope,
      mutationFn: async () => {
        return adapters.toggleSpeedLimitsMode();
      },
      onMutate: () => {
        // Cancel outgoing refetches so they don't overwrite our optimistic value
        void queryClient.cancelQueries({ queryKey: key });

        // Snapshot the previous state for rollback
        const previous = queryClient.getQueryData<Preferences>(key);

        // Optimistically flip use_alt_speed_limits in the cache
        queryClient.setQueryData<Preferences>(key, (old) => {
          if (!old) return old;
          return { ...old, use_alt_speed_limits: !old.use_alt_speed_limits };
        });

        // Return the snapshot so onError can restore it
        return { previous };
      },
      onError: (_err, _vars, context) => {
        // Rollback to the previous state on failure
        const ctx = context as { previous?: Preferences } | undefined;
        if (ctx?.previous) {
          queryClient.setQueryData(key, ctx.previous);
        }
      },
      onSuccess: () => {
        invalidatePreferences(queryClient, scope);
      },
    });

    return {
      mutate: mutation.mutate,
      mutateAsync: mutation.mutateAsync,
      toggleSpeedLimitsMode: mutation.mutateAsync,
      reset: mutation.reset,
      isSuccess: mutation.isSuccess,
      isPending: mutation.isPending,
      error: mutation.error,
    };
  }

  return {
    usePreferences,
    useUpdatePreference,
    useSetPreferences,
    useSetGlobalDownloadLimit,
    useSetGlobalUploadLimit,
    useToggleSpeedLimitsMode,
  };
}
