// Shared preferences mutation hooks — renderer-only, bridge-agnostic.
//
// These hooks own the React Query mutation lifecycle and invalidation logic.
// They accept injected mutation functions so callers provide the bridge adapter
// at the call site.
//
// Usage (desktop/mobile):
//   const { updatePreference } = useUpdatePreference({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: ({ key, value }) =>
//       BridgeAdapter.torrents.setPreferences({ [key]: value }),
//   });

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { preferencesKey } from '../query/keys';
import { createPreferencesOptimisticUpdate } from '../query/optimistic-updates';

interface PreferencesMutationContext {
  previousData: Record<string, unknown> | undefined;
}

/**
 * Options for preference mutation hooks.
 */
export interface UsePreferenceMutationOptions<TVariables> {
  scope: QueryScope;
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// useUpdatePreference
// ---------------------------------------------------------------------------

export interface UpdatePreferenceVariables {
  key: string;
  value: unknown;
}

/**
 * Hook for updating a single preference key/value pair.
 * Accepts `{ key: string, value: unknown }`.
 * Invalidates preferences query on success.
 */
export function useUpdatePreference({
  scope,
  mutationFn,
  onSuccess,
}: UsePreferenceMutationOptions<UpdatePreferenceVariables>) {
  const queryClient = useQueryClient();
  const optimisticPreferences = createPreferencesOptimisticUpdate(queryClient, preferencesKey(scope));

  const getOptimisticHandlers = (variables: UpdatePreferenceVariables) => {
    return optimisticPreferences.updatePreference(variables.key, variables.value);
  };

  const mutation = useMutation<unknown, Error, UpdatePreferenceVariables, PreferencesMutationContext>({
    mutationFn,
    onMutate: (variables) => getOptimisticHandlers(variables).onMutate(variables),
    onError: (error, variables, context) => getOptimisticHandlers(variables).onError(error, variables, context),
    onSettled: (_data, _error, variables) => getOptimisticHandlers(variables).onSettled(),
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const updatePreference = useCallback(
    (key: string, value: unknown) => {
      mutation.mutate({ key, value });
    },
    [mutation]
  );

  return {
    updatePreference,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ---------------------------------------------------------------------------
// useSetPreferences
// ---------------------------------------------------------------------------

/**
 * Hook for setting multiple preferences at once.
 * Accepts `Record<string, unknown>`.
 * Invalidates preferences query on success.
 */
export function useSetPreferences({
  scope,
  mutationFn,
  onSuccess,
}: UsePreferenceMutationOptions<Record<string, unknown>>) {
  const queryClient = useQueryClient();
  const optimisticPreferences = createPreferencesOptimisticUpdate(queryClient, preferencesKey(scope));

  const getOptimisticHandlers = (variables: Record<string, unknown>) => {
    return optimisticPreferences.updatePreferences(variables);
  };

  return useMutation<unknown, Error, Record<string, unknown>, PreferencesMutationContext>({
    mutationFn,
    onMutate: (variables) => getOptimisticHandlers(variables).onMutate(variables),
    onError: (error, variables, context) => getOptimisticHandlers(variables).onError(error, variables, context),
    onSettled: (_data, _error, variables) => getOptimisticHandlers(variables).onSettled(),
    onSuccess: () => {
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// useSetGlobalDownloadLimit
// ---------------------------------------------------------------------------

/**
 * Hook for setting the global download limit.
 * Accepts `limitBytes: number`.
 * Invalidates preferences query on success.
 */
export function useSetGlobalDownloadLimit({
  scope,
  mutationFn,
  onSuccess,
}: UsePreferenceMutationOptions<number>) {
  const queryClient = useQueryClient();
  const optimisticPreferences = createPreferencesOptimisticUpdate(queryClient, preferencesKey(scope));
  const optimisticHandlers = optimisticPreferences.updatePreference('dl_limit', 0);

  return useMutation<unknown, Error, number, PreferencesMutationContext>({
    mutationFn,
    onMutate: (limitBytes) => {
      return optimisticPreferences.updatePreference('dl_limit', limitBytes).onMutate(limitBytes);
    },
    onError: (error, limitBytes, context) => {
      return optimisticPreferences.updatePreference('dl_limit', limitBytes).onError(error, limitBytes, context);
    },
    onSettled: () => optimisticHandlers.onSettled(),
    onSuccess: () => {
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// useSetGlobalUploadLimit
// ---------------------------------------------------------------------------

/**
 * Hook for setting the global upload limit.
 * Accepts `limitBytes: number`.
 * Invalidates preferences query on success.
 */
export function useSetGlobalUploadLimit({
  scope,
  mutationFn,
  onSuccess,
}: UsePreferenceMutationOptions<number>) {
  const queryClient = useQueryClient();
  const optimisticPreferences = createPreferencesOptimisticUpdate(queryClient, preferencesKey(scope));
  const optimisticHandlers = optimisticPreferences.updatePreference('up_limit', 0);

  return useMutation<unknown, Error, number, PreferencesMutationContext>({
    mutationFn,
    onMutate: (limitBytes) => {
      return optimisticPreferences.updatePreference('up_limit', limitBytes).onMutate(limitBytes);
    },
    onError: (error, limitBytes, context) => {
      return optimisticPreferences.updatePreference('up_limit', limitBytes).onError(error, limitBytes, context);
    },
    onSettled: () => optimisticHandlers.onSettled(),
    onSuccess: () => {
      onSuccess?.();
    },
  });
}
