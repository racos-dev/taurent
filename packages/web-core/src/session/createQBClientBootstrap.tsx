// QBClient bootstrap factory — creates the QBClientProvider, useQBClient hook,
// and React context from platform-specific configuration.
//
// This eliminates the nearly-identical QBClientProvider.tsx files in desktop and
// mobile. Each app provides its BridgeAdapter and useSessionOptions; this factory
// produces the fully wired provider tree.

import { type ReactNode } from 'react';
import { createQBClientContext } from './createQBClientContext';
import { createSessionProvider } from './createSessionProvider';
import { useStandardContextValue } from './useStandardContextValue';
import { MaindataSyncProvider, useMaindataState, useMaindataSelector } from '../sync/MaindataSyncProvider';
import type { QBClientContextValue } from './QBClientContextValue';
import type { SessionController } from './sessionController';
import type { QueryClient } from '@tanstack/react-query';
import type { UseStandardContextValueOptions } from './useStandardContextValue';
import type { UseSessionOptions } from './createSessionProvider';
import type { MaindataSyncBackendBridge } from '../sync/MaindataSyncProvider';

export interface CreateQBClientBootstrapOptions {
  bridgeAdapter: UseStandardContextValueOptions['bridge'];
  /** Backend-owned sync bridge — enables Rust-managed sync. */
  maindataBackendBridge?: MaindataSyncBackendBridge;
  useSessionOptions: (queryClient: QueryClient) => UseSessionOptions;
}

export function createQBClientBootstrap(config: CreateQBClientBootstrapOptions) {
  const { Context: QBClientContext, useQBClient } = createQBClientContext<QBClientContextValue>();

  function useContextValue(controller: SessionController): QBClientContextValue {
    return useStandardContextValue({
      controller,
      bridge: config.bridgeAdapter,
    });
  }

  const InternalSessionProvider = createSessionProvider({
    Context: QBClientContext,
    useSessionOptions: config.useSessionOptions,
    useContextValue,
  });

  function QBClientProvider({ children }: { children: ReactNode }) {
    return (
      <InternalSessionProvider>
        <MaindataProvider>{children}</MaindataProvider>
      </InternalSessionProvider>
    );
  }

  // Inner component that accesses useQBClient via the context established by
  // InternalSessionProvider, then passes the scope into MaindataSyncProvider.
  // useMemo is not needed here — MaindataSyncProvider re-renders at the
  // 500ms poll cadence regardless, and the controller values are stable.
  function MaindataProvider({ children }: { children: ReactNode }) {
    const { serverId, sessionGeneration, isConnected, isHydrated } = useQBClient();
    return (
      <MaindataSyncProvider
        backendBridge={config.maindataBackendBridge}
        scope={{ serverId, sessionGeneration, isConnected, isHydrated }}
      >
        {children}
      </MaindataSyncProvider>
    );
  }

  return { QBClientProvider, useQBClient, useMaindataState, useMaindataSelector, Context: QBClientContext };
}
