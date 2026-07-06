/**
 * RSS Screen Model Hook
 *
 * Composes `useRssController` with all RSS mutations and the shared
 * capability/error derivation logic from the desktop and mobile wrappers.
 * Each app passes bridge-backed fetch/mutation functions at the call site.
 *
 * Usage:
 *   const model = useRssScreenModel({
 *     scope: { serverId, sessionGeneration, isConnected },
 *     capabilities: { supportsSearch, supportsRss, supportsWebSeedManagement },
 *     getRssItems: () => bridge.qBClient.getRssItems(),
 *     getRssRules: () => bridge.qBClient.getRssRules(),
 *     mutations: {
 *       addFeed: ({ path, url }) => bridge.qBClient.addRssFeed(path, url),
 *       setFeedUrl: ({ path, url }) => bridge.qBClient.setRssFeedUrl(path, url),
 *       removeItem: ({ path }) => bridge.qBClient.removeRssItem(path),
 *       setRule: ({ ruleName, rule }) => bridge.qBClient.setRssRule(ruleName, rule),
 *       renameRule: ({ ruleName, newRuleName }) => bridge.qBClient.renameRssRule(ruleName, newRuleName),
 *       removeRule: ({ ruleName }) => bridge.qBClient.removeRssRule(ruleName),
 *     },
 *   });
 */

import type { QueryScope } from '../query/scope';
import { useRssController } from './useRssController';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import {
  useAddRssFeed,
  useSetRssFeedUrl,
  useRemoveRssItem,
  useSetRssRule,
  useRenameRssRule,
  useRemoveRssRule,
} from '../hooks/useRssMutations';
import type { RssItem, RssRule, RssRuleInput } from '@taurent/bridge';
import type { UseRssControllerResult } from './useRssController';
import type { AppCapabilities } from '../capabilities';

export interface UseRssScreenMutations {
  addFeed: (variables: { path: string; url: string }) => Promise<unknown>;
  setFeedUrl: (variables: { path: string; url: string }) => Promise<unknown>;
  removeItem: (variables: { path: string }) => Promise<unknown>;
  setRule: (variables: { ruleName: string; rule: RssRuleInput }) => Promise<unknown>;
  renameRule: (variables: { ruleName: string; newRuleName: string }) => Promise<unknown>;
  removeRule: (variables: { ruleName: string }) => Promise<unknown>;
}

export interface UseRssScreenModelOptions {
  scope: QueryScope;
  /**
   * Server capabilities (Rust-resolved, camelCase).
   * `capabilities.supportsRss` gates the RSS data fetch and the
   * `isSupported` / `isUnsupported` derivation in the result.
   */
  capabilities: AppCapabilities;
  /**
   * Fetch function for RSS items — returns the typed bridge envelope.
   * T142.3: items is `RssItem[]` (Rust-owned DTO rows) instead of `unknown`.
   */
  getRssItems: () => Promise<{ items: RssItem[] }>;
  /**
   * Fetch function for RSS rules — returns the typed bridge envelope.
   * T142.3: rules is `RssRule[]` (Rust-owned DTO rows) instead of `unknown`.
   */
  getRssRules: () => Promise<{ rules: RssRule[] }>;
  /** Bridge-backed mutation functions */
  mutations: UseRssScreenMutations;
}

export interface UseRssScreenModelResult {
  // Data from controller
  rssItems: UseRssControllerResult['rssItems'];
  rssRules: UseRssControllerResult['rssRules'];
  rssRuleNames: UseRssControllerResult['rssRuleNames'];
  isLoading: boolean;
  error: Error | null;

  // Capability state. `isSupported` keeps the legacy `boolean | null`
  // shape (offline → `null`, supported → `true`, unsupported → `false`)
  // so the shared `RSSScreenBody` continues to render the correct empty state.
  isSupported: boolean | null;
  isUnsupported: boolean;
  isCapabilityLoading: boolean;

  // Refetch
  onRefetch: () => void;

  // Feed mutations
  onAddFeed: (path: string, url: string) => Promise<void>;
  onEditFeedUrl: (path: string, url: string) => Promise<void>;
  onRemoveItem: (path: string) => void;
  isAddingFeed: boolean;
  isEditingFeedUrl: boolean;
  isRemovingItem: boolean;

  // Rule mutations
  onSetRule: (ruleName: string, rule: RssRuleInput) => Promise<void>;
  onRenameRule: (ruleName: string, newRuleName: string) => Promise<void>;
  onRemoveRule: (ruleName: string) => void;
  isSettingRule: boolean;
  isRenamingRule: boolean;
  isRemovingRule: boolean;
}

export function useRssScreenModel({
  scope,
  capabilities,
  getRssItems,
  getRssRules,
  mutations,
}: UseRssScreenModelOptions): UseRssScreenModelResult {
  const controller = useRssController({
    scope,
    capabilities,
    getRssItems,
    getRssRules,
  });

  // Feed mutations
  const addFeedMutation = useAddRssFeed({
    scope,
    mutationFn: mutations.addFeed,
  });

  const editFeedUrlMutation = useSetRssFeedUrl({
    scope,
    mutationFn: mutations.setFeedUrl,
  });

  const removeItemMutation = useRemoveRssItem({
    scope,
    mutationFn: mutations.removeItem,
  });

  // Rule mutations
  const setRuleMutation = useSetRssRule({
    scope,
    mutationFn: mutations.setRule,
  });

  const renameRuleMutation = useRenameRssRule({
    scope,
    mutationFn: mutations.renameRule,
  });

  const removeRuleMutation = useRemoveRssRule({
    scope,
    mutationFn: mutations.removeRule,
  });

  // Reconstruct the legacy tri-state `isSupported: boolean | null` so the
  // existing `RSSScreenBody` keeps rendering the correct empty state:
  //   - disconnected (`!scope.isConnected`) → null → "Connect to a server"
  //   - connected + supportsRss             → true  → normal RSS UI
  //   - connected + !supportsRss            → false → "RSS not available"
  const isOffline = !scope.isConnected;
  const isSupported = isOffline ? null : capabilities.supportsRss;
  const isUnsupported = !isOffline && !capabilities.supportsRss;
  // No capability-loading state in v2 — capabilities arrive with the session snapshot.
  const isCapabilityLoading = false;

  // Collect the first Error from controller or any mutation
  const mutationError =
    addFeedMutation.error ??
    editFeedUrlMutation.error ??
    removeItemMutation.error ??
    setRuleMutation.error ??
    renameRuleMutation.error ??
    removeRuleMutation.error;
  const rawError =
    controller.error ??
    (mutationError && mutationError instanceof Error
      ? mutationError
      : mutationError
        ? new Error(String(mutationError))
        : null);
  const error = rawError ? new Error(formatUserMessageForContext(rawError, 'rss')) : null;

  return {
    rssItems: controller.rssItems,
    rssRules: controller.rssRules,
    rssRuleNames: controller.rssRuleNames,
    isLoading: controller.isLoading,
    error,

    isSupported,
    isUnsupported,
    isCapabilityLoading,

    onRefetch: controller.refetch,

    // Feed mutations
    onAddFeed: async (path, url) => {
      await addFeedMutation.mutateAsync({ path, url });
    },
    onEditFeedUrl: async (path, url) => {
      await editFeedUrlMutation.mutateAsync({ path, url });
    },
    onRemoveItem: (path) => removeItemMutation.mutate({ path }),
    isAddingFeed: addFeedMutation.isPending,
    isEditingFeedUrl: editFeedUrlMutation.isPending,
    isRemovingItem: removeItemMutation.isPending,

    // Rule mutations
    onSetRule: async (ruleName, rule) => {
      await setRuleMutation.mutateAsync({ ruleName, rule });
    },
    onRenameRule: async (ruleName, newRuleName) => {
      await renameRuleMutation.mutateAsync({ ruleName, newRuleName });
    },
    onRemoveRule: (ruleName) => removeRuleMutation.mutate({ ruleName }),
    isSettingRule: setRuleMutation.isPending,
    isRenamingRule: renameRuleMutation.isPending,
    isRemovingRule: removeRuleMutation.isPending,
  };
}
