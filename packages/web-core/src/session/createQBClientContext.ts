// Shared context factory helpers for QBClientProvider.
//
// Architecture:
//   App QBClientProvider (desktop/mobile)
//         │
//         │  imports createQBClientContext + useQBClient from web-core
//         │  or re-exports if app needs a narrow type override
//         ▼
//   createQBClientContext<ContextValue>(Context)
//         → creates Context + useQBClient hook
//
//   Both are thin wrappers; all heavy logic lives in web-core hooks
//   (createSessionProvider, useStandardContextValue, sessionController).

import React, { type Context } from 'react';
import type { QBClientContextValue } from './QBClientContextValue';

/**
 * Factory: creates a React Context + useQBClient hook for a platform.
 *
 * Usage in app:
 *   const { Context, useQBClient } = createQBClientContext<QBClientContextValue>();
 *   // use in provider...
 *
 * This eliminates the boilerplate of context creation + hook in every app file
 * when the shape matches QBClientContextValue exactly.
 */
export function createQBClientContext<ContextValue extends QBClientContextValue>() {
  const QBClientContext = React.createContext<ContextValue | null>(null);

  function useQBClient(): ContextValue {
    const context = React.useContext(QBClientContext);
    if (!context) {
      throw new Error('useQBClient must be used within QBClientProvider');
    }
    return context;
  }

  return { Context: QBClientContext as Context<ContextValue | null>, useQBClient };
}
