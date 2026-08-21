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

  return {
    formatBytes(bytes: number, decimals = 2): string {
      if (bytes === 0) return '0 B';
      if (bytes < 0) return t('values.unlimited', { ns: 'common' });
      const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        BYTE_UNITS.length - 1,
      );
      return `${number(bytes / Math.pow(1024, unitIndex), decimals)} ${BYTE_UNITS[unitIndex]}`;
    },
    formatBoolean(value: boolean): string {
      return t(value ? 'values.yes' : 'values.no', { ns: 'common' });
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
    formatPriority(priority: number): string {
      if (priority === 0) return t('values.skip', { ns: 'common' });
      if (priority === 1) return t('values.normal', { ns: 'common' });
      if (priority === 6) return t('values.high', { ns: 'common' });
      if (priority === 7) return t('values.maximum', { ns: 'common' });
      return String(priority);
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
