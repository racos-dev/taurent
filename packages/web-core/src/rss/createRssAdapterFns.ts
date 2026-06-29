/**
 * RSS Adapter Factory
 *
 * Constructs the fetch functions and mutation object expected by `useRssScreenModel`
 * from a structurally typed qBittorrent client bridge surface.
 *
 * This moves bridge bundle construction from app-level screens into shared
 * web-core, reducing route-level contract knowledge without making web-core
 * depend on any platform-specific Tauri entrypoint.
 *
 * Usage:
 *   const { getRssItems, getRssRules, mutations } = createRssAdapterFns(qBClient);
 *   const model = useRssScreenModel({ ..., getRssItems, getRssRules, mutations });
 */

import type { QBClientBridge, RssItem, RssRule, RssRuleInput } from '@taurent/bridge';
import type { UseRssScreenMutations } from './useRssScreenModel';

/**
 * Creates the fetch functions and mutations object expected by `useRssScreenModel`
 * from a `QBClientBridge`.
 *
 * T142.3: the bridge now returns typed envelopes with `RssItem[]` /
 * `RssRule[]` rows (Rust-owned DTOs), so the adapter forwards those
 * types directly without a downcast to `unknown`. The promise shapes
 * remain envelope-shaped for forward compatibility with the
 * `session_generation` / `server_id` fields the Tauri side emits.
 *   - `getRssItems` → `Promise<{ items: RssItem[] }>`
 *   - `getRssRules` → `Promise<{ rules: RssRule[] }>`
 *   - Mutations → `Promise<unknown>` (raw response, wrapped by mutation hooks)
 */
export function createRssAdapterFns(qBClient: QBClientBridge): {
  getRssItems: () => Promise<{ items: RssItem[] }>;
  getRssRules: () => Promise<{ rules: RssRule[] }>;
  mutations: UseRssScreenMutations;
} {
  return {
    getRssItems: () =>
      qBClient.getRssItems().then(({ items }) => ({ items })),
    getRssRules: () =>
      qBClient.getRssRules().then(({ rules }) => ({ rules })),
    mutations: {
      addFeed: ({ path, url }) => qBClient.addRssFeed(path, url) as Promise<unknown>,
      setFeedUrl: ({ path, url }) =>
        qBClient.setRssFeedUrl(path, url) as Promise<unknown>,
      removeItem: ({ path }) => qBClient.removeRssItem(path) as Promise<unknown>,
      setRule: ({ ruleName, rule }: { ruleName: string; rule: RssRuleInput }) =>
        qBClient.setRssRule(ruleName, rule) as Promise<unknown>,
      renameRule: ({ ruleName, newRuleName }) =>
        qBClient.renameRssRule(ruleName, newRuleName) as Promise<unknown>,
      removeRule: ({ ruleName }) =>
        qBClient.removeRssRule(ruleName) as Promise<unknown>,
    },
  };
}