// Shared context factory helper for ServerManager.
//
// Architecture:
//   App ServerManager (desktop/mobile)
//         │
//         │  imports createServerManagerContext from web-core/connection
//         │  or re-exports if app needs a narrow type override
//         ▼
//   createServerManagerContext<ContextValue>()
//         → creates Context + useServerManager hook
//
// Both apps were duplicating createContext + useContext + React.memo wrapper boilerplate.
// This eliminates that duplication while preserving platform-specific typing (desktop's
// stronger updateServerCredentials type is handled by the caller).

import React, { type Context } from 'react';

/**
 * Factory: creates a React Context + useServerManager hook for a platform.
 *
 * Usage in app:
 *   const { Context, useServerManager } = createServerManagerContext<ServerManagerContextType>();
 *   // Context passed to createServerManagerProvider, useServerManager exported for consumers
 *
 * This eliminates the boilerplate of context creation + hook in every app file
 * when the shape matches ServerManagerContextType (or a platform-specific extension).
 */
export function createServerManagerContext<ContextValue>(): {
  Context: Context<ContextValue | null>;
  useServerManager: () => ContextValue;
} {
  const ServerContext = React.createContext<ContextValue | null>(null);

  function useServerManager(): ContextValue {
    const context = React.useContext(ServerContext);
    if (!context) {
      throw new Error('useServerManager must be used within ServerManagerProvider');
    }
    return context;
  }

  return { Context: ServerContext, useServerManager };
}
