import { useMemo } from 'react';
import { useLocalization, useTaurentTranslation } from './LocalizationProvider';
import type { SupportedLocale, TaurentTFunction } from './types';
import { localizeTorrentDetailedState } from '../utils/torrentStatus';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function createLocalizedFormatters(locale: SupportedLocale, t: TaurentTFunction) {
  const number = (
    value: number,
    minimumFractionDigits: number,
    maximumFractionDigits = minimumFractionDigits,
  ) => new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);

  const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 0) return t('values.unlimited', { ns: 'common' });
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      BYTE_UNITS.length - 1,
    );
    return `${number(bytes / Math.pow(1024, unitIndex), decimals)} ${BYTE_UNITS[unitIndex]}`;
  };

  const formatCompactDuration = (seconds: number): string => {
    if (seconds < 60) return `${number(seconds, 0)}${t('units.secondShort', { ns: 'common' })}`;
    if (seconds < 3600) {
      return `${number(Math.floor(seconds / 60), 0)}${t('units.minuteShort', { ns: 'common' })}`;
    }
    if (seconds < 86400) {
      return `${number(Math.floor(seconds / 3600), 0)}${t('units.hourShort', { ns: 'common' })}`;
    }
    return `${number(Math.floor(seconds / 86400), 0)}${t('units.dayShort', { ns: 'common' })}`;
  };

  return {
    formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
      return new Intl.NumberFormat(locale, options).format(value);
    },
    formatBytes,
    formatBoolean(value: boolean): string {
      return t(value ? 'values.yes' : 'values.no', { ns: 'common' });
    },
    formatCount(value: number | null | undefined): string {
      if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '-';
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    },
    formatDate(timestamp: number): string {
      if (!timestamp) return '-';
      return new Intl.DateTimeFormat(locale).format(new Date(timestamp * 1000));
    },
    formatDateTime(timestamp: number): string {
      if (!timestamp) return '-';
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(timestamp * 1000));
    },
    formatDuration(seconds: number): string {
      if (!Number.isFinite(seconds) || seconds <= 0) return '-';
      return formatCompactDuration(seconds);
    },
    formatEta(seconds: number): string {
      if (seconds === 0 || seconds === -1) return '∞';
      if (!Number.isFinite(seconds) || seconds < 0) return '-';
      return formatCompactDuration(seconds);
    },
    formatPercent(value: number, decimals = 1): string {
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    },
    formatPriority(priority: number): string {
      if (priority === 0) return t('values.skip', { ns: 'common' });
      if (priority === 1) return t('values.normal', { ns: 'common' });
      if (priority === 6) return t('values.high', { ns: 'common' });
      if (priority === 7) return t('values.maximum', { ns: 'common' });
      return String(priority);
    },
    formatRatio(value: number | null | undefined, decimals = 2): string {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return t('values.notAvailable', { ns: 'common' });
      }
      if (value < 0) return '∞';
      return number(value, decimals);
    },
    formatSpeed(bytesPerSecond: number, decimals = 2): string {
      if (bytesPerSecond < 0) return t('values.unlimited', { ns: 'common' });
      const formatted = formatBytes(bytesPerSecond, decimals);
      return `${formatted}${t('units.perSecond', { ns: 'common' })}`;
    },
    formatTorrentState(state: string): string {
      return localizeTorrentDetailedState(state, (key) => t(key, { ns: 'torrents' }));
    },
  };
}

export function useLocalizedFormatters() {
  const { locale } = useLocalization();
  const { t } = useTaurentTranslation();
  return useMemo(() => createLocalizedFormatters(locale, t), [locale, t]);
}
