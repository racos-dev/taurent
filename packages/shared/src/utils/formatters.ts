// Canonical source for all torrent-related formatting helpers.
// Do not duplicate these functions in mobile or desktop apps.

const BYTE_SIZES = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 0) {
    return 'Unlimited';
  }
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${BYTE_SIZES[i]}`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
  return formatBytes(bytesPerSecond) + '/s';
};

export const formatSpeedInKB = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 KB/s';
  if (bytesPerSecond < 0) return 'Unlimited';
  const kb = bytesPerSecond / 1024;
  return `${Number.isInteger(kb) ? kb : kb.toFixed(2)} KB/s`;
};

export const formatTime = (seconds: number | undefined): string => {
  if (seconds === undefined || seconds === null) {
    return 'N/A';
  }
  if (seconds < 0) {
    return '∞';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatRatio = (ratio: unknown): string => {
  if (ratio === undefined || ratio === null || typeof ratio !== 'number') {
    return 'N/A';
  }
  if (ratio < 0) {
    return '∞';
  }
  return ratio.toFixed(2);
};

export const formatEta = (seconds: number): string => {
  if (seconds === 0 || seconds === -1) {
    return '∞';
  }
  if (seconds < 0) {
    return '-';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  return `${Math.floor(seconds / 86400)}d`;
};

export const formatDate = (timestamp: number): string => {
  if (!timestamp) {
    return '-';
  }
  return new Date(timestamp * 1000).toLocaleDateString();
};

export const formatDateTime = (timestamp: number): string => {
  if (!timestamp) {
    return '-';
  }
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatProgress = (progress: number, decimals = 1): string => {
  return `${(progress * 100).toFixed(decimals)}%`;
};

export const formatPriority = (priority: number): string => {
  if (priority === 0) {
    return 'Skip';
  }
  if (priority === 1) {
    return 'Normal';
  }
  if (priority === 6) {
    return 'High';
  }
  if (priority === 7) {
    return 'Maximum';
  }
  return String(priority);
};

export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds === 0) {
    return '-';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  return `${Math.floor(seconds / 86400)}d`;
};

export const formatTags = (tags: string): string => {
  if (!tags) {
    return '-';
  }
  return tags.split(',').map((t) => t.trim()).filter(Boolean).join(', ') || '-';
};

export const formatTracker = (tracker: string): string => {
  if (!tracker) {
    return '-';
  }
  try {
    const url = new URL(tracker);
    return url.hostname || tracker;
  } catch {
    return tracker.length > 30 ? `${tracker.slice(0, 30)}...` : tracker;
  }
};

export const formatBoolean = (value: boolean): string => {
  return value ? 'Yes' : 'No';
};

export const formatCount = (count: number | undefined | null): string => {
  if (count === undefined || count === null || !Number.isFinite(count) || count < 0) {
    return '-';
  }
  return String(count);
};

export const formatCountFraction = (
  current: number | undefined | null,
  total: number | undefined | null,
): string => {
  return `${formatCount(current)} / ${formatCount(total)}`;
};

export const formatCountWithTotal = (
  current: number | undefined | null,
  total: number | undefined | null,
  totalSuffix = '',
): string => {
  const suffix = totalSuffix ? ` ${totalSuffix}` : '';
  return `${formatCount(current)} (${formatCount(total)}${suffix})`;
};

export const formatLabeledCount = (
  label: string,
  count: number | undefined | null,
): string => {
  return `${label} ${formatCount(count)}`;
};

export const formatLabel = (value: string): string => {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatAvailability = (availability: number): string => {
  if (!Number.isFinite(availability) || availability < 0) {
    return '-';
  }
  return availability.toFixed(3);
};

export const formatAvailabilityMultiplier = (
  availability: number | undefined | null,
  decimals = 2,
): string => {
  if (availability === undefined || availability === null || !Number.isFinite(availability) || availability < 0) {
    return '-';
  }
  return `${availability.toFixed(decimals)}x`;
};

export const formatAvailabilityPercent = (
  availability: number | undefined | null,
  decimals = 1,
): string => {
  if (availability === undefined || availability === null || !Number.isFinite(availability) || availability < 0) {
    return '-';
  }
  return `${(availability * 100).toFixed(decimals)}%`;
};

export const formatTransferLimit = (bytesPerSecond: number | undefined | null): string => {
  if (bytesPerSecond === undefined || bytesPerSecond === null || bytesPerSecond <= 0) {
    return '∞';
  }
  return formatSpeed(bytesPerSecond);
};

export const formatRatioLimit = (ratioLimit: number): string => {
  if (ratioLimit < 0) {
    return 'Global';
  }
  if (ratioLimit === 0) {
    return 'None';
  }
  return ratioLimit.toFixed(2);
};

export const formatSeenComplete = (timestamp: number): string => {
  if (!timestamp || timestamp < 0) {
    return 'Never';
  }
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatPopularity = (popularity: number | undefined): string => {
  if (popularity === undefined || popularity === null) {
    return '-';
  }
  return popularity.toFixed(3);
};

export const formatReannounce = (seconds: number | undefined): string => {
  if (seconds === undefined || seconds === null || seconds <= 0) {
    return '-';
  }
  return formatDuration(seconds);
};
