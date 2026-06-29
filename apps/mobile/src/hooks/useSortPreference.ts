import { useState, useEffect, useCallback } from 'react';
import { storage } from '../platform';
import type { SortField, SortOrder } from '@taurent/shared';

const SORT_BY_KEY = 'torrent_sort_by';
const SORT_ORDER_KEY = 'torrent_sort_order';

const DEFAULT_SORT_BY: SortField = 'added_on';
const DEFAULT_SORT_ORDER: SortOrder = 'desc';

const VALID_SORT_FIELDS: SortField[] = ['added_on', 'name', 'size', 'progress', 'dlspeed', 'upspeed', 'ratio', 'eta'];

interface SortConfig {
  sortBy: SortField;
  sortOrder: SortOrder;
}

function isValidSortField(value: string): value is SortField {
  return VALID_SORT_FIELDS.includes(value as SortField);
}

export function useSortPreference() {
  const [config, setConfig] = useState<SortConfig>({
    sortBy: DEFAULT_SORT_BY,
    sortOrder: DEFAULT_SORT_ORDER as SortOrder,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSortPreference = async () => {
      try {
        const savedSortBy = await storage.getItem(SORT_BY_KEY);
        const savedSortOrder = await storage.getItem(SORT_ORDER_KEY);

        if (savedSortBy && isValidSortField(savedSortBy)) {
          setConfig(prev => ({
            ...prev,
            sortBy: savedSortBy as SortField,
          }));
        }

        if (savedSortOrder && (savedSortOrder === 'asc' || savedSortOrder === 'desc')) {
          setConfig(prev => ({
            ...prev,
            sortOrder: savedSortOrder as SortOrder,
          }));
        }
      } catch (error) {
        console.error('Failed to load sort preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSortPreference();
  }, []);

  const setSortBy = useCallback((sortBy: SortField) => {
    setConfig(prev => ({ ...prev, sortBy }));
    storage.setItem(SORT_BY_KEY, sortBy).catch((error) => {
      console.error('Failed to save sort by preference:', error);
    });
  }, []);

  const setSortOrder = useCallback((sortOrder: SortOrder) => {
    setConfig(prev => ({ ...prev, sortOrder }));
    storage.setItem(SORT_ORDER_KEY, sortOrder).catch((error) => {
      console.error('Failed to save sort order preference:', error);
    });
  }, []);

  const setSortConfig = useCallback((sortBy: SortField, sortOrder: SortOrder) => {
    setSortBy(sortBy);
    setSortOrder(sortOrder);
  }, [setSortBy, setSortOrder]);

  const toggleSortDirection = useCallback(() => {
    const newOrder = config.sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
  }, [config.sortOrder, setSortOrder]);

  return {
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    isLoading,
    setSortBy,
    setSortOrder,
    setSortConfig,
    toggleSortDirection,
  };
}
