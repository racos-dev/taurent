import { useContext } from 'react';
import { SearchFocusContext } from './SearchFocusContext';

export function useSearchFocusContext() {
  const ctx = useContext(SearchFocusContext);
  if (!ctx) {
    throw new Error('useSearchFocusContext must be used within SearchFocusProvider');
  }
  return ctx;
}