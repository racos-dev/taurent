// Shared context-value factory for ServerManager.
//
// Architecture:
//   App ServerManager (desktop/mobile)
//         │
//         │  imports createServerManagerContextValue from web-core
//         ▼
//   createServerManagerContextValue(controller, options)
//         → maps controller methods to ServerManagerContextType shape
//
// This eliminates the duplicate useMemo/useContextValue wrappers
// that were nearly identical between desktop and mobile.
// Memoization is the caller's responsibility (useMemo in the component).

import type { ServerManagerController } from '../server/controller';
import type { BridgeCapabilities } from '@taurent/bridge/contracts/capabilities';
import type { ServerManagerContextType } from '../server/ServerManagerContextType';

export interface CreateServerManagerContextValueOptions {
  controller: ServerManagerController;
  /** Bridge capabilities — used to conditionally expose updateServerCredentials */
  capabilities?: BridgeCapabilities;
}

/**
 * Maps a web-core ServerManagerController to a ServerManagerContextType value.
 *
 * Both desktop and mobile were duplicating this mapping logic in their
 * useMemo wrappers. The only platform difference is updateServerCredentials
 * (desktop: always present; mobile: absent).
 *
 * The shared controller already handles the {name?, url?, username?, password?} object
 * form of updateServer — this helper just wraps it for Context exposure.
 *
 * Note: This function is called from inside a component render (via useContextValue
 * callback), so the caller is responsible for memoization if needed.
 */
export function createServerManagerContextValue({
  controller,
  capabilities,
}: CreateServerManagerContextValueOptions): ServerManagerContextType {
  const supportsCredentialsUpdate = capabilities?.supportsCredentialsUpdate ?? false;

  const base: ServerManagerContextType = {
    ...controller,
    // Map controller.updateServer(object) → ServerManagerContextType.updateServer(object)
    // Controller already handles the internals; we just surface it.
    updateServer: async (
      serverId: string,
      updates: { name?: string; url?: string; username?: string; password?: string; rememberPassword?: boolean },
    ) => {
      await controller.updateServer(serverId, {
        name: updates.name,
        url: updates.url,
        username: updates.username,
        password: updates.password,
        rememberPassword: updates.rememberPassword,
      });
    },
  };

  // updateServerCredentials: desktop always has this capability; mobile doesn't.
  if (supportsCredentialsUpdate && controller.updateServerCredentials) {
    return {
      ...base,
      updateServerCredentials: controller.updateServerCredentials,
    };
  }

  return base;
}
