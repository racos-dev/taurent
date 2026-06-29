// Generic session provider factory — creates a platform-specific provider by
// injecting platform-agnostic session controller logic and exposing a narrow
// Context + useContextValue hook for app-specific context shaping.
//
// Architecture:
//   App QBClientProvider (desktop/mobile)
//         │
//         │  imports createSessionProvider + platform bridges/listeners/retry
//         ▼
//   createSessionProvider({ Context, useSessionOptions, useContextValue })
//         │
//         ├── uses useQueryClient() internally
//         ├── calls useSessionController({ bridge, listeners, invalidator, retryConfig })
//         └── calls useContextValue(controller) → Context.Provider
//
// Platform boundaries:
//   web-core never imports @tauri-apps/* or @taurent/bridge/* directly.
//   Platform bridges and listeners are injected by the caller.

import { type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSessionController,
  type SessionController,
  type UseSessionControllerOptions,
} from './sessionController';

export type UseSessionOptions = Omit<UseSessionControllerOptions, 'queryClient'>;

export function createSessionProvider<ContextValue>({
  Context,
  useSessionOptions,
  useContextValue,
}: {
  Context: React.Context<ContextValue | null>;
  useSessionOptions: (queryClient: ReturnType<typeof useQueryClient>) => UseSessionOptions;
  useContextValue: (controller: SessionController) => ContextValue;
}) {
  return function SessionProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const options = useSessionOptions(queryClient);
    const controller = useSessionController({
      ...options,
      queryClient,
    });

    const value = useContextValue(controller);

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };
}
