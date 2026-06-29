import { createContext } from 'react';

interface SearchFocusContextValue {
  registerSearchInput: (el: HTMLInputElement) => void;
  unregisterSearchInput: () => void;
  focusSearch: () => void;
}

export const SearchFocusContext = createContext<SearchFocusContextValue | null>(null);