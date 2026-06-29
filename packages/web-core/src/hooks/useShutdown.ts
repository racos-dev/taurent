// Remote shutdown hook — platform-agnostic.
//
// Usage:
//   const { shutdownAsync, isPending, error, wasSuccessful } = useRemoteShutdown({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: () => BridgeAdapter.application.shutdown(),
//   });

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';

export interface UseRemoteShutdownOptions {
  scope: QueryScope;
  mutationFn: () => Promise<unknown>;
}

export interface UseRemoteShutdownResult {
  /** Trigger the shutdown call and return a promise that resolves on success, rejects on failure. */
  shutdownAsync: () => Promise<void>;
  /** True while the shutdown request is in flight. */
  isPending: boolean;
  /** Error from the last failed attempt, cleared on new call. */
  error: Error | null;
  /** True after a successful shutdown call (before navigating away). */
  wasSuccessful: boolean;
}

export function useRemoteShutdown({
  scope: _scope,
  mutationFn,
}: UseRemoteShutdownOptions): UseRemoteShutdownResult {
  // scope is intentionally not used for query invalidation — shutdown kills the server.
  const [wasSuccessful, setWasSuccessful] = React.useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      setWasSuccessful(false);
      await mutationFn();
      setWasSuccessful(true);
    },
  });

  return {
    shutdownAsync: async () => {
      await mutation.mutateAsync();
    },
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
    wasSuccessful,
  };
}