// Higher-level ServerManager bindings factory.
//
// Architecture:
//
//   App ServerManager (desktop/mobile)
//         │
//         │  imports createServerManagerBindings from web-core
//         ▼
//   createServerManagerBindings({ bridge, capabilities, extendContextValue? })
//         │
//         ├── createServerManagerContext<ContextValue>()
//         ├── createServerManagerProvider({ Context, bridge, capabilities, useContextValue })
//         │     └── useMemo(() => createServerManagerContextValue({ controller, capabilities }), [controller])
//         └── if extendContextValue provided → apply to base value before returning
//
//
// This is the "Phase 1 shell extraction" target: eliminates the duplicated
// { Context, useServerManager } + createServerManagerProvider boilerplate
// from both app ServerManager files while preserving platform-specific typing
// (desktop extends the shared type to make updateServerCredentials required).
//
// Platform boundaries:
//   web-core never imports @tauri-apps/* or any concrete platform bridge module.

import { useMemo, type ReactNode } from 'react';
import { createServerManagerProvider } from './createServerManagerProvider';
import { createServerManagerContextValue } from './createServerManagerContextValue';
import { createServerManagerContext } from './createServerManagerContext';
import type { BridgeCapabilities } from '@taurent/bridge/contracts/capabilities';
import type { ServerBridgeInterface, ServerManagerController } from '../server/controller';
import type { SessionEventListenerFactory } from '../server/controller';
import type { ServerManagerContextType } from '../server/ServerManagerContextType';

export interface CreateServerManagerBindingsOptions<ContextValue> {
  bridge: ServerBridgeInterface;
  capabilities: BridgeCapabilities;
  /**
   * Optional listener factory for session-changed events.
   * When provided, the server manager controller subscribes and refreshes the
   * server list on server switches so independent webviews stay in sync.
   */
  createSessionEventListener?: SessionEventListenerFactory;
  /**
   * Optional extender — receives the base context value and controller
   * and returns a platform-extended value. Called inside the provider's
   * useMemo after the base value is computed.
   *
   * Use this when the app needs to narrow/extend the shared context type
   * (e.g. desktop makes updateServerCredentials non-optional).
   *
   * Note: the returned ExtendedValue must be assignable to ContextValue.
   */
  extendContextValue?: (
    baseValue: ServerManagerContextType,
    controller: ServerManagerController,
  ) => ContextValue;
}

export function createServerManagerBindings<ContextValue = ServerManagerContextType>({
  bridge,
  capabilities,
  createSessionEventListener,
  extendContextValue,
}: CreateServerManagerBindingsOptions<ContextValue>): {
  ServerManagerProvider: ReturnType<typeof createServerManagerProvider<ContextValue>>;
  useServerManager: () => ContextValue;
} {
  const { Context, useServerManager } = createServerManagerContext<ContextValue>();
  const Provider = createServerManagerProvider<ContextValue>({
    Context,
    bridge,
    capabilities,
    createSessionEventListener,
    useContextValue: (controller) =>
      useMemo(() => {
        const baseValue = createServerManagerContextValue({ controller, capabilities });
        return extendContextValue ? extendContextValue(baseValue, controller) : (baseValue as ContextValue);
      }, [controller]),
  });

  function ServerManagerProvider({ children }: { children: ReactNode }) {
    return <Provider>{children}</Provider>;
  }

  return { ServerManagerProvider, useServerManager };
}
