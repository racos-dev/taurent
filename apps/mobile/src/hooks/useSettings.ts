// Mobile settings hooks — wired via shared createPlatformHooks factory.
// Re-exports only; all logic lives in @taurent/web-core.

// Re-export shared Preferences type for mobile consumers.
export type { Preferences } from '@taurent/shared';

export {
  usePreferences,
  useUpdatePreference,
  useSetPreferences,
  useSetGlobalDownloadLimit,
  useSetGlobalUploadLimit,
  useToggleSpeedLimitsMode,
} from './platform';
