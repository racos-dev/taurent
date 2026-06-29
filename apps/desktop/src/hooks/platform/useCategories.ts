// Desktop categories hooks — wired via shared createPlatformHooks factory.
// Re-exports only; all logic lives in @taurent/web-core.

export {
  useCategories,
  useCreateCategory,
  useEditCategory,
  useRemoveCategories,
  useSetTorrentCategory,
} from './platform';
