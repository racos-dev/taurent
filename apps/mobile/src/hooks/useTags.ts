// Mobile tags hooks — wired via shared createPlatformHooks factory.
// Re-exports only; all logic lives in @taurent/web-core.

export {
  useTags,
  useCreateTags,
  useDeleteTags,
  useAddTorrentTags,
  useRemoveTorrentTags,
} from './platform';
