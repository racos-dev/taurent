import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatSpeed,
  formatTime,
  formatRatio,
  formatEta,
  formatDate,
  formatDateTime,
  formatProgress,
  formatPriority,
  formatDuration,
  formatTags,
  formatTracker,
  formatBoolean,
  formatCount,
  formatCountFraction,
  formatCountWithTotal,
  formatLabeledCount,
  formatLabel,
  formatAvailability,
  formatAvailabilityMultiplier,
  formatAvailabilityPercent,
  formatTransferLimit,
  formatRatioLimit,
  formatSeenComplete,
  formatPopularity,
  formatReannounce,
} from '../formatters';

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns Unlimited for negative values', () => {
    expect(formatBytes(-1)).toBe('Unlimited');
    expect(formatBytes(-100)).toBe('Unlimited');
  });

  it('formats bytes in B', () => {
    expect(formatBytes(500)).toBe('500.00 B');
  });

  it('formats KB', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('formats MB', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(5242880)).toBe('5.00 MB');
  });

  it('formats GB', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });

  it('formats TB', () => {
    expect(formatBytes(1099511627776)).toBe('1.00 TB');
  });

  it('respects decimal parameter', () => {
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
    expect(formatBytes(1536, 0)).toBe('2 KB');
  });

  it('handles very small fractional KB', () => {
    expect(formatBytes(1)).toBe('1.00 B');
  });
});

// ─── formatSpeed ─────────────────────────────────────────────────────────────

describe('formatSpeed', () => {
  it('appends /s to formatBytes output', () => {
    expect(formatSpeed(1024)).toBe('1.00 KB/s');
    expect(formatSpeed(0)).toBe('0 B/s');
  });

  it('handles large speeds', () => {
    expect(formatSpeed(1048576)).toBe('1.00 MB/s');
  });
});

// ─── formatTime ─────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('returns N/A for undefined', () => {
    expect(formatTime(undefined)).toBe('N/A');
  });

  it('returns N/A for null', () => {
    expect(formatTime(null as unknown as number | undefined)).toBe('N/A');
  });

  it('returns ∞ for negative seconds', () => {
    expect(formatTime(-1)).toBe('∞');
    expect(formatTime(-100)).toBe('∞');
  });

  it('formats minutes when hours are zero', () => {
    expect(formatTime(30)).toBe('0m');
    expect(formatTime(60)).toBe('1m');
    expect(formatTime(3599)).toBe('59m');
  });

  it('formats hours and minutes for 1-23 hours', () => {
    expect(formatTime(3600)).toBe('1h 0m');
    expect(formatTime(3660)).toBe('1h 1m');
    expect(formatTime(7200)).toBe('2h 0m');
  });

  it('formats days for 24+ hours', () => {
    expect(formatTime(86400)).toBe('1d 0h');
    expect(formatTime(90000)).toBe('1d 1h');
  });
});

// ─── formatRatio ─────────────────────────────────────────────────────────────

describe('formatRatio', () => {
  it('returns N/A for undefined', () => {
    expect(formatRatio(undefined)).toBe('N/A');
  });

  it('returns N/A for null', () => {
    expect(formatRatio(null as unknown as number | undefined)).toBe('N/A');
  });

  it('returns ∞ for negative ratio', () => {
    expect(formatRatio(-1)).toBe('∞');
  });

  it('formats ratio to 2 decimal places', () => {
    expect(formatRatio(0)).toBe('0.00');
    expect(formatRatio(1)).toBe('1.00');
    expect(formatRatio(1.234)).toBe('1.23');
  });
});

// ─── formatEta ──────────────────────────────────────────────────────────────

describe('formatEta', () => {
  it('returns ∞ for 0', () => {
    expect(formatEta(0)).toBe('∞');
  });

  it('returns ∞ for -1', () => {
    expect(formatEta(-1)).toBe('∞');
  });

  it('returns - for other negative values', () => {
    expect(formatEta(-10)).toBe('-');
  });

  it('formats seconds for < 60', () => {
    expect(formatEta(30)).toBe('30s');
    expect(formatEta(59)).toBe('59s');
  });

  it('formats minutes for < 3600', () => {
    expect(formatEta(60)).toBe('1m');
    expect(formatEta(300)).toBe('5m');
    expect(formatEta(3599)).toBe('59m');
  });

  it('formats hours for < 86400', () => {
    expect(formatEta(3600)).toBe('1h');
    expect(formatEta(7200)).toBe('2h');
    expect(formatEta(86399)).toBe('23h');
  });

  it('formats days for >= 86400', () => {
    expect(formatEta(86400)).toBe('1d');
    expect(formatEta(172800)).toBe('2d');
  });
});

// ─── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns - for zero timestamp', () => {
    expect(formatDate(0)).toBe('-');
  });

  it('returns - for falsy timestamp', () => {
    expect(formatDate(0)).toBe('-');
    expect(formatDate(NaN)).toBe('-');
  });

  it('formats non-zero timestamp as locale date string', () => {
    // Unix timestamp 1704067200 = 2024-01-01 00:00:00 UTC
    const ts = 1704067200;
    const result = formatDate(ts);
    expect(result).toContain('2024');
  });
});

// ─── formatDateTime ─────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('returns - for zero timestamp', () => {
    expect(formatDateTime(0)).toBe('-');
  });

  it('returns - for falsy timestamp', () => {
    expect(formatDateTime(0)).toBe('-');
  });

  it('formats non-zero timestamp as locale string', () => {
    const ts = 1704067200;
    const result = formatDateTime(ts);
    expect(result).toContain('2024');
    expect(result).toContain(':');
  });
});

// ─── formatProgress ──────────────────────────────────────────────────────────

describe('formatProgress', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatProgress(0)).toBe('0.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatProgress(1)).toBe('100.0%');
  });

  it('formats 0.5 as 50.0%', () => {
    expect(formatProgress(0.5)).toBe('50.0%');
  });

  it('formats fractional progress', () => {
    expect(formatProgress(0.123)).toBe('12.3%');
  });
});

// ─── formatPriority ─────────────────────────────────────────────────────────

describe('formatPriority', () => {
  it('returns Skip for 0', () => {
    expect(formatPriority(0)).toBe('Skip');
  });

  it('returns Normal for 1', () => {
    expect(formatPriority(1)).toBe('Normal');
  });

  it('returns High for 6', () => {
    expect(formatPriority(6)).toBe('High');
  });

  it('returns Maximum for 7', () => {
    expect(formatPriority(7)).toBe('Maximum');
  });

  it('returns string representation for unknown values', () => {
    expect(formatPriority(3)).toBe('3');
    expect(formatPriority(99)).toBe('99');
  });
});

// ─── formatDuration ─────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns - for zero/falsy', () => {
    expect(formatDuration(0)).toBe('-');
    expect(formatDuration(null as unknown as number)).toBe('-');
  });

  it('formats seconds for < 60', () => {
    expect(formatDuration(30)).toBe('30s');
  });

  it('formats minutes for < 3600', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats hours for < 86400', () => {
    expect(formatDuration(7200)).toBe('2h');
  });

  it('formats days for >= 86400', () => {
    expect(formatDuration(172800)).toBe('2d');
  });
});

// ─── formatTags ─────────────────────────────────────────────────────────────

describe('formatTags', () => {
  it('returns - for empty/falsy', () => {
    expect(formatTags('')).toBe('-');
    expect(formatTags(null as unknown as string)).toBe('-');
  });

  it('splits on comma and joins with comma + space', () => {
    expect(formatTags('tag-a,tag-b,tag-c')).toBe('tag-a, tag-b, tag-c');
  });

  it('trims whitespace from individual tags', () => {
    expect(formatTags(' tag-a , tag-b ')).toBe('tag-a, tag-b');
  });

  it('filters empty segments', () => {
    expect(formatTags('tag-a,,tag-b')).toBe('tag-a, tag-b');
    expect(formatTags('tag-a, ,tag-b')).toBe('tag-a, tag-b');
  });

  it('returns - when all segments are empty', () => {
    expect(formatTags(',,')).toBe('-');
  });
});

// ─── formatTracker ──────────────────────────────────────────────────────────

describe('formatTracker', () => {
  it('returns - for empty/falsy', () => {
    expect(formatTracker('')).toBe('-');
    expect(formatTracker(null as unknown as string)).toBe('-');
  });

  it('returns hostname for valid URL', () => {
    expect(formatTracker('http://tracker.example.com/announce')).toBe('tracker.example.com');
  });

  it('returns the full URL if it has no path', () => {
    expect(formatTracker('http://tracker.example.com')).toBe('tracker.example.com');
  });

  it('returns hostname from https URL', () => {
    expect(formatTracker('https://tracker.example.com/announce')).toBe('tracker.example.com');
  });

  it('returns full tracker if URL parse fails', () => {
    expect(formatTracker('not-a-valid-url')).toBe('not-a-valid-url');
  });

  it('truncates long trackers > 30 chars without a valid URL', () => {
    const long = 'this_is_a_very_long_tracker_string_that_exceeds_thirty';
    expect(formatTracker(long)).toBe('this_is_a_very_long_tracker_st...');
  });
});

// ─── formatBoolean ──────────────────────────────────────────────────────────

describe('formatBoolean', () => {
  it('returns Yes for true', () => {
    expect(formatBoolean(true)).toBe('Yes');
  });

  it('returns No for false', () => {
    expect(formatBoolean(false)).toBe('No');
  });
});

// ─── formatCount ─────────────────────────────────────────────────────────────

describe('formatCount', () => {
  it('returns - for undefined', () => {
    expect(formatCount(undefined)).toBe('-');
  });

  it('returns - for null', () => {
    expect(formatCount(null as unknown as number | undefined)).toBe('-');
  });

  it('returns string representation for valid numbers', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(42)).toBe('42');
  });

  it('returns - for negative and non-finite counts', () => {
    expect(formatCount(-1)).toBe('-');
    expect(formatCount(Number.NaN)).toBe('-');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('-');
  });
});

describe('formatCountFraction', () => {
  it('formats current and total counts with sentinel masking', () => {
    expect(formatCountFraction(2, 5)).toBe('2 / 5');
    expect(formatCountFraction(-1, 5)).toBe('- / 5');
    expect(formatCountFraction(2, -1)).toBe('2 / -');
  });
});

describe('formatCountWithTotal', () => {
  it('formats parenthesized totals with optional suffix', () => {
    expect(formatCountWithTotal(2, 5)).toBe('2 (5)');
    expect(formatCountWithTotal(2, 5, 'total')).toBe('2 (5 total)');
    expect(formatCountWithTotal(-1, -1, 'total')).toBe('- (- total)');
  });
});

describe('formatLabeledCount', () => {
  it('keeps labels while masking invalid counts', () => {
    expect(formatLabeledCount('Seeds', 3)).toBe('Seeds 3');
    expect(formatLabeledCount('Tier', -1)).toBe('Tier -');
  });
});

// ─── formatLabel ─────────────────────────────────────────────────────────────

describe('formatLabel', () => {
  it('replaces underscores and hyphens with spaces', () => {
    expect(formatLabel('my_label')).toBe('My Label');
    expect(formatLabel('my-label')).toBe('My Label');
  });

  it('normalizes multiple spaces to one', () => {
    expect(formatLabel('my  label')).toBe('My Label');
  });

  it('capitalizes first letter of each word', () => {
    expect(formatLabel('ubuntu desktop')).toBe('Ubuntu Desktop');
  });

  it('trims whitespace', () => {
    expect(formatLabel('  ubuntu  ')).toBe('Ubuntu');
  });

  it('handles mixed underscore and hyphen', () => {
    expect(formatLabel('my_file-name.iso')).toBe('My File Name.Iso');
  });
});

// ─── formatAvailability ──────────────────────────────────────────────────────

describe('formatAvailability', () => {
  it('returns - for negative values', () => {
    expect(formatAvailability(-1)).toBe('-');
    expect(formatAvailability(-100)).toBe('-');
    expect(formatAvailability(Number.NaN)).toBe('-');
  });

  it('formats positive values to 3 decimal places', () => {
    expect(formatAvailability(0)).toBe('0.000');
    expect(formatAvailability(1)).toBe('1.000');
    expect(formatAvailability(0.5)).toBe('0.500');
  });
});

describe('formatAvailabilityMultiplier', () => {
  it('masks unavailable sentinels instead of rendering negative multipliers', () => {
    expect(formatAvailabilityMultiplier(-1)).toBe('-');
    expect(formatAvailabilityMultiplier(undefined)).toBe('-');
    expect(formatAvailabilityMultiplier(Number.NaN)).toBe('-');
  });

  it('formats available values with an x suffix', () => {
    expect(formatAvailabilityMultiplier(0)).toBe('0.00x');
    expect(formatAvailabilityMultiplier(1.234)).toBe('1.23x');
    expect(formatAvailabilityMultiplier(1.234, 3)).toBe('1.234x');
  });
});

describe('formatAvailabilityPercent', () => {
  it('masks unavailable sentinels instead of rendering a fake 0 percent', () => {
    expect(formatAvailabilityPercent(-1)).toBe('-');
    expect(formatAvailabilityPercent(null)).toBe('-');
  });

  it('formats available values as percentages', () => {
    expect(formatAvailabilityPercent(0)).toBe('0.0%');
    expect(formatAvailabilityPercent(0.456)).toBe('45.6%');
  });
});

describe('formatTransferLimit', () => {
  it('formats missing, zero, and negative limits as unlimited', () => {
    expect(formatTransferLimit(undefined)).toBe('∞');
    expect(formatTransferLimit(0)).toBe('∞');
    expect(formatTransferLimit(-1)).toBe('∞');
  });

  it('formats positive limits as speeds', () => {
    expect(formatTransferLimit(1024)).toBe('1.00 KB/s');
  });
});

// ─── formatRatioLimit ───────────────────────────────────────────────────────

describe('formatRatioLimit', () => {
  it('returns Global for negative values', () => {
    expect(formatRatioLimit(-1)).toBe('Global');
  });

  it('returns None for 0', () => {
    expect(formatRatioLimit(0)).toBe('None');
  });

  it('formats positive ratio to 2 decimal places', () => {
    expect(formatRatioLimit(1)).toBe('1.00');
    expect(formatRatioLimit(1.5)).toBe('1.50');
  });
});

// ─── formatSeenComplete ─────────────────────────────────────────────────────

describe('formatSeenComplete', () => {
  it('returns Never for zero', () => {
    expect(formatSeenComplete(0)).toBe('Never');
  });

  it('returns Never for negative timestamp', () => {
    expect(formatSeenComplete(-1)).toBe('Never');
  });

  it('formats non-zero positive timestamp as locale string', () => {
    const ts = 1704067200;
    const result = formatSeenComplete(ts);
    expect(result).toContain('2024');
  });
});

// ─── formatPopularity ───────────────────────────────────────────────────────

describe('formatPopularity', () => {
  it('returns - for undefined', () => {
    expect(formatPopularity(undefined)).toBe('-');
  });

  it('returns - for null', () => {
    expect(formatPopularity(null as unknown as number | undefined)).toBe('-');
  });

  it('formats valid popularity to 3 decimal places', () => {
    expect(formatPopularity(0)).toBe('0.000');
    expect(formatPopularity(1.5)).toBe('1.500');
  });
});

// ─── formatReannounce ───────────────────────────────────────────────────────

describe('formatReannounce', () => {
  it('returns - for undefined', () => {
    expect(formatReannounce(undefined)).toBe('-');
  });

  it('returns - for null', () => {
    expect(formatReannounce(null as unknown as number | undefined)).toBe('-');
  });

  it('returns - for zero', () => {
    expect(formatReannounce(0)).toBe('-');
  });

  it('returns - for negative values', () => {
    expect(formatReannounce(-1)).toBe('-');
  });

  it('formats positive seconds using formatDuration', () => {
    expect(formatReannounce(30)).toBe('30s');
    expect(formatReannounce(120)).toBe('2m');
  });
});
