import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@taurent/web-core/query';

// In dev, preserve the QueryClient across Vite HMR full-page reloads so cached
// data survives module re-evaluation (e.g. Vite's late-discovery reload).
// In production, import.meta.hot is undefined — this reduces to a plain singleton.
function getOrCreateQueryClient(): QueryClient {
  if (!import.meta.hot) {
    return createQueryClient();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__qb_queryClient) {
    w.__qb_queryClient = createQueryClient();
  }
  return w.__qb_queryClient as QueryClient;
}

// Module-level singleton — safe to share across the desktop app tree.
export const queryClient = getOrCreateQueryClient();
