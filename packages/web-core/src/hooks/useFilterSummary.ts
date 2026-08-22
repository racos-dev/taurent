// Headless hook for deriving active filter summary items.
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Consumed by mobile HomeScreen to render the active filter summary row.
// Desktop adoption is deferred intentionally.

import { useMemo } from 'react';
import { formatLabel, getTorrentFilterLabelKey } from '@taurent/shared';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export interface FilterSummaryItem {
  label: string;
  tone?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
}

export interface UseFilterSummaryOptions {
  filter: string | null;
  category: string | null;
  tag: string | null;
  tracker: string | null;
  search: string | null;
}

export function useFilterSummary({
  filter,
  category,
  tag,
  tracker,
  search,
}: UseFilterSummaryOptions): FilterSummaryItem[] {
  const { t } = useTaurentTranslation('torrents');
  return useMemo(() => {
    const items: FilterSummaryItem[] = [];

    if (filter) {
      const labelKey = getTorrentFilterLabelKey(filter);
      items.push({ label: labelKey ? t(labelKey) : formatLabel(filter), tone: 'primary' });
    }

    if (category) {
      items.push({ label: t('summary.category', { value: category }) });
    }

    if (tag) {
      items.push({ label: t('summary.tag', { value: tag }) });
    }

    if (tracker) {
      try {
        const trackerHostname = new URL(tracker).hostname;
        items.push({ label: t('summary.tracker', { value: trackerHostname }) });
      } catch {
        items.push({ label: t('summary.tracker', { value: tracker }) });
      }
    }

    if (search) {
      items.push({ label: t('summary.search', { value: search }) });
    }

    return items;
  }, [category, filter, search, t, tag, tracker]);
}
