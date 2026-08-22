import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  applyLanguagePreference,
  getLanguageState,
  initializeLocalization,
  localization,
  refreshSystemLanguage,
  subscribeLanguageState,
} from './runtime';
import type { AppNamespace, LanguagePreference, LocalizationContextValue } from './types';

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function LocalizationStateProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeLanguageState, getLanguageState, getLanguageState);
  const { t } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);

  const setPreference = useCallback(async (preference: LanguagePreference) => {
    setIsChanging(true);
    try {
      await applyLanguagePreference(preference);
    } finally {
      setIsChanging(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLanguageChange = () => {
      void refreshSystemLanguage();
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const value = useMemo<LocalizationContextValue>(() => ({
    ...state,
    t,
    isChanging,
    setPreference,
  }), [isChanging, setPreference, state, t]);

  return createElement(LocalizationContext.Provider, { value }, children);
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initializeLocalization();
  }, []);

  return createElement(
    I18nextProvider,
    { i18n: localization, defaultNS: 'common' },
    createElement(LocalizationStateProvider, null, children),
  );
}

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used within LocalizationProvider');
  return context;
}

/** Read the active locale without requiring the context provider. */
export function useCurrentLocale() {
  return useSyncExternalStore(subscribeLanguageState, getLanguageState, getLanguageState).locale;
}

export function useTaurentTranslation<N extends AppNamespace = 'common'>(
  namespace: N = 'common' as N,
) {
  return useTranslation<N>(namespace, { i18n: localization, useSuspense: false });
}
