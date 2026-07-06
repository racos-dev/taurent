/**
 * RSS Controller Hook
 *
 * Provides capability-aware RSS data fetching on top of the Rust-owned
 * `qb-core::dto::RssItemDto` / `RssRuleDto` wire types exposed through the
 * `@taurent/bridge` envelope responses.
 *
 * The Rust boundary is now the source of truth for RSS response
 * normalization (keyed trees, arrays, legacy `{ feeds, folders }`,
 * keyed/array rules, alias/default coercion), so this hook is a typed
 * consumer only — it does not re-normalize the payload.
 *
 * Usage:
 *   const controller = useRssController({
 *     scope: { serverId, sessionGeneration, isConnected },
 *     capabilities: { supportsRss, supportsSearch, supportsWebseedManagement },
 *     getRssItems: () => bridge.qBClient.getRssItems(),
 *     getRssRules: () => bridge.qBClient.getRssRules(),
 *   });
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RssItem, RssRule } from '@taurent/bridge';
import type { QueryScope } from '../query/scope';
import { DEFAULT_STALE_TIME } from '../query/scope';
import { RESOURCE } from '../query/keys';
import type { AppCapabilities } from '../capabilities';

// ---------------------------------------------------------------------------
// Normalized types for UI consumption
//
// Structurally identical to the Rust DTOs serialized by
// `qb_core::dto::RssItemDto` / `RssRuleDto` (T142.1/T142.2) and re-exported
// as `RssItem` / `RssRule` from `@taurent/bridge`. The aliases are kept here
// so existing `packages/web-ui` consumers (e.g. `RSSScreenBody`) continue
// to import the controller's UI-facing types unchanged.
// ---------------------------------------------------------------------------

export type NormalizedRSSItem = RssItem;
export type NormalizedRSSRule = RssRule;

// ---------------------------------------------------------------------------
// Options & Result types
// ---------------------------------------------------------------------------

export interface UseRssControllerOptions {
  scope: QueryScope;
  /**
   * Server capabilities (Rust-resolved, camelCase). `supportsRss` gates
   * the RSS queries — when false, the queries stay disabled and the
   * screen layer can render an unsupported empty state.
   */
  capabilities: AppCapabilities;
  /** Fetch function for RSS items — returns the typed bridge envelope. */
  getRssItems: () => Promise<{ items: RssItem[] }>;
  /** Fetch function for RSS rules — returns the typed bridge envelope. */
  getRssRules: () => Promise<{ rules: RssRule[] }>;
  staleTime?: number;
}

export interface UseRssControllerResult {
  /** List of normalized RSS items, empty when unsupported or loading */
  rssItems: NormalizedRSSItem[];
  /** List of normalized RSS rules, empty when unsupported or loading */
  rssRules: NormalizedRSSRule[];
  /** Rule names in order, derived from `rssRules[*].name` */
  rssRuleNames: string[];
  isLoading: boolean;
  isUnsupported: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRssController({
  scope,
  capabilities,
  getRssItems,
  getRssRules,
  staleTime = DEFAULT_STALE_TIME,
}: UseRssControllerOptions): UseRssControllerResult {
  const { isConnected, serverId } = scope;

  const enabled = isConnected && serverId !== null && capabilities.supportsRss;

  const itemsQuery = useQuery<{ items: RssItem[] }, Error>({
    queryKey: [RESOURCE.RSS, serverId, scope.sessionGeneration, 'items'],
    queryFn: getRssItems,
    enabled,
    staleTime,
  });

  const rulesQuery = useQuery<{ rules: RssRule[] }, Error>({
    queryKey: [RESOURCE.RSS, serverId, scope.sessionGeneration, 'rules'],
    queryFn: getRssRules,
    enabled,
    staleTime,
  });

  // Combine loading/error states
  const isLoading = itemsQuery.isLoading || rulesQuery.isLoading;
  const error = itemsQuery.error ?? rulesQuery.error ?? null;

  const refetch = () => {
    itemsQuery.refetch();
    rulesQuery.refetch();
  };

  // Rust owns RSS response normalization, so we consume the typed bridge
  // envelope rows directly. `items` / `rules` are flat `RssItem[]` /
  // `RssRule[]` arrays produced by `qb-core::parse_rss_items` /
  // `parse_rss_rules` (T142.1) and surfaced by the Tauri envelope
  // (T142.2). See `packages/bridge/src/types.ts` for the wire contract.
  //
  // The Rust DTO uses `skip_serializing_if = "Option::is_none"` for
  // optional fields, so a missing `url` reaches the renderer as
  // `undefined`. The downstream `packages/web-ui` consumers
  // (`RSSScreenBody`, `RSSItemRow`) require `url: string | null`
  // (never `undefined`), so we coerce missing values to `null` here to
  // keep the runtime shape in sync with the typed `RssItem` contract.
  const rssItems = useMemo<RssItem[]>(
    () =>
      (itemsQuery.data?.items ?? []).map((item) => ({
        name: item.name,
        url: item.url ?? null,
        isFolder: item.isFolder,
        path: item.path,
        uid: item.uid,
      })),
    [itemsQuery.data]
  );

  const rssRules = useMemo<RssRule[]>(
    () => rulesQuery.data?.rules ?? [],
    [rulesQuery.data]
  );

  const rssRuleNames = useMemo<string[]>(
    () => rssRules.map((rule) => rule.name),
    [rssRules]
  );

  return {
    rssItems,
    rssRules,
    rssRuleNames,
    isLoading,
    isUnsupported: !capabilities.supportsRss,
    error,
    refetch,
  };
}
