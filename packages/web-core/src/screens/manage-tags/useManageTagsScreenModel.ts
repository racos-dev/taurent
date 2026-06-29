/**
 * Manage Tags Screen Model Hook
 *
 * Composes the tags query with create/delete mutations
 * into a flat result object consumed by ManageTagsBody.
 *
 * Usage:
 *   const model = useManageTagsScreenModel({
 *     scope: { serverId, sessionGeneration, isConnected },
 *     adapters: {
 *       getTags: () => BridgeAdapter.tags.getTags(),
 *       createTags: (tags) => BridgeAdapter.tags.createTags(tags),
 *       deleteTags: (tags) => BridgeAdapter.tags.deleteTags(tags),
 *     },
 *   });
 *
 *   <ManageTagsBody
 *     variant="desktop"
 *     tags={model.tags}
 *     isLoading={model.isLoading}
 *     refetch={model.refetch}
 *     onCreateTag={model.onCreateTag}
 *     onDeleteTag={model.onDeleteTag}
 *     isCreating={model.isCreating}
 *     isDeleting={model.isDeleting}
 *     mutationError={model.mutationError}
 *   />
 */

import type { QueryScope } from '../../query/scope';
import { formatUserMessage } from '@taurent/shared/utils/error';
import { useTags } from '../../hooks/useTags';
import {
  useCreateTags,
  useDeleteTags,
} from '../../hooks/useTagMutations';

export interface ManageTagsScreenModelOptions {
  scope: QueryScope;
  adapters: {
    getTags: () => Promise<string[]>;
    createTags: (tags: string[]) => Promise<unknown>;
    deleteTags: (tags: string[]) => Promise<unknown>;
  };
}

export interface ManageTagsScreenModelResult {
  tags: string[] | undefined;
  isLoading: boolean;
  refetch: () => void;
  onCreateTag: (tagName: string) => void;
  onDeleteTag: (tagName: string) => void;
  isCreating: boolean;
  isDeleting: boolean;
  mutationError: string | null;
}

export function useManageTagsScreenModel({
  scope,
  adapters,
}: ManageTagsScreenModelOptions): ManageTagsScreenModelResult {
  const { tags, isLoading, refetch } = useTags({
    scope,
    queryFn: adapters.getTags,
  });

  const createTags = useCreateTags({
    scope,
    mutationFn: (vars) => adapters.createTags(vars),
  });

  const deleteTags = useDeleteTags({
    scope,
    mutationFn: (vars) => adapters.deleteTags(vars),
  });

  return {
    tags,
    isLoading,
    refetch,
    onCreateTag: (tagName) => createTags.mutate([tagName]),
    onDeleteTag: (tagName) => deleteTags.mutate([tagName]),
    isCreating: createTags.isPending,
    isDeleting: deleteTags.isPending,
    mutationError:
      (createTags.error ? formatUserMessage(createTags.error) : null) ||
      (deleteTags.error ? formatUserMessage(deleteTags.error) : null) ||
      null,
  };
}