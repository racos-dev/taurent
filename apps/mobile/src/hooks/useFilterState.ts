import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isTorrentFilterType, type TorrentFilterType } from '@taurent/shared';

export interface FilterState {
  selectedFilter: TorrentFilterType | null;
  selectedCategory: string | null;
  selectedTag: string | null;
  selectedTracker: string | null;
}

export function useFilterState() {
  const [searchParams] = useSearchParams();

  const rawFilter = searchParams.get('selectedFilter');
  const initialFilter = rawFilter && isTorrentFilterType(rawFilter) && rawFilter !== 'all'
    ? rawFilter
    : null;
  const initialCategory = searchParams.get('selectedCategory') || null;
  const initialTag = searchParams.get('selectedTag') || null;
  const initialTracker = searchParams.get('selectedTracker') || null;

  const [selectedFilter, setSelectedFilter] = useState<TorrentFilterType | null>(
    initialFilter || null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const [selectedTracker, setSelectedTracker] = useState<string | null>(initialTracker);

  const handleFilterSelect = useCallback((value: string) => {
    setSelectedFilter(value === 'all' || !isTorrentFilterType(value) ? null : value);
  }, []);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
  }, []);

  const handleTagSelect = useCallback((tag: string | null) => {
    setSelectedTag(tag);
  }, []);

  const handleTrackerSelect = useCallback((tracker: string | null) => {
    setSelectedTracker(tracker);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedFilter(null);
    setSelectedCategory(null);
    setSelectedTag(null);
    setSelectedTracker(null);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return selectedFilter !== null || selectedCategory !== null || selectedTag !== null || selectedTracker !== null;
  }, [selectedFilter, selectedCategory, selectedTag, selectedTracker]);

  const getQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCategory) {
      params.set('selectedCategory', selectedCategory);
    }
    if (selectedTag) {
      params.set('selectedTag', selectedTag);
    }
    if (selectedFilter && selectedFilter !== 'all') {
      params.set('selectedFilter', selectedFilter);
    }
    if (selectedTracker) {
      params.set('selectedTracker', selectedTracker);
    }
    return params.toString();
  }, [selectedCategory, selectedTag, selectedFilter, selectedTracker]);

  return {
    selectedFilter,
    selectedCategory,
    selectedTag,
    selectedTracker,
    setSelectedFilter: handleFilterSelect,
    setSelectedCategory: handleCategorySelect,
    setSelectedTag: handleTagSelect,
    setSelectedTracker: handleTrackerSelect,
    clearFilters,
    hasActiveFilters,
    getQueryString,
  };
}
