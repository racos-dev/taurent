import { useRef } from 'react';
import { SearchFocusContext } from './SearchFocusContext';

export function SearchFocusProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement | null>(null);

  const registerSearchInput = (el: HTMLInputElement) => {
    ref.current = el;
  };

  const unregisterSearchInput = () => {
    ref.current = null;
  };

  const focusSearch = () => {
    ref.current?.focus();
  };

  return (
    <SearchFocusContext.Provider value={{ registerSearchInput, unregisterSearchInput, focusSearch }}>
      {children}
    </SearchFocusContext.Provider>
  );
}