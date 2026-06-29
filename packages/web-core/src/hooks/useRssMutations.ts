// Shared RSS mutation hooks — renderer-only, bridge-agnostic.
//
// These hooks own the React Query mutation lifecycle and invalidation logic.
// They accept injected mutation functions so callers provide the bridge adapter
// at the call site.
//
// Usage (desktop):
//   const { addFeed } = useAddRssFeed({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: ({ path, url }) => BridgeAdapter.qBClient.addRssFeed(path, url),
//   });

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { invalidateRss } from '../query/invalidation';
import type { RssRuleInput } from '@taurent/bridge';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseRssMutationOptions<TVariables> {
  scope: QueryScope;
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Add RSS Feed
// ---------------------------------------------------------------------------

export interface AddRssFeedVariables {
  path: string;
  url: string;
}

/**
 * Hook for adding an RSS feed.
 * Invalidates RSS items and rules on success.
 */
export function useAddRssFeed({
  scope,
  mutationFn,
  onSuccess,
}: UseRssMutationOptions<AddRssFeedVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateRss(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Edit RSS Feed URL
// ---------------------------------------------------------------------------

export interface SetRssFeedUrlVariables {
  path: string;
  url: string;
}

/**
 * Hook for editing an RSS feed URL.
 * Invalidates RSS items and rules on success.
 */
export function useSetRssFeedUrl({
  scope,
  mutationFn,
  onSuccess,
}: UseRssMutationOptions<SetRssFeedUrlVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateRss(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Remove RSS Item
// ---------------------------------------------------------------------------

export interface RemoveRssItemVariables {
  path: string;
}

/**
 * Hook for removing an RSS item (feed or folder).
 * Invalidates RSS items and rules on success.
 */
export function useRemoveRssItem({
  scope,
  mutationFn,
  onSuccess,
}: UseRssMutationOptions<RemoveRssItemVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateRss(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Set (Create/Update) RSS Rule
// ---------------------------------------------------------------------------

export interface SetRssRuleVariables {
  ruleName: string;
  rule: RssRuleInput;
}

/**
 * Hook for creating or updating an RSS auto-download rule.
 * Only sends write-safe fields (excludes server-owned fields like lastMatch).
 * Invalidates RSS items and rules on success.
 */
export function useSetRssRule({
  scope,
  mutationFn,
  onSuccess,
}: UseRssMutationOptions<SetRssRuleVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateRss(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Rename RSS Rule
// ---------------------------------------------------------------------------

export interface RenameRssRuleVariables {
  ruleName: string;
  newRuleName: string;
}

/**
 * Hook for renaming an RSS auto-download rule.
 * Invalidates RSS items and rules on success.
 */
export function useRenameRssRule({
  scope,
  mutationFn,
  onSuccess,
}: UseRssMutationOptions<RenameRssRuleVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateRss(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Remove RSS Rule
// ---------------------------------------------------------------------------

export interface RemoveRssRuleVariables {
  ruleName: string;
}

/**
 * Hook for removing an RSS auto-download rule.
 * Invalidates RSS items and rules on success.
 */
export function useRemoveRssRule({
  scope,
  mutationFn,
  onSuccess,
}: UseRssMutationOptions<RemoveRssRuleVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateRss(queryClient, scope);
      onSuccess?.();
    },
  });
}
