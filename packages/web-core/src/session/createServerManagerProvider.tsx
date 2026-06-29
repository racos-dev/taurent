// Generic server manager provider factory — creates a platform-specific provider
// by injecting platform-agnostic server manager controller logic and exposing a
// narrow Context + useContextValue hook for app-specific context shaping.
//
// Architecture:
//   App ServerManagerProvider (desktop/mobile)
//         │
//         │  imports createServerManagerProvider + platform bridge
//         ▼
//   createServerManagerProvider({ Context, bridge, capabilities, useContextValue })
//         │
//         ├── calls useServerManagerController({ bridge, capabilities })
//         └── calls useContextValue(controller) → Context.Provider
//
// Platform boundaries:
//   web-core never imports @tauri-apps/* or any concrete platform bridge module.
//   It does depend on shared bridge contracts/capabilities types, while the
//   concrete bridge implementation is injected by the caller.

import { type ReactNode } from 'react';
import {
  useServerManagerController,
  type ServerBridgeInterface,
  type ServerManagerController,
  type SessionEventListenerFactory,
} from '../server/controller';
import type { BridgeCapabilities } from '@taurent/bridge/contracts/capabilities';

export function createServerManagerProvider<ContextValue>({
  Context,
  bridge,
  capabilities,
  createSessionEventListener,
  useContextValue,
}: {
  Context: React.Context<ContextValue | null>;
  bridge: ServerBridgeInterface;
  capabilities: BridgeCapabilities;
  createSessionEventListener?: SessionEventListenerFactory;
  useContextValue: (controller: ServerManagerController) => ContextValue;
}) {
  return function ServerManagerProvider({ children }: { children: ReactNode }) {
    const controller = useServerManagerController({
      bridge,
      capabilities,
      createSessionEventListener,
    });

    const value = useContextValue(controller);

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };
}
