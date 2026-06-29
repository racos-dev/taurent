// Headless hook for deriving active filter summary items.
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Consumed by mobile HomeScreen to render the active filter summary row.
// Desktop adoption is deferred intentionally.

import { useMemo } from 'react';
import { formatLabel } from '@taurent/shared';

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
  return useMemo(() => {
    const items: FilterSummaryItem[] = [];

    if (filter) {
      items.push({ label: formatLabel(filter), tone: 'primary' });
    }

    if (category) {
      items.push({ label: `Category: ${category}` });
    }

    if (tag) {
      items.push({ label: `Tag: ${tag}` });
    }

    if (tracker) {
      try {
        const trackerHostname = new URL(tracker).hostname;
        items.push({ label: `Tracker: ${trackerHostname}` });
      } catch {
        items.push({ label: `Tracker: ${tracker}` });
      }
    }

    if (search) {
      items.push({ label: `Search: ${search}` });
    }

    return items;
  }, [category, filter, search, tag, tracker]);
}
