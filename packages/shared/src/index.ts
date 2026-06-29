export * from './types/qbittorrent';
export type { Server } from './types/server';
export * from './types/auth';

export * from './schemas/addTorrent';

export * from './theme/helpers';
export * from './theme/motion';
export * from './theme/registry';
export * from './theme/resolver';
export * from './theme/tokens';
export type { ThemePalette, ThemeVariant, AccentHex, AccentPreference } from './theme/types';
export { normalizeAccent, isAccentValue, deriveMidnightAccentTokens, getContrastText, serializeAccentCss } from './theme/accent';

// Global type augmentations
import './types/globals';

export * from './platform';

export * from './utils/sortTorrents';
export * from './utils/maindata';
export * from './utils/logger';
export * from './utils/server-url';
export * from './utils/torrentFilter';
export * from './utils/deriveTrackerEntries';
export * from './utils/formatters';
export * from './utils/torrentStatus';
export * from './utils/buildMetadata';
export { cn } from './utils/cn';
export { measure, measureAsync, flushAudit, count, flushCounters, isPerfAuditEnabled } from './utils/perfAudit';

export * from './icons/index';
export { RatioIcon } from './icons/custom';
export { ICON_SIZES, type IconSize } from './icons/sizes';
export { Icon, type AppIconName } from './components/Icon/Icon';
export { StatusBadge, StatusDot, type StatusType, type StatusBadgeSize } from './components/StatusBadge';
