// Platform hooks barrel — re-exports platform.ts for ../platform consumers.
export {
	usePreferences,
	useUpdatePreference,
	useSetPreferences,
	useSetGlobalDownloadLimit,
	useSetGlobalUploadLimit,
	useToggleSpeedLimitsMode,
} from './platform';