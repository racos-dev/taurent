// Desktop settings hooks — wired via shared createPlatformHooks factory.
// Re-exports only; all logic lives in @taurent/web-core.


export {
  usePreferences,
  useUpdatePreference,
  useSetPreferences,
  useSetGlobalDownloadLimit,
  useSetGlobalUploadLimit,
  useToggleSpeedLimitsMode,
} from '../platform';
