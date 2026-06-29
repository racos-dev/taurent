import { useSearchFocusContext } from './useSearchFocusContext';

/** Returns a ref callback to attach to the toolbar search input. */
export function useSearchInputRef(): (el: HTMLInputElement | null) => void {
  const { registerSearchInput, unregisterSearchInput } = useSearchFocusContext();
  return (el) => {
    if (el) {
      registerSearchInput(el);
    } else {
      unregisterSearchInput();
    }
  };
}

/** Returns a focus function to call from keyboard shortcuts. */
export function useFocusSearch(): () => void {
  const { focusSearch } = useSearchFocusContext();
  return focusSearch;
}